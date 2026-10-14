import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';
import { generateQuizQuestions, generateRevisionPlan } from '../ai.js';

const router = Router();

// List quizzes
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { subjectId, classSection, status } = req.query;
  const user = (req as any).user;

  const quizzes = db.collection('quizzes').find((q) => {
    if (subjectId && q.subjectId !== subjectId) return false;
    if (classSection && q.classSection !== classSection) return false;
    // Students only see PUBLISHED quizzes for their class
    if (user.role === 'student') {
      if (q.status !== 'PUBLISHED') return false;
      if (user.classSection && q.classSection && q.classSection !== user.classSection) return false;
    } else if (status && q.status !== status) {
      return false;
    }
    return true;
  });

  // Attach student attempt status if student
  if (user.role === 'student') {
    const attempts = db.collection('quizAttempts').find((a) => a.studentId === user._id || a.studentId === user.id);
    const result = quizzes.map((q) => {
      const myAttempt = attempts.find((a) => a.quizId === q._id);
      return {
        ...q,
        attempted: !!myAttempt,
        myScore: myAttempt ? myAttempt.score : null,
        myPercentage: myAttempt ? myAttempt.percentage : null,
        attemptId: myAttempt ? myAttempt._id : null,
      };
    });
    res.json(result);
    return;
  }

  res.json(quizzes);
});

// Single quiz
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const quiz = db.collection('quizzes').findById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }
  const user = (req as any).user;

  // If student and already attempted, return with review
  const attempt = db.collection('quizAttempts').findOne(
    (a) => a.quizId === quiz._id && (a.studentId === user._id || a.studentId === user.id)
  );

  // If student taking quiz, do not reveal correct answers in payload
  if (user.role === 'student' && !attempt) {
    const sanitizedQuestions = quiz.questions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      topic: q.topic,
    }));
    res.json({ ...quiz, questions: sanitizedQuestions, alreadyAttempted: false });
    return;
  }

  res.json({ ...quiz, attempt: attempt || null, alreadyAttempted: !!attempt });
});

// Faculty generate AI questions draft
router.post('/generate-draft', authMiddleware, requireRole(['faculty', 'admin']), async (req: Request, res: Response) => {
  const { topic, subjectId, count = 5 } = req.body;
  if (!topic || !subjectId) {
    res.status(400).json({ error: 'Topic and subjectId are required.' });
    return;
  }

  const subject = db.collection('subjects').findById(subjectId);
  const materials = db.collection('studyMaterials').find((m) => m.subjectId === subjectId);
  const materialContext = materials.map((m) => m.extractedText).join('\n\n');

  try {
    const questions = await generateQuizQuestions({
      topic,
      subjectName: subject ? subject.name : 'Course',
      count: Number(count) || 5,
      studyMaterialText: materialContext,
    });

    const formattedQuestions = questions.map((q: any, idx: number) => ({
      id: 'q_' + Date.now() + '_' + idx,
      question: q.question,
      options: q.options || ['A', 'B', 'C', 'D'],
      correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
      explanation: q.explanation || '',
      topic: q.topic || topic,
    }));

    res.json({ questions: formattedQuestions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to draft AI quiz questions: ' + err.message });
  }
});

// Create Quiz (Faculty or Admin)
router.post('/', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { title, description, subjectId, subjectName, classSection, durationMinutes, questions, status } = req.body;
  const user = (req as any).user;

  if (!title || !subjectId || !questions || !Array.isArray(questions)) {
    res.status(400).json({ error: 'Title, subjectId, and questions array are required.' });
    return;
  }

  const created = db.collection('quizzes').insertOne({
    title,
    description: description || '',
    subjectId,
    subjectName: subjectName || 'Subject',
    classSection: classSection || '',
    facultyId: user._id || user.id,
    facultyName: user.name,
    durationMinutes: durationMinutes || 20,
    questions,
    status: status || 'DRAFT', // 'DRAFT' | 'PUBLISHED'
    createdAt: new Date().toISOString(),
  });

  recordAudit(user, 'CREATE_QUIZ', 'quiz', created._id, `Created quiz "${title}" (${questions.length} questions) with status ${status || 'DRAFT'}`);
  res.status(201).json(created);
});

// Update or Publish Quiz
router.patch('/:id/publish', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = (req as any).user;

  if (!['DRAFT', 'PUBLISHED'].includes(status)) {
    res.status(400).json({ error: 'Status must be DRAFT or PUBLISHED.' });
    return;
  }

  const updated = db.collection('quizzes').updateOne(id, { status });
  if (!updated) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  recordAudit(user, 'PUBLISH_QUIZ', 'quiz', id, `Updated quiz status to ${status}`);
  res.json({ message: `Quiz is now ${status}.`, quiz: updated });
});

// Student Submit Quiz Attempt & Server-side Grading
router.post('/:id/submit', authMiddleware, requireRole('student'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { answers } = req.body; // Map: { [questionId]: selectedOptionIndex }
  const user = (req as any).user;

  const quiz = db.collection('quizzes').findById(id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // Prevent multiple attempts if already taken
  const existing = db.collection('quizAttempts').findOne(
    (a) => a.quizId === id && (a.studentId === user._id || a.studentId === user.id)
  );
  if (existing) {
    res.status(400).json({ error: 'You have already submitted an attempt for this quiz.', attempt: existing });
    return;
  }

  // Server-side objective grading
  let score = 0;
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  const topicStats: Record<string, { total: number; correct: number }> = {};

  quiz.questions.forEach((q: any) => {
    const selected = answers ? answers[q.id] : undefined;
    const isCorrect = selected === q.correctOptionIndex;
    const topic = q.topic || 'General';

    if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
    topicStats[topic].total += 1;

    if (isCorrect) {
      score += 1;
      topicStats[topic].correct += 1;
    }
  });

  Object.keys(topicStats).forEach((topic) => {
    const stat = topicStats[topic];
    if (stat.correct / stat.total < 0.6) {
      weakTopics.push(topic);
    } else {
      strongTopics.push(topic);
    }
  });

  const totalQuestions = quiz.questions.length;
  const percentage = totalQuestions > 0 ? Number(((score / totalQuestions) * 100).toFixed(1)) : 0;

  const attempt = db.collection('quizAttempts').insertOne({
    quizId: id,
    quizTitle: quiz.title,
    subjectId: quiz.subjectId,
    subjectName: quiz.subjectName,
    studentId: user._id || user.id,
    studentName: user.name,
    studentRegNo: user.regNoOrEmpId || '',
    answers,
    score,
    totalQuestions,
    percentage,
    topicStats,
    weakTopics,
    strongTopics,
    submittedAt: new Date().toISOString(),
  });

  // Generate Personalized Revision Plan using Gemini if student had weak areas
  let revisionPlanText = '';
  try {
    revisionPlanText = await generateRevisionPlan({
      studentName: user.name,
      subjectName: quiz.subjectName,
      score,
      total: totalQuestions,
      weakTopics,
    });

    db.collection('revisionPlans').insertOne({
      studentId: user._id || user.id,
      quizId: id,
      subjectId: quiz.subjectId,
      score,
      total: totalQuestions,
      percentage,
      weakTopics,
      strongTopics,
      planContent: revisionPlanText,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[QUIZ] Revision plan generation deferred:', err);
  }

  recordAudit(
    user,
    'SUBMIT_QUIZ_ATTEMPT',
    'quiz_attempt',
    attempt._id,
    `Submitted attempt for ${quiz.title}: Scored ${score}/${totalQuestions} (${percentage}%)`
  );

  res.status(201).json({
    message: 'Quiz evaluated successfully.',
    score,
    totalQuestions,
    percentage,
    weakTopics,
    strongTopics,
    topicStats,
    revisionPlan: revisionPlanText,
    attemptId: attempt._id,
  });
});

// Student Revision Plans List
router.get('/revision-plans/my', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const plans = db.collection('revisionPlans').find((p) => p.studentId === user._id || p.studentId === user.id);
  plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(plans);
});

export default router;
