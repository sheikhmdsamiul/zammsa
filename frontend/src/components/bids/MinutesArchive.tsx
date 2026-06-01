import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, DownloadIcon, EyeIcon, MailIcon, XCircleIcon,
} from '@heroicons/react/outline';

const MinutesArchive: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bid-openings-minutes', page, pageSize, search],
    queryFn: () => bidsApi.listOpenings({ page, page_size: pageSize, search, status: 'completed' }),
  });

  const handleViewMinutes = async (openingId: string) => {
    try {
      const minutes = await bidsApi.getMinutes(openingId);
      if (minutes?.minutes_content) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`<pre style="font-family: monospace; padding: 20px; font-size: 14px;">${minutes.minutes_content}</pre>`);
          win.document.close();
        }
      } else {
        toast.success('Minutes retrieved');
      }
    } catch {
      toast.error('Failed to load minutes');
    }
  };

  const handleDownload = async (openingId: string) => {
    try {
      const minutes = await bidsApi.getMinutes(openingId);
      if (minutes?.minutes_content) {
        const blob = new Blob([minutes.minutes_content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bid-opening-minutes-${openingId.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Minutes downloaded');
      }
    } catch {
      toast.error('Failed to download minutes');
    }
  };

  const handleResend = async (openingId: string) => {
    try {
      await bidsApi.sendMinutes(openingId);
      toast.success('Minutes resent to all bidders');
    } catch {
      toast.error('Failed to resend minutes');
    }
  };

  const columns = [
    { key: 'solicitation_number', label: 'Solicitation #', render: (v: string, row: any) => (
      <span className="font-medium">{v || row.solicitation_number || row.solicitation?.sol_number || '---'}</span>
    )},
    { key: 'solicitation_title', label: 'Title', render: (v: string, row: any) => (
      <span className="text-gray-600 truncate max-w-[200px] block">{v || row.solicitation_title || row.solicitation?.title || '---'}</span>
    )},
    { key: 'opened_at', label: 'Opening Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'conducted_by_name', label: 'Conducted By', render: (v: string, row: any) => v || row.conducted_by_name || '-' },
    { key: 'total_bids', label: 'Total Bids', render: (v: number, row: any) => v ?? row.total_bids ?? '-' },
    { key: 'viewers_connected', label: 'Viewers', render: (v: number) => v || 0 },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'completed'} /> },
    { key: 'id', label: '', render: (_: any, row: any) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); handleViewMinutes(row.opening_id || row.id); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Minutes">
          <EyeIcon className="w-4 h-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDownload(row.opening_id || row.id); }}
          className="p-1.5 text-zammsa-green hover:bg-green-50 rounded-lg" title="Download">
          <DownloadIcon className="w-4 h-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleResend(row.opening_id || row.id); }}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Resend to Bidders">
          <MailIcon className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  const completedOpenings = data?.results || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minutes Archive"
        description="View, download, and resend bid opening minutes"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by solicitation..." /></div>
            <span className="text-sm text-gray-400">{data?.count || 0} completed openings</span>
          </div>
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={completedOpenings} />
        )}
        {!completedOpenings.length && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No minutes archived yet</p>
            <p className="text-sm mt-1">Completed bid openings will appear here</p>
          </div>
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil((data.count || 0) / pageSize)} pageSize={pageSize}
            totalItems={data.count || 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default MinutesArchive;
