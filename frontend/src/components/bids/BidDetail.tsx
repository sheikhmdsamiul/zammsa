import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

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

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!bid) return <p className="text-center text-gray-500 py-12">Bid not found</p>;

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
    <div className="max-w-4xl mx-auto space-y-6">
      {user?.role === 'supplier_user' && (
        <div>
          <Link to="/vendor/bids" className="text-sm text-zammsa-green hover:underline">← Back to My Bids</Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bid #{bid.bid_number}</h1>
            <StatusBadge status={bid.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Submitted by {bid.vendor_name}</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'procurement_officer' && !bid.security_verified && (
            <button onClick={() => verifyMutation.mutate(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Verify Security</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Summary</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-gray-500">Submission ID</dt><dd className="font-medium">{bid.bid_number || '-'}</dd></div>
          <div><dt className="text-gray-500">Receipt Number</dt><dd className="font-medium">{bid.receipt_number || '-'}</dd></div>
          <div><dt className="text-gray-500">Submitted At</dt><dd className="font-medium">{bid.submitted_at ? new Date(bid.submitted_at).toLocaleString() : '-'}</dd></div>
          <div><dt className="text-gray-500">Opened At</dt><dd className="font-medium">{bid.opened_at ? new Date(bid.opened_at).toLocaleString() : '-'}</dd></div>
          <div><dt className="text-gray-500">Bid Amount</dt><dd className="font-medium">{bid.bid_amount?.toLocaleString()} {bid.currency}</dd></div>
          <div><dt className="text-gray-500">Submission Method</dt><dd className="font-medium capitalize">{bid.submission_method || '-'}</dd></div>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Validity Period</dt><dd className="font-medium">{bid.validity_period_days} days</dd></div>
              <div><dt className="text-gray-500">Financial Envelope</dt><dd className="font-medium">{bid.financial_envelope_encrypted ? 'Encrypted' : 'Not encrypted'}</dd></div>
              <div><dt className="text-gray-500">Addenda Acknowledged</dt><dd className="font-medium">{bid.addenda_acknowledged ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-gray-500">Late Submission</dt><dd className="font-medium">{bid.is_late ? 'Yes' : 'No'}</dd></div>
            </dl>
          </div>

          {!!bid.items?.length && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bid.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.item_code}</td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{item.unit_price?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium">{item.total_price?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Security</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{bid.security_amount?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{bid.security_type?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{bid.security_expiry ? new Date(bid.security_expiry).toLocaleDateString() : '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Verified</span>
                <span className={`font-medium ${bid.security_verified ? 'text-green-600' : 'text-yellow-600'}`}>{bid.security_verified ? 'Yes' : 'No'}</span>
              </div>
            </dl>
          </div>

          {bid.documents?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
              <div className="space-y-2">
                {bid.documents.map((doc: any) => (
                  <div key={doc.id} className="text-sm p-2 hover:bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{doc.filename}</span>
                      {resolveDocumentUrl(doc) ? (
                        <a
                          href={resolveDocumentUrl(doc)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zammsa-green hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">Unavailable</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center justify-between">
                      <span>Type: {(doc.document_type || 'other').replace(/_/g, ' ')}</span>
                      <span>Uploaded: {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidDetail;
