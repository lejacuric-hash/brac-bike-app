-- =====================================================================
-- Izgubljene kronike: Lodina abeceda — game schema
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Before running:
--   Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".
-- After running, make yourself an admin:
--   1. Authentication → Users → Add user (email + password, auto-confirm).
--   2. insert into public.app_admins (user_id)
--        select id from auth.users where email = 'you@example.com';
-- Then run game_storage.sql for the photo bucket.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No policies: nobody reads this table directly; is_admin() does.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Stops (coordinates edited on site through the in-app admin screen)
-- ---------------------------------------------------------------------
create table if not exists public.game_stops (
  id text primary key,
  game integer not null check (game between 1 and 5),
  letter text not null unique,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 100 check (radius_m between 10 and 2000),
  verified boolean not null default false,
  recorded_accuracy_m real,
  on_foot boolean not null default false,       -- last part is walked ("Continue on foot")
  trailhead_lat double precision,               -- where to leave the bike; recorded on site
  trailhead_lng double precision,
  qr_required boolean not null default false,   -- QR scan replaces the photo as proof
  updated_at timestamptz not null default now()
);
alter table public.game_stops enable row level security;

revoke all on public.game_stops from anon, authenticated;
grant select on public.game_stops to anon, authenticated;
grant update (lat, lng, radius_m, verified, recorded_accuracy_m, on_foot, trailhead_lat, trailhead_lng, qr_required, updated_at)
  on public.game_stops to authenticated;

drop policy if exists "game_stops: public read" on public.game_stops;
create policy "game_stops: public read" on public.game_stops
  for select to anon, authenticated using (true);

drop policy if exists "game_stops: admin update" on public.game_stops;
create policy "game_stops: admin update" on public.game_stops
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Draft coordinates from content/stops-coordinates.md (not verified yet)
insert into public.game_stops (id, game, letter, name, lat, lng, radius_m, on_foot) values
  ('supetar_mausoleum', 1, 'T', 'Supetar – Petrinović mausoleum, St Nicholas peninsula', 43.3855, 16.5445, 100, false),
  ('likva',             1, 'O', 'Likva Bay (K-Pg boundary)',                              43.3870, 16.5000, 100, false),
  ('sutivan_monument',  1, 'Č', 'Sutivan – emigration monument, central park',            43.3842, 16.4814, 100, false),
  ('rasohe',            1, 'E', 'Splitska – Rasohe quarry, Hercules relief',              43.3620, 16.6070, 100, true),
  ('lozisca',           2, 'Z', 'Ložišća – Rendić''s bell tower',                         43.3469, 16.4803, 100, false),
  ('bobovisca',         2, 'B', 'Bobovišća na Moru – Gligo castle, Vičja Luka',           43.3520, 16.4630, 100, false),
  ('milna',             2, 'L', 'Milna – harbour and church of Our Lady of the Annunciation', 43.3265, 16.4495, 100, false),
  ('dracevica',         2, 'D', 'Dračevica – village and windmill',                       43.3290, 16.5420, 100, false),
  ('kopacina',          3, 'A', 'Kopačina Cave plateau near Donji Humac',                 43.3310, 16.5960, 100, true),
  ('skrip',             3, 'I', 'Škrip – Brač Island Museum, Radojković tower',           43.3500, 16.6000, 100, false),
  ('postira',           3, 'V', 'Postira – Nazor''s birth house',                         43.3775, 16.6310, 100, false),
  ('dol',               3, 'H', 'Dol – hrapoćuša caves',                                  43.3620, 16.6290, 100, false),
  ('nerezisca',         4, 'Đ', 'Nerežišća – edge of the village, dry-stone walls',       43.3330, 16.5830, 100, false),
  ('nerezisca_plain',   4, 'U', 'Nerežišća plain – prehistoric mounds',                   43.3300, 16.5750, 300, false),
  ('koloc',             4, 'N', 'Koloč rock, SW of Nerežišća',                            43.3250, 16.5700, 100, true),
  ('zlatni_rat',        5, 'Ž', 'Zlatni Rat – tip of the spit',                           43.2558, 16.6338, 200, false),
  ('dominicans_bol',    5, 'J', 'Bol – Dominican monastery',                              43.2598, 16.6620, 100, false),
  ('dragon_cave',       5, 'M', 'Dragon''s Cave above Murvica',                           43.2693, 16.5990, 100, true),
  ('blaca',             5, 'Š', 'Blaca Hermitage',                                        43.2873, 16.5430, 300, true),
  ('vidova_gora',       5, 'S', 'Vidova gora – summit viewpoint',                         43.2800, 16.6180, 200, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- QR boards (switched on per stop with game_stops.qr_required)
-- ---------------------------------------------------------------------
create table if not exists public.game_qr_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6,}$'),
  stop_id text not null references public.game_stops (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.game_qr_codes enable row level security;

-- Players never read this table (that would leak the codes); they go
-- through resolve_qr_code() and verify_qr_scan().
revoke all on public.game_qr_codes from anon, authenticated;
grant select, update (active) on public.game_qr_codes to authenticated;

drop policy if exists "game_qr_codes: admin read" on public.game_qr_codes;
create policy "game_qr_codes: admin read" on public.game_qr_codes
  for select to authenticated using (public.is_admin());

drop policy if exists "game_qr_codes: admin update" on public.game_qr_codes;
create policy "game_qr_codes: admin update" on public.game_qr_codes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Prizes (edit rows in the table editor; no app build needed)
-- ---------------------------------------------------------------------
create table if not exists public.game_rewards (
  id bigint generated always as identity primary key,
  level integer not null check (level between 1 and 3),
  name_hr text not null,
  name_en text not null,
  active boolean not null default true
);
alter table public.game_rewards enable row level security;

revoke all on public.game_rewards from anon, authenticated;
grant select on public.game_rewards to anon, authenticated;
grant insert, update, delete on public.game_rewards to authenticated;

drop policy if exists "game_rewards: public read" on public.game_rewards;
create policy "game_rewards: public read" on public.game_rewards
  for select to anon, authenticated using (active or public.is_admin());

drop policy if exists "game_rewards: admin write" on public.game_rewards;
create policy "game_rewards: admin write" on public.game_rewards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Placeholder prizes — finalize later
insert into public.game_rewards (level, name_hr, name_en)
select * from (values
  (1, 'Lodin privjesak',                               'Loda''s key ring'),
  (2, 'Boca maslinova ulja ili 1 h u aquaparku',       'A bottle of olive oil or 1 hour at the aquapark'),
  (3, 'Cijeli dan e-bicikla za dvoje i ulaz u aquapark', 'A full day of e-bike rental for two and aquapark entry')
) as v(level, name_hr, name_en)
where not exists (select 1 from public.game_rewards);

-- ---------------------------------------------------------------------
-- Players (one per device/team; one phone plays for the whole group)
-- ---------------------------------------------------------------------
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 40),
  group_size integer not null default 1 check (group_size between 1 and 50),
  language text not null check (language in ('hr', 'en')),
  collected_letters text[] not null default '{}',
  started_at timestamptz not null default now(),
  finale_completed_at timestamptz            -- set only by complete_finale()
);
create index if not exists game_players_leaderboard_idx on public.game_players (finale_completed_at);
alter table public.game_players enable row level security;

revoke all on public.game_players from anon, authenticated;
grant select on public.game_players to authenticated;
grant insert (id, team_name, group_size, language, collected_letters, started_at) on public.game_players to authenticated;
grant update (team_name, group_size, language, collected_letters) on public.game_players to authenticated;

drop policy if exists "game_players: own or admin read" on public.game_players;
create policy "game_players: own or admin read" on public.game_players
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "game_players: own insert" on public.game_players;
create policy "game_players: own insert" on public.game_players
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "game_players: own update" on public.game_players;
create policy "game_players: own update" on public.game_players
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The app starts the game offline and syncs later, so started_at comes from
-- the device. Keep it sane: never in the future, never older than 60 days.
create or replace function public.game_players_clamp_started_at()
returns trigger
language plpgsql
as $$
begin
  new.started_at := least(coalesce(new.started_at, now()), now());
  if new.started_at < now() - interval '60 days' then
    new.started_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists game_players_clamp_started_at on public.game_players;
create trigger game_players_clamp_started_at
  before insert on public.game_players
  for each row execute function public.game_players_clamp_started_at();

-- ---------------------------------------------------------------------
-- Per-stop results
-- ---------------------------------------------------------------------
create table if not exists public.game_stop_results (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.game_players (id) on delete cascade,
  stop_id text not null references public.game_stops (id),
  letter text not null,                        -- always the stop's letter (trigger)
  photo_url text,                              -- storage path in the private game-photos bucket
  answered_correctly boolean not null default false,
  attempts integer not null default 0,
  hint_used boolean not null default false,    -- "Show exact spot" on the map
  qr_scanned_at timestamptz,                   -- set only by verify_qr_scan()
  completed_at timestamptz,                    -- letter + proof of presence (photo or QR)
  unique (player_id, stop_id)
);
alter table public.game_stop_results enable row level security;

create or replace function public.game_stop_results_set_letter()
returns trigger
language plpgsql
as $$
begin
  select letter into new.letter from public.game_stops where id = new.stop_id;
  return new;
end;
$$;

drop trigger if exists game_stop_results_set_letter on public.game_stop_results;
create trigger game_stop_results_set_letter
  before insert or update on public.game_stop_results
  for each row execute function public.game_stop_results_set_letter();

-- player_id/stop_id need UPDATE too: the app upserts, and PostgREST's
-- ON CONFLICT DO UPDATE sets every column in the payload. The RLS
-- "with check" below still stops a row being moved to another player.
-- qr_scanned_at is deliberately not writable by players.
revoke all on public.game_stop_results from anon, authenticated;
grant select on public.game_stop_results to authenticated;
grant insert (player_id, stop_id, letter, photo_url, answered_correctly, attempts, hint_used, completed_at),
      update (player_id, stop_id, letter, photo_url, answered_correctly, attempts, hint_used, completed_at)
  on public.game_stop_results to authenticated;

drop policy if exists "game_stop_results: own or admin read" on public.game_stop_results;
create policy "game_stop_results: own or admin read" on public.game_stop_results
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.game_players p where p.id = player_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "game_stop_results: own insert" on public.game_stop_results;
create policy "game_stop_results: own insert" on public.game_stop_results
  for insert to authenticated with check (
    exists (select 1 from public.game_players p where p.id = player_id and p.user_id = auth.uid())
  );

drop policy if exists "game_stop_results: own update" on public.game_stop_results;
create policy "game_stop_results: own update" on public.game_stop_results
  for update to authenticated
  using (exists (select 1 from public.game_players p where p.id = player_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.game_players p where p.id = player_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Prize claims (created only by claim_prize())
-- ---------------------------------------------------------------------
create table if not exists public.game_prize_claims (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.game_players (id) on delete cascade,
  level integer not null check (level between 1 and 3),
  reward_id bigint references public.game_rewards (id),
  reward_code text not null unique,
  created_at timestamptz not null default now(),
  redeemed boolean not null default false,
  redeemed_at timestamptz,
  unique (player_id, level)
);
alter table public.game_prize_claims enable row level security;

revoke all on public.game_prize_claims from anon, authenticated;
grant select on public.game_prize_claims to authenticated;

drop policy if exists "game_prize_claims: own or admin read" on public.game_prize_claims;
create policy "game_prize_claims: own or admin read" on public.game_prize_claims
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.game_players p where p.id = player_id and p.user_id = auth.uid()
    )
  );

-- Letters that count for prizes: correct answer + proof of presence
create or replace function public.game_player_letters(p_player_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(letter), '{}') from public.game_stop_results
   where player_id = p_player_id and answered_correctly and completed_at is not null;
$$;
revoke execute on function public.game_player_letters(uuid) from public;

-- Finale: all 20 letters, words put in order (checked in the app).
create or replace function public.complete_finale(p_player_id uuid, p_completed_at timestamptz default now())
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.game_players;
begin
  select * into p from public.game_players where id = p_player_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Player not found';
  end if;
  if p.finale_completed_at is not null then
    return p;
  end if;
  if cardinality(public.game_player_letters(p.id)) < 20 then
    raise exception 'Not all 20 letters are collected';
  end if;
  update public.game_players
     set finale_completed_at = least(greatest(coalesce(p_completed_at, now()), p.started_at), now())
   where id = p.id
   returning * into p;
  return p;
end;
$$;
revoke execute on function public.complete_finale(uuid, timestamptz) from public;
grant execute on function public.complete_finale(uuid, timestamptz) to authenticated;

-- Issues the prize code for a level once its letters are collected
-- (level 3 also needs the finale). Returns the existing claim if there is one.
create or replace function public.claim_prize(p_player_id uuid, p_level integer)
returns public.game_prize_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.game_players;
  c public.game_prize_claims;
  have text[];
  need text[];
  new_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  select * into p from public.game_players where id = p_player_id and user_id = auth.uid();
  if not found then
    raise exception 'Player not found';
  end if;

  select * into c from public.game_prize_claims where player_id = p.id and level = p_level;
  if found then
    return c;
  end if;

  -- Must match PRIZE_LEVELS in src/game/structure.js
  need := case p_level
    when 1 then array['O','T','Č','E']
    when 2 then array['O','T','Č','E','Z','B','L','D','A','I','V','H']
    when 3 then (select array_agg(letter) from public.game_stops)
  end;
  if need is null then
    raise exception 'Unknown prize level';
  end if;
  have := public.game_player_letters(p.id);
  if not (have @> need) then
    raise exception 'Not all letters for this prize are collected';
  end if;
  if p_level = 3 and p.finale_completed_at is null then
    raise exception 'The finale is not completed';
  end if;

  loop
    new_code := 'BRAC-';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.game_prize_claims where reward_code = new_code);
  end loop;

  insert into public.game_prize_claims (player_id, level, reward_id, reward_code)
  values (p.id, p_level,
          (select r.id from public.game_rewards r where r.active and r.level = p_level order by r.id limit 1),
          new_code)
  returning * into c;
  return c;
end;
$$;
revoke execute on function public.claim_prize(uuid, integer) from public;
grant execute on function public.claim_prize(uuid, integer) to authenticated;

-- Admin: mark a prize code redeemed at the shop
create or replace function public.admin_redeem_reward(p_code text)
returns public.game_prize_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.game_prize_claims;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  update public.game_prize_claims
     set redeemed = true, redeemed_at = now()
   where reward_code = upper(trim(p_code)) and not redeemed
   returning * into c;
  if not found then
    raise exception 'Code not found or already redeemed';
  end if;
  return c;
end;
$$;
revoke execute on function public.admin_redeem_reward(text) from public;
grant execute on function public.admin_redeem_reward(text) to authenticated;

-- ---------------------------------------------------------------------
-- QR functions
-- ---------------------------------------------------------------------

-- Deep links (https://<domain>/g/<code>): which stop does an active code belong to?
create or replace function public.resolve_qr_code(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select stop_id from public.game_qr_codes where code = upper(trim(p_code)) and active;
$$;
revoke execute on function public.resolve_qr_code(text) from public;
grant execute on function public.resolve_qr_code(text) to anon, authenticated;

-- Accepts a scan only if the code is active, belongs to this stop and the
-- reported position is inside the stop radius. Records qr_scanned_at.
create or replace function public.verify_qr_scan(
  p_player_id uuid, p_stop_id text, p_code text, p_lat double precision, p_lng double precision
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.game_stops;
  dist_m double precision;
  scanned timestamptz := now();
begin
  if not exists (select 1 from public.game_players where id = p_player_id and user_id = auth.uid()) then
    raise exception 'Player not found';
  end if;
  select * into s from public.game_stops where id = p_stop_id;
  if not found then
    raise exception 'Unknown stop';
  end if;
  if not exists (select 1 from public.game_qr_codes
                  where code = upper(trim(p_code)) and active and stop_id = s.id) then
    raise exception 'QR code not valid for this stop';
  end if;

  dist_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - s.lat) / 2), 2) +
    cos(radians(s.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - s.lng) / 2), 2)
  ));
  if dist_m > s.radius_m then
    raise exception 'Too far from the stop (% m)', round(dist_m);
  end if;

  insert into public.game_stop_results (player_id, stop_id, letter, qr_scanned_at)
  values (p_player_id, p_stop_id, s.letter, scanned)
  on conflict (player_id, stop_id) do update set qr_scanned_at = excluded.qr_scanned_at;
  return scanned;
end;
$$;
revoke execute on function public.verify_qr_scan(uuid, text, text, double precision, double precision) from public;
grant execute on function public.verify_qr_scan(uuid, text, text, double precision, double precision) to authenticated;

-- Admin: new random code for a stop (e.g. when a board is lost)
create or replace function public.admin_create_qr_code(p_stop_id text)
returns public.game_qr_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  new_row public.game_qr_codes;
  i integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  loop
    new_code := '';
    for i in 1..7 loop
      new_code := new_code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.game_qr_codes where code = new_code);
  end loop;
  insert into public.game_qr_codes (code, stop_id) values (new_code, p_stop_id) returning * into new_row;
  return new_row;
end;
$$;
revoke execute on function public.admin_create_qr_code(text) from public;
grant execute on function public.admin_create_qr_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- Public leaderboard: teams that completed the finale, fastest first.
-- Team name, group size, time, date and whether "Show exact spot" was used.
-- ---------------------------------------------------------------------
create or replace function public.game_leaderboard(p_limit integer default 50)
returns table (team_name text, group_size integer, finale_completed_at timestamptz, duration_seconds bigint, hint_used boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.team_name, p.group_size, p.finale_completed_at,
         extract(epoch from p.finale_completed_at - p.started_at)::bigint,
         exists (select 1 from public.game_stop_results r where r.player_id = p.id and r.hint_used)
    from public.game_players p
   where p.finale_completed_at is not null
   order by p.finale_completed_at - p.started_at asc, p.finale_completed_at asc
   limit least(greatest(p_limit, 1), 200);
$$;
revoke execute on function public.game_leaderboard(integer) from public;
grant execute on function public.game_leaderboard(integer) to anon, authenticated;
