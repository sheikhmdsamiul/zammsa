import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../common/PageHeader';
import { 
  LightningBoltIcon, EyeIcon, ShieldCheckIcon, 
  UserGroupIcon, AcademicCapIcon, GlobeAltIcon 
} from '@heroicons/react/outline';

const team = [
  { name: 'Dr. John Banda', title: 'Director General' },
  { name: 'Ms. Mary Chanda', title: 'Director of Procurement' },
  { name: 'Mr. Peter Zulu', title: 'Director of Finance' },
  { name: 'Dr. Sarah Mwamba', title: 'Director of Operations' },
];

const milestones = [
  { year: '2015', event: 'ZAMMSA established by an Act of Parliament' },
  { year: '2016', event: 'Launched the first national procurement framework' },
  { year: '2018', event: 'Achieved ISO 9001:2015 certification' },
  { year: '2022', event: 'Launched the e-Procurement portal' },
  { year: '2024', event: 'Provincial Expansion Stage' },
];

const About: React.FC = () => {
  return (
    <div className="space-y-0">
      <section className="bg-slate-900 py-24 border-b border-slate-800 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center lg:text-left">
           <div className="max-w-3xl">
              <h1 className="text-4xl lg:text-6xl font-bold text-white tracking-tight mb-8">Modernizing <span className="text-zammsa-green">Health Supply Chains.</span></h1>
              <p className="text-lg text-slate-400 font-medium leading-relaxed mb-0">Zambia Medicines & Medical Supplies Agency is the leading institution for pharmaceutical procurement and distribution in Zambia.</p>
           </div>
        </div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-zammsa-green/10 rounded-full blur-[100px] -mr-32 -mt-32" />
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-32">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
           <div>
              <div className="inline-block px-3 py-1 bg-emerald-50 text-zammsa-green text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">Our Mandate</div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-6">Ensuring quality and affordability for every citizen.</h2>
              <div className="space-y-6">
                 <p className="text-slate-600 font-medium leading-relaxed">Established in 2015, ZAMMSA operates under a strict mandate to source, verify, and deliver essential medical supplies across the Republic of Zambia.</p>
                 <p className="text-slate-600 font-medium leading-relaxed">Our modernized e-Procurement ecosystem ensures that every Kwacha spent delivers maximum value, fostering a competitive and transparent marketplace for healthcare suppliers worldwide.</p>
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: 'Mission', desc: 'Timely, cost-effective delivery of quality medical supplies.', icon: <LightningBoltIcon />, color: 'emerald' },
                { title: 'Vision', desc: 'World-class procurement agency contributing to universal coverage.', icon: <EyeIcon />, color: 'blue' },
                { title: 'Integrity', desc: 'Highest standards of transparency and ethical conduct.', icon: <ShieldCheckIcon />, color: 'purple' },
                { title: 'People', desc: 'Prioritizing the health needs of the Zambian population.', icon: <UserGroupIcon />, color: 'amber' },
              ].map((item) => (
                <div key={item.title} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                     item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                     item.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                     item.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                     'bg-amber-50 text-amber-600'
                   }`}>
                      {React.isValidElement(item.icon) 
                        ? React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { 
                            className: 'w-5 h-5' 
                          }) 
                        : item.icon}
                   </div>
                   <h3 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-wider">{item.title}</h3>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
           </div>
        </section>

        <section className="bg-slate-50 rounded-[40px] p-8 lg:p-20 border border-slate-200">
           <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Our Strategic Journey</h2>
              <p className="text-slate-500 font-medium mt-2">Key milestones in our institutional evolution.</p>
           </div>
           <div className="relative">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-200 hidden lg:block -translate-y-1/2" />
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-0 relative">
                 {milestones.map((m, i) => (
                    <div key={m.year} className="flex flex-col items-center text-center lg:px-4">
                       <div className="w-4 h-4 rounded-full bg-zammsa-green border-4 border-white shadow-sm z-10 hidden lg:block mb-8" />
                       <span className="text-xl font-bold text-zammsa-green mb-2">{m.year}</span>
                       <p className="text-xs font-bold text-slate-900 uppercase tracking-tight mb-2">{m.event}</p>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        <section>
           <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Leadership</h2>
              <p className="text-slate-500 font-medium mt-2">The team driving ZAMMSA's vision forward.</p>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member) => (
                <div key={member.name} className="group bg-white rounded-3xl border border-slate-200 p-8 text-center hover:border-zammsa-green/30 transition-all shadow-sm">
                   <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-400 font-bold group-hover:bg-zammsa-green group-hover:text-white transition-all duration-300">
                      {member.name.split(' ').map(n => n[0]).join('')}
                   </div>
                   <h3 className="text-base font-bold text-slate-900 mb-1">{member.name}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.title}</p>
                </div>
              ))}
           </div>
        </section>
      </div>

      <section className="bg-zammsa-green py-24 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Empowering Supplier Growth</h2>
          <p className="text-lg text-emerald-50/70 font-medium mb-10">We invite reputable local and international suppliers to join our transparent e-Procurement network.</p>
          <Link to="/suppliers/register" className="inline-flex items-center gap-3 px-10 py-5 bg-white text-zammsa-green font-bold rounded-2xl uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
            Start Registration
          </Link>
        </div>
      </section>
    </div>
  );
};

export default About;
