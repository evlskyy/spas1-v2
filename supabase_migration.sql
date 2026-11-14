-- Run in Supabase SQL Editor only after backing up all 19 existing tables.
-- Before running: disable public sign-ups in Authentication > Settings.
-- This migration assigns trusted existing @admin/@module accounts their RLS role claims.
-- Transaction cancellations retain the original audit rows and apply stock corrections atomically.

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
  where "Status" in ('Menunggu Persetujuan SUPER ADMIN', 'Menunggu Verifikasi SUPER ADMIN', 'Sedang Diproses');

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
alter table public."modul3_stok_logistik"
  add column if not exists "Satuan Pecahan" text not null default '',
  add column if not exists "Faktor Konversi" numeric;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modul3_stok_logistik'
      and column_name = 'Stok' and data_type <> 'numeric'
  ) then
    alter table public."modul3_stok_logistik"
      alter column "Stok" type numeric
      using coalesce(nullif(btrim("Stok"::text), ''), '0')::numeric;
  end if;
end $$;
alter table public."modul3_stok_logistik"
  drop constraint if exists "modul3_stok_logistik_conversion_check";
alter table public."modul3_stok_logistik"
  add constraint "modul3_stok_logistik_conversion_check"
  check (("Satuan Pecahan" = '' and "Faktor Konversi" is null) or
     (length("Satuan Pecahan") between 1 and 40 and "Faktor Konversi" is not null and
      "Faktor Konversi" > 0 and "Faktor Konversi" = trunc("Faktor Konversi")));

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

create table if not exists public."modul3_stok_logistik_transaksi" (
  "ID" uuid primary key default gen_random_uuid(),
  "Tipe" text not null check ("Tipe" in ('Masuk', 'Keluar')),
  "Item ID" text not null,
  "Kategori" text not null,
  "Nama Item" text not null,
  "Satuan" text not null,
  "Satuan Pecahan" text not null default '',
  "Faktor Konversi" numeric,
  "Jumlah Utama" numeric not null default 0 check ("Jumlah Utama" >= 0),
  "Jumlah Pecahan" numeric not null default 0 check ("Jumlah Pecahan" >= 0),
  "Jumlah" numeric not null check ("Jumlah" > 0),
  "Stok Sebelum" numeric not null check ("Stok Sebelum" >= 0),
  "Stok Sesudah" numeric not null check ("Stok Sesudah" >= 0),
  "Harga Satuan" numeric check ("Harga Satuan" is null or "Harga Satuan" >= 0),
  "Supplier" text not null default '',
  "Catatan" text not null default '',
  "Tanggal" timestamptz not null default now(),
  "Hari" text not null check ("Hari" in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')),
  "Lokasi" text not null,
  "Foto Path" text not null,
  "Transaksi Referensi ID" uuid references public."modul3_stok_logistik_transaksi" ("ID"),
  "Dibuat Oleh" uuid not null default auth.uid(),
  "Status" text not null default 'Aktif',
  "Dibatalkan Pada" timestamptz,
  "Dibatalkan Oleh" uuid,
  "Alasan Pembatalan" text,
  "Stok Sebelum Pembatalan" numeric,
  "Stok Sesudah Pembatalan" numeric,
  "Kategori Sebelum" text,
  "Harga Sebelum" numeric,
  "Supplier Sebelum" text,
  constraint "modul3_stok_logistik_transaksi_status_check"
    check ("Status" in ('Aktif', 'Dibatalkan'))
);
alter table public."modul3_stok_logistik_transaksi"
  add column if not exists "Transaksi Referensi ID" uuid references public."modul3_stok_logistik_transaksi" ("ID"),
  add column if not exists "Satuan Pecahan" text not null default '',
  add column if not exists "Faktor Konversi" numeric,
  add column if not exists "Jumlah Utama" numeric not null default 0,
  add column if not exists "Jumlah Pecahan" numeric not null default 0,
  add column if not exists "Status" text not null default 'Aktif',
  add column if not exists "Dibatalkan Pada" timestamptz,
  add column if not exists "Dibatalkan Oleh" uuid,
  add column if not exists "Alasan Pembatalan" text,
  add column if not exists "Stok Sebelum Pembatalan" numeric,
  add column if not exists "Stok Sesudah Pembatalan" numeric,
  add column if not exists "Kategori Sebelum" text,
  add column if not exists "Harga Sebelum" numeric,
  add column if not exists "Supplier Sebelum" text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.modul3_stok_logistik_transaksi'::regclass
      and conname = 'modul3_stok_logistik_transaksi_status_check'
  ) then
    alter table public."modul3_stok_logistik_transaksi"
      add constraint "modul3_stok_logistik_transaksi_status_check"
      check ("Status" in ('Aktif', 'Dibatalkan'));
  end if;
end $$;
create index if not exists "modul3_stok_logistik_transaksi_tanggal_idx"
  on public."modul3_stok_logistik_transaksi" ("Tanggal" desc);
create index if not exists "modul3_stok_logistik_transaksi_item_idx"
  on public."modul3_stok_logistik_transaksi" ("Item ID", "Tanggal" desc);
create unique index if not exists "modul3_stok_logistik_transaksi_reference_key"
  on public."modul3_stok_logistik_transaksi" ("Transaksi Referensi ID")
  where "Transaksi Referensi ID" is not null;
alter table public."modul3_stok_logistik_transaksi" enable row level security;
drop policy if exists "Stock movement admin module access" on public."modul3_stok_logistik_transaksi";
create policy "Stock movement admin module access"
on public."modul3_stok_logistik_transaksi" for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','module'))
;
grant select on table public."modul3_stok_logistik_transaksi" to authenticated;

drop function if exists public.record_stok_logistik_movement(text, text, numeric, numeric, text, text, text, text, text);
create or replace function public.record_stok_logistik_movement(
  p_item_id text,
  p_type text,
  p_quantity numeric,
  p_unit_price numeric,
  p_supplier text,
  p_note text,
  p_weekday text,
  p_location text,
  p_photo_path text,
  p_small_quantity numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public."modul3_stok_logistik"%rowtype;
  v_movement public."modul3_stok_logistik_transaksi"%rowtype;
  v_before numeric;
  v_after numeric;
  v_quantity numeric;
  v_small_unit text;
  v_conversion_factor numeric;
  v_stock_type text;
  v_weekday text;
  v_timestamp timestamptz := clock_timestamp();
  v_category_before text;
  v_price_before numeric;
  v_supplier_before text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat mencatat stok masuk atau stok keluar gudang.';
  end if;
  if nullif(btrim(p_item_id), '') is null
     or p_type is null or p_type not in ('Masuk', 'Keluar')
    or p_quantity is null or p_quantity < 0 or p_quantity::text in ('NaN', 'Infinity', '-Infinity')
    or p_small_quantity is null or p_small_quantity < 0 or p_small_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or p_weekday is null or p_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')
     or nullif(btrim(p_location), '') is null
     or length(p_location) > 300
     or length(coalesce(p_supplier, '')) > 160
     or length(coalesce(p_note, '')) > 500
     or p_photo_path is null
     or p_photo_path !~ '^spas1/stok-logistik/[0-9]{4}/[0-9]{2}/[0-9]{2}-[A-Za-z]+/[^/]+\.(jpeg|png|webp)$'
     or (p_unit_price is not null and (p_unit_price < 0 or p_unit_price::text in ('NaN', 'Infinity', '-Infinity'))) then
    raise exception 'Data transaksi stok tidak valid.';
  end if;

  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin'
    when 2 then 'Selasa'
    when 3 then 'Rabu'
    when 4 then 'Kamis'
    when 5 then 'Jumat'
    when 6 then 'Sabtu'
    else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Transaksi operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;

  select * into v_item
  from public."modul3_stok_logistik"
  where "ID"::text = p_item_id
  for update;
  if not found then
    raise exception 'Item stok tidak ditemukan.';
  end if;

  v_small_unit := coalesce(v_item."Satuan Pecahan", '');
  v_conversion_factor := nullif(v_item."Faktor Konversi"::text, '')::numeric;
  if (p_quantity = 0 and p_small_quantity = 0) or (p_small_quantity > 0 and (v_small_unit = '' or v_conversion_factor is null or v_conversion_factor <= 0)) then
    raise exception 'Jumlah stok utama dan pecahan tidak sesuai konversi item.';
  end if;
  v_quantity := p_quantity + case when p_small_quantity > 0 then p_small_quantity / v_conversion_factor else 0 end;
  if v_quantity <= 0 then
    raise exception 'Jumlah stok keluar harus lebih dari nol.';
  end if;

  v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
  v_category_before := coalesce(v_item."Kategori", '');
  v_price_before := nullif(v_item."Harga (Rp)"::text, '')::numeric;
  v_supplier_before := coalesce(v_item."Supplier", '');
  v_after := case when p_type = 'Masuk' then v_before + v_quantity else v_before - v_quantity end;
  if v_after < 0 then
    raise exception 'Stok keluar melebihi sisa stok gudang.';
  end if;
  select data_type into v_stock_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'modul3_stok_logistik'
    and column_name = 'Stok';
  if v_stock_type in ('smallint', 'integer', 'bigint') and v_after <> trunc(v_after) then
    raise exception 'Kolom stok hanya mendukung bilangan bulat. Periksa satuan atau skema stok.';
  end if;

  update public."modul3_stok_logistik"
  set "Stok" = v_after,
      "Harga (Rp)" = case when p_type = 'Masuk' and p_unit_price is not null then p_unit_price else "Harga (Rp)" end
  where "ID" = v_item."ID"
  returning * into v_item;

  insert into public."modul3_stok_logistik_transaksi" (
    "Tipe", "Item ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi", "Jumlah Utama", "Jumlah Pecahan", "Jumlah",
    "Stok Sebelum", "Stok Sesudah", "Harga Satuan", "Supplier", "Catatan",
    "Tanggal", "Hari", "Lokasi", "Foto Path", "Dibuat Oleh",
    "Kategori Sebelum", "Harga Sebelum", "Supplier Sebelum"
  ) values (
    p_type, p_item_id, coalesce(v_item."Kategori", ''), coalesce(v_item."Nama Item", ''),
    coalesce(v_item."Satuan", ''), v_small_unit, v_conversion_factor, p_quantity, p_small_quantity, v_quantity, v_before, v_after, p_unit_price,
    coalesce(btrim(p_supplier), ''), coalesce(btrim(p_note), ''), v_timestamp,
    v_weekday, btrim(p_location), p_photo_path, auth.uid(),
    v_category_before, v_price_before, v_supplier_before
  ) returning * into v_movement;

  return jsonb_build_object('movement', to_jsonb(v_movement), 'stock', to_jsonb(v_item));
end;
$$;
revoke all on function public.record_stok_logistik_movement(text, text, numeric, numeric, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.record_stok_logistik_movement(text, text, numeric, numeric, text, text, text, text, text, numeric) to authenticated;

create table if not exists public."modul3_stok_logistik_belanja_harian" (
  "ID" uuid primary key default gen_random_uuid(),
  "Tanggal" timestamptz not null default now(),
  "Hari" text not null check ("Hari" in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')),
  "Supplier" text not null default '',
  "Catatan" text not null default '',
  "Lokasi" text not null,
  "Foto Path" text not null,
  "Total Belanja" numeric not null default 0 check ("Total Belanja" >= 0),
  "Jumlah Item" integer not null default 0 check ("Jumlah Item" > 0),
  "Dibuat Oleh" uuid not null default auth.uid(),
  "Status" text not null default 'Aktif',
  "Dibatalkan Pada" timestamptz,
  "Dibatalkan Oleh" uuid,
  "Alasan Pembatalan" text,
  constraint "modul3_stok_logistik_belanja_harian_status_check"
    check ("Status" in ('Aktif', 'Dibatalkan'))
);
alter table public."modul3_stok_logistik_belanja_harian"
  add column if not exists "Status" text not null default 'Aktif',
  add column if not exists "Dibatalkan Pada" timestamptz,
  add column if not exists "Dibatalkan Oleh" uuid,
  add column if not exists "Alasan Pembatalan" text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.modul3_stok_logistik_belanja_harian'::regclass
      and conname = 'modul3_stok_logistik_belanja_harian_status_check'
  ) then
    alter table public."modul3_stok_logistik_belanja_harian"
      add constraint "modul3_stok_logistik_belanja_harian_status_check"
      check ("Status" in ('Aktif', 'Dibatalkan'));
  end if;
end $$;
create index if not exists "modul3_stok_logistik_belanja_tanggal_idx"
  on public."modul3_stok_logistik_belanja_harian" ("Tanggal" desc);
alter table public."modul3_stok_logistik_belanja_harian" enable row level security;
drop policy if exists "Daily stock purchase admin read" on public."modul3_stok_logistik_belanja_harian";
create policy "Daily stock purchase admin read"
on public."modul3_stok_logistik_belanja_harian" for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
grant select on table public."modul3_stok_logistik_belanja_harian" to authenticated;
alter table public."modul3_stok_logistik_transaksi"
  add column if not exists "ID Belanja" uuid
  references public."modul3_stok_logistik_belanja_harian" ("ID");
create index if not exists "modul3_stok_logistik_transaksi_belanja_idx"
  on public."modul3_stok_logistik_transaksi" ("ID Belanja");

create or replace function public.record_stok_logistik_daily_purchase(
  p_supplier text,
  p_note text,
  p_location text,
  p_photo_path text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report public."modul3_stok_logistik_belanja_harian"%rowtype;
  v_item public."modul3_stok_logistik"%rowtype;
  v_movement public."modul3_stok_logistik_transaksi"%rowtype;
  v_line jsonb;
  v_category text;
  v_name text;
  v_unit text;
  v_small_unit text;
  v_conversion_factor numeric;
  v_quantity numeric;
  v_unit_price numeric;
  v_before numeric;
  v_after numeric;
  v_total numeric := 0;
  v_item_count integer := 0;
  v_new_id bigint;
  v_sequence text;
  v_stock_type text;
  v_timestamp timestamptz := clock_timestamp();
  v_weekday text;
  v_photo_folder text;
  v_movement_ids jsonb := '[]'::jsonb;
  v_category_before text;
  v_price_before numeric;
  v_supplier_before text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat mencatat pembelian stok harian.';
  end if;
  if nullif(btrim(p_location), '') is null or length(p_location) > 300
     or length(coalesce(p_supplier, '')) > 160
     or length(coalesce(p_note, '')) > 500
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Data laporan belanja harian tidak valid.';
  end if;

  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin'
    when 2 then 'Selasa'
    when 3 then 'Rabu'
    when 4 then 'Kamis'
    when 5 then 'Jumat'
    when 6 then 'Sabtu'
    else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Transaksi operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;
  v_photo_folder := 'spas1/stok-logistik/' ||
    to_char(v_timestamp at time zone 'Asia/Jakarta', 'YYYY/MM/DD') || '-' || v_weekday || '/';
  if p_photo_path is null
     or p_photo_path not like v_photo_folder || '%'
     or p_photo_path !~ '^spas1/stok-logistik/[0-9]{4}/[0-9]{2}/[0-9]{2}-[A-Za-z]+/[^/]+\.(jpeg|png|webp)$' then
    raise exception 'Foto nota harus disimpan pada folder tanggal transaksi.';
  end if;

  insert into public."modul3_stok_logistik_belanja_harian" (
    "Tanggal", "Hari", "Supplier", "Catatan", "Lokasi", "Foto Path", "Jumlah Item", "Dibuat Oleh"
  ) values (
    v_timestamp, v_weekday, coalesce(btrim(p_supplier), ''), coalesce(btrim(p_note), ''),
    btrim(p_location), p_photo_path, jsonb_array_length(p_items), auth.uid()
  ) returning * into v_report;

  lock table public."modul3_stok_logistik" in share row exclusive mode;
  select data_type into v_stock_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'modul3_stok_logistik'
    and column_name = 'Stok';
  v_sequence := pg_get_serial_sequence('public.modul3_stok_logistik', 'ID');

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_category_before := null;
    v_price_before := null;
    v_supplier_before := null;
    v_category := btrim(coalesce(v_line ->> 'category', ''));
    v_name := btrim(coalesce(v_line ->> 'name', ''));
    v_unit := btrim(coalesce(v_line ->> 'unit', ''));
     v_small_unit := btrim(coalesce(v_line ->> 'smallUnit', ''));
     v_conversion_factor := nullif(v_line ->> 'conversionFactor', '')::numeric;
    if v_category not in ('Bahan Baku', 'Bumbu', 'Rempah', 'Sayur', 'Buah', 'Lainnya')
       or v_name = '' or length(v_name) > 160
       or v_unit = '' or length(v_unit) > 40
       or length(v_small_unit) > 40
       or ((v_small_unit = '') <> (v_conversion_factor is null))
       or (v_conversion_factor is not null and (v_conversion_factor <= 0 or v_conversion_factor <> trunc(v_conversion_factor)))
       or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
       or coalesce(v_line ->> 'unitPrice', '') !~ '^[0-9]+$' then
      raise exception 'Nama, kategori, satuan, jumlah, atau harga item belanja tidak valid.';
    end if;
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_unit_price := (v_line ->> 'unitPrice')::numeric;
    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Jumlah harus lebih dari nol dan harga tidak boleh negatif.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(lower(v_name), 0));
    select * into v_item
    from public."modul3_stok_logistik"
    where lower(btrim("Nama Item"::text)) = lower(v_name)
    order by "ID"
    limit 1
    for update;

    if not found then
      v_category_before := v_category;
      v_price_before := 0;
      v_supplier_before := '';
      if v_sequence is null then
        select coalesce(max(nullif("ID"::text, '')::bigint), 0) + 1
        into v_new_id
        from public."modul3_stok_logistik";
      else
        loop
          execute 'select nextval($1::regclass)' into v_new_id using v_sequence;
          exit when not exists (
            select 1 from public."modul3_stok_logistik" where "ID"::text = v_new_id::text
          );
        end loop;
      end if;
      insert into public."modul3_stok_logistik" (
        "ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi", "Stok", "Harga (Rp)", "Supplier"
      ) values (
        v_new_id, v_category, v_name, v_unit, v_small_unit, v_conversion_factor, 0, v_unit_price, coalesce(btrim(p_supplier), '')
      ) returning * into v_item;
    elsif lower(btrim(v_item."Satuan"::text)) <> lower(v_unit) then
      raise exception 'Satuan item "%" adalah "%"; gunakan satuan yang sama saat belanja.', v_name, v_item."Satuan";
    else
      v_category_before := coalesce(v_item."Kategori", '');
      v_price_before := nullif(v_item."Harga (Rp)"::text, '')::numeric;
      v_supplier_before := coalesce(v_item."Supplier", '');
    end if;

    v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
    v_after := v_before + v_quantity;
    if v_stock_type in ('smallint', 'integer', 'bigint') and v_after <> trunc(v_after) then
      raise exception 'Kolom stok hanya mendukung bilangan bulat. Periksa satuan item "%".', v_name;
    end if;
    update public."modul3_stok_logistik"
    set "Kategori" = v_category,
      "Satuan Pecahan" = case when v_small_unit <> '' then v_small_unit else "Satuan Pecahan" end,
      "Faktor Konversi" = case when v_small_unit <> '' then v_conversion_factor else "Faktor Konversi" end,
        "Stok" = v_after,
        "Harga (Rp)" = v_unit_price,
        "Supplier" = case when nullif(btrim(p_supplier), '') is not null then btrim(p_supplier) else "Supplier" end
    where "ID" = v_item."ID"
    returning * into v_item;

    insert into public."modul3_stok_logistik_transaksi" (
      "Tipe", "Item ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi", "Jumlah Utama", "Jumlah Pecahan", "Jumlah",
      "Stok Sebelum", "Stok Sesudah", "Harga Satuan", "Supplier", "Catatan",
      "Tanggal", "Hari", "Lokasi", "Foto Path", "Dibuat Oleh", "ID Belanja",
      "Kategori Sebelum", "Harga Sebelum", "Supplier Sebelum"
    ) values (
      'Masuk', v_item."ID"::text, v_category, v_name, v_unit, v_small_unit, v_conversion_factor, v_quantity, 0, v_quantity,
      v_before, v_after, v_unit_price, coalesce(btrim(p_supplier), ''), coalesce(btrim(p_note), ''),
      v_timestamp, v_weekday, btrim(p_location), p_photo_path, auth.uid(), v_report."ID",
      v_category_before, v_price_before, v_supplier_before
    ) returning * into v_movement;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement."ID");
  end loop;

  update public."modul3_stok_logistik_belanja_harian"
  set "Total Belanja" = v_total
  where "ID" = v_report."ID"
  returning * into v_report;

  return jsonb_build_object(
    'report', to_jsonb(v_report),
    'movementIds', v_movement_ids,
    'itemCount', v_item_count
  );
end;
$$;
revoke all on function public.record_stok_logistik_daily_purchase(text, text, text, text, jsonb) from public, anon;
grant execute on function public.record_stok_logistik_daily_purchase(text, text, text, text, jsonb) to authenticated;

create table if not exists public."modul3_stok_logistik_pemakaian_harian" (
  "ID" uuid primary key default gen_random_uuid(),
  "Transaksi Keluar ID" uuid not null unique
    references public."modul3_stok_logistik_transaksi" ("ID") on delete cascade,
  "Item ID" text not null,
  "Tanggal" date not null,
  "Hari" text not null check ("Hari" in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')),
  "Jumlah Keluar" numeric not null check ("Jumlah Keluar" > 0),
  "Jumlah Dipakai" numeric not null check ("Jumlah Dipakai" >= 0),
  "Jumlah Dipakai Utama" numeric not null default 0 check ("Jumlah Dipakai Utama" >= 0),
  "Jumlah Dipakai Pecahan" numeric not null default 0 check ("Jumlah Dipakai Pecahan" >= 0),
  "Satuan Pecahan" text not null default '',
  "Faktor Konversi" numeric,
  "Sisa Dapur" numeric not null check ("Sisa Dapur" >= 0),
  "Jumlah Dikembalikan" numeric not null default 0 check ("Jumlah Dikembalikan" >= 0),
  "Dikembalikan Pada" timestamptz,
  "Transaksi Pengembalian ID" uuid references public."modul3_stok_logistik_transaksi" ("ID"),
  "Catatan" text not null default '',
  "Diperbarui Pada" timestamptz not null default now(),
  "Diperbarui Oleh" uuid not null default auth.uid(),
  "Status" text not null default 'Aktif',
  "Dibatalkan Pada" timestamptz,
  "Dibatalkan Oleh" uuid,
  "Alasan Pembatalan" text,
  constraint "modul3_stok_logistik_pemakaian_harian_status_check"
    check ("Status" in ('Aktif', 'Dibatalkan')),
  check ("Jumlah Dipakai" + "Sisa Dapur" = "Jumlah Keluar")
);
alter table public."modul3_stok_logistik_pemakaian_harian"
  add column if not exists "Jumlah Dipakai Utama" numeric not null default 0,
  add column if not exists "Jumlah Dipakai Pecahan" numeric not null default 0,
  add column if not exists "Satuan Pecahan" text not null default '',
  add column if not exists "Faktor Konversi" numeric,
  add column if not exists "Jumlah Dikembalikan" numeric not null default 0,
  add column if not exists "Dikembalikan Pada" timestamptz,
  add column if not exists "Transaksi Pengembalian ID" uuid references public."modul3_stok_logistik_transaksi" ("ID"),
  add column if not exists "Status" text not null default 'Aktif',
  add column if not exists "Dibatalkan Pada" timestamptz,
  add column if not exists "Dibatalkan Oleh" uuid,
  add column if not exists "Alasan Pembatalan" text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.modul3_stok_logistik_pemakaian_harian'::regclass
      and conname = 'modul3_stok_logistik_pemakaian_harian_status_check'
  ) then
    alter table public."modul3_stok_logistik_pemakaian_harian"
      add constraint "modul3_stok_logistik_pemakaian_harian_status_check"
      check ("Status" in ('Aktif', 'Dibatalkan'));
  end if;
end $$;
create index if not exists "modul3_stok_logistik_pemakaian_tanggal_idx"
  on public."modul3_stok_logistik_pemakaian_harian" ("Tanggal" desc);
alter table public."modul3_stok_logistik_pemakaian_harian" enable row level security;
drop policy if exists "Kitchen usage admin module read" on public."modul3_stok_logistik_pemakaian_harian";
create policy "Kitchen usage admin module read"
on public."modul3_stok_logistik_pemakaian_harian" for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'module'));
grant select on table public."modul3_stok_logistik_pemakaian_harian" to authenticated;

update public."modul3_stok_logistik_pemakaian_harian"
set "Jumlah Dipakai Utama" = "Jumlah Dipakai"
where "Jumlah Dipakai Utama" = 0 and "Jumlah Dipakai" > 0;

drop function if exists public.record_stok_logistik_kitchen_usage(uuid, numeric, text);
create or replace function public.record_stok_logistik_kitchen_usage(
  p_movement_id uuid,
  p_used_primary_quantity numeric,
  p_used_small_quantity numeric,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement public."modul3_stok_logistik_transaksi"%rowtype;
  v_usage public."modul3_stok_logistik_pemakaian_harian"%rowtype;
  v_date date;
  v_used_quantity numeric;
  v_remainder numeric;
  v_small_unit text;
  v_conversion_factor numeric;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'module') then
    raise exception 'Login Koki/Persiapan diperlukan untuk mencatat pemakaian harian.';
  end if;
    if p_movement_id is null
      or p_used_primary_quantity is null
      or p_used_primary_quantity < 0
      or p_used_primary_quantity::text in ('NaN', 'Infinity', '-Infinity')
      or p_used_small_quantity is null
      or p_used_small_quantity < 0
      or p_used_small_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or length(coalesce(p_note, '')) > 500 then
    raise exception 'Data pemakaian harian tidak valid.';
  end if;

  select * into v_movement
  from public."modul3_stok_logistik_transaksi"
  where "ID" = p_movement_id and "Tipe" = 'Keluar'
  for update;
  if not found then
    raise exception 'Transaksi stok keluar gudang tidak ditemukan.';
  end if;
  if v_movement."Status" <> 'Aktif' then
    raise exception 'Transaksi stok keluar sudah dibatalkan.';
  end if;
  v_small_unit := coalesce(v_movement."Satuan Pecahan", '');
  v_conversion_factor := nullif(v_movement."Faktor Konversi"::text, '')::numeric;
  if p_used_small_quantity > 0 and (v_small_unit = '' or v_conversion_factor is null or v_conversion_factor <= 0) then
    raise exception 'Pemakaian pecahan tidak memiliki faktor konversi yang valid.';
  end if;
  v_used_quantity := p_used_primary_quantity + case when p_used_small_quantity > 0 then p_used_small_quantity / v_conversion_factor else 0 end;
  if v_used_quantity > v_movement."Jumlah" then
    raise exception 'Jumlah dipakai tidak boleh melebihi jumlah stok yang dikeluarkan.';
  end if;

  select * into v_usage
  from public."modul3_stok_logistik_pemakaian_harian"
  where "Transaksi Keluar ID" = v_movement."ID"
  for update;
  if found and v_usage."Dikembalikan Pada" is not null then
    raise exception 'Pemakaian tidak dapat diubah setelah sisa dikembalikan ke gudang.';
  end if;

  v_date := (v_movement."Tanggal" at time zone 'Asia/Jakarta')::date;
  v_remainder := v_movement."Jumlah" - v_used_quantity;
  insert into public."modul3_stok_logistik_pemakaian_harian" (
    "Transaksi Keluar ID", "Item ID", "Tanggal", "Hari", "Jumlah Keluar",
    "Jumlah Dipakai", "Jumlah Dipakai Utama", "Jumlah Dipakai Pecahan", "Satuan Pecahan", "Faktor Konversi",
    "Sisa Dapur", "Catatan", "Diperbarui Pada", "Diperbarui Oleh"
  ) values (
    v_movement."ID", v_movement."Item ID", v_date, v_movement."Hari", v_movement."Jumlah",
    v_used_quantity, p_used_primary_quantity, p_used_small_quantity, v_small_unit, v_conversion_factor,
    v_remainder, coalesce(btrim(p_note), ''), clock_timestamp(), auth.uid()
  )
  on conflict ("Transaksi Keluar ID") do update set
    "Item ID" = excluded."Item ID",
    "Tanggal" = excluded."Tanggal",
    "Hari" = excluded."Hari",
    "Jumlah Keluar" = excluded."Jumlah Keluar",
    "Jumlah Dipakai" = excluded."Jumlah Dipakai",
    "Jumlah Dipakai Utama" = excluded."Jumlah Dipakai Utama",
    "Jumlah Dipakai Pecahan" = excluded."Jumlah Dipakai Pecahan",
    "Satuan Pecahan" = excluded."Satuan Pecahan",
    "Faktor Konversi" = excluded."Faktor Konversi",
    "Sisa Dapur" = excluded."Sisa Dapur",
    "Catatan" = excluded."Catatan",
    "Diperbarui Pada" = excluded."Diperbarui Pada",
    "Diperbarui Oleh" = excluded."Diperbarui Oleh"
  returning * into v_usage;

  return jsonb_build_object('usage', to_jsonb(v_usage));
end;
$$;
revoke all on function public.record_stok_logistik_kitchen_usage(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.record_stok_logistik_kitchen_usage(uuid, numeric, numeric, text) to authenticated;

create or replace function public.return_stok_logistik_kitchen_remainder(p_movement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usage public."modul3_stok_logistik_pemakaian_harian"%rowtype;
  v_source public."modul3_stok_logistik_transaksi"%rowtype;
  v_return public."modul3_stok_logistik_transaksi"%rowtype;
  v_item public."modul3_stok_logistik"%rowtype;
  v_remainder numeric;
  v_before numeric;
  v_after numeric;
  v_stock_type text;
  v_weekday text;
  v_timestamp timestamptz := clock_timestamp();
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat mengembalikan sisa ke gudang.';
  end if;
  if p_movement_id is null then
    raise exception 'Transaksi stok keluar tidak valid.';
  end if;

  select * into v_source
  from public."modul3_stok_logistik_transaksi"
  where "ID" = p_movement_id and "Tipe" = 'Keluar'
  for update;
  if not found or v_source."Status" <> 'Aktif' then
    raise exception 'Transaksi stok keluar tidak ditemukan atau sudah dibatalkan.';
  end if;

  select * into v_usage
  from public."modul3_stok_logistik_pemakaian_harian"
  where "Transaksi Keluar ID" = p_movement_id and "Status" = 'Aktif'
  for update;
  if not found then
    raise exception 'Simpan jumlah pemakaian harian sebelum mengembalikan sisa.';
  end if;
  if v_usage."Dikembalikan Pada" is not null or v_usage."Sisa Dapur" <= 0 then
    raise exception 'Tidak ada sisa dapur yang dapat dikembalikan atau sisa sudah pernah dikembalikan.';
  end if;

  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin'
    when 2 then 'Selasa'
    when 3 then 'Rabu'
    when 4 then 'Kamis'
    when 5 then 'Jumat'
    when 6 then 'Sabtu'
    else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Pengembalian stok operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;

  select * into v_item
  from public."modul3_stok_logistik"
  where "ID"::text = v_source."Item ID"
  for update;
  if not found then
    raise exception 'Item stok untuk sisa dapur tidak ditemukan.';
  end if;

  v_remainder := v_usage."Sisa Dapur";
  v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
  v_after := v_before + v_remainder;
  select data_type into v_stock_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'modul3_stok_logistik' and column_name = 'Stok';
  if v_stock_type in ('smallint', 'integer', 'bigint') and v_after <> trunc(v_after) then
    raise exception 'Kolom stok item hanya mendukung bilangan bulat; pengembalian sisa dihentikan.';
  end if;
  update public."modul3_stok_logistik" set "Stok" = v_after where "ID" = v_item."ID" returning * into v_item;

  insert into public."modul3_stok_logistik_transaksi" (
    "Tipe", "Item ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi",
    "Jumlah Utama", "Jumlah Pecahan", "Jumlah", "Stok Sebelum", "Stok Sesudah", "Harga Satuan",
    "Supplier", "Catatan", "Tanggal", "Hari", "Lokasi", "Foto Path", "Transaksi Referensi ID", "Dibuat Oleh"
  ) values (
    'Masuk', v_item."ID"::text, coalesce(v_item."Kategori", ''), coalesce(v_item."Nama Item", ''),
    coalesce(v_item."Satuan", ''), coalesce(v_source."Satuan Pecahan", ''), v_source."Faktor Konversi",
    v_remainder, 0, v_remainder, v_before, v_after, nullif(v_item."Harga (Rp)"::text, '')::numeric,
    coalesce(v_item."Supplier", ''), 'Pengembalian sisa pemakaian dari transaksi ' || p_movement_id::text,
    v_timestamp, v_weekday, v_source."Lokasi", v_source."Foto Path", v_source."ID", auth.uid()
  ) returning * into v_return;

  update public."modul3_stok_logistik_pemakaian_harian"
  set "Jumlah Dikembalikan" = v_remainder,
      "Dikembalikan Pada" = v_timestamp,
      "Transaksi Pengembalian ID" = v_return."ID",
      "Diperbarui Pada" = v_timestamp,
      "Diperbarui Oleh" = auth.uid()
  where "ID" = v_usage."ID"
  returning * into v_usage;

  return jsonb_build_object('usage', to_jsonb(v_usage), 'returnMovement', to_jsonb(v_return), 'stock', to_jsonb(v_item));
end;
$$;
revoke all on function public.return_stok_logistik_kitchen_remainder(uuid) from public, anon;
grant execute on function public.return_stok_logistik_kitchen_remainder(uuid) to authenticated;

create or replace function public.void_stok_logistik_transaction(
  p_movement_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_selected public."modul3_stok_logistik_transaksi"%rowtype;
  v_report public."modul3_stok_logistik_belanja_harian"%rowtype;
  v_movement public."modul3_stok_logistik_transaksi"%rowtype;
  v_item public."modul3_stok_logistik"%rowtype;
  v_latest public."modul3_stok_logistik_transaksi"%rowtype;
  v_snapshot public."modul3_stok_logistik_transaksi"%rowtype;
  v_report_id uuid;
  v_item_id text;
  v_before numeric;
  v_after numeric;
  v_stock_type text;
  v_timestamp timestamptz := clock_timestamp();
  v_adjustments jsonb := '[]'::jsonb;
  v_metadata_restored boolean := true;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat membatalkan transaksi stok.';
  end if;
  if p_movement_id is null
     or nullif(btrim(p_reason), '') is null
     or length(btrim(p_reason)) < 5
     or length(p_reason) > 500 then
    raise exception 'ID transaksi dan alasan pembatalan minimal 5 karakter wajib diisi.';
  end if;

  select * into v_selected
  from public."modul3_stok_logistik_transaksi"
  where "ID" = p_movement_id;
  if not found then
    raise exception 'Transaksi stok tidak ditemukan.';
  end if;

  v_report_id := v_selected."ID Belanja";
  if v_report_id is not null then
    select * into v_report
    from public."modul3_stok_logistik_belanja_harian"
    where "ID" = v_report_id
    for update;
    if not found then
      raise exception 'Laporan nota pembelian tidak ditemukan; pembatalan dihentikan.';
    end if;
    if v_report."Status" <> 'Aktif' then
      raise exception 'Nota pembelian ini sudah dibatalkan.';
    end if;
    perform 1
    from public."modul3_stok_logistik_transaksi"
    where "ID Belanja" = v_report_id
    order by "Item ID", "ID"
    for update;
  else
    select * into v_selected
    from public."modul3_stok_logistik_transaksi"
    where "ID" = p_movement_id
    for update;
    if not found then
      raise exception 'Transaksi stok tidak ditemukan.';
    end if;
    if v_selected."Status" <> 'Aktif' then
      raise exception 'Transaksi stok ini sudah dibatalkan.';
    end if;
  end if;

  perform 1
  from public."modul3_stok_logistik" s
  where s."ID"::text in (
    select t."Item ID"
    from public."modul3_stok_logistik_transaksi" t
    where (v_report_id is not null and t."ID Belanja" = v_report_id)
       or (v_report_id is null and t."ID" = p_movement_id)
  )
  order by s."ID"
  for update;

  select data_type into v_stock_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'modul3_stok_logistik'
    and column_name = 'Stok';

  for v_movement in
    select *
    from public."modul3_stok_logistik_transaksi"
    where (v_report_id is not null and "ID Belanja" = v_report_id)
       or (v_report_id is null and "ID" = p_movement_id)
    order by "Item ID", "ID"
    for update
  loop
    if v_movement."Status" <> 'Aktif' then
      raise exception 'Semua baris nota harus masih aktif agar pembatalan dapat dilakukan.';
    end if;
    if v_movement."Tipe" = 'Keluar' and exists (
      select 1
      from public."modul3_stok_logistik_pemakaian_harian" usage
      join public."modul3_stok_logistik_transaksi" returned
        on returned."ID" = usage."Transaksi Pengembalian ID"
      where usage."Transaksi Keluar ID" = v_movement."ID"
        and usage."Dikembalikan Pada" is not null
        and returned."Status" = 'Aktif'
    ) then
      raise exception 'Batalkan transaksi pengembalian sisa terlebih dahulu sebelum membatalkan stok keluar.';
    end if;

    select * into v_item
    from public."modul3_stok_logistik"
    where "ID"::text = v_movement."Item ID"
    for update;
    if not found then
      raise exception 'Item "%" sudah tidak ada di stok gudang; pembatalan dihentikan.', v_movement."Nama Item";
    end if;

    v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
    v_after := case
      when v_movement."Tipe" = 'Masuk' then v_before - v_movement."Jumlah"
      else v_before + v_movement."Jumlah"
    end;
    if v_after < 0 then
      raise exception 'Pembatalan pembelian "%" ditolak: stok tersedia % %, sedangkan % % harus dikurangi.',
        v_movement."Nama Item", v_before, v_movement."Satuan",
        v_movement."Jumlah", v_movement."Satuan";
    end if;
    if v_stock_type in ('smallint', 'integer', 'bigint') and v_after <> trunc(v_after) then
      raise exception 'Kolom stok item "%" hanya mendukung bilangan bulat; pembatalan dihentikan.',
        v_movement."Nama Item";
    end if;

    update public."modul3_stok_logistik"
    set "Stok" = v_after
    where "ID" = v_item."ID";

    update public."modul3_stok_logistik_transaksi"
    set "Status" = 'Dibatalkan',
        "Dibatalkan Pada" = v_timestamp,
        "Dibatalkan Oleh" = auth.uid(),
        "Alasan Pembatalan" = btrim(p_reason),
        "Stok Sebelum Pembatalan" = v_before,
        "Stok Sesudah Pembatalan" = v_after
    where "ID" = v_movement."ID";

    update public."modul3_stok_logistik_pemakaian_harian"
    set "Status" = 'Dibatalkan',
        "Dibatalkan Pada" = v_timestamp,
        "Dibatalkan Oleh" = auth.uid(),
        "Alasan Pembatalan" = btrim(p_reason)
    where "Transaksi Keluar ID" = v_movement."ID"
      and "Status" = 'Aktif';

    if v_movement."Transaksi Referensi ID" is not null then
      update public."modul3_stok_logistik_pemakaian_harian"
      set "Jumlah Dikembalikan" = 0,
          "Dikembalikan Pada" = null,
          "Transaksi Pengembalian ID" = null
      where "Transaksi Pengembalian ID" = v_movement."ID";
    end if;

    v_adjustments := v_adjustments || jsonb_build_array(jsonb_build_object(
      'movementId', v_movement."ID",
      'itemId', v_movement."Item ID",
      'itemName', v_movement."Nama Item",
      'type', v_movement."Tipe",
      'quantity', v_movement."Jumlah",
      'stockBeforeCancellation', v_before,
      'stockAfterCancellation', v_after
    ));
  end loop;

  if v_report_id is not null then
    update public."modul3_stok_logistik_belanja_harian"
    set "Status" = 'Dibatalkan',
        "Dibatalkan Pada" = v_timestamp,
        "Dibatalkan Oleh" = auth.uid(),
        "Alasan Pembatalan" = btrim(p_reason)
    where "ID" = v_report_id;
  end if;

  for v_item_id in
    select distinct t."Item ID"
    from public."modul3_stok_logistik_transaksi" t
    where (v_report_id is not null and t."ID Belanja" = v_report_id)
       or (v_report_id is null and t."ID" = p_movement_id)
  loop
    if exists (
      select 1
      from public."modul3_stok_logistik_transaksi" t
      where t."Item ID" = v_item_id
        and ((v_report_id is not null and t."ID Belanja" = v_report_id)
          or (v_report_id is null and t."ID" = p_movement_id))
        and t."Tipe" = 'Masuk'
    ) then
      select * into v_latest
      from public."modul3_stok_logistik_transaksi" t
      where t."Item ID" = v_item_id
        and t."Tipe" = 'Masuk'
        and t."Status" = 'Aktif'
        and t."Tanggal" > (
          select max(cancelled."Tanggal")
          from public."modul3_stok_logistik_transaksi" cancelled
          where cancelled."Item ID" = v_item_id
            and ((v_report_id is not null and cancelled."ID Belanja" = v_report_id)
              or (v_report_id is null and cancelled."ID" = p_movement_id))
        )
      order by t."Tanggal" desc, t."ID" desc
      limit 1;

      if found then
        update public."modul3_stok_logistik"
        set "Kategori" = v_latest."Kategori",
            "Harga (Rp)" = coalesce(v_latest."Harga Satuan", "Harga (Rp)"),
            "Supplier" = coalesce(v_latest."Supplier", '')
        where "ID"::text = v_item_id;
      else
        select * into v_snapshot
        from public."modul3_stok_logistik_transaksi" t
        where t."Item ID" = v_item_id
          and ((v_report_id is not null and t."ID Belanja" = v_report_id)
            or (v_report_id is null and t."ID" = p_movement_id))
          and t."Tipe" = 'Masuk'
        order by t."Stok Sebelum", t."ID"
        limit 1;
        if v_snapshot."Kategori Sebelum" is null
           and v_snapshot."Harga Sebelum" is null
           and v_snapshot."Supplier Sebelum" is null then
          v_metadata_restored := false;
        else
          update public."modul3_stok_logistik"
          set "Kategori" = coalesce(v_snapshot."Kategori Sebelum", "Kategori"),
              "Harga (Rp)" = coalesce(v_snapshot."Harga Sebelum", "Harga (Rp)"),
              "Supplier" = coalesce(v_snapshot."Supplier Sebelum", "Supplier")
          where "ID"::text = v_item_id;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'success',
    'reportId', v_report_id,
    'reason', btrim(p_reason),
    'cancelledAt', v_timestamp,
    'adjustments', v_adjustments,
    'metadataRestored', v_metadata_restored
  );
end;
$$;
revoke all on function public.void_stok_logistik_transaction(uuid, text) from public, anon;
grant execute on function public.void_stok_logistik_transaction(uuid, text) to authenticated;

create table if not exists public.spas1_lpdh_reports (
  report_date date primary key,
  sppg_name text not null,
  sppg_code text not null default '',
  fund_period text not null default '',
  beneficiary_portions integer not null default 0 check (beneficiary_portions >= 0),
  accountant_name text not null default '',
  approver_name text not null default '',
  opening_cash numeric(14,2) not null default 0 check (opening_cash >= 0),
  top_up numeric(14,2) not null default 0 check (top_up >= 0),
  operational_cap numeric(14,2) check (operational_cap is null or operational_cap >= 0),
  expenses jsonb not null default '[]'::jsonb check (jsonb_typeof(expenses) = 'array'),
  signatures jsonb not null default '{}'::jsonb check (jsonb_typeof(signatures) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.spas1_lpdh_reports
add column if not exists approver_name text not null default '';
alter table public.spas1_lpdh_reports
add column if not exists signatures jsonb not null default '{}'::jsonb;
alter table public.spas1_lpdh_reports enable row level security;
drop policy if exists "LPDH admin read" on public.spas1_lpdh_reports;
create policy "LPDH admin read"
on public.spas1_lpdh_reports for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPDH admin insert" on public.spas1_lpdh_reports;
create policy "LPDH admin insert"
on public.spas1_lpdh_reports for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPDH admin update" on public.spas1_lpdh_reports;
create policy "LPDH admin update"
on public.spas1_lpdh_reports for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
revoke all on table public.spas1_lpdh_reports from anon, public;
grant select, insert, update on table public.spas1_lpdh_reports to authenticated;

create table if not exists public.spas1_lpj_reports (
  report_date date primary key,
  identity jsonb not null default '{}'::jsonb check (jsonb_typeof(identity) = 'object'),
  cash_book jsonb not null default '[]'::jsonb check (jsonb_typeof(cash_book) = 'array'),
  budget jsonb not null default '[]'::jsonb check (jsonb_typeof(budget) = 'array'),
  food_costs jsonb not null default '[]'::jsonb check (jsonb_typeof(food_costs) = 'array'),
  stock_card jsonb not null default '[]'::jsonb check (jsonb_typeof(stock_card) = 'array'),
  distribution jsonb not null default '[]'::jsonb check (jsonb_typeof(distribution) = 'array'),
  honorarium jsonb not null default '[]'::jsonb check (jsonb_typeof(honorarium) = 'array'),
  sptjm jsonb not null default '{}'::jsonb check (jsonb_typeof(sptjm) = 'object'),
  signatures jsonb not null default '{}'::jsonb check (jsonb_typeof(signatures) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.spas1_lpj_reports enable row level security;
drop policy if exists "LPJ admin read" on public.spas1_lpj_reports;
create policy "LPJ admin read"
on public.spas1_lpj_reports for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPJ admin insert" on public.spas1_lpj_reports;
create policy "LPJ admin insert"
on public.spas1_lpj_reports for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPJ admin update" on public.spas1_lpj_reports;
create policy "LPJ admin update"
on public.spas1_lpj_reports for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
revoke all on table public.spas1_lpj_reports from anon, public;
grant select, insert, update on table public.spas1_lpj_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spas1-lpdh',
  'spas1-lpdh',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "LPDH receipts admin read" on storage.objects;
create policy "LPDH receipts admin read"
on storage.objects for select to authenticated
using (bucket_id = 'spas1-lpdh' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPDH receipts admin upload" on storage.objects;
create policy "LPDH receipts admin upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'spas1-lpdh' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "LPDH receipts admin delete" on storage.objects;
create policy "LPDH receipts admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'spas1-lpdh' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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
