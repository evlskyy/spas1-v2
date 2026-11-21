# SPAS1 Android Release App 2.1.2 — GitHub Release

> Published on 2026-11-21: [v2.1.2-android](https://github.com/evlskyy/spas1-v2/releases/tag/v2.1.2-android).

## WebToApp build settings

| Setting | Value |
| --- | --- |
| App type | Web |
| App name | SPAS1 |
| Target URL | `https://spas1.my.id/` |
| App icon | `https://spas1.my.id/assets/spas1-mark.png` |
| Android application ID | `spas1.app` |
| Version name | `2.1.2` |
| Version code | `1` |
| Browser engine | System WebView |

Keep the application ID and signing identity unchanged for future APK updates; increase the version code for each update. Create and back up the signing key securely; never commit it or include it in a GitHub Release. Use default WebView settings for the first POC. Do not enable offline packaging, resource encryption, proxy, CORS bypass, or background services.

The wrapper loads the live website and requires an internet connection. Updates to the live site can appear without reinstalling the APK; native wrapper changes require a newly signed APK.

## Build baseline

On 2026-11-15, the production home page and icon URL responded successfully. The live page was still on the previous release; the planned 2.1.2 changes are local and will appear in the wrapper after deployment to the same URL.

## POC test record

- Device model: Samsung Galaxy S9+
- Android version: 15
- WebToApp version: _pending_
- APK version code/name: `1` / `2.1.2`
- APK package: `spas1.app`
- APK size: `9,247,590 bytes` (about `8.8 MiB`)
- Minimum / target Android API: `24` / `35`
- APK SHA-256: `85c8a001a0245cc4d8632ead471e7b58fc0c5435cc2defc4840ef441168a1783`
- Build summary reports signature schemes `v1+v2+v3`.
- The owner confirms the APK's declared permissions are required by implemented app features; do not remove them without approval.
- Test result for this exact APK: installed and tested on Samsung Galaxy S9+ running Android 15 (owner-reported); detailed test cases were not individually recorded

Use an approved test account and test environment. Do not create test attendance, stock, or accounting transactions in production.

### Additional validation checklist

- [x] APK installs and launches on the recorded Android device (owner-reported).
- [ ] The app opens the SPAS1 production URL over HTTPS and renders its home page.
- [ ] Public pages and module navigation work; back navigation returns to the expected page.
- [ ] Login and read-only Supabase data loading work with an authorized test account.
- [ ] Camera, location, and file-picker permission prompts are understandable; test uploads only with approved test data.
- [ ] WhatsApp and other external links open in the expected app/browser.
- [ ] PDF/print actions fail clearly or hand off correctly in WebView.
- [ ] A network interruption and the site's maintenance page do not leave the app blank or frozen.
- [ ] After a Cloudflare Pages update, relaunching the app shows the updated website without reinstalling.

## Published GitHub Release

- Release title: `SPAS1 Android Release App 2.1.2`
- Tag: `v2.1.2-android`
- Status: Published publicly on 2026-11-21.
- URL: https://github.com/evlskyy/spas1-v2/releases/tag/v2.1.2-android
- Asset: `spas1_v2.1.2.APK`

### Published release notes

Android WebView release app for SPAS1 Version 2.1.2.

- Application ID: `spas1.app`; version: `2.1.2` (version code `1`).
- Opens `https://spas1.my.id/`; an internet connection is required. Website updates appear after deployment.
- Owner-reported device test: Samsung Galaxy S9+ running Android 15.
- The APK declares permissions for camera, location (including background location), media/files, contacts/accounts, notifications/background services, and system settings. Review Android permission prompts before granting access.
- This is an Android APK, not an iOS app, and it does not provide offline access to Supabase data.
- Review `LICENSE.md` for the project code-use terms.

APK SHA-256: `85c8a001a0245cc4d8632ead471e7b58fc0c5435cc2defc4840ef441168a1783`.

Never commit or distribute the signing keystore, passwords, production credentials, or private user data.
