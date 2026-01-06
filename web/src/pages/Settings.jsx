import React, { useState } from "react";
import { api } from "../lib/api.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready;
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Missing VITE_VAPID_PUBLIC_KEY (set in docker compose)");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
  return sub.toJSON();
}

export default function Settings() {
  const [msg, setMsg] = useState("");

  const [groupName, setGroupName] = useState("Friends");
  const [invite, setInvite] = useState("");

  const groupId = localStorage.getItem("groupId");
  const inviteCode = localStorage.getItem("inviteCode");

  async function createGroup() {
    setMsg("");
    try {
      const g = await api.createGroup(groupName);
      localStorage.setItem("groupId", String(g.id));
      localStorage.setItem("inviteCode", g.invite_code);
      setMsg(`Created ✅ Invite code: ${g.invite_code}`);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function joinGroup() {
    setMsg("");
    try {
      const r = await api.joinGroup(invite.trim().toUpperCase());
      localStorage.setItem("groupId", String(r.group_id));
      setMsg("Joined ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function enablePush() {
    setMsg("");
    try {
      if (!("serviceWorker" in navigator)) throw new Error("No service worker support (iPhone needs HTTPS + Add to Home Screen)");
      if (!("PushManager" in window)) throw new Error("No push support in this browser");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notification permission not granted");

      const sub = await subscribeToPush();
      await api.subscribePush(sub);
      setMsg("Push enabled ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h2>Settings</h2>

      <div style={{ marginBottom: 12, opacity: 0.85 }}>
        Group ID: {groupId || "—"}<br />
        Invite Code: {inviteCode || "—"}<br />
      </div>

      <h3>Create Group</h3>
      <input
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        style={{ width: "100%", padding: 10 }} 
      />
      <button onClick={createGroup} style={{ width: "100%", padding: 12, marginTop: 10}}>
        Create
      </button>

      <h3 style={{ marginTop: 24 }}>Join Group</h3>
      <input
        placeholder="Invite Code"
        value={invite}
        onChange={(e) => setInvite(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />
      <button onClick={joinGroup} style={{ width: "100%", padding: 12, marginTop: 10 }}>
        Join
      </button>

      <h3 style={{ marginTop: 24 }}>Notifications</h3>
      <button onClick={enablePush} style={{ width: "100%", padding: 12 }}>
        Enable Notifications
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 24, opacity: 0.8 }}>
        iPhone: needs HTTPS + “Add to Home Screen” + open from icon.

        <p>
        Roadmap: <br />
        
        Add Group Members Overview Tab from Settings <br />
        
        </p>

      </p>
    </div>
  );
}
