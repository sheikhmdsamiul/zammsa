import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/outline';

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced', margin: 4 },
  non_citizen: { label: 'Non-Citizen', margin: 0 },
};

const BidSubmission: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [declarationAccurate, setDeclarationAccurate] = useState(false);

  const [bidPrice, setBidPrice] = useState('');

  const [files, setFiles] = useState<Record<string, File | null>>({
    technical: null,
    financial: null,
    security: null,
    zamra: null,
    supporting: null,
  });

  const { data: tender, isLoading } = useQuery({
    queryKey: ['vendor-open-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  const { data: profile } = useQuery({
    queryKey: ['vendor-profile-light'],
    queryFn: () => vendorApi.profile.get(),
  });

  const ceecCategory = (profile?.ceec_category || 'non_citizen') as string;
  const ceecInfo = ceecPreferenceMap[ceecCategory] || ceecPreferenceMap.non_citizen;
  const submissionType = useMemo(() => {
    const method = String(tender?.procurement_method || '').toLowerCase();
    const category = String(tender?.category || '').toLowerCase();
    const isGoods = method.includes('goods') || category.includes('goods');
    return isGoods ? 'Single-Envelope (ITB — Goods)' : 'Single-Envelope (ITB)';
  }, [tender?.procurement_method, tender?.category]);

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

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const isGoodsTender = String(tender?.category || tender?.procurement_method || '').toLowerCase().includes('goods');
  const zamraRequired = isGoodsTender;

  const canSubmit =
    !!files.technical &&
    !!files.financial &&
    !!files.security &&
    (!zamraRequired || !!files.zamra) &&
    declarationAccurate &&
    parsedBidPrice > 0;

  const saveDraft = () => {
    localStorage.setItem(
      `bid-draft-${id}`,
      JSON.stringify({
        bidPrice,
      })
    );
    toast.success('Draft saved locally');
  };

  const submitBid = async () => {
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
      if (files.supporting) form.append('other_supporting', files.supporting);

      form.append('addenda_acknowledged', 'true');
      form.append('bid_price', String(parsedBidPrice));

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

  if (isLoading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!tender) return <div className="text-center py-20 text-gray-400">Tender not found.</div>;

  if (submitted && receipt) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-6">
          <h2 className="text-2xl font-bold text-green-700">Bid Submitted Successfully</h2>

          <div className="bg-gray-50 rounded-lg p-6 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Submission ID</span><span className="font-medium">{receipt.submission_id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Submitted</span><span className="font-medium">{new Date(receipt.submitted_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Solicitation</span><span className="font-medium">{tender.tender_number} — {tender.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bid Price</span><span className="font-medium">K {parsedBidPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          </div>

          <p className="text-sm text-gray-600">A receipt has been emailed to your registered contact email.</p>

          <div className="text-sm text-gray-700 space-y-1">
            <p>1. Bids remain sealed until the closing date.</p>
            <p>2. Public bid opening occurs at the published closing time.</p>
            <p>3. You will be notified of outcome within 30 working days.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => navigate('/vendor/bids')} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">Go to My Bids</button>
            <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Browse More Tenders</button>
          </div>
        </div>
      </div>
    );
  }

  const docRow = (label: string, key: string, required = false, hint = '', accept = '.pdf,.jpg,.jpeg,.png') => {
    const file = files[key];
    return (
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="min-w-[220px] text-gray-700">
          {required ? '* ' : ''}{label}
          {hint ? <span className="text-xs text-gray-500"> {hint}</span> : null}
        </div>
        <label className="flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-zammsa-green">
          <span className="text-gray-600">{file ? file.name : 'Upload file'}</span>
          <input
            type="file"
            className="hidden"
            accept={accept}
            onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
          />
        </label>
        <span className="w-28 text-right font-medium inline-flex justify-end items-center gap-1">
          {file ? <><CheckCircleIcon className="h-4 w-4 text-green-600" /> Uploaded</> : <><XCircleIcon className="h-4 w-4 text-red-500" /> Not uploaded</>}
        </span>
      </div>
    );
  };


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Bid — {tender.tender_number}: {tender.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Closing: {closingDate ? closingDate.toLocaleString() : 'N/A'}
            <span className="ml-3">Time remaining: {timeRemaining}</span>
          </p>
        </div>

        <div className="text-sm text-gray-700">
          <span className="font-semibold">Submission Type:</span> {submissionType}
        </div>

        <div className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Your Bid Documents</h2>
          {docRow('Technical Proposal', 'technical', true, '(PDF, max 50MB)', '.pdf')}
          {docRow('Financial Proposal', 'financial', true, '(PDF)', '.pdf')}
          {docRow('Bid Security', 'security', true, '(Bank Guarantee / Surety)', '.pdf,.jpg,.jpeg,.png')}
          {docRow('ZAMRA Registration', 'zamra', zamraRequired, '(mandatory goods)', '.pdf,.jpg,.jpeg,.png')}
          {docRow('Other Supporting', 'supporting', false, '(optional)', '.pdf,.jpg,.jpeg,.png,.doc,.docx')}
        </div>

        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Total Bid Price (ZMW)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">K</span>
              <input
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
                placeholder="245000.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2 text-sm">
          <h2 className="font-semibold text-gray-900">Citizen Status (auto-detected from CEEC)</h2>
          <p>Your Category: <span className="font-medium">{ceecInfo.label}</span> {ceecInfo.margin > 0 ? `- ${ceecInfo.margin}% preference applied` : ''}</p>
          <p>Evaluated Price (for ranking only): K {evaluatedPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p>Actual contract price if awarded: K {parsedBidPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>

        <div className="border-t pt-4">
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={declarationAccurate} onChange={(e) => setDeclarationAccurate(e.target.checked)} className="mt-0.5" />
            I confirm that all information in this bid is accurate and complete and that submitting a false bid is an offence under Zambian law.
          </label>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <button onClick={saveDraft} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Save Draft</button>
          <button
            onClick={submitBid}
            disabled={!canSubmit || submitting}
            className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <LoadingSpinner size="sm" />}
            Submit Bid Officially
          </button>
        </div>

        <p className="text-xs text-amber-700">Once submitted, bids cannot be modified. Withdrawal is permitted only before the closing deadline.</p>
      </div>
    </div>
  );
};

export default BidSubmission;
