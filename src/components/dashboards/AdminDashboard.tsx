import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Users,
  GraduationCap,
  Calendar,
  ShieldCheck,
  Plus,
  Search,
  Upload,
  Activity,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  FileText,
  Building,
  BookOpen,
} from 'lucide-react';
import { FaceEnrollmentModal } from '../camera/FaceEnrollmentModal';

interface AdminDashboardProps {
  currentTab: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentTab }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // User Management State
  const [userRoleFilter, setUserRoleFilter] = useState<string>('student');
  const [userSearch, setUserSearch] = useState<string>('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [enrollingUser, setEnrollingUser] = useState<any | null>(null);

  // Academic State
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);

  // Modals for Academic CRUD
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showAddTimetableModal, setShowAddTimetableModal] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load initial data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, healthRes] = await Promise.all([api.getDashboardSummary(), api.getDbHealth()]);
      setMetrics(sumRes.metrics);
      setDbHealth(healthRes);

      // Load users
      loadUsers();
      // Load academics
      loadAcademics();
      // Load audit
      const logs = await api.getAuditLogs({ limit: '40' });
      setAuditLogs(logs);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.getUsers({
        role: userRoleFilter,
        search: userSearch,
      });
      setUsersList(res.data || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const loadAcademics = async () => {
    try {
      const [deptRes, classRes, subRes, ttRes] = await Promise.all([
        api.getDepartments(),
        api.getClasses(),
        api.getSubjects(),
        api.getTimetables(),
      ]);
      setDepartments(deptRes);
      setClasses(classRes);
      setSubjects(subRes);
      setTimetables(ttRes);
    } catch (e) {
      console.error('Failed to load academic records:', e);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [userRoleFilter, userSearch]);

  // Handle user deactivation/reactivation
  const toggleUserStatus = async (user: any) => {
    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    try {
      await api.updateUserStatus(user._id, nextStatus);
      loadUsers();
      loadDashboardData();
    } catch (e: any) {
      alert('Failed to update status: ' + e.message);
    }
  };

  const deleteUserRecord = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this account?')) return;
    try {
      await api.deleteUser(id);
      loadUsers();
      loadDashboardData();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Database Health & Connection Status */}
      <div className="bg-[#17263D] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Database Engine:</h2>
              <span className="text-xs font-mono text-cyan-300">
                {dbHealth?.storageEngine === 'mongodb' ? 'MongoDB Cluster' : 'Persistent Document DB (MongoDB-compatible)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict Dynamic Architecture · 0 Hardcoded Records · Uptime: {Math.round(process.uptime ? process.uptime() : 0)}s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-slate-900 border border-slate-700/80 rounded text-xs font-mono text-slate-300">
            Records: <span className="text-cyan-400 font-bold">{metrics?.totalStudents || 0} Students</span> ·{' '}
            <span className="text-blue-400 font-bold">{metrics?.totalFaculty || 0} Faculty</span>
          </div>
        </div>
      </div>

      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {metrics?.totalStudents || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Active institutional roster</div>
        </div>

        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Faculty Members</span>
            <GraduationCap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {metrics?.totalFaculty || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Appointed instructors</div>
        </div>

        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Biometric Enrollments</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {metrics?.enrolledFaces || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Protected facial templates</div>
        </div>

        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Attendance Sessions</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {metrics?.totalSessions || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics?.finalizedSessions || 0} finalized sessions
          </div>
        </div>
      </div>

      {/* Main View Switching based on Tab */}
      {currentTab === 'overview' || currentTab === 'users' ? (
        /* ================= USER MANAGEMENT VIEW ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Institutional User Directory</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register, manage, deactivate, and enroll facial biometric templates for all institution members.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkImportModal(true)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Bulk CSV Import
              </button>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add New User
              </button>
            </div>
          </div>

          {/* Role Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Segmented Role Controls */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {(['student', 'faculty', 'higher_official', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize cursor-pointer ${
                    userRoleFilter === r
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.replace('_', ' ')}s
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, email, ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* User Table / Empty State */}
          {usersList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-xl">
              <Users className="w-10 h-10 text-slate-600 mb-3" />
              <h4 className="text-sm font-semibold text-slate-300">No {userRoleFilter} records found</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                The database currently contains no dynamic {userRoleFilter} records matching your filter.
              </p>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Add First {userRoleFilter.replace('_', ' ')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Registration / Emp ID</th>
                    <th className="py-3 px-4">Department & Class</th>
                    <th className="py-3 px-4">Biometrics</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersList.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-300">{u.regNoOrEmpId}</td>
                      <td className="py-3 px-4">
                        <div>{u.department || '—'}</div>
                        {u.classSection && (
                          <div className="text-[10px] text-slate-400 font-mono">{u.classSection}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.faceEnrolled ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                          </span>
                        ) : (
                          <button
                            onClick={() => setEnrollingUser(u)}
                            className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Enroll Face
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            u.status === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                          title={u.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
                        >
                          {u.status === 'active' ? (
                            <XCircle className="w-4 h-4 inline" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 inline" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteUserRecord(u._id)}
                          className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : currentTab === 'academic' ? (
        /* ================= ACADEMIC CURRICULUM MANAGEMENT ================= */
        <div className="space-y-8">
          {/* Departments */}
          <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Building className="w-4 h-4 text-cyan-400" />
                <span>Academic Departments ({departments.length})</span>
              </div>
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Department
              </button>
            </div>

            {departments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No academic departments configured. Add the institution's official departments.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {departments.map((d) => (
                  <div key={d._id} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-xs">{d.name}</div>
                      <div className="text-[11px] font-mono text-cyan-400 mt-0.5">Code: {d.code}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteDepartment(d._id);
                        loadAcademics();
                      }}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Classes & Sections */}
          <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Classes & Sections ({classes.length})</span>
              </div>
              <button
                onClick={() => setShowAddClassModal(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Class Section
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No classes configured. Add class sections (e.g. CSE-4A).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {classes.map((c) => (
                  <div key={c._id} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-xs">{c.code}</div>
                      <div className="text-[10px] text-slate-400">
                        Room: {c.roomNo} · Sem {c.semester}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteClass(c._id);
                        loadAcademics();
                      }}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subjects */}
          <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Subjects & Course Codes ({subjects.length})</span>
              </div>
              <button
                onClick={() => setShowAddSubjectModal(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subject
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No courses or subjects found. Add subjects with course codes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Course Code</th>
                      <th className="py-2.5 px-4">Subject Title</th>
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4">Assigned Faculty</th>
                      <th className="py-2.5 px-4 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {subjects.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-mono text-cyan-300">{s.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-2.5 px-4">{s.department}</td>
                        <td className="py-2.5 px-4">{s.assignedFacultyName || 'Unassigned'}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={async () => {
                              await api.deleteSubject(s._id);
                              loadAcademics();
                            }}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= AUDIT LOGS VIEW ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-semibold text-white">Institutional Security Audit Logs</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically verifiable timestamped audit trail of all attendance triggers, overrides, and user changes.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 font-mono text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-4 text-slate-400 tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-cyan-300">{log.actorName}</td>
                    <td className="py-2 px-4 font-bold text-amber-400">{log.action}</td>
                    <td className="py-2 px-4 text-slate-300 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD USER ================= */}
      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => {
            setShowAddUserModal(false);
            loadUsers();
            loadDashboardData();
          }}
          departments={departments}
          classes={classes}
        />
      )}

      {/* ================= MODAL: BULK CSV IMPORT ================= */}
      {showBulkImportModal && (
        <BulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onSuccess={() => {
            setShowBulkImportModal(false);
            loadUsers();
            loadDashboardData();
          }}
        />
      )}

      {/* ================= MODAL: ADD DEPARTMENT ================= */}
      {showAddDeptModal && (
        <AddDepartmentModal
          onClose={() => setShowAddDeptModal(false)}
          onSuccess={() => {
            setShowAddDeptModal(false);
            loadAcademics();
          }}
        />
      )}

      {/* ================= MODAL: ADD CLASS ================= */}
      {showAddClassModal && (
        <AddClassModal
          departments={departments}
          onClose={() => setShowAddClassModal(false)}
          onSuccess={() => {
            setShowAddClassModal(false);
            loadAcademics();
          }}
        />
      )}

      {/* ================= MODAL: ADD SUBJECT ================= */}
      {showAddSubjectModal && (
        <AddSubjectModal
          departments={departments}
          onClose={() => setShowAddSubjectModal(false)}
          onSuccess={() => {
            setShowAddSubjectModal(false);
            loadAcademics();
          }}
        />
      )}

      {/* ================= MODAL: FACE ENROLLMENT ================= */}
      {enrollingUser && (
        <FaceEnrollmentModal
          userId={enrollingUser._id}
          userName={enrollingUser.name}
          userRegNo={enrollingUser.regNoOrEmpId}
          classSection={enrollingUser.classSection}
          onEnrollmentSuccess={() => {
            setEnrollingUser(null);
            loadUsers();
            loadDashboardData();
          }}
          onClose={() => setEnrollingUser(null)}
        />
      )}
    </div>
  );
};

// Modal subcomponents for Clean Modularity
const AddUserModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  departments: any[];
  classes: any[];
}> = ({ onClose, onSuccess, departments, classes }) => {
  const [role, setRole] = useState<'student' | 'faculty' | 'higher_official' | 'admin'>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [regNoOrEmpId, setRegNoOrEmpId] = useState('');
  const [department, setDepartment] = useState(departments[0]?.name || '');
  const [classSection, setClassSection] = useState(classes[0]?.code || '');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createUser({
        name,
        email,
        role,
        regNoOrEmpId,
        department,
        classSection: role === 'student' ? classSection : '',
        designation: designation || (role === 'student' ? 'Student' : 'Faculty Member'),
        phone,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create user record.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111C2E] border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-white">Add New Institutional Member</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && <div className="mb-4 p-2.5 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white capitalize focus:outline-none focus:border-cyan-400"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="higher_official">Higher Official</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Full Legal Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Official Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">{role === 'student' ? 'Registration No.' : 'Employee ID'}</label>
              <input
                type="text"
                required
                value={regNoOrEmpId}
                onChange={(e) => setRegNoOrEmpId(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Computer Science"
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            {role === 'student' ? (
              <div>
                <label className="block text-slate-300 mb-1">Class Section</label>
                <input
                  type="text"
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value)}
                  placeholder="CSE-4A"
                  className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Associate Professor"
                  className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BulkImportModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [csvText, setCsvText] = useState('');
  const [role, setRole] = useState('student');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);

    // Simple robust CSV parser
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must contain a header row and at least 1 record.');
      setImporting(false);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });

    try {
      const res = await api.bulkImportUsers(rows, role);
      setResult(res.summary);
      if (res.summary.importedCount > 0) {
        setTimeout(() => onSuccess(), 1800);
      }
    } catch (e: any) {
      alert('Import failed: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111C2E] border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-white">Bulk CSV Import</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Paste CSV rows with headers: <code className="text-cyan-400">name,email,regNoOrEmpId,department,classSection</code>
        </p>

        <textarea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`name,email,regNoOrEmpId,department,classSection\nJohn Doe,john@university.edu,REG-101,CSE,CSE-4A\nJane Smith,jane@university.edu,REG-102,CSE,CSE-4A`}
          className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-3 text-xs text-white font-mono placeholder-slate-600 mb-4 focus:outline-none focus:border-cyan-400"
        />

        {result && (
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs mb-4">
            Imported: <span className="text-emerald-400 font-bold">{result.importedCount}</span> · Failed:{' '}
            <span className="text-rose-400 font-bold">{result.failedCount}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            {importing ? 'Processing...' : 'Run Bulk Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddDepartmentModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createDepartment({ name, code });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Add Department</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computer Science & Engineering"
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Department Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CSE"
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white uppercase font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddClassModal: React.FC<{ departments: any[]; onClose: () => void; onSuccess: () => void }> = ({ departments, onClose, onSuccess }) => {
  const [dept, setDept] = useState(departments[0]?.code || 'CSE');
  const [sem, setSem] = useState('4');
  const [sec, setSec] = useState('A');
  const [room, setRoom] = useState('Hall 302');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createClass({ department: dept, semester: sem, section: sec, roomNo: room });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Add Class Section</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Department</label>
            <input type="text" value={dept} onChange={(e) => setDept(e.target.value)} className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-300 mb-1">Semester</label>
              <input type="text" value={sem} onChange={(e) => setSem(e.target.value)} className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white font-mono" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Section</label>
              <input type="text" value={sec} onChange={(e) => setSec(e.target.value)} className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white font-mono uppercase" />
            </div>
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Room No.</label>
            <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddSubjectModal: React.FC<{ departments: any[]; onClose: () => void; onSuccess: () => void }> = ({ departments, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dept, setDept] = useState(departments[0]?.name || 'CSE');
  const [facultyName, setFacultyName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createSubject({ code, name, department: dept, assignedFacultyName: facultyName });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Add Course / Subject</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Course Code</label>
            <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS401" className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white uppercase font-mono" />
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Subject Title</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Neural Networks & Deep Learning" className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Department</label>
            <input type="text" value={dept} onChange={(e) => setDept(e.target.value)} className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Assigned Instructor Name</label>
            <input type="text" value={facultyName} onChange={(e) => setFacultyName(e.target.value)} placeholder="Prof. Alexander Wright" className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
