-- ============================================================================
-- add_song_categories.sql
-- ----------------------------------------------------------------------------
-- Lets users sub-categorize their Custom uploads and Community submissions
-- using the same top-level buckets as the built-in library (video_games,
-- anime, popular, classical, films, tv_shows).
--
-- Run this once in the Supabase SQL editor.
--
-- Schema:
--   user_song_uploads.category   TEXT NULL  — owner-set, editable any time.
--   community_midis.category     TEXT NULL  — copied from upload at publish.
--   Both nullable: NULL = "Uncategorized" (back-compat for existing rows).
--   A CHECK constraint pins the allowed values to the SongCategoryKey enum
--   used by the app — typo'd writes get rejected at the DB instead of
--   silently breaking the picker.
-- ============================================================================

-- 1. Custom uploads — owner sets it on save and can change it later.
alter table user_song_uploads
    add column if not exists category text;

alter table user_song_uploads
    drop constraint if exists user_song_uploads_category_check;

alter table user_song_uploads
    add constraint user_song_uploads_category_check
    check (
        category is null
        or category in ('video_games', 'anime', 'popular', 'classical', 'films', 'tv_shows')
    );

-- 2. Community submissions — populated at publish time from the source upload.
alter table community_midis
    add column if not exists category text;

alter table community_midis
    drop constraint if exists community_midis_category_check;

alter table community_midis
    add constraint community_midis_category_check
    check (
        category is null
        or category in ('video_games', 'anime', 'popular', 'classical', 'films', 'tv_shows')
    );

-- 3. Indexes so the per-category list queries don't full-scan once the
--    community library grows. Partial-on-status for community_midis matches
--    the typical access pattern (only approved rows are listed).
create index if not exists user_song_uploads_user_category_idx
    on user_song_uploads (user_id, category);

create index if not exists community_midis_approved_category_idx
    on community_midis (status, category)
    where status = 'approved';
