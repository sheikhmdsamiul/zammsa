import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { XCircleIcon } from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, CheckCircleIcon, CashIcon,
  CalendarIcon, InformationCircleIcon,
} from '@heroicons/react/outline';

const ContractGeneration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBerId = searchParams.get('ber_id');

  const [selectedSolicitation, setSelectedSolicitation] = useState('');
  const [selectedBidId, setSelectedBidId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [generated, setGenerated] = useState(false);

  const { data: solsData, isLoading: solsLoading, error: solsError } = useQuery({
    queryKey: ['solicitations-awarded'],
    queryFn: () => solicitationsApi.list({ status: 'awarded', page_size: 50 }),
  });

  const { data: passedBidsData, isLoading: bidsLoading, error: bidsError } = useQuery({
    queryKey: ['passed-bids', selectedSolicitation],
    queryFn: () => evaluationsApi.listPassedTechBids(selectedSolicitation),
    enabled: !!selectedSolicitation,
  });

  const passedBids = passedBidsData?.bids || [];
  const selectedBid = passedBids.find((b) => (b.bid_id || (b as any).id) === selectedBidId);

  const generateMutation = useMutation({
    mutationFn: () => contractsApi.create({
      contract_number: contractNumber,
      solicitation: selectedSolicitation,
      winning_bid: (selectedBid as any)?.bid_id || selectedBidId,
      supplier: (selectedBid as any)?.vendor?.[0]?.id || (selectedBid as any)?.vendor_id || (selectedBid as any)?.supplier || '',
      title: `Contract for ${selectedBid?.bidder_name || (selectedBid as any)?.vendor_name || ''}`,
      value: contractValue,
      start_date: startDate,
      end_date: endDate,
      status: 'draft',
      ber: preselectedBerId || undefined,
    } as any),
    onSuccess: (data: any) => {
      setGenerated(true);
      toast.success('Contract generated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate contract'),
  });

  const handleGenerate = () => {
    if (!selectedSolicitation || !selectedBidId || !contractNumber || !contractValue || !startDate || !endDate) {
      toast.error('All required fields must be filled');
      return;
    }
    generateMutation.mutate();
  };

  if (generated) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircleIcon className="w-16 h-16 text-zammsa-green mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Generated</h2>
          <p className="text-gray-500 mb-6">Contract {contractNumber} has been created successfully</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/contracts`)} className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold">
              View Contracts
            </button>
            <button onClick={() => navigate(`/contracts/${(generateMutation.data as any)?.id || ''}/standstill`)}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold">
              Proceed to Standstill
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Contract Generation</h1>
            <StatusBadge status="draft" />
          </div>
          <p className="text-sm text-gray-500 mt-1">Generate contract from awarded bid evaluation</p>
        </div>
      </div>

      {solsLoading ? <LoadingSpinner className="py-12" /> : solsError ? (
        <div className="text-center py-12">
          <XCircleIcon className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-rose-600">Failed to load awarded solicitations</p>
          <p className="text-sm text-gray-400 mt-1">Please try refreshing the page</p>
        </div>
      ) : (solsData?.results || []).length === 0 ? (
        <div className="text-center py-12">
          <InformationCircleIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-amber-700">No awarded solicitations found</p>
          <p className="text-sm text-gray-400 mt-1">Complete the evaluation and award process before generating a contract.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                <DocumentTextIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
                Contract Details
                {preselectedBerId && <span className="ml-2 text-xs font-normal text-gray-400">(from BER)</span>}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation</label>
                  <select value={selectedSolicitation} onChange={(e) => { setSelectedSolicitation(e.target.value); setSelectedBidId(''); }}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
                    <option value="">Select awarded solicitation...</option>
                    {(solsData?.results || []).map((sol: any) => (
                      <option key={sol.id} value={sol.id}>{sol.sol_number || sol.title || sol.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Awarded Bidder</label>
                  {bidsLoading ? (
                    <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-400">Loading bidders...</div>
                  ) : bidsError ? (
                    <div className="w-full border border-rose-200 rounded-lg px-4 py-2.5 text-sm text-rose-500">Failed to load bidders</div>
                  ) : (
                    <select value={selectedBidId} onChange={(e) => {
                      setSelectedBidId(e.target.value);
                      const bid = passedBids.find((b: any) => (b.bid_id || b.id) === e.target.value);
                      if (bid) {
                        setContractValue(bid.evaluated_price || (bid as any).original_price || 0);
                      }
                    }} disabled={!selectedSolicitation}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
                      <option value="">Select winning bidder...</option>
                      {passedBids.map((b) => (
                        <option key={b.bid_id || (b as any).id} value={b.bid_id || (b as any).id}>
                          {b.bidder_name || (b as any).vendor_name} — K {(b.evaluated_price || (b as any).original_price || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
                  <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                    placeholder="Enter contract number..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CashIcon className="w-4 h-4 inline mr-1" />
                      Contract Value (K)
                    </label>
                    <input type="number" value={contractValue} onChange={(e) => setContractValue(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
                      <option value="net_30">Net 30</option>
                      <option value="net_60">Net 60</option>
                      <option value="net_90">Net 90</option>
                      <option value="advance_50">50% Advance + 50% on Delivery</option>
                      <option value="milestone">Milestone-based</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CalendarIcon className="w-4 h-4 inline mr-1" />
                      Start Date
                    </label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CalendarIcon className="w-4 h-4 inline mr-1" />
                      End Date
                    </label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => navigate('/contracts')} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                    Cancel
                  </button>
                  <button onClick={handleGenerate} disabled={generateMutation.isPending || !selectedSolicitation || !selectedBidId || !contractNumber}
                    className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    {generateMutation.isPending ? 'Generating...' : 'Generate Contract'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Selected Bid Details</h2>
              {selectedBid ? (
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Bidder</p>
                    <p className="font-medium text-gray-900">{selectedBid.bidder_name || (selectedBid as any).vendor_name}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Technical Score</p>
                    <p className="font-medium text-gray-900">{selectedBid?.overall_technical_score ?? '-'}/100</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Evaluated Price</p>
                    <p className="font-medium text-gray-900">K {(selectedBid.evaluated_price || (selectedBid as any).original_price || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Preference</p>
                    <p className="font-medium text-gray-900">{(selectedBid as any).preference_category || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Select a solicitation and bidder to see details</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractGeneration;
