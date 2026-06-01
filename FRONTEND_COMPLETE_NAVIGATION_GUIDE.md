# ZAMMSA Frontend Complete Navigation Guide
## Role-Wise UI/UX Documentation for Code Agents

> **Purpose:** This document provides a complete picture of every section, view, list, and form in the ZAMMSA system, organized by user role. Use this to understand what's implemented and identify any gaps.
> 
> **Last Updated:** June 2026

---

# TABLE OF CONTENTS

1. [System Architecture Overview](#system-architecture-overview)
2. [Portal 1: Internal Staff Portal - All Roles](#portal-1-internal-staff-portal)
   - [R-01: User Department Staff](#r-01-user-department-staff)
   - [R-02: Department Head](#r-02-department-head)
   - [R-03: Procurement Officer](#r-03-procurement-officer)
   - [R-04: Procurement Manager](#r-04-procurement-manager)
   - [R-05: Evaluation Committee Member](#r-05-evaluation-committee-member)
   - [R-06: Evaluation Committee Chair](#r-06-evaluation-committee-chair)
   - [R-07: Finance Officer](#r-07-finance-officer)
   - [R-08: ZPC Member](#r-08-zpc-member)
   - [R-09: Director of Procurement](#r-09-director-of-procurement)
   - [R-10: Director General](#r-10-director-general)
   - [R-12: Contract Manager](#r-12-contract-manager)
   - [R-14: Auditor](#r-14-auditor)
   - [R-16: ZPPA Reporting Officer](#r-16-zppa-reporting-officer)
   - [R-17: Supplier Relationship Manager](#r-17-supplier-relationship-manager)
   - [R-18: Budget Controller](#r-18-budget-controller)
3. [Portal 2: Supplier Portal](#portal-2-supplier-portal)
4. [Portal 3: Public Portal](#portal-3-public-portal)
5. [Portal 4: System Admin Panel](#portal-4-system-admin-panel)

---

# SYSTEM ARCHITECTURE OVERVIEW

## Tech Stack
- **Frontend:** React 18 + TypeScript + React Router v6
- **State Management:** Redux Toolkit + React Query (TanStack)
- **UI Components:** Tailwind CSS + Headless UI + Heroicons
- **Charts:** Recharts
- **Forms:** Native HTML forms with controlled components
- **Layout:** Custom Sidebar + Header components

## Layout Components
- `DashboardLayout.tsx` - Internal portal layout (green accent)
- `VendorLayout.tsx` - Supplier portal layout (green accent)
- `AdminLayout.tsx` - Admin panel layout (orange accent)
- `PublicLayout.tsx` - Public portal layout
- `SupplierRelationsLayout.tsx` - Supplier relations layout

## Common Components Used
- `Sidebar.tsx` - Navigation sidebar with collapsible sections
- `DataTable.tsx` - Reusable table component
- `StatusBadge.tsx` - Status indicator badges
- `Pagination.tsx` - Pagination controls
- `SearchBar.tsx` - Search input component
- `PageHeader.tsx` - Page title with actions
- `StatCard.tsx` - Statistics display cards
- `ConfirmModal.tsx` - Confirmation dialogs

---

# PORTAL 1: INTERNAL STAFF PORTAL

**Layout:** `DashboardLayout.tsx`  
**Route Prefix:** `/` (root)  
**Accent Color:** `zammsa-green`  
**Brand:** "ZAMMSA PMS"

---

## R-01: USER DEPARTMENT STAFF

### Sidebar Navigation
```
├── Dashboard
├── Requisitions
│   ├── Create New
│   └── My Requisitions
└── Procurement Planning
```

### Dashboard (`/dashboard`)
**Component:** `DepartmentHeadDashboard.tsx` (shared with Dept Head)
**View Type:** Dashboard with stats and quick actions

**Sections:**
1. **Welcome Header**
   - User name and date display
   - Notification bell icon

2. **Quick Stats Cards**
   - My Draft Requisitions (count)
   - Pending Approval (count)
   - Approved This Month (count)
   - Rejected (count)

3. **Recent Activity Table**
   - Columns: Reference, Description, Status, Date, Actions
   - Actions: View, Edit (if draft)

4. **Quick Actions**
   - Create New Requisition button
   - View All Requisitions button

### Requisitions Section

#### List View (`/requisitions`)
**Component:** `RequisitionsList.tsx`
**View Type:** Data table with filters

**Features:**
- **Filters:**
  - Status filter (All, Draft, Submitted, Approved, Rejected)
  - Date range filter
- **Search:** By requisition number or description
- **Table Columns:**
  - Req Number (clickable link to detail)
  - Description
  - Department
  - Estimated Value (ZMW formatted)
  - Status (badge)
  - Date Submitted
  - Actions (View, Edit, Delete)
- **Actions:**
  - Create New button (visible for this role)
  - Export button
- **Pagination:** 10/25/50/100 per page

#### Create View (`/requisitions/create`)
**Component:** `RequisitionCreate.tsx`
**View Type:** Multi-step wizard form

**Step 1: Type & Basic Details**
- **Procurement Type Selection** (radio cards):
  - Goods (Items, medicines, supplies, equipment)
  - Consulting Services (Expert advice, studies, TOR-based)
  - Works (Construction, installation, renovation)
- **Form Fields:**
  - Description (textarea, required)
  - Department (dropdown, required)
  - Required Delivery Date (date picker, required)
  - Delivery Location (text input, required)
  - Funding Source (dropdown from master data, required)
  - Link to APP Line Item (dropdown, required)
  - Justification (textarea, required)

**Step 2: Line Items**
- **Add Item Button**
- **Line Item Table:**
  - Item Code (text)
  - Description (text, required)
  - Quantity (number, required)
  - Unit (text, required)
  - Estimated Unit Cost (number, required)
  - Commodity (dropdown)
  - ZAMRA Required (checkbox)
  - Remove button
- **Estimated Total Display** (auto-calculated)

**Step 3: Specifications**
- For each line item, show specification form:
  - Technical Standard / Reference (text, required)
  - Minimum Shelf Life (text, required)
  - Packaging Requirements (textarea, required)
  - Storage and Handling Conditions (textarea, required)
  - Quality and Certification Requirements (textarea, required)
  - Technically Neutral (radio: Yes/No)

**Step 4: Review & Submit**
- **Summary Display:**
  - All entered information in read-only format
  - Approval chain preview (You → Dept Head → Finance → DG → [ZPC if >K250K])
- **Confirmation Checkbox**
- **Actions:**
  - Save Draft button (saves without submitting)
  - Submit & Lock Budget button (submits for approval)

#### Detail View (`/requisitions/:id`)
**Component:** `RequisitionDetail.tsx`
**View Type:** Detail page with sections

**Sections:**
1. **Header Card**
   - Requisition number
   - Status badge
   - Created date
   - Created by

2. **Basic Information**
   - Description
   - Procurement type
   - Department
   - Required date
   - Delivery location
   - Funding source
   - APP line item
   - Justification

3. **Line Items Table**
   - Item code, description, quantity, unit, unit cost, total

4. **Specifications Accordion**
   - Expandable sections for each item's specifications

5. **Workflow Timeline**
   - Visual timeline showing approval progress
   - Each step shows: Approver, Date, Action, Comments

6. **Audit Log**
   - Chronological list of all actions

7. **Action Buttons** (based on status)
   - Edit (if draft)
   - Withdraw (if submitted)
   - Print/Export

#### Edit View (`/requisitions/:id/edit`)
**Component:** `RequisitionEdit.tsx`
**View Type:** Same as Create but pre-populated
**Restrictions:** Only available for draft requisitions

### Procurement Planning Section

#### APP List View (`/procurement-planning`)
**Component:** `APPList.tsx`
**View Type:** Data table with status filters

**Features:**
- **Status Filter Buttons** (showing counts):
  - Draft, Dept Head Review, Procurement Review, Director Review, ZPC Review, Approved, Published, Rejected
- **Fiscal Year Filter**
- **Table Columns:**
  - Department (with APP ID)
  - Fiscal Year
  - Status (badge)
  - Total Estimated Value
  - Submitted Date
  - ZPPA Registry Status (Published/Overdue/days left)
  - Date Created
- **Actions:**
  - Create Plan button (for authorized roles)
  - Row click navigates to detail

#### APP Detail View (`/procurement-planning/:id`)
**Component:** `APPDetail.tsx`
**View Type:** Detail page

**Sections:**
1. **Header**
   - APP reference number
   - Department
   - Fiscal year
   - Status badge

2. **Summary Stats**
   - Total line items
   - Total value
   - Approved items count

3. **Line Items Table**
   - Item description
   - Procurement method
   - Estimated value
   - Status

4. **Workflow Status**
   - Current approval stage
   - Approval history

---

## R-02: DEPARTMENT HEAD

### Sidebar Navigation
```
├── Dashboard
├── Requisitions
└── Procurement Planning
```

### Dashboard (`/dashboard`)
**Component:** `DepartmentHeadDashboard.tsx`
**View Type:** Dashboard with approval focus

**Sections:**
1. **Pending Approvals Card**
   - Count of requisitions awaiting approval
   - Quick action to view all

2. **Department Budget Utilization**
   - Budget allocated vs utilized
   - Percentage display

3. **Recent Approvals/Rejections**
   - List of recently processed items

### Requisitions Section

#### List View (`/requisitions`)
**Component:** `RequisitionsList.tsx`
**View Type:** Data table (same as R-01 but with approval actions)

**Additional Features for Dept Head:**
- **Filter by:** Requiring my approval
- **Actions per row:**
  - View details
  - Approve (opens approval modal)
  - Return for revision (opens modal with comment field)
  - Reject (opens modal with reason field)

#### Approval Modal
**View Type:** Modal dialog

**Fields:**
- Requisition summary (read-only)
- Approval comments (textarea)
- Action buttons: Approve, Return, Reject

### Procurement Planning Section
(Same as R-01 - view-only access)

---

## R-03: PROCUREMENT OFFICER

### Sidebar Navigation
```
├── Dashboard
├── Procurement Planning
│   ├── Annual Plans (APP)
│   └── Contract Plans (CPP)
├── Requisitions
├── Solicitations
│   ├── Create New
│   ├── Draft
│   ├── Pending Approval
│   ├── Published
│   ├── Closed
│   └── All Solicitations
├── Bid Management
│   ├── Bid Opening List
│   ├── Opening Setup
│   ├── Received Bids
│   ├── Minutes Archive
│   └── Late/Rejected Bids
├── Evaluation
│   ├── Active Evaluations
│   └── Post-Qualification
├── Contract Award
│   ├── Award Overview
│   ├── Award Notices
│   ├── Standstill Monitor
│   ├── Appeals
│   ├── Generate Contract
│   └── Performance Security
├── Suppliers
└── Reports
```

### Dashboard (`/dashboard`)
**Component:** `ProcurementDashboard.tsx`
**View Type:** Dashboard with tabs

**Tabs:**
1. **Dashboard Tab**
   - Stats cards (Requisitions awaiting action, Active solicitations, Bids closing, etc.)
   - Action Required section (highlighted items)
   - My Active Solicitations list
   - Closing Soon list
   - CPP Milestone Alerts table
   - Procurement Pipeline (stage progress bars)

2. **Requisitions Tab**
   - Table of requisitions ready for CPP creation
   - Columns: Req No, Description, Value, Action (Create CPP button)

3. **Solicitations Tab**
   - Create New button
   - Filters: Status, Department, Method
   - Search bar
   - Table: Sol No, Title, Method, Status, Closing, Actions

4. **Bids Tab**
   - Closing Today section (highlighted)
   - All Bid Openings table
   - Late/Rejected Bids list

5. **Award Tab**
   - Award Notices Pending table
   - Standstill Monitor table
   - Standstill Complete - Generate Contract table

### Solicitations Section

#### List View (`/solicitations`)
**Component:** `SolicitationsList.tsx`
**View Type:** Data table

**Features:**
- Filters: Status, Type, Date range
- Search
- Table columns: Reference, Title, Type, Status, Created, Actions
- Create button

#### Create View (`/solicitations/create`)
**Component:** `SolicitationCreate.tsx`
**View Type:** Multi-step wizard

**Step 1: Template Selection**
- Linked Requisition selector (dropdown)
- Template type: ITB, RFP, RFQ (radio cards)
- Submission format: Single/Two envelope

**Step 2: Solicitation Details**
- Auto-generated solicitation number
- Title, Description
- Department, Currency, Budget Code
- Estimated Value
- Issue Date, Closing Date/Time, Opening Date/Time
- Bid Validity (days)
- Pre-bid Conference Date/Venue
- Citizen Preference (Yes/No)

**Step 3: Evaluation Criteria**
- Mandatory Pass/Fail Criteria (add/remove/edit)
- Technical Scoring Criteria (add/remove/edit with weights)
- Minimum Technical Threshold

**Step 4: Bid Security**
- Required (Yes/No)
- Type: Bank Guarantee, Surety Bond, Cash
- Rate (% of bid value)
- Validity period

**Step 5: Documents & Publication**
- Mandatory clauses (auto-included)
- Specification documents (auto-linked)
- Additional documents (upload)
- Document fee (Yes/No with amount)
- Publication channels (checkboxes)

**Step 6: Review & Submit**
- Complete validation summary
- Confirmation checkbox
- Submit for Approval button

#### Detail View (`/solicitations/:id`)
**Component:** `SolicitationDetail.tsx`
**View Type:** Detail page with tabs

**Tabs:**
- Overview
- Evaluation Criteria
- Bids Received
- Evaluation Status
- Documents

### Bid Management Section

#### Bid Opening List (`/bids/opening`)
**Component:** `BidOpeningList.tsx`
**View Type:** Data table

**Columns:**
- Solicitation
- Bids Received count
- Opening Date/Time
- Status
- Actions (Conduct Opening)

#### Opening Setup (`/bids/opening/setup`)
**Component:** `OpeningSetup.tsx`
**View Type:** Form

**Fields:**
- Select solicitation
- Date and time
- Venue
- Attendees list
- Opening committee members

#### Bid Opening Ceremony (`/bids/opening/:solId`)
**Component:** `BidOpeningCeremony.tsx`
**View Type:** Interactive ceremony interface

**Features:**
- List of received bids
- Open technical proposals
- Record opening minutes
- Publish results

#### Received Bids (`/bids`)
**Component:** `BidsList.tsx`
**View Type:** Data table

**Columns:**
- Bid Reference
- Solicitation
- Bidder Name
- Submitted Date
- Status
- Actions (View, Download)

### Evaluation Section

#### Evaluations List (`/evaluations`)
**Component:** `EvaluationsList.tsx`
**View Type:** Data table

**Columns:**
- Solicitation
- Committee
- Stage
- Progress
- Actions

#### Committee Formation (`/evaluations/committee/formation`)
**Component:** `CommitteeFormation.tsx`
**View Type:** Form

**Fields:**
- Select solicitation
- Select committee members (multi-select)
- Designate chairperson
- Set evaluation timeline
- COI declaration requirement

**Sidebar access:**
- Procurement Manager: `Committee Formation`
- Director of Procurement: `Bid Evaluation -> Form EC Committee`
- Procurement Officer: no direct committee-formation menu; use the handoff flow from bid opening if available

### Contract Award Section

#### Award Overview (`/contracts/award-overview`)
**Component:** `AwardOverview.tsx`
**View Type:** Dashboard

**Sections:**
- Pending award notices
- Active standstill periods
- Ready for contract generation

#### Award Notices (`/contracts/award-notices`)
**Component:** `AwardNotices.tsx`
**View Type:** Data table

**Columns:**
- Solicitation
- Recommended Supplier
- Value
- Status
- Actions (Publish)

#### Standstill Monitor (`/contracts`)
**Component:** `StandstillMonitor.tsx`
**View Type:** Data table

**Columns:**
- Solicitation
- Standstill Start
- Expires
- Appeals Received
- Actions

#### Generate Contract (`/contracts/generate`)
**Component:** `ContractGeneration.tsx`
**View Type:** Form/Wizard

**Process:**
- Select completed standstill
- Review contract terms
- Generate contract document
- Send for signatures

---

## R-04: PROCUREMENT MANAGER

### Sidebar Navigation
```
├── Dashboard
├── Solicitations
├── Bid Management
│   ├── Bid Opening List
│   ├── Opening Setup
│   ├── All Bids
│   ├── Minutes Archive
│   └── Late/Rejected Bids
├── Committee Formation
├── Contracts
│   ├── All Contracts
│   ├── Award Overview
│   ├── Award Notices
│   ├── Standstill Monitor
│   ├── Appeals
│   ├── Generate Contract
│   └── Performance Security
└── Procurement Planning
```

### Dashboard (`/dashboard`)
**Component:** `ProcurementDashboard.tsx` (Director/Manager view)
**View Type:** Executive dashboard

**Sections:**
- Pending Approvals (count and list)
- Method Override requests
- Active Evaluation Committees
- Active Contracts count
- ZPPA Report Due indicator
- Pending My Approval table
- Procurement Health metrics
- Method Usage YTD chart
- Evaluation Committees table
- Compliance - Direct Bidding Log
- Procurement KPIs table

### Solicitations Section
- **Approval Workflow:** Review and approve solicitations created by Procurement Officers
- **View:** Same list as R-03 but with Approve/Return/Reject actions

### Bid Management Section
- **Oversight:** Monitor all bid opening activities
- **View:** Same as R-03

### Contracts Section
- **Approval:** Approve contract amendments
- **View:** Same as R-03 with additional approval actions

---

## R-05: EVALUATION COMMITTEE MEMBER

### Sidebar Navigation
```
├── Dashboard
├── My Evaluations
├── Declarations
└── Bid Documents
```

### Dashboard (`/dashboard`)
**Component:** `EvaluationDashboard.tsx`
**View Type:** Task-focused dashboard

**Sections:**
- Assigned Evaluations list
- Pending COI Declarations
- Upcoming Deadlines
- Quick access to bid documents

### My Evaluations (`/evaluations`)
**Component:** `EvaluationsList.tsx` (filtered for user)
**View Type:** Data table

**Features:**
- Only shows evaluations user is assigned to
- Access to scoring interface
- View bid documents

#### Technical Scoring (`/evaluations/:committeeId/scoring`)
**Component:** `TechnicalScoring.tsx`
**View Type:** Scoring form

**Features:**
- List of bids to evaluate
- For each bid:
  - Technical criteria with weights
  - Score input (0-100)
  - Comments field
- Submit scores button

### Declarations (`/evaluations`)
**Component:** `ConflictOfInterestDeclaration.tsx`
**View Type:** Form

**Fields:**
- Conflict of Interest declaration (Yes/No with explanation)
- Confidentiality agreement acknowledgment
- Submit button

---

## R-06: EVALUATION COMMITTEE CHAIR

### Sidebar Navigation
```
├── Dashboard
├── My Evaluations
├── Declarations
├── Post-Qualification
└── Bid Documents
```

### Additional Features (compared to R-05)

#### Post-Qualification (`/evaluations/post-qualification`)
**Component:** `PostQualification.tsx`
**View Type:** Verification form

**Features:**
- Verify bidder credentials
- Check ZRA/PACRA status
- Confirm ZAMRA registration
- Pass/Fail decision

#### BER Generation (`/evaluations/ber/:solId`)
**Component:** `BERWorkflow.tsx`
**View Type:** Report generation wizard

**Steps:**
1. Review all scores
2. Consolidate results
3. Generate BER document
4. Submit for approval

---

## R-07: FINANCE OFFICER (MFA Required)

### Sidebar Navigation
```
├── Dashboard
├── Finance
│   ├── Overview
│   └── Budgets
├── Invoices
│   ├── Invoice Queue
│   └── 3-Way Matching
├── Payments
│   ├── Payment Queue
│   └── Letters of Credit
├── Requisitions
├── Procurement Planning
└── Reports
```

### Dashboard (`/dashboard`)
**Component:** `FinanceDashboard.tsx`
**View Type:** Financial dashboard

**Sections:**
- Budget utilization overview
- Pending invoice approvals
- Payment queue status
- Upcoming payment deadlines
- Cash flow summary

### Finance Section

#### Overview (`/finance`)
**Component:** `FinanceDashboard.tsx`
**View Type:** Dashboard

**Widgets:**
- Budget vs Actual chart
- Encumbrance tracking
- Payment status summary

#### Budgets (`/finance/budgets`)
**Component:** `FinanceBudgets.tsx`
**View Type:** Data table

**Columns:**
- Department
- Budget Allocated
- Budget Utilized
- Encumbered
- Available
- Percentage Used

### Invoices Section

#### Invoice Queue (`/finance/invoices`)
**Component:** `FinanceInvoices.tsx`
**View Type:** Data table

**Columns:**
- Invoice Number
- Contract
- Supplier
- Amount
- Due Date
- Status
- Actions (Approve, Query, Reject)

#### 3-Way Matching (`/finance/matching`)
**Component:** `ThreeWayMatch.tsx`
**View Type:** Matching interface

**Features:**
- Select invoice
- View Purchase Order details
- View Goods Received Note
- Match status indicator
- Discrepancy handling

### Payments Section

#### Payment Queue (`/finance/payments`)
**Component:** `FinancePayments.tsx`
**View Type:** Data table

**Columns:**
- Payment Reference
- Invoice Number
- Supplier
- Amount
- Payment Method
- Status
- Actions (Process, Hold)

#### Letters of Credit (`/finance/letters-of-credit`)
**Component:** `FinanceLettersOfCredit.tsx`
**View Type:** Data table

**Columns:**
- LC Number
- Beneficiary
- Amount
- Expiry Date
- Status
- Actions

---

## R-08: ZPC MEMBER (MFA Required)

### Sidebar Navigation
```
├── Dashboard
├── ZPC Approvals
│   ├── BERs Pending
│   ├── APP Reviews
│   ├── CPP Non-Open Method
│   ├── Requisitions >K250K
│   └── Contract Amendments
├── ZPC Meeting
└── Approvals History
```

### Dashboard (`/dashboard`)
**Component:** `ZPCDashboard.tsx`
**View Type:** Approval-focused dashboard

**Sections:**
- Pending BERs count
- Pending APP Reviews
- Requisitions >K250K awaiting approval
- Upcoming ZPC Meeting date
- Recent approval history

### ZPC Approvals Section

#### BERs Pending (`/evaluations/zpc-approval`)
**Component:** `ZPCApproval.tsx`
**View Type:** Data table

**Columns:**
- BER Reference
- Solicitation
- Recommended Supplier
- Value
- Evaluation Summary
- Actions (Approve, Reject with comments)

#### APP Reviews (`/procurement-planning`)
**Component:** `APPList.tsx` (filtered for ZPC review)
**View Type:** Data table

**Actions:** Approve/Reject APP

#### CPP Non-Open Method (`/procurement-planning/cpp`)
**Component:** `CPPList.tsx` (filtered for non-open methods)
**View Type:** Data table

**Features:**
- Shows only CPPs with non-open procurement methods
- View justification documents
- Approve/Reject

#### Requisitions >K250K (`/requisitions`)
**Component:** `RequisitionsList.tsx` (filtered by value)
**View Type:** Data table

**Features:**
- Shows only high-value requisitions
- Full details view
- Approve/Reject

#### Contract Amendments (`/contracts`)
**Component:** `ContractsList.tsx` (filtered for amendments)
**View Type:** Data table

**Features:**
- Amendment requests requiring ZPC approval
- View amendment details
- Approve/Reject

---

## R-09: DIRECTOR OF PROCUREMENT (MFA Required)

### Sidebar Navigation
```
├── Dashboard
├── Approvals
├── Procurement Planning
│   ├── Annual Plans (APP)
│   └── Contract Plans (CPP)
├── Solicitations
├── Bid Evaluation
│   ├── Form EC Committee
│   ├── Active Evaluations
│   ├── Post-Qualification
│   └── BERs Awaiting ZPC
├── Contract Award
│   ├── Award Overview
│   ├── Award Notices
│   ├── Standstill Monitor
│   ├── Appeals
│   ├── Generate Contract
│   └── Performance Security
├── Compliance
└── Analytics
```

### Dashboard (`/dashboard`)
**Component:** `ProcurementDashboard.tsx` (Director view)
**View Type:** Strategic overview dashboard

**Sections:**
- Same as Procurement Manager view
- Additional strategic KPIs
- Compliance metrics
- Organization-wide analytics

### All Sections
- Full access to all procurement modules
- Approval authority at director level
- Override capabilities for method selection
- Compliance monitoring

---

## R-10: DIRECTOR GENERAL (MFA Required)

### Sidebar Navigation
```
├── Dashboard
├── My Approvals
│   ├── Requisitions
│   ├── Invoice Payments
│   └── Contract Signing
├── Executive Overview
│   ├── Procurement KPIs
│   ├── Budget Status
│   ├── Active Contracts
│   └── Supplier Performance
├── Contracts
└── Reports
```

### Dashboard (`/dashboard`)
**Component:** `DirectorGeneralDashboard.tsx`
**View Type:** Executive dashboard

**Sections:**
- Executive summary stats
- Pending approvals requiring DG action
- Organization-wide KPIs
- Budget status overview
- Active contracts summary
- Critical alerts

### My Approvals Section

#### Requisitions (`/requisitions`)
**Component:** `RequisitionsList.tsx` (filtered for DG approval)
**View Type:** Data table

**Features:**
- Requisitions requiring DG approval
- Full details view
- Approve/Reject with digital signature

#### Invoice Payments (`/finance/invoices`)
**Component:** `FinanceInvoices.tsx` (filtered for high-value)
**View Type:** Data table

**Features:**
- High-value payments requiring DG approval
- Payment details
- Approve/Reject

#### Contract Signing (`/contracts`)
**Component:** `ContractSigning.tsx`
**View Type:** Signing interface

**Features:**
- Contracts ready for DG signature
- View contract terms
- Digital signature capability
- Countersign after supplier signs

### Executive Overview Section

#### Procurement KPIs (`/reports`)
**Component:** `Reports.tsx`
**View Type:** Analytics dashboard

**Metrics:**
- Procurement efficiency
- Cost savings
- Citizen supplier participation
- Timeline adherence

#### Budget Status (`/finance/budgets`)
**Component:** `FinanceBudgets.tsx`
**View Type:** Budget dashboard

**Features:**
- Organization-wide budget overview
- Department-wise utilization
- Variance analysis

---

## R-12: CONTRACT MANAGER

### Sidebar Navigation
```
├── Dashboard
├── My Contracts
├── Milestones
├── Amendments
├── Liquidated Damages
├── Invoices & Payments
├── Supplier Performance
└── Contract Closure
```

### Dashboard (`/dashboard`)
**Component:** `ContractManagerDashboard.tsx`
**View Type:** Contract management dashboard

**Sections:**
- Active contracts count
- Upcoming milestones
- Overdue deliverables
- Pending amendments
- Supplier performance alerts

### My Contracts (`/contracts`)
**Component:** `ContractsList.tsx` (filtered for user's contracts)
**View Type:** Data table

**Columns:**
- Contract Number
- Title
- Supplier
- Value
- Start/End Dates
- Status
- Actions (View, Manage)

#### Contract Detail (`/contracts/:id`)
**Component:** `ContractDetail.tsx`
**View Type:** Detail page with tabs

**Tabs:**
- Overview
- Milestones
- Deliverables
- Payments
- Amendments
- Documents

### Milestones (`/contracts/milestones`)
**Component:** `MilestonesList.tsx`
**View Type:** Data table

**Columns:**
- Contract
- Milestone Description
- Due Date
- Status
- Days Remaining
- Actions (Update Status)

### Amendments (`/contracts/amendments`)
**Component:** `AmendmentsList.tsx`
**View Type:** Data table

**Columns:**
- Amendment Reference
- Contract
- Type
- Value Change
- Status
- Actions

#### Create Amendment (`/contracts/:id/amendments`)
**Component:** `ContractAmendments.tsx`
**View Type:** Form

**Fields:**
- Amendment type
- Description
- Value change
- Timeline change
- Justification
- Attachments

### Liquidated Damages (`/contracts/liquidated-damages`)
**Component:** `LiquidatedDamagesList.tsx`
**View Type:** Data table

**Columns:**
- Contract
- Delay Days
- LD Rate
- LD Amount
- Status
- Actions

#### Apply LD (`/contracts/:id/ld`)
**Component:** `LiquidatedDamages.tsx`
**View Type:** Form

**Fields:**
- Delay calculation
- LD rate application
- Amount computation
- Notification to supplier

### Supplier Performance (`/contracts/supplier-performance`)
**Component:** `SupplierPerformanceList.tsx`
**View Type:** Data table

**Columns:**
- Contract
- Supplier
- Performance Score
- Last Evaluation
- Status
- Actions (Evaluate)

#### Performance Evaluation (`/contracts/:id/performance`)
**Component:** `SupplierPerformanceEval.tsx`
**View Type:** Evaluation form

**Criteria:**
- Quality of deliverables
- Timeliness
- Communication
- Compliance
- Overall rating

### Contract Closure (`/contracts/closure`)
**Component:** `ContractClosureList.tsx`
**View Type:** Data table

**Columns:**
- Contract
- Completion Date
- Final Inspection
- Status
- Actions (Close)

#### Closure Checklist (`/contracts/:id/closure`)
**Component:** `ContractClosureChecklist.tsx`
**View Type:** Checklist form

**Items:**
- All deliverables completed
- Final inspection passed
- All payments processed
- Securities released
- Lessons learned documented

---

## R-14: AUDITOR

### Sidebar Navigation
```
├── Dashboard
└── (Read-only access to all modules)
```

### Dashboard (`/dashboard`)
**Component:** `AuditorDashboard.tsx`
**View Type:** Audit overview dashboard

**Sections:**
- Recent system activities
- Compliance alerts
- Audit findings summary
- Quick access to audit logs
- Exception reports

### Read-Only Access
- Can view all modules but no create/edit/delete buttons
- Export functionality available
- Audit trail viewer
- Comprehensive search across all data

---

## R-16: ZPPA REPORTING OFFICER

### Sidebar Navigation
```
├── Dashboard
└── Reports
```

### Dashboard (`/dashboard`)
**Component:** `ProcurementDashboard.tsx` (ZPPA view)
**View Type:** Compliance dashboard

**Sections:**
- ZPPA reporting deadlines
- Pending submissions
- Compliance status

### Reports (`/reports`)
**Component:** `Reports.tsx`
**View Type:** Report generator

**Features:**
- ZPPA compliance reports
- Procurement statistics
- Export to ZPPA format
- Scheduled reports

---

## R-17: SUPPLIER RELATIONSHIP MANAGER

### Sidebar Navigation (via SupplierRelationsLayout)
```
├── Dashboard
├── Vendor Applications
├── Vendors
└── Reports
```

### Dashboard (`/supplier-relations`)
**Component:** `SupplierRelationsDashboard.tsx`
**View Type:** Supplier management dashboard

**Sections:**
- Pending vendor applications
- Active suppliers count
- Supplier performance alerts
- Upcoming certifications expiry

### Vendor Applications (`/supplier-relations/vendor-applications`)
**Component:** `VendorApplications.tsx`
**View Type:** Data table

**Columns:**
- Company Name
- Application Date
- Category
- Status
- Actions (Review, Approve, Reject)

#### Application Review
**View Type:** Detail page with form

**Sections:**
- Company information
- Certifications
- Financial documents
- References
- Approval decision

### Vendors (`/supplier-relations/vendors`)
**Component:** `VendorManagement.tsx`
**View Type:** Data table

**Columns:**
- Company Name
- Registration Number
- Category
- Status
- Performance Rating
- Actions (View, Suspend, Debar)

---

## R-18: BUDGET CONTROLLER

### Sidebar Navigation
```
├── Dashboard
├── Finance
│   ├── Overview
│   └── Budgets
├── Invoices
│   ├── Invoice Queue
│   └── 3-Way Matching
├── Payments
│   ├── Payment Queue
│   └── Letters of Credit
├── Requisitions
├── Procurement Planning
└── Reports
```

### Dashboard (`/dashboard`)
**Component:** `FinanceDashboard.tsx` (Budget Controller view)
**View Type:** Budget governance dashboard

**Sections:**
- Total budget allocation
- Budget utilization by department
- Encumbrance tracking
- Budget variance alerts
- Upcoming budget reviews

### Finance Section
- Full access to all finance modules
- Budget approval authority
- Budget transfer capabilities
- Financial reporting

---

# PORTAL 2: SUPPLIER PORTAL

**Layout:** `VendorLayout.tsx`  
**Route Prefix:** `/vendor`  
**Accent Color:** `zammsa-green`  
**Brand:** "ZAMMSA Supplier"

### Sidebar Navigation
```
├── Dashboard
├── Open Tenders
├── My Bids
├── My Contracts
├── Invoices & Payments
└── My Profile
```

## Dashboard (`/vendor/dashboard`)
**Component:** `VendorDashboard.tsx`
**View Type:** Supplier dashboard

**Sections:**
- Active bids count
- Won contracts count
- Pending payments
- Notifications
- Quick actions

## Open Tenders (`/vendor/open-tenders`)
**Component:** `OpenTenders.tsx`
**View Type:** Data table

**Features:**
- Filter by category, value, closing date
- Search functionality
- Table columns: Reference, Title, Category, Value, Closing, Actions
- Action: View Details, Submit Bid

### Tender Detail (`/vendor/open-tenders/:id`)
**Component:** `VendorTenderDetail.tsx`
**View Type:** Detail page

**Sections:**
- Tender information
- Eligibility requirements
- Evaluation criteria
- Key dates
- Documents for download
- Submit Bid button

### Bid Submission (`/vendor/open-tenders/:id/bid`)
**Component:** `BidSubmission.tsx`
**View Type:** Multi-step wizard

**Step 1: Eligibility Confirmation**
- Confirm meeting mandatory criteria
- Upload required certificates

**Step 2: Technical Proposal**
- Upload technical documents
- Fill technical response forms

**Step 3: Financial Proposal**
- Enter pricing details
- Upload financial documents
- Bid security upload

**Step 4: Review & Submit**
- Review all information
- Digital signature
- Submit bid

## My Bids (`/vendor/bids`)
**Component:** `MyBids.tsx`
**View Type:** Data table

**Columns:**
- Bid Reference
- Tender
- Submitted Date
- Status (Submitted, Under Evaluation, Won, Lost)
- Actions (View)

### Bid Detail (`/vendor/bids/:id`)
**Component:** `BidDetail.tsx` (supplier view)
**View Type:** Detail page

**Sections:**
- Bid information
- Evaluation status
- Clarification requests
- Result notification

## My Contracts (`/vendor/contracts`)
**Component:** `MyContracts.tsx`
**View Type:** Data table

**Columns:**
- Contract Number
- Title
- Value
- Start/End Dates
- Status
- Actions (View)

### Contract Detail (`/vendor/contracts/:id`)
**Component:** `VendorContractDetail.tsx`
**View Type:** Detail page

**Sections:**
- Contract information
- Milestones
- Deliverables
- Payment schedule
- Documents

## Invoices & Payments (`/vendor/invoices`)
**Component:** `Invoices.tsx` (supplier view)
**View Type:** Data table

**Features:**
- Submit new invoice button
- View invoice status
- Payment history

### Submit Invoice
**View Type:** Form

**Fields:**
- Select contract
- Invoice number
- Invoice amount
- Invoice date
- Attach invoice document
- Attach delivery note/GRN

## My Profile (`/vendor/profile`)
**Component:** `VendorProfile.tsx`
**View Type:** Profile management

**Sections:**
- Company information
- Contact details
- Certifications
- Bank details
- Categories of supply

### Settings (`/vendor/settings`)
**Component:** `VendorSettings.tsx`
**View Type:** Settings page

**Features:**
- Change password
- Notification preferences
- Two-factor authentication

---

# PORTAL 3: PUBLIC PORTAL

**Layout:** `PublicLayout.tsx`  
**Route Prefix:** `/` (root, public pages)  
**Access:** Anonymous (no login required)

### Navigation
```
├── Home
├── Tenders
├── News
├── Notices
├── Events
├── GPN
├── FAQ
├── Contact
└── About
```

## Home (`/`)
**Component:** `Home.tsx`
**View Type:** Landing page

**Sections:**
- Hero banner
- Latest tenders (carousel)
- News highlights
- Quick links
- Statistics

## Tenders (`/tenders`)
**Component:** `TendersList.tsx`
**View Type:** Data table

**Features:**
- Filter by category, department, value
- Search
- Sort by date, closing date
- Pagination

### Tender Detail (`/tenders/:id`)
**Component:** `TenderDetail.tsx`
**View Type:** Detail page

**Sections:**
- Tender title and reference
- Procuring entity
- Description
- Key dates
- Eligibility requirements
- Evaluation criteria
- Documents for download
- Contact information

## News (`/news`)
**Component:** `NewsList.tsx`
**View Type:** List view

### News Detail (`/news/:id`)
**Component:** `NewsDetail.tsx`
**View Type:** Article view

## Notices (`/notices`)
**Component:** `NoticesList.tsx`
**View Type:** List view

### Notice Detail (`/notices/:id`)
**Component:** `NoticeDetail.tsx`
**View Type:** Detail view

## Events (`/events`)
**Component:** `EventsList.tsx`
**View Type:** Calendar/List view

## GPN (`/gpns`)
**Component:** `GPNListPublic.tsx`
**View Type:** List view

### GPN Detail (`/gpns/:id`)
**Component:** `GPNDetailPublic.tsx`
**View Type:** Detail view

## FAQ (`/faq`)
**Component:** `FAQ.tsx`
**View Type:** Accordion FAQ

## Contact (`/contact`)
**Component:** `Contact.tsx`
**View Type:** Contact form + info

## About (`/about`)
**Component:** `About.tsx`
**View Type:** Information page

---

# PORTAL 4: SYSTEM ADMIN PANEL

**Layout:** `AdminLayout.tsx`  
**Route Prefix:** `/admin`  
**Accent Color:** `zammsa-orange`  
**Brand:** "Admin Panel"  
**Access:** System Administrator only

### Sidebar Navigation
```
├── Dashboard
├── Users & Roles
│   ├── All Users
│   ├── Roles & Permissions
│   └── Departments
├── Vendors
│   ├── Applications
│   └── Approved Vendors
├── System
│   ├── System Health
│   ├── Settings
│   ├── Integrations
│   └── Backups
├── Planning Data
│   ├── Fiscal Years
│   ├── Commodities
│   └── Budget Allocations
├── Compliance
│   ├── Audit Logs
│   └── Governance
└── Reports
```

## Dashboard (`/admin`)
**Component:** `AdminDashboard.tsx`
**View Type:** System administration dashboard

**Sections:**
- System health indicators
- User activity metrics
- Recent admin actions
- System alerts
- Quick stats

## Users & Roles Section

### All Users (`/admin/users`)
**Component:** `UserManagement.tsx`
**View Type:** Data table with CRUD operations

**Features:**
- Create User button
- Export button
- Filters: Search, Role, Status
- Table columns: Name, Email, Role, Department, Status, Actions
- Actions: Edit, Reset Password, Suspend/Activate, View Audit

#### Create/Edit User Modal
**View Type:** Modal form

**Fields:**
- Full Name
- Employee ID
- Email
- Role (dropdown with all roles)
- Department
- Phone
- Create/Update button

#### Reset Password Modal
**View Type:** Confirmation modal

**Action:** Send password reset email

#### Audit History Modal
**View Type:** Modal with list

**Content:** Chronological audit trail for user

### Roles & Permissions (`/admin/roles`)
**Component:** `RoleManagement.tsx`
**View Type:** Role management interface

**Features:**
- List of roles
- Create/Edit role
- Assign permissions
- Role hierarchy

### Departments (`/admin/departments`)
**Component:** `DepartmentManagement.tsx`
**View Type:** Data table

**Features:**
- Department list
- Create/Edit department
- Assign department heads
- Hierarchy view

## Vendors Section

### Applications (`/admin/vendor-applications`)
**Component:** `VendorApplications.tsx`
**View Type:** Data table

**Features:**
- Pending applications
- Application details
- Approve/Reject actions
- Request additional information

### Approved Vendors (`/admin/vendors`)
**Component:** `VendorManagement.tsx`
**View Type:** Data table

**Features:**
- Vendor directory
- Vendor details
- Suspension/Debarment
- Performance ratings

## System Section

### System Health (`/admin/system-health`)
**Component:** `SystemHealth.tsx`
**View Type:** Monitoring dashboard

**Widgets:**
- Server status
- Database status
- API response times
- Error rates
- Resource utilization

### Settings (`/admin/settings`)
**Component:** `SystemSettings.tsx`
**View Type:** Settings form

**Sections:**
- General settings
- Email configuration
- Notification settings
- Security settings
- Workflow thresholds

### Integrations (`/admin/integrations`)
**Component:** `IntegrationMonitor.tsx`
**View Type:** Integration management

**Features:**
- ZPPA e-GP integration status
- Bank integrations
- ERP integration
- API keys management
- Integration health

### Backups (`/admin/backups`)
**Component:** `BackupManagement.tsx`
**View Type:** Backup management

**Features:**
- Backup schedule
- Manual backup trigger
- Backup history
- Restore functionality

## Planning Data Section

### Fiscal Years (`/admin/fiscal-years`)
**Component:** `FiscalYearManagement.tsx`
**View Type:** Data table

**Features:**
- Fiscal year list
- Create new fiscal year
- Set active fiscal year
- Lock/unlock periods

### Commodities (`/admin/commodities`)
**Component:** `CommodityManagement.tsx`
**View Type:** Data table

**Features:**
- Commodity list
- Create/Edit commodities
- Commodity hierarchy
- Import/Export

### Budget Allocations (`/admin/budget-allocations`)
**Component:** `BudgetAllocationManagement.tsx`
**View Type:** Data table

**Features:**
- Allocation by department
- Allocation by fiscal year
- Transfer allocations
- Track utilization

## Compliance Section

### Audit Logs (`/admin/audit-logs`)
**Component:** `AdminAuditLogs.tsx`
**View Type:** Audit log viewer

**Features:**
- Comprehensive activity log
- Filters: User, Date, Action
- Search
- Export logs

### Governance (`/admin/governance`)
**Component:** `GovernanceSettings.tsx`
**View Type:** Settings form

**Sections:**
- Approval thresholds
- Segregation of duties rules
- Compliance rules
- Policy settings

## Reports (`/admin/reports`)
**Component:** `AdminReports.tsx`
**View Type:** Report generator

**Reports:**
- User activity reports
- System usage reports
- Compliance reports
- Export functionality

---

# END OF DOCUMENTATION

This document provides a complete picture of every view, list, and form in the ZAMMSA system. Use this as a reference for:
1. Understanding what's implemented
2. Identifying gaps or missing features
3. Planning new development
4. QA testing
5. User training materials

**Total Views Documented:** 100+
**Total Forms Documented:** 50+
**Total Roles Covered:** 15+
