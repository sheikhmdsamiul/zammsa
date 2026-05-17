# ZAMMSA Procurement Management System

## Overview

The Zambia Medicines and Medical Supplies Agency (ZAMMSA) Procurement Management System is a comprehensive web-based platform designed to manage the entire procurement lifecycle from requisition to contract management. The system supports multiple user roles with role-based access control, enabling efficient procurement operations while maintaining proper governance and compliance.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Portals](#user-portals)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Modules & Features](#modules--features)
5. [Workflows](#workflows)
6. [Technical Stack](#technical-stack)
7. [Test Accounts](#test-accounts)

---

## System Architecture

### Backend (Django REST Framework)
- **Framework**: Django 5.x with Django REST Framework
- **Authentication**: JWT (JSON Web Tokens) with SimpleJWT
- **Database**: PostgreSQL
- **Security**: django-axes for brute-force protection, CORS headers
- **Task Queue**: Celery with Redis broker
- **API Documentation**: drf-yasg (Swagger/OpenAPI)

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit + React Query
- **Routing**: React Router DOM v7
- **UI Framework**: Custom Tailwind CSS
- **Forms**: React Hook Form with Zod validation

---

## User Portals

The system has five portals:

- `PORTAL 1` Internal Staff Portal (ZAMMSA employees)
- `PORTAL 2` Supplier Portal (external vendors/companies)
- `PORTAL 3` Public Portal (general public, read-only)
- `PORTAL 4` System Admin Panel (IT administrators)
- `PORTAL 5` Auditor Panel (read-only compliance access)

---

## User Roles & Permissions

### All User Roles at a Glance

| Role ID | Role Name | Portal | Level |
|---|---|---|---|
| R-01 | User Department Staff | Internal | Entry |
| R-02 | Department Head | Internal | Mid |
| R-03 | Procurement Officer | Internal | Mid |
| R-04 | Procurement Manager | Internal | Mid-Senior |
| R-05 | Evaluation Committee Member | Internal | Specialized |
| R-06 | Evaluation Committee Chair | Internal | Specialized |
| R-07 | Finance Officer | Internal | Mid (MFA) |
| R-08 | ZPC Member | Internal | Senior (MFA) |
| R-09 | Director of Procurement | Internal | Senior (MFA) |
| R-10 | Director General | Internal | Executive (MFA) |
| R-11 | Supplier User | Supplier | External |
| R-12 | Contract Manager | Internal | Mid |
| R-13 | System Administrator | Admin Panel | Technical (MFA) |
| R-14 | Auditor | Auditor Panel | Read-Only |
| R-15 | Public Portal Viewer | Public | Anonymous |
| R-16 | ZPPA Reporting Officer | Internal | Compliance |
| R-17 | Supplier Relationship Manager | Internal | Mid |
| R-18 | Budget Controller | Internal | Finance |
| R-19 | Integration Manager | Internal | Technical |

### Master Permission Matrix

| Feature | R-01 | R-02 | R-03 | R-04 | R-05 | R-06 | R-07 | R-08 | R-09 | R-10 | R-11 | R-12 | R-13 | R-14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Create Requisition | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve Requisition (Dept) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve Requisition (Finance) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve Requisition (DG) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve Requisition (ZPC) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create APP Entry | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve APP | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Solicitation | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve Solicitation | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit Bid | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Conduct Bid Opening | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Score Bids (Technical) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lead Evaluation / Generate BER | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve BER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Award Contract | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sign Contract (ZAMMSA side) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sign Contract (Supplier side) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage Active Contract | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Submit Invoice | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Process Payment | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Budget | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate ZPPA Reports | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage System / Users | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View All (Audit / Read-Only) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 1. System Administrator (`system_admin`)
**Access Level**: Full system access

**Capabilities**:
- Manage all system settings
- Create and manage user accounts
- Configure procurement methods
- Monitor system audit logs
- Manage departments
- Handle approval workflows
- System-wide notifications
- Integration management (API connections)

**Navigation**: Full access to all modules

---

### 2. Director General (`director_general`)
**Access Level**: Executive/Strategic

**Capabilities**:
- View all procurement activities
- Approve high-value procurement plans
- ZPC-level approvals
- View reports and analytics
- Strategic decision making

**Navigation**: Dashboard, Procurement Planning, Reports, Approvals

---

### 3. Director of Procurement (`director_procurement`)
**Access Level**: Senior Management

**Capabilities**:
- Manage procurement operations
- Approve solicitation documents
- Review evaluation reports
- Oversee contract awards
- Strategic procurement planning
- View all tenders and bids

**Navigation**: Full procurement lifecycle access, Finance (view), Reports

---

### 4. Procurement Manager (`procurement_manager`)
**Access Level**: Management

**Capabilities**:
- Create and manage solicitations
- Publish tenders
- Review bid submissions
- Manage evaluation committees
- Approve evaluation results
- Create contracts
- Monitor supplier performance

**Navigation**: Requisitions, Solicitations, Bids, Evaluations, Contracts, Reports

---

### 5. Procurement Officer (`procurement_officer`)
**Access Level**: Operational

**Capabilities**:
- Create requisitions
- Draft solicitation documents
- Submit for approval
- Manage tender addenda
- Bid opening and processing
- Support evaluation process

**Navigation**: Requisitions, Solicitations, Bids, Contracts (view)

---

### 6. Department Head (`department_head`)
**Access Level**: Departmental

**Capabilities**:
- Create procurement requisitions for their department
- Review requisitions from department staff
- Approve/reject department requisitions
- Track department procurement needs

**Navigation**: Requisitions, Dashboard

---

### 7. Department Staff (`user_dept_staff`)
**Access Level**: Basic/Entry

**Capabilities**:
- Create procurement requisitions
- Track status of submitted requisitions
- View approved procurement plans

**Navigation**: Requisitions (create/view own), Dashboard

---

### 8. Finance Officer (`finance_officer`)
**Access Level**: Finance Operations

**Capabilities**:
- Budget validation of requisitions
- Invoice processing
- Payment processing
- Letters of Credit management
- Financial tracking

**Navigation**: Requisitions (budget check), Finance (Invoices, Payments, LC), Dashboard

---

### 9. Budget Controller (`budget_controller`)
**Access Level**: Finance Control

**Capabilities**:
- Budget allocation and monitoring
- Budget variance analysis
- Approve budget for procurements
- Financial reports
- Fiscal year budget management

**Navigation**: Finance (Budgets), Reports, Requisitions (budget approval)

---

### 10. ZPC Member (`zpc_member`)
**Access Level**: Governance/Policy

**Capabilities**:
- Review procurement plans
- Policy compliance verification
- High-value procurement approval
- Strategic procurement oversight

**Navigation**: Procurement Planning (APP review), Reports

---

### 11. Evaluation Committee Chair (`evaluation_committee_chair`)
**Access Level**: Evaluation Leadership

**Capabilities**:
- Lead bid evaluations
- Assign evaluators to bids
- Review evaluation scores
- Submit evaluation recommendations
- Sign evaluation reports

**Navigation**: Evaluations, Bids, Reports

---

### 12. Evaluation Committee Member (`evaluation_committee_member`)
**Access Level**: Evaluation

**Capabilities**:
- Evaluate submitted bids
- Score technical and financial proposals
- Submit evaluation findings
- Participate in evaluation meetings

**Navigation**: Evaluations (assigned only), Bids (view assigned)

---

### 13. Contract Manager (`contract_manager`)
**Access Level**: Contract Administration

**Capabilities**:
- Create and manage contracts
- Track contract performance
- Contract amendments
- Termination management
- Contract renewal processing

**Navigation**: Contracts, Evaluations (view), Reports

---

### 14. Supplier User (`supplier_user`)
**Access Level**: External/Supplier

**Capabilities**:
- Browse open tenders
- Submit bids
- Track bid status
- View awarded contracts
- Manage company profile
- Submit invoices (if contracted)

**Navigation**: Supplier Portal (Dashboard, Bids, Tenders, Contracts, Profile)

---

### 15. Supplier Relationship Manager (`supplier_relationship_manager`)
**Access Level**: Supplier Management

**Capabilities**:
- Manage supplier database
- Supplier registration/approval
- Performance monitoring
- Supplier qualification
- Blacklist management

**Navigation**: Suppliers, Contracts, Supplier Portal (admin)

---

### 16. Auditor (`auditor`)
**Access Level**: Audit/Compliance

**Capabilities**:
- View all procurement records
- Audit trail access
- Compliance reports
- Financial audit trail
- Procurement audit logs

**Navigation**: All modules (read-only), Audit Logs, Reports

---

### 17. ZPPA Reporting Officer (`zppa_reporting_officer`)
**Access Level**: Regulatory Reporting

**Capabilities**:
- Generate ZPPA compliance reports
- Submit regulatory reports
- Tender publishing to ZPPA
- Procurement statistics

**Navigation**: Reports (ZPPA specific), Solicitations (publish)

---

### 18. Integration Manager (`integration_manager`)
**Access Level**: Technical/Integration

**Capabilities**:
- Manage API integrations
- System integrations monitoring
- Data synchronization
- Integration testing

**Navigation**: System Settings (Integrations), Admin

---

### 19. Public Portal Viewer (`public_portal_viewer`)
**Access Level**: Public/Read-only

**Capabilities**:
- View public tenders
- View supplier directory
- Access public announcements
- No authentication required

**Navigation**: Public Portal only

---

## Modules & Features

### 1. Requisitions Module
**Purpose**: Manage procurement requests from departments

**Features**:
- Create new requisition
- Edit draft requisitions
- Submit for approval
- Budget validation
- Department head approval
- Procurement review
- Track status (Draft → Submitted → Under Review → Approved/Rejected)
- Export to Excel

**Statuses**: draft, submitted, dept_head_review, procurement_review, approved, rejected

---

### 2. Procurement Planning Module (APP - Annual Procurement Plan)
**Purpose**: Annual procurement planning and consolidation

**Features**:
- Create Annual Procurement Plan (APP)
- Department-level plans
- Consolidation of plans
- ZPC review and approval
- GPN (Goods Notice Publication) generation
- Compliance checking
- Publish approved plans
- Budget allocation tracking

**Statuses**: draft, dept_head_review, procurement_review, director_review, zpc_review, approved, published, rejected

---

### 3. Solicitations Module (Tenders)
**Purpose**: Create and manage tender documents

**Features**:
- Create solicitation from approved requisition
- Select procurement method
- Define eligibility criteria
- Set technical specifications
- Define submission deadline
- Publish tender
- Add addenda/amendments
- Bid opening
- Withdraw/close tender

**Procurement Methods**: Open, Restricted, Direct, Framework Agreement, Emergency

**Statuses**: draft, pending_approval, approved, published, closed, cancelled

---

### 4. Bids Module
**Purpose**: Manage supplier bid submissions

**Features**:
- View submitted bids
- Bid opening
- Bid validity checking
- Technical bid evaluation
- Financial bid opening
- Clarification requests
- Bid rejection reasons

**Statuses**: submitted, under_evaluation, technically_qualified, financially_qualified, accepted, rejected, withdrawn

---

### 5. Evaluations Module
**Purpose**: Bid evaluation process management

**Features**:
- Create evaluation committees
- Assign evaluators
- Technical evaluation
- Financial evaluation
- Combined scoring
- Evaluation report generation
- Committee chair signing
- Approval workflow

**Statuses**: pending, in_progress, completed, approved, rejected

---

### 6. Contracts Module
**Purpose**: Contract creation and management

**Features**:
- Create contract from awarded bid
- Define terms and conditions
- Set delivery schedules
- Payment terms
- Contract amendments
- Extension requests
- Termination management
- Performance tracking

**Statuses**: draft, pending_approval, approved, active, completed, terminated, expired

---

### 7. Finance Module
**Purpose**: Financial management and tracking

**Sub-modules**:

#### Budgets
- Annual budget allocation
- Department budget distribution
- Budget tracking and monitoring
- Variance reports

#### Invoices
- Invoice submission (suppliers)
- Invoice verification (finance)
- Invoice approval workflow
- Invoice payment processing

#### Payments
- Payment processing
- Payment scheduling
- Payment history
- Advance payments

#### Letters of Credit
- LC application
- LC issuance tracking
- LC amendments
- LC closure

---

### 8. Suppliers Module
**Purpose**: Supplier management

**Features**:
- Supplier registration
- Supplier verification
- Performance rating
- Blacklist management
- Document management
- Category classification
- Compliance tracking

---

### 9. Reports Module
**Purpose**: Analytics and reporting

**Features**:
- Procurement dashboards
- Spend analysis
- Supplier performance reports
- Budget utilization
- Timeline compliance
- ZPPA reports
- Audit reports
- Custom report builder
- Export to PDF/Excel

---

### 10. Admin Module
**Purpose**: System administration

**Features**:
- User management (CRUD)
- Role management
- Department management
- Procurement method configuration
- System settings
- Notification management
- Audit logs
- Integration monitoring

---

### 11. Public Portal
**Purpose**: External-facing information

**Features**:
- Public tender listings
- Tender detail view
- Supplier directory
- News and announcements
- Event calendar
- About the organization
- Contact information

---

### 12. Supplier Portal
**Purpose**: Supplier self-service

**Features**:
- Open tenders list
- Tender detail view
- Bid submission wizard
- Document upload
- My bids tracking
- Contract viewing
- Profile management

---

## Workflows

### Requisition to Contract Workflow

```
1. Department Staff creates Requisition (Draft)
2. Department Head reviews and approves
3. Procurement Officer reviews and validates
4. Budget Controller validates budget
5. Requisition Approved
6. Procurement Manager creates Solicitations
7. Director approves Solicitations
8. Tender Published
9. Suppliers submit Bids
10. Bid Opening
11. Evaluation Committee evaluates Bids
12. Evaluation Report approved
13. Contract created from winning bid
14. Contract Manager manages contract
15. Finance processes payments
```

### Procurement Planning Workflow

```
1. Department Staff creates APP entry
2. Department Head reviews
3. Procurement reviews and consolidates
4. Director of Procurement reviews
5. ZPC reviews (for high-value)
6. Director General approval
7. APP Published
8. GPN generated for each item
9. Solicitation creation follows
```

---

## Technical Stack

### Backend
| Component | Technology |
|-----------|------------|
| Framework | Django 5.x |
| API | Django REST Framework |
| Auth | SimpleJWT |
| Database | PostgreSQL |
| Task Queue | Celery |
| Cache/Broker | Redis |
| Documentation | drf-yasg |
| Security | django-axes |

### Frontend
| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| State | Redux Toolkit |
| Data Fetching | React Query |
| Routing | React Router v7 |
| UI | Tailwind CSS |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Excel Export | xlsx |
| PDF Generation | jsPDF |

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| System Admin | admin@zammsa.zm | Test@123 |
| Director General | dg@zammsa.zm | Test@123 |
| Director of Procurement | dirproc@zammsa.zm | Test@123 |
| Procurement Manager | pm@zammsa.zm | Test@123 |
| Procurement Officer | po@zammsa.zm | Test@123 |
| Department Head | dh@zammsa.zm | Test@123 |
| Department Staff | staff@zammsa.zm | Test@123 |
| Finance Officer | fo@zammsa.zm | Test@123 |
| Budget Controller | bc@zammsa.zm | Test@123 |
| ZPC Member | zpc@zammsa.zm | Test@123 |
| EC Chair | ecchair@zammsa.zm | Test@123 |
| EC Member | ecm1@zammsa.zm | Test@123 |
| Contract Manager | cm@zammsa.zm | Test@123 |
| ZPPA Reporter | zppa@zammsa.zm | Test@123 |
| Auditor | auditor@zammsa.zm | Test@123 |
| Supplier | vendor@healthpharma.zm | Vendor@123 |
| Supplier Relationship Manager | supplier.manager@zammsa.gov.zm | Test@123 |

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 14+
- Redis

### Backend Setup
```bash
cd backend
python3 -m venv envfile
source envfile/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_test_users
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Access Points
- Backend API: http://localhost:8000/api/v1
- Swagger Docs: http://localhost:8000/swagger/
- Frontend: http://localhost:3000

---

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Brute-force protection (django-axes)
- CORS configuration
- Password hashing (Django default)
- Audit logging
- MFA support (TOTP)
- Session management
- HTTPS enforcement (production)

---

## Support

For technical support or questions, contact the system administrator or refer to the internal user guide.
