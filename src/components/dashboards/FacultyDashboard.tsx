import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Camera,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { GestureAttendanceCamera } from '../camera/GestureAttendanceCamera';

interface FacultyDashboardProps {
  currentTab: string;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ currentTab }) => {
  const { user } = useAuth();

  // Faculty assigned data
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [odRequests, setOdRequests] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  // Active attendance session trigger
  const [activeCameraSession, setActiveCameraSession] = useState<any | null>(null);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState<boolean>(false);
  const [inspectingSession, setInspectingSession] = useState<any | null>(null);
  const [inspectingRecords, setInspectingRecords] = useState<any[]>([]);
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Study material upload state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Quiz creation & AI draft state
  const [showQuizModal, setShowQuizModal] = useState<boolean>(false);

  const loadFacultyData = async () => {
    try {
      const [subRes, classRes, sessRes, odRes, matRes, quizRes] = await Promise.all([
        api.getSubjects(),
        api.getClasses(),
        api.getSessions(),
        api.getOdLeaveRequests(),
        api.getStudyMaterials(),
        api.getQuizzes(),
      ]);
      setSubjects(subRes);
      setClasses(classRes);
      setSessions(sessRes);
      setOdRequests(odRes);
      setMaterials(matRes);
      setQuizzes(quizRes);
    } catch (e) {
      console.error('Failed to load faculty portal data:', e);
    }
  };

  useEffect(() => {
    loadFacultyData();
  }, []);

  const openSessionInspection = async (session: any) => {
    try {
      const res = await api.getSession(session._id);
      setInspectingSession(res.session);
      setInspectingRecords(res.records);
    } catch (e) {
      console.error('Failed to load session records:', e);
    }
  };

  const handleCorrectRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    try {
      await api.correctAttendanceRecord(correctingRecord._id, {
        newStatus: correctionStatus,
        reason: correctionReason || 'Manual faculty verification',
      });
      setCorrectingRecord(null);
      setCorrectionReason('');
      if (inspectingSession) {
        openSessionInspection(inspectingSession);
      }
      loadFacultyData();
    } catch (err: any) {
      alert('Correction error: ' + err.message);
    }
  };

  const handleOdDecision = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const notes = prompt(`Enter optional decision notes for ${status}:`);
    try {
      await api.decideOdLeave(id, { status, decisionNotes: notes || '' });
      loadFacultyData();
    } catch (err: any) {
      alert('Decision update failed: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner / Session Starter */}
      <div className="bg-[#17263D] border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Faculty Portal</span>
          <h2 className="text-xl font-bold text-white mt-1">Classroom Attendance & Learning Operations</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Launch authorized attendance sessions with facial-landmark double-blink trigger, review student OD/Leave requests, and manage course materials.
          </p>
        </div>

        <button
          onClick={() => setShowCreateSessionModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Camera className="w-4 h-4" /> Start New Attendance Session
        </button>
      </div>

      {/* Main Tabs */}
      {currentTab === 'classes' || currentTab === 'attendance' ? (
        <div className="space-y-6">
          {/* Sessions List */}
          <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Attendance Sessions</h3>
                <p className="text-xs text-slate-400 mt-0.5">Recorded sessions and double-blink gesture states</p>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                {sessions.length} Total Sessions
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No attendance sessions initiated yet. Click "Start New Attendance Session" to launch one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Class Section</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Attendance Stats</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sessions.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-200">
                          {s.date} <span className="text-slate-500">({s.startTime})</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300">{s.classSection}</td>
                        <td className="py-3 px-4 font-semibold text-white">{s.subjectName}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <span className="text-emerald-400 font-bold">{s.presentCount || 0} Present</span> ·{' '}
                          <span className="text-rose-400">{s.absentCount || 0} Absent</span> ·{' '}
                          <span className="text-cyan-400">{s.odCount || 0} OD</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              s.status === 'FINALIZED'
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                                : s.status === 'ATTENDANCE_IN_PROGRESS'
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                                : 'bg-slate-900 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {s.status !== 'FINALIZED' && (
                            <button
                              onClick={() => setActiveCameraSession(s)}
                              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3" /> Resume Scanner
                            </button>
                          )}
                          <button
                            onClick={() => openSessionInspection(s)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            Roster & Correct
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
      ) : currentTab === 'requests' ? (
        /* ================= OD & LEAVE RECONCILIATION ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Student OD & Leave Approval Portal</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Approvals automatically reconcile with attendance records across affected dates.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {odRequests.filter((r) => r.status === 'PENDING').length} Pending
            </span>
          </div>

          {odRequests.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No On-Duty or Leave applications submitted by students.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Dates Covered</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {odRequests.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{r.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.studentRegNo} · {r.classSection}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            r.type === 'OD'
                              ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                              : 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {r.startDate} <span className="text-slate-500">to</span> {r.endDate}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            r.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'REJECTED'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {r.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => handleOdDecision(r._id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleOdDecision(r._id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            By {r.approverName || 'Faculty'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : currentTab === 'materials' ? (
        /* ================= STUDY MATERIALS MANAGER ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Course Study Materials & RAG Knowledge Base</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload PDFs and syllabus notes to power the contextual AI Study Tutor.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Study Material
            </button>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No course documents uploaded yet. Upload PDFs or notes to activate AI tutor citations.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {materials.map((m) => (
                <div key={m._id} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                        {m.subjectName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {m.pageCount ? `${m.pageCount} pgs` : `${Math.round(m.fileSize / 1024)} KB`}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white mt-2 leading-tight">{m.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">{m.fileName}</p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Indexed ({m.chunkCount || 1} chunks)
                    </span>
                    <button
                      onClick={async () => {
                        await api.deleteStudyMaterial(m._id);
                        loadFacultyData();
                      }}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= QUIZZES & TESTS ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Quizzes & Assessment Builder</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Draft AI-generated question sets using Gemini and publish to enrolled classes.
              </p>
            </div>
            <button
              onClick={() => setShowQuizModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Create AI Quiz
            </button>
          </div>

          {quizzes.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No quizzes created. Use the AI Quiz builder to draft tests aligned with course topics.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quizzes.map((q) => (
                <div key={q._id} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                        {q.subjectName}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          q.status === 'PUBLISHED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white mt-2">{q.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{q.description}</p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">{q.questions?.length || 0} Questions</span>
                    {q.status === 'DRAFT' && (
                      <button
                        onClick={async () => {
                          await api.publishQuiz(q._id, 'PUBLISHED');
                          loadFacultyData();
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Publish Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: CREATE ATTENDANCE SESSION ================= */}
      {showCreateSessionModal && (
        <CreateSessionModal
          subjects={subjects}
          classes={classes}
          onClose={() => setShowCreateSessionModal(false)}
          onSuccess={(session) => {
            setShowCreateSessionModal(false);
            loadFacultyData();
            setActiveCameraSession(session);
          }}
        />
      )}

      {/* ================= MODAL: ACTIVE GESTURE CAMERA ================= */}
      {activeCameraSession && (
        <GestureAttendanceCamera
          sessionId={activeCameraSession._id}
          classSection={activeCameraSession.classSection}
          subjectName={activeCameraSession.subjectName}
          onAttendanceUpdated={loadFacultyData}
          onSessionFinalized={() => {
            setActiveCameraSession(null);
            loadFacultyData();
          }}
          onClose={() => setActiveCameraSession(null)}
        />
      )}

      {/* ================= MODAL: SESSION ROSTER & CORRECTION ================= */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-[#111C2E] border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Session Roster · {inspectingSession.classSection} · {inspectingSession.subjectName}
                </h3>
                <span className="text-xs font-mono text-slate-400">{inspectingSession.date}</span>
              </div>
              <button onClick={() => setInspectingSession(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 font-mono text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Reg No</th>
                    <th className="py-2.5 px-4">Current Status</th>
                    <th className="py-2.5 px-4">Verification Method</th>
                    <th className="py-2.5 px-4 text-right">Correct Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inspectingRecords.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-800/30">
                      <td className="py-2 px-4 font-semibold text-white">{r.studentName}</td>
                      <td className="py-2 px-4 font-mono text-cyan-300">{r.regNo}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            r.status === 'PRESENT'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'PRESENT_OD'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : r.status === 'ABSENT_APPROVED_LEAVE'
                              ? 'bg-purple-950 text-purple-400 border border-purple-800'
                              : r.status === 'NEEDS_REVIEW'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-[10px] text-slate-400">{r.verificationMethod}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => setCorrectingRecord(r)}
                          className="text-cyan-400 hover:underline font-mono text-[11px] cursor-pointer"
                        >
                          Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MANUAL CORRECTION WITH AUDIT ================= */}
      {correctingRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-xl p-5 shadow-2xl">
            <h4 className="text-xs font-semibold text-white mb-2">
              Manual Attendance Override · {correctingRecord.studentName}
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Institutional security policy requires an audit reason for all manual status corrections.
            </p>

            <form onSubmit={handleCorrectRecord} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">New Status</label>
                <select
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value)}
                  className="w-full bg-[#17263D] border border-slate-700 rounded p-1.5 text-white"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="PRESENT_OD">PRESENT_OD</option>
                  <option value="ABSENT_APPROVED_LEAVE">ABSENT_APPROVED_LEAVE</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Reason for Override (Audit Log)</label>
                <textarea
                  required
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Student present in front row, camera angle missed face"
                  className="w-full bg-[#17263D] border border-slate-700 rounded p-1.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold"
                >
                  Commit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: UPLOAD STUDY MATERIAL ================= */}
      {showUploadModal && (
        <UploadMaterialModal
          subjects={subjects}
          classes={classes}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadFacultyData();
          }}
        />
      )}

      {/* ================= MODAL: CREATE QUIZ WITH GEMINI ================= */}
      {showQuizModal && (
        <CreateQuizModal
          subjects={subjects}
          classes={classes}
          onClose={() => setShowQuizModal(false)}
          onSuccess={() => {
            setShowQuizModal(false);
            loadFacultyData();
          }}
        />
      )}
    </div>
  );
};

// Subcomponent: Create Session Modal
const CreateSessionModal: React.FC<{
  subjects: any[];
  classes: any[];
  onClose: () => void;
  onSuccess: (session: any) => void;
}> = ({ subjects, classes, onClose, onSuccess }) => {
  const [classSection, setClassSection] = useState(classes[0]?.code || 'CSE-4A');
  const [subjectId, setSubjectId] = useState(subjects[0]?._id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selSub = subjects.find((s) => s._id === subjectId) || subjects[0];
    try {
      const session = await api.createSession({
        classSection,
        subjectId: selSub ? selSub._id : 'sub_general',
        subjectName: selSub ? selSub.name : 'Computer Science Lecture',
      });
      onSuccess(session);
    } catch (err: any) {
      alert('Failed to initialize session: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Start Attendance Session</h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Target Class Section</label>
            <input
              type="text"
              required
              value={classSection}
              onChange={(e) => setClassSection(e.target.value)}
              placeholder="CSE-4A"
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Subject / Course</label>
            {subjects.length > 0 ? (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              >
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                placeholder="Artificial Intelligence"
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold">Proceed to Camera</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponent: Upload Material Modal
const UploadMaterialModal: React.FC<{
  subjects: any[];
  classes: any[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ subjects, classes, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?._id || '');
  const [classSection, setClassSection] = useState(classes[0]?.code || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const selSub = subjects.find((s) => s._id === subjectId) || subjects[0];
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    formData.append('subjectId', selSub ? selSub._id : 'sub_general');
    formData.append('subjectName', selSub ? selSub.name : 'Course');
    formData.append('classSection', classSection);

    try {
      await api.uploadStudyMaterial(formData);
      onSuccess();
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Upload Course Material</h3>
        <form onSubmit={handleUpload} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lecture 4: Transformer Architectures"
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            >
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Select File (PDF, TXT, DOCX)</label>
            <input
              type="file"
              required
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-slate-400 file:bg-blue-600 file:border-none file:text-white file:px-3 file:py-1.5 file:rounded-md file:text-xs file:mr-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md">Cancel</button>
            <button
              type="submit"
              disabled={uploading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold cursor-pointer"
            >
              {uploading ? 'Extracting Text...' : 'Upload & Index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponent: AI Quiz Generator Modal
const CreateQuizModal: React.FC<{
  subjects: any[];
  classes: any[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ subjects, classes, onClose, onSuccess }) => {
  const [topic, setTopic] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?._id || '');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState<any[]>([]);

  const handleGenerateAiQuestions = async () => {
    if (!topic) return;
    setGenerating(true);
    try {
      const res = await api.generateQuizDraft({ topic, subjectId, count: 4 });
      setDraftQuestions(res.questions || []);
      if (!title) setTitle(`${topic} Knowledge Check`);
    } catch (e: any) {
      alert('AI generation failed: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveQuiz = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title || draftQuestions.length === 0) return;
    const selSub = subjects.find((s) => s._id === subjectId) || subjects[0];
    try {
      await api.createQuiz({
        title,
        description: `Quiz on ${topic}`,
        subjectId: selSub ? selSub._id : 'sub_general',
        subjectName: selSub ? selSub.name : 'Course',
        questions: draftQuestions,
        status,
      });
      onSuccess();
    } catch (err: any) {
      alert('Failed to save quiz: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#111C2E] border border-slate-700 rounded-2xl p-6 flex flex-col max-h-[90vh]">
        <h3 className="text-sm font-semibold text-white mb-2">AI-Powered Quiz Generator</h3>
        <p className="text-xs text-slate-400 mb-4">
          Draft rigorous curriculum-aligned questions automatically using Gemini AI and review before publishing.
        </p>

        <div className="space-y-3 text-xs mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              >
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Topic / Chapter</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Backpropagation & Gradient Descent"
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAiQuestions}
              disabled={generating || !topic}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generating ? 'Drafting Questions with Gemini...' : 'Generate AI Question Draft'}
            </button>
          </div>
        </div>

        {draftQuestions.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
            <div>
              <label className="block text-slate-300 text-xs mb-1">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>

            {draftQuestions.map((q, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs space-y-2">
                <div className="font-semibold text-slate-200">
                  {idx + 1}. {q.question}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {q.options.map((opt: string, i: number) => (
                    <div
                      key={i}
                      className={`p-2 rounded border ${
                        i === q.correctOptionIndex
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold'
                          : 'border-slate-800 text-slate-400'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <div className="text-[10px] text-slate-400 italic">Explanation: {q.explanation}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs">
            Cancel
          </button>
          {draftQuestions.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => handleSaveQuiz('DRAFT')}
                className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveQuiz('PUBLISHED')}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
              >
                Publish to Students
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
