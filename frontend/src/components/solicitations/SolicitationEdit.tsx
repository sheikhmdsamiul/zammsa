import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import DepartmentSelect from '../common/DepartmentSelect';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, InformationCircleIcon,
  SaveIcon, ArrowLeftIcon,
} from '@heroicons/react/outline';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 8).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function fmtDateTimeForInput(d: string | undefined): string {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 16); } catch { return ''; }
}

const SolicitationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: sol, isLoading } = useQuery({
    queryKey: ['solicitation', id],
    queryFn: () => solicitationsApi.get(id!),
    enabled: !!id,
  });

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (sol) {
      setForm({
        title: sol.title || '',
        description: sol.description || '',
        department: sol.department_name || sol.department || '',
        estimated_value: sol.estimated_value || 0,
        currency: sol.currency || 'ZMW',
        budget_code: sol.budget_code || '',
        issue_date: sol.issue_date || '',
        closing_date: sol.closing_date ? sol.closing_date.slice(0, 16) : '',
        opening_date: sol.opening_date ? sol.opening_date.slice(0, 16) : '',
        submission_format: sol.submission_format || 'single',
        bid_validity_days: sol.bid_validity_days || 90,
        pre_bid_date: sol.pre_bid_date || '',
        pre_bid_venue: sol.pre_bid_venue || '',
        citizen_preference: sol.citizen_preference ?? true,
        bid_security_required: sol.bid_security_required ?? true,
        bid_security_type: sol.bid_security_type || 'bank_guarantee',
        bid_security_rate: sol.bid_security_rate || 2,
        contact_person: sol.contact_person || '',
        contact_phone: sol.contact_phone || '',
        contact_email: sol.contact_email || '',
        minimum_technical_threshold: sol.minimum_technical_threshold || 70,
        document_fee_enabled: sol.document_fee_enabled || false,
        document_fee_amount: sol.document_fee_amount || 0,
      });
    }
  }, [sol]);

  const update = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  const mutation = useMutation({
    mutationFn: (data: any) => solicitationsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Solicitation updated');
      navigate(`/solicitations/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.closing_date) { toast.error('Closing date is required'); return; }

    function clean(v: any): any {
      if (v === '' || v === undefined) return null;
      return v;
    }

    const payload: Record<string, any> = {
      title: form.title,
      description: form.description,
      department: form.department || null,
      estimated_value: parseFloat(form.estimated_value) || null,
      currency: form.currency,
      budget_code: form.budget_code,
      issue_date: clean(form.issue_date) || null,
      closing_date: form.closing_date ? new Date(form.closing_date).toISOString() : null,
      opening_date: form.opening_date ? new Date(form.opening_date).toISOString() : null,
      submission_format: form.submission_format,
      bid_validity_days: parseInt(form.bid_validity_days, 10) || 90,
      pre_bid_date: clean(form.pre_bid_date),
      pre_bid_venue: form.pre_bid_venue || '',
      citizen_preference: !!form.citizen_preference,
      bid_security_required: !!form.bid_security_required,
      bid_security_type: form.bid_security_required ? (form.bid_security_type || 'bank_guarantee') : '',
      bid_security_rate: form.bid_security_required ? (parseFloat(form.bid_security_rate) || 2) : null,
      contact_person: form.contact_person || '',
      contact_phone: form.contact_phone || '',
      contact_email: form.contact_email || '',
      minimum_technical_threshold: parseInt(form.minimum_technical_threshold, 10) || null,
      document_fee_enabled: !!form.document_fee_enabled,
      document_fee_amount: form.document_fee_enabled ? (parseFloat(form.document_fee_amount) || 0) : null,
    };

    // Preserve other read-only fields the serializer needs
    payload.type = sol?.type || sol?.procurement_method;
    payload.procurement_method = sol?.procurement_method;

    mutation.mutate(payload);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!sol) return <p className="text-center text-gray-500 py-12">Solicitation not found</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
          <button onClick={() => navigate(`/solicitations/${id}`)} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Solicitations</span>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-900">Edit Solicitation</h1>
          <span className="ml-auto text-xs font-bold text-gray-400">{sol.sol_number}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Basic Information</h2>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Department</label>
                <DepartmentSelect value={form.department} onChange={(v) => update('department', v)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Currency</label>
                <select value={form.currency} onChange={(e) => update('currency', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                  <option value="ZMW">ZMW</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Budget Code</label>
                <input type="text" value={form.budget_code} onChange={(e) => update('budget_code', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Estimated Value *</label>
              <input type="number" value={form.estimated_value} onChange={(e) => update('estimated_value', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Key Dates</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Issue Date *</label>
                <input type="date" value={form.issue_date?.slice(0, 10)} onChange={(e) => update('issue_date', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Bid Validity (Days)</label>
                <input type="number" value={form.bid_validity_days} onChange={(e) => update('bid_validity_days', e.target.value)} min={30} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Closing Date & Time *</label>
                <input type="datetime-local" value={form.closing_date} onChange={(e) => update('closing_date', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Opening Date & Time</label>
                <input type="datetime-local" value={form.opening_date} onChange={(e) => update('opening_date', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Pre-Bid Conference Date</label>
                <input type="date" value={form.pre_bid_date?.slice(0, 10)} onChange={(e) => update('pre_bid_date', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Venue / Link</label>
                <input type="text" value={form.pre_bid_venue} onChange={(e) => update('pre_bid_venue', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Submission & Preferences</h2>
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Submission Format</p>
              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${form.submission_format === 'single' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="format" checked={form.submission_format === 'single'} onChange={() => update('submission_format', 'single')} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Single Envelope</p>
                </label>
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${form.submission_format === 'two' ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="format" checked={form.submission_format === 'two'} onChange={() => update('submission_format', 'two')} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Two Envelope</p>
                </label>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Citizen Preference</p>
              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${form.citizen_preference ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="citizen" checked={form.citizen_preference} onChange={() => update('citizen_preference', true)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Yes</p>
                </label>
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${!form.citizen_preference ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="citizen" checked={!form.citizen_preference} onChange={() => update('citizen_preference', false)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">No</p>
                </label>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Document Fee</p>
              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${form.document_fee_enabled ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="doc_fee" checked={form.document_fee_enabled} onChange={() => update('document_fee_enabled', true)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Fee: K <input type="number" value={form.document_fee_amount} onChange={(e) => update('document_fee_amount', e.target.value)} className="w-20 inline-block bg-transparent border-b border-gray-200 text-center text-sm font-bold outline-none" onClick={(e) => e.stopPropagation()} /></p>
                </label>
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${!form.document_fee_enabled ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="doc_fee" checked={!form.document_fee_enabled} onChange={() => update('document_fee_enabled', false)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Free</p>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Bid Security</h2>
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Required?</p>
              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${form.bid_security_required ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="sec_req" checked={form.bid_security_required} onChange={() => update('bid_security_required', true)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">Yes</p>
                </label>
                <label className={`flex-1 p-4 rounded-2xl cursor-pointer border-2 transition-all ${!form.bid_security_required ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="radio" name="sec_req" checked={!form.bid_security_required} onChange={() => update('bid_security_required', false)} className="sr-only" />
                  <p className="text-sm font-bold text-gray-900 text-center">No</p>
                </label>
              </div>
            </div>

            {form.bid_security_required && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Security Type</label>
                  <select value={form.bid_security_type} onChange={(e) => update('bid_security_type', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5">
                    <option value="bank_guarantee">Bank Guarantee</option>
                    <option value="surety_bond">Surety Bond</option>
                    <option value="cash">Cash Deposit</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Rate (% of bid value)</label>
                  <input type="number" value={form.bid_security_rate} onChange={(e) => update('bid_security_rate', e.target.value)} min={1} max={5} step={0.5} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Phone</label>
              <input type="tel" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(`/solicitations/${id}`)} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors disabled:opacity-50">
            <SaveIcon className="w-4 h-4" /> {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SolicitationEdit;
