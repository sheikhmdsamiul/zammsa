import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { SearchIcon, ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/outline';

const FAQ: React.FC = () => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedAll, setExpandedAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: () => publicApi.listFAQs({ limit: 100 }),
  });

  const faqs = data?.results || [];

  const filtered = search
    ? faqs.filter((f: any) => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  const categories = Array.from(new Set(filtered.map((f: any) => f.category)));

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
    setExpandedAll(false);
  };

  const toggleAll = () => {
    if (expandedAll) {
      setExpanded(new Set());
      setExpandedAll(false);
    } else {
      setExpanded(new Set(filtered.map((f: any) => f.id)));
      setExpandedAll(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="Knowledge Base"
        description="Frequently asked questions about procurement processes, supplier registration, and compliance."
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder="Search knowledge base..."
             className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
           />
        </div>
        <button
          onClick={toggleAll}
          className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-sm whitespace-nowrap"
        >
          {expandedAll ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : !filtered.length ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-200">
              <QuestionMarkCircleIcon className="w-8 h-8" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No results found</h3>
           <p className="text-slate-500 font-medium mt-1">Try a different search term or category.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {categories.map((category: any) => (
            <div key={category} className="space-y-6">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">{category.replace('_', ' ')}</h2>
              <div className="space-y-3">
                {filtered.filter((f: any) => f.category === category).map((faq: any) => (
                  <div key={faq.id} className={`bg-white rounded-2xl border transition-all duration-300 ${expanded.has(faq.id) ? 'border-zammsa-green/30 shadow-md ring-4 ring-emerald-50/50' : 'border-slate-200 shadow-sm'}`}>
                    <button
                      onClick={() => toggle(faq.id)}
                      className="w-full flex items-center justify-between p-5 text-left transition-colors group"
                    >
                      <span className={`font-bold text-sm leading-tight transition-colors ${expanded.has(faq.id) ? 'text-zammsa-green' : 'text-slate-900 group-hover:text-zammsa-green'}`}>{faq.question}</span>
                      <ChevronDownIcon
                        className={`h-5 w-5 text-slate-300 flex-shrink-0 transition-transform duration-300 ${expanded.has(faq.id) ? 'rotate-180 text-zammsa-green' : ''}`}
                      />
                    </button>
                    {expanded.has(faq.id) && (
                      <div className="px-5 pb-6 text-slate-600 text-sm font-medium leading-relaxed border-t border-slate-50 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FAQ;
