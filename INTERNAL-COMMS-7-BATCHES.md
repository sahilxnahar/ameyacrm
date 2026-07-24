# Ameya Heights CRM — secure internal communication (7 batches)

A complete internal-communication and cross-department workflow layer, built to be
**secure and permission-aware from the first line**. The point isn't just chat —
it's letting one department *get work done by another* with a clear trail: who
asked, who owns it, by when, and against which lead / booking / invoice.

It builds on what the CRM already has — departments, roles & permissions (RBAC),
the reporting hierarchy, tasks and approvals, the notifications bell, mail threads,
the audit trail and the Decision Log — so these batches extend the app rather than
bolt a separate tool beside it.

**One architecture note up front (affects every batch):** live chat needs a
real-time transport. The app runs on Vercel's serverless setup, which can't hold
open socket connections, so real-time delivery uses a hosted pub/sub channel
(e.g. a managed WebSocket/SSE service) with the database as the source of truth.
Batch 1 sets this up once; the rest build on it.

Ordered so each batch makes the next possible.

---

## Batch C1 — Foundation: secure direct & group messaging
**Purpose.** The core of everything — private 1:1 and small-group conversations
between staff, delivered in real time.

**What we build.**
- Models: `Conversation`, `ConversationMember`, `Message`, `MessageReceipt`
  (delivered/read), `MessageReaction`.
- Real-time delivery (the pub/sub transport above), with the database as the
  record of truth so nothing is lost if a client is offline.
- Text, mentions (`@person`), attachments, edit/delete with an edit trail, read
  receipts and typing indicators.
- **Security from the start:** every message access is checked against membership;
  no one can read a conversation they're not in, enforced server-side, not just
  hidden in the UI.

**Builds on.** Users & hierarchy, RBAC, the notifications bell.

---

## Batch C2 — Department channels & spaces
**Purpose.** Persistent places for teams to talk — a Sales channel, an Accounts
channel, a per-project space — instead of scattered DMs.

**What we build.**
- Models: `Channel` (department / project / topic scoped), `ChannelMember`,
  channel-level roles (owner, member, read-only).
- Public channels (anyone in the department can join) and private channels
  (invite-only), threaded replies, pinned messages.
- Auto-membership from department and reporting lines, so a new joiner lands in the
  right channels automatically.
- **Security:** channel visibility follows department and permission boundaries;
  a private Accounts channel is invisible to anyone without access.

**Builds on.** Departments, project scoping, C1's message core.

---

## Batch C3 — Inter-department work requests (handoffs)  ⭐ your example
**Purpose.** The flagship: "I need something done by another department" as a
*structured request*, not a message that gets lost. Raise it, the other team
accepts it, works it, and closes it — with a clear owner and deadline throughout.

**What we build.**
- Models: `WorkRequest` (from-department → to-department, title, detail, priority,
  due date, linked entity), `WorkRequestEvent` (status history), `WorkRequestComment`.
- A lifecycle: **Raised → Accepted → In progress → Done → Confirmed** (or Rejected /
  Sent back), each step recorded with who and when.
- **Link it to the work:** attach a request to the lead, booking, invoice or unit
  it's about, so context travels with it (e.g. "Legal: verify title for Plot 14",
  linked to that land parcel).
- **SLAs & ownership:** a due date, an owner on each side, and it turns into (or
  spawns) a task for the receiving team so it shows up in their queue.
- A per-department **inbox** of incoming requests and a view of what you've asked
  of others.
- **Security:** routing and visibility respect department boundaries and RBAC —
  you see requests to and from your department, not everyone's.

**Builds on.** Departments, tasks, approvals, the CRM entities themselves.

---

## Batch C4 — Announcements, acknowledgements & escalations
**Purpose.** Top-down and time-critical communication: notices everyone must see,
and automatic nudges when something isn't moving.

**What we build.**
- Models: `Announcement` (audience: company / department / role), `AnnouncementAck`
  (must-read sign-off), `EscalationRule`.
- Broadcasts with optional **read-acknowledgement**, so you can prove a policy or
  price change was seen.
- **Escalations:** when a work request or approval breaches its SLA, it escalates
  up the reporting line automatically and pings the right person.
- **Security:** audience targeting is permission-checked; a department notice never
  leaks outside its audience.

**Builds on.** Hierarchy (for escalation paths), C3 SLAs, notifications.

---

## Batch C5 — Unified notifications, presence & preferences
**Purpose.** One place for everything demanding attention, delivered how each
person wants it — without drowning them.

**What we build.**
- Models: `Notification` (extended), `NotificationPreference`, `PresenceStatus`.
- A single **inbox**: messages, mentions, work requests, approvals, announcements —
  all in one feed, with unread counts on the bell.
- Real-time in-app + optional push + an **email digest** for what you missed.
- **Presence** (online / away / do-not-disturb) and per-channel mute, so focus time
  is respected.
- **Security:** notification contents respect the same access checks — a preview
  never reveals something the person couldn't otherwise see.

**Builds on.** The existing notifications bell and `/api/notifications`, C1–C4.

---

## Batch C6 — Security, access control, retention & audit
**Purpose.** The "secure" in secure comms — the governance layer that makes this
safe to run in a regulated real-estate business.

**What we build.**
- **Who-can-talk-to-whom rules** (optional): restrict cross-department DMs, or
  require channels for certain topics, set by admins.
- **Encryption** in transit and at rest for message content and attachments.
- **Retention & legal hold:** configurable retention, and the ability to freeze a
  conversation for a dispute so it can't be edited or deleted.
- **Full audit:** every message, edit, deletion and work-request action already
  lands in the audit trail; this adds admin **oversight and export** for
  compliance, and moderation (flag/remove) with a reason.
- **Leak prevention:** guardrails on sharing outside the org, and clear marking of
  anything customer-visible vs internal-only.

**Builds on.** The audit trail, RBAC, C1–C5.

---

## Batch C7 — Comms ↔ CRM integration, search & knowledge
**Purpose.** Communication shouldn't be a silo. This ties it into the work and
makes it findable and reusable.

**What we build.**
- **Turn talk into action:** convert any message into a task or a work request in
  one click; discuss a lead / booking / invoice from a thread attached to that
  record, and see that thread on the record.
- **Universal search** across messages, channels, work requests and shared files —
  respecting permissions, so results never expose what you can't see.
- **Files & knowledge:** shared attachments obey the same document permissions;
  pin decisions and push them to the **Decision Log** so institutional memory
  isn't lost in a scroll.
- **Templates & quick replies** for common internal messages, reusing the existing
  template system.

**Builds on.** Tasks, CRM records, document permissions, the Decision Log,
global search.

---

## How to sequence & what it touches
- **Build order = the numbering.** C1 (messaging + real-time transport) is the
  foundation; C3 (work requests) is the piece you described and the biggest
  business win, but it leans on C1–C2. Security (C6) is designed *into* every batch
  from C1, and C6 is where the deeper governance (retention, legal hold, oversight)
  is completed.
- **If you want the business value fastest:** C1 → C3 delivers "message a colleague"
  and "get work done by another department" first; channels, announcements,
  notifications, governance and search follow.
- **What it touches:** each batch adds a few models and one idempotent migration.
  The real-time transport (C1) needs one external service configured; everything
  else runs on the existing stack.
- **Quality bar, as always:** 0 type errors, all tests, all verifier checks,
  production build clean — each shipped as its own version, with the SQL and the
  zip delivered separately.
