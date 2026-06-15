import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { TenderItem } from '../../types';
import {
  CheckCircleIcon, XCircleIcon, InformationCircleIcon,
  LockClosedIcon, ShieldCheckIcon, ClockIcon,
  ArrowLeftIcon, ArrowRightIcon,
} from '@heroicons/react/outline';

const BID_STEPS = [
  { id: 'prechecks', label: 'Pre-checks', subtitle: 'Step 1' },
  { id: 'documents', label: 'Documents', subtitle: 'Step 2' },
  { id: 'pricing', label: 'Pricing', subtitle: 'Step 3' },
  { id: 'confirm', label: 'Confirm & Submit', subtitle: 'Step 4' },
] as const;

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned (\u226575% citizen owned)', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered (\u226551% citizen owned)', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced (\u226525% citizen owned)', margin: 4 },
  non_citizen: { label: 'Non-Citizen', margin: 0 },
};

function fmtDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const BidSubmission: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [addendaAcknowledged, setAddendaAcknowledged] = useState<Set<string>>(new Set());
  const [declarationAccurate, setDeclarationAccurate] = useState(false);

  const [files, setFiles] = useState<Record<string, File | null>>({
    technical: null,
    financial: null,
    security: null,
    zamra: null,
    bidForms: null,
    boq: null,
    supporting: null,
  });

  const [itemPrices, setItemPrices] = useState<Record<number, number>>({});
  const [bidPrice, setBidPrice] = useState('');

  const { data: tender, isLoading } = useQuery({
    queryKey: ['vendor-open-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['vendor-profile-light'],
    queryFn: () => vendorApi.profile.get(),
  });

  const ceecCategory = (profile?.ceec_category || 'non_citizen') as string;
  const ceecInfo = ceecPreferenceMap[ceecCategory] || ceecPreferenceMap.non_citizen;

  useEffect(() => {
    if (tender?.items) {
      const initial: Record<number, number> = {};
      tender.items.forEach((item: TenderItem, i: number) => { initial[i] = item.unit_price; });
      setItemPrices(initial);
    }
  }, [tender]);

  const lineItemTotal = useMemo(() => {
    if (!tender?.items) return 0;
    return tender.items.reduce((sum: number, item: TenderItem, i: number) => sum + (itemPrices[i] ?? item.unit_price) * item.quantity, 0);
  }, [tender, itemPrices]);

  const parsedBidPrice = Number((bidPrice || '0').replace(/,/g, '')) || 0;

  const evaluatedPrice = useMemo(() => {
    if (!parsedBidPrice || !ceecInfo.margin) return parsedBidPrice;
    return parsedBidPrice * (1 - ceecInfo.margin / 100);
  }, [parsedBidPrice, ceecInfo.margin]);

  const closingDate = tender?.closing_date ? new Date(tender.closing_date) : null;
  const timeRemaining = useMemo(() => {
    if (!closingDate) return 'N/A';
    const now = new Date();
    const diffMs = closingDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'Closed';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    return `${days}d ${hours}h ${mins}m`;
  }, [closingDate]);

  const securityRequiredAmount = useMemo(() => {
    const estimatedValue = Number(tender?.estimated_value || 0);
    if (!estimatedValue) return 0;
    const rate = tender?.bid_security_rate || 2;
    return estimatedValue * (rate / 100);
  }, [tender]);

  const addendaList = tender?.addenda || [];
  const hasAddenda = addendaList.length > 0;
  const submissionType = tender?.submission_format === 'two' ? 'Two-Envelope System' : 'Single Envelope System';
  const evaluationMethodLabel =
    tender?.evaluation_method === 'lowest_price' ? 'Lowest Evaluated Price' :
    tender?.evaluation_method === 'qcbs' ? `Quality & Cost Based Selection (QCBS) — ${tender.financial_weight || 20}% financial, ${100 - (tender.financial_weight || 20)}% technical` :
    tender?.evaluation_method === 'qbs' ? 'Quality Based Selection (QBS)' :
    tender?.evaluation_method === 'lcs' ? 'Least Cost Selection (LCS)' :
    tender?.evaluation_method === 'fbs' ? 'Fixed Budget Selection (FBS)' :
    tender?.type === 'rfp' ? 'Quality & Cost Based Selection (QCBS)' : 'Lowest Evaluated Price';
  const isGoods = tender?.type === 'rfb' || tender?.type === 'rfq';
  const zamraRequired = isGoods;
  const bidSecurityRequired = tender?.bid_security_required !== false;

  const allDocsUploaded = !!files.technical && !!files.financial && (!bidSecurityRequired || !!files.security) && (!zamraRequired || !!files.zamra) && !!files.bidForms && !!files.boq;

  const allAddendaAcknowledged = hasAddenda ? addendaList.every((a: any) => addendaAcknowledged.has(a.id || a.addendum_id || String(a.number))) : true;
  const canSubmit = allDocsUploaded && declarationAccurate && parsedBidPrice > 0;

  const handleFileChange = (key: string, file: File | null) => {
    if (file && file.size > 50 * 1024 * 1024) {
      toast.error('Each bid document must be 50MB or smaller');
      return;
    }
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const saveDraft = () => {
    localStorage.setItem(`bid-draft-${id}`, JSON.stringify({ bidPrice, itemPrices }));
    toast.success('Draft saved locally');
  };

  const submitBid = async () => {
    if (!tender) return;
    if (!canSubmit) {
      toast.error('Please complete all mandatory fields before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      if (files.technical) form.append('technical_proposal', files.technical);
      if (files.financial) form.append('financial_proposal', files.financial);
      if (files.security) form.append('bid_security', files.security);
      if (files.zamra) form.append('zamra_registration', files.zamra);
      if (files.bidForms) form.append('bid_forms', files.bidForms);
      if (files.boq) form.append('boq', files.boq);
      if (files.supporting) form.append('other_supporting', files.supporting);
      form.append('addenda_acknowledged', 'true');
      form.append('bid_price', String(parsedBidPrice));
      form.append('security_amount', String(Math.round(securityRequiredAmount)));
      form.append('security_type', tender?.bid_security_type || 'bank_guarantee');
      form.append('validity_period_days', String(tender?.bid_validity_days || 90));

      const lineItems = tender.items.map((item: TenderItem, i: number) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: itemPrices[i] ?? item.unit_price,
        total_price: (itemPrices[i] ?? item.unit_price) * item.quantity,
      }));
      form.append('line_items', JSON.stringify(lineItems));

      const res = await vendorApi.bids.submitBid(id!, form);
      setReceipt(res);
      setSubmitted(true);
      toast.success('Bid submitted successfully');
      localStorage.removeItem(`bid-draft-${id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    }
    setSubmitting(false);
  };

  const nextStep = () => {
    if (currentStep === 0 && hasAddenda && !allAddendaAcknowledged) {
      const missing = addendaList
        .filter((a: any) => !addendaAcknowledged.has(a.id || a.addendum_id || String(a.number)))
        .map((a: any) => `Addendum #${a.number || '---'}`);
      toast.error(`Please acknowledge: ${missing.join(', ')}`);
      return;
    }
    if (currentStep === 1 && !allDocsUploaded) {
      toast.error('Upload all required documents before proceeding');
      return;
    }
    if (currentStep === 2 && parsedBidPrice <= 0) {
      toast.error('Enter a valid total bid price');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, BID_STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  const docUploadRow = (
    label: string,
    key: string,
    required: boolean,
    hint: string,
    accept: string,
    desc: string
  ) => {
    const file = files[key];
    return (
      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-gray-900">
                {required && '* '}{label}
              </p>
              {file && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                  Uploaded
                </span>
              )}
            </div>
            {desc && <p className="text-[11px] text-gray-500 mb-3">{desc}</p>}
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-zammsa-green/50 transition-colors">
                <span className="text-sm text-gray-400">
                  {file ? file.name : 'Upload file'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={accept}
                  onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
                />
              </label>
              {file && (
                <button
                  onClick={() => handleFileChange(key, null)}
                  className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          </div>
          <div className="w-28 text-right shrink-0">
            {file ? (
              <div className="flex items-center justify-end gap-1">
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-bold text-emerald-600">{file.name.endsWith('.pdf') ? 'PDF' : file.name.split('.').pop()?.toUpperCase()} — {(file.size / 1024 / 1024).toFixed(1)}MB</span>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-rose-500 flex items-center justify-end gap-1">
                <XCircleIcon className="w-4 h-4" /> Not uploaded
              </span>
            )}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 ml-1">{hint}</p>
      </div>
    );
  };

  if (isLoading || profileLoading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!tender) return <div className="text-center py-20 text-gray-400">Tender not found.</div>;
  if (!profile) return <div className="text-center py-20 text-gray-400">Could not load vendor profile. Please try again.</div>;

  if (submitted && receipt) {
    const bidRef = receipt.submission_id || receipt.bid_id || `BID-${new Date().getFullYear()}-${(tender.tender_number || 'XXX').split('-').slice(1).join('-')}-XXX`;
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Bid Submitted Successfully</h2>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left max-w-lg mx-auto my-8">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Official Submission Receipt</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Submission ID</span><span className="font-bold">{receipt.submission_id || bidRef}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Submitted</span><span className="font-bold">{receipt.submitted_at ? fmtDateTime(receipt.submitted_at) : fmtDateTime(new Date())}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Solicitation</span><span className="font-bold">{tender.tender_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Supplier</span><span className="font-bold">{profile?.company_name || profile?.contact_person || '---'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bid Price</span><span className="font-bold">K {parsedBidPrice.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Documents</span><span className="font-bold">{Object.values(files).filter(Boolean).length} files</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-bold flex items-center gap-1"><LockClosedIcon className="w-4 h-4" /> Sealed — awaiting opening</span></div>
            </div>
            <p className="text-xs text-gray-400 mt-4">A copy of this receipt has been emailed to: {profile?.email || 'your registered email'}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-left max-w-lg mx-auto mb-8">
            <h3 className="text-sm font-bold text-blue-900 mb-3">What Happens Next</h3>
            <div className="space-y-1.5 text-sm text-blue-800">
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Closing Deadline: {closingDate ? fmtDateTime(closingDate) : '---'}</p>
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Public Bid Opening: {closingDate ? fmtDate(closingDate) : '---'} 14:30 CAT</p>
              {closingDate && <p className="text-xs text-blue-600 mt-1">Join the live opening: portal.zammsa.gov.zm/opening/live</p>}
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Evaluation outcome: approx. 30 working days</p>
            </div>
            <p className="text-xs text-blue-500 mt-3">You can withdraw your bid any time before {closingDate ? fmtDateTime(closingDate) : 'the closing deadline'}.</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/vendor/bids')} className="px-6 py-3 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90">View My Bids</button>
            <button className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Print Receipt</button>
            <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Browse More Tenders</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/vendor/open-tenders/${id}`} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Submit Bid</span>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">{tender.tender_number}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-gray-500">Closing: {closingDate ? fmtDateTime(closingDate) : 'N/A'}</span>
            <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg whitespace-nowrap inline-flex items-center gap-1"><ClockIcon className="w-4 h-4" /> {timeRemaining}</span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {BID_STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < currentStep ? 'bg-zammsa-green text-white' :
                    i === currentStep ? 'bg-zammsa-green text-white ring-4 ring-zammsa-green/20' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {i < currentStep ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 whitespace-nowrap ${
                    i === currentStep ? 'text-zammsa-green' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < BID_STEPS.length - 1 && (
                  <div className={`w-10 sm:w-16 h-0.5 mx-2 sm:mx-3 ${i < currentStep ? 'bg-zammsa-green' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1 — Pre-checks */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              Eligibility Checks (system auto-verified)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['Solicitation status', `Open (closes in ${timeRemaining})`, true],
                ['Your account status', 'Active', true],
                ['ZPPA Debarment', 'Not debarred', true],
                ['ZRA Tax Clearance', (profile as any)?.zra_expiry ? `Valid until ${fmtDate((profile as any).zra_expiry)}` : 'Verified', true],
                ['PACRA Registration', `Active — ${profile?.company_name || profile?.contact_person || 'Your Company'}`, true],
                ['CEEC Certificate', `${ceecInfo.label}${(profile as any)?.ceec_expiry ? ` — valid until ${fmtDate((profile as any).ceec_expiry)}` : ''}`, true],
              ].map(([label, value, pass]) => (
                <div key={label as string} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  {pass ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label as string}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{value as string}</p>
                    {label === 'CEEC Certificate' && ceecInfo.margin > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">{ceecInfo.margin}% preference margin will be applied to your bid</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasAddenda && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4" />
                Addendum Acknowledgement (required before proceeding)
              </h2>
              <div className="space-y-4">
                {addendaList.map((a: any, i: number) => {
                  const aKey = a.id || a.addendum_id || String(a.number);
                  const checked = addendaAcknowledged.has(aKey);
                  return (
                    <div key={aKey} className={`p-5 rounded-2xl border-2 transition-colors ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <p className="text-sm font-bold text-gray-900">Addendum No. {a.number || i + 1} — {a.issued_at ? fmtDate(a.issued_at) : '---'}</p>
                      <p className="text-sm text-gray-700 mt-1">{a.description || 'No description provided.'}</p>
                      <div className="flex items-center justify-between mt-3">
                        <button className="text-xs font-bold text-zammsa-green underline hover:text-zammsa-green/80">
                          Download and Read Addendum
                        </button>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(addendaAcknowledged);
                              if (e.target.checked) next.add(aKey);
                              else next.delete(aKey);
                              setAddendaAcknowledged(next);
                            }}
                            className="text-zammsa-green focus:ring-zammsa-green rounded"
                          />
                          <span className="text-xs font-bold text-gray-600">Acknowledge</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasAddenda && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
              <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl">
                <ShieldCheckIcon className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="text-sm font-bold text-gray-900">Submission Type</p>
                  <p className="text-sm text-gray-500">This solicitation uses: <strong>{submissionType}</strong></p>
                  <p className="text-xs text-gray-400 mt-1">(Technical and financial documents submitted together. Prices are read out at public bid opening.)</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Evaluation:</span>
                    <span className="text-xs font-semibold text-blue-800">{evaluationMethodLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Documents */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Required Documents</h2>
              <span className="text-xs font-bold text-gray-400 inline-flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5" /> Closing: {closingDate ? fmtDateTime(closingDate) : '---'} — {timeRemaining}
              </span>
            </div>
            <div className="space-y-4">
              {docUploadRow(
                'Technical Proposal',
                'technical', true, 'Max file size: 50MB | Accepted: PDF only',
                '.pdf',
                'Include: company profile, experience, references, sample product documentation, after-sales plan'
              )}
              {docUploadRow(
                'Financial Proposal',
                'financial', true, 'Max file size: 50MB | Accepted: PDF only',
                '.pdf',
                submissionType === 'Two-Envelope System'
                  ? 'This file is sealed by the system until authorized financial opening.'
                  : 'This file is submitted with the bid and may be read at bid opening.'
              )}
              {bidSecurityRequired && docUploadRow(
                'Bid Security Document',
                'security', true, 'Must be from a registered commercial bank in Zambia. Valid for: 118 days from closing date (90+28 days)',
                '.pdf,.jpg,.jpeg,.png',
                `Bank guarantee — ${tender?.bid_security_rate || 2}% of the solicitation estimated value (K${Math.round(securityRequiredAmount).toLocaleString()})`
              )}
              {zamraRequired && docUploadRow(
                'ZAMRA Product Registration Certificates',
                'zamra', true, 'Required for each reagent product line being offered',
                '.pdf,.jpg,.jpeg,.png',
                'Required for each reagent product line being offered'
              )}
              {docUploadRow(
                'Completed Bid Forms',
                'bidForms', true, 'ZPPA standard forms — download from solicitation documents',
                '.pdf',
                'ZPPA standard forms — download from solicitation documents'
              )}
              {docUploadRow(
                'Completed Bill of Quantities (BOQ)',
                'boq', true, 'Must match your pricing in Step 3',
                '.xlsx,.xls,.pdf,.csv',
                ''
              )}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-sm font-bold text-gray-900 mb-2">Additional Supporting Documents (optional)</p>
                <label className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-zammsa-green/50 transition-colors">
                  <span className="text-sm text-gray-400">Drag files here or Browse</span>
                  <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    handleFileChange('supporting', f);
                  }} />
                </label>
                {files.supporting && (
                  <div className="mt-3 flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-gray-700">{files.supporting.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">({(files.supporting.size / 1024 / 1024).toFixed(1)}MB)</span>
                    </div>
                    <button onClick={() => handleFileChange('supporting', null)} className="p-1 text-gray-300 hover:text-rose-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Pricing */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Bid Pricing</h2>
            <p className="text-[11px] text-gray-400 mb-4">Enter your bid prices for each item below. These must match the figures in your uploaded BOQ.</p>

            <div className="overflow-hidden rounded-2xl border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                    <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Qty</th>
                    <th className="text-center px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Unit</th>
                    <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-28">Unit K</th>
                    <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-28">Total K</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tender.items.map((row: TenderItem, i: number) => {
                    const unitPrice = itemPrices[i] ?? row.unit_price;
                    const total = row.quantity * unitPrice;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{row.description}</td>
                        <td className="px-5 py-4 text-right text-sm text-gray-600">{row.quantity}</td>
                        <td className="px-5 py-4 text-center text-sm text-gray-600">{row.unit}</td>
                        <td className="px-5 py-4 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={unitPrice}
                            onChange={(e) => setItemPrices(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                            className="w-full text-right text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zammsa-green/20"
                          />
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-bold text-gray-900">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={4} className="px-5 py-4 text-right text-sm text-gray-600">TOTAL</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-900">
                      {lineItemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Total Bid Price (ZMW) *</label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400">K</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(e.target.value.replace(/[^0-9,.]/g, ''))}
                    placeholder="Enter total bid price"
                    className="w-64 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-lg font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green/40 transition-all"
                  />
                </div>
              </div>

              <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bid Security Amount Confirmed</p>
                <p className="text-sm font-bold text-gray-900">
                  {(tender?.bid_security_rate || 2)}% of estimated value K{Number(tender.estimated_value || 0).toLocaleString()} = K{Math.round(securityRequiredAmount).toLocaleString()}
                </p>
                {files.security && (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Your uploaded bank guarantee meets requirement
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Citizen Preference (auto-applied from your CEEC profile)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Category</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{ceecInfo.label}</p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preference Margin</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{ceecInfo.margin}%</p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Bid Price</p>
                <p className="text-sm font-bold text-gray-900 mt-1">K {parsedBidPrice.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl border-2 border-emerald-200 md:col-span-2">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Evaluated Price (for ranking)</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">K {evaluatedPrice.toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-emerald-100 text-[11px] text-emerald-600 space-y-0.5 font-mono">
                  <p>Bid Price: K {parsedBidPrice.toLocaleString()}</p>
                  <p>Preference Discount ({ceecInfo.margin}%): &minus; K {Math.round(parsedBidPrice * ceecInfo.margin / 100).toLocaleString()}</p>
                  <p className="font-bold text-emerald-700">= K {evaluatedPrice.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1"><InformationCircleIcon className="w-3.5 h-3.5" /> Evaluated price is used ONLY for ranking during evaluation. If awarded, your CONTRACT price = K{parsedBidPrice.toLocaleString()} (actual bid).</p>
          </div>
        </div>
      )}

      {/* Step 4 — Confirm & Submit */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Bid Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Solicitation', tender.tender_number],
                ['Supplier', profile?.company_name || profile?.contact_person || '---'],
                ['Total Bid Price', `K ${parsedBidPrice.toLocaleString()}`],
                ['Bid Security', `K ${Math.round(securityRequiredAmount).toLocaleString()} — ${files.security?.name || 'Bank Guarantee'}`],
                ['CEEC Status', `${ceecInfo.label} (${ceecInfo.margin}% preference)`],
                ['Documents', `${Object.values(files).filter(Boolean).length} files uploaded \u2705`],
                ['Addendum', `${hasAddenda ? 'Acknowledged \u2705' : 'N/A'}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-amber-900 mb-2">Important — Read Before Submitting</h2>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-4">
                  <li>Once submitted, your bid CANNOT be modified</li>
                  <li>You may WITHDRAW your bid only before closing deadline</li>
                  <li>Your bid documents are encrypted and sealed until opening</li>
                  <li>Submitting false information is an offence under the Public Procurement Act No.8 of 2020 (Zambia)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Declaration *</h2>
            <label className="flex items-start gap-4 p-6 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent hover:border-zammsa-green/20">
              <input type="checkbox" checked={declarationAccurate} onChange={(e) => setDeclarationAccurate(e.target.checked)} className="mt-1 text-zammsa-green focus:ring-zammsa-green rounded" />
              <div className="text-sm font-semibold text-gray-700 leading-relaxed">
                <p>I, the authorised representative of {profile?.company_name || profile?.contact_person || 'our company'}, confirm that:</p>
                <ul className="list-disc ml-5 mt-2 space-y-1 text-gray-600">
                  <li>All information in this bid is accurate and complete</li>
                  <li>All documents are authentic and unaltered</li>
                  <li>We are not debarred or under any conflict of interest</li>
                  <li>We accept the terms and conditions of the solicitation</li>
                  <li>This submission is legally binding on our company</li>
                </ul>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm px-8 py-4 flex items-center justify-between">
        <button onClick={currentStep === 0 ? () => navigate(`/vendor/open-tenders/${id}`) : prevStep} className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          {currentStep === 0 ? 'Cancel' : <><ArrowLeftIcon className="w-4 h-4" /> Back</>}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={saveDraft} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Save Draft
          </button>
          {currentStep < BID_STEPS.length - 1 ? (
            <button onClick={nextStep} className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors">
              Next <ArrowRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submitBid}
              disabled={!canSubmit || submitting}
              className="px-6 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              {submitting ? 'Submitting...' : '\uD83D\uDD12 Submit Bid'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidSubmission;
