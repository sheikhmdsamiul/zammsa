# ZAMMSA e-Procurement — Workflow Summary (Aligned to SSSF v0.2)

This file is synchronized with `backend/ZAMMSA_COMPLETE_PORTAL_GUIDE_SSSF.md` and provides an implementation-facing summary.

## 1) End-to-End Procurement Lifecycle

1. Planning: APP creation -> department approval -> procurement review -> director approval -> ZPC approval -> GPN publication.
2. Requisition: create -> budget validation -> dept head -> finance -> DG/ZPC threshold route -> approved for procurement.
3. Solicitation: create CPP + solicitation -> procurement manager approval -> publication to public portal/e-GP.
4. Bidding: suppliers submit -> closing lock -> public bid opening by procurement officer.
5. Evaluation: EC formed -> COI declarations -> technical scoring -> financial evaluation -> BER -> ZPC approval.
6. Award/Contract: award notice -> standstill -> supplier sign -> DG countersign -> active contract.
7. Payment: invoice -> 3-way match -> threshold approvals -> bank file -> paid + ERP posting.
8. Closure/Archiving: contract closure -> retention release -> encrypted archive -> 7-year retention.

## 2) Key Routing Rules

- Requisition approval threshold:
  - `<= K250,000`: DG approval path
  - `> K250,000`: includes ZPC approval
- Payment approval threshold:
  - `<= K100,000`: Finance Officer
  - `<= K500,000`: includes Department Head
  - `> K500,000`: includes DG
- Solicitation approval after creation: `Procurement Manager (R-04)`.

## 3) Core Segregation Rules

- No user can both create and approve the same procurement action (`BR-USER-03`).
- No self-approval for any transaction (`BR-USER-04`).
- Audit trail is mandatory across all workflow steps.

## 4) Canonical References

- Role matrix: `backend/ROLE_RESPONSIBILITY_MATRIX.md`
- Full portal + screens + business rules: `backend/ZAMMSA_COMPLETE_PORTAL_GUIDE_SSSF.md`
