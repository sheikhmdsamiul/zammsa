import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, ClockIcon, ExclamationIcon,
  BanIcon, DocumentTextIcon,
} from '@heroicons/react/outline';

const StandstillMonitor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [published, setPublished] = useState(false);
  const [appealModal, setAppealModal] = useState(false);
  const [appealGrounds, setAppealGrounds] = useState('');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: () => contractsApi.publishAward(id!),
    onSuccess: () => {
      setPublished(true);
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      toast.success('Award notice published. Standstill period started.');
    },
    onError: () => toast.error('Failed to publish award notice'),
  });

  const fileAppealMutation = useMutation({
    mutationFn: () => contractsApi.fileAppeal(id!, { grounds: appealGrounds }),
    onSuccess: () => {
      toast.success('Appeal logged');
      setAppealModal(false);
    },
    onError: () => toast.error('Failed to log appeal'),
  });

  const activateMutation = useMutation({
    mutationFn: () => contractsApi.activateAfterWaiting(id!),
    onSuccess: () => {
      navigate(`/contracts/${id}/signing`);
      toast.success('Standstill period expired. Ready for contract signing.');
    },
    onError: () => toast.error('Failed to activate'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) return <p className="text-center text-gray-500 py-12">Contract not found</p>;

  const standstillStart = contract.award_notice_published_at
    ? new Date(contract.award_notice_published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const standstillEnd = contract.waiting_period_end
    ? new Date(contract.waiting_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const appealLogged = false;
  const standstillExpired = published && !appealLogged;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Contract Award & Standstill</h1>
            <StatusBadge status={published ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract.contract_number} | {contract.vendor_name}</p>
        </div>
      </div>

      {!published && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Award Notice</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <p className="text-sm font-bold text-gray-900 mb-2">CONTRACT AWARD NOTICE</p>
            <p className="text-sm text-gray-600 mb-1">Reference: {contract.contract_number}</p>
            <p className="text-sm text-gray-600 mb-1">Awarded to: {contract.vendor_name}</p>
            <p className="text-sm text-gray-600 mb-1">Award Value: K {contract.value?.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-3">This award is subject to a mandatory 10-working-day standstill period during which aggrieved bidders may submit a formal appeal.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked className="text-zammsa-green rounded" />
              ZAMMSA Public Portal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked className="text-zammsa-green rounded" />
              ZPPA e-GP Portal
            </label>
          </div>

          <button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}
            className="mt-6 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {publishMutation.isPending ? 'Publishing...' : 'Publish Award Notice & Start Standstill'}
          </button>
        </div>
      )}

      {published && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Standstill Period</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-medium">Started</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{standstillStart}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-medium">Expires</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{standstillEnd}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-medium">Elapsed</p>
                <p className="text-sm font-bold text-gray-900 mt-1">In progress</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-medium">Remaining</p>
                <p className="text-sm font-bold text-gray-900 mt-1">10 working days</p>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div className="bg-zammsa-green h-2 rounded-full" style={{ width: '50%' }} />
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">Appeals Received: 0 — No issues</span>
              </div>
              <StatusBadge status="active" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications Sent</h2>
            <div className="space-y-3">
              {[
                { label: 'Winner (Lusaka Reagents)', desc: 'Award notification sent', done: true },
                { label: 'Losers (5 suppliers)', desc: 'Unsuccessful notifications sent', done: true },
                { label: 'Public portal', desc: 'Award notice published', done: true },
                { label: 'ZPPA e-GP', desc: 'Award notice published', done: true },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{n.label}</p>
                    <p className="text-xs text-gray-500">{n.desc}</p>
                  </div>
                  {n.done ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ClockIcon className="w-5 h-5 text-amber-500" />}
                </div>
              ))}
            </div>
          </div>

          {appealModal && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-amber-900 mb-4">Log Incoming Appeal</h2>
              <textarea value={appealGrounds} onChange={(e) => setAppealGrounds(e.target.value)} rows={3}
                className="w-full border border-amber-300 rounded-lg px-4 py-3 text-sm mb-4" placeholder="Describe grounds of appeal..." />
              <div className="flex gap-3">
                <button onClick={() => fileAppealMutation.mutate()} disabled={!appealGrounds || fileAppealMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold">Log Appeal</button>
                <button onClick={() => setAppealModal(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {standstillExpired && !appealModal && (
            <div className="flex justify-end gap-3">
              <button onClick={() => setAppealModal(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold">
                Log Incoming Appeal
              </button>
              <button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">
                Standstill Expired — Generate Contract
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StandstillMonitor;
