import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import BlogPage from './pages/BlogPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import CaseDiary from './pages/CaseDiary';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import ClientsPage from './pages/ClientsPage';
import CasesPage from './pages/CasesPage';
import VaultPage from './pages/VaultPage';
import BillingPage from './pages/BillingPage';
import TeamPage from './pages/TeamPage';
import LibraryPage from './pages/LibraryPage';
import { FeaturesPage, HowItWorksPage, SecurityPage, FaqPage } from './pages/InfoPages';
import StartPage from './pages/StartPage';
import ClientPortalPage from './pages/ClientPortalPage';
import FindLawyerPage from './pages/FindLawyerPage';
import { getToken, isTokenExpired, endSession } from './api';

/* ── Auth guard: redirects to /login if the token is missing or expired ── */
function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  if (isTokenExpired(token)) {
    endSession();  // clears the stale token and shows "session expired" on the login page
    return null;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public website: landing, about, blog */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          <Route path="/lawyers" element={<FindLawyerPage />} />
          <Route path="/lawyers/:id" element={<FindLawyerPage />} />
        </Route>

        <Route path="/start" element={<StartPage />} />
        <Route path="/client" element={<ClientPortalPage />} />

        <Route path="/login" element={<AuthPage />} />

        {/* The app (requires login) */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/diary" element={<CaseDiary />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
