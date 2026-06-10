import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckIcon } from '@heroicons/react/outline';

const VendorProfile: React.FC = () => {
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: () => vendorApi.profile.get(),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [newDocs, setNewDocs] = useState<Record<string, File>>({});

  const startEdit = () => {
    if (profile) {
      setForm({
        company_name: profile.company_name || '',
        address: profile.address || '',
        contact_person: profile.contact_person || '',
        contact_phone: profile.contact_phone || '',
        contact_title: profile.contact_title || '',
        bank_name: profile.bank_name || '',
        bank_account_number: profile.bank_account_number || '',
        bank_account_name: profile.bank_account_name || '',
      });
      setEditing(true);
    }
  };

  const saveProfile = async () => {
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v as string));
      Object.entries(newDocs).forEach(([k, v]) => data.append(k, v));
      await vendorApi.profile.update(data);
      toast.success('Profile updated');
      setEditing(false);
      refetch();
    } catch { /* handled by interceptor */ }
  };

  if (isLoading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!profile) return <div className="text-center py-20 text-gray-400">Complete registration first.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
          <p className="text-gray-500 mt-1">View and update your registration details</p>
        </div>
        {!editing && <button onClick={startEdit} className="px-4 py-2 border border-zammsa-green text-zammsa-green rounded-lg text-sm hover:bg-green-50">Edit Profile</button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input value={form.company_name} onChange={(e) => setForm((f: any) => ({ ...f, company_name: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea value={form.address} onChange={(e) => setForm((f: any) => ({ ...f, address: e.target.value }))} rows={2} className="w-full border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                    <input value={form.contact_person} onChange={(e) => setForm((f: any) => ({ ...f, contact_person: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Title</label>
                    <input value={form.contact_title} onChange={(e) => setForm((f: any) => ({ ...f, contact_title: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={form.contact_phone} onChange={(e) => setForm((f: any) => ({ ...f, contact_phone: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-3 pt-3">
                  <button onClick={saveProfile} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm">Save Changes</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt className="text-gray-500">Company Name</dt><dd className="font-medium">{profile.company_name}</dd></div>
                <div><dt className="text-gray-500">Registration Number</dt><dd className="font-medium">{profile.registration_number}</dd></div>
                <div><dt className="text-gray-500">Tax ID</dt><dd className="font-medium">{profile.tax_id}</dd></div>
                <div><dt className="text-gray-500">Business Type</dt><dd className="font-medium">{profile.business_type}</dd></div>
                <div><dt className="text-gray-500">Year Established</dt><dd className="font-medium">{profile.year_established}</dd></div>
                <div><dt className="text-gray-500">Employee Count</dt><dd className="font-medium">{profile.employee_count}</dd></div>
                <div className="sm:col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium">{profile.address}</dd></div>
              </dl>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h2>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input value={form.bank_name} onChange={(e) => setForm((f: any) => ({ ...f, bank_name: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input value={form.bank_account_number} onChange={(e) => setForm((f: any) => ({ ...f, bank_account_number: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder</label>
                  <input value={form.bank_account_name} onChange={(e) => setForm((f: any) => ({ ...f, bank_account_name: e.target.value }))} className="w-full border-gray-300 rounded-lg" />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-gray-500">Bank Name</dt><dd className="font-medium">{profile.bank_name || '-'}</dd></div>
                <div><dt className="text-gray-500">Account Number</dt><dd className="font-medium font-mono">{profile.bank_account_number || '-'}</dd></div>
                <div><dt className="text-gray-500">Account Holder</dt><dd className="font-medium">{profile.bank_account_name || '-'}</dd></div>
              </dl>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            {profile.documents?.length > 0 ? (
              <div className="space-y-2">
                {profile.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 capitalize">{doc.type.replace(/_/g, ' ')}</span>
                      {doc.verified && <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckIcon className="h-3 w-3" /> Verified</span>}
                    </div>
                    <a href={doc.file} target="_blank" rel="noreferrer" className="text-xs text-zammsa-green hover:underline">View</a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No documents uploaded.</p>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Upload Additional Documents</p>
              <input type="file" multiple className="text-sm" onChange={(e) => {
                Array.from(e.target.files || []).forEach((f) => setNewDocs((prev) => ({ ...prev, [f.name]: f })));
              }} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Verification Status</h3>
            <div className="space-y-3">
              {[
                { label: 'PACRA Verification', status: profile.verification_status?.pacra },
                { label: 'ZRA Verification', status: profile.verification_status?.zra },
                { label: 'CEEC Verification', status: profile.verification_status?.ceec },
                { label: 'Overall Status', status: profile.status === 'approved' },
              ].map((v) => (
                <div key={v.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{v.label}</span>
                  <span className={`text-sm font-medium ${v.status ? 'text-green-600' : 'text-yellow-600'}`}>
                    {v.status ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Commodity Categories</h3>
            {profile.commodity_categories?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.commodity_categories.map((cat) => (
                  <span key={cat} className="px-3 py-1 bg-green-50 text-zammsa-green text-sm rounded-full">{cat}</span>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">None selected</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorProfile;
