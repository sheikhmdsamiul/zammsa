import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { procurementPlanningApi, methodApi } from '../../api/procurement_planning';
import { requisitionsApi } from '../../api/requisitions';
import { ContractProcurementPlan, ProcurementMilestone, CPPRisk } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeftIcon, CheckCircleIcon, ExclamationIcon, DocumentTextIcon,
  CalendarIcon, UserCircleIcon, ClipboardListIcon, ShieldCheckIcon,
  LightningBoltIcon, PlusIcon, TrashIcon, InformationCircleIcon, LockClosedIcon, XCircleIcon,
} from '@heroicons/react/outline';

interface RequisitionOption {
  requisition_id: string;
  req_number: string;
  title: string;
  description: string;
  estimated_total: number;
  status: string;
  department?: string;
  department_name?: string;
  date_required?: string;
  delivery_location?: string;
  encumbrance_ref?: string;
  items?: { description: string; estimated_total_cost: number; item_code?: string }[];
  specifications?: { filename: string }[];
}

type ProcurementMethod = NonNullable<ContractProcurementPlan['method']>;

interface MethodOption {
  value: ProcurementMethod;
  label: string;
  shortLabel: string;
  minPeriod: number;
  zpcRequired: boolean;
  isOpen: boolean;
  thresholdRange: string;
  citizenPreference: boolean;
  reservationScheme: boolean;
}

interface ResourceRequirements {
  evaluationCommitteeSize: number;
  requiredExpertise: string[];
  prebidConferenceRequired: boolean;
  prebidConferenceDate: string;
  siteVisitRequired: boolean;
  externalExpertRequired: boolean;
  specialInspectionRequired: boolean;
  specialInspectionDetails: string;
}

interface NewRiskState {
  category: CPPRisk['risk_category'];
  description: string;
  likelihood: CPPRisk['likelihood'];
  impact: CPPRisk['impact'];
  mitigation: string;
  owner: string;
}

interface MilestoneTemplate {
  name: string;
  locked: boolean;
  autoCalculated: boolean;
  offsetDays?: number;
  time?: string;
  note?: string;
}

const CPPSteps = [
  { id: 'source', label: 'Source & Overview', subtitle: 'Step 1' },
  { id: 'method', label: 'Method', subtitle: 'Step 2' },
  { id: 'milestones', label: 'Milestones', subtitle: 'Step 3' },
  { id: 'resources', label: 'Resources', subtitle: 'Step 4' },
  { id: 'risk_submit', label: 'Risk & Submit', subtitle: 'Step 5' },
] as const;

const METHOD_OPTIONS: MethodOption[] = [
  { value: 'open_tender', label: 'Open National Bidding', shortLabel: 'ONB', minPeriod: 21, zpcRequired: false, isOpen: true, thresholdRange: 'K1,000,001 – K5,000,000', citizenPreference: true, reservationScheme: true },
  { value: 'international', label: 'Open International Bidding', shortLabel: 'OIB', minPeriod: 45, zpcRequired: true, isOpen: true, thresholdRange: '> K5,000,000', citizenPreference: false, reservationScheme: false },
  { value: 'limited', label: 'Limited Bidding', shortLabel: 'LB', minPeriod: 14, zpcRequired: true, isOpen: false, thresholdRange: 'Special circumstances', citizenPreference: false, reservationScheme: false },
  { value: 'simplified', label: 'Simplified Bidding', shortLabel: 'SB', minPeriod: 7, zpcRequired: true, isOpen: false, thresholdRange: 'K20,001 – K1,000,000', citizenPreference: true, reservationScheme: true },
  { value: 'direct', label: 'Direct Procurement', shortLabel: 'DP', minPeriod: 0, zpcRequired: true, isOpen: false, thresholdRange: '< K20,000', citizenPreference: false, reservationScheme: false },
];

const EXPERTISE_OPTIONS = [
  { key: 'procurement', label: 'Procurement / regulatory expertise', mandatory: true },
  { key: 'laboratory', label: 'Laboratory / medical sciences expertise', mandatory: false },
  { key: 'finance', label: 'Finance / value-for-money expertise', mandatory: false },
  { key: 'legal', label: 'Legal expertise', mandatory: false },
  { key: 'supply_chain', label: 'Supply chain / logistics expertise', mandatory: false },
  { key: 'engineering', label: 'Engineering / technical expertise', mandatory: false },
];

const MILESTONE_TEMPLATES: Record<string, MilestoneTemplate[]> = {
  open_tender: [
    { name: 'CPP Approved', locked: true, autoCalculated: true, note: 'today — auto' },
    { name: 'Solicitation Document Ready', locked: false, autoCalculated: false, offsetDays: 3 },
    { name: 'Solicitation Published', locked: false, autoCalculated: false, offsetDays: 4 },
    { name: 'Pre-bid Conference (optional)', locked: false, autoCalculated: false, offsetDays: 13 },
    { name: 'Clarification Cutoff', locked: true, autoCalculated: true, note: 'auto: closing minus 5 working days' },
    { name: 'Bid Closing Date / Time', locked: false, autoCalculated: false, offsetDays: 25, time: '14:00 CAT' },
    { name: 'Public Bid Opening', locked: false, autoCalculated: false, offsetDays: 25, time: '14:30 CAT', note: 'same day or after closing' },
    { name: 'Preliminary Examination Complete', locked: false, autoCalculated: false, offsetDays: 27 },
    { name: 'Technical Evaluation Complete', locked: false, autoCalculated: false, offsetDays: 34 },
    { name: 'Financial Evaluation Complete', locked: false, autoCalculated: false, offsetDays: 36 },
    { name: 'BER Generated and Signed', locked: false, autoCalculated: false, offsetDays: 39 },
    { name: 'BER Approved by ZPC', locked: false, autoCalculated: false, offsetDays: 44 },
    { name: 'Contract Award Notice Published', locked: false, autoCalculated: false, offsetDays: 46 },
    { name: 'Standstill Period Ends', locked: true, autoCalculated: true, note: 'auto: award + 10 working days' },
    { name: 'Contract Signed (Both Parties)', locked: false, autoCalculated: false, offsetDays: 62 },
    { name: 'Contract Active', locked: false, autoCalculated: false, offsetDays: 66 },
    { name: 'Delivery', locked: true, autoCalculated: true, note: 'from requisition — required date' },
  ],
  limited: [
    { name: 'CPP Approved', locked: true, autoCalculated: true, note: 'today — auto' },
    { name: 'Solicitation Document Ready', locked: false, autoCalculated: false, offsetDays: 2 },
    { name: 'Solicitation Published', locked: false, autoCalculated: false, offsetDays: 3 },
    { name: 'Bid Closing Date / Time', locked: false, autoCalculated: false, offsetDays: 17, time: '14:00 CAT' },
    { name: 'Public Bid Opening', locked: false, autoCalculated: false, offsetDays: 17, time: '14:30 CAT' },
    { name: 'Evaluation Complete', locked: false, autoCalculated: false, offsetDays: 24 },
    { name: 'BER Generated and Signed', locked: false, autoCalculated: false, offsetDays: 27 },
    { name: 'ZPC Approval', locked: false, autoCalculated: false, offsetDays: 34 },
    { name: 'Contract Award Notice Published', locked: false, autoCalculated: false, offsetDays: 36 },
    { name: 'Standstill Period Ends', locked: true, autoCalculated: true, note: 'auto: award + 10 working days' },
    { name: 'Contract Signed', locked: false, autoCalculated: false, offsetDays: 50 },
    { name: 'Delivery', locked: true, autoCalculated: true, note: 'from requisition — required date' },
  ],
  simplified: [
    { name: 'CPP Approved', locked: true, autoCalculated: true, note: 'today — auto' },
    { name: 'Solicitation Issued', locked: false, autoCalculated: false, offsetDays: 2 },
    { name: 'Bid Closing', locked: false, autoCalculated: false, offsetDays: 9, time: '14:00 CAT' },
    { name: 'Bid Opening', locked: false, autoCalculated: false, offsetDays: 9, time: '14:30 CAT' },
    { name: 'Evaluation Complete', locked: false, autoCalculated: false, offsetDays: 14 },
    { name: 'BER Generated', locked: false, autoCalculated: false, offsetDays: 16 },
    { name: 'ZPC Approval', locked: false, autoCalculated: false, offsetDays: 23 },
    { name: 'Award Notice', locked: false, autoCalculated: false, offsetDays: 25 },
    { name: 'Standstill Ends', locked: true, autoCalculated: true },
    { name: 'Contract Signed', locked: false, autoCalculated: false, offsetDays: 35 },
    { name: 'Delivery', locked: true, autoCalculated: true },
  ],
  direct: [
    { name: 'CPP Approved', locked: true, autoCalculated: true, note: 'today — auto' },
    { name: 'Direct Negotiation Started', locked: false, autoCalculated: false, offsetDays: 2 },
    { name: 'Price Agreement', locked: false, autoCalculated: false, offsetDays: 10 },
    { name: 'ZPC Approval', locked: false, autoCalculated: false, offsetDays: 17 },
    { name: 'Contract Signed', locked: false, autoCalculated: false, offsetDays: 24 },
    { name: 'Delivery', locked: true, autoCalculated: true },
  ],
  international: [
    { name: 'CPP Approved', locked: true, autoCalculated: true, note: 'today — auto' },
    { name: 'Solicitation Document Ready', locked: false, autoCalculated: false, offsetDays: 7 },
    { name: 'Solicitation Published', locked: false, autoCalculated: false, offsetDays: 10 },
    { name: 'Pre-bid Conference', locked: false, autoCalculated: false, offsetDays: 25 },
    { name: 'Clarification Cutoff', locked: true, autoCalculated: true },
    { name: 'Bid Closing', locked: false, autoCalculated: false, offsetDays: 55, time: '14:00 CAT' },
    { name: 'Bid Opening', locked: false, autoCalculated: false, offsetDays: 55, time: '14:30 CAT' },
    { name: 'Evaluation Complete', locked: false, autoCalculated: false, offsetDays: 70 },
    { name: 'BER Generated', locked: false, autoCalculated: false, offsetDays: 75 },
    { name: 'ZPC Approval', locked: false, autoCalculated: false, offsetDays: 85 },
    { name: 'Award Notice', locked: false, autoCalculated: false, offsetDays: 88 },
    { name: 'Standstill Ends', locked: true, autoCalculated: true },
    { name: 'Contract Signed', locked: false, autoCalculated: false, offsetDays: 105 },
    { name: 'Delivery', locked: true, autoCalculated: true },
  ],
};

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) added++;
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRiskLabel(level: string): string {
  switch (level) {
    case 'high': return 'HIGH';
    case 'medium': return 'MEDIUM';
    case 'medium-high': return 'MEDIUM-HIGH';
    default: return 'LOW';
  }
}

const CPPCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([]);
  const [selectedRequisition, setSelectedRequisition] = useState<string>('');
  const [recommendedMethod, setRecommendedMethod] = useState<ProcurementMethod | ''>('');
  const [methodOverride, setMethodOverride] = useState(false);
  const [newMethodOverride, setNewMethodOverride] = useState<ProcurementMethod | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [milestones, setMilestones] = useState<ProcurementMilestone[]>([]);
  const [resourceRequirements, setResourceRequirements] = useState<ResourceRequirements>({
    evaluationCommitteeSize: 4,
    requiredExpertise: ['procurement'],
    prebidConferenceRequired: false,
    prebidConferenceDate: '',
    siteVisitRequired: false,
    externalExpertRequired: false,
    specialInspectionRequired: false,
    specialInspectionDetails: '',
  });
  const [risks, setRisks] = useState<CPPRisk[]>([]);
  const [newRisk, setNewRisk] = useState<NewRiskState>({
    category: 'supply',
    description: '',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: '',
    owner: '',
  });
  const [procurementStrategy, setProcurementStrategy] = useState('');
  const [isMultiYear, setIsMultiYear] = useState(false);
  const [cppNumber] = useState(() => `CPP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`);

  const loadRequisitions = useCallback(async () => {
    try {
      const res = await requisitionsApi.list({ page_size: 100, status: 'approved' });
      setRequisitions((res.results || []).map(r => ({
        requisition_id: r.id || r.requisition_id || '',
        req_number: r.req_number || r.requisition_id || '',
        title: r.title || '',
        description: r.description || '',
        estimated_total: Number(r.estimated_total) || Number(r.estimated_value) || 0,
        status: r.status || '',
        department: r.department || '',
        department_name: r.department_name || '',
        date_required: r.date_required || r.required_date || '',
        delivery_location: r.delivery_location || '',
        encumbrance_ref: r.encumbrance_ref || '',
        items: r.items?.map(item => ({
          description: item.description,
          estimated_total_cost: Number(item.estimated_total_cost) || 0,
          item_code: item.item_code,
        })) || [],
        specifications: r.specifications?.map((s: any) => ({ filename: s.filename || s.file?.split('/').pop() || 'Document' })) || [],
      })));
    } catch { setRequisitions([]); }
  }, []);

  useEffect(() => { loadRequisitions(); }, [loadRequisitions]);

  const selectedReq = useMemo(() => requisitions.find(r => r.requisition_id === selectedRequisition), [requisitions, selectedRequisition]);

  const finalMethod = useMemo(() => {
    if (methodOverride && newMethodOverride) return newMethodOverride;
    return recommendedMethod;
  }, [methodOverride, newMethodOverride, recommendedMethod]);

  const finalMethodOption = useMemo(() => METHOD_OPTIONS.find(m => m.value === finalMethod), [finalMethod]);

  const handleRequisitionSelect = async (reqId: string) => {
    setSelectedRequisition(reqId);
    const req = requisitions.find(r => r.requisition_id === reqId);
    if (req) {
      try {
        const rec = await methodApi.recommend({ estimated_value: req.estimated_total });
        setRecommendedMethod(rec.recommended_method as ProcurementMethod);
      } catch {
        const estimatedValue = req.estimated_total;
        const recommended = estimatedValue >= 1000000 ? 'open_tender' : estimatedValue >= 20000 ? 'simplified' : 'direct';
        setRecommendedMethod(recommended);
      }
    }
  };

  const generateMilestones = useCallback(() => {
    if (!finalMethod) return;
    const template = MILESTONE_TEMPLATES[finalMethod] || MILESTONE_TEMPLATES.open_tender;
    const today = new Date();
    const deliveryDate = selectedReq?.date_required ? new Date(selectedReq.date_required) : addWorkingDays(today, 75);
    const generated: ProcurementMilestone[] = [];

    template.forEach((t, idx) => {
      let plannedDate: string;
      let constraintNote = '';
      let validationBadges: string[] = [];

      if (t.locked && t.note?.includes('today')) {
        plannedDate = formatDate(today);
      } else if (t.locked && t.note?.includes('requisition')) {
        plannedDate = formatDate(deliveryDate);
      } else if (t.autoCalculated && t.note?.includes('closing')) {
        const closingMilestone = generated.find(m => m.milestone_name.includes('Bid Closing'));
        if (closingMilestone) {
          plannedDate = formatDate(addWorkingDays(new Date(closingMilestone.planned_date), -5));
        } else {
          plannedDate = formatDate(addWorkingDays(today, (t.offsetDays || 20)));
        }
      } else if (t.autoCalculated && t.note?.includes('standstill')) {
        const awardMilestone = generated.find(m => m.milestone_name.includes('Award Notice') || m.milestone_name.includes('Award'));
        if (awardMilestone) {
          plannedDate = formatDate(addWorkingDays(new Date(awardMilestone.planned_date), 10));
        } else {
          plannedDate = formatDate(addWorkingDays(today, (t.offsetDays || 40)));
        }
      } else if (t.offsetDays !== undefined) {
        plannedDate = formatDate(addWorkingDays(today, t.offsetDays));
      } else {
        plannedDate = formatDate(addWorkingDays(today, idx * 3));
      }

      // Constraint notes
      if (t.name.includes('Solicitation Published') || t.name.includes('Solicitation Issued')) {
        constraintNote = 'must be ≥ today';
      } else if (t.name.includes('Bid Closing')) {
        constraintNote = `min ${finalMethodOption?.minPeriod || 21} days from publication`;
      } else if (t.name.includes('Bid Opening') || t.name.includes('Opening')) {
        constraintNote = 'same day or after closing';
      }

      // Validation badge markers
      if (t.name.includes('Solicitation Published') || t.name.includes('Solicitation Issued')) {
        validationBadges.push('days_to_closing');
      }
      if (t.name.includes('Delivery')) {
        validationBadges.push('achievable');
      }

      generated.push({
        milestone_id: crypto.randomUUID(),
        cpp: '',
        milestone_name: t.name,
        sequence_number: idx + 1,
        planned_date: plannedDate,
        actual_date: null,
        variance_days: null,
        variance_flag: t.locked ? 'green' : undefined,
        is_system_updated: t.autoCalculated,
        time: t.time,
        note: t.note,
        constraintNote,
        validationBadges,
      });
    });

    setMilestones(generated);
  }, [finalMethod, selectedReq, finalMethodOption]);

  const prevMethodRef = useRef<string | null>(null);

  useEffect(() => {
    if (finalMethod) {
      const prev = prevMethodRef.current;
      prevMethodRef.current = finalMethod;
      if (prev !== null && prev !== finalMethod) {
        generateMilestones();
      } else if (milestones.length === 0) {
        generateMilestones();
      }
    }
  }, [finalMethod, milestones.length, generateMilestones]);

  const updateMilestoneDate = (i: number, value: string) => {
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, planned_date: value } : m));
  };

  const toggleExpertise = (key: string) => {
    setResourceRequirements(prev => ({
      ...prev,
      requiredExpertise: prev.requiredExpertise.includes(key)
        ? prev.requiredExpertise.filter(e => e !== key)
        : [...prev.requiredExpertise, key],
    }));
  };

  const addRisk = () => {
    if (!newRisk.description.trim()) { toast.error('Risk description is required'); return; }
    if (!newRisk.mitigation.trim()) { toast.error('Mitigation strategy is required'); return; }
    setRisks(prev => [...prev, {
      risk_id: crypto.randomUUID(),
      cpp: '',
      risk_category: newRisk.category,
      risk_description: newRisk.description,
      likelihood: newRisk.likelihood,
      impact: newRisk.impact,
      mitigation_strategy: newRisk.mitigation,
      risk_owner: newRisk.owner || (user?.full_name ? `${user.full_name} — Procurement Officer` : ''),
      created_at: new Date().toISOString(),
    }]);
    setNewRisk({ category: 'supply', description: '', likelihood: 'medium', impact: 'medium', mitigation: '', owner: '' });
  };

  const removeRisk = (i: number) => {
    setRisks(prev => prev.filter((_, idx) => idx !== i));
  };

  const calculateOverallRiskLevel = (): string => {
    if (risks.length === 0) return 'low';
    const impactMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const likelihoodMap = { low: 1, medium: 2, high: 3 };
    let totalScore = 0;
    risks.forEach(r => {
      const impact = impactMap[r.impact as keyof typeof impactMap] || 1;
      const likelihood = likelihoodMap[r.likelihood as keyof typeof likelihoodMap] || 1;
      totalScore += impact * likelihood;
    });
    const avg = totalScore / risks.length;
    if (avg >= 9) return 'high';
    if (avg >= 5) return 'medium-high';
    if (avg >= 3) return 'medium';
    return 'low';
  };

  const handleSubmit = async (submitAndApprove = false) => {
    if (!selectedRequisition) { toast.error('Select a requisition first'); return; }
    if (!finalMethod) { toast.error('Procurement method must be determined'); return; }
    if (milestones.length === 0) { toast.error('Milestones must be set'); return; }
    if (risks.length === 0) { toast.error('Add at least one risk with mitigation strategy'); return; }
    if (risks.some(r => !r.mitigation_strategy)) { toast.error('All risks must have a mitigation strategy'); return; }
    if (resourceRequirements.evaluationCommitteeSize < 3) { toast.error('Evaluation committee must have at least 3 members'); return; }

    if (milestoneErrors.length > 0) {
      toast.error(milestoneErrors[0]);
      return;
    }

    setLoading(true);
    try {
      const cppData: Partial<ContractProcurementPlan> = {
        requisition: selectedRequisition,
        method: finalMethod,
        recommended_method: recommendedMethod || undefined,
        method_override: methodOverride,
        override_reason: methodOverride ? overrideReason : undefined,
        zpc_approval_required: finalMethodOption?.zpcRequired || false,
        estimated_value: selectedReq?.estimated_total || 0,
        overall_risk_level: calculateOverallRiskLevel() as any,
        resource_requirements: resourceRequirements as any,
        milestones,
        risks,
        status: submitAndApprove && finalMethodOption?.isOpen ? 'approved' : 'draft',
      };

      const created = await procurementPlanningApi.contractPlans.create(cppData);

      if (submitAndApprove && finalMethodOption?.isOpen) {
        await procurementPlanningApi.contractPlans.approve(created.cpp_id);
        await procurementPlanningApi.contractPlans.lockBaseline(created.cpp_id);
        toast.success('CPP approved — baseline locked, procurement may commence');
      } else {
        toast.success('CPP created successfully');
      }
      navigate(`/procurement-planning/cpp/${created.cpp_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create CPP');
    }
    setLoading(false);
  };

  const nextStep = () => {
    if (currentStep === 0 && !selectedRequisition) { toast.error('Select a requisition to proceed'); return; }
    if (currentStep === 1 && !finalMethod) { toast.error('Determine procurement method first'); return; }
    if (currentStep === 1 && methodOverride && !newMethodOverride) { toast.error('Select an alternative method'); return; }
    if (currentStep === 1 && methodOverride && !overrideReason.trim()) { toast.error('Override justification is required'); return; }
    setCurrentStep(prev => Math.min(prev + 1, CPPSteps.length - 1));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const milestoneErrors = useMemo(() => {
    if (!finalMethodOption || milestones.length === 0) return [];
    const errors: string[] = [];
    const methodOpt = finalMethodOption;

    const pubIdx = milestones.findIndex(m => m.milestone_name.includes('Published') || m.milestone_name.includes('Issued'));
    const closingIdx = milestones.findIndex(m => m.milestone_name.includes('Bid Closing') || m.milestone_name.includes('Closing'));

    if (pubIdx >= 0 && closingIdx >= 0) {
      const pubDate = new Date(milestones[pubIdx].planned_date);
      const closingDate = new Date(milestones[closingIdx].planned_date);
      const daysDiff = Math.ceil((closingDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < methodOpt.minPeriod) {
        errors.push(`Solicitation period (${daysDiff} days) is less than minimum (${methodOpt.minPeriod} days for ${methodOpt.shortLabel})`);
      }
    }

    const openingIdx = milestones.findIndex(m => m.milestone_name.includes('Opening'));
    if (openingIdx >= 0 && closingIdx >= 0) {
      const openDate = new Date(milestones[openingIdx].planned_date);
      const closeDate = new Date(milestones[closingIdx].planned_date);
      if (openDate < closeDate) {
        errors.push('Bid opening must be on or after closing date');
      }
    }

    return errors;
  }, [milestones, finalMethodOption]);

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/procurement-planning/cpp')} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Procurement Plans</span>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Create Contract Procurement Plan</h1>
          {selectedReq && (
            <p className="text-sm font-medium text-gray-400 mt-1">
              Source: {selectedReq.req_number} — {selectedReq.title || selectedReq.description} — K{selectedReq.estimated_total.toLocaleString()}
            </p>
          )}

          {/* Step Indicator */}
          <div className="mt-8 flex items-center justify-between">
            {CPPSteps.map((step, i) => {
              const isComplete = i < currentStep;
              const isActive = i === currentStep;
              const isLocked = i > currentStep;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                      isComplete ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                      isActive ? 'bg-zammsa-green text-white shadow-lg shadow-zammsa-green/20 ring-4 ring-zammsa-green/10' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {isComplete ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-2 text-center ${
                      isActive ? 'text-gray-900' : isComplete ? 'text-gray-400' : 'text-gray-300'
                    }`}>
                      {step.label}
                    </span>
                    {isLocked && (
                      <span className="text-[8px] font-black text-gray-300 uppercase tracking-wider mt-0.5">locked</span>
                    )}
                  </div>
                  {i < CPPSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-8 ${
                      isComplete ? 'bg-emerald-500' : isActive ? 'bg-zammsa-green/30' : 'bg-gray-100'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 1: Source & Overview */}
      {currentStep === 0 && (
        <div className="space-y-8">
          {/* Source Requisition */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4" />
                Source Requisition (read-only — auto-populated)
              </h2>
            </div>

            {!selectedReq ? (
              <div className="p-8">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-2 block">Select Approved Requisition *</label>
                <select
                  value={selectedRequisition}
                  onChange={(e) => handleRequisitionSelect(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all"
                >
                  <option value="">-- Select Requisition --</option>
                  {requisitions.map(r => (
                    <option key={r.requisition_id} value={r.requisition_id}>
                      {r.req_number} — {r.title || r.description} (K{r.estimated_total.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requisition</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {selectedReq.req_number}
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Approved for Procurement</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</p>
                    <p className="text-sm font-bold text-gray-900">{selectedReq.title || selectedReq.description}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</p>
                    <p className="text-sm font-bold text-gray-900">Goods</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</p>
                    <p className="text-sm font-bold text-gray-900">{selectedReq.department_name || selectedReq.department || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Total</p>
                    <p className="text-lg font-black text-zammsa-green">K {selectedReq.estimated_total.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Required By</p>
                    <p className="text-sm font-bold text-gray-900">{selectedReq.date_required ? formatDateDisplay(selectedReq.date_required) : '---'}</p>
                  </div>
                  {selectedReq.delivery_location && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery</p>
                      <p className="text-sm font-bold text-gray-900">{selectedReq.delivery_location}</p>
                    </div>
                  )}
                  {selectedReq.encumbrance_ref && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Encumbrance</p>
                      <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {selectedReq.encumbrance_ref}
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Active</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Line Items */}
                {selectedReq.items && selectedReq.items.length > 0 && (
                  <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6 mb-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Line Items</h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest pb-3">Item</th>
                          <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest pb-3">Description</th>
                          <th className="text-right text-[10px] font-black text-gray-400 uppercase tracking-widest pb-3">Total K</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReq.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-50">
                            <td className="py-3 text-xs font-mono font-bold text-gray-600">{item.item_code || `#${idx + 1}`}</td>
                            <td className="py-3 text-sm font-bold text-gray-800">{item.description}</td>
                            <td className="py-3 text-right text-sm font-black text-gray-900">{item.estimated_total_cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Specifications */}
                {selectedReq.specifications && selectedReq.specifications.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <DocumentTextIcon className="w-4 h-4" />
                    <span className="font-bold">Specifications:</span>
                    {selectedReq.specifications.map((s, idx) => (
                      <span key={idx} className="text-zammsa-green font-bold">{s.filename}{idx < selectedReq.specifications!.length - 1 ? ' | ' : ''}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CPP Details */}
          {selectedReq && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <ClipboardListIcon className="w-4 h-4" />
                CPP Details
              </h2>
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CPP Number</label>
                  <input
                    value={cppNumber}
                    readOnly
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-mono font-bold text-gray-500"
                  />
                  <p className="text-[10px] font-bold text-gray-300 ml-1">Auto-generated, read-only</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Procurement Strategy *</label>
                  <textarea
                    value={procurementStrategy}
                    onChange={(e) => setProcurementStrategy(e.target.value)}
                    placeholder="Describe your procurement strategy..."
                    rows={3}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Is this a multi-year contract?</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={isMultiYear} onChange={() => setIsMultiYear(true)} className="text-zammsa-green focus:ring-zammsa-green" />
                      <span className="text-sm font-bold text-gray-700">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!isMultiYear} onChange={() => setIsMultiYear(false)} className="text-zammsa-green focus:ring-zammsa-green" />
                      <span className="text-sm font-bold text-gray-700">No</span>
                    </label>
                  </div>
                  {isMultiYear && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-amber-700">
                      <InformationCircleIcon className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-bold">If Yes, you must document future-year budget commitments</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Method of Procurement */}
      {currentStep === 1 && (
        <div className="space-y-8">
          {/* System Recommendation */}
          {recommendedMethod && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50">
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <LightningBoltIcon className="w-4 h-4" />
                  System Recommendation
                </h2>
              </div>
              <div className="p-8">
                <div className="text-sm text-gray-500 mb-6 space-y-1">
                  <p className="font-bold">Based on:</p>
                  <p className="ml-4">• Type: Goods</p>
                  <p className="ml-4">• Value: K{selectedReq?.estimated_total.toLocaleString()}</p>
                  <p className="ml-4">• Emergency: No</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                    <h3 className="text-lg font-black text-emerald-900 uppercase tracking-wider">
                      {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.label} ({METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.shortLabel})
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm text-emerald-800">
                    <p className="font-bold">K{selectedReq?.estimated_total.toLocaleString()} falls within {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.thresholdRange} range per Procurement Policy Section 21.2(a).</p>
                    <p>Minimum period: {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.minPeriod} days</p>
                    <p>Citizen preference: {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.citizenPreference ? 'Applicable' : 'Not applicable'}</p>
                    <p>Reservation scheme: {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.reservationScheme ? `Applicable (K${(selectedReq?.estimated_total || 0) / 1000000}M < K3M)` : 'Not applicable'}</p>
                    <p>ZPC approval required: {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.zpcRequired ? 'Yes' : 'No (open method)'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Decision */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Your Decision *</h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-5 bg-gray-50 rounded-2xl cursor-pointer border-2 border-transparent hover:border-zammsa-green/20 transition-all">
                <input
                  type="radio"
                  checked={!methodOverride}
                  onChange={() => { setMethodOverride(false); setNewMethodOverride(''); setOverrideReason(''); }}
                  className="mt-1 text-zammsa-green focus:ring-zammsa-green"
                />
                <div>
                  <p className="text-sm font-bold text-gray-900">Accept system recommendation: {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.label}</p>
                  <p className="text-xs text-gray-500 mt-1">CPP will be approved immediately (no ZPC wait needed)</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-5 bg-gray-50 rounded-2xl cursor-pointer border-2 border-transparent hover:border-amber-200 transition-all">
                <input
                  type="radio"
                  checked={methodOverride}
                  onChange={() => setMethodOverride(true)}
                  className="mt-1 text-zammsa-green focus:ring-zammsa-green"
                />
                <div>
                  <p className="text-sm font-bold text-gray-900">Override with a different method</p>
                  <p className="text-xs text-gray-500 mt-1">Requires Director of Procurement approval. Non-open methods also require ZPC justification.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Override Section */}
          {methodOverride && (
            <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-6">Select Alternative Method *</h2>
              <div className="space-y-6">
                <div>
                  <select
                    value={newMethodOverride}
                    onChange={(e) => setNewMethodOverride(e.target.value as ProcurementMethod)}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-amber-500/5 transition-all"
                  >
                    <option value="">-- Select Method --</option>
                    {METHOD_OPTIONS.filter(m => m.value !== recommendedMethod).map(m => (
                      <option key={m.value} value={m.value}>{m.label} ({m.shortLabel})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Override Justification *</label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide detailed justification for overriding the system recommendation..."
                    rows={3}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-amber-500/5 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-amber-700">
                  <InformationCircleIcon className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-bold">This will be routed to the Director of Procurement (R-09) for approval before you can proceed.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Step 3: Milestone Schedule */}
      {currentStep === 2 && (
        <div className="space-y-8">
          {/* Guidance */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-900 mb-1">SYSTEM GUIDANCE</p>
              <p className="text-sm text-blue-800 leading-relaxed">
                Working backwards from delivery ({selectedReq?.date_required ? formatDateDisplay(selectedReq.date_required) : 'auto-calculated (75 working days)'}), here is the suggested schedule. Adjust dates as needed.
                <br />
                Minimum solicitation period: {finalMethodOption?.minPeriod || 21} days ({finalMethodOption?.shortLabel || 'ONB'})
              </p>
            </div>
          </div>

          {/* Milestone Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Milestone Schedule
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Method: {finalMethodOption?.label || '---'} | Required Delivery: {selectedReq?.date_required ? formatDateDisplay(selectedReq.date_required) : (milestones.length > 0 ? formatDateDisplay(milestones[milestones.length - 1]?.planned_date || '') : '---')}
                </span>
                <button
                  onClick={generateMilestones}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-zammsa-green hover:border-zammsa-green/20 transition-all"
                >
                  <LightningBoltIcon className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-10">#</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Milestone</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-64">Planned Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {milestones.map((m, i) => {
                    const isLocked = m.variance_flag === 'green' || m.is_system_updated;

                    // Compute dynamic validation data
                    let daysToClosing = '';
                    let isAchievable = false;
                    if (m.validationBadges?.includes('days_to_closing')) {
                      const closingMs = milestones.find(x => x.milestone_name.includes('Bid Closing') || x.milestone_name.includes('Closing'));
                      if (closingMs) {
                        const pubDate = new Date(m.planned_date);
                        const closeDate = new Date(closingMs.planned_date);
                        const days = Math.ceil((closeDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
                        daysToClosing = `${days} days to closing`;
                      }
                    }
                    if (m.validationBadges?.includes('achievable') && selectedReq?.date_required) {
                      isAchievable = true;
                    }

                    return (
                      <tr key={m.milestone_id} className={`border-b border-gray-100 transition-colors ${isLocked ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4 text-xs font-black text-gray-400 align-top">{m.sequence_number}</td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <span className={`text-sm font-semibold ${isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                              {m.milestone_name}
                            </span>
                            {isLocked && (
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded-md px-2 py-0.5 whitespace-nowrap mt-0.5">
                                locked
                              </span>
                            )}
                          </div>
                          {m.constraintNote && (
                            <p className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-1">
                              <ArrowLeftIcon className="w-3 h-3" /> {m.constraintNote}
                            </p>
                          )}
                          {m.note && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              {m.note}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {isLocked ? (
                                <div className="flex items-center gap-2">
                                  <LockClosedIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm font-bold text-gray-700">{formatDateDisplay(m.planned_date)}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                                  <input
                                    type="date"
                                    value={m.planned_date}
                                    onChange={(e) => updateMilestoneDate(i, e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-zammsa-green/30 focus:border-zammsa-green transition-shadow"
                                  />
                                </div>
                              )}
                              {m.time && (
                                <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{m.time}</span>
                              )}
                            </div>
                            {m.is_system_updated && m.note && (
                              <span className="text-[10px] font-bold text-gray-400">(auto-calculated)</span>
                            )}
                            {daysToClosing && (
                              <div className="mt-0.5 flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                <span className="text-[11px] font-black text-emerald-600">{daysToClosing}</span>
                                <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                              </div>
                            )}
                            {isAchievable && (
                              <div className="mt-0.5 flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                <span className="text-[11px] font-black text-emerald-600">Achievable</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {milestones.length === 0 && (
              <div className="p-12 text-center">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No milestones generated</p>
                <p className="text-xs text-gray-300 mt-1">Select a procurement method in Step 2 to auto-generate the schedule</p>
                <button
                  onClick={generateMilestones}
                  className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
                >
                  Generate Schedule
                </button>
              </div>
            )}
          </div>

          {/* Schedule Validation */}
          {milestones.length > 0 && (
            <div className={`rounded-2xl border p-6 ${milestoneErrors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className={`w-5 h-5 shrink-0 mt-0.5 ${milestoneErrors.length === 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                <div className="flex-1">
                  <h2 className={`text-sm font-bold mb-3 ${milestoneErrors.length === 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                    SCHEDULE VALIDATION
                  </h2>
                  <div className="space-y-1.5">
                    {milestoneErrors.length === 0 ? (
                      <>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Solicitation period: {finalMethodOption?.minPeriod || 21} days (meets {finalMethodOption?.shortLabel || 'ONB'} minimum)</p>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Bid opening on / after closing date</p>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Award notice after BER approval</p>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Standstill auto-calculated: 10 working days</p>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Delivery meets requisition requirement</p>
                        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Total procurement cycle achievable</p>
                      </>
                    ) : (
                      milestoneErrors.map((err, idx) => (
                        <p key={idx} className="text-sm text-red-600 flex items-center gap-2"><XCircleIcon className="w-4 h-4" /> {err}</p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Resources */}
      {currentStep === 3 && (
        <div className="space-y-8">
          {/* Evaluation Committee */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <UserCircleIcon className="w-4 h-4" />
              Evaluation Committee
            </h2>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-2 block">Required Number of Evaluators * (minimum is 3)</label>
                <input
                  type="number"
                  min={3}
                  value={resourceRequirements.evaluationCommitteeSize}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, evaluationCommitteeSize: parseInt(e.target.value) || 3 })}
                  className="w-32 bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-3 block">Required Expertise (tick all that apply) *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {EXPERTISE_OPTIONS.map(exp => (
                    <label key={exp.key} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                      <input
                        type="checkbox"
                        checked={resourceRequirements.requiredExpertise.includes(exp.key)}
                        onChange={() => toggleExpertise(exp.key)}
                        className="mt-0.5 rounded text-zammsa-green focus:ring-zammsa-green"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-700">{exp.label}</span>
                        {exp.mandatory && <span className="text-[9px] font-black text-zammsa-green ml-2 uppercase">(mandatory)</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Procurement Activities */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <ClipboardListIcon className="w-4 h-4" />
              Procurement Activities
            </h2>
            <div className="space-y-8">
              {/* Pre-bid Conference */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pre-bid Conference Required?</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={resourceRequirements.prebidConferenceRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, prebidConferenceRequired: true })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!resourceRequirements.prebidConferenceRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, prebidConferenceRequired: false })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">No</span>
                  </label>
                </div>
                {resourceRequirements.prebidConferenceRequired && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-500">Planned date:</label>
                    <input
                      type="date"
                      value={resourceRequirements.prebidConferenceDate}
                      onChange={(e) => setResourceRequirements({ ...resourceRequirements, prebidConferenceDate: e.target.value })}
                      className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                    />
                    <span className="text-[10px] font-bold text-gray-300">(auto-linked to milestone)</span>
                  </div>
                )}
              </div>

              {/* Site Visit */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Site Visit Required?</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={resourceRequirements.siteVisitRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, siteVisitRequired: true })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!resourceRequirements.siteVisitRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, siteVisitRequired: false })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* External Expert */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">External Technical Expert Required?</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={resourceRequirements.externalExpertRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, externalExpertRequired: true })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!resourceRequirements.externalExpertRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, externalExpertRequired: false })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Special Inspection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Special Inspection on Delivery?</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={resourceRequirements.specialInspectionRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, specialInspectionRequired: true })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!resourceRequirements.specialInspectionRequired} onChange={() => setResourceRequirements({ ...resourceRequirements, specialInspectionRequired: false })} className="text-zammsa-green focus:ring-zammsa-green" />
                    <span className="text-sm font-bold text-gray-700">No</span>
                  </label>
                </div>
                {resourceRequirements.specialInspectionRequired && (
                  <textarea
                    value={resourceRequirements.specialInspectionDetails}
                    onChange={(e) => setResourceRequirements({ ...resourceRequirements, specialInspectionDetails: e.target.value })}
                    placeholder="Describe special inspection requirements..."
                    rows={2}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Risk & Submit */}
      {currentStep === 4 && (
        <div className="space-y-8">
          {/* Risk Register */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <ExclamationIcon className="w-4 h-4 text-amber-500" />
                Risk Register
              </h2>
              <button
                onClick={() => {
                  if (!newRisk.description.trim()) { toast.error('Enter risk description first'); return; }
                  addRisk();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
              >
                <PlusIcon className="w-3 h-3" />
                Add Risk
              </button>
            </div>

            {/* New Risk Form */}
            <div className="p-8 border-b border-gray-50 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-1 block">Risk Category *</label>
                  <select
                    value={newRisk.category}
                    onChange={(e) => setNewRisk({ ...newRisk, category: e.target.value as CPPRisk['risk_category'] })}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  >
                    <option value="supply">Supply Risk</option>
                    <option value="price">Price Risk</option>
                    <option value="quality">Quality Risk</option>
                    <option value="delivery">Delivery Risk</option>
                    <option value="regulatory">Regulatory Risk</option>
                    <option value="capacity">Capacity Risk</option>
                    <option value="custom">Custom Risk</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-1 block">Likelihood *</label>
                  <select
                    value={newRisk.likelihood}
                    onChange={(e) => setNewRisk({ ...newRisk, likelihood: e.target.value as CPPRisk['likelihood'] })}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-1 block">Impact *</label>
                  <select
                    value={newRisk.impact}
                    onChange={(e) => setNewRisk({ ...newRisk, impact: e.target.value as CPPRisk['impact'] })}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Risk Description *</label>
                  <textarea
                    value={newRisk.description}
                    onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                    placeholder="Describe the risk..."
                    rows={2}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Mitigation Strategy *</label>
                  <textarea
                    value={newRisk.mitigation}
                    onChange={(e) => setNewRisk({ ...newRisk, mitigation: e.target.value })}
                    placeholder="Describe how this risk will be mitigated..."
                    rows={2}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Risk Owner</label>
                  <input
                    value={newRisk.owner}
                    onChange={(e) => setNewRisk({ ...newRisk, owner: e.target.value })}
                    placeholder={user?.full_name ? `${user.full_name} — Procurement Officer` : 'Risk owner'}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  />
                </div>
              </div>
            </div>

            {/* Existing Risks */}
            {risks.length > 0 && (
              <div className="divide-y divide-gray-50">
                {risks.map((r, i) => {
                  const impactColor = r.impact === 'critical' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                    r.impact === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    r.impact === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200';
                  const likelihoodColor = r.likelihood === 'high' ? 'bg-rose-50 text-rose-600' :
                    r.likelihood === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600';
                  return (
                    <div key={r.risk_id} className="p-6 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Risk {i + 1}</span>
                          <span className="text-[9px] font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">{r.risk_category.replace(/_/g, ' ')} Risk</span>
                        </div>
                        <button onClick={() => removeRisk(i)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded border ${impactColor}`}>{r.impact.toUpperCase()} Impact</span>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded ${likelihoodColor}`}>{r.likelihood.toUpperCase()} Likelihood</span>
                      </div>
                      <p className="text-sm font-bold text-gray-800 mb-2">{r.risk_description}</p>
                      <p className="text-xs text-gray-500"><span className="font-bold">Mitigation:</span> {r.mitigation_strategy}</p>
                      {r.risk_owner && <p className="text-[10px] font-bold text-gray-300 mt-2 uppercase">Owner: {r.risk_owner}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {risks.length === 0 && (
              <div className="p-12 text-center text-gray-300">
                <ExclamationIcon className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm font-bold uppercase tracking-widest">No risks added yet</p>
                <p className="text-xs mt-1">Use the form above to add risks to the register</p>
              </div>
            )}

            {/* Overall Risk Level */}
            {risks.length > 0 && (
              <div className="p-6 bg-gray-900 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Overall Risk Level (system calculated)</p>
                    <p className={`text-lg font-black tracking-tight mt-1 ${
                      calculateOverallRiskLevel() === 'high' ? 'text-rose-400' :
                      calculateOverallRiskLevel() === 'medium-high' ? 'text-amber-400' :
                      calculateOverallRiskLevel() === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {getRiskLabel(calculateOverallRiskLevel())}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full ${
                    calculateOverallRiskLevel() === 'high' ? 'bg-rose-500' :
                    calculateOverallRiskLevel() === 'medium-high' ? 'bg-amber-500' :
                    calculateOverallRiskLevel() === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`} />
                </div>
              </div>
            )}
          </div>

          {/* Final Validation */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              Final Validation
            </h2>
            <div className="space-y-3">
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Source requisition: {selectedReq?.req_number} (Approved)</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Method: {finalMethodOption?.label} {methodOverride ? '(override)' : '(system recommended)'}</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> {milestones.length} milestones set — all dates validated</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> {resourceRequirements.evaluationCommitteeSize} EC members required, {resourceRequirements.requiredExpertise.length} expertise areas specified</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> {risks.length} risks identified with mitigations</p>
              {!finalMethodOption?.zpcRequired && (
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> No ZPC approval needed (open method, no override)</p>
              )}
            </div>

            {/* Routing Info */}
            <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-sm font-black text-emerald-900 uppercase tracking-wider">
                {finalMethodOption?.isOpen ? (
                  <>Routing: CPP will be APPROVED IMMEDIATELY upon submission (Open method — no ZPC wait required). Baseline schedule will be LOCKED automatically.</>
                ) : methodOverride ? (
                  <>Routing: CPP will be sent to Director of Procurement for override approval, then ZPC for justification review.</>
                ) : (
                  <>Routing: CPP will be submitted to ZPC for justification review and approval.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-100">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
            currentStep === 0 ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => toast.success('Draft saved')}
            className="px-6 py-4 bg-white border border-gray-200 text-sm font-black text-gray-400 uppercase tracking-widest rounded-2xl hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            Save Draft
          </button>
          {currentStep === CPPSteps.length - 1 ? (
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-5 bg-zammsa-green text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-zammsa-green/30 hover:bg-zammsa-green-dark transition-all disabled:opacity-50"
            >
              <CheckCircleIcon className="w-5 h-5" />
              {loading ? 'Submitting...' : 'Submit & Approve'}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="px-8 py-5 bg-zammsa-green text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-zammsa-green/30 hover:bg-zammsa-green-dark transition-all"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CPPCreate;
