import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { allMachines, GROUPS, lineage, MACHINES, machineById, useMachine } from '../machines';
import type { MachineDef } from '../machines/types';
import { useCatalogue } from './Catalogue';
import { useGuide } from './Guide';
import { useTree } from './Tree';
import { aimAt, clearEdits, editOf, partEdits, restoreAll, selectMachine, useStudio, type ViewMode } from '../state';
import { useTheme } from '../theme';

const pad = (n: number) => String(n).padStart(2, '0');

export function TitleColumn() {
  const machine = useMachine();
  const { step, explode, running, section, sectionDepth, labels, view, hiddenLines, projection, moveMode, deep, hidden, solo, set } = useStudio();
  const drawingMode = view === 'drawing';
  const { Controls, Toggles } = machine;
  const chain = lineage(machine);
  const root = chain[0];

  const goStep = (index: number) => {
    const { state, apply } = machine.steps[index];
    const { viewNonce } = useStudio.getState();
    apply?.();
    set({
      localExplode: null, step: index, explode: state.explode, section: state.section, running: state.running,
      selected: state.select, focus: state.focus, view: drawingMode ? 'drawing' : 'perspective', viewNonce: viewNonce + 1,
    });
  };

  return (
    <section className="title-column">
      <header className="masthead">
        <h1 className="mast-title">格物</h1>
        <div className="mast-rule" />
        <p className="mast-en">INKWORK</p>
        <p className="mast-zh">工程制图 · 交互拆解</p>
        <div className="fig-rule"><span>FIG. {pad(MACHINES.indexOf(root) + 1)}{chain.length > 1 ? `-${chain.length - 1}` : ''}</span><i /></div>
        <div className="mast-buttons">
          <button type="button" className="mast-catalogue" onClick={() => useGuide.getState().set(true)}>说明</button>
          <button type="button" className="mast-catalogue" onClick={() => useCatalogue.getState().set(true)}>目录</button>
          <button type="button" className="mast-catalogue" onClick={() => useTree.getState().set(!useTree.getState().open)}>结构树</button>
        </div>
      </header>

      <PartSearch />

      <MachineSwitcher rootId={root.id} />
      <MachineStrip rootId={root.id} />

      <div className="subject">
        {chain.length > 1 && (
          <nav className="crumbs" aria-label="所在组件">
            {chain.slice(0, -1).map((m) => (
              <button key={m.id} type="button" onClick={() => selectMachine(m.id)}>{m.name}</button>
            ))}
            <span>{machine.name}</span>
          </nav>
        )}
        <h2>{machine.name}</h2>
        <p>{machine.en} · {machine.subtitle}</p>
      </div>

      <ol className="steps">
        {machine.steps.map((item, index) => (
          <li key={item.title} className={index === step ? 'is-active' : ''}>
            <button type="button" onClick={() => goStep(index)}>
              <span className="step-num">{pad(index + 1)}</span>
              <span className="step-title">{item.title}</span>
              <span className="step-en">{item.en}</span>
            </button>
            {index === step && <p className="step-body">{item.body}</p>}
          </li>
        ))}
      </ol>

      <div className="controls">
        <label className="slider">
          <span>拆解</span>
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => set({ explode: Number(e.target.value) })} />
          <output>{Math.round(explode * 100)}%</output>
        </label>
        {section && (
          <label className="slider" title="拖动剖切面：0% 刚切到表皮，50% 沿中线，100% 只留最后一层">
            <span>剖切</span>
            <input type="range" min={0} max={1} step={0.01} value={sectionDepth} onChange={(e) => set({ sectionDepth: Number(e.target.value) })} />
            <output>{Math.round(sectionDepth * 100)}%</output>
          </label>
        )}
        <Stepper machine={machine} explode={explode} />
        {Controls && <Controls />}
        <div className="toggles">
          <button type="button" className={running ? 'is-on' : ''} onClick={() => set({ running: !running })}>{running ? '暂停' : '运转'}</button>
          {Toggles && <Toggles />}
          <button type="button" className={section ? 'is-on' : ''} onClick={() => set({ section: !section })}>剖视</button>
          {drawingMode ? (
            <>
              <button type="button" className={hiddenLines ? 'is-on' : ''} onClick={() => set({ hiddenLines: !hiddenLines })} title="不可见轮廓线（细虚线）">虚线</button>
              <button type="button" className={projection ? 'is-on' : ''} onClick={() => set({ projection: !projection })} title="长对正 · 高平齐 · 宽相等">投影</button>
            </>
          ) : (
            <>
              <button type="button" className={labels ? 'is-on' : ''} onClick={() => set({ labels: !labels })}>标注</button>
              <button type="button" className={moveMode ? 'is-on' : ''} onClick={() => set({ moveMode: !moveMode })} title="拖动零件挪到别处（视角暂停转动）">挪动</button>
              {(hidden.length > 0 || solo) && (
                <button type="button" className="is-on" onClick={() => set({ hidden: [], solo: null })} title="把隐藏的零件都显示出来">
                  显示全部{hidden.length > 0 ? ` (${hidden.length})` : ''}
                </button>
              )}
              {machine.children && (
                <button
                  type="button"
                  className={deep ? 'is-on' : ''}
                  onClick={() => set(deep ? { deep: false } : { deep: true, explode: 1, localExplode: null })}
                  title="整个拆开，并把每个子组件拉到旁边再拆开"
                >
                  全部展开
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const VIEWS: Array<[ViewMode, string]> = [['perspective', '透视'], ['drawing', '三视图'], ['elevation', '主视'], ['plan', '俯视']];

type ExportKind = 'plate' | 'video' | 'json';

const EXPORTS: Array<[ExportKind, string, string]> = [
  ['plate', '图版 PNG', 'A4 横版爆炸图：编号、明细表、标题栏'],
  ['video', '拆装动画', '整机 → 拆开 → 合拢，WebM 视频'],
  ['json', '零件数据', '零件表与讲解步骤，JSON'],
];

/** Opens the structure tree beside the plate. */
function TreeToggle() {
  const { open, set } = useTree();
  return <button type="button" className={`meta-action meta-tree${open ? ' is-on' : ''}`} aria-pressed={open} onClick={() => set(!open)} title="结构树：所有层级的组件与零件">结构树</button>;
}

export function PlateMeta({ onExport, busy, recording }: { onExport: (kind: ExportKind) => void; busy: boolean; recording: number | null }) {
  const { view, viewNonce, set } = useStudio();
  const machine = useMachine();
  return (
    <nav className="plate-meta" aria-label="视图">
      <button type="button" className="meta-catalogue" onClick={() => useCatalogue.getState().set(true)} title="全部机器一览">目录</button>
      <button type="button" className="meta-action meta-guide" onClick={() => useGuide.getState().set(true)} title="怎么使用">说明</button>
      <TreeToggle />
      <div className="views" role="group" aria-label="视图">
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} className={view === id ? 'is-on' : ''} onClick={() => set({ view: id, focus: null, viewNonce: viewNonce + 1 })}>{label}</button>
        ))}
      </div>
      <button type="button" className="meta-action" onClick={() => restoreAll(machine.steps[0])} title="合拢所有零件，撤销挪动、缩放和隐藏，关掉剖视，回到第一步和默认视角">
        复位
      </button>
      <ThemeToggle />
      <ExportMenu onExport={onExport} busy={busy} recording={recording} />
    </nav>
  );
}

/** Paper or blueprint. */
function ThemeToggle() {
  const { theme, set } = useTheme();
  const blueprint = theme === 'blueprint';
  return (
    <button type="button" className={`meta-action meta-theme${blueprint ? ' is-on' : ''}`} aria-pressed={blueprint} onClick={() => set(blueprint ? 'paper' : 'blueprint')} title={blueprint ? '换回纸面线稿' : '换成蓝图：深蓝底、白色线条'}>
      <span className="theme-swatch" aria-hidden="true" />蓝图
    </button>
  );
}

/** Plate, animation and data exports behind one button. */
function ExportMenu({ onExport, busy, recording }: { onExport: (kind: ExportKind) => void; busy: boolean; recording: number | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('.export')) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="export">
      <button
        type="button"
        className={`meta-action${recording !== null ? ' is-recording' : ''}`}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {recording !== null ? `录制中 ${recording.toFixed(0)}s` : '导出'} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="export-menu" role="menu">
          {EXPORTS.map(([kind, label, hint]) => (
            <li key={kind} role="none">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onExport(kind); }}>
                <span className="export-label">{label}</span>
                <span className="export-hint">{hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Group tabs, and the machines of the open group. */
function MachineSwitcher({ rootId }: { rootId: string }) {
  const home = GROUPS.findIndex((g) => g.machines.some((m) => m.id === rootId));
  const [open, setOpen] = useState(home);
  useEffect(() => setOpen(home), [home]);
  const group = GROUPS[open] ?? GROUPS[0];
  return (
    <nav className="machines" aria-label="选择机器">
      <div className="machines-tabs" role="tablist">
        {GROUPS.map((g, i) => (
          <button key={g.name} type="button" role="tab" aria-selected={i === open} className={i === open ? 'is-open' : ''} onClick={() => setOpen(i)}>
            {g.name}<span className="machines-count">{g.machines.length}</span>
          </button>
        ))}
        <button type="button" className="machines-all" onClick={() => useCatalogue.getState().set(true)} title="全部机器一览">全部 ↗</button>
      </div>
      <div className="machines-list" role="tabpanel">
        {group.machines.map((m) => (
          <button key={m.id} type="button" className={m.id === rootId ? 'is-on' : ''} onClick={() => selectMachine(m.id)} title={m.summary}>
            {m.name}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Narrow screens: every machine in one row that scrolls sideways, the open one kept in view. */
function MachineStrip({ rootId }: { rootId: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = ref.current;
    const on = strip?.querySelector<HTMLElement>('.is-on');
    if (strip && on) strip.scrollTo({ left: on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
  }, [rootId]);
  return (
    <nav className="machine-strip" aria-label="选择机器" ref={ref}>
      {GROUPS.map((g) => (
        <Fragment key={g.name}>
          <span className="strip-group">{g.name}</span>
          {g.machines.map((m) => (
            <button key={m.id} type="button" className={m.id === rootId ? 'is-on' : ''} onClick={() => selectMachine(m.id)}>{m.name}</button>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}

/** Find a part anywhere, in any machine or subassembly, and go straight to it. */
function PartSearch() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const found: Array<{ machine: MachineDef; part: MachineDef['parts'][number] }> = [];
    for (const machine of allMachines()) {
      for (const part of machine.parts) {
        if (part.name.toLowerCase().includes(q) || part.en.toLowerCase().includes(q) || machine.name.includes(q)) found.push({ machine, part });
      }
    }
    return found.slice(0, 8);
  }, [query]);
  useEffect(() => setActive(0), [query]);

  // Global keys: "/" to search, Esc to let go of the selection, F to aim at it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).tagName === 'INPUT';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        document.getElementById('part-search')?.focus();
      } else if (e.key === 'Escape' && !typing) {
        useStudio.getState().set({ selected: null });
      } else if ((e.key === 'f' || e.key === 'F') && !typing) {
        const { selected } = useStudio.getState();
        if (selected) aimAt(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (hit: (typeof results)[number]) => {
    const switching = useStudio.getState().machineId !== hit.machine.id;
    selectMachine(hit.machine.id);
    useStudio.getState().set({ selected: hit.part.id });
    // Let a newly opened assembly put itself together before swinging the camera in.
    window.setTimeout(() => aimAt(hit.part.id), switching ? 2200 : 0);
    setQuery('');
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="search">
      <input
        id="part-search"
        type="search"
        placeholder="搜索零件，如 活塞环、喷注器…（按 / ）"
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === 'Enter' && results[active]) go(results[active]);
          if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
        }}
      />
      {results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((hit, i) => (
            <li key={`${hit.machine.id}:${hit.part.id}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(hit)}>
                <span className="search-name">{hit.part.name}</span>
                <span className="search-path">{lineage(hit.machine).map((m) => m.name).join(' › ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The teardown as discrete steps: each step ends where some part (or set of screws) is off. */
function teardownStops(machine: MachineDef) {
  const stops = new Map<number, { at: number; ids: string[]; labels: string[] }>();
  const add = (end: number, label: string, id?: string) => {
    const key = Math.round(end * 1000);
    const stop = stops.get(key) ?? { at: end, ids: [], labels: [] };
    stop.labels.push(label);
    if (id) stop.ids.push(id);
    stops.set(key, stop);
  };
  for (const [id, set] of Object.entries(machine.boltSets)) {
    if (set.stage[1] > set.stage[0]) add(set.stage[1], `${machine.parts.find((p) => p.id === set.owner)?.name ?? ''}的螺钉`);
  }
  for (const p of machine.parts) if (p.stage[1] > p.stage[0]) add(p.stage[1], p.name, p.id);
  return [...stops.values()].sort((a, b) => a.at - b.at);
}

/** Step through the teardown one part at a time. */
function Stepper({ machine, explode }: { machine: MachineDef; explode: number }) {
  const set = useStudio((s) => s.set);
  const stops = useMemo(() => teardownStops(machine), [machine]);
  if (stops.length === 0) return null;
  const done = stops.filter((s) => s.at <= explode + 1e-4).length;
  const go = (n: number) => {
    const target = n <= 0 ? 0 : stops[Math.min(n, stops.length) - 1].at;
    const next = stops[n - 1];
    set({ explode: target, localExplode: null, deep: false, selected: next?.ids[0] ?? null });
  };
  const current = done > 0 ? stops[done - 1] : null;
  return (
    <div className="stepper" title="也可以用键盘 ← →">
      <StepKeys onPrev={() => done > 0 && go(done - 1)} onNext={() => done < stops.length && go(done + 1)} />
      <button type="button" disabled={done === 0} onClick={() => go(done - 1)} aria-label="上一步">‹</button>
      <p>
        <span className="stepper-count">{pad(done)} / {pad(stops.length)}</span>
        {current ? `拆下 ${current.labels.join('、')}` : '完整装配 · 按 › 逐步拆开'}
      </p>
      <button type="button" disabled={done === stops.length} onClick={() => go(done + 1)} aria-label="下一步">›</button>
    </div>
  );
}

/** Left and right arrow keys step through the teardown (when not typing). */
function StepKeys({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);
  return null;
}

/** Size slider for the selected part, plus a button to undo its moves and resizing. */
function PartSize({ id }: { id: string }) {
  const nonce = useStudio((s) => s.editNonce);
  const [scale, setScale] = useState(() => partEdits.get(id)?.scale ?? 1);
  useEffect(() => setScale(partEdits.get(id)?.scale ?? 1), [id, nonce]);
  return (
    <div className="part-size">
      <label className="slider">
        <span>大小</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={scale}
          onChange={(e) => {
            const value = Number(e.target.value);
            editOf(id).scale = value;
            setScale(value);
          }}
        />
        <output>{scale.toFixed(2)}×</output>
      </label>
      <button type="button" className="caption-action" onClick={() => clearEdits(id)}>还原</button>
    </div>
  );
}

export function PartsLegend() {
  const machine = useMachine();
  const { selected, hovered, localExplode, view, hidden, solo, set } = useStudio();
  const focus = selected ?? hovered;
  const part = focus ? machine.parts.find((p) => p.id === focus) : undefined;
  const child = part && machine.children?.[part.id];
  // A local explode follows the selection, and folds away when nothing is selected.
  useEffect(() => {
    const { localExplode: current } = useStudio.getState();
    if (current && current !== selected) set({ localExplode: selected });
  }, [selected, set]);
  return (
    <aside className="legend">
      {part && (
        <div className="caption">
          <div className="caption-head">
            <span className="caption-num">{pad(part.index)}</span>
            <div>
              <h3>{part.name}</h3>
              <p className="caption-en">{part.en} · {part.role}</p>
            </div>
            {selected && <button type="button" className="caption-close" onClick={() => set({ selected: null })} aria-label="取消选择">×</button>}
          </div>
          <p className="caption-body">{part.description}</p>
          {selected && view !== 'drawing' && <PartSize id={selected} />}
          {selected && view !== 'drawing' && (
            <div className="caption-tools">
              <button type="button" className="caption-action" onClick={() => set({ hidden: [...hidden, selected], selected: null, solo: solo === selected ? null : solo })}>隐藏</button>
              <button type="button" className="caption-action" onClick={() => set({ solo: solo === selected ? null : selected })}>{solo === selected ? '显示全部' : '只看它'}</button>
              <button type="button" className="caption-action" onClick={() => aimAt(selected)} title="镜头对准这个零件（键盘 F）">对准</button>
            </div>
          )}
          {child && (
            <button type="button" className="caption-open" onClick={() => selectMachine(child)}>
              拆开此组件：{machineById(child).summary} <span aria-hidden="true">↘</span>
            </button>
          )}
          <div className="caption-foot">
            <p className="caption-mat">{part.material}</p>
            {selected && (
              <button type="button" className="caption-action" onClick={() => set({ localExplode: localExplode === selected ? null : selected, explode: 0 })}>
                {localExplode === selected ? '收拢' : '局部展开'} <span aria-hidden="true">{localExplode === selected ? '↙' : '↗'}</span>
              </button>
            )}
          </div>
        </div>
      )}
      <table className={`parts${machine.parts.length > 15 ? ' is-long' : ''}`}>
        <caption>零件明细 · PARTS</caption>
        <tbody>
          {machine.parts.map((item) => (
            <tr
              key={item.id}
              className={`${selected === item.id ? 'is-selected' : ''}${hovered === item.id ? ' is-hovered' : ''}${hidden.includes(item.id) || (solo && solo !== item.id) ? ' is-hidden' : ''}`}
              onClick={() => hidden.includes(item.id)
                ? set({ hidden: hidden.filter((h) => h !== item.id), selected: item.id })
                : set({ selected: selected === item.id ? null : item.id })}
              onPointerEnter={() => set({ hovered: item.id })}
              onPointerLeave={() => set({ hovered: null })}
            >
              <td className="num">{pad(item.index)}</td>
              <td>{item.name}{machine.children?.[item.id] && <span className="has-child" title="可继续拆开"> ▸</span>}</td>
              <td className="en">{item.en}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="title-block">
        <span>图号 {machine.drawingNo}</span>
        <span>比例 {machine.scale}</span>
        <span>第 1 张 共 1 张</span>
      </div>
    </aside>
  );
}
