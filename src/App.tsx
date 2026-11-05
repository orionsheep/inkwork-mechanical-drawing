import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Catalogue } from './components/Catalogue';
import { Guide } from './components/Guide';
import { Tree } from './components/Tree';
import { PartsLegend, PlateMeta, TitleColumn } from './components/Plate';
import { currentMachine, hasMachine, useMachine } from './machines';
import { CameraRig, Guides, InkRenderer, MotionDriver } from './scene';
import { selectMachine, useStudio } from './state';
import './theme';
import { bridge, exportPlate, recordTeardown } from './export';
import { DrawingRig } from './drawing/DrawingRig';
import { DrawingSheet } from './drawing/Sheet';
import './styles/fonts.css';
import './styles/theme.css';

function download(name: string, href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}

function exportJson() {
  const m = currentMachine();
  const data = { id: m.id, name: m.name, en: m.en, drawingNo: m.drawingNo, scale: m.scale, parts: m.parts, steps: m.steps.map(({ apply: _apply, ...step }) => step) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  download(`gewu-${m.id}.json`, url);
  URL.revokeObjectURL(url);
}

/** Lets the exporters change the render resolution from outside the canvas. */
function ExportBridge() {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    bridge.setDpr = setDpr;
    bridge.getDpr = () => gl.getPixelRatio();
  }, [setDpr, gl]);
  return null;
}

/**
 * The address bar follows the assembly and the selected part (#model-t/engine/crank),
 * so a view can be shared; opening such a link goes straight there.
 */
function useDeepLink() {
  useEffect(() => {
    const open = () => {
      const parts = decodeURIComponent(window.location.hash.slice(1)).split('/');
      // Assembly ids themselves contain slashes: take the longest prefix that names one.
      for (let n = parts.length; n > 0; n -= 1) {
        const id = parts.slice(0, n).join('/');
        if (hasMachine(id)) {
          selectMachine(id);
          const part = parts[n];
          if (part && currentMachine().parts.some((p) => p.id === part)) useStudio.getState().set({ selected: part });
          return;
        }
      }
    };
    open();
    window.addEventListener('hashchange', open);
    const unsubscribe = useStudio.subscribe((s, prev) => {
      if (s.machineId === prev.machineId && s.selected === prev.selected) return;
      const hash = `#${s.machineId}${s.selected ? `/${s.selected}` : ''}`;
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    });
    return () => {
      window.removeEventListener('hashchange', open);
      unsubscribe();
    };
  }, []);
}

/** Opening an assembly puts it in its first study step (cut open, running, …). */
function useFirstStep() {
  const machine = useMachine();
  useEffect(() => {
    const first = machine.steps[0];
    if (!first) return;
    first.apply?.();
    const { selected, set } = useStudio.getState();
    set({ section: first.state.section, running: first.state.running, focus: first.state.focus, selected: selected ?? first.state.select });
  }, [machine]);
}

/** Horizontal offset (px) of the projection centre, so the machine clears the text column. */
function useStageShift() {
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const measure = () => setShift(window.innerWidth >= 1100 ? Math.min(60, window.innerWidth * 0.025) : 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return shift;
}

export default function App() {
  const shift = useStageShift();
  useDeepLink();
  useFirstStep();
  const clear = useStudio((s) => s.set);
  const machine = useMachine();
  const { Model, Driver, Backdrop } = machine;
  const drawingMode = useStudio((s) => s.view === 'drawing');
  const moveMode = useStudio((s) => s.moveMode);
  const [recording, setRecording] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const onExport = async (kind: 'plate' | 'video' | 'json') => {
    if (busy) return;
    if (kind === 'json') return exportJson();
    setBusy(true);
    try {
      if (kind === 'plate') await exportPlate();
      else await recordTeardown(setRecording);
    } finally {
      setBusy(false);
      setRecording(null);
    }
  };
  return (
    <div className={`studio${drawingMode ? ' is-drawing' : ''}`}>
      <div className="paper-drawings" aria-hidden="true">
        {Backdrop && <Backdrop />}
      </div>
      <div className="stage">
        <Canvas
          camera={{ position: [5.5, 6.45, 11.85], fov: 30, near: 0.5, far: 200 }}
          dpr={[1, 2]}
          gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true, toneMapping: THREE.NoToneMapping }}
          linear
          flat
          onPointerMissed={() => { if (useStudio.getState().view !== 'drawing') clear({ selected: null }); }}
        >
          <MotionDriver />
          {Driver && <Driver key={`driver-${machine.id}`} />}
          <group key={machine.id} name="machine-root" scale={machine.unit ?? 1}>
            <Model />
          </group>
          <Guides />
          <OrbitControls makeDefault enabled={!drawingMode} enablePan={false} minDistance={3} maxDistance={160} maxPolarAngle={Math.PI * 0.49} enableDamping dampingFactor={0.08} />
          <CameraRig shift={shift} />
          <InkRenderer />
          <ExportBridge />
          <DrawingRig />
        </Canvas>
        <DrawingSheet />
      </div>
      <TitleColumn />
      <PlateMeta onExport={onExport} busy={busy} recording={recording} />
      <PartsLegend />
      <Catalogue />
      <Guide />
      <Tree />
      <p className="stage-hint">{drawingMode ? '第一角画法 · 悬停或点选零件查看投影关系' : moveMode ? '按住零件拖动来挪动 · 拖空白处旋转 · 选中后可调大小' : '拖动旋转 · 滚轮缩放 · 点选零件'}</p>
    </div>
  );
}
