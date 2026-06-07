import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ArchiveIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  ExclamationIcon,
} from '@heroicons/react/outline';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const ContractArchiving: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [archiveResult, setArchiveResult] = useState<any | null>(null);

  const { data: contract, isLoading, refetch } = useQuery({
    queryKey: ['contract-archive', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const checklistCount = contract?.closure_checklists?.length || 0;
  const latestChecklist = checklistCount ? contract!.closure_checklists[checklistCount - 1] : undefined;
  const archiveEligible = ['completed', 'closed', 'archived'].includes(contract?.status || '');
  const archiveReadyDate = contract?.completed_at ? addDays(contract.completed_at, 30) : null;
  const archiveBlockedByRetention = Boolean(archiveReadyDate && new Date() < archiveReadyDate && contract?.status !== 'archived');
  const archiveWindowLabel = archiveReadyDate
    ? archiveReadyDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const archiveMutation = useMutation({
    mutationFn: () => contractsApi.archive(id!),
    onSuccess: async (data) => {
      setArchiveResult(data);
      toast.success('Contract archived successfully');
      await refetch();
    },
    onError: (err: any) => {
      const apiError = err?.response?.data?.error || 'Failed to archive contract';
      toast.error(apiError);
    },
  });

  const archiveSummary = useMemo(() => {
    if (!archiveResult) return null;
    return {
      archiveFilename: archiveResult.archive_filename || `ZAMMSA-${contract?.contract_number}-ARCHIVE.zip.enc`,
      encryption: archiveResult.encryption || 'AES-256',
      retentionExpiry: archiveResult.retention_expiry ? formatDate(archiveResult.retention_expiry) : '7 years',
      legalHold: archiveResult.legal_hold ? 'Active' : 'None',
      message: archiveResult.message,
    };
  }, [archiveResult, contract?.contract_number]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-gray-500">
        Contract not found
      </div>
    );
  }

  const showSuccess = Boolean(archiveSummary || contract.archived_at);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Automated Archiving</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {contract.contract_number} | {contract.title || contract.vendor_name || 'Archive workflow'}
          </p>
        </div>
        <button
          onClick={() => navigate(`/contracts/${contract.id}`)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back to Contract
        </button>
      </div>

      {showSuccess ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center">
            <ArchiveIcon className="w-16 h-16 text-zammsa-green mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Archive Created Successfully</h2>
            <p className="text-sm text-gray-500">
              {archiveSummary?.message || 'The contract archive has been created and the record is now retained for compliance.'}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Archive File</p>
              <p className="mt-1 font-semibold text-gray-900 break-all">
                {archiveSummary?.archiveFilename || `ZAMMSA-${contract.contract_number}-ARCHIVE.zip.enc`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Encryption</p>
              <p className="mt-1 font-semibold text-gray-900">{archiveSummary?.encryption || 'AES-256'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Retention Expiry</p>
              <p className="mt-1 font-semibold text-gray-900">
                {archiveSummary?.retentionExpiry || formatDate(contract.retention_expiry)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Legal Hold</p>
              <p className="mt-1 font-semibold text-gray-900">{archiveSummary?.legalHold || (contract.legal_hold ? 'Active' : 'None')}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigate('/contracts')}
              className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold"
            >
              View Contracts
            </button>
            <button
              onClick={() => navigate(`/contracts/${contract.id}`)}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-700"
            >
              Open Contract Detail
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Status</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={contract.status} />
                <span className="text-sm text-gray-500">{contract.status === 'archived' ? 'Already archived' : 'Ready for records review'}</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completion Date</p>
              <p className="mt-2 text-lg font-bold text-gray-900">{formatDate(contract.completed_at)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Earliest Archive Date</p>
              <p className="mt-2 text-lg font-bold text-gray-900">{archiveWindowLabel}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-zammsa-green shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Archive Preconditions</h2>
                <p className="text-sm text-gray-500 mt-1">
                  The backend will only archive completed contracts, and it enforces a 30-day waiting period unless a records workflow forces it.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { ok: archiveEligible, label: 'Contract status is completed, closed, or archived' },
                { ok: Boolean(contract.completed_at), label: 'Closure checklist is completed' },
                { ok: !archiveBlockedByRetention || contract.status === 'archived', label: '30-day retention window has elapsed' },
                { ok: !contract.legal_hold, label: 'No legal hold is active' },
              ].map((item) => (
                <div key={item.label} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${item.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-center gap-3">
                    {item.ok ? (
                      <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ExclamationIcon className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {item.ok ? 'Ready' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {latestChecklist && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClockIcon className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Closure Checklist Snapshot</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-4">Deliverables: <span className="font-semibold">{latestChecklist.all_deliverables_received ? 'Complete' : 'Pending'}</span></div>
                <div className="rounded-xl bg-gray-50 p-4">Inspection: <span className="font-semibold">{latestChecklist.final_inspection_passed ? 'Complete' : 'Pending'}</span></div>
                <div className="rounded-xl bg-gray-50 p-4">Payments: <span className="font-semibold">{latestChecklist.all_payments_processed ? 'Complete' : 'Pending'}</span></div>
                <div className="rounded-xl bg-gray-50 p-4">Security: <span className="font-semibold">{latestChecklist.performance_security_released ? 'Released' : 'Held'}</span></div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <LockClosedIcon className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Archive Action</p>
                <p className="text-sm text-gray-600 mt-1">
                  This will create the encrypted archive package and update the contract record to archived status.
                </p>
                {archiveBlockedByRetention && contract.status !== 'archived' && (
                  <p className="text-sm text-amber-700 mt-2">
                    Archive is not yet available. Earliest archive date: {archiveWindowLabel}.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => archiveMutation.mutate()}
                disabled={!archiveEligible || archiveBlockedByRetention || archiveMutation.isPending}
                className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                <ArchiveIcon className="w-5 h-5" />
                {archiveMutation.isPending ? 'Archiving...' : 'Archive Contract'}
              </button>
              <button
                onClick={() => navigate(`/contracts/${contract.id}`)}
                className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700"
              >
                Back to Contract
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContractArchiving;
