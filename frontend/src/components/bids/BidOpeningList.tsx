import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  LockOpenIcon, ClockIcon, CheckCircleIcon, XCircleIcon, CalendarIcon, PlusIcon,
} from '@heroicons/react/outline';

type TabType = 'all' | 'scheduled' | 'in_progress' | 'completed';

const BidOpeningList: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('all');

  const { data: openingsData, isLoading: openingsLoading } = useQuery({
    queryKey: ['bid-openings-list', page, pageSize, search, tab],
    queryFn: () => bidsApi.listOpenings({
      page,
      page_size: pageSize,
      search,
      status: tab === 'all' ? undefined : tab,
    }),
  });

  const allOpenings = openingsData?.results || [];

  const scheduled = allOpenings.filter((o: any) => o.status === 'scheduled').length;
  const inProgress = allOpenings.filter((o: any) => o.status === 'in_progress').length;
  const completed = allOpenings.filter((o: any) => o.status === 'completed').length;
  const visibleOpenings = allOpenings;

  const columns = [
    { key: 'solicitation_number', label: 'Solicitation #', render: (v: string, row: any) => (
      <span className="font-medium">{v || row.solicitation_number || row.solicitation?.sol_number || '---'}</span>
    )},
    { key: 'solicitation_title', label: 'Title', render: (v: string, row: any) => (
      <span className="text-gray-600 truncate max-w-[200px] block">{v || row.solicitation_title || row.solicitation?.title || '---'}</span>
    )},
    { key: 'opened_at', label: 'Opening Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'conducted_by_name', label: 'Conducted By', render: (v: string, row: any) => v || row.conducted_by_name || '-' },
    { key: 'total_bids', label: 'Total Bids', render: (v: number, row: any) => (
      <span className="font-medium">{v ?? row.total_bids ?? '-'}</span>
    )},
    { key: 'opened_count', label: 'Opened', render: (v: number, row: any) => (
      <span className="font-medium">{v ?? row.opened_count ?? '-'}</span>
    )},
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'scheduled'} /> },
    { key: 'id', label: '', render: (_: any, row: any) => (
      <div className="flex gap-1">
        {row.status === 'scheduled' && (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/bids/opening/${row.solicitation_id || row.solicitation}`); }}
            className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg hover:bg-zammsa-green-dark flex items-center gap-1">
            <LockOpenIcon className="w-3.5 h-3.5" />
            Start
          </button>
        )}
        {row.status === 'completed' && (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/bids/opening/minutes`); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
            Minutes
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Opening"
        description="Manage public bid opening sessions for published solicitations"
        actions={
          <button onClick={() => navigate('/bids/opening/setup')}
            className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-zammsa-green-dark flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            New Opening Session
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={openingsData?.count || 0} icon={<CalendarIcon className="w-6 h-6" />} color="blue" description="Opening sessions recorded" />
        <StatCard label="Scheduled" value={scheduled} icon={<ClockIcon className="w-6 h-6" />} color="orange" description="Opening sessions scheduled" />
        <StatCard label="In Progress" value={inProgress} icon={<LockOpenIcon className="w-6 h-6" />} color="green" description="Live bid openings" />
        <StatCard label="Completed" value={completed} icon={<CheckCircleIcon className="w-6 h-6" />} color="purple" description="Minutes available" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <div className="flex">
            {([
              { key: 'all', label: 'All Sessions' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' },
            ] as { key: TabType; label: string }[]).map((t) => (
              <button key={t.key}
                onClick={() => { setTab(t.key); setPage(1); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search openings..." />
        </div>
        {openingsLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable
            columns={columns}
            data={visibleOpenings}
            onRowClick={(row) => {
              if (row.status === 'completed' || row.status === 'in_progress' || row.status === 'scheduled') {
                navigate(`/bids/opening/${row.solicitation_id || row.solicitation}`);
              }
            }}
          />
        )}
        {!visibleOpenings.length && !openingsLoading && (
          <div className="py-12 text-center text-gray-400">
            <XCircleIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No openings found</p>
            <p className="text-sm mt-1">Create a new opening session to get started</p>
          </div>
        )}
        {openingsData && (
          <Pagination currentPage={page} totalPages={Math.ceil((openingsData.count || 0) / pageSize)} pageSize={pageSize}
            totalItems={openingsData.count || 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default BidOpeningList;
