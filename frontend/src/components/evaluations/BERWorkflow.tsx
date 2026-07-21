import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, DocumentTextIcon,
  ShieldCheckIcon, XCircleIcon, DownloadIcon, EyeIcon,
} from '@heroicons/react/outline';

interface RankingRow {
  rank: number;
  name: string;
  price: number;
  ceec: string;
  combinedScore: number;
  technicalScore: number;
  financialScore: number;
  passed: boolean;
  details: any[];
  evaluatedPrice: number;
}

const BERWorkflow: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [berGenerated, setBerGenerated] = useState(false);
  const [berId, setBerId] = useState('');
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [berSubmitted, setBerSubmitted] = useState(false);

  const { data: solicitation } = useQuery({
    queryKey: ['solicitation-for-ber', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: committeesData, isLoading: committeesLoading } = useQuery({
    queryKey: ['committees-for-ber', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId }),
    enabled: !!solId,
  });

  const { data: berListData, isLoading: berLoading } = useQuery({
    queryKey: ['ber-for-solicitation', solId],
    queryFn: () => evaluationsApi.listBERs({ solicitation: solId, page_size: 10 }),
    enabled: !!solId,
  });

  const committees = committeesData?.results || [];
  const primaryCommittee = committees[0];
  const currentBer = berListData?.results?.[0] || null;
  const reportContent = currentBer?.report_content || {};
  const isChair = String(primaryCommittee?.chairperson || '') === String(user?.id || '');

  const { data: passedBidsData } = useQuery({
    queryKey: ['passed-tech-bids-ber', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId && !currentBer && !!isChair,
  });

  const evalMethod = solicitation?.evaluation_method || (solicitation?.type === 'proposal' ? 'qcbs' : 'lowest_price');
  const isCombinedMethod = evalMethod === 'qcbs' || evalMethod === 'qbs';

  const { data: qcbsData } = useQuery({
    queryKey: ['qcbs-ber', solId],
    queryFn: () => evaluationsApi.calculateQCBS(solId!),
    enabled: !!solId && !currentBer && !!isChair && isCombinedMethod,
  });

  const passedBids = useMemo<any[]>(() => {
    if (currentBer && reportContent?.technical_evaluation) {
      return (reportContent.technical_evaluation as any[]).map((te: any) => ({
        bid_id: te.submission_id,
        submission_id: te.submission_id,
        bidder_name: te.bidder_name,
        evaluated_price: te.evaluated_price,
        overall_technical_score: te.overall_technical_score,
        financial_score: te.financial_score,
        passed: true,
        original_price: te.evaluated_price,
        bid_price: te.evaluated_price,
        preference_category: te.preference_applied,
        details: te.criterion_details || [],
      }));
    }
    return passedBidsData?.bids || [];
  }, [currentBer, reportContent, passedBidsData]);

  const qcbsBids = useMemo(() => {
    if (currentBer && reportContent?.technical_evaluation) {
      return (reportContent.technical_evaluation as any[]).map((te: any) => ({
        bid_id: te.submission_id,
        submission_id: te.submission_id,
        combined_total_score: te.combined_total_score,
        rank: te.rank,
        financial_score: te.financial_score,
        evaluated_price: te.evaluated_price || 0,
      }));
    }
    return qcbsData?.results || [];
  }, [currentBer, reportContent, qcbsData]);

  const qcbsMap = useMemo(() => {
    const map = new Map<string, { combined_score: number; rank: number; financial_score: number; evaluated_price: number }>();
    (Array.isArray(qcbsBids) ? qcbsBids : []).forEach((entry: any) => {
      map.set(entry.bid_id || entry.submission_id, {
        combined_score: entry.combined_total_score || entry.total_score || 0,
        rank: entry.rank || 999,
        financial_score: entry.financial_score || 0,
        evaluated_price: entry.evaluated_price || 0,
      });
    });
    return map;
  }, [qcbsBids]);

  const committeeMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; role: string }>();
    const add = (id?: string, name?: string, role?: string) => {
      if (!id || memberMap.has(id)) return;
      memberMap.set(id, { id, name: name || id, role: role || 'Member' });
    };

    if (primaryCommittee) {
      add(primaryCommittee.chairperson, primaryCommittee.chairperson_name || primaryCommittee.chairperson, 'Chair');
      add(primaryCommittee.secretary, primaryCommittee.secretary_name || primaryCommittee.secretary, 'Secretary');
      (primaryCommittee.members || []).forEach((m: any) => {
        const uid = typeof m === 'object' && m !== null ? (m.user || m.id) : m;
        add(String(uid || ''), typeof m === 'object' && m !== null ? (m.full_name || String(uid || '')) : String(uid || '').slice(0, 8), 'Member');
      });
    }

    return Array.from(memberMap.values());
  }, [primaryCommittee]);

  const rankingRows = useMemo<RankingRow[]>(() => {
    return passedBids
      .map((bid: any) => {
        const bidId = bid.bid_id || bid.submission_id || '';
        const qcbs = qcbsMap.get(bidId);
        return {
          rank: qcbs?.rank || 999,
          name: bid.bidder_name || bid.vendor_name || bid.submission_id || 'Unknown',
          price: bid.original_price || bid.bid_price || 0,
          ceec: bid.preference_category || 'non_citizen',
          combinedScore: qcbs?.combined_score || 0,
          technicalScore: bid.overall_technical_score || 0,
          financialScore: qcbs?.financial_score || bid.financial_score || 0,
          passed: bid.passed,
          details: bid.details || [],
          evaluatedPrice: bid.evaluated_price || bid.original_price || 0,
        };
      })
      .sort((a: RankingRow, b: RankingRow) => {
        if (a.passed !== b.passed) return a.passed ? -1 : 1;
        if (isCombinedMethod) return (a.rank || 999) - (b.rank || 999);
        return (a.evaluatedPrice || 0) - (b.evaluatedPrice || 0);
      })
      .map((row: RankingRow, idx: number) => ({ ...row, displayRank: idx + 1 }));
  }, [passedBids, qcbsMap, isCombinedMethod]);

  const winner = useMemo(() => {
    const sorted = [...passedBids]
      .filter((b: any) => b.passed)
      .sort((a: any, b: any) => {
        if (isCombinedMethod) {
          const aRank = qcbsMap.get(a.bid_id || a.submission_id || '')?.rank || 999;
          const bRank = qcbsMap.get(b.bid_id || b.submission_id || '')?.rank || 999;
          return aRank - bRank;
        }
        return (a.evaluated_price || a.original_price || 0) - (b.evaluated_price || b.original_price || 0);
      });
    const winnerBid = sorted[0];
    const bidId = winnerBid?.bid_id || winnerBid?.submission_id || '';
    const qcbs = qcbsMap.get(bidId);
    return winnerBid
      ? {
          name: winnerBid.bidder_name || winnerBid.vendor_name || '',
          price: qcbs?.combined_score
            ? winnerBid.evaluated_price || winnerBid.original_price || 0
            : (isCombinedMethod ? winnerBid.original_price || 0 : winnerBid.evaluated_price || winnerBid.original_price || 0),
          combinedScore: qcbs?.combined_score || 0,
        }
      : null;
  }, [passedBids, qcbsMap, isCombinedMethod]);

  useEffect(() => {
    if (!currentBer) return;
    setBerId(currentBer.id || currentBer.ber_id || '');
    setBerGenerated(true);
    setBerSubmitted(currentBer.status === 'submitted' || currentBer.status === 'approved');
    const signatureMap: Record<string, boolean> = {};
    (currentBer.signatures || []).forEach((sig: any) => {
      if (sig?.member_id) signatureMap[String(sig.member_id)] = true;
    });
    setSigned(signatureMap);
  }, [currentBer]);

  const generateMutation = useMutation({
    mutationFn: () => evaluationsApi.generateBER(solId!),
    onSuccess: (data: any) => {
      const ber = data.ber || data;
      setBerId(ber.id || ber.ber_id || '');
      setBerGenerated(true);
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER generated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate BER'),
  });

  const signMutation = useMutation({
    mutationFn: () => evaluationsApi.signBER(berId || ''),
    onSuccess: () => {
      setSigned((prev) => ({ ...prev, [user?.id || '']: true }));
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      queryClient.invalidateQueries({ queryKey: ['phase-status', solId] });
      toast.success('BER signed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to sign BER'),
  });

  const submitMutation = useMutation({
    mutationFn: () => evaluationsApi.submitBER(berId),
    onSuccess: () => {
      setBerSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER submitted to ZPC');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit BER'),
  });

  const loading = committeesLoading || berLoading;
  if (loading) return <LoadingSpinner className="py-12" />;

  const allSigned = committeeMembers.length > 0 && committeeMembers.every((m) => signed[m.id]);
  const userCanSign = committeeMembers.some(m => String(m.id) === String(user?.id || '')) && !signed[user?.id || ''];
  const isFinalised = berSubmitted || currentBer?.status === 'approved' || currentBer?.status === 'rejected';

  const berStatus = currentBer?.status || (berGenerated ? 'draft' : 'pending');

  const statusSteps = [
    { label: 'Draft', active: berStatus === 'draft' },
    { label: 'Signatures', active: berStatus === 'draft' && Object.keys(signed).length > 0 },
    { label: 'All Signed', active: allSigned && !berSubmitted },
    { label: 'ZPC Submitted', active: berSubmitted },
  ];

  const getStepIndex = () => {
    if (berSubmitted) return 4;
    if (allSigned) return 3;
    if (Object.keys(signed).length > 0) return 2;
    if (berStatus === 'draft') return 1;
    return 0;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(primaryCommittee ? `/evaluations/${primaryCommittee.id}` : '/evaluations')}
            className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Back to Evaluation Committee
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bid Evaluation Report — BER-{solId?.slice(0, 8) || ''}</h1>
            <StatusBadge status={berStatus} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || ''} — {solicitation?.title || ''}
          </p>
        </div>
        {isChair && !berGenerated && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <DocumentTextIcon className="w-5 h-5" />
            {generateMutation.isPending ? 'Generating...' : 'Generate BER PDF'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          {['Draft', 'Signatures Pending', 'All Signed', 'ZPC Submitted'].map((step, i) => {
            const stepIdx = getStepIndex();
            const isActive = stepIdx >= i + 1;
            const isCurrent = stepIdx === i + 1;

            return (
              <div key={step} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-zammsa-green' : isCurrent ? 'bg-zammsa-green/60' : 'bg-gray-300'}`} />
                <span className={`text-xs font-medium ${isActive ? 'text-zammsa-green' : 'text-gray-400'}`}>{step}</span>
                {i < 3 && <span className="text-gray-300 mx-2">-</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SECTION 1: Procurement Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <dt className="text-xs text-gray-500">Solicitation</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">{solicitation?.sol_number || solId}</dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <dt className="text-xs text-gray-500">Title</dt>
            <dd className="font-semibold text-gray-900 mt-0.5 truncate">{solicitation?.title || '-'}</dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <dt className="text-xs text-gray-500">Method</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">{solicitation?.procurement_method || 'Open Tender'}{isCombinedMethod ? ` (${evalMethod.toUpperCase()})` : ''}</dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="font-semibold text-gray-900 mt-0.5 capitalize">{berStatus}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SECTION 2: Bids Received</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price (ZMW)</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankingRows.map((row, i) => (
                <tr key={i} className={row.passed ? 'hover:bg-gray-50' : 'bg-red-50/40'}>
                  <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.price > 0 ? Number(row.price).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {row.passed
                      ? <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Evaluated</span>
                      : <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Failed Tech</span>
                    }
                  </td>
                </tr>
              ))}
              {rankingRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No bid data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SECTION 3: Evaluation Summary {isCombinedMethod ? '(Combined Scores)' : '(Price Ranking)'}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Rank</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Technical</th>
                {isCombinedMethod && <th className="px-4 py-2 text-center font-medium text-gray-500">Financial</th>}
                <th className="px-4 py-2 text-center font-medium text-gray-500">{isCombinedMethod ? 'Combined Score' : 'Evaluated Price (ZMW)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankingRows.filter(r => r.passed).map((row, i) => (
                <tr key={i} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2 text-center font-bold">
                    {i === 0 ? (
                      <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">1st</span>
                    ) : (
                      <span className="text-gray-500">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2 text-center font-mono">{row.technicalScore.toFixed(2)}</td>
                  {isCombinedMethod && <td className="px-4 py-2 text-center font-mono">{row.financialScore.toFixed(2)}</td>}
                  <td className="px-4 py-2 text-center font-mono font-bold text-zammsa-green">
                    {isCombinedMethod
                      ? (row.combinedScore > 0 ? row.combinedScore.toFixed(2) : '-')
                      : `ZMW ${Number(row.evaluatedPrice).toLocaleString()}`}
                  </td>
                </tr>
              ))}
              {rankingRows.filter(r => r.passed).length === 0 && (
                <tr>
                  <td colSpan={isCombinedMethod ? 5 : 4} className="px-4 py-6 text-center text-sm text-gray-400">No passing bids</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SECTION 4: Recommendation</h2>
        {winner ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-blue-500">Recommended Supplier</dt>
                <dd className="font-semibold text-blue-900 mt-0.5">{winner.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-blue-500">Contract Value</dt>
                <dd className="font-semibold text-blue-900 mt-0.5">ZMW {Number(winner.price).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-blue-500">{isCombinedMethod ? 'Combined Score' : 'Evaluated Price'}</dt>
                <dd className="font-semibold text-blue-900 mt-0.5">
                  {isCombinedMethod
                    ? (winner.combinedScore > 0 ? winner.combinedScore.toFixed(2) : 'N/A')
                    : `ZMW ${Number(winner.price).toLocaleString()}`}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No recommendation yet. Complete the evaluation workflow first.</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SECTION 5: Digital Signatures</h2>
        <p className="text-xs text-gray-500 mb-4">All committee members must sign before ZPC submission</p>

        <div className="overflow-x-auto mb-4">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {committeeMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-2 text-gray-500">{member.role}</td>
                  <td className="px-4 py-2 text-center">
                    {signed[member.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircleIcon className="w-4 h-4" /> Signed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {committeeMembers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-400">No committee members found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {userCanSign && (
            <button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending}
              className="px-6 py-2 bg-zammsa-green text-white text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheckIcon className="w-5 h-5" />
              {signMutation.isPending ? 'Signing...' : 'Apply My Signature'}
            </button>
          )}

          {allSigned && !berSubmitted && isChair && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit to ZPC'}
            </button>
          )}
        </div>
      </div>

      {berGenerated && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/evaluations/${solId}/financial`)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm"
          >
            Back to Financial
          </button>
          <button
            onClick={() => {
              if (!berId) return;
              evaluationsApi.downloadBER(berId).then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
              }).catch(() => toast.error('Failed to load BER'));
            }}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            <EyeIcon className="w-4 h-4" /> View BER
          </button>
          <button
            onClick={() => {
              if (!berId) return;
              evaluationsApi.downloadBER(berId).then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BER-${solId?.slice(0, 8)}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
              }).catch(() => toast.error('Failed to download BER'));
            }}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" /> Download PDF
          </button>
          {currentBer?.status === 'approved' && (
            <button
              onClick={() => navigate(`/contracts/generate?ber_id=${berId}&sol_id=${solId}`)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold"
            >
              Generate Contract
            </button>
          )}
        </div>
      )}

      {currentBer?.status === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-emerald-800 mb-1">BER Approved</h2>
          <p className="text-sm text-emerald-700">
            BER status: ZPC Approved. Proceed to contract generation.
          </p>
        </div>
      )}

      {currentBer?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <XCircleIcon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-rose-800 mb-1">BER Rejected</h2>
          <p className="text-sm text-rose-700">
            {currentBer.rejection_reason || 'The report has been rejected.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BERWorkflow;
