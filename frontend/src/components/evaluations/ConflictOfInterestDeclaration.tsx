import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import type { ConflictOfInterest, CommitteeCOIState } from '../../types';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ShieldCheckIcon,
  ExclamationIcon,
} from '@heroicons/react/outline';

type DeclarationType = 'no_conflict' | 'general_conflict' | 'specific_conflict';

const ConflictOfInterestDeclaration: React.FC = () => {
  const { committeeId } = useParams<{ committeeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [declarationType, setDeclarationType] = useState<DeclarationType | null>(null);
  const [explanation, setExplanation] = useState('');
  const [conflictedBidders, setConflictedBidders] = useState<string[]>([]);
  const [confidentialityAgreed, setConfidentialityAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [localDeclaration, setLocalDeclaration] = useState<ConflictOfInterest | null>(null);

  const { data: committee, isLoading: committeeLoading } = useQuery({
    queryKey: ['evaluation-committee', committeeId],
    queryFn: () => evaluationsApi.getCommittee(committeeId!),
    enabled: !!committeeId,
  });

  const { data: coiState, isLoading: coiLoading } = useQuery({
    queryKey: ['coi-committee', committeeId],
    queryFn: () => evaluationsApi.getCOI(committeeId!),
    enabled: !!committeeId,
  });

  const { data: bidsData } = useQuery({
    queryKey: ['bids-for-coi', committee?.solicitation],
    queryFn: () => bidsApi.list({ solicitation: committee!.solicitation, page_size: 50 }),
    enabled: !!committee?.solicitation,
  });

  const bidders = (bidsData?.results || []).map((b: any) => ({
    id: b.id,
    name: b.vendor_name || b.bidder_name || b.supplier_name || b.id?.slice(0, 8),
  }));

  const declareMutation = useMutation({
    mutationFn: () => {
      const hasConflict = declarationType !== 'no_conflict';
      return evaluationsApi.declareCOI(committeeId!, {
        declaration_type: declarationType || 'no_conflict',
        has_conflict: hasConflict,
        explanation: explanation || 'No conflict of interest to declare',
        conflicted_bidders: conflictedBidders,
        confidentiality_agreed: confidentialityAgreed,
      });
    },
    onSuccess: (response: any) => {
      const savedDeclaration: ConflictOfInterest | null = response?.coi || null;
      if (savedDeclaration) {
        setLocalDeclaration(savedDeclaration);
        queryClient.setQueryData<CommitteeCOIState | undefined>(['coi-committee', committeeId], (current) => {
          const existing = current?.declarations || [];
          const filtered = existing.filter((item) => item.id !== savedDeclaration.id && item.member !== savedDeclaration.member);
          return {
            declarations: [...filtered, savedDeclaration],
            recused_members: savedDeclaration.recused
              ? Array.from(new Set([...(current?.recused_members || []), savedDeclaration.member]))
              : (current?.recused_members || []),
          };
        });
      }
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['coi-committee'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluationDashboard'] });
      toast.success('COI declaration submitted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit declaration'),
  });

  const toggleBidder = (bidderId: string) => {
    setConflictedBidders(prev =>
      prev.includes(bidderId) ? prev.filter(id => id !== bidderId) : [...prev, bidderId]
    );
  };

  const canSubmit = declarationType !== null
    && confidentialityAgreed
    && (declarationType === 'no_conflict' || (declarationType === 'specific_conflict' && conflictedBidders.length > 0) || (declarationType === 'general_conflict' && explanation.trim().length > 0));

  // Auto-redirect after successful COI declaration
  React.useEffect(() => {
    if (submitted && localDeclaration && !localDeclaration.recused) {
      const timer = setTimeout(() => {
        navigate(`/evaluations/${committeeId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitted, localDeclaration, committeeId, navigate]);

  if (committeeLoading || coiLoading) return <LoadingSpinner className="py-12" />;
  if (!committee) return <p className="text-center text-gray-500 py-12">Committee not found</p>;

  const memberMap = new Map<string, { id: string; name: string; role: string }>();
  const addMember = (id: string, name: string, role: string) => {
    if (!id) return;
    if (!memberMap.has(id)) memberMap.set(id, { id, name, role });
  };

  addMember(committee.chairperson, committee.chairperson_name || committee.chairperson, 'Chairperson');
  addMember(committee.secretary, committee.secretary_name || committee.secretary, 'Secretary');
  (committee.members || []).forEach((m: any) => {
    const id = typeof m === 'string' ? m : m.user;
    const name = typeof m === 'string' ? m.slice(0, 8) : m.full_name || m.user;
    addMember(id, name, 'Member');
  });

  const members = Array.from(memberMap.values());

  const declarations = coiState?.declarations || [];
  const visibleDeclarations = localDeclaration
    ? [
        ...declarations.filter((d: any) => d.id !== localDeclaration.id && d.member !== localDeclaration.member),
        localDeclaration,
      ]
    : declarations;
  const allDeclared = visibleDeclarations.length >= members.length;
  const myDeclaration = visibleDeclarations.find((d: any) => d.member === user?.id || d.user === user?.id || d.user_id === user?.id);
  const hasMyDeclaration = Boolean(myDeclaration || submitted);

  const declarationTypeLabel: Record<string, string> = {
    no_conflict: 'No Conflict',
    general_conflict: 'General Conflict',
    specific_conflict: 'Specific Bidder(s) Conflict',
  };

  if (hasMyDeclaration) {
    const isRecused = myDeclaration?.recused;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Conflict of Interest Declaration</h1>
              <StatusBadge status={allDeclared ? 'completed' : 'active'} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {committee.solicitation_number || committee.solicitation} — {committee.solicitation_title || ''}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900">Declaration Complete</h2>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
            <p className="text-sm font-medium text-emerald-800">
              {myDeclaration?.declaration_type === 'no_conflict'
                ? 'No conflict declared — cleared for evaluation'
                : isRecused
                  ? `You have been recused from this evaluation.`
                  : 'Conflict declared'}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Type: {declarationTypeLabel[myDeclaration?.declaration_type || 'no_conflict'] || 'Declared'}
            </p>
            {myDeclaration?.explanation && (
              <p className="text-xs text-emerald-600 mt-1">{myDeclaration.explanation}</p>
            )}
            <p className="text-xs text-emerald-500 mt-1">
              Submitted: {new Date(myDeclaration?.declared_at || '').toLocaleString()}
            </p>
          </div>

          {isRecused ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
              <XCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-800 mb-2">Recused From Evaluation</h3>
              <p className="text-sm text-red-700">
                You have been recused from this evaluation due to a declared conflict of interest.
                The Procurement Officer has been notified. You cannot access bid documents for this solicitation.
              </p>
              <button onClick={() => navigate('/evaluations')}
                className="mt-4 px-6 py-2.5 bg-white border border-red-300 text-red-700 rounded-xl text-sm font-bold hover:bg-red-50">
                ← Back to Evaluations
              </button>
            </div>
           ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircleIcon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-900">COI Declaration Complete</h3>
              <p className="text-sm text-green-700 mt-2">
                You have successfully completed your Conflict of Interest declaration.
                The evaluation workflow will continue automatically.
              </p>
              <p className="text-xs text-green-600 mt-4">
                You will be redirected to the evaluation committee page shortly.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <ShieldCheckIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
            Committee Members
          </h2>
          <div className="space-y-3">
            {members.map((m, i) => {
              const declared = visibleDeclarations.find((d: any) => d.member === m.id || d.user === m.id || d.user_id === m.id);
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.role}</p>
                  </div>
                  {declared ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs">
                      <CheckCircleIcon className="w-4 h-4" /> Declared
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 text-xs">
                      <XCircleIcon className="w-4 h-4" /> Pending
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium ${allDeclared ? 'text-emerald-600' : 'text-amber-600'}`}>
                {visibleDeclarations.length} / {members.length} declared
              </span>
            </div>
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
            <h1 className="text-2xl font-bold text-gray-900">Conflict of Interest Declaration</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {committee.solicitation_number || committee.solicitation} — {committee.solicitation_title || ''}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <ExclamationIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            You must complete this declaration before you can access any bid documents for this evaluation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Do you have a conflict of interest with any bidder?</h2>

            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-colors ${declarationType === 'no_conflict' ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <input type="radio" name="coi" checked={declarationType === 'no_conflict'} onChange={() => setDeclarationType('no_conflict')}
                  className="mt-0.5 text-zammsa-green focus:ring-zammsa-green" />
                <div>
                  <p className="text-sm font-medium text-gray-900">No conflict</p>
                  <p className="text-xs text-gray-500">I declare I have no conflict with any bidder</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-colors ${declarationType === 'general_conflict' ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <input type="radio" name="coi" checked={declarationType === 'general_conflict'} onChange={() => setDeclarationType('general_conflict')}
                  className="mt-0.5 text-red-500 focus:ring-red-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">General conflict</p>
                  <p className="text-xs text-gray-500">I have a conflict of interest (explain below)</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-colors ${declarationType === 'specific_conflict' ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <input type="radio" name="coi" checked={declarationType === 'specific_conflict'} onChange={() => setDeclarationType('specific_conflict')}
                  className="mt-0.5 text-orange-500 focus:ring-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Conflict with specific bidder(s)</p>
                  <p className="text-xs text-gray-500">Select bidder(s) below</p>
                </div>
              </label>
            </div>

            {declarationType === 'specific_conflict' && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Select conflicted bidder(s):</p>
                {bidders.length === 0 ? (
                  <p className="text-xs text-gray-400">No bidders found for this solicitation</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bidders.map((bidder) => (
                      <label key={bidder.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={conflictedBidders.includes(bidder.id)}
                          onChange={() => toggleBidder(bidder.id)}
                          className="text-orange-500 focus:ring-orange-500 rounded"
                        />
                        <span className="text-gray-900">{bidder.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(declarationType === 'general_conflict' || declarationType === 'specific_conflict') && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explanation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green"
                  placeholder={declarationType === 'specific_conflict' ? 'Describe your relationship with the selected bidder(s)...' : 'Describe your conflict of interest...'}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer border border-gray-200">
              <input
                type="checkbox"
                checked={confidentialityAgreed}
                onChange={(e) => setConfidentialityAgreed(e.target.checked)}
                className="mt-0.5 text-zammsa-green focus:ring-zammsa-green rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Confidentiality Agreement</p>
                <p className="text-xs text-gray-500">
                  I agree to maintain strict confidentiality throughout this evaluation process
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/evaluations')}
              className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => declareMutation.mutate()}
              disabled={!canSubmit || declareMutation.isPending}
              className="px-6 py-2.5 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-green-700"
            >
              {declareMutation.isPending ? 'Submitting...' : 'Submit Declaration'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <ShieldCheckIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Committee Members
            </h2>
            <div className="space-y-3">
              {members.map((m, i) => {
                const declared = visibleDeclarations.find((d: any) => d.member === m.id || d.user === m.id || d.user_id === m.id);
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.role}</p>
                    </div>
                    {declared ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircleIcon className="w-4 h-4" /> Declared
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 text-xs">
                        <XCircleIcon className="w-4 h-4" /> Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${allDeclared ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {visibleDeclarations.length} / {members.length} declared
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictOfInterestDeclaration;
