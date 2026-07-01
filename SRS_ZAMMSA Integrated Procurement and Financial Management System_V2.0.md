## **UNDP Zambia, ZAMMSA Office, Lusaka** 

## **SOFTWARE REQUIREMENT SPECIFICATION (SRS)** 

## **on** 

# **ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM** 

## **SUBMITTED TO** 

UNDP Zambia Date: 10/03/2026 (March 10, 2026) 

## **SUBMITTED BY** 

## **Dream71 Bangladesh Ltd.** 

House No 16 (level 5) Block A, Basundhara R/A, Dhaka 1229 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

**==> picture [468 x 611] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|Table of Contents|
|REVISIONS HISTORY|.............................................................................................................................. 9|
|APPROVALS|.............................................................................................................................................. 9|
|DOMAIN EXPERT LIST & COMMUNICATION DETAILS|................................................................. 9|
|RESPONSE TO CLIENT FEEDBACK MATRIX|................................................................................ 10|
|1. INTRODUCTION|................................................................................................................................. 11|
|1.1 Purpose ........................................................................................................................................... 11|
|1.2 Scope .............................................................................................................................................. 11|
|1.3 Document Organization ................................................................................................................ 11|
|1.4 Target Audience............................................................................................................................. 11|
|2. OVERALL DESCRIPTION ................................................................................................................. 12|
|2.1 User Roles ...................................................................................................................................... 12|
|2.2 Assumptions ................................................................................................................................... 12|
|2.3 Dependencies ................................................................................................................................ 13|
|2.4 Constraints ...................................................................................................................................... 13|
|3. IMPLEMENTATION PHASING STRATEGY ................................................................................................. 14|
|3.1 Phase 1: Core Procurement ........................................................................................................ 14|
|3.2 Phase 2: Enhanced Capabilities ................................................................................................. 14|
|3.3 Phase 3: Advanced Analytics & Optimization ........................................................................... 15|
|4. MODULE 1: USER AND ACCESS MANAGEMENT ...................................................................... 16|
|4.1 Objective ......................................................................................................................................... 16|
|4.2 Actors .............................................................................................................................................. 16|
|4.3 Preconditions .................................................................................................................................. 16|
|4.4 Postconditions ................................................................................................................................ 16|
|4.5 Functional Requirements ............................................................................................................. 16|
|4.6 Business Rules .............................................................................................................................. 18|
|4.7 Data Requirements ....................................................................................................................... 18|
|4.8 Validation Rules ............................................................................................................................. 19|
|4.9 Exception Handling ....................................................................................................................... 19|
|4.10 Workflow / Process Flow ............................................................................................................ 19|
|4.10.1 User Onboarding Workflow .................................................................................. 19|
|4.10.2 Conflict of Interest Declaration Workflow ........................................................... 20|

**----- End of picture text -----**<br>


Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

4.10.3 Account Lockout Workflow ................................................................................... 21 4.11 Relationships ................................................................................................................................ 21 4.12 Audit Requirements ..................................................................................................................... 21 4.13 Compliance References ............................................................................................................. 22 5. MODULE 2: PROCUREMENT PLANNING ..................................................................................... 23 5.1 Objective ......................................................................................................................................... 23 5.2 Actors .............................................................................................................................................. 23 5.3 Preconditions .................................................................................................................................. 23 5.4 Postconditions ................................................................................................................................ 23 5.5 Functional Requirements ............................................................................................................. 23 5.7 Data Requirements ....................................................................................................................... 25 5.8 Validation Rules ............................................................................................................................. 25 5.9 Workflow / Process Flow .............................................................................................................. 25 5.9.1 Annual Procurement Plan (APP) Creation and Approval Workflow ................. 25 5.9.2 Contract Procurement Plan (CPP) Creation Workflow....................................... 27 5.10 Relationships ................................................................................................................................ 28 5.11 Audit & Compliance Requirements ........................................................................................... 28 5.12 Compliance References ............................................................................................................. 28 6. MODULE 3: REQUISITION AND SPECIFICATION MANAGEMENT ......................................... 29 6.1 Objective ......................................................................................................................................... 29 6.2 Actors .............................................................................................................................................. 29 6.3 Preconditions .................................................................................................................................. 29 6.4 Postconditions ................................................................................................................................ 29 6.5 Functional Requirements ............................................................................................................. 29 6.6 Business Rules .............................................................................................................................. 31 6.7 Data Requirements ....................................................................................................................... 31 6.8 Workflow / Process Flow .............................................................................................................. 31 6.8.1 Requisition Creation and Approval Workflow ....................................................... 31 6.8.2 Requisition Amendment Workflow ......................................................................... 33 6.9 Relationships .................................................................................................................................. 33 6.10 Audit & Compliance Requirements ........................................................................................... 33 

Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

6.11 Compliance References ............................................................................................................. 34 7. MODULE 4: METHOD OF PROCUREMENT SELECTION ......................................................... 35 7.1 Objective ......................................................................................................................................... 35 7.2 Actors .............................................................................................................................................. 35 7.3 Preconditions .................................................................................................................................. 35 7.4 Postconditions ................................................................................................................................ 35 7.5 Functional Requirements ............................................................................................................. 35 7.6 Business Rules .............................................................................................................................. 36 7.7 Workflow / Process Flow .............................................................................................................. 37 7.7.1 Method of Procurement Selection Workflow ........................................................ 37 7.7.2 Preference Scheme Application Workflow (During Evaluation) ........................ 38 7.8 Relationships .................................................................................................................................. 38 7.9 Audit & Compliance Requirements ............................................................................................. 38 7.10 Compliance References ............................................................................................................. 39 8. MODULE 5: SOLICITATION DOCUMENT MANAGEMENT ........................................................ 40 8.1 Objective ......................................................................................................................................... 40 8.2 Actors .............................................................................................................................................. 40 8.3 Preconditions .................................................................................................................................. 40 8.4 Postconditions ................................................................................................................................ 40 8.5 Functional Requirements ............................................................................................................. 40 8.6 Business Rules .............................................................................................................................. 41 8.7 Workflow / Process Flow .............................................................................................................. 41 8.7.1 Solicitation Creation and Publication Workflow ................................................... 41 8.7.2 Addendum Issuance Workflow ............................................................................... 43 8.8 Relationships .................................................................................................................................. 44 8.9 Audit & Compliance Requirements ............................................................................................. 44 8.10 Compliance References ............................................................................................................. 44 9. MODULE 6: BID MANAGEMENT ..................................................................................................... 45 9.1 Objective ......................................................................................................................................... 45 9.2 Actors .............................................................................................................................................. 45 9.3 Preconditions .................................................................................................................................. 45 

Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

9.4 Postconditions ................................................................................................................................ 45 9.5 Functional Requirements ............................................................................................................. 45 9.6 Business Rules .............................................................................................................................. 46 9.7 Workflow / Process Flow .............................................................................................................. 46 9.7.1 Bid Submission Workflow ....................................................................................... 46 9.7.2 Public Bid Opening Workflow ................................................................................. 47 9.8 Relationships .................................................................................................................................. 48 9.9 Audit & Compliance Requirements ............................................................................................. 48 9.10 Compliance References ............................................................................................................. 48 10. MODULE 7: BID EVALUATION ...................................................................................................... 50 10.1 Objective ....................................................................................................................................... 50 10.2 Actors ............................................................................................................................................ 50 10.3 Preconditions ............................................................................................................................... 50 10.4 Postconditions .............................................................................................................................. 50 10.5 Functional Requirements ........................................................................................................... 50 10.6 Business Rules ............................................................................................................................ 51 10.7 Workflow / Process Flow ............................................................................................................ 51 10.7.1 Bid Evaluation (QCBS) Workflow ........................................................................ 51 10.8 Relationships ................................................................................................................................ 53 10.9 Audit & Compliance Requirements ........................................................................................... 53 10.10 Compliance References ........................................................................................................... 54 11. MODULE 8: CONTRACT AWARD AND MANAGEMENT .......................................................... 55 11.1 Objective ....................................................................................................................................... 55 11.2 Actors ............................................................................................................................................ 55 11.3 Preconditions ............................................................................................................................... 55 11.4 Postconditions .............................................................................................................................. 55 11.5 Functional Requirements ........................................................................................................... 55 11.6 Business Rules ............................................................................................................................ 56 11.7 Workflow / Process Flow ............................................................................................................ 57 11.7.1 Contract Award and Execution Workflow ........................................................... 57 11.7.2 Contract Amendment Workflow............................................................................ 58 

Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

11.8 Relationships ................................................................................................................................ 59 11.9 Audit & Compliance Requirements ........................................................................................... 59 11.10 Compliance References ........................................................................................................... 59 12. MODULE 9: FINANCIAL TRACKING AND BUDGET CONTROL ............................................. 60 12.1 Objective ....................................................................................................................................... 60 12.2 Actors ............................................................................................................................................ 60 12.3 Preconditions ............................................................................................................................... 60 12.4 Postconditions .............................................................................................................................. 60 12.5 Functional Requirements ........................................................................................................... 60 12.6 Business Rules ............................................................................................................................ 61 12.7 Workflow / Process Flow ............................................................................................................ 61 12.7.1 Invoice Processing and Payment Workflow....................................................... 61 12.7.2 Budget Encumbrance Workflow .......................................................................... 63 12.8 Relationships ................................................................................................................................ 64 12.11 Audit & Compliance Requirements ........................................................................................ 64 12.12 Compliance References ........................................................................................................... 64 13. MODULE 10: SUPPLIER PERFORMANCE MANAGEMENT ...................................................................... 65 13.1 Objective ....................................................................................................................................... 65 13.2 Actors ............................................................................................................................................ 65 13.3 Preconditions ............................................................................................................................... 65 13.4 Postconditions .............................................................................................................................. 65 13.5 Functional Requirements ........................................................................................................... 65 13.6 Business Rules ............................................................................................................................ 66 13.7 Workflow / Process Flow ............................................................................................................ 66 13.7.1 Supplier Registration Workflow ............................................................................ 66 13.7.2 Supplier Performance Evaluation Workflow ...................................................... 68 13.8 Relationships ................................................................................................................................ 68 13.9 Audit & Compliance Requirements ........................................................................................... 69 13.10 Compliance References ........................................................................................................... 69 14. MODULE 11: PREDICTIVE ANALYTICS AND REPORTING ................................................... 70 14.1 Objective ....................................................................................................................................... 70 

Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

14.2 Actors ............................................................................................................................................ 70 14.3 Preconditions ............................................................................................................................... 70 14.4 Postconditions .............................................................................................................................. 70 14.5 Functional Requirements ........................................................................................................... 70 14.6 Business Rules ............................................................................................................................ 71 14.7 Workflow / Process Flow ............................................................................................................ 72 14.7.1 Automated Archiving Workflow ............................................................................ 72 14.8 Relationships ................................................................................................................................ 73 14.9 Audit & Compliance Requirements ........................................................................................... 73 14.10 Compliance References ........................................................................................................... 73 15. MODULE 12: SYSTEM INTEGRATION ........................................................................................ 74 15.1 Objective ....................................................................................................................................... 74 15.2 Actors ............................................................................................................................................ 74 15.3 Preconditions ............................................................................................................................... 74 15.4 Postconditions .............................................................................................................................. 74 15.5 Functional Requirements ........................................................................................................... 74 15.6 Business Rules ............................................................................................................................ 76 15.7 Workflow / Process Flow ............................................................................................................ 76 15.7.1 Budget Validation Integration Workflow (Synchronous) ................................... 76 15.7.2 WMS Goods Receipt Webhook Workflow (Event-Driven) ............................... 77 15.8 Relationships ................................................................................................................................ 77 15.8 Audit & Compliance Requirements ........................................................................................... 77 15.9 Compliance References ............................................................................................................. 77 16. NON-FUNCTIONAL REQUIREMENTS ......................................................................................... 79 16.1 Performance Requirements ....................................................................................................... 79 16.2 Availability Requirements ........................................................................................................... 79 16.3 Security Requirements ............................................................................................................... 79 16.4 Scalability Requirements ............................................................................................................ 80 16.5 Operational Requirements ......................................................................................................... 80 16.6 Usability Requirements ............................................................................................................... 80 17. APPENDICES .................................................................................................................................... 81 

Dream71 Bangladesh Limited                         Confidential 

Page | 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Appendix A: Requirement Count Summary ..................................................................................... 81 Appendix B: Module-to-Requirement Mapping Matrix .................................................................... 82 Appendix C: Module-to-Manual DI Mapping .................................................................................... 82 Appendix D: External System Integration Summary ...................................................................... 82 Appendix E: Reference Documents .................................................................................................. 83 

Dream71 Bangladesh Limited                         Confidential 

Page | 8 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## **REVISIONS HISTORY** 

|**Version**<br>**Date**<br>**Author**<br>**Changes Made**||
|---|---|
|0.1<br>10-Mar-2026<br>PM, Dream71<br>1st draft for client review||
|0.2<br>04-Apr-2026<br>PM, Dream71<br>Restructured per client feedback: traceable|Restructured per client feedback: traceable|
|IDs, acceptance criteria, separation of||
|concerns||
|||
|||
|||
|Dream71 Bangladesh Limited                         Confidential<br>Page |9<br>**APPROVALS**<br>**Name**<br>**Title/Role**<br>**Signature**<br>**Signature**<br>**Date**<br>Director of Procurement,<br>ZAMMSA<br>Chief Technical Advisor,<br>UNDP<br>Project Manager,<br>Dream71<br>**DOMAIN EXPERT LIST & COMMUNICATION DETAILS**<br>Name<br>Organization<br>Contact Information<br>~~=SSez~~<br>~~===~~||



Page | 9 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## **RESPONSE TO CLIENT FEEDBACK MATRIX** 

|**Client Feedback**<br>**Point**|**How This SRS Addresses It**|**Location**|
|---|---|---|
|SRS and SDD<br>overlap|Pure requirements focus. No database schemas,<br>API endpoints, or deployment details. Those remain<br>in SDD.|Entire<br>document|
|No traceable<br>requirement<br>identifiers|Every requirement has unique ID: FR-XXX-YY, BR-<br>XXX-YY, NFR-YY, AUD-XXX-YY|All sections|
|No acceptance<br>criteria|Every FR includes Given-When-Then acceptance<br>criteria|All FR sections|
|Distributed data<br>model|Data requirements per module show entities and<br>relationships, but no physical schemas|Section 1.8,<br>2.8, etc.|
|API design at pattern<br>level|Only integration requirements (WHAT). API design<br>(HOW) remains in SDD|Module 12|
|Configurability vs<br>hard-coding|Explicit section on configurable governance<br>parameters with access controls, audit, and<br>approval workflows|Section 1.12|
|Transactional vs<br>analytical separation|Separate NFR for workload isolation with read<br>replicas|NFR-08|
|Operational<br>readiness|NFR for monitoring, alerting, incident response,<br>SLIs/SLOs|NFR-09 to<br>NFR-14|
|Implementation<br>phasing|Explicit 3-phase implementation plan|Section 3.0<br>(after<br>modules)|



Dream71 Bangladesh Limited                         Confidential 

Page | 10 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## **1. INTRODUCTION** 

## 1.1 Purpose 

This document defines the complete functional and non-functional requirements for the ZAMMSA Integrated Procurement and Financial Management System. It is intended for software developers, testers, project managers, and stakeholders to guide implementation. 

## 1.2 Scope 

The system automates the end-to-end procurement lifecycle, financial tracking, supplier management, and integration with external regulatory systems for ZAMMSA Zambia, in compliance with: 

- ZAMMSA Procurement Manual (July 2023) 

- ZAMMSA Procurement Policy (August 2024) 

- Public Procurement Act No. 8 of 2020 

- Public Procurement Regulations 2022 

- ZPPA reporting requirements 

## 1.3 Document Organization 

This SRS is organized into: 

- **12 functional modules** with numbered requirements 

- **Non-Functional Requirements** (performance, security, availability, operational) 

- **Configurable Governance Parameters** (with control mechanisms) 

- **Implementation Phasing** (3 phases for rollout) 

- **Traceability Matrix** mapping requirements to modules 

## 1.4 Target Audience 

|1.4 Target Audience||
|---|---|
|**Audience**|**Use**|
|**Client (ZAMMSA/UNDP)**|Validate requirements, approve scope|
|**Software Developers**|Understand what to build|
|**Testers**|Derive test cases from acceptance criteria|
|**Project Managers**|Plan sprints and track progress|
|**Business Analysts**|Maintain requirements traceability|



Dream71 Bangladesh Limited                         Confidential 

Page | 11 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 2. OVERALL DESCRIPTION 

|**Role ID**<br>~~a~~|**Role Name**<br>~~ee~~|**Description**<br>~~ee~~|
|---|---|---|
|**R-01**<br>~~a~~<br>~~a~~|User Department Staff<br>~~ee~~|Initiates requisitions, provides specifications<br>~~ee~~|
|**R-02**<br>~~a~~<br>~~a~~|Department Head<br>~~ee~~|Approves departmental requisitions<br>~~ee~~|
|**R-03**<br>~~a ~~<br>~~ee~~|Procurement Officer<br> ~~a~~<br>~~ee ee~~|Manages solicitations and bids<br>~~ee~~|
|**R-04**<br>~~ee~~|Procurement Manager<br>~~ee ee~~|Oversees procurement operations<br>~~ee~~|
|**R-05**<br>~~ee~~<br>~~a~~|Evaluation Committee Member<br>~~ee ee~~|Scores bids independently<br>~~ee~~|
|**R-06**<br>~~a a~~|Evaluation Committee Chair<br>~~a~~|Leads evaluation, consolidates scores<br>~~ee~~|
|**R-07**<br>~~aee~~|Finance Officer<br>~~ee~~|Validates budgets, processes payments<br>~~eee~~|
|**R-08**<br>~~aee~~|ZPC Member<br>~~ee~~|Approves contracts and BERs<br>~~eee~~|
|**R-09**<br>~~ee~~<br>~~aee~~|Director of Procurement<br>~~ee ~~<br>~~ee~~|Approves APP, oversees compliance<br> ~~eee~~<br>~~ee~~|
|**R-10**<br>~~ee~~|Director General<br>~~ee~~|Final approval authority<br>~~ee~~|
|**R-11**<br>~~ee~~<br>~~aee~~|Supplier User<br>~~ee ~~<br>~~ee~~|Submits bids, manages profile<br> ~~ee~~<br>~~ee~~|
|**R-12**<br>~~aee~~|Contract Manager<br>~~ee~~|Manages active contracts<br>~~ee~~|
|**R-13**<br>~~ee~~<br>~~a~~|System Administrator<br>~~ee~~<br>~~a~~<br>~~a~~|Manages system configuration<br>~~ee~~|
|**R-14**<br>~~a~~|Auditor<br>~~a~~<br>~~ee~~|Read-only access for compliance<br>~~ee~~|
|**R-15**<br>~~a~~<br>~~a a~~<br>~~ee~~|Public Portal Viewer<br>~~a~~<br>~~ee~~<br>~~a~~<br>~~ee ee~~|Views published tenders<br>~~ee~~<br>~~ee~~|
|**R-16**<br>~~a a~~<br>~~ee~~|ZPPA Reporting Officer<br>~~a~~<br>~~ee ee~~|Generates and submits regulatory reports<br>~~ee~~|
|**R-17**<br>~~ee~~<br>~~aee~~|Supplier Relationship Manager<br>~~ee ee~~<br>~~ee ee~~|Manages supplier database<br>~~ee~~<br>~~ee~~|
|**R-18**<br>~~aee~~|Budget Controller<br>~~ee ee~~|Manages budget allocations<br>~~ee~~|
|**R-19**<br>~~ee~~<br>~~a~~|Integration Manager<br>~~ee ee~~|Monitors API integrations<br>~~ee~~|



## 2.2 Assumptions 

|**ID**|**Assumption**|
|---|---|
|**A-01**|External systems (ERP, ZRA, PACRA, CEEC, ZAMRA) have available APIs with<br>documented specifications|
|**A-02**|Network connectivity to government systems is available during business hours<br>(99% uptime)|



Dream71 Bangladesh Limited                         Confidential 

Page | 12 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

**A-03** Digital signatures are supported by government PKI infrastructure **A-04** Email server (SMTP) is available for sending notifications **A-05** SMS gateway is available for sending mobile notifications (optional) 2.3 Dependencies **ID Dependency Responsible Party D-01** ERP API availability and documentation Ministry of Finance **D-02** ZRA, PACRA, CEEC, ZAMRA API access Respective agencies **D-03** Smart Zambia SSO SAML 2.0 configuration Smart Zambia **D-04** Bank SFTP and webhook endpoints Commercial Bank **D-05** e-GP portal API credentials ZPPA 2.4 Constraints **ID Constraint C-01** System must comply with Zambian public procurement laws and regulations **C-02** All procurement data must be retained for 7 years minimum **C-03** System must support both English language only (official procurement language) **C-04** All financial transactions must be auditable and meet compliance **C-05** System must operate within Zambia time zone (CAT) ~~——[—]~~ Dream71 Bangladesh Limited                         Confidential Page | 13 

Page | 13 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 3. IMPLEMENTATION PHASING STRATEGY 

To address client feedback on scope management and realistic planning, the system shall be delivered in three phases. 

3.1 Phase 1: Core Procurement **Objective:** Replace manual procurement processes with basic automation. 

|**Module**|**Scope**|
|---|---|
|**User Management**|Registration, roles, basic RBAC, audit logs|
|**Procurement Planning**|APP creation, basic approval workflow|
|**Requisition Management**|Creation, budget validation, approval workflow|
|**Method Selection**|Basic threshold-based recommendation|
|**Solicitation Management**|Template-based document generation, publication|
|**Bid Management**|Electronic submission, basic bid opening|
|**Bid Evaluation**|Basic scoring (no QCBS initially)|
|**Contract Award**|Basic contract generation, digital signing|
|**Financial Tracking**|Budget validation, encumbrance, basic invoicing|
|**Supplier Management**|Registration, basic validation|
|**Reporting**|Basic dashboards, quarterly reports|
|**Integration**|ERP budget sync, basic e-GP publish|



_**Excluded from Phase 1:** QCBS methodology, predictive analytics, advanced contract amendments, Letter of Credit management, all advanced integrations (ZRA, PACRA, CEEC may be Phase 2)._ 

3.2 Phase 2: Enhanced Capabilities **Objective:** Add advanced procurement methodologies and external validations. 

|**Module**|**Additions**|
|---|---|
|**Bid Evaluation**|Full QCBS, QBS, LCS methodologies|
|**Contract**<br>**Management**|Advanced amendments (25% cap enforcement), liquidated<br>damages|
|**Financial Tracking**|Letter of Credit management, retention management|
|**Supplier Management**|CEEC integration, performance evaluations|



Dream71 Bangladesh Limited                         Confidential 

Page | 14 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**Integration**|ZRA, PACRA, CEEC, ZAMRA real-time validation|
|---|---|
|**Reporting**|Enhanced dashboards, predictive analytics setup|



3.3 Phase 3: Advanced Analytics & Optimization **Objective:** Add machine learning and advanced reporting. 

|**Module**|**Additions**|
|---|---|
|**Analytics**|Demand forecasting ML models|
|**Reporting**|Advanced procurement analytics|
|**Integration**|Full SSO with Smart Zambia|
|**Optimization**|Procurement bottleneck prediction, price trend analysis|



Dream71 Bangladesh Limited                         Confidential 

Page | 15 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 4. MODULE 1: USER AND ACCESS MANAGEMENT 

## 4.1 Objective 

To manage all system user identities, role assignments, permissions, authentication mechanisms, conflict of interest declarations, and maintain an immutable audit trail. 

## 4.2 Actors 

- System Administrator (R-13) 

- End User (all roles) 

- Auditor (R-14) 

- HR System (automated) 

## 4.3 Preconditions 

|4.3 Preconditions|4.3 Preconditions|
|---|---|
|**ID**|**Precondition**|
|**PRE-USER-01**|System Administrator account exists with initial credentials secured offline|
|**PRE-USER-02**|Employee data is available from HRMS for user provisioning|
|**PRE-USER-03**|Digital certificate infrastructure (PKI) is operational|



## 4.4 Postconditions 

|4.4 Postconditions||
|---|---|
|**ID**|**Postcondition**|
|**POST-USER-01**|All user actions are logged to immutable audit trail|
|**POST-USER-02**|Users can only access modules permitted by assigned roles|
|**POST-USER-03**|Session inactivity results in automatic logout|



## 4.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**USER-**<br>**01**|The system SHALL allow<br>System Administrators to<br>create user accounts with:<br>employee ID (unique), full<br>name, department, official<br>email, phone number.|High|**Given**a System Administrator is logged<br>in,**When**they complete the user<br>registration form with valid data,**Then**a<br>new user account is created with status<br>"Active" and a temporary password is<br>sent to the user's email.|
|**FR-**<br>**USER-**<br>**02**|The system SHALL generate<br>a temporary password (12<br>characters, meeting<br>complexity) and force<br>password change on first<br>login. The temporary|High|**Given**a new user account is<br>created,**When**the user attempts to log in<br>after 25 hours,**Then**the temporary<br>password is expired and the user must<br>request a password reset.|



Dream71 Bangladesh Limited                         Confidential 

Page | 16 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||password SHALL expire in<br>24 hours.|||
|---|---|---|---|
|**FR-**<br>**USER-**<br>**03**|The system SHALL enforce<br>password complexity:<br>minimum 8 characters, at<br>least one uppercase, one<br>lowercase, one number, one<br>special character.|High|**Given**a user creates a new<br>password,**When**the password does not<br>contain a special character,**Then**the<br>system rejects it with message "Password<br>must contain at least one special<br>character (!@#$%^&*)."|
|**FR-**<br>**USER-**<br>**04**|The system SHALL expire<br>passwords every 90 days.<br>Starting 14 days before<br>expiry, the system SHALL<br>display a warning at each<br>login.|High|**Given**a user's password expires in 7<br>days,**When**they log in,**Then**they see a<br>warning "Your password will expire in 7<br>days. Please change it soon."|
|**FR-**<br>**USER-**<br>**05**|The system SHALL lock a<br>user account after 5<br>consecutive failed login<br>attempts. Lock duration<br>SHALL be 30 minutes<br>(configurable).|High|**Given**a user enters incorrect passwords<br>5 times,**When**they attempt the 6th<br>login,**Then**they see "Account locked.<br>Please try again after 30 minutes."|
|**FR-**<br>**USER-**<br>**06**|The system SHALL require<br>Multi-Factor Authentication<br>(MFA) for roles: ZPC<br>Member, Director General,<br>Finance Officer, System<br>Administrator, Director of<br>Procurement. MFA SHALL<br>use TOTP (authenticator<br>app) or SMS.|High|**Given**a user with role "Finance Officer"<br>logs in with correct<br>password,**When**prompted for MFA<br>code,**Then**access is granted only after<br>entering a valid TOTP.|
|**FR-**<br>**USER-**<br>**07**|The system SHALL enforce<br>session timeout after 30<br>minutes of inactivity. A<br>warning SHALL appear at 28<br>minutes.|High|**Given**a logged-in user is inactive for 31<br>minutes,**When**they attempt any<br>action,**Then**they are redirected to login<br>page with message "Session expired due<br>to inactivity."|
|**FR-**<br>**USER-**<br>**08**|The system SHALL provide a<br>Conflict of Interest<br>declaration form for<br>Evaluation Committee<br>members assigned to a<br>solicitation.|High|**Given**an EC member is assigned to an<br>evaluation,**When**they access the<br>evaluation workspace,**Then**they must<br>complete a conflict declaration before<br>viewing any bid documents.|



Dream71 Bangladesh Limited                         Confidential 

Page | 17 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**|The system SHALL|High|**Given**an EC member declares conflict|
|---|---|---|---|
|**USER-**|automatically recuse any||with a specific bidder,**When**the|
|**09**|Evaluation Committee||declaration is submitted,**Then**the|
||member who declares a||member cannot access that solicitation's|
||conflict. The recusal SHALL||bids, and the Procurement Officer|
||be logged and the||receives a notification.|
||Procurement Officer notified.|||
|**FR-**|The system SHALL require|High|**Given**a Procurement Officer has not|
|**USER-**|all procurement staff (roles||completed the annual declaration by|
|**10**|with approval or evaluation||February 1,**When**they attempt to access|
||authority) to complete an||the Solicitation workspace,**Then**they are|
||annual Conflict of Interest||redirected to the declaration form and|
||declaration by January 31||cannot proceed until completed.|
||each year.|||
|4.6 Business Rules||||
|**ID**|**Business Rule**|||
|**BR-USER-**<br>Audit logs SHALL be retained for 7 years from creation date.||||
|**01**||||
|**BR-USER-**<br>Digital signatures SHALL use government PKI with X.509 certificates.||Digital signatures SHALL use government PKI with X.509 certificates.||
|**02**||||
|**BR-USER-**<br>No single user SHALL be assigned both a procurement creation role and||No single user SHALL be assigned both a procurement creation role and||
|**03**|approval role for the same procurement type (segregation of duties).|||
|**BR-USER-**<br>Users SHALL NOT be able to approve their own requests or transactions.||||
|**04**||||
|**BR-USER-**<br>The System Administrator role SHALL require two-person approval for any||||
|**05**|changes to audit log configuration.|||



## 4.6 Business Rules 

## 4.7 Data Requirements 

|**Entity**|**Key Fields**|**Relationships**|
|---|---|---|
|**User**|user_id, employee_id, full_name,<br>department_id, email, password_hash,<br>status, last_login|User → UserRole →<br>Role|
|**Role**|role_id, role_name, hierarchy_level|Role →<br>RolePermission →<br>Permission|



Dream71 Bangladesh Limited                         Confidential 

Page | 18 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**AuditLog**|log_id, user_id, timestamp, action, module,<br>record_id, old_value, new_value|AuditLog → User|
|---|---|---|
|**ConflictDeclaration**|declaration_id, user_id, procurement_id,<br>declared_conflict, resolution|ConflictDeclaration →<br>User, Procurement|



## 4.8 Validation Rules 

|**ID**|**Rule**|**Error Message**|
|---|---|---|
|**VAL-**<br>**USER-01**|Employee ID must be unique|"Employee ID [value] is already<br>registered"|
|**VAL-**<br>**USER-02**|Email must be from<br>@zammsa.gov.zmor@health.gov.zm|"Email must be from an approved<br>government domain"|
|**VAL-**<br>**USER-03**|New password cannot be same as last 5<br>passwords|"Password has been used recently"|
|**VAL-**<br>**USER-04**|User cannot approve own transaction|"You cannot approve a transaction<br>that you created"|



## 4.9 Exception Handling 

|**ID**|**Exception**|**Handling**|
|---|---|---|
|**EX-**<br>**USER-**<br>**01**|Email server<br>unavailable for<br>password reset|Queue email for retry (every 15 min for 2 hours), display<br>"Password reset email will be sent when service is<br>restored"|
|**EX-**<br>**USER-**<br>**02**|MFA code invalid|Display "Invalid verification code", increment failed MFA<br>counter, lock MFA after 5 failures|
|**EX-**<br>**USER-**<br>**03**|Audit log write fails|Log to local fallback file, alert System Administrator,<br>reject write operations until restored|



4.10 Workflow / Process Flow 

4.10.1 User Onboarding Workflow 

Step 1: System Administrator receives request for new user with employee ID and role. Step 2: Administrator creates user account in system with mandatory fields. 

Step 3: System generates temporary password (random 12-character string meeting complexity ). 

Step 4: System sends email to user with: 

Dream71 Bangladesh Limited                         Confidential 

Page | 19 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## - Temporary password 

- Login URL 

- Instruction to change password on first login 

- Expiry notice (password valid for 24 hours only) 

Step 5: User navigates to login page, enters employee ID and temporary password. Step 6: System forces password change: 

- User enters temporary password 

- User enters new password (meeting complexity) - User confirms new password 

- Step 7: System validates new password meets complexity rules. Step 8: System prompts for MFA setup (if user role requires MFA): 

- User scans QR code with authenticator app 

- User enters TOTP for verification 

- Step 9: User completes profile (optional: phone, digital certificate). 

- Step 10: System logs successful login and password change to audit trail. 

Step 11: Administrator assigns roles to user (may be before or after first login). Step 12: User accesses modules based on role permissions. 

## 4.10.2 Conflict of Interest Declaration Workflow 

Step 1: System identifies that a user with role "Evaluation Committee Member" has been assign ed to a solicitation. 

Step 2: System sends email notification: "You have been assigned as evaluator for Solicitation [ 

REF]. Please declare any conflict of interest." 

Step 3: User logs in and navigates to the evaluation workspace. 

Step 4: System displays Conflict of Interest declaration form before allowing access to bids. 

Step 5: User selects one of the following: 

- "No conflict" → Proceed to evaluation 

- "General conflict" → Provide explanation → Automatically recused 

- "Conflict with specific bidder(s)" → Select bidder(s) from list → Provide explanation → Aut 

omatically recused 

Step 6: If conflict declared: 

- System records declaration in audit log 

- System removes user from evaluation committee for this solicitation 

- System notifies Procurement Officer of recusal 

- System prompts Procurement Officer to assign replacement evaluator 

- Step 7: If no conflict: 

- System grants access to bid documents 

Dream71 Bangladesh Limited                         Confidential 

Page | 20 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- System logs declaration as "No conflict - cleared for evaluation" 

Step 8: Annual declaration reminder: System checks if user has declared in current calendar ye ar. 

Step 9: If no annual declaration exists by January 31, system blocks access to procurement fun ctions. 

Step 10: User completes annual declaration (simplified form confirming no undisclosed conflicts) Step 11: System logs declaration and restores access. 

- 4.10.3 Account Lockout Workflow 

Step 1: User attempts login with incorrect password. 

Step 2: System increments failed attempt counter for the user. 

Step 3: System logs failed attempt with IP address. 

Step 4: If failed attempts < 5: User is prompted to try again. 

Step 5: If failed attempts = 5: 

- System locks account 

- System sets lock expiry timestamp = current time + lock duration (30 minutes default) 

- System sends email to user: "Your account has been locked due to 5 failed login attempts. It will be unlocked at [timestamp]." 

- System sends alert to System Administrator (if configured) 

Step 6: User attempts login before lock expiry. 

Step 7: System displays: "Account locked. Please try again after [timestamp]." 

Step 8: After lock expiry, system resets failed attempt counter to 0. 

Step 9: User can attempt login again. 

## 4.11 Relationships 

4.12 Audit Requirements 

**ID Audit Event Data Captured Retention** 

Dream71 Bangladesh Limited                         Confidential 

Page | 21 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**AUD-**<br>**USER-01**|Login attempts<br>(success/failure)|User ID, timestamp, IP address,<br>success flag|7 years|
|---|---|---|---|
|**AUD-**<br>**USER-02**|Password changes|User ID, timestamp, password version 7 years|User ID, timestamp, password version 7 years|
|**AUD-**<br>**USER-03**|Role assignments|Admin ID, user ID, role ID, timestamp|7 years|
|**AUD-**<br>**USER-04**|Conflict declarations|User ID, procurement ID, declaration<br>type, timestamp|7 years|



## 4.13 Compliance References 

|4.13 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual Annex II**|Organizational framework and role definitions|
|**Procurement Manual Annex III**|Professional standards and confidentiality|
|**Procurement Policy Section 18**|Conflict of interest requirements|
|**Procurement Policy Section 20**|Confidentiality of procurement information|
|**ISO 27001**|Access control and audit logging standards|



Dream71 Bangladesh Limited                         Confidential 

Page | 22 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 5. MODULE 2: PROCUREMENT PLANNING 

## 5.1 Objective 

To facilitate the creation, approval, monitoring, and publication of Annual Procurement Plans (APP) and Contract Procurement Plans (CPP) aligned with budget allocations. 

## 5.2 Actors 

- User Department Staff (R-01) 

- Department Head (R-02) 

- Procurement Officer (R-03) 

- Director of Procurement (R-09) 

- ZPC Member (R-08) 

- Finance Officer (R-07) 

- ZPPA Reporting Officer (R-16) 

## 5.3 Preconditions 

|5.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-PLAN-01**|Budget allocations for fiscal year are loaded from ERP|
|**PRE-PLAN-02**|Fiscal year calendar is configured|
|**PRE-PLAN-03**|Department hierarchy is defined|



## 5.4 Postconditions 

|5.4 Postconditions|5.4 Postconditions|
|---|---|
|**ID**|**Postcondition**|
|**POST-PLAN-01**|Approved APP is published on ZAMMSA website and submitted to ZPPA|
|**POST-PLAN-02**|General Procurement Notice (GPN) is generated|
|**POST-PLAN-03**|No procurement may commence without approved APP line item or CPP|



## 5.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**PLAN-**<br>**01**|The system SHALL allow User<br>Department Staff to create APP<br>entries with: item description,<br>estimated value, proposed<br>method (system-<br>recommended), planned issue|High|**Given**a User Department Staff is<br>logged in,**When**they complete the<br>APP entry form with valid<br>data,**Then**the plan is saved with<br>status "Draft".|



Dream71 Bangladesh Limited                         Confidential 

Page | 23 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||date, planned award date,<br>funding source.|||
|---|---|---|---|
|**FR-**<br>**PLAN-**<br>**02**|The system SHALL<br>automatically validate that<br>estimated value does not<br>exceed department's available<br>budget via ERP API.|High|**Given**a department has K100,000<br>remaining budget,**When**a user<br>creates an APP line item with<br>estimated value K150,000,**Then**the<br>system displays "Insufficient budget.<br>Available: K100,000" and prevents<br>submission.|
|**FR-**<br>**PLAN-**<br>**03**|The system SHALL recommend<br>Method of Procurement based<br>on thresholds per Procurement<br>Policy Section 21.|High|**Given**a requisition for goods valued at<br>K1,500,000,**When**the system<br>evaluates,**Then**it recommends "Open<br>National Bidding" and displays the<br>applicable threshold.|
|**FR-**<br>**PLAN-**<br>**04**|The APP SHALL follow<br>approval workflow: Department<br>Head → Procurement Review<br>→ Director of Procurement →<br>ZPC → Published.|High|**Given**an APP is submitted,**When**the<br>Department Head<br>approves,**Then**status changes to<br>"Pending Procurement Review" and<br>the Procurement Officer is notified.|
|**FR-**<br>**PLAN-**<br>**05**|Upon ZPC approval, the system<br>SHALL automatically generate<br>a General Procurement Notice<br>(GPN).|High|**Given**an APP receives ZPC<br>approval,**When**the approval is<br>recorded,**Then**the system generates<br>a GPN and displays a "Publish" button.|
|**FR-**<br>**PLAN-**<br>**06**|The system SHALL allow<br>quarterly updates to the APP.<br>Each update SHALL require<br>justification and follow the same<br>approval workflow.|Medium|**Given**an approved APP<br>exists,**When**a user creates a quarterly<br>update,**Then**the justification field is<br>mandatory and the update goes<br>through full approval.|
|**FR-**<br>**PLAN-**<br>**07**|The system SHALL allow<br>Procurement Officers to create<br>CPPs from approved<br>requisitions with milestone<br>scheduling and risk<br>assessment.|High|**Given**a requisition with status<br>"Approved for Procurement",**When**a<br>Procurement Officer selects "Create<br>CPP",**Then**a CPP form pre-populated<br>with requisition data is displayed.|
|**FR-**<br>**PLAN-**<br>**08**|The system SHALL track<br>planned vs actual dates for<br>each milestone and display<br>variances on a dashboard.|Medium|**Given**a CPP with planned issue date<br>of March 1,**When**actual issue date is<br>March 10,**Then**the dashboard shows<br>a 9-day variance with warning<br>indicator.|



Dream71 Bangladesh Limited                         Confidential 

Page | 24 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**5.6 Business Rules**|
|---|
|**ID**<br>**Business Rule**<br>**BR-PLAN-**<br>**01**<br>APP must be submitted to ZPPA within 30 days of approval.<br>**BR-PLAN-**<br>**02**<br>No procurement may commence without approved APP line item or CPP.<br>**BR-PLAN-**<br>**03**<br>Multi-year contracts require future year budget commitments documented in<br>CPP.<br>**BR-PLAN-**<br>**04**<br>APP quarterly updates limited to 20% aggregate value change without re-<br>approval.<br>~~—~~|
|5.7 Data Requirements|
|**Entity**<br>**Key Fields**<br>**AnnualProcurementPlan**<br>app_id, fiscal_year, department_id, status, submitted_at,<br>approved_at<br>**APPLineItem**<br>line_item_id, app_id, description, estimated_value,<br>recommended_method, planned_issue_date<br>**ContractProcurementPlan**<br>cpp_id, requisition_id, milestones (JSON), risk_assessment<br>(JSON), status<br>**GeneralProcurementNotice**gpn_id, app_id, generated_at, publication_status<br>~~=—~~|
|5.8 Validation Rules|
|**ID**<br>**Rule**<br>**Error Message**<br>**VAL-**<br>**PLAN-01**<br>Estimated value > 0<br>"Estimated value must be greater than zero"<br>**VAL-**<br>**PLAN-02**<br>Planned award date after<br>planned issue date<br>"Award date must be after issue date"<br>**VAL-**<br>**PLAN-03**<br>Cumulative APP value ≤<br>department budget<br>"Total planned value exceeds department<br>budget by K[amount]"<br>~~=~~|



5.9 Workflow / Process Flow 

5.9.1 Annual Procurement Plan (APP) Creation and Approval Workflow Step 1: Finance system releases annual budget to departments (external API sync). 

Dream71 Bangladesh Limited                         Confidential 

Page | 25 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Step 2: System displays budget availability to each department. 

- Step 3: User Department Staff creates departmental APP entries: 

- For each planned procurement, enters description, estimated value, required date 

- System recommends method of procurement based on value 

- System validates estimated value against department budget 

- Step 4: User Department Staff submits departmental APP for approval. 

- Step 5: Department Head reviews: 

- Reviews each line item for alignment with operational needs 

- Can approve, reject, or request changes 

- If approved, status changes to "Pending Procurement Review" 

- Step 6: Procurement Officer reviews: 

- Validates method of procurement selection 

- Checks for consolidation opportunities with other departments 

- Provides feedback on market conditions 

- Approves or returns for revision 

- Step 7: Director of Procurement reviews: 

- Confirms alignment with strategic objectives 

- Approves consolidated APP 

- Status changes to "Pending ZPC Approval" 

- Step 8: ZPC Secretary schedules APP for ZPC meeting. 

- Step 9: ZPC members review APP before meeting. 

Step 10: During ZPC meeting, committee approves or requests modifications. 

Step 11: System records ZPC approval decision. 

- Step 12: Status changes to "Approved". 

- Step 13: System automatically generates GPN. 

- Step 14: Procurement Officer publishes GPN to: 

- ZAMMSA website (one-click publish) 

- Government Gazette (system generates file for upload) 

Dream71 Bangladesh Limited                         Confidential 

Page | 26 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- e-GP portal (API call) 

- Step 15: System stores publication proofs and timestamps. 

Step 16: Approved APP is now the basis for all requisitions in the fiscal year. 

- 5.9.2 Contract Procurement Plan (CPP) Creation Workflow Step 1: Requisition is approved and funded (status = "Approved for Procurement"). 

- Step 2: System notifies Procurement Officer that CPP can be created. 

- Step 3: Procurement Officer selects "Create CPP from Requisition". 

- Step 4: System pre-populates CPP with data from requisition: 

- Item descriptions and quantities 

- Estimated value 

- Department 

- Step 5: Procurement Officer adds: 

- Milestone schedule (configurable template based on method) 

   - Requisition to Solicitation: X days 

   - Solicitation to Closing: Y days (based on method) 

   - Closing to Evaluation: Z days 

   - Evaluation to Award: W days 

- Resource requirements (evaluation committee size, expertise needed) 

- Risk assessment (select from risk library: supply risk, price risk, quality risk, etc.) 

- Mitigation strategies for each identified risk 

- Step 6: If method of procurement is non-open (Limited, Simplified, Direct): 

- System flags CPP for ZPC approval 

- Procurement Officer submits CPP for ZPC review 

- Step 7: ZPC reviews and approves CPP (or requests changes). 

Step 8: Status changes to "Approved - Procurement May Commence". 

- Step 9: System creates baseline schedule with planned dates. 

Step 10: Procurement Officer can commence solicitation process. 

Dream71 Bangladesh Limited                         Confidential 

Page | 27 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 5.10 Relationships 

## 5.11 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-PLAN-01**|All APP creation, modification, and approval actions|7 years|
|**AUD-PLAN-02**|All CPP creation and approval actions|7 years|
|**AUD-PLAN-03**|All GPN publication events (including channel and timestamp)|7 years|
|**AUD-PLAN-04**|All milestone date changes (planned vs actual)|7 years|
|**AUD-PLAN-05**|All budget validation requests and responses|7 years|
|**AUD-PLAN-06**|Quarterly update justifications|7 years|



## 5.12 Compliance References 

|**Reference**|**Requirement**|
|---|---|
|**Procurement Manual DI #1**|Procurement planning requirements|
|**Procurement Manual GN A**|Planning and advertising requirements|
|**Procurement Policy Section 6**|Procurement strategy and planning|
|**Public Procurement Act Section 15**|Annual procurement plans|



Dream71 Bangladesh Limited                         Confidential 

Page | 28 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 6. MODULE 3: REQUISITION AND SPECIFICATION MANAGEMENT 

## 6.1 Objective 

To enable User Departments to initiate procurement requests with specifications and validate budget availability. 

## 6.2 Actors 

- User Department Staff (R-01) 

- Department Head (R-02) 

- Finance Officer (R-07) 

- Director General (R-10) 

- ZPC Member (R-08) 

- Procurement Officer (R-03) 

## 6.3 Preconditions 

|**ID**|**Precondition**|
|---|---|
|**PRE-REQ-01**|User has role "User Department Staff"|
|**PRE-REQ-02**|Department has approved APP for fiscal year|
|**PRE-REQ-03**|Budget data is loaded from ERP|
|**PRE-REQ-04**|Approval thresholds are configured|



## 6.4 Postconditions 

|**ID**|**Postcondition**|
|---|---|
|**POST-REQ-01**|Budget hold (encumbrance) is created|
|**POST-REQ-02**|Approved requisition is available for Procurement Officer|
|**POST-REQ-03**|All approval decisions are logged with timestamps|



## 6.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**REQ-**<br>**01**|The system SHALL allow<br>User Department Staff to<br>create requisitions with:<br>item details, quantity,<br>estimated cost, required<br>delivery date,<br>justification,and|High|**Given**a User Department Staff is logged<br>in,**When**they complete the requisition form<br>and attach specifications,**Then**the requisition<br>is saved with status "Draft".|



Dream71 Bangladesh Limited                         Confidential 

Page | 29 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||specification<br>attachments.|||
|---|---|---|---|
|**FR-**<br>**REQ-**<br>**02**|The system SHALL<br>provide three<br>specification templates:<br>Goods Specification,<br>Terms of Reference<br>(consulting), Statement<br>of Work (works).|High|**Given**a user selects "Goods" as procurement<br>type,**When**they access the specification<br>section,**Then**the Goods Specification<br>Template is displayed with all required fields.|
|**FR-**<br>**REQ-**<br>**03**|The system SHALL<br>perform real-time budget<br>validation via ERP API<br>when a requisition is<br>submitted. If sufficient,<br>create encumbrance.|High|**Given**a requisition with estimated total<br>K50,000,**When**submitted,**Then**the system<br>checks available budget, and if sufficient,<br>creates an encumbrance reducing available<br>budget by K50,000.|
|**FR-**<br>**REQ-**<br>**04**|If budget insufficient, the<br>system SHALL reject the<br>requisition, display<br>available amount, and<br>return with status<br>"Budget Rejected -<br>Revise and Resubmit."|High|**Given**a requisition with estimated total<br>K50,000 but available budget is<br>K30,000,**When**submitted,**Then**the system<br>rejects with message "Insufficient budget.<br>Available: K30,000."|
|**FR-**<br>**REQ-**<br>**05**|The requisition SHALL<br>follow approval workflow:<br>≤ K250,000: Dept Head<br>→ Finance → DG; ><br>K250,000: add ZPC<br>approval.|High|**Given**a requisition for K200,000 is<br>submitted,**When**Dept Head and Finance<br>approve,**Then**it routes to DG, not to ZPC.|
|**FR-**<br>**REQ-**<br>**06**|The system SHALL allow<br>requisition amendments<br>before approval.<br>Amendments SHALL be<br>versioned with full<br>history.|Medium|**Given**a requisition in "Draft" status,**When**the<br>originator edits any field,**Then**the previous<br>version is preserved and changes are<br>highlighted.|
|**FR-**<br>**REQ-**<br>**07**|The system SHALL<br>provide a requisition<br>tracking dashboard<br>showing status, current<br>approver, time at current<br>stage.|Medium|**Given**a requisition pending Dept Head<br>approval for 3 days,**When**the originator views<br>the dashboard,**Then**a warning "Pending<br>approval - 3 days" is displayed.|



Dream71 Bangladesh Limited                         Confidential 

Page | 30 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 6.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-REQ-01**|DG approves up to K250,000; ZPC approves above K250,000.|
|**BR-REQ-02**|Budget hold remains active until contract award or cancellation.|
|**BR-REQ-03**|Specifications for goods > K1,000,000 require technical review.|
|**BR-REQ-04**|Requisition expires after 90 days without action.|



## 6.7 Data Requirements 

|6.7 Data Requirements||
|---|---|
|**Entity**|**Key Fields**|
|**Requisition**|requisition_id, department_id, requester_id, estimated_total, status,<br>submitted_at|
|**RequisitionItem**|item_id, requisition_id, description, quantity, unit_price_estimate|
|**Specification**|specification_id, requisition_id, specification_type, content|
|**RequisitionApproval**|approval_id, requisition_id, approver_id, decision, comments,<br>approved_at|
|**BudgetEncumbrance**|encumbrance_id, requisition_id, amount, erp_reference, status|



6.8 Workflow / Process Flow 

6.8.1 Requisition Creation and Approval Workflow 

Step 1: User Department Staff identifies need for goods, services, or works. 

Step 2: User logs in and navigates to Requisition workspace. 

Step 3: User clicks "Create New Requisition". 

Step 4: User selects procurement type: Goods / Consulting Services / Works. 

Step 5: System displays appropriate specification template. 

Step 6: User completes requisition form: 

- Adds line items (can add multiple) 

- For each line, selects from catalog or enters description 

- Enters quantity, unit, estimated unit price 

- System calculates line total and grand total 

Dream71 Bangladesh Limited                         Confidential 

Page | 31 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Selects required delivery date 

- Selects delivery location 

- Selects funding source (if multiple) 

- Attaches specifications (Word, PDF, Excel, CAD files) 

- Links to APP line item (optional but recommended) 

- Step 7: User clicks "Submit for Approval". 

- Step 8: System validates: 

- All mandatory fields completed 

- Attachments present for each line item 

- Estimated total > 0 

Step 9: System performs budget validation via ERP API: 

- Sends request with department, fiscal year, amount 

- Receives response: available budget amount 

- If available >= requested: proceed 

- If available < requested: display error, prevent submission 

Step 10: System creates requisition record with status "Submitted". 

Step 11: System notifies Department Head via email and in-app notification. 

Step 12: Department Head reviews requisition: 

- Reviews specifications for accuracy 

- Confirms operational need 

- Approves, rejects, or requests changes 

Step 13: If approved, status changes to "Pending Finance Validation". 

Step 14: System notifies Finance Officer. 

Step 15: Finance Officer reviews budget validation (confirms the automated check): 

- Approves budget hold 

- System calls ERP API to create encumbrance 

- Encumbrance reference stored in requisition 

Step 16: Status changes based on value threshold: 

Dream71 Bangladesh Limited                         Confidential 

Page | 32 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## - If value ≤ K250,000: "Pending DG Approval" 

- If value > K250,000: "Pending DG Approval" then "Pending ZPC Approval" 

Step 17: Director General reviews and approves. 

Step 18: For values > K250,000, ZPC reviews and approves at next committee meeting. 

Step 19: Upon final approval, status changes to "Approved for Procurement". 

Step 20: System notifies Procurement Officer that requisition is ready for action. 

Step 21: Budget hold remains active until contract award or requisition cancellation. 

6.8.2 Requisition Amendment Workflow 

Step 1: User with requisition in "Draft", "Rejected", or "Pending Changes" status clicks "Amend". 

Step 2: System creates a new version of the requisition. 

Step 3: User makes changes to line items, quantities, estimated values, or specifications. 

Step 4: System recalculates totals. 

Step 5: System performs budget validation again if estimated total increased. 

Step 6: User submits amended requisition. 

Step 7: System preserves previous version in version history. 

Step 8: Approval workflow restarts from beginning (unless only minor changes). 

Step 9: Approvers see diff view showing changes from previous version. 

Step 10: If approved, amended requisition replaces previous version. 

## 6.9 Relationships 

## 6.10 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-REQ-01**|All requisition creation, modification, and submission events|7 years|
|**AUD-REQ-02**|All approval decisions (who, when, decision, comments)|7 years|



Dream71 Bangladesh Limited                         Confidential 

Page | 33 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**AUD-REQ-03**|All budget validation requests and encumbrance creations|7 years|
|---|---|---|
|**AUD-REQ-04**|All specification changes (diff view)|7 years|
|**AUD-REQ-05**|All delegation of authority events|7 years|



## 6.11 Compliance References 

|6.11 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #8**|Specifying procurement requirements|
|**Procurement Manual GN C**|Specification for goods|
|**Procurement Manual GN D**|Terms of Reference for services|
|**Procurement Manual GN E**|Statement of Work for works|
|**Procurement Policy Section 14**|Cost management|



Dream71 Bangladesh Limited                         Confidential 

Page | 34 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

7. MODULE 4: METHOD OF PROCUREMENT SELECTION 

## 7.1 Objective 

To automatically determine the appropriate procurement method based on value and nature of purchase, manage justifications for non-open methods, and apply preference schemes. 

## 7.2 Actors 

- Procurement Officer (R-03) 

- ZPC Member (R-08) 

- Director of Procurement (R-09) 

- Evaluation Committee (R-05, R-06) 

## 7.3 Preconditions 

|7.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-METHOD-01**|Requisition is approved with estimated value|
|**PRE-METHOD-02**|Threshold configuration is loaded from Policy|
|**PRE-METHOD-03**|Supplier CEEC categories are available|



## 7.4 Postconditions 

|7.4 Postconditions||
|---|---|
|**ID**|**Postcondition**|
|**POST-METHOD-01**|Method is recorded in CPP and solicitation|
|**POST-METHOD-02**|Non-open method justifications are ZPC-approved|
|**POST-METHOD-03**|Preference scheme is applied during financial evaluation|



## 7.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**METHOD-**<br>**01**|The system SHALL<br>automatically<br>recommend Method<br>of Procurement<br>based on thresholds:<br>Open Bidding for<br>goods/works ><br>K1,000,000;<br>Simplified Bidding ≤<br>K1,000,000; Direct<br>Bidding ≤ K20,000.|High|**Given**a requisition for goods valued at<br>K2,000,000,**When**the system<br>evaluates,**Then**it recommends "Open<br>National Bidding" and displays the threshold<br>rule applied.|



Dream71 Bangladesh Limited                         Confidential 

Page | 35 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**METHOD-**<br>**02**|For consulting<br>services: Open<br>Selection ><br>K600,000; Simplified<br>Selection ≤<br>K600,000.|High|**Given**a requisition for consulting services<br>valued at K800,000,**When**the system<br>evaluates,**Then**it recommends "Open<br>Selection".|
|---|---|---|---|
|**FR-**<br>**METHOD-**<br>**03**|For non-open<br>methods, the system<br>SHALL require a<br>justification form<br>before publication.|High|**Given**a requisition for Direct Bidding is<br>recommended,**When**the Procurement<br>Officer attempts to publish,**Then**they are<br>redirected to a justification form with<br>mandatory fields.|
|**FR-**<br>**METHOD-**<br>**04**|Justifications for non-<br>open methods<br>SHALL be routed to<br>ZPC for approval.|High|**Given**a Direct Bidding justification is<br>submitted,**When**complete,**Then**status<br>changes to "Pending ZPC Approval" and ZPC<br>members are notified.|
|**FR-**<br>**METHOD-**<br>**05**|The system SHALL<br>apply preference<br>margins during<br>financial evaluation:<br>4% (Citizen-<br>Influenced), 8%<br>(Citizen-Empowered),<br>12% (Citizen-<br>Owned), 15%<br>(domestic goods).|High|**Given**a Citizen-Owned supplier bids<br>K100,000,**When**financial evaluation<br>runs,**Then**the evaluated price is K88,000<br>(12% margin applied).|



## 7.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-**<br>**METHOD-01**|Reservation thresholds: Goods ≤ K3,000,000 reserved for citizen suppliers;<br>Works ≤ K20,000,000 reserved.|
|**BR-**<br>**METHOD-02**|Direct Bidding limit: K20,000 per transaction; annual cumulative ≤ K200,000<br>per department without waiver.|
|**BR-**<br>**METHOD-03**|Preference margins applied only during evaluation, not to actual contract<br>price.|



Dream71 Bangladesh Limited                         Confidential 

Page | 36 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- 7.7 Workflow / Process Flow 

- 7.7.1 Method of Procurement Selection Workflow Step 1: Requisition is approved with status "Approved for Procurement". 

Step 2: Procurement Officer creates CPP or accesses existing CPP. 

Step 3: System evaluates requisition estimated value and procurement type. 

Step 4: System applies threshold rules: 

- Check value range 

- Check procurement type (goods/works vs consulting) 

- Check if emergency flag is set 

- Check if reservation scheme applies 

Step 5: System displays recommended method with rationale: 

Example: "Open National Bidding recommended - Value K1,500,000 falls within K1,000,001 to K5,000,000 threshold per Policy Section 21.2(a)." 

Step 6: Procurement Officer reviews recommendation. 

Step 7: Procurement Officer either: 

- Accepts recommended method → proceed to step 10 

- Overrides with alternative method → proceed to step 8 

Step 8: If override: 

- Procurement Officer selects alternative method 

- Enters override reason 

- System routes to Director of Procurement for approval 

- Step 9: Director of Procurement approves or rejects override. 

Step 10: If selected method is non-open (Limited, Simplified, Direct): 

- System displays justification form 

- Procurement Officer completes justification 

- Attaches supporting evidence 

- Submits for ZPC approval 

Step 11: ZPC members review justification (can be done online or during meeting). 

Step 12: ZPC approves or rejects justification. 

Step 13: If approved, method is locked for this procurement. 

Dream71 Bangladesh Limited                         Confidential 

Page | 37 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 14: Method is recorded in CPP and will be used for solicitation generation. 

7.7.2 Preference Scheme Application Workflow (During Evaluation) Step 1: Solicitation is issued with preference scheme flag (if applicable). 

Step 2: Suppliers submit bids with CEEC certificate numbers. 

Step 3: During bid submission, system validates CEEC status via API. 

Step 4: System records supplier category for each bid. 

Step 5: During financial evaluation: 

- System identifies bids subject to preference (citizen-owned) 

- For each qualifying bid, system calculates evaluated price: 

Evaluated Price = Bid Price × (1 - Preference Margin/100) 

- For Citizen-Owned (12%): Evaluated Price = Bid Price × 0.88 

Step 6: System ranks bids by evaluated price (lowest wins). 

Step 7: Contract award uses actual bid price, not evaluated price. 

Step 8: System documents preference application in Bid Evaluation Report. 

## 7.8 Relationships 

## 7.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-METHOD-01**|All method recommendations and overrides|7 years|
|**AUD-METHOD-02**|All non-open method justifications and ZPC approvals|7 years|
|**AUD-METHOD-03**|All preference scheme applications and margin calculations|7 years|
|**AUD-METHOD-04**|All CEEC validation requests and responses|7 years|



Dream71 Bangladesh Limited                         Confidential 

Page | 38 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

7.10 Compliance References 

|7.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #2**|Preference and reservation schemes|
|**Procurement Manual DI #3**|Method of procurement selection|
|**Procurement Policy Section 7**|Procurement methods|
|**Procurement Policy Section 11**|Procurement methods details|
|**Procurement Policy Section 21**|Thresholds for procurement methods|
|**Public Procurement Act Section 32**|Methods of procurement|



Dream71 Bangladesh Limited                         Confidential 

Page | 39 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 8. MODULE 5: SOLICITATION DOCUMENT MANAGEMENT 

## 8.1 Objective 

To create, manage, and distribute solicitation documents using ZPPA-approved templates. 

## 8.2 Actors 

- Procurement Officer (R-03) 

- Procurement Manager (R-04) 

- Supplier User (R-11) 

- Public Portal Viewer (R-15) 

## 8.3 Preconditions 

|**ID**||**Precondition**|
|---|---|---|
|**PRE-SOL-01**||Requisition is approved|
|**PRE-SOL-02**||Method of procurement is selected|
|**PRE-SOL-03**||ZPPA-approved templates are loaded|
|8.4 Postconditions|||
|**ID**|**Postcondition**||
|**POST-SOL-01**|Solicitation is published and available to suppliers||
|**POST-SOL-02**|Notifications are sent to registered suppliers||
|**POST-SOL-03**|Solicitation is published on e-GP portal||



## 8.4 Postconditions 

## 8.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**SOL-**<br>**01**|The system SHALL provide<br>ZPPA-approved templates<br>for ITB (goods/works), RFP<br>(consulting), RFQ<br>(simplified).|High|**Given**a Procurement Officer selects "Create<br>Solicitation",**When**they choose the<br>procurement method,**Then**the appropriate<br>template is loaded with standard clauses.|
|**FR-**<br>**SOL-**<br>**02**|Mandatory clauses SHALL<br>be read-only and cannot be<br>modified.|High|**Given**a Procurement Officer edits an ITB<br>template,**When**they attempt to modify the<br>"General Conditions" section,**Then**the<br>section is read-only with tooltip "Mandatory<br>clause - cannot be edited."|
|**FR-**<br>**SOL-**<br>**03**|The system SHALL allow<br>configuration of evaluation|High|**Given**a Procurement Officer creates an<br>RFP,**When**they configure|



Dream71 Bangladesh Limited                         Confidential 

Page | 40 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||criteria with weights<br>summing to 100%.||criteria,**Then**they can set weights and the<br>system enforces total = 100%.|
|---|---|---|---|
|**FR-**<br>**SOL-**<br>**04**|Upon publication, the<br>system SHALL publish to<br>ZAMMSA website, e-GP<br>portal, and (for<br>international) UN<br>Development Business.|High|**Given**a solicitation is<br>published,**When**publication<br>completes,**Then**the system stores proof of<br>publication for each channel.|
|**FR-**<br>**SOL-**<br>**05**|The system SHALL allow<br>addenda issuance.<br>Addenda issued within 7<br>days of closing SHALL<br>automatically extend<br>closing date by 7 days.|High|**Given**a solicitation closes in 5<br>days,**When**an addendum is<br>issued,**Then**the system automatically<br>extends closing date by 7 days and notifies<br>all suppliers.|



## 8.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-SOL-**<br>**01**|Minimum solicitation period: 30 days (international), 21 days (national), 14 days<br>(simplified).|
|**BR-SOL-**<br>**02**|Clarification cutoff: 5 working days before closing.|
|**BR-SOL-**<br>**03**|Addendum within 7 days of closing automatically extends by 7 days.|



- 8.7 Workflow / Process Flow 

8.7.1 Solicitation Creation and Publication Workflow Step 1: Procurement Officer selects "Create Solicitation" from approved requisition. 

Step 2: System pre-populates solicitation with requisition data: 

- Item descriptions and quantities 

- Estimated value 

- Department 

- Delivery requirements 

Step 3: Procurement Officer selects template based on procurement method. 

Step 4: System loads the template with mandatory clauses. 

Step 5: Procurement Officer completes solicitation document: 

Dream71 Bangladesh Limited                         Confidential 

Page | 41 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Fills in Bid Data Sheet (deadlines, contact information, submission instructions) 

- Configures evaluation criteria: 

- Adds mandatory pass/fail criteria (e.g., "Bid security provided") 

- Adds technical criteria with weights (e.g., "Experience: 30%") 

- Sets minimum technical threshold (if QCBS) 

- Sets financial weight (if QCBS) 

- Defines closing date and bid opening date 

- Uploads additional reference documents (drawings, terms of reference) 

Step 6: System validates: 

- Closing date is at least minimum period from now (30/21/14 days based on method) 

- Bid opening date is after closing date 

- Evaluation criteria weights sum to 100% 

- Minimum technical threshold is between 0 and 100 

Step 7: Procurement Officer saves solicitation with status "Draft". 

Step 8: Procurement Officer submits for approval. 

Step 9: Procurement Manager reviews: 

- Checks document completeness 

- Verifies evaluation criteria are appropriate 

- Confirms closing date allows adequate bidding time 

- Approves or returns with comments 

- Step 10: Upon approval, status changes to "Ready for Publication". 

Step 11: Procurement Officer clicks "Publish". 

Step 12: System generates final PDF of solicitation document. 

Step 13: System publishes to: 

- ZAMMSA website (public portal becomes visible) 

- e-GP portal (API call) 

- Government Gazette (if required) 

Step 14: System records publication timestamps and stores proofs. 

Dream71 Bangladesh Limited                         Confidential 

Page | 42 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 15: System identifies registered suppliers in relevant categories. 

Step 16: System sends email notifications to all identified suppliers. 

- Step 17: Status changes to "Published - Open for Bids". 

Step 18: Solicitation is now visible to suppliers for bid submission. 

8.7.2 Addendum Issuance Workflow 

Step 1: Procurement Officer identifies need to modify solicitation (clarification, correction, or change). 

- Step 2: Procurement Officer selects "Issue Addendum" from solicitation. 

- Step 3: System generates addendum number (e.g., Addendum No. 1). 

- Step 4: Procurement Officer enters: 

- Description of change 

- Reason for change 

- Attached modified document sections (or full document) 

- Step 5: System checks if closing date is within 7 days. 

- If yes, system automatically suggests extending closing date by 7 days 

- Procurement Officer confirms or adjusts extension 

- Step 6: Procurement Officer submits addendum. 

- Step 7: Procurement Manager approves addendum (if material change). 

- Step 8: System publishes addendum to portal. 

- Step 9: System sends email notifications to all suppliers who downloaded solicitation. 

- Step 10: System updates solicitation version number. 

- Step 11: Suppliers must acknowledge addendum before submitting bids. 

Step 12: Closing date is updated in system if extended. 

Dream71 Bangladesh Limited                         Confidential 

Page | 43 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 8.8 Relationships 

## 8.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-SOL-01**|All solicitation creation, modification, and publication events|7 years|
|**AUD-SOL-02**|All addendum issuances and closing date changes|7 years|
|**AUD-SOL-03**|All clarification questions and answers|7 years|
|**AUD-SOL-04**|All template changes and approvals|7 years|
|**AUD-SOL-05**|All document downloads (who, when, which document)|7 years|



## 8.10 Compliance References 

|**Reference**|**Requirement**|
|---|---|
|**Procurement Manual DI #9**|Drafting and issuing solicitation documents|
|**Procurement Manual DI #10**|Preparation of procurement notices/invitations|
|**Procurement Manual DI #12**|Approval and distribution of solicitation documents|
|**Procurement Manual GN G-1, G-2, G-3**|Solicitation document contents|



Dream71 Bangladesh Limited                         Confidential 

Page | 44 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 9. MODULE 6: BID MANAGEMENT 

## 9.1 Objective 

To manage bid submission, public bid opening, clarifications, and bid security. 

## 9.2 Actors 

- Supplier User (R-11) 

- Procurement Officer (R-03) 

- Evaluation Committee Member (R-05) 

- Public Portal Viewer (R-15) 

## 9.3 Preconditions 

|9.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-BID-01**|Solicitation is published and open|
|**PRE-BID-02**|Current time is before closing deadline|
|**PRE-BID-03**|Supplier is registered and not debarred|



## 9.4 Postconditions 

|9.4 Postconditions||
|---|---|
|**ID**|**Postcondition**|
|**POST-BID-01**|Bids are securely stored with timestamps|
|**POST-BID-02**|Late bids are automatically rejected|
|**POST-BID-03**|Bid opening minutes are generated and distributed|



## 9.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**BID-**<br>**01**|The system SHALL allow<br>suppliers to submit bids<br>electronically with<br>timestamp.|High|**Given**a supplier is logged in,**When**they<br>upload bid documents and click<br>"Submit",**Then**the system generates a<br>receipt with timestamp and unique<br>submission ID.|
|**FR-**<br>**BID-**<br>**02**|For two-envelope system,<br>financial envelopes SHALL<br>be encrypted and<br>inaccessible until technical<br>evaluation complete.|High|**Given**a supplier submits a bid for consulting<br>services,**When**they upload financial<br>documents,**Then**the documents are<br>encrypted and cannot be viewed until<br>authorized.|



Dream71 Bangladesh Limited                         Confidential 

Page | 45 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**BID-**<br>**03**|The system SHALL<br>automatically reject bids<br>submitted after closing<br>deadline.|High|**Given**a solicitation closes at 14:00,**When**a<br>supplier attempts to submit at<br>14:01,**Then**the system displays "Bid closed<br>- submission rejected."|
|---|---|---|---|
|**FR-**<br>**BID-**<br>**04**|The system SHALL provide<br>a public bid opening<br>interface displaying bidder<br>names and prices in real-<br>time.|High|**Given**a public bid opening is in<br>progress,**When**the Procurement Officer<br>clicks "Open Next Bid",**Then**the system<br>displays bidder name and price to all<br>connected viewers within 2 seconds.|
|**FR-**<br>**BID-**<br>**05**|The system SHALL<br>automatically generate Bid<br>Opening Minutes with<br>witness signatures and<br>distribute to bidders.|High|**Given**a bid opening is completed,**When**the<br>Procurement Officer clicks "Finalize<br>Opening",**Then**the system generates a PDF<br>of minutes, collects signatures, and emails to<br>all bidding suppliers.|



## 9.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-BID-01**|Bid security: 2-5% of estimated value for goods/works, 1-2% for consulting.|
|**BR-BID-02**|Bid security validity: 28 days beyond bid validity.|
|**BR-BID-03**|Financial envelopes opened only after technical evaluation complete.|



9.7 Workflow / Process Flow 9.7.1 Bid Submission Workflow Step 1: Supplier logs into supplier portal. 

Step 2: Supplier navigates to "Open Tenders" and selects a solicitation. 

Step 3: System displays solicitation details, closing date, and document download link. 

Step 4: Supplier downloads solicitation documents (if not already downloaded). 

Step 5: Supplier prepares bid documents offline. 

Step 6: Supplier returns to portal and clicks "Submit Bid". 

Step 7: System checks: 

- Is current time before closing deadline? 

- Has supplier acknowledged all addenda? 

- Is supplier not debarred? 

Dream71 Bangladesh Limited                         Confidential 

Page | 46 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Is supplier tax clearance valid? 

Step 8: If all checks pass, system displays bid submission form. 

Step 9: Supplier uploads: 

- Technical proposal (PDF, max 50MB) 

- Financial proposal (PDF, encrypted by supplier - for two-envelope) 

- Bid security document (PDF) 

- Any other required forms 

Step 10: Supplier enters total bid price (for single envelope) or "TBD" (for two-envelope). 

Step 11: Supplier checks confirmation box: "I confirm that the information provided is accurate and complete." 

Step 12: Supplier clicks "Submit Bid". 

Step 13: System timestamps submission. 

Step 14: System generates unique Submission ID. 

Step 15: System stores bid documents securely. 

Step 16: For two-envelope: System encrypts financial envelope with system key. 

Step 17: System displays receipt with Submission ID and timestamp. 

Step 18: System emails receipt to supplier. 

Step 19: Bid status = "Submitted". 

9.7.2 Public Bid Opening Workflow 

Step 1: At scheduled bid opening date and time, Procurement Officer logs in. 

Step 2: Procurement Officer navigates to solicitation and clicks "Open Bids". 

Step 3: System displays public bid opening interface. 

Step 4: Procurement Officer generates public view link and shares with attendees (or displays on screen). 

Step 5: Procurement Officer announces start of bid opening. 

Step 6: For each bid (in order of receipt): 

- Procurement Officer clicks "Open Next Bid" 

- System displays: 

* Bidder name 

Dream71 Bangladesh Limited                         Confidential 

Page | 47 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

* For single envelope: Total bid price 

* For two-envelope: "Technical envelope only - financial envelope sealed" 

- Attendees see the display in real-time 

- Procurement Officer reads aloud the information 

Step 7: Procurement Officer notes any objections or observations. 

Step 8: After all bids are opened, Procurement Officer clicks "Finalize Opening". 

Step 9: System generates Bid Opening Minutes PDF. 

Step 10: Procurement Officer and witnesses apply digital signatures. 

Step 11: System emails minutes to all bidding suppliers. 

Step 12: For two-envelope: System maintains financial envelope encryption. 

Step 13: Bid status = "Opened - Under Evaluation". 

## 9.8 Relationships 

## 9.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-BID-01**|All bid submissions (including rejected late bids)|7 years|
|**AUD-BID-02**|All bid withdrawals and modifications (with versions)|7 years|
|**AUD-BID-03**|All bid opening events and minutes|7 years|
|**AUD-BID-04**|All financial envelope encryption/decryption events|7 years|
|**AUD-BID-05**|All bid security verification attempts|7 years|



## 9.10 Compliance References 

|9.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #13**|Pre-bid conference and site visit|
|**Procurement Manual DI #14**|Bidder clarifications, modifications and extensions|



Dream71 Bangladesh Limited                         Confidential 

Page | 48 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**Procurement Manual DI #15**|Receipt and opening of bids|
|---|---|
|**Procurement Manual DI #16**|Bid opening - single envelope|
|**Procurement Manual DI #17**|Bid opening - one stage - two envelopes|
|**Procurement Manual DI #11**|Bid, contract and payment securities|



Dream71 Bangladesh Limited                         Confidential 

Page | 49 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 10. MODULE 7: BID EVALUATION 

## 10.1 Objective 

To facilitate systematic bid evaluation with multiple methodologies, scoring, and Bid Evaluation Report generation. 

## 10.2 Actors 

- Director of Procurement (R-09) 

- Evaluation Committee Member (R-05) 

- Evaluation Committee Chair (R-06) 

- ZPC Member (R-08) 

## 10.3 Preconditions 

|10.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-EVAL-01**|Bid opening is complete|
|**PRE-EVAL-02**|Committee members are assigned|
|**PRE-EVAL-03**|Conflict declarations are completed|



## 10.4 Postconditions 

|10.4 Postconditions||
|---|---|
|**ID**|**Postcondition**|
|**POST-EVAL-01**|All bids are scored and ranked|
|**POST-EVAL-02**|BER is generated and approved|
|**POST-EVAL-03**|Winning bidder is recommended|



## 10.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**EVAL-**<br>**01**|The system SHALL allow<br>Director of Procurement to<br>form Evaluation Committee<br>with at least 3 members.|High|**Given**a Director selects 3 users as<br>committee members,**When**the<br>assignment is saved,**Then**each<br>receives an email with link to accept or<br>decline.|
|**FR-**<br>**EVAL-**<br>**02**|The system SHALL allow each<br>EC member to independently<br>score technical proposals.<br>Members SHALL not see<br>others' scores until after<br>submitting their own.|High|**Given**an EC member is scoring a<br>bid,**When**they view the scoring<br>page,**Then**they see only their own<br>previous scores, not others'.|



Dream71 Bangladesh Limited                         Confidential 

Page | 50 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**EVAL-**<br>**03**|The system SHALL<br>automatically calculate<br>average technical scores and<br>weighted totals.|High|**Given**3 committee members score a<br>bid 70, 80, and 90 on a criterion<br>weighted at 40%,**When**the system<br>calculates,**Then**average is 80,<br>weighted contribution is 32 points.|
|---|---|---|---|
|**FR-**<br>**EVAL-**<br>**04**|For QCBS, the system SHALL<br>calculate combined scores:<br>(Tech Score × Tech Weight) +<br>(Financial Score × Financial<br>Weight).|High|**Given**tech weight 80%, tech score 85,<br>financial score 16,**When**system<br>calculates,**Then**total = (85×0.8)+16 =<br>68+16 = 84.|
|**FR-**<br>**EVAL-**<br>**05**|The system SHALL<br>automatically generate a Bid<br>Evaluation Report with<br>preliminary results, scores,<br>ranking, and recommendation.|High|**Given**evaluation is<br>complete,**When**the Committee Chair<br>clicks "Generate BER",**Then**the<br>system populates the template with all<br>evaluation data and produces a PDF.|
|**FR-**<br>**EVAL-**<br>**06**|The BER SHALL be digitally<br>signed by all committee<br>members and submitted to<br>ZPC for approval.|High|**Given**a BER is generated,**When**each<br>committee member applies their digital<br>signature,**Then**the system records<br>signatures and changes status to<br>"Ready for ZPC Approval."|



## 10.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-EVAL-**<br>**01**|Committee minimum 3 members. Quorum = 2/3 of members.|
|**BR-EVAL-**<br>**02**|Technical weights must sum to 100%.|
|**BR-EVAL-**<br>**03**|Minimum technical score for consulting: typically 70-80 points.|
|**BR-EVAL-**<br>**04**|Tie-breaking: higher technical score wins; if still tied, higher citizen ownership<br>category wins.|



10.7 Workflow / Process Flow 10.7.1 Bid Evaluation (QCBS) Workflow Step 1: Bid opening is complete. All bids are in status "Opened - Under Evaluation". Step 2: Director of Procurement forms Evaluation Committee (3+ members). 

Step 3: Each committee member completes conflict of interest declaration. 

Dream71 Bangladesh Limited                         Confidential 

Page | 51 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## Step 4: Evaluation Committee Chair schedules evaluation meetings. 

Step 5: System grants committee members access to technical envelopes only. 

Step 6: Preliminary Examination (all members): 

- Each member reviews each bid for mandatory compliance 

- System records pass/fail for each criterion 

- Bids failing any mandatory criterion are rejected 

- System flags rejected bids as "Failed Preliminary - Not Considered" 

Step 7: Technical Evaluation (independent scoring): 

- Each member independently scores each remaining bid 

- For each criterion, member enters score (e.g., 0-100) 

- Member can add comments for each score 

- System saves scores but does not reveal other members' scores 

Step 8: After all members have submitted scores: 

- System calculates average score for each criterion 

- System calculates weighted total technical score 

- System displays all members' scores to the committee 

- Chair can facilitate discussion of discrepancies 

Step 9: Committee identifies bids below minimum technical threshold. 

- System marks these bids as "Failed Technical - Financial Sealed" 

- Financial envelopes remain encrypted 

Step 10: For bids that passed technical threshold: 

- Evaluation Committee Chair authorizes opening of financial envelopes 

- System decrypts financial envelopes 

- System displays financial proposals to committee 

Step 11: Financial Evaluation: 

- System corrects arithmetic errors 

- System applies discounts 

- System converts currencies (using Bank of Zambia rates) 

Dream71 Bangladesh Limited                         Confidential 

Page | 52 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

   - System applies preference margins 

   - System calculates financial scores 

- Step 12: Combined Scoring (QCBS): 

- System calculates: (Tech Score × Tech Weight) + (Financial Score × Financial Weight) 

   - System ranks bids by total score 

- Step 13: Committee reviews ranking and selects winning bidder. 

Step 14: Post-qualification verification on winning bidder: 

   - System generates verification checklist 

   - Procurement Officer contacts references and issuing authorities 

   - System tracks verification status 

- Step 15: If verification passes: 

   - Committee Chair prepares BER 

   - System populates BER with all evaluation data 

Step 16: All committee members digitally sign BER. 

Step 17: BER is submitted to ZPC for approval. 

Step 18: ZPC approves BER. 

Step 19: System notifies Procurement Officer to proceed with contract award. 

## 10.8 Relationships 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-EVAL-01**|All committee assignments and conflict declarations|7 years|



Dream71 Bangladesh Limited                         Confidential 

Page | 53 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**AUD-EVAL-02**|All technical scores (individual and averaged)|7 years|
|---|---|---|
|**AUD-EVAL-03**|All financial evaluations and preference applications|7 years|
|**AUD-EVAL-04**|All BER versions and approval decisions|7 years|
|**AUD-EVAL-05**|All post-qualification verification records|7 years|



## 10.10 Compliance References 

|10.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #18**|Evaluation of purchases - general|
|**Procurement Manual DI #19**|General evaluation procedures for consulting<br>services|
|**Procurement Manual DI #20-24**|Specific evaluation methodologies|
|**Procurement Manual GN J-1 to J-**<br>**22**|Evaluation guidance|



Dream71 Bangladesh Limited                         Confidential 

Page | 54 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 11. MODULE 8: CONTRACT AWARD AND MANAGEMENT 

## 11.1 Objective 

To manage contract lifecycle from award through execution, amendments, performance monitoring, and closure. 

## 11.2 Actors 

- Procurement Officer (R-03) 

- Contract Manager (R-12) 

- Supplier User (R-11) 

- Director General (R-10) 

- ZPC Member (R-08) 

- Attorney General (external) 

## 11.3 Preconditions 

|**ID**|**Precondition**|
|---|---|
|**PRE-CON-01**|BER is approved by ZPC|
|**PRE-CON-02**|Waiting period (10 working days) has expired|
|**PRE-CON-03**|Winning bidder has valid tax clearance|



## 11.4 Postconditions 

|**ID**|**Postcondition**|
|---|---|
|**POST-CON-01**|Executed contract is stored with digital signatures|
|**POST-CON-02**|Contract award is published on ZAMMSA website and e-GP|
|**POST-CON-03**|Performance security is validated|
|**POST-CON-04**|Upon closure, file is archived for 7 years|



## 11.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**CON-**<br>**01**|Upon BER approval, the<br>system SHALL generate a<br>Contract Award Notice with<br>winning bidder, value, and<br>10-day waiting period<br>statement.|High|**Given**a BER is approved by<br>ZPC,**When**approval is recorded,**Then**the<br>system generates the award notice and<br>displays a "Publish" button.|



Dream71 Bangladesh Limited                         Confidential 

Page | 55 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**CON-**<br>**02**|The system SHALL enforce<br>a 10-working-day waiting<br>period before contract<br>execution.|High|**Given**an award notice is<br>published,**When**the Procurement Officer<br>attempts to generate the contract within 10<br>days,**Then**the system displays "Cannot<br>execute contract until [date] - waiting period<br>in progress."|
|---|---|---|---|
|**FR-**<br>**CON-**<br>**03**|If an appeal is received, the<br>system SHALL<br>automatically suspend<br>contract execution.|High|**Given**a waiting period is in<br>progress,**When**a supplier submits an<br>appeal,**Then**the system changes status to<br>"Appeal Pending" and notifies the Director of<br>Procurement.|
|**FR-**<br>**CON-**<br>**04**|The system SHALL support<br>digital signing by supplier<br>and Director General using<br>government PKI.|High|**Given**a contract is generated,**When**the<br>supplier logs in and clicks "Sign<br>Contract",**Then**the system applies digital<br>signature and notifies DG for<br>countersignature.|
|**FR-**<br>**CON-**<br>**05**|The system SHALL track<br>total variation and enforce<br>25% cumulative cap.<br>Amendments exceeding<br>cap SHALL require legal<br>review.|High|**Given**a contract of K1,000,000 with existing<br>amendments totaling K240,000<br>(24%),**When**a Contract Manager attempts<br>a K20,000 amendment,**Then**the system<br>displays "Would exceed 25% cap. Legal<br>review required."|
|**FR-**<br>**CON-**<br>**06**|The system SHALL<br>automatically calculate<br>liquidated damages for late<br>deliveries, capped at 10%<br>of contract value.|High|**Given**a contract of K1,000,000 with 0.5%<br>weekly rate, delivery 14 days late (2<br>weeks),**When**the system<br>calculates,**Then**LD = K1,000,000 × 0.5% ×<br>2 = K10,000.|
|**FR-**<br>**CON-**<br>**07**|Upon contract completion,<br>the system SHALL guide<br>the Contract Manager<br>through a closure checklist.|Medium|**Given**all deliverables are<br>complete,**When**the Contract Manager<br>initiates closure,**Then**the system displays a<br>checklist and blocks closure until all items<br>are checked.|



## 11.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-CON-**<br>**01**|Performance security: 5-10% of contract value, valid until 60 days after<br>completion.|
|**BR-CON-**<br>**02**|Advance payment maximum: 25%, requires advance payment guarantee.|



Dream71 Bangladesh Limited                         Confidential 

Page | 56 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**BR-CON-**|Liquidated damages cap: 10% of contract value.|
|---|---|
|**03**||
|**BR-CON-**|Contract files archived for 7 years.|
|**04**||



11.7 Workflow / Process Flow 11.7.1 Contract Award and Execution Workflow Step 1: BER is approved by ZPC. 

Step 2: System generates Contract Award Notice. 

Step 3: Procurement Officer publishes award notice (ZAMMSA website, e-GP portal). 

Step 4: System sends award notification to winning supplier. 

Step 5: System starts 10-working-day waiting period timer. 

Step 6: During waiting period, system monitors for appeals. 

Step 7: If appeal received: 

- Status changes to "Appeal Pending" 

- Director of Procurement reviews appeal 

- If appeal upheld: procurement may be cancelled or re-evaluated 

- If appeal rejected: waiting period continues 

Step 8: After waiting period expires (and no pending appeals): 

- Status changes to "Ready for Contract Generation" 

- Procurement Officer clicks "Generate Contract" 

Step 9: System determines contract type (PO or EXC) based on value. 

Step 10: System populates contract template with data. 

Step 11: Procurement Officer reviews generated contract. 

Step 12: Procurement Officer sends contract to supplier for signature. 

Step 13: Supplier logs into portal, reviews contract, clicks "Sign". 

Step 14: System applies supplier's digital signature. 

Step 15: System notifies Director General for countersignature. 

Step 16: Director General reviews and applies digital signature. 

Step 17: Contract status changes to "Executed". 

Dream71 Bangladesh Limited                         Confidential 

Page | 57 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 18: If performance security required (>K1,000,000): 

- System prompts supplier to upload security 

- Status changes to "Pending Performance Security" 

- Procurement Officer validates security 

- Status changes to "Active" after validation 

Step 19: Contract is now active. 

Step 20: System assigns Contract Manager. 

Step 21: System creates contract milestones based on delivery schedule. 

11.7.2 Contract Amendment Workflow 

Step 1: Contract Manager identifies need for amendment (e.g., scope change, price adjustment, time extension). 

Step 2: Contract Manager clicks "Request Amendment" on contract. 

Step 3: System displays amendment form. 

Step 4: Contract Manager enters: 

- Amendment reason (dropdown) 

- Description of changes 

- Financial impact (if any) 

- New dates (if applicable) 

Step 5: System calculates new total contract value and cumulative variation percentage. 

Step 6: If cumulative variation ≤ 25%: 

- Amendment proceeds to standard approval 

- Approval required: Contract Manager → Procurement Manager → Director of Procurement 

Step 7: If cumulative variation > 25%: 

- System blocks direct approval 

- Displays: "Amendment would exceed 25% cap. Legal review required." 

- Contract Manager submits to Attorney General for legal review 

- Step 8: Attorney General reviews and provides legal opinion. 

Step 9: If legal opinion favorable, amendment proceeds to ZPC approval. 

Step 10: ZPC approves or rejects amendment. 

Dream71 Bangladesh Limited                         Confidential 

Page | 58 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 11: If approved, system generates amendment document. 

Step 12: Supplier signs amendment digitally. 

Step 13: ZAMMSA countersigns. 

Step 14: System updates contract with amended values. 

Step 15: System logs amendment in contract history. 

## 11.8 Relationships 

## 11.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-CON-01**|All contract award notices and publications|7 years|
|**AUD-CON-02**|All contract versions and digital signatures|7 years|
|**AUD-CON-03**|All amendments and variation calculations|7 years|
|**AUD-CON-04**|All milestone status changes|7 years|
|**AUD-CON-05**|All termination decisions and legal reviews|7 years|



## 11.10 Compliance References 

|11.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #28**|Contract award|
|**Procurement Manual DI #29**|Contract administration and management|
|**Procurement Manual DI #30**|Contract amendments|
|**Procurement Manual DI #31**|Contract completion|
|**Procurement Manual DI #32**|Contract termination|



Dream71 Bangladesh Limited                         Confidential 

Page | 59 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 12. MODULE 9: FINANCIAL TRACKING AND BUDGET CONTROL 

## 12.1 Objective 

To provide real-time budget visibility, encumbrance management, invoice processing, and payment workflows. 

## 12.2 Actors 

- Finance Officer (R-07) 

- Budget Controller (R-18) 

- Supplier User (R-11) 

- Contract Manager (R-12) 

- ERP System (automated) 

## 12.3 Preconditions 

|**ID**|**Precondition**|
|---|---|
|**PRE-FIN-01**|Budget data is loaded from ERP|
|**PRE-FIN-02**|Contract is executed and active|
|**PRE-FIN-03**|GRN is created in WMS (for goods)|



## 12.4 Postconditions 

|**ID**|**Postcondition**|
|---|---|
|**POST-FIN-01**|Encumbrance is created for approved requisitions|
|**POST-FIN-02**|Invoices are matched against PO and GRN|
|**POST-FIN-03**|Payments are processed and recorded|



## 12.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**FIN-**<br>**01**|The system SHALL<br>integrate with ERP to<br>receive budget allocations<br>across National,<br>Provincial, District, Facility<br>levels.|High|**Given**the ERP updates a district<br>budget,**When**the daily sync runs,**Then**the<br>procurement system reflects the new budget<br>within 24 hours.|
|**FR-**<br>**FIN-**<br>**02**|The system SHALL<br>display budget utilization:|High|**Given**a department has allocated K1,000,000,<br>encumbered K200,000, expended<br>K150,000,**When**a Finance Officer views|



Dream71 Bangladesh Limited                         Confidential 

Page | 60 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||allocated, encumbered,<br>expended, available.||dashboard,**Then**available displays as<br>K650,000.|
|---|---|---|---|
|**FR-**<br>**FIN-**<br>**03**|When a requisition is<br>approved, the system<br>SHALL create an<br>encumbrance via ERP<br>API.|High|**Given**a requisition for K100,000 is<br>approved,**When**approval completes,**Then**the<br>system calls ERP API to create encumbrance,<br>and available budget decreases by K100,000.|
|**FR-**<br>**FIN-**<br>**04**|The system SHALL<br>perform 3-way matching<br>between PO, GRN, and<br>Invoice.|High|**Given**a PO for 100 units at K10 each, GRN<br>shows 95 units, invoice shows 100<br>units,**When**the system performs<br>matching,**Then**it flags quantity discrepancy<br>and suggests payment for 95 units (K950).|
|**FR-**<br>**FIN-**<br>**05**|The system SHALL<br>integrate with banking<br>system via SFTP (ISO<br>20022) for payment<br>processing.|High|**Given**an invoice is approved for<br>payment,**When**the Finance Officer clicks<br>"Process Payment",**Then**the system<br>generates an ISO 20022 file and places it in the<br>SFTP outbox for the bank.|
|**FR-**<br>**FIN-**<br>**06**|The system SHALL<br>support Letter of Credit<br>management (irrevocable,<br>confirmed, sight, usance,<br>deferred payment).|Medium|**Given**a procurement requires LoC,**When**the<br>Finance Officer creates an LoC<br>request,**Then**the system tracks status from<br>"Requested" to "Issued" to "Claimed."|



## 12.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-**<br>**FIN-01**|Payment approval thresholds: Finance Officer (≤K100,000), Dept Head (K100,001-<br>K500,000), DG (>K500,000).|
|**BR-**<br>**FIN-02**|Retention: 5-10% withheld, released upon final acceptance.|
|**BR-**<br>**FIN-03**|No payment without 3-way matching approval.|
|**BR-**<br>**FIN-04**|Payment terms: 30 days from invoice approval (standard).|



12.7 Workflow / Process Flow 

12.7.1 Invoice Processing and Payment Workflow Step 1: Supplier delivers goods or completes service milestone. 

Dream71 Bangladesh Limited                         Confidential 

Page | 61 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 2: Stores/Warehouse Officer creates Goods Receipt Note (GRN) in WMS. 

- Step 3: WMS sends webhook to procurement system with GRN data. 

- Step 4: Procurement system updates contract milestone status. 

- Step 5: Supplier logs into portal and submits invoice: 

- Selects Purchase Order/Contract 

- Enters invoice number and date 

- Uploads invoice PDF 

- Enters amount 

- Step 6: System performs 3-way matching: 

- Retrieves PO (quantity, unit price) 

- Retrieves GRN (quantity received) 

- Compares with invoice (quantity, price) 

- Step 7: System displays matching results: 

- Green: All match 

- Yellow: Partial match (e.g., quantity discrepancy) 

- Red: No match (e.g., no GRN) 

- Step 8: If complete match: 

- Invoice status = "Ready for Approval" 

- Routes to Finance Officer 

- Step 9: If partial match: 

- Invoice status = "Discrepancy - Requires Review" 

- Finance Officer reviews and can: 

   - Accept as is (with reason) 

   - Request supplier correction 

Step 10: Finance Officer reviews invoice and approves (or rejects). 

Step 11: If value exceeds Finance Officer threshold, invoice routes to Department Head. 

Step 12: Department Head approves. 

Dream71 Bangladesh Limited                         Confidential 

Page | 62 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

Step 13: If value exceeds K500,000, invoice routes to Director General. 

- Step 14: Director General approves. 

Step 15: Invoice status = "Approved for Payment". 

- Step 16: Finance Officer schedules payment (immediate or batch). 

- Step 17: System generates ISO 20022 payment file. 

- Step 18: System encrypts file with PGP. 

- Step 19: System places file in SFTP outbox for bank. 

- Step 20: Bank processes payment. 

- Step 21: Bank sends payment confirmation webhook. 

- Step 22: System updates invoice status to "Paid". 

- Step 23: System sends payment advice to supplier. 

- Step 24: System posts expenditure to ERP for general ledger. 

12.7.2 Budget Encumbrance Workflow Step 1: Requisition is submitted with estimated value. 

Step 2: System calls ERP API to check available budget. 

Step 3: ERP returns available amount. 

Step 4: If available ≥ requested: 

- System calls ERP API to create encumbrance 

- ERP returns encumbrance reference 

- System stores encumbrance reference 

- Available budget decreases by requested amount 

Step 5: Requisition proceeds through approval. 

Step 6: When contract is awarded: 

- System calls ERP API to convert encumbrance to commitment 

- Actual contract value may be less than encumbrance 

- Excess encumbrance is released 

Step 7: When contract is completed: 

- System calls ERP API to release remaining encumbrance 

Dream71 Bangladesh Limited                         Confidential 

Page | 63 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Available budget increases 

## Step 8: If requisition is cancelled: 

- System calls ERP API to release encumbrance 

## 12.8 Relationships 

## 12.11 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-FIN-01**|All budget validation requests and responses|7 years|
|**AUD-FIN-02**|All encumbrance creations, conversions, and releases|7 years|
|**AUD-FIN-03**|All invoice submissions, approvals, and payments|7 years|
|**AUD-FIN-04**|All 3-way matching results and discrepancies|7 years|
|**AUD-FIN-05**|All payment files generated (ISO 20022)|7 years|
|**AUD-FIN-06**|All LoC issuances and claims|7 years|



## 12.12 Compliance References 

|12.12 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #29**|Contract administration and management|
|**Procurement Manual GN R**|Payments by Letters of Credit|
|**Public Financial Management Act**|Budget execution and controls|



Dream71 Bangladesh Limited                         Confidential 

Page | 64 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 13. MODULE 10: SUPPLIER PERFORMANCE MANAGEMENT 

## 13.1 Objective 

To maintain supplier database, manage performance evaluations, risk scoring, and enforce eligibility. 

## 13.2 Actors 

- Supplier User (R-11) 

- Supplier Relationship Manager (R-17) 

- Contract Manager (R-12) 

- ZPPA (automated) 

## 13.3 Preconditions 

|13.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-SUP-01**|Supplier portal is accessible|
|**PRE-SUP-02**|External APIs (ZRA, PACRA, CEEC) are available|



## 13.4 Postconditions 

|**ID**|**Postcondition**|
|---|---|
|**POST-SUP-01**|Supplier profile is created with validated documents|
|**POST-SUP-02**|Performance evaluations are recorded|
|**POST-SUP-03**|Risk scores are calculated monthly|
|**POST-SUP-04**|Debarred suppliers are blocked from bidding|



## 13.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**SUP-**<br>**01**|The system SHALL provide a<br>public supplier registration portal<br>with document upload.|High|**Given**a new supplier visits the<br>portal,**When**they complete registration<br>and upload required<br>documents,**Then**account is created<br>with status "Pending Verification."|
|**FR-**<br>**SUP-**<br>**02**|The system SHALL<br>automatically validate tax<br>clearance with ZRA (real-time<br>API), company registration with|High|**Given**a supplier submits tax clearance<br>number,**When**the system calls ZRA<br>API,**Then**if valid, status is "Verified"; if<br>invalid, registration is rejected.|



Dream71 Bangladesh Limited                         Confidential 

Page | 65 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

||PACRA (real-time), CEEC<br>certification (real-time).|||
|---|---|---|---|
|**FR-**<br>**SUP-**<br>**03**|The system SHALL integrate<br>with ZPPA debarment list (daily<br>sync) and automatically flag<br>debarred suppliers.|High|**Given**a supplier is added to ZPPA<br>debarment list,**When**the daily sync<br>runs,**Then**supplier status changes to<br>"Debarred" and they cannot submit bids.|
|**FR-**<br>**SUP-**<br>**04**|The system SHALL calculate<br>supplier risk score using:<br>delivery delays (40%), quality<br>issues (30%), financial stability<br>(20%), regulatory compliance<br>(10%). Risk levels: Low (0-30),<br>Medium (31-60), High (61-100).|Medium|**Given**a supplier has 3 delivery delays<br>in last 12 months,**When**risk score is<br>calculated,**Then**delivery delay<br>component adds 20 points, potentially<br>moving to Medium/High risk.|
|**FR-**<br>**SUP-**<br>**05**|When supplier risk score<br>reaches "High," the system<br>SHALL send alerts to<br>Procurement Manager and<br>Contract Managers.|Medium|**Given**a supplier's risk score becomes<br>75 (High),**When**score is<br>updated,**Then**all relevant managers<br>receive email notifications within 5<br>minutes.|



## 13.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-SUP-**<br>**01**|Debarred suppliers ineligible for bidding.|
|**BR-SUP-**<br>**02**|Tax clearance must be valid; expired blocks bidding.|
|**BR-SUP-**<br>**03**|Performance evaluations: quarterly for active contracts, annually for all.|
|**BR-SUP-**<br>**04**|Three consecutive evaluations below 60 may lead to debarment<br>recommendation.|



13.7 Workflow / Process Flow 13.7.1 Supplier Registration Workflow Step 1: Supplier visits public registration portal. 

Step 2: Supplier clicks "Register as Supplier". 

Step 3: Supplier enters basic information: 

- Company name 

Dream71 Bangladesh Limited                         Confidential 

Page | 66 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

- Registration number 

- Tax Identification Number (TIN) 

- CEEC certificate number (if applicable) 

- Contact person name, email, phone 

- Physical address 

- Step 4: System validates TIN with PACRA API. 

- If invalid: registration blocked 

- If valid: system retrieves company details 

Step 5: System validates CEEC certificate with CEEC API (if provided). Step 6: Supplier uploads required documents: 

- Certificate of Incorporation 

- Tax Clearance Certificate 

- NAPSA Compliance Certificate 

- CEEC Certificate (if applicable) 

- Professional licenses 

- Bank account confirmation letter 

Step 7: Supplier creates login credentials. 

Step 8: System creates account with status "Pending Verification". 

Step 9: Supplier Relationship Manager receives notification. 

Step 10: Supplier Relationship Manager reviews documents: 

- Verifies authenticity 

- Checks expiry dates 

- Approves or rejects with reason 

Step 11: If approved, status changes to "Active". 

Step 12: If rejected, supplier receives email with reason and can resubmit. 

Step 13: System performs initial risk assessment based on company age, capital, and past performance (if available). 

Step 14: Supplier can now view tenders and submit bids. 

Dream71 Bangladesh Limited                         Confidential 

Page | 67 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

13.7.2 Supplier Performance Evaluation Workflow Step 1: Contract is completed or quarter ends. 

- Step 2: System sends evaluation reminder to Contract Manager. 

Step 3: Contract Manager accesses supplier evaluation form. 

- Step 4: Contract Manager rates supplier on metrics: 

- Delivery timeliness: (on-time deliveries / total deliveries) × 100 

- Quality compliance: (accepted goods / total goods) × 100 

- Contract adherence: compliance with terms (subjective 0-100) 

- Responsiveness: time to respond to queries (0-100) 

- Technical support: quality of support (0-100) 

- Step 5: System calculates overall score (average of metrics). 

- Step 6: Contract Manager adds comments and recommendations. 

- Step 7: System saves evaluation. 

- Step 8: Supplier Relationship Manager reviews evaluation. 

- Step 9: If score < 60: 

- System flags supplier for review 

- Supplier Relationship Manager may schedule improvement plan 

- Step 10: System updates supplier's performance history. 

Step 11: System recalculates risk score. 

## 13.8 Relationships 

Dream71 Bangladesh Limited                         Confidential 

Page | 68 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 13.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-SUP-01**|All supplier registrations and document submissions|7 years|
|**AUD-SUP-02**|All external validation requests (ZRA, PACRA, CEEC)|7 years|
|**AUD-SUP-03**|All performance evaluations and score changes|7 years|
|**AUD-SUP-04**|All risk score calculations and changes|7 years|
|**AUD-SUP-05**|All debarment and blacklist actions|7 years|



## 13.10 Compliance References 

|13.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #5**|Selection of bidders|
|**Procurement Manual GN S**|Supplier performance management - liquidated damages|
|**Procurement Manual GN T**|Supplier performance management|
|**Procurement Policy Section 12**|Eligibility of bidders|



Dream71 Bangladesh Limited                         Confidential 

Page | 69 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 14. MODULE 11: PREDICTIVE ANALYTICS AND REPORTING 

## 14.1 Objective 

To provide dashboards, regulatory reports, predictive analytics, and automated archiving. 

## 14.2 Actors 

- Director General (R-10) 

- Procurement Manager (R-04) 

- ZPPA Reporting Officer (R-16) 

- Procurement Data Analyst (R-19) 

- Auditor (R-14) 

## 14.3 Preconditions 

|14.3 Preconditions||
|---|---|
|**ID**|**Precondition**|
|**PRE-REP-01**|Transactional data is loaded into data warehouse|
|**PRE-REP-02**|ETL jobs are scheduled|
|**PRE-REP-03**|ML models are trained (Phase 3)|



## 14.4 Postconditions 

|14.4 Postconditions||
|---|---|
|**ID**|**Postcondition**|
|**POST-REP-01**|Dashboards display real-time metrics|
|**POST-REP-02**|Regulatory reports are generated on schedule|
|**POST-REP-03**|Completed files are archived with 7-year retention|



## 14.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**REP-**<br>**01**|The system SHALL provide an<br>Executive Dashboard with:<br>total procurement value YTD,<br>budget utilization, active<br>contracts, supplier<br>performance index,<br>procurements by method (pie<br>chart).|High|**Given**an executive logs in,**When**they<br>view the dashboard,**Then**all metrics<br>refresh automatically every 5 minutes.|



Dream71 Bangladesh Limited                         Confidential 

Page | 70 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**REP-**<br>**02**|The system SHALL generate<br>Quarterly Procurement Report<br>for ZPPA following ZPPA<br>schema.|High|**Given**a ZPPA Reporting Officer selects<br>"Generate Quarterly Report,"**When**they<br>select the quarter,**Then**the system<br>produces an Excel file matching ZPPA's<br>template with validated data.|
|---|---|---|---|
|**FR-**<br>**REP-**<br>**03**|The system SHALL generate<br>Direct Bidding Report monthly.|High|**Given**the end of the month,**When**the<br>scheduled job runs,**Then**the system<br>generates the report and emails it to the<br>ZPPA Reporting Officer.|
|**FR-**<br>**REP-**<br>**04**|The system SHALL<br>automatically archive<br>completed procurement files<br>after contract closure.<br>Archived files SHALL include<br>all related documents.|High|**Given**a contract is marked<br>"Completed,"**When**closure is<br>finalized,**Then**the system compresses<br>all related documents into a single archive<br>and moves to long-term storage.|
|**FR-**<br>**REP-**<br>**05**|The system SHALL enforce 7-<br>year retention. Generate alerts<br>90 days before expiry, auto-<br>delete after 7 years unless<br>legal hold placed.|Medium|**Given**a file is 6 years 9 months<br>old,**When**monthly retention check<br>runs,**Then**system sends alert to Records<br>Manager that deletion is pending in 90<br>days.|
|**FR-**<br>**REP-**<br>**06**|(Phase 3) The system SHALL<br>use machine learning to<br>forecast medicine demand<br>based on historical<br>consumption, seasonality, and<br>epidemiological data.|Low|**Given**3 years of historical consumption<br>data,**When**the forecasting model runs<br>monthly,**Then**it generates predicted<br>quantities for next 6 months with<br>confidence intervals.|



## 14.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-REP-01**|Quarterly reports to ZPPA within 30 days of quarter end.|
|**BR-REP-02**|Direct Bidding reports within 14 days of month end.|
|**BR-REP-03**|Contract termination reported to ZPPA within 14 days.|
|**BR-REP-04**|Archived files encrypted with access logs.|
|**BR-REP-05**|Dashboard data refreshes every 15 minutes during business hours.|



Dream71 Bangladesh Limited                         Confidential 

Page | 71 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 14.7 Workflow / Process Flow 

14.7.1 Automated Archiving Workflow Step 1: Contract status changes to "Completed" or "Terminated". 

Step 2: System waits 30 days (to allow for any post-completion activities). 

Step 3: System identifies all documents related to the procurement: 

- Requisition and specifications 

- APP and CPP references 

- Solicitation and addenda 

- All bid submissions (including unsuccessful) 

- Evaluation scores and BER 

- Contract and amendments 

- Payment and invoice records 

- Audit logs for all actions 

Step 4: System compresses documents into a single archive file (ZIP with AES-256 encryption). 

Step 5: System generates metadata for the archive: procurement ID, supplier name, contract value, dates, retention expiry date. 

Step 6: System moves archive to long-term storage (separate from active database). 

Step 7: System marks original records as "Archived" in active database (metadata only, content removed). 

Step 8: System logs archiving event. 

Step 9: Monthly retention check runs: 

- Identifies archives with retention expiry date < current date + 90 days 

- Sends alert to Records Manager 

Step 10: On retention expiry date: 

- If no legal hold: System permanently deletes archive 

- If legal hold: System retains until hold is lifted 

Dream71 Bangladesh Limited                         Confidential 

Page | 72 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 14.8 Relationships 

## 14.9 Audit & Compliance Requirements 

|**ID**|**Audit Requirement**|**Retention**|
|---|---|---|
|**AUD-REP-01**|All report generation events (who, when, which report)|7 years|
|**AUD-REP-02**|All regulatory report submissions (content and timestamp)|7 years|
|**AUD-REP-03**|All archiving events and retention actions|7 years|
|**AUD-REP-04**|All archive access events (who accessed, when, which file)|7 years|
|**AUD-REP-05**|All legal hold placements and removals|7 years|



## 14.10 Compliance References 

|14.10 Compliance References||
|---|---|
|**Reference**|**Requirement**|
|**Procurement Manual DI #36**|Reporting and archiving|
|**Procurement Policy Section 13**|Submission of reports to the Authority|



Dream71 Bangladesh Limited                         Confidential 

Page | 73 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 15. MODULE 12: SYSTEM INTEGRATION 

## 15.1 Objective 

To enable integration with external systems: ERP, WMS, e-GP, banking, government validation services. 

## 15.2 Actors 

- Integration Manager (R-20) 

- External Systems (automated) 

- System Administrator (R-13) 

## 15.3 Preconditions 

|**ID**|**Precondition**|
|---|---|
|**PRE-INT-01**|External APIs are available|
|**PRE-INT-02**|Credentials are provisioned|
|**PRE-INT-03**|Network connectivity established|



## 15.4 Postconditions 

|**ID**|**Postcondition**|
|---|---|
|**POST-INT-01**|Data is synchronized as per schedule|
|**POST-INT-02**|Integration failures are logged and alerted|
|**POST-INT-03**|All transmissions are encrypted|



## 15.5 Functional Requirements 

|**ID**|**Requirement**|**Priority Acceptance Criteria**|**Priority Acceptance Criteria**|
|---|---|---|---|
|**FR-**<br>**INT-**<br>**01**|The system SHALL integrate<br>with ERP via REST API for<br>budget validation (sync),<br>expenditure posting (async<br>batch), vendor sync (daily).|High|**Given**a requisition requires budget<br>validation,**When**the system calls the<br>ERP API,**Then**it receives a response<br>within 2 seconds indicating budget<br>available or insufficient.|
|**FR-**<br>**INT-**<br>**02**|The system SHALL integrate<br>with WMS via webhooks to<br>receive goods receipt<br>notifications and trigger invoice<br>matching.|High|**Given**a WMS user creates a GRN for a<br>PO,**When**the webhook is sent,**Then**the<br>procurement system updates contract<br>milestone status within 5 seconds.|



Dream71 Bangladesh Limited                         Confidential 

Page | 74 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**FR-**<br>**INT-**<br>**03**|The system SHALL integrate<br>with e-GP portal via REST API<br>and SFTP to publish tenders,<br>receive bids, sync awards.|High|**Given**a solicitation is<br>published,**When**the Procurement Officer<br>clicks "Publish to e-GP,"**Then**the system<br>sends the notice via API and stores<br>confirmation receipt.|
|---|---|---|---|
|**FR-**<br>**INT-**<br>**04**|The system SHALL integrate<br>with ZRA via REST API for<br>real-time tax clearance<br>validation during registration<br>and bidding.|High|**Given**a supplier submits a tax clearance<br>number,**When**the system calls ZRA<br>API,**Then**it returns "Valid" or "Invalid"<br>with expiry date.|
|**FR-**<br>**INT-**<br>**05**|The system SHALL integrate<br>with PACRA via REST API to<br>validate company registration<br>and retrieve director<br>information.|High|**Given**a supplier registers with a company<br>registration number,**When**the system<br>calls PACRA API,**Then**it returns<br>company name, status, and director list.|
|**FR-**<br>**INT-**<br>**06**|The system SHALL integrate<br>with CEEC via REST API to<br>validate citizen ownership<br>category.|High|**Given**a supplier provides a CEEC<br>certificate number,**When**the system calls<br>CEEC API,**Then**it returns category and<br>expiry date.|
|**FR-**<br>**INT-**<br>**07**|The system SHALL integrate<br>with banking system via SFTP<br>(ISO 20022, PGP encrypted)<br>for payments and receive<br>confirmation webhooks.|High|**Given**a payment is processed,**When**the<br>bank sends a confirmation<br>webhook,**Then**the system updates<br>invoice status to "Paid" and records<br>transaction reference.|
|**FR-**<br>**INT-**<br>**08**|(Phase 3) The system SHALL<br>integrate with Smart Zambia<br>via SAML 2.0 for Single Sign-<br>On.|Medium|**Given**a ZAMMSA employee attempts to<br>log in,**When**they click "Login with<br>Government SSO,"**Then**they are<br>redirected to the government login page,<br>and upon success, logged into the<br>system.|
|**FR-**<br>**INT-**<br>**09**|The system SHALL implement<br>retry logic for failed API calls:<br>exponential backoff (1s, 2s, 4s,<br>8s, 16s), max 5 retries. After 5<br>failures, alert Integration<br>Manager.|High|**Given**an external API returns a 5xx<br>error,**When**the retry mechanism is<br>triggered,**Then**the system retries with<br>increasing delays and logs each attempt.|
|**FR-**<br>**INT-**<br>**10**|The system SHALL maintain<br>integration logs (timestamp,<br>endpoint, response status,<br>response time) for 90 days.|Medium|**Given**an API call is made,**When**the<br>response is received,**Then**the system<br>logs the call with response time and status<br>for future troubleshooting.|



Dream71 Bangladesh Limited                         Confidential 

Page | 75 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 15.6 Business Rules 

|**ID**|**Business Rule**|
|---|---|
|**BR-INT-01**|API timeout: 10 seconds.|
|**BR-INT-02**|Integration logs retained for 90 days.|
|**BR-INT-03**|API versioning: /v1/, /v2/. Backward compatibility for 12 months.|
|**BR-INT-04**|All transmissions encrypted with TLS 1.3.|
|**BR-INT-05**|Rate limit: 100 requests per minute per client; HTTP 429 if exceeded.|
|**BR-INT-06**|Webhook signatures required (HMAC-SHA256).|



## 15.7 Workflow / Process Flow 

15.7.1 Budget Validation Integration Workflow (Synchronous) Step 1: User submits requisition. 

Step 2: System constructs API request to ERP: 

- URL: https://erp.zammsa.gov.zm/api/v1/budget/validate 

- Method: POST 

- Headers: Authorization: Bearer {token}, Content-Type: application/json 

- Body: { "department": "DEPT-01", "fiscalYear": "2026", "amount": 100000 } 

Step 3: System sends request with 10-second timeout. 

Step 4. ERP validates budget and returns response: 

- Success: { "available": true, "availableAmount": 500000, "encumbranceRef": "ENC-12345" } 

- Failure: { "available": false, "availableAmount": 50000, "message": "Insufficient funds" } 

Step 5: System processes response: 

- If success: Creates encumbrance, proceeds with requisition 

- If failure: Displays error to user, prevents submission 

Step 6: System logs API call with response time and status. 

Step 7: If API call fails (timeout or 5xx error): 

- Retry with exponential backoff (max 3 retries) 

- If all retries fail: Display error, alert Integration Manager 

Dream71 Bangladesh Limited                         Confidential 

Page | 76 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

15.7.2 WMS Goods Receipt Webhook Workflow (Event-Driven) Step 1: WMS user creates Goods Receipt Note for a purchase order. 

Step 2: WMS constructs webhook payload: 

- URL: https://procurement.zammsa.gov.zm/api/v1/webhooks/wms/grn 

- Body: { "poNumber": "PO-2026-00123", "grnNumber": "GRN-2026-04567", "items": [...], "receivedAt": "2026-04-04T10:30:00Z" } 

Step 3: WMS sends POST request to procurement system. 

Step 4: Procurement system verifies webhook signature using shared secret. 

Step 5: Procurement system validates that PO exists and is active. 

Step 6: Procurement system updates contract milestone status for the PO. 

Step 7: Procurement system triggers invoice matching for any pending invoices. 

Step 8: Procurement system returns HTTP 200 OK response. 

Step 9: If validation fails, procurement system returns HTTP 400 with error details. 

Step 10: Procurement system logs webhook receipt. 

15.8 Relationships 

## 15.8 Audit & Compliance Requirements 

**==> picture [448 x 122] intentionally omitted <==**

**----- Start of picture text -----**<br>
||||
|---|---|---|
|ID|Audit Requirement|Retention|
|AUD-INT-01|All API calls (request/response metadata)|90 days|
|AUD-INT-02|All authentication token generations and rotations|90 days|
|AUD-INT-03|All webhook receipts|90 days|
|AUD-INT-04|All integration configuration changes|7 years|
|AUD-INT-05|All data synchronization jobs (success/failure)|90 days|

**----- End of picture text -----**<br>


## 15.9 Compliance References 

**Reference Requirement** 

Dream71 Bangladesh Limited                         Confidential 

Page | 77 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**Procurement Manual DI #34**|Storage and distribution|
|---|---|
|**Procurement Policy Section 8.0**|E-Procurement|
|**ISO 27001**|Information security controls for integrations|



Dream71 Bangladesh Limited                         Confidential 

Page | 78 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 16. NON-FUNCTIONAL REQUIREMENTS 

## 16.1 Performance Requirements 

||**ID**||**Requirement**<br>**Target**<br>**Acceptance Criteria**|||
|---|---|---|---|---|---|
||**NFR-**||Page load time<br>< 3 seconds for<br>Load test with 100 concurrent users|||
||**01**||(standard operations)<br>95% of requests<br>shows 95th percentile < 3 seconds|||
||**NFR-**||Bid opening (500<br>< 5 seconds<br>Test with 500 test bids shows|||
||**02**||submissions)<br>opening complete within 5 seconds|||
||**NFR-**||Standard report<br>< 30 seconds<br>Quarterly report generates within 30|||
||**03**||generation<br>seconds for 1,000 procurements|||
||**NFR-**||Complex report<br>Progress indicator,<br>User sees progress bar; report|||
||**04**||generation<br>may take longer<br>completes within 2 minutes|||
|16.2 Availability Requirements||||||
|**ID**<br>**Requirement**<br>**Target**<br>**Acceptance Criteria**<br>**NFR-**<br>**05**<br>System uptime (business<br>hours: Mon-Fri, 8 AM - 5<br>PM CAT)<br>99.5%<br>Monthly uptime shows < 3.6<br>hours of downtime outside<br>scheduled maintenance<br>**NFR-**<br>**06**<br>Planned maintenance<br>Maximum 4 hours<br>per month, outside<br>business hours<br>Maintenance scheduled and<br>communicated 7 days in<br>advance<br>**NFR-**<br>**07**<br>Disaster recovery<br>RTO ≤ 4 hours, RPO<br>≤ 15 minutes<br>Documented DR plan tested<br>quarterly<br>16.3 Security Requirements<br>**ID**<br>**Requirement**<br>**Acceptance Criteria**<br>**NFR-**<br>**08**<br>Passwords encrypted with bcrypt (cost<br>factor 12)<br>Code review confirms no plaintext storage<br>**NFR-**<br>**09**<br>Protected against OWASP Top 10 (SQL<br>Injection, XSS, CSRF)<br>Security scan (OWASP ZAP) shows no<br>critical/high vulnerabilities<br>**NFR-**<br>**10**<br>TLS 1.3 for all transmissions<br>SSL Labs test shows TLS 1.3 only, no<br>weak ciphers<br>**NFR-**<br>**11**<br>Role-Based Access Control enforced<br>Penetration test confirms users cannot<br>access unauthorized data<br> ~~—=~~<br>~~te~~||||||
|Dream71 Bangladesh Limited                         Confidential|||Dream71 Bangladesh Limited                         Confidential<br>Page |79|||



**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 16.4 Scalability Requirements 

|**ID**|**Requirement**|**Acceptance Criteria**|
|---|---|---|
|**NFR-**<br>**12**|Support 500 concurrent<br>users|Load test shows response times within NFR-01 limits|
|**NFR-**<br>**13**|Horizontal scaling for web<br>tier|Additional app servers can be added without<br>configuration changes|
|**NFR-**<br>**14**|Database read replicas for<br>reporting|Analytical queries routed to replicas, not primary|



## 16.5 Operational Requirements 

|**ID**|**Requirement**|**Acceptance Criteria**|
|---|---|---|
|**NFR-**<br>**15**|Monitoring: API response times, error rates,<br>queue depths, DB connection pool|Prometheus/Grafana dashboards<br>available|
|**NFR-**<br>**16**|Alerting: API error rate >5% for 2 minutes,<br>queue depth >1000|Alerts sent to Integration Manager<br>via email/SMS|
|**NFR-**<br>**17**|Logging: Centralized ELK stack|All logs searchable, retained 90<br>days (audit logs 7 years)|
|**NFR-**<br>**18**|Backup: Daily full, hourly incremental, offsite<br>copy|Restore tested monthly|



## 16.6 Usability Requirements 

|**ID**|**Requirement**|**Acceptance Criteria**|
|---|---|---|
|**NFR-**<br>**19**|Non-technical user proficient<br>within 2 days training|UAT with 5 users shows 80% complete core tasks<br>without assistance on day 2|
|**NFR-**<br>**20**|WCAG 2.1 Level AA compliance|Accessibility audit passes|
|**NFR-**<br>**21**|Mobile-responsive interface|System usable on tablet (minimum 768px width)|



Dream71 Bangladesh Limited                         Confidential 

Page | 80 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

## 17. APPENDICES Appendix A: Requirement Count Summary 

|**Module**|**Functional**<br>**Requirements**|**Business**<br>**Rules**|**Validation**<br>**Rules**|**Exception**<br>**Handlers**|**Audit**<br>**Requirements**|
|---|---|---|---|---|---|
|**1. User**<br>**Management**|17|6|6|5|8|
|**2. Procurement**<br>**Planning**|14|6|5|4|6|
|**3. Requisition**<br>**Management**|13|6|7|4|5|
|**4. Method**<br>**Selection**|12|6|4|3|4|
|**5. Solicitation**<br>**Management**|16|6|6|4|5|
|**6. Bid**<br>**Management**|15|6|6|4|5|
|**7. Bid Evaluation**|16|6|5|4|5|
|**8. Contract**<br>**Management**<br>~~Pt~~|16<br>~~Pt~~|6<br>~~Pt~~|5<br>~~Pt~~|4<br>~~Pt~~|5<br>~~Pt~~|
|**9. Financial**<br>**Tracking**<br>~~Pt~~|14<br>~~Pt~~|6<br>~~Pt~~|4<br>~~Pt~~|4<br>~~Pt~~|6<br>~~Pt~~|
|**10. Supplier**<br>**Management**|11|6|5|4|5|
|**11. Analytics &**<br>**Reporting**|11|6|3|4|5|
|**12. System**<br>**Integration**<br>~~ee~~|12<br>~~ee~~|6<br>~~ee~~|4|4|5|
|**TOTAL**<br>~~ee~~|**167**<br>~~ee~~|**72**<br>~~ee~~|**60**|**48**|**64**|



Dream71 Bangladesh Limited                         Confidential 

Page | 81 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**TOR Requirement**|**Module**|**Sub-Module**|
|---|---|---|
|**Virtual Budget System**|Module 9|Budget Management|
|**Procurement Automation**|Module 5, 6, 7|Solicitation, Bid, Evaluation|
|**Real-time Budget Tracking**|Module 9|Budget Management|
|**Supplier Management**|Module 10|All|
|**Order Validation against Budget**|Module 9|Purchase Order Validation|
|**Integration with ERP/OMS/WMS**|Module 12|All|
|**Open Source / No Subscription**|Architecture|Licensing|
|**Full Source Code Transfer**|Deliverables|Documentation|



|**Manual DI**|**Module**|
|---|---|
|**DI #1 (Procurement Planning)**|Module 2|
|**DI #2 (Preference Schemes)**|Module 4|
|**DI #3 (Method of Procurement)**|Module 4|
|**DI #5-7 (Bidder Selection)**|Module 4, 10|
|**DI #8 (Specifications)**|Module 3|
|**DI #9-12 (Solicitation)**|Module 5|
|**DI #13-17 (Bid Management)**|Module 6|
|**DI #18-25 (Evaluation)**|Module 7|
|**DI #28-32 (Contract)**|Module 8|
|**DI #36 (Reporting)**|Module 11|
|**DI #37-38 (Supplier)**|Module 10|



|**External**<br>**System**|**Integration Type**|**Protocol**|**Authentication**|**Data Direction**|
|---|---|---|---|---|
|**ERP (Finance)**|Synchronous + Batch|REST API|OAuth 2.0|Bi-directional|



Dream71 Bangladesh Limited                         Confidential 

Page | 82 

**SRS** - ZAMMSA INTEGRATED PROCUREMENT AND FINANCIAL MANAGEMENT SYSTEM 

|**WMS**|Event-driven<br>(Webhook)|REST API|API Key +<br>Signature|WMS →<br>Procurement|
|---|---|---|---|---|
|**e-GP (ZPPA)**|Batch + Synchronous|REST API +<br>SFTP|API Key +<br>Certificate|Bi-directional|
|**ZRA**|Synchronous|REST API|API Key +<br>Certificate|Procurement → ZRA|
|**PACRA**|Synchronous|REST API|API Key|Procurement →<br>PACRA|
|**CEEC**|Synchronous|REST API|API Key|Procurement →<br>CEEC|
|**ZAMRA**|Synchronous|REST API +<br>SOAP|API Key +<br>Certificate|Procurement →<br>ZAMRA|
|**Banking System**|Batch + Webhook|SFTP +<br>Webhook|PGP + API Key|Bi-directional|
|**Smart Zambia**<br>**SSO**|Synchronous|SAML 2.0|X.509 Certificate|Bi-directional|



## Appendix E: Reference Documents 

|**Document**|**Version**|**Source**|
|---|---|---|
|**ZAMMSA Procurement TOR**|Final June 2025|ZAMMSA/UNDP|
|**ZAMMSA Procurement Manual**|July 2023|ZAMMSA|
|**ZAMMSA Procurement Policy**|August 2024|ZAMMSA|
|**Public Procurement Act No. 8**|2020|Government of Zambia|
|**Public Procurement Regulations**|2022|Government of Zambia|



Dream71 Bangladesh Limited                         Confidential 

Page | 83 
