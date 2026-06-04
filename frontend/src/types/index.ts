export interface User {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  must_change_password: boolean;
  password_changed_at: string;
  created_at: string;
  last_login: string | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
  must_change_password?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export type StatusType =
  | 'draft' | 'submitted' | 'pending_dept_head' | 'pending_finance'
  | 'pending_dg' | 'pending_zpc' | 'pending_approval'
  | 'approved' | 'rejected'
  | 'active' | 'completed' | 'terminated' | 'cancelled'
  | 'published' | 'closed' | 'awarded'
  | 'pending' | 'verified' | 'failed';

export interface Requisition {
  id: string;
  requisition_id?: string;
  title: string;
  description: string;
  department: string;
  department_name?: string;
  req_number?: string;
  status: StatusType;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimated_value: number;
  estimated_total?: number;
  currency?: string;
  procurement_method?: string;
  date_required?: string;
  required_date?: string;
  delivery_location?: string;
  created_by?: string;
  requester_name?: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  submitted_at: string | null;
  approved_at?: string | null;
  budget_validated?: boolean;
  encumbrance_ref?: string;
  app_line_item?: string;
  app_line_item_id?: string;
  app_line_item_ref?: string;
  items: RequisitionItem[];
  specifications?: any[];
  approvals?: any[];
  attachments?: Attachment[];
}

export interface RequisitionItem {
  id: string;
  requisition: string;
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  estimated_unit_cost: number;
  estimated_total_cost: number;
}

export interface Attachment {
  id: string;
  file: string;
  filename: string;
  file_type: string;
  uploaded_at: string;
}

export interface Solicitation {
  id: string;
  solicitation_id?: string;
  title: string;
  description: string;
  type: 'rfq' | 'rfb' | 'rfp' | 'rfi';
  requisition: string;
  status: StatusType;
  issue_date: string;
  closing_date: string;
  opening_date: string;
  estimated_value: number;
  currency: string;
  budget_code: string;
  procurement_method: string;
  total_bids?: number;
  created_by: string;
  department: string;
  department_name?: string;
  approved_by?: string;
  published_at?: string;
  sol_number?: string;
  addenda: Addendum[];
  document_sets: Attachment[];
  clarification_responses: Clarification[];
  evaluation_criteria?: EvaluationCriterion[];
  created_at: string;
  updated_at: string;
  // Publication tracking
  publication_targets?: string[];
  publication_proofs?: Record<string, any>;
  egp_reference?: string;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
  // Extended solicitation detail fields
  submission_format?: 'single' | 'two';
  bid_validity_days?: number;
  pre_bid_date?: string;
  pre_bid_venue?: string;
  citizen_preference?: boolean;
  bid_security_required?: boolean;
  bid_security_type?: string;
  bid_security_rate?: number;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  minimum_technical_threshold?: number;
  document_fee_enabled?: boolean;
  document_fee_amount?: number;
}

export interface Addendum {
  id: string;
  number: number;
  description: string;
  document: Attachment;
  issued_at: string;
}

export interface Clarification {
  id: string;
  question: string;
  answer: string;
  asked_by: string;
  asked_at: string;
  answered_at: string | null;
}

export interface Bid {
  id: string;
  solicitation: string;
  vendor: string;
  vendor_name: string;
  bid_number: string;
  submission_id?: string;
  bidder_name?: string;
  receipt_number?: string;
  status: 'draft' | 'submitted' | 'withdrawn' | 'modified' | 'opened' | 'evaluated';
  bid_amount: number;
  currency: string;
  validity_period_days: number;
  security_amount: number;
  security_type: string;
  security_expiry: string;
  security_verified: boolean;
  submission_method: 'online' | 'physical';
  financial_envelope_encrypted?: boolean;
  addenda_acknowledged?: boolean;
  addenda_acknowledged_at?: string;
  is_late?: boolean;
  technical_doc_url?: string;
  financial_doc_url?: string;
  submission_timestamp?: string;
  documents: Attachment[];
  items: BidItem[];
  submitted_at: string | null;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
  solicitation_title?: string;
  solicitation_number?: string;
  solicitation_type?: string;
  closing_date?: string;
}

export interface BidItem {
  id: string;
  bid: string;
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface EvaluationCommittee {
  id: string;
  committee_id: string;
  solicitation: string;
  solicitation_number?: string;
  solicitation_title?: string;
  members: any[];
  chairperson: string;
  chairperson_name?: string;
  secretary: string;
  secretary_name?: string;
  formed_date: string;
  formed_at?: string;
  status: string;
  member_count?: number;
  coi_declarations?: ConflictOfInterest[];
}

export interface EvaluationMember {
  id: string;
  user: string;
  full_name: string;
  role: 'chairperson' | 'secretary' | 'member';
  is_present: boolean;
}

export interface Evaluation {
  id: string;
  solicitation: string;
  bid: string;
  committee: string;
  scores: EvaluationScore[];
  financial_envelope_opened: boolean;
  ber_generated: boolean;
  ber_signed: boolean;
  ber_submitted: boolean;
  ber_approved: boolean;
  ber_file: string | null;
  total_score: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationScore {
  id: string;
  evaluation: string;
  evaluator: string;
  bid: string;
  criteria: string;
  score: number;
  comment: string;
}

export interface ConflictOfInterest {
  id: string;
  committee: string;
  member: string;
  member_name: string;
  member_email: string;
  declaration: string;
  has_conflict: boolean;
  declaration_type: 'no_conflict' | 'general_conflict' | 'specific_conflict';
  conflicted_bidders: string[];
  explanation: string;
  confidentiality_agreed: boolean;
  recused: boolean;
  declared_at: string;
}

export interface CommitteeCOIState {
  declarations: ConflictOfInterest[];
  recused_members: string[];
}

export interface MyScoresResponse {
  my_scores: any[];
  all_scores: any[];
  is_final: boolean;
}

export interface ScoreAverageResult {
  criterion_id: string;
  criterion_name: string;
  average_raw_score: number;
  weighted_score: number;
  weight: number;
}

export interface ScoreThresholdResult {
  bid_id: string;
  overall_technical_score: number;
  threshold: number;
  passed: boolean;
  details: ScoreAverageResult[];
}

export interface PassedTechBid {
  bid_id: string;
  submission_id: string;
  bidder_name: string;
  vendor_name?: string;
  original_price?: number;
  preference_category?: string;
  preference_margin?: number;
  overall_technical_score: number;
  passed: boolean;
  financial_evaluation_id: string | null;
  evaluated_price: number | null;
  financial_score: number | null;
  financial_sealed: boolean;
  details: ScoreAverageResult[];
}

export interface CombinedScoreResult {
  bid_id: string;
  submission_id: string;
  bidder_name: string;
  technical_score: number;
  financial_score: number;
  total_score: number;
  rank?: number;
}

export interface BERSignature {
  member_id: string;
  member_name: string;
  role: string;
  signed_at: string;
}

export interface BERSignatureStatus {
  ber_id: string;
  status: string;
  signatures: BERSignature[];
  members: { id: string; full_name: string; role: string; signed: boolean }[];
  signed_count: number;
  total_required: number;
  all_signed: boolean;
}

export interface Contract {
  id: string;
  title: string;
  contract_number: string;
  contract_type?: string;
  solicitation_number?: string;
  solicitation: string;
  vendor: string;
  vendor_name: string;
  value: number;
  currency: string;
  status: string;
  start_date: string;
  end_date: string;
  signed_by_vendor: boolean;
  signed_by_authority: boolean;
  signed_vendor_date: string | null;
  signed_authority_date: string | null;
  contract_document: string;
  milestones: ContractMilestone[];
  amendments: ContractAmendment[];
  appeals: any[];
  securities: ContractSecurity[];
  closure_checklists: any[];
  contract_manager: string | null;
  award_date: string | null;
  completed_at?: string | null;
  award_notice_published: boolean;
  award_notice_published_at: string | null;
  waiting_period_days: number;
  waiting_period_start: string | null;
  waiting_period_end: string | null;
  appeal_pending: boolean;
  performance_security_required: boolean;
  performance_security_uploaded: boolean;
  performance_security_validated: boolean;
  requires_performance_bond: boolean;
  performance_bond: PerformanceBond | null;
  archived_at: string | null;
  retention_expiry: string | null;
  legal_hold: boolean;
  created_at: string;
  updated_at: string;
}



export interface ContractSecurity {
  id?: string;
  security_id?: string;
  contract: string;
  security_type: string;
  amount: string;
  issuing_bank: string;
  reference_number: string;
  expiry_date: string | null;
  status: string;
}

export interface PerformanceBond {
  amount: string | null;
  expiry_date: string | null;
  status: string;
  issuing_bank: string;
  reference_number: string;
}
export interface ContractMilestone {
  id: string;
  contract: string;
  title: string;
  milestone_name?: string;
  description?: string;
  due_date: string;
  completion_date: string | null;
  status: string;
  notes?: string;
}

export interface ContractAmendment {
  id: string;
  contract: string;
  amendment_number: number;
  description: string;
  reason: string;
  value_change: number;
  financial_impact: number;
  variation_percentage: number;
  legal_review_required: boolean;
  legal_opinion_ref: string;
  signed_by_supplier: boolean;
  signed_by_authority: boolean;
  approved_by: string | null;
  created_at: string;
}

export type InvoiceStatus = 'draft' | 'submitted' | 'pending_matching' | 'pending_approval' | 'approved' | 'paid' | 'rejected';

export type PaymentMethod = 'electronic' | 'cheque' | 'loc' | 'iso20022';

export type PaymentStatus = 'pending' | 'processing' | 'sent' | 'confirmed' | 'failed';

export type ApprovalRoute = 'finance_officer' | 'department_head' | 'director_general';

export type LocType = 'sight' | 'usance' | 'standby';

export type LocStatus = 'issued' | 'confirmed' | 'utilized' | 'exhausted' | 'expired';

export type MatchStatus = 'complete' | 'partial' | 'no_match';

export interface GoodsReceiptNote {
  grn_id: string;
  contract: string;
  po_number: string;
  grn_number: string;
  item_description: string;
  quantity_received: number;
  unit_price: number;
  total_amount: number;
  received_date: string;
  received_by: string;
  notes: string;
  source: string;
}

export interface ThreeWayMatch {
  match_id: string;
  invoice: string;
  po_quantity: number;
  grn_quantity: number;
  invoice_quantity: number;
  po_price: number;
  invoice_price: number;
  match_status: MatchStatus;
  discrepancies: Record<string, any>;
}

export interface Invoice {
  invoice_id: string;
  id?: string; // Standardized ID
  contract: string;
  contract_number?: string;
  contract_value?: number;
  po_number: string;
  grn: string | null;
  supplier: string;
  supplier_name?: string;
  supplier_bank?: string;
  invoice_number: string;
  amount: number;
  due_date: string | null;
  document: string;
  status: InvoiceStatus;
  approval_route: ApprovalRoute | null;
  rejection_reason: string;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  erp_posted: boolean;
  erp_posted_at: string | null;
  payment_advice_sent: boolean;
  payment_advice_sent_at: string | null;
  created_at: string;
  updated_at: string;
  grn_details?: GoodsReceiptNote;
  suggested_approval_route?: ApprovalRoute;
  three_way_matches?: ThreeWayMatch[];
}

export interface Payment {
  payment_id: string;
  invoice: string;
  contract: string | null;
  amount: number;
  payment_method: PaymentMethod;
  reference: string;
  iso20022_file_ref: string;
  vendor: string;
  status: PaymentStatus;
  processed_at: string | null;
  created_at: string;
}

export interface LetterOfCredit {
  loc_id: string;
  contract: string;
  lc_number: string;
  loc_type: LocType;
  issuing_bank: string;
  beneficiary: string;
  amount: number;
  document: string;
  status: LocStatus;
  issued_at: string;
  expiry_date: string;
}

export interface BudgetAllocation {
  allocation_id: string;
  entity_level: string;
  entity_code: string;
  entity_name: string;
  fiscal_year: string;
  allocated_amount: number;
  encumbered_amount: number;
  expended_amount: number;
  available: number;
  last_synced_at: string | null;
  sync_source: string;
}

export interface BudgetEncumbrance {
  encumbrance_id: string;
  requisition: string;
  amount: number;
  erp_reference: string;
  status: string;
  created_at: string;
  released_at: string | null;
}

export interface BudgetSummary {
  total_allocated: number;
  total_encumbered: number;
  total_expended: number;
  total_available: number;
  allocation_count: number;
  fiscal_year: string;
}

export interface Supplier {
  id: string;
  company_name: string;
  registration_number: string;
  tax_id: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  business_type: string;
  categories: string[];
  certifications: string[];
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  risk_score: number;
  performance_score: number;
  registered_at: string;
  approved_at: string | null;
  documents: Attachment[];
}

export interface DashboardStats {
  total_procurements: number;
  pending_approvals: number;
  active_contracts: number;
  total_value: number;
  procurement_by_department: Record<string, number>;
  procurement_by_method: Record<string, number>;
  monthly_trend: { month: string; count: number; value: number }[];
  recent_activities: Activity[];
}

export interface Activity {
  id: string;
  user: string;
  action: string;
  description: string;
  created_at: string;
}

export interface TenderItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_estimate: number;
}

export interface TenderPublic {
  id: string;
  title: string;
  description: string;
  type: 'rfq' | 'rfb' | 'rfp' | 'rfi';
  tender_number: string;
  procuring_entity: string;
  department: string;
  procurement_method: string;
  category: string;
  estimated_value: number;
  currency: string;
  fee_required: boolean;
  fee_amount: number;
  closing_date: string;
  opening_date: string;
  issue_date: string;
  status: StatusType;
  view_count: number;
  documents: Attachment[];
  addenda: Addendum[];
  clarifications: Clarification[];
  evaluation_criteria: EvaluationCriterion[];
  award_notice: AwardNotice | null;
  bid_opening_results: BidOpeningResult | null;
  bid_security_rate: number;
  bid_security_required?: boolean;
  bid_security_type?: string;
  submission_format?: 'single' | 'two';
  bid_validity_days: number;
  items: TenderItem[];
  created_at: string;
}

export interface EvaluationCriterion {
  id: string;
  solicitation: string;
  criterion_name: string;
  criterion_type: 'mandatory' | 'technical' | 'financial';
  weight: number;
  minimum_threshold: number | null;
  order_index: number;
}

export interface AwardNotice {
  awarded_to: string;
  award_amount: number;
  award_date: string;
  justification: string;
}

export interface BidOpeningResult {
  opened_at: string;
  total_bids: number;
  bidders: string[];
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  featured_image: string;
  author: string;
  published_at: string;
  view_count: number;
  is_featured: boolean;
  tags: string[];
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'procurement' | 'meeting' | 'board' | 'press';
  document: Attachment | null;
  is_pinned: boolean;
  view_count: number;
  published_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: 'meeting' | 'workshop' | 'conference' | 'training' | 'deadline' | 'other';
  location: string;
  start_date: string;
  end_date: string;
  registration_link: string | null;
  is_featured: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

export interface PublicStats {
  total_tenders: number;
  active_tenders: number;
  registered_suppliers: number;
  contracts_awarded: number;
  total_value: number;
}

export interface VendorRegistration {
  id: string;
  user: string;
  company_name: string;
  email: string;
  registration_number: string;
  tax_id: string;
  business_type: string;
  year_established: number;
  employee_count: number;
  annual_turnover: number;
  address: string;
  contact_person: string;
  contact_title: string;
  contact_phone: string;
  ceec_certificate_number: string;
  ceec_category: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  bank_branch: string;
  commodity_categories: string[];
  status: 'draft' | 'submitted' | 'pending_review' | 'approved' | 'rejected';
  documents: RegistrationDocument[];
  verification_status: {
    pacra: boolean;
    zra: boolean;
    ceec: boolean;
  };
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
}

export interface RegistrationDocument {
  id: string;
  type: 'incorporation' | 'tax_clearance' | 'napsa' | 'ceec' | 'bank_letter' | 'license' | 'other';
  file: string;
  filename: string;
  verified: boolean;
  uploaded_at: string;
}

export interface VendorDashboardStats {
  open_tenders: number;
  total_bids: number;
  active_bids: number;
  awarded_contracts: number;
  pending_invoices: number;
  profile_completeness: number;
  total_value_awarded: number;
}

export interface VendorActivity {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  closing_date: string;
  type: 'tender' | 'bid' | 'contract';
}

export interface VendorNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: string;
}

export interface ProcurementDashboardData {
  key_metrics: { label: string; value: number; change: number }[];
  solicitations_by_status: { status: string; count: number }[];
  upcoming_deadlines: { id: string; title: string; closing_date: string; type: string }[];
  recent_activities: { id: string; description: string; created_at: string; user: string }[];
  tasks: { id: string; title: string; due: string; priority: string }[];
}

export interface FinanceDashboardData {
  budget_utilization: { code: string; description: string; allocated: number; spent: number; remaining: number; percentage: number }[];
  pending_invoices: { id: string; invoice_number: string; vendor: string; amount: number; due_date: string; days_overdue: number; status: string }[];
  payment_queue: { id: string; invoice: string; amount: number; priority: string; requested_at: string }[];
  department_breakdown: { department: string; allocated: number; spent: number }[];
  alerts: { type: string; message: string }[];
  total_budget: number; total_spent: number; total_remaining: number;
}

export interface DepartmentDashboardData {
  pending_requisitions: { id: string; title: string; requester: string; estimated_value: number; created_at: string; priority: string }[];
  budget_utilization: { allocated: number; spent: number; remaining: number };
  staff_summary: { staff: string; total: number; approved: number; pending: number }[];
}

export interface DGDashboardData {
  executive_kpis: { label: string; value: number; change: number }[];
  procurement_by_method: { method: string; value: number }[];
  procurement_by_department: { department: string; value: number }[];
  monthly_trend: { month: string; count: number; value: number }[];
  top_suppliers: { name: string; contract_value: number; contracts: number }[];
  pending_approvals_count: number;
  total_procurement_value: number; active_contracts: number;
}

export interface ZPCDashboardData {
  pending_ber_approvals: { id: string; title: string; submitted_by: string; submitted_at: string; total_score: number; recommendations: string }[];
  pending_amendments: { id: string; contract: string; description: string; value_change: number; variation_percentage: number }[];
  pending_justifications: { id: string; title: string; justification: string; amount: number }[];
  approval_history: { id: string; action: string; user: string; created_at: string }[];
  upcoming_meetings: { id: string; title: string; date: string }[];
}

export interface EvaluationDashboardData {
  assignments: { id: string; solicitation: string; role: string; deadline: string; status: string }[];
  scoring_matrix: { criteria: string; weight: number; scores: { bidder: string; score: number; comment: string }[] }[];
  chair_data: { committee_id: string; members: string[]; financial_envelopes_opened: boolean; ber_generated: boolean; ber_signed: boolean };
}

export interface ContractManagerDashboardData {
  active_contracts: { id: string; title: string; vendor: string; value: number; end_date: string; status: string }[];
  upcoming_milestones: { id: string; contract: string; title: string; due_date: string; days_remaining: number }[];
  alerts: { type: string; message: string; severity: string }[];
}

export interface ConsolidatedMember {
  id: string;
  name: string;
  role: 'member' | 'chairperson' | 'secretary';
  submitted: boolean;
  scores: any[];
}

export interface ConsolidatedDetail {
  criterion_id: string;
  criterion_name: string;
  average_raw_score: number;
  weighted_score: number;
  weight: number;
  scores_by_evaluator: {
    evaluator_id: string;
    evaluator_name: string;
    raw_score: number;
    weighted_score: number;
  }[];
}

export interface ConsolidatedBid {
  bidId: string;
  submissionId: string;
  bidderName: string;
  originalPrice: number;
  preferenceCategory: string;
  preferenceMargin: number;
  overallTechnicalScore: number;
  passed: boolean;
  financialEvaluationId?: string;
  evaluatedPrice?: number;
  financialScore?: number;
  financialSealed: boolean;
  details: ConsolidatedDetail[];
  members: ConsolidatedMember[];
  allMembersSubmitted: boolean;
  membersSubmittedCount: number;
  totalMembers: number;
}

export interface ConsolidatedScoresResponse {
  solicitation_id: string;
  solicitation_number: string;
  solicitation_title: string;
  minimum_technical_threshold: number;
  total_bids: number;
  passed_bids: number;
  committees: any[];
  criteria: EvaluationCriterion[];
  bids: ConsolidatedBid[];
}

export interface QCBSResult {
  bid_id: string;
  submission_id: string;
  bidder_name: string;
  technical_score: number;
  financial_score: number;
  total_score: number;
  rank?: number;
}

export interface QCBSResponse {
  message: string;
  tech_weight: number;
  fin_weight: number;
  results: QCBSResult[];
}

export interface SelectWinnerResponse {
  message: string;
  winner_id: string;
  winner_name: string;
  solicitation_status: string;
}

export interface AuthorizeOpeningResponse {
  message: string;
  opened_count: number;
}

export interface PassedTechBidsResponse {
  solicitation_id: string;
  threshold: number;
  bids: PassedTechBid[];
  winner_name?: string | null;
}

export interface AuditorDashboardData {
  recent_logs: { id: string; user: string; action: string; resource: string; timestamp: string; ip: string }[];
  summary: { total_logs: number; today_logs: number; unique_users: number; anomalies: number };
}

export interface AdminDashboardData {
  system_health: { cpu: number; memory: number; disk: number; db_connections: number };
  integrations: { name: string; status: string; last_checked: string }[];
  user_stats: { total: number; active: number; suspended: number; pending: number };
  recent_audit_logs: { id: string; user: string; action: string; resource: string; timestamp: string }[];
  pending_approvals_summary: { type: string; count: number }[];
  scheduled_jobs: { name: string; status: string; last_run: string; next_run: string }[];
}

export interface Role {
  id: string; name: string; description: string; permissions: Record<string, string[]>; is_system: boolean;
  created_at: string; users_count: number;
}

export interface VendorApplication {
  application_id: string; company_name: string; registration_number: string; tin: string;
  ceec_certificate_number: string; ceec_category: string; email: string; contact_person: string;
  contact_phone: string; contact_email: string; address: string;
  bank_name: string; bank_account_number: string; bank_account_name: string; bank_branch: string;
  pacra_validated: boolean; ceec_validated: boolean;
  status: string; submitted_at: string; rejection_reason: string;
  created_at: string; updated_at: string;
  documents: { document_id: string; document_type: string; file_path: string; uploaded_at: string }[];
}

export interface SystemHealthData {
  database: { connections: number; max_connections: number; size: string; replication_lag: string };
  redis: { memory_used: string; max_memory: string; hit_rate: number; connected_clients: number };
  celery: { workers: number; active_tasks: number; queue_depth: number; failed_tasks: number };
  server: { cpu_history: { time: string; value: number }[]; memory_history: { time: string; value: number }[];
    disk_history: { time: string; value: number }[]; uptime: string };
}

export interface AuditLogEntry {
  id: string; user: string; action: string; resource: string; resource_id: string; module: string;
  ip: string; user_agent: string; old_value: any; new_value: any; timestamp: string; status: string;
}

export interface GovernanceSetting {
  id: string; category: string; key: string; value: string; description: string; data_type: string;
  updated_at: string; updated_by: string;
}
export interface ChangeRequest {
  id: string; setting_id: string; setting_key: string; old_value: string; new_value: string;
  requested_by: string; requested_at: string; status: string; approved_by: string; approved_at: string;
}

export interface IntegrationConfig {
  id: string; name: string; type: string; status: string; api_key: string; endpoint: string;
  last_tested: string; last_success: string; failed_transactions: number;
}

export interface SystemSetting {
  key: string; value: string; category: string; description: string;
}

export interface Department {
  id: string; name: string; code: string; parent_id: string | null; children: Department[];
  head: string; budget: number; active: boolean; order: number;
}

export interface FiscalYear {
  id: string; name: string; start_date: string; end_date: string; is_current: boolean; is_closed: boolean;
  total_budget: number; total_spent: number; status: string;
}

export interface Commodity {
  id: string; commodity_code: string; commodity_name: string; category: string;
  sub_category: string; unit_of_measure: string | null; uom_name: string; is_active: boolean;
}

export interface BackupRecord {
  id: string; filename: string; size: string; type: string; status: string; created_at: string;
  created_by: string; checksum: string; downloaded: boolean;
}

export interface ScheduledReport {
  id: string; name: string; type: string; format: string; frequency: string; recipients: string[];
  last_generated: string; next_generation: string; active: boolean;
}

export interface AnnualProcurementPlan {
  app_id: string;
  fiscal_year: string;
  fiscal_year_code?: string;
  department: string;
  department_name?: string;
  department_code?: string;
  status: string;
  total_estimated_value: number;
  submitted_by?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  compliance_notes?: string;
  is_consolidated?: boolean;
  consolidated_into?: string;
  consolidated_into_id?: string;
  consolidated_from_count?: number;
  consolidation_notes?: string;
  zpc_resolution?: Record<string, any>;
  approval_trail?: ApprovalTrailEntry[];
  line_items?: APPLineItem[];
  gpns?: GeneralProcurementNotice[];
  // GPN publication tracking
  gpn_published_at?: string;
  gpn_publication_targets?: string[];
  gpn_publication_proofs?: Record<string, any>;
  // ZPPA submission tracking
  zppa_deadline?: string;
  zppa_submitted?: boolean;
  zppa_submitted_at?: string;
  zppa_submission_ref?: string;
  zppa_reference?: string;
  zppa_deadline_alerted?: boolean;
  zppa_status?: 'submitted' | 'not_applicable' | 'overdue' | 'approaching' | 'on_track';
  zppa_days_remaining?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface ApprovalTrailEntry {
  action: string;
  role: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface APPLineItem {
  line_item_id?: string;
  app?: string;
  description: string;
  procurement_type?: 'goods' | 'works' | 'services';
  procurement_type_display?: string;
  estimated_value: number;
  recommended_method?: string;
  planned_issue_date?: string;
  planned_award_date?: string;
  funding_source?: string;
  funding_source_name?: string;
  commodity?: string;
  commodity_name?: string;
  commodity_category?: string;
  is_citizen_reserved?: boolean;
  budget_available?: number;
}

export interface FundingSourceOption {
  source_id: string;
  source_code: string;
  source_name: string;
  type: string;
  budget_reference: string;
  is_active: boolean;
}

export interface CommodityOption {
  commodity_id: string;
  commodity_code: string;
  commodity_name: string;
  category: string;
  sub_category: string;
  is_active: boolean;
}

export interface UnitOfMeasure {
  uom_id: string;
  uom_code: string;
  uom_name: string;
  category: string;
}

export interface GeneralProcurementNotice {
  gpn_id: string;
  app: string;
  generated_at: string;
  generated_by?: string;
  generated_by_name?: string;
  content?: Record<string, any>;
  publication_status: 'draft' | 'published' | 'archived';
  publication_targets?: string[];
  publication_proof_urls?: string[];
  // Enhanced publication proofs with detailed metadata
  publication_proofs?: Record<string, {
    url?: string;
    timestamp: string;
    reference?: string;
    delivered?: number;
    failed?: number;
    status: string;
  }>;
  published_at?: string;
  published_by?: string;
  published_by_name?: string;
  // Email notification tracking
  email_notification_sent?: boolean;
  email_notification_count?: number;
  email_notification_failed?: number;
  email_notification_sent_at?: string;
  // Gazette file tracking
  gazette_file_path?: string;
  gazette_submitted?: boolean;
  gazette_submitted_at?: string;
}

export interface APPDashboardStats {
  total: number;
  draft: number;
  dept_head_review: number;
  procurement_review: number;
  director_review: number;
  zpc_review: number;
  approved: number;
  published: number;
  rejected: number;
  total_value: number;
  consolidated: number;
}

export interface ContractProcurementPlan {
   cpp_id: string;
   cpp_number?: string;
   requisition: string;
   requisition_number?: string;
   requisition_description?: string;
   requisition_department?: string;
   requisition_required_date?: string;
   requisition_estimated_value?: number;
   requisition_delivery_location?: string;
   requisition_encumbrance_ref?: string;
   procurement_strategy?: string;
   method?: 'open_tender' | 'international' | 'limited' | 'simplified' | 'direct';
   recommended_method?: 'open_tender' | 'international' | 'limited' | 'simplified' | 'direct';
   method_override?: boolean;
   override_reason?: string;
   override_approved_by?: string;
   override_approved_at?: string;
   zpc_approval_required?: boolean;
   zpc_justification?: string;
   zpc_grounds?: string;
   zpc_resolution_ref?: string;
   zpc_approved_at?: string;
    zpc_approved_by?: string;
    zpc_approved_by_name?: string;
    estimated_value?: number;
    overall_risk_level?: 'low' | 'medium' | 'high';
    overall_risk_display?: string;
   resource_requirements?: Record<string, any>;
   risks?: CPPRisk[];
   milestones?: ProcurementMilestone[];
   status?: 'draft' | 'pending_zpc' | 'approved' | 'rejected' | 'active' | 'amended' | 'completed' | 'cancelled';
   created_by?: string;
   created_by_name?: string;
   approved_by?: string;
   approved_by_name?: string;
   approved_at?: string;
   rejection_reason?: string;
   rejected_by?: string;
   rejected_at?: string;
   is_baseline_locked?: boolean;
   baseline_locked_at?: string;
   baseline_locked_by?: string;
   baseline_locked_by_name?: string;
   amendment_version?: number;
   previous_baseline?: Record<string, any>;
   created_at: string;
   updated_at: string;
   completed_at?: string;
 }

export interface CPPRisk {
   risk_id: string;
   cpp: string;
   risk_category: 'supply' | 'price' | 'quality' | 'delivery' | 'regulatory' | 'capacity' | 'custom';
   risk_description: string;
   likelihood: 'low' | 'medium' | 'high';
   impact: 'low' | 'medium' | 'high' | 'critical';
   mitigation_strategy: string;
   risk_owner?: string;
   created_at: string;
 }

export interface ProcurementMilestone {
   milestone_id: string;
   cpp: string;
   milestone_name: string;
   sequence_number: number;
   planned_date: string;
   actual_date: string | null;
   variance_days: number | null;
   variance_flag?: 'green' | 'yellow' | 'orange' | 'red';
   is_system_updated?: boolean;
   time?: string;
   note?: string;
   constraintNote?: string;
   validationBadges?: string[];
 }

 
