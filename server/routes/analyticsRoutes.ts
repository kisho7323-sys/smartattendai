import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';

const router = Router();

// Overall Institutional Metrics (Dynamic, derived strictly from database)
router.get('/dashboard-summary', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;

  const totalStudents = db.collection('users').countDocuments((u) => u.role === 'student' && u.status === 'active');
  const totalFaculty = db.collection('users').countDocuments((u) => u.role === 'faculty' && u.status === 'active');
  const totalOfficials = db.collection('users').countDocuments((u) => u.role === 'higher_official' && u.status === 'active');
  const enrolledFaces = db.collection('faceEnrollments').countDocuments((e) => e.status === 'active');

  const totalSessions = db.collection('attendanceSessions').countDocuments();
  const finalizedSessions = db.collection('attendanceSessions').countDocuments((s) => s.status === 'FINALIZED');

  const totalRecords = db.collection('attendanceRecords').countDocuments();
  const presentRecords = db.collection('attendanceRecords').countDocuments((r) => r.status === 'PRESENT' || r.status === 'PRESENT_OD');
  const odRecords = db.collection('attendanceRecords').countDocuments((r) => r.status === 'PRESENT_OD');
  const leaveRecords = db.collection('attendanceRecords').countDocuments((r) => r.status === 'ABSENT_APPROVED_LEAVE');

  const overallAttendanceRate = totalRecords > 0 ? Number(((presentRecords / totalRecords) * 100).toFixed(1)) : 0;

  const totalMaterials = db.collection('studyMaterials').countDocuments();
  const totalQuizzes = db.collection('quizzes').countDocuments();
  const totalAttempts = db.collection('quizAttempts').countDocuments();

  res.json({
    metrics: {
      totalStudents,
      totalFaculty,
      totalOfficials,
      enrolledFaces,
      totalSessions,
      finalizedSessions,
      totalRecords,
      presentRecords,
      odRecords,
      leaveRecords,
      overallAttendanceRate,
      totalMaterials,
      totalQuizzes,
      totalAttempts,
    },
    institutionStatus: {
      dbHealth: db.getHealth(),
      serverUptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Department-level metrics for Higher Officials and Admins
router.get('/department-breakdown', authMiddleware, requireRole(['admin', 'higher_official']), (req: Request, res: Response) => {
  const departments = db.collection('departments').find();
  const students = db.collection('users').find((u) => u.role === 'student');
  const faculty = db.collection('users').find((u) => u.role === 'faculty');
  const sessions = db.collection('attendanceSessions').find();
  const records = db.collection('attendanceRecords').find();

  const breakdown = departments.map((d) => {
    const deptStudents = students.filter((s) => s.department === d.name || s.department === d.code);
    const deptFaculty = faculty.filter((f) => f.department === d.name || f.department === d.code);
    const deptStudentIds = new Set(deptStudents.map((s) => s._id));

    const deptRecords = records.filter((r) => deptStudentIds.has(r.studentId));
    const attended = deptRecords.filter((r) => r.status === 'PRESENT' || r.status === 'PRESENT_OD').length;
    const rate = deptRecords.length > 0 ? Number(((attended / deptRecords.length) * 100).toFixed(1)) : 0;

    return {
      departmentId: d._id,
      name: d.name,
      code: d.code,
      studentCount: deptStudents.length,
      facultyCount: deptFaculty.length,
      totalAttendanceRecords: deptRecords.length,
      attendancePercentage: rate,
    };
  });

  res.json(breakdown);
});

// Audit Logs
router.get('/audit-logs', authMiddleware, requireRole(['admin', 'higher_official']), (req: Request, res: Response) => {
  const { limit = '50', search, entityType } = req.query;
  const l = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));

  const logs = db.collection('auditLogs').find((log) => {
    if (entityType && log.entityType !== entityType) return false;
    if (search) {
      const q = (search as string).toLowerCase();
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchActor = log.actorName?.toLowerCase().includes(q);
      if (!matchAction && !matchDetails && !matchActor) return false;
    }
    return true;
  });

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(logs.slice(0, l));
});

export default router;
