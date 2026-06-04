import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, CheckCircleIcon, CashIcon,
  CalendarIcon, InformationCircleIcon, ArrowLeftIcon,
  UserGroupIcon, ShieldCheckIcon,
} from '@heroicons/react/outline';

interface FieldErrors {
  contractNumber?: string;
  contractValue?: string;
  startDate?: string;
  endDate?: string;
  selectedBidId?: string;
}

const ContractGeneration: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedBerId = searchParams.get('ber_id');
  const preselectedSolId = searchParams.get('sol_id');

  const [selectedSolicitation, setSelectedSolicitation] = useState(preselectedSolId || '');
  const [selectedBidId, setSelectedBidId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [contractType, setContractType] = useState('po');
  const todayStr = new Date().toISOString().split('T')[0];
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const oneYearStr = oneYearFromNow.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(oneYearStr);
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [generated, setGenerated] = useState(false);
  const [generatedContractId, setGeneratedContractId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { data: solsData, isLoading: solsLoading, error: solsError } = useQuery({
    queryKey: ['solicitations-awarded'],
    queryFn: () => solicitationsApi.list({ status: 'awarded', page_size: 50 }),
  });

  const { data: berData } = useQuery({
    queryKey: ['ber-for-generation', preselectedBerId],
    queryFn: () => evaluationsApi.getBER(preselectedBerId!),
    enabled: !!preselectedBerId,
  });

  const selectedSolicitationObj = useMemo(() => {
    if (!selectedSolicitation) return null;
    return (solsData?.results || []).find((s: any) => s.id === selectedSolicitation) || null;
  }, [selectedSolicitation, solsData]);

  const winnerSubmissionId = berData?.report_content?.winner?.submission_id || berData?.report_content?.technical_evaluation?.[0]?.submission_id;

  React.useEffect(() => {
    if (selectedSolicitationObj && !contractNumber) {
      const solRef = selectedSolicitationObj.sol_number || selectedSolicitationObj.id?.slice(0, 8).toUpperCase();
      setContractNumber(`CTR-${solRef}`);
    }
  }, [selectedSolicitationObj]);

  const { data: passedBidsData, isLoading: bidsLoading, error: bidsError } = useQuery({
    queryKey: ['passed-bids', selectedSolicitation],
    queryFn: () => evaluationsApi.listPassedTechBids(selectedSolicitation),
    enabled: !!selectedSolicitation,
  });

  const passedBids: any[] = passedBidsData?.bids || [];

  React.useEffect(() => {
    if (winnerSubmissionId && passedBids.length > 0) {
      const match = passedBids.find((b) => (b.submission_id || b.id) === winnerSubmissionId);
      if (match) {
        setSelectedBidId(match.bid_id || match.id);
        setContractValue(match.evaluated_price || match.original_price || 0);
      }
    }
  }, [winnerSubmissionId, passedBids]);

  const selectedBid: any = passedBids.find((b) => (b.bid_id || b.id) === selectedBidId);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!contractNumber.trim()) errors.contractNumber = 'Contract number is required';
    if (!selectedBidId) errors.selectedBidId = 'Select the winning bidder';
    if (!contractValue || contractValue <= 0) errors.contractValue = 'Enter a valid contract value';
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      errors.endDate = 'End date must be after start date';
    }
    if (startDate && new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) {
      errors.startDate = 'Start date cannot be in the past';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getFieldClass = (field: string, hasError?: boolean) => {
    const base = 'w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition-all';
    if (touched[field] && (fieldErrors[field as keyof FieldErrors] || hasError)) {
      return `${base} border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200`;
    }
    return `${base} border-gray-200 focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green`;
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        contract_number: contractNumber.trim(),
        solicitation: selectedSolicitation,
        winning_bid: selectedBid?.bid_id || selectedBidId,
        supplier: selectedBid?.supplier_id || selectedBid?.vendor?.[0]?.id || selectedBid?.vendor_id || selectedBid?.supplier || '',
        title: `Contract for ${selectedBid?.bidder_name || selectedBid?.vendor_name || ''}`,
        contract_type: contractType,
        value: contractValue,
        start_date: startDate,
        end_date: endDate,
        status: 'draft',
      };
      if (paymentTerms) payload.payment_terms = paymentTerms;
      if (preselectedBerId) payload.ber = preselectedBerId;
      return contractsApi.create(payload);
    },
    onSuccess: (data: any) => {
      setGenerated(true);
      setGeneratedContractId(data?.id || data?.contract_id || null);
      queryClient.invalidateQueries({ queryKey: ['contracts-list'] });
      toast.success('Contract generated successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data || 'Failed to generate contract';
      const detail = typeof msg === 'string' ? msg : Object.values(msg).flat().join(', ');
      toast.error(detail || 'Failed to generate contract');
    },
  });

  const handleGenerate = () => {
    setTouched({ contractNumber: true, selectedBidId: true, contractValue: true, startDate: true, endDate: true });
    if (!validate()) return;
    generateMutation.mutate();
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate();
  };

  if (generated) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-zammsa-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-10 h-10 text-zammsa-green" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Generated</h2>
          <p className="text-gray-500 mb-2">Contract <span className="font-mono font-semibold text-gray-700">{contractNumber}</span> has been created successfully</p>
          <p className="text-xs text-gray-400 mb-6">Status: Draft — proceed to the standstill period to publish the award notice</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => navigate('/contracts')} className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold text-sm">
              View All Contracts
            </button>
            <button
              onClick={() => navigate(generatedContractId ? `/contracts/${generatedContractId}/standstill` : '/contracts')}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold text-sm"
            >
              Proceed to Standstill
            </button>
            <button onClick={() => navigate(-1)} className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-sm">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Contract Generation</h1>
            <StatusBadge status="draft" />
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-9">Generate a contract from an awarded bid evaluation</p>
        </div>
        {preselectedBerId && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
            <DocumentTextIcon className="w-3.5 h-3.5" /> Linked to BER
          </span>
        )}
      </div>

      {/* Loading / Error / Empty states */}
      {solsLoading ? (
        <LoadingSpinner className="py-12" />
      ) : solsError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <InformationCircleIcon className="w-6 h-6 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-rose-700">Failed to load awarded solicitations</p>
          <p className="text-sm text-rose-500 mt-1">Please try refreshing the page</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm">
            Refresh Page
          </button>
        </div>
      ) : (solsData?.results || []).length === 0 && !preselectedSolId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <InformationCircleIcon className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-700">No awarded solicitations found</p>
          <p className="text-sm text-amber-600 mt-1">Complete the evaluation and ZPC approval process first.</p>
          <button onClick={() => navigate('/evaluations/zpc-approval')} className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">
            Go to ZPC Approval
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-zammsa-green" />
                Contract Details
              </h2>

              <div className="space-y-5">
                {/* Solicitation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Solicitation <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedSolicitation}
                    onChange={(e) => { setSelectedSolicitation(e.target.value); setSelectedBidId(''); }}
                    disabled={!!preselectedSolId}
                    className={`${getFieldClass('solicitation')} ${preselectedSolId ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{preselectedSolId ? 'Loading solicitation...' : 'Select awarded solicitation...'}</option>
                    {(solsData?.results || []).map((sol: any) => (
                      <option key={sol.id} value={sol.id}>
                        {sol.sol_number || ''} — {sol.title || sol.id?.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  {preselectedSolId && (
                    <p className="text-xs text-gray-400 mt-1">Solicitation is pre-selected from the BER workflow</p>
                  )}
                </div>

                {/* Awarded Bidder */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Awarded Bidder <span className="text-red-400">*</span>
                  </label>
                  {bidsLoading ? (
                    <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-400 bg-gray-50">Loading bidders...</div>
                  ) : bidsError ? (
                    <div className="w-full border border-rose-200 rounded-lg px-4 py-2.5 text-sm text-rose-500 bg-rose-50">Failed to load bidders</div>
                  ) : (
                    <>
                      <select
                        value={selectedBidId}
                        onChange={(e) => {
                          setSelectedBidId(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, selectedBidId: undefined }));
                          const bid = passedBids.find((b: any) => (b.bid_id || b.id) === e.target.value);
                          if (bid) setContractValue(bid.evaluated_price || bid.original_price || 0);
                        }}
                        onBlur={() => handleBlur('selectedBidId')}
                        disabled={!selectedSolicitation}
                        className={getFieldClass('selectedBidId', !selectedBidId && touched.selectedBidId)}
                      >
                        <option value="">Select winning bidder...</option>
                        {passedBids.map((b) => (
                          <option key={b.bid_id || b.id} value={b.bid_id || b.id}>
                            {b.bidder_name || b.vendor_name} — K {(b.evaluated_price || b.original_price || 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.selectedBidId && touched.selectedBidId && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.selectedBidId}</p>
                      )}
                      {winnerSubmissionId && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3" /> Winner auto-selected from BER
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Contract Number & Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Contract Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={contractNumber}
                      onChange={(e) => { setContractNumber(e.target.value); setFieldErrors((prev) => ({ ...prev, contractNumber: undefined })); }}
                      onBlur={() => handleBlur('contractNumber')}
                      placeholder="CTR-XXXXXXXX"
                      className={getFieldClass('contractNumber')}
                    />
                    {fieldErrors.contractNumber && touched.contractNumber && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.contractNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Contract Type <span className="text-red-400">*</span>
                    </label>
                    <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green transition-all">
                      <option value="po">Purchase Order</option>
                      <option value="exc">Framework Contract</option>
                    </select>
                  </div>
                </div>

                {/* Contract Value & Payment Terms */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <CashIcon className="w-4 h-4 inline mr-1 text-gray-400" />
                      Contract Value (K) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={contractValue}
                      onChange={(e) => { setContractValue(Number(e.target.value)); setFieldErrors((prev) => ({ ...prev, contractValue: undefined })); }}
                      onBlur={() => handleBlur('contractValue')}
                      className={getFieldClass('contractValue')}
                    />
                    {fieldErrors.contractValue && touched.contractValue && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.contractValue}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Terms</label>
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green transition-all">
                      <option value="net_30">Net 30 Days</option>
                      <option value="net_60">Net 60 Days</option>
                      <option value="net_90">Net 90 Days</option>
                      <option value="advance_50">50% Advance + 50% on Delivery</option>
                      <option value="milestone">Milestone-based</option>
                    </select>
                  </div>
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <CalendarIcon className="w-4 h-4 inline mr-1 text-gray-400" />
                      Start Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setFieldErrors((prev) => ({ ...prev, startDate: undefined })); }}
                      onBlur={() => handleBlur('startDate')}
                      className={getFieldClass('startDate')}
                    />
                    {fieldErrors.startDate && touched.startDate && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.startDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <CalendarIcon className="w-4 h-4 inline mr-1 text-gray-400" />
                      End Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => { setEndDate(e.target.value); setFieldErrors((prev) => ({ ...prev, endDate: undefined })); }}
                      onBlur={() => handleBlur('endDate')}
                      className={getFieldClass('endDate')}
                    />
                    {fieldErrors.endDate && touched.endDate && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.endDate}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <button
                    onClick={() => navigate(preselectedBerId ? `/evaluations/ber/${preselectedSolId}` : '/contracts')}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {preselectedBerId ? 'Back to BER' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending || !selectedSolicitation || !selectedBidId || !contractNumber.trim()}
                    className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-zammsa-green-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {generateMutation.isPending ? (
                      <><LoadingSpinner className="w-4 h-4" /> Generating...</>
                    ) : (
                      <><DocumentTextIcon className="w-4 h-4" /> Generate Contract</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Bid Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-zammsa-green" />
                Selected Bid Details
              </h2>
              {selectedBid ? (
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Bidder</p>
                    <p className="font-semibold text-gray-900">{selectedBid.bidder_name || selectedBid.vendor_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Technical Score</p>
                      <p className="font-semibold text-gray-900">{selectedBid?.overall_technical_score ?? '-'}/100</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Financial Score</p>
                      <p className="font-semibold text-gray-900">{selectedBid?.financial_score ?? '-'}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Evaluated Price</p>
                    <p className="font-semibold text-gray-900">K {(selectedBid.evaluated_price || selectedBid.original_price || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Preference Category</p>
                    <p className="font-semibold text-gray-900 capitalize">{selectedBid.preference_category?.replace('_', ' ') || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">Select a solicitation and bidder to see details</p>
                </div>
              )}
            </div>

            {/* BER Information */}
            {berData && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  Linked BER
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Reference</span>
                    <span className="font-mono font-medium text-blue-900">BER-{berData.id?.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Status</span>
                    <StatusBadge status={berData.status || 'approved'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Signatures</span>
                    <span className="font-medium text-blue-900">{berData.signed_count || 0}/{berData.required_count || 0}</span>
                  </div>
                  {berData.submitted_at && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Submitted</span>
                      <span className="font-medium text-blue-900">{new Date(berData.submitted_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {berData.report_content?.winner && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Winner</span>
                      <span className="font-medium text-blue-900">{berData.report_content.winner.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Committee Info */}
            {berData?.report_content?.evaluation_committees && berData.report_content.evaluation_committees.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UserGroupIcon className="w-4 h-4 text-gray-400" />
                  Evaluation Committee
                </h2>
                {(() => {
                  const ec = berData.report_content.evaluation_committees[0];
                  const memberList = ec.members || [];
                  return (
                    <div className="space-y-1.5 text-sm">
                      {ec.chairperson_name && (
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-gray-600">{ec.chairperson_name}</span>
                          <span className="text-xs text-gray-400">(Chair)</span>
                        </div>
                      )}
                      {Array.isArray(memberList) && memberList.slice(0, 4).map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                          <span className="text-gray-600">{typeof m === 'string' ? m.slice(0, 8) : m.full_name || m.user?.slice(0, 8)}</span>
                        </div>
                      ))}
                      {memberList.length > 4 && (
                        <p className="text-xs text-gray-400">+{memberList.length - 4} more</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractGeneration;
