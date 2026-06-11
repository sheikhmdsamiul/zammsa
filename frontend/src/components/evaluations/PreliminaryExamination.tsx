import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentSearchIcon,
  ShieldCheckIcon,
} from '@heroicons/react/outline';

import { ConfirmModal } from '../common/ConfirmModal';

interface BidExamination {
  bidId: string;
  bidderName: string;
  securityVerified: boolean;
  docsComplete: boolean;
  eligibilityPass: boolean;
  conformityPass: boolean;
  notes: string;
}

const PreliminaryExamination: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();

  const [exams, setExams] = useState<Record<string, BidExamination>>({});
  const [allCompleted, setAllCompleted] = useState(false);

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['bids-for-examination', solId],
    queryFn: () => bidsApi.list({ solicitation: solId!, page_size: 50 }),
    enabled: !!solId,
  });

  const bids = bidsData?.results || [];

  const { data: committeesData } = useQuery({
    queryKey: ['committees-for-prelim', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 5 }),
    enabled: !!solId && !!allCompleted,
  });

  const primaryCommittee = (committeesData?.results || [])[0];

  const thresholdCheckMutation = useMutation({
    mutationFn: (bidId: string) => evaluationsApi.thresholdCheck(bidId),
    onSuccess: (data: any) => {
      toast.success(`Threshold check: ${data.passed ? 'PASSED' : 'FAILED'}`);
    },
    onError: () => toast.error('Failed to run threshold check'),
  });

  const initExamination = (bid: any) => {
    const bidId = bid.bid_id || bid.id;
    if (!exams[bidId]) {
      setExams(prev => ({
        ...prev,
        [bidId]: {
          bidId,
          bidderName: bid.supplier_name || bid.bidder_name || 'Unknown',
          securityVerified: bid.security_verified || false,
          docsComplete: false,
          eligibilityPass: false,
          conformityPass: false,
          notes: '',
        },
      }));
    }
  };

  if (solLoading || bidsLoading) return <LoadingSpinner className="py-12" />;

  const examList = Object.values(exams);
  const allExamined = bids.length > 0 && bids.every((b: any) => {
    const e = exams[b.bid_id || b.id];
    const secPass = solicitation?.bid_security_required === false ? true : e?.securityVerified;
    return e && secPass && e.docsComplete && e.eligibilityPass && e.conformityPass;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Preliminary Examination</h1>
            <StatusBadge status={allExamined ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{solId} | Mandatory checks before technical evaluation</p>
        </div>
        {!allCompleted && bids.length > 0 && examList.length < bids.length && (
          <button onClick={() => bids.forEach((b: any) => initExamination(b))}
            className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">
            Initialize All Bids
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Total Bids</p>
          <p className="text-2xl font-bold text-gray-900">{bids.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Examined</p>
          <p className="text-2xl font-bold text-zammsa-green">{examList.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Passed</p>
          <p className="text-2xl font-bold text-emerald-600">{examList.filter(e => (solicitation?.bid_security_required === false || e.securityVerified) && e.docsComplete && e.eligibilityPass && e.conformityPass).length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Failed</p>
          <p className="text-2xl font-bold text-rose-600">{examList.filter(e => !(solicitation?.bid_security_required === false || e.securityVerified) || !e.docsComplete || !e.eligibilityPass || !e.conformityPass).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <DocumentSearchIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
          Examination Checklist
        </h2>

        <div className="space-y-4">
          {bids.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No bids received for this solicitation</p>
          )}

          {bids.map((bid: any) => {
            const bidId = bid.bid_id || bid.id;
            const exam = exams[bidId];
            if (!exam) {
              return (
                <div key={bidId} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{bid.supplier_name || bid.bidder_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">Click to begin examination</p>
                  </div>
                  <button onClick={() => initExamination(bid)}
                    className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg">
                    Examine
                  </button>
                </div>
              );
            }

            return (
              <div key={bidId} className="p-5 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{exam.bidderName}</p>
                    <p className="text-xs text-gray-500">BID-{bidId.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => thresholdCheckMutation.mutate(bidId)} disabled={thresholdCheckMutation.isPending}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                      Run Threshold
                    </button>
                    <StatusBadge status={
                      (solicitation?.bid_security_required === false || exam.securityVerified) && exam.docsComplete && exam.eligibilityPass && exam.conformityPass ? 'approved' : 'draft'
                    } />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ...(solicitation?.bid_security_required !== false ? [{ key: 'securityVerified' as const, label: 'Bid Security', desc: 'Bank guarantee / bond valid' }] : []),
                    { key: 'docsComplete' as const, label: 'Documents', desc: 'All required docs submitted' },
                    { key: 'eligibilityPass' as const, label: 'Eligibility', desc: 'Supplier qualified & registered' },
                    { key: 'conformityPass' as const, label: 'Conformity', desc: 'Bid conforms to solicitation' },
                  ].map((check) => (
                    <button key={check.key}
                      onClick={() => setExams(prev => ({
                        ...prev,
                        [bidId]: { ...prev[bidId], [check.key]: !prev[bidId][check.key] },
                      }))}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        exam[check.key as keyof BidExamination]
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{check.label}</span>
                        {exam[check.key as keyof BidExamination]
                          ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                          : <XCircleIcon className="w-4 h-4 text-gray-300" />
                        }
                      </div>
                      <p className="text-[10px] text-gray-400">{check.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <input value={exam.notes} onChange={(e) => setExams(prev => ({
                    ...prev, [bidId]: { ...prev[bidId], notes: e.target.value }
                  }))} placeholder="Examination notes..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {allExamined && !allCompleted && (
        <div className="flex justify-end">
          <ConfirmModal
            open={false}
            onClose={() => {}}
            onConfirm={() => { setAllCompleted(true); toast.success('Preliminary examination completed'); }}
            title="Complete Preliminary Examination?"
            message="This will mark all bids as examined. Individual bid results can still be reviewed later."
            variant="info"
            confirmText="Yes, Complete Examination"
          />
          <button onClick={() => { setAllCompleted(true); toast.success('Preliminary examination completed'); }}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
            Complete Preliminary Examination
          </button>
        </div>
      )}

      {allCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <ShieldCheckIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-emerald-800 mb-2">Preliminary Examination Complete</h2>
          <p className="text-sm text-emerald-600 mb-4">
            {examList.filter(e => (solicitation?.bid_security_required === false || e.securityVerified) && e.docsComplete && e.eligibilityPass && e.conformityPass).length} of {examList.length} bids passed
          </p>
          <button onClick={() => navigate(primaryCommittee ? `/evaluations/${primaryCommittee.id}/scoring` : `/evaluations`)}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold">
            Proceed to Technical Evaluation
          </button>
        </div>
      )}
    </div>
  );
};

export default PreliminaryExamination;
