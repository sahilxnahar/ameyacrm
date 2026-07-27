# Ameya Heights CRM — Capacitor shell (iOS & Android)

Trusted Web Activity (see `../android/`) is the recommended Android build. Use
**Capacitor** when you need an **iOS app** (TWA is Android-only) or a single
native project for both stores.

This shell does not bundle a copy of the app — it points at the deployed PWA
(`https://crm.ameyaheights.com`), so login, 2FA, sessions, camera, uploads,
downloads and web-push all keep working, and the app updates the moment you
deploy. The `www/` folder holds only a tiny redirect used before the remote URL
loads.

## Build

```bash
cd mobile
npm install

# iOS (needs a Mac + Xcode)
npm run add:ios
npm run open:ios         # opens Xcode → set your Team, then Product ▸ Archive

# Android
npm run add:android
npm run open:android     # opens Android Studio → Build ▸ Generate Signed Bundle/APK
```

After any config change: `npm run sync`.

## iOS universal links (open crm.ameyaheights.com links inside the app)

1. In Xcode, add the **Associated Domains** capability with
   `applinks:crm.ameyaheights.com`.
2. Replace `TEAMID` and `com.ameyaheights.crm` in
   `../public/.well-known/apple-app-site-association` with your Apple Team ID and
   bundle id. It is already served (no extension, `application/json`) at
   `https://crm.ameyaheights.com/.well-known/apple-app-site-association`.

## Push notifications

The CRM already uses VAPID web-push, which the TWA inherits for free. For the
Capacitor iOS app, register the APNs token from
`@capacitor/push-notifications` against the CRM's `PushSubscription` on sign-in.

## Which wrapper?

| Need | Use |
|---|---|
| Android APK / Play Store, least code | TWA (`../android`) |
| iOS App Store / TestFlight | Capacitor (this folder) |
| One project, both stores, native plugins | Capacitor |
