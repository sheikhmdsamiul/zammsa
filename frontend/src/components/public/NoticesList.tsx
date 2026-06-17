import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { Notice } from '../../types';
import { BookmarkIcon, SearchIcon, ChevronRightIcon, PaperClipIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 15;

const typeColors: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700',
  procurement: 'bg-blue-50 text-blue-600',
  meeting: 'bg-purple-50 text-purple-600',
  board: 'bg-amber-50 text-amber-600',
  press: 'bg-rose-50 text-rose-600',
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="Public Notices"
        description="Official announcements, board resolutions, and procurement notifications."
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-lg">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={search}
             onChange={(e) => { setSearch(e.target.value); setPage(1); }}
             placeholder="Search notices..."
             className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
           />
        </div>
        <select 
          value={type} 
          onChange={(e) => { setType(e.target.value); setPage(1); }} 
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-zammsa-green/10 outline-none cursor-pointer"
        >
          <option value="">All Types</option>
          <option value="general">General</option>
          <option value="procurement">Procurement</option>
          <option value="meeting">Meeting</option>
          <option value="board">Board</option>
          <option value="press">Press Release</option>
        </select>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : !data?.results?.length ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-200">
              <BookmarkIcon className="w-8 h-8" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Notices</h3>
           <p className="text-slate-500 font-medium mt-1">There are no notices matching your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((notice: Notice) => (
            <Link
              key={notice.id}
              to={`/notices/${notice.id}`}
              className="group block bg-white rounded-2xl border border-slate-200 p-6 hover:border-zammsa-green/30 transition-all shadow-sm"
            >
              <div className="flex items-start gap-8">
                <div className="flex-shrink-0 text-center w-16 pt-1">
                  <div className="text-xl font-bold text-slate-900 leading-none">{new Date(notice.published_at).getDate()}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(notice.published_at).toLocaleString('default', { month: 'short' })}</div>
                  <div className="text-[9px] font-bold text-slate-300 mt-0.5">{new Date(notice.published_at).getFullYear()}</div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${typeColors[notice.type] || 'bg-slate-100 text-slate-600'}`}>
                      {notice.type}
                    </span>
                    {notice.is_pinned && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase tracking-widest"><BookmarkIcon className="h-3 w-3" /> Pinned</span>}
                  </div>
                  
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-zammsa-green transition-colors leading-snug">{notice.title}</h3>
                  <p className="text-sm font-medium text-slate-500 mt-2 line-clamp-1">{notice.content}</p>
                  
                  {notice.document && (
                    <div className="flex items-center gap-1.5 text-zammsa-green mt-3">
                       <PaperClipIcon className="w-3.5 h-3.5" />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Attachment Included</span>
                    </div>
                  )}
                </div>
                
                <div className="hidden sm:flex self-center">
                   <div className="p-2 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-zammsa-green group-hover:text-white transition-all">
                      <ChevronRightIcon className="w-4 h-4" />
                   </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.count > pageSize && (
        <div className="pt-12">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(data.count / pageSize)}
            pageSize={pageSize}
            totalItems={data.count}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
};

export default NoticesList;
