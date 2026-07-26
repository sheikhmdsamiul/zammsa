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
  LockOpenIcon, ExclamationIcon, CheckCircleIcon, ChevronDownIcon,
  DocumentDownloadIcon, ChartBarIcon, ArrowRightIcon, ArrowLeftIcon,
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

const ScoreConsolidation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQCBSModal, setShowQCBSModal] = useState(false);
  const [showQcbsConfirm, setShowQcbsConfirm] = useState(false);
  const [showConfirmAuth, setShowConfirmAuth] = useState(false);
  const [sortField, setSortField] = useState<'score' | 'name'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation-detail', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: committeeData } = useQuery({
    queryKey: ['committees-for-consolidation', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 5 }),
    enabled: !!solId,
  });
  const primaryCommittee = (committeeData?.results || [])[0];

  const solicitationAwarded = solicitation?.status === 'awarded';
  const evalMethod = solicitation?.evaluation_method || 'lowest_price';
  const isCombinedMethod = evalMethod === 'qcbs' || evalMethod === 'qbs';
  const isLowestPrice = evalMethod === 'lowest_price' || evalMethod === 'lcs' || evalMethod === 'fbs';
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
  const financialOpened = passedBids.some((bid: any) => bid.financial_sealed === false);

  useEffect(() => {
    if (financialOpened) setAuthChecked(true);
  }, [financialOpened]);

  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter(
    (c: EvaluationCriterion) => c.criterion_type === 'technical'
  );

  const isChairSystem = user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR;
  const isChairCommittee = primaryCommittee ? String(primaryCommittee.chairperson || '') === String(user?.id || '') : false;
  const isDirector = user?.role === ROLES.DIRECTOR_PROCUREMENT;
  const canManage = isChairSystem || isChairCommittee || isDirector;

  const committeeMembers = useMemo(() => {
    const memberMap = new Map<string, ConsolidatedMember>();
    consolidatedScores.forEach((bid) => {
      bid.members.forEach((m) => {
        if (!memberMap.has(m.id)) memberMap.set(m.id, m);
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
      memberName: string; score: number; avg: number; diff: number;
    }[] = [];
    consolidatedScores.forEach((bid) => {
      bid.details.forEach((detail) => {
        const scores = detail.scores_by_evaluator || [];
        if (scores.length < 2) return;
        const rawScores = scores.map((s) => s.raw_score);
        const avg = rawScores.reduce((sum, s) => sum + s, 0) / rawScores.length;
        scores.forEach((s) => {
          const diff = Math.abs(s.raw_score - avg);
          if (diff > 15) {
            flags.push({
              bidId: bid.bidId, bidderName: bid.bidderName,
              criterionName: detail.criterion_name, memberName: s.evaluator_name,
              score: s.raw_score, avg: Number(avg.toFixed(2)), diff: Number(diff.toFixed(2)),
            });
          }
        });
      });
    });
    return flags;
  }, [consolidatedScores]);

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data) => {
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-scores', solId] });
      queryClient.invalidateQueries({ queryKey: ['phase-status', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorize'),
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
        const tw = data.tech_weight ?? (100 - (solicitation?.financial_weight || 20));
        const fw = data.fin_weight ?? (solicitation?.financial_weight || 20);
        toast.success(`Combined scores calculated: Tech ${tw}% / Fin ${fw}%`);
      } else if (isLowestPrice) {
        toast.success('Rankings calculated by evaluated price');
      } else {
        toast.success('Rankings persisted');
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to calculate'),
  });

  const exportCSV = () => {
    setShowExportMenu(false);
    toast.loading('Preparing CSV export...');
    const headers = isCombinedMethod
      ? ['Rank', 'Bidder', 'Submission ID', 'Tech Score', 'Financial Score', 'Total Score', 'Passed', ...committeeMembers.map(m => m.name)]
      : ['Rank', 'Bidder', 'Submission ID', 'Tech Score', 'Evaluated Price', 'Passed', ...committeeMembers.map(m => m.name)];
    const sorted = [...consolidatedScores].sort((a, b) => {
      if (isCombinedMethod) return (b as any).totalScore - (a as any).totalScore || b.overallTechnicalScore - a.overallTechnicalScore;
      return b.overallTechnicalScore - a.overallTechnicalScore;
    });
    const rows = sorted.map((bid, i) => {
      const memberChecks = committeeMembers.map(m => {
        const member = bid.members.find(mm => mm.id === m.id);
        return member?.submitted ? '1' : '0';
      });
      if (isCombinedMethod) {
        return [i + 1, `"${bid.bidderName}"`, bid.submissionId, bid.overallTechnicalScore.toFixed(2), (bid as any).financialScore?.toFixed(2) || '', (bid as any).totalScore?.toFixed(2) || '', bid.passed ? 'Yes' : 'No', ...memberChecks].join(',');
      }
      return [i + 1, `"${bid.bidderName}"`, bid.submissionId, bid.overallTechnicalScore.toFixed(2), bid.evaluatedPrice != null ? Number(bid.evaluatedPrice).toLocaleString() : '', bid.passed ? 'Yes' : 'No', ...memberChecks].join(',');
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

  const sortedBids = useMemo(() => {
    const list = [...consolidatedScores];
    if (sortField === 'score') {
      list.sort((a, b) => sortDir === 'desc' ? b.overallTechnicalScore - a.overallTechnicalScore : a.overallTechnicalScore - b.overallTechnicalScore);
    } else {
      list.sort((a, b) => sortDir === 'desc' ? b.bidderName.localeCompare(a.bidderName) : a.bidderName.localeCompare(b.bidderName));
    }
    return list;
  }, [consolidatedScores, sortField, sortDir]);

  const toggleSort = (field: 'score' | 'name') => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  if (solLoading || consolidatedLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner className="w-12 h-12" />
        <div className="ml-4">
          <h2 className="text-lg font-semibold text-gray-700">Loading Consolidated Scores...</h2>
          <p className="text-sm text-gray-500">Compiling technical evaluation data.</p>
        </div>
      </div>
    );
  }

  const passedBidsCount = consolidatedScores.filter(b => b.passed).length;
  const totalBids = consolidatedScores.length;
  const submissionRate = committeeMembers.length > 0 ? Math.round((membersSubmitted.size / committeeMembers.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(primaryCommittee ? `/evaluations/${primaryCommittee.id}` : '/evaluations')}
              className="text-sm text-indigo-200 hover:text-white mb-2 flex items-center gap-1 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Back to Evaluation Committee
            </button>
            <h1 className="text-2xl font-bold">Score Consolidation</h1>
            <p className="text-indigo-200 text-sm mt-1">
              {consolidatedData?.solicitation_number} &mdash; {consolidatedData?.solicitation_title}
            </p>
          </div>
          <div className="text-right">
            <StatusBadge
              status={financialOpened ? 'completed' : 'active'}
              className="bg-white/20 border-white/30 text-white"
            />
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          {[
            { label: 'Technical Scoring', done: allMembersSubmitted, active: false },
            { label: 'Score Consolidation', done: financialOpened, active: allMembersSubmitted && !financialOpened },
            { label: 'Financial Opening', done: financialOpened, active: false },
            { label: isCombinedMethod ? 'Combined Scoring' : 'Price Ranking', done: false, active: financialOpened },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 mx-2 rounded ${step.done ? 'bg-indigo-500' : 'bg-gray-200'}`} />
              )}
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step.done ? 'bg-indigo-500 text-white' : step.active ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.done ? <CheckCircleIcon className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${step.active ? 'text-indigo-700' : step.done ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Bids</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalBids}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passed Technical</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{passedBidsCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{totalBids > 0 ? Math.round((passedBidsCount / totalBids) * 100) : 0}% of total</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Committee</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{membersSubmitted.size}<span className="text-base font-normal text-gray-400">/{committeeMembers.length}</span></p>
          <p className="text-xs text-gray-400 mt-0.5">{submissionRate}% submitted</p>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border p-4 ${discrepancies.length > 0 ? 'border-amber-200' : 'border-gray-100'}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discrepancies</p>
          <p className={`text-2xl font-bold mt-1 ${discrepancies.length > 0 ? 'text-amber-500' : 'text-gray-900'}`}>{discrepancies.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{discrepancies.length > 0 ? 'Score gaps > 15pts' : 'No issues'}</p>
        </div>
      </div>

      {/* Discrepancy Alert */}
      {discrepancies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">Score Discrepancies Detected</h3>
              <p className="text-xs text-amber-700 mt-1">
                {discrepancies.length} score(s) deviate more than 15 points from the evaluator average. Review the expanded bid details below.
              </p>
              <div className="mt-2 space-y-1">
                {discrepancies.slice(0, 5).map((d, i) => (
                  <p key={i} className="text-xs text-amber-800">
                    <span className="font-semibold">{d.bidderName}</span> &mdash; {d.criterionName}: {d.memberName} scored {d.score} vs avg {d.avg}
                  </p>
                ))}
                {discrepancies.length > 5 && (
                  <p className="text-xs text-amber-600 font-medium">+{discrepancies.length - 5} more discrepancies</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Table + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scores Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Consolidated Technical Scores</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort:</span>
                <button
                  onClick={() => toggleSort('score')}
                  className={`px-2 py-1 text-xs font-medium rounded ${sortField === 'score' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Score {sortField === 'score' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
                <button
                  onClick={() => toggleSort('name')}
                  className={`px-2 py-1 text-xs font-medium rounded ${sortField === 'name' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Name {sortField === 'name' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bidder</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Tech Score</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Financial</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Evaluators</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedBids.map((bid, i) => {
                    const isExpanded = expandedBid === bid.bidId;
                    return (
                      <React.Fragment key={bid.bidId}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setExpandedBid(isExpanded ? null : bid.bidId)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-500">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {bid.bidderName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{bid.bidderName}</p>
                                <p className="text-xs text-gray-400">{bid.submissionId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-lg font-bold ${bid.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                              {bid.overallTechnicalScore.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              bid.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {bid.passed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              bid.financialSealed ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {bid.financialSealed ? 'Sealed' : 'Opened'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-gray-500">
                              {bid.membersSubmittedCount}/{bid.totalMembers}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-4">
                                {/* Score Breakdown Table */}
                                {bid.details.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Score Breakdown by Criterion</h4>
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Criterion</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Weight</th>
                                            {bid.members.map(m => (
                                              <th key={m.id} className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                                                <div className="flex items-center justify-center gap-1">
                                                  {m.name.split(' ')[0]}
                                                  {m.submitted && <CheckCircleIcon className="w-3 h-3 text-emerald-500" />}
                                                </div>
                                              </th>
                                            ))}
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Avg</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Weighted</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {bid.details.map((detail) => {
                                            const rawScores = detail.scores_by_evaluator?.map((s) => s.raw_score) || [];
                                            const avgRaw = rawScores.length > 0 ? rawScores.reduce((sum, s) => sum + s, 0) / rawScores.length : 0;
                                            const weightedScore = avgRaw * (detail.weight / 100);
                                            return (
                                              <tr key={detail.criterion_id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{detail.criterion_name}</td>
                                                <td className="px-3 py-2 text-center text-xs text-gray-500">{detail.weight}%</td>
                                                {bid.members.map((member) => {
                                                  const memberScore = detail.scores_by_evaluator?.find(
                                                    (s) => s.evaluator_id === member.id
                                                  );
                                                  return (
                                                    <td key={member.id} className="px-3 py-2 text-center">
                                                      {memberScore ? (
                                                        <span className={`text-sm font-mono ${
                                                          memberScore.raw_score >= 70 ? 'text-emerald-600' :
                                                          memberScore.raw_score >= 50 ? 'text-amber-600' : 'text-red-600'
                                                        }`}>
                                                          {memberScore.raw_score.toFixed(1)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-300">&mdash;</span>
                                                      )}
                                                    </td>
                                                  );
                                                })}
                                                <td className="px-3 py-2 text-center text-sm font-bold text-gray-700">{avgRaw.toFixed(1)}</td>
                                                <td className="px-3 py-2 text-center text-sm font-bold text-indigo-600">{weightedScore.toFixed(2)}</td>
                                              </tr>
                                            );
                                          })}
                                          <tr className="bg-gray-50 font-bold">
                                            <td className="px-3 py-2 text-sm text-gray-900">Total</td>
                                            <td className="px-3 py-2 text-center text-xs text-gray-500">100%</td>
                                            {bid.members.map(m => <td key={m.id} />)}
                                            <td />
                                            <td className="px-3 py-2 text-center text-sm text-indigo-700">{bid.overallTechnicalScore.toFixed(2)}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Member Submission Status */}
                                <div>
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Evaluator Status</h4>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {bid.members.map((member) => (
                                      <div
                                        key={member.id}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                                          member.submitted
                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                            : 'bg-gray-100 border border-gray-200 text-gray-600'
                                        }`}
                                      >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${member.submitted ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{member.name}</p>
                                          <p className="text-gray-400 capitalize">{member.role}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {consolidatedScores.length === 0 && !solicitationAwarded && (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ChartBarIcon className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">No Scores Available Yet</h3>
                <p className="text-sm text-gray-500">Technical scores haven't been finalized. Waiting for committee members to complete scoring.</p>
              </div>
            )}

            {consolidatedScores.length === 0 && solicitationAwarded && (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircleIcon className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Solicitation Awarded</h3>
                <p className="text-sm text-gray-500 mb-4">This solicitation has been awarded. View the BER for full details.</p>
                <button
                  onClick={() => navigate(`/evaluations/ber/${solId}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700"
                >
                  View BER <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions Sidebar */}
        <div className="space-y-4">
          {/* Submission Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Committee Progress</h3>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Scoring</span>
              <span className={`font-bold ${submissionRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {membersSubmitted.size}/{committeeMembers.length} ({submissionRate}%)
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${submissionRate >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${submissionRate}%` }}
              />
            </div>
            <div className="mt-3 space-y-1.5">
              {committeeMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${membersSubmitted.has(m.id) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700 truncate">{m.name}</span>
                  <span className="text-gray-400 capitalize ml-auto">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculate / Compute Button */}
          {canManage && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">{methodTitle}</h3>
              <p className="text-xs text-gray-500 mb-3">
                {isCombinedMethod
                  ? `Compute combined scores using Tech ${100 - (solicitation?.financial_weight || 20)}% + Financial ${solicitation?.financial_weight || 20}%.`
                  : isLowestPrice
                  ? 'Rank bids by evaluated price. Lowest evaluated price wins.'
                  : 'Persist current technical rankings for all passing bids.'}
              </p>
              {!financialOpened ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800">Open financial envelopes first</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Financial envelopes must be opened and evaluated before combined scores can be calculated.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowQcbsConfirm(true)}
                    disabled={qcbsMutation.isPending}
                    className={`w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      !qcbsMutation.isPending
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ChartBarIcon className="w-4 h-4" />
                    {qcbsMutation.isPending ? 'Calculating...' : computeLabel}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Authorize Financial Opening */}
          {canManage && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <LockOpenIcon className="w-4 h-4 text-blue-500" />
                Financial Envelope Opening
              </h3>
              {financialOpened ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-emerald-700">Financial envelopes have been opened.</p>
                </div>
              ) : !allMembersSubmitted ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800">Complete all technical scoring first.</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {committeeMembers.length - membersSubmitted.size} evaluator(s) have not submitted scores yet. Financial envelopes cannot be opened until all members complete technical scoring.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">
                    Unseal financial envelopes for technically passing bids. This action is irreversible.
                  </p>
                  <label className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={authChecked}
                      onChange={(e) => setAuthChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-indigo-500"
                    />
                    <span className="text-xs text-blue-800">I confirm technical consolidation is complete</span>
                  </label>
                  <button
                    onClick={() => setShowConfirmAuth(true)}
                    disabled={!authChecked || authorizeMutation.isPending}
                    className={`w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      authChecked && !authorizeMutation.isPending
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <LockOpenIcon className="w-4 h-4" />
                    {authorizeMutation.isPending ? 'Authorizing...' : 'Open Financial Envelopes'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Export */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Export Data</h3>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors"
              >
                <DocumentDownloadIcon className="w-4 h-4" />
                Export as...
              </button>
              {showExportMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button onClick={exportCSV} className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg">
                    CSV Spreadsheet
                  </button>
                  <button onClick={() => { setShowExportMenu(false); toast.success('JSON export coming soon'); }} className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100">
                    JSON Data
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Discussion Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Chair Discussion Notes</h3>
            <textarea
              value={discussionNotes}
              onChange={(e) => setDiscussionNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Notes for the BER (conflicts, discrepancies, observations)..."
            />
            <p className="text-xs text-gray-400 mt-1">Carried into the Bid Evaluation Report.</p>
          </div>
        </div>
      </div>

      {/* Modals */}
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
        title={isCombinedMethod ? 'Calculate Combined Scores?' : 'Calculate Rankings?'}
        message={isCombinedMethod
          ? `This will compute combined technical (${100 - (solicitation?.financial_weight || 20)}%) and financial (${solicitation?.financial_weight || 20}%) scores for all technically passing bids with opened financial envelopes.`
          : isLowestPrice
          ? 'This will rank all technically passing bids by evaluated price. The lowest evaluated price wins.'
          : 'This will persist the current technical rankings for all passing bids.'}
        variant="info"
        confirmText={isCombinedMethod ? 'Calculate' : 'Calculate'}
        cancelText="Cancel"
      />

      {showQCBSModal && qcbsMutation.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowQCBSModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{methodTitle} Results</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isCombinedMethod
                    ? `Tech ${qcbsMutation.data.tech_weight ?? (100 - (solicitation?.financial_weight || 20))}% + Financial ${qcbsMutation.data.fin_weight ?? (solicitation?.financial_weight || 20)}%`
                    : isLowestPrice
                    ? 'Ranked by evaluated price (lowest wins)'
                    : 'Technical score-based ranking'}
                </p>
                {qcbsMutation.data.consolidated_by && qcbsMutation.data.consolidated_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Consolidated by {qcbsMutation.data.consolidated_by} at {new Date(qcbsMutation.data.consolidated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button onClick={() => setShowQCBSModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Rank</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    {isCombinedMethod ? (
                      <>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Tech</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Financial</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">Total</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Tech Score</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Evaluated Price</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(qcbsMutation.data.results as QCBSResult[]).map((r, i) => (
                    <tr key={r.bid_id} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-center font-bold text-gray-500">{r.rank || i + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {r.bidder_name}
                        {i === 0 && <span className="ml-1.5 text-yellow-500">★</span>}
                      </td>
                      {isCombinedMethod ? (
                        <>
                          <td className="px-4 py-2 text-right font-mono text-gray-700">{r.technical_score.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-700">{r.financial_score.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center font-mono font-bold text-emerald-600">{r.total_score.toFixed(2)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-right font-mono text-gray-700">{r.technical_score.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-700">
                            {r.evaluated_price != null ? Number(r.evaluated_price).toLocaleString() : 'N/A'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => navigate(`/evaluations/${solId}/financial`)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                Proceed to Financial Evaluation <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreConsolidation;
