import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';

const EvaluationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [coiHasConflict, setCoiHasConflict] = useState(false);
  const [coiDeclaration, setCoiDeclaration] = useState('');
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

  const coiMutation = useMutation({
    mutationFn: () => evaluationsApi.declareCOI(id!, { declaration: coiDeclaration, has_conflict: coiHasConflict }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coi-committee', id] });
      setCoiDeclaration('');
      setCoiHasConflict(false);
    },
  });

  const navigate = useNavigate();
  const [view, setView] = useState<'overview' | 'scoring' | 'financial' | 'ber'>('overview');

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!committee) return <p className="text-center text-gray-500 py-12">Committee not found</p>;

  const isChairperson = committee.chairperson === user?.id;
  const isSecretary = committee.secretary === user?.id;
  const isMember = isChairperson || isSecretary || (committee.members || []).some(
    (m: any) => (typeof m === 'string' ? m : m.user) === user?.id
  );
  const alreadyDeclared = coiState?.declarations?.some((d: any) => d.member === user?.id);
  const isRecused = coiState?.recused_members?.includes(user?.id || '');
  const memberList = (committee.members || []).map((m: any) => typeof m === 'string' ? { user: m, full_name: m.slice(0, 8) } : m);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Evaluation Committee</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">Solicitation: {committee.solicitation}</p>
        </div>
      </div>

      {/* Evaluation Workflow Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('overview')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'overview' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Overview</button>
          <button onClick={() => setView('scoring')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'scoring' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Technical Scoring</button>
          <button onClick={() => setView('financial')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'financial' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Financial Evaluation</button>
          <button onClick={() => setView('ber')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'ber' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>BER & Approval</button>
          <div className="ml-auto flex gap-2">
            {isMember && !isRecused && (
              <button onClick={() => navigate(`/evaluations/${committee.id}/coi`)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold">Declare COI</button>
            )}
            {isChairperson && (
              <>
              <button onClick={() => navigate(`/evaluations/preliminary/${committee.solicitation}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Preliminary Exam</button>
              <button onClick={() => navigate(`/evaluations/${committee.id}/scoring`)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Score Bids</button>
              <button onClick={() => navigate(`/evaluations/${committee.solicitation}/financial`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Financial Eval</button>
              <button onClick={() => navigate(`/evaluations/ber/${committee.solicitation}`)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold">Generate BER</button>
              </>
            )}
          </div>
        </div>
      </div>

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

          {isMember && !isRecused && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conflict of Interest Declaration
                {alreadyDeclared && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Declared</span>}
              </h2>
              {alreadyDeclared ? (
                <div className="space-y-2">
                  {coiState?.declarations?.filter((d: any) => d.member === user?.id).map((d: any) => (
                    <div key={d.id} className="text-sm bg-gray-50 p-3 rounded">
                      <p><span className="font-medium">Declaration:</span> {d.declaration || 'None'}</p>
                      <p><span className="font-medium">Has Conflict:</span> {d.has_conflict ? 'Yes' : 'No'}</p>
                      <p><span className="font-medium">Recused:</span> {d.recused ? 'Yes' : 'No'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Do you have a conflict of interest?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1 text-sm">
                        <input type="radio" checked={!coiHasConflict} onChange={() => setCoiHasConflict(false)} className="accent-zammsa-green" /> No
                      </label>
                      <label className="flex items-center gap-1 text-sm">
                        <input type="radio" checked={coiHasConflict} onChange={() => setCoiHasConflict(true)} className="accent-red-500" /> Yes
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Declaration Details</label>
                    <textarea value={coiDeclaration} onChange={(e) => setCoiDeclaration(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm" rows={3}
                      placeholder="Describe any conflict of interest..." />
                  </div>
                  <button onClick={() => coiMutation.mutate()} disabled={coiMutation.isPending}
                    className="bg-zammsa-green text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                    {coiMutation.isPending ? 'Declaring...' : 'Submit Declaration'}
                  </button>
                </div>
              )}
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
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Declaration</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Has Conflict</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Recused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coiState.declarations.map((d: any) => (
                      <tr key={d.id} className={d.recused ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2">{d.member_name}</td>
                        <td className="px-3 py-2 text-gray-600">{d.declaration || '-'}</td>
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
              <p className="text-sm text-gray-500 mb-4">Score each bid independently. Your scores are private until all members submit.</p>
              <div className="space-y-3">
                {bidsData?.results?.length ? bidsData.results.map((bid: any) => (
                  <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{bid.vendor_name || bid.supplier_name || bid.id}</span>
                      <span className="text-xs text-gray-400 ml-2">({bid.bid_id || bid.submission_id})</span>
                    </div>
                    <button onClick={() => navigate(`/evaluations/${committee.id}/scoring`)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Score</button>
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
