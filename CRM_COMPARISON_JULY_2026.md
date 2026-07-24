# Ameya Heights CRM vs the market — July 2026

Benchmarked against **Salesforce**, **Zoho CRM**, **HubSpot** and India's real-estate
specialist **LeadRat**. This replaces the earlier comparison; nearly everything that
was a gap then has since been built.

---

## Verdict

| Dimension | Where you stand |
|---|---|
| Real-estate depth (inventory, cost sheets, CLP collections, channel partners, buyer portal) | **Ahead** of all four |
| Core CRM (leads, pipeline, tasks, RBAC, audit) | **At parity** |
| Configurability (custom fields, saved views, report builder, nav layout) | **At parity** |
| AI (document Q&A, call analysis, lead scoring, reply drafting, briefings) | **Ahead** |
| Platform ops (API, backups, monitoring, DPDP, e-signature) | **At parity** |
| Communications (telephony, WhatsApp API, two-way email) | **Behind** — the last real gap |
| Marketplace, vendor support, third-party integrations | **Behind** — structural, not fixable by building |
| Cost | **₹0/user** vs $14–$300/user/month |

---

## 1. What you have that they do not

These need months of paid customisation on Salesforce or Zoho, and simply do not
exist in HubSpot:

- **Interactive inventory matrix** with token blocking and an auto-release timer
- **Visual floor-plan picker** — tap a flat on the actual plan and see its price
- **Dynamic cost sheet generator** → branded PDF in seconds
- **Construction-linked collections** with milestone demands and interest accrual
- **Channel-partner module** — RERA/KYC onboarding, 60-day lead lock, brokerage slabs
- **Buyer portal** with construction updates, document vault and snagging
- **ERP adjacency** — GST invoices, POs, vendor bills, material requests, approvals
- **Ask-your-documents** — RAG over every agreement, answered with the passage quoted
- **Self-hosted e-signature** with IP and timestamp stamped into the PDF
- **Offline field capture** — geo check-in that survives no signal
- **Full data ownership**, no per-seat licence, no vendor lock-in

> HubSpot is repeatedly noted as lacking real-estate specifics such as commission
> tracking. Salesforce reaches this shape only with enterprise budget and an admin.

## 2. What they have that you do not

**Telephony with AI call analysis.** LeadRat and Sell.Do are built around telecalling —
click-to-call, recording, auto-logging. *Your Gemini engine for this is already written
and idle.* It needs an Exotel or Knowlarity account and nothing else.

**WhatsApp Business API.** Two-way inbox and template broadcasts. Needs a Meta account
(free tier exists) — Meta, not Google, so your billing constraint does not apply.

**Portal integrations.** LeadRat pulls leads automatically from 99acres, MagicBricks and
Housing.com. You have the webhook to receive them; nobody is pushing yet.

**Two-way email.** You send; you do not capture replies onto the lead record.

**A marketplace and a support contract.** Zoho has hundreds of prebuilt integrations and
someone to ring at 2am. You have neither. This is the honest structural trade for
₹0/user and total control.

## 3. On price

| | Cost for 10 users |
|---|---|
| Salesforce (Sales Cloud Enterprise) | roughly ₹1.5–3 L per year |
| Zoho CRM (from $14/user/month) | roughly ₹1.4 L per year |
| HubSpot (paid tiers) | ₹2 L+ per year |
| LeadRat (from ₹1,500) | roughly ₹1.8 L+ per year |
| **Ameya Heights CRM** | **₹0** — hosting only |

## 4. The honest risk

This is a bespoke system with a single maintainer. You get zero licence cost and total
control; you give up vendor SLAs, guaranteed uptime and someone else's security patching.
Mitigated so far by: nightly backups, error monitoring with email alerts, a documented
runbook and an audit trail. Still needed: **a second person who can deploy.**

## 5. What to do next, in order

1. **Import your real data.** Nothing above matters while the system is empty.
2. **WhatsApp Business API** — free Meta tier, and it is where Indian buyers actually are.
3. **Telephony** — the expensive half is already built and waiting.
4. **Portal feeds** from 99acres and MagicBricks into your existing webhook.
5. **A second deployer** — the single biggest operational risk today.

---

### Sources
- [Best CRM for Real Estate Agents: 2026 Comparison Guide — CRMLenses](https://www.crmlenses.com/guides/best-crm-for-real-estate-agents-2026-comparison-guide/)
- [The 15 Best Real Estate CRM Software for 2026 — monday.com](https://monday.com/blog/crm-and-sales/crm-for-real-estate/)
- [Best CRM for Real Estate 2026: Top 5 Picks — Toolradar](https://toolradar.com/guides/best-crm-for-real-estate)
- [Leadrat CRM — Features & Pricing](https://leadrat.com/)
- [Leadrat CRM Pricing & Reviews 2026 — Techjockey](https://www.techjockey.com/detail/leadrat-crm)
- [Top 10 Real Estate CRM Software in India — PropTechBuzz](https://www.proptechbuzz.com/blog/top-10-real-estate-crm-software-in-india)
