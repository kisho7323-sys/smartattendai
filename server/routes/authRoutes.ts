import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { generateToken, hashPassword, comparePassword, authMiddleware, recordAudit } from '../auth.js';

const router = Router();

// Check if any admin exists (for first-time initial admin setup wizard)
router.get('/status', (req: Request, res: Response) => {
  const adminCount = db.collection('users').countDocuments((u) => u.role === 'admin');
  res.json({
    hasAdmin: adminCount > 0,
    databaseConnected: true,
  });
});

// First admin setup
router.post('/setup-admin', (req: Request, res: Response) => {
  const adminCount = db.collection('users').countDocuments((u) => u.role === 'admin');
  if (adminCount > 0) {
    res.status(400).json({ error: 'Initial administrator already exists. Please log in.' });
    return;
  }

  const { name, email, password, regNoOrEmpId, department } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }

  const existing = db.collection('users').findOne((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(400).json({ error: 'User with this email already exists.' });
    return;
  }

  const newAdmin = db.collection('users').insertOne({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    role: 'admin',
    regNoOrEmpId: regNoOrEmpId || 'ADM-001',
    department: department || 'Institutional Administration',
    designation: 'Chief Administrator',
    status: 'active',
    emailVerified: true,
    faceEnrolled: false,
  });

  const token = generateToken(newAdmin);
  recordAudit(newAdmin, 'CREATE_ADMIN', 'user', newAdmin._id, 'Initial administrator account setup completed.');

  res.json({
    message: 'Administrator account configured successfully.',
    token,
    user: {
      id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      department: newAdmin.department,
    },
  });
});

// Login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.collection('users').findOne((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.status === 'deactivated') {
    res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
    return;
  }

  const isMatch = comparePassword(password, user.passwordHash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = generateToken(user);
  recordAudit(user, 'USER_LOGIN', 'user', user._id, `Successful login from ${req.ip}`);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      regNoOrEmpId: user.regNoOrEmpId,
      classSection: user.classSection,
      faceEnrolled: !!user.faceEnrolled,
      profilePhoto: user.profilePhoto,
    },
  });
});

// Current User Profile
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const user = db.collection('users').findById(authUser.id);
  if (!user) {
    res.status(404).json({ error: 'User record not found.' });
    return;
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    regNoOrEmpId: user.regNoOrEmpId,
    classSection: user.classSection,
    degree: user.degree,
    academicYear: user.academicYear,
    semester: user.semester,
    phone: user.phone,
    faceEnrolled: !!user.faceEnrolled,
    profilePhoto: user.profilePhoto,
    status: user.status,
    emailVerified: user.emailVerified,
  });
});

export default router;
