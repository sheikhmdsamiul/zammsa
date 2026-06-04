import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, ClockIcon, DocumentTextIcon,
} from '@heroicons/react/outline';

interface NoticeRecord {
  id: string;
  contract_number: string;
  title: string;
  vendor_name: string;
  award_date: string | null;
  award_notice_published: boolean;
  award_notice_published_at: string | null;
  waiting_period_end: string | null;
  appeal_pending: boolean;
}

const AwardNotices: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: contractsResp, isLoading, error } = useQuery({
    queryKey: ['contracts-for-award-notices'],
    queryFn: () => contractsApi.list({ page_size: 100 }),
  });

  const publishMutation = useMutation({
    mutationFn: (contractId: string) => contractsApi.publishAward(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts-for-award-notices'] });
      toast.success('Award notice published');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to publish award notice'),
  });

  const contracts: NoticeRecord[] = (contractsResp?.results || []).map((c: any) => ({
    id: c.id,
    contract_number: c.contract_number,
    title: c.title,
    vendor_name: c.vendor_name || 'Unknown',
    award_date: c.award_date || null,
    award_notice_published: c.award_notice_published || false,
    award_notice_published_at: c.award_notice_published_at || null,
    waiting_period_end: c.waiting_period_end || null,
    appeal_pending: c.appeal_pending || false,
  }));

  const published = contracts.filter(c => c.award_notice_published);
  const needsPublishing = contracts.filter(c => !c.award_notice_published);

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error || !contracts.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">No award notices</h2>
        <p className="mt-2 text-gray-500">Award notices will appear here after contracts are generated.</p>
      </div>
    );
  }

  const renderTable = (records: NoticeRecord[], emptyMsg: string) => (
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
          <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Vendor</th>
          <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
          <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/contracts/${record.id}`)}>
            <td className="px-6 py-4">
              <div className="font-bold text-gray-900">{record.contract_number}</div>
              <div className="text-xs text-gray-600 truncate max-w-xs">{record.title}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-gray-700">{record.vendor_name}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              {record.award_notice_published ? (
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-emerald-700">
                    Published {record.award_notice_published_at
                      ? new Date(record.award_notice_published_at).toLocaleDateString('en-GB')
                      : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-amber-700">Not published</span>
                </div>
              )}
              {record.appeal_pending && (
                <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">Appeal pending</span>
              )}
            </td>
            <td className="px-6 py-4 text-center">
              {!record.award_notice_published && (
                <button
                  onClick={(e) => { e.stopPropagation(); publishMutation.mutate(record.id); }}
                  disabled={publishMutation.isPending}
                  className="px-3 py-1.5 bg-zammsa-green text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {publishMutation.isPending ? 'Publishing...' : 'Publish Award Notice'}
                </button>
              )}
              {record.award_notice_published && !record.waiting_period_end && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${record.id}/standstill`); }}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg"
                >
                  Standstill
                </button>
              )}
              {record.award_notice_published && record.waiting_period_end && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${record.id}/signing`); }}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg"
                >
                  Signing
                </button>
              )}
            </td>
          </tr>
        ))}
        {records.length === 0 && (
          <tr>
            <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">{emptyMsg}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Award Notices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track award notice publication and standstill period compliance
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-500"></span>
            Total: {contracts.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            Needs Publishing: {needsPublishing.length}
          </span>
        </div>
      </div>

      {needsPublishing.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
            <h2 className="text-sm font-bold text-amber-800">Awaiting Publication ({needsPublishing.length})</h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(needsPublishing, 'No contracts awaiting publication')}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">Published Award Notices ({published.length})</h2>
        </div>
        <div className="overflow-x-auto">
          {renderTable(published, 'No published award notices')}
        </div>
      </div>
    </div>
  );
};

export default AwardNotices;
