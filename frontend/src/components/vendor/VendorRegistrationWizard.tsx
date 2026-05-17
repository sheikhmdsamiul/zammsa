import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { suppliersApi } from '../../api/suppliers';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckIcon } from '@heroicons/react/outline';

const steps = ['Account Info', 'Company Info', 'Contact & CEEC', 'Bank Details', 'Documents'];

const accountSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8).optional(),
});

const companySchema = z.object({
  company_name: z.string().min(2),
  registration_number: z.string().min(1),
  tax_id: z.string().min(1),
  business_type: z.string().min(1),
  year_established: z.string().min(4),
  employee_count: z.string().min(1),
  annual_turnover: z.string().min(1),
  address: z.string().min(5),
});

const contactSchema = z.object({
  contact_person: z.string().min(2),
  contact_title: z.string().min(2),
  contact_phone: z.string().min(7),
  ceec_certificate_number: z.string().optional(),
  ceec_category: z.string().optional(),
});

const bankSchema = z.object({
  bank_name: z.string().min(2),
  bank_account_number: z.string().min(5),
  bank_account_name: z.string().min(2),
  bank_branch: z.string().min(1),
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

  const ceecCategoryMap: Record<string, string> = {
    youth: 'citizen_owned',
    woman: 'citizen_empowered',
    disabled: 'citizen_influenced',
    general: 'non_citizen',
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const account = accountForm.getValues();
      const company = companyForm.getValues();
      const contact = contactForm.getValues();
      const data = {
        email: account.email,
        password: account.password,
        company_name: company.company_name,
        registration_number: company.registration_number,
        tin: company.tax_id,
        ceec_certificate_number: contact.ceec_certificate_number || '',
        ceec_category: ceecCategoryMap[contact.ceec_category || ''] || 'non_citizen',
        contact_person: contact.contact_person,
        contact_phone: contact.contact_phone,
        contact_email: account.email,
        address: company.address,
        bank_name: bankForm.getValues('bank_name') || '',
        bank_account_number: bankForm.getValues('bank_account_number') || '',
        bank_account_name: bankForm.getValues('bank_account_name') || '',
        bank_branch: bankForm.getValues('bank_branch') || '',
      };
      await vendorApi.registration.submit(data);
      setSubmitted(true);
    } catch { /* handled by interceptor */ }
    setSubmitting(false);
  };

  const saveDraft = async () => {
    try {
      await vendorApi.registration.saveDraft({});
      toast.success('Draft saved');
    } catch { /* handled by interceptor */ }
  };

  const nextStep = () => { if (step < 4) setStep(step + 1); };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-600">{'\u2713'}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
          <p className="text-gray-500 mb-6">Your application has been submitted for review. You will be notified once your account is approved.</p>
          <a href="/" className="inline-block px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-green-700">Return Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Registration</h1>
        <p className="text-gray-500 mt-1">Complete all steps to register as a ZAMMSA supplier</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < step ? 'bg-zammsa-green text-white' :
                  i === step ? 'bg-zammsa-green text-white ring-2 ring-zammsa-green ring-offset-2' :
                  'bg-gray-200 text-gray-500'
                }`}>{i < step ? <CheckIcon className="h-4 w-4" /> : i + 1}</div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-zammsa-green font-medium' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-zammsa-green' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...accountForm.register('email')} className="w-full border-gray-300 rounded-lg" />
              {accountForm.formState.errors.email && <p className="text-xs text-red-600 mt-1">{accountForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input {...accountForm.register('username')} className="w-full border-gray-300 rounded-lg" />
              {accountForm.formState.errors.username && <p className="text-xs text-red-600 mt-1">{accountForm.formState.errors.username.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" {...accountForm.register('password')} className="w-full border-gray-300 rounded-lg" />
              {accountForm.formState.errors.password && <p className="text-xs text-red-600 mt-1">{accountForm.formState.errors.password.message}</p>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input {...companyForm.register('company_name')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <div className="flex gap-2">
                  <input {...companyForm.register('registration_number')} className="flex-1 border-gray-300 rounded-lg" />
                  <button type="button" onClick={validatePACRA} className="px-3 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-zammsa-green-dark">Verify</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TIN (Tax ID)</label>
                <input {...companyForm.register('tax_id')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select {...companyForm.register('business_type')} className="w-full border-gray-300 rounded-lg">
                  <option value="">Select...</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="wholesaler">Wholesaler</option>
                  <option value="retailer">Retailer</option>
                  <option value="service_provider">Service Provider</option>
                  <option value="contractor">Contractor</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Established</label>
                <input type="number" {...companyForm.register('year_established')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Count</label>
                <input type="number" {...companyForm.register('employee_count')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Turnover (ZMW)</label>
                <input type="number" {...companyForm.register('annual_turnover')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                <textarea {...companyForm.register('address')} rows={2} className="w-full border-gray-300 rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Person & CEEC</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
                <input {...contactForm.register('contact_person')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input {...contactForm.register('contact_title')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input {...contactForm.register('contact_phone')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEEC Certificate Number</label>
                <div className="flex gap-2">
                  <input {...contactForm.register('ceec_certificate_number')} className="flex-1 border-gray-300 rounded-lg" />
                  <button type="button" onClick={validateCEEC} className="px-3 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-zammsa-green-dark">Verify</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEEC Category</label>
                <select {...contactForm.register('ceec_category')} className="w-full border-gray-300 rounded-lg">
                  <option value="">Select...</option>
                  <option value="youth">Youth</option>
                  <option value="woman">Woman-Owned</option>
                  <option value="disabled">PWD-Owned</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Details & Capabilities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input {...bankForm.register('bank_name')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input {...bankForm.register('bank_account_number')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input {...bankForm.register('bank_account_name')} className="w-full border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <input {...bankForm.register('bank_branch')} className="w-full border-gray-300 rounded-lg" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Commodity Categories</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {commodityOptions.map((cat) => (
                  <button
                    key={cat} type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedCategories.includes(cat) ? 'bg-zammsa-green text-white border-zammsa-green' : 'bg-white text-gray-600 border-gray-300 hover:border-zammsa-green'
                    }`}
                  >{cat}</button>
                ))}
              </div>
              {bankForm.formState.errors.commodity_categories && <p className="text-xs text-red-600 mt-1">Select at least one category</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h2>
            <p className="text-sm text-gray-500 mb-4">Upload the required documents. Drag & drop or click to upload.</p>
            <div className="space-y-3">
              {[
                { key: 'incorporation', label: 'Certificate of Incorporation' },
                { key: 'tax_clearance', label: 'Tax Clearance Certificate' },
                { key: 'napsa', label: 'NAPSA Certificate' },
                { key: 'ceec', label: 'CEEC Certificate' },
                { key: 'bank_letter', label: 'Bank Confirmation Letter' },
                { key: 'license', label: 'Professional License' },
              ].map((doc) => (
                <div key={doc.key}
                  onDragOver={(e) => { e.preventDefault(); setDragging(doc.key); }}
                  onDragLeave={() => setDragging(null)}
                  onDrop={(e) => { e.preventDefault(); setDragging(null); const f = e.dataTransfer.files[0]; if (f) addDocument(doc.key, f); }}
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors ${dragging === doc.key ? 'border-zammsa-green bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{doc.label}</p>
                      {documents.find((d) => d.type === doc.key) ? (
                        <p className="text-xs text-zammsa-green mt-1">{documents.find((d) => d.type === doc.key)?.name}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG or PNG (max 5MB)</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {documents.find((d) => d.type === doc.key) ? (
                        <button type="button" onClick={() => removeDocument(doc.key)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      ) : (
                        <label className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg cursor-pointer hover:bg-gray-200">
                          Browse
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) addDocument(doc.key, f); }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <div>
            {step > 0 && (
              <button onClick={prevStep} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Previous</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={saveDraft} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Save Draft</button>
            {step < 4 ? (
              <button onClick={nextStep} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">Next</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center gap-2">
                {submitting && <LoadingSpinner size="sm" />}
                Submit for Approval
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorRegistrationWizard;
