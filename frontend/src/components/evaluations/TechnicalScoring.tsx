import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { bidsApi } from '../../api/bids';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { EvaluationCriterion } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, ArrowLeftIcon, XCircleIcon,
} from '@heroicons/react/outline';

type PrelimCheck = {
  criterion: string;
  passed: boolean;
};

const DEFAULT_PRELIM_CHECKS: PrelimCheck[] = [
  { criterion: 'Bid security provided', passed: false },
  { criterion: 'Bid validity period met', passed: false },
  { criterion: 'All required forms submitted', passed: false },
];

const TechnicalScoring: React.FC = () => {
  const { committeeId } = useParams<{ committeeId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentBidIndex, setCurrentBidIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, Record<string, { score: number; comment: string }>>>({});
  const [prelim, setPrelim] = useState<Record<string, PrelimCheck[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collabStatus, setCollabStatus] = useState<Record<string, { lastSeen: number; memberName: string }>>({});

  const { data: committee, isLoading: committeeLoading } = useQuery({
    queryKey: ['evaluation-committee', committeeId],
    queryFn: () => evaluationsApi.getCommittee(committeeId!),
    enabled: !!committeeId,
  });

  const { data: coiState } = useQuery({
    queryKey: ['coi-committee', committeeId],
    queryFn: () => evaluationsApi.getCOI(committeeId!),
    enabled: !!committeeId,
  });

  const { data: solicitation, isLoading: solicitationLoading } = useQuery({
    queryKey: ['solicitation-detail', committee?.solicitation],
    queryFn: () => solicitationsApi.get(committee!.solicitation),
    enabled: !!committee?.solicitation,
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['bids-for-eval', committee?.solicitation],
    queryFn: () => bidsApi.list({ solicitation: committee!.solicitation, page_size: 50 }),
    enabled: !!committee?.solicitation,
  });

  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter((c: EvaluationCriterion) => c.criterion_type === 'technical');
  const bidList = bidsData?.results || [];
  const currentBid = bidList[currentBidIndex];
  const currentScores = scores[currentBid?.id] || {};
  const currentPrelim = prelim[currentBid?.id] || DEFAULT_PRELIM_CHECKS.map(c => ({ ...c }));

  const scoredCount = bidList.filter((bid: any) => {
    const s = scores[bid.id];
    return s && criteria.length > 0 && criteria.every((c) => s[c.id] !== undefined);
  }).length;

  const allBidsScored = bidList.length > 0 && scoredCount === bidList.length;

  const prelimAllPassed = (bidId: string) => {
    const checks = prelim[bidId] || [];
    return checks.length > 0 && checks.every(c => c.passed);
  };

  const prelimAnyFailed = (bidId: string) => {
    const checks = prelim[bidId] || [];
    return checks.some(c => !c.passed);
  };

  const committeeMemberIds = useMemo(() => {
    const ids = new Set<string>();
    if (!committee) return ids;
    ids.add(String(committee.chairperson || ''));
    ids.add(String(committee.secretary || ''));
    (committee.members || []).forEach((m: any) => {
      const id = typeof m === 'string' ? m : m?.user || m?.id;
      if (id) ids.add(String(id));
    });
    return ids;
  }, [committee]);

  const isCommitteeMember = committee ? committeeMemberIds.has(String(user?.id || '')) : false;
  const isRecused = Boolean(coiState?.recused_members?.includes(String(user?.id || '')));

   // Fetch scores when component mounts or when bidList/criteria changes
   useEffect(() => {
     if (!bidList.length || !criteria.length) return;
     const fetchExistingScores = async () => {
       setLoadingScores(true);
       const results = await Promise.allSettled(
         bidList.map((bid: any) =>
           evaluationsApi.getMyScores(bid.id).then(data => ({ bidId: bid.id, data }))
         )
       );
       const newScores = { ...scores };
       for (const r of results) {
         if (r.status === 'fulfilled') {
           const { bidId, data } = r.value;
           if (!data?.my_scores?.length) continue;
           for (const s of data.my_scores) {
             if (!s.criterion) continue;
             const criterionId = s.criterion;
             const c = criteria.find((crt: EvaluationCriterion) => crt.id === criterionId);
             if (!c) continue;
             newScores[bidId] = newScores[bidId] || {};
             newScores[bidId][criterionId] = {
               score: Number(s.raw_score),
               comment: s.comment || '',
             };
           }
         }
       }
       setScores(newScores);
       setLoadingScores(false);
     };
     fetchExistingScores();
   }, [bidList.length, criteria.length, refreshKey]);

   // Collaboration tracking - update last seen time periodically
   useEffect(() => {
     if (!isCommitteeMember || isRecused) return;
     
     const updateLastSeen = () => {
       setCollabStatus(prev => ({
         ...prev,
         [user?.id || '']: {
           lastSeen: Date.now(),
           memberName: user?.full_name || 'Unknown'
         }
       }));
     };
     
     // Update every 30 seconds
     const interval = setInterval(updateLastSeen, 30000);
     updateLastSeen(); // Initial update
     
     return () => clearInterval(interval);
   }, [isCommitteeMember, isRecused, user]);

   // Auto-refresh scores periodically to see others' submissions
   useEffect(() => {
     if (!isCommitteeMember || isRecused || allSubmitted) return;
     
     const refreshScores = async () => {
       try {
         const results = await Promise.allSettled(
           bidList.map((bid: any) =>
             evaluationsApi.getMyScores(bid.id).then(data => ({ bidId: bid.id, data }))
           )
         );
         
         let hasUpdates = false;
         const newScores = { ...scores };
         
         for (const r of results) {
           if (r.status === 'fulfilled') {
             const { bidId, data } = r.value;
             if (!data?.my_scores?.length) continue;
             
             for (const s of data.my_scores) {
               if (!s.criterion) continue;
               const criterionId = s.criterion;
               const c = criteria.find((crt: EvaluationCriterion) => crt.id === criterionId);
               if (!c) continue;
               
               // Check if this is a new score or updated score
               const existingScore = newScores[bidId]?.[criterionId];
               if (!existingScore || 
                   existingScore.score !== Number(s.raw_score) || 
                   existingScore.comment !== (s.comment || '')) {
                 hasUpdates = true;
                 newScores[bidId] = newScores[bidId] || {};
                 newScores[bidId][criterionId] = {
                   score: Number(s.raw_score),
                   comment: s.comment || '',
                 };
               }
             }
           }
         }
         
         if (hasUpdates) {
           setScores(newScores);
            // Notify user of updates
            toast('Scores updated - other members have submitted their evaluations', { icon: 'ℹ️' });
         }
       } catch (err) {
         console.warn('Failed to refresh scores:', err);
       }
     };
     
     // Refresh every 45 seconds
     const interval = setInterval(refreshScores, 45000);
     return () => clearInterval(interval);
   }, [isCommitteeMember, isRecused, bidList.length, criteria.length, allSubmitted]);

  const getWeightedTotal = (bidId: string) => {
    const s = scores[bidId] || {};
    let total = 0;
    criteria.forEach((c) => {
      const entry = s[c.id];
      if (entry && entry.score > 0) total += entry.score * (c.weight / 100);
    });
    return total;
  };

  const updateScore = (bidId: string, criterionId: string, field: 'score' | 'comment', value: string | number) => {
    setScores(prev => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [criterionId]: {
          ...((prev[bidId] || {})[criterionId] || { score: 0, comment: '' }),
          [field]: value,
        },
      },
    }));
  };

  const updatePrelim = (bidId: string, index: number, passed: boolean) => {
    setPrelim(prev => {
      const checks = [...(prev[bidId] || DEFAULT_PRELIM_CHECKS.map(c => ({ ...c })))];
      checks[index] = { ...checks[index], passed };
      return { ...prev, [bidId]: checks };
    });
  };

  const submitScoresForCurrent = async () => {
    setSubmitting(true);
    let submitted = 0;
    let skipped = 0;
    try {
      for (const c of criteria) {
        const entry = currentScores[c.id];
        if (!entry || !(entry.score > 0)) continue;
        try {
          await evaluationsApi.submitScores({
            bid_id: currentBid.id,
            criterion_id: c.id,
            raw_score: entry.score,
            comment: entry.comment,
          });
          submitted++;
        } catch (err: any) {
          if (err?.response?.data?.error?.includes('already scored')) {
            skipped++;
          } else {
            throw err;
          }
        }
      }
      const name = currentBid.vendor_name || currentBid.id;
      if (submitted > 0) toast.success(`${submitted} score(s) submitted for ${name}`);
      if (skipped > 0) toast(`${skipped} criterion/criteria already scored — skipped`, { icon: 'ℹ️' });
      queryClient.invalidateQueries({ queryKey: ['solicitation-bids'] });
      if (currentBidIndex < bidList.length - 1) {
        setCurrentBidIndex(i => i + 1);
      }
    } catch {
      toast.error('Failed to submit scores');
    }
    setSubmitting(false);
  };

  const submitAllScores = async () => {
    setSubmitting(true);
    let allSuccess = true;
    for (let i = 0; i < bidList.length; i++) {
      const bid = bidList[i];
      const bidScores = scores[bid.id] || {};
      for (const c of criteria) {
        const entry = bidScores[c.id];
        if (!entry || !(entry.score > 0)) continue;
        try {
          await evaluationsApi.submitScores({
            bid_id: bid.id,
            criterion_id: c.id,
            raw_score: entry.score,
            comment: entry.comment,
          });
        } catch (err: any) {
          if (err?.response?.data?.error?.includes('already scored')) continue;
          allSuccess = false;
        }
      }
    }
    if (allSuccess) {
      toast.success('All scores submitted successfully');
      setAllSubmitted(true);
      setShowConfirmSubmit(false);
    } else {
      toast.error('Some scores could not be submitted');
    }
    setSubmitting(false);
  };

  if (committeeLoading || solicitationLoading || bidsLoading || loadingScores) {
    return <LoadingSpinner className="py-12" />;
  }

  if (!committeeId) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No committee selected.</p>
      </div>
    );
  }

  if (!criteria.length) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No technical evaluation criteria defined for this solicitation.</p>
      </div>
    );
  }

  if (!isCommitteeMember) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500">
            This technical scoring workspace is only available to assigned evaluation committee members.
          </p>
        </div>
      </div>
    );
  }

  if (isRecused) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <XCircleIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Recused From Evaluation</h2>
          <p className="text-gray-500">
            You have been recused due to a declared conflict of interest and cannot participate in scoring.
          </p>
        </div>
      </div>
    );
  }

  if (allSubmitted) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Scores Submitted</h2>
          <p className="text-gray-500 mb-2">Your independent evaluation has been recorded. Scores are private until all members submit.</p>
          <p className="text-sm text-amber-600 mb-6 font-medium">Waiting for other members to complete scoring</p>

          <div className="max-w-lg mx-auto space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Your Scores Summary</h3>
            {bidList.map((bid: any) => {
              const wt = getWeightedTotal(bid.id);
              return (
                <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="font-medium text-gray-900">{bid.vendor_name || bid.id}</span>
                  <div className="text-right">
                    <span className="font-bold text-zammsa-green">{wt.toFixed(1)} / 100</span>
                    <span className={`ml-2 text-xs font-medium ${wt >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {wt >= 70 ? '✅ Passes' : '🔴 Below threshold'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate('/evaluations')}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold"
          >
            Back to My Evaluations
          </button>
        </div>
      </div>
    );
  }

  if (!bidList.length) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No bids found for this solicitation.</p>
      </div>
    );
  }

  const currentWeightedTotal = getWeightedTotal(currentBid?.id);
  const threshold = solicitation?.minimum_technical_threshold || 70;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Technical Evaluation</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || committee?.solicitation_number || ''} — {solicitation?.title || committee?.solicitation_title || ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Evaluator: {user?.full_name} &nbsp;|&nbsp; Role: {user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR ? 'Chair' : 'Member'}
          </p>
        </div>
      </div>

       <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
         <div className="flex items-start gap-3">
           <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
             i
           </div>
           <div>
             <p className="text-sm font-medium text-blue-900">Privacy Notice</p>
             <p className="text-xs text-blue-700">
               Your scores are private and visible only to you until all committee members submit their evaluations.
               After submission, scores become visible to the committee chair for consolidation.
             </p>
           </div>
         </div>
       </div>

       {/* Progress Bar */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
         <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-gray-700">Your Progress</span>
             <span className="text-sm font-bold text-zammsa-green">{scoredCount} of {bidList.length} bids scored</span>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-gray-500">Collaboration</span>
             <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
               <span className="text-xs text-gray-500">Live updates</span>
             </div>
           </div>
         </div>
         <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
           <div
             className="bg-zammsa-green h-3 rounded-full transition-all duration-500"
             style={{ width: `${(scoredCount / Math.max(bidList.length, 1)) * 100}%` }}
           />
         </div>
         <p className="text-xs text-gray-400 mt-1">You must score ALL bids before submitting</p>
       </div>

       {/* Bid Selection Table */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
         <div className="flex items-center justify-between mb-3">
           <h2 className="text-sm font-semibold text-gray-900">Bids to Evaluate</h2>
           <div className="flex items-center gap-2 text-sm text-gray-500">
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-emerald-500" />
               <span>Scored by You</span>
             </div>
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-blue-500" />
               <span>In Progress by Others</span>
             </div>
           </div>
         </div>
         <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200 text-sm">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                 <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                 <th className="px-4 py-2 text-center font-medium text-gray-500">Your Status</th>
                 <th className="px-4 py-2 text-center font-medium text-gray-500">Team Progress</th>
                 <th className="px-4 py-2 text-right font-medium text-gray-500">Action</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {bidList.map((bid: any, i: number) => {
                 const isScored = scores[bid.id] && criteria.length > 0 && criteria.every((c) => (scores[bid.id]?.[c.id]?.score || 0) > 0);
                 
                 // Check collaboration status for this bid
                 const memberProgress = Object.values(collabStatus).filter(member => 
                   // In a real implementation, we'd track per-bid progress
                   // For now, we'll show general member activity
                   member.lastSeen > Date.now() - 300000 // Last 5 minutes
                 ).length;
                 
                 return (
                   <tr key={bid.id} className={`hover:bg-gray-50 cursor-pointer ${i === currentBidIndex ? 'bg-zammsa-green/5' : ''}`} onClick={() => setCurrentBidIndex(i)}>
                     <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                     <td className="px-4 py-2 font-medium text-gray-900">{bid.vendor_name || bid.supplier_name || bid.id}</td>
                     <td className="px-4 py-2 text-center">
                       {isScored ? (
                         <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">✅ Scored</span>
                       ) : (
                         <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">⏳ Pending</span>
                       )}
                     </td>
                     <td className="px-4 py-2 text-center">
                       {isScored ? (
                         <span className="text-xs font-medium text-emerald-600">✓ Complete</span>
                       ) : (
                         <span className="text-xs font-medium text-gray-500">
                           {memberProgress} of {Object.keys(collabStatus).length} active
                         </span>
                       )}
                     </td>
                     <td className="px-4 py-2 text-right">
                       {isScored ? (
                         <span className="text-xs text-zammsa-green font-medium cursor-pointer hover:underline">View/Edit</span>
                       ) : (
                         <button className="px-3 py-1 text-xs font-bold text-white bg-zammsa-green rounded-lg hover:bg-green-700">Score Now</button>
                       )}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
       </div>

      {currentBid && (
        <>
          {/* Preliminary Check */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Preliminary Check — {currentBid.vendor_name || currentBid.id}
              </h2>
              <span className="text-xs text-gray-400">{currentBid.bid_number || currentBid.submission_id || ''}</span>
            </div>
            <div className="space-y-2">
              {currentPrelim.map((check: PrelimCheck, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{check.criterion}</span>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium cursor-pointer ${check.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      <input type="radio" name={`prelim-${currentBid.id}-${idx}`} checked={check.passed} onChange={() => updatePrelim(currentBid.id, idx, true)} className="sr-only" />
                      ● Pass
                    </label>
                    <label className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium cursor-pointer ${!check.passed ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      <input type="radio" name={`prelim-${currentBid.id}-${idx}`} checked={!check.passed} onChange={() => updatePrelim(currentBid.id, idx, false)} className="sr-only" />
                      ○ Fail
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {prelimAnyFailed(currentBid.id) && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-700">
                  ⚠ If any preliminary criterion FAILS: Bid is disqualified. Technical scoring not required.
                </p>
              </div>
            )}
          </div>

          {/* Technical Criteria Scoring */}
          {prelimAllPassed(currentBid.id) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Criteria Scoring</h2>
              <div className="space-y-4">
                {criteria.map((criterion) => {
                  const entry = currentScores[criterion.id] || { score: 0, comment: '' };
                  const weightedScore = (entry.score || 0) * (criterion.weight / 100);
                  return (
                    <div key={criterion.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{criterion.order_index}. {criterion.criterion_name}</p>
                          <p className="text-xs text-gray-500">Weight: {criterion.weight}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Weighted</p>
                          <p className="text-lg font-bold text-zammsa-green">{weightedScore.toFixed(1)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Score (0-100):</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={entry.score || ''}
                            onChange={(e) => updateScore(currentBid.id, criterion.id, 'score', Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-center"
                            placeholder="0"
                          />
                        </div>
                        <input
                          value={entry.comment}
                          onChange={(e) => updateScore(currentBid.id, criterion.id, 'comment', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="Comments..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentWeightedTotal > 0 && (
                <div className={`mt-4 p-4 rounded-xl border ${currentWeightedTotal >= threshold ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Total Weighted Score</p>
                      <p className="text-xs text-gray-500">Minimum threshold: {threshold}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${currentWeightedTotal >= threshold ? 'text-emerald-600' : 'text-red-600'}`}>
                        {currentWeightedTotal.toFixed(1)} / 100
                      </p>
                      <p className={`text-xs font-medium ${currentWeightedTotal >= threshold ? 'text-emerald-600' : 'text-red-600'}`}>
                        {currentWeightedTotal >= threshold ? '✅ Passes threshold' : '🔴 Below threshold'}
                      </p>
                    </div>
                  </div>
                  {currentWeightedTotal < threshold && (
                    <p className="text-xs text-red-600 mt-2">This bid will NOT proceed to financial evaluation</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentBidIndex > 0 && (
            <button onClick={() => setCurrentBidIndex(i => i - 1)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50">
              <ArrowLeftIcon className="w-4 h-4" /> Back to Bid List
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={submitScoresForCurrent}
            disabled={submitting || !prelimAllPassed(currentBid?.id)}
            className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-green-700"
          >
            {submitting ? 'Saving...' : currentBidIndex < bidList.length - 1 ? 'Save & Next Bid →' : 'Save Scores'}
          </button>
          {allBidsScored && (
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              Submit All My Scores
            </button>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowConfirmSubmit(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Submit Your Scores — {solicitation?.sol_number || ''}</h2>
            <p className="text-sm text-gray-500 mb-4">You have scored all {bidList.length} bids. Review before submitting:</p>

            <div className="space-y-3 mb-6">
              {bidList.map((bid: any) => {
                const wt = getWeightedTotal(bid.id);
                return (
                  <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="font-medium text-gray-900">{bid.vendor_name || bid.id}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{wt.toFixed(1)}</span>
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded ${wt >= threshold ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {wt >= threshold ? '✅ Passes' : '🔴 Below threshold'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm font-medium text-amber-800">⚠ Once submitted your scores are LOCKED. You cannot edit them after submission.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmSubmit(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Review My Scores</button>
              <button
                onClick={submitAllScores}
                disabled={submitting}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit All Scores 🔒'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalScoring;
