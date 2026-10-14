export const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('smartattend_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('smartattend_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('smartattend_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || response.statusText || 'Request failed';
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Health
  getHealth: () => request<any>('/health'),
  getDbHealth: () => request<any>('/health/db'),

  // Auth
  getAuthStatus: () => request<{ hasAdmin: boolean; databaseConnected: boolean }>('/auth/status'),
  setupAdmin: (payload: any) => request<any>('/auth/setup-admin', { method: 'POST', body: JSON.stringify(payload) }),
  login: (credentials: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request<any>('/auth/me'),

  // Users
  getUsers: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any>(`/users${query ? `?${query}` : ''}`);
  },
  getUser: (id: string) => request<any>(`/users/${id}`),
  createUser: (user: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: string, updates: any) => request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  updateUserStatus: (id: string, status: 'active' | 'deactivated') =>
    request<any>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteUser: (id: string) => request<any>(`/users/${id}`, { method: 'DELETE' }),
  bulkImportUsers: (rows: any[], role: string) =>
    request<any>('/users/bulk-import', { method: 'POST', body: JSON.stringify({ rows, role }) }),

  // Academic
  getDepartments: () => request<any[]>('/academic/departments'),
  createDepartment: (dept: any) => request<any>('/academic/departments', { method: 'POST', body: JSON.stringify(dept) }),
  deleteDepartment: (id: string) => request<any>(`/academic/departments/${id}`, { method: 'DELETE' }),

  getClasses: () => request<any[]>('/academic/classes'),
  createClass: (cls: any) => request<any>('/academic/classes', { method: 'POST', body: JSON.stringify(cls) }),
  deleteClass: (id: string) => request<any>(`/academic/classes/${id}`, { method: 'DELETE' }),

  getSubjects: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/academic/subjects${query ? `?${query}` : ''}`);
  },
  createSubject: (sub: any) => request<any>('/academic/subjects', { method: 'POST', body: JSON.stringify(sub) }),
  deleteSubject: (id: string) => request<any>(`/academic/subjects/${id}`, { method: 'DELETE' }),

  getTimetables: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/academic/timetables${query ? `?${query}` : ''}`);
  },
  createTimetable: (tt: any) => request<any>('/academic/timetables', { method: 'POST', body: JSON.stringify(tt) }),
  deleteTimetable: (id: string) => request<any>(`/academic/timetables/${id}`, { method: 'DELETE' }),

  // Biometrics
  getEnrollmentStatus: (userId: string) => request<any>(`/biometrics/status/${userId}`),
  enrollFace: (payload: any) => request<any>('/biometrics/enroll', { method: 'POST', body: JSON.stringify(payload) }),
  revokeEnrollment: (userId: string) => request<any>(`/biometrics/${userId}`, { method: 'DELETE' }),
  matchFace: (payload: any) => request<any>('/biometrics/match', { method: 'POST', body: JSON.stringify(payload) }),

  // Attendance
  getSessions: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/attendance/sessions${query ? `?${query}` : ''}`);
  },
  getSession: (id: string) => request<any>(`/attendance/sessions/${id}`),
  createSession: (payload: any) => request<any>('/attendance/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  triggerGesture: (sessionId: string, payload: any) =>
    request<any>(`/attendance/sessions/${sessionId}/trigger-gesture`, { method: 'POST', body: JSON.stringify(payload) }),
  markRecognized: (sessionId: string, payload: any) =>
    request<any>(`/attendance/sessions/${sessionId}/mark-recognized`, { method: 'POST', body: JSON.stringify(payload) }),
  correctAttendanceRecord: (recordId: string, payload: any) =>
    request<any>(`/attendance/records/${recordId}/correct`, { method: 'PATCH', body: JSON.stringify(payload) }),
  finalizeSession: (sessionId: string) =>
    request<any>(`/attendance/sessions/${sessionId}/finalize`, { method: 'POST' }),
  getStudentAttendanceRecords: () => request<any>('/attendance/student-records'),

  // OD / Leave
  getOdLeaveRequests: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/od-leave${query ? `?${query}` : ''}`);
  },
  submitOdLeave: (payload: any) => request<any>('/od-leave', { method: 'POST', body: JSON.stringify(payload) }),
  decideOdLeave: (id: string, payload: any) =>
    request<any>(`/od-leave/${id}/decision`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Study Materials & AI Tutor
  getStudyMaterials: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/study/materials${query ? `?${query}` : ''}`);
  },
  uploadStudyMaterial: (formData: FormData) =>
    request<any>('/study/upload', { method: 'POST', body: formData }),
  deleteStudyMaterial: (id: string) => request<any>(`/study/materials/${id}`, { method: 'DELETE' }),
  askAiTutor: (payload: any) => request<any>('/study/tutor/ask', { method: 'POST', body: JSON.stringify(payload) }),
  getTutorHistory: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/study/tutor/history${query ? `?${query}` : ''}`);
  },

  // Quizzes
  getQuizzes: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/quizzes${query ? `?${query}` : ''}`);
  },
  getQuiz: (id: string) => request<any>(`/quizzes/${id}`),
  generateQuizDraft: (payload: any) => request<any>('/quizzes/generate-draft', { method: 'POST', body: JSON.stringify(payload) }),
  createQuiz: (payload: any) => request<any>('/quizzes', { method: 'POST', body: JSON.stringify(payload) }),
  publishQuiz: (id: string, status: 'DRAFT' | 'PUBLISHED') =>
    request<any>(`/quizzes/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  submitQuizAttempt: (id: string, answers: any) =>
    request<any>(`/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getMyRevisionPlans: () => request<any[]>('/quizzes/revision-plans/my'),

  // Analytics
  getDashboardSummary: () => request<any>('/analytics/dashboard-summary'),
  getDepartmentBreakdown: () => request<any[]>('/analytics/department-breakdown'),
  getAuditLogs: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/analytics/audit-logs${query ? `?${query}` : ''}`);
  },
};
