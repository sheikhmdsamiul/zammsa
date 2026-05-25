import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ShieldCheckIcon,
  ExclamationIcon,
} from '@heroicons/react/outline';

const ConflictOfInterestDeclaration: React.FC = () => {
  const { committeeId } = useParams<{ committeeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [hasConflict, setHasConflict] = useState<boolean | null>(null);
  const [declaration, setDeclaration] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: committee, isLoading: committeeLoading } = useQuery({
    queryKey: ['evaluation-committee', committeeId],
    queryFn: () => evaluationsApi.getCommittee(committeeId!),
    enabled: !!committeeId,
  });

  const { data: coiState, isLoading: coiLoading } = useQuery({
    queryKey: ['coi-state', committeeId],
    queryFn: () => evaluationsApi.getCOI(committeeId!),
    enabled: !!committeeId,
  });

  const declareMutation = useMutation({
    mutationFn: () => evaluationsApi.declareCOI(committeeId!, {
      declaration: declaration || 'No conflict of interest to declare',
      has_conflict: hasConflict || false,
    }),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['coi-state', committeeId] });
      toast.success('COI declaration submitted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit declaration'),
  });

  if (committeeLoading || coiLoading) return <LoadingSpinner className="py-12" />;
  if (!committee) return <p className="text-center text-gray-500 py-12">Committee not found</p>;

  const members = [
    { id: committee.chairperson, name: committee.chairperson_name || committee.chairperson, role: 'Chairperson' },
    { id: committee.secretary, name: committee.secretary_name || committee.secretary, role: 'Secretary' },
    ...(committee.members || []).map((m: any) => ({
      id: typeof m === 'string' ? m : m.user,
      name: typeof m === 'string' ? m.slice(0, 8) : m.full_name || m.user,
      role: 'Member',
    })),
  ];

  const declarations = coiState?.declarations || [];
  const allDeclared = declarations.length >= members.length;
  const myDeclaration = declarations.find((d: any) => d.user === user?.id || d.user_id === user?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Conflict of Interest Declaration</h1>
            <StatusBadge status={allDeclared ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Committee: {committee.solicitation || committeeId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!myDeclaration && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Declaration</h2>
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <ExclamationIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">You must declare any conflict of interest</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Do you have any financial, personal, or professional relationship with any of the bidders
                        that could influence your objectivity in this evaluation?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 border border-gray-200">
                    <input type="radio" name="coi" checked={hasConflict === false} onChange={() => setHasConflict(false)}
                      className="text-zammsa-green focus:ring-zammsa-green" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">No Conflict of Interest</p>
                      <p className="text-xs text-gray-500">I have no relationship with any bidder in this procurement</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 border border-gray-200">
                    <input type="radio" name="coi" checked={hasConflict === true} onChange={() => setHasConflict(true)}
                      className="text-zammsa-green focus:ring-zammsa-green" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">I Have a Conflict of Interest</p>
                      <p className="text-xs text-gray-500">I have a relationship that may affect my objectivity</p>
                    </div>
                  </label>
                </div>

                {hasConflict && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Describe the Conflict</label>
                    <textarea value={declaration} onChange={(e) => setDeclaration(e.target.value)} rows={3}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green"
                      placeholder="Describe your relationship with the bidder(s)..." />
                  </div>
                )}

                <button onClick={() => declareMutation.mutate()}
                  disabled={hasConflict === null || (hasConflict && !declaration) || declareMutation.isPending}
                  className="w-full px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {declareMutation.isPending ? 'Submitting...' : 'Submit COI Declaration'}
                </button>
              </div>
            </div>
          )}

          {myDeclaration && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Declaration</h2>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    {myDeclaration.has_conflict
                      ? 'Conflict declared — recused from evaluation'
                      : 'No conflict of interest declared'}
                  </span>
                </div>
                {myDeclaration.declaration && (
                  <p className="text-xs text-emerald-700 mt-2">{myDeclaration.declaration}</p>
                )}
                <p className="text-xs text-emerald-500 mt-1">
                  Submitted: {new Date((myDeclaration as any).created_at || (myDeclaration as any).submitted_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {allDeclared && (
            <div className="flex justify-end">
              <button onClick={() => navigate(`/evaluations/${committeeId}/scoring`)}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700">
                Proceed to Evaluation
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <ShieldCheckIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Committee Members
            </h2>
            <div className="space-y-3">
              {members.map((m, i) => {
                const declared = declarations.find((d: any) => d.user === m.id || d.user_id === m.id);
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
                  {declarations.length} / {members.length} declared
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
