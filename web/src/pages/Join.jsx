import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getToken } from "../lib/api.js";

export default function Join() {
  const { code } = useParams();
  const nav = useNavigate();
  const [msg, setMsg] = useState("Joining...");

  useEffect(() => {
    (async () => {
      const invite = (code || "").trim().toUpperCase();
      if (!invite) {
        setMsg("Missing invite code.");
        return;
      }

      // Not logged in → store code and go login
      if (!getToken()) {
        localStorage.setItem("pendingInvite", invite);
        nav("/login", { replace: true });
        return;
      }

      try {
        const r = await api.joinGroup(invite);
        localStorage.setItem("groupId", String(r.group_id));
        setMsg("Joined ✅");
        nav("/settings", { replace: true });
      } catch (e) {
        setMsg(e.message);
      }
    })();
  }, [code]);

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h2>Join</h2>
      <p>{msg}</p>
    </div>
  );
}
