import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ClipboardListIcon,
  ChevronDownIcon, ChevronUpIcon, ClockIcon,
  ShieldCheckIcon, DocumentTextIcon, CurrencyDollarIcon,
  ExclamationIcon, OfficeBuildingIcon, UserGroupIcon,
} from '@heroicons/react/outline';

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal & Registration',
  financial: 'Financial',
  technical: 'Technical Capacity',
  reference: 'Client References',
  compliance: 'Compliance',
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: 'bg-blue-50 text-blue-700 border-blue-200',
  financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  technical: 'bg-purple-50 text-purple-700 border-purple-200',
  reference: 'bg-amber-50 text-amber-700 border-amber-200',
  compliance: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PostQualification: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const solicitationFilter = searchParams.get('solicitation') || '';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedPQ, setSelectedPQ] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    legal: true, financial: true, technical: true, reference: true, compliance: true,
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [contactResult, setContactResult] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['post-qualifications', page, pageSize, search, solicitationFilter],
    queryFn: () => evaluationsApi.listPostQuals({ page, page_size: pageSize, search, solicitation: solicitationFilter || undefined }),
  });

  const { data: selectedData, isLoading: selectedLoading } = useQuery({
    queryKey: ['post-qualification', selectedPQ],
    queryFn: () => evaluationsApi.getPostQual(selectedPQ!),
    enabled: !!selectedPQ,
  });

  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['pq-verification-context', selectedPQ],
    queryFn: () => evaluationsApi.getPQVerificationContext(selectedPQ!),
    enabled: !!selectedPQ,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ pqId, itemId, status, notes, contact_result }: any) =>
      evaluationsApi.updatePQItem(pqId, { item_id: itemId, status, notes, contact_result }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['pq-verification-context', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['phase-status'] });
      setEditingItem(null);
      setItemNotes('');
      setContactResult('');
      toast.success('Verification item updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update'),
  });

  const generateChecklistMutation = useMutation({
    mutationFn: (pqId: string) => evaluationsApi.generatePQChecklist(pqId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['pq-verification-context', selectedPQ] });
      toast.success('Verification checklist generated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate checklist'),
  });

  const pqs = data?.results || [];
  const selected = selectedData;
  const verificationItems = selected?.verification_items || [];

  const pending = pqs.filter((p: any) => p.status === 'pending').length;
  const inProgress = pqs.filter((p: any) => p.status === 'in_progress').length;
  const cleared = pqs.filter((p: any) => p.status === 'cleared').length;
  const failed = pqs.filter((p: any) => p.status === 'failed').length;

  const groupedItems = verificationItems.reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryProgress = (items: any[]) => {
    const done = items.filter(i => i.status === 'cleared' || i.status === 'failed').length;
    return { done, total: items.length, percent: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
  };

  const overallProgress = verificationItems.length > 0
    ? Math.round((verificationItems.filter((i: any) => i.status === 'cleared' || i.status === 'failed').length / verificationItems.length) * 100)
    : 0;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleUpdateItem = (itemId: string, status: string) => {
    if (!selectedPQ) return;
    updateItemMutation.mutate({
      pqId: selectedPQ,
      itemId,
      status,
      notes: itemNotes,
      contact_result: contactResult,
    });
  };

  // Detail view
  if (selectedPQ && selected) {
    const ctx = contextData;
    const verificationItems = ctx?.verification_items || selected?.verification_items || [];
    const overallProgress = verificationItems.length > 0
      ? Math.round((verificationItems.filter((i: any) => i.status === 'cleared' || i.status === 'failed').length / verificationItems.length) * 100)
      : 0;
    const groupedItems = verificationItems.reduce((acc: Record<string, any[]>, item: any) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    const DetailRow = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
      <div className="flex justify-between py-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
      </div>
    );

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => { setSelectedPQ(null); setEditingItem(null); }}
              className="text-sm text-gray-500 hover:text-gray-900 mb-1 flex items-center gap-1"
            >
              ← Back to Post-Qualifications
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Post-Qualification Verification</h1>
              <StatusBadge status={selected.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {selected.submission_id} — {selected.bidder_name}
            </p>
          </div>
          {(!selected.verification_items || selected.verification_items.length === 0) && (
            <button
              onClick={() => generateChecklistMutation.mutate(selectedPQ)}
              disabled={generateChecklistMutation.isPending}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
            >
              <ClipboardListIcon className="w-4 h-4" />
              {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Checklist'}
            </button>
          )}
        </div>

        {selectedLoading || contextLoading ? <LoadingSpinner className="py-12" /> : (
          <>
            {/* Blacklist Warning */}
            {ctx?.blacklist && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                <ExclamationIcon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">BLACKLISTED SUPPLIER</p>
                  <p className="text-xs text-red-700 mt-1">Reason: {ctx.blacklist.reason}</p>
                  {ctx.blacklist.debarred_until && (
                    <p className="text-xs text-red-700">Debarred until: {new Date(ctx.blacklist.debarred_until).toLocaleDateString()}</p>
                  )}
                  {ctx.blacklist.source && <p className="text-xs text-red-700">Source: {ctx.blacklist.source}</p>}
                </div>
              </div>
            )}

            {/* Supplier & Bid Context - Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Supplier Company Profile */}
              {ctx?.supplier_profile && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <OfficeBuildingIcon className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">Supplier Company Profile</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Company Name" value={ctx.supplier_profile.name} />
                    <DetailRow label="Registration No." value={ctx.supplier_profile.registration_number} mono />
                    <DetailRow label="TIN" value={ctx.supplier_profile.tin} mono />
                    <DetailRow label="CEEC Category" value={ctx.supplier_profile.ceec_category?.replace(/_/g, ' ')} />
                    <DetailRow label="Supplier Status" value={
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ctx.supplier_profile.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        ctx.supplier_profile.status === 'suspended' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{ctx.supplier_profile.status}</span>
                    } />
                    <DetailRow label="Risk Level" value={
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ctx.supplier_profile.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' :
                        ctx.supplier_profile.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{ctx.supplier_profile.risk_level || 'N/A'}</span>
                    } />
                    <DetailRow label="Bank" value={ctx.supplier_profile.bank_name} />
                    <DetailRow label="Account No." value={ctx.supplier_profile.bank_account_number} mono />
                  </div>
                </div>
              )}

              {/* Vendor Application Profile */}
              {ctx?.vendor_application && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">Vendor Registration Details</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Business Type" value={ctx.vendor_application.business_type} />
                    <DetailRow label="Year Established" value={ctx.vendor_application.year_established} />
                    <DetailRow label="Employee Count" value={ctx.vendor_application.employee_count} />
                    <DetailRow label="Annual Turnover" value={ctx.vendor_application.annual_turnover ? `ZMW ${Number(ctx.vendor_application.annual_turnover).toLocaleString()}` : '-'} />
                    <DetailRow label="Contact Person" value={ctx.vendor_application.contact_person} />
                    <DetailRow label="Phone" value={ctx.vendor_application.contact_phone} />
                    <DetailRow label="PACRA Validated" value={
                      ctx.vendor_application.pacra_validated ?
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> :
                        <XCircleIcon className="w-4 h-4 text-gray-300" />
                    } />
                    <DetailRow label="CEEC Validated" value={
                      ctx.vendor_application.ceec_validated ?
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> :
                        <XCircleIcon className="w-4 h-4 text-gray-300" />
                    } />
                  </div>
                </div>
              )}

              {/* Bid Details */}
              {ctx?.bid && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CurrencyDollarIcon className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">Bid Details</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Submission ID" value={ctx.bid.submission_id} mono />
                    <DetailRow label="Bid Price" value={`ZMW ${Number(ctx.bid.bid_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    <DetailRow label="Currency" value={ctx.bid.currency} />
                    <DetailRow label="Validity Period" value={ctx.bid.validity_period_days ? `${ctx.bid.validity_period_days} days` : '-'} />
                    <DetailRow label="Security Amount" value={ctx.bid.security_amount ? `ZMW ${Number(ctx.bid.security_amount).toLocaleString()}` : '-'} />
                    <DetailRow label="Security Type" value={ctx.bid.security_type?.replace(/_/g, ' ')} />
                    <DetailRow label="Submitted" value={ctx.bid.submitted_at ? new Date(ctx.bid.submitted_at).toLocaleString() : '-'} />
                  </div>
                </div>
              )}

              {/* Bid Securities */}
              {ctx?.bid_securities?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheckIcon className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">Bid Securities</h3>
                  </div>
                  <div className="space-y-3">
                    {ctx.bid_securities.map((sec: any) => (
                      <div key={sec.security_id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700">{sec.security_type?.replace(/_/g, ' ').toUpperCase()}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            sec.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                            sec.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{sec.verification_status}</span>
                        </div>
                        <div className="text-[11px] text-gray-600 space-y-0.5">
                          <p>Amount: ZMW {Number(sec.amount).toLocaleString()}</p>
                          <p>Institution: {sec.issuing_institution}</p>
                          <p>Ref: {sec.reference_number}</p>
                          <p>Valid until: {sec.validity_date ? new Date(sec.validity_date).toLocaleDateString() : '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bid Documents */}
            {ctx?.bid_documents?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">Submitted Bid Documents</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ctx.bid_documents.map((doc: any) => (
                    <div key={doc.document_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <DocumentTextIcon className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{doc.document_type?.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-gray-500">Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical & Financial Scores */}
            {ctx?.technical_scores?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardListIcon className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">Evaluation Scores</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-500">Criterion</th>
                        <th className="text-left py-2 font-medium text-gray-500">Evaluator</th>
                        <th className="text-right py-2 font-medium text-gray-500">Raw Score</th>
                        <th className="text-right py-2 font-medium text-gray-500">Weighted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ctx.technical_scores.map((ts: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 text-gray-900">{ts.criterion}</td>
                          <td className="py-1.5 text-gray-600">{ts.evaluator}</td>
                          <td className="py-1.5 text-right font-mono">{ts.raw_score.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-mono font-medium">{ts.weighted_score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ctx.financial_evaluation && (
                  <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-emerald-600">Original Price</p>
                      <p className="text-xs font-bold text-emerald-800 font-mono">ZMW {Number(ctx.financial_evaluation.original_price).toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-emerald-600">Evaluated Price</p>
                      <p className="text-xs font-bold text-emerald-800 font-mono">ZMW {Number(ctx.financial_evaluation.evaluated_price).toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-blue-600">Financial Score</p>
                      <p className="text-xs font-bold text-blue-800 font-mono">{ctx.financial_evaluation.financial_score.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-purple-600">Preference</p>
                      <p className="text-xs font-bold text-purple-800">{ctx.financial_evaluation.preference_category?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supplier Documents */}
            {ctx?.supplier_documents?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">Supplier Documents on File</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ctx.supplier_documents.map((doc: any) => (
                    <div key={doc.document_id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs font-medium text-gray-900">{doc.document_type?.replace(/_/g, ' ')}</p>
                          {doc.expiry_date && (
                            <p className={`text-[10px] ${new Date(doc.expiry_date) < new Date() ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                              Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                              {new Date(doc.expiry_date) < new Date() && ' (EXPIRED)'}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        doc.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                        doc.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{doc.verification_status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Progress */}
            {verificationItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Verification Progress</h3>
                  <span className={`text-sm font-bold ${overallProgress === 100 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {overallProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overallProgress === 100 ? 'bg-emerald-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900">{verificationItems.length}</p>
                    <p className="text-[10px] text-gray-500">Total Items</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-emerald-600">
                      {verificationItems.filter((i: any) => i.status === 'cleared').length}
                    </p>
                    <p className="text-[10px] text-emerald-600">Cleared</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-red-600">
                      {verificationItems.filter((i: any) => i.status === 'failed').length}
                    </p>
                    <p className="text-[10px] text-red-600">Failed</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-amber-600">
                      {verificationItems.filter((i: any) => i.status === 'pending' || i.status === 'in_progress').length}
                    </p>
                    <p className="text-[10px] text-amber-600">Pending</p>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Categories */}
            {verificationItems.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <ClipboardListIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Verification Checklist</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Generate a verification checklist to begin post-qualification checks.
                </p>
                <button
                  onClick={() => generateChecklistMutation.mutate(selectedPQ)}
                  disabled={generateChecklistMutation.isPending}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
                >
                  {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Verification Checklist'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const items = groupedItems[cat];
                  if (!items || items.length === 0) return null;
                  const prog = categoryProgress(items);
                  const isExpanded = expandedCategories[cat];

                  return (
                    <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleCategory(cat)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-1 rounded text-xs font-semibold border ${CATEGORY_COLORS[cat]}`}>
                            {label}
                          </div>
                          <span className="text-xs text-gray-500">
                            {prog.done}/{prog.total} complete
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full ${prog.percent === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          {isExpanded ? (
                            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {items.map((item: any) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 p-4 border-b border-gray-50 last:border-b-0 ${
                                item.status === 'cleared' ? 'bg-emerald-50/30' :
                                item.status === 'failed' ? 'bg-red-50/30' : ''
                              }`}
                            >
                              <div className="shrink-0">
                                {item.status === 'cleared' ? (
                                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                ) : item.status === 'failed' ? (
                                  <XCircleIcon className="w-5 h-5 text-red-500" />
                                ) : (
                                  <ClockIcon className="w-5 h-5 text-gray-300" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{item.notes}</p>
                                )}
                                {item.contact_result && (
                                  <p className="text-xs text-blue-600 mt-0.5 truncate">{item.contact_result}</p>
                                )}
                                {item.verified_by && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    Verified by {item.verified_by} on {item.verified_at ? new Date(item.verified_at).toLocaleDateString() : '-'}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {editingItem === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleUpdateItem(item.id, 'cleared')}
                                      className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700"
                                    >
                                      Pass
                                    </button>
                                    <button
                                      onClick={() => handleUpdateItem(item.id, 'failed')}
                                      className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                    >
                                      Fail
                                    </button>
                                    <button
                                      onClick={() => { setEditingItem(null); setItemNotes(''); setContactResult(''); }}
                                      className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingItem(item.id);
                                      setItemNotes(item.notes || '');
                                      setContactResult(item.contact_result || '');
                                    }}
                                    className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-200"
                                  >
                                    Update
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {editingItem && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Verification Notes</label>
                                <textarea
                                  value={itemNotes}
                                  onChange={(e) => setItemNotes(e.target.value)}
                                  rows={2}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                  placeholder="Enter verification notes..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Contact Result</label>
                                <input
                                  value={contactResult}
                                  onChange={(e) => setContactResult(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                  placeholder="e.g. Confirmed by phone on 2024-01-15"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Overall Notes</h3>
              <textarea
                value={selected.notes || ''}
                onChange={(e) => {
                  // TODO: Save notes on blur
                }}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Add overall verification notes for this supplier..."
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate('/evaluations')}
          className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors"
        >
          ← Back to Evaluations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Post-Qualification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify winning bidder credentials, references, and compliance before contract award
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
            <ClockIcon className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-1">{pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">In Progress</p>
            <ClipboardListIcon className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-600 mt-1">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cleared</p>
            <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{cleared}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Failed</p>
            <XCircleIcon className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-600 mt-1">{failed}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by bidder name or submission ID..." />
        </div>

        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <div className="divide-y divide-gray-100">
            {pqs.map((pq: any) => {
              const items = pq.verification_items || [];
              const done = items.filter((i: any) => i.status === 'cleared' || i.status === 'failed').length;
              const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

              return (
                <div
                  key={pq.id}
                  onClick={() => setSelectedPQ(pq.id)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="shrink-0">
                    {pq.status === 'cleared' ? (
                      <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                    ) : pq.status === 'failed' ? (
                      <XCircleIcon className="w-8 h-8 text-red-500" />
                    ) : pq.status === 'in_progress' ? (
                      <ClipboardListIcon className="w-8 h-8 text-blue-500" />
                    ) : (
                      <ClockIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{pq.bidder_name}</p>
                      <StatusBadge status={pq.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{pq.submission_id}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    {items.length > 0 ? (
                      <>
                        <p className="text-sm font-bold text-gray-900">{pct}%</p>
                        <p className="text-[10px] text-gray-500">{done}/{items.length} items</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">No checklist</p>
                    )}
                  </div>

                  <ChevronDownIcon className="w-5 h-5 text-gray-300 -rotate-90 shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {pqs.length === 0 && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <ClipboardListIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No post-qualification records</p>
            <p className="text-sm mt-1">Records are created when a winner is selected during Financial Evaluation</p>
          </div>
        )}

        {data && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil((data.count || 0) / pageSize)}
            pageSize={pageSize}
            totalItems={data.count || 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default PostQualification;
