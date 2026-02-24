import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  sendVerification,
} from "@/api/auth";
import PageHeader from "@/components/ui/PageHeader";
import PasswordInput from "@/components/ui/PasswordInput";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage security and account preferences" />

      {!user?.email_verified && (
        <div className="duo-card p-4" style={{ backgroundColor: "var(--orange-bg)", borderColor: "var(--orange)" }}>
          <p style={{ fontWeight: 700 }}>Your email is not verified.</p>
          <button
            className="duo-btn duo-btn-outline mt-2"
            onClick={() =>
              run(async () => {
                await sendVerification();
                await refreshUser().catch(() => undefined);
                setMessage("Verification email sent.");
              })
            }
            disabled={busy}
          >
            Resend verification email
          </button>
        </div>
      )}

      <div className="duo-card p-5 space-y-4">
        <h3 style={{ fontWeight: 800, fontSize: "18px" }}>Change Email</h3>
        <input
          className="duo-input w-full"
          placeholder="New email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <PasswordInput
          value={currentPassword}
          onChange={setCurrentPassword}
          label="Current Password"
          autoComplete="current-password"
          required
        />
        <button
          className="duo-btn duo-btn-blue"
          disabled={busy || !newEmail.trim() || !currentPassword}
          onClick={() =>
            run(async () => {
              await changeEmail({
                current_password: currentPassword,
                new_email: newEmail.trim(),
              });
              await refreshUser().catch(() => undefined);
              setMessage("Check your new email to confirm the change.");
            })
          }
        >
          Save email change
        </button>
      </div>

      <div className="duo-card p-5 space-y-4">
        <h3 style={{ fontWeight: 800, fontSize: "18px" }}>Change Password</h3>
        <PasswordInput
          value={currentPassword}
          onChange={setCurrentPassword}
          label="Current Password"
          autoComplete="current-password"
          required
        />
        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          label="New Password"
          autoComplete="new-password"
          showStrength
          showRules
          required
        />
        <button
          className="duo-btn duo-btn-blue"
          disabled={busy || !currentPassword || !newPassword}
          onClick={() =>
            run(async () => {
              await changePassword({
                current_password: currentPassword,
                new_password: newPassword,
              });
              await refreshUser().catch(() => undefined);
              setMessage("Password changed successfully.");
              setCurrentPassword("");
              setNewPassword("");
            })
          }
        >
          Save new password
        </button>
      </div>

      <div className="duo-card p-5 space-y-4" style={{ borderColor: "var(--red)", backgroundColor: "var(--red-bg)" }}>
        <h3 style={{ fontWeight: 800, fontSize: "18px", color: "var(--red)" }}>Delete Account</h3>
        <p style={{ color: "var(--text-muted)" }}>
          This permanently removes your account and all study data.
        </p>
        <PasswordInput
          value={deletePassword}
          onChange={setDeletePassword}
          label="Confirm with current password"
          autoComplete="current-password"
          required
        />
        <button
          className="duo-btn duo-btn-red"
          disabled={busy || !deletePassword}
          onClick={() =>
            run(async () => {
              await deleteAccount({ current_password: deletePassword });
              logout();
              navigate("/", { replace: true });
            })
          }
        >
          Delete account
        </button>
      </div>

      {message && <p style={{ color: "var(--text-secondary)" }}>{message}</p>}
    </div>
  );
}
