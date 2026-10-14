import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';

const router = Router();

// List requests
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status, studentId } = req.query;

  const requests = db.collection('odLeaveRequests').find((r) => {
    // Students only see their own requests
    if (user.role === 'student' && r.studentId !== user._id && r.studentId !== user.id) {
      return false;
    }
    if (studentId && r.studentId !== studentId) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(requests);
});

// Submit request (Student or Admin)
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { type, startDate, endDate, reason, supportingDocUrl, classSection, subjectIds } = req.body;

  if (!type || !startDate || !endDate || !reason) {
    res.status(400).json({ error: 'Type (OD/LEAVE), start date, end date, and reason are required.' });
    return;
  }

  const created = db.collection('odLeaveRequests').insertOne({
    studentId: user._id || user.id,
    studentName: user.name,
    studentRegNo: user.regNoOrEmpId || '',
    classSection: classSection || user.classSection || '',
    type, // 'OD' | 'LEAVE'
    startDate,
    endDate,
    reason,
    supportingDocUrl: supportingDocUrl || '',
    subjectIds: subjectIds || [],
    status: 'PENDING',
    approvedBy: null,
    approverName: null,
    decisionDate: null,
    decisionNotes: null,
  });

  recordAudit(
    user,
    'SUBMIT_OD_LEAVE',
    'od_leave_request',
    created._id,
    `Submitted ${type} request from ${startDate} to ${endDate}`
  );

  res.status(201).json(created);
});

// Review decision (Faculty or Admin)
router.patch('/:id/decision', authMiddleware, requireRole(['faculty', 'admin', 'higher_official']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, decisionNotes } = req.body;
  const user = (req as any).user;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
    return;
  }

  const request = db.collection('odLeaveRequests').findById(id);
  if (!request) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }

  const updated = db.collection('odLeaveRequests').updateOne(id, {
    status,
    approvedBy: user._id || user.id,
    approverName: user.name,
    decisionDate: new Date().toISOString(),
    decisionNotes: decisionNotes || '',
  });

  // If approved, reconcile any existing attendance records in that date range!
  if (status === 'APPROVED') {
    const affectedRecords = db.collection('attendanceRecords').find((r) => {
      return (
        r.studentId === request.studentId &&
        r.date >= request.startDate &&
        r.date <= request.endDate &&
        r.status === 'ABSENT'
      );
    });

    affectedRecords.forEach((r) => {
      const reconciledStatus = request.type === 'OD' ? 'PRESENT_OD' : 'ABSENT_APPROVED_LEAVE';
      db.collection('attendanceRecords').updateOne(r._id, {
        status: reconciledStatus,
        verificationMethod: 'OD_RECONCILIATION',
        correctionLog: [
          ...(r.correctionLog || []),
          {
            previousStatus: r.status,
            newStatus: reconciledStatus,
            reason: `Automatic reconciliation from approved ${request.type} #${id}`,
            correctedBy: user.name,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });
  }

  recordAudit(
    user,
    'DECIDE_OD_LEAVE',
    'od_leave_request',
    id,
    `${status} ${request.type} request for ${request.studentName}: ${decisionNotes || 'Approved by authority'}`
  );

  res.json({ message: `Request has been marked as ${status}.`, request: updated });
});

export default router;
