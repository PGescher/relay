import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import type { Exercise } from '@relay/shared';

type Mode = 'single' | 'multi';

type Props = {
  open: boolean;
  title?: string;

  exercises: Exercise[];

  mode: Mode;

  /**
   * SINGLE:
   * - user clicks an item => onPick(id) fired immediately
   */
  onPick?: (exerciseId: string) => void;

  /**
   * MULTI:
   * - user toggles multiple items
   * - presses "Add selected" => onConfirm(ids)
   */
  onConfirm?: (exerciseIds: string[]) => void;

  onClose: () => void;

  /** optional: show muscle group label etc */
  showMeta?: boolean;
};

export function ExerciseLibraryModal({
  open,
  title = 'LIBRARY',
  exercises,
  mode,
  onPick,
  onConfirm,
  onClose,
  showMeta = true,
}: Props) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  // ✅ IMPORTANT: reset every time modal opens
  useEffect(() => {
    if (open) {
      setQ('');
      setSelected([]);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return exercises;

    return exercises.filter((e) => {
      const name = e.name?.toLowerCase() ?? '';
      const mg = (e.muscleGroup ?? '').toLowerCase();
      return name.includes(query) || mg.includes(query);
    });
  }, [q, exercises]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex flex-col justify-end p-4">
      <div className="bg-[var(--bg)] text-[var(--text)] rounded-[40px] p-6 max-h-[85vh] overflow-hidden w-full max-w-md mx-auto border border-[var(--border)] animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-black italic">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-full"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exercise..."
              className="w-full bg-transparent outline-none text-sm placeholder:text-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: mode === 'multi' ? '55vh' : '65vh' }}>
          {filtered.map((ex) => {
            const isSelected = selected.includes(ex.id);

            return (
              <button
                key={`${ex.id}-${ex.name}`}
                type="button"
                onClick={() => {
                  if (mode === 'single') {
                    onPick?.(ex.id); // ✅ immediate
                    onClose();       // ✅ close
                  } else {
                    toggle(ex.id);   // ✅ multi toggle
                  }
                }}
                className={[
                  "w-full p-5 border rounded-2xl flex justify-between items-center transition-colors",
                  isSelected
                    ? "bg-[var(--primary-soft)] border-[var(--primary)]"
                    : "bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--glass-strong)]",
                ].join(' ')}
              >
                <div className="text-left min-w-0">
                  <p className="font-black truncate">{ex.name}</p>
                  {showMeta && (
                    <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest">
                      {ex.muscleGroup}
                    </p>
                  )}
                </div>

                {mode === 'multi' ? (
                  <div
                    className={[
                      "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-[var(--primary)] border-white/10 text-white"
                        : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)]",
                    ].join(' ')}
                    aria-label="Selected"
                  >
                    <Check size={18} />
                  </div>
                ) : (
                  <div className="text-[var(--primary)] font-black text-xs uppercase tracking-widest">Add</div>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-[var(--text-muted)] font-bold">No matches.</div>
          )}
        </div>

        {/* Multi footer */}
        {mode === 'multi' && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] py-4 font-black text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                onConfirm?.(selected); // ✅ return IDs
                onClose();             // ✅ close
              }}
              className="rounded-2xl bg-[var(--primary)] text-white py-4 font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              Add selected ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
