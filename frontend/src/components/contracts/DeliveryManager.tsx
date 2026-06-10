import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { financeApi } from '../../api/finance';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from './contractUtils';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, TruckIcon,
  ClockIcon, CheckCircleIcon, ExclamationIcon,
} from '@heroicons/react/outline';

interface GrnItem {
  po_line_item_id: string;
  item_code: string;
  item_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  total_amount: number;
}

const emptyItem: GrnItem = {
  po_line_item_id: '', item_code: '', item_name: '', quantity_ordered: 0,
  quantity_received: 0, unit_price: 0, total_amount: 0,
};

const DeliveryManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [grnItems, setGrnItems] = React.useState<GrnItem[]>([{ ...emptyItem }]);
  const [grnNumber, setGrnNumber] = React.useState('');
  const [grnNotes, setGrnNotes] = React.useState('');
  const [milestoneName, setMilestoneName] = React.useState('');
  const [ldDays, setLdDays] = React.useState('');
  const [ldRate, setLdRate] = React.useState('0.5');
  const [certRef, setCertRef] = React.useState('');
  const [editingMilestone, setEditingMilestone] = React.useState<{ id: string; actualDate: string } | null>(null);
  const [verificationGrnNumber, setVerificationGrnNumber] = React.useState('');
  const [verificationMilestoneName, setVerificationMilestoneName] = React.useState('');
  const [verificationHint, setVerificationHint] = React.useState<string | null>(null);
  const [adviceToLink, setAdviceToLink] = React.useState('');
  const [zamraCertificateVerified, setZamraCertificateVerified] = React.useState(false);
  const [coldChainMaintained, setColdChainMaintained] = React.useState(true);
  const [temperatureLogAttached, setTemperatureLogAttached] = React.useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const { data: d } = useQuery({
    queryKey: ['contract-execution-dashboard', id],
    queryFn: () => vendorApi.contracts.executionDashboard(id!),
    enabled: !!id,
  });

  const { data: deliveryAdvices } = useQuery({
    queryKey: ['delivery-advices', id],
    queryFn: () => financeApi.listDeliveryAdvices({ contract: id, status: 'submitted', page_size: 50 }),
    enabled: !!id,
  });

  const c = contract;
  const dashboard = d;

  // Gather PO line items from contract's purchase_orders
  const poLineItems = React.useMemo(() => {
    if (!c?.purchase_orders) return [];
    return c.purchase_orders.flatMap(po =>
      (po.line_items || []).map(li => ({
        ...li,
        po_number: po.po_number,
      }))
    );
  }, [c]);

  const handleSelectPOItem = (idx: number, poLineItemId: string) => {
    const poItem = poLineItems.find(li => li.id === poLineItemId);
    if (!poItem) return;
    const updated = grnItems.map((item, i) => {
      if (i !== idx) return item;
      return {
        po_line_item_id: poItem.id,
        item_code: poItem.item_code,
        item_name: poItem.item_name,
        quantity_ordered: poItem.quantity,
        quantity_received: poItem.quantity,
        unit_price: poItem.unit_price,
        total_amount: poItem.quantity * poItem.unit_price,
      };
    });
    setGrnItems(updated);
  };

  const addItem = () => setGrnItems([...grnItems, { ...emptyItem }]);
  const removeItem = (idx: number) => {
    if (grnItems.length <= 1) return;
    setGrnItems(grnItems.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof GrnItem, value: string) => {
    const updated = grnItems.map((item, i) => {
      if (i !== idx) return item;
      const newItem = { ...item, [field]: value };
      if (field === 'quantity_received' || field === 'unit_price') {
        const qty = field === 'quantity_received' ? Number(value) : item.quantity_received;
        const price = field === 'unit_price' ? Number(value) : item.unit_price;
        newItem.total_amount = qty * price;
      }
      return newItem;
    });
    setGrnItems(updated);
  };

  const grnMutation = useMutation({
    mutationFn: () => financeApi.createGrnManual({
      contract_id: id!,
      grn_number: grnNumber || undefined,
      milestone_name: milestoneName || undefined,
      notes: grnNotes,
      delivery_advice_id: adviceToLink || undefined,
      zamra_certificate_verified: zamraCertificateVerified,
      cold_chain_maintained: coldChainMaintained,
      temperature_log_attached: temperatureLogAttached,
      items: grnItems,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-advices', id] });
      toast.success('GRN created manually');
      setGrnItems([{ ...emptyItem }]);
      setGrnNumber('');
      setGrnNotes('');
      setAdviceToLink('');
      setZamraCertificateVerified(false);
      setColdChainMaintained(true);
      setTemperatureLogAttached(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create GRN'),
  });

  const wmsWebhookMutation = useMutation({
    mutationFn: () => financeApi.postGrnWebhook({
      contract_id: id!,
      po_number: c?.contract_number || '',
      grn_number: grnNumber || undefined,
      items: grnItems,
      notes: grnNotes,
      milestone_name: milestoneName || undefined,
      received_by: c?.contract_manager || 'WMS',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      toast.success('WMS webhook GRN posted successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to post WMS webhook GRN'),
  });

  const verifyAdviceMutation = useMutation({
    mutationFn: ({ adviceId }: { adviceId: string }) => financeApi.verifyDeliveryAdvice(adviceId, {
      grn_number: verificationGrnNumber || undefined,
      milestone_name: verificationMilestoneName || undefined,
      received_by: c?.contract_manager || undefined,
      notes: grnNotes || undefined,
      zamra_certificate_verified: zamraCertificateVerified,
      cold_chain_maintained: coldChainMaintained,
      temperature_log_attached: temperatureLogAttached,
    }),
    onSuccess: () => {
      setVerificationHint(null);
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-advices', id] });
      toast.success('WMS GRN verified and milestone updated');
    },
    onError: (err: any) => {
      const apiError = err?.response?.data?.error || 'Failed to verify GRN';
      const friendlyError = err?.response?.data?.manual_grn_required
        ? `${apiError} Manual GRN creation is required until WMS comes back online or sends the webhook.`
        : apiError;
      setVerificationHint(friendlyError);
      toast.error(friendlyError);
    },
  });

  const populateFromAdvice = (advice: any) => {
    const rawItems = advice.raw_payload?.items || [];
    if (rawItems.length > 0) {
      setGrnItems(rawItems.map((it: any) => ({
        po_line_item_id: it.po_line_item_id || '',
        item_code: it.item_code || '',
        item_name: it.item_name || '',
        quantity_ordered: Number(it.quantity_delivered || 0),
        quantity_received: Number(it.quantity_delivered || 0),
        unit_price: Number(it.unit_price || 0),
        total_amount: Number(it.total_amount || 0),
      })));
    }
    if (advice.notes) setGrnNotes(advice.notes);
    setAdviceToLink(advice.advice_id || advice.id);
    setMilestoneName(advice.raw_payload?.milestone_name || '');
    toast.success('Form auto-populated from delivery advice');
  };

  const ldMutation = useMutation({
    mutationFn: () => contractsApi.calculateLD(id!, {
      days_delayed: Number(ldDays),
      daily_rate: Number(ldRate) * 100, // convert % to daily rate
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      toast.success(`LD assessed: K${Number(data.applied_amount).toLocaleString()}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to calculate LD'),
  });

  const finalAcceptMutation = useMutation({
    mutationFn: () => contractsApi.finalAcceptance(id!, {
      acceptance_certificate_ref: certRef || undefined,
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      toast.success(data.message);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to issue acceptance'),
  });

  const milestoneUpdateMutation = useMutation({
    mutationFn: ({ milestoneId, actual_date, notes }: { milestoneId: string; actual_date: string; notes?: string }) =>
      contractsApi.updateMilestoneActual(milestoneId, { actual_date, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      toast.success('Milestone updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update milestone'),
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!c) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <p className="text-gray-500 text-lg">Contract not found</p>
      <Link to="/contracts" className="text-zammsa-green font-bold mt-2 inline-block">Back to contracts</Link>
    </div>
  );

  const totalAmount = grnItems.reduce((s, i) => s + i.total_amount, 0);
  const totalQty = grnItems.reduce((s, i) => s + i.quantity_received, 0);

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/contracts/${id}`} className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Delivery Manager</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{c.contract_number} — {c.title}</p>
        </div>
        <Link
          to="/finance/grns"
          className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          Official GRNs
        </Link>
      </div>

      {/* Contract Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><p className="text-xs font-bold text-gray-400 uppercase">Value</p><p className="text-lg font-black text-gray-900">{formatContractValue(c.value, c.currency)}</p></div>
          <div><p className="text-xs font-bold text-gray-400 uppercase">Period</p><p className="text-sm font-bold text-gray-900">{formatDate(c.start_date)} — {formatDate(c.end_date)}</p></div>
          <div><p className="text-xs font-bold text-gray-400 uppercase">Supplier</p><p className="text-sm font-bold text-gray-900 truncate">{c.vendor_name}</p></div>
          <div><p className="text-xs font-bold text-gray-400 uppercase">Manager</p><p className="text-sm font-bold text-gray-900">{c.contract_manager || 'Not assigned'}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: GRN Handling */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TruckIcon className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Manual GRN Creation</h2>
            {adviceToLink ? (
              <span className="ml-auto text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">Linked to Advice</span>
            ) : (
              <span className="ml-auto text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-bold">Testing Alt</span>
            )}
          </div>
          {adviceToLink && (
            <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Form auto-populated from delivery advice.</p>
                  <p className="text-xs mt-1">Review and adjust if needed, then click <strong>Create GRN Manually</strong>. The delivery advice will be marked as verified.</p>
                </div>
                <button onClick={() => { setAdviceToLink(''); setMilestoneName(''); }} className="text-red-600 hover:text-red-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mb-4">Use this when the WMS webhook has not arrived. This creates the official GRN and updates the selected milestone.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">GRN Number</label>
              <input value={grnNumber} onChange={e => setGrnNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Auto-generated" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Milestone (optional)</label>
              <input value={milestoneName} onChange={e => setMilestoneName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Delivery 1" />
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {grnItems.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400">Item #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    {item.po_line_item_id && (
                      <span className="text-xs text-emerald-600 font-semibold">✓ from PO</span>
                    )}
                    {grnItems.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-rose-500 hover:text-rose-700"><TrashIcon className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>

                {poLineItems.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-0.5">Select from Purchase Order</label>
                    <select
                      value={item.po_line_item_id}
                      onChange={(e) => handleSelectPOItem(idx, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— Manual entry —</option>
                      {poLineItems.map((pli) => (
                        <option key={pli.id} value={pli.id}>
                          {pli.item_name} ({pli.po_number}) — Qty: {pli.quantity} @ K{Number(pli.unit_price).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Item Code</label>
                    <input value={item.item_code} onChange={e => updateItem(idx, 'item_code', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Item Name *</label>
                    <input value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Qty Ordered</label>
                    <input type="number" min="0" value={item.quantity_ordered || ''}
                      onChange={e => updateItem(idx, 'quantity_ordered', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Qty Received *</label>
                    <input type="number" min="0" value={item.quantity_received || ''}
                      onChange={e => updateItem(idx, 'quantity_received', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Unit Price *</label>
                    <input type="number" min="0" step="0.01" value={item.unit_price || ''}
                      onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Total</label>
                    <input type="text" readOnly value={item.total_amount.toFixed(2)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700" />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addItem}
              className="flex items-center gap-2 text-sm text-zammsa-green font-bold hover:underline">
              <PlusIcon className="w-4 h-4" /> Add Item
            </button>
          </div>

          {/* Medical Compliance & Inspection (COI) Checks */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Medical Compliance & Safety (COI) Checks</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={zamraCertificateVerified} onChange={e => setZamraCertificateVerified(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-xs font-semibold text-gray-950">ZAMRA Product Registration Certificate Verified</p>
                  <p className="text-[10px] text-gray-500">Confirm medicine batch registration certificates are valid</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={coldChainMaintained} onChange={e => setColdChainMaintained(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-xs font-semibold text-gray-950">Cold Chain Maintained</p>
                  <p className="text-[10px] text-gray-500">Confirm temperature was kept within required ranges in transit</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={temperatureLogAttached} onChange={e => setTemperatureLogAttached(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-xs font-semibold text-gray-950">Temperature Log Attached</p>
                  <p className="text-[10px] text-gray-500">Confirm temperature log data is extracted and reviewed</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-600 mb-1">Notes</label>
            <textarea value={grnNotes} onChange={e => setGrnNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total: <strong>{totalQty} units</strong> — <strong>K {totalAmount.toLocaleString()}</strong>
            </div>
            <div className="flex gap-3">
              <button onClick={() => wmsWebhookMutation.mutate()} disabled={wmsWebhookMutation.isPending || !grnItems.some(i => i.item_name)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                {wmsWebhookMutation.isPending ? 'Posting...' : 'Simulate WMS Webhook'}
              </button>
              <button onClick={() => grnMutation.mutate()} disabled={grnMutation.isPending || !grnItems.some(i => i.item_name)}
                className="px-6 py-2.5 bg-zammsa-green text-white rounded-xl font-bold text-sm hover:bg-zammsa-green-dark disabled:opacity-50 shadow-sm">
                {grnMutation.isPending ? 'Creating...' : 'Create GRN Manually'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: LD + Final Acceptance */}
        <div className="space-y-6">
          {/* Delivery Advice Inbox */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Pending Delivery Advice</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">Verify the WMS GRN first. If the webhook GRN is not found, use the manual GRN form below.</p>
            {verificationHint && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {verificationHint}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">WMS GRN Number</label>
                <input
                  value={verificationGrnNumber}
                  onChange={(e) => setVerificationGrnNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter the GRN number from WMS"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Milestone Name</label>
                <input
                  value={verificationMilestoneName}
                  onChange={(e) => setVerificationMilestoneName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Milestone to mark as delivered"
                />
              </div>
            </div>
            {deliveryAdvices?.results?.length ? (
              <div className="space-y-3">
                {deliveryAdvices.results.map((advice: any) => (
                  <div key={advice.advice_id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{advice.advice_number}</p>
                        <p className="text-xs text-gray-500">{advice.supplier_name || 'Supplier'} • {advice.contract_number || c.contract_number}</p>
                        <p className="text-xs text-gray-500 mt-1">{advice.item_description}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">Submitted</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span>Qty: {Number(advice.quantity_advised).toLocaleString()}</span>
                      <span>K {Number(advice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => populateFromAdvice(advice)}
                          className="px-3 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600"
                        >
                          Create GRN
                        </button>
                        <button
                          type="button"
                          onClick={() => verifyAdviceMutation.mutate({ adviceId: advice.advice_id })}
                          disabled={verifyAdviceMutation.isPending}
                          className="px-3 py-2 rounded-lg bg-zammsa-green text-white font-bold hover:bg-zammsa-green-dark disabled:opacity-50"
                        >
                          Verify GRN
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No pending delivery advice for this contract.</p>
            )}
          </div>

          {/* Liquidated Damages */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationIcon className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">Liquidated Damages</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">Calculate LD when delivery is late. Default rate: 0.5%/week, capped at 10% of contract value.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Days Delayed</label>
                <input type="number" min="0" value={ldDays} onChange={e => setLdDays(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 5" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">LD Rate (% per week)</label>
                <input type="number" min="0" step="0.1" value={ldRate} onChange={e => setLdRate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            {ldDays && (
              <div className="text-xs text-gray-500 mb-4">
                Est: K {c.value.toLocaleString()} × {ldRate}% × {Math.max(1, Math.ceil(Number(ldDays) / 7))}wk ={' '}
                <strong>K {(c.value * Number(ldRate) / 100 * Math.max(1, Math.ceil(Number(ldDays) / 7))).toLocaleString()}</strong>
                (capped at 10% = K {(c.value * 0.1).toLocaleString()})
              </div>
            )}
            <button onClick={() => ldMutation.mutate()} disabled={ldMutation.isPending || !ldDays}
              className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 disabled:opacity-50 shadow-sm">
              {ldMutation.isPending ? 'Calculating...' : 'Record Liquidated Damages'}
            </button>
          </div>

          {/* Final Acceptance */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">Final Acceptance</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">Issue Final Acceptance Certificate when all items delivered and inspected. Starts 30-day retention countdown.</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 mb-1">Certificate Reference</label>
              <input value={certRef} onChange={e => setCertRef(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Auto-generated" />
            </div>
            <button onClick={() => finalAcceptMutation.mutate()} disabled={finalAcceptMutation.isPending}
              className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
              {finalAcceptMutation.isPending ? 'Issuing...' : 'Issue Final Acceptance Certificate'}
            </button>
          </div>

          {/* Submitted Invoices & Certificates */}
          {dashboard && dashboard.invoices && dashboard.invoices.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-lg font-bold text-gray-900">Submitted Invoices & Certificates</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Review supplier-submitted documents before manually issuing or verifying the Goods Receipt Note (GRN).</p>
              <div className="space-y-3">
                {dashboard.invoices.map((inv: any) => (
                  <div key={inv.invoice_id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-3 text-sm">
                      <div>
                        <span className="font-bold text-gray-950">{inv.invoice_number}</span>
                        {inv.submitted_at && (
                          <span className="text-[10px] text-gray-500 ml-2">
                            {new Date(inv.submitted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-gray-950">K {inv.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-2 border-t border-gray-200/60 pt-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Attached Documents</p>
                      {inv.document && (
                        <a href={inv.document} target="_blank" rel="noopener noreferrer" 
                          className="flex items-center gap-2 text-xs text-zammsa-green font-semibold hover:underline">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Invoice PDF
                        </a>
                      )}
                      {inv.delivery_note && (
                        <a href={inv.delivery_note} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-blue-600 font-semibold hover:underline">
                          <CheckCircleIcon className="w-4 h-4 text-blue-500" /> Delivery Note / Packing List
                        </a>
                      )}
                      {inv.zamra_certificate && (
                        <a href={inv.zamra_certificate} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-purple-600 font-semibold hover:underline">
                          <CheckCircleIcon className="w-4 h-4 text-purple-500" /> ZAMRA Batch Certificate
                        </a>
                      )}
                      {inv.temperature_log && (
                        <a href={inv.temperature_log} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-amber-600 font-semibold hover:underline">
                          <CheckCircleIcon className="w-4 h-4 text-amber-500" /> Cold Chain Temperature Log
                        </a>
                      )}
                      {!inv.document && !inv.delivery_note && !inv.zamra_certificate && !inv.temperature_log && (
                        <span className="text-xs text-gray-400 italic">No document attachments uploaded.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Deliveries */}
          {dashboard && dashboard.deliveries.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TruckIcon className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Existing Deliveries ({dashboard.deliveries.length})</h2>
              </div>
              <div className="space-y-2">
                {dashboard.deliveries.map((del) => (
                  <div key={del.grn_id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <div>
                      <span className="font-semibold text-gray-900">{del.grn_number}</span>
                      <span className="text-xs text-gray-500 ml-2">{new Date(del.received_date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-bold text-gray-700">K {del.total_amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {dashboard && dashboard.milestones.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClockIcon className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Milestones</h2>
              </div>
              <div className="space-y-3">
                {dashboard.milestones
                  .slice()
                  .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
                  .map((m) => {
                    const plannedDate = m.planned_date || m.due_date;
                    const variance = m.variance_days ?? (m.actual_date && plannedDate ?
                      Math.ceil((new Date(m.actual_date).getTime() - new Date(plannedDate).getTime()) / (1000 * 60 * 60 * 24)) : null);
                    const varianceFlag = m.variance_flag;
                    const milestoneId = m.milestone_id;
                    const isEditing = editingMilestone?.id === milestoneId;
                    const editDate = editingMilestone?.actualDate || m.actual_date || '';
                    
                    const getVarianceColor = (flag?: string) => {
                      if (!flag) return 'bg-gray-100 text-gray-600';
                      switch (flag) {
                        case 'green': return 'bg-emerald-50 text-emerald-700';
                        case 'yellow': return 'bg-amber-50 text-amber-700';
                        case 'orange': return 'bg-orange-50 text-orange-700';
                        case 'red': return 'bg-rose-50 text-rose-700';
                        default: return 'bg-gray-100 text-gray-600';
                      }
                    };
                    
                    const getVarianceLabel = (days?: number | null, flag?: string) => {
                      if (days === null || days === undefined) return '—';
                      if (days <= 0) return `On time (${days}d)`;
                      if (days <= 7) return `${days}d late`;
                      if (days <= 14) return `${days}d late`;
                      return `${days}d late`;
                    };
                    
                    const handleSubmit = (e: React.FormEvent) => {
                      e.preventDefault();
                      if (!editDate || !milestoneId) return;
                      milestoneUpdateMutation.mutate({ milestoneId, actual_date: editDate, notes: `Updated via Delivery Manager` });
                      setEditingMilestone(null);
                    };
                    
                    const startEdit = () => {
                      if (!milestoneId) return;
                      setEditingMilestone({ id: milestoneId, actualDate: m.actual_date || '' });
                    };
                    
                    const cancelEdit = () => {
                      setEditingMilestone(null);
                    };
                    
                    return (
                      <div key={milestoneId} className="flex items-center justify-between py-3 border-b border-gray-50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${
                            m.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400'
                          }`} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{m.milestone_name}</p>
                            <p className="text-xs text-gray-500">
                              Planned: {formatDate(plannedDate)}
                              {m.actual_date && <span className="ml-2">| Actual: {formatDate(m.actual_date)}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {variance !== null && variance !== undefined && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getVarianceColor(varianceFlag)}`}>
                              {getVarianceLabel(variance, varianceFlag)}
                            </span>
                          )}
                          {isEditing ? (
                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditingMilestone(prev => prev ? { ...prev, actualDate: e.target.value } : null)}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-32"
                              />
                              <button type="submit" className="text-xs text-zammsa-green hover:underline font-bold">Save</button>
                              <button type="button" onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                            </form>
                          ) : (
                            <button
                              onClick={startEdit}
                              className="text-xs text-zammsa-green hover:underline font-bold"
                              disabled={milestoneUpdateMutation.isPending}
                            >
                              Update Actual
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryManager;
