import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentTextIcon,
  PaperClipIcon, ClockIcon, ShieldCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/outline';

function fmtDate(d: string | undefined | null): string {
  if (!d) return '---';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateTime(d: string | undefined | null): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

const BidDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: bid, isLoading } = useQuery({
    queryKey: ['bid', id],
    queryFn: () => bidsApi.get(id!),
    enabled: !!id,
  });

  const verifyMutation = useMutation({
    mutationFn: (verified: boolean) => bidsApi.verifySecurity(id!, { verified, notes: '' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bid', id] }); toast.success('Security verification updated'); },
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!bid) return <p className="text-center text-gray-500 py-20">Bid not found</p>;

  const isSupplier = user?.role === 'supplier_user';
  const resolveDocumentUrl = (doc: any) => {
    if (doc?.file_url) return doc.file_url;
    const rawPath = doc?.file_path || '';
    if (!rawPath) return '';
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    const backendOrigin = apiBase.replace(/\/api\/v1\/?$/, '');
    if (rawPath.startsWith('/')) return `${backendOrigin}${rawPath}`;
    if (rawPath.startsWith('media/')) return `${backendOrigin}/${rawPath}`;
    return `${backendOrigin}/media/${rawPath}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        to={isSupplier ? '/vendor/bids' : '/bids'}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-zammsa-green hover:underline"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to {isSupplier ? 'My Bids' : 'Bids'}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-black text-gray-900">Bid {bid.bid_number}</h1>
              <StatusBadge status={bid.status} />
              {bid.is_late && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider">Late</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-500 mt-1 flex items-center gap-1.5">
              <DocumentTextIcon className="w-4 h-4 text-gray-400" />
              {bid.solicitation_title || `Solicitation #${bid.solicitation}`}
              {bid.solicitation_number && <span className="text-gray-400">({bid.solicitation_number})</span>}
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Submitted by {bid.vendor_name}
              {bid.submitted_at && <> &middot; {fmtDateTime(bid.submitted_at)}</>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-zammsa-green">{bid.currency} {bid.bid_amount?.toLocaleString()}</p>
            <p className="text-xs font-bold text-gray-400">Bid Amount</p>
          </div>
        </div>
        {user?.role === 'procurement_officer' && !bid.security_verified && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={() => verifyMutation.mutate(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors">
              <ShieldCheckIcon className="w-4 h-4" /> Verify Security
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Solicitation Information */}
          {bid.solicitation_title && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Solicitation Information</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.solicitation_title}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Number</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.solicitation_number || '---'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{bid.solicitation_type || '---'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing Date</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.closing_date)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submission Summary */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Submission Summary</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission ID</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.bid_number || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt Number</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.receipt_number || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitted At</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.submitted_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opened At</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.opened_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Timestamp</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.submission_timestamp)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Method</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{bid.submission_method || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bid Amount</p>
                <p className="text-sm font-bold text-zammsa-green mt-0.5">{bid.currency} {bid.bid_amount?.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Validity Period</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.validity_period_days} days</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial Envelope</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.financial_envelope_encrypted ? 'Encrypted' : 'Not encrypted'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Addenda Acknowledged</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.addenda_acknowledged ? 'Yes' : 'No'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Addenda Acknowledged At</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.addenda_acknowledged_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Late Submission</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.is_late ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Bid Items */}
          {!!bid.items?.length && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bid Items</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 rounded-2xl">
                      <th className="text-left px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Code</th>
                      <th className="text-left px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                      <th className="text-right px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                      <th className="text-right px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit Price</th>
                      <th className="text-right px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bid.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-900">{item.item_code}</td>
                        <td className="px-3 py-3 text-sm text-gray-700">{item.description}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold">{item.quantity}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold">{item.unit_price?.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-gray-900">{item.total_price?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Document URLs */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Document References</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Technical Document URL</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 break-all">{bid.technical_doc_url || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial Document URL</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 break-all">{bid.financial_doc_url || '---'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Bid Security */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bid Security</h2>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{bid.security_amount?.toLocaleString() || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{bid.security_type?.replace(/_/g, ' ') || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDate(bid.security_expiry)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified</p>
                <p className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${bid.security_verified ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {bid.security_verified ? <CheckCircleIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4" />}
                  {bid.security_verified ? 'Verified' : 'Pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          {bid.documents?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Uploaded Documents</h2>
              <div className="space-y-2">
                {bid.documents.map((doc: any) => (
                  <div key={doc.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{doc.filename}</span>
                      </div>
                      {resolveDocumentUrl(doc) ? (
                        <a href={resolveDocumentUrl(doc)} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-zammsa-green uppercase hover:underline shrink-0 ml-2">View</a>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0 ml-2">N/A</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold text-gray-400">
                      <span className="capitalize">{(doc.document_type || 'other').replace(/_/g, ' ')}</span>
                      {doc.uploaded_at && <span>{fmtDate(doc.uploaded_at)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Record Timeline */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Record Timeline</h2>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Created</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.created_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Updated</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(bid.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidDetail;
