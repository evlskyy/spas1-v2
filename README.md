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