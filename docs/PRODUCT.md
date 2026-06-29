# TLV Capital CRM — Product Requirements

**How to use this document:**
This is the business specification for the TLV Capital CRM. It is written in plain language and does not contain technical details. When something in the system needs to change, this document is updated first — the technical implementation follows from it.

---

## 1. Context

TLV Capital is a defense export company that connects international clients — primarily government ministries, defense agencies, defense integrators, and security organizations — with Israeli defense and technology companies. TLV Capital represents a portfolio of manufacturers and their products, and manages the full sales cycle from initial contact through to signed contract.

The CRM exists to:
- Give every Regional Sales Manager a clear, up-to-date view of their pipeline
- Give the Admin a complete picture across all regions and all deals
- Reduce reliance on spreadsheets and informal tracking
- Ensure no deal, contact, or follow-up falls through the cracks
- Serve as a reference for the team on the portfolio — products, services, and partner manufacturers

---

## 2. Users

There are three user roles: Admin, RSM, and Sector Manager. Every user is assigned exactly one role by an Admin.

### Admin
The Admin has full visibility into the entire business — all regions, all sectors, all deals, all financial data. Multiple people hold the Admin role. Admins are responsible for managing the system (adding users, assigning regions and sectors, maintaining the product catalog) and for oversight of the full pipeline. An Admin can create and edit any record on behalf of any RSM.

### RSM — Regional Sales Manager
An RSM manages all client relationships and opportunities within a specific geographic region. They are the primary day-to-day users of the system. An RSM creates and updates their own opportunities, logs every client interaction, and tracks their pipeline toward close.

RSMs do **not** see data from other regions. An RSM in one region cannot see which clients or deals another RSM is working on.

RSMs can see margin information on products. All roles can see margins — there is no margin restriction by role.

There are currently 4 RSMs. Regions currently in use: Baltics, Nordics, Balkan, LATAM, Israel, Asia. Regions are expected to change and expand. The Admin assigns RSMs to regions and can change region assignments at any time.

### Sector Manager
A Sector Manager is responsible for one or more business sectors within the portfolio. The current sectors are:

- Defense Export
- Homeland Security
- Cyber
- Manufacturing

Sectors are managed by Admins and new ones can be added at any time without disrupting the system. A Sector Manager has read-only access to the full product catalog, the full pipeline, and all contracts. They can create and edit contacts and activities. The Admin assigns managers to sectors and can change assignments at any time. The Admin can also configure individual Sector Managers to see only records in their assigned sectors if the business requires it in the future.

---

## 3. Glossary

These are the agreed terms used throughout the system. Everyone — users, documents, and the software itself — uses these exact words.

| Term | Definition |
|---|---|
| **Client** | A confirmed customer — an organization that has signed at least one contract with TLV Capital. A Client record is created when an Opportunity is Won. Before that point, the customer is referred to as a prospect and exists only as fields on the Opportunity. |
| **Deal** | A closed, won opportunity. Once a contract is signed, the Opportunity becomes a Deal and the prospect becomes a Client. |
| **Contact** | A specific person at a Client organization. A Client can have multiple Contacts. |
| **Manufacturer** | A company whose products TLV Capital represents and sells. Examples: CyberRidge, TATOOM, Sterlights. Also referred to as "Partner" in the context of a specific opportunity. |
| **Product** | A specific item from a Manufacturer that TLV Capital can sell. Products live in the Product Catalog. |
| **Opportunity** | A potential deal that is currently being pursued. An Opportunity belongs to one RSM and is scoped to one region. The prospect (potential customer) details live on the Opportunity itself until it is Won. |
| **Activity** | Any interaction with a client or contact — a call, meeting, email, site visit, or internal review. Activities are logged against an Opportunity, a Client, or a Contact. |
| **Contract** | A signed agreement between TLV Capital and a Client. A Contract record is created when an Opportunity is marked Won. |
| **Pipeline** | The full set of open Opportunities, typically viewed by stage. |
| **Region** | A geographic area managed by a single RSM. |
| **Sector** | A business domain that organizes the product catalog and Sector Manager responsibilities. The four sectors are: Defense Export, Homeland Security, Cyber, Manufacturing. |

---

## 4. Core Workflows

### 4.1 A New Opportunity Enters the Pipeline

An RSM creates the opportunity directly in the CRM, or imports it from a spreadsheet. The RSM is responsible for entering it into the system.

**Information known at the start (required at registration):**
- RSM (Account Manager)
- Region
- Country
- Stage (defaults to "New")
- Requirement Type — free text description of the type of requirement (e.g. C-UAS, Optronics, Maritime ISR)
- Sector — one of: Defense Export, Homeland Security, Cyber, Manufacturing
- Brief description of the requirement
- Prospect company name
- Lead source — one of: Cold Outreach, Partner, Inbound, Diplomatic, Marketing
- Registration date

**Prospect contact and classification (collected when available, not required at registration):**
- Prospect organization type — one of: Ministry of Defense, Defense Agency, Intelligence, Police/HLS, Government, Private, Other
- Prospect contact name
- Prospect website
- Prospect contact email
- Prospect contact phone
- Advisor support — one of: Manor, Doron, Nitzan, Ziv

**Information filled in over time:**
- Estimated deal value and currency
- Budget status (Not Yet Secured / Secured)
- Probability %
- Expected close date
- Products being offered — one or more lines, each with:
  - Product (linked from the Product Catalog, or a free-text name if not yet in the catalog — the two cannot both be blank)
  - Quantity (default 1)
  - Manufacturer (partner) contact name, email, and phone for this product line
  - Partner MNDA status — one of: Not Required / Pending / Sent / Signed (tracked per product line, since different manufacturers may be at different stages)
  - Optional notes specific to this product in this deal
- Next step (free text — updated by the RSM as the deal progresses)
- Special export license required (Yes / No flag)

### 4.2 Moving an Opportunity Through the Pipeline

An opportunity moves through the following stages. Stages can be skipped — there is no enforced order. Both the RSM who owns the opportunity and any Admin can change the stage.

1. **New** — Initial contact or interest, not yet qualified
2. **Qualified** — Confirmed there is a real opportunity worth pursuing
3. **Awaiting NDA** — *(Optional — for new clients only)* An NDA is required before proceeding
4. **Proposal Sent** — A formal proposal or offer has been submitted to the prospect
5. **Negotiation** — Terms are being discussed
6. **Awaiting License** — *(Optional)* A special export license is required before closing. Most deals will not reach this stage.
7. **Won** — Contract signed. A Client record and Contract record are created.
8. **Lost** — Deal did not proceed

A Won opportunity can be reopened by changing its stage back to an earlier stage (see §4.5 for the confirmation flow). A Lost opportunity can also be re-staged by the RSM or Admin if circumstances change — the same confirmation flow applies. Alternatively, a Lost opportunity can be re-engaged by creating a new Opportunity for the same prospect.

### 4.3 Logging an Activity

After any interaction with a client or contact, the RSM logs an Activity. An Activity records what happened. The types of activities are:

- Call
- Email
- Meeting
- Demo / Product Presentation
- Site Visit
- Internal Review

Each opportunity has a **Next Step** field — a single free-text field the RSM updates to describe what happens next. This is not part of the Activity log; it lives directly on the Opportunity.

### 4.4 Export Licenses

The company holds a universal export license that covers the majority of sales. This is managed entirely outside the CRM. In rare cases where a special license is required, the RSM or Admin can mark this on the opportunity using a simple Yes/No flag. No further license tracking happens in the CRM.

### 4.5 Closing a Deal (Won)

When an RSM marks an opportunity as Won, the RSM creates a Contract record capturing:
- Contract value
- Currency
- Signed date
- Expected delivery date

At this point, the system creates a Client record from the prospect details on the opportunity. The opportunity becomes a Deal.

A Contract can be flagged as at-risk after signing if there is a concern about delivery or payment. The RSM who owns the opportunity can toggle this flag; Admins can also toggle it. Contract terms (value, currency, dates) can only be edited by Admins — the RSM cannot modify them after the deal closes.

An open Opportunity can also be flagged as at-risk at any point before it is Won or Lost — for example, if the prospect goes quiet, a competing vendor appears, or the budget looks uncertain. The RSM or Admin can toggle this flag independently of the stage.

### 4.6 The Product Catalog

The Product Catalog contains all products from all Manufacturers that TLV Capital can sell. Products are organized by sector. The catalog is maintained by Admins only. RSMs and Sector Managers can browse and search the catalog but cannot edit it.

Catalog updates are routine — adding new products is a regular occurrence, not a special event. A single opportunity can include products from multiple manufacturers. There is no geographic enforcement on which products can be offered to which countries — this is handled outside the CRM.

The following are also Admin-configurable without any technical changes:
- **Pipeline stages** — Admins can add, rename, or reorder stages through the UI
- **Advisors** — Admins can add or deactivate advisors as the team changes
- **Sectors** — Admins can add new sectors as the business expands
- **Regions** — Admins can add new regions and deactivate existing ones as the territory expands

---

## 5. Business Rules

### Pipeline & Opportunities
- Every opportunity must have an owner (an RSM). An opportunity cannot exist without an assigned RSM.
- An RSM can only see opportunities in their own region.
- An Admin can reassign an opportunity to any RSM. If the new RSM is in a different region, the opportunity's region updates to match.
- If an RSM leaves the company, the Admin reassigns their opportunities to another RSM.

### Client Records
- A Client record only exists once a deal has been won. Before that, customer details live on the Opportunity.
- When a deal is Won, the system checks if a Client with the same name already exists in that region. If so, the won opportunity is linked to the existing Client — no duplicate is created.
- Clients belong to one region and do not span regions.
- RSMs cannot delete Client or Contact records. A client may have multiple deals across different RSMs over time, so deletion requires Admin action.

### Data Ownership
- An RSM can create and edit opportunities, activities, and contacts within their region.
- An RSM cannot edit another RSM's records.
- An Admin can create and edit any record.
- Deletion of clients and contacts is Admin-only.

### Financial Visibility
- All users — including RSMs — can see product margins and deal values.
- There are no financial figures currently restricted from any role.

---

## 6. What Each Role Can Do

### Admin
- Full access to all clients, contacts, opportunities, activities, and contracts across all regions and sectors
- Can create, edit, and delete any record
- Can create and edit opportunities on behalf of any RSM
- Manages the product catalog across all sectors (add, edit, deactivate products)
- Manages users (add users, assign roles, assign regions and sectors, deactivate accounts)
- Can view the full pipeline and reports across all RSMs and regions

### RSM
- Can see clients, contacts, and opportunities in their own region only
- Can create and edit clients, contacts, opportunities, and activities in their region
- Can update the stage and all details of their own opportunities
- Can log activities against their own opportunities and contacts
- Can browse the full product catalog (read only)
- Can see all financial data including product margins and deal values
- Cannot access another RSM's data
- Cannot delete clients or contacts
- Cannot manage users or edit the product catalog
- Can export their own pipeline data as a spreadsheet

### Sector Manager
- Can browse all opportunities (read only)
- Can browse the full product catalog (read only)
- Can see all contracts (read only)
- Can create and edit contacts and activities
- Cannot create or edit opportunities
- Cannot edit the product catalog
- Cannot manage users

---

## 7. Reporting & Visibility

### Admin Dashboard
- Total pipeline value by region
- Deal count by stage
- Recent activity across all RSMs
- Manually flagged at-risk deals
- Graph showing opportunities progression over time

### RSM Dashboard
- Their own pipeline by stage
- Deals with no recent activity (no activity logged in the last 30 days, excluding Won and Lost opportunities)
- Inactive contacts (no activity in the last 30 days)
- Manually flagged at-risk deals

### At-Risk
At-risk is a manual flag with two distinct contexts:

- **Open opportunity at-risk** — flagged by the RSM or Admin when an in-progress deal is in jeopardy (e.g. prospect silent, competitor appeared, budget uncertain). Toggled directly on the Opportunity.
- **Contract at-risk** — flagged by the RSM or Admin after a deal is Won, when there is a concern about delivery or payment. Toggled on the Contract.

The dashboards surface both: open at-risk opportunities and at-risk contracts appear as separate sections (or a combined list clearly labelled by type). There is no automatic at-risk calculation in the first version.

### External Reports
No reports are generated or sent outside the system.

---

## 8. Out of Scope (First Version)

- Accounting, invoicing, or payment tracking
- Email integration (sending emails from within the CRM)
- Calendar integration
- Automated outreach or sequences
- Customer support / ticketing
- Export license tracking beyond a simple Yes/No flag
- Automatic at-risk detection
- 90-day opportunity protection enforcement
