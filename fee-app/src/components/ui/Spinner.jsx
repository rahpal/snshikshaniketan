import { Loader2 } from 'lucide-react';

export default function Spinner({ label, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}
