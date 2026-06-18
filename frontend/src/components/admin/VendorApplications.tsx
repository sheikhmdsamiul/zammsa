import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchVendorApplications, fetchVendorApplicationDetail, approveVendorApplication, rejectVendorApplication, requestMoreInfo } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Pagination } from '../common/Pagination';
import { PageHeader } from '../common/PageHeader';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import {
  SearchIcon, OfficeBuildingIcon,
  UserIcon, MailIcon, PhoneIcon, LocationMarkerIcon,
  CheckCircleIcon, XCircleIcon, DocumentTextIcon,
  ExternalLinkIcon, CashIcon, IdentificationIcon,
  XIcon, InformationCircleIcon
} from '@heroicons/react/outline';

const VendorApplications: React.FC = () => {
  const { user } = useAuth();
  const canReview = user?.role === ROLES.SUPPLIER_RELATIONSHIP_MANAGER || user?.role === 'system_admin';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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
    return `${backendOrigin}/media/${rawPath.replace(/^media\//, '')}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['vendorApplications', search, statusFilter, page, limit],
    queryFn: () => fetchVendorApplications({ search, status: statusFilter || undefined, page, limit }),
  });

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['vendorApplicationDetail', selected?.application_id],
    queryFn: () => fetchVendorApplicationDetail(selected.application_id),
    enabled: !!selected?.application_id,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveVendorApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorApplications'] });
      toast.success('Application approved. Supplier account created.');
      setSelected(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to approve application'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVendorApplication(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorApplications'] });
      toast.success('Application rejected');
      setShowReject(false);
      setRejectReason('');
      setSelected(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to reject application'),
  });

  const infoMut = useMutation({
    mutationFn: ({ id, msg }: { id: string; msg: string }) => requestMoreInfo(id, msg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorApplications'] });
      toast.success('Information request sent to vendor');
      setShowInfo(false);
      setInfoMsg('');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to send request'),
  });

  const columns = [
    {
      key: 'company_name',
      label: 'Company',
      render: (v: string, row: any) => (
        <div>
          <span className="font-semibold text-slate-900">{v}</span>
          <span className="block text-[11px] text-slate-400">Reg: {row.registration_number}</span>
        </div>
      )
    },
    {
      key: 'contact_person',
      label: 'Contact',
      render: (v: string, row: any) => (
        <div>
          <span className="text-sm text-slate-600">{v}</span>
          <span className="block text-[11px] text-slate-400">{row.email || row.contact_email}</span>
        </div>
      )
    },
    {
      key: 'ceec_category',
      label: 'Category',
      render: (v: string) => (
        <span className="text-sm text-slate-600 capitalize">{v?.replace(/_/g, ' ')}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (v: string) => <StatusBadge status={v} />
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (v: string) => (
        <span className="text-sm text-slate-500">
          {v ? new Date(v).toLocaleDateString('en-GB') : <span className="text-slate-300 italic">Draft</span>}
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (_: any, row: any) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
          className="text-xs font-semibold text-zammsa-green hover:underline"
        >
          Review
        </button>
      )
    }
  ];

  if (isLoading && !data) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor applications"
        description="Review and manage supplier registration applications."
        actions={
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-md">
            <p className="text-xs font-semibold text-emerald-700">{data?.total || 0} total</p>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by company or reg no..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all placeholder:text-slate-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        onRowClick={(row) => setSelected(row)}
      />

      {(data?.total ?? 0) > limit && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil((data?.total ?? 0) / limit)}
            totalItems={data?.total ?? 0}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
          />
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zammsa-green rounded-lg flex items-center justify-center text-white">
                  <OfficeBuildingIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-lg font-bold text-slate-900">{selected.company_name}</h2>
                    <StatusBadge status={detail?.status || selected.status} />
                  </div>
                  <p className="text-xs text-slate-400">
                    ID: {selected.application_id.slice(0, 8)}
                    {selected.submitted_at && <> &middot; Submitted {new Date(selected.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <XIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isDetailLoading ? (
                <div className="py-24 flex justify-center"><LoadingSpinner /></div>
              ) : (
                <>
                  {/* Status Timeline */}
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center max-w-xl">
                      {[
                        { key: 'submitted', label: 'Submitted' },
                        { key: 'under_review', label: 'Under review' },
                        { key: 'decision', label: 'Decision' },
                      ].map((step, i, arr) => {
                        const currentStatus = detail?.status || selected.status;
                        const isRejected = currentStatus === 'rejected';
                        const isApproved = currentStatus === 'approved';
                        const isUnderReview = currentStatus === 'under_review' || currentStatus === 'pending_pacra' || currentStatus === 'pending_ceec';

                        let state: 'complete' | 'active' | 'inactive' = 'inactive';
                        if (step.key === 'submitted' && (isUnderReview || isApproved || isRejected || currentStatus === 'submitted')) state = currentStatus === 'submitted' || currentStatus === 'draft' ? 'active' : 'complete';
                        if (step.key === 'under_review' && (isUnderReview || isApproved || isRejected)) state = isUnderReview ? 'active' : 'complete';
                        if (step.key === 'decision' && (isApproved || isRejected)) state = isRejected ? 'active' : 'complete';

                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                state === 'complete' ? 'bg-emerald-500' :
                                state === 'active' ? (isRejected ? 'bg-rose-500' : 'bg-zammsa-green') :
                                'bg-slate-200'
                              }`} />
                              <span className={`text-xs font-medium ${
                                state === 'inactive' ? 'text-slate-400' : 'text-slate-700'
                              }`}>{step.label}</span>
                            </div>
                            {i < arr.length - 1 && (
                              <div className={`flex-1 h-px mx-3 ${
                                state === 'complete' || (step.key === 'submitted' && currentStatus !== 'draft') ? 'bg-emerald-200' : 'bg-slate-200'
                              }`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left: Business Info & Documents */}
                      <div className="lg:col-span-2 space-y-8">
                        {/* Registration */}
                        <section>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <IdentificationIcon className="w-4 h-4" /> Registration & profile
                          </h3>
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                            <div className="grid grid-cols-2 divide-x divide-slate-200">
                              <div className="p-4">
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Company name</p>
                                <p className="text-sm font-semibold text-slate-900">{detail?.company_name}</p>
                              </div>
                              <div className="p-4">
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">PACRA reg no.</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{detail?.registration_number}</p>
                                  {detail?.pacra_validated && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200">
                              <div className="p-4">
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Tax ID (TIN)</p>
                                <p className="text-sm font-semibold text-slate-900">{detail?.tin || '-'}</p>
                              </div>
                              <div className="p-4">
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">CEEC category</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900 capitalize">{detail?.ceec_category?.replace(/_/g, ' ') || '-'}</p>
                                  {detail?.ceec_validated && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                                </div>
                              </div>
                            </div>
                            <div className="p-4">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Business address</p>
                              <div className="flex items-start gap-1.5">
                                <LocationMarkerIcon className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                                <p className="text-sm text-slate-600">{detail?.address || 'No address provided'}</p>
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* Documents */}
                        <section>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <DocumentTextIcon className="w-4 h-4" /> Supporting documents
                          </h3>
                          {(() => {
                            const docs = detail?.documents?.length ? detail.documents : selected?.documents;
                            return docs?.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {docs.map((doc: any) => (
                                <div key={doc.id || doc.document_id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-lg hover:border-zammsa-green/40 transition-all">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                      <DocumentTextIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate">{doc.type?.replace(/_/g, ' ') || 'Document'}</p>
                                      <p className="text-[11px] text-slate-400 truncate">{doc.filename || doc.file_path?.split('/').pop()}</p>
                                    </div>
                                  </div>
                                  <a
                                    href={resolveDocumentUrl(doc.file_path)}
                                    target="_blank" rel="noreferrer"
                                    className="text-xs font-medium text-zammsa-green hover:underline shrink-0 ml-2"
                                  >
                                    <ExternalLinkIcon className="w-4 h-4" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg">
                              <DocumentTextIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                              <p className="text-xs font-medium text-slate-400">No documents uploaded</p>
                              <p className="text-[10px] text-slate-300 mt-1">
                                detail docs: {detail?.documents?.length ?? 'N/A'} &middot; selected docs: {selected?.documents?.length ?? 'N/A'}
                              </p>
                            </div>
                          );
                          })()}
                        </section>
                      </div>

                      {/* Right: Contact, Banking, Decision */}
                      <div className="space-y-5">
                        <div className="border border-slate-200 rounded-lg">
                          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                            <h4 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                              <UserIcon className="w-3.5 h-3.5" /> Contact
                            </h4>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <UserIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-400 uppercase">Name</p>
                                <p className="text-sm font-semibold text-slate-900 truncate">{detail?.contact_person || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <MailIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-400 uppercase">Email</p>
                                <p className="text-sm font-semibold text-slate-900 truncate">{detail?.email || detail?.contact_email || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <PhoneIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-400 uppercase">Phone</p>
                                <p className="text-sm font-semibold text-slate-900">{detail?.contact_phone || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg">
                          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                            <h4 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                              <CashIcon className="w-3.5 h-3.5" /> Banking
                            </h4>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <CashIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{detail?.bank_name || '-'}</p>
                                <p className="text-xs text-slate-500">{detail?.bank_account_number || '-'}</p>
                                <p className="text-[11px] text-slate-400 truncate">{detail?.bank_account_name || ''}</p>
                                {detail?.bank_branch && (
                                  <p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">Branch: {detail.bank_branch}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg">
                          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                            <h4 className="text-xs font-semibold text-slate-500">Decision</h4>
                          </div>
                          <div className="p-4">
                            {canReview ? (
                              <div className="space-y-2.5">
                                <button
                                  onClick={() => approveMut.mutate(selected.application_id)}
                                  disabled={approveMut.isPending || detail?.status === 'approved'}
                                  className="w-full py-2.5 bg-zammsa-green text-white text-xs font-semibold rounded-lg hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {approveMut.isPending ? <LoadingSpinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                                  Approve & create account
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => setShowReject(true)}
                                    disabled={detail?.status === 'approved' || detail?.status === 'rejected'}
                                    className="py-2 bg-white border border-rose-200 text-rose-600 text-xs font-semibold rounded-lg hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                  >
                                    <XCircleIcon className="w-3.5 h-3.5" /> Reject
                                  </button>
                                  <button
                                    onClick={() => setShowInfo(true)}
                                    className="py-2 bg-white border border-slate-200 text-slate-500 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <InformationCircleIcon className="w-3.5 h-3.5" /> Request info
                                  </button>
                                </div>
                                {detail?.status === 'rejected' && detail?.rejection_reason && (
                                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg mt-2">
                                    <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-0.5">Rejection reason</p>
                                    <p className="text-xs text-rose-700">{detail.rejection_reason}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 text-center py-3">View-only access</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
                  <XCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reject application</h3>
                  <p className="text-xs text-slate-500">This will notify the vendor.</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for rejection</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Missing valid tax clearance certificate..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors rounded-lg border border-slate-200">
                  Cancel
                </button>
                <button
                  onClick={() => rejectMut.mutate({ id: selected.application_id, reason: rejectReason })}
                  disabled={rejectMut.isPending || !rejectReason}
                  className="flex-1 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {rejectMut.isPending ? <LoadingSpinner size="sm" /> : null}
                  Confirm rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <InformationCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request information</h3>
                  <p className="text-xs text-slate-500">Ask for additional documents or clarification.</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Message to vendor</label>
              <textarea
                value={infoMsg}
                onChange={(e) => setInfoMsg(e.target.value)}
                placeholder="Describe what additional information is needed..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowInfo(false); setInfoMsg(''); }} className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors rounded-lg border border-slate-200">
                  Cancel
                </button>
                <button
                  onClick={() => infoMut.mutate({ id: selected.application_id, msg: infoMsg })}
                  disabled={infoMut.isPending || !infoMsg}
                  className="flex-1 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {infoMut.isPending ? <LoadingSpinner size="sm" /> : null}
                  Send request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorApplications;
