import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckIcon, ArrowLeftIcon, CloudUploadIcon } from '@heroicons/react/outline';

const steps = ['Account', 'Company', 'Contact', 'Banking', 'Documents'];

const accountSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const companySchema = z.object({
  company_name: z.string().min(2, 'Required'),
  registration_number: z.string().min(1, 'Required'),
  tin: z.string().min(1, 'Required'),
  business_type: z.string().min(1, 'Required'),
  year_established: z.string().min(4, 'Required'),
  employee_count: z.string().min(1, 'Required'),
  annual_turnover: z.string().min(1, 'Required'),
  address: z.string().min(5, 'Required'),
});

const contactSchema = z.object({
  contact_person: z.string().min(2, 'Required'),
  contact_title: z.string().min(2, 'Required'),
  contact_phone: z.string().min(7, 'Required'),
  ceec_certificate_number: z.string().optional(),
  ceec_category: z.string().min(1, 'Required'),
});

const bankSchema = z.object({
  bank_name: z.string().min(2, 'Required'),
  bank_account_number: z.string().min(5, 'Required'),
  bank_account_name: z.string().min(2, 'Required'),
  bank_branch: z.string().min(1, 'Required'),
  commodity_categories: z.array(z.string()).min(1, 'Select at least one category'),
});

type AccountForm = z.infer<typeof accountSchema>;
type CompanyForm = z.infer<typeof companySchema>;
type ContactForm = z.infer<typeof contactSchema>;
type BankForm = z.infer<typeof bankSchema>;

const commodityOptions = ['Pharmaceuticals', 'Medical Equipment', 'Consumables', 'Laboratory', 'Vaccines', 'Nutrition', 'Infrastructure', 'IT', 'Transport', 'Services'];

interface UploadedDoc {
  type: string;
  file: File;
  name: string;
}

const VendorRegistrationWizard: React.FC = () => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);

  const accountForm = useForm<AccountForm>({ resolver: zodResolver(accountSchema) });
  const companyForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const contactForm = useForm<ContactForm>({ resolver: zodResolver(contactSchema) });
  const bankForm = useForm<BankForm>({ resolver: zodResolver(bankSchema) });

  const validatePACRA = async () => {
    const regNo = companyForm.getValues('registration_number');
    if (!regNo) { toast.error('Enter registration number first'); return; }
    try {
      const res = await vendorApi.registration.validatePACRA(regNo);
      toast.success(res.message || 'PACRA validation passed');
    } catch { /* handled by interceptor */ }
  };

  const validateCEEC = async () => {
    const certNo = contactForm.getValues('ceec_certificate_number');
    if (!certNo) { toast.error('Enter CEEC certificate number first'); return; }
    try {
      const res = await vendorApi.registration.validateCEEC(certNo);
      toast.success(res.message || 'CEEC validation passed');
    } catch { /* handled by interceptor */ }
  };

  const addDocument = (type: string, file: File) => {
    setDocuments((prev) => [...prev.filter((d) => d.type !== type), { type, file, name: file.name }]);
  };

  const removeDocument = (type: string) => {
    setDocuments((prev) => prev.filter((d) => d.type !== type));
  };

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    bankForm.setValue('commodity_categories', next, { shouldValidate: true });
  };

  const nextStep = async () => {
    let isValid = false;
    if (step === 0) isValid = await accountForm.trigger();
    if (step === 1) isValid = await companyForm.trigger();
    if (step === 2) isValid = await contactForm.trigger();
    if (step === 3) isValid = await bankForm.trigger();
    if (step === 4) isValid = documents.length >= 4;

    if (isValid && step < 4) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else if (!isValid) {
      if (step === 4) toast.error('Please upload all required documents');
      else toast.error('Please complete all required fields correctly');
    }
  };

  const prevStep = () => { if (step > 0) setStep(step - 1); };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...accountForm.getValues(),
        ...companyForm.getValues(),
        ...contactForm.getValues(),
        ...bankForm.getValues(),
      };

      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (Array.isArray(value)) formData.append(key, JSON.stringify(value));
        else formData.append(key, String(value));
      });

      documents.forEach((doc) => {
        formData.append(`doc_${doc.type}`, doc.file);
      });

      await vendorApi.registration.submit(formData);
      setSubmitted(true);
      toast.success('Registration application submitted!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed. Please check your details.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Application received</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Your registration as a ZAMMSA supplier has been submitted. Our compliance team will review your documents and notify you via email within 3-5 business days.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-zammsa-green text-white text-sm font-semibold rounded-lg hover:bg-zammsa-green-dark transition-all"
          >
            Return to portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center mb-10">
          <Link to="/" className="w-10 h-10 bg-zammsa-green rounded-lg flex items-center justify-center shadow-md mb-4">
            <span className="text-white text-lg font-bold">Z</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier onboarding</h1>
          <p className="text-sm text-slate-500 mt-1">Complete your registration to join the ZAMMSA procurement network.</p>
        </div>

        <div className="flex items-center justify-between mb-8 bg-white rounded-lg border border-slate-200 px-6 py-3">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-emerald-100 text-emerald-600' :
                  i === step ? 'bg-zammsa-green text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {i < step ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-semibold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px mx-4 ${i < step ? 'bg-emerald-200' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-10">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create account</h2>
                <p className="text-sm text-slate-500 mt-1">These credentials will let you access the supplier portal once approved.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input {...accountForm.register('email')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" placeholder="legal@company.com" />
                  {accountForm.formState.errors.email && <p className="text-[11px] font-medium text-rose-600 mt-1">{accountForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
                  <input {...accountForm.register('username')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {accountForm.formState.errors.username && <p className="text-[11px] font-medium text-rose-600 mt-1">{accountForm.formState.errors.username.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <input type="password" {...accountForm.register('password')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {accountForm.formState.errors.password && <p className="text-[11px] font-medium text-rose-600 mt-1">{accountForm.formState.errors.password.message}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Company details</h2>
                <p className="text-sm text-slate-500 mt-1">Official business information as registered with PACRA.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official company name</label>
                  <input {...companyForm.register('company_name')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.company_name && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.company_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">PACRA registration number</label>
                  <div className="flex gap-2">
                    <input {...companyForm.register('registration_number')} className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                    <button type="button" onClick={validatePACRA} className="px-3.5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all shrink-0">Verify</button>
                  </div>
                  {companyForm.formState.errors.registration_number && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.registration_number.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tax ID (TIN)</label>
                  <input {...companyForm.register('tin')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.tin && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.tin.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business category</label>
                  <select {...companyForm.register('business_type')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all">
                    <option value="">Select category...</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="distributor">Distributor</option>
                    <option value="wholesaler">Wholesaler</option>
                    <option value="service_provider">Service Provider</option>
                  </select>
                  {companyForm.formState.errors.business_type && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.business_type.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Year established</label>
                  <input type="number" {...companyForm.register('year_established')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.year_established && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.year_established.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Employee count</label>
                  <input type="number" {...companyForm.register('employee_count')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.employee_count && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.employee_count.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Annual turnover (ZMW)</label>
                  <input type="number" {...companyForm.register('annual_turnover')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.annual_turnover && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.annual_turnover.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business address</label>
                  <textarea {...companyForm.register('address')} rows={2} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {companyForm.formState.errors.address && <p className="text-[11px] font-medium text-rose-600 mt-1">{companyForm.formState.errors.address.message}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Contact & compliance</h2>
                <p className="text-sm text-slate-500 mt-1">Designate a representative and provide CEEC information.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary contact name</label>
                  <input {...contactForm.register('contact_person')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {contactForm.formState.errors.contact_person && <p className="text-[11px] font-medium text-rose-600 mt-1">{contactForm.formState.errors.contact_person.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Designation / title</label>
                  <input {...contactForm.register('contact_title')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {contactForm.formState.errors.contact_title && <p className="text-[11px] font-medium text-rose-600 mt-1">{contactForm.formState.errors.contact_title.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone number</label>
                  <input {...contactForm.register('contact_phone')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {contactForm.formState.errors.contact_phone && <p className="text-[11px] font-medium text-rose-600 mt-1">{contactForm.formState.errors.contact_phone.message}</p>}
                </div>
                <div />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">CEEC certificate (optional)</label>
                  <div className="flex gap-2">
                    <input {...contactForm.register('ceec_certificate_number')} className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                    <button type="button" onClick={validateCEEC} className="px-3.5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all shrink-0">Verify</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Empowerment category</label>
                  <select {...contactForm.register('ceec_category')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all">
                    <option value="">Select category...</option>
                    <option value="youth">Youth-Owned</option>
                    <option value="woman">Woman-Owned</option>
                    <option value="disabled">PWD-Owned</option>
                    <option value="general">General Citizen Owned</option>
                  </select>
                  {contactForm.formState.errors.ceec_category && <p className="text-[11px] font-medium text-rose-600 mt-1">{contactForm.formState.errors.ceec_category.message}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Financial & capability</h2>
                <p className="text-sm text-slate-500 mt-1">Provide banking details and select your service domains.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank name</label>
                  <input {...bankForm.register('bank_name')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {bankForm.formState.errors.bank_name && <p className="text-[11px] font-medium text-rose-600 mt-1">{bankForm.formState.errors.bank_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account number</label>
                  <input {...bankForm.register('bank_account_number')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {bankForm.formState.errors.bank_account_number && <p className="text-[11px] font-medium text-rose-600 mt-1">{bankForm.formState.errors.bank_account_number.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account name</label>
                  <input {...bankForm.register('bank_account_name')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {bankForm.formState.errors.bank_account_name && <p className="text-[11px] font-medium text-rose-600 mt-1">{bankForm.formState.errors.bank_account_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Branch</label>
                  <input {...bankForm.register('bank_branch')} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all" />
                  {bankForm.formState.errors.bank_branch && <p className="text-[11px] font-medium text-rose-600 mt-1">{bankForm.formState.errors.bank_branch.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-3">Commodity categories (select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {commodityOptions.map((cat) => (
                      <button
                        key={cat} type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                          selectedCategories.includes(cat)
                            ? 'bg-zammsa-green text-white border-zammsa-green'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-zammsa-green/50'
                        }`}
                      >{cat}</button>
                    ))}
                  </div>
                  {bankForm.formState.errors.commodity_categories && <p className="text-[11px] font-medium text-rose-600 mt-2">Selection required</p>}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Documentation</h2>
                <p className="text-sm text-slate-500 mt-1">Upload high-resolution scans of the following legal documents.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'incorporation', label: 'Certificate of Incorporation' },
                  { key: 'tax_clearance', label: 'Tax Clearance' },
                  { key: 'napsa', label: 'NAPSA Compliance' },
                  { key: 'ceec', label: 'CEEC Certificate' },
                ].map((doc) => {
                  const isUploaded = documents.find((d) => d.type === doc.key);
                  return (
                    <div key={doc.key}
                      onDragOver={(e) => { e.preventDefault(); setDragging(doc.key); }}
                      onDragLeave={() => setDragging(null)}
                      onDrop={(e) => { e.preventDefault(); setDragging(null); const f = e.dataTransfer.files[0]; if (f) addDocument(doc.key, f); }}
                      className={`relative border-2 border-dashed rounded-lg p-5 transition-all ${
                        dragging === doc.key ? 'border-zammsa-green bg-emerald-50' :
                        isUploaded ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${isUploaded ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                          {isUploaded ? <CheckIcon className="w-5 h-5" /> : <CloudUploadIcon className="w-5 h-5" />}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mb-1">{doc.label}</p>
                        {isUploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-emerald-600 truncate max-w-[120px]">{isUploaded.name}</span>
                            <button onClick={() => removeDocument(doc.key)} className="text-rose-500 hover:text-rose-700"><XIcon className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <p className="text-[10px] font-medium text-slate-400">PDF or image, max 5MB</p>
                        )}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) addDocument(doc.key, f); }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <div>
              {step > 0 && (
                <button onClick={prevStep} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">
                  <ArrowLeftIcon className="w-3.5 h-3.5" />
                  Previous
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Save draft</button>
              {step < 4 ? (
                <button onClick={nextStep} className="px-6 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all">
                  Continue
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-zammsa-green text-white text-xs font-semibold rounded-lg hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center gap-2">
                  {submitting ? <LoadingSpinner /> : 'Complete registration'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default VendorRegistrationWizard;
