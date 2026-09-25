-- =====================================================================
-- Storage bucket for game photos. Run after game_schema.sql (uses is_admin()).
-- Private bucket: each player uploads into a folder named after their own
-- auth user id ({uid}/{stop}-{timestamp}.jpg); only they and admins can read
-- the photos. The leaderboard never exposes them.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-photos', 'game-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "game-photos: upload into own folder" on storage.objects;
create policy "game-photos: upload into own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'game-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "game-photos: read own or admin" on storage.objects;
create policy "game-photos: read own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'game-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
