import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  UsersIcon, ShieldCheckIcon, PlusIcon,
} from '@heroicons/react/outline';

const CommitteeFormation: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  const [solicitation, setSolicitation] = useState('');
  const [chairperson, setChairperson] = useState('');
  const [secretary, setSecretary] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [coiRequired, setCoiRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingCommitteeId, setEditingCommitteeId] = useState<string | null>(null);

  const { data: committeesData, isLoading } = useQuery({
    queryKey: ['evaluation-committees'],
    queryFn: () => evaluationsApi.listCommittees({ page_size: 50 }),
  });

  const { data: solsData } = useQuery({
    queryKey: ['solicitations-for-committee'],
    queryFn: () => solicitationsApi.list({ page_size: 50 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-committee'],
    queryFn: () => usersApi.list({ page_size: 100 }),
  });

  const allUsers = usersData?.results || [];
  const committees = committeesData?.results || [];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const solicitationParam = params.get('solicitation');
    if (solicitationParam) {
      setSolicitation(solicitationParam);
    }
  }, [location.search]);

  const formMutation = useMutation({
    mutationFn: () => {
      const allMembers = Array.from(new Set([...members, chairperson, secretary].filter(Boolean)));
      const payload = {
        solicitation,
        chairperson,
        secretary,
        members: allMembers,
        require_coi: coiRequired,
      } as any;
      return editingCommitteeId
        ? evaluationsApi.updateCommittee(editingCommitteeId, payload)
        : evaluationsApi.formCommittee(payload);
    },
    onSuccess: () => {
      toast.success(editingCommitteeId ? 'Evaluation committee updated successfully' : 'Evaluation committee formed successfully');
      setSolicitation('');
      setChairperson('');
      setSecretary('');
      setMembers([]);
      setEditingCommitteeId(null);
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to form committee'),
  });

  const handleSubmit = async () => {
    if (!solicitation || !chairperson || !secretary) {
      toast.error('Solicitation, Chairperson, and Secretary are required');
      return;
    }
    if (members.length < 3) {
      toast.error('At least 3 committee members required');
      return;
    }
    setSubmitting(true);
    await formMutation.mutateAsync();
    setSubmitting(false);
  };

  const openEditCommittee = (c: any) => {
    const committeeMembers = Array.isArray(c.members)
      ? c.members.map((m: any) => (typeof m === 'string' ? m : m?.user || m?.id)).filter(Boolean)
      : [];
    const chairpersonId = c.chairperson || '';
    const secretaryId = c.secretary || '';

    setEditingCommitteeId(c.id);
    setSolicitation(c.solicitation || '');
    setChairperson(chairpersonId);
    setSecretary(secretaryId);
    setMembers(Array.from(new Set([...committeeMembers, chairpersonId, secretaryId].filter(Boolean))));
  };

  const resetForm = () => {
    setEditingCommitteeId(null);
    setSolicitation('');
    setChairperson('');
    setSecretary('');
    setMembers([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Form Evaluation Committee</h1>
            <StatusBadge status={committees.length > 0 ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Use the sidebar path: Evaluations {'->'} Committee Formation
          </p>
          {editingCommitteeId && (
            <p className="text-sm text-amber-600 mt-2 font-medium">
              Editing an existing committee. Save changes to update the formed committee.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Committee Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation</label>
                <select value={solicitation} onChange={(e) => setSolicitation(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green">
                  <option value="">Select solicitation...</option>
                  {(solsData?.results || []).map((sol: any) => (
                    <option key={sol.id} value={sol.id}>{sol.sol_number || sol.title || sol.id}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chairperson</label>
                  <select value={chairperson} onChange={(e) => setChairperson(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green">
                    <option value="">Select chairperson...</option>
                    {allUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secretary</label>
                  <select value={secretary} onChange={(e) => setSecretary(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green">
                    <option value="">Select secretary...</option>
                    {allUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Committee Members (at least 3)</label>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {allUsers.map((u: any) => {
                    const isSelected = members.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setMembers(prev =>
                            isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          )}
                          className="text-zammsa-green rounded focus:ring-zammsa-green" />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{u.full_name || u.email}</span>
                          <span className="text-gray-400 text-xs ml-2">({u.role || 'No role'})</span>
                        </div>
                      </label>
                    );
                  })}
                  {allUsers.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading users...</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{members.length} selected (chairperson & secretary auto-included)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conflict of Interest Configuration</h2>
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
              <input type="checkbox" checked={coiRequired} onChange={(e) => setCoiRequired(e.target.checked)}
                className="text-zammsa-green rounded focus:ring-zammsa-green" />
              <div>
                <p className="text-sm font-medium text-gray-900">Require Conflict of Interest Declarations</p>
                <p className="text-xs text-gray-500">All members must declare COI before evaluation begins</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                {editingCommitteeId ? 'Cancel Edit' : 'Cancel'}
              </button>
            <button onClick={handleSubmit} disabled={submitting || !solicitation || !chairperson || !secretary || members.length < 3}
              className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              {submitting ? (editingCommitteeId ? 'Updating...' : 'Creating...') : (editingCommitteeId ? 'Update Evaluation Committee' : 'Form Evaluation Committee')}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <UsersIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Existing Committees
            </h2>
            <div className="space-y-3">
              {committees.slice(0, 5).map((c: any) => (
                <div key={c.id} className="p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100">
                  <p className="font-medium text-gray-900">{c.solicitation?.slice(0, 12)}</p>
                  <p className="text-xs text-gray-500">{c.member_count || 0} members</p>
                  <button
                    type="button"
                    onClick={() => openEditCommittee(c)}
                    className="mt-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Edit Committee
                  </button>
                </div>
              ))}
              {committees.length === 0 && (
                <p className="text-sm text-gray-400">No committees formed yet</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">ZPPA Requirement</p>
                <p className="text-xs text-blue-700 mt-1">
                  Evaluation committees must have a minimum of 3 members, a chairperson, and a secretary.
                  All members must sign COI declarations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommitteeFormation;
