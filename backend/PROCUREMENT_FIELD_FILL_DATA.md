# Procurement Field Fill Data

This file contains sample values you can use directly when filling frontend fields for:
- APP creation
- Requisition creation
- Solicitation creation

> Replace placeholders like `{{APP_UUID}}` and `{{REQUISITION_UUID}}` with actual IDs from your backend.

---

## 1) APP fields

| Field | Example Value | Notes |
|---|---|---|
| fiscal_year | 2026 | Use actual fiscal year code from master data |
| department | Procurement Department | Use the department name or ID supported by the frontend |
| total_estimated_value | 1,250,000.00 | Sum of all line item estimated values |
| compliance_notes | Include all planned procurement for FY 2026. | Optional |
| is_consolidated | false | Boolean |
| gpn_publication_targets | ["zammsa_website", "egp_portal"] | Optional publication targets |

### APP line item example 1

| Field | Example Value |
|---|---|
| app | `{{APP_UUID}}` |
| description | Office furniture and workstations for the procurement team |
| estimated_value | 450,000.00 |
| recommended_method | open_tender |
| planned_issue_date | 2026-03-01 |
| planned_award_date | 2026-04-15 |
| funding_source | GOZ |
| commodity | Office Furniture |

### APP line item example 2

| Field | Example Value |
|---|---|
| app | `{{APP_UUID}}` |
| description | Annual managed IT support services and software licensing |
| estimated_value | 300,000.00 |
| recommended_method | simplified |
| planned_issue_date | 2026-04-01 |
| planned_award_date | 2026-05-10 |
| funding_source | Donor Fund |
| commodity | Software |

---

## 2) Requisition fields

| Field | Example Value | Notes |
|---|---|---|
| department | Procurement Department | Use matching department for the linked APP |
| app_line_item | `{{APP_LINE_ITEM_UUID}}` | Select an APP line item from the created APP |
| description | Procurement of laptops and a projector for the evaluation team | Short text description |
| required_date | 2026-05-20 | Date by which goods/services are required |
| delivery_location | ZAMMSA Head Office, Lusaka | Optional delivery details |

### Requisition items

| Field | Example Value |
|---|---|
| item_code | LAP-001 |
| description | 14-inch laptop with 16GB RAM and 512GB SSD |
| quantity | 8 |
| unit | Piece |
| estimated_unit_cost | 12,000.00 |

| Field | Example Value |
|---|---|
| item_code | PROJ-001 |
| description | Wireless projector with HDMI and VGA support |
| quantity | 2 |
| unit | Piece |
| estimated_unit_cost | 8,500.00 |

### Requisition specification example

| Field | Example Value |
|---|---|
| specification_type | goods |
| content | {"brand": "Any reputable manufacturer", "warranty_months": 24, "power_requirements": "230V"} |

---

## 3) Solicitation fields

| Field | Example Value | Notes |
|---|---|---|
| requisition | `{{REQUISITION_UUID}}` | The approved requisition ID |
| title | Procurement of Office IT Equipment | Solicitation title |
| description | A solicitation to procure laptops, projectors, and supporting accessories for the procurement unit. | Detailed description |
| procurement_method | open_tender | Use `type` if the frontend field is named differently |
| estimated_value | 120,000.00 | Total expected value |
| currency | ZMW | Currency code |
| budget_code | PROC-2026-01 | Budget code string |
| issue_date | 2026-06-01 | Date the solicitation is issued |
| closing_date | 2026-06-25T17:00:00Z | Bid closing timestamp |
| department | Procurement Department | Responsible department |

### Publication targets

| Field | Example Value |
|---|---|
| targets | ["zammsa_website", "egp_portal", "email_suppliers"] |
| proofs | {"zammsa_website": {"url": "https://zammsa.gov.zm/tenders/123", "timestamp": "2026-06-01T10:00:00Z"}} |

---

## Notes
- Use actual department and fiscal year values from your system.
- Use the generated object UUIDs from the backend for `app`, `app_line_item`, `requisition`, and `solicitation` fields.
- If your frontend form expects `type` instead of `procurement_method`, set `type: open_tender`.
- Keep `closing_date` in ISO 8601 format with timezone `Z` if the field uses datetime.
