const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function setToken(token) {
  localStorage.setItem("token", token);
}
export function getToken() {
  return localStorage.getItem("token");
}
export function clearToken() {
  localStorage.removeItem("token");
}

async function req(path, method, body) {
  const token = getToken();

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  // Only set JSON header if we actually send a JSON body
  const hasBody = body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}



export const api = {
  signup: (username, password) => req("/signup", "POST", { username, password }),
  login: (username, password) => req("/login", "POST", { username, password }),
  createGroup: (name) => req("/groups", "POST", { name }),
  joinGroup: (invite_code) => req("/groups/join", "POST", { invite_code }),
  subscribePush: (sub) => req("/push/subscribe", "POST", sub),
  unsubscribePush: (endpoint) => req(`/push/unsubscribe`, "POST", { endpoint }),
  startWorkout: (groupId) => req(`/groups/${groupId}/start`, "POST", {}),
  feed: () => req(`/feed`, "GET"),
  meGroups: () => req(`/me/groups`, "GET"),
  groupMembers: (groupId) => req(`/groups/${groupId}/members`, "GET"),
  setGroupPrefs: (groupId, prefs) => req(`/groups/${groupId}/prefs`, "POST", prefs),
  leaveGroup: (groupId) => req(`/groups/${groupId}/leave`, "POST", {}),
  kickMember: (groupId, userId) => req(`/groups/${groupId}/kick`, "POST", { user_id: userId }),
  renameGroup: (groupId, name) => req(`/groups/${groupId}/rename`, "POST", { name }),
  deleteGroup: (groupId) => req(`/groups/${groupId}/delete`, "POST", {}),
};

