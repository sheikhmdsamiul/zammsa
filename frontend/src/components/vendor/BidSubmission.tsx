import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';
import { CardSkeleton } from '../common/Skeleton';
import { TenderItem } from '../../types';
import {
  CheckCircleIcon, XCircleIcon, InformationCircleIcon,
  LockClosedIcon, ShieldCheckIcon, ClockIcon,
  ArrowLeftIcon, ArrowRightIcon, CalendarIcon,
  CloudUploadIcon,
} from '@heroicons/react/outline';

const BID_STEPS = [
  { id: 'prechecks', label: 'Pre-checks', subtitle: 'Step 1' },
  { id: 'documents', label: 'Documents', subtitle: 'Step 2' },
  { id: 'pricing', label: 'Pricing & Security', subtitle: 'Step 3' },
  { id: 'confirm', label: 'Confirm & Submit', subtitle: 'Step 4' },
] as const;

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned (≥75% citizen owned)', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered (≥51% citizen owned)', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced (≥25% citizen owned)', margin: 4 },
  non_citizen: { label: 'Non-Citizen', margin: 0 },
};

const ALLOWED_MIME_TYPES = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function fmtDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDefaultExpiryDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days + 30);
  return d.toISOString().split('T')[0];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const FileDropZone: React.FC<{
  label: string;
  required: boolean;
  hint: string;
  accept: string;
  desc: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}> = ({ label, required, hint, accept, desc, file, onFileChange }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    if (f.size > MAX_FILE_SIZE) {
      return `${label} exceeds 50MB maximum file size`;
    }
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    const allowedExts = Object.keys(ALLOWED_MIME_TYPES);
    if (!allowedExts.includes(ext)) {
      return `${label}: file type "${ext}" is not allowed`;
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const err = validate(f);
    if (err) { toast.error(err); return; }
    onFileChange(f);
  }, [label, onFileChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validate(f);
    if (err) { toast.error(err); return; }
    onFileChange(f);
  };

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
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            aria-label={`Upload ${label}`}
            className={`flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragOver ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 hover:border-zammsa-green/50'
            }`}
          >
            <CloudUploadIcon className={`w-5 h-5 ${dragOver ? 'text-zammsa-green' : 'text-gray-300'}`} />
            <span className={`text-sm truncate ${file ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {file ? file.name : 'Drop file here or click to browse'}
            </span>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="w-28 text-right shrink-0">
          {file ? (
            <div className="flex items-center justify-end gap-1">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-bold text-emerald-600">{formatFileSize(file.size)}</span>
            </div>
          ) : (
            <span className={`text-[11px] font-bold flex items-center justify-end gap-1 ${required ? 'text-rose-500' : 'text-gray-400'}`}>
              {required ? <XCircleIcon className="w-4 h-4" /> : null} {required ? 'Required' : 'Optional'}
            </span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 ml-1">{hint}</p>
    </div>
  );
};

const BidSubmissionInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [addendaAcknowledged, setAddendaAcknowledged] = useState<Set<string>>(new Set());
  const [declarationAccurate, setDeclarationAccurate] = useState(false);

  const [files, setFiles] = useState<Record<string, File | null>>({
    technical_proposal: null,
    financial_proposal: null,
    bid_security: null,
    zamra_registration: null,
    other_supporting: null,
  });

  const [itemPrices, setItemPrices] = useState<Record<number, number>>({});
  const [bidPrice, setBidPrice] = useState('');
  const [securityType, setSecurityType] = useState('bank_guarantee');
  const [securityAmount, setSecurityAmount] = useState('');
  const [validityPeriodDays, setValidityPeriodDays] = useState(90);
  const [securityExpiry, setSecurityExpiry] = useState(getDefaultExpiryDate(90));

  const { data: tender, isLoading, error: tenderError } = useQuery({
    queryKey: ['vendor-open-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  const { data: addendaData } = useQuery({
    queryKey: ['vendor-tender-addenda', id],
    queryFn: () => vendorApi.bids.getAddenda(id!),
    enabled: !!id,
  });

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['vendor-profile-light'],
    queryFn: () => vendorApi.profile.get(),
  });

  const ceecCategory = (profile?.ceec_category || 'non_citizen') as string;
  const ceecInfo = ceecPreferenceMap[ceecCategory] || ceecPreferenceMap.non_citizen;

  useEffect(() => {
    if (tender) {
      if (tender.items?.length) {
        const initial: Record<number, number> = {};
        tender.items.forEach((item: TenderItem, i: number) => { initial[i] = item.unit_price; });
        setItemPrices(initial);
      }
      if (tender.bid_validity_days) {
        setValidityPeriodDays(tender.bid_validity_days);
        setSecurityExpiry(getDefaultExpiryDate(tender.bid_validity_days));
      }
      if (tender.bid_security_type) {
        setSecurityType(tender.bid_security_type);
      }
    }
  }, [tender]);

  const lineItemTotal = useMemo(() => {
    if (!tender?.items?.length) return 0;
    return tender.items.reduce((sum: number, item: TenderItem, i: number) => sum + (itemPrices[i] ?? item.unit_price) * item.quantity, 0);
  }, [tender, itemPrices]);

  useEffect(() => {
    if (lineItemTotal > 0 && !bidPrice) {
      setBidPrice(String(lineItemTotal));
    }
  }, [lineItemTotal, bidPrice]);

  const parsedBidPrice = Number((bidPrice || '0').replace(/,/g, '')) || lineItemTotal;

  const evaluatedPrice = useMemo(() => {
    if (!parsedBidPrice || !ceecInfo.margin) return parsedBidPrice;
    return parsedBidPrice * (1 - ceecInfo.margin / 100);
  }, [parsedBidPrice, ceecInfo.margin]);

  const closingDate = tender?.closing_date ? new Date(tender.closing_date) : null;
  const isClosed = closingDate ? new Date() > closingDate : false;

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

  const calculatedSecurityAmount = useMemo(() => {
    const estimatedValue = Number(tender?.estimated_value || 0);
    if (!estimatedValue) return 0;
    const rate = tender?.bid_security_rate || 2;
    return estimatedValue * (rate / 100);
  }, [tender]);

  useEffect(() => {
    if (calculatedSecurityAmount > 0 && !securityAmount) {
      setSecurityAmount(String(Math.round(calculatedSecurityAmount)));
    }
  }, [calculatedSecurityAmount, securityAmount]);

  const addendaList = addendaData?.addenda || tender?.addenda || [];
  const hasAddenda = addendaList.length > 0;
  const isTwoEnvelope = tender?.submission_format === 'two';
  const submissionType = isTwoEnvelope ? 'Two-Envelope System' : 'Single Envelope System';
  const evaluationMethodLabel =
    tender?.evaluation_method === 'lowest_price' ? 'Lowest Evaluated Price' :
    tender?.evaluation_method === 'qcbs' ? `Quality & Cost Based Selection (QCBS) — ${tender.financial_weight || 20}% financial, ${100 - (tender.financial_weight || 20)}% technical` :
    tender?.evaluation_method === 'qbs' ? 'Quality Based Selection (QBS)' :
    tender?.evaluation_method === 'lcs' ? 'Least Cost Selection (LCS)' :
    tender?.evaluation_method === 'fbs' ? 'Fixed Budget Selection (FBS)' :
    tender?.type === 'rfp' ? 'Quality & Cost Based Selection (QCBS)' : 'Lowest Evaluated Price';

  const bidSecurityRequired = tender?.bid_security_required !== false;

  const allDocsUploaded = !!files.technical_proposal && !!files.financial_proposal && (!bidSecurityRequired || !!files.bid_security);

  const allAddendaAcknowledged = hasAddenda ? addendaList.every((a: any) => addendaAcknowledged.has(a.id || a.addendum_id || String(a.number))) : true;
  const canSubmit = allDocsUploaded && declarationAccurate && parsedBidPrice > 0 && allAddendaAcknowledged;

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleClearFile = (key: string) => {
    setFiles((prev) => ({ ...prev, [key]: null }));
  };

  const saveDraft = () => {
    localStorage.setItem(`bid-draft-${id}`, JSON.stringify({ bidPrice, itemPrices, securityType, securityAmount, validityPeriodDays, securityExpiry }));
    toast.success('Draft saved locally');
  };

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(`bid-draft-${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bidPrice) setBidPrice(parsed.bidPrice);
        if (parsed.securityType) setSecurityType(parsed.securityType);
        if (parsed.securityAmount) setSecurityAmount(parsed.securityAmount);
        if (parsed.validityPeriodDays) setValidityPeriodDays(parsed.validityPeriodDays);
        if (parsed.securityExpiry) setSecurityExpiry(parsed.securityExpiry);
        if (parsed.itemPrices) setItemPrices(parsed.itemPrices);
        toast.success('Draft restored from local storage');
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadDraft(); }, [loadDraft]);

  const submitBid = async () => {
    if (!tender) return;
    if (!canSubmit) {
      toast.error('Please complete all mandatory fields before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      if (files.technical_proposal) form.append('technical_proposal', files.technical_proposal);
      if (files.financial_proposal) form.append('financial_proposal', files.financial_proposal);
      if (files.bid_security) form.append('bid_security', files.bid_security);
      if (files.zamra_registration) form.append('zamra_registration', files.zamra_registration);
      if (files.other_supporting) form.append('other_supporting', files.other_supporting);

      form.append('solicitation_id', id!);
      form.append('addenda_acknowledged', 'true');
      form.append('bid_price', String(parsedBidPrice));
      form.append('security_amount', String(Number(securityAmount) || Math.round(calculatedSecurityAmount)));
      form.append('security_type', securityType);
      form.append('validity_period_days', String(validityPeriodDays));
      if (securityExpiry) {
        form.append('security_expiry', securityExpiry);
      }

      if (tender.items?.length) {
        const lineItems = tender.items.map((item: TenderItem, i: number) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: itemPrices[i] ?? item.unit_price,
          total_price: (itemPrices[i] ?? item.unit_price) * item.quantity,
        }));
        form.append('line_items', JSON.stringify(lineItems));
      }

      const res = await vendorApi.bids.submitBid(id!, form);
      setReceipt(res);
      setSubmitted(true);
      toast.success('Bid submitted successfully');
      localStorage.removeItem(`bid-draft-${id}`);
    } catch (err: any) {
      const details = err.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        toast.error(details.join('. '));
      } else {
        toast.error(err.response?.data?.error || 'Submission failed');
      }
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
      toast.error('Upload all required documents (Technical Proposal, Financial Proposal, Bid Security if required)');
      return;
    }
    if (currentStep === 2 && parsedBidPrice <= 0) {
      toast.error('Enter a valid total bid price');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, BID_STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  if (isLoading || profileLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 py-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (tenderError || profileError) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <XCircleIcon className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load submission data</h2>
        <p className="text-gray-500 mb-6">{(tenderError as any)?.message || (profileError as any)?.message || 'Please try again.'}</p>
        <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-3 text-sm font-bold text-white bg-zammsa-green rounded-xl">Back to Tenders</button>
      </div>
    );
  }

  if (!tender) return <div className="text-center py-20 text-gray-400">Tender not found.</div>;
  if (!profile) return <div className="text-center py-20 text-gray-400">Could not load vendor profile. Please try again.</div>;

  if (isClosed && !submitted) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <ClockIcon className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Bidding Closed</h2>
        <p className="text-gray-500 mb-6">The submission deadline for {tender.tender_number} has passed.</p>
        <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-3 text-sm font-bold text-white bg-zammsa-green rounded-xl">Browse Tenders</button>
      </div>
    );
  }

  if (submitted && receipt) {
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
              <div className="flex justify-between"><span className="text-gray-500">Receipt No.</span><span className="font-bold">{receipt.receipt_number || '---'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Submission ID</span><span className="font-bold">{receipt.submission_id || receipt.bid_id || '---'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Submitted</span><span className="font-bold">{receipt.submitted_at ? fmtDateTime(receipt.submitted_at) : fmtDateTime(new Date())}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Solicitation</span><span className="font-bold">{tender.tender_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Supplier</span><span className="font-bold">{profile?.company_name || profile?.contact_person || '---'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Bid Price</span><span className="font-bold">K {parsedBidPrice.toLocaleString()}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Financial Envelope</span>
                <span className="font-bold text-emerald-700">
                  {receipt.financial_envelope_encrypted ? 'Sealed & Encrypted' : 'Opened at public opening'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-left max-w-lg mx-auto mb-8">
            <h3 className="text-sm font-bold text-blue-900 mb-3">What Happens Next</h3>
            <div className="space-y-1.5 text-sm text-blue-800">
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Closing Deadline: {closingDate ? fmtDateTime(closingDate) : '---'}</p>
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Public Bid Opening: {closingDate ? fmtDate(closingDate) : '---'}</p>
              <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Technical & Financial Evaluation: strictly as per evaluation methodology</p>
            </div>
            <p className="text-xs text-blue-500 mt-3">You can withdraw your bid any time before {closingDate ? fmtDateTime(closingDate) : 'the closing deadline'}.</p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => navigate('/vendor/bids')} className="px-6 py-3 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90">View My Bids</button>
            <button onClick={() => window.print()} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Print Receipt</button>
            <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Browse Tenders</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/vendor/open-tenders/${id}`} className="p-2 -ml-2 text-gray-400 hover:text-gray-600" aria-label="Back to tender">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Submit Bid</span>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">{tender.tender_number}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-gray-500">Closing: {closingDate ? fmtDateTime(closingDate) : 'N/A'}</span>
            <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg whitespace-nowrap inline-flex items-center gap-1">
              <ClockIcon className="w-4 h-4" /> {timeRemaining}
            </span>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between max-w-2xl mx-auto" role="navigation" aria-label="Bid submission steps">
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

      {currentStep === 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              Eligibility Checks
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

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-zammsa-green" />
              Submission Format & Policy Notice
            </h2>
            <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
              <p className="text-sm font-bold text-gray-900">System: {submissionType}</p>
              {isTwoEnvelope ? (
                <p className="text-xs text-gray-600 leading-relaxed">
                  In accordance with ZPPA regulations, your Financial Proposal is encrypted and sealed upon submission.
                  Only the Technical Proposal will be accessed at bid opening. Financial proposals remain locked until technical evaluation scores are approved by the Committee.
                </p>
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed">
                  Technical and Financial proposals are submitted together. Bid prices will be read out during public bid opening.
                </p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Evaluation Method:</span>
                <span className="text-xs font-semibold text-blue-800">{evaluationMethodLabel}</span>
              </div>
            </div>
          </div>

          {hasAddenda ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4 text-amber-500" />
                Addendum Acknowledgement
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
                        {a.document?.file ? (
                          <a href={a.document.file} target="_blank" rel="noreferrer" className="text-xs font-bold text-zammsa-green underline hover:text-zammsa-green/80">
                            Download Addendum File
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Notice of Modification</span>
                        )}
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
                          <span className="text-xs font-bold text-gray-600">Acknowledge Addendum #{a.number || i + 1}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-center text-xs font-semibold text-gray-400">
              No addenda issued for this solicitation.
            </div>
          )}
        </div>
      )}

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
              <FileDropZone
                label="Technical Proposal"
                required={true}
                hint="Max file size: 50MB | Accepted: PDF, DOC, DOCX"
                accept=".pdf,.doc,.docx"
                desc="Include: company profile, technical compliance, methodology, staff qualifications, and reference letters."
                file={files.technical_proposal}
                onFileChange={(f) => handleFileChange('technical_proposal', f)}
              />
              <FileDropZone
                label="Financial Proposal"
                required={true}
                hint="Max file size: 50MB | Accepted: PDF, XLSX, XLS"
                accept=".pdf,.xlsx,.xls"
                desc={isTwoEnvelope ? 'This file is encrypted by the system until authorized financial opening.' : 'Contains itemized pricing breakdown matching your BOQ.'}
                file={files.financial_proposal}
                onFileChange={(f) => handleFileChange('financial_proposal', f)}
              />
              {bidSecurityRequired && (
                <FileDropZone
                  label="Bid Security Document"
                  required={true}
                  hint="Must be from a registered commercial bank or insurance firm in Zambia."
                  accept=".pdf,.jpg,.jpeg,.png"
                  desc={`Required rate: ${tender?.bid_security_rate || 2}% of estimated value (K${Math.round(calculatedSecurityAmount).toLocaleString()}).`}
                  file={files.bid_security}
                  onFileChange={(f) => handleFileChange('bid_security', f)}
                />
              )}
              <FileDropZone
                label="ZAMRA Registration Certificate (Optional)"
                required={false}
                hint="Required for pharmaceutical / medical reagent suppliers"
                accept=".pdf,.jpg,.jpeg,.png"
                desc="Product registration certificate issued by ZAMRA."
                file={files.zamra_registration}
                onFileChange={(f) => handleFileChange('zamra_registration', f)}
              />
              <FileDropZone
                label="Other Supporting Documents (Optional)"
                required={false}
                hint="Additional certificates, joint venture agreements, or tax clearance files"
                accept=".pdf,.zip,.doc,.docx"
                desc="Any other relevant attachments supporting your submission."
                file={files.other_supporting}
                onFileChange={(f) => handleFileChange('other_supporting', f)}
              />
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Line Item Pricing</h2>
            {tender.items?.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                      <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Qty</th>
                      <th className="text-center px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Unit</th>
                      <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-36">Unit Price (ZMW)</th>
                      <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-36">Total (ZMW)</th>
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
                              aria-label={`Unit price for ${row.description}`}
                            />
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-bold text-gray-900">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={4} className="px-5 py-4 text-right text-sm text-gray-600">Calculated Line Items Total</td>
                      <td className="px-5 py-4 text-right text-sm text-gray-900">
                        {lineItemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-lg font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green/40 transition-all"
                    aria-label="Total bid price"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Validity Period (Days)</label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={validityPeriodDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 90;
                    setValidityPeriodDays(days);
                    setSecurityExpiry(getDefaultExpiryDate(days));
                  }}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-base font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20"
                  aria-label="Bid validity in days"
                />
              </div>
            </div>

            {bidSecurityRequired && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-zammsa-green" />
                  Bid Security Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Security Type</label>
                    <select
                      value={securityType}
                      onChange={(e) => setSecurityType(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20"
                    >
                      <option value="bank_guarantee">Bank Guarantee</option>
                      <option value="surety_bond">Surety Bond / Insurance</option>
                      <option value="cash_deposit">Cash Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Security Amount (ZMW)</label>
                    <input
                      type="number"
                      value={securityAmount}
                      onChange={(e) => setSecurityAmount(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20"
                      aria-label="Security amount"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Min required: K{Math.round(calculatedSecurityAmount).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" /> Security Expiry Date
                    </label>
                    <input
                      type="date"
                      value={securityExpiry}
                      onChange={(e) => setSecurityExpiry(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Must be ≥ {validityPeriodDays + 28} days from today</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Citizen Preference (Auto-applied from your CEEC profile)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Category</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{ceecInfo.label}</p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preference Margin</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{ceecInfo.margin}%</p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl border-2 border-emerald-200 md:col-span-2">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Evaluated Price (For ranking during evaluation)</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">K {evaluatedPrice.toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-emerald-100 text-[11px] text-emerald-600 space-y-0.5 font-mono">
                  <p>Bid Price: K {parsedBidPrice.toLocaleString()}</p>
                  <p>Preference Discount ({ceecInfo.margin}%): &minus; K {Math.round(parsedBidPrice * ceecInfo.margin / 100).toLocaleString()}</p>
                  <p className="font-bold text-emerald-700">= K {evaluatedPrice.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Bid Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Solicitation', tender.tender_number],
                ['Supplier', profile?.company_name || profile?.contact_person || '---'],
                ['Total Bid Price', `K ${parsedBidPrice.toLocaleString()}`],
                ['Bid Security', bidSecurityRequired ? `K ${Number(securityAmount).toLocaleString()} (${securityType})` : 'Not Required'],
                ['Security Expiry', bidSecurityRequired ? securityExpiry : 'N/A'],
                ['CEEC Status', `${ceecInfo.label} (${ceecInfo.margin}% preference)`],
                ['Documents Uploaded', `${Object.values(files).filter(Boolean).length} file(s) attached`],
                ['Addenda Status', hasAddenda ? 'Acknowledged' : 'No addenda'],
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
                  <li>Once submitted, your bid cannot be modified without withdrawing first</li>
                  <li>You may withdraw your bid at any time prior to the closing deadline</li>
                  <li>{isTwoEnvelope ? 'Financial envelopes remain encrypted until technical evaluation completion.' : 'Your bid will be opened publicly.'}</li>
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
                <p>I, the authorized representative of {profile?.company_name || profile?.contact_person || 'our company'}, confirm that:</p>
                <ul className="list-disc ml-5 mt-2 space-y-1 text-gray-600">
                  <li>All information in this bid is accurate and complete</li>
                  <li>All uploaded documents are authentic and unaltered</li>
                  <li>We are not debarred or under any conflict of interest</li>
                  <li>We accept all terms, conditions, and addenda of this solicitation</li>
                  <li>This submission constitutes a legal commitment</li>
                </ul>
              </div>
            </label>
          </div>
        </div>
      )}

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
              {submitting ? 'Submitting...' : 'Submit Bid'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const BidSubmission: React.FC = () => (
  <ErrorBoundary>
    <BidSubmissionInner />
  </ErrorBoundary>
);

export default BidSubmission;
