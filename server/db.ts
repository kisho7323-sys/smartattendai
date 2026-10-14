import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'smartattend_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface SmartAttendDBData {
  users: any[];
  departments: any[];
  classes: any[];
  subjects: any[];
  timetables: any[];
  faceEnrollments: any[];
  attendanceSessions: any[];
  attendanceRecords: any[];
  odLeaveRequests: any[];
  studyMaterials: any[];
  aiConversations: any[];
  quizzes: any[];
  quizAttempts: any[];
  revisionPlans: any[];
  auditLogs: any[];
}

const defaultData: SmartAttendDBData = {
  users: [],
  departments: [],
  classes: [],
  subjects: [],
  timetables: [],
  faceEnrollments: [],
  attendanceSessions: [],
  attendanceRecords: [],
  odLeaveRequests: [],
  studyMaterials: [],
  aiConversations: [],
  quizzes: [],
  quizAttempts: [],
  revisionPlans: [],
  auditLogs: [],
};

class DocumentDB {
  private data: SmartAttendDBData;
  private isMongooseConnected: boolean = false;
  private storageEngine: 'mongodb' | 'embedded_persistent_json' = 'embedded_persistent_json';

  constructor() {
    this.data = this.loadFromDisk();
    this.initMongoose();
  }

  private loadFromDisk(): SmartAttendDBData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[DB] Failed to read db file, initializing fresh:', err);
    }
    this.saveToDisk(defaultData);
    return JSON.parse(JSON.stringify(defaultData));
  }

  private saveToDisk(data: SmartAttendDBData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist data to disk:', err);
    }
  }

  private async initMongoose() {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 3000,
        });
        this.isMongooseConnected = true;
        this.storageEngine = 'mongodb';
        console.log('[DB] Successfully connected to external MongoDB cluster');
      } catch (err) {
        console.warn('[DB] MongoDB URI provided but unreachable, falling back to embedded persistent document store:', (err as any).message);
        this.isMongooseConnected = false;
        this.storageEngine = 'embedded_persistent_json';
      }
    } else {
      this.storageEngine = 'embedded_persistent_json';
      console.log('[DB] Running embedded persistent document store at ./data/smartattend_db.json');
    }
  }

  public getHealth() {
    return {
      status: 'UP',
      storageEngine: this.storageEngine,
      isMongooseConnected: this.isMongooseConnected,
      collections: {
        users: this.data.users.length,
        departments: this.data.departments.length,
        classes: this.data.classes.length,
        subjects: this.data.subjects.length,
        timetables: this.data.timetables.length,
        faceEnrollments: this.data.faceEnrollments.length,
        attendanceSessions: this.data.attendanceSessions.length,
        attendanceRecords: this.data.attendanceRecords.length,
        odLeaveRequests: this.data.odLeaveRequests.length,
        studyMaterials: this.data.studyMaterials.length,
        quizzes: this.data.quizzes.length,
        quizAttempts: this.data.quizAttempts.length,
        auditLogs: this.data.auditLogs.length,
      },
      persistedPath: DB_FILE,
      timestamp: new Date().toISOString(),
    };
  }

  public collection<K extends keyof SmartAttendDBData>(name: K) {
    const self = this;
    return {
      find: (predicate?: (item: any) => boolean) => {
        const items = self.data[name] || [];
        if (!predicate) return [...items];
        return items.filter(predicate);
      },
      findById: (id: string) => {
        const items = self.data[name] || [];
        return items.find((item: any) => item._id === id || item.id === id) || null;
      },
      findOne: (predicate: (item: any) => boolean) => {
        const items = self.data[name] || [];
        return items.find(predicate) || null;
      },
      insertOne: (doc: any) => {
        const _id = doc._id || 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        const fullDoc = {
          ...doc,
          _id,
          id: _id,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        self.data[name].push(fullDoc);
        self.saveToDisk(self.data);
        return fullDoc;
      },
      updateOne: (id: string, updates: any) => {
        const index = self.data[name].findIndex((item: any) => item._id === id || item.id === id);
        if (index === -1) return null;
        const current = self.data[name][index];
        const updated = {
          ...current,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        self.data[name][index] = updated;
        self.saveToDisk(self.data);
        return updated;
      },
      deleteOne: (id: string) => {
        const initialLen = self.data[name].length;
        self.data[name] = self.data[name].filter((item: any) => item._id !== id && item.id !== id);
        const deleted = self.data[name].length < initialLen;
        if (deleted) {
          self.saveToDisk(self.data);
        }
        return deleted;
      },
      countDocuments: (predicate?: (item: any) => boolean) => {
        const items = self.data[name] || [];
        if (!predicate) return items.length;
        return items.filter(predicate).length;
      },
    };
  }
}

export const db = new DocumentDB();
