# ZAMMSA Procurement Management System — Full Lifecycle Walkthrough

> **Setup**: Dev server at `http://localhost:3000/`. Maximise browser window.
> **Recommended browser**: Firefox or Chrome.

---

## Phase 0 — Open Two Tabs

| Tab | Portal | User Role | Login |
|-----|--------|-----------|-------|
| **Tab 1** | **Internal Portal** (`/dashboard`) | **Procurement Officer** — John Procurement | `procurement.officer@zammsa.gov.zm` / `Test@123` |
| **Tab 2** | **Vendor Portal** (`/vendor/dashboard`) | **Supplier User** — David Supplier | `supplier@zammsa.gov.zm` / `Test@123` |

> Keep Tab 1 logged in as Procurement Officer throughout. Switch Tab 2 to other roles when noted.

---

## Phase 1 — Supplier Registration

**Portal**: 🌐 **Public Portal** (no login required) → then **Supplier Relations Portal** / **Admin Portal**

### Step 1.1 — Open the Registration Form

| | |
|---|---|
| **Portal** | 🌐 **Public Portal** (no login needed) |
| **User Role** | Guest / Unauthenticated visitor |
| **URL** | `http://localhost:3000/suppliers/register` |
| **Tab** | Tab 1 (no login needed for this) |

**Action**: The 5-step wizard appears. Click through each step tab (Account → Company → Contact/CEEC → Bank → Documents) to reveal the form fields — **do not fill or submit**.

**Script**: *"The procurement lifecycle starts even before a tender is published — it begins when a supplier submits their application through the public portal. Here we have a 5-step registration wizard.*

*Step 1 asks for account credentials — email and password.*
*Step 2 collects company information — business name, registration number with PACRA, TIN, business type, and years in operation. The PACRA number is validated in real time against the government registry.*
*Step 3 captures contact details and CEEC certification — this is critical because it determines preference categories: youth-owned, woman-owned, or PWD-owned businesses receive preferential margins during evaluation.*
*Step 4 handles bank details and commodity categories — the supplier selects what they want to supply, like pharmaceuticals, medical equipment, or consumables.*
*Step 5 is document upload — certificate of incorporation, tax clearance, NAPSA, CEEC certificate, and bank confirmation letter.*

*Every supplier that wants to do business with ZAMMSA must go through this process. Once submitted, the application moves to the Supplier Relations Manager for review."*

### Step 1.2 — View Pending Applications

| | |
|---|---|
| **Portal** | 🔒 **Supplier Relations Portal** (`/supplier-relations`) |
| **User Role** | **Supplier Relationship Manager** — Grace Supplier Relations |
| **Login** | `supplier.manager@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 2 (switch login) |

**Action**: After login, you land on the Supplier Relations dashboard. Click **Supplier Applications** in the sidebar to see the pending applications list. Show the table with status, review/approve/reject buttons.

**Script**: *"Once a supplier submits their application, it appears here in the Supplier Relations Manager's queue. Each application shows the company name, registration number, CEEC category, submission date, and current status.*

*The manager can click into any application to review the uploaded documents — checking that the certificate of incorporation matches the company name, the tax clearance is current, and the CEEC certificate is valid.*

*From the detail view, the manager can either approve the supplier — which activates them in the vendor master — or reject with a reason. Approved suppliers can now see tenders and submit bids. This is the first gate in the procurement process — only verified suppliers participate."*

### Step 1.3 — View Approved Supplier Detail

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** → **Suppliers** tab |
| **User Role** | **Supplier Relationship Manager** |
| **Tab** | Tab 2 (still logged in) |

**Action**: Sidebar → **Suppliers** (or `/suppliers`). Click on an approved supplier row to open `/suppliers/:id`.

**Script**: *"Here's the supplier master list — all approved vendors who can participate in tenders. Clicking into a supplier shows their full profile: company details, approved commodity categories, uploaded documents, and a complete audit trail showing when they registered, who approved them, and any subsequent updates.*

*This supplier is now active and will appear in bidder lists when solicitations are published. The system maintains a complete record of every supplier interaction from registration right through to contract completion."*

---

## Phase 2 — Internal Portal Dashboard

**Portal**: 🔒 **Internal Portal** (`/dashboard`)

**User Role**: **Procurement Officer** — John Procurement

| | |
|---|---|
| **Login** | `procurement.officer@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 1 |
| **URL** | `http://localhost:3000/dashboard` |

**Action**: Show the dashboard — stats cards showing pending requisitions, active solicitations, open bids, and active contracts.

**Script**: *"Now let's switch to the internal portal where procurement officers manage the full lifecycle. This is John Procurement's dashboard — the command centre for daily operations.*

*The dashboard gives a real-time overview: how many requisitions are pending approval, how many solicitations are active, how many bids have been received, and how many contracts are currently being executed.*

*From here, John can jump directly into any phase of the cycle. Let's start at the very beginning — procurement planning."*

---

## Phase 3 — Procurement Planning (APP / CPP)

**Portal**: 🔒 **Internal Portal** (`/dashboard`)

**User Role**: **Procurement Officer** — John Procurement

### Step 3.1 — View Annual Procurement Plans

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Procurement Planning** → **Annual Plans (APP)**.

**Script**: *"Everything in public procurement starts with the Annual Procurement Plan — the APP. By law, no procurement can happen without an approved APP in place.*

*Here we see the list of annual plans for different fiscal years. Each plan has a status — draft, submitted, approved — a total estimated value, and the responsible department.*

*The APP is the strategic document that answers: what are we buying, how much will it cost, and what procurement method will we use? It's approved by the entity head and forms the basis for all downstream activities."*

### Step 3.2 — View APP Detail

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Click any row to open `/procurement-planning/:id`.

**Script**: *"Drilling into a plan reveals the line items — each individual procurement. Here's one for antimalarial drugs. We can see the estimated cost, quantity, commodity classification, and the proposed procurement method — in this case, Open National Bidding.*

*The plan also shows budget allocation — how much funding is available versus what's been committed. This prevents over-commitment and ensures financial discipline from the start."*

### Step 3.3 — Open Create APP Form

| | |
|---|---|
| **User Role** | **Procurement Officer** (or Dept Staff — `staff@zammsa.gov.zm`) |

**Action**: Click **Create New** → `/procurement-planning/create`. Show the form fields but do not submit.

**Script**: *"Creating a new APP follows a structured template. The user selects the fiscal year, adds the department, and then adds line items one by one — each with a description, commodity classification, quantity, estimated unit price, and proposed procurement method.*

*The form enforces budget limits in real time — if the total exceeds the department's allocation, the system flags it immediately. This built-in control ensures plans are always within budget."*

---

## Phase 4 — Requisitions

**Portal**: 🔒 **Internal Portal**

**User Role**: **Procurement Officer** — John Procurement

### Step 4.1 — View Requisitions

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Requisitions**.

**Script**: *"With the plan approved, individual departments raise requisitions to trigger actual procurement. Here's the requisitions dashboard — every request for goods or services enters here.*

*Each requisition shows the request number, the department that raised it, the estimated total, and its current status in the approval workflow.*

*Requisitions don't go straight to procurement — they flow through an approval chain: first the Department Head, then Procurement, then Budget Controller, and for high-value items over K250,000, the Director General must also approve. This multi-layered approval ensures proper governance."*

### Step 4.2 — Open Create Requisition

| | |
|---|---|
| **User Role** | **Dept Staff** (switch Tab 1 to `staff@zammsa.gov.zm` to show, or just navigate) |

**Action**: Click **Create New Requisition** → `/requisitions/create`. Show the blank form layout.

**Script**: *"When a department needs something, they raise a requisition here. The form lets them add multiple line items — each with a description, quantity, estimated unit price, and delivery location. Specifications can be attached to each item to ensure suppliers know exactly what's required.*

*The form also captures the required delivery date, delivery location, and any special instructions. Once submitted, the approval chain kicks off automatically."*

### Step 4.3 — View Requisition Detail

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Click any requisition row.

**Script**: *"The detail page shows everything in one place: the requested items with their specifications, the approval timeline with who approved and when, budget check results showing whether funds are available, and any attached documents. This gives a complete audit trail for every procurement action."*

---

## Phase 5 — Solicitations (Tendering)

**Portal**: 🔒 **Internal Portal**

**User Role**: **Procurement Officer** — John Procurement

### Step 5.1 — View Solicitations

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Solicitations**.

**Script**: *"Once a requisition is approved, the next step is creating a solicitation — the formal tender document that goes to the market. Here are all our active solicitations.*

*Each one shows the solicitation number, the title of what we're buying, the procurement method — Open National Bidding, Limited Bidding, Request for Quotations — the current status, and the bid closing date.*

*The procurement method is determined by the estimated value and complexity of what we're buying. Lower-value items might use RFQ, while high-value strategic procurements use Open National or International Bidding."*

### Step 5.2 — Open Create Solicitation

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Click **Create Solicitation** → `/solicitations/create`. Show form fields without submitting.

**Script**: *"Creating a solicitation is where the procurement officer sets the rules of the competition. They select the procurement method, define the evaluation criteria with percentage weights — for example, technical criteria might be 70% and price 30% — and set the bid closing and opening dates.*

*The officer also attaches the bidding document — the full set of instructions, terms of reference, and contract conditions that suppliers will use to prepare their bids.*

*The solicitation is then published, and all registered suppliers in the relevant commodity categories receive notifications automatically."*

### Step 5.3 — View Solicitation Detail

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Click any solicitation row.

**Script**: *"The solicitation detail shows everything tied together: the originating requisition, the evaluation criteria and their weights, a timeline of key dates, and the published documents that suppliers can download. This is the single source of truth for each tender."*

---

## Phase 6 — Vendor: View & Submit Bids

**Portal**: 🔒 **Vendor Portal** (`/vendor/dashboard`)

**User Role**: **Supplier User** — David Supplier

### Step 6.1 — View Open Tenders

| | |
|---|---|
| **Portal** | 🔒 **Vendor Portal** (`/vendor`) |
| **User Role** | **Supplier User** — David Supplier |
| **Login** | `supplier@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 2 |

**Action**: Sidebar → **Open Tenders**. Show the list of published tenders.

**Script**: *"Now let's see the system from the supplier's perspective. David Supplier logs into the vendor portal and sees all open tenders that match his commodity categories.*

*Each tender shows the title, the procurement method, the bid closing date and time, and the status. Suppliers can view the full details and download bidding documents — all without any paperwork."*

### Step 6.2 — Open the Bid Submission Form

| | |
|---|---|
| **Portal** | 🔒 **Vendor Portal** |
| **User Role** | **Supplier User** |

**Action**: Click a tender → **Submit Bid** → `/vendor/open-tenders/:id/bid`. Show the bid form but do not submit.

**Script**: *"When a supplier is ready to bid, they open the submission form. It collects the financial proposal amount, the technical and financial documents as uploaded files, and the bid security details — bank guarantee, surety bond, or cash deposit.*

*The system validates that all required documents are attached and that the bid security meets the specified requirements before allowing submission. Once submitted, the system generates a unique receipt number and timestamp — this is critical proof of timely submission."*

### Step 6.3 — View Submitted Bids

| | |
|---|---|
| **Portal** | 🔒 **Vendor Portal** |
| **User Role** | **Supplier User** |

**Action**: Sidebar → **My Bids**.

**Script**: *"Suppliers can track all their bid submissions in one place — each with its status showing whether it's been submitted, opened during the ceremony, found responsive, or ultimately awarded. This gives complete visibility into where each bid stands in the process."*

---

## Phase 7 — Bid Management & Opening

**Portal**: 🔒 **Internal Portal** (`/dashboard`)

**User Role**: **Procurement Officer** — John Procurement (switch Tab 1 back)

### Step 7.1 — View Bid Opening Dashboard

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Bid Management** → **Bid Opening List** (`/bids/opening`).

**Script**: *"Back in the internal portal, the procurement team manages the bid opening process. The dashboard shows four key metrics: pending openings that need to be scheduled, scheduled sessions waiting for the appointed time, ones currently in progress — where bids are being opened live — and completed openings where minutes have been archived.*

*The list below shows each opening session with its solicitation, scheduled time, and current status. This gives the team complete control over the opening workflow."*

### Step 7.2 — Open Opening Setup

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Click **Setup Opening** → `/bids/opening/setup`. Click through the 3 steps without starting.

**Script**: *"Setting up a bid opening is a guided 3-step wizard. Step 1: select which solicitation's bids to open. Step 2: configure the session — date, time, location, witnesses who will observe the opening, and a public live stream link so suppliers can watch remotely. Step 3: review all the details and start the session.*

*This structured process ensures consistency and transparency — every opening follows the same procedure, records the same information, and is witnessed by independent observers."*

### Step 7.3 — View Completed Opening (Minutes)

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Sidebar → **Minutes Archive** (`/bids/opening/minutes`).

**Script**: *"Once an opening is complete, minutes are automatically generated. Each minute records the sequence of bids opened, the bidder names, the prices read aloud, bid security amounts verified, and any objections raised by witnesses.*

*Minutes can be viewed in the browser, downloaded as PDFs, or re-sent to stakeholders. This creates an irrefutable record of what happened during the opening — critical for audit and dispute resolution."*

### Step 7.4 — View Late / Rejected Bids

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Sidebar → **Late/Rejected Bids** (`/bids/late-rejected`).

**Script**: *"Bids received after the deadline — late bids — are tracked separately. The system automatically flags them. Here we also track non-responsive bids that didn't meet mandatory requirements, and withdrawn bids where the supplier pulled out.*

*This is important for audit compliance — the system maintains a complete record of every bid received and its disposition, even if it didn't proceed in the process."*

---

## Phase 8 — Bid Evaluation

**Portal**: 🔒 **Internal Portal**

**User Role**: **Procurement Officer** → **Evaluation Committee Chair** → **ZPC Member**

### Step 8.1 — View Active Evaluations

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Evaluation** → **Active Evaluations** (`/evaluations`).

**Script**: *"After bid opening, the evaluation phase begins. Here we see all solicitations currently under evaluation. The evaluation module manages the full lifecycle: committee formation, conflict of interest declarations, technical scoring, financial evaluation, and score consolidation.*

*Each step has its own workflow, signatures, and audit trail — ensuring the evaluation is fair, transparent, and defensible."*

### Step 8.2 — View Committee Formation

| | |
|---|---|
| **User Role** | **Procurement Officer** (or **Director Procurement** — `director@zammsa.gov.zm`) |

**Action**: Sidebar → **Committee Formation** → `/evaluations/committee/formation`. Show the form.

**Script**: *"Before evaluation can begin, an Evaluation Committee must be formally constituted. The form assigns a chairperson — who leads the evaluation — a secretary who handles documentation, and committee members who will score the bids.*

*Once formed, the committee's first action is to declare any conflicts of interest. Members with conflicts must recuse themselves. This governance layer is mandated by the Public Procurement Act and ensures impartiality."*

### Step 8.3 — View Post-Qualification

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Evaluation Committee Chair** (switch Tab 1 to `ecchair@zammsa.gov.zm`) |

**Action**: Sidebar → **Post-Qualification** (`/evaluations/post-qualification`).

**Script**: *"After evaluation, post-qualification verifies that the winning bidder can actually deliver. The system shows verification items — tax clearance, business registration with PACRA, ZPPA registration, financial capacity through audited accounts, and relevant experience.*

*Each item has a status: pending, cleared, or failed. Only bidders who clear all verification items proceed to award. This prevents awarding contracts to bidders who can't perform."*

### Step 8.4 — View ZPC Approval

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **ZPC Member** (switch Tab 1 to `zpc@zammsa.gov.zm`) |

**Action**: Sidebar → **ZPC Approval** (`/evaluations/zpc-approval`). Open the approve/reject modal but do not click.

**Script**: *"For high-value procurements, the Bid Evaluation Report must be submitted to the Zambia Public Procurement Authority — ZPC — for approval. Here Sarah ZPC can review the full evaluation summary: the scores, the recommendation, and any notes from the evaluation committee.*

*The review interface shows the complete evaluation outcome. ZPC can approve the recommendation, or reject it with a reason. This is the final oversight gate before a contract can be awarded — ensuring compliance with procurement regulations."*

---

## Phase 9 — Contract Award

**Portal**: 🔒 **Internal Portal**

**User Role**: **Procurement Officer** — John Procurement (switch Tab 1 back)

### Step 9.1 — View Award Overview

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Contract Award** → **Award Overview** (`/contracts/award-overview`).

**Script**: *"With ZPC approval secured, we move to contract award. The Award Overview dashboard shows the high-level state of all awards: how many are pending, how many have been awarded, and whether any are under appeal.*

*This is the transition point from evaluation to contract — the most critical handoff in the procurement cycle."*

### Step 9.2 — View Award Notices

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Sidebar → **Award Notices** (`/contracts/award-notices`).

**Script**: *"Once a decision is made, award notices are published to notify all bidders of the outcome. This fulfills the transparency requirements of the procurement act — every bidder has the right to know who won and why.*

*Published notices include the winning bidder, the contract value, and the basis for the award decision."*

### Step 9.3 — View Appeals

| | |
|---|---|
| **User Role** | **Procurement Officer** (or **ZPC Member**) |

**Action**: Sidebar → **Appeals** (`/contracts/appeals`).

**Script**: *"If a bidder is dissatisfied with the outcome, they can file an appeal. The appeals module tracks every dispute from filing through resolution. Each appeal records the grounds, supporting documents, and the final determination.*

*Appeals can be filed, under review, upheld — meaning the decision is overturned — or dismissed. This ensures due process and gives bidders a formal channel to challenge decisions."*

### Step 9.4 — Open Generate Contract

| | |
|---|---|
| **User Role** | **Procurement Officer** |

**Action**: Sidebar → **Generate Contract** (`/contracts/generate`). Show the form.

**Script**: *"Once any appeal period has passed, the contract is generated. The form selects the winning bid, sets the contract value — which should match the bid price — defines the start and end dates, and assigns a contract manager who will oversee execution.*

*The system generates the contract document and routes it for digital signing by both the supplier and the authorized ZAMMSA representative."*

### Step 9.5 — View Performance Security

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Procurement Officer** (or switch to **Contract Manager** — `contract@zammsa.gov.zm`) |

**Action**: Sidebar → **Performance Security** (`/contracts/performance-security`).

**Script**: *"Before a contract becomes active, the winning supplier must provide performance security — typically a bank guarantee worth 10% of the contract value. The Performance Security dashboard tracks all bonds and guarantees in one place.*

*The stats cards show: how many contracts require a bond but haven't provided one yet, how many have active bonds in place, how many are expiring within 30 days — highlighted in red — and how many have already expired.*

*Each row shows the bond amount, the issuing bank, and the expiry date. Colour coding alerts the contract manager when bonds need renewal — preventing lapses that could put the contract at risk."*

---

## Phase 10 — Contract Execution

**Portal**: 🔒 **Internal Portal**

**User Role**: **Contract Manager** — Patricia Contract (switch Tab 1 to `contract@zammsa.gov.zm`)

### Step 10.1 — View Contracts List

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Contract Manager** |
| **Login** | `contract@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 1 |

**Action**: Sidebar → **My Contracts** (`/contracts`).

**Script**: *"Once the contract is signed and performance security is in place, the contract becomes active and moves into the execution phase. Patricia Contract — our Contract Manager — sees all contracts she's responsible for.*

*Each one shows the contract number, supplier, value, and current status: active, completed, or closed. From here she can drill into any contract to manage its lifecycle."*

### Step 10.2 — View Contract Detail

| | |
|---|---|
| **User Role** | **Contract Manager** |

**Action**: Click any contract row.

**Script**: *"The contract detail page is the command centre for execution. It shows the contract value and dates, a timeline of milestones — with completed ones in green and pending ones with due dates — plus a history of amendments, linked performance security, and the supplier's performance rating.*

*From here, Patricia can manage every aspect of the contract: track milestones, process amendments, assess liquidated damages, and eventually close the contract."*

### Step 10.3 — View Amendments

| | |
|---|---|
| **User Role** | **Contract Manager** |

**Action**: `/contracts/:id/amendments`.

**Script**: *"During execution, changes sometimes need to be made — a scope change, a price adjustment due to inflation, or a timeline extension. Amendments handle all of this.*

*Each amendment records the reason for the change, the financial impact — showing whether the contract value increases or decreases — the variation percentage, and whether legal review was required. Both parties must digitally sign the amendment for it to take effect."*

### Step 10.4 — View Liquidated Damages

| | |
|---|---|
| **User Role** | **Contract Manager** |

**Action**: `/contracts/:id/ld`.

**Script**: *"If the supplier fails to deliver on time, liquidated damages are applied. The system calculates the damages automatically based on the number of days delayed and the contractual daily rate.*

*Damages can be assessed — meaning they've been calculated, waived — if the delay was justified, or applied — meaning the amount will be deducted from the next payment. This automated calculation ensures consistency and prevents disputes."*

### Step 10.5 — View Milestones

| | |
|---|---|
| **User Role** | **Contract Manager** |

**Action**: Contract detail page — scroll to milestones section.

**Script**: *"Milestones break the contract into manageable delivery phases. Each milestone has a name — like Initial Delivery or Final Acceptance — a due date, a status, and completion notes.*

*When a milestone is completed, Patricia marks it complete and records the delivery details. Milestones drive the payment schedule — typically, a percentage of the contract value is paid upon completion of each milestone."*

### Step 10.6 — View Closure Checklist

| | |
|---|---|
| **User Role** | **Contract Manager** |

**Action**: `/contracts/:id/closure`.

**Script**: *"When all the work is done, the contract doesn't just end — it must be formally closed. The closure checklist ensures nothing is missed: all deliverables received, final inspection passed, all payments processed, snagging items resolved, and performance security ready for release.*

*Every item must be checked off before the contract can be marked as closed. This prevents the common problem of contracts being left open indefinitely — creating contingent liabilities."*

---

## Phase 11 — Invoice & Payment

**Portal**: 🔒 **Internal Portal**

**User Role**: **Finance Officer** — Jane Finance (switch Tab 1 to `finance.officer@zammsa.gov.zm`)

### Step 11.1 — View Invoices

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Finance Officer** |
| **Login** | `finance.officer@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Finance** → **Invoices** (`/finance/invoices`).

**Script**: *"Now we reach the final phase — invoicing and payment. Jane Finance manages all supplier invoices here. The invoice dashboard shows every invoice with its current status: submitted, pending three-way matching, pending approval, approved for payment, paid, or rejected.*

*Each invoice is linked to its contract, so Jane can see the full context — what contract it relates to, what the PO value was, and whether goods were received. This connectivity prevents duplicate payments and ensures every invoice is legitimate."*

### Step 11.2 — Open Invoice Approval

| | |
|---|---|
| **User Role** | **Finance Officer** |

**Action**: Click a **Pending Approval** invoice → `/finance/invoices/:id/approval`. Show the approval interface without clicking approve.

**Script**: *"When an invoice reaches the approval stage, Jane sees the full detail: the invoice amount, the linked contract and PO, the goods receipt note confirming delivery, and the 3-way match result. She can see the approval route — whether it needs to go to the Department Head, the Director General, or if she can approve it herself.*

*The approve and reject buttons are right here. If she rejects, she must provide a reason — creating a clear audit trail. If she approves, the invoice moves to the payment queue."*

### Step 11.3 — View Three-Way Matching

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Finance Officer** (or **Budget Controller** — `bc@zammsa.gov.zm`) |

**Action**: Sidebar → **Invoice Matching** (`/finance/matching`).

**Script**: *"Before any invoice is paid, it must pass the three-way match — one of the most important controls in procurement. The system compares three documents:*

*First, the Purchase Order — what we ordered and at what price. Second, the Goods Received Note — what was actually delivered and in what quantity. Third, the Invoice — what the supplier is billing us for.*

*If all three match, the status is 'Complete Match' and the invoice can proceed. If there are discrepancies — like the invoice quantity doesn't match the GRN — it's flagged as 'Partial Match' or 'No Match' and must be resolved before payment. This prevents overpayment and detects fraud."*

### Step 11.4 — View Payments

| | |
|---|---|
| **User Role** | **Finance Officer** |

**Action**: Sidebar → **Payments** (`/finance/payments`).

**Script**: *"Once invoices pass matching and approval, they enter the payment queue. Jane can see all payments in the pipeline — how much is going out, to which supplier, by what payment method — electronic transfer or cheque — and whether the payment is processing or completed.*

*This gives finance complete control over cash flow and payment timing."*

### Step 11.5 — View Payment History

| | |
|---|---|
| **User Role** | **Finance Officer** |

**Action**: `/finance/payments` → scroll to payment history section.

**Script**: *"The payment history provides a complete audit trail — every payment that's been processed, who approved it, when it was paid, and the payment method. This is essential for financial audit, supplier reconciliation, and regulatory reporting to the Ministry of Finance."*

### Step 11.6 — View Letters of Credit

| | |
|---|---|
| **User Role** | **Finance Officer** |

**Action**: Sidebar → **Letters of Credit** (`/finance/letters-of-credit`).

**Script**: *"For high-value or international procurements, Letters of Credit are often used instead of direct payment. The system tracks each LC — its type, whether sight or deferred, the amount, the issuing bank, the beneficiary, its current status, and the expiry date.*

*The system alerts finance before an LC expires — ensuring that either the supplier is paid or the LC is extended, preventing disruptions in the supply chain."*

---

## Phase 12 — Reports & Close

**Portal**: 🔒 **Internal Portal**

**User Role**: **Director Procurement** — Alice Director (switch Tab 1 to `director@zammsa.gov.zm`)

### Step 12.1 — View Reports

| | |
|---|---|
| **Portal** | 🔒 **Internal Portal** |
| **User Role** | **Director Procurement** |
| **Login** | `director@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 1 |

**Action**: Sidebar → **Reports** (`/reports`).

**Script**: *"To close the loop, let's look at reporting and analytics. Alice Director — our Director of Procurement — sees aggregated data across the entire procurement portfolio.*

*The reports show procurement volume by method, spending by department, supplier performance ratings, and average processing times from requisition to payment. All reports can be exported as PDF or Excel for regulatory submissions to ZPPA and the Ministry of Finance.*

*This visibility enables data-driven decision-making — identifying bottlenecks, measuring supplier performance, and ensuring the procurement function is delivering value for money."*

---

## Phase 13 — Admin Panel (Quick Recap)

**Portal**: 🔒 **Admin Portal** (`/admin`)

**User Role**: **System Administrator** (switch Tab 2 to `admin@zammsa.gov.zm`)

### Step 13.1 — Admin Overview

| | |
|---|---|
| **Portal** | 🔒 **Admin Portal** (`/admin`) |
| **User Role** | **System Administrator** |
| **Login** | `admin@zammsa.gov.zm` / `Test@123` |
| **Tab** | Tab 2 |

**Action**: Navigate to `/admin`. Show Dashboard → **Users & Roles** → **Vendors** → **Audit Logs**.

**Script**: *"Finally, the admin panel ties the entire system together. The System Administrator can manage:*

*Users and Roles — every user account with granular, role-based permissions. Each role controls exactly what the user can see and do.*

*Vendor Applications — the same approval queue the Supplier Relations Manager uses, but with full system access.*

*Audit Logs — every single action in the system is logged: who did what, when, and from which IP address. This meets the highest standards of public financial management and audit compliance.*

*Fiscal Years — setting the current fiscal year controls which budgets are active.*

*And System Configuration — threshold rules, preference margins, and notification templates that drive the entire procurement engine.*

*This completes the full lifecycle — from a supplier submitting a registration form on the public portal, all the way through to invoice payment and contract closure — all within a single, integrated, auditable system."*

---

## Navigation Cheat Sheet

### Login Credentials by Portal

| Portal | Role | Email | Password | Default Landing |
|--------|------|-------|----------|-----------------|
| 🌐 Public | Guest (no login) | — | — | `/` |
| 🔒 Internal | Procurement Officer | `procurement.officer@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Director Procurement | `director@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Procurement Manager | `pm@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Evaluation Chair | `ecchair@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | ZPC Member | `zpc@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Contract Manager | `contract@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Finance Officer | `finance.officer@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Budget Controller | `bc@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Director General | `dg@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Dept Head | `dept.head@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Internal | Dept Staff | `staff@zammsa.gov.zm` | `Test@123` | `/dashboard` |
| 🔒 Vendor | Supplier User | `supplier@zammsa.gov.zm` | `Test@123` | `/vendor/dashboard` |
| 🔒 Supp. Relations | Supp. Relations Manager | `supplier.manager@zammsa.gov.zm` | `Test@123` | `/supplier-relations` |
| 🔒 Admin | System Admin | `admin@zammsa.gov.zm` | `Test@123` | `/admin` |

### Quick Reference by Phase

| Phase | Portal | User Role(s) | Key URLs |
|-------|--------|--------------|----------|
| 1. Supplier Registration | Public → Supp. Relations → Internal | Guest → Supp. Relations Mgr | `/suppliers/register`, `/supplier-relations/vendor-applications`, `/suppliers/:id` |
| 2. Internal Dashboard | Internal Portal | Procurement Officer | `/dashboard` |
| 3. Procurement Planning | Internal Portal | Procurement Officer | `/procurement-planning`, `/procurement-planning/create` |
| 4. Requisitions | Internal Portal | Procurement Officer / Dept Staff | `/requisitions`, `/requisitions/create`, `/requisitions/:id` |
| 5. Solicitations | Internal Portal | Procurement Officer | `/solicitations`, `/solicitations/create`, `/solicitations/:id` |
| 6. Vendor Bids | Vendor Portal | Supplier User | `/vendor/open-tenders`, `/vendor/open-tenders/:id/bid`, `/vendor/bids` |
| 7. Bid Opening | Internal Portal | Procurement Officer | `/bids/opening`, `/bids/opening/setup`, `/bids/opening/minutes`, `/bids/late-rejected` |
| 8. Evaluation | Internal Portal | PO → EC Chair → ZPC Member | `/evaluations`, `/evaluations/committee/formation`, `/evaluations/post-qualification`, `/evaluations/zpc-approval` |
| 9. Contract Award | Internal Portal | Procurement Officer → Contract Manager | `/contracts/award-overview`, `/contracts/award-notices`, `/contracts/appeals`, `/contracts/generate`, `/contracts/performance-security` |
| 10. Execution | Internal Portal | Contract Manager | `/contracts`, `/contracts/:id`, `/contracts/:id/amendments`, `/contracts/:id/ld`, `/contracts/:id/closure` |
| 11. Invoice & Payment | Internal Portal | Finance Officer → Budget Controller | `/finance/invoices`, `/finance/invoices/:id/approval`, `/finance/matching`, `/finance/payments`, `/finance/letters-of-credit` |
| 12. Reports | Internal Portal | Director Procurement | `/reports` |
| 13. Admin | Admin Portal | System Admin | `/admin`, `/admin/users`, `/admin/vendor-applications`, `/admin/audit-logs` |

---

*End of walkthrough guide. Each step includes: which **portal** and **user role** to use, and a full **script** of what to say while demonstrating.*
