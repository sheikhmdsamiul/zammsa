import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import {
  ClockIcon, DocumentTextIcon, PaperClipIcon,
  CheckCircleIcon, InformationCircleIcon,
} from '@heroicons/react/outline';

const TYPE_LABELS: Record<string, string> = {
  rfb: 'ITB — Invitation to Bid',
  rfp: 'RFP — Request for Proposals',
  rfq: 'RFQ — Request for Quotations',
  rfi: 'RFI — Request for Information',
};

function fmtDate(d: string | undefined): string {
  if (!d) return '---';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateTime(d: string | undefined): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

const VendorTenderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: tender, isLoading } = useQuery({
    queryKey: ['vendor-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!tender) return <p className="text-center text-gray-500 py-20">Tender not found.</p>;

  const countdown = new Date(tender.closing_date).getTime() - Date.now();
  const isExpired = countdown <= 0;
  const daysLeft = Math.ceil(countdown / (1000 * 60 * 60 * 24));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link to="/vendor/open-tenders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zammsa-green hover:underline mb-6">
        &larr; Back to Open Tenders
      </Link>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                {TYPE_LABELS[tender.type] || tender.type?.toUpperCase()}
              </span>
              {tender.evaluation_method && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                  {tender.evaluation_method === 'lowest_price' ? 'Lowest Price' :
                   tender.evaluation_method === 'qcbs' ? 'QCBS' :
                   tender.evaluation_method === 'qbs' ? 'QBS' :
                   tender.evaluation_method === 'lcs' ? 'LCS' :
                   tender.evaluation_method === 'fbs' ? 'FBS' : tender.evaluation_method}
                </span>
              )}
              <StatusBadge status={tender.status} />
            </div>
            <h1 className="text-xl font-black text-gray-900 mt-1">{tender.title}</h1>
            <p className="text-sm font-semibold text-gray-500 mt-1 flex items-center gap-1.5">
              <DocumentTextIcon className="w-4 h-4 text-gray-400" />
              {tender.tender_number} &middot; {tender.department}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-zammsa-green">{tender.currency} {tender.estimated_value?.toLocaleString()}</p>
            <p className={`text-sm font-bold mt-1 ${isExpired ? 'text-red-500' : daysLeft <= 3 ? 'text-orange-500' : 'text-gray-500'}`}>
              {isExpired ? 'Closed' : `${daysLeft} days remaining`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Description</h2>
            <p className="text-sm font-semibold text-gray-700 leading-relaxed whitespace-pre-line">{tender.description}</p>
          </div>

          {/* Evaluation Criteria */}
          {tender.evaluation_criteria?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Evaluation Criteria</h2>
              <div className="space-y-2">
                {tender.evaluation_criteria.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-zammsa-green shrink-0" />
                      <span className="text-sm font-bold text-gray-900">{c.description}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-zammsa-green">{c.weight}%</span>
                      {c.minimum_pass_score && (
                        <p className="text-[10px] font-bold text-gray-400">Min: {c.minimum_pass_score}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addenda */}
          {tender.addenda?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Addenda</h2>
              <div className="space-y-3">
                {tender.addenda.map((a: any) => (
                  <div key={a.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <InformationCircleIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-gray-900">Addendum #{a.number}</p>
                    </div>
                    <p className="text-sm text-gray-600">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Award Notice */}
          {tender.award_notice && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Award Notice</h2>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <p className="text-sm font-bold text-emerald-800">Awarded to: {tender.award_notice.awarded_to}</p>
                <p className="text-sm font-semibold text-emerald-700 mt-1">Amount: {tender.currency} {tender.award_notice.award_amount?.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 mt-1">Date: {new Date(tender.award_notice.award_date).toLocaleDateString()}</p>
                <p className="text-sm text-emerald-700 mt-2">{tender.award_notice.justification}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Dates */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Key Dates</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Issue Date</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(tender.issue_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing Date</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDateTime(tender.closing_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening Date</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDateTime(tender.opening_date)}</p>
                </div>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-2xl text-center text-sm font-bold ${
              isExpired ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {isExpired ? 'Tender Closed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Tender Details</h2>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Procurement Method</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{tender.procurement_method?.replace(/_/g, ' ') || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{tender.category?.replace(/_/g, ' ') || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Value</p>
                <p className="text-sm font-bold text-zammsa-green mt-0.5">{tender.currency} {tender.estimated_value?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Documents */}
          {tender.documents?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Documents</h2>
              <div className="space-y-2">
                {tender.documents.map((doc: any) => (
                  <a key={doc.id} href={doc.file} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{doc.filename}</span>
                    <span className="text-[10px] font-bold text-zammsa-green uppercase">Download</span>
                  </a>
                ))}
              </div>
              {tender.fee_required && (
                <p className="text-xs text-gray-400 mt-3">Document fee: {tender.currency} {tender.fee_amount?.toLocaleString()}</p>
              )}
            </div>
          )}

          {/* Action */}
          <button
            onClick={() => navigate(`/vendor/open-tenders/${tender.id}/bid`)}
            disabled={isExpired}
            className={`w-full px-6 py-3 text-sm font-bold rounded-2xl transition-colors ${
              isExpired
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-zammsa-green text-white hover:bg-zammsa-green/90'
            }`}
          >
            {isExpired ? 'Tender Closed' : 'Submit Bid'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorTenderDetail;
