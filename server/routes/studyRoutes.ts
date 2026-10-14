import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';
import { askAiTutor } from '../ai.js';

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.doc', '.docx', '.md', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Please upload PDF, TXT, or DOC.`));
    }
  },
});

// List study materials
router.get('/materials', authMiddleware, (req: Request, res: Response) => {
  const { subjectId, classSection } = req.query;
  const user = (req as any).user;

  const materials = db.collection('studyMaterials').find((m) => {
    if (subjectId && m.subjectId !== subjectId) return false;
    if (classSection && m.classSection !== classSection) return false;
    // If student, restrict to materials of their classSection
    if (user.role === 'student' && user.classSection && m.classSection && m.classSection !== user.classSection) {
      return false;
    }
    return true;
  });

  res.json(materials);
});

// Upload study material
router.post('/upload', authMiddleware, requireRole(['faculty', 'admin']), upload.single('document'), async (req: Request, res: Response) => {
  const file = req.file;
  const { title, subjectId, subjectName, classSection } = req.body;
  const user = (req as any).user;

  if (!file) {
    res.status(400).json({ error: 'Please select a document file to upload.' });
    return;
  }

  if (!title || !subjectId) {
    res.status(400).json({ error: 'Document title and subject are required.' });
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  let extractedText = '';
  let pageCount = 1;
  let processingStatus = 'PROCESSING';

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || '';
      pageCount = pdfData.numpages || 1;
    } else if (['.txt', '.md', '.json'].includes(ext)) {
      extractedText = fs.readFileSync(file.path, 'utf-8');
    } else {
      extractedText = `Content of document: ${title} (${file.originalname})`;
    }
    processingStatus = 'READY';
  } catch (err: any) {
    console.error('[STUDY] Text extraction failed:', err);
    processingStatus = 'ERROR';
    extractedText = `Error parsing document: ${err.message}`;
  }

  // Chunking text into semantically cohesive passages
  const chunkSize = 800;
  const chunks: string[] = [];
  for (let i = 0; i < extractedText.length; i += chunkSize) {
    chunks.push(extractedText.slice(i, i + chunkSize));
  }

  const newDoc = db.collection('studyMaterials').insertOne({
    title,
    fileName: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    fileType: ext,
    subjectId,
    subjectName: subjectName || 'Subject Course',
    classSection: classSection || '',
    facultyId: user._id || user.id,
    facultyName: user.name,
    pageCount,
    extractedLength: extractedText.length,
    extractedText,
    chunkCount: chunks.length,
    status: processingStatus,
    uploadedAt: new Date().toISOString(),
  });

  recordAudit(
    user,
    'UPLOAD_STUDY_MATERIAL',
    'study_material',
    newDoc._id,
    `Uploaded material "${title}" for subject ${subjectName || subjectId} (${chunks.length} chunks generated)`
  );

  res.status(201).json({
    message: 'Study material uploaded and indexed successfully.',
    material: newDoc,
  });
});

// Delete study material
router.delete('/materials/:id', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const item = db.collection('studyMaterials').findById(id);
  if (!item) {
    res.status(404).json({ error: 'Material not found.' });
    return;
  }

  db.collection('studyMaterials').deleteOne(id);
  if (item.filePath && fs.existsSync(item.filePath)) {
    try {
      fs.unlinkSync(item.filePath);
    } catch (e) {}
  }

  recordAudit(user, 'DELETE_STUDY_MATERIAL', 'study_material', id, `Deleted material ${item.title}`);
  res.json({ message: 'Study material removed.' });
});

// AI Tutor Query with RAG
router.post('/tutor/ask', authMiddleware, async (req: Request, res: Response) => {
  const { question, subjectId, conversationId } = req.body;
  const user = (req as any).user;

  if (!question || !subjectId) {
    res.status(400).json({ error: 'Question and subjectId are required.' });
    return;
  }

  const subject = db.collection('subjects').findById(subjectId);
  const subjectName = subject ? subject.name : 'Course';

  // Load authorized materials for this subject
  const materials = db.collection('studyMaterials').find((m) => {
    if (m.subjectId !== subjectId) return false;
    if (m.status !== 'READY') return false;
    if (user.role === 'student' && user.classSection && m.classSection && m.classSection !== user.classSection) {
      return false;
    }
    return true;
  });

  const formattedMaterials = materials.map((m) => ({
    title: m.title,
    fileName: m.fileName,
    content: m.extractedText || '',
  }));

  const history: { sender: string; text: string }[] = []; // Can be extended from conversationId if exists
  const tutorResult = await askAiTutor({
    question,
    subjectName,
    materials: formattedMaterials,
    history,
  });

  // Save conversation log
  db.collection('aiConversations').insertOne({
    userId: user._id || user.id,
    userName: user.name,
    subjectId,
    subjectName,
    question,
    answer: tutorResult.answer,
    sources: tutorResult.sources,
    timestamp: new Date().toISOString(),
  });

  res.json(tutorResult);
});

// Get user recent AI conversation history
router.get('/tutor/history', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { subjectId } = req.query;

  const logs = db.collection('aiConversations').find((c) => {
    if (c.userId !== user._id && c.userId !== user.id) return false;
    if (subjectId && c.subjectId !== subjectId) return false;
    return true;
  });

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(logs.slice(0, 30));
});

export default router;
