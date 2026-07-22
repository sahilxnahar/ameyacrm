# Turning on real-time (H2)

The whole software side is built and shipped. Chat messages and notifications
already update on their own — today by *polling* (checking every few seconds).
Real-time makes them **instant** and cuts the constant checking. It's the one
hardening item that needs a small outside piece switched on; until then the app
runs exactly as it does now.

## What it needs

A **realtime relay** — a small always-on service that browsers can hold an open
connection to. The app is serverless (Vercel), so it can't hold those
connections itself; the relay does. You have two options:

1. **A hosted pub/sub service** (e.g. an SSE/WebSocket provider). Easiest — no
   server to run.
2. **A tiny self-hosted SSE relay** (a small Node process on any always-on box).

Either way, the relay does two things: accepts a `POST` from the CRM saying
"channel X changed", and lets browsers **subscribe** to channel X over
Server-Sent Events (SSE).

## The three settings

Set these as environment variables in Vercel (never in the code, never in
GitHub):

| Variable | Where | What it is |
|---|---|---|
| `REALTIME_PUBLISH_URL` | Server | The relay's publish endpoint the CRM POSTs to. |
| `REALTIME_PUBLISH_TOKEN` | Server | *(optional)* A bearer token the relay checks, so only the CRM can publish. |
| `NEXT_PUBLIC_REALTIME_SSE_URL` | Browser | The relay's SSE endpoint browsers subscribe to. Must be reachable from users' browsers. |

That's it. The moment `NEXT_PUBLIC_REALTIME_SSE_URL` is set, browsers subscribe;
the moment `REALTIME_PUBLISH_URL` is set, the CRM publishes. **System Health →
Integrations** will show "Real-time: Connected" once both are in place.

## How it behaves

- **Publishes:** a new chat message publishes to `conversation:<id>`; a new
  notification publishes to `user:<id>`.
- **Subscribes:** an open conversation listens on `conversation:<id>`; the
  notification bell listens on `user:<id>` — and refreshes the instant an event
  arrives.
- **Safety net:** polling never goes away — it just slows to a gentle heartbeat
  (chat 30s, bell 2 min) when real-time is on, so even if the relay blips,
  nothing is ever missed. With no relay configured, polling stays at its normal
  pace and everything works exactly as before.
- **Fail-safe:** if publishing to the relay ever errors or times out, it's
  ignored — it can never slow down or break sending a message or raising an alert.

## The relay contract (if self-hosting)

- **Publish:** `POST {REALTIME_PUBLISH_URL}` with JSON body
  `{ "channel": "conversation:abc", "event": "message", "data": {} }` and (if set)
  header `Authorization: Bearer {REALTIME_PUBLISH_TOKEN}`.
- **Subscribe:** browser opens `EventSource({NEXT_PUBLIC_REALTIME_SSE_URL}?channel=conversation:abc)`
  and receives an SSE `message` whenever something is published to that channel.
  The event payload doesn't matter — any message on the channel triggers a fresh
  read from the database (the source of truth).

Tell me which relay/provider you want to use and I'll wire the exact adapter and
give you a ready-to-run relay if you're self-hosting.
