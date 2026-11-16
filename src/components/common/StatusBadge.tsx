import React from 'react';
import { PickupStatus } from '../../types/index.ts';

interface StatusBadgeProps {
  status: PickupStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStyles = (st: string) => {
    switch (st) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'In Progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Collector On The Way':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Assigned':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Approved':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Pending Approval':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Submitted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Missed':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Cancelled':
      case 'Rejected':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${getStyles(
        status
      )} ${sizeClasses[size]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};
