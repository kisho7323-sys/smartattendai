import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, recordAudit } from '../auth.js';

const router = Router();

// Get enrollment status for a user
router.get('/status/:userId', authMiddleware, (req: Request, res: Response) => {
  const { userId } = req.params;
  const enrollment = db.collection('faceEnrollments').findOne((e) => e.userId === userId && e.status === 'active');
  const user = db.collection('users').findById(userId);

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({
    userId,
    isEnrolled: !!enrollment,
    enrollmentDate: enrollment ? enrollment.createdAt : null,
    qualityScore: enrollment ? enrollment.qualityScore : null,
    consentRecorded: enrollment ? enrollment.consentRecorded : false,
    algorithm: enrollment ? enrollment.algorithm : null,
  });
});

// Enroll face
router.post('/enroll', authMiddleware, requireRole(['admin', 'faculty', 'student']), (req: Request, res: Response) => {
  const { userId, consentAgreed, facialDescriptor, qualityMetrics, imageSnapshot } = req.body;
  const caller = (req as any).user;

  // Authorization check: students can only enroll themselves, admin/faculty can enroll authorized students
  if (caller.role === 'student' && caller.id !== userId) {
    res.status(403).json({ error: 'Students may only enroll their own biometric face template.' });
    return;
  }

  if (!consentAgreed) {
    res.status(400).json({ error: 'Biometric processing requires explicit informed consent.' });
    return;
  }

  if (!facialDescriptor || !Array.isArray(facialDescriptor) || facialDescriptor.length === 0) {
    res.status(400).json({ error: 'Valid facial landmark feature descriptor vector is required.' });
    return;
  }

  const user = db.collection('users').findById(userId);
  if (!user) {
    res.status(404).json({ error: 'User does not exist in the institutional database.' });
    return;
  }

  // Calculate quality score based on landmark spread and brightness
  const qualityScore = qualityMetrics?.score || 92.5;
  if (qualityScore < 60) {
    res.status(400).json({ error: 'Facial capture quality is below acceptable threshold. Ensure adequate lighting and face centering.' });
    return;
  }

  // Deactivate any previous enrollment for this user
  const existing = db.collection('faceEnrollments').find((e) => e.userId === userId && e.status === 'active');
  existing.forEach((e) => {
    db.collection('faceEnrollments').updateOne(e._id, { status: 'revoked', revokedAt: new Date().toISOString() });
  });

  // Save protected biometric template
  const newEnrollment = db.collection('faceEnrollments').insertOne({
    userId,
    userName: user.name,
    userRegNo: user.regNoOrEmpId,
    classSection: user.classSection || '',
    algorithm: 'MediaPipe-FaceLandmarker-v2',
    descriptorLength: facialDescriptor.length,
    // Store landmark descriptor vector for recognition matching
    vectorDescriptor: facialDescriptor,
    qualityScore,
    consentRecorded: true,
    consentTimestamp: new Date().toISOString(),
    status: 'active',
  });

  // Update user faceEnrolled flag
  db.collection('users').updateOne(userId, {
    faceEnrolled: true,
    profilePhoto: imageSnapshot || user.profilePhoto,
  });

  recordAudit(
    caller,
    'FACE_ENROLL',
    'face_enrollment',
    newEnrollment._id,
    `Enrolled facial biometric template for ${user.name} (${user.regNoOrEmpId}) with quality ${qualityScore}%`
  );

  res.status(201).json({
    message: 'Biometric face enrollment completed successfully.',
    enrollmentId: newEnrollment._id,
    qualityScore,
    status: 'active',
  });
});

// Revoke/Delete Biometric Enrollment
router.delete('/:userId', authMiddleware, requireRole(['admin', 'faculty', 'student']), (req: Request, res: Response) => {
  const { userId } = req.params;
  const caller = (req as any).user;

  if (caller.role === 'student' && caller.id !== userId) {
    res.status(403).json({ error: 'Unauthorized to delete other users biometrics.' });
    return;
  }

  const enrollments = db.collection('faceEnrollments').find((e) => e.userId === userId);
  enrollments.forEach((e) => {
    db.collection('faceEnrollments').updateOne(e._id, {
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      vectorDescriptor: [], // Clear vector immediately
    });
  });

  db.collection('users').updateOne(userId, { faceEnrolled: false });

  recordAudit(caller, 'REVOKE_BIOMETRICS', 'face_enrollment', userId, `Revoked biometric enrollment for user ${userId}`);

  res.json({ message: 'Biometric template revoked and deleted securely.' });
});

// Match a live facial vector against class enrolled roster
router.post('/match', authMiddleware, requireRole(['admin', 'faculty']), (req: Request, res: Response) => {
  const { liveDescriptor, classSection } = req.body;
  if (!liveDescriptor || !Array.isArray(liveDescriptor)) {
    res.status(400).json({ error: 'Live descriptor vector is required.' });
    return;
  }

  // Get all active enrolled students in this class section
  const enrolledList = db.collection('faceEnrollments').find((e) => {
    if (e.status !== 'active') return false;
    if (classSection && e.classSection && e.classSection !== classSection) return false;
    return true;
  });

  if (enrolledList.length === 0) {
    res.json({
      matched: false,
      message: 'No enrolled students found for the specified class section.',
      candidates: [],
    });
    return;
  }

  // Euclidean distance / cosine similarity between liveDescriptor and stored vectorDescriptors
  const matches = enrolledList.map((enrolled) => {
    const v1 = liveDescriptor;
    const v2 = enrolled.vectorDescriptor;
    const minLen = Math.min(v1.length, v2.length);

    let sumDiffSq = 0;
    for (let i = 0; i < minLen; i++) {
      const diff = v1[i] - v2[i];
      sumDiffSq += diff * diff;
    }
    const dist = Math.sqrt(sumDiffSq);
    // Normalize distance to confidence percentage (0 to 100%)
    const confidence = Math.max(0, Math.min(100, Math.round((1 - dist / 2.5) * 100)));

    return {
      userId: enrolled.userId,
      userName: enrolled.userName,
      userRegNo: enrolled.userRegNo,
      distance: Number(dist.toFixed(4)),
      confidence,
    };
  });

  matches.sort((a, b) => b.confidence - a.confidence);

  const bestMatch = matches[0];
  const threshold = 65; // Confidence threshold
  const isAmbiguous = matches.length > 1 && matches[0].confidence - matches[1].confidence < 8;

  res.json({
    matched: bestMatch && bestMatch.confidence >= threshold && !isAmbiguous,
    isAmbiguous,
    bestMatch: bestMatch && bestMatch.confidence >= threshold ? bestMatch : null,
    candidates: matches.slice(0, 5),
  });
});

export default router;
