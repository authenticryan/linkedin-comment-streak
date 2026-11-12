-- Comment Streak sync: run with `npm run migrate`. Safe to run again.

CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  -- Product-update emails. Off unless the user ticked the box.
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  -- Daily goal; the newest change from any computer wins.
  goal integer,
  goal_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

-- One live sign-in code per email, stored as an HMAC (never the code itself).
CREATE TABLE IF NOT EXISTS login_codes (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- Rate limit: codes sent in the hour that started at window_start.
  sends integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Sign-in sessions. The extension holds the token; we keep only its SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id);

-- Comments per day, per computer. Each computer writes only its own rows,
-- so two computers never overwrite each other. A day's total is the sum.
CREATE TABLE IF NOT EXISTS day_counts (
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id, day)
);
