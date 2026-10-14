import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';

const router = Router();

// ==================== DEPARTMENTS ====================
router.get('/departments', authMiddleware, (req: Request, res: Response) => {
  const depts = db.collection('departments').find();
  res.json(depts);
});

router.post('/departments', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { name, code, degrees } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: 'Department name and code are required.' });
    return;
  }
  const created = db.collection('departments').insertOne({
    name,
    code: code.toUpperCase().trim(),
    degrees: degrees || ['B.Tech'],
    active: true,
  });
  recordAudit((req as any).user, 'CREATE_DEPT', 'department', created._id, `Added department ${name} (${code})`);
  res.status(201).json(created);
});

router.delete('/departments/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const deleted = db.collection('departments').deleteOne(req.params.id);
  res.json({ success: deleted });
});

// ==================== CLASSES / SECTIONS ====================
router.get('/classes', authMiddleware, (req: Request, res: Response) => {
  const classes = db.collection('classes').find();
  res.json(classes);
});

router.post('/classes', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { department, degree, academicYear, semester, section, roomNo } = req.body;
  if (!department || !semester || !section) {
    res.status(400).json({ error: 'Department, semester, and section are required.' });
    return;
  }
  const code = `${department}-${semester}${section}`;
  const created = db.collection('classes').insertOne({
    department,
    degree: degree || 'B.Tech',
    academicYear: academicYear || '2026-2027',
    semester,
    section: section.toUpperCase().trim(),
    code,
    roomNo: roomNo || 'Hall 101',
    studentCount: 0,
  });
  recordAudit((req as any).user, 'CREATE_CLASS', 'class', created._id, `Created class section ${code}`);
  res.status(201).json(created);
});

router.delete('/classes/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const deleted = db.collection('classes').deleteOne(req.params.id);
  res.json({ success: deleted });
});

// ==================== SUBJECTS ====================
router.get('/subjects', authMiddleware, (req: Request, res: Response) => {
  const { department, facultyId } = req.query;
  const subjects = db.collection('subjects').find((s) => {
    if (department && s.department !== department) return false;
    if (facultyId && s.assignedFacultyId !== facultyId) return false;
    return true;
  });
  res.json(subjects);
});

router.post('/subjects', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { code, name, department, semester, assignedFacultyId, assignedFacultyName } = req.body;
  if (!code || !name) {
    res.status(400).json({ error: 'Subject code and name are required.' });
    return;
  }
  const created = db.collection('subjects').insertOne({
    code: code.toUpperCase().trim(),
    name,
    department: department || '',
    semester: semester || '1',
    assignedFacultyId: assignedFacultyId || '',
    assignedFacultyName: assignedFacultyName || '',
    active: true,
  });
  recordAudit((req as any).user, 'CREATE_SUBJECT', 'subject', created._id, `Added subject ${code}: ${name}`);
  res.status(201).json(created);
});

router.put('/subjects/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const updated = db.collection('subjects').updateOne(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }
  res.json(updated);
});

router.delete('/subjects/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const deleted = db.collection('subjects').deleteOne(req.params.id);
  res.json({ success: deleted });
});

// ==================== TIMETABLES ====================
router.get('/timetables', authMiddleware, (req: Request, res: Response) => {
  const { classSection, facultyId, dayOfWeek } = req.query;
  const list = db.collection('timetables').find((t) => {
    if (classSection && t.classSection !== classSection) return false;
    if (facultyId && t.facultyId !== facultyId) return false;
    if (dayOfWeek && t.dayOfWeek !== dayOfWeek) return false;
    return true;
  });
  res.json(list);
});

router.post('/timetables', authMiddleware, requireRole(['admin', 'faculty']), (req: Request, res: Response) => {
  const { classSection, dayOfWeek, period, startTime, endTime, subjectId, subjectName, facultyId, facultyName, room } =
    req.body;
  if (!classSection || !dayOfWeek || !startTime || !endTime) {
    res.status(400).json({ error: 'Class, day, start and end times are required.' });
    return;
  }

  const created = db.collection('timetables').insertOne({
    classSection,
    dayOfWeek,
    period: period || 1,
    startTime,
    endTime,
    subjectId: subjectId || '',
    subjectName: subjectName || '',
    facultyId: facultyId || '',
    facultyName: facultyName || '',
    room: room || 'Room 101',
  });

  recordAudit(
    (req as any).user,
    'CREATE_TIMETABLE',
    'timetable',
    created._id,
    `Scheduled ${subjectName} for ${classSection} on ${dayOfWeek}`
  );
  res.status(201).json(created);
});

router.delete('/timetables/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const deleted = db.collection('timetables').deleteOne(req.params.id);
  res.json({ success: deleted });
});

export default router;
