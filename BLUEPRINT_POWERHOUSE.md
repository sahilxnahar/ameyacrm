# Ameya Heights CRM — Blueprint to a $600–1,000/month product

**Where you are today (v8.4):** 98 data models, 73 screens, 187 server actions,
32 API endpoints. Feature-for-feature you already beat Zoho and HubSpot on
real-estate depth, and you match Salesforce on everything except communications.

**What this document is:** three stages that take it from *a very good internal
system* to *a product other developers pay ₹50,000–85,000 a month for*.

---

## The honest framing first

At $600–1,000 a month you are not selling software. Zoho would give a ten-person
team the same nominal feature list for $140. What justifies seven times the price
is:

1. **It is built for Indian real-estate developers specifically** — nobody has to
   configure a "property" object or invent a construction-linked payment plan.
2. **It replaces four tools**, not one — CRM, collections, light ERP and the
   buyer portal.
3. **Someone answers the phone.** This is the part that is not code.

Stages 1 and 2 below are software. **Stage 3 is a business.** You can stop after
Stage 2 and have an extraordinary internal system. Only go to Stage 3 if you
actually want to run a software company alongside a construction company.

---

# STAGE 1 — Close the communications gap
### The last thing standing between you and every paid competitor
**Roughly 6–8 weeks · needs paid accounts · this is where the money is**

Everything here is a gap you genuinely have. None of it is padding.

### 1.1 Telephony and conversation intelligence
The AI half is **already written and idle** — recording in, Gemini out, with
budget, typology, timeline and sentiment extracted.

- Click-to-call from any lead, with automatic call logging
- Recording → transcript → structured extraction (built)
- **Talk-to-listen ratio, objection detection, coaching scorecards** per rep
- Missed-call auto-callback tasks
- IVR routing to the owning rep

*Needs:* Exotel or Knowlarity, roughly ₹0.50–1.20 per minute.
*Why it matters:* This is LeadRat's entire pitch. Your sales team lives on the phone.

### 1.2 WhatsApp Business API
- Two-way inbox inside the CRM, threaded on the lead
- Template broadcasts — brochures, demand notices, site-visit confirmations
- Automated journeys triggered by stage changes
- Click-to-WhatsApp ads landing straight in the CRM

*Needs:* Meta Cloud API — free tier, then roughly ₹0.10–0.80 per conversation.
*Why it matters:* In India this is the channel. Everything else is secondary.

### 1.3 Two-way email
You send; you do not receive. Missing half of every conversation.

- IMAP capture so replies thread onto the lead automatically
- Open and click tracking
- **Sequences** — multi-step follow-up that stops the moment someone replies
- Shared team inboxes for `sales@` and `nri@`

*Needs:* Nothing new — your existing Google Workspace.

### 1.4 Online payments
- Razorpay from the buyer portal, auto-receipt, ledger updates itself
- UPI autopay mandates for instalments
- Payment links inside WhatsApp and email

*Needs:* Razorpay, ~2% per transaction.
*Note:* You declined this before. For your own use, bank transfer is fine. For a
product you sell, buyers will expect it.

### 1.5 Portal integrations, properly
Beyond email parsing: official API feeds from 99acres, MagicBricks and Housing,
with listing sync pushing your inventory *out* as well as leads coming *in*.

*Needs:* Paid listing accounts you likely already have.

### 1.6 Scheduling
Two-way calendar sync, a public booking page for site visits, automated
reminders, and route planning for a day of visits.

**Stage 1 outcome:** every competitor's feature list is matched. Nothing a
prospect asks about gets a "not yet".

---

# STAGE 2 — Intelligence and scale
### What turns a good CRM into one people cannot leave
**Roughly 10–14 weeks · almost all pure build**

### 2.1 Predictive, not prompt-based
Today the AI reasons from a prompt. At scale it should learn from *your* history.

- **Booking-likelihood model** trained on your own won/lost record
- **Churn and drop-off prediction** — which buyer is about to cancel
- **Next best action** on every lead: who to call, what to say, why now
- **Deal risk scoring** on the pipeline — what will slip this month
- **Demand-based pricing** — suggest a floor-rise or facing premium from actual
  velocity, not a spreadsheet set in January

### 2.2 Revenue intelligence
- Pipeline waterfall — what moved, what slipped, what was created
- Cohort analysis by source, rep, campaign and typology
- Attribution across the whole journey, not just first touch
- Cash-flow forecast from the collections schedule
- Board pack generated monthly, automatically

### 2.3 Visual workflow canvas
The engine handles branching and SLAs already. What is missing is the canvas —
drag nodes, draw conditions, simulate a rule against real historical data before
it goes live. Non-technical ops staff should build automations without you.

### 2.4 Enterprise operations
- Territory management and lead-routing rules by geography and typology
- SLA management with escalation trees and breach reporting
- Approval matrices with delegation and out-of-office
- **Multi-entity consolidation** — several LLPs, one executive view
- Field-level permissions and record-level sharing rules
- Immutable audit log with legal-hold export

### 2.5 Collaboration
Presence, @mentions, comment threads on any record, internal notes distinct
from customer-facing ones, and a notification digest that respects working hours.

### 2.6 Search and data quality
Typo-tolerant search across every entity, semantic search over documents and
conversations, saved searches with alerts, plus continuous duplicate detection
and a data-health score.

### 2.7 Native mobile
The PWA is good. Native is better for site teams: true offline sync with conflict
resolution, camera-first snagging, background location for visit logging,
biometric login, and call-log integration that captures calls made outside the app.

**Stage 2 outcome:** switching cost. A competitor can copy a feature list; they
cannot copy two years of your conversion data feeding your own model.

---

# STAGE 3 — Turn it into a business
### Only if you actually want to run a software company
**Roughly 4–6 months · this is where the price tag is justified or lost**

### 3.1 Multi-tenancy
Every table gains a tenant boundary; every query is scoped; every file is
partitioned. This is invasive and must be done before the first paying customer,
not after. Retrofitting tenancy onto live customer data is the single most
expensive mistake in this business.

- Tenant isolation, per-tenant encryption keys, data residency
- White-label branding, custom domain per customer
- Self-serve onboarding with a sample dataset
- Per-tenant configuration without forking code

### 3.2 Commercials
- Subscription billing, plans, seats, usage metering, dunning
- Free trial with a guided setup, in-app upgrade prompts
- Usage analytics so you know who is about to churn

### 3.3 Enterprise-buyer requirements
Sold at ₹85,000 a month, procurement will ask for all of this:

- **SSO** — SAML and OIDC — plus **SCIM** user provisioning
- Configurable password and session policy per tenant
- Penetration test report, security questionnaire responses, a DPA
- **99.9% uptime SLA**, backed by a status page and real incident response
- Sandbox environment and a documented release cadence

### 3.4 The platform
- Public REST and GraphQL API with a developer portal and sandbox keys
- OAuth app framework so third parties can build on you
- Webhooks with retry and replay
- A genuine marketplace — because now there *are* other tenants to sell to

### 3.5 The part that is not software
This is what the price actually buys, and it is where most products fail:

- **A support desk with a response-time promise**, staffed by a person
- Onboarding and data migration as a service — most developers arrive with a
  decade of Excel
- Training, certification, a help centre
- A customer success motion for renewals
- A partner or reseller channel

### 3.6 Infrastructure it will need
Vercel Hobby and Neon Free do not survive contact with paying customers.

| Need | Roughly |
|---|---|
| Vercel Pro / Enterprise | $20–150/mo |
| Neon Scale, read replicas, PITR | $70–700/mo |
| Job queue and workers | $25–100/mo |
| Object storage and CDN | $20–200/mo |
| Monitoring, logs, uptime | $50–200/mo |
| Email and WhatsApp at volume | $100–500/mo |
| **Total to serve ~20 tenants** | **roughly $300–1,800/mo** |

At $800 a month per tenant, twenty tenants is $16,000/mo revenue against maybe
$1,200 of infrastructure. The margin is real. **The cost that breaks people is
support and engineering, not servers.**

---

## Sequencing, honestly

| | Do this | Because |
|---|---|---|
| **Now** | Import your data. Use it daily for a quarter. | Nothing below matters until the system is full. Ninety days of real use will change what you think Stage 1 should contain. |
| **Then** | Stage 1 | It closes the only genuine gap and pays for itself in leads that stop leaking. |
| **Then** | Stage 2, in the order 2.3 → 2.1 → 2.2 | Workflow canvas first: it removes you as the bottleneck for every small change. |
| **Only if you mean it** | Stage 3 | Ask yourself whether you want to be woken at 2am because another builder's CRM is down. |

## What I would cut

If this were mine, I would drop the following as expensive and rarely used:
GraphQL alongside REST, a third-party OAuth app framework before there is
demand, certification programmes, and data residency options before a customer
has actually asked. Each is months of work bought by a sales objection you can
usually answer with a sentence.

## The risk nobody prices in

**You are still the only person who can deploy this.** At Stage 1 that is a
worry. At Stage 3, with paying customers and an uptime promise, it is negligent.
A second engineer is a harder prerequisite than any feature on this list, and it
comes before Stage 3, not during it.
