import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import UserPortal from "@/pages/UserPortal";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import KnowledgeManagement from "@/pages/admin/KnowledgeManagement";
import ResourceManagement from "@/pages/admin/ResourceManagement";
import UserManagement from "@/pages/admin/UserManagement";
import AIConfig from "@/pages/admin/AIConfig";
import AnnouncementManagement from "@/pages/admin/AnnouncementManagement";
import TicketManagement from "@/pages/admin/TicketManagement";
import GapAnalysis from "@/pages/admin/GapAnalysis";
import TrainedAnswers from "@/pages/admin/TrainedAnswers";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#64748B] font-medium">Loading...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !["super_admin", "knowledge_manager", "support_manager"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-3 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <UserPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="knowledge" element={<KnowledgeManagement />} />
        <Route path="resources" element={<ResourceManagement />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="ai-config" element={<AIConfig />} />
        <Route path="announcements" element={<AnnouncementManagement />} />
        <Route path="tickets" element={<TicketManagement />} />
        <Route path="gap-analysis" element={<GapAnalysis />} />
        <Route path="trained-answers" element={<TrainedAnswers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
