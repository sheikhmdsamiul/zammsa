import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi, masterDataApi, MasterDepartment } from '../../api/procurement_planning';
import { fetchFiscalYears } from '../../api/admin';
import { budgetApi } from '../../api/procurement_planning';
import { APPLineItem, FundingSourceOption, CommodityOption, FiscalYear } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  DocumentTextIcon, CurrencyDollarIcon, CubeIcon, TrashIcon,
  CheckCircleIcon, XCircleIcon, LockClosedIcon, PaperAirplaneIcon,
  CheckIcon, ChevronRightIcon, ChevronLeftIcon,
} from '@heroicons/react/outline';

const STEPS = [
  { id: 'details', label: 'Plan Details' },
  { id: 'items', label: 'Line Items' },
  { id: 'review', label: 'Review' },
  { id: 'submit', label: 'Submit' },
] as const;

const PROCUREMENT_TYPES = [
  { value: 'goods', label: 'Goods' },
  { value: 'works', label: 'Works' },
  { value: 'services', label: 'Services' },
] as const;

const RECOMMENDED_METHOD_LABELS: Record<string, string> = {
  open_tender: 'Open National Bidding (ONB)',
  international: 'International Bidding (INT)',
  limited: 'Limited Bidding (LIM)',
  simplified: 'Simplified Bidding (SIM)',
  direct: 'Direct Procurement',
};

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

function getMethodRationale(value: number): string {
  if (value > 1000000) return 'Open National Bidding (Policy §21.2)';
  if (value > 20000) return 'Simplified Bidding (Policy §21.2)';
  return 'Direct Procurement permitted (Policy §21.2)';
}

function getMethodFromValue(value: number): string {
  if (value > 1000000) return 'open_tender';
  if (value > 20000) return 'simplified';
  return 'direct';
}

const APPCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fundingSources, setFundingSources] = useState<FundingSourceOption[]>([]);
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [form, setForm] = useState({
    fiscal_year_id: '',
    department_id: '',
    compliance_notes: '',
    is_consolidated: false,
    consolidated_departments: [] as string[],
    consolidation_notes: '',
  });

  const [items, setItems] = useState<Partial<APPLineItem>[]>([
    {
      description: '',
      procurement_type: 'goods',
      estimated_value: 0,
      planned_issue_date: '',
      planned_award_date: '',
      funding_source: '',
      commodity: '',
      is_citizen_reserved: true,
      recommended_method: '',
    },
  ]);

  const [budgetOverview, setBudgetOverview] = useState<{
    total_allocated: number;
    available: number;
    loading: boolean;
  }>({ total_allocated: 0, available: 0, loading: false });

  const [submissionNotes, setSubmissionNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    Promise.all([
      masterDataApi.departments({ is_active: true, page_size: 200 }),
      fetchFiscalYears(),
      masterDataApi.fundingSources({ is_active: true, page_size: 200 }),
      masterDataApi.commodities({ is_active: true, page_size: 500 }),
    ])
      .then(([deptRes, fys, fsRes, commRes]) => {
        setDepartments(deptRes.results);
        setFiscalYears(fys);
        setFundingSources(fsRes.results);
        setCommodities(commRes.results);
        const current = fys.find((fy: FiscalYear) => fy.is_current);
        if (current) setForm((prev) => ({ ...prev, fiscal_year_id: current.id }));
      })
      .catch(() => toast.error('Failed to load master data'))
      .finally(() => setLoadingMeta(false));
  }, []);

  const fetchBudget = useCallback(() => {
    if (!form.department_id || !form.fiscal_year_id) return;
    const dept = departments.find((d) => d.dept_id === form.department_id);
    if (!dept) return;
    setBudgetOverview((prev) => ({ ...prev, loading: true }));
    const fy = fiscalYears.find((fy) => fy.id === form.fiscal_year_id);
    budgetApi.summary({ entity_code: dept.dept_code, fiscal_year: fy ? fy.name : '' })
      .then((res) => {
        setBudgetOverview({ total_allocated: res.total_allocated, available: res.total_available, loading: false });
      })
      .catch(() => {
        setBudgetOverview({ total_allocated: 0, available: 0, loading: false });
      });
  }, [form.department_id, form.fiscal_year_id, departments, fiscalYears]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  useEffect(() => {
    const handleFocus = () => { fetchBudget(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchBudget]);

  const planTotal = items.reduce((s, i) => s + Number(i.estimated_value || 0), 0);
  const remainingBudget = budgetOverview.available - planTotal;
  const budgetOk = remainingBudget >= 0;

  const selFY = fiscalYears.find((fy) => fy.id === form.fiscal_year_id);
  const planRef = form.department_id
    ? `APP-${(selFY?.name || 'XXXX').replace(/\s*\/\s*/g, '-').replace(/\s+/g, '')}-${departments.find((d) => d.dept_id === form.department_id)?.dept_code || 'XXX'}-001`
    : 'APP-XXXX-XXX-001';

  function updateItem(index: number, field: string, value: any) {
    const updated = [...items];
    if (field === 'estimated_value') {
      const num = parseFloat(value);
      (updated[index] as any).estimated_value = isNaN(num) ? 0 : num;
      if (num > 0) {
        updated[index].recommended_method = getMethodFromValue(num);
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setItems(updated);
  }

  function addItem() {
    setItems([
      ...items,
      {
        description: '',
        procurement_type: 'goods',
        estimated_value: 0,
        planned_issue_date: '',
        planned_award_date: '',
        funding_source: '',
        commodity: '',
        is_citizen_reserved: true,
        recommended_method: '',
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  }

  function validateStep1(): boolean {
    if (!form.fiscal_year_id) { toast.error('Fiscal year is required'); return false; }
    if (!form.department_id) { toast.error('Department is required'); return false; }
    return true;
  }

  function validateStep2(): boolean {
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description?.trim()) {
        toast.error(`Item ${i + 1}: description is required`);
        return false;
      }
      if (!items[i].estimated_value || Number(items[i].estimated_value) <= 0) {
        toast.error(`Item ${i + 1}: estimated value is required`);
        return false;
      }
      if (!items[i].planned_issue_date) {
        toast.error(`Item ${i + 1}: planned issue date is required`);
        return false;
      }
      if (!items[i].planned_award_date) {
        toast.error(`Item ${i + 1}: planned award date is required`);
        return false;
      }
      const issueDate = items[i].planned_issue_date;
      const awardDate = items[i].planned_award_date;
      if (issueDate && awardDate && new Date(awardDate) <= new Date(issueDate)) {
        toast.error(`Item ${i + 1}: award date must be after issue date`);
        return false;
      }
    }
    if (!budgetOk) {
      toast.error('Total exceeds available budget');
      return false;
    }
    return true;
  }

  async function handleSaveDraft() {
    if (!validateStep1()) return;
    setSavingDraft(true);
    try {
      if (createdAppId) {
        const app = await procurementPlanningApi.update(createdAppId, {
          fiscal_year: form.fiscal_year_id,
          department: form.department_id,
          compliance_notes: form.compliance_notes || undefined,
          is_consolidated: form.is_consolidated,
          consolidation_notes: form.is_consolidated ? form.consolidation_notes : undefined,
        });
        if (items.some((i) => i.description?.trim())) {
          await procurementPlanningApi.bulkCreateLineItems(createdAppId, items.filter((i) => i.description?.trim()));
        }
        toast.success('Draft saved');
        navigate(`/procurement-planning/${createdAppId}`);
      } else {
        const app = await procurementPlanningApi.create({
          fiscal_year: form.fiscal_year_id,
          department: form.department_id,
          compliance_notes: form.compliance_notes || undefined,
          is_consolidated: form.is_consolidated,
          consolidation_notes: form.is_consolidated ? form.consolidation_notes : undefined,
        });
        const newId = app.app_id;
        setCreatedAppId(newId);
        if (items.some((i) => i.description?.trim())) {
          await procurementPlanningApi.bulkCreateLineItems(newId, items.filter((i) => i.description?.trim()));
        }
        toast.success('Draft saved');
        navigate(`/procurement-planning/${newId}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save draft');
    }
    setSavingDraft(false);
  }

  async function handleNext() {
    if (step === 0) {
      if (!validateStep1()) return;
      if (!createdAppId) {
        try {
          const app = await procurementPlanningApi.create({
            fiscal_year: form.fiscal_year_id,
            department: form.department_id,
            compliance_notes: form.compliance_notes || undefined,
            is_consolidated: form.is_consolidated,
            consolidation_notes: form.is_consolidated ? form.consolidation_notes : undefined,
          });
          setCreatedAppId(app.app_id);
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to create APP');
          return;
        }
      } else {
        try {
          await procurementPlanningApi.update(createdAppId, {
            fiscal_year: form.fiscal_year_id,
            department: form.department_id,
            compliance_notes: form.compliance_notes || undefined,
            is_consolidated: form.is_consolidated,
            consolidation_notes: form.is_consolidated ? form.consolidation_notes : undefined,
          });
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to update APP');
          return;
        }
      }
      setStep(1);
    } else if (step === 1) {
      if (!validateStep2()) return;
      if (createdAppId && items.some((i) => i.description?.trim())) {
        try {
          await procurementPlanningApi.bulkCreateLineItems(createdAppId, items.filter((i) => i.description?.trim()));
          setItems(items.map((i) => ({ ...i, description: i.description || '' })));
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to save line items');
          return;
        }
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    if (!confirmed) { toast.error('Please confirm the plan before submitting'); return; }
    setSubmitting(true);
    try {
      if (!createdAppId) throw new Error('No APP created');
      await procurementPlanningApi.submit(createdAppId);
      toast.success('APP submitted for approval');
      navigate(`/procurement-planning/${createdAppId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit APP');
    }
    setSubmitting(false);
  }

  if (loadingMeta) return <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Annual Procurement Plan</h1>
          <p className="text-sm text-gray-500">Fiscal Year {fiscalYears.find((fy) => fy.id === form.fiscal_year_id)?.name || ''}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">?</span>
          <span>A. Mwanza</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200">
          <div
            className="h-full bg-zammsa-green transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="relative flex justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  i <= step
                    ? 'bg-zammsa-green text-white border-zammsa-green'
                    : 'bg-white text-gray-400 border-gray-300'
                }`}
              >
                {i + 1}
              </div>
              <span className={`mt-2 text-xs font-medium ${i <= step ? 'text-zammsa-green' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < step && (
                <CheckIcon className="w-3 h-3 text-gray-400 -mt-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-600" /> Basic Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year *</label>
              <select
                value={form.fiscal_year_id}
                onChange={(e) => setForm({ ...form, fiscal_year_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Select fiscal year...</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.name}{fy.is_current ? ' (Current)' : ''}{fy.is_closed ? ' (Closed)' : ''}
                  </option>
                ))}
              </select>
              {form.fiscal_year_id && (() => {
                const sel = fiscalYears.find((fy) => fy.id === form.fiscal_year_id);
                return sel ? (
                  <p className="text-xs text-gray-400 mt-1">
                    Budget period: {formatDate(sel.start_date)} — {formatDate(sel.end_date)}
                  </p>
                ) : null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Auto-filled from your profile. Contact Admin to change.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Reference</label>
              <input
                value={planRef}
                readOnly
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-generated, read-only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Notes</label>
              <textarea
                value={form.compliance_notes}
                onChange={(e) => setForm({ ...form, compliance_notes: e.target.value })}
                rows={3}
                placeholder="Optional — any regulatory or compliance notes for this APP"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Optional</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Is this a consolidated plan?</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="is_consolidated"
                    checked={!form.is_consolidated}
                    onChange={() => setForm({ ...form, is_consolidated: false })}
                    className="accent-zammsa-green"
                  />
                  No — this is a standalone departmental plan
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="is_consolidated"
                    checked={form.is_consolidated}
                    onChange={() => setForm({ ...form, is_consolidated: true })}
                    className="accent-zammsa-green"
                  />
                  Yes — this consolidates multiple departmental submissions
                </label>
              </div>
              {form.is_consolidated && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Consolidated from:</label>
                    <select
                      multiple
                      value={form.consolidated_departments}
                      onChange={(e) => setForm({ ...form, consolidated_departments: Array.from(e.target.selectedOptions, (o) => o.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      {departments.filter((d) => d.dept_id !== form.department_id).map((d) => (
                        <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Consolidation notes:</label>
                    <textarea
                      value={form.consolidation_notes}
                      onChange={(e) => setForm({ ...form, consolidation_notes: e.target.value })}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-gray-600" /> Budget Overview
              {form.department_id && form.fiscal_year_id && (
                <button onClick={fetchBudget} disabled={budgetOverview.loading} className="ml-auto text-xs text-blue-600 hover:underline disabled:opacity-50">
                  {budgetOverview.loading ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
            </h2>
            {budgetOverview.loading ? (
              <div className="py-4 flex justify-center"><LoadingSpinner size="sm" /></div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Total Budget Allocated:</span>
                  <span className="font-medium">K {budgetOverview.total_allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Already Committed (other APPs):</span>
                  <span className="font-medium">K 0.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Available for This Plan:</span>
                  <span className="font-medium text-green-600">K {budgetOverview.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-2 flex justify-between py-1">
                  <span className="text-gray-600">This Plan Total (so far):</span>
                  <span className="font-medium">K {planTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Remaining Available:</span>
                  <span className={`font-medium ${budgetOk ? 'text-green-600' : 'text-red-600'}`}>
                    K {remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    {budgetOk ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 ml-1" /> : <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 ml-1" />}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Budget figures sync with ERP.</p>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => navigate('/procurement-planning')}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                {savingDraft && <LoadingSpinner size="sm" />}
                Save Draft
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CubeIcon className="w-5 h-5 text-gray-600" /> Procurement Line Items
              </h2>
              <button
                onClick={addItem}
                className="px-3 py-1.5 text-sm border border-zammsa-green text-zammsa-green rounded-lg hover:bg-green-50"
              >
                + Add Item
              </button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item Description *</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Describe the procurement need"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Procurement Type *</label>
                    <select
                      value={item.procurement_type || 'goods'}
                      onChange={(e) => updateItem(i, 'procurement_type', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      {PROCUREMENT_TYPES.map((pt) => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Commodity Category *</label>
                    <select
                      value={item.commodity || ''}
                      onChange={(e) => updateItem(i, 'commodity', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Select category...</option>
                      {commodities.map((c) => (
                        <option key={c.commodity_id} value={c.commodity_id}>
                          {c.category ? `${c.category} - ` : ''}{c.commodity_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Value (ZMW) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.estimated_value || ''}
                      onChange={(e) => updateItem(i, 'estimated_value', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Funding Source *</label>
                    <select
                      value={item.funding_source || ''}
                      onChange={(e) => updateItem(i, 'funding_source', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Select funding source...</option>
                      {fundingSources.map((fs) => (
                        <option key={fs.source_id} value={fs.source_id}>
                          {fs.source_name} — {fs.source_code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Recommended Method (auto)</label>
                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 flex items-center gap-2">
                      <LockClosedIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {item.recommended_method
                        ? RECOMMENDED_METHOD_LABELS[item.recommended_method] || item.recommended_method
                        : 'Will auto-calculate'}
                    </div>
                    {Number(item.estimated_value || 0) > 0 && (
                      <p className="text-xs text-blue-600 mt-1">{getMethodRationale(Number(item.estimated_value || 0))}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Planned Issue Date *</label>
                      <input
                        type="date"
                        value={item.planned_issue_date || ''}
                        onChange={(e) => updateItem(i, 'planned_issue_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Planned Award Date *</label>
                      <input
                        type="date"
                        value={item.planned_award_date || ''}
                        onChange={(e) => updateItem(i, 'planned_award_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.is_citizen_reserved !== false}
                      onChange={(e) => updateItem(i, 'is_citizen_reserved', e.target.checked)}
                      className="accent-zammsa-green"
                    />
                    Citizen-reserved (preference for Zambian bidders)
                  </label>
                  {Number(item.estimated_value || 0) > 0 && Number(item.estimated_value || 0) < 3000000 && (
                    <span className="text-xs text-green-600">K{Number(item.estimated_value || 0).toLocaleString()} &lt; K3M limit</span>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addItem}
              className="w-full py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-zammsa-green hover:text-zammsa-green"
            >
              + Add Another Line Item
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Plan Totals</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Estimated Value:</span>
                <span className="font-medium">K {planTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dept Budget Available:</span>
                <span className="font-medium">K {budgetOverview.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-600">Remaining After Plan:</span>
                <span className={`font-medium ${budgetOk ? 'text-green-600' : 'text-red-600'}`}>
                  K {remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  {budgetOk ? ' Sufficient' : ' OVER BUDGET'}
                </span>
              </div>
            </div>
            {!budgetOk && (
              <p className="text-xs text-red-500 mt-2">Total exceeds budget — you will not be able to submit.</p>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              &larr; Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                {savingDraft && <LoadingSpinner size="sm" />}
                Save Draft
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" /> Validation Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> Fiscal year selected
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> Department confirmed: {departments.find((d) => d.dept_id === form.department_id)?.dept_name || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> {items.filter((i) => i.description?.trim()).length} line item(s) added
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> All items have descriptions, values, and dates
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> Award dates are after issue dates
              </div>
              <div className={`flex items-center gap-2 ${budgetOk ? 'text-green-700' : 'text-red-600'}`}>
                {budgetOk ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <XCircleIcon className="w-4 h-4 text-red-600" />}
                <span>Total K{planTotal.toLocaleString()} within budget K{budgetOverview.available.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span><CheckCircleIcon className="w-4 h-4 text-green-600" /></span> Methods recommended by system
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Plan Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Reference:</span> <span className="font-medium">{planRef}</span></div>
              <div><span className="text-gray-500">Department:</span> <span className="font-medium">{departments.find((d) => d.dept_id === form.department_id)?.dept_name || 'N/A'}</span></div>
              <div><span className="text-gray-500">Fiscal Year:</span> <span className="font-medium">{fiscalYears.find((fy) => fy.id === form.fiscal_year_id)?.name || 'N/A'}</span></div>
              <div><span className="text-gray-500">Total Value:</span> <span className="font-medium">K {planTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-gray-500">Line Items:</span> <span className="font-medium">{items.filter((i) => i.description?.trim()).length}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">Draft</span></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Description</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">Value K</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium">Method</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter((i) => i.description?.trim()).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-2">{item.description}</td>
                      <td className="text-right py-2 px-2">{Number(item.estimated_value || 0).toLocaleString()}</td>
                      <td className="text-center py-2 px-2">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {item.recommended_method
                            ? item.recommended_method === 'simplified' ? 'SIM'
                              : item.recommended_method === 'open_tender' ? 'ONB'
                              : item.recommended_method === 'direct' ? 'DIR'
                              : item.recommended_method === 'international' ? 'INT'
                              : item.recommended_method === 'limited' ? 'LIM'
                              : item.recommended_method.substring(0, 3).toUpperCase()
                            : '-'}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">{item.planned_issue_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">What happens after submission?</h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Department Head reviews and approves</li>
              <li>Procurement Officer reviews</li>
              <li>Director of Procurement approves</li>
              <li>ZPC reviews in committee meeting</li>
              <li>Upon ZPC approval, GPN published automatically</li>
              <li>APP submitted to ZPPA within 30 days of approval</li>
            </ol>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              &larr; Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                {savingDraft && <LoadingSpinner size="sm" />}
                Save Draft
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <PaperAirplaneIcon className="w-5 h-5 text-gray-600" /> Submit for Approval
            </h2>
            <p className="text-sm text-gray-600">
              You are about to submit <strong>{planRef}</strong> for departmental head review and subsequent approval chain.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submission Notes (optional)</label>
              <textarea
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes for the approver..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-zammsa-green"
              />
              <span className="text-sm text-gray-700">
                I confirm this Annual Procurement Plan is complete, accurate, and aligned with departmental operational needs. I understand that this will initiate the formal approval process.
              </span>
            </label>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              Once submitted, you cannot edit until returned for changes by an approver.
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              &larr; Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                {savingDraft && <LoadingSpinner size="sm" />}
                Save as Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !confirmed || !budgetOk}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <LoadingSpinner size="sm" />}
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APPCreate;
