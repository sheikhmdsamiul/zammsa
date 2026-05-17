# ROLE RESPONSIBILITY MATRIX

Source of truth: `ZAMMSA_COMPLETE_PORTAL_GUIDE_SSSF.md` (Version 0.2, April 2026)

## Portals in this system

- `PORTAL 1` Internal Staff Portal (ZAMMSA employees)
- `PORTAL 2` Supplier Portal (external vendors/companies)
- `PORTAL 3` Public Portal (general public, read-only)
- `PORTAL 4` System Admin Panel (IT administrators)
- `PORTAL 5` Auditor Panel (read-only compliance access)

## All user roles at a glance

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

| Role ID | Role Name | Requisition | APP | Solicitation | Bidding | Evaluation | Contract | Payment | Access Scope |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | User Department Staff | Create/submit | Create entries | - | - | - | - | - | Own department only |
| R-02 | Department Head | Approve/return/reject (dept) | Approve (dept stage) | - | - | - | - | Co-approve up to K500K | Own department |
| R-03 | Procurement Officer | - | Review/consolidate | Create/publish | Conduct bid opening | - | Award notice + contract generation | - | Procurement module |
| R-04 | Procurement Manager | - | - | Approve solicitation | - | - | Approve amendments | - | Procurement governance |
| R-05 | Evaluation Committee Member | - | - | - | - | Technical scoring | - | - | Assigned bids only |
| R-06 | Evaluation Committee Chair | - | - | - | - | Lead evaluation + BER generation | - | - | Assigned evaluations |
| R-07 | Finance Officer (MFA) | Budget validate | - | - | - | - | - | Approve <=K100K | Finance-wide |
| R-08 | ZPC Member (MFA) | Approve >K250K | Final APP approval | - | - | Approve BER | Approve major amendments | - | ZPC agenda scope |
| R-09 | Director of Procurement (MFA) | - | Approve APP director stage | Method override governance | - | Form EC | Approve amendments | - | Organisation-wide procurement |
| R-10 | Director General (MFA) | Approve threshold stage | - | - | - | - | Sign/countersign contracts | Approve >K500K | Executive scope |
| R-11 | Supplier User | - | - | View/download published | Submit bids | - | Supplier-side signing | Submit invoices | Own supplier account |
| R-12 | Contract Manager | - | - | - | - | - | Manage active contracts | - | Assigned contracts |
| R-13 | System Administrator (MFA) | - | - | - | - | - | - | - | User/admin operations |
| R-14 | Auditor | Read-only | Read-only | Read-only | Read-only | Read-only | Read-only | Read-only | Full audit read-only |
| R-15 | Public Portal Viewer | - | View published APP/GPN | View published solicitations | - | - | View awards | - | Anonymous public |
| R-16 | ZPPA Reporting Officer | - | Reporting | - | - | - | - | - | Compliance reporting |
| R-17 | Supplier Relationship Manager | - | - | - | - | - | Supplier performance | - | Supplier governance |
| R-18 | Budget Controller | Budget governance | - | - | - | - | - | Budget control | Finance governance |
| R-19 | Integration Manager | - | - | - | - | - | - | - | Integration monitoring |

## Critical approval ownership

- Tender/Solicitation creation: `R-03 Procurement Officer`
- Tender/Solicitation approval: `R-04 Procurement Manager`
- BER approval: `R-08 ZPC Member`
- Contract signature (ZAMMSA): `R-10 Director General`
