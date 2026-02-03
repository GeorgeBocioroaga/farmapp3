import React, { useState } from "react";
import api from "../api";
import { setSession } from "../auth";

type LoginProps = {
  onLogin: (user: any) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = new URLSearchParams({ username, password });
      const res = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      setSession(res.data.access_token, res.data.user);
      onLogin(res.data.user);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div className="panel login">
      <h2>Login</h2>
      <p className="small">Cont implicit: admin / admin</p>
      {error && <div className="notice" style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="button" type="submit">Login</button>
      </form>
    </div>
  );
}
