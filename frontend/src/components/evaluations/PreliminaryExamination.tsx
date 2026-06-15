import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EvaluationCriterion } from '../../types';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentSearchIcon,
  ShieldCheckIcon, InformationCircleIcon,
} from '@heroicons/react/outline';

interface CheckState {
  criterion: string;
  passed: boolean;
  examId?: string;
}

interface BidExamState {
  bidId: string;
  bidderName: string;
  checks: CheckState[];
  notes: string;
}

const PreliminaryExamination: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [exams, setExams] = useState<Record<string, BidExamState>>({});
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

  const { data: existingExams } = useQuery({
    queryKey: ['preliminary-exams', solId],
    queryFn: () => evaluationsApi.listPreliminaryExams({ page_size: 200 }),
    enabled: !!solId,
  });

  const { data: committeesData } = useQuery({
    queryKey: ['committees-for-prelim', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 5 }),
    enabled: !!solId && !!allCompleted,
  });

  const primaryCommittee = (committeesData?.results || [])[0];
  const bids = bidsData?.results || [];
  const existingExamList: any[] = existingExams?.results || [];

  const mandatoryCriteria: EvaluationCriterion[] = useMemo(() => {
    return (solicitation?.evaluation_criteria || []).filter(
      (c: EvaluationCriterion) => c.criterion_type === 'mandatory'
    );
  }, [solicitation]);

  const saveExamMutation = useMutation({
    mutationFn: (data: { bid: string; criterion: string; is_compliant: boolean; comment?: string }) =>
      evaluationsApi.savePreliminaryExam(data),
    onError: () => toast.error('Failed to save exam result'),
  });

  const initExamination = (bid: any) => {
    const bidId = bid.bid_id || bid.id;
    if (exams[bidId]) return;

    const existingForBid = existingExamList.filter((e: any) => e.bid === bidId);
    const checks: CheckState[] = mandatoryCriteria.map((c) => {
      const match = existingForBid.find((e: any) => e.criterion === c.criterion_name);
      return {
        criterion: c.criterion_name,
        passed: match ? match.is_compliant : false,
        examId: match ? match.exam_id || match.id : undefined,
      };
    });

    setExams(prev => ({
      ...prev,
      [bidId]: {
        bidId,
        bidderName: bid.supplier_name || bid.bidder_name || 'Unknown',
        checks,
        notes: existingForBid.find((e: any) => e.comment)?.comment || '',
      },
    }));
  };

  const toggleCheck = (bidId: string, checkIdx: number) => {
    setExams(prev => {
      const exam = prev[bidId];
      if (!exam) return prev;
      const updatedChecks = exam.checks.map((c, i) =>
        i === checkIdx ? { ...c, passed: !c.passed } : c
      );
      return { ...prev, [bidId]: { ...exam, checks: updatedChecks } };
    });
  };

  const persistChecks = (bidId: string) => {
    const exam = exams[bidId];
    if (!exam) return;
    for (let i = 0; i < exam.checks.length; i++) {
      const check = exam.checks[i];
      if (check.examId) {
        evaluationsApi.updatePreliminaryExam(check.examId, { is_compliant: check.passed });
      } else {
        saveExamMutation.mutate({
          bid: bidId,
          criterion: check.criterion,
          is_compliant: check.passed,
          comment: exam.notes || undefined,
        });
      }
    }
  };

  if (solLoading || bidsLoading) return <LoadingSpinner className="py-12" />;

  const examList = Object.values(exams);
  const allExamined = bids.length > 0 && bids.every((b: any) => {
    const e = exams[b.bid_id || b.id];
    return e && e.checks.length > 0 && e.checks.every(c => c.passed);
  });

  const passedCount = examList.filter(e => e.checks.length > 0 && e.checks.every(c => c.passed)).length;
  const failedCount = examList.filter(e => e.checks.length > 0 && e.checks.some(c => !c.passed)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Preliminary Examination</h1>
            <StatusBadge status={allExamined ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{solId} | Mandatory checks driven by solicitation criteria</p>
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
          <p className="text-2xl font-bold text-emerald-600">{passedCount}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Failed</p>
          <p className="text-2xl font-bold text-rose-600">{failedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          <DocumentSearchIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
          Examination Checklist
        </h2>
        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <InformationCircleIcon className="w-3.5 h-3.5" />
          {mandatoryCriteria.length} mandatory criteria set during solicitation creation — each must PASS for the bid to proceed.
        </p>

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
                  <StatusBadge status={
                    exam.checks.length > 0 && exam.checks.every(c => c.passed) ? 'approved' : 'draft'
                  } />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exam.checks.map((check, idx) => {
                    const criterionMeta = mandatoryCriteria.find(c => c.criterion_name === check.criterion);
                    return (
                      <button key={idx}
                        onClick={() => toggleCheck(bidId, idx)}
                        className={`p-3 rounded-xl text-left border transition-all ${
                          check.passed
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{check.criterion}</span>
                          {check.passed
                            ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                            : <XCircleIcon className="w-4 h-4 text-gray-300" />
                          }
                        </div>
                        {criterionMeta?.scoring_guidance && (
                          <p className="text-[10px] text-gray-400 mt-1">{criterionMeta.scoring_guidance}</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input value={exam.notes} onChange={(e) => setExams(prev => ({
                    ...prev, [bidId]: { ...prev[bidId], notes: e.target.value }
                  }))} placeholder="Examination notes..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                  <button onClick={() => persistChecks(bidId)}
                    className="px-3 py-2 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {allExamined && !allCompleted && (
        <div className="flex justify-end">
          <button onClick={() => {
            bids.forEach((b: any) => persistChecks(b.bid_id || b.id));
            setAllCompleted(true);
            toast.success('Preliminary examination completed');
          }}
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
            {passedCount} of {examList.length} bids passed
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
