import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import { ExclamationIcon } from '@heroicons/react/outline';

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

  const [view, setView] = useState<'overview' | 'scoring' | 'financial' | 'ber'>('overview');

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

      {/* Evaluation Workflow Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('overview')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'overview' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Overview</button>
          <button onClick={() => setView('scoring')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'scoring' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Technical Scoring</button>
          {isChairperson && (
            <>
              <button onClick={() => setView('financial')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'financial' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Financial Evaluation</button>
            </>
          )}
          <button onClick={() => setView('ber')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'ber' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>BER & Approval</button>
          <div className="ml-auto flex gap-2">
            {isChairperson && (
              <>
                <button onClick={() => navigate(`/evaluations/preliminary/${committee.solicitation}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Preliminary Exam</button>
                <button onClick={() => navigate(`/evaluations/${id}/scoring`)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Score Bids</button>
                <button onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Financial Eval</button>
              </>
            )}
            <button onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold">
              {isChairperson ? 'Generate BER' : 'View BER'}
            </button>
          </div>
        </div>
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
          {view === 'overview' && (
          <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Committee Members</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-600 w-24">Chairperson:</span>
                <span>{committee.chairperson_name}</span>
                {isChairperson && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-600 w-24">Secretary:</span>
                <span>{committee.secretary_name}</span>
                {isSecretary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>}
              </div>
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium text-gray-600 mb-2">Members ({memberList.length})</p>
                {memberList.map((m: any, i: number) => {
                  const mid = m.user || m;
                  const recused = coiState?.recused_members?.includes(mid);
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm py-1">
                      <span className={`w-2 h-2 rounded-full ${recused ? 'bg-red-400' : 'bg-green-400'}`} />
                      <span className={recused ? 'text-red-500 line-through' : ''}>{m.full_name || mid.slice(0, 8)}</span>
                      {mid === user?.id && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>}
                      {recused && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Recused</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {isMember && !isRecused && !alreadyDeclared && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-amber-900 mb-4">Conflict of Interest Declaration Required</h2>
              <p className="text-sm text-amber-800 mb-4">
                You must complete a conflict of interest declaration before accessing bid documents.
              </p>
              <button
                onClick={() => navigate(`/evaluations/${id}/coi`)}
                className="px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700"
              >
                Complete COI Declaration
              </button>
            </div>
          )}

          {isChairperson && alreadyDeclared && !isRecused && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                {alreadyDeclared && !isRecused && (
                  <button onClick={() => navigate(`/evaluations/${id}/scoring`)}
                    className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-green-700">
                    Proceed to Scoring
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate(`/evaluations/${committee.solicitation}/consolidation`)}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                  Score Consolidation
                </button>
                <button onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                  Financial Evaluation
                </button>
                <button onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)}
                  className="px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700">
                  BER Workflow
                </button>
                <button onClick={() => navigate(`/evaluations/zpc-approval`)}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">
                  ZPC Approval
                </button>
              </div>
            </div>
          )}

          {!isChairperson && isMember && alreadyDeclared && !isRecused && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">COI Declaration Complete</h2>
                  <p className="text-sm text-gray-500 mt-1">You can now proceed to evaluate bids</p>
                </div>
                <button onClick={() => navigate(`/evaluations/${id}/scoring`)}
                  className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold hover:bg-green-700">
                  Proceed to Scoring
                </button>
              </div>
            </div>
          )}

          {coiState && coiState.declarations.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">All COI Declarations</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Member</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Has Conflict</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Recused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coiState.declarations.map((d: any) => (
                      <tr key={d.id} className={d.recused ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2">{d.member_name}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{d.declaration_type || (d.has_conflict ? 'Conflict' : 'No Conflict')}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${d.has_conflict ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {d.has_conflict ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {d.recused ? <span className="text-red-600 font-medium">Recused</span> : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>
          )}

          {view === 'scoring' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Scoring</h2>
              <p className="text-sm text-gray-500 mb-4">Your scores are private. You cannot see other members' scores until you submit all your scores.</p>
              <div className="space-y-3">
                {bidsData?.results?.length ? bidsData.results.map((bid: any) => (
                  <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{bid.vendor_name || bid.supplier_name || bid.id}</span>
                      <span className="text-xs text-gray-400 ml-2">({bid.bid_id || bid.submission_id})</span>
                    </div>
                    <button onClick={() => navigate(`/evaluations/${id}/scoring`)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Score</button>
                  </div>
                )) : <p className="text-sm text-gray-400">No bids available for scoring.</p>}
              </div>
            </div>
          )}
          {view === 'financial' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Evaluation</h2>
              <p className="text-sm text-gray-500 mb-4">Review and evaluate financial proposals. Apply preference margins.</p>
              {user && [ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT].includes(user.role as any) ? (
                <button onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)} className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
                  Open Financial Evaluation
                </button>
              ) : (
                <p className="text-sm text-gray-500">Only the committee chair or director of procurement can access the financial evaluation.</p>
              )}
            </div>
          )}
          {view === 'ber' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Evaluation Report</h2>
              <p className="text-sm text-gray-500 mb-4">Generate the BER, collect committee signatures, and submit to ZPC for approval.</p>
              <button onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)} className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold">
                Go to BER Workflow
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
