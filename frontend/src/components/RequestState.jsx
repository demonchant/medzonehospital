export function LoadingState({ children }) {
  return <p className="text-slate-600 font-medium" role="status" aria-live="polite">{children}</p>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium space-y-4" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-[#00AEEF] font-black uppercase tracking-widest text-xs hover:text-[#0054A6] transition-colors">
          Try Again
        </button>
      )}
    </div>
  );
}
