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

- Cloudflare Pages project: `spas1` (`spas1.pages.dev`)
- Supabase project reference is configured in `index.html`; the publishable key is public by design.
- The volunteer-registration Edge Function requires the `TURNSTILE_SECRET_KEY` secret in Supabase. Never put this value in frontend code or commit it to Git.
- Allowed browser origins for the function are configured by `APP_ALLOWED_ORIGINS`; the default includes `https://spas1.pages.dev` and `https://spas1.my.id`.
- Database schema and row-level security setup are documented in `supabase_migration.sql`. Review carefully and back up data before applying it to another project.

Cloudflare Pages deploys the production branch when changes are pushed to GitHub. Verify the Pages deployment at `https://spas1.pages.dev` before changing custom-domain routing.

## Developer

- GitHub: [evlskyy](https://github.com/evlskyy)
- Email: [hallosky@spas1.my.id](mailto:hallosky@spas1.my.id)
- Instagram: [@evlskyy](https://instagram.com/evlskyy)
- Trakteer: [Support the project](https://teer.id/evlskyy)

© 2026 SPAS1 Project. Crafted.Sky with ❤️
