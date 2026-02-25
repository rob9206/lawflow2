import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import Layout from "@/components/common/Layout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import TutorialModal from "@/components/common/TutorialModal";
import UpgradeModal from "@/components/common/UpgradeModal";
import { TutorialProvider } from "@/context/TutorialContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { useAuth } from "@/context/AuthContext";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const TutorPage = lazy(() => import("@/pages/TutorPage"));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));
const AutoTeachPage = lazy(() => import("@/pages/AutoTeachPage"));
const AutoTeachSessionPage = lazy(() => import("@/pages/AutoTeachSessionPage"));
const FlashcardPage = lazy(() => import("@/pages/FlashcardPage"));
const ProgressPage = lazy(() => import("@/pages/ProgressPage"));
const SubjectsListPage = lazy(() =>
  import("@/pages/SubjectsPage").then((m) => ({ default: m.SubjectsListPage }))
);
const SubjectDetailPage = lazy(() =>
  import("@/pages/SubjectsPage").then((m) => ({ default: m.SubjectDetailPage }))
);
const ExamSimulatorPage = lazy(() => import("@/pages/ExamSimulatorPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const RewardsPage = lazy(() => import("@/pages/RewardsPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));
const ConfirmEmailChangePage = lazy(() => import("@/pages/ConfirmEmailChangePage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-3 border-t-transparent animate-spin"
          style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }}
        />
        <span style={{ color: "var(--text-muted)", fontSize: "15px", fontWeight: 600 }}>
          Loading...
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TutorialProvider>
        <UpgradeProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/tutor" element={<TutorPage />} />
                  <Route path="/tutor/:sessionId" element={<TutorPage />} />
                  <Route path="/auto-teach" element={<AutoTeachPage />} />
                  <Route path="/auto-teach/session/:sessionId" element={<AutoTeachSessionPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/flashcards" element={<FlashcardPage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/subjects" element={<SubjectsListPage />} />
                  <Route path="/subjects/:subject" element={<SubjectDetailPage />} />
                  <Route path="/exam" element={<ExamSimulatorPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  } />
                  <Route path="/rewards" element={<RewardsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
        <TutorialModal />
        <UpgradeModal />
        </UpgradeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card-bg)",
              border: "2px solid var(--border)",
              borderBottom: "4px solid var(--border-dark)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-primary)",
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 700,
              fontSize: "15px",
            },
            classNames: {
              success: "!border-[var(--green)] !border-b-[var(--green-dark)] !bg-[var(--green-bg)]",
              error: "!border-[var(--red)] !border-b-[var(--red-dark)] !bg-[var(--red-bg)]",
              warning: "!border-[var(--orange)] !border-b-[var(--orange-dark)] !bg-[var(--orange-bg)]",
              info: "!border-[var(--blue)] !border-b-[var(--blue-dark)] !bg-[var(--blue-bg)]",
            },
          }}
        />
      </TutorialProvider>
    </BrowserRouter>
  );
}
