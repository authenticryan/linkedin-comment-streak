-- Relink waitlist for tryrelink.live. Run with `npm run migrate`. Safe to run again.
-- Lives in the same Neon database as the Comment Streak sync server (server/),
-- in its own table.

CREATE TABLE IF NOT EXISTS waitlist (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  -- Which form on the page: hero or closing.
  source text,
  -- Attribution: the UTM tags on the landing URL, and the referring site (host only).
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set when the invite goes out.
  invited_at timestamptz
);
