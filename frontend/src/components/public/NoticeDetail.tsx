import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PrintButton } from '../common/PrintButton';
import { BookmarkIcon } from '@heroicons/react/outline';

const NoticeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: notice, isLoading } = useQuery({
    queryKey: ['public-notice', id],
    queryFn: () => publicApi.getNotice(id!).then((n) => { publicApi.trackNoticeView(id!); return n; }),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;
  if (!notice) return <div className="text-center py-20 text-gray-400">Notice not found.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/notices" className="text-sm text-zammsa-green hover:underline">← Back to Notices</Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                notice.type === 'general' ? 'bg-gray-100 text-gray-700' :
                notice.type === 'procurement' ? 'bg-blue-100 text-blue-700' :
                notice.type === 'meeting' ? 'bg-purple-100 text-purple-700' :
                notice.type === 'board' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>{notice.type}</span>
              <span className="text-sm text-gray-400">{new Date(notice.published_at).toLocaleDateString('en-ZM', { dateStyle: 'long' })}</span>
              {notice.is_pinned && <span className="inline-flex items-center gap-1 text-xs text-red-500"><BookmarkIcon className="h-3 w-3" /> Pinned</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{notice.title}</h1>
          </div>
          <PrintButton />
        </div>

        <div className="prose prose-gray max-w-none mb-8">
          {notice.content?.split('\n').map((p, i) => <p key={i} className="mb-4 leading-relaxed">{p}</p>)}
        </div>

        {notice.document && (
          <div className="border-t border-gray-200 pt-6">
            <a
              href={notice.document.file}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Document ({notice.document.filename})
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default NoticeDetail;
