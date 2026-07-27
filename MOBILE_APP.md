# Ameya Heights CRM — native mobile apps

The CRM is a full PWA, so the fastest install is **Add to Home Screen** from the
browser (see the in-app `/install` page, and the Admin → Mobile App & Reminders
screen for the APK link and push coverage). For store-grade native apps there are
two wrappers, both of which load the live PWA — nothing is bundled, so the app
updates the instant you deploy.

## Android — Trusted Web Activity (recommended)

Folder: [`android/`](android/README.md). Google Bubblewrap turns the PWA into a
signed `.apk` / `.aab`. Full screen (no URL bar once Digital Asset Links are
verified via `public/.well-known/assetlinks.json`), inherits web-push, camera,
uploads and downloads. Best choice for the Play Store and sideloading.

## iOS (and cross-platform) — Capacitor

Folder: [`mobile/`](mobile/README.md). Wraps the same PWA for the **App Store /
TestFlight**, which TWA cannot do. Universal links use
`public/.well-known/apple-app-site-association`. Also builds Android if you want a
single project across both stores.

## Which to pick

| You want… | Use |
|---|---|
| Quickest install, no store | PWA “Add to Home Screen” (`/install`) |
| Android APK / Play Store | TWA (`android/`) |
| iOS App Store / TestFlight | Capacitor (`mobile/`) |
| One codebase for both stores | Capacitor (`mobile/`) |

Both wrappers reuse the CRM's existing sign-in, 2FA, sessions and VAPID web-push,
so there is no separate auth or notification system to maintain.
