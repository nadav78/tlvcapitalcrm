# Page & UX Specifications

Moved out of `docs/ARCHITECTURE.md` (which is `@`-imported into every session via CLAUDE.md) to keep the auto-loaded context small. **Read the relevant spec before building or changing a page** — layouts, columns, filters, and form presentation here are binding. CLAUDE.md rule 10 (Form Presentation) and rule 8's inline-editing carve-out are enforced against the tables in this file. See also `docs/UI-STANDARDS.md` for the craft bar any implementation must meet.

Contents: Navigation Structure (sidebar + mobile tab bar) · Form Presentation table · Feedback Pattern (toasts, inline errors, loading states, optimistic-update scope) · Table Defaults · Opportunity List (Pipeline) · Opportunity Detail Page · Dashboard Layouts (Admin + RSM) · Activity Logging · Client Detail Page · Product Catalog Page · Contacts Page

---

### Navigation Structure

#### Desktop: Left Sidebar

A persistent left sidebar (~240px) is visible on all authenticated pages. This is the universal CRM navigation pattern (Salesforce, HubSpot, Pipedrive) because a sidebar keeps the user oriented across the app without consuming vertical space.

Items, in order:
1. Dashboard
2. Opportunities
3. Clients
4. Contacts
5. Activities
6. Products
7. *(separator)*
8. Settings — **Admin only.** Hidden entirely from RSM and Sector Manager (not greyed out, just absent — a greyed-out item invites clicking and then confusion).

All other items are visible to all roles. Permissions within each page are enforced by RLS and component-level guards — the nav itself does not change per role beyond the Settings item.

Active item is highlighted. Each item shows an icon and a label. The sidebar does not collapse to icon-only — at the scale of this app (7 nav items) a full-width sidebar is not wasteful and icon-only sidebars require users to memorise icon meanings.

#### Mobile: Bottom Tab Bar

On mobile the sidebar is replaced by a bottom tab bar — the standard navigation pattern for iOS/Android and PWAs. The sidebar is still accessible by tapping a menu icon (top-left), which opens it as a slide-over sheet for less-frequent destinations (Products, Settings).

Bottom bar tabs (4 items — more than 5 becomes cramped and hard to tap):
1. **Dashboard** — daily check-in
2. **Opportunities** — primary RSM workflow
3. **Contacts** — the lookup RSMs do most on mobile, immediately before a call
4. **Activities** — the action RSMs do most on mobile, immediately after a call

Clients are navigable from the Opportunities and Contacts pages. Products and Settings are desktop tasks.

---

### Form Presentation

One consistent rule across the entire app:

| Situation | Pattern | Why |
|---|---|---|
| Creating a new Opportunity | **Full page** | 10+ fields across logical groups; rare enough that losing navigation context is acceptable |
| Editing an Opportunity, Client, or Contact | **Slide-over panel** (opens from the right) | The underlying detail page stays visible — the user never loses context of what they are editing |
| Focused action: Log Activity, Close Deal, confirm destructive action | **Modal** | 2–6 fields; enforces completion before returning to the page |
| High-frequency field: stage, next step, at-risk toggle | **Inline** | Opening a form for these fields would mean RSMs stop using them |

Never use a full page for an edit form. Never use a modal for a form with more than ~6 fields. The slide-over is the middle ground — it feels lighter than a page navigation but has enough space for a real form.

---

### Feedback Pattern

**Success:** Toast notification, bottom-right corner, 3-second auto-dismiss. Text is short and specific: "Opportunity updated." not "Your changes have been saved successfully."

**Error:** Inline, below the relevant field or at the top of the form. Never a toast for errors — toasts disappear before the user can read and act on them. If a Server Action returns an error, the form stays open and the error renders inline.

**Loading states:**
- Button: disabled + spinner while the mutation is in flight. The button label does not change — the spinner is sufficient.
- Initial page load: skeleton loaders (grey shapes matching the approximate layout) rather than a centred spinner. A skeleton tells the user what structure is coming; a spinner tells them nothing.

**No optimistic updates for multi-record mutations.** Closing a deal, reassigning an opportunity, and deleting a client/contact each write more than one record or trigger complex side effects (Client + Contract creation, contact linking, region reassignment). The UI confirms success from the server before updating for these — the loading state is fast enough (local Supabase → Vercel round-trip) that the cost of waiting is lower than the cost of a failed optimistic update that needs to unwind cleanly.

This is not a blanket rule against optimistic updates everywhere. Single-field mutations — a stage change, the `next_step` textarea, an `is_at_risk` toggle — are cheap to roll back (revert one field) and are exactly the fields the "Inline Editing for High-Frequency Fields" pattern below requires to feel instant. An optimistic update is a reasonable, deliberate choice for those; it just isn't the default and isn't used for anything that touches more than one record.

---

### Table Defaults (all entity list pages)

- **Default sort:** `updated_at DESC` — the most recently touched record appears first. RSMs return to the CRM mid-day and want to continue where they left off.
- **Row click:** navigates to the detail page. Inline expand is not used — detail pages contain too much information to show inline.
- **Pagination:** client-side, 25 rows per page. At current data volumes (dozens to low hundreds of records), client-side pagination is instant and avoids server-round-trip complexity.
- **Empty state:** helpful message + primary CTA. For Opportunities: *"No opportunities yet."* with a "New Opportunity" button. Never show an empty table with no explanation.

---

### Opportunity List (Pipeline)

Columns shown to all roles:

| Column | Notes |
|---|---|
| Company | `prospect_company_name` — clickable link to detail |
| Country | |
| Stage | Inline-editable badge (`InlineStageCell`) |
| Value | `estimated_value` + `currency`, formatted. Blank if not yet set. |
| Next Step | Inline-editable text (`InlineTextareaCell`), truncated to one line |
| Last Activity | Relative time ("3 days ago"). Rendered in red if > 30 days old and the stage is not Won or Lost. |

Admin-only additional columns (appended to the right):

| Column | Notes |
|---|---|
| RSM | Assigned RSM's full name |
| Region | |

**Filters** (rendered above the table, always visible — not hidden in a dropdown):
- **Search** — searches `prospect_company_name` and `country`, client-side, instant
- **Stage** — multi-select from active pipeline stages
- **At-risk** — toggle (show only flagged records)
- **Sector** — multi-select (Admin and Sector Manager only — RSMs are scoped to one sector via their opportunities)

**Default view:** no filters active, Won and Lost excluded. A "Show closed" toggle adds them to the results. RSMs rarely need to see closed deals while working their active pipeline.

---

### Opportunity Detail Page

This is the most-used page in the app. Layout: sticky header + single scrollable body. No tabs, no sidebar panel.

**Sticky header** (always visible, never scrolls away):
```
Meridian Defense Group                    [Proposal Sent ▾]  [⚠ At Risk]
LATAM · Defense Export · Colombia
```
- Company name: large, primary text
- Stage badge: inline editable (opens stage popover)
- At-risk toggle: directly in the header — one click, no form
- Region · Sector · Country: small secondary line

**Scrollable body sections** (in this order):

**1. Next Step**
Large inline-editable textarea, directly below the header. This is the RSM's working memory for the deal — what needs to happen next. It gets the most prominent position in the body because it is the field updated most often.

**2. Prospect Details**
Compact read display — not a field-by-field form readout. Shows organisation type, country, website (as a link), contact name/email/phone, lead source, advisor, registration date, probability %, expected close date, budget status. An Edit button opens a slide-over with the full edit form.

Before Win: `prospect_contact_name` renders as a mailto link if email is set.
After Win: prospect contact renders as a link to the now-created Contact record.

**3. Products**
Read mode: collapsed rows, each showing manufacturer name + product name + quantity. Clicking a row expands it to show manufacturer contact details and MNDA status. An Edit button opens the slide-over with the ProductPicker editor.

**4. Activities**
"Log Activity" button pinned to the top of this section. Below it: a chronological feed, newest first. Each item shows: type icon + subject + relative date + logged-by name. Clicking an item expands to show full notes.

**5. Contract** *(only visible when `is_won = true`)*
Contract value, currency, signed date, expected delivery date, at-risk toggle. Admin-only Edit button. RSMs see this section read-only and can only toggle at-risk.

---

### Dashboard Layouts

#### Admin Dashboard

**Row 1 — KPI cards (4 across):**
1. Total open pipeline value (sum of `estimated_value` across non-Won, non-Lost opportunities)
2. Open opportunity count
3. Won this quarter (count + total contract value)
4. At-risk count (open at-risk opportunities + at-risk contracts combined)

**Row 2 — Pipeline over time (full width, two charts side by side):**

Left chart — **Pipeline value by stage:** stacked area chart (Recharts) showing total estimated value of open opportunities, broken down by stage, by month, for the past 12 months. Each stage is a coloured band. Answers "how much is the pipeline worth, and where is value concentrated?"

Right chart — **Opportunity count by stage:** same stacked area format, Y-axis is deal count instead of value. Answers "how active is the team, and where are deals accumulating?" Useful for spotting bottlenecks (many deals stuck in Negotiation) independent of their monetary weight.

Both charts share the same stage colour scheme and X-axis (month). Code-split with `dynamic(() => import(...), { ssr: false })` — not loaded until an Admin views the dashboard.

**Row 3 — two columns:**
- Left: At-risk deals (table: company name, stage, RSM, days since last activity)
- Right: Deals by stage (horizontal bar chart: deal count per stage, ordered by `display_order`)

**Row 4 — Recent activity feed (full width):**
The 20 most recent activities logged across all RSMs. Each row: activity type icon, opportunity/client name, logged by, relative timestamp.

#### RSM Dashboard

**Row 1 — Pipeline by stage (cards, one per active non-terminal stage):**
Each card shows: stage name, deal count, total estimated value. Clicking a card navigates to the Opportunities list pre-filtered to that stage.

**Row 2 — two columns:**
- Left: Stale deals (no activity in 30+ days, open opportunities only — `last_activity_at < NOW() - INTERVAL '30 days'`)
- Right: At-risk deals (manually flagged open opportunities)

**Row 3 — Inactive contacts (full width):**
Table: contact name, client name, last activity date. Clicking a row navigates to the contact.

---

### Activity Logging

"Log Activity" appears in two places: pinned to the top of the Activities section on the opportunity detail page, and pinned to the top of the Activities section on the client detail page. Both open the same modal with `opportunity_id` or `client_id` pre-filled.

**Activity modal fields (in order):**
1. Type — segmented control or radio group: Call / Email / Meeting / Demo / Product Presentation / Site Visit / Internal Review
2. Date — date+time picker, defaults to now
3. Contact — optional select from contacts linked to this opportunity or client
4. Subject — short text
5. Notes — textarea

On submit: mutation fires, success toast appears, the new activity appears at the top of the feed without a page reload (TanStack Query cache invalidation).

---

### Client Detail Page

**Sticky header:** client name (large), status badge (active / inactive / former), region, organisation type, website as a link.

**Body sections:**

1. **Contacts** — list of contacts at this client, primary contact first. Each row: name, title, email, phone. "Add Contact" opens a slide-over. Edit and (Admin only) delete controls per row.
2. **Deals** — list of all won opportunities linked to this client. Columns: product(s), contract value, signed date, at-risk flag. Clicking navigates to the opportunity detail.
3. **Activities** — same timeline as on the opportunity detail page, scoped to this client.
4. **Notes** — the `notes` free-text field on the client record. Inline editable (click to edit, blur to save).

---

### Product Catalog Page

Table view (not a card grid — there are no product images in the schema, so a grid would just be labelled boxes).

**Columns:** Product name, Manufacturer, Category, Sector, Margin %, Active status.

**Filters:** Manufacturer (select), Sector (select), search by name / SKU / category.

"Add Product" button and row-level Edit visible to Admins only. Non-admin users see the table with no write controls — absent, not disabled.

---

### Contacts Page (standalone list)

RSMs see only contacts for clients in their region. Admins and Sector Managers see all.

**Columns:** Name, Title, Client, Email, Phone, Last Activity (relative, red if > 30 days).

**Default sort:** `last_activity_at DESC`.

**Row click:** opens a slide-over with the contact record (name, title, email, phone, is_primary toggle, notes, activity feed). Contact detail is simple enough that a full page is unnecessary.
