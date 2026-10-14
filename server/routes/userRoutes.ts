import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole, hashPassword, recordAudit } from '../auth.js';

const router = Router();

// List users with search, role filter, department filter, and pagination
router.get('/', authMiddleware, requireRole(['admin', 'higher_official', 'faculty']), (req: Request, res: Response) => {
  const { role, department, classSection, search, page = '1', limit = '50' } = req.query;
  const p = Math.max(1, parseInt(page as string, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

  const users = db.collection('users').find((u) => {
    if (role && u.role !== role) return false;
    if (department && u.department !== department) return false;
    if (classSection && u.classSection !== classSection) return false;
    if (search) {
      const q = (search as string).toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchReg = u.regNoOrEmpId?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchReg) return false;
    }
    return true;
  });

  const total = users.length;
  const startIndex = (p - 1) * l;
  const paginated = users.slice(startIndex, startIndex + l).map((u) => {
    const { passwordHash, ...safeUser } = u;
    return safeUser;
  });

  res.json({
    data: paginated,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l),
    },
  });
});

// Single user
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const user = db.collection('users').findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

// Create new user (Student, Faculty, Higher Official)
router.post('/', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const {
    name,
    email,
    password = 'TempPassword123!',
    role,
    regNoOrEmpId,
    phone,
    department,
    designation,
    degree,
    admissionYear,
    academicYear,
    semester,
    classSection,
    profilePhoto,
    assignedSubjects,
    permissions,
  } = req.body;

  if (!name || !email || !role || !regNoOrEmpId) {
    res.status(400).json({ error: 'Name, email, role, and Reg/Employee ID are required.' });
    return;
  }

  const existingEmail = db.collection('users').findOne((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existingEmail) {
    res.status(400).json({ error: 'A user with this email address already exists.' });
    return;
  }

  const existingReg = db.collection('users').findOne((u) => u.regNoOrEmpId?.toLowerCase() === regNoOrEmpId.toLowerCase().trim());
  if (existingReg) {
    res.status(400).json({ error: 'A user with this Registration/Employee ID already exists.' });
    return;
  }

  const newUser = db.collection('users').insertOne({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    role,
    regNoOrEmpId: regNoOrEmpId.trim(),
    phone: phone || '',
    department: department || '',
    designation: designation || (role === 'student' ? 'Student' : 'Faculty Member'),
    degree: degree || '',
    admissionYear: admissionYear || '',
    academicYear: academicYear || '',
    semester: semester || '',
    classSection: classSection || '',
    profilePhoto: profilePhoto || '',
    assignedSubjects: assignedSubjects || [],
    permissions: permissions || [],
    status: 'active',
    emailVerified: true,
    faceEnrolled: false,
  });

  recordAudit(
    (req as any).user,
    'CREATE_USER',
    'user',
    newUser._id,
    `Created ${role} account: ${name} (${regNoOrEmpId})`
  );

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

// Update user
router.put('/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates._id;
  delete updates.id;

  if (updates.password) {
    updates.passwordHash = hashPassword(updates.password);
    delete updates.password;
  }

  const updated = db.collection('users').updateOne(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  recordAudit((req as any).user, 'UPDATE_USER', 'user', id, `Updated account properties for ${updated.name}`);
  const { passwordHash, ...safeUser } = updated;
  res.json(safeUser);
});

// Deactivate / Reactivate
router.patch('/:id/status', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'deactivated'].includes(status)) {
    res.status(400).json({ error: 'Status must be active or deactivated.' });
    return;
  }

  const updated = db.collection('users').updateOne(id, { status });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  recordAudit((req as any).user, 'STATUS_CHANGE', 'user', id, `Changed account status to ${status}`);
  res.json({ message: `Account status updated to ${status}`, user: updated });
});

// Delete user
router.delete('/:id', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = db.collection('users').findById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.collection('users').deleteOne(id);
  recordAudit((req as any).user, 'DELETE_USER', 'user', id, `Deleted user account: ${target.name}`);
  res.json({ message: 'User deleted successfully.' });
});

// Bulk CSV Import
router.post('/bulk-import', authMiddleware, requireRole('admin'), (req: Request, res: Response) => {
  const { rows, role = 'student' } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'Payload must contain a non-empty array of records.' });
    return;
  }

  const successful: any[] = [];
  const errors: { row: number; error: string; data: any }[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const name = row.name || row.FullName || row['Full Name'];
    const email = (row.email || row.Email || '').trim().toLowerCase();
    const regNoOrEmpId = (row.regNoOrEmpId || row.regNo || row['Reg No'] || row.employeeId || row['Employee ID'] || '').trim();

    if (!name || !email || !regNoOrEmpId) {
      errors.push({
        row: rowNum,
        error: 'Missing required field: Name, Email, or ID.',
        data: row,
      });
      return;
    }

    const dupEmail = db.collection('users').findOne((u) => u.email.toLowerCase() === email);
    if (dupEmail) {
      errors.push({
        row: rowNum,
        error: `Duplicate email "${email}" already registered.`,
        data: row,
      });
      return;
    }

    const dupId = db.collection('users').findOne((u) => u.regNoOrEmpId?.toLowerCase() === regNoOrEmpId.toLowerCase());
    if (dupId) {
      errors.push({
        row: rowNum,
        error: `Duplicate Reg/Emp ID "${regNoOrEmpId}" already registered.`,
        data: row,
      });
      return;
    }

    const created = db.collection('users').insertOne({
      name,
      email,
      passwordHash: hashPassword(row.password || 'Welcome123!'),
      role: row.role || role,
      regNoOrEmpId,
      department: row.department || row.Department || '',
      degree: row.degree || row.Degree || '',
      classSection: row.classSection || row.section || row['Class Section'] || '',
      semester: row.semester || row.Semester || '',
      academicYear: row.academicYear || '',
      phone: row.phone || '',
      designation: row.designation || (role === 'student' ? 'Student' : 'Faculty Member'),
      status: 'active',
      emailVerified: true,
      faceEnrolled: false,
    });

    successful.push({ id: created._id, name: created.name, regNoOrEmpId: created.regNoOrEmpId });
  });

  recordAudit(
    (req as any).user,
    'BULK_IMPORT',
    'users',
    'batch',
    `Bulk imported ${successful.length} records, ${errors.length} failed rows.`
  );

  res.json({
    summary: {
      totalSubmitted: rows.length,
      importedCount: successful.length,
      failedCount: errors.length,
    },
    successful,
    errors,
  });
});

export default router;
