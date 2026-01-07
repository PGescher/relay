import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

async function shareInviteLink(inviteLink) {
  // iOS: navigator.share works best, clipboard can be flaky
  try {
    if (navigator.share) {
      await navigator.share({ title: "Relay Invite", url: inviteLink });
      return "Invite shared ✅";
    }
  } catch {""}

  try {
    await navigator.clipboard.writeText(inviteLink);
    return "Invite link copied ✅";
  } catch {""}

  window.prompt("Copy this invite link:", inviteLink);
  return "Copy the link from the prompt.";
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(Number(localStorage.getItem("groupId") || "0") || 0);
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState("");

  // rename UI state
  const [rename, setRename] = useState("");

  const selected = useMemo(() => groups.find(g => g.id === selectedId) || null, [groups, selectedId]);

  async function loadGroups({ keepSelection = true } = {}) {
    setMsg("");
    const r = await api.meGroups();
    const list = r.groups || [];
    setGroups(list);

    if (!keepSelection) return;

    // keep current selection if possible, otherwise choose first group
    const current = Number(localStorage.getItem("groupId") || "0");
    const preferredId = selectedId || current;
    const g = list.find(x => x.id === preferredId) || list.find(x => x.id === current) || list[0];

    if (g) {
      await selectGroup(g);
    } else {
      setSelectedId(0);
      setMembers([]);
      localStorage.removeItem("groupId");
      localStorage.removeItem("inviteCode");
    }
  }

  async function selectGroup(g) {
    setSelectedId(g.id);
    localStorage.setItem("groupId", String(g.id));
    localStorage.setItem("inviteCode", g.invite_code);
    setRename(g.name || "");
    await loadMembers(g.id);
  }

  async function loadMembers(groupId) {
    try {
      const r = await api.groupMembers(groupId);
      setMembers(r.members || []);
    } catch (e) {
      setMembers([]);
      setMsg(e.message);
    }
  }

  async function toggleMutedFeed() {
    if (!selected) return;
    setMsg("");
    try {
      const r = await api.setGroupPrefs(selected.id, {
        muted_feed: !selected.muted_feed,
        muted_push: selected.muted_push
      });
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, muted_feed: r.muted_feed } : g));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function toggleMutedPush() {
    if (!selected) return;
    setMsg("");
    try {
      const r = await api.setGroupPrefs(selected.id, {
        muted_feed: selected.muted_feed,
        muted_push: !selected.muted_push
      });
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, muted_push: r.muted_push } : g));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function leaveSelected() {
    if (!selected) return;
    setMsg("");
    try {
      await api.leaveGroup(selected.id);

      // if leaving active group, clear
      const current = Number(localStorage.getItem("groupId") || "0");
      if (current === selected.id) {
        localStorage.removeItem("groupId");
        localStorage.removeItem("inviteCode");
      }

      setSelectedId(0);
      setMembers([]);
      await loadGroups({ keepSelection: false });
      setMsg("Left group ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function kick(userId) {
    if (!selected) return;
    setMsg("");
    try {
      await api.kickMember(selected.id, userId);
      await loadMembers(selected.id);
      setMsg("Member removed ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function renameGroup() {
    if (!selected) return;
    setMsg("");
    try {
      const name = (rename || "").trim();
      if (!name) throw new Error("Group name cannot be empty");
      const r = await api.renameGroup(selected.id, name);
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, name: r.group.name } : g));
      setMsg("Renamed ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteGroup() {
    if (!selected) return;
    setMsg("");
    const ok = window.confirm(`Delete group "${selected.name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await api.deleteGroup(selected.id);

      // If deleted group was active, clear selection
      const current = Number(localStorage.getItem("groupId") || "0");
      if (current === selected.id) {
        localStorage.removeItem("groupId");
        localStorage.removeItem("inviteCode");
      }

      setSelectedId(0);
      setMembers([]);
      await loadGroups({ keepSelection: false });
      setMsg("Group deleted ✅");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function inviteLink() {
    if (!selected) return;
    const link = `${window.location.origin}/join/${selected.invite_code}`;
    const status = await shareInviteLink(link);
    setMsg(status);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadGroups();
      } catch (e) {
        if (alive) setMsg(e.message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h2>Group Overview</h2>
      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: group list */}
        <div style={{ flex: "1 1 320px" }}>
          <h3>Your Groups</h3>

          {groups.length === 0 && <p style={{ opacity: 0.8 }}>You are not in any groups.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => selectGroup(g)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  background: selected?.id === g.id ? "#f3f4f6" : "white"
                }}
              >
                <div style={{ fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{g.name}</span>
                  <span style={{ opacity: 0.7, fontWeight: 600 }}>{g.is_owner ? "Owner" : "Member"}</span>
                </div>
                <div style={{ opacity: 0.75, fontSize: 14 }}>
                  invite: {g.invite_code} · feed: {g.muted_feed ? "muted" : "on"} · push: {g.muted_push ? "muted" : "on"}
                </div>
              </button>
            ))}
          </div>

          <button onClick={() => loadGroups()} style={{ marginTop: 12, padding: 10 }}>
            Refresh
          </button>
        </div>

        {/* RIGHT: selected group actions + members */}
        <div style={{ flex: "1 1 380px" }}>
          <h3>Selected Group</h3>
          {!selected && <p style={{ opacity: 0.8 }}>Select a group to manage it.</p>}

          {selected && (
            <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.name}</div>
              <div style={{ opacity: 0.75, marginTop: 4 }}>
                ID: {selected.id} · Invite: <b>{selected.invite_code}</b>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={inviteLink} style={{ padding: 10 }}>
                  Invite Link
                </button>

                <button onClick={toggleMutedFeed} style={{ padding: 10 }}>
                  {selected.muted_feed ? "Unmute Feed" : "Mute Feed"}
                </button>

                <button onClick={toggleMutedPush} style={{ padding: 10 }}>
                  {selected.muted_push ? "Unmute Notifications" : "Mute Notifications"}
                </button>

                {!selected.is_owner && (
                  <button onClick={leaveSelected} style={{ padding: 10 }}>
                    Leave Group
                  </button>
                )}
              </div>

              {/* Owner actions */}
              {selected.is_owner && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  <h4 style={{ margin: 0 }}>Owner Actions</h4>

                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <input
                      value={rename}
                      onChange={(e) => setRename(e.target.value)}
                      style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                      placeholder="New group name"
                    />
                    <button onClick={renameGroup} style={{ padding: 10 }}>
                      Rename
                    </button>
                  </div>

                  <button onClick={deleteGroup} style={{ marginTop: 10, padding: 10 }}>
                    Delete Group
                  </button>
                </div>
              )}

              <h4 style={{ marginTop: 16 }}>Members</h4>
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  maxHeight: 320,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch"
                }}
              >
                {members.map(m => (
                  <div
                    key={m.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #f0f0f0",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <b>{m.username}</b> <span style={{ opacity: 0.7 }}>({m.role})</span>
                    </div>

                    {selected.is_owner && m.role !== "owner" && (
                      <button onClick={() => kick(m.id)} style={{ padding: "6px 10px" }}>
                        Kick
                      </button>
                    )}
                  </div>
                ))}

                {members.length === 0 && <div style={{ opacity: 0.7 }}>No members loaded.</div>}
              </div>

              {selected.is_owner && (
                <p style={{ marginTop: 10, opacity: 0.75 }}>
                  Note:
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
