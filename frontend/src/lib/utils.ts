import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRiskBadgeClasses(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'HIGH':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'LOW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export function getStatusBadgeClasses(status: string): string {
  switch (status?.toUpperCase()) {
    case 'QUANTUM_VULNERABLE':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'TRANSITION_REQUIRED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'HYBRID_READY':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'POST_QUANTUM_READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'RESOLVED':
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'IN_PROGRESS':
    case 'RUNNING':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'OPEN':
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ACCEPTED_RISK':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
