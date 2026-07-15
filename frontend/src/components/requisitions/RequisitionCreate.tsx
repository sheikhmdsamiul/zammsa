import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requisitionsApi } from '../../api/requisitions';
import { procurementPlanningApi, masterDataApi } from '../../api/procurement_planning';
import toast from 'react-hot-toast';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { useAuth } from '../../hooks/useAuth';

type ProcurementType = 'goods' | 'consulting' | 'works';

const RequisitionCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    procurement_type: 'goods' as ProcurementType,
    description: '',
    department: user?.department || '',
    date_required: '',
    delivery_location: '',
    funding_source: '',
    app_line_item: '',
    justification: '',
  });
  const [items, setItems] = useState([{
    item_code: '', description: '', quantity: 1, unit: 'Box', estimated_unit_cost: 0, commodity: '', zamra_required: true,
  }]);
  const [specs, setSpecs] = useState<Record<number, any>>({});
  const [attachments, setAttachments] = useState<Record<number, File | null>>({});
  const [confirm, setConfirm] = useState(false);

  const { data: lineItemsData } = useQuery({
    queryKey: ['appLineItems', 'approved-published'],
    queryFn: () => procurementPlanningApi.lineItems.list({ page_size: 500, app__status__in: 'approved,published' }),
  });
  const { data: fundingSourcesData } = useQuery({
    queryKey: ['fundingSourcesForReq'],
    queryFn: () => masterDataApi.fundingSources({ is_active: true, page_size: 200 }),
  });
  const { data: commoditiesData } = useQuery({
    queryKey: ['commoditiesForReq'],
    queryFn: () => masterDataApi.commodities({ is_active: true, page_size: 200 }),
  });
  const { data: departmentsData } = useQuery({
    queryKey: ['departmentsForReq'],
    queryFn: () => masterDataApi.departments({ is_active: true, page_size: 200 }),
  });

  const lineItems = lineItemsData?.results ?? [];
  const fundingSources = fundingSourcesData?.results ?? [];
  const commodities = commoditiesData?.results ?? [];
  const departments = departmentsData?.results ?? [];

  const prevAppLineItem = useRef(form.app_line_item);

  useEffect(() => {
    if (!form.app_line_item || form.app_line_item === prevAppLineItem.current) return;
    prevAppLineItem.current = form.app_line_item;

    const li = lineItems.find((item: any) => item.line_item_id === form.app_line_item);
    if (!li) return;

    const rawType = (li.procurement_type as string | undefined) || 'goods';
    const mappedType: ProcurementType =
      rawType === 'services' ? 'consulting'
        : rawType === 'consulting' ? 'consulting'
        : rawType === 'works' ? 'works'
        : rawType === 'goods' ? 'goods'
        : 'goods';

    setForm((prev) => ({
      ...prev,
      description: li.description || '',
      procurement_type: mappedType,
      department: li.app_department_id || prev.department,
      date_required: li.planned_award_date || li.planned_issue_date || '',
      funding_source: li.funding_source || '',
    }));

    setItems((prev) => {
      if (prev.length === 1 && !prev[0].description && prev[0].estimated_unit_cost === 0) {
        return [{
          ...prev[0],
          description: li.description || '',
          commodity: li.commodity || '',
          estimated_unit_cost: Number(li.estimated_value) || 0,
        }];
      }
      return prev;
    });
  }, [form.app_line_item, lineItems]);

  const addItem = () => setItems([...items, { item_code: '', description: '', quantity: 1, unit: 'Box', estimated_unit_cost: 0, commodity: '', zamra_required: true }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item);
    setItems(updated);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => requisitionsApi.create(data),
  });
  const submitMutation = useMutation({
    mutationFn: ({ id, specifications }: { id: string; specifications: any[] }) => requisitionsApi.submit(id, { specifications }),
  });

  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.estimated_unit_cost) || 0), 0),
    [items],
  );

  const selectedFunding = fundingSources.find((f: any) => (f.source_id || f.id) === form.funding_source);

  const canGoStep2 = Boolean(form.description && form.department && form.date_required && form.delivery_location && form.funding_source && form.justification);
  const canGoStep3 = items.length > 0 && items.every(i => i.description && Number(i.quantity) > 0 && Number(i.estimated_unit_cost) > 0) && items.every((_, idx) => attachments[idx]);
  const canGoStep4 = canGoStep3 && items.every((_, idx) => {
    const s = specs[idx];
    return s?.technical_standard && s?.shelf_life && s?.packaging && s?.storage && s?.quality_requirements;
  });

  const next = () => {
    if (step === 1 && !canGoStep2) return toast.error('Complete Step 1 fields');
    if (step === 2 && !canGoStep3) return toast.error('Complete all line items and upload attachments for each');
    if (step === 3 && !canGoStep4) return toast.error('Complete specifications for all items');
    setStep(prev => Math.min(prev + 1, 4));
  };
  const back = () => setStep(prev => Math.max(prev - 1, 1));

  const saveDraftOnly = async () => {
    if (!canGoStep2) return toast.error('Complete required basic details first');
    if (!form.app_line_item) {
      toast.error('Please select an APP Line Item');
      return;
    }
    try {
      const payload = {
        title: form.description,
        description: form.description,
        department: form.department,
        date_required: form.date_required,
        delivery_location: form.delivery_location,
        app_line_item: form.app_line_item,
        estimated_value: estimatedTotal,
        items: items.map((it) => ({
          item_code: it.item_code,
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit: it.unit,
          estimated_unit_cost: Number(it.estimated_unit_cost) || 0,
        })),
        notes: `Funding Source: ${selectedFunding?.source_name || '-'}${selectedFunding?.source_code ? ` (${selectedFunding.source_code})` : ''}\nJustification: ${form.justification}`,
      };
      const res = await createMutation.mutateAsync(payload);
      toast.success('Draft requisition created');
      navigate(`/requisitions/${res.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save draft');
    }
  };

  const submitAndLock = async () => {
    if (!confirm) return toast.error('Please confirm before submitting');
    if (!canGoStep4) return toast.error('Complete all steps before submit');
    try {
      const payload = {
        title: form.description,
        description: form.description,
        department: form.department,
        date_required: form.date_required,
        delivery_location: form.delivery_location,
        app_line_item: form.app_line_item,
        estimated_value: estimatedTotal,
        items: items.map((it) => ({
          item_code: it.item_code,
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit: it.unit,
          estimated_unit_cost: Number(it.estimated_unit_cost) || 0,
        })),
        notes: `Funding Source: ${selectedFunding?.source_name || '-'}${selectedFunding?.source_code ? ` (${selectedFunding.source_code})` : ''}\nJustification: ${form.justification}`,
      };
      const created = await createMutation.mutateAsync(payload);

      // Upload attachments per line item
      for (let i = 0; i < items.length; i++) {
        const file = attachments[i];
        if (file && created.items?.[i]?.id) {
          await requisitionsApi.uploadItemAttachment(created.items[i].id, file);
        }
      }

      const specifications = items.map((it, idx) => ({
        specification_type: form.procurement_type === 'goods' ? 'goods' : form.procurement_type === 'consulting' ? 'tor' : 'sow',
        content: {
          item_description: it.description,
          ...specs[idx],
          technically_neutral: specs[idx]?.technically_neutral ?? true,
        },
      }));

      await submitMutation.mutateAsync({ id: created.id, specifications });
      toast.success('Requisition submitted to Department Head');
      navigate(`/requisitions/${created.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit requisition');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Requisition</h1>
          <p className="text-sm text-gray-500 mt-1">Step {step} of 4</p>
        </div>
        <button type="button" onClick={() => navigate('/requisitions')} className="text-sm text-gray-500 hover:text-gray-700">← Requisitions</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-4 gap-2 text-xs md:text-sm">
          {['Type & Details', 'Line Items', 'Specifications', 'Review & Submit'].map((label, idx) => {
            const n = idx + 1;
            const active = step === n;
            const completed = step > n;
            return (
              <div key={label} className={`rounded-lg border px-3 py-2 ${active ? 'border-zammsa-green bg-green-50' : completed ? 'border-green-200 bg-green-50/60' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`font-semibold ${active ? 'text-zammsa-green' : 'text-gray-600'}`}>Step {n}</p>
                <p className="text-gray-700">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Step 1 — Type & Basic Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Procurement Type</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'goods', title: 'Goods', desc: 'Items, medicines, supplies, equipment' },
                { key: 'consulting', title: 'Consulting Services', desc: 'Expert advice, studies, TOR-based' },
                { key: 'works', title: 'Works', desc: 'Construction, installation, renovation' },
              ].map((t) => (
                <button key={t.key} type="button" onClick={() => setForm({ ...form, procurement_type: t.key as ProcurementType })}
                  className={`text-left p-4 rounded-lg border ${form.procurement_type === t.key ? 'border-zammsa-green bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select department...</option>
                {departments.map((dept: any) => (
                  <option key={dept.dept_id || dept.id} value={dept.dept_id || dept.id}>
                    {dept.dept_name} {dept.dept_code ? ` (${dept.dept_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Delivery Date *</label>
              <input type="date" value={form.date_required} onChange={(e) => setForm({ ...form, date_required: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location *</label>
              <input value={form.delivery_location} onChange={(e) => setForm({ ...form, delivery_location: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funding Source *</label>
              <select value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select funding source...</option>
                {fundingSources.map((fs: any) => (
                  <option key={fs.source_id || fs.id} value={fs.source_id || fs.id}>
                    {fs.source_name} {fs.source_code ? `— Code: ${fs.source_code}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to APP Line Item *</label>
              <select value={form.app_line_item} onChange={(e) => setForm({ ...form, app_line_item: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2">
                <option value="">-- Select an approved/published APP line item --</option>
                {lineItems.length === 0 && <option value="" disabled>No approved/published APP line items available</option>}
                {lineItems.map((li: any) => (
                  <option key={li.line_item_id} value={li.line_item_id}>
                    {li.app_name || '---'} | {li.description?.slice(0, 60)} | K{Number(li.estimated_value || 0).toLocaleString()} | {li.commodity_name || li.commodity_category || '---'} | {li.app_status}
                  </option>
                ))}
              </select>
              {lineItems.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Showing {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} from approved/published APPs only
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Justification *</label>
              <textarea rows={4} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Step 2 — Line Items</h2>
            <button type="button" onClick={addItem} className="text-sm text-zammsa-green hover:underline">+ Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-2">
                  <input type="text" placeholder="Code" value={item.item_code} onChange={(e) => updateItem(i, 'item_code', e.target.value)} className="border-gray-300 rounded px-2 py-1 text-sm" />
                  <input type="text" placeholder="Description *" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="md:col-span-2 border-gray-300 rounded px-2 py-1 text-sm" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} min={1} className="border-gray-300 rounded px-2 py-1 text-sm" />
                  <input type="text" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="border-gray-300 rounded px-2 py-1 text-sm" />
                  <input type="number" placeholder="Unit Cost" value={item.estimated_unit_cost} onChange={(e) => updateItem(i, 'estimated_unit_cost', parseFloat(e.target.value) || 0)} min={0} step="0.01" className="border-gray-300 rounded px-2 py-1 text-sm" />
                  <select value={item.commodity} onChange={(e) => updateItem(i, 'commodity', e.target.value)} className="border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">Commodity</option>
                    {commodities.map((c: any) => (
                      <option key={c.commodity_id || c.id} value={c.commodity_id || c.id}>{c.commodity_name}</option>
                    ))}
                  </select>
                  <label className="text-xs flex items-center gap-2 px-2"><input type="checkbox" checked={item.zamra_required} onChange={(e) => updateItem(i, 'zamra_required', e.target.checked)} /> ZAMRA</label>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Supporting Doc:</label>
                    <input type="file" onChange={(e) => setAttachments(prev => ({ ...prev, [i]: e.target.files?.[0] || null }))} className="text-xs w-24" title="Spec sheet, quote, or other supporting document" />
                    {attachments[i] && <span className="text-[10px] text-green-600 font-medium">✓</span>}
                  </div>
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-sm mt-1">Remove</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-lg border bg-green-50">
            <p className="text-sm text-gray-700">Estimated Total: <span className="font-semibold">K {estimatedTotal.toLocaleString()}</span></p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Step 3 — Specifications</h2>
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <p className="font-medium text-gray-900">Specification for: {item.description || `Item ${idx + 1}`}</p>
              <input placeholder="Technical Standard / Reference *" value={specs[idx]?.technical_standard || ''} onChange={(e) => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], technical_standard: e.target.value } }))} className="w-full border-gray-300 rounded px-3 py-2 text-sm" />
              <input placeholder="Minimum Shelf Life *" value={specs[idx]?.shelf_life || ''} onChange={(e) => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], shelf_life: e.target.value } }))} className="w-full border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Packaging Requirements *" value={specs[idx]?.packaging || ''} onChange={(e) => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], packaging: e.target.value } }))} className="w-full border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Storage and Handling Conditions *" value={specs[idx]?.storage || ''} onChange={(e) => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], storage: e.target.value } }))} className="w-full border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Quality and Certification Requirements *" value={specs[idx]?.quality_requirements || ''} onChange={(e) => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], quality_requirements: e.target.value } }))} className="w-full border-gray-300 rounded px-3 py-2 text-sm" />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={(specs[idx]?.technically_neutral ?? true) === true} onChange={() => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], technically_neutral: true } }))} />
                  Technically neutral
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={specs[idx]?.technically_neutral === false} onChange={() => setSpecs((p) => ({ ...p, [idx]: { ...p[idx], technically_neutral: false } }))} />
                  Not neutral
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Step 4 — Review & Submit</h2>
          <div className="rounded-lg border p-4 bg-gray-50 text-sm space-y-2">
            <p>Procurement Type: <span className="font-medium capitalize">{form.procurement_type}</span></p>
            <p>Description: <span className="font-medium">{form.description || '-'}</span></p>
            <p>Required Date: <span className="font-medium">{form.date_required || '-'}</span></p>
            <p>Delivery Location: <span className="font-medium">{form.delivery_location || '-'}</span></p>
            <p>Funding Source: <span className="font-medium">{selectedFunding?.source_name || '-'}</span></p>
            <p>Line Items: <span className="font-medium">{items.length}</span></p>
            <p>Estimated Total: <span className="font-medium">K {estimatedTotal.toLocaleString()}</span></p>
            <p>Attachments: <span className="font-medium">{Object.values(attachments).filter(Boolean).length} / {items.length} items</span></p>
            {items.some((_, i) => Number(items[i].quantity) * Number(items[i].estimated_unit_cost) > 1_000_000) && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4 text-yellow-600 shrink-0" />
                <span className="text-yellow-800 font-medium">Technical review required — some line items exceed K1,000,000</span>
              </div>
            )}
            <p>Approval Chain: <span className="font-medium">You → Dept Head → Finance → Director General {estimatedTotal > 250000 ? '→ ZPC' : ''} → Approved</span></p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
            <span>I confirm this requisition information is accurate and budget will be encumbered on submission.</span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" onClick={() => navigate('/requisitions')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <div className="flex gap-3">
          {step > 1 && <button type="button" onClick={back} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>}
          <button type="button" onClick={saveDraftOnly} disabled={createMutation.isPending || submitMutation.isPending} className="px-4 py-2 text-sm border border-yellow-400 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Draft'}
          </button>
          {step < 4 ? (
            <button type="button" onClick={next} className="px-5 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-zammsa-green-dark">Next →</button>
          ) : (
            <button type="button" onClick={submitAndLock} disabled={createMutation.isPending || submitMutation.isPending || !confirm} className="px-5 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-zammsa-green-dark disabled:opacity-50">
              {submitMutation.isPending ? 'Submitting...' : 'Submit & Lock Budget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionCreate;
