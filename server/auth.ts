import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smartattend_jwt_secure_secret_key_2026';

export interface AuthUser {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'faculty' | 'student' | 'higher_official';
  department?: string;
  regNoOrEmpId?: string;
  classSection?: string;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user._id || user.id,
      _id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      regNoOrEmpId: user.regNoOrEmpId,
      classSection: user.classSection,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: `Forbidden. Role '${user.role}' lacks permission. Required: [${roles.join(', ')}]`,
      });
      return;
    }
    next();
  };
}

export function recordAudit(
  actor: AuthUser | null,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  ipAddress?: string
) {
  try {
    db.collection('auditLogs').insertOne({
      actorId: actor ? actor._id || actor.id : 'SYSTEM',
      actorName: actor ? actor.name : 'System Process',
      actorRole: actor ? actor.role : 'system',
      action,
      entityType,
      entityId,
      details,
      ipAddress: ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[AUDIT] Failed to write log:', e);
  }
}
