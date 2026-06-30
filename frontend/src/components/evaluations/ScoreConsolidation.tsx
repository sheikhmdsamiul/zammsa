import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  LockOpenIcon, ExclamationIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon,
  DocumentDownloadIcon, ChartBarIcon, StarIcon, ClipboardListIcon,
} from '@heroicons/react/outline';
import type {
  ConsolidatedBid, ConsolidatedMember, ConsolidatedDetail,
  ConsolidatedScoresResponse, QCBSResult, EvaluationCriterion,
} from '../../types';

type ScoreRow = {
  evaluator_id: string;
  evaluator_name: string;
  raw_score: number;
  weighted_score: number;
};

type CriterionDetail = {
  criterion_id: string;
  criterion_name: string;
  weight: number;
  scores_by_evaluator: ScoreRow[];
};

const ScoreConsolidation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [expandedBids, setExpandedBids] = useState<Record<string, boolean>>({});
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [showConfirmAuth, setShowConfirmAuth] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQCBSModal, setShowQCBSModal] = useState(false);
  const [showQcbsConfirm, setShowQcbsConfirm] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation-detail', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const solicitationAwarded = solicitation?.status === 'awarded';
  const isCombinedMethod = solicitation?.evaluation_method === 'qcbs' || solicitation?.evaluation_method === 'qbs' || (!solicitation?.evaluation_method && solicitation?.type === 'proposal');
  const computeLabel = isCombinedMethod ? 'Calculate Combined Scores' : 'Persist Rankings';
  const methodTitle = isCombinedMethod ? 'Combined Scores' : 'Evaluated Rankings';

  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ['consolidated-scores', solId],
    queryFn: () => evaluationsApi.getConsolidatedScores(solId!).then((data: any) => ({
      ...data,
      bids: (data.bids || []).map((bid: any) => ({
        bidId: bid.bid_id,
        submissionId: bid.submission_id,
        bidderName: bid.bidder_name,
        originalPrice: bid.original_price,
        preferenceCategory: bid.preference_category,
        preferenceMargin: bid.preference_margin,
        overallTechnicalScore: bid.overall_technical_score,
        passed: bid.passed,
        financialEvaluationId: bid.financial_evaluation_id,
        evaluatedPrice: bid.evaluated_price,
        financialScore: bid.financial_score,
        financialSealed: bid.financial_sealed,
        details: bid.details,
        members: bid.members,
        allMembersSubmitted: bid.all_members_submitted,
        membersSubmittedCount: bid.members_submitted_count,
        totalMembers: bid.total_members,
      })),
    })),
    enabled: !!solId,
  });

  const { data: passedBidsData } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
    staleTime: 30000,
  });

  const consolidatedScores: ConsolidatedBid[] = consolidatedData?.bids || [];
  const passedBids: any[] = passedBidsData?.bids || [];
  const awardedWinner = passedBidsData?.winner_name || null;
  const financialOpened = passedBids.some((bid: any) => bid.financial_sealed === false);

  useEffect(() => {
    if (financialOpened) {
      setAuthChecked(true);
    }
  }, [financialOpened]);

  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter(
    (c: EvaluationCriterion) => c.criterion_type === 'technical'
  );

  const isChair = user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR;
  const isDirector = user?.role === ROLES.DIRECTOR_PROCUREMENT;
  const canManage = isChair || isDirector;

  const committeeMembers = useMemo(() => {
    const memberMap = new Map<string, ConsolidatedMember>();
    consolidatedScores.forEach((bid) => {
      bid.members.forEach((m) => {
        if (!memberMap.has(m.id)) {
          memberMap.set(m.id, m);
        }
      });
    });
    return Array.from(memberMap.values());
  }, [consolidatedScores]);

  const membersSubmitted = useMemo(() => {
    const submitted = new Set<string>();
    consolidatedScores.forEach((bid) => {
      bid.members.forEach((m) => {
        if (m.submitted) submitted.add(m.id);
      });
    });
    return submitted;
  }, [consolidatedScores]);

  const allMembersSubmitted = committeeMembers.length > 0 && committeeMembers.every(m => membersSubmitted.has(m.id));

  const discrepancies = useMemo(() => {
    const flags: {
      bidId: string; bidderName: string; criterionName: string;
      memberName: string; score: number; avg: number; diff: number; memberId: string;
    }[] = [];

    consolidatedScores.forEach((bid: ConsolidatedBid) => {
      bid.details.forEach((detail: ConsolidatedDetail) => {
        const scores = detail.scores_by_evaluator || [];
        if (scores.length < 2) return;

        const rawScores = scores.map((s: ScoreRow) => s.raw_score);
        const avg = rawScores.reduce((sum: number, s: number) => sum + s, 0) / rawScores.length;

        scores.forEach((s: ScoreRow) => {
          const diff = Math.abs(s.raw_score - avg);
          if (diff > 15) {
            flags.push({
              bidId: bid.bidId,
              bidderName: bid.bidderName,
              criterionName: detail.criterion_name,
              memberName: s.evaluator_name,
              score: s.raw_score,
              avg: Number(avg.toFixed(2)),
              diff: Number(diff.toFixed(2)),
              memberId: s.evaluator_id,
            });
          }
        });
      });
    });

    return flags;
  }, [consolidatedScores]);

  const hasDiscrepancies = discrepancies.length > 0;

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data) => {
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-scores', solId] });
      queryClient.invalidateQueries({ queryKey: ['phase-status', solId] });
    },
    onError: (err: any) => {
      const errorMessage = err?.response?.data?.error || 'Failed to authorize';
      toast.error(errorMessage);
    },
  });

  const qcbsMutation = useMutation({
    mutationFn: () => evaluationsApi.calculateQCBS(solId!),
    onSuccess: (data) => {
      setShowQCBSModal(true);
      queryClient.invalidateQueries({ queryKey: ['consolidated-scores', solId] });
      queryClient.invalidateQueries({ queryKey: ['phase-status', solId] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      if (isCombinedMethod) {
        toast.success(`Combined scores calculated: Tech ${data.tech_weight}% / Fin ${data.fin_weight}%`);
      } else {
        toast.success('Rankings persisted successfully');
      }
    },
    onError: (err: any) => {
      const label = isCombinedMethod ? 'combined scores' : 'rankings';
      toast.error(err?.response?.data?.error || `Failed to calculate ${label}`);
    },
  });

  const toggleBidExpansion = (bidId: string) => {
    setExpandedBids(prev => ({ ...prev, [bidId]: !prev[bidId] }));
  };

  const exportCSV = () => {
    setShowExportMenu(false);
    toast.loading('Preparing CSV export...');

    const headers = [
      'Bidder', 'Submission ID', 'Overall Tech Score', 'Passed',
      ...committeeMembers.map(m => `${m.name}`),
      'Financial Sealed',
    ];

    const rows = consolidatedScores.map(bid => {
      const memberChecks = committeeMembers.map(m => {
        const member = bid.members.find(mm => mm.id === m.id);
        return member?.submitted ? '1' : '0';
      });
      return [
        `"${bid.bidderName}"`,
        bid.submissionId,
        bid.overallTechnicalScore.toFixed(2),
        bid.passed ? 'Yes' : 'No',
        ...memberChecks,
        bid.financialSealed ? 'Sealed' : 'Opened',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${consolidatedData?.solicitation_number || 'consolidation'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const exportJSON = () => {
    setShowExportMenu(false);
    if (!consolidatedData) {
      toast.error('No data to export');
      return;
    }
    const jsonStr = JSON.stringify(consolidatedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${consolidatedData.solicitation_number || 'consolidation'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('JSON exported');
  };

  if (solLoading || consolidatedLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner className="w-16 h-16" />
        <div className="ml-4">
          <h2 className="text-xl font-semibold text-gray-700">Loading Consolidated Scores...</h2>
          <p className="text-sm text-gray-500">Compiling all technical evaluation data.</p>
        </div>
      </div>
    );
  }

  const passedBidsCount = consolidatedScores.filter(b => b.passed).length;
  const totalBids = consolidatedScores.length;

  const totalMembers = committeeMembers.length;
  const submissionRate = totalMembers > 0 ? Math.round((membersSubmitted.size / totalMembers) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Score Consolidation</h1>
            <div className="flex items-center gap-4 text-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{consolidatedData?.solicitation_number || solId}</span>
                <span className="text-xl">&bull;</span>
                <span>{consolidatedData?.solicitation_title || ''}</span>
              </div>
              <StatusBadge
                status={financialOpened ? 'completed' : 'active'}
                className="bg-white/20 border-white/30 text-white"
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-blue-200 mb-2">Committee Progress</div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-3xl font-bold">{membersSubmitted.size}</span>
                <span className="text-xs text-blue-200">Submitted</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-3xl font-bold">{totalMembers}</span>
                <span className="text-xs text-blue-200">Total</span>
              </div>
              <div className="flex flex-col items-end min-w-[60px]">
                <span className={`text-3xl font-bold ${submissionRate >= 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {submissionRate}%
                </span>
                <span className="text-xs text-blue-200">Done</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-blue-200 mb-2">
            <span>Submission Progress</span>
            <span>{submissionRate}% Complete</span>
          </div>
          <div className="w-full bg-blue-900/50 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-in-out rounded-full ${
                submissionRate >= 100 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              style={{ width: `${submissionRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Bids</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalBids}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passed Technical</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{passedBidsCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discrepancies</p>
          <p className={`text-3xl font-bold mt-1 ${hasDiscrepancies ? 'text-amber-500' : 'text-gray-900'}`}>
            {hasDiscrepancies ? discrepancies.length : 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Financial Status</p>
          <p className={`text-3xl font-bold mt-1 ${financialOpened ? 'text-emerald-600' : 'text-amber-600'}`}>
            {financialOpened ? 'Opened' : 'Sealed'}
          </p>
        </div>
      </div>

      {hasDiscrepancies && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationIcon className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 mb-2">Score Discrepancies Detected</h3>
              <p className="text-sm text-amber-800 mb-3">
                {discrepancies.length} member score(s) deviate more than 15 points from the average on specific criteria.
                Review scores in chair notes below.
              </p>
              <div className="max-h-48 overflow-y-auto bg-white border border-amber-100 rounded-lg p-3 text-sm">
                <p className="font-semibold text-amber-800 mb-2">Discrepancies:</p>
                {discrepancies.slice(0, 10).map((d, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-amber-900 font-medium">{d.bidderName}</p>
                      <p className="text-xs text-amber-700">
                        {d.criterionName}: {d.memberName} scored {d.score} vs avg {d.avg}
                      </p>
                    </div>
                  </div>
                ))}
                {discrepancies.length > 10 && (
                  <p className="text-xs text-amber-600 mt-2">+{discrepancies.length - 10} more</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <DocumentDownloadIcon className="w-4 h-4" />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button onClick={exportCSV} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Export as CSV
              </button>
              <button onClick={exportJSON} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Export as JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {consolidatedScores.map((bid: ConsolidatedBid) => {
        const isExpanded = expandedBids[bid.bidId];
        const passed = bid.passed;

        return (
          <div key={bid.bidId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200">
            <div
              className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleBidExpansion(bid.bidId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {bid.bidderName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{bid.bidderName}</h2>
                    <p className="text-xs text-gray-500">{bid.submissionId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                      {bid.overallTechnicalScore.toFixed(1)}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {passed ? 'Passes' : 'Fails'}
                    </span>
                  </div>
                  <div className="px-3 py-1 rounded bg-gray-100 text-xs font-medium text-gray-600">
                    Fin: {bid.financialSealed ? 'Sealed' : 'Open'}
                  </div>
                  {isExpanded ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400 rotate-180 transition-transform" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400 transition-transform" />
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <>
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {bid.details.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Criterion</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Weight</th>
                            {bid.members.map(m => (
                              <th key={m.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                <div className="flex items-center gap-1">
                                  {m.name.split(' ')[0]}
                                  {m.submitted && <CheckCircleIcon className="w-3 h-3 text-emerald-500" />}
                                </div>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">WTotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {bid.details.map((detail: ConsolidatedDetail) => {
                            const rawScores = detail.scores_by_evaluator?.map((s: ScoreRow) => s.raw_score) || [];
                            const avgRaw = rawScores.length > 0
                              ? rawScores.reduce((sum: number, s: number) => sum + s, 0) / rawScores.length
                              : 0;
                            const weightedScore = avgRaw * (detail.weight / 100);

                            return (
                              <tr key={detail.criterion_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{detail.criterion_name}</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">{detail.weight}%</td>
                                {bid.members.map((member) => {
                                  const memberScore = detail.scores_by_evaluator?.find(
                                    (s: ScoreRow) => s.evaluator_id === member.id
                                  );
                                  return (
                                    <td key={member.id} className="px-4 py-3 text-center">
                                      {memberScore ? (
                                        <span className={`text-sm font-mono ${
                                          memberScore.raw_score >= 70 ? 'text-emerald-600' :
                                          memberScore.raw_score >= 50 ? 'text-amber-600' : 'text-red-600'
                                        }`}>
                                          {memberScore.raw_score.toFixed(1)}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-gray-300">&mdash;</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-center text-sm font-bold text-gray-700">
                                  {avgRaw.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-bold text-emerald-600">
                                  {weightedScore.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Member Submission Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {bid.members.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                          member.submitted
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          member.submitted ? 'bg-emerald-500' : 'bg-gray-300'
                        }`} />
                        <div>
                          <p className="text-xs font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                        </div>
                        {member.submitted && (
                          <CheckCircleIcon className="w-4 h-4 text-emerald-500 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {bid.membersSubmittedCount} of {bid.totalMembers} members submitted
                    </span>
                    {bid.allMembersSubmitted && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                        Complete
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {consolidatedScores.length === 0 && !solicitationAwarded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DocumentDownloadIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Consolidated Scores Available</h3>
          <p className="text-sm text-gray-500 mb-6">
            Technical scores haven't been finalized yet.
          </p>
          <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            Awaiting member submissions
          </div>
        </div>
      )}

      {consolidatedScores.length === 0 && solicitationAwarded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Awarded to {awardedWinner || 'Unknown'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            This solicitation has been awarded. You can view the BER for details.
          </p>
          <button
            onClick={() => navigate(`/evaluations/ber/${solId}`)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            View BER &rarr;
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Technical Ranking</h2>
          {canManage && allMembersSubmitted && (
            <button
              onClick={() => setShowQcbsConfirm(true)}
              disabled={qcbsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              {qcbsMutation.isPending ? 'Calculating...' : computeLabel}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bidder</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Tech Score</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Passed</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Financial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...consolidatedScores]
                .sort((a: ConsolidatedBid, b: ConsolidatedBid) => b.overallTechnicalScore - a.overallTechnicalScore)
                .map((bid: ConsolidatedBid, i: number) => (
                  <tr key={bid.bidId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bid.bidderName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`font-bold ${
                        bid.passed ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {bid.overallTechnicalScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={bid.passed ? 'text-emerald-600' : 'text-red-600'}>
                        {bid.passed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-xs text-amber-600 font-medium">
                        {bid.financialSealed ? 'Sealed' : 'Opened'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chair Discussion Notes</h2>
        <textarea
          value={discussionNotes}
          onChange={(e) => setDiscussionNotes(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter discussion notes for the BER (conflicts, discrepancies, notable observations)..."
        />
        <p className="text-xs text-gray-500 mt-2">
          These notes will be carried into the Bid Evaluation Report.
        </p>
      </div>

      {canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LockOpenIcon className="w-5 h-5 text-blue-500" />
            Authorize Financial Envelope Opening
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Once technical consolidation is complete, authorize the opening of financial envelopes
            for all technically passing bids.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                i
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">Consolidation Status</p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>&bull; Committee: {membersSubmitted.size} of {totalMembers} submitted</p>
                  <p>&bull; Evaluated: {totalBids} bids (Passed: {passedBidsCount})</p>
                  <p>&bull; Financial: {financialOpened ? 'Already opened' : 'Still sealed'}</p>
                  <p>&bull; Discrepancies: {hasDiscrepancies ? `${discrepancies.length} flagged` : 'None'}</p>
                </div>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-75 transition-colors">
            <input
              type="checkbox"
              checked={authChecked}
              onChange={(e) => setAuthChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-500 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-blue-900">I confirm technical consolidation is complete</p>
              <p className="text-xs text-blue-700 mt-0.5">
                This will unseal financial envelopes for passing bids only. Irreversible.
              </p>
            </div>
          </label>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => setShowConfirmAuth(true)}
              disabled={!authChecked || authorizeMutation.isPending || financialOpened}
              className={`px-6 py-3 text-sm font-bold rounded-lg transition-all ${
                !authChecked || financialOpened
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg'
              } ${authorizeMutation.isPending ? 'opacity-70' : ''}`}
            >
              {financialOpened
                ? 'Financial Envelopes Already Opened'
                : authorizeMutation.isPending
                  ? 'Authorizing...'
                  : 'Authorize Financial Envelope Opening'}
            </button>
            <button
              onClick={() => navigate(`/evaluations/${solId}/financial`)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Go to Financial Evaluation &rarr;
            </button>
          </div>

          {authorizeMutation.isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Processing authorization...
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={showConfirmAuth}
        onClose={() => setShowConfirmAuth(false)}
        onConfirm={() => { setShowConfirmAuth(false); authorizeMutation.mutate(); }}
        title="Authorize Financial Envelope Opening?"
        message="This will irreversibly unseal financial envelopes for all technically passing bids. Disqualified bids' envelopes remain permanently sealed."
        variant="warning"
        confirmText="Yes, Authorize Opening"
        cancelText="Cancel"
      />

      <ConfirmModal
        open={showQcbsConfirm}
        onClose={() => setShowQcbsConfirm(false)}
        onConfirm={() => { setShowQcbsConfirm(false); qcbsMutation.mutate(); }}
        title={isCombinedMethod ? "Calculate Combined Scores?" : "Persist Rankings?"}
        message={isCombinedMethod
          ? "This will compute combined technical and financial scores for all technically passing bids. Ensure all financial evaluations are complete."
          : "This will persist the current rankings for all technically passing bids. Ensure all financial evaluations are complete."}
        variant="info"
        confirmText={isCombinedMethod ? "Calculate" : "Persist"}
        cancelText="Cancel"
      />

      {showQCBSModal && qcbsMutation.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowQCBSModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{isCombinedMethod ? 'Combined Scores' : 'Rankings'} Results</h2>
                {isCombinedMethod ? (
                  <p className="text-xs text-gray-500">
                    Weight: Tech {qcbsMutation.data.tech_weight}% / Financial {qcbsMutation.data.fin_weight}%
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Evaluated price-based ranking</p>
                )}
              </div>
              <button onClick={() => setShowQCBSModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Rank</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Tech ({qcbsMutation.data.tech_weight}%)</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Fin ({qcbsMutation.data.fin_weight}%)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(qcbsMutation.data.results as QCBSResult[]).map((r: QCBSResult, i: number) => (
                    <tr key={r.bid_id} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-center font-medium text-gray-500">{r.rank || i + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {r.bidder_name}
                        {i === 0 && <StarIcon className="w-4 h-4 text-yellow-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{r.technical_score.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.financial_score.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-emerald-600">{r.total_score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end">
              <button
                onClick={() => navigate(`/evaluations/${solId}/financial`)}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700"
              >
                Proceed to Financial Evaluation &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreConsolidation;
