import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useActionBar } from "../lib/actionBarContext.js";
import { useLocation } from "react-router-dom";

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function Home() {
  const [msg, setMsg] = useState("");
  const [events, setEvents] = useState([]);
  const groupId = localStorage.getItem("groupId");
  const { setHomeAction } = useActionBar();
  const location = useLocation();

  const [pushHint, setPushHint] = useState("");


  async function refreshFeed() {
    if (!groupId) return;
    try {
      const r = await api.feed(groupId);
      setEvents(r.events || []);
    } catch (e) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setPushHint("");
          return;
        }
        if (Notification.permission !== "granted") {
          setPushHint("Notifications are off. Enable them in Settings for group alerts.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushHint(sub ? "" : "Enable notifications in Settings to receive group alerts.");
      } catch {
        setPushHint("Enable notifications in Settings to receive group alerts.");
      }
    })();
  // this runs each time you navigate to Home (new location key)
  setMsg("");
  refreshFeed();

  // When Home is active, make the middle tab a Start button
  setHomeAction({
    label: "Start 💪",
    onClick: startFitness,
    disabled: !groupId
  });

  const t = setInterval(refreshFeed, 5000);
  return () => clearInterval(t);

  // Cleanup when leaving Home
  //return () => setHomeAction(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key, groupId]);




  async function startFitness() {
    setMsg("");
    try {
      if (!groupId) throw new Error("No group selected. Go to Settings and create/join a group.");
      const r = await api.startWorkout(groupId);
      setMsg(`Sent ✅ notified: ${r.notified}`);
      await refreshFeed(); // update immediately
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h2>Home</h2>

      {pushHint && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, marginBottom: 12 }}>
          {pushHint} <a href="/settings">Open Settings</a>
        </div>
      )}

      <div style={{ marginBottom: 12, opacity: 0.85 }}>
        Group ID: {groupId || "—"}
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <h3 style={{ marginTop: 24 }}>Feed</h3>
      {!groupId && <p style={{ opacity: 0.8 }}>Join or create a group in Settings to see the feed.</p>}
      
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          maxHeight: "55vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch"
        }}
      >
        {events.map(ev => (
          <div key={ev.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ fontWeight: 700 }}>
              {ev.username} <span style={{ opacity: 0.6 }}>· {ev.group_name} • {fmt(ev.created_at)}</span>
            </div>
            <div style={{ opacity: 0.85 }}>{ev.message}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>
              {new Date(ev.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
