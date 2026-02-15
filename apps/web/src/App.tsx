import React from 'react';
import { HashRouter, MemoryRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext'; 


import { Home, MessageSquare, Zap, User, LogOut, Sparkles } from 'lucide-react';
import AppShell from './components/layout/AppShell';

// Features
import LandingPage from './features/auth/LandingPage';
import SignupPage from './features/auth/SignupPage';
import LoginPage from './features/auth/LoginPage';
import LoginEmailPage from './features/auth/LoginEmailPage';
import ActivitiesOverview from './features/activities/ActivitesOverview';
import GymDashboard from './features/gym-tracker/GymDashboard';
import GymHistory from './features/gym-tracker/GymHistory';
import HomeHub from './features/home/HomeHub';
import ActiveWorkout from './features/gym-tracker/GymExpandedSessionView';
import GymHistoryDetail from './features/gym-tracker/GymHistoryDetails';

import TemplateBuilderPage from './features/gym-tracker/TemplateBuilderPage';

import GymTemplates from './features/gym-tracker/GymTemplates';

import GymImportExport from './features/gym-tracker/GymImportExport';


//import { registerSW } from 'virtual:pwa-register';
/*
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Variante 1: hart reloaden (simpel, effektiv)
    updateSW(true);
  },
  onOfflineReady() {
    // optional: kannst du loggen oder toasten
    console.log('App ready to work offline');
  },
});
*/

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
          <Route path="/login-email" element={<LoginEmailPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route element={<AppShell onLogout={logout} />}>
            <Route path="/home" element={<HomeHub user={user} />} />
            <Route path="/activities" element={<ActivitiesOverview />} />
            <Route path="/activities/gym" element={<GymDashboard />} />
            <Route path="/activities/gym/active" element={<ActiveWorkout />} />
          
            <Route path="/activities/gym/history" element={<GymHistory />} />
            <Route path="/activities/gym/history/:id" element={<GymHistoryDetail />} />
            <Route path="/activities/gym/templates" element={<GymTemplates />} />
            <Route path="/activities/gym/templates/new" element={<TemplateBuilderPage />} />
            <Route path="/activities/gym/templates/:id/edit" element={<TemplateBuilderPage />} />
            <Route path="/activities/gym/importexport" element={<GymImportExport />} />
            <Route path="*" element={<Navigate to="/home" />} />
          </Route>
        </>
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