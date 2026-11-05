import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { lineage, machineById, useMachine } from '../machines';
import type { MachineDef } from '../machines/types';
import { selectMachine, useStudio } from '../state';

/**
 * 结构树: the whole assembly tree of the current machine in a side drawer —
 * every subassembly, recursively, down to the plain parts, with how deep
 * each branch goes. Click an assembly to open it, a part to open its
 * assembly with the part selected. The branch you are in starts expanded.
 */

export const useTree = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

interface Stats { depth: number; assemblies: number; instances: number }

/** How deep an assembly goes, how many distinct assemblies it contains, and how many part instances in all (repeats counted). */
function stats(m: MachineDef, memo = new Map<string, Stats>()): Stats {
  const hit = memo.get(m.id);
  if (hit) return hit;
  let depth = 1;
  let instances = 0;
  const distinct = new Set<string>();
  for (const p of m.parts) {
    const child = m.children?.[p.id];
    if (!child) { instances += 1; continue; }
    const s = stats(machineById(child), memo);
    depth = Math.max(depth, s.depth + 1);
    instances += s.instances;
    distinct.add(child);
  }
  const assemblies = 1 + [...distinct].reduce((n, id) => n + stats(machineById(id), memo).assemblies, 0);
  const out = { depth, assemblies, instances };
  memo.set(m.id, out);
  return out;
}

/** The longest chain of assemblies from m down. */
function deepest(m: MachineDef): MachineDef[] {
  let best: MachineDef[] = [];
  for (const id of new Set(Object.values(m.children ?? {}))) {
    const chain = deepest(machineById(id));
    if (chain.length > best.length) best = chain;
  }
  return [m, ...best];
}

function openPart(machineId: string, partId: string | null) {
  const switching = useStudio.getState().machineId !== machineId;
  selectMachine(machineId);
  if (partId) window.setTimeout(() => useStudio.getState().set({ selected: partId }), switching ? 60 : 0);
}

function Node({ m, level, label, path, onPath, memo }: { m: MachineDef; level: number; label?: string; path: string; onPath: Set<string>; memo: Map<string, Stats> }) {
  const current = useStudio((s) => s.machineId);
  const selected = useStudio((s) => s.selected);
  const [open, setOpen] = useState(() => onPath.has(m.id) || level === 0);
  const s = stats(m, memo);
  const here = current === m.id;
  return (
    <li className={`tree-node${here ? ' is-here' : ''}`}>
      <div className="tree-row">
        <button type="button" className="tree-twist" aria-label={open ? '收起' : '展开'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        <button type="button" className="tree-name" onClick={() => openPart(m.id, null)} title={m.summary}>
          <span className="tree-level">L{level + 1}</span>
          <b>{label ?? m.name}</b>
          {label && label !== m.name && <i> · {m.name}</i>}
        </button>
        <span className="tree-meta">{m.parts.length} 件{s.depth > 1 ? ` · 下 ${s.depth - 1} 级` : ''}</span>
      </div>
      {open && (
        <ul className="tree-list">
          {m.parts.map((p) => {
            const child = m.children?.[p.id];
            if (child) return <Node key={p.id} m={machineById(child)} level={level + 1} label={p.name} path={`${path}/${p.id}`} onPath={onPath} memo={memo} />;
            return (
              <li key={p.id} className={`tree-leaf${here && selected === p.id ? ' is-selected' : ''}`}>
                <button type="button" onClick={() => openPart(m.id, p.id)}>
                  <span className="tree-no">{String(p.index).padStart(2, '0')}</span>
                  {p.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function Tree() {
  const { open, set } = useTree();
  const machine = useMachine();
  const chain = lineage(machine);
  const root = chain[0];
  const memo = useMemo(() => new Map<string, Stats>(), []);
  const onPath = useMemo(() => new Set(chain.map((m) => m.id)), [chain.map((m) => m.id).join('|')]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);
  if (!open) return null;
  const s = stats(root, memo);
  const longest = deepest(root);
  return (
    <aside className="tree-drawer" role="dialog" aria-label="结构树">
      <header className="tree-head">
        <div>
          <p className="tree-kicker">STRUCTURE · 结构树</p>
          <h2>{root.name}</h2>
        </div>
        <button type="button" className="tree-close" onClick={() => set(false)} aria-label="关闭">×</button>
      </header>
      <div className="tree-stats">
        <span><b>{s.depth}</b> 级</span>
        <span><b>{s.assemblies}</b> 种组件</span>
        <span><b>{s.instances}</b> 个零件（含重复）</span>
      </div>
      {s.depth > 1 && <p className="tree-deepest">最深一支：{longest.map((m) => m.name).join(' › ')}</p>}
      <ul className="tree-list tree-root" key={root.id}>
        <Node m={root} level={0} path={root.id} onPath={onPath} memo={memo} />
      </ul>
      <p className="tree-foot">点组件名打开那一级 · 点零件直接选中 · ▸ 展开 · Esc 关闭</p>
    </aside>
  );
}
