# SPAS1 Version 2.1.1

SPAS1 supports daily operations for the MBG kitchen at SPPG Sungai Pasir 1, Meral, Karimun.

## Application

- Daily menu planning and menu bank
- Volunteer registration, administrator approval, login, and attendance
- Kitchen logistics and stock management
- Preparation, distribution, budget, HACCP, and AKG poster modules
- Public site content and media management

The application frontend is a static site served by Cloudflare Pages. Supabase provides authentication, database, storage, and the volunteer-registration Edge Function. The previous Apps Script and spreadsheet backend is not used by this version.

## Deployment and configuration

- Cloudflare Pages project: `spas1`
- Supabase project reference is configured in `index.html`; the publishable key is public by design.
- The volunteer-registration Edge Function requires the `TURNSTILE_SECRET_KEY` secret in Supabase. Never put this value in frontend code or commit it to Git.
- Allowed browser origins for the function are configured by `APP_ALLOWED_ORIGINS`; the default includes `https://spas1.my.id`. HTTP(S) localhost origins are also allowed for local development; authenticated actions still require a valid session.
- Database schema and row-level security setup are documented in `supabase_migration.sql`. Review carefully and back up data before applying it to another project.
- The standalone `aboutsky.html` page is served by Cloudflare Pages at `https://spas1.my.id/aboutsky.html` and uses the same Supabase project for published content, contact submissions, and private archives. Apply `supabase/aboutsky_migration.sql` in the SQL Editor, then deploy `aboutsky-contact` and `aboutsky-archive` with the Supabase CLI. Set `ABOUTSKY_ALLOWED_ORIGINS` if the page uses another origin. Archive access requires a Supabase user whose `app_metadata.role` is `admin`; the Edge Function checks the user token and returns private Storage links that expire after 10 minutes. Keep the service-role key server-side. To import archive files locally, export them into numeric subfolders `1` through `7`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in a trusted local terminal, then run `node scripts/import-aboutsky-archive.js <folder-ekspor>`. The importer accepts PDF, Word, image, ZIP, SQL, and CSV files up to 100 MB, skips already registered files, and never sends the service-role key to the browser. Archive files and existing contact history in Google Sheets are not imported by the SQL migration and must be transferred separately.
- Stock logistics purchases and warehouse issues are recorded by SUPER ADMIN in the `Stok & Nota` tab, with weekday, item quantities, stock snapshots, timemarked receipt/evidence photos, and location. The logistics module shows only items purchased on the selected Monday–Friday of the current week. Cooks record daily usage against each warehouse issue; the remaining quantity is stored as kitchen stock and does not increase warehouse stock. Apply the updated `supabase_migration.sql` in the Supabase SQL Editor before using these features; it creates the movement and daily kitchen-usage tables and their database functions.
- `Pemakaian Koki` provides a Supabase-backed simulation folder for mixed-unit notes (for example 1 Dus = 12 bungkus), two-unit usage, equivalent remainder calculations, editable folder names, save/draft actions, adding more materials to the same folder, and deletion for mistaken entries. After saving, the form clears and opens the destination folder detail page; the folder list has a back action. Folder records are shared across signed-in devices. Existing browser-only demo notes are preserved and can be copied to Supabase with **Impor Draf Lokal Lama**. The simulated return is recorded in the dedicated stock-demo table but intentionally does not increase active warehouse stock. The separate `Stok & Nota` workflow records real stock movements; cancel real movements through stock audit so the audit trail is retained. Apply the updated `supabase_migration.sql` before using the cloud-backed simulation folder.
- The Akuntan submenu includes LPDH daily reports with beneficiary portions, categorized expenses, private receipt uploads, opening/top-up/closing cash calculations, and printable approver/accountant names. Excel, CSV, PDF, and print exports are available. Apply the updated `supabase_migration.sql` before using LPDH; it creates the admin-only report table, private receipt bucket, and signature-name column.
- The Akuntan submenu also includes LPJ with editable data for all eight workbook sheets, `Anonymous` defaults for personal names, per-date Supabase storage, and Excel/PDF/print exports. **Folder LPDH & LPJ** lists saved report dates from the existing Supabase tables; each date folder opens a page with available LPDH/LPJ reports, and LPDH receipt evidence remains in its private Supabase storage bucket. Saving either report refreshes the archive. No new folder table or migration is required. LPDH and LPJ support drawn signature images for print and Excel/PDF output; these are visual signatures, not certificate-based electronic signatures. Apply the latest `supabase_migration.sql` in the Supabase SQL Editor to add LPDH signature storage and the admin-only LPJ table before using these features.
- The SUPER ADMIN sidebar groups `Konten & Tautan Situs`, attendance `Laporan`, `Relawan`, and `Registrasi` under **SUPER AKSES**, above **Akuntan**. Attendance and volunteer print/PDF layouts use landscape pages with print-safe colors.
- After the first successful SUPER ADMIN login in a browser, a **Welcome to SUPER SPAS1** screen asks whether the user is Kepala SPPG, Ahli Gizi, Akuntan, Aslap, Head Chef, and/or Admin. After the answers, an animated chibi neon robot with the SPAS1 S mark waves and says “Say Hallo!” before opening the portal. The answers are just for fun and do not change permissions or get saved; the one-time welcome flag is stored in browser local storage and appears again if that browser data is cleared.
- The Akuntan submenu provides **Audit & Riwayat Transaksi Stok**, **Stok & Nota**, **Folder LPDH & LPJ**, **LPDH Harian**, and **LPJ**. The stock audit includes an animated comparison of active incoming/outgoing quantities grouped by unit (cancelled transactions are excluded), and prints on A4 landscape with a white background and without application overlays. LPJ prints on multi-page A4 landscape.
- **SUPER GIZI** adds a per-serving AKG calculator. Enter each ingredient's serving weight and verified nutrient values per 100 g; the calculator scales and totals energy, protein, fat, carbohydrates, fiber, vitamins A/C, calcium, and iron, and shows category contributions and percentages against editable targets. Its visual dashboard includes an energy-contribution doughnut, macro cards, nutrient-target progress bars, and the three highest target contributions; it updates as ingredients or targets change. Print/PDF uses a compact, white-background layout with readable chart colors and tighter summary tables to reduce page breaks and wasted space. The 2,150 kcal energy target is only an illustrative default from the supplied example, not a universal target. Ingredient composition data must be sourced and entered by the operator; no nutrition database is bundled. Calculator data is stored in the current browser's local storage, not Supabase, so it is device/browser-specific. CSV export and print/PDF are available. No database migration is needed.
- **Read Info Project** includes an in-app **Tutorial Penggunaan Aplikasi** page with step-by-step guidance for public pages, volunteer attendance, Bank Menu, stock logistics, preparation/distribution, SUPER ADMIN, Akuntan, exports, and common access/data issues.
- Volunteer-role registration fields, attendance record IDs/drafts, and administrator edit/delete controls require the matching SQL migration and the updated `volunteer-registration` Edge Function to be deployed before the frontend update is used. Volunteer profiles are deactivated rather than deleted so attendance history is retained.

### Temporary maintenance mode

The Cloudflare Pages middleware in `functions/_middleware.js` reads the `MAINTENANCE_MODE` environment variable. It returns an HTTP 503 maintenance page for requests to `spas1.my.id`

Set `MAINTENANCE_MODE` to `false` in the Cloudflare Pages project's production environment variables to restore the custom domain. Set it to `true` (or remove the variable) to enable maintenance. Deploy the project after changing the variable so the new setting takes effect.

## Developer

- Author: **iamsky**
- Role: Programmer; Full Stack Developer Android & iOS
- Profile photo: [Skyy (iamsky)](assets/skyyabout.jpeg)
- Project repository: [evlskyy/spas1-v2](https://github.com/evlskyy/spas1-v2)
- GitHub: [evlskyy](https://github.com/evlskyy)
- Email: [hallosky@spas1.my.id](mailto:hallosky@spas1.my.id)
- Instagram: [@evlskyy](https://instagram.com/evlskyy)
- Trakteer: [Support the project](https://teer.id/evlskyy)

© 2026 SPAS1 Project. Crafted.Sky with ❤️