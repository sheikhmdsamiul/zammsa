import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { contractsApi } from '../../api/contracts';
import { financeApi } from '../../api/finance';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CashIcon, CheckCircleIcon, XCircleIcon, ExclamationIcon,
  ArrowLeftIcon, ShieldCheckIcon, ClockIcon,
} from '@heroicons/react/outline';

const RetentionReleasePanel: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [certRef, setCertRef] = useState('');
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);

  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['contract-financial-summary', id],
    queryFn: () => vendorApi.contracts.financialSummary(id!),
    enabled: !!id,
  });

  const releaseMutation = useMutation({
    mutationFn: () => financeApi.releaseRetention(id!, {
      amount: Number(amount),
      acceptance_certificate_ref: certRef || undefined,
      notes: notes || undefined,
      override: override || undefined,
    }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Retention released successfully');
      queryClient.invalidateQueries({ queryKey: ['contract-financial-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      setAmount('');
      setCertRef('');
      setNotes('');
      setOverride(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to release retention'),
  });

  const isLoading = contractLoading || summaryLoading;
  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!contract || !summary) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
      <ExclamationIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p className="text-xl font-bold text-gray-500">Contract data not found</p>
      <Link to="/contracts" className="mt-4 text-zammsa-green font-bold hover:underline inline-block">Back to contracts</Link>
    </div>
  );

  const retainedToDate = summary.retained_to_date;
  const releasedToDate = summary.retention_released_to_date;
  const availableForRelease = Math.max(retainedToDate - releasedToDate, 0);
  const retentionRate = summary.retention_rate;

  const completedAt = contract.completed_at ? new Date(contract.completed_at) : null;
  const releasableOn = completedAt ? new Date(completedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const isGatePassed = releasableOn ? now >= releasableOn : false;
  const daysRemaining = releasableOn && !isGatePassed
    ? Math.ceil((releasableOn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const maxAmount = Math.min(availableForRelease, Number(amount) || 0);

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/contracts/${id}`)} className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Retention Release</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contract.contract_number} — {contract.title}</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Retained</p>
          <p className="text-2xl font-black text-amber-600">K {retainedToDate.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Already Released</p>
          <p className="text-2xl font-black text-emerald-600">K {releasedToDate.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Available for Release</p>
          <p className={`text-2xl font-black ${availableForRelease > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            K {availableForRelease.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Retention Rate</p>
          <p className="text-2xl font-black text-gray-900">{(retentionRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* 30-Day Gate Status */}
      <div className={`rounded-2xl border p-6 ${completedAt ? (isGatePassed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200') : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${completedAt ? (isGatePassed ? 'bg-emerald-100' : 'bg-amber-100') : 'bg-gray-200'}`}>
            {completedAt ? (isGatePassed ? <CheckCircleIcon className="w-6 h-6 text-emerald-600" /> : <ClockIcon className="w-6 h-6 text-amber-600" />) : <XCircleIcon className="w-6 h-6 text-gray-400" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900">
              {!completedAt ? 'Final Acceptance Not Completed' : isGatePassed ? '30-Day Waiting Period Passed' : 'Awaiting 30-Day Waiting Period'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {!completedAt
                ? 'The contract must reach final acceptance (R-12) before retention can be released.'
                : isGatePassed
                ? `Final acceptance was on ${completedAt.toLocaleDateString()}. The 30-day waiting period has ended — retention is ready for release.`
                : `Final acceptance was on ${completedAt.toLocaleDateString()}. Retention becomes releasable on ${releasableOn?.toLocaleDateString()} (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining).`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Release Form */}
      {completedAt && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheckIcon className="w-6 h-6 text-zammsa-green" />
            <h2 className="text-lg font-bold text-gray-900">Release Retention</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Release Amount (K)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                max={availableForRelease}
                step="0.01"
                className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 text-lg font-black focus:border-zammsa-green outline-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-1.5">Max available: K {availableForRelease.toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Acceptance Certificate Reference</label>
              <input
                type="text"
                value={certRef}
                onChange={(e) => setCertRef(e.target.value)}
                placeholder="e.g. FAC-CON-001-2026"
                className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-zammsa-green outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for release..."
                className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm focus:border-zammsa-green outline-none transition-all"
              />
            </div>

            {!isGatePassed && (
              <label className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="text-sm font-bold text-amber-900">Override 30-day waiting period</p>
                  <p className="text-xs text-amber-700">Only use if R-07 has authorized early release.</p>
                </div>
              </label>
            )}

            <button
              onClick={() => releaseMutation.mutate()}
              disabled={!amount || Number(amount) <= 0 || Number(amount) > availableForRelease || releaseMutation.isPending}
              className="w-full py-4 bg-zammsa-green text-white rounded-2xl font-black text-sm hover:bg-zammsa-green-dark disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-zammsa-green/20 transition-all"
            >
              {releaseMutation.isPending ? 'Releasing...' : `Release K ${Number(amount || 0).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetentionReleasePanel;
