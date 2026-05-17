import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckCircleIcon, XCircleIcon, CheckIcon } from '@heroicons/react/outline';

const bidSteps = ['Review Tender', 'Technical Proposal', 'Financial Proposal', 'Bid Security', 'Submit'];

const BidSubmission: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [addendaAcknowledged, setAddendaAcknowledged] = useState(false);
  const [declarations, setDeclarations] = useState({
    accurate: false,
    conflict: false,
    terms: false,
  });
  const [files, setFiles] = useState<Record<string, File | null>>({
    technical: null,
    financial: null,
    security: null,
  });

  const { data: tender, isLoading } = useQuery({
    queryKey: ['vendor-open-tender', id],
    queryFn: () => vendorApi.openTenders.get(id!),
    enabled: !!id,
  });

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const submitBid = async () => {
    if (!declarations.accurate || !declarations.conflict || !declarations.terms) {
      toast.error('Please accept all declarations');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      if (files.technical) form.append('technical_proposal', files.technical);
      if (files.financial) form.append('financial_proposal', files.financial);
      if (files.security) form.append('bid_security', files.security);
      form.append('addenda_acknowledged', addendaAcknowledged ? 'true' : 'false');
      const res = await vendorApi.bids.submitBid(id!, form);
      setReceipt(res);
      setSubmitted(true);
      toast.success('Bid submitted successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    }
    setSubmitting(false);
  };

  if (isLoading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!tender) return <div className="text-center py-20 text-gray-400">Tender not found.</div>;

  if (submitted && receipt) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Bid Submitted Successfully</h2>
          <div className="bg-gray-50 rounded-lg p-6 text-left space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Receipt Number</span>
              <span className="font-bold text-gray-900">{receipt.receipt_number}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Submission ID</span>
              <span className="font-medium text-gray-900">{receipt.submission_id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Submitted At</span>
              <span className="font-medium text-gray-900">{new Date(receipt.submitted_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Financial Envelope</span>
              <span className="font-medium text-green-600">Encrypted</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Documents</span>
              <span className="font-medium text-gray-900">
                <span className="inline-flex items-center gap-1">{receipt.documents_uploaded?.technical_proposal ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Tech</span> |
                <span className="inline-flex items-center gap-1">{receipt.documents_uploaded?.financial_proposal ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Fin</span> |
                <span className="inline-flex items-center gap-1">{receipt.documents_uploaded?.bid_security ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Security</span>
              </span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <button onClick={() => navigate('/vendor/bids')} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">View My Bids</button>
            <button onClick={() => navigate('/vendor/open-tenders')} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Browse More Tenders</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Submit Bid</h1>
        <p className="text-gray-500 mt-1">{tender.title}</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {bidSteps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < step ? 'bg-zammsa-green text-white' :
              i === step ? 'bg-zammsa-green text-white ring-2 ring-zammsa-green ring-offset-2' :
              'bg-gray-200 text-gray-500'
            }`}>{i < step ? <CheckIcon className="h-4 w-4" /> : i + 1}</div>
            <span className={`text-xs ml-1.5 ${i === step ? 'text-zammsa-green font-medium' : 'text-gray-400'}`}>{s}</span>
            {i < bidSteps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-zammsa-green' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review Tender Details</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Tender Number:</span> <span className="font-medium">{tender.tender_number}</span></p>
              <p><span className="text-gray-500">Title:</span> <span className="font-medium">{tender.title}</span></p>
              <p><span className="text-gray-500">Procuring Entity:</span> {tender.procuring_entity}</p>
              <p><span className="text-gray-500">Method:</span> {tender.procurement_method}</p>
              <p><span className="text-gray-500">Estimated Value:</span> {tender.currency} {tender.estimated_value?.toLocaleString()}</p>
              <p><span className="text-gray-500">Closing Date:</span> {new Date(tender.closing_date).toLocaleDateString()}</p>
            </div>
            {tender.documents?.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Tender Documents</h3>
                <div className="space-y-1">
                  {tender.documents.map((doc: any) => (
                    <a key={doc.id} href={doc.file} target="_blank" rel="noreferrer" className="block text-sm text-zammsa-green hover:underline">{doc.filename}</a>
                  ))}
                </div>
              </div>
            )}
            {tender.addenda?.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Addenda</h3>
                <div className="space-y-2">
                  {tender.addenda.map((a: any) => (
                    <div key={a.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <p className="font-medium text-amber-800">Addendum #{a.number}</p>
                      <p className="text-amber-700">{a.description}</p>
                      {a.extended_closing_date && <p className="text-xs text-amber-600 mt-1">Extended closing: {new Date(a.extended_closing_date).toLocaleString()}</p>}
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-3 mt-3">
                  <input type="checkbox" checked={addendaAcknowledged} onChange={(e) => setAddendaAcknowledged(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
                  <span className="text-sm text-gray-600">I acknowledge all addenda issued for this tender.</span>
                </label>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Technical Proposal</h2>
            <p className="text-sm text-gray-500">Upload your technical proposal in PDF format (max 20MB)</p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-zammsa-green transition-colors">
              {files.technical ? (
                <div>
                  <p className="text-sm text-zammsa-green font-medium">{files.technical.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(files.technical.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button onClick={() => handleFileChange('technical', null)} className="text-xs text-red-500 mt-2">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
                  <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileChange('technical', e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Financial Proposal</h2>
            <p className="text-sm text-gray-500">Upload your financial proposal (PDF). This will be encrypted for the two-envelope system.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 mb-4">
              Your financial proposal will be securely encrypted and only opened after technical evaluation is complete.
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-zammsa-green transition-colors">
              {files.financial ? (
                <div>
                  <p className="text-sm text-zammsa-green font-medium">{files.financial.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(files.financial.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button onClick={() => handleFileChange('financial', null)} className="text-xs text-red-500 mt-2">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-gray-500">Click to upload financial proposal</span>
                  <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileChange('financial', e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Bid Security</h2>
            <p className="text-sm text-gray-500">Upload bid security (bank guarantee PDF)</p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-zammsa-green transition-colors">
              {files.security ? (
                <div>
                  <p className="text-sm text-zammsa-green font-medium">{files.security.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(files.security.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button onClick={() => handleFileChange('security', null)} className="text-xs text-red-500 mt-2">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm text-gray-500">Click to upload bank guarantee</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange('security', e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Tender:</span> <span className="font-medium">{tender.title}</span></p>
              <p><span className="text-gray-500">Addenda Acknowledged:</span> <span className="inline-flex items-center gap-1">{addendaAcknowledged || !tender.addenda?.length ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />}</span></p>
              <p><span className="text-gray-500">Technical Proposal:</span> <span className="inline-flex items-center gap-1">{files.technical ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} {files.technical ? 'Uploaded' : 'Missing'}</span></p>
              <p><span className="text-gray-500">Financial Proposal:</span> <span className="inline-flex items-center gap-1">{files.financial ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} {files.financial ? 'Uploaded' : 'Missing'}</span></p>
              <p><span className="text-gray-500">Bid Security:</span> <span className="inline-flex items-center gap-1">{files.security ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} {files.security ? 'Uploaded' : 'Missing'}</span></p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={declarations.accurate} onChange={(e) => setDeclarations((d) => ({ ...d, accurate: e.target.checked }))} className="mt-0.5 rounded border-gray-300" />
                <span className="text-sm text-gray-600">I confirm that all information provided is accurate and complete.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={declarations.conflict} onChange={(e) => setDeclarations((d) => ({ ...d, conflict: e.target.checked }))} className="mt-0.5 rounded border-gray-300" />
                <span className="text-sm text-gray-600">I declare no conflict of interest in submitting this bid.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={declarations.terms} onChange={(e) => setDeclarations((d) => ({ ...d, terms: e.target.checked }))} className="mt-0.5 rounded border-gray-300" />
                <span className="text-sm text-gray-600">I agree to the terms and conditions of this tender.</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/vendor/open-tenders')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            {step === 0 ? 'Back to Tenders' : 'Previous'}
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">Next</button>
          ) : (
            <button onClick={submitBid} disabled={submitting} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center gap-2">
              {submitting && <LoadingSpinner size="sm" />}
              Submit Bid
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidSubmission;
