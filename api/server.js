import Fastify from "fastify";
import cors from "@fastify/cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import webpush from "web-push";

const { Pool } = pg;

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;

// -------------------- Helpers --------------------
function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

async function authGuard(req, reply) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return reply.code(401).send({ error: "invalid token" });
  }
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function isMember(userId, groupId) {
  const r = await pool.query(
    "select 1 from group_members where group_id=$1 and user_id=$2",
    [groupId, userId]
  );
  return !!r.rows[0];
}

async function isOwner(userId, groupId) {
  const r = await pool.query(
    "select 1 from group_members where group_id=$1 and user_id=$2 and role='owner'",
    [groupId, userId]
  );
  return !!r.rows[0];
}


// -------------------- DB schema init (MVP) --------------------
await pool.query(`
create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id bigserial primary key,
  name text not null,
  invite_code text unique not null,
  created_by bigint references users(id),
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id bigint references groups(id) on delete cascade,
  user_id bigint references users(id) on delete cascade,
  role text not null default 'member',
  primary key (group_id, user_id)
);

create table if not exists push_subscriptions (
  user_id bigint references users(id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  group_id bigint references groups(id) on delete cascade,
  user_id bigint references users(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists group_prefs (
  group_id bigint references groups(id) on delete cascade,
  user_id bigint references users(id) on delete cascade,
  muted_feed boolean not null default false,
  muted_push boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);


`);

// -------------------- Routes --------------------
app.get("/health", async () => ({ ok: true }));

app.get("/feed", { preHandler: authGuard }, async (req) => {
  const userId = Number(req.user.sub);

  const r = await pool.query(
    `select e.id, e.type, e.message, e.created_at,
            u.username,
            g.id as group_id, g.name as group_name
     from events e
     join users u on u.id=e.user_id
     join groups g on g.id=e.group_id
     join group_members gm on gm.group_id=e.group_id and gm.user_id=$1
     left join group_prefs gp on gp.group_id=e.group_id and gp.user_id=$1
     where coalesce(gp.muted_feed,false)=false
     order by e.created_at desc
     limit 200`,
    [userId]
  );

  return { events: r.rows };
});

app.get("/me/groups", { preHandler: authGuard }, async (req) => {
  const userId = Number(req.user.sub);

  const r = await pool.query(
    `select g.id, g.name, g.invite_code,
            (gm.role='owner') as is_owner,
            gm.role,
            coalesce(gp.muted_feed,false) as muted_feed,
            coalesce(gp.muted_push,false) as muted_push,
            g.created_at
     from group_members gm
     join groups g on g.id = gm.group_id
     left join group_prefs gp on gp.group_id=g.id and gp.user_id=$1
     where gm.user_id=$1
     order by g.created_at desc`,
    [userId]
  );

  return { groups: r.rows };
});


app.get("/groups/:groupId/members", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);

  if (!(await isMember(userId, groupId))) {
    return reply.code(403).send({ error: "not a member of this group" });
  }

  const r = await pool.query(
    `select u.id, u.username, gm.role
     from group_members gm
     join users u on u.id=gm.user_id
     where gm.group_id=$1
     order by (gm.role='owner') desc, u.username asc`,
    [groupId]
  );

  return { members: r.rows };
});

app.post("/groups/:groupId/prefs", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);
  const { muted_feed, muted_push } = req.body || {};

  if (!(await isMember(userId, groupId))) {
    return reply.code(403).send({ error: "not a member of this group" });
  }

  await pool.query(
    `insert into group_prefs(group_id, user_id, muted_feed, muted_push)
     values ($1,$2,$3,$4)
     on conflict (group_id, user_id)
     do update set muted_feed=$3, muted_push=$4, updated_at=now()`,
    [groupId, userId, !!muted_feed, !!muted_push]
  );

  return { ok: true, muted_feed: !!muted_feed, muted_push: !!muted_push };
});


app.post("/groups/:groupId/leave", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);

  if (!(await isMember(userId, groupId))) {
    return reply.code(403).send({ error: "not a member of this group" });
  }

  // owner cannot leave yet (MVP)
  if (await isOwner(userId, groupId)) {
    return reply.code(400).send({ error: "owner cannot leave yet (delete or transfer ownership not implemented)" });
  }

  await pool.query("delete from group_members where group_id=$1 and user_id=$2", [groupId, userId]);
  await pool.query("delete from group_prefs where group_id=$1 and user_id=$2", [groupId, userId]);

  return { ok: true };
});


app.post("/push/unsubscribe", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const { endpoint } = req.body || {};
  if (!endpoint) return reply.code(400).send({ error: "missing endpoint" });

  await pool.query(`delete from push_subscriptions where user_id=$1 and endpoint=$2`, [userId, endpoint]);
  return { ok: true };
});

app.post("/groups/:groupId/kick", { preHandler: authGuard }, async (req, reply) => {
  const ownerId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);
  const { user_id } = req.body || {};
  const targetId = Number(user_id);

  if (!targetId) return reply.code(400).send({ error: "missing user_id" });
  if (!(await isOwner(ownerId, groupId))) return reply.code(403).send({ error: "owner only" });
  if (targetId === ownerId) return reply.code(400).send({ error: "cannot kick yourself" });

  // do not allow kicking another owner (MVP: single-owner groups)
  const targetRole = await pool.query(
    "select role from group_members where group_id=$1 and user_id=$2",
    [groupId, targetId]
  );
  if (!targetRole.rows[0]) return reply.code(404).send({ error: "user not in group" });
  if (targetRole.rows[0].role === "owner") return reply.code(400).send({ error: "cannot kick owner" });

  await pool.query("delete from group_members where group_id=$1 and user_id=$2", [groupId, targetId]);
  await pool.query("delete from group_prefs where group_id=$1 and user_id=$2", [groupId, targetId]);

  return { ok: true };
});

app.post("/groups/:groupId/rename", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);
  const { name } = req.body || {};

  if (!name || String(name).trim().length < 1) return reply.code(400).send({ error: "missing name" });
  if (!(await isOwner(userId, groupId))) return reply.code(403).send({ error: "owner only" });

  const r = await pool.query("update groups set name=$1 where id=$2 returning id, name", [String(name).trim(), groupId]);
  if (!r.rows[0]) return reply.code(404).send({ error: "group not found" });
  return { ok: true, group: r.rows[0] };
});

app.post("/groups/:groupId/delete", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);

  if (!(await isOwner(userId, groupId))) return reply.code(403).send({ error: "owner only" });

  await pool.query("delete from groups where id=$1", [groupId]); // cascades members/events/prefs
  return { ok: true };
});


// Signup: username + password -> JWT
app.post("/signup", async (req, reply) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 6) {
    return reply.code(400).send({ error: "username + password (min 6) required" });
  }
  const password_hash = await bcrypt.hash(password, 10);

  try {
    const r = await pool.query(
      "insert into users(username, password_hash) values ($1,$2) returning id, username",
      [username, password_hash]
    );
    return { token: signToken(r.rows[0]) };
  } catch (e) {
    // likely duplicate username
    return reply.code(409).send({ error: "username already taken" });
  }
});

// Login -> JWT
app.post("/login", async (req, reply) => {
  const { username, password } = req.body || {};
  const r = await pool.query(
    "select id, username, password_hash from users where username=$1",
    [username]
  );
  const user = r.rows[0];
  if (!user) return reply.code(401).send({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return reply.code(401).send({ error: "invalid credentials" });

  return { token: signToken(user) };
});

// Create group -> returns invite code
app.post("/groups", { preHandler: authGuard }, async (req) => {
  const userId = Number(req.user.sub);
  const { name } = req.body || {};
  const invite = makeInviteCode();

  const g = await pool.query(
    "insert into groups(name, invite_code, created_by) values ($1,$2,$3) returning id, name, invite_code",
    [name || "Group", invite, userId]
  );

  await pool.query(
    "insert into group_members(group_id, user_id, role) values ($1,$2,'owner')",
    [g.rows[0].id, userId]
  );

  return g.rows[0];
});

// Join group by invite code
app.post("/groups/join", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const { invite_code } = req.body || {};

  const g = await pool.query("select id from groups where invite_code=$1", [invite_code]);
  if (!g.rows[0]) return reply.code(404).send({ error: "group not found" });

  await pool.query(
    "insert into group_members(group_id, user_id) values ($1,$2) on conflict do nothing",
    [g.rows[0].id, userId]
  );

  return { ok: true, group_id: g.rows[0].id };
});

// Store push subscription for this user
app.post("/push/subscribe", { preHandler: authGuard }, async (req) => {
  const userId = Number(req.user.sub);
  const sub = req.body; // { endpoint, keys: { p256dh, auth } }

  await pool.query(
    `insert into push_subscriptions(user_id, endpoint, p256dh, auth)
     values ($1,$2,$3,$4)
     on conflict (endpoint)
     do update set user_id=$1, p256dh=$3, auth=$4, updated_at=now()`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );

  return { ok: true };
});

// Start workout -> notify group members via web push
app.post("/groups/:groupId/start", { preHandler: authGuard }, async (req, reply) => {
  const userId = Number(req.user.sub);
  const groupId = Number(req.params.groupId);

  if (!(await isMember(userId, groupId))) {
    return reply.code(403).send({ error: "not a member of this group" });
  }

  // Configure push (needs VAPID keys set in env to actually send)
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return reply.code(500).send({ error: "push not configured (missing VAPID keys)" });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Find all members + their subscriptions
  const members = await pool.query(
    `select u.id, u.username, ps.endpoint, ps.p256dh, ps.auth,
            coalesce(gp.muted_push,false) as muted_push
    from group_members gm
    join users u on u.id=gm.user_id
    left join push_subscriptions ps on ps.user_id=u.id
    left join group_prefs gp on gp.group_id=gm.group_id and gp.user_id=gm.user_id
    where gm.group_id=$1`,
    [groupId]
  );

  const targets = members.rows.filter(m => m.endpoint && !m.muted_push);

  const payload = JSON.stringify({
    title: "Workout started",
    body: `${req.user.username} started a workout 💪`,
    url: "/"
  });

  await pool.query(
    "insert into events(group_id, user_id, type, message) values ($1,$2,$3,$4)",
    [groupId, userId, "workout_start", `${req.user.username} started a workout 💪`]
  );

  await Promise.all(
    members.rows
      .filter((m) => m.endpoint)
      .map((m) =>
        webpush
          .sendNotification(
            { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
            payload
          )
          .catch(() => null)
      )
  );

  return { ok: true, notified: targets.length };
});

app.listen({ port: 3000, host: "0.0.0.0" });