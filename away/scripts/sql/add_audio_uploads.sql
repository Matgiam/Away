-- ============================================================================
-- add_audio_uploads.sql
-- ----------------------------------------------------------------------------
-- Adds support for storing the original audio file alongside a transcribed
-- MIDI upload so the practice player can play the audio synced with the MIDI.
--
-- Run this once in the Supabase SQL editor on the project's database.
--
-- Changes:
--   1. New `audio_uploads` private storage bucket (owner-only read/write).
--   2. Two new nullable columns on `user_song_uploads`:
--        audio_storage_path  TEXT  — path within the bucket
--        audio_file_name     TEXT  — display filename for downloads
--      Rows without an audio file (e.g. direct MIDI uploads) keep these NULL.
-- ============================================================================

-- 1. Private storage bucket. The owner-only policies below restrict access.
insert into storage.buckets (id, name, public)
values ('audio_uploads', 'audio_uploads', false)
on conflict (id) do nothing;

-- 2. Owner-only RLS on the bucket. Path is `${user_id}/${uuid}.${ext}` so
--    the first segment of the path identifies the owner.
create policy "audio_uploads: owner can read"
on storage.objects for select
to authenticated
using (
    bucket_id = 'audio_uploads'
    and split_part(name, '/', 1) = auth.uid()::text
);

create policy "audio_uploads: owner can insert"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'audio_uploads'
    and split_part(name, '/', 1) = auth.uid()::text
);

create policy "audio_uploads: owner can delete"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'audio_uploads'
    and split_part(name, '/', 1) = auth.uid()::text
);

-- 3. New columns on the existing uploads row.
alter table user_song_uploads
    add column if not exists audio_storage_path text,
    add column if not exists audio_file_name    text;
