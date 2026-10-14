import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { AuthScreens } from './components/auth/AuthScreens';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { FacultyDashboard } from './components/dashboards/FacultyDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { HigherOfficialDashboard } from './components/dashboards/HigherOfficialDashboard';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
        <span className="text-xs font-mono">Connecting to SmartAttend Platform...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreens />;
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F8FAFC] flex flex-col">
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="flex-1 pb-16">
        {user.role === 'admin' && <AdminDashboard currentTab={currentTab} />}
        {user.role === 'faculty' && <FacultyDashboard currentTab={currentTab} />}
        {user.role === 'student' && <StudentDashboard currentTab={currentTab} />}
        {user.role === 'higher_official' && <HigherOfficialDashboard currentTab={currentTab} />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
