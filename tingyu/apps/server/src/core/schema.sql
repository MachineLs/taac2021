-- 听屿 database schema (SQLite via node:sqlite). Owned by the lead. JSON columns hold JSON text.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT,
  roles TEXT NOT NULL DEFAULT '["client"]',          -- JSON Role[]
  referred_by_creator_id TEXT,                         -- attribution at signup
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS counselors (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  title TEXT NOT NULL,
  headline TEXT NOT NULL,
  badges TEXT NOT NULL DEFAULT '[]',
  years INTEGER NOT NULL,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5,
  review_count INTEGER NOT NULL DEFAULT 0,
  rebook_rate INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  modes TEXT NOT NULL DEFAULT '["video","voice"]',
  price INTEGER NOT NULL,
  original_price INTEGER,
  city TEXT,
  gender TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  methods TEXT NOT NULL DEFAULT '[]',
  qualifications TEXT NOT NULL DEFAULT '[]',
  training TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',             -- pending | approved | rejected
  sort_weight INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  counselor_id TEXT NOT NULL REFERENCES counselors(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',                -- open | booked | blocked
  UNIQUE (counselor_id, start_at)
);
CREATE INDEX IF NOT EXISTS idx_slots_counselor_start ON slots(counselor_id, start_at);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  min_spend INTEGER NOT NULL DEFAULT 0,
  new_user_only INTEGER NOT NULL DEFAULT 0,
  valid_days INTEGER NOT NULL DEFAULT 7
);

CREATE TABLE IF NOT EXISTS user_coupons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  coupon_id TEXT NOT NULL REFERENCES coupons(id),
  status TEXT NOT NULL DEFAULT 'unused',              -- unused | used | expired
  expires_at TEXT NOT NULL,
  used_at TEXT,
  UNIQUE (user_id, coupon_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  counselor_id TEXT NOT NULL REFERENCES counselors(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,                               -- pending_payment | paid | in_session | completed | cancelled | refunded
  price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL,
  user_coupon_id TEXT REFERENCES user_coupons(id),
  intake_session_id TEXT,
  share_intake INTEGER NOT NULL DEFAULT 0,
  creator_id TEXT REFERENCES creators(id),
  reviewed INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  cancelled_at TEXT,
  pay_expires_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_appt_user ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appt_counselor ON appointments(counselor_id, start_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,                               -- succeeded | refunded
  transaction_no TEXT NOT NULL,
  created_at TEXT NOT NULL,
  refunded_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  appointment_id TEXT UNIQUE REFERENCES appointments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  counselor_id TEXT NOT NULL REFERENCES counselors(id),
  rating INTEGER NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  counselor_id TEXT NOT NULL REFERENCES counselors(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intake_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',              -- active | ended
  risk TEXT NOT NULL DEFAULT 'low',
  crisis INTEGER NOT NULL DEFAULT 0,
  summary TEXT,                                       -- JSON IntakeSummary
  state TEXT NOT NULL DEFAULT '{}',                   -- JSON: provider-private conversation state
  created_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS intake_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES intake_sessions(id),
  role TEXT NOT NULL,                                 -- assistant | user
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_intake_msg_session ON intake_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS assessment_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scale TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  max INTEGER NOT NULL,
  level TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mood_checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  mood INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  counselor_id TEXT NOT NULL REFERENCES counselors(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, counselor_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  ref_code TEXT NOT NULL UNIQUE,
  commission_rate REAL NOT NULL DEFAULT 0.1,
  recommended_counselor_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_visits (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',             -- pending | settled
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crisis_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  session_id TEXT,
  source TEXT NOT NULL,                               -- intake | message
  excerpt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  handled_by TEXT,
  created_at TEXT NOT NULL
);
