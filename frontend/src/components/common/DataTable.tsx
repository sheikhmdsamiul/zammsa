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
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelect && <th className="w-10 px-3 py-3" />}
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSort?.(col.key)}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr><td colSpan={columns.length + (onSelect ? 1 : 0)} className="text-center py-8">Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length + (onSelect ? 1 : 0)} className="text-center py-8 text-gray-500">No data</td></tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {onSelect && (
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(row.id)}
                      onChange={() => onSelect(row.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                {columns.map((col) => {
                  const rendered = col.render ? col.render(row[col.key], row) : row[col.key];
                  return (
                    <td key={col.key} className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
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
  );
};
