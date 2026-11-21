-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.
-- Perintah ini hanya memperbaiki tabel Modul 4 yang mengalami error 550001.

alter table public."MODUL4_AnggaranPO" replica identity full;
alter table public."MODUL4_CloudSync" replica identity full;
alter table public."MODUL4_HACCP" replica identity full;
alter table public."MODUL4_JadwalDistribusi" replica identity full;
alter table public."MODUL4_Joblist" replica identity full;
alter table public."MODUL4_PosterAKG" replica identity full;
alter table public."MODUL4_Resep" replica identity full;
alter table public."MODUL4_TargetPorsi" replica identity full;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'MODUL4_AnggaranPO',
    'MODUL4_CloudSync',
    'MODUL4_HACCP',
    'MODUL4_JadwalDistribusi',
    'MODUL4_Joblist',
    'MODUL4_PosterAKG',
    'MODUL4_Resep',
    'MODUL4_TargetPorsi'
  ] loop
    execute format(
      'alter table public.%I add column if not exists "AppKey" text',
      table_name
    );
    execute format(
      'create unique index if not exists %I on public.%I ("AppKey")',
      table_name || '_AppKey_app_key',
      table_name
    );
  end loop;
end $$;

select
  c.relname as tabel,
  case c.relreplident
    when 'f' then 'FULL - OK'
    when 'd' then 'DEFAULT'
    when 'n' then 'NOTHING'
    when 'i' then 'INDEX'
  end as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'MODUL4_AnggaranPO',
    'MODUL4_CloudSync',
    'MODUL4_HACCP',
    'MODUL4_JadwalDistribusi',
    'MODUL4_Joblist',
    'MODUL4_PosterAKG',
    'MODUL4_Resep',
    'MODUL4_TargetPorsi'
  )
order by c.relname;
