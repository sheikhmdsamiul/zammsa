import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { financeApi } from '../../api/finance';
import { vendorApi } from '../../api/vendor';
import { Contract, ExecutionDashboard } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from './contractUtils';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, TruckIcon,
  ClockIcon, CheckCircleIcon, ExclamationIcon, CashIcon,
} from '@heroicons/react/outline';

interface GrnItem {
  item_code: string;
  item_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  total_amount: number;
}

const emptyItem: GrnItem = {
  item_code: '', item_name: '', quantity_ordered: 0,
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

  const c = contract;
  const dashboard = d;

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
      items: grnItems,
      notes: grnNotes,
      milestone_name: milestoneName || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-execution-dashboard', id] });
      toast.success('GRN created manually');
      setGrnItems([{ ...emptyItem }]);
      setGrnNumber('');
      setGrnNotes('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create GRN'),
  });

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
        {/* Left: Manual GRN Creation */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TruckIcon className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Manual GRN Creation</h2>
            <span className="ml-auto text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-bold">Testing Alt</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Alternative to WMS webhook — create a GRN directly in PMS for testing.</p>

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
                  {grnItems.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-rose-500 hover:text-rose-700"><TrashIcon className="w-4 h-4" /></button>
                  )}
                </div>
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

          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-600 mb-1">Notes</label>
            <textarea value={grnNotes} onChange={e => setGrnNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total: <strong>{totalQty} units</strong> — <strong>K {totalAmount.toLocaleString()}</strong>
            </div>
            <button onClick={() => grnMutation.mutate()} disabled={grnMutation.isPending || !grnItems.some(i => i.item_name)}
              className="px-6 py-2.5 bg-zammsa-green text-white rounded-xl font-bold text-sm hover:bg-zammsa-green-dark disabled:opacity-50 shadow-sm">
              {grnMutation.isPending ? 'Creating...' : 'Create GRN (Manual)'}
            </button>
          </div>
        </div>

        {/* Right: LD + Final Acceptance */}
        <div className="space-y-6">
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
              <div className="space-y-2">
                {dashboard.milestones.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        m.status === 'completed' || m.status === 'delivered' ? 'bg-emerald-500' : 'bg-amber-400'
                      }`} />
                      <span className="text-gray-900">{m.milestone_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{formatDate(m.due_date)}</span>
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        m.status === 'completed' || m.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryManager;
