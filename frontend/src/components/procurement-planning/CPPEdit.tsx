import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { requisitionsApi } from '../../api/requisitions';
import { ContractProcurementPlan, ProcurementMilestone, CPPRisk } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface RequisitionOption {
  requisition_id: string;
  req_number: string;
  description: string;
  estimated_total: number;
  status: string;
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
  prebidConferenceRequired: boolean;
  siteVisitRequired: boolean;
  specialInspectionRequired: boolean;
  specialDeliveryRequirements: boolean;
}

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
  const [zpcJustification, setZpcJustification] = useState('');
  const [milestones, setMilestones] = useState<ProcurementMilestone[]>([]);
  const [newMilestone, setNewMilestone] = useState({ name: '', date: '' });
  const [resourceRequirements, setResourceRequirements] = useState<ResourceRequirements>({
    evaluationCommitteeSize: 3,
    prebidConferenceRequired: false,
    siteVisitRequired: false,
    specialInspectionRequired: false,
    specialDeliveryRequirements: false,
  });
  const [risks, setRisks] = useState<CPPRisk[]>([]);
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
        description: r.description || '',
        estimated_total: Number(r.estimated_total) || 0,
        status: r.status || '',
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
          prebidConferenceRequired: Boolean(rr.prebidConferenceRequired),
          siteVisitRequired: Boolean(rr.siteVisitRequired),
          specialInspectionRequired: Boolean(rr.specialInspectionRequired),
          specialDeliveryRequirements: Boolean(rr.specialDeliveryRequirements),
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.error || 'Failed to load CPP');
        navigate('/procurement-planning/cpp');
      } finally {
        setLoadingData(false);
      }
    };
    loadCPP();
  }, [id, navigate]);

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
    
    setLoading(true);
    try {
      const cppData: Partial<ContractProcurementPlan> = {
        requisition: selectedRequisition,
        method: methodOverride ? (newMethodOverride as any) : recommendedMethod,
        recommended_method: recommendedMethod || undefined,
        method_override: methodOverride,
        override_reason: methodOverride ? overrideReason : '',
        zpc_approval_required: METHOD_OPTIONS.find(m => m.value === (methodOverride ? newMethodOverride : recommendedMethod))?.zpcRequired || false,
        zpc_justification: zpcJustification,
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
      const updatedMethod = updated.method || (methodOverride ? (newMethodOverride as ProcurementMethod) : recommendedMethod);
      if (updated.status === 'approved' && ['open_tender', 'international'].includes((updatedMethod || '') as string)) {
        toast.success('CPP approved — procurement may commence');
      } else {
        toast.success('CPP updated successfully');
      }
      navigate(`/procurement-planning/cpp/${updated.cpp_id || id}`);
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

  const selectedRequisitionData = requisitions.find(r => r.requisition_id === selectedRequisition);

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
                    {r.req_number} — {r.description} (K{r.estimated_total.toLocaleString()})
                  </option>
                ))}
              </select>
              {selectedRequisitionData && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500 block">Requisition #</span>{selectedRequisitionData.req_number}</div>
                    <div><span className="text-gray-500 block">Description</span>{selectedRequisitionData.description}</div>
                    <div><span className="text-gray-500 block">Est. Value</span>K{selectedRequisitionData.estimated_total.toLocaleString()}</div>
                    <div><span className="text-gray-500 block">Status</span>{selectedRequisitionData.status}</div>
                  </div>
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

          {(() => {
            const finalMethod = methodOverride ? newMethodOverride : recommendedMethod;
            return finalMethod && METHOD_OPTIONS.find(m => m.value === finalMethod)?.zpcRequired ? (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">ZPC Justification (required for non-open method)</label>
                <textarea
                  value={zpcJustification}
                  onChange={(e) => setZpcJustification(e.target.value)}
                  placeholder="Provide justification for non-open procurement method..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24"
                />
              </div>
            ) : null;
          })()}
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
                  checked={resourceRequirements.specialInspectionRequired}
                  onChange={(e) => setResourceRequirements({ ...resourceRequirements, specialInspectionRequired: e.target.checked })}
                  className="rounded text-zammsa-green"
                />
                <span>Special Inspection Required (e.g., ZAMRA verification)</span>
              </div>
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
              </div>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 text-sm">Validation Checklist</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Requirement: Requisition selected
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Requirement: Procurement method determined
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Requirement: At least one milestone defined
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Requirement: Resource requirements specified
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Requirement: At least one risk identified
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
          ← Previous
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
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CPPEdit;
