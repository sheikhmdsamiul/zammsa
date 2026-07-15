import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import {
  ExclamationIcon, CheckCircleIcon, XCircleIcon,
  ShieldCheckIcon, DocumentTextIcon, ArrowRightIcon,
  ArrowLeftIcon, LockClosedIcon,
} from '@heroicons/react/outline';
import { EVALUATION_PHASES, EvaluationPhaseStepper, EvaluationPhaseId } from './EvaluationPhaseStepper';

const PHASE_ICONS: Record<string, React.ReactNode> = {
  'shield-check': <ShieldCheckIcon className="w-6 h-6" />,
  'check-circle': <CheckCircleIcon className="w-6 h-6" />,
  'academic-cap': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'chart-bar': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  'currency-dollar': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'clipboard-check': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  'document-text': <DocumentTextIcon className="w-6 h-6" />,
};

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  coi: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', iconBg: 'bg-amber-100 text-amber-700' },
  preliminary: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', iconBg: 'bg-blue-100 text-blue-700' },
  technical: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', iconBg: 'bg-indigo-100 text-indigo-700' },
  consolidation: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', iconBg: 'bg-purple-100 text-purple-700' },
  financial: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-700' },
  'post-qual': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', iconBg: 'bg-teal-100 text-teal-700' },
  ber: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', iconBg: 'bg-rose-100 text-rose-700' },
};

const EvaluationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: committee, isLoading } = useQuery({
    queryKey: ['evaluation-committee', id],
    queryFn: () => evaluationsApi.getCommittee(id!),
    enabled: !!id,
  });

  const { data: coiState } = useQuery({
    queryKey: ['coi-committee', id],
    queryFn: () => evaluationsApi.getCOI(id!),
    enabled: !!id,
  });

  const { data: bidsData } = useQuery({
    queryKey: ['bids-for-committee', committee?.solicitation],
    queryFn: () => bidsApi.list({ solicitation: committee!.solicitation, page_size: 50 }),
    enabled: !!committee?.solicitation,
  });

  const { data: phaseStatus } = useQuery({
    queryKey: ['phase-status', committee?.solicitation],
    queryFn: () => evaluationsApi.getPhaseStatus(committee!.solicitation),
    enabled: !!committee?.solicitation,
    refetchInterval: 10000,
  });

  const [currentPhase, setCurrentPhase] = useState<EvaluationPhaseId>('coi');
  const [viewingPhase, setViewingPhase] = useState<EvaluationPhaseId | null>(null);

  const isChairperson = committee?.chairperson === user?.id;
  const isSecretary = committee?.secretary === user?.id;
  const isMember = isChairperson || isSecretary || (committee?.members || []).some(
    (m: any) => (typeof m === 'string' ? m : m.user) === user?.id
  );
  const alreadyDeclared = !!coiState?.declarations?.some(
    (d: any) => d.member === user?.id || d.user === user?.id || d.user_id === user?.id
  );
  const isRecused = !!coiState?.recused_members?.includes(user?.id || '');
  const needsCoiDeclaration = isMember && !isRecused && !alreadyDeclared;

  const phasesComplete = useMemo(() => {
    const phases = phaseStatus?.phases || {};
    return {
      coi: !!alreadyDeclared && !isRecused,
      preliminary: phases.preliminary?.complete || false,
      technical: phases.technical?.complete || false,
      financial: phases.financial?.complete || false,
      consolidation: phases.consolidation?.complete || false,
      ber: phases.ber?.complete || false,
      'post-qual': phases.post_qual?.complete || false,
    };
  }, [alreadyDeclared, isRecused, phaseStatus]);

  const phasesBlocked = useMemo(() => {
    const blocked: Record<string, boolean> = {};
    EVALUATION_PHASES.forEach((phase) => {
      blocked[phase.id] = phase.dependencies.some(dep => !phasesComplete[dep]);
    });
    return blocked;
  }, [phasesComplete]);

  const userRoleLabel = useMemo(() => {
    if (isChairperson) return 'chairperson';
    if (isSecretary) return 'secretary';
    if (isMember) return 'member';
    return 'external';
  }, [isChairperson, isSecretary, isMember]);

  // Auto-advance current phase
  useEffect(() => {
    const phaseOrder = EVALUATION_PHASES.map(p => p.id);
    const currentIndex = phaseOrder.indexOf(currentPhase);
    if (phasesComplete[currentPhase] && currentIndex < phaseOrder.length - 1) {
      const nextIncomplete = phaseOrder.find((phaseId, idx) => idx > currentIndex && !phasesComplete[phaseId]);
      if (nextIncomplete) {
        setCurrentPhase(nextIncomplete);
        setViewingPhase(null);
        return;
      }
    }
  }, [phasesComplete, currentPhase]);

  useEffect(() => {
    if (needsCoiDeclaration && id) {
      navigate(`/evaluations/${id}/coi`, { replace: true });
    }
  }, [needsCoiDeclaration, id, navigate]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!committee) return <p className="text-center text-gray-500 py-12">Committee not found</p>;
  if (needsCoiDeclaration) return <LoadingSpinner className="py-12" />;

  const memberListMap = new Map<string, any>();
  const addMember = (uid: string, member: any) => {
    if (!uid || memberListMap.has(uid)) return;
    memberListMap.set(uid, member);
  };
  addMember(committee.chairperson, { user: committee.chairperson, full_name: committee.chairperson_name || committee.chairperson, role: 'Chairperson' });
  addMember(committee.secretary, { user: committee.secretary, full_name: committee.secretary_name || committee.secretary, role: 'Secretary' });
  (committee.members || []).forEach((m: any) => {
    const uid = typeof m === 'string' ? m : m.user;
    addMember(uid, typeof m === 'string' ? { user: m, full_name: m.slice(0, 8) } : m);
  });
  const memberList = Array.from(memberListMap.values());

  const activePhase = viewingPhase || currentPhase;
  const activePhaseConfig = EVALUATION_PHASES.find(p => p.id === activePhase);
  const activePhaseIdx = EVALUATION_PHASES.findIndex(p => p.id === activePhase);
  const isFirstPhase = activePhaseIdx === 0;
  const isLastPhase = activePhaseIdx === EVALUATION_PHASES.length - 1;
  const prevPhase = !isFirstPhase ? EVALUATION_PHASES[activePhaseIdx - 1] : null;
  const nextPhase = !isLastPhase ? EVALUATION_PHASES[activePhaseIdx + 1] : null;
  const canGoBack = viewingPhase !== null || (prevPhase && phasesComplete[prevPhase.id]);
  const canGoForward = nextPhase && phasesComplete[activePhase];
  const colors = PHASE_COLORS[activePhase] || PHASE_COLORS.coi;

  const handleNavigate = (direction: 'back' | 'forward') => {
    if (direction === 'back' && prevPhase) {
      if (phasesComplete[prevPhase.id]) {
        setViewingPhase(prevPhase.id);
        setCurrentPhase(prevPhase.id);
      }
    } else if (direction === 'forward' && nextPhase) {
      setViewingPhase(null);
      setCurrentPhase(nextPhase.id);
    }
  };

  const handlePhaseClick = (phaseId: EvaluationPhaseId) => {
    const idx = EVALUATION_PHASES.findIndex(p => p.id === phaseId);
    const currentIdx = EVALUATION_PHASES.findIndex(p => p.id === currentPhase);
    if (phasesComplete[phaseId] || idx <= currentIdx) {
      setViewingPhase(phaseId);
      setCurrentPhase(phaseId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Evaluation Committee</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {committee.solicitation_number || committee.solicitation} — {committee.solicitation_title || ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/evaluations')}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← Back to Evaluations
        </button>
      </div>

      {/* Phase Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <EvaluationPhaseStepper
          currentPhase={currentPhase}
          phasesComplete={phasesComplete}
          phasesBlocked={phasesBlocked}
          onPhaseChange={handlePhaseClick}
          userRole={userRoleLabel}
          committeeStatus="active"
          solicitationTitle={committee.solicitation_title || committee.solicitation}
        />
      </div>

      {/* Recused Warning */}
      {isRecused && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <ExclamationIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">You have been recused from this evaluation.</p>
            <p className="text-xs text-red-700 mt-1">
              Due to a declared conflict of interest, you cannot participate in scoring. The Procurement Officer has been notified.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Phase Card */}
          <div className={`rounded-xl shadow-sm border p-6 transition-all duration-300 ${colors.border} ${colors.bg}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.iconBg}`}>
                {PHASE_ICONS[activePhaseConfig?.icon || 'check-circle']}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-semibold ${colors.text}`}>
                    {activePhaseConfig?.label}
                  </h2>
                  <span className="text-xs text-gray-500">
                    Phase {activePhaseConfig?.order} of {EVALUATION_PHASES.length}
                  </span>
                  {phasesComplete[activePhase] && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircleIcon className="w-3 h-3" /> Complete
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{activePhaseConfig?.description}</p>
              </div>
            </div>

            {/* Phase-specific content */}
            <div className="space-y-4">
              {activePhase === 'coi' && (
                <COIContent
                  alreadyDeclared={alreadyDeclared}
                  isRecused={isRecused}
                  isChairperson={isChairperson}
                  isMember={isMember}
                  committee={committee}
                  coiState={coiState}
                  phasesComplete={phasesComplete}
                  onNavigate={handleNavigate}
                  canGoForward={!!canGoForward}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'preliminary' && (
                <PreliminaryContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  bidsData={bidsData}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'technical' && (
                <TechnicalContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  bidsData={bidsData}
                  isRecused={isRecused}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'consolidation' && (
                <ConsolidationContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  isChairperson={isChairperson}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'financial' && (
                <FinancialContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  isChairperson={isChairperson}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'post-qual' && (
                <PostQualContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
              {activePhase === 'ber' && (
                <BERContent
                  committee={committee}
                  phasesComplete={phasesComplete}
                  isChairperson={isChairperson}
                  onNavigate={handleNavigate}
                  canGoBack={!!canGoBack}
                  canGoForward={!!canGoForward}
                  prevPhase={prevPhase}
                  nextPhase={nextPhase}
                />
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200/60">
              <button
                onClick={() => handleNavigate('back')}
                disabled={!canGoBack}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-white/60"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                {prevPhase ? EVALUATION_PHASES.find(p => p.id === prevPhase?.id)?.label : 'Previous'}
              </button>
              <button
                onClick={() => {
                  if (viewingPhase) {
                    setViewingPhase(null);
                  } else {
                    handleNavigate('forward');
                  }
                }}
                disabled={!canGoForward && !viewingPhase}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-zammsa-green text-white hover:bg-green-700"
              >
                {viewingPhase ? 'Return to Current' : (nextPhase ? EVALUATION_PHASES.find(p => p.id === nextPhase?.id)?.label : 'Complete')}
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* All Phases Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">All Phases</h3>
            <div className="space-y-2">
              {EVALUATION_PHASES.map((phase) => {
                const isDone = phasesComplete[phase.id];
                const isCurrent = phase.id === activePhase;
                const isAccessible = isDone || (!phasesBlocked[phase.id]);
                const phaseColors = PHASE_COLORS[phase.id];

                return (
                  <div
                    key={phase.id}
                    onClick={() => isAccessible && handlePhaseClick(phase.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isCurrent ? `${phaseColors.bg} ${phaseColors.border} border` :
                      isDone ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer border border-transparent' :
                      'bg-gray-50/50 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDone ? 'bg-emerald-100 text-emerald-700' :
                      isCurrent ? `${phaseColors.iconBg}` :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {isDone ? (
                        <CheckCircleIcon className="w-4 h-4" />
                      ) : phasesBlocked[phase.id] ? (
                        <LockClosedIcon className="w-4 h-4" />
                      ) : (
                        phase.order
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isCurrent ? phaseColors.text : isDone ? 'text-gray-900' : 'text-gray-500'}`}>
                        {phase.label}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{phase.description}</p>
                    </div>
                    <div className="shrink-0">
                      {isDone ? (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      ) : isCurrent ? (
                        <span className="text-[10px] font-medium text-zammsa-green bg-green-50 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : phasesBlocked[phase.id] ? (
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          Locked
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Committee Info</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Formed Date</dt>
                <dd className="font-medium">{committee.formed_date ? new Date(committee.formed_date).toLocaleDateString() : '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Total Members</dt>
                <dd className="font-medium">{memberList.length}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Quorum Required</dt>
                <dd className="font-medium">{committee.quorum_required ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Quorum Status</dt>
                <dd className="font-medium">
                  {committee.quorum_met === true ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4" /> Met
                    </span>
                  ) : committee.quorum_met === false ? (
                    <span className="text-rose-600 flex items-center gap-1">
                      <XCircleIcon className="w-4 h-4" /> Not Met
                    </span>
                  ) : '---'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">COI Declarations</dt>
                <dd className="font-medium">{coiState?.declarations?.length || 0} / {memberList.length}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Recused Members</dt>
                <dd className="font-medium">{coiState?.recused_members?.length || 0}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Committee Members</h2>
            <div className="space-y-2">
              {memberList.map((m, i) => {
                const declared = coiState?.declarations?.find(
                  (d: any) => d.member === m.user || d.user === m.user || d.user_id === m.user
                );
                const recused = coiState?.recused_members?.includes(m.user);
                return (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <p className="font-medium text-gray-900">{m.full_name || m.user}</p>
                      <p className="text-gray-500">{m.role}</p>
                    </div>
                    {recused ? (
                      <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[10px] font-medium">Recused</span>
                    ) : declared ? (
                      <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-medium">Declared</span>
                    ) : (
                      <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isRecused && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              You have been recused from this evaluation due to a declared conflict of interest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Phase Content Sub-Components ----

interface PhaseNavProps {
  canGoBack: boolean;
  canGoForward: boolean;
  prevPhase: typeof EVALUATION_PHASES[number] | null;
  nextPhase: typeof EVALUATION_PHASES[number] | null;
  onNavigate: (direction: 'back' | 'forward') => void;
}

const COIContent: React.FC<{
  alreadyDeclared: boolean;
  isRecused: boolean;
  isChairperson: boolean;
  isMember: boolean;
  committee: any;
  coiState: any;
  phasesComplete: Record<string, boolean>;
  onNavigate: (d: 'back' | 'forward') => void;
  canGoForward: boolean;
  nextPhase: typeof EVALUATION_PHASES[number] | null;
}> = ({ alreadyDeclared, isRecused, isChairperson, isMember, committee, coiState, phasesComplete }) => {
  const navigate = useNavigate();

  if (isRecused) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-red-900">Recused from Evaluation</h3>
        <p className="text-sm text-red-700 mt-1">
          Due to a declared conflict of interest, you cannot participate in this evaluation.
        </p>
      </div>
    );
  }

  if (alreadyDeclared) {
    const myDeclaration = coiState?.declarations?.find(
      (d: any) => d.member === committee?.chairperson || d.user === committee?.chairperson
    );
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-emerald-900">COI Declaration Complete</h3>
          <p className="text-sm text-emerald-700 mt-1">
            {myDeclaration?.declaration_type === 'no_conflict'
              ? 'No conflict declared — cleared for evaluation'
              : 'Conflict declared — your participation has been recorded'}
          </p>
          {myDeclaration?.explanation && (
            <p className="text-xs text-emerald-600 mt-1">{myDeclaration.explanation}</p>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {coiState?.declarations?.length || 0} of committee members have declared.{' '}
          {phasesComplete.preliminary ? 'Ready for next phase.' : 'Waiting for remaining members.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-amber-900 mb-2">Required: COI Declaration</h3>
      <p className="text-sm text-amber-800 mb-3">
        All evaluation committee members must complete a conflict of interest declaration before
        accessing bid documents and performing any scoring.
      </p>
      <button
        onClick={() => navigate(`/evaluations/${committee.committee_id || committee.id}/coi`)}
        className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700"
      >
        Complete COI Declaration
      </button>
    </div>
  );
};

const PreliminaryContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
  bidsData: any;
} & PhaseNavProps> = ({ committee, phasesComplete, bidsData }) => {
  const navigate = useNavigate();
  const bidCount = bidsData?.results?.length || 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Review mandatory compliance requirements for all {bidCount} submitted bid(s).
        Each bid is checked against mandatory criteria — pass or fail.
      </p>
      {phasesComplete.preliminary ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Preliminary Examination Complete</p>
            <p className="text-xs text-emerald-700">All bids have been examined against mandatory criteria.</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate(`/evaluations/preliminary/${committee.solicitation}`)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
        >
          Launch Preliminary Examination →
        </button>
      )}
    </div>
  );
};

const TechnicalContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
  bidsData: any;
  isRecused: boolean;
} & PhaseNavProps> = ({ committee, phasesComplete, bidsData, isRecused }) => {
  const navigate = useNavigate();

  if (isRecused) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">You have been recused and cannot participate in technical scoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Score each bid against the technical evaluation criteria. Your scores are private
        until you submit them. All committee members must score independently.
      </p>
      {phasesComplete.technical ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Technical Scoring Complete</p>
            <p className="text-xs text-emerald-700">All evaluators have submitted their scores.</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate(`/evaluations/${committee.committee_id || committee.id}/scoring`)}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
        >
          Start Technical Scoring →
        </button>
      )}
    </div>
  );
};

const ConsolidationContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
  isChairperson: boolean;
} & PhaseNavProps> = ({ committee, phasesComplete, isChairperson }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Merge technical scores from all committee members, identify discrepancies,
        and calculate combined QCBS/QBS scores if applicable.
      </p>
      {!isChairperson && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Only the Committee Chair can access Score Consolidation.
        </p>
      )}
      {phasesComplete.consolidation ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Score Consolidation Complete</p>
            <p className="text-xs text-emerald-700">Combined scores calculated and financial envelopes authorized.</p>
          </div>
        </div>
      ) : isChairperson ? (
        <button
          onClick={() => navigate(`/evaluations/${committee.solicitation}/consolidation`)}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"
        >
          Open Score Consolidation →
        </button>
      ) : null}
    </div>
  );
};

const FinancialContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
  isChairperson: boolean;
} & PhaseNavProps> = ({ committee, phasesComplete, isChairperson }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Review financial proposals, apply CEEC preference margins, calculate financial scores,
        and select the recommended winner.
      </p>
      {!isChairperson && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Only the Committee Chair can access Financial Evaluation.
        </p>
      )}
      {phasesComplete.financial ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Financial Evaluation Complete</p>
            <p className="text-xs text-emerald-700">Winner has been selected and financial scores computed.</p>
          </div>
        </div>
      ) : isChairperson ? (
        <button
          onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
        >
          Open Financial Evaluation →
        </button>
      ) : null}
    </div>
  );
};

const PostQualContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
} & PhaseNavProps> = ({ committee, phasesComplete }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Perform post-qualification verification of the winning supplier. The system generates
        a verification checklist, the Procurement Officer contacts references and issuing authorities,
        and verification status is tracked until clearance.
      </p>
      {phasesComplete['post-qual'] ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Post-Qualification Complete</p>
            <p className="text-xs text-emerald-700">All verification items have been cleared.</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate(`/evaluations/post-qualification`)}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700"
        >
          Open Post-Qualification →
        </button>
      )}
    </div>
  );
};

const BERContent: React.FC<{
  committee: any;
  phasesComplete: Record<string, boolean>;
  isChairperson: boolean;
} & PhaseNavProps> = ({ committee, phasesComplete, isChairperson }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Generate the Bid Evaluation Report (BER), collect digital signatures from all
        committee members, and submit to ZPC for approval.
      </p>
      {phasesComplete.ber ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">BER Workflow Complete</p>
            <p className="text-xs text-emerald-700">BER has been generated, signed, and submitted.</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)}
          className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700"
        >
          Open BER Workflow →
        </button>
      )}
    </div>
  );
};

export default EvaluationDetail;
