import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Building, TrendingUp, Users, Calendar, AlertCircle, ShieldAlert, Award } from 'lucide-react';

interface HigherOfficialDashboardProps {
  currentTab: string;
}

export const HigherOfficialDashboard: React.FC<HigherOfficialDashboardProps> = ({ currentTab }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOfficialData = async () => {
      setLoading(true);
      try {
        const [sumRes, deptRes, logsRes] = await Promise.all([
          api.getDashboardSummary(),
          api.getDepartmentBreakdown(),
          api.getAuditLogs({ limit: '30' }),
        ]);
        setSummary(sumRes);
        setDepartments(deptRes);
        setAuditLogs(logsRes);
      } catch (e) {
        console.error('Failed to load higher official data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadOfficialData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Executive KPI Strip */}
      <div className="bg-[#17263D] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Executive Directorate</span>
            <h2 className="text-xl font-bold text-white mt-0.5">Institutional Attendance Analytics & Compliance</h2>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded border border-slate-800">
            Real-Time MongoDB Aggregations
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400">Institutional Attendance Rate</span>
            <div className="text-3xl font-bold font-mono text-white mt-1 tabular-nums">
              {summary?.metrics?.overallAttendanceRate || 0}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              Across {summary?.metrics?.totalRecords || 0} verification events
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400">Total Enrolled Students</span>
            <div className="text-3xl font-bold font-mono text-cyan-400 mt-1 tabular-nums">
              {summary?.metrics?.totalStudents || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {summary?.metrics?.enrolledFaces || 0} biometric-enrolled
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400">Attendance Sessions Held</span>
            <div className="text-3xl font-bold font-mono text-blue-400 mt-1 tabular-nums">
              {summary?.metrics?.totalSessions || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {summary?.metrics?.finalizedSessions || 0} verified & finalized
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400">Reconciled OD & Leaves</span>
            <div className="text-3xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              {(summary?.metrics?.odRecords || 0) + (summary?.metrics?.leaveRecords || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {summary?.metrics?.odRecords || 0} On-Duty · {summary?.metrics?.leaveRecords || 0} Leaves
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-white">Department-Level Attendance & Roster Breakdown</h3>
          <span className="text-xs text-slate-400">Zero synthetic metrics · Computed live</span>
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No department records configured. When departments and students are added by administration, statistics will aggregate here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 font-mono text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Students</th>
                  <th className="py-2.5 px-4">Faculty</th>
                  <th className="py-2.5 px-4">Total Records</th>
                  <th className="py-2.5 px-4 text-right">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {departments.map((dept) => (
                  <tr key={dept.departmentId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-white">{dept.name}</td>
                    <td className="py-3 px-4 font-mono text-cyan-300">{dept.code}</td>
                    <td className="py-3 px-4 font-mono">{dept.studentCount}</td>
                    <td className="py-3 px-4 font-mono">{dept.facultyCount}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{dept.totalAttendanceRecords}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          dept.attendancePercentage >= 75
                            ? 'text-emerald-400'
                            : dept.totalAttendanceRecords > 0
                            ? 'text-rose-400'
                            : 'text-slate-500'
                        }
                      >
                        {dept.attendancePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Oversight */}
      <div className="bg-[#17263D] border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Institutional Governance & Audit History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono text-[11px]">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log._id}>
                  <td className="py-2 px-4 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="py-2 px-4 text-cyan-300">{log.actorName}</td>
                  <td className="py-2 px-4 text-amber-400">{log.action}</td>
                  <td className="py-2 px-4 text-slate-300 font-sans">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
