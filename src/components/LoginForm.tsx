"use client";

import { useState } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { cn } from "@/lib/utils";

export default function LoginForm() {
  const { login, register } = useAppContext();
  const accent = useAccentColor();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-stone-100">Battle Plan</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-stone-400 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                "w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1",
                accent.ring
              )}
              placeholder="Enter username"
              autoComplete="username"
              required
              minLength={3}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-400 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1",
                accent.ring
              )}
              placeholder="Enter password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={4}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 text-white font-medium rounded-md transition-colors disabled:opacity-50"
            style={{ backgroundColor: accent.swatch }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.filter = "brightness(1.1)")}
            onMouseLeave={(e) => e.currentTarget.style.filter = ""}
          >
            {isLoading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-sm text-stone-400 hover:text-stone-300 transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
