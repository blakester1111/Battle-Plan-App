"use client";

import { useState, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { usersApi, relationshipsApi } from "@/lib/api";
import type { User, UserRelationship } from "@/lib/types";
import { cn } from "@/lib/utils";
import Select from "@/components/ui/Select";

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const { state, refreshJuniors } = useAppContext();
  const accent = useAccentColor();
  const [users, setUsers] = useState<User[]>([]);
  const [relationships, setRelationships] = useState<UserRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"users" | "relationships" | "create">("users");

  // For creating new relationship
  const [seniorId, setSeniorId] = useState("");
  const [juniorId, setJuniorId] = useState("");
  const [creatingRel, setCreatingRel] = useState(false);

  // For creating new user
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newOrg, setNewOrg] = useState<"" | "Day" | "Foundation">("");
  const [newDivision, setNewDivision] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creatingUser, setCreatingUser] = useState(false);

  // For password reset and username change
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [submittingUserEdit, setSubmittingUserEdit] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersData, relationshipsData] = await Promise.all([
        usersApi.getAll(),
        relationshipsApi.getAll(),
      ]);
      setUsers(usersData.users || []);
      setRelationships(relationshipsData.relationships || []);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      return;
    }

    try {
      await usersApi.delete(userId);
      setUsers(users.filter((u) => u.id !== userId));
      setRelationships(relationships.filter((r) => r.seniorId !== userId && r.juniorId !== userId));
      setSuccess("User deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to delete user");
      console.error(err);
    }
  }

  async function handleCreateRelationship() {
    if (!seniorId || !juniorId) {
      setError("Please select both senior and junior");
      return;
    }

    if (seniorId === juniorId) {
      setError("User cannot be their own senior");
      return;
    }

    setCreatingRel(true);
    setError("");

    try {
      await relationshipsApi.create(seniorId, juniorId);
      await loadData();
      await refreshJuniors(); // Update sidebar
      setSeniorId("");
      setJuniorId("");
      setSuccess("Relationship created successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to create relationship. It may already exist.");
      console.error(err);
    } finally {
      setCreatingRel(false);
    }
  }

  async function handleDeleteRelationship(relationshipId: number) {
    try {
      await relationshipsApi.delete(relationshipId);
      setRelationships(relationships.filter((r) => r.id !== relationshipId));
      await refreshJuniors(); // Update sidebar
    } catch (err) {
      setError("Failed to delete relationship");
      console.error(err);
    }
  }

  async function handleCreateUser() {
    if (!newUsername || !newPassword) {
      setError("Username and password are required");
      return;
    }

    setCreatingUser(true);
    setError("");

    try {
      const { user } = await usersApi.create({
        username: newUsername,
        password: newPassword,
        firstName: newFirstName || undefined,
        lastName: newLastName || undefined,
        org: newOrg || undefined,
        division: newDivision ? parseInt(newDivision, 10) : undefined,
        department: newDepartment ? parseInt(newDepartment, 10) : undefined,
        postTitle: newPostTitle || undefined,
        role: newRole,
      });

      setUsers([...users, user]);
      // Reset form
      setNewUsername("");
      setNewPassword("");
      setNewFirstName("");
      setNewLastName("");
      setNewOrg("");
      setNewDivision("");
      setNewDepartment("");
      setNewPostTitle("");
      setNewRole("user");
      setTab("users");
      setSuccess("User created successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
      console.error(err);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSaveUserEdit() {
    if (!editingUserId) return;

    if (!resetPassword && !newUserUsername) {
      setError("Please enter a new password or username");
      return;
    }

    setSubmittingUserEdit(true);
    setError("");

    try {
      if (resetPassword) {
        await usersApi.resetPassword(editingUserId, resetPassword);
      }
      if (newUserUsername) {
        await usersApi.changeUsername(editingUserId, newUserUsername);
        // Update the local users list with the new username
        setUsers(users.map((u) =>
          u.id === editingUserId ? { ...u, username: newUserUsername } : u
        ));
      }
      setEditingUserId(null);
      setResetPassword("");
      setNewUserUsername("");
      setSuccess(resetPassword && newUserUsername
        ? "Password and username updated successfully"
        : resetPassword
          ? "Password reset successfully"
          : "Username changed successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
      console.error(err);
    } finally {
      setSubmittingUserEdit(false);
    }
  }

  function getUserDisplayName(user: User) {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.username;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            Admin Panel
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 shrink-0">
          <button
            onClick={() => setTab("users")}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-colors",
              tab === "users"
                ? `${accent.text} border-b-2`
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            )}
            style={tab === "users" ? { borderColor: accent.swatch } : undefined}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setTab("create")}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-colors",
              tab === "create"
                ? `${accent.text} border-b-2`
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            )}
            style={tab === "create" ? { borderColor: accent.swatch } : undefined}
          >
            + Create User
          </button>
          <button
            onClick={() => setTab("relationships")}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-colors",
              tab === "relationships"
                ? `${accent.text} border-b-2`
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            )}
            style={tab === "relationships" ? { borderColor: accent.swatch } : undefined}
          >
            Relationships ({relationships.length})
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm">
              {success}
            </div>
          )}

          {loading ? (
            <div className="text-center text-stone-500 dark:text-stone-400 py-8">
              Loading...
            </div>
          ) : tab === "users" ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800 dark:text-stone-200">
                        {getUserDisplayName(user)}
                      </span>
                      {user.role === "admin" && (
                        <span className={cn("px-2 py-0.5 text-xs font-medium rounded", accent.bgSubtle, accent.text)}>
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                      @{user.username}
                      {user.postTitle && ` · ${user.postTitle}`}
                      {user.org && ` · ${user.org}`}
                      {user.division && ` · Div ${user.division}`}
                      {user.department && ` · Dept ${user.department}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setNewUserUsername(user.username);
                      }}
                      className={cn("p-2 text-stone-500 rounded transition-colors", accent.textHover, accent.bgHover)}
                      title="Edit user"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {user.id !== state.user?.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete user"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "create" ? (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  placeholder="password"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Organization
                </label>
                <Select
                  value={newOrg}
                  onChange={(val) => setNewOrg(val as "" | "Day" | "Foundation")}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "Day", label: "Day" },
                    { value: "Foundation", label: "Foundation" },
                  ]}
                  placeholder="Select..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Division
                  </label>
                  <input
                    type="number"
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Department
                  </label>
                  <input
                    type="number"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Post Title
                </label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Role
                </label>
                <Select
                  value={newRole}
                  onChange={(val) => setNewRole(val as "user" | "admin")}
                  options={[
                    { value: "user", label: "User" },
                    { value: "admin", label: "Admin" },
                  ]}
                />
              </div>

              <button
                onClick={handleCreateUser}
                disabled={creatingUser || !newUsername || !newPassword}
                className="w-full px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50"
                style={{ backgroundColor: accent.swatch }}
                onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.filter = ""}
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Create relationship form */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg">
                <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
                  Assign Senior/Junior Relationship
                </h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                      Senior
                    </label>
                    <Select
                      value={seniorId}
                      onChange={setSeniorId}
                      options={[
                        { value: "", label: "Select senior..." },
                        ...users.map((user) => ({ value: user.id, label: `${getUserDisplayName(user)} (@${user.username})` })),
                      ]}
                      placeholder="Select senior..."
                    />
                  </div>
                  <div className="text-stone-400 dark:text-stone-500 pb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                      Junior
                    </label>
                    <Select
                      value={juniorId}
                      onChange={setJuniorId}
                      options={[
                        { value: "", label: "Select junior..." },
                        ...users.map((user) => ({ value: user.id, label: `${getUserDisplayName(user)} (@${user.username})` })),
                      ]}
                      placeholder="Select junior..."
                    />
                  </div>
                  <button
                    onClick={handleCreateRelationship}
                    disabled={creatingRel || !seniorId || !juniorId}
                    className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50"
                    style={{ backgroundColor: accent.swatch }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.filter = ""}
                  >
                    {creatingRel ? "..." : "Assign"}
                  </button>
                </div>
              </div>

              {/* Existing relationships */}
              <div>
                <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
                  Current Relationships
                </h3>
                {relationships.length === 0 ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400 text-center py-4">
                    No relationships assigned yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relationships.map((rel) => (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="font-medium text-stone-800 dark:text-stone-200">
                              {rel.seniorFirstName || rel.seniorLastName
                                ? `${rel.seniorFirstName || ""} ${rel.seniorLastName || ""}`.trim()
                                : rel.seniorUsername}
                            </span>
                            <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
                              (senior)
                            </span>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                          <div>
                            <span className="font-medium text-stone-800 dark:text-stone-200">
                              {rel.juniorFirstName || rel.juniorLastName
                                ? `${rel.juniorFirstName || ""} ${rel.juniorLastName || ""}`.trim()
                                : rel.juniorUsername}
                            </span>
                            <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
                              (junior)
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRelationship(rel.id)}
                          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Remove relationship"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-4">
              Edit User
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              Editing{" "}
              <strong>{users.find((u) => u.id === editingUserId)?.username}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  New Username
                </label>
                <input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                  placeholder="Leave blank to keep current"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setResetPassword("");
                  setNewUserUsername("");
                }}
                className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserEdit}
                disabled={submittingUserEdit || (!resetPassword && newUserUsername === users.find((u) => u.id === editingUserId)?.username)}
                className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50"
                style={{ backgroundColor: accent.swatch }}
                onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.filter = ""}
              >
                {submittingUserEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
