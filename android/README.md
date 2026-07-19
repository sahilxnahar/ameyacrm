# Ameya Heights CRM — Android wrapper

Two ways to ship an installable Android app. **TWA is recommended.**

## Option 1 — Trusted Web Activity (recommended)

A Chrome-backed, full-screen wrapper over the live PWA. Full-screen (no URL bar), shares the
same login/2FA/session, receives push when closed, supports camera / file upload / document
scanning / downloads, and auto-updates because it loads the deployed PWA.

### Build

```bash
npm i -g @bubblewrap/cli          # Google's TWA generator
cd android
bubblewrap init --manifest https://crm.ameyaheights.com/manifest.webmanifest
# (or:) bubblewrap init --config ./twa-manifest.json
bubblewrap build                  # -> app-release-signed.apk  and  app-release-bundle.aab
```

Bubblewrap installs the Android SDK/JDK on first run and prompts to create a signing key.
Keep the keystore safe — you need it for every future update.

### Verify ownership (removes the URL bar)

1. `bubblewrap fingerprint` prints your signing key SHA-256.
2. Put it into `assetlinks.sample.json`, rename, and serve it at:
   `https://crm.ameyaheights.com/.well-known/assetlinks.json`
   (Next serves anything in `public/.well-known/`.)

### Distribute

- **Direct:** hand out `app-release-signed.apk` (sideload) or push via MDM.
- **Play Store:** upload `app-release-bundle.aab`.

## Option 2 — Native WebView shell

If you can't depend on Chrome, wrap the PWA in a minimal Kotlin WebView:

- `WebView` with `javaScriptEnabled`, `domStorageEnabled`, `databaseEnabled`.
- `WebChromeClient.onShowFileChooser` for uploads; `onPermissionRequest` for camera/mic.
- `setDownloadListener` → `DownloadManager` for file downloads.
- Firebase Cloud Messaging for push (register the FCM token against `PushSubscription`).
- Optional `BiometricPrompt` gate before showing the WebView.

TWA needs far less code and reuses the PWA's web-push, so prefer Option 1 unless you have a
specific reason not to.

## Requirements coverage

| Requirement | How |
|---|---|
| Installable via APK | TWA `bubblewrap build` → signed `.apk` |
| Same auth + 2FA | Loads the same web app / session cookies |
| Push when closed | TWA delegates to Chrome web-push (VAPID) |
| No browser UI | TWA + verified Digital Asset Links |
| Biometric unlock | Passkeys/WebAuthn in-page, or `BiometricPrompt` (Option 2) |
| Stay logged in | Secure session cookie + optional device trust |
| Camera / scan / upload / download | TWA inherits browser capabilities; WebView wires them explicitly |
| Phone + tablet layouts | Responsive PWA |
