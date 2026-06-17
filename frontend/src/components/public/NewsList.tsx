import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { NewsArticle } from '../../types';
import { SearchIcon, CalendarIcon, EyeIcon, ArrowRightIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 12;

const NewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => (
  <Link to={`/news/${article.id}`} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-zammsa-green/30 transition-all flex flex-col shadow-sm">
    <div className="h-52 bg-slate-100 overflow-hidden relative">
      {article.featured_image ? (
        <img src={article.featured_image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-300">
           <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
           </svg>
        </div>
      )}
      <div className="absolute top-4 left-4">
         <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-zammsa-green uppercase tracking-wider rounded-lg shadow-sm border border-emerald-50">
            {article.category?.replace('_', ' ')}
         </span>
      </div>
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
        <div className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> {new Date(article.published_at).toLocaleDateString('en-GB')}</div>
        <div className="flex items-center gap-1.5"><EyeIcon className="w-3.5 h-3.5" /> {article.view_count}</div>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug group-hover:text-zammsa-green transition-colors line-clamp-2">{article.title}</h3>
      <p className="text-sm font-medium text-slate-500 line-clamp-3 mb-6 flex-1">{article.summary}</p>
      
      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">By {article.author}</span>
        <div className="p-1.5 bg-slate-50 text-zammsa-green rounded-lg group-hover:bg-zammsa-green group-hover:text-white transition-all">
           <ArrowRightIcon className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  </Link>
);

const NewsList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['public-news', params],
    queryFn: () => publicApi.listNews(params),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="News & Insights"
        description="Stay informed with the latest procurement announcements and agency updates."
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-lg">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={search}
             onChange={(e) => { setSearch(e.target.value); setPage(1); }}
             placeholder="Search articles..."
             className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
           />
        </div>
        <select 
          value={category} 
          onChange={(e) => { setCategory(e.target.value); setPage(1); }} 
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-zammsa-green/10 outline-none cursor-pointer"
        >
          <option value="">All Categories</option>
          <option value="press_release">Press Releases</option>
          <option value="announcement">Announcements</option>
          <option value="procurement">Procurement</option>
          <option value="general">General</option>
        </select>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : !data?.results?.length ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-200">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
              </svg>
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Articles Found</h3>
           <p className="text-slate-500 font-medium mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.results.map((article: NewsArticle) => <NewsCard key={article.id} article={article} />)}
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

export default NewsList;
