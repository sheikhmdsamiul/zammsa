import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { useCountdown } from '../../hooks/useCountdown';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PrintButton } from '../common/PrintButton';
import { InformationCircleIcon } from '@heroicons/react/outline';

const TenderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: tender, isLoading } = useQuery({
    queryKey: ['public-tender', id],
    queryFn: () => publicApi.getTender(id!).then((t) => { publicApi.trackTenderView(id!); return t; }),
    enabled: !!id,
  });

  const countdown = useCountdown(tender?.closing_date || '');

  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;
  if (!tender) return <div className="text-center py-20 text-gray-400">Tender not found.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/tenders" className="text-sm text-zammsa-green hover:underline">← Back to Tenders</Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              tender.type === 'rfb' ? 'bg-blue-100 text-blue-700' :
              tender.type === 'rfp' ? 'bg-purple-100 text-purple-700' :
              tender.type === 'rfq' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-700'
            }`}>{tender.type?.toUpperCase()}</span>
            {tender.evaluation_method && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                {tender.evaluation_method === 'lowest_price' ? 'Lowest Price' :
                 tender.evaluation_method === 'qcbs' ? 'QCBS' :
                 tender.evaluation_method === 'qbs' ? 'QBS' :
                 tender.evaluation_method === 'lcs' ? 'LCS' :
                 tender.evaluation_method === 'fbs' ? 'FBS' : tender.evaluation_method}
              </span>
            )}
            <StatusBadge status={tender.status} />
            <span className="text-sm text-gray-400">{tender.tender_number}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{tender.title}</h1>
          <p className="text-gray-500 mt-2">{tender.procuring_entity} • {tender.department}</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{tender.description}</p>
          </section>

          {tender.evaluation_criteria?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Criteria</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Criterion</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 uppercase">Weight (%)</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 uppercase">Minimum Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tender.evaluation_criteria.map((c: any) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{c.description}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{c.weight}%</td>
                        <td className="px-4 py-3 text-sm text-center">{c.minimum_pass_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tender.clarifications?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Clarifications</h2>
              <div className="space-y-4">
                {tender.clarifications.map((c: any) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900">Q: {c.question}</p>
                    {c.answer && <p className="text-sm text-gray-600 mt-2">A: {c.answer}</p>}
                    {!c.answer && <p className="text-sm text-yellow-600 mt-2">Pending response</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {tender.addenda?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Addenda</h2>
              <div className="space-y-3">
                {tender.addenda.map((a: any) => (
                  <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <InformationCircleIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-gray-900">Addendum #{a.number}</p>
                    </div>
                    <p className="text-sm text-gray-600">{a.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tender.bid_opening_results && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Opening Results</h2>
              <p className="text-sm text-gray-600">Opened at: {new Date(tender.bid_opening_results.opened_at).toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total bids received: {tender.bid_opening_results.total_bids}</p>
              <ul className="mt-2 space-y-1">
                {tender.bid_opening_results.bidders?.map((name: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700">• {name}</li>
                ))}
              </ul>
            </section>
          )}

          {tender.award_notice && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Award Notice</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">Awarded to: <strong>{tender.award_notice.awarded_to}</strong></p>
                <p className="text-sm text-green-800 mt-1">Amount: {tender.currency} {tender.award_notice.award_amount?.toLocaleString()}</p>
                <p className="text-sm text-green-800 mt-1">Date: {new Date(tender.award_notice.award_date).toLocaleDateString()}</p>
                <p className="text-sm text-green-700 mt-2">{tender.award_notice.justification}</p>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Key Dates</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Issue Date</dt>
                <dd className="font-medium">{new Date(tender.issue_date).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Closing Date</dt>
                <dd className="font-medium text-red-600">{new Date(tender.closing_date).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Opening Date</dt>
                <dd className="font-medium">{new Date(tender.opening_date).toLocaleDateString()}</dd>
              </div>
            </dl>
            <div className={`mt-4 p-3 rounded-lg text-center text-sm font-medium ${
              countdown.expired ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {countdown.expired ? 'Tender Closed' : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m remaining`}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Tender Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Method</dt>
                <dd className="font-medium">{tender.procurement_method}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Category</dt>
                <dd className="font-medium">{tender.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Estimated Value</dt>
                <dd className="font-medium text-zammsa-green">{tender.currency} {tender.estimated_value?.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Views</dt>
                <dd className="font-medium">{tender.view_count}</dd>
              </div>
            </dl>
          </div>

          {tender.documents?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
              <div className="space-y-2">
                {tender.documents.map((doc: any) => (
                  <a
                    key={doc.id}
                    href={doc.file_url || doc.file}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm"
                    target="_blank" rel="noreferrer"
                  >
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-gray-700">{doc.filename || doc.file_path || 'Document'}</span>
                  </a>
                ))}
                {tender.fee_required && (
                  <p className="text-xs text-gray-400 mt-2">Fee: {tender.currency} {tender.fee_amount?.toLocaleString()} required</p>
                )}
              </div>
            </div>
          )}

          <Link
            to="/login"
            className="block w-full text-center px-6 py-3 bg-zammsa-green text-white font-semibold rounded-lg hover:bg-zammsa-green-dark transition-colors"
          >
            Login to Bid
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TenderDetail;
