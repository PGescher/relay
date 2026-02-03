import React from 'react';

const GymImportExport: React.FC = () => {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-[900] italic text-[var(--text)]">
        IMPORT / EXPORT<span className="text-[var(--primary)]">.</span>
      </h2>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <div className="text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">Coming soon</div>
        <p className="mt-3 text-[var(--text)] font-bold">
          Export your workouts as CSV, and import data from other apps.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <button disabled className="w-full rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-4 opacity-50">
            Export CSV (soon)
          </button>
          <button disabled className="w-full rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-4 opacity-50">
            Import CSV (soon)
          </button>
        </div>
      </div>
    </div>
  );
};

export default GymImportExport;
