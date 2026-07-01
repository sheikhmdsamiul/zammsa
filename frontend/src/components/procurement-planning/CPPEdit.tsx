import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { requisitionsApi } from '../../api/requisitions';
import { ContractProcurementPlan, ProcurementMilestone, CPPRisk } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import {
  CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon,
  DocumentTextIcon, PaperClipIcon, UploadIcon, TrashIcon, DownloadIcon,
} from '@heroicons/react/outline';

const DOC_TYPES = [
  { value: 'strategy_paper', label: 'Strategy Paper' },
  { value: 'market_research', label: 'Market Research' },
  { value: 'price_quote', label: 'Price Quote' },
  { value: 'evaluation_methodology', label: 'Evaluation Methodology' },
  { value: 'specification', label: 'Specification Document' },
  { value: 'other', label: 'Other' },
];

interface RequisitionOption {
  requisition_id: string;
  req_number: string;
  title: string;
  description: string;
  estimated_total: number;
  status: string;
  items?: { description: string; estimated_total_cost: number; item_code?: string; attachment_url?: string }[];
  specifications?: { filename: string }[];
}

type ProcurementMethod = NonNullable<ContractProcurementPlan['method']>;

interface MethodOption {
  value: ProcurementMethod;
  label: string;
  minPeriod: number;
  zpcRequired: boolean;
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
  specialDeliveryRequirements: boolean;
  submissionFormat: 'single' | 'two';
  bidValidityDays: number;
  bidSecurityType: 'bank_guarantee' | 'surety_bond' | 'cash';
  bidSecurityRate: number;
  minimumTechnicalThreshold: number;
  citizenPreference: boolean;
}

const EXPERTISE_OPTIONS = [
  { key: 'procurement', label: 'Procurement / regulatory expertise', mandatory: true },
  { key: 'laboratory', label: 'Laboratory / medical sciences expertise', mandatory: false },
  { key: 'finance', label: 'Finance / value-for-money expertise', mandatory: false },
  { key: 'legal', label: 'Legal expertise', mandatory: false },
  { key: 'supply_chain', label: 'Supply chain / logistics expertise', mandatory: false },
  { key: 'engineering', label: 'Engineering / technical expertise', mandatory: false },
];

interface NewRiskState {
  category: CPPRisk['risk_category'];
  description: string;
  likelihood: CPPRisk['likelihood'];
  impact: CPPRisk['impact'];
  mitigation: string;
}

const CPPSteps = [
  { id: 'requisition', label: 'Requisition' },
  { id: 'method', label: 'Method' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'resources', label: 'Resources' },
  { id: 'risks', label: 'Risks' },
  { id: 'review', label: 'Review' },
] as const;

const METHOD_OPTIONS: MethodOption[] = [
  { value: 'direct', label: 'Direct Procurement', minPeriod: 0, zpcRequired: true },
  { value: 'simplified', label: 'Simplified Bidding', minPeriod: 7, zpcRequired: true },
  { value: 'limited', label: 'Limited Bidding', minPeriod: 14, zpcRequired: true },
  { value: 'open_tender', label: 'Open Tender', minPeriod: 30, zpcRequired: false },
  { value: 'international', label: 'International Tender', minPeriod: 45, zpcRequired: true },
];

const ZPC_GROUNDS = [
  'Sole Source / Proprietary Item',
  'Emergency Procurement',
  'Additional Supplies from Original Supplier',
  'Standardization Requirements',
  'National Security',
  'Artistic / Cultural Specificity',
  'Research / Experimental Purpose',
];

const CPPEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([]);
  const [newMethodOverride, setNewMethodOverride] = useState<string>('');
  const [selectedRequisition, setSelectedRequisition] = useState<string>('');
  const [recommendedMethod, setRecommendedMethod] = useState<ProcurementMethod | ''>('');
  const [methodOverride, setMethodOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [zpcGrounds, setZpcGrounds] = useState('');
  const [zpcJustification, setZpcJustification] = useState('');
  const [milestones, setMilestones] = useState<ProcurementMilestone[]>([]);
  const [newMilestone, setNewMilestone] = useState({ name: '', date: '' });
  const [resourceRequirements, setResourceRequirements] = useState<ResourceRequirements>({
    evaluationCommitteeSize: 3,
    requiredExpertise: ['procurement'],
    prebidConferenceRequired: false,
    prebidConferenceDate: '',
    siteVisitRequired: false,
    externalExpertRequired: false,
    specialInspectionRequired: false,
    specialInspectionDetails: '',
    specialDeliveryRequirements: false,
    submissionFormat: 'single',
    bidValidityDays: 90,
    bidSecurityType: 'bank_guarantee',
    bidSecurityRate: 2,
    minimumTechnicalThreshold: 70,
    citizenPreference: true,
  });
  const [risks, setRisks] = useState<CPPRisk[]>([]);
  const [cppDocs, setCppDocs] = useState<{ file?: File; documentType: string; description: string; isExisting?: boolean; documentId?: string; filename?: string; file_url?: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [newRisk, setNewRisk] = useState<NewRiskState>({
    category: 'supply',
    description: '',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: '',
  });

  const loadRequisitions = useCallback(async () => {
    try {
      const res = await requisitionsApi.list({ page_size: 100, status: 'approved' });
      setRequisitions((res.results || []).map(r => ({
        requisition_id: r.requisition_id || '',
        req_number: r.req_number || '',
        title: r.title || r.description || '',
        description: r.description || '',
        estimated_total: Number(r.estimated_total) || 0,
        status: r.status || '',
        items: r.items?.map((item: any) => ({
          description: item.description,
          estimated_total_cost: Number(item.estimated_total_cost) || 0,
          item_code: item.item_code,
          attachment_url: item.attachment_url,
        })) || [],
        specifications: r.specifications?.map((s: any) => ({ filename: s.filename || s.file?.split('/').pop() || 'Document' })) || [],
      })));
    } catch { setRequisitions([]); }
  }, []);

  useEffect(() => { loadRequisitions(); }, [loadRequisitions]);
  
  useEffect(() => {
    const loadCPP = async () => {
      if (!id) return;
      setLoadingData(true);
      try {
        const res = await procurementPlanningApi.contractPlans.detail(id);
        setSelectedRequisition(res.requisition || '');
        setRecommendedMethod((res.recommended_method || res.method || '') as ProcurementMethod | '');
        setMethodOverride(Boolean(res.method_override));
        setNewMethodOverride(res.method_override ? (res.method || '') : '');
        setOverrideReason(res.override_reason || '');
        setZpcGrounds(res.zpc_grounds || '');
        setZpcJustification(res.zpc_justification || '');
        setMilestones((res.milestones || []).map((m, idx) => ({
          milestone_id: m.milestone_id || crypto.randomUUID(),
          cpp: m.cpp || '',
          milestone_name: m.milestone_name || '',
          sequence_number: m.sequence_number || idx + 1,
          planned_date: m.planned_date || '',
          actual_date: m.actual_date || null,
          variance_days: m.variance_days ?? null,
        })));
        setRisks((res.risks || []).map(r => ({
          risk_id: r.risk_id || crypto.randomUUID(),
          cpp: r.cpp || '',
          risk_category: r.risk_category,
          risk_description: r.risk_description || '',
          likelihood: r.likelihood,
          impact: r.impact,
          mitigation_strategy: r.mitigation_strategy || '',
          created_at: r.created_at || new Date().toISOString(),
        })));
        const rr = (res.resource_requirements || {}) as Partial<ResourceRequirements>;
        setResourceRequirements({
          evaluationCommitteeSize: Number(rr.evaluationCommitteeSize) || 3,
          requiredExpertise: Array.isArray(rr.requiredExpertise) ? rr.requiredExpertise : ['procurement'],
          prebidConferenceRequired: Boolean(rr.prebidConferenceRequired),
          prebidConferenceDate: rr.prebidConferenceDate || '',
          siteVisitRequired: Boolean(rr.siteVisitRequired),
          externalExpertRequired: Boolean(rr.externalExpertRequired),
          specialInspectionRequired: Boolean(rr.specialInspectionRequired),
          specialInspectionDetails: rr.specialInspectionDetails || '',
          specialDeliveryRequirements: Boolean(rr.specialDeliveryRequirements),
          submissionFormat: (rr.submissionFormat as 'single' | 'two') || 'single',
          bidValidityDays: Number(rr.bidValidityDays) || 90,
          bidSecurityType: (rr.bidSecurityType as 'bank_guarantee' | 'surety_bond' | 'cash') || 'bank_guarantee',
          bidSecurityRate: Number(rr.bidSecurityRate) || 2,
          minimumTechnicalThreshold: Number(rr.minimumTechnicalThreshold) || 70,
          citizenPreference: rr.citizenPreference !== undefined ? Boolean(rr.citizenPreference) : true,
        });

        // Load existing documents
        if (res.documents && res.documents.length > 0) {
          setCppDocs(res.documents.map((doc: any) => ({
            documentType: doc.document_type,
            description: doc.description,
            isExisting: true,
            documentId: doc.id || doc.document_id,
            filename: doc.filename,
            file_url: doc.file_url,
          })));
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error || 'Failed to load CPP');
        navigate('/procurement-planning/cpp');
      } finally {
        setLoadingData(false);
      }
    };
    loadCPP();
  }, [id, navigate]);

  const handleDeleteDocument = async (doc: any, idx: number) => {
    if (doc.isExisting && doc.documentId) {
      setDeletingDocId(doc.documentId);
      try {
        await procurementPlanningApi.contractPlans.documents.delete(id, doc.documentId);
        toast.success('Document deleted');
        setCppDocs(prev => prev.filter((_, i) => i !== idx));
      } catch (err: any) {
        toast.error(err?.response?.data?.error || 'Failed to delete document');
      } finally {
        setDeletingDocId(null);
      }
    } else {
      setCppDocs(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const addMilestone = () => {
    if (!newMilestone.name || !newMilestone.date) return;
    setMilestones(prev => [...prev, {
      milestone_id: crypto.randomUUID(),
      cpp: '',
      milestone_name: newMilestone.name,
      sequence_number: prev.length + 1,
      planned_date: newMilestone.date,
      actual_date: null,
      variance_days: null,
    }]);
    setNewMilestone({ name: '', date: '' });
  };

  const removeMilestone = (i: number) => {
    setMilestones(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateMilestone = (i: number, field: keyof ProcurementMilestone, value: any) => {
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const addRisk = () => {
    if (!newRisk.description) return;
    if (!newRisk.mitigation.trim()) { toast.error('Mitigation strategy is required'); return; }
    setRisks(prev => [...(prev || []), {
      risk_id: crypto.randomUUID(),
      cpp: '',
      risk_category: newRisk.category as any,
      risk_description: newRisk.description,
      likelihood: newRisk.likelihood as any,
      impact: newRisk.impact as any,
      mitigation_strategy: newRisk.mitigation,
      created_at: new Date().toISOString(),
    }]);
    setNewRisk({ category: 'supply', description: '', likelihood: 'medium', impact: 'medium', mitigation: '' });
  };

  const removeRisk = (i: number) => {
    setRisks(prev => (prev || []).filter((_, idx) => idx !== i));
  };

  const calculateOverallRiskLevel = () => {
    if (!risks || risks.length === 0) return 'low';
    const maxImpact = risks.reduce((max, r) => {
      const impactMap = { low: 1, medium: 2, high: 3, critical: 4 };
      return Math.max(max, impactMap[r.impact as keyof typeof impactMap]);
    }, 0);
    if (maxImpact === 4) return 'high';
    if (maxImpact >= 3) return 'high';
    return 'medium';
  };

  const handleSubmit = async () => {
    if (!selectedRequisition) { toast.error('Select a requisition first'); return; }
    if (!recommendedMethod) { toast.error('Procurement method must be determined'); return; }
    if (milestones.length === 0) { toast.error('Add at least one milestone'); return; }
    const selectedMethod = methodOverride ? (newMethodOverride as ProcurementMethod) : recommendedMethod;
    const selectedMethodOption = METHOD_OPTIONS.find(m => m.value === selectedMethod);
    if (selectedMethodOption?.zpcRequired) {
      if (!zpcGrounds) { toast.error('Select non-open method grounds'); return; }
      if (!zpcJustification.trim()) { toast.error('Enter the non-open method justification'); return; }
      if (cppDocs.length === 0) { toast.error('Attach at least one supporting evidence document for the non-open method'); return; }
    }
    
    setLoading(true);
    try {
      const cppData: Partial<ContractProcurementPlan> = {
        requisition: selectedRequisition,
        method: methodOverride ? (newMethodOverride as any) : recommendedMethod,
        recommended_method: recommendedMethod || undefined,
        method_override: methodOverride,
        override_reason: methodOverride ? overrideReason : '',
        zpc_approval_required: selectedMethodOption?.zpcRequired || false,
        zpc_grounds: selectedMethodOption?.zpcRequired ? zpcGrounds : '',
        zpc_justification: selectedMethodOption?.zpcRequired ? zpcJustification : '',
        estimated_value: requisitions.find(r => r.requisition_id === selectedRequisition)?.estimated_total || 0,
        overall_risk_level: calculateOverallRiskLevel(),
        resource_requirements: resourceRequirements,
        milestones: milestones.map(m => ({
          milestone_id: m.milestone_id,
          cpp: '',
          milestone_name: m.milestone_name,
          sequence_number: m.sequence_number,
          planned_date: m.planned_date,
          actual_date: null,
          variance_days: null,
        })),
        risks: risks.map(r => ({
          risk_id: r.risk_id,
          cpp: '',
          risk_category: r.risk_category as any,
          risk_description: r.risk_description,
          likelihood: r.likelihood as any,
          impact: r.impact as any,
          mitigation_strategy: r.mitigation_strategy,
          created_at: r.created_at,
        })),
        status: 'draft',
      };

      const updated = await procurementPlanningApi.contractPlans.update(id, cppData);
      const cppId = updated.cpp_id || id;

      const newDocs = cppDocs.filter(doc => doc.file && !doc.isExisting);
      if (newDocs.length > 0) {
        setUploadingDocs(true);
        let uploaded = 0;
        for (const doc of newDocs) {
          try {
            await procurementPlanningApi.contractPlans.documents.upload(cppId, doc.file!, doc.documentType, doc.description);
            uploaded++;
          } catch { /* skip failed uploads */ }
        }
        setUploadingDocs(false);
        if (uploaded > 0) toast.success(`${uploaded} document(s) uploaded`);
      }

      const updatedMethod = updated.method || (methodOverride ? (newMethodOverride as ProcurementMethod) : recommendedMethod);
      if (updated.status === 'approved' && ['open_tender', 'international'].includes((updatedMethod || '') as string)) {
        toast.success('CPP approved — procurement may commence');
      } else {
        toast.success('CPP updated successfully');
      }
      navigate(`/procurement-planning/cpp/${cppId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update CPP');
    }
    setLoading(false);
  };

  const nextStep = () => {
    if (currentStep === 0 && !selectedRequisition) {
      toast.error('Select a requisition to proceed');
      return;
    }
    if (currentStep === 1 && (!recommendedMethod && !methodOverride)) {
      toast.error('Determine procurement method first');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, CPPSteps.length - 1));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {CPPSteps.map((step, i) => (
        <div key={step.id} className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            i <= currentStep ? 'bg-zammsa-green text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {i + 1}
          </div>
          <span className={`text-xs mt-1 ${i <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );

  const selectedRequisitionData = useMemo(() => requisitions.find(r => r.requisition_id === selectedRequisition), [requisitions, selectedRequisition]);
  const selectedReq = selectedRequisitionData;

  if (loadingData) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-600">
          Loading CPP...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Contract Procurement Plan</h1>
          <p className="text-sm text-gray-500">Step {currentStep + 1} of {CPPSteps.length}</p>
        </div>
        <button onClick={() => navigate('/procurement-planning/cpp')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to List</button>
      </div>

      {renderStepIndicator()}

      {/* Step 1: Review Source Requisition */}
      {currentStep === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h2 className="font-semibold text-gray-900">Select Requisition</h2>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Requisition Reference</label>
              <select
                value={selectedRequisition}
                onChange={(e) => {
                  setSelectedRequisition(e.target.value);
                  const req = requisitions.find(r => r.requisition_id === e.target.value);
                  if (req) {
                    const estimatedValue = req.estimated_total;
                    const recommended = estimatedValue > 1000000 ? 'open_tender' : estimatedValue > 20000 ? 'simplified' : 'direct';
                    setRecommendedMethod(recommended);
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Select Requisition --</option>
                {requisitions.map(r => (
                  <option key={r.requisition_id} value={r.requisition_id}>
                    {r.req_number} — {r.title || r.description} (K{r.estimated_total.toLocaleString()})
                  </option>
                ))}
              </select>
              {selectedRequisitionData && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500 block">Requisition #</span>{selectedRequisitionData.req_number}</div>
                    <div><span className="text-gray-500 block">Title</span>{selectedRequisitionData.title || selectedRequisitionData.description}</div>
                    <div><span className="text-gray-500 block">Est. Value</span>K{selectedRequisitionData.estimated_total.toLocaleString()}</div>
                    <div><span className="text-gray-500 block">Status</span>{selectedRequisitionData.status}</div>
                  </div>

                  {/* Requisition Items */}
                  {selectedReq?.items && selectedReq.items.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Requisition Line Items</h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-1 text-xs text-gray-400 font-medium">Code</th>
                            <th className="text-left py-1 text-xs text-gray-400 font-medium">Description</th>
                            <th className="text-right py-1 text-xs text-gray-400 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReq.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-2 text-xs font-mono font-bold text-gray-600">{item.item_code || `#${idx + 1}`}</td>
                              <td className="py-2 text-sm font-bold text-gray-800">{item.description}</td>
                              <td className="py-2 text-right text-sm font-black text-gray-900">{item.estimated_total_cost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Specifications */}
                  {selectedReq?.specifications && selectedReq.specifications.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <DocumentTextIcon className="w-4 h-4" />
                      <span className="font-bold">Specifications:</span>
                      {selectedReq.specifications.map((s, idx) => (
                        <span key={idx} className="text-zammsa-green font-bold">{s.filename}{idx < selectedReq.specifications!.length - 1 ? ' | ' : ''}</span>
                      ))}
                    </div>
                  )}

                  {/* Requisition item attachments */}
                  {selectedReq?.items?.some((item: any) => item.attachment_url) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <PaperClipIcon className="w-4 h-4" />
                      <span className="font-bold">Attachments:</span>
                      {selectedReq.items.filter((item: any) => item.attachment_url).map((item: any, idx: number) => (
                        <a key={idx} href={item.attachment_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-zammsa-green/5 text-zammsa-green rounded-lg text-xs font-bold hover:bg-zammsa-green/10 transition-colors">
                          <PaperClipIcon className="w-3 h-3" />
                          {item.description?.slice(0, 30) || `Attachment ${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Method Selection */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h2 className="font-semibold text-gray-900">Procurement Method Selection</h2>
          {recommendedMethod && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900">System Recommendation</h3>
              <div className="mt-2 space-y-1">
                <p><strong>Recommended Method:</strong> {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.label}</p>
                <p><strong>Minimum Solicitation Period:</strong> {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.minPeriod} days</p>
                <p><strong>Threshold Logic:</strong> {selectedRequisitionData?.estimated_total && selectedRequisitionData.estimated_total > 1000000 ? `K${selectedRequisitionData.estimated_total.toLocaleString()} > K1,000,000` : `K${(selectedRequisitionData?.estimated_total || 0).toLocaleString()} \u2264 K1,000,000`}</p>
                <p><strong>ZPC Approval:</strong> {METHOD_OPTIONS.find(m => m.value === recommendedMethod)?.zpcRequired ? 'Required (non-open method)' : 'Not required (open method)'}</p>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={methodOverride}
              onChange={(e) => setMethodOverride(e.target.checked)}
              className="rounded text-zammsa-green focus:ring-zammsa-green"
            />
            <span>Override recommendation (requires Director of Procurement approval)</span>
          </label>

          {methodOverride && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <select
                value={newMethodOverride}
                onChange={(e) => setNewMethodOverride(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
              >
                <option value="">-- Select Method --</option>
                {METHOD_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Justification for override..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24"
              />
            </div>
          )}

        </div>
      )}

      {/* Step 3: Milestones */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Milestone Schedule</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newMilestone.name}
              onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
              placeholder="Milestone name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={newMilestone.date}
              onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addMilestone} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">Add</button>
          </div>
          {milestones.length > 0 && (
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={m.milestone_id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div>
                    <input
                      type="text"
                      value={m.milestone_name}
                      onChange={(e) => updateMilestone(i, 'milestone_name', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={m.planned_date}
                      onChange={(e) => updateMilestone(i, 'planned_date', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeMilestone(i)} className="text-red-600 hover:text-red-800">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Resources */}
      {currentStep === 3 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h2 className="font-semibold text-gray-900">Resource Requirements</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Evaluation Committee Size (min 3)</label>
              <input
                type="number"
                min={3}
                value={resourceRequirements.evaluationCommitteeSize}
                onChange={(e) => setResourceRequirements({ ...resourceRequirements, evaluationCommitteeSize: parseInt(e.target.value) || 3 })}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Expertise (tick all that apply)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {EXPERTISE_OPTIONS.map(exp => (
                  <label key={exp.key} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={resourceRequirements.requiredExpertise.includes(exp.key)}
                      onChange={() => {
                        setResourceRequirements(prev => ({
                          ...prev,
                          requiredExpertise: prev.requiredExpertise.includes(exp.key)
                            ? prev.requiredExpertise.filter(e => e !== exp.key)
                            : [...prev.requiredExpertise, exp.key],
                        }));
                      }}
                      className="mt-0.5 rounded text-zammsa-green focus:ring-zammsa-green"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">{exp.label}</span>
                      {exp.mandatory && <span className="text-[10px] font-bold text-zammsa-green ml-1 uppercase">(mandatory)</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resourceRequirements.prebidConferenceRequired}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, prebidConferenceRequired: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>Pre-bid Conference Required</span>
              </div>
              {resourceRequirements.prebidConferenceRequired && (
                <div className="flex items-center gap-3 ml-6">
                  <label className="text-xs font-bold text-gray-500">Planned date:</label>
                  <input
                    type="date"
                    value={resourceRequirements.prebidConferenceDate}
                    onChange={(e) => setResourceRequirements({ ...resourceRequirements, prebidConferenceDate: e.target.value })}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resourceRequirements.siteVisitRequired}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, siteVisitRequired: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>Site Visit Required</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resourceRequirements.externalExpertRequired}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, externalExpertRequired: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>External Technical Expert Required</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resourceRequirements.specialInspectionRequired}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, specialInspectionRequired: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>Special Inspection Required (e.g., ZAMRA verification)</span>
              </div>
              {resourceRequirements.specialInspectionRequired && (
                <div className="ml-6">
                  <textarea
                    value={resourceRequirements.specialInspectionDetails}
                    onChange={(e) => setResourceRequirements({ ...resourceRequirements, specialInspectionDetails: e.target.value })}
                    placeholder="Describe special inspection requirements..."
                    rows={2}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/10"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resourceRequirements.specialDeliveryRequirements}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, specialDeliveryRequirements: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>Special Delivery Requirements (e.g., Cold Chain 2-8°C)</span>
              </div>
            </div>
          </div>

          {/* Solicitation Strategy Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h2 className="font-semibold text-gray-900">Solicitation Strategy Settings</h2>
            <p className="text-xs text-gray-500 -mt-4">These will pre-populate the solicitation when it is created from this CPP</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Submission Format</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-3 rounded-lg cursor-pointer border-2 text-center ${resourceRequirements.submissionFormat === 'single' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="edit_submissionFormat" checked={resourceRequirements.submissionFormat === 'single'} onChange={() => setResourceRequirements({ ...resourceRequirements, submissionFormat: 'single' })} className="sr-only" />
                    <span className="text-sm font-medium">Single Envelope</span>
                  </label>
                  <label className={`flex-1 p-3 rounded-lg cursor-pointer border-2 text-center ${resourceRequirements.submissionFormat === 'two' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="edit_submissionFormat" checked={resourceRequirements.submissionFormat === 'two'} onChange={() => setResourceRequirements({ ...resourceRequirements, submissionFormat: 'two' })} className="sr-only" />
                    <span className="text-sm font-medium">Two Envelope</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Citizen Preference Scheme</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-3 rounded-lg cursor-pointer border-2 text-center ${resourceRequirements.citizenPreference ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="edit_citizenPref" checked={resourceRequirements.citizenPreference} onChange={() => setResourceRequirements({ ...resourceRequirements, citizenPreference: true })} className="sr-only" />
                    <span className="text-sm font-medium">Yes</span>
                  </label>
                  <label className={`flex-1 p-3 rounded-lg cursor-pointer border-2 text-center ${!resourceRequirements.citizenPreference ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="edit_citizenPref" checked={!resourceRequirements.citizenPreference} onChange={() => setResourceRequirements({ ...resourceRequirements, citizenPreference: false })} className="sr-only" />
                    <span className="text-sm font-medium">No</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Bid Validity (Days)</label>
                <input type="number" value={resourceRequirements.bidValidityDays} onChange={(e) => setResourceRequirements({ ...resourceRequirements, bidValidityDays: parseInt(e.target.value) || 90 })} min={30} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Min. Technical Threshold (points)</label>
                <input type="number" value={resourceRequirements.minimumTechnicalThreshold} onChange={(e) => setResourceRequirements({ ...resourceRequirements, minimumTechnicalThreshold: parseInt(e.target.value) || 70 })} min={0} max={100} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Bid Security Type</label>
                <select value={resourceRequirements.bidSecurityType} onChange={(e) => setResourceRequirements({ ...resourceRequirements, bidSecurityType: e.target.value as 'bank_guarantee' | 'surety_bond' | 'cash' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="bank_guarantee">Bank Guarantee (preferred)</option>
                  <option value="surety_bond">Surety Bond</option>
                  <option value="cash">Cash Deposit</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Bid Security Rate (% of bid value)</label>
                <input type="number" value={resourceRequirements.bidSecurityRate} onChange={(e) => setResourceRequirements({ ...resourceRequirements, bidSecurityRate: parseFloat(e.target.value) || 2 })} min={1} max={5} step={0.5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Supporting Documents */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <UploadIcon className="w-4 h-4" />
              Supporting Documents
            </h2>
            <p className="text-xs text-gray-400">Strategy papers, market research, price quotes, specifications, etc.</p>

            <div className="space-y-3">
              {cppDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <PaperClipIcon className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{doc.filename || doc.file?.name}</p>
                    <p className="text-xs text-gray-400">{DOC_TYPES.find(t => t.value === doc.documentType)?.label || doc.documentType}{doc.isExisting ? ' (Existing)' : ''}</p>
                  </div>
                  {doc.isExisting && doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zammsa-green bg-zammsa-green/5 rounded-lg hover:bg-zammsa-green/10 transition-colors">
                      <DownloadIcon className="w-3.5 h-3.5" />
                      Download
                    </a>
                  )}
                  <button 
                    onClick={() => handleDeleteDocument(doc, idx)}
                    disabled={deletingDocId === (doc.documentId || idx.toString())}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
                  <select
                    id="cpp-edit-doc-type"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select type --</option>
                    {DOC_TYPES.map(t => {
                      const isDuplicate = cppDocs.some(d => d.documentType === t.value);
                      return (
                        <option 
                          key={t.value} 
                          value={t.value} 
                          disabled={isDuplicate}
                          className={isDuplicate ? 'text-gray-300' : ''}
                        >
                          {t.label}{isDuplicate ? ' (Already added)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    id="cpp-edit-doc-desc"
                    type="text"
                    placeholder="Brief description..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-green-50 border-2 border-dashed border-green-300 rounded-lg cursor-pointer hover:bg-green-100 transition-all">
                    <UploadIcon className="w-5 h-5 text-zammsa-green" />
                    <span className="text-sm font-bold text-zammsa-green">Choose File</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const docType = (document.getElementById('cpp-edit-doc-type') as HTMLSelectElement)?.value || 'other';
                        const desc = (document.getElementById('cpp-edit-doc-desc') as HTMLInputElement)?.value || '';
                        if (docType === '') { toast.error('Select document type'); return; }
                        if (cppDocs.some(d => d.documentType === docType)) {
                          toast.error('This document type already exists');
                          return;
                        }
                        setCppDocs(prev => [...prev, { file, documentType: docType, description: desc, isExisting: false }]);
                        (document.getElementById('cpp-edit-doc-type') as HTMLSelectElement).value = '';
                        (document.getElementById('cpp-edit-doc-desc') as HTMLInputElement).value = '';
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            {uploadingDocs && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm font-bold text-blue-700 flex items-center gap-2">
                <UploadIcon className="w-4 h-4 animate-pulse" />
                Uploading documents...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Risk Assessment */}
      {currentStep === 4 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Risk Assessment</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={newRisk.category}
              onChange={(e) => setNewRisk({ ...newRisk, category: e.target.value as CPPRisk['risk_category'] })}
              className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="supply">Supply Risk</option>
              <option value="price">Price Risk</option>
              <option value="quality">Quality Risk</option>
              <option value="delivery">Delivery Risk</option>
              <option value="regulatory">Regulatory Risk</option>
              <option value="capacity">Capacity Risk</option>
            </select>
            <input
              type="text"
              value={newRisk.description}
              onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
              placeholder="Risk description"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newRisk.likelihood}
              onChange={(e) => setNewRisk({ ...newRisk, likelihood: e.target.value as CPPRisk['likelihood'] })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
            >
              <option value="low">Low Likelihood</option>
              <option value="medium">Medium Likelihood</option>
              <option value="high">High Likelihood</option>
            </select>
            <select
              value={newRisk.impact}
              onChange={(e) => setNewRisk({ ...newRisk, impact: e.target.value as CPPRisk['impact'] })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
            >
              <option value="low">Low Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="high">High Impact</option>
              <option value="critical">Critical Impact</option>
            </select>
            <input
              type="text"
              value={newRisk.mitigation}
              onChange={(e) => setNewRisk({ ...newRisk, mitigation: e.target.value })}
              placeholder="Mitigation strategy"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addRisk} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">Add</button>
          </div>
          {risks.length > 0 && (
            <div className="space-y-2">
              {risks.map((r, i) => (
                <div key={r.risk_id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div>
                    <span className="font-medium">{r.risk_description}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      r.impact === 'critical' ? 'bg-red-100 text-red-800' :
                      r.impact === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {r.impact} Impact
                    </span>
                    <span className="ml-2 text-gray-500 text-xs">{r.likelihood} Likely</span>
                    {r.mitigation_strategy && <span className="ml-2 text-gray-600 text-xs">— {r.mitigation_strategy}</span>}
                  </div>
                  <button onClick={() => removeRisk(i)} className="text-red-600 hover:text-red-800">&times;</button>
                </div>
              ))}
            </div>
          )}
          {risks.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Overall Risk Level:</span>
              <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${
                calculateOverallRiskLevel() === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {calculateOverallRiskLevel().toUpperCase()} RISK
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 6: Review & Submit */}
      {currentStep === 5 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h2 className="font-semibold text-gray-900">Review and Submit</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900">Summary</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500 block">Requisition #</span>{selectedRequisitionData?.req_number}</div>
                <div><span className="text-gray-500 block">Description</span>{selectedRequisitionData?.description}</div>
                <div><span className="text-gray-500 block">Method</span>{METHOD_OPTIONS.find(m => m.value === (methodOverride ? (newMethodOverride as string) : recommendedMethod))?.label}</div>
                <div><span className="text-gray-500 block">ZPC Approval</span>{METHOD_OPTIONS.find(m => m.value === (methodOverride ? newMethodOverride : recommendedMethod))?.zpcRequired ? 'Required' : 'Not Required'}</div>
                <div><span className="text-gray-500 block">Milestones</span>{milestones.length}</div>
                <div><span className="text-gray-500 block">Risks</span>{risks.length}</div>
                <div><span className="text-gray-500 block">Est. Value</span>{selectedRequisitionData?.estimated_total.toLocaleString()}</div>
                <div><span className="text-gray-500 block">Committee</span>{resourceRequirements.evaluationCommitteeSize} members, {resourceRequirements.requiredExpertise.length} expertise areas</div>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 text-sm">Validation Checklist</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" /> Requirement: Requisition selected
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" /> Requirement: Procurement method determined
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" /> Requirement: At least one milestone defined
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" /> Requirement: Resource requirements specified
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" /> Requirement: At least one risk identified
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 pb-8">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={`px-6 py-2 border rounded-lg text-sm font-medium ${
            currentStep === 0 ? 'border-gray-300 text-gray-400 cursor-not-allowed' : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span className="inline-flex items-center gap-1"><ChevronLeftIcon className="w-4 h-4" /> Previous</span>
        </button>
        <div className="flex gap-3">
          {currentStep === CPPSteps.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-medium hover:bg-zammsa-green-dark disabled:opacity-50"
            >
              {loading ? 'Saving CPP...' : 'Save Changes'}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-medium hover:bg-zammsa-green-dark"
            >
              <span className="inline-flex items-center gap-1">Next <ChevronRightIcon className="w-4 h-4" /></span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CPPEdit;
