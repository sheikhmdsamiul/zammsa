import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { useAppSelector } from '../../hooks/useRedux';
import { ROLES } from '../../config/rbac';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const EvaluationsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAppSelector((s) => s.auth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCommitteeId, setEditingCommitteeId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [] as string[] });
  const myEvaluationsOnly = user?.role === ROLES.EVALUATION_COMMITTEE_MEMBER || user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR;
  const manageCommitteeRoles: string[] = [
    ROLES.PROCUREMENT_OFFICER,
    ROLES.PROCUREMENT_MANAGER,
    ROLES.DIRECTOR_PROCUREMENT,
    ROLES.SYSTEM_ADMIN,
  ];
  const canManageCommittees = !!user?.role && manageCommitteeRoles.includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ['evaluation-committees', page, pageSize, search, myEvaluationsOnly],
    queryFn: () => evaluationsApi.listCommittees({ page, page_size: pageSize, search, mine: myEvaluationsOnly ? true : undefined }),
  });

  const { data: solsData } = useQuery({
    queryKey: ['solicitations-for-committee'],
    queryFn: () => solicitationsApi.list({ page_size: 50 }),
    enabled: showForm,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-committee'],
    queryFn: () => usersApi.list({ page_size: 100 }),
    enabled: showForm,
  });
  const allUsers = usersData?.results || [];

  const formMutation = useMutation({
    mutationFn: () => {
      const members = Array.from(new Set([...formData.members, formData.chairperson, formData.secretary].filter(Boolean)));
      const payload = {
        solicitation: formData.solicitation,
        chairperson: formData.chairperson,
        secretary: formData.secretary,
        members,
      } as any;

      return editingCommitteeId
        ? evaluationsApi.updateCommittee(editingCommitteeId, payload)
        : evaluationsApi.formCommittee(payload);
    },
    onSuccess: () => {
      toast.success(editingCommitteeId ? 'Evaluation committee updated' : 'Evaluation committee formed');
      setShowForm(false);
      setEditingCommitteeId(null);
      setFormData({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
    },
    onError: () => toast.error(editingCommitteeId ? 'Failed to update committee' : 'Failed to form committee'),
  });

  const openCreateForm = () => {
    setEditingCommitteeId(null);
    setFormData({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [] });
    setShowForm(true);
  };

  const openEditForm = (row: any) => {
    const committeeMembers = Array.isArray(row.members)
      ? row.members.map((m: any) => (typeof m === 'string' ? m : m?.user || m?.id)).filter(Boolean)
      : [];
    const chairpersonId = row.chairperson || '';
    const secretaryId = row.secretary || '';

    setEditingCommitteeId(row.id);
    setFormData({
      solicitation: row.solicitation || '',
      chairperson: chairpersonId,
      chairpersonName: row.chairperson_name || '',
      secretary: secretaryId,
      secretaryName: row.secretary_name || '',
      members: Array.from(new Set([...committeeMembers, chairpersonId, secretaryId].filter(Boolean))),
    });
    setShowForm(true);
  };

  const columns = [
    { key: 'id', label: 'ID', render: (_: any, row: any) => (
      <span className="text-zammsa-green hover:underline font-medium cursor-pointer" onClick={() => navigate(`/evaluations/${row.id}`)}>{row.id?.slice(0, 8)}</span>
    )},
    { key: 'solicitation', label: 'Solicitation' },
    { key: 'member_count', label: 'Members', render: (v: number) => `${v ?? 0}` },
    { key: 'chairperson_name', label: 'Chairperson' },
    { key: 'secretary_name', label: 'Secretary' },
    { key: 'formed_date', label: 'Formed', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'active'} /> },
    ...(canManageCommittees ? [{
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditForm(row);
          }}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {myEvaluationsOnly ? 'My Evaluations' : 'Evaluation Committees'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {myEvaluationsOnly
              ? 'View only the committees you were assigned to'
              : 'Manage evaluation committees, COI declarations, and scoring'}
          </p>
        </div>
        {canManageCommittees && (
          <button onClick={openCreateForm} className="px-4 py-2 bg-zammsa-green text-white rounded-xl text-sm font-bold">
            Form Committee
          </button>
        )}
      </div>

      {canManageCommittees && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowForm(false); setEditingCommitteeId(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingCommitteeId ? 'Update Evaluation Committee' : 'Form Evaluation Committee'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation</label>
                <select value={formData.solicitation} onChange={(e) => setFormData(p => ({ ...p, solicitation: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  <option value="">Select solicitation...</option>
                  {(solsData?.results || []).map((sol: any) => (
                    <option key={sol.id} value={sol.id}>{sol.sol_number || sol.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chairperson</label>
                <select value={formData.chairperson} onChange={(e) => setFormData(p => ({ ...p, chairperson: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  <option value="">Select chairperson...</option>
                  {allUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secretary</label>
                <select value={formData.secretary} onChange={(e) => setFormData(p => ({ ...p, secretary: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  <option value="">Select secretary...</option>
                  {allUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Committee Members (at least 3)</label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {allUsers.map((u: any) => {
                    const isSelected = formData.members.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setFormData(p => ({
                            ...p,
                            members: isSelected ? p.members.filter((id: string) => id !== u.id) : [...p.members, u.id],
                          }))} />
                        <span>{u.full_name || u.email}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.role || ''}</span>
                      </label>
                    );
                  })}
                  {allUsers.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">Loading users...</p>}
                </div>
                <p className="text-xs text-gray-400 mt-1">{formData.members.length} selected (chairperson & secretary auto-included)</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingCommitteeId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => formMutation.mutate()} disabled={!formData.solicitation || !formData.chairperson || !formData.secretary || formData.members.length < 3 || formMutation.isPending}
                className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {formMutation.isPending
                  ? (editingCommitteeId ? 'Updating...' : 'Creating...')
                  : (editingCommitteeId ? 'Update Committee' : 'Create Committee')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search committees..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} onRowClick={(row) => navigate(`/evaluations/${row.id}`)} />
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
            totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default EvaluationsList;
