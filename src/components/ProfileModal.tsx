"use client";

import { useState } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { usersApi } from "@/lib/api";
import Select from "@/components/ui/Select";

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const user = state.user;

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [org, setOrg] = useState<"Day" | "Foundation" | "">(user?.org || "");
  const [division, setDivision] = useState(user?.division?.toString() || "");
  const [department, setDepartment] = useState(user?.department?.toString() || "");
  const [postTitle, setPostTitle] = useState(user?.postTitle || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const { user: updatedUser } = await usersApi.updateProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        org: org || undefined,
        division: division ? parseInt(division, 10) : undefined,
        department: department ? parseInt(department, 10) : undefined,
        postTitle: postTitle.trim() || undefined,
      });

      dispatch({ type: "UPDATE_USER_PROFILE", payload: updatedUser });
      onClose();
    } catch (err) {
      setError("Failed to save profile");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            My Profile
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

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
              Username
            </label>
            <input
              type="text"
              value={user?.username || ""}
              disabled
              className="w-full px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded border border-stone-200 dark:border-stone-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
              Role
            </label>
            <input
              type="text"
              value={user?.role === "admin" ? "Admin" : "User"}
              disabled
              className="w-full px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded border border-stone-200 dark:border-stone-700 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
              Organization
            </label>
            <Select
              value={org}
              onChange={(val) => setOrg(val as "Day" | "Foundation" | "")}
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
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                Department
              </label>
              <input
                type="number"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
              Post Title
            </label>
            <input
              type="text"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current"
            />
          </div>
        </div>

        <div className="p-5 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: accent.swatch }}
            onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
            onMouseLeave={(e) => e.currentTarget.style.filter = ""}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
