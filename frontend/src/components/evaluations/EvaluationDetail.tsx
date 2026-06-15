import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import { ExclamationIcon } from '@heroicons/react/outline';
import { EVALUATION_PHASES, EvaluationPhaseStepper, EvaluationPhaseId } from './EvaluationPhaseStepper';

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

  const [currentPhase, setCurrentPhase] = useState<EvaluationPhaseId>('coi');

  // COI Gate - computed before early return for hooks rule
  const isChairperson = committee?.chairperson === user?.id;
  const isSecretary = committee?.secretary === user?.id;
  const isMember = isChairperson || isSecretary || (committee?.members || []).some(
    (m: any) => (typeof m === 'string' ? m : m.user) === user?.id
  );
  const alreadyDeclared = coiState?.declarations?.some(
    (d: any) => d.member === user?.id || d.user === user?.id || d.user_id === user?.id
  );
  const isRecused = coiState?.recused_members?.includes(user?.id || '');
  const needsCoiDeclaration = isMember && !isRecused && !alreadyDeclared;

  // Check which phases are complete for this committee
  const phasesComplete = useMemo(() => {
    const complete: Record<string, boolean> = {
      coi: !!alreadyDeclared && !isRecused,
    };
    return complete;
  }, [alreadyDeclared, isRecused]);

  // Build phasesBlocked map based on dependencies
  const phasesBlocked = useMemo(() => {
    const blocked: Record<string, boolean> = {};
    EVALUATION_PHASES.forEach((phase) => {
      blocked[phase.id] = false;
    });
    return blocked;
  }, []);

  // User role label
  const userRoleLabel = useMemo(() => {
    if (isChairperson) return 'chairperson';
    if (isSecretary) return 'secretary';
    if (isMember) return 'member';
    return 'external';
  }, [isChairperson, isSecretary, isMember]);

  useEffect(() => {
    if (needsCoiDeclaration && id) {
      navigate(`/evaluations/${id}/coi`, { replace: true });
    }
  }, [needsCoiDeclaration, id, navigate]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!committee) return <p className="text-center text-gray-500 py-12">Committee not found</p>;

  if (needsCoiDeclaration) {
    return <LoadingSpinner className="py-12" />;
  }

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
      </div>

      {/* Evaluation Phase Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <EvaluationPhaseStepper
          currentPhase={currentPhase}
          phasesComplete={phasesComplete}
          phasesBlocked={phasesBlocked}
          onPhaseChange={setCurrentPhase}
          userRole={userRoleLabel}
          committeeStatus="active"
          solicitationTitle={committee.solicitation_title || committee.solicitation}
        />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* COI Declaration Phase Content */}
          {currentPhase === 'coi' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <ExclamationIcon className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Conflict of Interest Declaration</h2>
                  <p className="text-sm text-gray-500">Phase 1 of 7 - Required before any evaluation</p>
                </div>
              </div>
              <div className="space-y-4">
                {alreadyDeclared && !isRecused ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-green-900">✅ COI Declaration Complete</h3>
                      <p className="text-sm text-green-700 mt-1">You have successfully declared no conflict of interest.</p>
                      <div className="mt-3 text-xs text-green-600 bg-green-100/50 p-3 rounded-lg">
                        <span className="font-medium">Next Phase:</span> Preliminary Examination (Phase 2)
                      </div>
                    </div>
                    {isChairperson && (
                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          onClick={() => navigate(`/evaluations/preliminary/${committee.solicitation}`)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
                        >
                          Proceed to Preliminary Exam
                        </button>
                        <button
                          onClick={() => setCurrentPhase('technical')}
                          className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
                        >
                          Skip to Technical Scoring
                        </button>
                      </div>
                    )}
                    {!isChairperson && !isMember && (
                      <button
                        onClick={() => setCurrentPhase('technical')}
                        className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
                      >
                        Proceed to Technical Scoring
                      </button>
                    )}
                  </>
                ) : isRecused ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-red-900">Recused from Evaluation</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Due to a declared conflict of interest, you cannot participate in this evaluation.
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-amber-900 mb-3">Required: COI Declaration</h3>
                    <p className="text-sm text-amber-800 mb-4">
                      All evaluation committee members must complete a conflict of interest declaration before accessing bid documents and performing any scoring.
                    </p>
                    <button
                      onClick={() => navigate(`/evaluations/${id}/coi`)}
                      className="px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700"
                    >
                      Complete COI Declaration
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Scoring Phase Content */}
          {currentPhase === 'technical' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 10a4.471 4.471 0 01-1.006 1.007M14 10a4.471 4.471 0 01-1.006-1.007l-.707-.707a5 5 0 117.072 0l.548.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Technical Scoring</h2>
                  <p className="text-sm text-gray-500">Phase 3 of 7 - Evaluate technical proposals</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">Your scores are private. You cannot see other members' scores until you submit all your scores.</p>
              <div className="space-y-3">
                {bidsData?.results?.length ? bidsData.results.map((bid: any) => (
                  <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{bid.vendor_name || bid.supplier_name || bid.id}</span>
                      <span className="text-xs text-gray-400 ml-2">({bid.bid_id || bid.submission_id})</span>
                    </div>
                    <button
                      onClick={() => navigate(`/evaluations/${id}/scoring`)}
                      className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
                    >
                      Score Bids
                    </button>
                  </div>
                )) : <p className="text-sm text-gray-400">No bids available for scoring.</p>}
              </div>
            </div>
          )}

          {/* Financial Evaluation Phase Content */}
          {currentPhase === 'financial' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Financial Evaluation</h2>
                  <p className="text-sm text-gray-500">Phase 4 of 7 - Review financial proposals & apply preferences</p>
                </div>
              </div>
              {user && [ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT].includes(user.role as any) ? (
                <button
                  onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)}
                  className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold"
                >
                  Open Financial Evaluation
                </button>
              ) : (
                <p className="text-sm text-gray-500">Only the committee chair or director of procurement can access the financial evaluation.</p>
              )}
            </div>
          )}

          {/* Consolidation Phase Content */}
          {currentPhase === 'consolidation' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Score Consolidation</h2>
                  <p className="text-sm text-gray-500">Phase 5 of 7 - Merge scores & calculate combined QCBS</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Merge technical scores from all committee members and calculate combined QCBS/QBS scores if applicable.
              </p>
              <button
                onClick={() => navigate(`/evaluations/${committee.solicitation}/consolidation`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold"
              >
                Launch Score Consolidation
              </button>
            </div>
          )}

          {/* BER Workflow Phase Content */}
          {currentPhase === 'ber' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">BER Workflow</h2>
                  <p className="text-sm text-gray-500">Phase 6 of 7 - Generate report & collect signatures</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Generate the Bid Evaluation Report (BER), collect digital signatures from all committee members, and submit to ZPC for approval.
              </p>
              <button
                onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold"
              >
                Go to BER Workflow
              </button>
            </div>
          )}

          {/* Post-Qualification Phase Content */}
          {currentPhase === 'post-qual' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Post-Qualification</h2>
                  <p className="text-sm text-gray-500">Phase 7 of 7 - Verify awarded supplier credentials</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Perform post-qualification verification of the winning supplier to ensure they meet all requirements before contract award.
              </p>
              <button
                onClick={() => navigate(`/evaluations/post-qualification`)}
                className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold"
              >
                Launch Post-Qualification
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-gray-500">Formed Date</dt><dd className="font-medium">{committee.formed_date ? new Date(committee.formed_date).toLocaleDateString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Total Members</dt><dd className="font-medium">{memberList.length}</dd></div>
              <div><dt className="text-gray-500">Declarations</dt><dd className="font-medium">{coiState?.declarations?.length || 0}</dd></div>
              <div><dt className="text-gray-500">Recused</dt><dd className="font-medium">{coiState?.recused_members?.length || 0}</dd></div>
            </dl>
          </div>

          {isRecused && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              You have been recused from this evaluation due to a declared conflict of interest. You cannot participate in scoring.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationDetail;