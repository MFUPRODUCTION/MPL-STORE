import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple mock authentication for prototype
    if (username === "admin" && password === "admin123") {
      localStorage.setItem("adminToken", "admin-secret-token");
      navigate("/admin/dashboard");
    } else {
      setError("Username atau password salah");
    }
  };

  return (
    <div className="min-h-screen bg-mpl-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-mpl-accent p-3 rounded-md">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-mpl-text uppercase tracking-wide">
          Admin Login
        </h2>
        <p className="mt-2 text-center text-xs text-mpl-text-dim">
          Gunakan <span className="text-mpl-text font-mono">admin</span> / <span className="text-mpl-text font-mono">admin123</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-mpl-surface py-8 px-4 sm:rounded-lg sm:px-10 border border-mpl-border">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-[#ff0033]/10 border border-[#ff0033]/50 text-[#ff0033] text-xs p-3 rounded text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-[0.65rem] font-medium text-mpl-text-dim uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-mpl-border bg-[#000] rounded text-mpl-text text-sm focus:outline-none focus:border-mpl-accent placeholder-mpl-text-dim"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[0.65rem] font-medium text-mpl-text-dim uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-mpl-border bg-[#000] rounded text-mpl-text text-sm focus:outline-none focus:border-mpl-accent placeholder-mpl-text-dim"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 rounded text-[0.85rem] font-semibold text-white bg-mpl-accent hover:bg-[#cc0029] focus:outline-none transition-colors"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
