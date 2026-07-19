# Mobile: PWA + Android APK

The CRM is a first‑class **Progressive Web App** and ships an **Android wrapper** build
path. No separate iOS app is needed — iOS uses the PWA.

## What’s built in

- **Web App Manifest** (`public/manifest.webmanifest`) — name, brand icons (96–512 +
  maskable), theme colours (charcoal/sand), `standalone` display, app **shortcuts**
  (New Task, My Tasks, Leads, Material Request).
- **Service worker** (`public/sw.js`) — offline app shell, stale‑while‑revalidate for
  static assets, network‑first navigations with an **offline fallback** (`offline.html`),
  **web‑push** receiving + notification click‑through.
- **Install prompt** (`RegisterSW`) — surfaces the Android/desktop install prompt; iOS uses
  Add to Home Screen.
- **Icons** generated from the Ameya Heights onyx‑gold app icon.

### Enabling push

1. `npx web-push generate-vapid-keys` → set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
2. Client fetches the key from `GET /api/push/subscribe`, subscribes, and POSTs the
   subscription; the server stores it in `PushSubscription` and fans out via `notify()`.

## iPhone / iPad (iOS) — PWA

1. Open the app in **Safari**.
2. **Share → Add to Home Screen**.
3. Launch from the home‑screen icon → runs full‑screen (no browser chrome), app‑like
   navigation, offline for recently viewed pages, auto‑updates on deploy.
4. Web push works on iOS 16.4+ for installed PWAs (grant permission when asked).
   Biometric unlock is available to sites via WebAuthn/passkeys (the `WebAuthnCredential`
   model backs future passkey enrolment).

## Android — installable APK (Trusted Web Activity)

The recommended wrapper is a **TWA** (Chrome‑backed): full‑screen, no browser UI, shares the
same session/2FA, receives push even when closed, supports camera, file upload, document
scanning and downloads, and auto‑updates because it loads the live PWA.

Build it with **Bubblewrap** using the provided config in [`../android/`](../android):

```bash
npm i -g @bhz/bubblewrap-cli   # or: npm i -g @bubblewrap/cli
cd android
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest   # or use twa-manifest.json
bubblewrap build                # produces app-release-signed.apk + app-release-bundle.aab
```

Then host **Digital Asset Links** so the app opens without a URL bar:

- Bubblewrap prints your signing‑key SHA‑256 fingerprint.
- Serve it at `https://<your-domain>/.well-known/assetlinks.json` (sample in
  `android/assetlinks.sample.json`).

Distribute the `.apk` directly (sideload/MDM) or publish the `.aab` to Google Play.

### Alternative — WebView wrapper

If you prefer a plain WebView shell (no Chrome dependency), `android/README.md` outlines a
minimal Kotlin `WebView` activity with file‑chooser, camera permission, downloads and
FCM push. TWA is recommended because it reuses the PWA’s push and needs far less native code.

## Why this approach

One codebase serves desktop, iOS (PWA) and Android (TWA over the same PWA). The **notification
backend is unified** (`notify()` → in‑app + web‑push + email), so future native Android/iOS
apps can reuse the exact same infrastructure by registering their push tokens against the
`PushSubscription` model — no backend rewrite.
