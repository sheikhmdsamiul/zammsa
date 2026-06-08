import React from 'react';
import { Link } from 'react-router-dom';
import { Contract } from '../../types';
import { ArchiveIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/outline';

const stateStyles = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  current: 'border-indigo-200 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100',
  upcoming: 'border-gray-200 bg-gray-50 text-gray-600',
} as const;

const statePills = {
  complete: 'Done',
  current: 'Active',
  upcoming: 'Pending',
} as const;

const StateIcon: React.FC<{ state: 'complete' | 'current' | 'upcoming' }> = ({ state }) => {
  if (state === 'complete') return <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (state === 'current') return <ClockIcon className="w-5 h-5 text-indigo-600 shrink-0" />;
  return <ArchiveIcon className="w-5 h-5 text-gray-400 shrink-0" />;
};

interface Props {
  contract: Contract;
  title?: string;
}

const ContractOperationalPhases: React.FC<Props> = ({ contract, title = 'Post-activation phases' }) => {
  const phases = contract.operational_phases || [];

  if (!phases.length) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            The contract has now moved into the execution, finance, closure, and archiving stages.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
          <span className="inline-flex items-center gap-1"><CheckCircleIcon className="w-4 h-4 text-emerald-600" /> Complete</span>
          <span className="inline-flex items-center gap-1"><ClockIcon className="w-4 h-4 text-indigo-600" /> Active</span>
          <span className="inline-flex items-center gap-1"><ArchiveIcon className="w-4 h-4 text-gray-400" /> Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {phases.map((phase) => (
          <div
            key={phase.code}
            className={`rounded-2xl border p-4 shadow-sm transition-shadow ${stateStyles[phase.state]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/80 border border-current/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-black">{phase.code}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{phase.label}</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] mt-1 opacity-70">{phase.role}</p>
                </div>
              </div>
              <StateIcon state={phase.state} />
            </div>

            <div className="mt-4 space-y-3">
              {phase.evidence && (
                <div className="rounded-xl bg-white/70 border border-white/50 px-3 py-2 text-xs font-semibold">
                  {phase.evidence}
                </div>
              )}
              {phase.detail && <p className="text-sm opacity-90">{phase.detail}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{statePills[phase.state]}</span>
                {phase.path ? (
                  phase.path.startsWith('/') ? (
                    <Link
                      to={phase.path}
                      className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 hover:opacity-100 hover:underline"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                      {phase.path}
                    </span>
                  )
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ContractOperationalPhases;
