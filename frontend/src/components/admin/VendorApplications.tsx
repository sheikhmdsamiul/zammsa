import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchVendorApplications, fetchVendorApplicationDetail, approveVendorApplication, rejectVendorApplication, requestMoreInfo } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Pagination } from '../common/Pagination';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';

const VendorApplications: React.FC = () => {
  const { user } = useAuth();
  const canReview = user?.role === ROLES.SUPPLIER_RELATIONSHIP_MANAGER;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const resolveDocumentUrl = (rawPath: string) => {
    if (!rawPath) return '';
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;

    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    const backendOrigin = apiBase.replace(/\/api\/v1\/?$/, '');
    if (rawPath.startsWith('/')) return `${backendOrigin}${rawPath}`;
    if (rawPath.startsWith('media/')) return `${backendOrigin}/${rawPath}`;
    return `${backendOrigin}/media/${rawPath}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['vendorApplications', search, statusFilter, page, limit],
    queryFn: () => fetchVendorApplications({ search, status: statusFilter || undefined, page, limit }),
  });

  const { data: detail } = useQuery({
    queryKey: ['vendorApplicationDetail', selected?.application_id],
    queryFn: () => fetchVendorApplicationDetail(selected.application_id),
    enabled: !!selected?.application_id,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveVendorApplication(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendorApplications'] }); toast.success('Application approved'); setSelected(null); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVendorApplication(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendorApplications'] }); toast.success('Application rejected'); setShowReject(false); setRejectReason(''); setSelected(null); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });
  const infoMut = useMutation({
    mutationFn: ({ id, msg }: { id: string; msg: string }) => requestMoreInfo(id, msg),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendorApplications'] }); toast.success('Request sent'); setShowInfo(false); setInfoMsg(''); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Applications</h1>
        <span className="text-sm text-gray-500">{data?.total || 0} pending</span>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by company, email..." className="flex-1 w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Status</option><option value="pending">Pending</option><option value="under_review">Under Review</option><option value="info_requested">Info Requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Company</th><th className="px-4 py-3 text-left font-medium text-gray-500">Reg No</th><th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th><th className="px-4 py-3 text-center font-medium text-gray-500">Status</th><th className="px-4 py-3 text-right font-medium text-gray-500">Submitted</th><th className="px-4 py-3 text-center font-medium text-gray-500">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data?.map((a: any) => (
                <tr key={a.application_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(a)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.company_name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.registration_number}</td>
                  <td className="px-4 py-3 text-gray-600">{a.email || a.contact_email}<br /><span className="text-xs">{a.contact_person}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'approved' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : a.status.startsWith('pending') || a.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{a.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 text-right text-gray-500">{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelected(a); }} className="text-xs text-blue-600 hover:underline">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total && data.total > limit && (
          <div className="mt-4"><Pagination currentPage={page} totalPages={Math.ceil(data.total / limit)} totalItems={data.total} pageSize={limit} onPageChange={setPage} onPageSizeChange={(s) => { setLimit(s); setPage(1); }} /></div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{selected.company_name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><p className="text-sm font-medium text-gray-500">Registration</p><p className="text-sm text-gray-900">{detail?.registration_number || selected.registration_number}</p></div>
                <div><p className="text-sm font-medium text-gray-500">TIN</p><p className="text-sm text-gray-900">{detail?.tin || '-'}</p></div>
                <div><p className="text-sm font-medium text-gray-500">CEEC Category</p><p className="text-sm text-gray-900">{detail?.ceec_category || selected.ceec_category}</p></div>
                <div><p className="text-sm font-medium text-gray-500">Contact</p><p className="text-sm text-gray-900">{detail?.contact_email || selected.email || '-'} / {detail?.contact_phone || '-'}</p></div>
                <div><p className="text-sm font-medium text-gray-500">Address</p><p className="text-sm text-gray-900">{detail?.address || '-'}</p></div>

                {/* PACRA / CEEC Validation */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Validation Status</p>
                  <div className="flex items-center gap-2 text-sm py-1">
                    <span className={detail?.pacra_validated ? 'text-green-600' : 'text-red-600'}>{detail?.pacra_validated ? '\u2713' : '\u2717'}</span>
                    <span className="text-gray-700">PACRA Verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm py-1">
                    <span className={detail?.ceec_validated ? 'text-green-600' : 'text-red-600'}>{detail?.ceec_validated ? '\u2713' : '\u2717'}</span>
                    <span className="text-gray-700">CEEC Verified</span>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Documents</p>
                  {(detail?.documents || []).map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm py-1">
                      <span className="text-blue-600">{'\uD83D\uDCCE'}</span>
                      <span className="text-gray-700">{d.document_type || d.filename}</span>
                      {d.file_path && (
                        <a
                          href={resolveDocumentUrl(d.file_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline ml-2"
                        >
                          View
                        </a>
                      )}
                    </div>
                  ))}
                  {(!detail?.documents || detail.documents.length === 0) && <p className="text-xs text-gray-400">No documents uploaded</p>}
                </div>
              </div>

              <div className="space-y-4">
                {/* Bank Details */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Bank Details</p>
                  <p className="text-sm text-gray-900">{detail?.bank_name || '-'}</p>
                  <p className="text-sm text-gray-900">{detail?.bank_account_name || '-'} - {detail?.bank_account_number || '-'}</p>
                  <p className="text-sm text-gray-900">{detail?.bank_branch || '-'}</p>
                </div>

                {/* Status Info */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Status</p>
                  <p className="text-sm text-gray-900 capitalize">{(detail?.status || selected.status).replace(/_/g, ' ')}</p>
                  {detail?.submitted_at && <p className="text-xs text-gray-500 mt-1">Submitted: {new Date(detail.submitted_at).toLocaleString()}</p>}
                  {detail?.rejection_reason && <p className="text-xs text-red-600 mt-1">Reason: {detail.rejection_reason}</p>}
                </div>

                {/* Actions */}
                {canReview ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => approveMut.mutate(selected.application_id)} disabled={approveMut.isPending || selected.status === 'approved'} className="w-full px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">Approve & Create Account</button>
                    <button onClick={() => setShowReject(true)} disabled={selected.status === 'approved' || selected.status === 'rejected'} className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                    <button onClick={() => setShowInfo(true)} disabled className="w-full px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 opacity-60 cursor-not-allowed" title="Not yet implemented">Request More Information</button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Only Supplier Relationship Managers can review applications.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Reject Application</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} className="w-full border border-gray-300 rounded-lg p-2 text-sm mt-3" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => rejectMut.mutate({ id: selected.application_id, reason: rejectReason })} disabled={rejectMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Request More Information</h3>
            <textarea value={infoMsg} onChange={(e) => setInfoMsg(e.target.value)} placeholder="Describe what additional information is needed..." rows={3} className="w-full border border-gray-300 rounded-lg p-2 text-sm mt-3" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowInfo(false); setInfoMsg(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => infoMut.mutate({ id: selected.application_id, msg: infoMsg })} disabled={infoMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorApplications;
