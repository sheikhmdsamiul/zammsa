import React from 'react';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  columns: Column[];
  data: any[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: any) => void;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  loading?: boolean;
}

export const DataTable: React.FC<Props> = ({
  columns, data, sortKey, sortDir, onSort, onRowClick, selectedIds, onSelect, loading,
}) => {
  const sanitizeCellValue = (value: React.ReactNode) => {
    if (typeof value === 'number' && Number.isNaN(value)) return '-';
    return value;
  };

  return (
    <div className="overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr className="bg-slate-50/50">
              {onSelect && (
                <th className="w-12 px-6 py-3.5">
                  <span className="sr-only">Select</span>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={`px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:text-slate-900 transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <div className="flex flex-col shrink-0">
                        <span className={`leading-[0.5] ${sortKey === col.key && sortDir === 'asc' ? 'text-zammsa-green' : 'opacity-30'}`}>▴</span>
                        <span className={`leading-[0.5] ${sortKey === col.key && sortDir === 'desc' ? 'text-zammsa-green' : 'opacity-30'}`}>▾</span>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (onSelect ? 1 : 0)} className="px-6 py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-zammsa-green border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-semibold text-slate-400">Loading Data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelect ? 1 : 0)} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl grayscale opacity-20">📂</span>
                    <p className="text-sm font-semibold text-slate-400">No records found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
                >
                  {onSelect && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds?.includes(row.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelect(row.id);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-zammsa-green focus:ring-zammsa-green transition-all"
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const rendered = col.render ? col.render(row[col.key], row) : row[col.key];
                    return (
                      <td key={col.key} className="px-6 py-4 text-sm font-medium text-slate-600 whitespace-nowrap group-hover:text-slate-900 transition-colors">
                        {sanitizeCellValue(rendered)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
