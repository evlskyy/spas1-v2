# SPAS1 Android Release App 2.1.2 — GitHub Release Draft

> Draft only. Do not publish until the APK is built, tested, and approved.

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

Keep the application ID and signing key unchanged for future APK updates. Create and back up the signing key securely; never commit it or include it in a GitHub Release. Use default WebView settings for the first POC. Do not enable offline packaging, resource encryption, proxy, CORS bypass, or background services.

The wrapper loads the live website and requires an internet connection. Updates to the live site can appear without reinstalling the APK; native wrapper changes require a newly signed APK.

## Build baseline

On 2026-11-15, the production home page and icon URL responded successfully. The live page was still on the previous release; the planned 2.1.2 changes are local and will appear in the wrapper after deployment to the same URL.

## POC test record

- Device model: _pending_
- Android version: _pending_
- WebToApp version: _pending_
- APK version code/name: _pending_
- APK SHA-256: _pending_

Use an approved test account and test environment. Do not create test attendance, stock, or accounting transactions in production.

### Acceptance checklist

- [ ] APK installs and launches on the recorded Android device.
- [ ] The app opens the SPAS1 production URL over HTTPS and renders its home page.
- [ ] Public pages and module navigation work; back navigation returns to the expected page.
- [ ] Login and read-only Supabase data loading work with an authorized test account.
- [ ] Camera, location, and file-picker permission prompts are understandable; test uploads only with approved test data.
- [ ] WhatsApp and other external links open in the expected app/browser.
- [ ] PDF/print actions fail clearly or hand off correctly in WebView.
- [ ] A network interruption and the site's maintenance page do not leave the app blank or frozen.
- [ ] After a Cloudflare Pages update, relaunching the app shows the updated website without reinstalling.

## Proposed GitHub Release

- Release title: `SPAS1 Android Release App 2.1.2`
- Tag: `v2.1.2-android`
- Type: Keep as a GitHub draft until approved.
- Asset: `SPAS1-Android-2.1.2.apk`

### Release notes draft

This is the Android WebView release app for SPAS1 Version 2.1.2.

- Opens `https://spas1.my.id/`; an internet connection is required.
- Android application ID: `spas1.app`; app version: `2.1.2`.
- Includes the 2.1.2 version labels, refreshed mobile tutorial, aligned light-mode module cards, and updated maintenance page.
- The separate LIVE DEMO page is unchanged.
- This APK is not an iOS app and does not provide offline access to Supabase data.
- Test status, device details, and APK SHA-256 will be added after the POC test.

Attach only the signed APK and the completed test details. Do not attach the signing keystore, passwords, production credentials, or private user data.
