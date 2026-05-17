import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Notice } from '../../types';
import { BookmarkIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 15;

const typeColors: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  procurement: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  board: 'bg-yellow-100 text-yellow-700',
  press: 'bg-red-100 text-red-700',
};

const NoticesList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (type) params.type = type;

  const { data, isLoading } = useQuery({
    queryKey: ['public-notices', params],
    queryFn: () => publicApi.listNotices(params),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notices</h1>
        <p className="text-gray-500 mt-2">Official notices and announcements</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search notices..." />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="border-gray-300 rounded-lg text-sm">
          <option value="">All Types</option>
          <option value="general">General</option>
          <option value="procurement">Procurement</option>
          <option value="meeting">Meeting</option>
          <option value="board">Board</option>
          <option value="press">Press Release</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-20 text-gray-400">No notices found.</div>
      ) : (
        <div className="space-y-3">
          {data.results.map((notice: Notice) => (
            <Link
              key={notice.id}
              to={`/notices/${notice.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-center w-14">
                  <div className="text-sm font-bold text-zammsa-green">{new Date(notice.published_at).getDate()}</div>
                  <div className="text-xs text-gray-400">{new Date(notice.published_at).toLocaleString('default', { month: 'short' })}</div>
                  <div className="text-xs text-gray-400">{new Date(notice.published_at).getFullYear()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[notice.type] || 'bg-gray-100 text-gray-700'}`}>
                      {notice.type}
                    </span>
                    {notice.is_pinned && <span className="inline-flex items-center gap-1 text-xs text-red-500"><BookmarkIcon className="h-3 w-3" /> Pinned</span>}
                  </div>
                  <h3 className="font-medium text-gray-900">{notice.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notice.content}</p>
                  {notice.document && (
                    <span className="text-xs text-zammsa-green mt-2 inline-block">Has attachment</span>
                  )}
                </div>
                <svg className="h-5 w-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.count / pageSize)}
          pageSize={pageSize}
          totalItems={data.count}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </div>
  );
};

export default NoticesList;
