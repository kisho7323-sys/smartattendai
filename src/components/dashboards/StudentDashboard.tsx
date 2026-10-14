import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Clock,
  HelpCircle,
  FileText,
  Award,
} from 'lucide-react';
import { FaceEnrollmentModal } from '../camera/FaceEnrollmentModal';

interface StudentDashboardProps {
  currentTab: string;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentTab }) => {
  const { user } = useAuth();

  // Attendance metrics
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Biometrics
  const [enrollmentStatus, setEnrollmentStatus] = useState<any>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // OD & Leave
  const [myOdLeaves, setMyOdLeaves] = useState<any[]>([]);
  const [showApplyOdModal, setShowApplyOdModal] = useState(false);

  // AI Tutor
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorMessages, setTutorMessages] = useState<any[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);

  // Quizzes & Revision Plans
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [lastQuizResult, setLastQuizResult] = useState<any | null>(null);
  const [revisionPlans, setRevisionPlans] = useState<any[]>([]);

  const loadStudentData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [attRes, bioRes, odRes, subRes, quizRes, planRes] = await Promise.all([
        api.getStudentAttendanceRecords(),
        api.getEnrollmentStatus(user.id || (user as any)._id),
        api.getOdLeaveRequests(),
        api.getSubjects(),
        api.getQuizzes(),
        api.getMyRevisionPlans(),
      ]);

      setAttendanceData(attRes);
      setEnrollmentStatus(bioRes);
      setMyOdLeaves(odRes);
      setSubjects(subRes);
      if (subRes.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subRes[0]._id);
      }
      setQuizzes(quizRes);
      setRevisionPlans(planRes);
    } catch (e) {
      console.error('Failed to load student dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [user]);

  // Handle AI Tutor Query
  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuery.trim() || !selectedSubjectId) return;

    const queryText = tutorQuery;
    setTutorQuery('');
    setTutorMessages((prev) => [...prev, { sender: 'student', text: queryText, timestamp: new Date().toLocaleTimeString() }]);
    setTutorLoading(true);

    try {
      const res = await api.askAiTutor({
        question: queryText,
        subjectId: selectedSubjectId,
      });

      setTutorMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: res.answer,
          sources: res.sources,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      setTutorMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: `Error connecting to AI tutor: ${err.message}`,
          sources: [],
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  // Handle Quiz Submission
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setQuizSubmitting(true);
    try {
      const result = await api.submitQuizAttempt(activeQuiz._id, quizAnswers);
      setLastQuizResult(result);
      setActiveQuiz(null);
      setQuizAnswers({});
      loadStudentData();
    } catch (err: any) {
      alert('Quiz submission failed: ' + err.message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const overallPct = attendanceData?.overall?.percentage || 0;
  const isShortage = overallPct < 75 && (attendanceData?.overall?.totalClasses || 0) >= 3;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Attendance & Biometric Header Strip */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Attendance KPI Card (8 cols) */}
        <div className="md:col-span-8 bg-[#17263D] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Academic Record</span>
                <h2 className="text-xl font-bold text-white mt-0.5">My Attendance Status</h2>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  isShortage
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                }`}
              >
                {isShortage ? 'Attendance Shortage (<75%)' : 'Eligible Attendance (≥75%)'}
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-bold font-mono text-white tabular-nums">
                {overallPct}%
              </span>
              <span className="text-xs text-slate-400">
                ({attendanceData?.overall?.attendedClasses || 0} of {attendanceData?.overall?.totalClasses || 0} lectures attended)
              </span>
            </div>

            {/* Attendance Progress Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full mt-3 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPct >= 75 ? 'bg-cyan-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, overallPct)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>Class Section: <strong className="text-white font-mono">{user?.classSection || 'CSE-4A'}</strong></span>
            <span>Registration ID: <strong className="text-cyan-300 font-mono">{user?.regNoOrEmpId}</strong></span>
          </div>
        </div>

        {/* Biometrics Card (4 cols) */}
        <div className="md:col-span-4 bg-[#17263D] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Face Biometrics</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center">
                {user?.profilePhoto ? (
                  <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-slate-500" />
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-white">
                  {enrollmentStatus?.isEnrolled ? 'Enrolled & Verified' : 'Enrollment Required'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {enrollmentStatus?.isEnrolled ? 'Template active' : 'Not yet enrolled'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {enrollmentStatus?.isEnrolled ? 'Re-enroll Face' : 'Enroll Face Biometrics'}
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      {currentTab === 'attendance' ? (
        /* ================= SUBJECT ATTENDANCE BREAKDOWN ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">Subject-Wise Attendance Breakdown</h3>
            <span className="text-xs text-slate-400">Calculated directly from session verification logs</span>
          </div>

          {!attendanceData?.subjectStats || attendanceData.subjectStats.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No verified attendance records found yet. Once your faculty holds an attendance session, records will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {attendanceData.subjectStats.map((sub: any) => (
                <div key={sub.subjectId} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate max-w-[150px]">{sub.subjectName}</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        sub.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sub.percentage}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {sub.attendedClasses} of {sub.totalClasses} classes attended
                  </div>
                  {sub.isShortage && (
                    <div className="mt-2 text-[10px] text-rose-400 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Shortage Warning
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : currentTab === 'od_leave' ? (
        /* ================= OD & LEAVE APPLICATIONS ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">On-Duty & Medical Leave Requests</h3>
              <p className="text-xs text-slate-400 mt-0.5">Approved OD requests mark attendance as PRESENT_OD</p>
            </div>
            <button
              onClick={() => setShowApplyOdModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Submit New Request
            </button>
          </div>

          {myOdLeaves.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              You haven't submitted any OD or Leave requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 font-mono text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Dates</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Decision Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {myOdLeaves.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-cyan-300">{req.type}</td>
                      <td className="py-2.5 px-4 font-mono">{req.startDate} to {req.endDate}</td>
                      <td className="py-2.5 px-4 max-w-xs truncate">{req.reason}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 italic text-[11px]">{req.decisionNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : currentTab === 'tutor' ? (
        /* ================= AI STUDY ASSISTANT (RAG) ================= */
        <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">AI Academic Study Tutor</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Answers questions using verified institutional course materials with genuine source citations.
              </p>
            </div>

            {/* Subject Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Course Subject:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs"
              >
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversation History */}
          <div className="h-96 overflow-y-auto space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            {tutorMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                <BookOpen className="w-8 h-8 text-slate-600 mb-2" />
                <p>Ask any academic question related to this course.</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-sm">
                  The AI tutor will cross-reference the lecturer's uploaded PDFs and cite exact document passages.
                </p>
              </div>
            ) : (
              tutorMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-2xl p-3.5 rounded-xl text-xs leading-relaxed ${
                      msg.sender === 'student'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-[#17263D] border border-slate-700/80 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Source citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] space-y-1">
                        <span className="text-cyan-400 font-mono font-semibold">Verified Course Citations:</span>
                        {msg.sources.map((s: any, sIdx: number) => (
                          <div key={sIdx} className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-300">
                            <strong>{s.title}</strong>: {s.snippet}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 font-mono">{msg.timestamp}</span>
                </div>
              ))
            )}
            {tutorLoading && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Searching course materials and generating answer...</span>
              </div>
            )}
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleAskTutor} className="flex gap-2">
            <input
              type="text"
              value={tutorQuery}
              onChange={(e) => setTutorQuery(e.target.value)}
              placeholder="Ask a question about the syllabus or uploaded lecture notes..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={tutorLoading || !tutorQuery.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
            >
              <Send className="w-3.5 h-3.5" /> Ask Tutor
            </button>
          </form>
        </div>
      ) : (
        /* ================= QUIZZES & REVISION PLANS ================= */
        <div className="space-y-6">
          {/* Active Quiz Taking Modal */}
          {activeQuiz && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl bg-[#111C2E] border border-slate-700 rounded-2xl p-6 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{activeQuiz.title}</h3>
                    <span className="text-xs text-slate-400">{activeQuiz.subjectName} · {activeQuiz.questions?.length} Questions</span>
                  </div>
                  <button onClick={() => setActiveQuiz(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                  {activeQuiz.questions.map((q: any, idx: number) => (
                    <div key={q.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs space-y-3">
                      <div className="font-semibold text-white">
                        {idx + 1}. {q.question}
                      </div>

                      <div className="space-y-2">
                        {q.options.map((opt: string, optIdx: number) => (
                          <label
                            key={optIdx}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              quizAnswers[q.id] === optIdx
                                ? 'bg-blue-950/80 border-blue-500 text-white font-medium'
                                : 'border-slate-800 text-slate-300 hover:bg-slate-800/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={quizAnswers[q.id] === optIdx}
                              onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                              className="accent-blue-500"
                            />
                            <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button onClick={() => setActiveQuiz(null)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={quizSubmitting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    {quizSubmitting ? 'Grading Answers...' : 'Submit Quiz for Grading'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Last Quiz Result Banner */}
          {lastQuizResult && (
            <div className="bg-emerald-950/60 border border-emerald-600/60 rounded-xl p-5 text-xs text-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 text-sm">Quiz Results</span>
                <span className="font-mono text-xs bg-slate-900 px-2 py-0.5 rounded border border-emerald-800">
                  Score: {lastQuizResult.score}/{lastQuizResult.totalQuestions} ({lastQuizResult.percentage}%)
                </span>
              </div>
              <p>Objective evaluation complete. Persisted into your academic profile.</p>

              {lastQuizResult.revisionPlan && (
                <div className="mt-3 pt-3 border-t border-emerald-900 text-slate-300">
                  <strong className="text-cyan-300">Personalized AI Revision Plan:</strong>
                  <div className="whitespace-pre-wrap mt-1 text-slate-300 leading-relaxed">
                    {lastQuizResult.revisionPlan}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Available Quizzes */}
          <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-3">Published Quizzes & Knowledge Checks</h3>

            {quizzes.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No active quizzes available for your class.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {quizzes.map((q) => (
                  <div key={q._id} className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-cyan-400">{q.subjectName}</span>
                        {q.attempted ? (
                          <span className="text-emerald-400 font-bold">Score: {q.myPercentage}%</span>
                        ) : (
                          <span className="text-slate-500">Not Attempted</span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-white mt-1.5">{q.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{q.description}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">{q.questions?.length || 0} Questions</span>
                      {!q.attempted ? (
                        <button
                          onClick={() => {
                            setActiveQuiz(q);
                            setQuizAnswers({});
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Start Test
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: FACE ENROLLMENT ================= */}
      {showEnrollModal && user && (
        <FaceEnrollmentModal
          userId={user.id || (user as any)._id}
          userName={user.name}
          userRegNo={user.regNoOrEmpId || ''}
          classSection={user.classSection}
          onEnrollmentSuccess={() => {
            setShowEnrollModal(false);
            loadStudentData();
          }}
          onClose={() => setShowEnrollModal(false)}
        />
      )}

      {/* ================= MODAL: APPLY OD / LEAVE ================= */}
      {showApplyOdModal && (
        <ApplyOdLeaveModal
          onClose={() => setShowApplyOdModal(false)}
          onSuccess={() => {
            setShowApplyOdModal(false);
            loadStudentData();
          }}
        />
      )}
    </div>
  );
};

const ApplyOdLeaveModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [type, setType] = useState<'OD' | 'LEAVE'>('OD');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitOdLeave({ type, startDate, endDate, reason });
      onSuccess();
    } catch (e: any) {
      alert('Application failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#111C2E] border border-slate-700 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Apply for On-Duty (OD) or Leave</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Request Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            >
              <option value="OD">On-Duty (Hackathon / University Event)</option>
              <option value="LEAVE">Medical / Personal Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Official Reason</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Representing college in Smart India Hackathon finals"
              className="w-full bg-[#17263D] border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
