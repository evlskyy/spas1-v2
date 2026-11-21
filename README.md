<p align="center">
  <a href="https://spas1.my.id/">
    <img src="./assets/spas1-mark.png" alt="Logo SPAS1" width="112">
  </a>
</p>

<h1 align="center">SPAS1 Version 2.1.2</h1>

<p align="center">
  Aplikasi operasional harian dapur Makan Bergizi Gratis untuk SPPG Sungai Pasir 1, Meral, Karimun.
</p>

<p align="center">
  <a href="https://spas1.my.id/"><img src="https://img.shields.io/badge/Live%20App-spas1.my.id-0ea5a4?style=for-the-badge" alt="Buka aplikasi SPAS1"></a>
  <a href="https://spas1.my.id/demo.html"><img src="https://img.shields.io/badge/Demo-data%20simulasi-2563eb?style=for-the-badge" alt="Coba demo SPAS1"></a>
</p>

<p align="center">
  <a href="https://github.com/evlskyy/spas1-v2/stargazers"><img src="https://img.shields.io/github/stars/evlskyy/spas1-v2?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/evlskyy/spas1-v2/network/members"><img src="https://img.shields.io/github/forks/evlskyy/spas1-v2?style=social" alt="GitHub forks"></a>
</p>

<p align="center">
  <strong>Cloudflare Pages</strong> · <strong>Supabase</strong> · <strong>HTML, CSS &amp; JavaScript</strong>
</p>

---

SPAS1 menyatukan alur menu dan gizi, stok logistik, absensi relawan, persiapan, distribusi, serta administrasi dalam satu aplikasi web. Frontend statis berjalan di Cloudflare Pages, sementara autentikasi dan data operasional menggunakan Supabase.

## Fitur utama

- Perencanaan menu harian dan Bank Menu.
- Registrasi relawan, persetujuan admin, login, dan pencatatan absensi.
- Pengelolaan logistik dapur dan stok.
- Modul persiapan, distribusi, anggaran, HACCP, serta poster AKG.
- Pengelolaan konten publik dan media situs.
- Tutorial penggunaan yang diperbarui untuk layar ponsel, tampilan modul yang diselaraskan, serta halaman pemeliharaan.

## Arsitektur

Frontend merupakan situs statis yang disajikan melalui Cloudflare Pages. Supabase menyediakan autentikasi, database, penyimpanan, dan Edge Function untuk registrasi relawan. Backend Apps Script dan Spreadsheet versi sebelumnya tidak digunakan.

## Deployment dan konfigurasi

- Nama project Cloudflare Pages: `spas1`.
- Referensi project Supabase diatur di `index.html`; publishable key memang bersifat publik.
- Edge Function registrasi relawan memerlukan secret `TURNSTILE_SECRET_KEY` di Supabase. Jangan masukkan secret ini ke kode frontend atau commit ke Git.
- Origin browser yang diizinkan diatur dengan `APP_ALLOWED_ORIGINS`; nilai bawaan mencakup `https://spas1.my.id`. Origin localhost HTTP(S) juga diizinkan untuk pengembangan lokal, tetapi aksi terautentikasi tetap memerlukan sesi yang valid.
- Skema database dan Row Level Security (RLS) dijelaskan di `supabase_migration.sql`. Tinjau perubahan dan cadangkan data sebelum menerapkannya ke project lain.

### AboutSky

Halaman mandiri `aboutsky.html` disajikan di `https://spas1.my.id/aboutsky.html` dan menggunakan project Supabase yang sama untuk konten publik, kiriman kontak, serta arsip privat.

- Jalankan `supabase/aboutsky_migration.sql` melalui SQL Editor, lalu deploy fungsi `aboutsky-contact` dan `aboutsky-archive` menggunakan Supabase CLI.
- Atur `ABOUTSKY_ALLOWED_ORIGINS` jika halaman menggunakan origin lain.
- Akses arsip memerlukan pengguna Supabase dengan `app_metadata.role` bernilai `admin`. Edge Function memeriksa token pengguna dan memberikan tautan Storage privat yang kedaluwarsa setelah 10 menit. Simpan service-role key hanya di sisi server.
- Untuk impor lokal, ekspor berkas ke subfolder bernomor `1` sampai `7`, atur `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` hanya di terminal lokal tepercaya, lalu jalankan `node scripts/import-aboutsky-archive.js <folder-ekspor>`.
- Importer menerima PDF, Word, gambar, ZIP, SQL, dan CSV hingga 100 MB, melewati berkas yang sudah terdaftar, dan tidak mengirim service-role key ke browser. Berkas arsip dan riwayat kontak lama di Google Sheets tidak dipindahkan oleh migrasi SQL; pindahkan secara terpisah.

### Stok dan pemakaian dapur

- SUPER ADMIN mencatat pembelian dan pengeluaran gudang pada tab `Stok & Nota`, termasuk hari kerja, jumlah barang, snapshot stok, foto bukti bertanda waktu, dan lokasi. Modul logistik hanya menampilkan pembelian pada Senin–Jumat di minggu yang dipilih.
- Koki mencatat pemakaian harian dari setiap pengeluaran gudang. Sisa barang disimpan sebagai stok dapur dan tidak menambah stok gudang. Terapkan `supabase_migration.sql` terbaru sebelum menggunakan alur ini; migrasi tersebut membuat tabel pergerakan stok, pemakaian harian dapur, dan fungsi database terkait.
- `Pemakaian Koki` menyediakan folder simulasi berbasis Supabase untuk catatan satuan campuran (misalnya 1 dus = 12 bungkus), pemakaian dua satuan, perhitungan sisa ekuivalen, pengubahan nama folder, simpan/draf, penambahan bahan, dan penghapusan entri keliru. Setelah disimpan, formulir dikosongkan dan detail folder tujuan dibuka. Folder dapat digunakan lintas perangkat oleh pengguna yang sudah login.
- Draf demo yang hanya tersimpan di browser tetap tersedia dan dapat disalin ke Supabase melalui **Impor Draf Lokal Lama**. Pengembalian simulasi dicatat di tabel khusus demo stok dan tidak menambah stok gudang aktif. Alur `Stok & Nota` mencatat pergerakan stok nyata; batalkan pergerakan nyata melalui audit stok agar jejak audit tetap tersimpan. Terapkan `supabase_migration.sql` terbaru sebelum memakai folder simulasi cloud.

### Akuntan dan laporan

- Menu Akuntan menyediakan **Audit & Riwayat Transaksi Stok**, **Stok & Nota**, **Folder LPDH & LPJ**, **LPDH Harian**, dan **LPJ**.
- Audit stok membandingkan jumlah masuk/keluar aktif berdasarkan satuan, tidak menghitung transaksi yang dibatalkan, dan menyediakan cetak A4 landscape berlatar putih tanpa overlay aplikasi. LPJ dicetak dalam beberapa halaman A4 landscape.
- LPDH Harian mencatat porsi penerima manfaat, belanja per kategori, bukti nota privat, saldo awal/top-up/akhir, serta nama penanggung jawab dan akuntan untuk cetak. Ekspor Excel, CSV, PDF, dan cetak tersedia. Terapkan `supabase_migration.sql` terbaru untuk membuat tabel laporan khusus admin, bucket nota privat, dan kolom nama tanda tangan.
- LPJ mendukung pengisian dan penyuntingan delapan lembar kerja, nama pribadi bawaan `Anonymous`, penyimpanan Supabase per tanggal, serta ekspor Excel/PDF dan cetak.
- **Folder LPDH & LPJ** mengelompokkan laporan berdasarkan tanggal menggunakan tabel Supabase yang sudah ada. Setiap folder membuka laporan LPDH/LPJ yang tersedia; bukti nota LPDH tetap berada di bucket privat. Penyimpanan laporan memperbarui arsip tanpa memerlukan tabel folder atau migrasi baru.
- LPDH dan LPJ mendukung gambar tanda tangan untuk cetak dan ekspor Excel/PDF. Tanda tangan ini bersifat visual, bukan tanda tangan elektronik berbasis sertifikat. Terapkan `supabase_migration.sql` terbaru untuk penyimpanan tanda tangan LPDH dan tabel LPJ khusus admin.

### Modul dan administrasi

- Sidebar SUPER ADMIN mengelompokkan **Konten & Tautan Situs**, **Laporan**, **Relawan**, dan **Registrasi** di bawah **SUPER AKSES**, di atas menu **Akuntan**. Tata letak cetak absensi dan relawan menggunakan halaman landscape dengan warna yang aman untuk dicetak.
- Setelah login SUPER ADMIN pertama kali di suatu browser, layar **Welcome to SUPER SPAS1** menanyakan peran seperti Kepala SPPG, Ahli Gizi, Akuntan, Aslap, Head Chef, dan Admin. Setelah itu animasi robot chibi neon dengan logo S SPAS1 menyapa pengguna. Jawaban hanya untuk hiburan, tidak mengubah hak akses dan tidak disimpan; penanda sekali tampil disimpan di local storage browser dan akan muncul lagi jika data browser dihapus.
- **SUPER GIZI** menyediakan kalkulator AKG per porsi. Masukkan berat bahan per porsi dan nilai zat gizi terverifikasi per 100 g; kalkulator menghitung energi, protein, lemak, karbohidrat, serat, vitamin A/C, kalsium, dan zat besi serta kontribusi kategori dan persentase terhadap target yang dapat diubah.
- Dasbor SUPER GIZI menampilkan diagram donat kontribusi energi, kartu makronutrien, progres target zat gizi, dan tiga kontribusi tertinggi. Cetak/PDF memakai tata letak ringkas berlatar putih. Target energi 2.150 kkal hanya contoh ilustratif, bukan target universal; operator harus menyediakan data komposisi bahan sendiri karena aplikasi tidak menyertakan database gizi.
- Data kalkulator disimpan di local storage browser/perangkat, bukan Supabase, sehingga hanya tersedia pada browser tersebut. Ekspor CSV dan cetak/PDF tersedia; tidak diperlukan migrasi database.
- **READ INFO PROJECT** memuat **Tutorial Penggunaan Aplikasi** berisi panduan halaman publik, absensi relawan, Bank Menu, logistik, persiapan/distribusi, SUPER ADMIN, Akuntan, ekspor, serta kendala akses dan data.
- Perubahan field pendaftaran relawan, ID/draf absensi, dan kontrol edit/hapus administrator memerlukan migrasi SQL yang sesuai serta Edge Function `volunteer-registration` versi terbaru sebelum frontend diperbarui. Profil relawan dinonaktifkan, bukan dihapus, agar riwayat absensi tetap terjaga.

### Mode pemeliharaan

Middleware Cloudflare Pages di `functions/_middleware.js` membaca variabel lingkungan `MAINTENANCE_MODE`. Saat pemeliharaan aktif, middleware menyajikan [`maintenance.html`](./maintenance.html) dengan HTTP 503 untuk permintaan ke `spas1.my.id`. Halaman menggunakan logo SPAS1 dan ilustrasi anak berlisensi yang disediakan di folder `assets/`.

Atur `MAINTENANCE_MODE` menjadi `false` pada environment produksi project Cloudflare Pages untuk menonaktifkan pemeliharaan. Atur menjadi `true` atau hapus variabel tersebut untuk mengaktifkannya. Deploy project setelah mengubah variabel agar pengaturan baru berlaku.

## Lisensi

Repository ini bukan open source. Penggunaan, penyalinan, modifikasi, atau distribusi kode memerlukan izin tertulis terlebih dahulu. Lihat [`LICENSE.md`](./LICENSE.md) atau hubungi [iamsky](mailto:hallosky@spas1.my.id) untuk meminta izin.

## Pengembang

- Penulis: **iamsky**
- Peran: Programmer; Full Stack Developer Android & iOS
- Foto profil: [Skyy (iamsky)](assets/skyyabout.jpeg)
- Repository: [evlskyy/spas1-v2](https://github.com/evlskyy/spas1-v2)
- GitHub: [evlskyy](https://github.com/evlskyy)
- Email: [hallosky@spas1.my.id](mailto:hallosky@spas1.my.id)
- Instagram: [@evlskyy](https://instagram.com/evlskyy)
- Trakteer: [Dukung project ini](https://teer.id/evlskyy)

© 2026 SPAS1 Project. Crafted.Sky with ❤️
