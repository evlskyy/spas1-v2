begin;

-- Stock-only migration. Does not alter other modules, auth users, or RLS policies.
do $$
begin
  if to_regclass('public.modul3_stok_logistik') is null
     or to_regclass('public.modul3_stok_logistik_transaksi') is null
     or to_regclass('public.modul3_stok_logistik_belanja_harian') is null
     or to_regclass('public.modul3_stok_logistik_pemakaian_harian') is null then
    raise exception 'Tabel stok inti belum lengkap; pastikan keempat tabel modul3_stok_logistik tersedia sebelum menjalankan migrasi ini.';
  end if;
end $$;

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

alter table public."modul3_stok_logistik_transaksi"
  add column if not exists "Transaksi Referensi ID" uuid references public."modul3_stok_logistik_transaksi" ("ID"),
  add column if not exists "Satuan Pecahan" text not null default '',
  add column if not exists "Faktor Konversi" numeric,
  add column if not exists "Jumlah Utama" numeric not null default 0,
  add column if not exists "Jumlah Pecahan" numeric not null default 0;
create unique index if not exists "modul3_stok_logistik_transaksi_reference_key"
  on public."modul3_stok_logistik_transaksi" ("Transaksi Referensi ID")
  where "Transaksi Referensi ID" is not null;
update public."modul3_stok_logistik_transaksi"
set "Jumlah Utama" = "Jumlah"
where "Jumlah Utama" = 0 and "Jumlah Pecahan" = 0 and "Jumlah" > 0;

alter table public."modul3_stok_logistik_pemakaian_harian"
  add column if not exists "Jumlah Dipakai Utama" numeric not null default 0,
  add column if not exists "Jumlah Dipakai Pecahan" numeric not null default 0,
  add column if not exists "Satuan Pecahan" text not null default '',
  add column if not exists "Faktor Konversi" numeric,
  add column if not exists "Jumlah Dikembalikan" numeric not null default 0,
  add column if not exists "Dikembalikan Pada" timestamptz,
  add column if not exists "Transaksi Pengembalian ID" uuid references public."modul3_stok_logistik_transaksi" ("ID");
update public."modul3_stok_logistik_pemakaian_harian"
set "Jumlah Dipakai Utama" = "Jumlah Dipakai"
where "Jumlah Dipakai Utama" = 0 and "Jumlah Dipakai" > 0 and "Jumlah Dipakai Pecahan" = 0;

-- The old overload is removed so PostgREST exposes the movement signature with fractional quantity.
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
  v_weekday text;
  v_timestamp timestamptz := clock_timestamp();
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat mencatat stok masuk atau stok keluar gudang.';
  end if;
  if nullif(btrim(p_item_id), '') is null
     or p_type is null or p_type not in ('Masuk', 'Keluar')
     or p_quantity is null or p_quantity < 0 or p_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or p_small_quantity is null or p_small_quantity < 0 or p_small_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or p_weekday is null or p_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')
     or nullif(btrim(p_location), '') is null or length(p_location) > 300
     or length(coalesce(p_supplier, '')) > 160 or length(coalesce(p_note, '')) > 500
     or p_photo_path is null
     or p_photo_path !~ '^spas1/stok-logistik/[0-9]{4}/[0-9]{2}/[0-9]{2}-[A-Za-z]+/[^/]+\.(jpeg|png|webp)$'
     or (p_unit_price is not null and (p_unit_price < 0 or p_unit_price::text in ('NaN', 'Infinity', '-Infinity'))) then
    raise exception 'Data transaksi stok tidak valid.';
  end if;

  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin' when 2 then 'Selasa' when 3 then 'Rabu'
    when 4 then 'Kamis' when 5 then 'Jumat' when 6 then 'Sabtu' else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Transaksi operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;

  select * into v_item from public."modul3_stok_logistik"
  where "ID"::text = p_item_id for update;
  if not found then raise exception 'Item stok tidak ditemukan.'; end if;

  v_small_unit := coalesce(v_item."Satuan Pecahan", '');
  v_conversion_factor := nullif(v_item."Faktor Konversi"::text, '')::numeric;
  if (p_quantity = 0 and p_small_quantity = 0)
     or (p_small_quantity > 0 and (v_small_unit = '' or v_conversion_factor is null or v_conversion_factor <= 0)) then
    raise exception 'Jumlah stok utama dan pecahan tidak sesuai konversi item.';
  end if;
  v_quantity := p_quantity + case when p_small_quantity > 0 then p_small_quantity / v_conversion_factor else 0 end;
  if v_quantity <= 0 then raise exception 'Jumlah stok keluar harus lebih dari nol.'; end if;

  v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
  v_after := case when p_type = 'Masuk' then v_before + v_quantity else v_before - v_quantity end;
  if v_after < 0 then raise exception 'Stok keluar melebihi sisa stok gudang.'; end if;
  update public."modul3_stok_logistik" set
    "Stok" = v_after,
    "Harga (Rp)" = case when p_type = 'Masuk' and p_unit_price is not null then p_unit_price else "Harga (Rp)" end
  where "ID" = v_item."ID" returning * into v_item;

  insert into public."modul3_stok_logistik_transaksi" (
    "Tipe", "Item ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi",
    "Jumlah Utama", "Jumlah Pecahan", "Jumlah", "Stok Sebelum", "Stok Sesudah", "Harga Satuan",
    "Supplier", "Catatan", "Tanggal", "Hari", "Lokasi", "Foto Path", "Dibuat Oleh"
  ) values (
    p_type, p_item_id, coalesce(v_item."Kategori", ''), coalesce(v_item."Nama Item", ''),
    coalesce(v_item."Satuan", ''), v_small_unit, v_conversion_factor, p_quantity, p_small_quantity,
    v_quantity, v_before, v_after, p_unit_price, coalesce(btrim(p_supplier), ''), coalesce(btrim(p_note), ''),
    v_timestamp, v_weekday, btrim(p_location), p_photo_path, auth.uid()
  ) returning * into v_movement;
  return jsonb_build_object('movement', to_jsonb(v_movement), 'stock', to_jsonb(v_item));
end;
$$;
revoke all on function public.record_stok_logistik_movement(text, text, numeric, numeric, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.record_stok_logistik_movement(text, text, numeric, numeric, text, text, text, text, text, numeric) to authenticated;

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
     or length(coalesce(p_supplier, '')) > 160 or length(coalesce(p_note, '')) > 500
     or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Data laporan belanja harian tidak valid.';
  end if;
  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin' when 2 then 'Selasa' when 3 then 'Rabu'
    when 4 then 'Kamis' when 5 then 'Jumat' when 6 then 'Sabtu' else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Transaksi operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;
  v_photo_folder := 'spas1/stok-logistik/' || to_char(v_timestamp at time zone 'Asia/Jakarta', 'YYYY/MM/DD') || '-' || v_weekday || '/';
  if p_photo_path is null or p_photo_path not like v_photo_folder || '%'
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
       or v_name = '' or length(v_name) > 160 or v_unit = '' or length(v_unit) > 40
       or length(v_small_unit) > 40
       or ((v_small_unit = '') <> (v_conversion_factor is null))
       or (v_conversion_factor is not null and (v_conversion_factor <= 0 or v_conversion_factor <> trunc(v_conversion_factor)))
       or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
       or coalesce(v_line ->> 'unitPrice', '') !~ '^[0-9]+$' then
      raise exception 'Nama, kategori, satuan, jumlah, atau harga item belanja tidak valid.';
    end if;
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_unit_price := (v_line ->> 'unitPrice')::numeric;
    if v_quantity <= 0 or v_unit_price < 0 then raise exception 'Jumlah harus lebih dari nol dan harga tidak boleh negatif.'; end if;

    perform pg_advisory_xact_lock(hashtextextended(lower(v_name), 0));
    select * into v_item from public."modul3_stok_logistik"
    where lower(btrim("Nama Item"::text)) = lower(v_name) order by "ID" limit 1 for update;
    if not found then
      v_category_before := v_category;
      v_price_before := 0;
      v_supplier_before := '';
      if v_sequence is null then
        select coalesce(max(nullif("ID"::text, '')::bigint), 0) + 1 into v_new_id from public."modul3_stok_logistik";
      else
        loop
          execute 'select nextval($1::regclass)' into v_new_id using v_sequence;
          exit when not exists (select 1 from public."modul3_stok_logistik" where "ID"::text = v_new_id::text);
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
    update public."modul3_stok_logistik"
    set "Kategori" = v_category,
        "Satuan Pecahan" = case when v_small_unit <> '' then v_small_unit else "Satuan Pecahan" end,
        "Faktor Konversi" = case when v_small_unit <> '' then v_conversion_factor else "Faktor Konversi" end,
        "Stok" = v_after,
        "Harga (Rp)" = v_unit_price,
        "Supplier" = case when nullif(btrim(p_supplier), '') is not null then btrim(p_supplier) else "Supplier" end
    where "ID" = v_item."ID" returning * into v_item;

    insert into public."modul3_stok_logistik_transaksi" (
      "Tipe", "Item ID", "Kategori", "Nama Item", "Satuan", "Satuan Pecahan", "Faktor Konversi", "Jumlah Utama", "Jumlah Pecahan", "Jumlah",
      "Stok Sebelum", "Stok Sesudah", "Harga Satuan", "Supplier", "Catatan", "Tanggal", "Hari", "Lokasi", "Foto Path", "Dibuat Oleh", "ID Belanja",
      "Kategori Sebelum", "Harga Sebelum", "Supplier Sebelum"
    ) values (
      'Masuk', v_item."ID"::text, v_category, v_name, v_unit, v_small_unit, v_conversion_factor, v_quantity, 0, v_quantity,
      v_before, v_after, v_unit_price, coalesce(btrim(p_supplier), ''), coalesce(btrim(p_note), ''), v_timestamp, v_weekday,
      btrim(p_location), p_photo_path, auth.uid(), v_report."ID", v_category_before, v_price_before, v_supplier_before
    ) returning * into v_movement;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement."ID");
  end loop;
  update public."modul3_stok_logistik_belanja_harian" set "Total Belanja" = v_total
  where "ID" = v_report."ID" returning * into v_report;
  return jsonb_build_object('report', to_jsonb(v_report), 'movementIds', v_movement_ids, 'itemCount', v_item_count);
end;
$$;
revoke all on function public.record_stok_logistik_daily_purchase(text, text, text, text, jsonb) from public, anon;
grant execute on function public.record_stok_logistik_daily_purchase(text, text, text, text, jsonb) to authenticated;

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
  if p_movement_id is null or p_used_primary_quantity is null or p_used_primary_quantity < 0
     or p_used_primary_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or p_used_small_quantity is null or p_used_small_quantity < 0
     or p_used_small_quantity::text in ('NaN', 'Infinity', '-Infinity') or length(coalesce(p_note, '')) > 500 then
    raise exception 'Data pemakaian harian tidak valid.';
  end if;
  select * into v_movement from public."modul3_stok_logistik_transaksi"
  where "ID" = p_movement_id and "Tipe" = 'Keluar' for update;
  if not found then raise exception 'Transaksi stok keluar gudang tidak ditemukan.'; end if;
  if v_movement."Status" <> 'Aktif' then raise exception 'Transaksi stok keluar sudah dibatalkan.'; end if;

  v_small_unit := coalesce(v_movement."Satuan Pecahan", '');
  v_conversion_factor := nullif(v_movement."Faktor Konversi"::text, '')::numeric;
  if p_used_small_quantity > 0 and (v_small_unit = '' or v_conversion_factor is null or v_conversion_factor <= 0) then
    raise exception 'Pemakaian pecahan tidak memiliki faktor konversi yang valid.';
  end if;
  v_used_quantity := p_used_primary_quantity + case when p_used_small_quantity > 0 then p_used_small_quantity / v_conversion_factor else 0 end;
  if v_used_quantity > v_movement."Jumlah" then raise exception 'Jumlah dipakai tidak boleh melebihi jumlah stok yang dikeluarkan.'; end if;

  select * into v_usage from public."modul3_stok_logistik_pemakaian_harian"
  where "Transaksi Keluar ID" = v_movement."ID" for update;
  if found and v_usage."Dikembalikan Pada" is not null then
    raise exception 'Pemakaian tidak dapat diubah setelah sisa dikembalikan ke gudang.';
  end if;
  v_date := (v_movement."Tanggal" at time zone 'Asia/Jakarta')::date;
  v_remainder := v_movement."Jumlah" - v_used_quantity;
  insert into public."modul3_stok_logistik_pemakaian_harian" (
    "Transaksi Keluar ID", "Item ID", "Tanggal", "Hari", "Jumlah Keluar", "Jumlah Dipakai",
    "Jumlah Dipakai Utama", "Jumlah Dipakai Pecahan", "Satuan Pecahan", "Faktor Konversi",
    "Sisa Dapur", "Catatan", "Diperbarui Pada", "Diperbarui Oleh"
  ) values (
    v_movement."ID", v_movement."Item ID", v_date, v_movement."Hari", v_movement."Jumlah", v_used_quantity,
    p_used_primary_quantity, p_used_small_quantity, v_small_unit, v_conversion_factor,
    v_remainder, coalesce(btrim(p_note), ''), clock_timestamp(), auth.uid()
  ) on conflict ("Transaksi Keluar ID") do update set
    "Item ID" = excluded."Item ID", "Tanggal" = excluded."Tanggal", "Hari" = excluded."Hari",
    "Jumlah Keluar" = excluded."Jumlah Keluar", "Jumlah Dipakai" = excluded."Jumlah Dipakai",
    "Jumlah Dipakai Utama" = excluded."Jumlah Dipakai Utama", "Jumlah Dipakai Pecahan" = excluded."Jumlah Dipakai Pecahan",
    "Satuan Pecahan" = excluded."Satuan Pecahan", "Faktor Konversi" = excluded."Faktor Konversi",
    "Sisa Dapur" = excluded."Sisa Dapur", "Catatan" = excluded."Catatan",
    "Diperbarui Pada" = excluded."Diperbarui Pada", "Diperbarui Oleh" = excluded."Diperbarui Oleh"
  returning * into v_usage;
  return jsonb_build_object('usage', to_jsonb(v_usage));
end;
$$;
drop function if exists public.record_stok_logistik_kitchen_usage(uuid, numeric, text);
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
  v_weekday text;
  v_timestamp timestamptz := clock_timestamp();
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Hanya SUPER ADMIN yang dapat mengembalikan sisa ke gudang.';
  end if;
  if p_movement_id is null then raise exception 'Transaksi stok keluar tidak valid.'; end if;
  select * into v_source from public."modul3_stok_logistik_transaksi"
  where "ID" = p_movement_id and "Tipe" = 'Keluar' for update;
  if not found or v_source."Status" <> 'Aktif' then
    raise exception 'Transaksi stok keluar tidak ditemukan atau sudah dibatalkan.';
  end if;
  select * into v_usage from public."modul3_stok_logistik_pemakaian_harian"
  where "Transaksi Keluar ID" = p_movement_id and "Status" = 'Aktif' for update;
  if not found then raise exception 'Simpan jumlah pemakaian harian sebelum mengembalikan sisa.'; end if;
  if v_usage."Dikembalikan Pada" is not null or v_usage."Sisa Dapur" <= 0 then
    raise exception 'Tidak ada sisa dapur yang dapat dikembalikan atau sisa sudah pernah dikembalikan.';
  end if;
  v_weekday := case extract(isodow from (v_timestamp at time zone 'Asia/Jakarta'))
    when 1 then 'Senin' when 2 then 'Selasa' when 3 then 'Rabu'
    when 4 then 'Kamis' when 5 then 'Jumat' when 6 then 'Sabtu' else 'Minggu'
  end;
  if v_weekday not in ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') then
    raise exception 'Pengembalian stok operasional hanya dapat dicatat pada hari Senin–Jumat.';
  end if;
  select * into v_item from public."modul3_stok_logistik"
  where "ID"::text = v_source."Item ID" for update;
  if not found then raise exception 'Item stok untuk sisa dapur tidak ditemukan.'; end if;
  v_remainder := v_usage."Sisa Dapur";
  v_before := coalesce(nullif(v_item."Stok"::text, ''), '0')::numeric;
  v_after := v_before + v_remainder;
  update public."modul3_stok_logistik" set "Stok" = v_after
  where "ID" = v_item."ID" returning * into v_item;
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
  set "Jumlah Dikembalikan" = v_remainder, "Dikembalikan Pada" = v_timestamp,
      "Transaksi Pengembalian ID" = v_return."ID", "Diperbarui Pada" = v_timestamp, "Diperbarui Oleh" = auth.uid()
  where "ID" = v_usage."ID" returning * into v_usage;
  return jsonb_build_object('usage', to_jsonb(v_usage), 'returnMovement', to_jsonb(v_return), 'stock', to_jsonb(v_item));
end;
$$;
revoke all on function public.return_stok_logistik_kitchen_remainder(uuid) from public, anon;
grant execute on function public.return_stok_logistik_kitchen_remainder(uuid) to authenticated;

-- Prevent voiding a source issue while its return is active. Voiding a return clears its marker.
create or replace function public.guard_stok_logistik_return_void()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old."Status" = 'Aktif' and new."Status" = 'Dibatalkan' then
    if old."Tipe" = 'Keluar' and exists (
      select 1 from public."modul3_stok_logistik_pemakaian_harian" usage
      join public."modul3_stok_logistik_transaksi" returned
        on returned."ID" = usage."Transaksi Pengembalian ID"
      where usage."Transaksi Keluar ID" = old."ID"
        and usage."Dikembalikan Pada" is not null
        and returned."Status" = 'Aktif'
    ) then
      raise exception 'Batalkan transaksi pengembalian sisa terlebih dahulu sebelum membatalkan stok keluar.';
    end if;
    if old."Transaksi Referensi ID" is not null then
      update public."modul3_stok_logistik_pemakaian_harian"
      set "Jumlah Dikembalikan" = 0, "Dikembalikan Pada" = null, "Transaksi Pengembalian ID" = null
      where "Transaksi Pengembalian ID" = old."ID";
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists "modul3_stok_logistik_return_void_guard" on public."modul3_stok_logistik_transaksi";
create trigger "modul3_stok_logistik_return_void_guard"
before update of "Status" on public."modul3_stok_logistik_transaksi"
for each row execute function public.guard_stok_logistik_return_void();

commit;
