import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { isStandstillExpired } from './contractUtils';
import {
  CheckCircleIcon, ClockIcon, ExclamationIcon,
  DocumentTextIcon, CogIcon, ArrowLeftIcon,
} from '@heroicons/react/outline';

function toInputDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

const StandstillMonitor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [appealModal, setAppealModal] = useState(false);
  const [appealGrounds, setAppealGrounds] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [waitingDays, setWaitingDays] = useState(10);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!contract) return;
    setWaitingDays(contract.waiting_period_days ?? 10);
    setManualStart(toInputDate(contract.waiting_period_start));
    setManualEnd(toInputDate(contract.waiting_period_end));
  }, [contract]);

  const standstillPeriodExpired = useMemo(
    () => (contract ? isStandstillExpired(contract) : false),
    [contract],
  );

  const publishMutation = useMutation({
    mutationFn: () =>
      contractsApi.publishAward(id!, {
        waiting_period_days: waitingDays,
        ...(manualEnd ? { waiting_period_end: manualEnd } : {}),
        ...(manualStart ? { waiting_period_start: manualStart } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Award notice published. Standstill period started.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to publish award notice'),
  });

  const setStandstillMutation = useMutation({
    mutationFn: (payload: Parameters<typeof contractsApi.setStandstill>[1]) =>
      contractsApi.setStandstill(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Standstill period updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update standstill'),
  });

  const fileAppealMutation = useMutation({
    mutationFn: () => contractsApi.fileAppeal(id!, { grounds: appealGrounds }),
    onSuccess: () => {
      toast.success('Appeal logged');
      setAppealModal(false);
      setAppealGrounds('');
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
    },
    onError: () => toast.error('Failed to log appeal'),
  });

  const activateMutation = useMutation({
    mutationFn: () => contractsApi.activateAfterWaiting(id!),
    onSuccess: () => {
      navigate(`/contracts/${id}/signing`);
      toast.success('Standstill period expired. Ready for contract signing.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to activate'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-bold text-gray-500">Contract not found</p>
      </div>
    );
  }

  const noticePublished = contract.award_notice_published;
  const standstillStart = contract.waiting_period_start
    ? new Date(contract.waiting_period_start).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  const standstillEnd = contract.waiting_period_end
    ? new Date(contract.waiting_period_end).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const startTs = contract.waiting_period_start
    ? new Date(contract.waiting_period_start).getTime()
    : contract.award_notice_published_at
      ? new Date(contract.award_notice_published_at).getTime()
      : null;
  const endTs = contract.waiting_period_end ? new Date(contract.waiting_period_end).getTime() : null;

  const standstillElapsedPct =
    noticePublished && startTs && endTs && endTs > startTs
      ? Math.min(
          100,
          Math.max(0, Math.round(((Date.now() - startTs) / (endTs - startTs)) * 100)),
        )
      : standstillPeriodExpired
        ? 100
        : 0;

  const appealLogged = contract.appeal_pending;
  const canActivate = noticePublished && standstillPeriodExpired && !appealLogged;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to={`/contracts/${id}`}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900"
              aria-label="Back to contract"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Contract Award and Standstill</h1>
            <StatusBadge status={standstillPeriodExpired ? 'completed' : noticePublished ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-11">
            {contract.contract_number} · {contract.vendor_name}
          </p>
        </div>
      </div>

      {/* Manual standstill configuration */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 w-full"
        >
          <CogIcon className="w-5 h-5" />
          {showManual ? 'Hide' : 'Show'} manual standstill settings (for testing)
        </button>
        {showManual && (
          <div className="mt-4 space-y-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Set the standstill end date to today ({todayIso}) or earlier to proceed to signing immediately.
              On the end date itself, the period is considered complete.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Working days</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={waitingDays}
                  onChange={(e) => setWaitingDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Start date</label>
                <input
                  type="date"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">End date</label>
                <input
                  type="date"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={setStandstillMutation.isPending}
                onClick={() =>
                  setStandstillMutation.mutate({
                    waiting_period_days: waitingDays,
                    waiting_period_start: manualStart || undefined,
                    waiting_period_end: manualEnd || undefined,
                    publish_award: !noticePublished,
                  })
                }
                className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                Save dates
              </button>
              <button
                type="button"
                disabled={setStandstillMutation.isPending}
                onClick={() =>
                  setStandstillMutation.mutate({
                    expire_now: true,
                    publish_award: !noticePublished,
                  })
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                End standstill today
              </button>
              <button
                type="button"
                disabled={setStandstillMutation.isPending || !manualStart}
                onClick={() =>
                  setStandstillMutation.mutate({
                    waiting_period_days: waitingDays,
                    waiting_period_start: manualStart,
                    recalculate_end: true,
                    publish_award: !noticePublished,
                  })
                }
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                Recalculate end from working days
              </button>
            </div>
          </div>
        )}
      </div>

      {!noticePublished && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Award Notice</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <p className="text-sm font-bold text-gray-900 mb-2">CONTRACT AWARD NOTICE</p>
            <p className="text-sm text-gray-600 mb-1">Reference: {contract.contract_number}</p>
            <p className="text-sm text-gray-600 mb-1">Awarded to: {contract.vendor_name}</p>
            <p className="text-sm text-gray-600 mb-1">Award Value: K {contract.value?.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-3">
              Mandatory standstill: {waitingDays} working day(s). Use manual settings above to set a custom end date
              before publishing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing...' : 'Publish Award Notice and Start Standstill'}
          </button>
        </div>
      )}

      {noticePublished && (
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
                <p className="text-sm font-bold text-gray-900 mt-1">{standstillElapsedPct}%</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-medium">Status</p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {standstillPeriodExpired ? 'Complete' : 'In progress'}
                </p>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                className={`h-2 rounded-full transition-all ${standstillPeriodExpired ? 'bg-emerald-500' : 'bg-zammsa-green'}`}
                style={{ width: `${standstillElapsedPct}%` }}
              />
            </div>

            {standstillPeriodExpired && !appealLogged && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                Standstill has ended. You can proceed to contract signing.
              </div>
            )}

            {appealLogged ? (
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExclamationIcon className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Appeal pending — standstill extended</span>
                </div>
                <StatusBadge status="pending" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">No appeals filed</span>
                </div>
                <StatusBadge status="active" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications Sent</h2>
            <div className="space-y-3">
              {[
                { label: `Winner (${contract.vendor_name})`, desc: 'Award notification sent', done: noticePublished },
                { label: 'Unsuccessful bidders', desc: 'Notification status pending', done: false },
                {
                  label: 'ZAMMSA Public Portal',
                  desc: noticePublished ? 'Award notice published' : 'Not yet published',
                  done: noticePublished,
                },
                {
                  label: 'ZPPA e-GP Portal',
                  desc: noticePublished ? 'Award notice forwarded' : 'Not yet forwarded',
                  done: noticePublished,
                },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{n.label}</p>
                    <p className="text-xs text-gray-500">{n.desc}</p>
                  </div>
                  {n.done ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {appealModal && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-amber-900 mb-4">Log Incoming Appeal</h2>
              <textarea
                value={appealGrounds}
                onChange={(e) => setAppealGrounds(e.target.value)}
                rows={3}
                className="w-full border border-amber-300 rounded-lg px-4 py-3 text-sm mb-4"
                placeholder="Describe grounds of appeal..."
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileAppealMutation.mutate()}
                  disabled={!appealGrounds || fileAppealMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold"
                >
                  Log Appeal
                </button>
                <button
                  type="button"
                  onClick={() => setAppealModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 flex-wrap">
            {!appealLogged && (
              <button
                type="button"
                onClick={() => setAppealModal(true)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold"
              >
                Log Incoming Appeal
              </button>
            )}
            {canActivate && (
              <button
                type="button"
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
              >
                {activateMutation.isPending ? 'Activating...' : 'Proceed to Contract Signing'}
              </button>
            )}
            {noticePublished && !standstillPeriodExpired && (
              <button
                type="button"
                onClick={() => setStandstillMutation.mutate({ expire_now: true })}
                disabled={setStandstillMutation.isPending}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-bold"
              >
                End standstill now (test)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StandstillMonitor;
