import React from 'react';

export const EVALUATION_PHASES = [
  {
    id: 'coi',
    label: 'COI Declaration',
    description: 'Conflict of Interest declarations from all committee members',
    icon: 'shield-check',
    order: 1,
    roles: ['chairperson', 'secretary', 'member'],
    dependencies: [],
  },
  {
    id: 'preliminary',
    label: 'Preliminary Examination',
    description: 'Mandatory criteria pass/fail checks',
    icon: 'check-circle',
    order: 2,
    roles: ['chairperson', 'secretary', 'member'],
    dependencies: ['coi'],
  },
  {
    id: 'technical',
    label: 'Technical Scoring',
    description: 'Evaluate technical proposals against criteria',
    icon: 'academic-cap',
    order: 3,
    roles: ['chairperson', 'secretary', 'member'],
    dependencies: ['preliminary'],
  },
  {
    id: 'consolidation',
    label: 'Score Consolidation',
    description: 'Merge technical scores, calculate combined QCBS scores',
    icon: 'chart-bar',
    order: 4,
    roles: ['chairperson'],
    dependencies: ['technical'],
  },
  {
    id: 'financial',
    label: 'Financial Evaluation',
    description: 'Review financial proposals and apply preferences',
    icon: 'currency-dollar',
    order: 5,
    roles: ['chairperson'],
    dependencies: ['consolidation'],
  },
  {
    id: 'post-qual',
    label: 'Post-Qualification',
    description: 'Verify winning bidder credentials and references',
    icon: 'clipboard-check',
    order: 6,
    roles: ['chairperson', 'secretary', 'member'],
    dependencies: ['financial'],
  },
  {
    id: 'ber',
    label: 'BER Workflow',
    description: 'Generate Bid Evaluation Report with signatures',
    icon: 'document-text',
    order: 7,
    roles: ['chairperson', 'secretary', 'member'],
    dependencies: ['post-qual'],
  },
] as const;

export type EvaluationPhaseId = typeof EVALUATION_PHASES[number]['id'];

export interface EvaluationPhase {
  id: EvaluationPhaseId;
  label: string;
  description: string;
  icon: string;
  order: number;
  roles: string[];
  dependencies: EvaluationPhaseId[];
}

export interface EvaluationPhaseStepperProps {
  currentPhase: EvaluationPhaseId;
  phasesComplete: Record<EvaluationPhaseId, boolean>;
  phasesBlocked: Record<EvaluationPhaseId, boolean>;
  onPhaseChange?: (phaseId: EvaluationPhaseId) => void;
  showLabels?: boolean;
  compact?: boolean;
  userRole?: string;
  committeeStatus?: string;
  solicitationTitle?: string;
}

export const EvaluationPhaseStepper: React.FC<EvaluationPhaseStepperProps> = ({
  currentPhase,
  phasesComplete,
  phasesBlocked,
  onPhaseChange,
  showLabels = true,
  compact = false,
  userRole = 'member',
  committeeStatus = 'active',
  solicitationTitle = '',
}) => {
  const currentPhaseIndex = EVALUATION_PHASES.findIndex((p) => p.id === currentPhase);
  const isCompleted = (idx: number) => phasesComplete[EVALUATION_PHASES[idx].id];
  const isBlocked = (idx: number) => phasesBlocked[EVALUATION_PHASES[idx].id];

  const canAccess = (idx: number) => {
    if (isCompleted(idx)) return true;
    if (idx <= currentPhaseIndex && !isBlocked(idx)) return true;
    return false;
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 -z-10 hidden md:block" />

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-4 md:gap-6">
          {EVALUATION_PHASES.map((phase, idx) => {
            const isCurrent = idx === currentPhaseIndex;
            const isDone = isCompleted(idx);
            const isAccessible = canAccess(idx);
            const blocked = isBlocked(idx) && !isDone;

            let statusBadge;
            if (isDone) {
              statusBadge = (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-emerald-700">Complete</span>
                </span>
              );
            } else if (isCurrent) {
              statusBadge = (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-zammsa-green animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-zammsa-green">Active</span>
                </span>
              );
            } else if (blocked) {
              statusBadge = (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-gray-400">Locked</span>
                </span>
              );
            } else {
              statusBadge = (
                <span className="text-xs font-medium text-gray-400">Pending</span>
              );
            }

            return (
              <div
                key={phase.id}
                className={`relative flex flex-col items-center group ${!compact ? 'text-center' : ''}`}
                onClick={() => isAccessible && onPhaseChange?.(phase.id)}
              >
                <div
                  className={`
                    relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                    ${isDone
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:border-emerald-700 hover:bg-emerald-100'
                      : isCurrent
                      ? 'border-zammsa-green bg-zammsa-green text-white shadow-lg shadow-zammsa-green/20'
                      : blocked
                      ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 bg-white text-gray-500 hover:border-zammsa-green hover:text-zammsa-green'}
                    ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}
                  `}
                >
                  {isDone ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-bold text-sm">{phase.order}</span>
                  )}
                </div>

                {showLabels && (
                  <div className="mt-3 text-center">
                    <h4
                      className={`
                        text-xs font-semibold transition-colors duration-300
                        ${isCurrent ? 'text-zammsa-green' : isDone ? 'text-gray-700' : blocked ? 'text-gray-400' : 'text-gray-900'}
                        ${!isAccessible ? 'opacity-60' : ''}
                        ${compact ? 'text-[10px]' : ''}
                      `}
                    >
                      {phase.label}
                    </h4>
                    <p
                      className={`
                        text-[10px] mt-0.5 transition-opacity duration-200
                        ${isCurrent || isDone ? 'text-gray-600 opacity-100' : 'text-gray-400 opacity-70'}
                      `}
                    >
                      {phase.description}
                    </p>

                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      {statusBadge}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 font-medium text-xs">Committee Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
              committeeStatus === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : committeeStatus === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {committeeStatus.charAt(0).toUpperCase() + committeeStatus.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-600 font-medium text-xs">Progress:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-zammsa-green to-emerald-600 transition-all duration-500"
                style={{
                  width: `${(Object.values(phasesComplete).filter(Boolean).length / EVALUATION_PHASES.length) * 100}%`,
                }}
              />
            </div>
            <span className="font-bold text-gray-700 text-xs">
              {Object.values(phasesComplete).filter(Boolean).length}/{EVALUATION_PHASES.length}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] text-gray-500 flex items-center justify-between px-2">
        <div>
          Your Role: <span className="font-medium text-gray-700">{userRole.replace(/_/g, ' ').toUpperCase()}</span>
        </div>
        <div className="text-right">
          {userRole === 'chairperson' && 'Full access: All phases'}
          {userRole === 'secretary' && 'COI, Prelim, Tech, Post-Qual, BER'}
          {userRole === 'member' && 'COI, Prelim, Tech, Post-Qual, BER'}
        </div>
      </div>

      {solicitationTitle && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg text-[10px] text-gray-600 border border-gray-200">
          <span className="font-medium text-gray-800">Solicitation:</span> {solicitationTitle}
        </div>
      )}
    </div>
  );
};
