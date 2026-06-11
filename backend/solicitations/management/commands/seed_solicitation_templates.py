from django.core.management.base import BaseCommand
from solicitations.models import SolicitationTemplate

ITB_CONTENT = """
<h2>Part I — Invitation to Bid</h2>
<p>The Zambia Medicines and Medical Supplies Agency (ZAMMSA) invites sealed bids from eligible bidders for the supply of goods as described in this Invitation to Bid (ITB). Bidding is open to all bidders eligible as defined in the Procurement Act and ZPPA Regulations.</p>

<div class="section">
<h3>1. Bid Submission</h3>
<p>Bids must be submitted in sealed envelopes clearly marked with the solicitation number and title, addressed to the Head of Procurement, ZAMMSA, and deposited in the tender box located at ZAMMSA Head Office, Plot No. 8499, Mwambwi Road, Lusaka, not later than the closing date and time specified in the solicitation.</p>
</div>

<div class="section">
<h3>2. Bid Security</h3>
<p>A bid security of not less than 2% of the bid price shall be submitted with each bid. The bid security shall be in the form of a bank guarantee, certified cheque, or bid bond issued by a reputable commercial bank registered in Zambia. Bid securities must remain valid for thirty (30) days beyond the bid validity period.</p>
</div>

<div class="section">
<h3>3. Bid Validity</h3>
<p>Bids shall remain valid for a period of ninety (90) calendar days from the date of bid closing. The Procuring Entity reserves the right to request an extension of bid validity beyond this period at its sole discretion.</p>
</div>

<div class="section">
<h3>4. Eligibility Criteria</h3>
<ul>
<li>Valid Certificate of Incorporation / Registration issued by PACRA</li>
<li>Valid ZRA Tax Clearance Certificate</li>
<li>Valid NAPSA Compliance Certificate</li>
<li>Valid NHIMA Compliance Certificate</li>
<li>Proof of similar supply capacity and experience (minimum 3 similar contracts in past 5 years)</li>
<li>ZPPA registration in the relevant category</li>
</ul>
</div>

<div class="section">
<h3>5. Evaluation Methodology</h3>
<p>Bids shall be evaluated using the Lowest Evaluated Responsive Bidder (LERB) method. Bidders must meet all mandatory requirements and technical specifications. Financial bids shall be compared on a common basis after applying any applicable margin of preference for citizen-owned enterprises as per the Citizen Economic Empowerment Commission (CEEC) guidelines.</p>
</div>

<div class="section">
<h3>6. Clarification and Site Visits</h3>
<p>Bidders may request clarifications in writing not later than seven (7) working days before the bid closing date. ZAMMSA shall respond to all clarification requests in writing and circulate anonymous responses to all prospective bidders. A pre-bid conference may be held as specified in the solicitation.</p>
</div>

<div class="section">
<h3>7. Right to Accept or Reject</h3>
<p>ZAMMSA reserves the right to accept or reject any or all bids, to annul the tendering process at any time prior to contract award, and to reject all bids at any time without thereby incurring any liability to any affected bidder.</p>
</div>
"""

RFP_CONTENT = """
<h2>Part I — Request for Proposals</h2>
<p>ZAMMSA invites proposals from eligible consulting firms and individual consultants to provide the services described in this Request for Proposals (RFP). This RFP follows the Quality and Cost-Based Selection (QCBS) method as prescribed by ZPPA.</p>

<div class="section">
<h3>1. Submission Requirements</h3>
<p>Proposals must be submitted in two separate sealed envelopes clearly marked "Technical Proposal" and "Financial Proposal" respectively. The outer envelope must bear the solicitation number and title. Technical proposals shall be opened immediately after the closing date, while financial proposals shall remain sealed until evaluation of technical proposals is complete.</p>
</div>

<div class="section">
<h3>2. Proposal Security</h3>
<p>Proposal security of not less than 2% of the budget estimate is required. The proposal security must be valid for sixty (60) days beyond the proposal validity period. Proposals submitted without the required security shall be rejected as non-responsive.</p>
</div>

<div class="section">
<h3>3. Proposal Validity</h3>
<p>Proposals shall remain valid for one hundred and twenty (120) calendar days from the submission deadline. Consultants may be requested to extend the validity period pending finalisation of evaluations and contract negotiations.</p>
</div>

<div class="section">
<h3>4. Technical Evaluation Criteria</h3>
<ul>
<li>Firm's relevant experience and track record — 25%</li>
<li>Proposed methodology and work plan — 30%</li>
<li>Key personnel qualifications and experience — 35%</li>
<li>Knowledge transfer and local capacity building — 10%</li>
</ul>
<p>A minimum technical score of 70% is required to proceed to financial evaluation.</p>
</div>

<div class="section">
<h3>5. Financial Evaluation</h3>
<p>Financial proposals of technically responsive firms shall be opened in a public session. The total combined score shall be computed as Technical Score (80%) + Financial Score (20%). The firm with the highest combined score shall be invited for negotiations.</p>
</div>

<div class="section">
<h3>6. Conflict of Interest</h3>
<p>Consultants shall not be hired for engagements that conflict with their prior obligations. Consultants shall disclose any actual or potential conflicts of interest and shall recuse themselves from assignments where impartiality may be compromised.</p>
</div>
"""

RFQ_CONTENT = """
<h2>Part I — Request for Quotations</h2>
<p>ZAMMSA invites quotations from eligible suppliers for the provision of goods as specified herein. This procurement is conducted under the simplified bidding procedure in accordance with ZPPA thresholds for small value procurements.</p>

<div class="section">
<h3>1. Submission Instructions</h3>
<p>Quotations must be submitted in sealed envelopes marked "Quotation — [Solicitation Number]" or via the ZAMMSA eProcurement Portal. Quotations submitted by email must be encrypted and password-protected. The password must be provided to the Head of Procurement separately not later than the closing date and time.</p>
</div>

<div class="section">
<h3>2. Quotation Validity</h3>
<p>Quotations shall remain valid for a minimum period of thirty (30) calendar days from the closing date. ZAMMSA may request bidders to extend the validity period; such extension shall be requested in writing.</p>
</div>

<div class="section">
<h3>3. Specifications</h3>
<p>Goods offered must strictly meet the technical specifications set out in the solicitation. Alternative specifications or substitutes will not be considered unless expressly authorised in the solicitation document. Bidders must provide detailed product literature demonstrating compliance.</p>
</div>

<div class="section">
<h3>4. Delivery Terms</h3>
<p>All goods shall be delivered DDP (Delivered Duty Paid) to ZAMMSA designated stores or delivery locations as specified in the purchase order. Delivery periods shall be calculated from the date of receipt of the purchase order. Late delivery shall attract penalties as stipulated in the conditions of contract.</p>
</div>

<div class="section">
<h3>5. Evaluation and Award</h3>
<p>Award shall be made to the lowest priced technically compliant quotation. The Procuring Entity may split the award among multiple bidders where quantity discounts are offered or where supply capacity necessitates multi-award. Bidders must indicate their acceptance of ZAMMSA's standard terms and conditions.</p>
</div>
"""

GCC_CONTENT = """
<h2>General Conditions of Contract — ZPPA Standard v2024</h2>
<p>These General Conditions of Contract (GCC) form part of all contracts awarded by ZAMMSA pursuant to a solicitation process. The GCC shall govern the contractual relationship between ZAMMSA (the "Purchaser") and the successful bidder (the "Supplier") for the supply of goods, works, or services.</p>

<div class="section">
<h3>1. Definitions and Interpretation</h3>
<p>"Contract" means the agreement between the Purchaser and the Supplier including all annexes, appendices, and documents incorporated by reference. "Goods" means all items, materials, equipment, and supplies to be provided under the contract. "Purchaser" means ZAMMSA. "Supplier" means the legal entity contracted to provide the Goods.</p>
</div>

<div class="section">
<h3>2. Governing Language and Law</h3>
<p>The contract shall be governed by and construed in accordance with the laws of the Republic of Zambia. The language of the contract and all communications shall be English. Any translation of the contract into a local language shall be for reference purposes only and the English version shall prevail.</p>
</div>

<div class="section">
<h3>3. Performance Security</h3>
<p>Within twenty-eight (28) days of receipt of the Letter of Acceptance, the Supplier shall furnish a performance security in the amount of ten percent (10%) of the contract price, in the form of a bank guarantee or insurance bond from a reputable institution acceptable to ZAMMSA. The performance security shall remain valid until issuance of the Final Acceptance Certificate.</p>
</div>

<div class="section">
<h3>4. Delivery and Inspection</h3>
<p>The Supplier shall deliver the Goods within the delivery period specified in the Purchase Order. All Goods shall be subject to inspection and testing prior to acceptance. ZAMMSA reserves the right to reject any Goods that do not conform to the specified requirements. The Supplier shall bear all costs of replacement of rejected Goods.</p>
</div>

<div class="section">
<h3>5. Warranty</h3>
<p>The Supplier warrants that all Goods supplied shall be new, unused, of the most recent models, and shall conform to the specifications and standards described in the contract. The warranty period shall be a minimum of twelve (12) months from the date of final acceptance or such longer period as specified in the Special Conditions of Contract.</p>
</div>

<div class="section">
<h3>6. Payment Terms</h3>
<p>Payment shall be made within thirty (30) calendar days of receipt of a valid invoice and upon certification by the User Department that Goods have been received, inspected, and accepted. All payments shall be made in Zambian Kwacha (ZMW) unless otherwise specified. Payments may be made by direct bank transfer or cheque as determined by ZAMMSA.</p>
</div>

<div class="section">
<h3>7. Liquidated Damages</h3>
<p>Should the Supplier fail to deliver within the stipulated delivery period, the Supplier shall pay liquidated damages at the rate of one percent (1%) of the contract value per week of delay, up to a maximum of ten percent (10%). Beyond this threshold, ZAMMSA may terminate the contract and enforce the performance security.</p>
</div>

<div class="section">
<h3>8. Termination</h3>
<p>ZAMMSA may terminate the contract in whole or in part: (a) for cause — if the Supplier fails to perform its obligations; (b) for convenience — if ZAMMSA determines that termination is in its best interest; or (c) for insolvency — if the Supplier is declared bankrupt or insolvent. Termination for convenience shall entitle the Supplier to payment for Goods delivered and accepted up to the date of termination.</p>
</div>

<div class="section">
<h3>9. Dispute Resolution</h3>
<p>Any dispute arising under the contract shall first be referred to amicable negotiation between the parties. Should negotiation fail, the dispute shall be referred to mediation in accordance with the Mediation Act. If mediation fails, the dispute shall be finally settled by arbitration in accordance with the Arbitration Act of Zambia, administered by the Zambia Association of Arbitration.</p>
</div>

<div class="section">
<h3>10. Force Majeure</h3>
<p>Neither party shall be held liable for failure to perform its obligations under the contract if such failure results from events of Force Majeure including but not limited to: acts of God, war, civil unrest, strikes, fires, floods, epidemics, and government actions. The affected party shall notify the other party within fourteen (14) days of the occurrence.</p>
</div>
"""

BID_FORMS_CONTENT = """
<h2>Standard Bid Forms (ZPPA-Approved)</h2>
<p>The following bid forms comprise the approved ZPPA-standard documentation that must be completed and submitted by all bidders as part of their bid response. All forms must be signed by an authorised representative of the bidding entity.</p>

<div class="section">
<h3>Form A — Bid Submission Letter</h3>
<p>A formal letter on the bidder's letterhead indicating the bidder's intent to bid, confirming the bid validity period, and binding the bidder to the terms and conditions of the solicitation. The letter must be signed by the Chief Executive Officer or an authorised representative.</p>
</div>

<div class="section">
<h3>Form B — Bidder Information Form</h3>
<p>The Bidder Information Form captures: legal name and trading name, registration number and date of incorporation, physical and postal address, contact details, VAT registration number, tax clearance certificate reference, shareholding structure, and beneficial ownership details.</p>
</div>

<div class="section">
<h3>Form C — Bid Schedule / Price Schedule</h3>
<p>The Price Schedule must list each item offered with: item number and description, country of origin, quantity, unit price excluding VAT, total price per item excluding VAT, applicable VAT amount, and the grand total price including all taxes and duties. Prices must be in Zambian Kwacha (ZMW).</p>
</div>

<div class="section">
<h3>Form D — Technical Compliance Schedule</h3>
<p>Bidders must complete a compliance statement against each technical specification, indicating Full Compliance / Partial Compliance / Non-Compliance. Partial compliance must be accompanied by explanatory notes and supporting documentation. Deviations from specifications must be clearly identified.</p>
</div>

<div class="section">
<h3>Form E — Bidder Experience Statement</h3>
<p>Bidders must provide a minimum of three (3) similar contracts completed within the past five (5) years, including: client name and contact details, contract description and value, period of performance, and certificates of completion or client reference letters.</p>
</div>

<div class="section">
<h3>Form F — Financial Capability Statement</h3>
<p>Bidders must provide: audited financial statements for the past three (3) years, bankers' reference letter, credit facility confirmation, and a statement of overall turnover and turnover in similar contracts. For consortium bids, financial statements for all consortium members are required.</p>
</div>

<div class="section">
<h3>Form G — Bid Security Form</h3>
<p>The Bid Security must be completed by the issuing financial institution and must include: beneficiary (ZAMMSA), principal (bidder), solicitation number, amount of security (minimum 2% of bid price), and validity period (thirty days beyond bid validity). The security must be unconditional and irrevocable.</p>
</div>
"""

COI_CONTENT = """
<h2>Conflict of Interest Declaration Form</h2>
<p>This form must be completed by all members of the Evaluation Committee, Technical Evaluation Team, and any other person involved in the evaluation and award process. The purpose is to identify, declare, and manage any actual, potential, or perceived conflicts of interest.</p>

<div class="section">
<h3>Section A — Personal Details</h3>
<p>Full Name: ........................................................<br>
National Registration Number (NRC): ................<br>
Position / Title: ..............................................<br>
Role in Procurement: ........................................</p>
</div>

<div class="section">
<h3>Section B — Declaration of Interests</h3>
<p>I hereby declare that to the best of my knowledge and belief, I have / do not have (delete as applicable) any of the following interests in relation to this procurement:</p>
<ul>
<li>I am a director, shareholder, partner, or employee of any bidding entity.</li>
<li>I have a personal relationship (family, business, or social) with any representative of a bidding entity.</li>
<li>I have a financial interest in the outcome of this procurement.</li>
<li>I have received or been offered any gift, hospitality, or benefit from any bidding entity.</li>
<li>I have previously been employed by or provided consultancy services to any bidding entity within the last three (3) years.</li>
</ul>
</div>

<div class="section">
<h3>Section C — Declaration of Confidentiality</h3>
<p>I undertake to maintain strict confidentiality regarding all information, documents, and deliberations relating to this evaluation. I shall not disclose any evaluation information to any person not directly involved in the evaluation process. I shall not use any information obtained during the evaluation for personal gain or advantage.</p>
</div>

<div class="section">
<h3>Section D — Certification</h3>
<p>I confirm that the information provided in this declaration is true and complete. I acknowledge that providing false or misleading information may result in legal action, disqualification from the procurement process, and disciplinary action up to and including dismissal.</p>
<p>Signed: ........................................................<br>
Date: ..............................................................</p>
</div>
"""

BID_SECURITY_CONTENT = """
<h2>Bid Security Form (Bank/Surety Guarantee Template)</h2>
<p>This form serves as the standard template for a Bank Guarantee or Insurance Surety Bond to be issued by a reputable financial institution in favour of ZAMMSA as security for a bid submitted in response to a solicitation.</p>

<div class="section">
<h3>Bank Guarantee — Format</h3>
<p>To: The Head of Procurement<br>
Zambia Medicines and Medical Supplies Agency (ZAMMSA)<br>
Plot No. 8499, Mwambwi Road<br>
Lusaka, Zambia</p>
<p><strong>BID GUARANTEE No.:</strong> ............................</p>
<p><strong>Date:</strong> ....................</p>
<p><strong>SOLICITATION No.:</strong> ............................</p>
</div>

<div class="section">
<h3>Guarantee Clause</h3>
<p>We, [Name of Bank/Insurance Company], having our registered office at [Address], hereby irrevocably guarantee to pay ZAMMSA, on first written demand without cavil or demur, a sum not exceeding [Amount in Words] (ZMW [Amount in Figures]) upon receipt of ZAMMSA's written certification that the Bidder has:</p>
<ol>
<li>Withdrawn or modified their bid during the bid validity period; or</li>
<li>Failed to submit the required performance security within the stipulated period after award; or</li>
<li>Failed to enter into the contract after being awarded; or</li>
<li>Failed to comply with any other condition precedent to contract formation as specified in the solicitation documents.</li>
</ol>
</div>

<div class="section">
<h3>Validity</h3>
<p>This guarantee shall remain valid up to and including [Date — being 30 days beyond bid validity]. Any claim under this guarantee must be received by us in writing on or before the expiry date. This guarantee shall automatically expire and become null and void on the expiry date regardless of whether the original document has been returned to us.</p>
</div>

<div class="section">
<h3>Execution</h3>
<p>Signed by an authorised officer of the Bank / Insurance Company:</p>
<p>Name: ........................................................<br>
Title: .............................................................<br>
Date: ..............................................................</p>
<p><em>Bank/Company Seal:</em></p>
</div>
"""

BID_SECURING_DECLARATION_CONTENT = """
<h2>Bid Securing Declaration Form</h2>
<p>This Bid Securing Declaration serves as an alternative to a Bid Security (Bank Guarantee) for procurements where the estimated value does not exceed the threshold prescribed by ZPPA. This declaration is binding on the bidder and enforceable under the laws of Zambia.</p>

<div class="section">
<h3>Bid Securing Declaration</h3>
<p>We, the undersigned, hereby declare and warrant that:</p>
<ol>
<li>We understand that this Bid Securing Declaration is a legally binding commitment.</li>
<li>We acknowledge that if we withdraw or modify our bid during the bid validity period, or fail to execute the contract or provide the required performance security after award, we shall be liable for payment to ZAMMSA of an amount equivalent to two percent (2%) of our total bid price, subject to a maximum amount as prescribed by ZPPA regulations.</li>
</ol>
</div>

<div class="section">
<h3>Bidder Details</h3>
<p>Bidder Name: ................................................<br>
Registration No.: ..............................................<br>
Solicitation No.: ...............................................<br>
Bid Amount (ZMW): ...........................................</p>
</div>

<div class="section">
<h3>Undertaking</h3>
<p>We undertake to pay ZAMMSA the said amount upon first written demand without requiring proof that ZAMMSA is entitled to such payment. We waive all rights of objection and defence relating to such demand.</p>
</div>

<div class="section">
<h3>Execution</h3>
<p>By signing this Bid Securing Declaration, the bidder acknowledges that this document is equivalent to a bank guarantee and that any false declaration or default shall constitute a procurement offence under the ZPPA Act.</p>
<p>Signed by an authorised representative:</p>
<p>Name: ........................................................<br>
Title: .............................................................<br>
Date: ..............................................................</p>
<p><em>Company Seal:</em></p>
</div>
"""

CEEC_CONTENT = """
<h2>CEEC Preference Application Form</h2>
<p>This form is for use by Citizen-Owned Enterprises seeking to benefit from the preference scheme under the Citizens Economic Empowerment Commission (CEEC) Act No. 9 of 2006. Only enterprises that are at least 51% citizen-owned and registered with CEEC are eligible for the preference margin.</p>

<div class="section">
<h3>Section A — Bidder Information</h3>
<p>Company Name: ................................................<br>
Company Registration No. (PACRA): ....................<br>
CEEC Registration No.: ......................................<br>
Date of Registration with CEEC: ...........................<br>
Business Category: [Goods / Works / Services] ........</p>
</div>

<div class="section">
<h3>Section B — Ownership Structure</h3>
<p>Provide details of all shareholders and their respective shareholdings:</p>
<p>Citizen Shareholding Percentage: ........................%<br>
Non-Citizen Shareholding Percentage: ...................%<br>
Total Shareholding: 100%</p>
<p><em>Attach certified copies of share certificates and CR-5 Form from PACRA.</em></p>
</div>

<div class="section">
<h3>Section C — Management Profile</h3>
<p>Chief Executive Officer Name: ............................<br>
CEO Nationality: .................................................<br>
Number of Citizen Managers (Executive): ..............<br>
Number of Non-Citizen Managers (Executive): .......</p>
</div>

<div class="section">
<h3>Section D — Preference Claimed</h3>
<p>Preference Margin Claimed: [Standard / Enhanced]</p>
<p>Note: Standard preference (15%) applies to citizen-owned enterprises. Enhanced preference (20%) applies to citizen-owned enterprises that also have at least 70% citizen employees at management level.</p>
</div>

<div class="section">
<h3>Section E — Declaration</h3>
<p>I hereby declare that the information provided in this application is true and correct. I understand that any false declaration may result in immediate disqualification of the bid, debarment from future procurement opportunities, and legal prosecution under the CEEC Act.</p>
<p>Signed: ........................................................<br>
Name: .............................................................<br>
Title: ..............................................................<br>
Date: ..............................................................</p>
</div>
"""

TWO_ENVELOPE_CONTENT = """
<h2>Two-Envelope Submission Guidelines</h2>
<p>This document provides guidelines for bidders submitting proposals under the Two-Envelope system, where the Technical Proposal and Financial Proposal are submitted simultaneously but in separate sealed envelopes. This method is used for complex procurements requiring detailed technical evaluation before financial consideration.</p>

<div class="section">
<h3>1. General Principles</h3>
<p>The Two-Envelope system ensures that financial proposals remain sealed and unopened until the technical evaluation is completed and approved. This safeguards the integrity of the evaluation process by preventing any influence of price on the technical assessment.</p>
</div>

<div class="section">
<h3>2. Envelope Labelling Requirements</h3>
<p>Each bidder shall submit two (2) separate sealed envelopes as follows:</p>
<p><strong>ENVELOPE A — TECHNICAL PROPOSAL</strong><br>
Outer envelope marked: "TECHNICAL PROPOSAL — [Solicitation Number]"<br>
Inner envelope containing: Technical submission, methodology, qualifications, experience, compliance schedules, and all non-financial information.</p>
<p><strong>ENVELOPE B — FINANCIAL PROPOSAL</strong><br>
Outer envelope marked: "FINANCIAL PROPOSAL — [Solicitation Number]"<br>
Inner envelope containing: Price schedules, bill of quantities, financial model, and all pricing information.</p>
<p>Both envelopes shall then be placed in an outer envelope addressed to ZAMMSA.</p>
</div>

<div class="section">
<h3>3. Opening Procedure — Technical Proposals</h3>
<p>At the public opening session, only Envelope A (Technical Proposal) shall be opened and recorded. Envelope B (Financial Proposal) shall remain sealed and shall be kept in secure custody by the Procurement Committee Secretary. The public opening minutes shall record each bidder's name and technical submission details only — no financial information shall be disclosed at this stage.</p>
</div>

<div class="section">
<h3>4. Technical Evaluation</h3>
<p>The Evaluation Committee shall evaluate the technical proposals in accordance with the published evaluation criteria. Bidders achieving the minimum technical threshold score (70% or as specified in the solicitation) shall be deemed technically responsive. All bidders shall be notified of the outcome of the technical evaluation in writing.</p>
</div>

<div class="section">
<h3>5. Opening of Financial Proposals</h3>
<p>Only the financial proposals of bidders who achieved the minimum technical threshold shall be opened. The opening of financial proposals shall be conducted in a public session after the technical evaluation is approved. Bidders whose technical proposals did not meet the threshold shall have their financial proposals returned unopened.</p>
</div>

<div class="section">
<h3>6. Combined Evaluation</h3>
<p>The final evaluation score shall be calculated as: Technical Score (80%) + Financial Score (20%). The bidder with the highest combined score shall be recommended for award. The same weighting ratios shall apply to all bids in the same solicitation.</p>
</div>
"""

TEMPLATES = [
    {
        'template_name': 'Invitation to Bid (ITB) Standard Document',
        'method': 'itb',
        'document_type': 'bidding_document',
        'template_content': ITB_CONTENT,
        'is_zppa_template': True,
        'version': '2.0',
        'mandatory_clauses': [
            {'clause_id': 'itb-001', 'clause_text': 'All bidders must comply with the Public Procurement Act No. 27 of 2020 and ZPPA Regulations of 2022.', 'is_locked': True},
            {'clause_id': 'itb-002', 'clause_text': 'Bidders must provide valid tax clearance, NAPSA, and NHIMA compliance certificates.', 'is_locked': True},
            {'clause_id': 'itb-003', 'clause_text': 'ZAMMSA reserves the right to inspect bidder facilities and verify information provided.', 'is_locked': False},
            {'clause_id': 'itb-004', 'clause_text': 'Any form of collusion, corruption, or fraudulent practice shall result in immediate disqualification.', 'is_locked': True},
        ],
    },
    {
        'template_name': 'Request for Proposals (RFP) Standard Document',
        'method': 'rfp',
        'document_type': 'bidding_document',
        'template_content': RFP_CONTENT,
        'is_zppa_template': True,
        'version': '2.0',
        'mandatory_clauses': [
            {'clause_id': 'rfp-001', 'clause_text': 'Consultants must disclose any actual or potential conflicts of interest.', 'is_locked': True},
            {'clause_id': 'rfp-002', 'clause_text': 'All proposals must comply with the consulting services procurement guidelines under ZPPA.', 'is_locked': True},
            {'clause_id': 'rfp-003', 'clause_text': 'Key personnel proposed shall not be replaced without prior written approval from ZAMMSA.', 'is_locked': True},
        ],
    },
    {
        'template_name': 'Request for Quotations (RFQ) Standard Document',
        'method': 'rfq',
        'document_type': 'bidding_document',
        'template_content': RFQ_CONTENT,
        'is_zppa_template': True,
        'version': '2.0',
        'mandatory_clauses': [
            {'clause_id': 'rfq-001', 'clause_text': 'Quotations must quote for all items in the schedule; partial quotations may be rejected.', 'is_locked': False},
            {'clause_id': 'rfq-002', 'clause_text': 'ZAMMSA is not obligated to accept the lowest or any quotation received.', 'is_locked': True},
        ],
    },
    {
        'template_name': 'General Conditions of Contract (ZPPA v2024)',
        'method': '',
        'document_type': 'other',
        'template_content': GCC_CONTENT,
        'is_zppa_template': True,
        'version': '2024.1',
        'mandatory_clauses': [],
    },
    {
        'template_name': 'Standard Bid Forms (ZPPA-approved)',
        'method': '',
        'document_type': 'bidding_document',
        'template_content': BID_FORMS_CONTENT,
        'is_zppa_template': True,
        'version': '2.0',
        'mandatory_clauses': [
            {'clause_id': 'sbf-001', 'clause_text': 'All forms must be completed in full and signed by an authorised representative.', 'is_locked': True},
            {'clause_id': 'sbf-002', 'clause_text': 'Incomplete forms may result in disqualification.', 'is_locked': True},
        ],
    },
    {
        'template_name': 'Conflict of Interest Declaration Form',
        'method': '',
        'document_type': 'other',
        'template_content': COI_CONTENT,
        'is_zppa_template': True,
        'version': '1.0',
        'mandatory_clauses': [],
    },
    {
        'template_name': 'Bid Security Form (Bank/Surety Guarantee Template)',
        'method': '',
        'document_type': 'other',
        'template_content': BID_SECURITY_CONTENT,
        'is_zppa_template': True,
        'version': '1.0',
        'mandatory_clauses': [],
    },
    {
        'template_name': 'Bid Securing Declaration Form',
        'method': '',
        'document_type': 'other',
        'template_content': BID_SECURING_DECLARATION_CONTENT,
        'is_zppa_template': True,
        'version': '1.0',
        'mandatory_clauses': [],
    },
    {
        'template_name': 'CEEC Preference Application Form',
        'method': '',
        'document_type': 'other',
        'template_content': CEEC_CONTENT,
        'is_zppa_template': True,
        'version': '1.0',
        'mandatory_clauses': [],
    },
    {
        'template_name': 'Two-Envelope Submission Guidelines',
        'method': '',
        'document_type': 'other',
        'template_content': TWO_ENVELOPE_CONTENT,
        'is_zppa_template': True,
        'version': '1.0',
        'mandatory_clauses': [],
    },
]


class Command(BaseCommand):
    help = 'Seed solicitation templates with realistic ZAMMSA/ZPPA-standard content'

    def handle(self, *args, **options):
        created = 0
        for data in TEMPLATES:
            _, was_created = SolicitationTemplate.objects.update_or_create(
                template_name__iexact=data['template_name'],
                defaults=data,
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {data['template_name']}"))
            else:
                self.stdout.write(f"  Updated: {data['template_name']}")
        self.stdout.write(self.style.SUCCESS(f'\nDone. {created} new templates created, {len(TEMPLATES) - created} updated.'))
