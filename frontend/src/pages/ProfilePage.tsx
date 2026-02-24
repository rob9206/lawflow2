import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, BookOpen, Target, Clock, GraduationCap, FileText, AlertTriangle, RotateCcw, Trash2, Camera } from "lucide-react";
import { getProfileStats, resetProgress, resetAll } from "@/api/profile";
import StatCard from "@/components/ui/StatCard";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showResetProgressConfirm, setShowResetProgressConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: getProfileStats,
  });

  const memberSince = useMemo(() => {
    if (!user?.created_at) return "Unknown";
    const parsed = new Date(user.created_at);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [user?.created_at]);

  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
    setBio(user?.bio ?? "");
    setAvatarPreview(null);
    setAvatarFile(null);
  }, [user?.display_name, user?.bio, user?.avatar_url]);

  const handleResetProgress = async () => {
    setIsResetting(true);
    try {
      await resetProgress();
      await queryClient.invalidateQueries();
      setResetMessage("Progress reset successfully! All study data cleared.");
      setShowResetProgressConfirm(false);
    } catch (error) {
      setResetMessage("Failed to reset progress. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      await resetAll();
      await queryClient.invalidateQueries();
      setResetMessage("All data reset successfully! Database completely cleared.");
      setShowResetAllConfirm(false);
    } catch (error) {
      setResetMessage("Failed to reset all data. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileMessage("Please select a valid image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage("Avatar must be 2MB or smaller.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileMessage("");
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileMessage("");
    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim().slice(0, 200),
      });
      await queryClient.invalidateQueries();
      setAvatarFile(null);
      setProfileMessage("Profile updated successfully.");
    } catch {
      setProfileMessage("Failed to update profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 rounded-lg w-64" style={{ backgroundColor: "var(--surface-bg)" }} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: "var(--card-bg)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<User size={24} />}
        title="Profile"
        subtitle="Your study overview and settings"
      />

      {/* Profile Header */}
      <div className="duo-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleAvatarPick}
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "2px solid var(--blue)",
                backgroundColor: "var(--blue-bg)",
                color: "var(--blue)",
              }}
            >
              {(avatarPreview || user?.avatar_url) ? (
                <img
                  src={avatarPreview || user?.avatar_url || ""}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 800 }}>
                  {(user?.display_name || user?.email || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <span
                className="absolute bottom-0 right-0 rounded-full p-1.5"
                style={{ backgroundColor: "var(--blue)", color: "white" }}
              >
                <Camera size={14} />
              </span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                  {user?.display_name || "Law Student"}
                </h3>
                <span
                  className="rounded-full px-2 py-1"
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: user?.tier === "pro" ? "var(--purple)" : "var(--text-muted)",
                    backgroundColor: user?.tier === "pro" ? "var(--purple-bg)" : "var(--card-bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {user?.tier === "pro" ? "Pro" : "Free"}
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>
                {user?.email ?? "No email available"}
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginTop: 2 }}>
                Member since {memberSince}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload avatar image"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleAvatarSelected}
            className="hidden"
          />

          <button
            onClick={handleSaveProfile}
            disabled={isSavingProfile || !displayName.trim()}
            className="duo-btn duo-btn-green"
            style={{ opacity: isSavingProfile || !displayName.trim() ? 0.6 : 1 }}
          >
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="duo-card p-5">
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
          Profile Details
        </h3>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="display_name"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}
            >
              Display name
            </label>
            <input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="duo-input w-full"
              placeholder="Your public name"
            />
          </div>
          <div>
            <label
              htmlFor="bio"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}
            >
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={4}
              className="duo-input w-full"
              placeholder="Tell us a bit about your study focus."
            />
            <p style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>{bio.length}/200</p>
          </div>
        </div>
      </div>

      {(profileMessage || resetMessage) && (
        <div
          className="duo-card p-4"
          style={{
            backgroundColor: (profileMessage + resetMessage).includes("Failed") ? "var(--red-bg)" : "var(--green-bg)",
            borderColor: (profileMessage + resetMessage).includes("Failed") ? "var(--red)" : "var(--green)",
            color: (profileMessage + resetMessage).includes("Failed") ? "var(--red)" : "var(--green)",
          }}
        >
          {profileMessage || resetMessage}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={<BookOpen size={18} />}
          label="Total Subjects"
          value={String(stats?.total_subjects ?? 0)}
          sub="active courses"
          color="var(--blue)"
        />
        <StatCard
          icon={<Target size={18} />}
          label="Total Topics"
          value={String(stats?.total_topics ?? 0)}
          sub="concepts learned"
          color="var(--green)"
        />
        <StatCard
          icon={<Target size={18} />}
          label="Overall Mastery"
          value={`${stats?.overall_mastery ?? 0}%`}
          sub="average score"
          color="var(--purple)"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Study Hours"
          value={String(stats?.total_study_hours ?? 0)}
          sub="total time"
          color="var(--orange)"
        />
        <StatCard
          icon={<GraduationCap size={18} />}
          label="Sessions"
          value={String(stats?.total_sessions ?? 0)}
          sub="study sessions"
          color="var(--purple)"
        />
        <StatCard
          icon={<FileText size={18} />}
          label="Documents"
          value={String(stats?.total_documents ?? 0)}
          sub="uploaded files"
          color="var(--blue)"
        />
      </div>

      {/* Danger Zone */}
      <div
        className="duo-card p-5"
        style={{ backgroundColor: "var(--red-bg)", borderColor: "var(--red)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} style={{ color: "var(--red)" }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            Danger Zone
          </h3>
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 24, color: "var(--text-muted)" }}>
          These actions cannot be undone. Please be certain before proceeding.
        </p>

        <div className="space-y-4">
          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ backgroundColor: "var(--card-bg)", border: "2px solid var(--border)" }}
          >
            <div>
              <h4 style={{ fontWeight: 700, color: "var(--text-primary)" }}>Reset Progress</h4>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>
                Clear all study progress, mastery scores, and sessions. Keeps uploaded documents.
              </p>
            </div>
            <button
              onClick={() => setShowResetProgressConfirm(true)}
              disabled={isResetting}
              className="duo-btn duo-btn-red flex items-center gap-2"
              style={{ opacity: isResetting ? 0.5 : 1 }}
            >
              <RotateCcw size={16} />
              Reset Progress
            </button>
          </div>

          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ backgroundColor: "var(--card-bg)", border: "2px solid var(--border)" }}
          >
            <div>
              <h4 style={{ fontWeight: 700, color: "var(--text-primary)" }}>Reset All Data</h4>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>
                Complete database wipe. Removes all data including documents, progress, and settings.
              </p>
            </div>
            <button
              onClick={() => setShowResetAllConfirm(true)}
              disabled={isResetting}
              className="duo-btn duo-btn-red flex items-center gap-2"
              style={{ opacity: isResetting ? 0.5 : 1 }}
            >
              <Trash2 size={16} />
              Reset All Data
            </button>
          </div>
        </div>
      </div>

      {/* Reset Progress Confirmation Modal */}
      {showResetProgressConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="duo-card max-w-md w-full mx-4 p-6">
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "var(--text-primary)" }}>
              Confirm Reset Progress
            </h3>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 24, color: "var(--text-muted)" }}>
              This will permanently delete all your study progress, mastery scores, sessions, and assessments.
              Your uploaded documents will be preserved. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetProgressConfirm(false)}
                disabled={isResetting}
                className="duo-btn duo-btn-outline flex-1"
                style={{ opacity: isResetting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                disabled={isResetting}
                className="duo-btn duo-btn-red flex-1"
                style={{ opacity: isResetting ? 0.5 : 1 }}
              >
                {isResetting ? "Resetting..." : "Reset Progress"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Confirmation Modal */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="duo-card max-w-md w-full mx-4 p-6">
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "var(--text-primary)" }}>
              Confirm Reset All Data
            </h3>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 24, color: "var(--text-muted)" }}>
              This will permanently delete ALL data in the database including documents, progress, sessions,
              assessments, and all other data. This is a complete wipe and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetAllConfirm(false)}
                disabled={isResetting}
                className="duo-btn duo-btn-outline flex-1"
                style={{ opacity: isResetting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                disabled={isResetting}
                className="duo-btn duo-btn-red flex-1"
                style={{ opacity: isResetting ? 0.5 : 1 }}
              >
                {isResetting ? "Resetting..." : "Reset All Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
