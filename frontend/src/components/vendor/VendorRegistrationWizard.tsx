import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckIcon, ChevronRightIcon, ArrowLeftIcon, CloudUploadIcon } from '@heroicons/react/outline';

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
  const navigate = useNavigate();
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
    if (step === 4) isValid = documents.length >= 4; // Simplified check

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xl shadow-emerald-900/5 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-8 ring-8 ring-emerald-50/50">
            <CheckIcon className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Application Received</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-10">
            Your registration as a ZAMMSA supplier has been successfully submitted. Our compliance team will review your documents and notify you via email within 3-5 business days.
          </p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-zammsa-green text-white text-sm font-bold rounded-xl uppercase tracking-widest hover:bg-zammsa-green-dark transition-all shadow-lg shadow-zammsa-green/20"
          >
            Return to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-4xl">
        {/* Branding & Header */}
        <div className="flex flex-col items-center text-center mb-12">
           <Link to="/" className="w-12 h-12 bg-zammsa-green rounded-2xl flex items-center justify-center shadow-lg shadow-zammsa-green/20 mb-6 hover:scale-110 transition-all">
              <span className="text-white text-xl font-bold italic">Z</span>
           </Link>
           <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Supplier Onboarding</h1>
           <p className="text-slate-500 font-semibold mt-2 uppercase tracking-[0.2em] text-[10px]">Official ZAMMSA Procurement Network</p>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 mb-8 shadow-sm overflow-x-auto">
          <div className="flex items-center min-w-[600px] justify-between">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-3 px-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < step ? 'bg-emerald-100 text-emerald-600' :
                    i === step ? 'bg-zammsa-green text-white shadow-lg ring-4 ring-emerald-50' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {i < step ? <CheckIcon className="w-5 h-5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-emerald-200' : 'bg-slate-100'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-900/5 p-8 lg:p-16 min-h-[600px] flex flex-col relative overflow-hidden">
          {/* Subtle Background pattern */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-slate-50 rounded-full opacity-50" />
          
          <div className="flex-1 relative z-10">
            {step === 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Create Account</h2>
                   <p className="text-sm text-slate-500 font-medium">Use these credentials to access the supplier portal once approved.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input {...accountForm.register('email')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="legal@company.com" />
                    {accountForm.formState.errors.email && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{accountForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                    <input {...accountForm.register('username')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="Choose a handle" />
                    {accountForm.formState.errors.username && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{accountForm.formState.errors.username.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                    <input type="password" {...accountForm.register('password')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="••••••••" />
                    {accountForm.formState.errors.password && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{accountForm.formState.errors.password.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Company Details</h2>
                   <p className="text-sm text-slate-500 font-medium">Official business information as registered with PACRA.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official Company Name</label>
                    <input {...companyForm.register('company_name')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.company_name && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.company_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">PACRA Reg Number</label>
                    <div className="flex gap-2">
                      <input {...companyForm.register('registration_number')} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                      <button type="button" onClick={validatePACRA} className="px-4 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-sm">Verify</button>
                    </div>
                    {companyForm.formState.errors.registration_number && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.registration_number.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tax ID (TIN)</label>
                    <input {...companyForm.register('tin')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.tin && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.tin.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Category</label>
                    <select {...companyForm.register('business_type')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none appearance-none">
                      <option value="">Select Category...</option>
                      <option value="manufacturer">Manufacturer</option>
                      <option value="distributor">Distributor</option>
                      <option value="wholesaler">Wholesaler</option>
                      <option value="service_provider">Service Provider</option>
                    </select>
                    {companyForm.formState.errors.business_type && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.business_type.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Year Established</label>
                    <input type="number" {...companyForm.register('year_established')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.year_established && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.year_established.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee Count</label>
                    <input type="number" {...companyForm.register('employee_count')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.employee_count && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.employee_count.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Annual Turnover (ZMW)</label>
                    <input type="number" {...companyForm.register('annual_turnover')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.annual_turnover && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.annual_turnover.message}</p>}
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Address</label>
                    <textarea {...companyForm.register('address')} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {companyForm.formState.errors.address && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{companyForm.formState.errors.address.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Contact & Compliance</h2>
                   <p className="text-sm text-slate-500 font-medium">Designate a representative and provide CEEC information.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Contact Name</label>
                    <input {...contactForm.register('contact_person')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {contactForm.formState.errors.contact_person && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{contactForm.formState.errors.contact_person.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Designation/Title</label>
                    <input {...contactForm.register('contact_title')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {contactForm.formState.errors.contact_title && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{contactForm.formState.errors.contact_title.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input {...contactForm.register('contact_phone')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {contactForm.formState.errors.contact_phone && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{contactForm.formState.errors.contact_phone.message}</p>}
                  </div>
                  <div className="hidden sm:block" />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CEEC Certificate (Optional)</label>
                    <div className="flex gap-2">
                      <input {...contactForm.register('ceec_certificate_number')} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                      <button type="button" onClick={validateCEEC} className="px-4 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-sm">Verify</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Empowerment Category</label>
                    <select {...contactForm.register('ceec_category')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none appearance-none">
                      <option value="">Select Category...</option>
                      <option value="youth">Youth-Owned</option>
                      <option value="woman">Woman-Owned</option>
                      <option value="disabled">PWD-Owned</option>
                      <option value="general">General Citizen Owned</option>
                    </select>
                    {contactForm.formState.errors.ceec_category && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{contactForm.formState.errors.ceec_category.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Financial & Capability</h2>
                   <p className="text-sm text-slate-500 font-medium">Provide banking details and select your service domains.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                    <input {...bankForm.register('bank_name')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {bankForm.formState.errors.bank_name && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{bankForm.formState.errors.bank_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
                    <input {...bankForm.register('bank_account_number')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {bankForm.formState.errors.bank_account_number && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{bankForm.formState.errors.bank_account_number.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                    <input {...bankForm.register('bank_account_name')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {bankForm.formState.errors.bank_account_name && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{bankForm.formState.errors.bank_account_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Branch</label>
                    <input {...bankForm.register('bank_branch')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" />
                    {bankForm.formState.errors.bank_branch && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{bankForm.formState.errors.bank_branch.message}</p>}
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Commodity Categories (Select all that apply)</label>
                    <div className="flex flex-wrap gap-2">
                      {commodityOptions.map((cat) => (
                        <button
                          key={cat} type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all ${
                            selectedCategories.includes(cat) 
                              ? 'bg-zammsa-green text-white border-zammsa-green shadow-md shadow-zammsa-green/20' 
                              : 'bg-white text-slate-500 border-slate-200 hover:border-zammsa-green/30'
                          }`}
                        >{cat}</button>
                      ))}
                    </div>
                    {bankForm.formState.errors.commodity_categories && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1 mt-2">Selection Required</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Documentation</h2>
                   <p className="text-sm text-slate-500 font-medium">Please provide high-resolution scans of the following legal documents.</p>
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
                        className={`relative group border-2 border-dashed rounded-2xl p-6 transition-all ${
                          dragging === doc.key ? 'border-zammsa-green bg-emerald-50' : 
                          isUploaded ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col items-center text-center">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${isUploaded ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 group-hover:text-zammsa-green shadow-sm'}`}>
                              {isUploaded ? <CheckIcon className="w-6 h-6" /> : <CloudUploadIcon className="w-6 h-6" />}
                           </div>
                           <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-1">{doc.label}</p>
                           {isUploaded ? (
                             <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-emerald-600 uppercase truncate max-w-[120px]">{isUploaded.name}</span>
                                <button onClick={() => removeDocument(doc.key)} className="text-rose-500 hover:text-rose-700 transition-colors"><XIcon className="w-3 h-3" /></button>
                             </div>
                           ) : (
                             <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">PDF/JPG • Max 5MB</p>
                           )}
                           <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) addDocument(doc.key, f); }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
            <div>
              {step > 0 && (
                <button onClick={prevStep} className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                  <ArrowLeftIcon className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Save Draft</button>
              {step < 4 ? (
                <button onClick={nextStep} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                  <span>Continue</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-3 px-10 py-3 bg-zammsa-green text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-zammsa-green-dark transition-all disabled:opacity-50 shadow-lg shadow-zammsa-green/20">
                  {submitting ? <LoadingSpinner /> : 'Complete Registration'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add missing icon
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default VendorRegistrationWizard;
