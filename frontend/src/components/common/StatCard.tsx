import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';
}

const colorMap = {
  green: 'text-zammsa-green',
  blue: 'text-blue-600',
  orange: 'text-amber-500',
  red: 'text-rose-600',
  purple: 'text-purple-600',
  gray: 'text-slate-600',
};

const bgMap = {
  green: 'bg-zammsa-green/5',
  blue: 'bg-blue-50',
  orange: 'bg-amber-50',
  red: 'bg-rose-50',
  purple: 'bg-purple-50',
  gray: 'bg-slate-50',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  icon,
  trend,
  description,
  color = 'green'
}) => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${bgMap[color]} ${colorMap[color]}`}>
          {React.isValidElement(icon) 
            ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { 
                className: 'w-5 h-5' 
              }) 
            : icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</h3>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-slate-500 font-medium">{description}</p>
        )}
      </div>
    </div>
  );
};
