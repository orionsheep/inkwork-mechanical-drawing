import { useEffect } from 'react';
import { create } from 'zustand';
import { GROUPS, machineById } from '../machines';
import type { MachineDef } from '../machines/types';
import { selectMachine } from '../state';
import { useGuide } from './Guide';

const SEEN = 'gewu-catalogue-seen';

const firstVisit = () => {
  try {
    return !window.location.hash && !window.localStorage.getItem(SEEN);
  } catch {
    return false;
  }
};

export const useCatalogue = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: typeof window !== 'undefined' && firstVisit(),
  set: (open) => set({ open }),
}));

/** Parts in an assembly and everything it opens into; and how many levels deep it goes. */
function reach(machine: MachineDef): { parts: number; depth: number } {
  const children = Object.values(machine.children ?? {});
  const seen = new Set<string>();
  let parts = machine.parts.length;
  let depth = 1;
  for (const id of children) {
    if (seen.has(id)) continue;
    seen.add(id);
    const sub = reach(machineById(id));
    parts += sub.parts;
    depth = Math.max(depth, sub.depth + 1);
  }
  return { parts, depth };
}

/** Every machine on one sheet, grouped as in the switcher. */
export function Catalogue() {
  const { open, set } = useCatalogue();
  useEffect(() => {
    if (!open) return;
    try { window.localStorage.setItem(SEEN, '1'); } catch { /* private mode */ }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);
  if (!open) return null;
  return (
    <div className="catalogue" role="dialog" aria-label="目录" onClick={() => set(false)}>
      <div className="catalogue-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="catalogue-head">
          <div>
            <p className="catalogue-kicker">CATALOGUE · 目录</p>
            <h2>格物 · 机械结构图谱</h2>
          </div>
          <button type="button" className="catalogue-close" onClick={() => set(false)} aria-label="关闭">×</button>
        </header>
        {GROUPS.map((group) => (
          <section key={group.name} className="catalogue-group">
            <h3>{group.name}</h3>
            <div className="catalogue-grid">
              {group.machines.map((m) => {
                const { parts, depth } = reach(m);
                return (
                  <button key={m.id} type="button" className="catalogue-card" onClick={() => { selectMachine(m.id); set(false); }}>
                    {/* Line drawings made by scripts/make-thumbs.mjs. */}
                    <img className="card-thumb" src={`${import.meta.env.BASE_URL}thumbs/${m.id}.webp`} alt="" loading="lazy" decoding="async" />
                    <span className="card-no">{m.drawingNo}</span>
                    <span className="card-name">{m.name}</span>
                    <span className="card-en">{m.en}</span>
                    <span className="card-summary">{m.summary.replace(/^\d+\s*(?:个|种)[^·，,]*[·，,]\s*/, '')}</span>
                    <span className="card-meta">
                      {parts} 种零件{depth > 1 ? ` · ${depth} 级拆解` : ''}{m.Driver ? ' · 会动' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <p className="catalogue-foot">
          点卡片进入 · Esc 关闭 · 之后可以随时从右上角“目录”回到这里 ·{' '}
          <button type="button" className="catalogue-guide" onClick={() => { set(false); useGuide.getState().set(true); }}>第一次用？看使用说明</button>
        </p>
      </div>
    </div>
  );
}
