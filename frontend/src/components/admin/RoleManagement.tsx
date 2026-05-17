import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchRoles, createRole, updateRole, deleteRole, updateRolePermissions } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';

const MODULES = ['users', 'roles', 'suppliers', 'solicitations', 'bids', 'evaluations', 'contracts', 'finance', 'reporting', 'system_config', 'integrations', 'master_data'];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'import'];

const EXISTING_ROLES = [
  'user_dept_staff',
  'department_head',
  'procurement_officer',
  'procurement_manager',
  'evaluation_committee_member',
  'evaluation_committee_chair',
  'finance_officer',
  'zpc_member',
  'director_procurement',
  'director_general',
  'supplier_user',
  'contract_manager',
  'system_admin',
  'auditor',
  'public_portal_viewer',
  'zppa_reporting_officer',
  'supplier_relationship_manager',
  'budget_controller',
  'integration_manager',
];

const RoleManagement: React.FC = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedRole, setSelectedRole] = useState<any>(null);

  const { data: roles, isLoading } = useQuery({ queryKey: ['adminRoles'], queryFn: fetchRoles });

  const createMut = useMutation({
    mutationFn: () => createRole({ ...form, permissions: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminRoles'] }); toast.success('Role created'); setShowCreate(false); setForm({ name: '', description: '' }); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });
  const updateMut = useMutation({
    mutationFn: () => editRole && updateRole(editRole.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminRoles'] }); toast.success('Role updated'); setEditRole(null); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminRoles'] }); toast.success('Role deleted'); setSelectedRole(null); },
    onError: (err: any) => toast.error(err?.message || 'Cannot delete system role'),
  });
  const permMut = useMutation({
    mutationFn: () => selectedRole && updateRolePermissions(selectedRole.id, perms),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminRoles'] }); toast.success('Permissions saved'); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });

  const togglePerm = (mod: string, action: string) => {
    const current = perms[mod] || [];
    const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
    setPerms({ ...perms, [mod]: next });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
        <button onClick={() => { setForm({ name: '', description: '' }); setShowCreate(true); }} className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700">+ Custom Role</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role List */}
        <div className="bg-white rounded-lg shadow p-5 lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-3">Roles ({EXISTING_ROLES.length})</h2>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {(roles || []).map((r: any) => (
              <button key={r.id} onClick={() => { setSelectedRole(r); setPerms(r.permissions || {}); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedRole?.id === r.id ? 'bg-zammsa-green text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                <span className="font-medium">{r.name}</span>
                {r.is_system && <span className="ml-2 text-xs opacity-70">(system)</span>}
                <span className="block text-xs opacity-70">{r.users_count || 0} users</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="bg-white rounded-lg shadow p-5 lg:col-span-3 overflow-x-auto">
          {selectedRole ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedRole.name}</h2>
                  <p className="text-sm text-gray-500">{selectedRole.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedRole.is_system && (
                    <>
                      <button onClick={() => { setEditRole(selectedRole); setForm({ name: selectedRole.name, description: selectedRole.description }); }} className="text-sm text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteMut.mutate(selectedRole.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                    </>
                  )}
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 border-r">Module</th>
                    {ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center font-medium text-gray-500 uppercase text-xs">{a}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {MODULES.map((mod) => (
                    <tr key={mod} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 capitalize border-r">{mod.replace('_', ' ')}</td>
                      {ACTIONS.map((action) => {
                        const checked = (perms[mod] || []).includes(action);
                        return (
                          <td key={action} className="px-2 py-2 text-center">
                            <input type="checkbox" checked={checked} onChange={() => togglePerm(mod, action)} className="h-4 w-4 text-zammsa-green border-gray-300 rounded" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <button onClick={() => permMut.mutate()} disabled={permMut.isPending} className="px-6 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">Save Permissions</button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Select a role to manage permissions</p></div>
          )}
        </div>
      </div>

      {/* Create/Edit Role Modal */}
      {(showCreate || editRole) && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">{editRole ? 'Edit Role' : 'Create Custom Role'}</h3>
            <div className="mt-4 space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Role name (e.g. custom_viewer)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); setEditRole(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => editRole ? updateMut.mutate() : createMut.mutate()} disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50">{editRole ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
