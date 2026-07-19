# Install the App — iPhone (PWA) & Android (APK)

One codebase, two install experiences. **iPhone/iPad users install the PWA**; **Android
users install a real `.apk`** you generate from the live site — no terminal, no Android
Studio. Everything needed is already in this project.

> Prerequisite: the CRM must be **deployed and live over HTTPS** first (see `DEPLOY.md`).
> Both install methods point at your live URL, e.g. `https://crm.yourdomain.com`.

---

## iPhone / iPad — Progressive Web App

Nothing to build. Tell users to:

1. Open the CRM URL in **Safari** (must be Safari on iOS).
2. Tap the **Share** icon → **Add to Home Screen** → **Add**.
3. Launch from the new home‑screen icon.

They get a full‑screen, app‑like experience (no browser bar), offline access to recently
viewed pages, and — on iOS 16.4+ — web‑push notifications once they allow them in Settings →
Notifications preferences inside the app.

---

## Android — installable `.apk` via PWABuilder (recommended, no terminal)

**PWABuilder** (free, by Microsoft) turns your live PWA into a signed Android app in the
browser. This project is already PWABuilder‑ready (valid manifest, icons, maskable icon,
screenshots, service worker).

### Steps
1. Go to **https://www.pwabuilder.com** and enter your live CRM URL. It analyzes the manifest
   and service worker (you should see high scores).
2. Click **Package for stores → Android**.
3. Choose **"Signed APK"** (for direct install/sideloading) or **"App Bundle (.aab)"** (for
   Google Play). Confirm the **Package ID** `com.ameyaheights.crm` (or set your own).
4. Let PWABuilder generate a **new signing key** (download and keep the `.keystore` +
   passwords safe — you need them for every future update) or upload your own.
5. **Download** the ZIP. It contains `app-release-signed.apk`, the `.aab`, the signing key,
   and a `assetlinks.json` snippet with your key's **SHA‑256 fingerprint**.

### Remove the browser address bar (Digital Asset Links)
So the app opens truly full‑screen (a "Trusted Web Activity" instead of a Custom Tab):
1. Open PWABuilder's generated `assetlinks.json` (or run its "fingerprint" output) and copy
   the `sha256_cert_fingerprints` value.
2. Paste it into this project's **`public/.well-known/assetlinks.json`**, replacing
   `REPLACE_AFTER_bubblewrap_fingerprint`, and confirm the `package_name` matches.
3. Commit/redeploy. Next.js serves it at
   `https://<your-domain>/.well-known/assetlinks.json` automatically.

### Distribute the APK
- **Direct install (fastest):** send `app-release-signed.apk` to staff (email/WhatsApp/MDM).
  On the phone: Settings → allow "Install unknown apps" for the source → tap the APK →
  Install.
- **Google Play (public/managed):** upload the `.aab` to the Play Console.

### Updates are automatic
The APK is a thin wrapper that loads your **live** PWA, so when you redeploy the site, the
app updates itself — no re‑install, no new APK (unless you change the icon/name/package).

---

## Android — Bubblewrap (alternative, uses a terminal)

If you prefer a command‑line build, a Bubblewrap config is included at
[`../android/twa-manifest.json`](../android/twa-manifest.json):

```bash
npm i -g @bubblewrap/cli
cd android
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest
bubblewrap build      # -> app-release-signed.apk and app-release-bundle.aab
bubblewrap fingerprint  # copy SHA-256 into public/.well-known/assetlinks.json
```

See [`../android/README.md`](../android/README.md) for details and a native‑WebView option.

---

## Capability checklist (already satisfied by this project)

| Requirement | Status |
|---|---|
| Installable PWA (manifest, SW, offline) | ✅ built in |
| Maskable + full icon set (96–512), apple‑touch | ✅ `public/icons` |
| Store screenshots (narrow + wide) | ✅ `public/screenshots` |
| Android `.apk`/`.aab` from live URL (no terminal) | ✅ via PWABuilder |
| Full‑screen (no URL bar) | ✅ add fingerprint to `assetlinks.json` |
| Push notifications (Android + iOS 16.4+) | ✅ VAPID web‑push |
| Same login + 2FA in the app | ✅ loads the same site |
| Auto‑update on redeploy | ✅ TWA loads live PWA |
| Camera / file upload / downloads | ✅ inherited from the web app |

## Replace the placeholder screenshots (optional, nicer store listing)
The generated screenshots are branded placeholders. After deploying, take real screenshots of
the dashboard on a phone and a desktop, name them `mobile-1.png` (1080×1920) and
`desktop-1.png` (1920×1080), and drop them into `public/screenshots/` (overwrite), then
redeploy.
