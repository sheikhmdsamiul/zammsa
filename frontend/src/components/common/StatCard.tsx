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
  green: 'bg-green-50 text-green-600 border-green-100',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-100',
};

const iconBgMap = {
  green: 'bg-green-100 text-green-600',
  blue: 'bg-blue-100 text-blue-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
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
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBgMap[color]}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
            change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</h3>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
        </div>
        {description && (
          <p className="mt-2 text-xs text-gray-500 font-medium">{description}</p>
        )}
      </div>
      
      {/* Subtle Background Accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] pointer-events-none ${
        color === 'green' ? 'bg-zammsa-green' : 'bg-gray-900'
      }`} />
    </div>
  );
};
