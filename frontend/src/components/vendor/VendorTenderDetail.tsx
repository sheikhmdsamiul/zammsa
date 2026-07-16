import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import api from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import {
  ClockIcon, DocumentTextIcon, PaperClipIcon,
  CheckCircleIcon, InformationCircleIcon,
  LocationMarkerIcon, PhoneIcon, MailIcon, ShieldCheckIcon,
  CalendarIcon, ClipboardListIcon, UserIcon, CurrencyDollarIcon,
  QuestionMarkCircleIcon, BadgeCheckIcon, PaperAirplaneIcon,
} from '@heroicons/react/outline';

const TYPE_LABELS: Record<string, string> = {
  rfb: 'ITB — Invitation to Bid',
  rfp: 'RFP — Request for Proposals',
  rfq: 'RFQ — Request for Quotations',
  rfi: 'RFI — Request for Information',
};

const FORMAT_LABELS: Record<string, string> = {
  single: 'Single Envelope',
  two: 'Two Envelope',
};

const SECURITY_TYPE_LABELS: Record<string, string> = {
  bank_guarantee: 'Bank Guarantee',
  cash_deposit: 'Cash Deposit',
  insurance_bond: 'Insurance Bond',
  fixed_deposit: 'Fixed Deposit Certificate',
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
  const queryClient = useQueryClient();
  const [questionText, setQuestionText] = useState('');
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  const { data: tender, isLoading } = useQuery({
    queryKey: ['vendor-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  const submitQuestion = useMutation({
    mutationFn: (question: string) =>
      api.post('/solicitations/clarifications/', { solicitation: id, question }).then(r => r.data),
    onSuccess: () => {
      toast.success('Question submitted successfully');
      setQuestionText('');
      setShowQuestionForm(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-tender', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit question');
    },
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

          {/* Bill of Quantities */}
          {tender.items?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bill of Quantities</h2>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-200">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Item Description</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2">Unit</th>
                      <th className="px-2 py-2 text-right">Unit Price (Est.)</th>
                      <th className="px-2 py-2 text-right">Total (Est.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tender.items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-3 text-gray-400 font-bold">{idx + 1}</td>
                        <td className="px-2 py-3 font-semibold text-gray-800">{it.description}</td>
                        <td className="px-2 py-3 text-right font-bold text-gray-900">{Number(it.quantity).toLocaleString()}</td>
                        <td className="px-2 py-3 text-gray-600">{it.unit}</td>
                        <td className="px-2 py-3 text-right font-semibold text-gray-700">{tender.currency} {Number(it.unit_price).toLocaleString()}</td>
                        <td className="px-2 py-3 text-right font-bold text-zammsa-green">{tender.currency} {Number(it.total_estimate).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={5} className="px-2 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Estimated Value</td>
                      <td className="px-2 py-3 text-right font-black text-zammsa-green">
                        {tender.currency} {tender.items.reduce((s: number, it: any) => s + Number(it.total_estimate || 0), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">Estimated prices are indicative only and do not constitute the bid ceiling.</p>
            </div>
          )}

          {/* Evaluation Criteria */}
          {tender.evaluation_criteria?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Evaluation Criteria</h2>
              {tender.evaluation_method === 'qcbs' && tender.financial_weight != null && (
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                  <ClipboardListIcon className="w-4 h-4 text-gray-400" />
                  Quality & Cost Based Selection — Financial proposal weight: <span className="font-bold text-gray-700">{tender.financial_weight}%</span>
                </p>
              )}
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

          {/* Clarifications */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Clarifications / Q&A</h2>
              {tender.clarification_cutoff && !isExpired && (() => {
                const cutoff = new Date(tender.clarification_cutoff);
                const now = new Date();
                const canAsk = now <= cutoff;
                return canAsk ? (
                  <button
                    onClick={() => setShowQuestionForm(!showQuestionForm)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
                    Ask a Question
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                    Clarification period ended
                  </span>
                );
              })()}
              {!tender.clarification_cutoff && !isExpired && (
                <button
                  onClick={() => setShowQuestionForm(!showQuestionForm)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
                  Ask a Question
                </button>
              )}
            </div>

            {showQuestionForm && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <p className="text-xs font-bold text-blue-800 mb-2">Submit a clarification question</p>
                <p className="text-[11px] text-blue-600 mb-3">
                  Your question and its answer will be visible to all bidders for transparency.
                  {tender.clarification_cutoff && (
                    <> Deadline: {fmtDateTime(tender.clarification_cutoff)}</>
                  )}
                </p>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type your question about this solicitation..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                />
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    onClick={() => { setShowQuestionForm(false); setQuestionText(''); }}
                    className="px-4 py-2 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!questionText.trim()) {
                        toast.error('Please enter a question');
                        return;
                      }
                      submitQuestion.mutate(questionText.trim());
                    }}
                    disabled={submitQuestion.isPending || !questionText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitQuestion.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <PaperAirplaneIcon className="w-3.5 h-3.5" />
                    )}
                    Submit Question
                  </button>
                </div>
              </div>
            )}

            {tender.clarifications?.length > 0 ? (
              <div className="space-y-3">
                {tender.clarifications.map((c: any) => (
                  <div key={c.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-start gap-2">
                      <QuestionMarkCircleIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-900">{c.question}</p>
                          {c.asked_by && (
                            <span className="text-[10px] font-bold text-gray-400">{c.asked_by}</span>
                          )}
                        </div>
                        {c.answer && (
                          <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <p className="text-sm text-emerald-800">
                              <span className="font-bold text-emerald-700">Answer: </span>{c.answer}
                            </p>
                            {c.answered_at && (
                              <p className="text-[10px] text-emerald-500 mt-1">Answered: {fmtDateTime(c.answered_at)}</p>
                            )}
                          </div>
                        )}
                        {!c.answer && (
                          <p className="text-xs text-amber-600 mt-2 italic font-semibold flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" /> Awaiting response from procurement
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <QuestionMarkCircleIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No clarifications yet</p>
                {tender.clarification_cutoff && !isExpired && (
                  <p className="text-xs text-gray-400 mt-1">
                    You can ask questions until {fmtDateTime(tender.clarification_cutoff)}
                  </p>
                )}
              </div>
            )}
          </div>

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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Format</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {FORMAT_LABELS[tender.submission_format] || tender.submission_format || '---'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Value</p>
                <p className="text-sm font-bold text-zammsa-green mt-0.5">{tender.currency} {tender.estimated_value?.toLocaleString()}</p>
              </div>
              {tender.delivery_location && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Location</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
                    <LocationMarkerIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    {tender.delivery_location}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bid Requirements */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bid Requirements</h2>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                <ShieldCheckIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bid Security</p>
                  {tender.bid_security_required ? (
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                      {SECURITY_TYPE_LABELS[tender.bid_security_type] || tender.bid_security_type || 'Required'}
                      {tender.bid_security_rate != null && (
                        <span className="text-zammsa-green"> · {tender.bid_security_rate}%</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-gray-900 mt-0.5">Not Required</p>
                  )}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bid Validity</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {tender.bid_validity_days ? `${tender.bid_validity_days} days from closing` : '---'}
                  </p>
                </div>
              </div>
              {tender.minimum_technical_threshold != null && (
                <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                  <CheckCircleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min. Technical Threshold</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{tender.minimum_technical_threshold}% to pass</p>
                  </div>
                </div>
              )}
              {tender.citizen_preference && (
                <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                  <BadgeCheckIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Citizen / Local Preference</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">Applicable</p>
                  </div>
                </div>
              )}
              {tender.pre_bid_date && (
                <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                  <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pre-Bid Meeting</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDate(tender.pre_bid_date)}</p>
                    {tender.pre_bid_venue && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <LocationMarkerIcon className="w-3.5 h-3.5" />{tender.pre_bid_venue}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {tender.clarification_cutoff && (
                <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                  <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clarification Deadline</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(tender.clarification_cutoff)}</p>
                  </div>
                </div>
              )}
              {(tender.contact_person || tender.contact_email || tender.contact_phone) && (
                <div className="p-3 bg-gray-50 rounded-2xl flex items-start gap-3">
                  <UserIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact (Procuring Entity)</p>
                    {tender.contact_person && <p className="text-sm font-bold text-gray-900 mt-0.5">{tender.contact_person}</p>}
                    {tender.contact_email && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 break-all">
                        <MailIcon className="w-3.5 h-3.5 shrink-0" />{tender.contact_email}
                      </p>
                    )}
                    {tender.contact_phone && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <PhoneIcon className="w-3.5 h-3.5 shrink-0" />{tender.contact_phone}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          {tender.documents?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Documents</h2>
              <div className="space-y-2">
                {tender.documents.map((doc: any) => (
                  <a key={doc.id} href={doc.file_url || doc.file} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-700 truncate block">{doc.filename || doc.file_path || 'Document'}</span>
                      {doc.file_type && (
                        <p className="text-[10px] text-gray-400 capitalize">{doc.file_type.replace(/_/g, ' ')}</p>
                      )}
                    </div>
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
