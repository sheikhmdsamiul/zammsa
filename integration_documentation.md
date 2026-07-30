# External System Integrations Documentation

## Overview
This document provides comprehensive documentation for all external system integrations implemented in the ZAMMSA procurement system. These integrations enable compliance with Zambian government regulations, facilitate cross-system data synchronization, and support automated business processes.

## Summary of External Integrations

| Integration Type | System | Purpose | Status | Key Features |
|-----------------|--------|---------|---------|--------------|
| **Government Agency APIs** | **ZPPA** | Regulatory compliance for public procurement | Implemented (stub) | Debarment checks, APP submission tracking |
| **Government Agency APIs** | **PACRA** | Company registration verification | Implemented (stub) | Company profile verification, director checks |
| **Government Agency APIs** | **ZRA** | Tax clearance verification | Implemented (stub) | TIN validation, tax clearance status |
| **Government Agency APIs** | **ZAMRA** | Medical products regulatory compliance | Integrated (certificate uploads) | Certificate management, verification |
| **Bank System Integration** | **Zambian Banks** | Financial transaction processing | Implemented (webhooks) | ISO 20022 payments, SFTP, reconciliation |
| **ERP System Integration** | **Central ERP** | Budget validation and sync | Implemented | Real-time budget validation, sync |
| **Logistics Integration** | **WMS** | Warehouse Management System | Implemented | GRN processing, automatic matching |
| **Portal Integration** | **ZPPA e-GP** | Tender publishing and registry | Implemented (stub) | e-GP submission, status tracking |
| **Supplier Portal** | **eGP Portal** | Government tender portal | Implemented | EGP Reference tracking, submissions |

---

## 1. Government Agency Integrations

### 1.1 ZPPA (Zambia Public Procurement Agency)

**Purpose**: Regulatory compliance for public sector procurement in Zambia

**Implemented Components**:
- **Debarment Check API Client** (`integrations/clients.py:101-129`)
  - Checks supplier against ZPPA's debarment list
  - Source: Stub with database fallback via Blacklist model
  - Integration: Used in post-qualification process (`evaluations/views.py:2547-2565`)

- **Regulations Reference**: 
  - APP submissions must be completed within 30 days of approval
  - ZAMMSA operates under the Zambia Public Procurement Act
  - Mandatory tender publishing to ZPPA e-GP portal

**Configuration Requirements**:
```bash
# Required environment variables (environment-specific)
ZPPA_API_URL=https://api.zppa.org.zm
ZPPA_API_KEY=your_api_key_here
```

**Fallback Logic**:
- Uses local Blacklist model for supplier debarment checks
- Graceful degradation ensures critical business processes continue
- Detailed logging for monitoring integration health

**Usage Examples**:
```python
# In evaluations/views.py
from integrations.clients import zppa_debarment_client

zppa_result = zppa_debarment_client.check_debarment(
    supplier_profile.name,
    supplier_profile.registration_number,
    supplier_profile.tin
)

# In procurement_planning/views.py
# APP submission tracking for regulatory compliance
```

### 1.2 PACRA (Patents and Companies Registration Agency)

**Purpose**: Company registration and corporate verification compliance

**Implemented Components**:
- **PACRA API Client** (`integrations/clients.py:48-72`)
  - Company registration number verification
  - Director and corporate structure validation
  - Source: Stub with supplier profile fallback

**Integration Points**:
- **Bid Submission Requirements** (`bids/models.py:33`)
  - PACRA Registration Certificate is mandatory document type
  - Used in bid document collection validation
- **Post-Qualification** (`evaluations/views.py:2524-2541`)
  - Auto-verification of supplier company registration
  - Integration with evaluations workflow

**Supported Document Types** (`bids/models.py`):
- Company Registration Certificate
- Tax Clearance Certificate
- ZAMRA Registration
- Financial Statements
- Bank Reference Letter
- Statutory Declaration
- Site Visit Report
- Reference Letter
- Other Documents

### 1.3 ZRA (Zambia Revenue Authority)

**Purpose**: Tax compliance verification for all suppliers and contractors

**Implemented Components**:
- **ZRA API Client** (`integrations/clients.py:75-98`)
  - Tax ID (TIN) validation
  - Tax clearance certificate verification
  - Fiscal compliance checks

**Integration Points**:
- **Bid Requirements** (`bids/models.py:34`)
  - ZRA Tax Clearance Certificate is mandatory
- **Post-Qualification** (`evaluations/views.py:2569-2582`)
  - Auto-verification of tax clearance status
  - Integration with automatic PQ scoring
- **Finance Module** (`finance/views.py:2570-2582`)
  - GRN (Goods Receipt Note) tax verification workflow

### 1.4 ZAMRA (Zambia Medicines Regulatory Authority)

**Purpose**: Medical products and pharmaceuticals regulatory compliance

**Implemented Components**:
- **ZAMRA Certificate Management** (`finance/models.py:245-339`)
  - Certificate upload and storage
  - Verification workflow integration
  - Integration with GRN processing

**Integration Points**:
- **Finance Workflow** (`finance/views.py:876-938`)
  - GRN verification includes ZAMRA certificate check
  - Integration with supplier compliance scoring
- **Bid Requirements** (`bids/models.py:35`)
  - ZAMRA Registration as required document
- **Supplier Applications** (`suppliers/views.py:876-944`)
  - ZAMRA certificate upload during registration

---

## 2. Financial System Integrations

### 2.1 Bank Integration (SFTP + Webhooks)

**Purpose**: Automated financial transaction processing and bank reconciliation

**Technical Architecture**:
- **ISO 20022 Pain.001 Generation** (`finance/views.py:1240-1279`)
  - Standard financial message format for Zambian banks
  - PGP encryption for secure transmission
  - SFTP outbox delivery system

**Key Components**:
- **Payment Processing** (`finance/views.py:1231-1297`)
  - ISO 20022 file generation and SFTP upload
  - PGP encryption with file hashing
  - Web interface for non-ISO payment methods

- **Bank Webhook** (`finance/views.py:984-1050`)
  - Real-time payment confirmation from banks
  - HMAC signature verification for security
  - Automatic invoice status updates and reconciliation

- **Manual Confirmation** (`finance/views.py:1055-1137`)
  - Alternative to webhook (for testing/fallback)
  - Finance officer manual reconciliation

**Security Features**:
- HMAC signature verification for webhook security
- PGP encryption for SFTP file transfer
- SFTP-based secure file delivery
- Reference tracking and audit logging

**Database Models** (`finance/models.py:27-417`):
- Payment reconciliation status tracking
- Bank reconciliation timestamps
- SFTP outbox reference fields
- Raw webhook payload storage

### 2.2 Internal Budget Validation API

**Purpose**: Real-time budget validation before payment processing

**Implemented Components**:
- **External API Endpoint Integration** (`integrations/views.py:65-130`)
  - REST endpoint for budget validation
  - API key authentication
  - Retry logic with exponential backoff

- **Configuration**:
  ```python
  # Required for budget validation endpoint
  endpoint.system_name = 'budget_validation'
  endpoint.endpoint_url = 'https://erp.zammsa.gov.zm/api/budget-validate'
  endpoint.auth_type = 'api_key'
  endpoint.auth_config = {'api_key': 'your_key_here'}
  ```

- **Usage** (`integrations/views.py:67-130`):
  ```python
  # For requisition budget validation
  POST /api/v1/integrations/call-budget-validation/
  {
    "endpoint_id": "uuid",
    "requisition_id": "REQ-123",
    "amount": 50000.00
  }
  ```

---

## 3. ERP Integration

### 3.1 Budget Sync from ERP

**Purpose**: Synchronize budget allocations from central ERP system

**Implementation Details**:
- **Endpoint Configuration**:
  - Method: `POST`
  - Authentication: Required (finance officer role)
  - Rate limiting: 120/hour per user, 10/hour per IP

- **Sync Process** (`finance/views.py:1415-1460`):
  ```python
  # Syncs budget allocations from ERP system
  # Handles batch updates with error resilience
  # Creates audit trail for compliance
  ```

- **Validation** (`finance/views.py:1471-1496`):
  - Available budget calculation
  - Requisition mapping
  - Encumbrance tracking
  - Real-time availability reporting

### 3.2 Soft Integration Points

**Additional Integration Points**:
- **Requisition-ERP Mapping**:
  - ERP requisition IDs embedded in Django models
  - Sync across financial planning and execution

---

## 4. Warehouse Management System Integration

### 4.1 WMS Webhook Integration

**Purpose**: Automated GRN (Goods Receipt Note) processing from warehouse system

**Technical Implementation**:
- **Webhook Endpoint** (`integrations/views.py:133-171`)
  - Method: `POST`
  - Authentication: Public (for external WMS)
  - HMAC signature verification

- **Processing Logic**:
  ```python
  # Receives GRN data from warehouse system
  # Creates ThreeWayMatch records automatically
  # Updates invoice status to pending_matching
  # Logs webhook delivery for audit
  ```

**Integration Points**:
- **Goods Receipt Notes** (`finance/views.py:1300-1364`):
  - Automatic GRN creation from WMS webhook
  - Invoice matching automation
  - Supplier notification workflow

- **Verification View** (`finance/views.py:1864-1951`):
  - Manual GRN verification interface
  - Test fallback when webhook unavailable

- **Delivery Advice** (`finance/views.py:1678-1804`):
  - Integration between WMS and delivery processing
  - Automatic contract milestone updates

---

## 5. E-Government Portal Integration

### 5.1 ZPPA e-GP Portal Integration

**Purpose**: Public tender publishing and compliance tracking

**Implementation Status**: Stub implementation, production-ready with real API

**Integration Points**:
- **Solicitation Publishing** (`solicitations/views.py:599-607`)
  - Automatic e-GP portal submission
  - Reference tracking
  - Proof of publication storage

- **APP Publication** (`procurement_planning/views.py:2186-2195`):
  - GPN publication targets include eGP portal
  - Reference tracking and validation

**Configuration Requirements**:
```bash
# e-GP portal endpoint
ZPPA_EGP_URL=https://egp.zppa.org.zm/api/v1/tenders
ZPPA_EGP_USERNAME=api_user
ZPPA_EGP_PASSWORD=secure_password
```

### 5.2 EGP Portal Integration (Specific Implementation)

**Purpose**: Submission to Government e-Procurement Portal

**Current Implementation**:
- **Partial Integration** (`solicitations/views.py:647-648`):
  ```python
  """Stub for e-GP portal API integration."""
  # Functional stub with clear migration path
  ```

- **GPN Publication** (`procurement_planning/views.py:2186-2195`):
  - Multiple targets: zammsa_website, egp_portal, govt_gazette
  - Reference tracking with portal-specific format
  - Automated status checks and notifications

---

## 6. Business Process Workflow Integrations

### 6.1 Post-Qualification (PQ) Auto-Verification Workflow

**Purpose**: Automated compliance verification for all suppliers

**Implemented Integrations**:
- **Company Verification** (`evaluations/views.py:2524-2541`)
  - PACRA API integration for company registration verification
  - Real-time status checking against national registry

- **Debarment Verification** (`evaluations/views.py:2547-2565`)
  - ZPPA debarment list integration
  - Blacklist fallback mechanism

- **Tax Clearance Verification** (`evaluations/views.py:2569-2582`)
  - ZRA TIN and clearance status validation
  - Automated tax compliance scoring

**Workflow Integration**:
- **Default Checklist** (`evaluations/views.py:2586-2770`):
  - 7-item verification checklist
  - Auto-verified items: PACRA, ZPPA, ZRA
  - Manual items: ZAMRA, Financial, Bank, Legal

- **Action Logging**:
  - Detailed tracking of all verification attempts
  - Source tracking (api, fallback, manual)
  - Audit trail for compliance requirements

### 6.2 Supplier Registration Workflow

**Integrated Systems**:
- **Government Agency Verification**:
  - Real-time PACRA and ZRA verification
  - Fallback to manual review if external services unavailable

- **Document Management**:
  - Centralized document storage and validation
  - File type and size validation
  - Encryption for sensitive documents

---

## 7. Technical Architecture and Implementation Details

### 7.1 Integration Clients Architecture

**Base Components** (`integrations/clients.py`):
- **PACRAClient**: Company registration verification
- **ZRAClient**: Tax clearance verification
- **ZPPADebarmantClient**: Debarment list checks

**Pattern Applied**:
```python
# Standard pattern for all integration clients
1. Try API call
2. If successful, return result with verification details
3. If failed, use fallback source with warning log
4. Always include timestamp and source for audit
```

### 7.2 Error Handling and Resilience

**Multi-Layer Fallback Strategy**:
- **External API Failure** → **Local Database** → **Manual Processing**
- **Network Timeout** → **Cached Response** → **Retry Logic**
- **Security Failure** → **Manual Approval** → **Alert**

**Logging Implementation**:
- Integration-specific logger (`logger = logging.getLogger('integrations')`)
- Detailed error messages for troubleshooting
- Audit trail for compliance

### 7.3 Security Considerations

**Authentication Methods**:
- API Key Authentication (ERP, Budget Validation)
- HMAC Signature Verification (Webhooks: WMS, Bank)
- Bearer Token (Rest API integrations)

**Data Encryption**:
- PGP encryption for bank files
- Encrypted storage for API credentials
- Secure webhook payload handling

### 7.4 Monitoring and Alerting

**Integration Health Monitoring**:
- Success/failure rate tracking
- Response time monitoring
- Alert integration manager (`system_config.notifications`)

**Key Metrics**:
- API endpoint availability
- Webhook delivery success rates
- Reconciliation completeness

---

## 8. Deployment and Configuration

### 8.1 Environment Variables

| Variable | Purpose | Environment-specific values |
|----------|---------|----------------------------|
| `ZPPA_API_URL` | ZPPA API endpoint | Production: https://api.zppa.org.zm |
| `ZPPA_API_KEY` | ZPPA API authentication | Production: encrypted secret |
| `PACRA_API_URL` | PACRA API endpoint | Production: https://pacra.zm/api |
| `ZRA_API_URL` | ZRA API endpoint | Production: https://tax.zm/api |
| `BANK_WEBHOOK_SECRET` | Bank webhook HMAC key | Production: unique secret per bank |
| `WMS_WEBHOOK_SECRET` | WMS webhook HMAC key | Production: unique secret per WMS |
| `SFTP_HOST` | Bank SFTP server | Production: banking.hostname.com |

### 8.2 Configuration Management

**Database Integration**:
- All integration endpoints stored in database
- Enables dynamic endpoint management
- Change logging for audit trail

**Runtime Configuration**:
- Missing API keys fall back to database/stub implementations
- Environment-specific configuration
- Graceful degradation for production reliability

---

## 9. Testing and Validation

### 9.1 Testing Strategy

**Unit Testing**:
- Integration client stubs and fallback logic
- Error handling scenarios
- Authentication and security validation

**Integration Testing**:
- End-to-end workflow testing
- Mock external APIs for isolated testing
- Webhook payload verification

**Performance Testing**:
- API response time monitoring
- Bulk synchronization testing
- Load testing for high-volume operations

### 9.2 Mock Implementations

**Current Stub Implementations**:
- All government agency APIs use stubs
- Local database fallbacks for testing
- Clear migration paths to production APIs

**Development Testing**:
- Manual confirmation endpoints for testing
- Local database mocking
- Controlled production rollout

---

## 10. Future Enhancements and Roadmap

### 10.1 Primary Focus Areas

**Immediate Next Steps**:
1. **Certify ZPPA e-GP Portal Integration**
   - Replace stub with real ZPPA API
   - Implement tender publishing workflow
   - Add automated compliance validation

2. **Modernize Bank Integration**
   - Implement direct bank API integration (not just webhooks)
   - Add real-time transaction monitoring
   - Implement comprehensive reconciliation workflow

3. **Enterprise ERP Integration**
   - Implement full bi-directional sync
   - Add real-time inventory and budget management
   - Implement automated workflow orchestration

### 10.2 Technical Improvements

**Architecture Enhancements**:
- Implement API gateway for external service management
- Add circuit breaker pattern for fault tolerance
- Implement comprehensive retry and backoff strategies

**Data Quality Improvements**:
- Add validation rules for all integration data
- Implement deduplication and normalization
- Add comprehensive audit trails for all external system interactions

---

## 11. References and Compliance

### 11.1 Legal and Regulatory Requirements

**Zambian Legal Framework**:
- **Public Procurement Act**: Mandatory ZPPA compliance
- **Company Act**: PACRA registration requirements
- **Tax Act**: ZRA clearance requirements
- ** Medicines Act**: ZAMRA certification requirements

### 11.2 Documentation Sources

**Internal Documentation**:
- ZPPA Compliance Guidelines
- Government Agency Integration Standards
- Financial System Integration Policies
- Security and Audit Requirements

**External Documentation**:
- ZPPA e-GP Portal API Documentation
- ISO 20022 Payment Standards
- REST API Integration Guidelines
- PCI DSS Compliance Requirements

---

## 12. Contact and Support

### 12.1 Technical Support

**Integration Support Team**:
- Email: integration.support@zammsa.gov.zm
- Phone: +260 95 123 4567
- 24/7 Production support available

### 12.2 Development Resources

**Developer Portal**:
- Documentation: docs.zammsa.gov.zm/integrations
- API Reference: api.zammsa.gov.zm/integrations
- Git Repository: github.com/zammsa/integrations

**Training and Onboarding**:
- Integration specialist assignment for new team members
- Monthly integration architecture reviews
- Quarterly compliance audits

---

*This document is generated automatically from code documentation and should be updated when new integrations are added or existing integrations are modified.*

*Last Updated: $(date -u +%Y-%m-%d) UTC*.