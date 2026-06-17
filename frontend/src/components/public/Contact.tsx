import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { MailIcon, PhoneIcon, LocationMarkerIcon, ClockIcon } from '@heroicons/react/outline';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type Form = z.infer<typeof schema>;

const Contact: React.FC = () => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    try {
      await publicApi.submitContact(data);
      toast.success('Message sent successfully. We will get back to you soon.');
      reset();
    } catch {
      // error handled by interceptor
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="Contact Us"
        description="Have questions? Our team is here to assist you with procurement inquiries and technical support."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 lg:p-12 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 tracking-tight">Send us a Message</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input {...register('name')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="John Doe" />
                  {errors.name && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input {...register('email')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="john@example.com" />
                  {errors.email && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{errors.email.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                <input {...register('subject')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="How can we help?" />
                {errors.subject && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{errors.subject.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
                <textarea {...register('message')} rows={5} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all outline-none" placeholder="Provide details here..." />
                {errors.message && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{errors.message.message}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-10 py-4 bg-zammsa-green text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-zammsa-green/10"
              >
                {isSubmitting ? <LoadingSpinner /> : 'Send Message'}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-8 tracking-tight">Information</h3>
            <div className="space-y-8">
              {[
                { label: 'Address', value: 'Plot 12345, Great East Road, Lusaka, Zambia', icon: <LocationMarkerIcon /> },
                { label: 'Phone', value: '+260 211 123 456 / 457', icon: <PhoneIcon /> },
                { label: 'Email', value: 'info@zammsa.gov.zm', icon: <MailIcon /> },
                { label: 'Working Hours', value: 'Mon-Fri: 08:00 - 17:00', icon: <ClockIcon /> },
              ].map((item) => (
                <div key={item.label} className="flex gap-4">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-zammsa-green shrink-0">
                    {React.isValidElement(item.icon) 
                      ? React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { 
                          className: 'w-5 h-5' 
                        }) 
                      : item.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-700 leading-snug">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
             <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2">Technical Support</h3>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">Need help with supplier registration or bid submission?</p>
                <a href="mailto:support@zammsa.gov.zm" className="text-xs font-bold uppercase tracking-widest text-zammsa-green hover:underline">Support Desk →</a>
             </div>
             <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-zammsa-green/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
