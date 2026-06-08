import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/outline';

const checklistFields = [
  'all_deliverables_received',
  'final_inspection_passed',
  'acceptance_certificate_issued',
  'all_invoices_submitted_approved',
  'all_payments_processed',
  'liquidated_damages_deducted',
  'retention_released',
  'no_outstanding_disputes',
  'performance_security_released',
  'no_pending_amendments',
  'supplier_evaluation_completed',
  'all_docs_saved',
] as const;

const ContractClosureChecklist: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const emptyChecks = useMemo(() => checklistFields.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as Record<(typeof checklistFields)[number], boolean>), []);

  const [checks, setChecks] = useState<Record<string, boolean>>(emptyChecks);
  const [closureNotes, setClosureNotes] = useState('');
  const [completed, setCompleted] = useState(false);

  const checklistCount = contract?.closure_checklists?.length || 0;
  const existingChecklist = checklistCount ? contract!.closure_checklists[checklistCount - 1] : undefined;

  useEffect(() => {
    if (!existingChecklist) {
      setChecks(emptyChecks);
      setClosureNotes('');
      setCompleted(false);
      return;
    }

    setChecks({
      all_deliverables_received: Boolean(existingChecklist.all_deliverables_received),
      final_inspection_passed: Boolean(existingChecklist.final_inspection_passed),
      acceptance_certificate_issued: Boolean(existingChecklist.acceptance_certificate_issued),
      all_invoices_submitted_approved: Boolean(existingChecklist.all_invoices_submitted_approved),
      all_payments_processed: Boolean(existingChecklist.all_payments_processed),
      liquidated_damages_deducted: Boolean(existingChecklist.liquidated_damages_deducted),
      retention_released: Boolean(existingChecklist.retention_released),
      no_outstanding_disputes: Boolean(existingChecklist.no_outstanding_disputes),
      performance_security_released: Boolean(existingChecklist.performance_security_released),
      no_pending_amendments: Boolean(existingChecklist.no_pending_amendments),
      supplier_evaluation_completed: Boolean(existingChecklist.supplier_evaluation_completed),
      all_docs_saved: Boolean(existingChecklist.all_docs_saved),
    });
    setClosureNotes(existingChecklist.notes || '');
    setCompleted(Boolean(existingChecklist.is_complete || existingChecklist.status === 'completed' || contract?.status === 'completed'));
  }, [contract, existingChecklist, emptyChecks]);

  const checklistItems = [
    { key: 'all_deliverables_received', label: 'All items delivered per GRN' },
    { key: 'final_inspection_passed', label: 'Final inspection completed and goods accepted' },
    { key: 'acceptance_certificate_issued', label: 'Acceptance certificate issued' },
    { key: 'all_invoices_submitted_approved', label: 'All invoices submitted and approved' },
    { key: 'all_payments_processed', label: 'All payments made excluding retention' },
    { key: 'liquidated_damages_deducted', label: 'Liquidated damages deducted (if applicable)' },
    { key: 'retention_released', label: 'Retention released (30 days post-acceptance)' },
    { key: 'no_outstanding_disputes', label: 'No outstanding invoices or disputes' },
    { key: 'performance_security_released', label: 'Performance security released (60 days after acceptance)' },
    { key: 'no_pending_amendments', label: 'No pending contract amendments or disputes' },
    { key: 'supplier_evaluation_completed', label: 'Supplier performance evaluation completed' },
    { key: 'all_docs_saved', label: 'All contract documents saved and accessible' },
  ];

  const allChecked = Object.values(checks).every(Boolean);
  const checkedCount = Object.values(checks).filter(Boolean).length;
  const totalItems = checklistItems.length;

  const closureMutation = useMutation({
    mutationFn: () => contractsApi.closureChecklist(id!, { ...checks, notes: closureNotes }),
    onSuccess: () => {
      setCompleted(true);
      toast.success('Contract closed successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to close contract'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => contractsApi.archive(id!),
    onSuccess: () => {
      toast.success('Contract archived successfully');
      navigate('/contracts');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to archive contract'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Contract Closure</h1>
            <StatusBadge status={completed ? 'completed' : contract?.status || 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract?.contract_number || '---'} | {contract?.vendor_name || '---'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Closure Checklist</h2>
          <span className="text-sm text-gray-500">{checkedCount} of {totalItems} items</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className="bg-zammsa-green h-2 rounded-full transition-all" style={{ width: `${(checkedCount / totalItems) * 100}%` }} />
        </div>

        <div className="space-y-3">
          {checklistItems.map((item) => (
            <div key={item.key} className={`flex items-center justify-between p-4 rounded-xl transition-colors ${checks[item.key] ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {checks[item.key]
                  ? <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                  : <XCircleIcon className="w-6 h-6 text-gray-300 shrink-0" />
                }
                <span className={`text-sm font-medium ${checks[item.key] ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </div>
              <button
                onClick={() => setChecks(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  checks[item.key]
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {checks[item.key] ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {allChecked && !completed && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Closure Notes</h2>
            <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} rows={3}
              className="w-full border rounded-lg px-4 py-3 text-sm"
              placeholder="Enter closure notes..." />
            <button onClick={() => closureMutation.mutate()} disabled={closureMutation.isPending}
              className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
              {closureMutation.isPending ? 'Closing...' : 'Mark Contract as COMPLETED'}
            </button>
          </div>
        </>
      )}

      {completed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Contract Closed Successfully</h2>
          <div className="max-w-md mx-auto bg-white rounded-xl p-6 text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Supplier</span><span className="font-medium">{contract?.vendor_name || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Contract Value</span><span className="font-medium">K {contract?.value?.toLocaleString() || '---'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Performance</span><span className="font-medium text-zammsa-green">Completed</span></div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}
              className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold">
              {archiveMutation.isPending ? 'Archiving...' : 'Archive Now'}
            </button>
            <button onClick={() => navigate('/contracts')} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold">
              Back to Contracts
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractClosureChecklist;
