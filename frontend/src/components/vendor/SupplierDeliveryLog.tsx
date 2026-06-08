import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { Contract } from '../../types';
import { formatContractValue } from '../contracts/contractUtils';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';

interface DeliveryItem {
  item_code: string;
  item_name: string;
  quantity_ordered: number;
  quantity_delivered: number;
  unit_price: number;
  total_amount: number;
}

const emptyItem: DeliveryItem = {
  item_code: '', item_name: '', quantity_ordered: 0,
  quantity_delivered: 0, unit_price: 0, total_amount: 0,
};

const SupplierDeliveryLog: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedContract, setSelectedContract] = React.useState(contractId || '');
  const [grnNumber, setGrnNumber] = React.useState('');
  const [items, setItems] = React.useState<DeliveryItem[]>([{ ...emptyItem }]);
  const [notes, setNotes] = React.useState('');

  useEffect(() => {
    if (contractId) {
      setSelectedContract(contractId);
    }
  }, [contractId]);

  const { data: contractsData } = useQuery({
    queryKey: ['vendor-contracts-for-delivery'],
    queryFn: () => vendorApi.contracts.list({ page_size: 100, status__in: 'active' }),
  });

  const activeContracts = ((contractsData?.results || []) as Contract[]).filter(
    (c) => c.status === 'active'
  );

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof DeliveryItem, value: string) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const newItem = { ...item, [field]: value };
      if (field === 'quantity_delivered' || field === 'unit_price') {
        const qty = field === 'quantity_delivered' ? Number(value) : item.quantity_delivered;
        const price = field === 'unit_price' ? Number(value) : item.unit_price;
        newItem.total_amount = qty * price;
      }
      return newItem;
    });
    setItems(updated);
  };

  const totalAmount = items.reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalQty = items.reduce((s, i) => s + (i.quantity_delivered || 0), 0);

  const deliveryMutation = useMutation({
    mutationFn: () => vendorApi.invoices.logDelivery({
      contract_id: selectedContract,
      grn_number: grnNumber || undefined,
      items: items.map(i => ({
        ...i,
        quantity_ordered: i.quantity_ordered || 0,
        quantity_delivered: i.quantity_delivered || 0,
      })),
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contracts'] });
      toast.success('Delivery logged successfully');
      navigate('/vendor/contracts', { replace: true });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to log delivery');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) { toast.error('Please select a contract'); return; }
    if (items.some(i => !i.item_name || !i.quantity_delivered || !i.unit_price)) {
      toast.error('Please fill in all item fields');
      return;
    }
    deliveryMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/vendor/contracts" className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log Delivery</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record goods delivered against an active contract</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Contract & Delivery Reference</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contract <span className="text-rose-500">*</span></label>
              <select value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none"
                required>
                <option value="">Select an active contract...</option>
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} — {c.title || 'Supply Contract'} ({formatContractValue(c.value, c.currency)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Note Number</label>
              <input value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none"
                placeholder="Auto-generated if left blank" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Delivery Items</h2>
            <button type="button" onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 border border-zammsa-green text-zammsa-green rounded-xl text-sm font-bold hover:bg-zammsa-green/5">
              <PlusIcon className="w-4 h-4" /> Add Item
            </button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase">Item #{idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)}
                    className="text-rose-500 hover:text-rose-700">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Code</label>
                  <input value={item.item_code} onChange={(e) => updateItem(idx, 'item_code', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. ITM-001" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name <span className="text-rose-500">*</span></label>
                  <input value={item.item_name} onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Toner Cartridge" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Qty Ordered</label>
                  <input type="number" min="0" step="1" value={item.quantity_ordered || ''}
                    onChange={(e) => updateItem(idx, 'quantity_ordered', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Qty Delivered <span className="text-rose-500">*</span></label>
                  <input type="number" min="0" step="1" value={item.quantity_delivered || ''}
                    onChange={(e) => updateItem(idx, 'quantity_delivered', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Price (ZMW) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 font-bold text-sm">K</span>
                    <input type="number" min="0" step="0.01" value={item.unit_price || ''}
                      onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 font-bold text-sm">K</span>
                    <input type="text" readOnly value={item.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      className="w-full border border-gray-100 bg-gray-50 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-700" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length > 1 && (
            <div className="flex items-center justify-end gap-6 pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-600">Total Quantity: <strong>{totalQty}</strong></span>
              <span className="text-sm text-gray-600">Total Amount: <strong>K {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none"
            placeholder="Optional delivery notes, remarks, or observations..." />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Link to="/vendor/contracts"
            className="px-6 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all text-center">
            Cancel
          </Link>
          <button type="submit" disabled={deliveryMutation.isPending}
            className="px-10 py-3 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zammsa-green/20 transition-all flex items-center gap-2">
            {deliveryMutation.isPending ? (
              <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Submitting...</>
            ) : (
              'Log Delivery'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierDeliveryLog;
