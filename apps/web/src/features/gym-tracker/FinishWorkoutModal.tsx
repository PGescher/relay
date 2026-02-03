import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, Trash2, Save } from 'lucide-react';
import type { WorkoutSession, WorkoutTemplate } from '@relay/shared';

type IncompleteAction = 'delete' | 'markComplete';

export function FinishWorkoutModal(props: {
  open: boolean;
  onClose: () => void;

  workout: WorkoutSession;

  // templates
  templateIdUsed?: string | null;
  onSaveTemplate: (name: string) => Promise<string | null>;
  onUpdateTemplate: (templateId: string) => Promise<void>;

  onConfirmFinish: (opts: {
    incompleteAction: IncompleteAction;
    rpeOverall?: number;
    saveAsTemplate: boolean;
    templateName?: string;
    updateUsedTemplate: boolean;
  }) => Promise<void>;
}) {
  const { open, onClose, workout } = props;

  const incompleteCount = useMemo(() => {
    let c = 0;
    for (const log of workout.logs) {
      for (const s of log.sets) if (!s.isCompleted) c++;
    }
    return c;
  }, [workout]);

  const [incompleteAction, setIncompleteAction] = useState<IncompleteAction>('delete');
  const [rpe, setRpe] = useState<number | undefined>(undefined);

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [updateUsedTemplate, setUpdateUsedTemplate] = useState(false);

  const canUpdateTemplate = !!props.templateIdUsed;

  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
      <div className="w-full max-w-xl rounded-[40px] border border-white/10 bg-[var(--bg)] text-[var(--text)] shadow-[0_30px_90px_rgba(0,0,0,0.55)] overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
                Finish workout
              </p>
              <h3 className="mt-2 text-2xl font-[900] italic uppercase tracking-tight">
                Review & Save
              </h3>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--glass-strong)] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Incomplete */}
          {incompleteCount > 0 && (
            <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
                Incomplete sets
              </p>
              <p className="mt-2 font-[900] uppercase tracking-widest text-sm">
                {incompleteCount} incomplete set{incompleteCount === 1 ? '' : 's'}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIncompleteAction('delete')}
                  className={[
                    "rounded-3xl p-4 border font-[900] uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2",
                    incompleteAction === 'delete'
                      ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--glass-strong)]",
                  ].join(' ')}
                >
                  <Trash2 size={14} />
                  Delete them
                </button>

                <button
                  type="button"
                  onClick={() => setIncompleteAction('markComplete')}
                  className={[
                    "rounded-3xl p-4 border font-[900] uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2",
                    incompleteAction === 'markComplete'
                      ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--glass-strong)]",
                  ].join(' ')}
                >
                  <CheckCircle2 size={14} />
                  Mark complete
                </button>
              </div>

              <p className="mt-3 text-[10px] font-[900] uppercase tracking-[0.35em] text-[var(--text-muted)]">
                Mark complete will use ghost values if fields are empty.
              </p>
            </div>
          )}

          {/* RPE */}
          <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
              Felt intensity (RPE)
            </p>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                value={rpe ?? 7}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full"
              />
              <div className="w-12 text-right font-[900] italic text-[var(--primary)]">
                {rpe ?? '—'}
              </div>
            </div>

            <p className="mt-3 text-[10px] font-[900] uppercase tracking-[0.35em] text-[var(--text-muted)]">
              6 easy · 7 manageable · 8 hard · 9 very hard · 10 max
            </p>
          </div>

          {/* Template */}
          <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
                Templates
              </p>

              <label className="inline-flex items-center gap-2 text-[10px] font-[900] uppercase tracking-widest text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                Save as template
              </label>
            </div>

            {saveAsTemplate && (
              <div className="mt-4">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Upper A)"
                  className="w-full rounded-2xl px-4 py-4 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                />

                {canUpdateTemplate && (
                  <label className="mt-4 inline-flex items-center gap-2 text-[10px] font-[900] uppercase tracking-widest text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={updateUsedTemplate}
                      onChange={(e) => setUpdateUsedTemplate(e.target.checked)}
                    />
                    Update used template with changes
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-3xl p-4 border border-[var(--border)] bg-[var(--bg-card)] font-[900] uppercase tracking-widest text-[10px] text-[var(--text-muted)] hover:bg-[var(--glass-strong)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await props.onConfirmFinish({
                    incompleteAction,
                    rpeOverall: rpe,
                    saveAsTemplate,
                    templateName: templateName.trim() || undefined,
                    updateUsedTemplate,
                  });
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-3xl p-4 border border-white/10 bg-[var(--primary)] text-white font-[900] uppercase tracking-widest text-[10px] hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={14} />
              Finish & Save
            </button>
          </div>
        </div>

        <div className="h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}
