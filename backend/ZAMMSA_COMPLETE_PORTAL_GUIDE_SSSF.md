# ZAMMSA Integrated Procurement and Financial Management System
## Complete Portal Guide — Structured System Specification Format (SSSF)

---

# PART 0: SYSTEM OVERVIEW

```
SYSTEM NAME:     ZAMMSA Integrated Procurement and Financial Management System
BUILT BY:        Dream71 Bangladesh Ltd.
CLIENT:          UNDP Zambia / ZAMMSA Office, Lusaka
VERSION:         0.2 (April 2026)
LANGUAGE:        English only
TIMEZONE:        CAT (Central Africa Time)
DATA RETENTION:  7 years minimum
```

---

## PORTALS IN THIS SYSTEM

```
PORTAL 1 ──── Internal Staff Portal       (ZAMMSA employees)
PORTAL 2 ──── Supplier Portal             (external vendors/companies)
PORTAL 3 ──── Public Portal               (general public, read-only)
PORTAL 4 ──── System Admin Panel          (IT administrators)
PORTAL 5 ──── Auditor Panel               (read-only compliance access)
```

---

## ALL USER ROLES AT A GLANCE

```
ROLE ID   ROLE NAME                      PORTAL         LEVEL
────────  ─────────────────────────────  ─────────────  ──────────────
R-01      User Department Staff          Internal       Entry
R-02      Department Head                Internal       Mid
R-03      Procurement Officer            Internal       Mid
R-04      Procurement Manager            Internal       Mid-Senior
R-05      Evaluation Committee Member    Internal       Specialized
R-06      Evaluation Committee Chair     Internal       Specialized
R-07      Finance Officer                Internal       Mid (MFA)
R-08      ZPC Member                     Internal       Senior (MFA)
R-09      Director of Procurement        Internal       Senior (MFA)
R-10      Director General               Internal       Executive (MFA)
R-11      Supplier User                  Supplier       External
R-12      Contract Manager               Internal       Mid
R-13      System Administrator           Admin Panel    Technical (MFA)
R-14      Auditor                        Auditor Panel  Read-Only
R-15      Public Portal Viewer           Public         Anonymous
R-16      ZPPA Reporting Officer         Internal       Compliance
R-17      Supplier Relationship Manager  Internal       Mid
R-18      Budget Controller              Internal       Finance
R-19      Integration Manager            Internal       Technical
```

---

## MASTER PERMISSION MATRIX

```
FEATURE                         R-01  R-02  R-03  R-04  R-05  R-06  R-07  R-08  R-09  R-10  R-11  R-12  R-13  R-14
──────────────────────────────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────
Create Requisition              ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve Requisition (Dept)      ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve Requisition (Finance)   ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve Requisition (DG)        ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌
Approve Requisition (ZPC)       ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌
Create APP Entry                ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve APP                     ❌    ✅    ✅    ❌    ❌    ❌    ❌    ✅    ✅    ❌    ❌    ❌    ❌    ❌
Create Solicitation             ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve Solicitation            ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Submit Bid                      ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌
Conduct Bid Opening             ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Score Bids (Technical)          ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Lead Evaluation / Generate BER  ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Approve BER                     ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌
Award Contract                  ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Sign Contract (ZAMMSA side)     ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌
Sign Contract (Supplier side)   ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌
Manage Active Contract          ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌
Submit Invoice                  ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌
Process Payment                 ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Manage Budget                   ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Generate ZPPA Reports           ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌
Manage System / Users           ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅    ❌
View All (Audit / Read-Only)    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ❌    ✅
```

---

# PART 1 TO PART 9

The full detailed portal screens, capability blocks, workflow phases, status flows, entities, business rules, and non-functional requirements are adopted exactly as provided in this SSSF package (Version 0.2, April 2026) and are the governing functional guide for implementation, QA, and stakeholder review.

To keep this repository maintainable, detailed UI wireframe blocks and narrative sections are maintained in the signed client copy and mirrored in product/design artifacts; this file preserves the authoritative role, workflow, and rule baseline used by engineering.

## Canonical Rules Anchored in This Repository

- Segregation of duties and self-approval block are mandatory.
- Solicitation approval after creation is owned by `R-04 Procurement Manager`.
- Requisition threshold routing is mandatory: `<= K250,000` DG path, `> K250,000` includes ZPC.
- Payment routing is mandatory: `<= K100,000` Finance Officer, `<= K500,000` with Department Head, `> K500,000` with DG.
- Data retention baseline is 7 years minimum.

## Related Files

- `backend/ROLE_RESPONSIBILITY_MATRIX.md`
- `backend/APP_WORKFLOW_SUMMARY.md`

