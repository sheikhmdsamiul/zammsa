import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  CheckCircleIcon, XCircleIcon, ClipboardListIcon, UserGroupIcon,
} from '@heroicons/react/outline';
import api from '../../api/client';

type PQStatus = 'pending' | 'cleared' | 'failed';

interface PostQualificationRecord {
  id: string;
  bidder: string;
  bidder_name: string;
  ber?: string | null;
  status: PQStatus;
  verification_items: Record<string, any>;
  verified_at?: string | null;
}

const PostQualification: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['post-qualifications', page, pageSize, search],
    queryFn: () => api.get('/evaluations/post-qualifications/', { params: { page, page_size: pageSize, search } }).then((r) => r.data),
  });

  const pqs = data?.results || [];

  const pending = pqs.filter((p: PostQualificationRecord) => p.status === 'pending').length;
  const preBer = pqs.filter((p: PostQualificationRecord) => !p.ber).length;
  const cleared = pqs.filter((p: PostQualificationRecord) => p.status === 'cleared').length;
  const failed = pqs.filter((p: PostQualificationRecord) => p.status === 'failed').length;

  const columns = [
    { key: 'id', label: 'ID', render: (_: any, row: any) => (
      <span className="font-mono text-xs">{row.id?.slice(0, 8) || '---'}</span>
    )},
    { key: 'bidder_name', label: 'Bidder' },
    { key: 'ber', label: 'BER', render: (v: string) => v ? v.slice(0, 8) : '-' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'pending'} /> },
    { key: 'verification_items', label: 'Checks', render: (v: Record<string, any>) => (
      <span className="text-sm max-w-[200px] block truncate">{v ? Object.keys(v).length : 0} item(s)</span>
    )},
    { key: 'verified_at', label: 'Verified', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Post-Qualification"
        description="Verify bidder capabilities, references, and compliance before award"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={pending} icon={<ClipboardListIcon className="w-6 h-6" />} color="orange" />
        <StatCard label="Pre-BER" value={preBer} icon={<UserGroupIcon className="w-6 h-6" />} color="blue" />
        <StatCard label="Cleared" value={cleared} icon={<CheckCircleIcon className="w-6 h-6" />} color="green" />
        <StatCard label="Failed" value={failed} icon={<XCircleIcon className="w-6 h-6" />} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by bidder name..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={pqs} />
        )}
        {!pqs.length && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <ClipboardListIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No post-qualification records</p>
            <p className="text-sm mt-1">Post-qualification checks appear after winner selection and before BER generation</p>
          </div>
        )}
        {data && (
          <Pagination currentPage={page}
            totalPages={Math.ceil((data.count || 0) / pageSize)}
            pageSize={pageSize} totalItems={data.count || 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default PostQualification;
