import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';

const router = Router();

// ==================== ATTENDANCE SESSIONS ====================

// List sessions for faculty or admin
router.get('/sessions', authMiddleware, (req: Request, res: Response) => {
  const { classSection, subjectId, facultyId, date } = req.query;
  const user = (req as any).user;

  const sessions = db.collection('attendanceSessions').find((s) => {
    if (user.role === 'faculty' && s.facultyId !== user.id && s.facultyId !== user._id) return false;
    if (facultyId && s.facultyId !== facultyId) return false;
    if (classSection && s.classSection !== classSection) return false;
    if (subjectId && s.subjectId !== subjectId) return false;
    if (date && s.date !== date) return false;
    return true;
  });

  // Sort by date/startTime desc
  sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sessions);
});

// Single session detail with records
router.get('/sessions/:id', authMiddleware, (req: Request, res: Response) => {
  const session = db.collection('attendanceSessions').findById(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  const records = db.collection('attendanceRecords').find((r) => r.sessionId === session._id);
  res.json({ session, records });
});

// Create new attendance session (Status: GESTURE_PENDING)
router.post('/sessions', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { classSection, subjectId, subjectName, date, startTime, endTime } = req.body;
  const user = (req as any).user;

  if (!classSection || !subjectId) {
    res.status(400).json({ error: 'Class section and subject are required.' });
    return;
  }

  const currentDate = date || new Date().toISOString().split('T')[0];

  const newSession = db.collection('attendanceSessions').insertOne({
    facultyId: user._id || user.id,
    facultyName: user.name,
    classSection,
    subjectId,
    subjectName: subjectName || 'Subject',
    date: currentDate,
    startTime: startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endTime: endTime || '',
    cameraState: 'CAMERA_OFF',
    status: 'GESTURE_PENDING',
    gestureTriggeredAt: null,
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    odCount: 0,
    leaveCount: 0,
    needsReviewCount: 0,
    finalizedAt: null,
  });

  recordAudit(
    user,
    'CREATE_SESSION',
    'attendance_session',
    newSession._id,
    `Initiated attendance session for ${classSection} - ${subjectName}`
  );

  res.status(201).json(newSession);
});

// Register Double-Blink Gesture Trigger Event
router.post('/sessions/:id/trigger-gesture', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { earHistory, blinkIntervalMs, modelMetrics } = req.body;
  const user = (req as any).user;

  const session = db.collection('attendanceSessions').findById(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  if (session.status === 'FINALIZED') {
    res.status(400).json({ error: 'Cannot trigger gesture on finalized session.' });
    return;
  }

  // Validate double blink parameters
  if (blinkIntervalMs && (blinkIntervalMs < 150 || blinkIntervalMs > 2500)) {
    res.status(400).json({ error: 'Invalid blink temporal window. Double blink must occur between 150ms and 2500ms.' });
    return;
  }

  const triggerTime = new Date().toISOString();

  // Populate roster for class section if not already created
  const students = db.collection('users').find((u) => u.role === 'student' && u.classSection === session.classSection && u.status === 'active');

  // Check approved OD and Leaves for this date
  const approvedOdLeaves = db.collection('odLeaveRequests').find((r) => {
    return (
      r.status === 'APPROVED' &&
      r.startDate <= session.date &&
      r.endDate >= session.date
    );
  });

  const existingRecords = db.collection('attendanceRecords').find((r) => r.sessionId === id);

  if (existingRecords.length === 0) {
    // Generate initial roster records
    students.forEach((student) => {
      const odLeave = approvedOdLeaves.find((ol) => ol.studentId === student._id);
      let initialStatus = 'ABSENT';
      let verificationMethod = 'PENDING';

      if (odLeave) {
        if (odLeave.type === 'OD') {
          initialStatus = 'PRESENT_OD';
          verificationMethod = 'OD_RECONCILIATION';
        } else {
          initialStatus = 'ABSENT_APPROVED_LEAVE';
          verificationMethod = 'OD_RECONCILIATION';
        }
      }

      db.collection('attendanceRecords').insertOne({
        sessionId: id,
        studentId: student._id,
        studentName: student.name,
        regNo: student.regNoOrEmpId,
        classSection: session.classSection,
        subjectId: session.subjectId,
        date: session.date,
        status: initialStatus,
        confidenceScore: 0,
        verificationMethod,
        markedAt: null,
        correctionLog: [],
      });
    });
  }

  const updatedSession = db.collection('attendanceSessions').updateOne(id, {
    status: 'ATTENDANCE_IN_PROGRESS',
    cameraState: 'ATTENDANCE_IN_PROGRESS',
    gestureTriggeredAt: triggerTime,
    blinkIntervalMs: blinkIntervalMs || 450,
  });

  recordAudit(
    user,
    'GESTURE_TRIGGERED',
    'attendance_session',
    id,
    `Double-blink gesture validated and attendance scanner activated (Blink interval: ${blinkIntervalMs || 450}ms)`
  );

  res.json({
    message: 'Double-blink gesture registered. Attendance workflow is now in progress.',
    session: updatedSession,
  });
});

// Process Recognized Student Identity into Attendance Record
router.post('/sessions/:id/mark-recognized', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { studentId, confidenceScore, livenessPassed } = req.body;

  const session = db.collection('attendanceSessions').findById(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  if (session.status !== 'ATTENDANCE_IN_PROGRESS') {
    res.status(400).json({ error: 'Session is not currently processing attendance. Double-blink gesture must be triggered first.' });
    return;
  }

  const record = db.collection('attendanceRecords').findOne((r) => r.sessionId === id && r.studentId === studentId);
  if (!record) {
    res.status(404).json({ error: 'Student record not found in session roster.' });
    return;
  }

  // Prevent duplicate overwrite if already marked PRESENT
  if (record.status === 'PRESENT') {
    res.json({ message: 'Student is already marked present.', record, alreadyMarked: true });
    return;
  }

  // Preserve approved OD
  if (record.status === 'PRESENT_OD') {
    res.json({ message: 'Student has approved On-Duty authorization.', record, alreadyMarked: true });
    return;
  }

  const score = confidenceScore || 85;
  const newStatus = score >= 65 ? 'PRESENT' : 'NEEDS_REVIEW';

  const updatedRecord = db.collection('attendanceRecords').updateOne(record._id, {
    status: newStatus,
    confidenceScore: score,
    verificationMethod: 'GESTURE_FACE_RECOGNITION',
    markedAt: new Date().toISOString(),
    livenessChecked: !!livenessPassed,
  });

  res.json({
    message: `Student marked as ${newStatus}`,
    record: updatedRecord,
    alreadyMarked: false,
  });
});

// Manual Correction with Audit Log
router.patch('/records/:recordId/correct', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { recordId } = req.params;
  const { newStatus, reason } = req.body;
  const user = (req as any).user;

  if (!['PRESENT', 'ABSENT', 'PRESENT_OD', 'ABSENT_APPROVED_LEAVE', 'NEEDS_REVIEW'].includes(newStatus)) {
    res.status(400).json({ error: 'Invalid attendance status.' });
    return;
  }

  const record = db.collection('attendanceRecords').findById(recordId);
  if (!record) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }

  const previousStatus = record.status;
  const correctionEntry = {
    previousStatus,
    newStatus,
    reason: reason || 'Manual faculty override',
    correctedBy: user.name,
    timestamp: new Date().toISOString(),
  };

  const updated = db.collection('attendanceRecords').updateOne(recordId, {
    status: newStatus,
    verificationMethod: 'MANUAL_CORRECTION',
    correctionLog: [...(record.correctionLog || []), correctionEntry],
  });

  recordAudit(
    user,
    'MANUAL_ATTENDANCE_CORRECTION',
    'attendance_record',
    recordId,
    `Corrected status from ${previousStatus} to ${newStatus} for ${record.studentName}: ${reason || 'Manual override'}`
  );

  res.json({ message: 'Record updated successfully.', record: updated });
});

// Finalize Attendance Session & Enforce Camera Shutdown State
router.post('/sessions/:id/finalize', authMiddleware, requireRole(['faculty', 'admin']), (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const session = db.collection('attendanceSessions').findById(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const records = db.collection('attendanceRecords').find((r) => r.sessionId === id);
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const odCount = records.filter((r) => r.status === 'PRESENT_OD').length;
  const leaveCount = records.filter((r) => r.status === 'ABSENT_APPROVED_LEAVE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const needsReviewCount = records.filter((r) => r.status === 'NEEDS_REVIEW').length;

  const updatedSession = db.collection('attendanceSessions').updateOne(id, {
    status: 'FINALIZED',
    cameraState: 'CAMERA_STOPPED',
    endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    finalizedAt: new Date().toISOString(),
    totalStudents: records.length,
    presentCount,
    odCount,
    leaveCount,
    absentCount,
    needsReviewCount,
  });

  recordAudit(
    user,
    'FINALIZE_ATTENDANCE',
    'attendance_session',
    id,
    `Finalized attendance for ${session.classSection}: ${presentCount} Present, ${absentCount} Absent, ${odCount} OD, ${leaveCount} Leave.`
  );

  res.json({
    message: 'Attendance session finalized successfully. Camera resources released.',
    session: updatedSession,
    summary: {
      total: records.length,
      present: presentCount,
      od: odCount,
      leave: leaveCount,
      absent: absentCount,
      needsReview: needsReviewCount,
    },
  });
});

// Student attendance lookup (Personal real attendance records)
router.get('/student-records', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const records = db.collection('attendanceRecords').find((r) => r.studentId === user._id || r.studentId === user.id);

  // Group by subject to compute real percentages
  const subjectMap: Record<string, { total: number; attended: number; subjectName: string }> = {};

  records.forEach((r) => {
    const sId = r.subjectId || 'General';
    if (!subjectMap[sId]) {
      const subject = db.collection('subjects').findById(sId);
      subjectMap[sId] = {
        total: 0,
        attended: 0,
        subjectName: subject ? subject.name : sId,
      };
    }
    subjectMap[sId].total += 1;
    if (r.status === 'PRESENT' || r.status === 'PRESENT_OD') {
      subjectMap[sId].attended += 1;
    }
  });

  const subjectStats = Object.keys(subjectMap).map((key) => {
    const item = subjectMap[key];
    const percentage = item.total > 0 ? Number(((item.attended / item.total) * 100).toFixed(1)) : 0;
    return {
      subjectId: key,
      subjectName: item.subjectName,
      totalClasses: item.total,
      attendedClasses: item.attended,
      percentage,
      isShortage: percentage < 75 && item.total >= 3,
    };
  });

  res.json({
    records,
    subjectStats,
    overall: {
      totalClasses: records.length,
      attendedClasses: records.filter((r) => r.status === 'PRESENT' || r.status === 'PRESENT_OD').length,
      percentage:
        records.length > 0
          ? Number(
              (
                (records.filter((r) => r.status === 'PRESENT' || r.status === 'PRESENT_OD').length / records.length) *
                100
              ).toFixed(1)
            )
          : 0,
    },
  });
});

export default router;
