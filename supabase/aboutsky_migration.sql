create table if not exists public.aboutsky_public_content (
  content_key text primary key
    check (content_key ~ '^[a-z][a-z0-9_-]{0,49}$'),
  payload jsonb not null
    check (jsonb_typeof(payload) in ('array', 'object')),
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.aboutsky_public_content enable row level security;
revoke all on public.aboutsky_public_content from public, anon, authenticated;
grant select on public.aboutsky_public_content to anon;

drop policy if exists aboutsky_public_content_published_read
  on public.aboutsky_public_content;
create policy aboutsky_public_content_published_read
  on public.aboutsky_public_content
  for select to anon
  using (published);

create table if not exists public.aboutsky_contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(btrim(name)) between 1 and 150),
  email text not null check (length(email) between 3 and 254),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  message text not null check (length(btrim(message)) between 1 and 5000)
);

alter table public.aboutsky_contact_messages enable row level security;
revoke all on public.aboutsky_contact_messages from public, anon, authenticated;
grant insert on public.aboutsky_contact_messages to service_role;

create table if not exists public.aboutsky_contact_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 6)
);

create index if not exists aboutsky_contact_rate_limits_window_idx
  on public.aboutsky_contact_rate_limits (window_started_at);

alter table public.aboutsky_contact_rate_limits enable row level security;
revoke all on public.aboutsky_contact_rate_limits from public, anon, authenticated;

create or replace function public.aboutsky_allow_contact(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_count integer;
begin
  if p_ip_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  insert into public.aboutsky_contact_rate_limits as current_limit
    (ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set window_started_at = case
        when current_limit.window_started_at <= now() - interval '1 hour'
          then now()
        else current_limit.window_started_at
      end,
      request_count = case
        when current_limit.window_started_at <= now() - interval '1 hour'
          then 1
        else least(current_limit.request_count + 1, 6)
      end
  returning request_count into current_count;

  delete from public.aboutsky_contact_rate_limits
  where window_started_at < now() - interval '1 hour';

  return current_count <= 5;
end;
$$;

revoke all on function public.aboutsky_allow_contact(text)
  from public, anon, authenticated;
grant execute on function public.aboutsky_allow_contact(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('aboutsky-private-archive', 'aboutsky-private-archive', false, 104857600)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.aboutsky_archive_folders (
  id smallint primary key check (id between 1 and 7),
  title text not null,
  icon text not null check (icon ~ '^fa-[a-z0-9-]+$')
);

alter table public.aboutsky_archive_folders enable row level security;
revoke all on public.aboutsky_archive_folders from public, anon, authenticated;
grant select, insert, update, delete on public.aboutsky_archive_folders to service_role;

create table if not exists public.aboutsky_archive_files (
  id uuid primary key default gen_random_uuid(),
  folder_id smallint not null references public.aboutsky_archive_folders(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 255),
  file_type text not null check (file_type in ('pdf', 'doc', 'img', 'zip', 'sql', 'csv')),
  description text not null default '' check (length(description) <= 500),
  file_size bigint not null check (file_size between 0 and 104857600),
  storage_path text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists aboutsky_archive_files_folder_order_idx
  on public.aboutsky_archive_files (folder_id, sort_order, name);

alter table public.aboutsky_archive_files enable row level security;
revoke all on public.aboutsky_archive_files from public, anon, authenticated;
grant select, insert, update, delete on public.aboutsky_archive_files to service_role;

create table if not exists public.aboutsky_archive_access_logs (
  id uuid primary key default gen_random_uuid(),
  accessed_at timestamptz not null default now(),
  auth_user_id uuid references auth.users(id) on delete set null,
  folder_id smallint references public.aboutsky_archive_folders(id) on delete set null,
  result text not null check (result in ('granted', 'denied'))
);

create index if not exists aboutsky_archive_access_logs_recent_idx
  on public.aboutsky_archive_access_logs (accessed_at desc);

alter table public.aboutsky_archive_access_logs enable row level security;
revoke all on public.aboutsky_archive_access_logs from public, anon, authenticated;
grant insert on public.aboutsky_archive_access_logs to service_role;

insert into public.aboutsky_archive_folders (id, title, icon)
values
  (1, 'Dokumen Pribadi', 'fa-file-lines'),
  (2, 'Secret Project', 'fa-code'),
  (3, 'Catatan Teknis', 'fa-book'),
  (4, 'Sertifikat Internal', 'fa-award'),
  (5, 'Foto & Media', 'fa-images'),
  (6, 'Backup Data', 'fa-database'),
  (7, 'Arsip Lama', 'fa-box-archive')
on conflict (id) do update
set title = excluded.title,
    icon = excluded.icon;

update public."SPAS1_SETTINGS" as settings
set "Nilai" = jsonb_set(
      settings."Nilai"::jsonb,
      '{socials}',
      coalesce((
        select jsonb_agg(
          case
            when social ->> 'key' = 'aboutskyy'
              then jsonb_set(social, '{url}', to_jsonb('https://spas1.my.id/aboutsky.html'::text), true)
            else social
          end
          order by ordinal
        )
        from jsonb_array_elements(settings."Nilai"::jsonb -> 'socials')
          with ordinality as social_items(social, ordinal)
      ), '[]'::jsonb),
      true
    )::text
where settings."Pengaturan" = 'siteContent'
  and jsonb_typeof(settings."Nilai"::jsonb) = 'object'
  and jsonb_typeof(settings."Nilai"::jsonb -> 'socials') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(settings."Nilai"::jsonb -> 'socials') as social_items(social)
    where social ->> 'key' = 'aboutskyy'
  );

insert into public.aboutsky_public_content (content_key, payload, published)
values (
  'projects',
  $aboutsky$[{"id":1,"title":"SPAS1 Version 2.0","category":["web","cloud"],"icon":"🍽️","screenshot":"","shortDesc":"Sistem operasional dapur MBG untuk SPPG Sungai Pasir 1 Meral","fullDesc":"Aplikasi web komprehensif untuk mengelola operasional dapur MBG (Makanan Bergizi Gratis) di <strong class=\"text-emerald-400\">SPPG Sungai Pasir 1 Meral, Karimun</strong>. Mengintegrasikan absensi AI, manajemen menu, stok logistik, dan distribusi.","tags":["Web App","Cloud","AI","Google Apps Script"],"stats":[{"value":"500+","label":"Paket Menu"},{"value":"600+","label":"Item Stok"},{"value":"55+","label":"Relawan"},{"value":"2.5K","label":"Porsi/Hari"}],"features":["Absensi dengan AI Face Recognition & GPS Live","Bank Menu 500+ paket dengan standar AKG","Manajemen stok logistik 600+ item","Joblist & tracking tugas harian","Sinkronisasi cloud 2 arah","Dashboard admin real-time"],"techStack":["Google Apps Script","JavaScript","Tailwind CSS","HTML5","Cloud Database"],"achievements":"Digunakan oleh 55+ relawan dapur setiap hari, mengelola 2.500+ porsi makanan bergizi untuk anak sekolah.","liveLink":"https://sites.google.com/view/spas1v2/portal","githubLink":"#"},{"id":2,"title":"EduLearn Mobile","category":["mobile"],"icon":"📱","screenshot":"","shortDesc":"Aplikasi pembelajaran interaktif untuk siswa SD-SMA","fullDesc":"Platform pembelajaran mobile yang menggabungkan gamifikasi, progress tracking, dan konten interaktif untuk meningkatkan engagement siswa dalam belajar.","tags":["Android","iOS","Education","Gamification"],"stats":[{"value":"10K+","label":"Pengguna"},{"value":"500+","label":"Materi"},{"value":"4.8","label":"Rating"},{"value":"50+","label":"Sekolah"}],"features":["Gamifikasi dengan sistem poin & badge","Progress tracking real-time","Konten interaktif & quiz","Offline mode","Parent dashboard","Multi-platform (Android & iOS)"],"techStack":["Kotlin","Swift","Firebase","REST API","Material Design"],"achievements":"Diadopsi oleh 50+ sekolah di Indonesia dengan rating 4.8 di Play Store.","liveLink":"#","githubLink":"#"},{"id":3,"title":"Cloud Analytics Dashboard","category":["web","cloud"],"icon":"📊","screenshot":"","shortDesc":"Real-time dashboard untuk monitoring data operasional","fullDesc":"Dashboard analitik real-time yang memvisualisasikan data operasional bisnis dengan chart interaktif, filtering, dan export capabilities.","tags":["Dashboard","Analytics","Real-time","Visualization"],"stats":[{"value":"1M+","label":"Data Points"},{"value":"<1s","label":"Latency"},{"value":"15+","label":"Chart Types"},{"value":"24/7","label":"Uptime"}],"features":["Real-time data visualization","15+ jenis chart interaktif","Custom dashboard builder","Export PDF/Excel","Alert & notification system","Multi-user access control"],"techStack":["React","D3.js","Node.js","PostgreSQL","WebSocket"],"achievements":"Memproses 1M+ data points dengan latency <1 detik, digunakan oleh 10+ perusahaan.","liveLink":"#","githubLink":"#"},{"id":4,"title":"TokoOnline Pro","category":["web"],"icon":"🛒","screenshot":"","shortDesc":"Platform e-commerce lengkap dengan payment gateway","fullDesc":"Solusi e-commerce full-stack dengan fitur lengkap termasuk payment gateway, inventory management, dan admin panel yang powerful.","tags":["E-Commerce","Payment","Inventory","Admin Panel"],"stats":[{"value":"5K+","label":"Produk"},{"value":"10K+","label":"Transaksi"},{"value":"99.9%","label":"Uptime"},{"value":"<2s","label":"Load Time"}],"features":["Multi-payment gateway","Inventory management otomatis","Admin panel dengan analytics","Mobile responsive","SEO optimized","Order tracking real-time"],"techStack":["Next.js","Node.js","MongoDB","Stripe","Tailwind CSS"],"achievements":"Menangani 10K+ transaksi dengan uptime 99.9% dan load time <2 detik.","liveLink":"#","githubLink":"#"},{"id":5,"title":"HealthTrack iOS","category":["mobile"],"icon":"❤️","screenshot":"","shortDesc":"Aplikasi tracking kesehatan dengan Apple HealthKit","fullDesc":"Aplikasi iOS untuk monitoring kesehatan harian dengan integrasi Apple HealthKit, reminder obat, dan laporan kesehatan komprehensif.","tags":["iOS","Health","HealthKit","SwiftUI"],"stats":[{"value":"5K+","label":"Users"},{"value":"4.9","label":"Rating"},{"value":"50+","label":"Metrics"},{"value":"24/7","label":"Tracking"}],"features":["Apple HealthKit integration","Medication reminder","Health reports & analytics","Doctor consultation feature","Family sharing","Privacy-first design"],"techStack":["Swift","SwiftUI","HealthKit","CoreData","CloudKit"],"achievements":"Rating 4.9 di App Store dengan 5K+ pengguna aktif harian.","liveLink":"#","githubLink":"#"},{"id":6,"title":"AI Customer Service","category":["web","cloud"],"icon":"🤖","screenshot":"","shortDesc":"Chatbot AI untuk customer service dengan NLP","fullDesc":"Sistem chatbot AI canggih untuk customer service dengan natural language processing, integrasi WhatsApp Business API, dan learning capabilities.","tags":["AI","Chatbot","NLP","WhatsApp"],"stats":[{"value":"100K+","label":"Messages"},{"value":"95%","label":"Accuracy"},{"value":"<3s","label":"Response"},{"value":"24/7","label":"Available"}],"features":["Natural Language Processing","WhatsApp Business API","Auto-learning dari interaksi","Multi-language support","Human handoff feature","Analytics dashboard"],"techStack":["Python","OpenAI API","Node.js","WhatsApp API","PostgreSQL"],"achievements":"Menangani 100K+ pesan dengan akurasi 95% dan response time <3 detik.","liveLink":"#","githubLink":"#"}]$aboutsky$::jsonb,
  true
)
on conflict (content_key) do nothing;

insert into public.aboutsky_public_content (content_key, payload, published)
values (
  'certifications',
  $aboutsky${"google":{"issuer":"Google","issuerLogo":" Google","title":"Associate Android Developer","recipientName":"Sky","recipientBrand":"DeploySkyy","recipientRole":"Android SDK & iOS Developer | Kotlin/JavaScript Engineer","description":"Telah berhasil menyelesaikan dan lulus ujian sertifikasi Associate Android Developer yang membuktikan kompetensi dalam pengembangan aplikasi Android menggunakan Kotlin, Material Design, dan arsitektur modern. ( Ini bukan yang sebenarnya hanya visualisasi,jika kamu butuh terkait yang relevan ada pada section Blog didalam folder arsip terenkripsi ).","date":"2021","certId":"GAD-2021-DEPLOYSKYY-001","verifyUrl":"https://developers.google.com/certification/associate-android-developer","color":"#FBBF24","seal":"🇬 Google"},"aws":{"issuer":"Amazon Web Services","issuerLogo":"Amazon🛒🛍","title":"AWS Cloud Practitioner","recipientName":"Sky","recipientBrand":"DeploySkyy","recipientRole":"Cloud Solutions Architect | Full-Stack Developer","description":"Telah berhasil menyelesaikan dan lulus ujian sertifikasi AWS Cloud Practitioner yang membuktikan pemahaman mendalam tentang cloud computing, arsitektur AWS, keamanan, dan best practices. ( Ini bukan yang sebenarnya hanya visualisasi,jika kamu butuh terkait yang relevan ada pada section Blog didalam folder arsip terenkripsi ).","date":"2022","certId":"AWS-CP-2022-DEPLOYSKYY-002","verifyUrl":"https://aws.amazon.com/certification/certified-cloud-practitioner/","color":"#3B82F6","seal":""},"meta":{"issuer":"Meta (Facebook)","issuerLogo":"️♾️","title":"Meta Front-End Developer","recipientName":"Sky","recipientBrand":"DeploySkyy","recipientRole":"Front-End Engineer | React & JavaScript Specialist","description":"Telah berhasil menyelesaikan dan lulus program sertifikasi Meta Front-End Developer yang membuktikan kompetensi dalam React, JavaScript, HTML/CSS, dan pengembangan UI/UX modern.( Ini bukan yang sebenarnya hanya visualisasi,jika kamu butuh terkait yang relevan ada pada section Blog didalam folder arsip terenkripsi ).","date":"2024","certId":"META-FE-2024-DEPLOYSKYY-003","verifyUrl":"https://www.coursera.org/professional-certificates/meta-front-end-developer","color":"#A855F7","seal":"♾️"}}$aboutsky$::jsonb,
  true
)
on conflict (content_key) do nothing;
