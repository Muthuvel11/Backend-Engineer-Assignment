-- Meeting Room Booking Service — Database Schema
-- Apply this to your Supabase project via the SQL editor.

-- ROOMS
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  capacity        INT NOT NULL CHECK (capacity >= 1),
  floor           INT NOT NULL,
  amenities       TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_name
  ON rooms (normalized_name);


-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed',
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CHECK (start_time < end_time),
  CHECK (status IN ('confirmed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_booking_overlap
  ON bookings (room_id, status, start_time, end_time);


-- IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  booking_id      UUID REFERENCES bookings(id),
  status          TEXT DEFAULT 'processing',
  request_hash    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency
  ON idempotency_keys (key, organizer_email);
