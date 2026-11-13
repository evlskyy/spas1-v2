-- Run in Supabase SQL Editor only after backing up all 19 existing tables.
-- Before running: disable public sign-ups in Authentication > Settings.
-- This migration assigns trusted existing @admin/@module accounts their RLS role claims.

alter table public."MODUL1_Absensi" enable row level security;
alter table public."MODUL1_DataRelawan" enable row level security;
alter table public."MODUL1_PendaftaranRelawan" enable row level security;
alter table public."MODUL4_AnggaranPO" enable row level security;
alter table public."MODUL4_CloudSync" enable row level security;
alter table public."MODUL4_HACCP" enable row level security;
alter table public."MODUL4_JadwalDistribusi" enable row level security;
alter table public."MODUL4_Joblist" enable row level security;
alter table public."MODUL4_PosterAKG" enable row level security;
alter table public."MODUL4_Resep" enable row level security;
alter table public."MODUL4_TargetPorsi" enable row level security;
alter table public."ADMIN_Login" enable row level security;
alter table public."INFO_SPPG" enable row level security;
alter table public."SPAS1_BENEFICIARIES" enable row level security;
alter table public."SPAS1_MEDIA" enable row level security;
alter table public."SPAS1_SETTINGS" enable row level security;
alter table public."SPAS1_TEAM" enable row level security;
alter table public."modul2_bank_menu" enable row level security;
alter table public."modul3_stok_logistik" enable row level security;

-- These tables are published for deletes or updates and may not have a primary key.
alter table public."INFO_SPPG" replica identity full;
alter table public."SPAS1_MEDIA" replica identity full;
alter table public."MODUL1_PendaftaranRelawan" replica identity full;
alter table public."MODUL1_DataRelawan" replica identity full;
alter table public."MODUL1_Absensi" replica identity full;

alter table public."MODUL1_PendaftaranRelawan"
  add column if not exists "Auth User ID" uuid;
alter table public."MODUL1_DataRelawan"
  add column if not exists "Auth User ID" uuid,
  add column if not exists "Status Akun" text;
update public."MODUL1_DataRelawan"
set "Status Akun" = 'Aktif'
where "Status Akun" is null;
alter table public."MODUL1_PendaftaranRelawan"
  add column if not exists "Diajukan Pada" text,
  add column if not exists "Diputuskan Pada" text,
  add column if not exists "Diputuskan Oleh" text,
  add column if not exists "Role" text,
  add column if not exists "Divisi" text,
  alter column "PIN Salt" drop not null,
  alter column "PIN Hash" drop not null;

alter table public."MODUL1_Absensi"
  add column if not exists "ID Absensi" uuid;
update public."MODUL1_Absensi"
set "ID Absensi" = gen_random_uuid()
where "ID Absensi" is null;
alter table public."MODUL1_Absensi"
  alter column "ID Absensi" set default gen_random_uuid(),
  alter column "ID Absensi" set not null;
create unique index if not exists "MODUL1_Absensi_ID_Absensi_app_key"
  on public."MODUL1_Absensi" ("ID Absensi");

create table if not exists public."MODUL1_Absensi_Drafts" (
  "ID Absensi" uuid primary key references public."MODUL1_Absensi" ("ID Absensi") on delete cascade,
  "Data" jsonb not null,
  "Diperbarui" timestamptz not null default now()
);
alter table public."MODUL1_Absensi_Drafts" enable row level security;

do $$
begin
  if exists (
    select 1 from public."MODUL1_DataRelawan"
    where "ID Relawan" is not null
    group by "ID Relawan" having count(*) > 1
  ) then
    raise exception 'Duplicate ID Relawan values exist in MODUL1_DataRelawan; resolve duplicates before applying this migration.';
  end if;
  if exists (
    select 1 from public."MODUL1_PendaftaranRelawan"
    where "ID Permohonan" is not null
    group by "ID Permohonan" having count(*) > 1
  ) then
    raise exception 'Duplicate ID Permohonan values exist; resolve duplicates before applying this migration.';
  end if;
  if exists (
    select 1 from public."MODUL1_PendaftaranRelawan"
    where "ID Relawan" is not null
      and "Status" in ('Menunggu Persetujuan SUPER ADMIN', 'Menunggu Verifikasi SUPER ADMIN', 'Sedang Diproses')
    group by "ID Relawan" having count(*) > 1
  ) then
    raise exception 'Duplicate pending volunteer IDs exist; resolve them before applying this migration.';
  end if;
end $$;

create unique index if not exists "MODUL1_DataRelawan_ID_Relawan_app_key"
  on public."MODUL1_DataRelawan" ("ID Relawan");
create unique index if not exists "MODUL1_DataRelawan_Auth_User_ID_app_key"
  on public."MODUL1_DataRelawan" ("Auth User ID");
create unique index if not exists "MODUL1_PendaftaranRelawan_ID_Permohonan_app_key"
  on public."MODUL1_PendaftaranRelawan" ("ID Permohonan");
drop index if exists public."MODUL1_PendaftaranRelawan_pending_ID_Relawan_app_key";
create unique index "MODUL1_PendaftaranRelawan_pending_ID_Relawan_app_key"
  on public."MODUL1_PendaftaranRelawan" ("ID Relawan")
  where "Status" in ('Menunggu Persetujuan SUPER ADMIN', 'Sedang Diproses');

-- These keys are required for the application's Supabase upsert operations.
-- Resolve existing duplicate key values before running this migration if an index fails.
create unique index if not exists "SPAS1_SETTINGS_Pengaturan_app_key"
  on public."SPAS1_SETTINGS" ("Pengaturan");
create unique index if not exists "SPAS1_BENEFICIARIES_ID_app_key"
  on public."SPAS1_BENEFICIARIES" ("ID");
create unique index if not exists "SPAS1_TEAM_ID_app_key"
  on public."SPAS1_TEAM" ("ID");
alter table public."modul2_bank_menu"
  add column if not exists "AKG Data" jsonb;
create unique index if not exists "modul2_bank_menu_ID_app_key"
  on public."modul2_bank_menu" ("ID");
create unique index if not exists "modul3_stok_logistik_ID_app_key"
  on public."modul3_stok_logistik" ("ID");

-- A stable JSON payload lets Modul 4 read/write the complete application state
-- without depending on legacy column names in these existing tables.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'MODUL4_AnggaranPO','MODUL4_CloudSync','MODUL4_HACCP',
    'MODUL4_JadwalDistribusi','MODUL4_Joblist','MODUL4_PosterAKG',
    'MODUL4_Resep','MODUL4_TargetPorsi'
  ] loop
    execute format('alter table public.%I add column if not exists "AppKey" text', table_name);
    execute format('alter table public.%I add column if not exists "Data" jsonb', table_name);
    execute format('create unique index if not exists %I on public.%I ("AppKey")', table_name || '_AppKey_app_key', table_name);
  end loop;
end $$;

alter table public."MODUL4_TargetPorsi"
  add column if not exists "Tanggal" text,
  add column if not exists "Target Porsi" bigint,
  add column if not exists "Porsi Besar" bigint,
  add column if not exists "Porsi Kecil" bigint;

-- Policies were cleared above so no older permissive rule can override these rules.
drop policy if exists "ADMIN_Login_authenticated_access" on public."ADMIN_Login";
drop policy if exists "MODUL1_Absensi_authenticated_access" on public."MODUL1_Absensi";
drop policy if exists "MODUL1_DataRelawan_authenticated_access" on public."MODUL1_DataRelawan";
drop policy if exists "MODUL1_PendaftaranRelawan_authenticated_access" on public."MODUL1_PendaftaranRelawan";
drop policy if exists "MODUL4_AnggaranPO_authenticated_access" on public."MODUL4_AnggaranPO";
drop policy if exists "MODUL4_CloudSync_authenticated_access" on public."MODUL4_CloudSync";
drop policy if exists "MODUL4_HACCP_authenticated_access" on public."MODUL4_HACCP";
drop policy if exists "MODUL4_JadwalDistribusi_authenticated_access" on public."MODUL4_JadwalDistribusi";
drop policy if exists "MODUL4_Joblist_authenticated_access" on public."MODUL4_Joblist";
drop policy if exists "MODUL4_PosterAKG_authenticated_access" on public."MODUL4_PosterAKG";
drop policy if exists "MODUL4_Resep_authenticated_access" on public."MODUL4_Resep";
drop policy if exists "MODUL4_TargetPorsi_authenticated_access" on public."MODUL4_TargetPorsi";
drop policy if exists "INFO_SPPG_authenticated_access" on public."INFO_SPPG";
drop policy if exists "SPAS1_BENEFICIARIES_authenticated_access" on public."SPAS1_BENEFICIARIES";
drop policy if exists "SPAS1_MEDIA_authenticated_access" on public."SPAS1_MEDIA";
drop policy if exists "SPAS1_SETTINGS_authenticated_access" on public."SPAS1_SETTINGS";
drop policy if exists "SPAS1_SETTINGS public read" on public."SPAS1_SETTINGS";
drop policy if exists "SPAS1_TEAM_authenticated_access" on public."SPAS1_TEAM";
drop policy if exists "modul2_bank_menu_authenticated_access" on public."modul2_bank_menu";
drop policy if exists "modul3_stok_logistik_authenticated_access" on public."modul3_stok_logistik";

-- Role claims are managed by trusted administrators, never by browser user metadata.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where right(lower(email), length('@admin.spas1.local')) = '@admin.spas1.local';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"module"}'::jsonb
where right(lower(email), length('@module.spas1.local')) = '@module.spas1.local';

drop policy if exists "MODUL1_Absensi admin read" on public."MODUL1_Absensi";
drop policy if exists "MODUL1_Absensi admin manage" on public."MODUL1_Absensi";
create policy "MODUL1_Absensi admin manage"
on public."MODUL1_Absensi" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "MODUL1_Absensi_Drafts admin manage" on public."MODUL1_Absensi_Drafts";
create policy "MODUL1_Absensi_Drafts admin manage"
on public."MODUL1_Absensi_Drafts" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "MODUL1_DataRelawan admin manage" on public."MODUL1_DataRelawan";
create policy "MODUL1_DataRelawan admin manage"
on public."MODUL1_DataRelawan" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "MODUL1_DataRelawan employee read own active profile" on public."MODUL1_DataRelawan";
create policy "MODUL1_DataRelawan employee read own active profile"
on public."MODUL1_DataRelawan" for select to authenticated
using ("Auth User ID" = auth.uid() and "Status Akun" = 'Aktif');

-- Registration requests are accessed only through the Edge Function using its service role.
-- The legacy credential table intentionally has no policies; authentication uses Supabase Auth.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'MODUL4_AnggaranPO','MODUL4_CloudSync','MODUL4_HACCP',
    'MODUL4_JadwalDistribusi','MODUL4_Joblist','MODUL4_PosterAKG',
    'MODUL4_Resep','MODUL4_TargetPorsi'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_module_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''module'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''module''))',
      table_name || '_admin_module_access', table_name
    );
  end loop;
end $$;

-- Public website tables.
drop policy if exists "INFO_SPPG public published read" on public."INFO_SPPG";
create policy "INFO_SPPG public published read" on public."INFO_SPPG"
for select to anon, authenticated using ("Status" = 'Published');

drop policy if exists "SPAS1_MEDIA public published read" on public."SPAS1_MEDIA";
create policy "SPAS1_MEDIA public published read" on public."SPAS1_MEDIA"
for select to anon, authenticated using ("Status" = 'Published');

drop policy if exists "SPAS1_TEAM public approved read" on public."SPAS1_TEAM";
create policy "SPAS1_TEAM public approved read" on public."SPAS1_TEAM"
for select to anon, authenticated using ("Publikasi Disetujui" = 'true');

drop policy if exists "SPAS1_BENEFICIARIES public read" on public."SPAS1_BENEFICIARIES";
create policy "SPAS1_BENEFICIARIES public read" on public."SPAS1_BENEFICIARIES"
for select to anon, authenticated using (true);

drop policy if exists "SPAS1_SETTINGS public read" on public."SPAS1_SETTINGS";
create policy "SPAS1_SETTINGS public read" on public."SPAS1_SETTINGS"
for select to anon using ("Pengaturan" <> 'operationalAppData');

drop policy if exists "INFO_SPPG admin manage" on public."INFO_SPPG";
create policy "INFO_SPPG admin manage"
on public."INFO_SPPG" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "SPAS1_MEDIA admin manage" on public."SPAS1_MEDIA";
create policy "SPAS1_MEDIA admin manage"
on public."SPAS1_MEDIA" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "SPAS1_BENEFICIARIES admin manage" on public."SPAS1_BENEFICIARIES";
create policy "SPAS1_BENEFICIARIES admin manage"
on public."SPAS1_BENEFICIARIES" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "SPAS1_SETTINGS public safe read" on public."SPAS1_SETTINGS";
create policy "SPAS1_SETTINGS public safe read"
on public."SPAS1_SETTINGS" for select to anon, authenticated
using ("Pengaturan" in (
  'foundationName','sppgName','logoUrl','logoFileId','markUrl','markFileId',
  'totalBeneficiaries','volunteerCount','siteContent'
));

drop policy if exists "SPAS1_SETTINGS admin manage" on public."SPAS1_SETTINGS";
create policy "SPAS1_SETTINGS admin manage"
on public."SPAS1_SETTINGS" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "SPAS1_SETTINGS module operational state" on public."SPAS1_SETTINGS";
create policy "SPAS1_SETTINGS module operational state"
on public."SPAS1_SETTINGS" for all to authenticated
using (
  "Pengaturan" = 'operationalAppData'
  and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module')
)
with check (
  "Pengaturan" = 'operationalAppData'
  and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module')
);

drop policy if exists "SPAS1_TEAM admin manage" on public."SPAS1_TEAM";
create policy "SPAS1_TEAM admin manage"
on public."SPAS1_TEAM" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Bank menu admin module manage" on public."modul2_bank_menu";
create policy "Bank menu admin module manage"
on public."modul2_bank_menu" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));

create table if not exists public."modul2_bank_menu_period" (
  "ID" text primary key,
  "Periode Bulan" text not null check ("Periode Bulan" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  "Periode Hari" text not null default 'Senin',
  "Periode Minggu" smallint not null check ("Periode Minggu" between 1 and 4),
  "Kategori" text not null,
  "Menu ID" bigint not null,
  "Data Menu" jsonb not null
);
alter table public."modul2_bank_menu_period"
  add column if not exists "Periode Hari" text;
update public."modul2_bank_menu_period"
set "Periode Hari" = case
  when ("Data Menu" ->> 'hari') in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then "Data Menu" ->> 'hari'
  else 'Senin'
end
where "Periode Hari" is null;
alter table public."modul2_bank_menu_period"
  alter column "Periode Hari" set default 'Senin',
  alter column "Periode Hari" set not null;
alter table public."modul2_bank_menu_period"
  drop constraint if exists "modul2_bank_menu_period_day_check";
alter table public."modul2_bank_menu_period"
  add constraint "modul2_bank_menu_period_day_check"
  check ("Periode Hari" in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'));
drop index if exists public."modul2_bank_menu_period_schedule_key";
create unique index if not exists "modul2_bank_menu_period_schedule_day_key"
  on public."modul2_bank_menu_period" ("Periode Bulan", "Periode Hari", "Periode Minggu", "Menu ID");
alter table public."modul2_bank_menu_period" enable row level security;
drop policy if exists "Bank menu period admin module manage" on public."modul2_bank_menu_period";
create policy "Bank menu period admin module manage"
on public."modul2_bank_menu_period" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));
grant select, insert, update, delete on table public."modul2_bank_menu_period" to authenticated;

drop policy if exists "Stock admin module manage" on public."modul3_stok_logistik";
create policy "Stock admin module manage"
on public."modul3_stok_logistik" for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spas1-media',
  'spas1-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads for SPAS1 media" on storage.objects;
create policy "Public reads for SPAS1 media"
on storage.objects for select to anon, authenticated using (bucket_id = 'spas1-media');

drop policy if exists "Authenticated uploads for SPAS1 media" on storage.objects;
create policy "Authenticated uploads for SPAS1 media"
on storage.objects for insert to authenticated
with check (bucket_id = 'spas1-media' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));

drop policy if exists "Authenticated updates for SPAS1 media" on storage.objects;
create policy "Authenticated updates for SPAS1 media"
on storage.objects for update to authenticated
using (bucket_id = 'spas1-media' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'))
with check (bucket_id = 'spas1-media' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));

drop policy if exists "Authenticated deletes for SPAS1 media" on storage.objects;
create policy "Authenticated deletes for SPAS1 media"
on storage.objects for delete to authenticated
using (bucket_id = 'spas1-media' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'));
