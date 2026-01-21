import React from 'react';
import { HashRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext'; 

import { Home, MessageSquare, Zap, User, LogOut, Sparkles } from 'lucide-react';
import AppShell from './components/layout/AppShell';

// Features
import LandingPage from './features/auth/LandingPage';
import SignupPage from './features/auth/SignupPage';
import LoginPage from './features/auth/LoginPage';
import ActivitiesOverview from './features/activities/ActivitesOverview';
import GymDashboard from './features/gym-tracker/GymDashboard';
import GymHistory from './features/gym-tracker/GymHistory';
import HomeHub from './features/home/HomeHub';

// This logic detects if we are in a limited environment (like some web previews)
const Router = typeof window !== 'undefined' && window.location.protocol === 'blob:' 
  ? MemoryRouter 
  : HashRouter;


/**
 * AppContent handles the actual view switching.
 * It must be a separate component so it can use the 'useAuth' hook.
 */
const AppContent: React.FC = () => {
  const { user, loading, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <Routes>
      {!user ? (
        <>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <Route path="/*" element={
          <AppShell onLogout={logout}>
            <Routes>
              <Route path="/home" element={<HomeHub user={user}/>} />
              <Route path="/activities" element={<ActivitiesOverview />} />
              <Route path="/activities/gym" element={<GymDashboard />} />
              <Route path="/activities/gym/history" element={<GymHistory />} />
              <Route path="/feed" element={<PlaceholderView title="Social Feed" />} />
              <Route path="/settings" element={<PlaceholderView title="Settings" />} />
              <Route path="*" element={<Navigate to="/home" />} />
              {/* ... rest of your routes */}
            </Routes>
          </AppShell>
        } />
      )}
    </Routes>
  );
};


const PlaceholderView: React.FC<{ title: string }> = ({ title }) => (
  <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in">
    <h2 className="text-xl font-black">{title}</h2>
    <p className="text-[var(--text-muted)] text-sm mt-2">Content coming soon to this module.</p>
  </div>
);

// Main Entry Point
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;