import React from 'react';
import { Contract } from '../../types';
import { getSigningSteps, SigningStep } from './contractUtils';
import { CheckCircleIcon, ClockIcon, ExclamationIcon } from '@heroicons/react/outline';

const stateStyles: Record<SigningStep['state'], string> = {
  complete: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  current: 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-2 ring-indigo-100',
  waiting: 'bg-gray-50 border-gray-200 text-gray-600',
  blocked: 'bg-amber-50 border-amber-200 text-amber-800',
};

const StateIcon: React.FC<{ state: SigningStep['state'] }> = ({ state }) => {
  if (state === 'complete') return <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (state === 'blocked') return <ExclamationIcon className="w-5 h-5 text-amber-600 shrink-0" />;
  return <ClockIcon className="w-5 h-5 text-gray-400 shrink-0" />;
};

interface Props {
  contract: Contract;
  title?: string;
}

export const ContractSigningSteps: React.FC<Props> = ({ contract, title = 'Signing workflow' }) => {
  const steps = getSigningSteps(contract);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{title}</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={`flex items-start gap-3 p-4 rounded-xl border ${stateStyles[step.state]}`}
          >
            <span className="text-xs font-black text-gray-400 mt-0.5 w-5">{i + 1}</span>
            <StateIcon state={step.state} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{step.label}</p>
              <p className="text-xs opacity-80 mt-0.5">{step.who}</p>
              {step.detail && <p className="text-xs mt-1 font-medium">{step.detail}</p>}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider shrink-0">
              {step.state === 'complete' ? 'Done' : step.state === 'current' ? 'Action' : step.state}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};
