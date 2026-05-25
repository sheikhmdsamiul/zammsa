import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/outline';

const ContractAmendments: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('time_extension');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [financialImpact, setFinancialImpact] = useState(0);
  const [hasFinancialChange, setHasFinancialChange] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [amendments, setAmendments] = useState<any[]>([
    { id: 'amd-1', amendment_number: 1, description: 'Time extension due to site renovation at Central Medical Stores Block C', reason: 'Supplier unable to access delivery site', value_change: 0, variation_percentage: 0, signed_by_supplier: true, signed_by_authority: true, approved_by: 'DOP', created_at: '2026-07-25' },
  ]);

  const amendMutation = useMutation({
    mutationFn: () => contractsApi.amend(id!, { reason, description, financial_impact: hasFinancialChange ? financialImpact : 0, legal_opinion_ref: '' }),
    onSuccess: () => {
      toast.success('Amendment submitted for approval');
      setSubmitted(true);
      setShowForm(false);
    },
    onError: () => toast.error('Failed to create amendment'),
  });

  const approveMutation = useMutation({
    mutationFn: (amdId: string) => contractsApi.approveAmendment(id!, amdId),
    onSuccess: () => {
      toast.success('Amendment approved');
      navigate(`/contracts/${id}`);
    },
    onError: () => toast.error('Failed to approve'),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Contract Amendments</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">CON-2026-LAB-11</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Request Amendment</button>
        )}
      </div>

      {amendments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Amendments</h2>
          <div className="space-y-3">
            {amendments.map((a) => (
              <div key={a.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900">Amendment #{a.amendment_number}</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.signed_by_supplier && a.signed_by_authority ? 'approved' : 'pending'} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">{a.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Value change: K {a.value_change?.toLocaleString() || '0'}</span>
                  <span>Variation: {a.variation_percentage || 0}%</span>
                  <span>Created: {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">New Amendment Request</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amendment Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm">
                <option value="time_extension">Time Extension</option>
                <option value="scope_change">Scope Change</option>
                <option value="price_adjustment">Price Adjustment</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Supplier unable to access delivery site..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Detailed description of the amendment..." />
            </div>

            {type === 'time_extension' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Delivery Date</label>
                <input type="date" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm" />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasFinancialChange} onChange={(e) => setHasFinancialChange(e.target.checked)} className="text-zammsa-green rounded" />
                Financial Change
              </label>
              {hasFinancialChange && (
                <input type="number" value={financialImpact} onChange={(e) => setFinancialImpact(Number(e.target.value))}
                  className="mt-2 w-full border rounded-lg px-4 py-2 text-sm" placeholder="Amount (ZMW)" />
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium text-gray-700">Variation Cap Check</p>
              <p className="text-gray-500 mt-1">Original Value: K 1,155,000 | Previous: K 0 | This: K {hasFinancialChange ? financialImpact.toLocaleString() : '0'} | Cap: 25% (K288,750)</p>
              {hasFinancialChange && financialImpact > 288750 && (
                <p className="text-rose-600 font-medium mt-1">⚠ Exceeds variation cap of 25%</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => amendMutation.mutate()} disabled={!reason || !description || amendMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                Submit Amendment for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractAmendments;
