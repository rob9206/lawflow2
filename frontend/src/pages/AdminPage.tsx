import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  tier: "free" | "pro";
  is_admin: boolean;
  is_active: boolean;
  email_verified: boolean;
};

type AdminStats = {
  total_users: number;
  pro_users: number;
  active_users: number;
  unverified_users: number;
  admin_users: number;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [statsRes, usersRes] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/users", { params: { q: query, page: 1, page_size: 50 } }),
    ]);
    setStats(statsRes.data);
    setUsers(usersRes.data.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateUser = async (
    userId: string,
    patch: Partial<Pick<AdminUser, "tier" | "is_active" | "is_admin">>
  ) => {
    try {
      await api.put(`/admin/users/${userId}`, patch);
      await load();
      setMessage("User updated.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      await load();
      setMessage("User deleted.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Manage users and account states" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="duo-card p-3">Total: {stats?.total_users ?? 0}</div>
        <div className="duo-card p-3">Pro: {stats?.pro_users ?? 0}</div>
        <div className="duo-card p-3">Active: {stats?.active_users ?? 0}</div>
        <div className="duo-card p-3">Unverified: {stats?.unverified_users ?? 0}</div>
        <div className="duo-card p-3">Admins: {stats?.admin_users ?? 0}</div>
      </div>

      <div className="duo-card p-4 space-y-3">
        <div className="flex gap-2">
          <input
            className="duo-input flex-1"
            placeholder="Search email or display name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="duo-btn duo-btn-blue" onClick={() => void load()}>
            Search
          </button>
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="duo-card p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p style={{ fontWeight: 800 }}>{user.display_name}</p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{user.email}</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {user.email_verified ? "verified" : "unverified"} | {user.is_active ? "active" : "inactive"} | {user.is_admin ? "admin" : "member"}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  className="duo-btn duo-btn-outline"
                  onClick={() => void updateUser(user.id, { tier: user.tier === "pro" ? "free" : "pro" })}
                >
                  Tier: {user.tier}
                </button>
                <button
                  className="duo-btn duo-btn-outline"
                  onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                >
                  {user.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  className="duo-btn duo-btn-outline"
                  onClick={() => void updateUser(user.id, { is_admin: !user.is_admin })}
                >
                  {user.is_admin ? "Remove Admin" : "Make Admin"}
                </button>
                <button className="duo-btn duo-btn-red" onClick={() => void removeUser(user.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {message && <p style={{ color: "var(--text-secondary)" }}>{message}</p>}
    </div>
  );
}
