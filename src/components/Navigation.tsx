import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const { user, logout } = useAuth();

  // Role-specific primary navigation tabs (strictly 4-5 concise single-line text links)
  const getNavLinks = () => {
    if (!user) return [];
    if (user.role === 'admin') {
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'users', label: 'User Directory' },
        { id: 'academic', label: 'Curriculum' },
        { id: 'reports', label: 'Reports' },
        { id: 'audit', label: 'Audit Logs' },
      ];
    }
    if (user.role === 'faculty') {
      return [
        { id: 'classes', label: 'My Classes' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'requests', label: 'OD & Leave' },
        { id: 'materials', label: 'Materials' },
        { id: 'quizzes', label: 'Quizzes' },
      ];
    }
    if (user.role === 'student') {
      return [
        { id: 'attendance', label: 'My Attendance' },
        { id: 'od_leave', label: 'Apply OD/Leave' },
        { id: 'tutor', label: 'AI Study Tutor' },
        { id: 'quizzes', label: 'Tests & Quizzes' },
        { id: 'biometrics', label: 'Face Enrollment' },
      ];
    }
    // Higher Official
    return [
      { id: 'overview', label: 'Analytics' },
      { id: 'departments', label: 'Departments' },
      { id: 'compliance', label: 'Compliance' },
      { id: 'audit', label: 'Audit History' },
    ];
  };

  const links = getNavLinks();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B1220]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            SmartAttend <span className="text-cyan-400">AI</span>
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {user?.role === 'higher_official' ? 'Official' : user?.role || 'Portal'}
          </span>
        </div>

        {/* Zone 2: 4-5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {links.map((link) => {
            const active = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onTabChange(link.id)}
                className={`transition-colors whitespace-nowrap shrink-0 text-sm py-1 cursor-pointer ${
                  active
                    ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Profile info & primary action */}
        <div className="flex items-center gap-4 shrink-0">
          {user && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                {user.regNoOrEmpId || user.email}
              </span>
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Sign out of SmartAttend"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
