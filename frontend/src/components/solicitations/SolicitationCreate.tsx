import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import { requisitionsApi } from '../../api/requisitions';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, PlusIcon, TrashIcon,
  InformationCircleIcon, ShieldCheckIcon, LockClosedIcon,
  ClockIcon, ExclamationIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/outline';
import DepartmentSelect from '../common/DepartmentSelect';

const SOL_STEPS = [
  { id: 'template', label: 'Template', subtitle: 'Step 1' },
  { id: 'details', label: 'Details', subtitle: 'Step 2' },
  { id: 'criteria', label: 'Criteria', subtitle: 'Step 3' },
  { id: 'security', label: 'Security', subtitle: 'Step 4' },
  { id: 'docs', label: 'Docs', subtitle: 'Step 5' },
  { id: 'review', label: 'Review & Submit', subtitle: 'Step 6' },
] as const;

type TemplateType = 'itb' | 'rfp' | 'rfq';

interface MandatoryCriterion {
  id: string;
  name: string;
}

interface TechnicalCriterion {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  guidance: string;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: string;
}

const DEFAULT_MANDATORY: MandatoryCriterion[] = [
  { id: '1', name: 'Bid submitted before closing deadline' },
  { id: '2', name: 'Bid security provided (correct form & amount)' },
  { id: '3', name: 'Valid ZRA Tax Clearance (auto-verified)' },
  { id: '4', name: 'PACRA Company Registration (auto-verified)' },
  { id: '5', name: 'ZAMRA Product Registration Certificate' },
  { id: '6', name: 'All required bid forms completed and signed' },
];

const CHANNELS = [
  { key: 'zammsa', label: 'ZAMMSA Public Portal', desc: 'portal.zammsa.gov.zm/tenders' },
  { key: 'zppa', label: 'ZPPA e-GP Portal', desc: 'API call — egp_reference stored' },
  { key: 'email', label: 'Email Notifications to Registered Suppliers', desc: 'Matching category' },
  { key: 'undb', label: 'UN Development Business', desc: 'For international bids only' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 8).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function fmtDate(d: string): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

const SolicitationCreate: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState('');

  const [template, setTemplate] = useState<TemplateType | null>(null);
  const [submissionFormat, setSubmissionFormat] = useState<'single' | 'two'>('single');
  const [requisition, setRequisition] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [currency, setCurrency] = useState('ZMW');
  const [budgetCode, setBudgetCode] = useState('');
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [issueDate, setIssueDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [closingHour, setClosingHour] = useState('10');
  const [closingMinute, setClosingMinute] = useState('00');
  const [openingDate, setOpeningDate] = useState('');
  const [openingHour, setOpeningHour] = useState('10');
  const [openingMinute, setOpeningMinute] = useState('00');
  const [bidValidity, setBidValidity] = useState(90);
  const [preBidDate, setPreBidDate] = useState('');
  const [preBidVenue, setPreBidVenue] = useState('');
  const [citizenPreference, setCitizenPreference] = useState(true);
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [bidSecurityRequired, setBidSecurityRequired] = useState(true);
  const [bidSecurityType, setBidSecurityType] = useState<'bank_guarantee' | 'surety_bond' | 'cash'>('bank_guarantee');
  const [bidSecurityRate, setBidSecurityRate] = useState(2);
  const [mandatoryCriteria, setMandatoryCriteria] = useState<MandatoryCriterion[]>([...DEFAULT_MANDATORY]);
  const [technicalCriteria, setTechnicalCriteria] = useState<TechnicalCriterion[]>([
    { id: '1', name: 'Experience in supplying laboratory reagents', weight: 30, maxScore: 100, guidance: '≥5 years: 90–100 pts\n3–5 years: 70–89 pts\n<3 years: 0–69 pts' },
    { id: '2', name: 'Technical quality and compliance of sample products', weight: 40, maxScore: 100, guidance: 'Based on samples or technical documentation' },
    { id: '3', name: 'After-sales support and warranty plan', weight: 30, maxScore: 100, guidance: 'Quality of proposed support and warranty terms' },
  ]);
  const [minTechThreshold, setMinTechThreshold] = useState(70);
  const [docFeeEnabled, setDocFeeEnabled] = useState(false);
  const [docFeeAmount, setDocFeeAmount] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [channels, setChannels] = useState<string[]>(['zammsa', 'zppa', 'email']);
  const [confirmed, setConfirmed] = useState(false);

  const { data: reqsData } = useQuery({
    queryKey: ['requisitions', 'approved-cpp'],
    queryFn: () => requisitionsApi.list({ page_size: 200, status: 'approved', has_approved_cpp: true }),
  });
  const requisitions = reqsData?.results ?? [];

  const selectedReq = useMemo(() => requisitions.find((r: any) => (r.id || r.requisition_id) === requisition), [requisitions, requisition]);

  const solicitationPeriodDays = useMemo(() => daysBetween(issueDate, closingDate), [issueDate, closingDate]);
  const totalWeight = useMemo(() => technicalCriteria.reduce((sum, c) => sum + c.weight, 0), [technicalCriteria]);
  const weightValid = totalWeight === 100;

  const clarificationCutoff = useMemo(() => {
    if (!closingDate) return '';
    const d = new Date(closingDate);
    d.setDate(d.getDate() - 5);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [closingDate]);

  const getDateTime = (date: string, hour: string, minute: string) => {
    if (!date) return '';
    return `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
  };

  const mutation = useMutation({
    mutationFn: (data: any) => solicitationsApi.create(data),
    onSuccess: (res) => {
      setSuccess(true);
      setCreatedId(res.id || res.solicitation_id || '');
    },
  });

  const handleSubmit = () => {
    if (!requisition) { toast.error('Select a linked requisition'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!weightValid) { toast.error('Technical criteria weights must total 100%'); return; }
    if (mandatoryCriteria.length === 0) { toast.error('At least one mandatory criterion is required'); return; }
    if (technicalCriteria.length === 0) { toast.error('At least one technical criterion is required'); return; }
    if (!confirmed) { toast.error('Please confirm the submission declaration'); return; }

    const solType = template === 'itb' ? 'rfb' : template === 'rfp' ? 'rfp' : 'rfq';

    const payload: Record<string, any> = {
      title,
      description,
      type: solType,
      requisition,
      department,
      estimated_value: estimatedValue,
      currency,
      budget_code: budgetCode,
      issue_date: issueDate,
      closing_date: getDateTime(closingDate, closingHour, closingMinute),
      opening_date: getDateTime(openingDate, openingHour, openingMinute),
      submission_format: submissionFormat,
      bid_validity_days: bidValidity,
      pre_bid_date: preBidDate,
      pre_bid_venue: preBidVenue,
      citizen_preference: citizenPreference,
      bid_security_required: bidSecurityRequired,
      bid_security_type: bidSecurityType,
      bid_security_rate: bidSecurityRate,
      contact_person: contactPerson,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      mandatory_criteria: mandatoryCriteria,
      technical_criteria: technicalCriteria.map(c => ({
        criterion_name: c.name,
        weight: c.weight,
        max_score: c.maxScore,
        scoring_guidance: c.guidance,
      })),
      minimum_technical_threshold: minTechThreshold,
      publication_channels: channels,
      document_fee_enabled: docFeeEnabled,
      document_fee_amount: docFeeEnabled ? docFeeAmount : 0,
    };

    if (uploadFiles.length > 0) {
      payload.additional_documents = uploadFiles.map(f => ({ name: f.name, size: f.size }));
    }
    mutation.mutate(payload);
  };

  const nextStep = () => {
    if (currentStep === 0 && !template) { toast.error('Select a solicitation template'); return; }
    if (currentStep === 1) {
      if (!requisition) { toast.error('Select a linked requisition'); return; }
      if (!title.trim()) { toast.error('Title is required'); return; }
      if (!closingDate) { toast.error('Closing date is required'); return; }
    }
    if (currentStep === 2 && !weightValid) { toast.error('Technical criteria weights must total 100%'); return; }
    setCurrentStep(s => Math.min(s + 1, SOL_STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  const addMandatory = () => {
    const newC: MandatoryCriterion = { id: Date.now().toString(), name: '' };
    setMandatoryCriteria([...mandatoryCriteria, newC]);
  };

  const updateMandatory = (id: string, name: string) => {
    setMandatoryCriteria(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const removeMandatory = (id: string) => {
    setMandatoryCriteria(prev => prev.filter(c => c.id !== id));
  };

  const addTechnical = () => {
    const newC: TechnicalCriterion = { id: Date.now().toString(), name: '', weight: 0, maxScore: 100, guidance: '' };
    setTechnicalCriteria([...technicalCriteria, newC]);
  };

  const updateTechnical = (id: string, field: keyof TechnicalCriterion, value: any) => {
    setTechnicalCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeTechnical = (id: string) => {
    setTechnicalCriteria(prev => prev.filter(c => c.id !== id));
  };

  const toggleChannel = (key: string) => {
    setChannels(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Solicitation Submitted for Approval</h2>
          <p className="text-lg font-semibold text-gray-500 mb-4">
            {createdId ? `${(() => { const r = requisitions.find((rq: any) => (rq.id || rq.requisition_id) === requisition); return `SOL-${new Date().getFullYear()}-${r?.department?.slice(0, 3).toUpperCase() || 'XXX'}-${String(Math.floor(Math.random() * 99)).padStart(2, '0')}`; })()} has been submitted.` : 'Submitted successfully.'}
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-left max-w-lg mx-auto mb-8">
            <h3 className="text-sm font-bold text-emerald-900 mb-3">What Happens Next</h3>
            <div className="space-y-2 text-sm text-emerald-800">
              <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Step 1: Procurement Manager reviews document completeness and criteria</p>
              <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Step 2: Upon approval → you are notified</p>
              <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Step 3: You click [Publish] to go live</p>
              <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Step 4: System publishes to ZAMMSA portal + e-GP + supplier email notifications</p>
              <p className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Step 5: Solicitation open for {solicitationPeriodDays || 21} days for bids</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate(`/solicitations/${createdId}`)} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              View Solicitation
            </button>
            <button onClick={() => navigate('/solicitations/create')} className="px-6 py-3 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90">
              Create Another
            </button>
            <button onClick={() => navigate('/dashboard')} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/solicitations')} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Solicitations</span>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">Create Solicitation</h1>
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            CPP: {(selectedReq as any)?.cpp_number || '---'} | REQ: {selectedReq?.req_number || '---'} | K{selectedReq?.estimated_total?.toLocaleString() || '---'}
          </span>
        </div>

        {/* Step Indicator */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {SOL_STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < currentStep ? 'bg-zammsa-green text-white' :
                    i === currentStep ? 'bg-zammsa-green text-white ring-4 ring-zammsa-green/20' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {i < currentStep ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 whitespace-nowrap ${
                    i === currentStep ? 'text-zammsa-green' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < SOL_STEPS.length - 1 && (
                  <div className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-4 ${i < currentStep ? 'bg-zammsa-green' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1 — Template Selection */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4" />
              Linked CPP Details
            </h2>
            {selectedReq ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CPP</p>
                  <p className="text-sm font-bold text-gray-900">{(selectedReq as any)?.cpp_number || 'CPP-2026-LAB-07'}</p>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">Approved — Baseline Locked</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method</p>
                  <p className="text-sm font-bold text-gray-900">Open National Bidding</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Value</p>
                  <p className="text-sm font-bold text-gray-900">K {selectedReq?.estimated_total?.toLocaleString() || '---'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</p>
                  <p className="text-sm font-bold text-gray-900">Goods</p>
                </div>
              </div>
            ) : (
              <div>
                <select
                  value={requisition}
                  onChange={(e) => { setRequisition(e.target.value); const r = requisitions.find((rq: any) => (rq.id || rq.requisition_id) === e.target.value); if (r) { setTitle(r.title || r.description || ''); setDescription(r.description || ''); setDepartment(r.department || r.department_name || ''); setEstimatedValue(Number(r.estimated_total) || 0); } }}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5"
                >
                  <option value="">-- Select Requisition with Approved CPP --</option>
                  {requisitions.map((r: any) => (
                    <option key={r.id || r.requisition_id} value={r.id || r.requisition_id}>
                      {r.req_number} - {r.title || r.description} ({r.department_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Select Solicitation Template *</h2>
            <div className="space-y-3">
              {([
                { key: 'itb' as TemplateType, label: 'ITB — Invitation to Bid', desc: 'For: Goods and Works', sub: 'Method: Open / Simplified / Limited Bidding', recommended: true },
                { key: 'rfp' as TemplateType, label: 'RFP — Request for Proposals', desc: 'For: Consulting Services (QCBS, QBS, LCS)', sub: 'Requires: Technical + Financial envelopes', recommended: false },
                { key: 'rfq' as TemplateType, label: 'RFQ — Request for Quotations', desc: 'For: Simplified / small value procurements', sub: '', recommended: false },
              ]).map(opt => (
                <label key={opt.key} className={`flex items-start gap-4 p-5 rounded-2xl cursor-pointer border-2 transition-all ${
                  template === opt.key ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}>
                  <input type="radio" name="template" checked={template === opt.key} onChange={() => { setTemplate(opt.key); if (opt.key === 'itb') setSubmissionFormat('single'); if (opt.key === 'rfp') setSubmissionFormat('two'); }} className="mt-1 text-zammsa-green focus:ring-zammsa-green" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    {opt.sub && <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>}
                  </div>
                  {opt.recommended && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 whitespace-nowrap">Recommended</span>}
                </label>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Submission Format</p>
              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${
                  submissionFormat === 'single' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'
                }`}>
                  <input type="radio" name="format" checked={submissionFormat === 'single'} onChange={() => setSubmissionFormat('single')} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900">Single Envelope</p>
                  <p className="text-xs text-gray-500 mt-1">Goods/Works — price visible at opening</p>
                </label>
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${
                  submissionFormat === 'two' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'
                }`}>
                  <input type="radio" name="format" checked={submissionFormat === 'two'} onChange={() => setSubmissionFormat('two')} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900">Two Envelope</p>
                  <p className="text-xs text-gray-500 mt-1">Consulting — financial encrypted until tech evaluation</p>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Solicitation Details */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Basic Information</h2>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Solicitation Number</label>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-500">
                  {`SOL-${new Date().getFullYear()}-${department?.slice(0, 3).toUpperCase() || 'XXX'}-${String(Math.floor(Math.random() * 99)).padStart(2, '0')}`}  (auto-generated)
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Solicitation Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Supply of Laboratory Reagents 2026" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Description *</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Department *</label>
                  <DepartmentSelect value={department} onChange={setDepartment} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Currency *</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                    <option value="ZMW">ZMW</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Budget Code *</label>
                  <input type="text" value={budgetCode} onChange={(e) => setBudgetCode(e.target.value)} placeholder="e.g. 7890-02" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Estimated Value *</label>
                <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)} min={0} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                <p className="text-[11px] text-gray-400 mt-1 ml-1">from requisition — editable</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Key Dates</h2>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Issue / Publication Date *</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                <p className="text-[11px] text-gray-400 mt-1 ml-1">from CPP milestone — editable</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Closing Date and Time *</label>
                  <div className="flex gap-2">
                    <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                    <select value={closingHour} onChange={(e) => setClosingHour(e.target.value)} className="w-20 bg-white border border-gray-200 rounded-2xl px-3 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="self-center text-gray-400 font-bold">:</span>
                    <select value={closingMinute} onChange={(e) => setClosingMinute(e.target.value)} className="w-20 bg-white border border-gray-200 rounded-2xl px-3 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="self-center text-[10px] font-black text-gray-400 uppercase">CAT</span>
                  </div>
                  {issueDate && closingDate && solicitationPeriodDays >= 21 && (
                    <p className="text-[11px] font-bold text-emerald-600 mt-1 ml-1 flex items-center gap-1"><CheckCircleIcon className="w-3.5 h-3.5" /> {solicitationPeriodDays} days from issue — meets ONB minimum</p>
                  )}
                  {issueDate && closingDate && solicitationPeriodDays < 21 && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1"><ExclamationIcon className="w-3.5 h-3.5" /> Only {solicitationPeriodDays} days — minimum is 21 days</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Opening Date and Time *</label>
                  <div className="flex gap-2">
                    <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                    <select value={openingHour} onChange={(e) => setOpeningHour(e.target.value)} className="w-20 bg-white border border-gray-200 rounded-2xl px-3 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="self-center text-gray-400 font-bold">:</span>
                    <select value={openingMinute} onChange={(e) => setOpeningMinute(e.target.value)} className="w-20 bg-white border border-gray-200 rounded-2xl px-3 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="self-center text-[10px] font-black text-gray-400 uppercase">CAT</span>
                  </div>
                  {closingDate && openingDate && new Date(openingDate) >= new Date(closingDate) && (
                    <p className="text-[11px] font-bold text-emerald-600 mt-1 ml-1 flex items-center gap-1"><CheckCircleIcon className="w-3.5 h-3.5" /> After closing time</p>
                  )}
                  {closingDate && openingDate && new Date(openingDate) < new Date(closingDate) && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1"><ExclamationIcon className="w-3.5 h-3.5" /> Opening must be after closing</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Validity (Days) *</label>
                  <input type="number" value={bidValidity} onChange={(e) => setBidValidity(parseInt(e.target.value) || 90)} min={30} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Clarification Cutoff</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
                    <LockClosedIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-500">{clarificationCutoff ? fmtDate(clarificationCutoff) : '---'}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 ml-1">(closing minus 5 working days)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Pre-bid Conference Date</label>
                  <input type="date" value={preBidDate} onChange={(e) => setPreBidDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Venue / Link</label>
                  <input type="text" value={preBidVenue} onChange={(e) => setPreBidVenue(e.target.value)} placeholder="e.g. Boardroom, City" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Preference and Reservation</h2>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Apply Citizen Preference Scheme?</p>
              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer border-2 border-transparent hover:border-zammsa-green/20 transition-all">
                <input type="radio" name="citizen" checked={citizenPreference} onChange={() => setCitizenPreference(true)} className="text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-sm font-bold text-gray-900">Yes — preference margins apply during financial evaluation</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer border-2 border-transparent hover:border-zammsa-green/20 transition-all">
                <input type="radio" name="citizen" checked={!citizenPreference} onChange={() => setCitizenPreference(false)} className="text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-sm font-bold text-gray-900">No</p>
                </div>
              </label>

              {citizenPreference && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <p className="text-xs font-bold text-blue-800 mb-2">If Yes, applicable margins:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <p>Citizen-Influenced (≥25%): 4% margin</p>
                    <p>Citizen-Empowered (≥51%): 8% margin</p>
                    <p>Citizen-Owned (≥75%): 12% margin</p>
                    <p>Domestic goods: 15% margin</p>
                  </div>
                  <p className="text-[10px] text-blue-500 mt-2 flex items-center gap-1"><InformationCircleIcon className="w-3 h-3" /> CEEC certificate verified automatically at bid submission</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Evaluation Criteria */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Mandatory Pass/Fail Criteria</h2>
              <button onClick={addMandatory} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-zammsa-green transition-all">
                <PlusIcon className="w-3 h-3" /> Add Mandatory
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">All must PASS — failure on any = bid rejected</p>
            <div className="space-y-2">
              {mandatoryCriteria.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <input type="text" value={c.name} onChange={(e) => updateMandatory(c.id, e.target.value)} placeholder="Criterion description" className="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-300" />
                  <button onClick={() => removeMandatory(c.id)} className="p-1 text-gray-300 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Technical Scoring Criteria</h2>
              <button onClick={addTechnical} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-zammsa-green transition-all">
                <PlusIcon className="w-3 h-3" /> Add Criterion
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">Scored 0–100, weighted — total weights must = 100%</p>
            <div className="space-y-4">
              {technicalCriteria.map((c, i) => (
                <div key={c.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Criterion {i + 1}</span>
                    <button onClick={() => removeTechnical(c.id)} className="p-1 text-gray-300 hover:text-rose-500"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Name *</label>
                      <input type="text" value={c.name} onChange={(e) => updateTechnical(c.id, 'name', e.target.value)} placeholder="Criterion name" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Weight (%) *</label>
                        <input type="number" value={c.weight} onChange={(e) => updateTechnical(c.id, 'weight', parseInt(e.target.value) || 0)} min={0} max={100} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Max Score</label>
                        <input type="number" value={c.maxScore} onChange={(e) => updateTechnical(c.id, 'maxScore', parseInt(e.target.value) || 100)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Scoring Guidance</label>
                      <textarea rows={2} value={c.guidance} onChange={(e) => updateTechnical(c.id, 'guidance', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-4 p-4 rounded-2xl border ${weightValid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className={`text-sm font-bold ${weightValid ? 'text-emerald-700' : 'text-rose-700'} flex items-center gap-1`}>
                  {weightValid ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                  Total Weight: {technicalCriteria.map(c => c.weight).join('% + ')}% = {totalWeight}%
                </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Evaluation Methodology</h2>
            <div className="p-4 bg-gray-50 rounded-2xl mb-4">
              <p className="text-sm font-bold text-gray-700">For ITB (Goods): Lowest evaluated price wins</p>
              <p className="text-xs text-gray-500 mt-1">(after technical pass/fail — no QCBS weighting for goods)</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Minimum Technical Threshold</label>
              <p className="text-[11px] text-gray-400 mb-2 ml-1">Minimum score to pass to financial evaluation</p>
              <div className="flex items-center gap-3">
                <input type="number" value={minTechThreshold} onChange={(e) => setMinTechThreshold(parseInt(e.target.value) || 70)} min={0} max={100} className="w-32 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                <span className="text-sm font-bold text-gray-400">points (out of 100)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 ml-1 flex items-center gap-1"><InformationCircleIcon className="w-3 h-3" /> Bids scoring below this threshold will not have their financial proposals opened.</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Bid Security */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Bid Security Requirements</h2>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bid Security Required?</p>
                <div className="flex gap-4">
                  <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${bidSecurityRequired ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                    <input type="radio" name="sec_required" checked={bidSecurityRequired} onChange={() => setBidSecurityRequired(true)} className="sr-only" />
                    <p className="text-sm font-bold text-gray-900 text-center">Yes</p>
                  </label>
                  <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${!bidSecurityRequired ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                    <input type="radio" name="sec_required" checked={!bidSecurityRequired} onChange={() => setBidSecurityRequired(false)} className="sr-only" />
                    <p className="text-sm font-bold text-gray-900 text-center">No</p>
                  </label>
                </div>
              </div>

              {bidSecurityRequired && (
                <>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bid Security Type *</p>
                    <div className="space-y-2">
                      {([
                        { key: 'bank_guarantee' as const, label: 'Bank Guarantee (preferred)' },
                        { key: 'surety_bond' as const, label: 'Surety Bond' },
                        { key: 'cash' as const, label: 'Cash deposit' },
                      ]).map(opt => (
                        <label key={opt.key} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${bidSecurityType === opt.key ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                          <input type="radio" name="sec_type" checked={bidSecurityType === opt.key} onChange={() => setBidSecurityType(opt.key)} className="text-zammsa-green focus:ring-zammsa-green" />
                          <p className="text-sm font-bold text-gray-900">{opt.label}</p>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Security Rate (% of bid value) *</label>
                    <div className="flex items-center gap-3">
                      <input type="number" value={bidSecurityRate} onChange={(e) => setBidSecurityRate(parseFloat(e.target.value) || 2)} min={1} max={5} step={0.5} className="w-32 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                      <span className="text-sm font-bold text-gray-400">% (range: 2–5% for goods/works)</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 ml-1 flex items-center gap-1"><InformationCircleIcon className="w-3 h-3" /> Example: If bid value = K1,000,000 → security = K{Math.round(bidSecurityRate * 10000).toLocaleString()}</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Security Validity *</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-500">
                      {bidValidity + 28} days beyond bid validity period (auto-calculated)
                      <br />= {bidValidity} days validity + 28 days = {bidValidity + 28} days from closing
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Contact Information for Submissions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Contact Person *</label>
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Phone *</label>
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Contact Email *</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5 — Documents & Publication */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Solicitation Documents</h2>

            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Mandatory Clauses (auto-included — read-only)</p>
              <div className="space-y-2">
                {['General Conditions of Contract (ZPPA v2024)', 'Standard Bid Forms (ZPPA-approved)', 'Conflict of Interest Declaration Form'].map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-800">{doc}</span>
                    <LockClosedIcon className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Specification Documents (auto-linked from Requisition)</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-gray-700">LabSpec_Reagents_2026.pdf</span>
                  <span className="text-[10px] font-bold text-gray-400 ml-auto">from REQ-{selectedReq?.req_number || '---'}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Additional Documents (optional — upload here)</p>
              <div
                className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center mb-4 cursor-pointer hover:border-zammsa-green/40 transition-colors"
                onClick={() => document.getElementById('solicitation-file-input')?.click()}
              >
                <input
                  id="solicitation-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const fileList = e.target.files;
                    if (!fileList) return;
                    const newFiles: UploadFile[] = Array.from(fileList).map(file => ({
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      file,
                      name: file.name,
                      size: file.size < 1024 ? `${file.size}B` :
                            file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)}KB` :
                            `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
                    }));
                    setUploadFiles(prev => [...prev, ...newFiles]);
                    e.target.value = '';
                  }}
                />
                <p className="text-sm font-bold text-gray-400">Drag files here or click to browse</p>
                <p className="text-xs text-gray-300 mt-1">Accepted: PDF, Word, Excel | Max: 50MB each</p>
              </div>
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-gray-700 flex-1">{f.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">{f.size}</span>
                      <button
                        onClick={() => setUploadFiles(prev => prev.filter(x => x.id !== f.id))}
                        className="p-1 text-gray-300 hover:text-rose-500 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploadFiles.length === 0 && (
                <p className="text-[11px] text-gray-400 ml-1">No additional documents uploaded yet</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Document Fee?</p>
              <div className="flex gap-4">
                <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${docFeeEnabled ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="doc_fee" checked={docFeeEnabled} onChange={() => setDocFeeEnabled(true)} className="text-zammsa-green focus:ring-zammsa-green" />
                  <span className="text-sm font-bold text-gray-900">
                    Yes — K <input type="number" value={docFeeAmount || ''} onChange={(e) => setDocFeeAmount(parseFloat(e.target.value) || 0)} className="w-24 inline-block bg-transparent border-b border-gray-200 px-2 py-1 text-sm font-bold outline-none" placeholder="0" onClick={(e) => e.stopPropagation()} /> per document set
                  </span>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${!docFeeEnabled ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="doc_fee" checked={!docFeeEnabled} onChange={() => setDocFeeEnabled(false)} className="text-zammsa-green focus:ring-zammsa-green" />
                  <span className="text-sm font-bold text-gray-900">No — documents are free to download</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Publication Channels</h2>
            <div className="space-y-3">
              {CHANNELS.map(ch => (
                <label key={ch.key} className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer border-2 transition-all ${
                  channels.includes(ch.key) ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'
                }`}>
                  <input type="checkbox" checked={channels.includes(ch.key)} onChange={() => toggleChannel(ch.key)} className="mt-1 text-zammsa-green focus:ring-zammsa-green rounded" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{ch.label}</p>
                    <p className="text-xs text-gray-500">{ch.desc}</p>
                  </div>
                  {ch.key === 'zammsa' && <span className="text-[10px] font-bold text-gray-400 ml-auto">automatic</span>}
                  {ch.key === 'zppa' && <span className="text-[10px] font-bold text-gray-400 ml-auto">automatic</span>}
                  {ch.key === 'undb' && <span className="text-[10px] font-bold text-gray-400 ml-auto">for international bids</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 6 — Review & Submit */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-emerald-900 mb-3">Complete Validation Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                `Template: ${template === 'itb' ? 'ITB (Goods, Single Envelope)' : template === 'rfp' ? 'RFP (Consulting, Two Envelope)' : 'RFQ (Quotations)'}`,
                `Title and description provided`,
                `Linked to approved CPP: ${(selectedReq as any)?.cpp_number || 'CPP-2026-LAB-07'}`,
                `Issue date: ${fmtDate(issueDate)}`,
                `Closing: ${fmtDate(closingDate)} — ${solicitationPeriodDays} days (ONB minimum met)`,
                `Opening: ${fmtDate(openingDate)} ${openingHour}:${openingMinute} — after closing`,
                `Clarification cutoff: ${fmtDate(clarificationCutoff)} (auto)`,
                `Bid validity: ${bidValidity} days`,
                `Bid security: ${bidSecurityRate}% ${bidSecurityType.replace('_', ' ')}`,
                `${mandatoryCriteria.length} mandatory pass/fail criteria`,
                `${technicalCriteria.length} technical criteria — total weight ${totalWeight}%`,
                `Min. technical threshold: ${minTechThreshold} points`,
                `Citizen preference scheme: ${citizenPreference ? 'Yes' : 'No'}`,
                `${uploadFiles.length} document(s) attached`,
                `Document fee: ${docFeeEnabled ? `K${docFeeAmount} per set` : 'Free'}`,
                `Publication: ${channels.length} channels selected`,
              ].map((item, i) => (
                <p key={i} className="text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4" /> {item}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Solicitation Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Reference', `SOL-${new Date().getFullYear()}-${department?.slice(0, 3).toUpperCase() || 'XXX'}-${String(Math.floor(Math.random() * 99)).padStart(2, '0')}`],
                ['Title', title],
                ['Method', 'Open National Bidding'],
                ['Value', `K ${estimatedValue.toLocaleString()}`],
                ['Closing', `${fmtDate(closingDate)} ${closingHour}:${closingMinute} CAT`],
                ['Opening', `${fmtDate(openingDate)} ${openingHour}:${openingMinute} CAT`],
                ['Suppliers', `${requisitions.length} will be notified`],
              ].map(([label, value]) => (
                <div key={label} className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-amber-900 mb-1">Approval Routing</h2>
                <p className="text-sm text-amber-800">
                  After submission → Procurement Manager (R-04) reviews → Approves → You receive notification → Click Publish.
                  <br />
                  <strong>You CANNOT approve your own solicitation.</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Submit for Approval</h2>
            <label className="flex items-start gap-3 p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={confirmed} onChange={() => setConfirmed(!confirmed)} className="mt-1 text-zammsa-green focus:ring-zammsa-green rounded" />
              <p className="text-sm font-semibold text-gray-700">
                I confirm this solicitation document is complete, technically neutral, and compliant with ZAMMSA procurement policy and ZPPA regulations.
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm px-8 py-4 flex items-center justify-between">
        <button onClick={currentStep === 0 ? () => navigate('/solicitations') : prevStep} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          {currentStep === 0 ? 'Cancel' : <span className="inline-flex items-center gap-1"><ChevronLeftIcon className="w-4 h-4" /> Back</span>}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => toast.success('Draft saved')} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Save Draft
          </button>
          {currentStep < SOL_STEPS.length - 1 ? (
            <button onClick={nextStep} className="px-6 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors">
              <span className="inline-flex items-center gap-1">Next <ChevronRightIcon className="w-4 h-4" /></span>
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={mutation.isPending} className="px-6 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SolicitationCreate;
