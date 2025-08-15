import { StatusFilter, TypeFilter } from '@/types/trading';

interface DateFilterProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

export const DateFilter = ({ value, onChange, className = '' }: DateFilterProps) => (
  <input
    type="date"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  />
);

interface StatusFilterProps {
  value: StatusFilter;
  onChange: (status: StatusFilter) => void;
  className?: string;
}

export const StatusFilterSelect = ({ value, onChange, className = '' }: StatusFilterProps) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as StatusFilter)}
    className={`bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  >
    <option value="all">All Status</option>
    <option value="open">Open</option>
    <option value="closed">Closed</option>
  </select>
);

interface TypeFilterProps {
  value: TypeFilter;
  onChange: (type: TypeFilter) => void;
  className?: string;
}

export const TypeFilterSelect = ({ value, onChange, className = '' }: TypeFilterProps) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as TypeFilter)}
    className={`bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  >
    <option value="all">All Types</option>
    <option value="long">Long</option>
    <option value="short">Short</option>
  </select>
);