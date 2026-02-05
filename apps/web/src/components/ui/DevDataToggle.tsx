import React from 'react';
import { canUseDevToggle, getDevDataSource, setDevDataSource } from '../../dev/devToggle';

export function DevDataSourceToggle({ user }: { user: any }) {
  if (!canUseDevToggle(user)) return null;

  const value = getDevDataSource();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">Data</span>
      <select
        value={value}
        onChange={(e) => {
          setDevDataSource(e.target.value as any);
          window.location.reload();
        }}
        className="rounded-full px-3 py-1 bg-[var(--bg-card)] border border-[var(--border)] text-xs font-[900]"
      >
        <option value="api">API</option>
        <option value="local">Local</option>
      </select>
    </div>
  );
}
