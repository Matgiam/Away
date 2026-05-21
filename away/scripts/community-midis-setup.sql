-- =============================================================================
-- Community MIDI Library — Supabase setup
-- =============================================================================
-- Run this script ONCE in your Supabase SQL editor.
-- After running, set yourself as admin with:
--   UPDATE profiles SET is_admin = TRUE WHERE id = '<your-user-id>';
-- (You can find your user id in profiles or in Authentication → Users.)
-- =============================================================================

-- 1) Admin flag on profiles -----------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 1b) Link a private upload to its community submission (so we can show "Pending"
--     / "Published" badges in the user's own uploads view).  Nullable: most
--     private uploads will never be published.
ALTER TABLE user_song_uploads
  ADD COLUMN IF NOT EXISTS community_submission_id UUID;

-- 2) community_midis: every submission (pending / approved / rejected) lives here
CREATE TABLE IF NOT EXISTS community_midis (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  artist           TEXT NOT NULL DEFAULT '',
  difficulty       TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  storage_path     TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  bpm              INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,
  review_note      TEXT,
  play_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_midis_status_created_idx
  ON community_midis (status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_midis_submitter_idx
  ON community_midis (submitter_id);

-- 3) community_midi_additions: which community songs each user added to "Custom"
CREATE TABLE IF NOT EXISTS community_midi_additions (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_midi_id UUID NOT NULL REFERENCES community_midis(id) ON DELETE CASCADE,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, community_midi_id)
);

CREATE INDEX IF NOT EXISTS community_midi_additions_user_idx
  ON community_midi_additions (user_id, added_at DESC);

-- 3b) FK from user_song_uploads → community_midis (added separately so the table
--     above exists before we reference it).
ALTER TABLE user_song_uploads
  DROP CONSTRAINT IF EXISTS user_song_uploads_community_submission_fk;
ALTER TABLE user_song_uploads
  ADD CONSTRAINT user_song_uploads_community_submission_fk
  FOREIGN KEY (community_submission_id) REFERENCES community_midis(id) ON DELETE SET NULL;

-- 4) Storage bucket — public so approved files can be fetched without signed URLs.
--    Paths use random UUIDs so enumeration is not a concern; the table RLS still
--    controls who can *learn* the path of a pending file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('community_midis', 'community_midis', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- =============================================================================
-- Row-Level Security
-- =============================================================================

ALTER TABLE community_midis           ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_midi_additions  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "community_midis_select"  ON community_midis;
DROP POLICY IF EXISTS "community_midis_insert"  ON community_midis;
DROP POLICY IF EXISTS "community_midis_update"  ON community_midis;
DROP POLICY IF EXISTS "community_midis_delete"  ON community_midis;
DROP POLICY IF EXISTS "community_additions_select" ON community_midi_additions;
DROP POLICY IF EXISTS "community_additions_insert" ON community_midi_additions;
DROP POLICY IF EXISTS "community_additions_delete" ON community_midi_additions;

-- Read: everyone authenticated sees approved rows; submitter sees their own;
-- admin sees everything.
CREATE POLICY "community_midis_select"
  ON community_midis FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    OR submitter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Insert: any authenticated user can submit, as themselves, in 'pending' state.
CREATE POLICY "community_midis_insert"
  ON community_midis FOR INSERT
  TO authenticated
  WITH CHECK (
    submitter_id = auth.uid()
    AND status = 'pending'
  );

-- Update: only admin can change status / play_count / review fields.
CREATE POLICY "community_midis_update"
  ON community_midis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Delete: submitter can withdraw their own pending submission; admin can delete any.
CREATE POLICY "community_midis_delete"
  ON community_midis FOR DELETE
  TO authenticated
  USING (
    (submitter_id = auth.uid() AND status = 'pending')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Additions: each user only sees and manages their own rows.
CREATE POLICY "community_additions_select"
  ON community_midi_additions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "community_additions_insert"
  ON community_midi_additions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_additions_delete"
  ON community_midi_additions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- Storage policies (bucket = community_midis)
-- =============================================================================
-- Paths are: <submitter_id>/<random-uuid>.mid

DROP POLICY IF EXISTS "community_midis_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "community_midis_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "community_midis_storage_delete" ON storage.objects;

-- Anyone authenticated can read the file if the corresponding row is approved,
-- if they're the submitter, or if they're an admin.
CREATE POLICY "community_midis_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'community_midis'
    AND (
      EXISTS (
        SELECT 1 FROM community_midis cm
        WHERE cm.storage_path = name
          AND (cm.status = 'approved' OR cm.submitter_id = auth.uid())
      )
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    )
  );

-- Users can upload only into their own folder (<auth.uid>/...).
CREATE POLICY "community_midis_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'community_midis'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Submitter can delete their own file; admin can delete any.
CREATE POLICY "community_midis_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'community_midis'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    )
  );

-- =============================================================================
-- Helper: a Postgres function the app calls to atomically bump play_count.
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_community_midi_play_count(midi_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE community_midis
  SET play_count = play_count + 1
  WHERE id = midi_id AND status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION increment_community_midi_play_count(UUID) TO authenticated;

-- =============================================================================
-- Done.  After running:
--   1) Find your user id (Authentication → Users)
--   2) Run:   UPDATE profiles SET is_admin = TRUE WHERE id = '<your-uuid>';
--   3) Reload the app.  An "Admin" link will appear on the home screen.
-- =============================================================================
