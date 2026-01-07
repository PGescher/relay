import React, { useState } from "react";
import { api, setToken, getToken, clearToken } from "../lib/api.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [msg, setMsg] = useState("");
  const localusername = localStorage.getItem("username");
  const nav = useNavigate();

  const loggedIn = !!getToken();

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const r =
        mode === "login"
          ? await api.login(username.trim(), password)
          : await api.signup(username.trim(), password);
      setToken(r.token);
      setMsg("Logged in ✅");
      localStorage.setItem("username", String(username));
      const pending = localStorage.getItem("pendingInvite");
      if (pending) {
        localStorage.removeItem("pendingInvite");
        nav(`/join/${pending}`, { replace: true });
        return;
      }
      nav("/", { replace: true });

    } catch (err) {
      setMsg(err.message);
    }
  }

  function logout() {
    clearToken();
    localStorage.removeItem("username")
    localStorage.removeItem("groupId")
    localStorage.removeItem("inviteCode")
    setMsg("Logged out ✅");
  }

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h2>Login</h2>

      {loggedIn && (
        <div style={{ marginBottom: 16 }}>
          <p>You are logged in as {localusername}</p>
          <button onClick={logout} style={{ padding: 12 }}>
            Logout
          </button>
        </div>
      )}

      <form onSubmit={submit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setU(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />
        <input
          placeholder="Password (min 6)"
          type="password"
          value={password}
          onChange={(e) => setP(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />
        <button style={{ width: "100%", padding: 12 }}>
          {mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>

      <button onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ marginTop: 12 }}>
        Switch to {mode === "login" ? "Sign up" : "Login"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
