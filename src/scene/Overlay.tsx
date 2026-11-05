import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMachine } from '../machines';
import type { GuideDef, Vec3 } from '../machines/types';
import { motion, partVisible, useStudio, type ViewMode } from '../state';
import { OVERLAY_LAYER } from './InkRenderer';
import { tint } from './ink';
import { SECTION_PLANE, usePartDepth } from './Part';
import { boltSetDef, partDef, partOffset, stageProgress } from './explode';

/** Numbered balloon with a short curved leader, in the style of a drawing plate. */
export function Callout({ id, p }: { id: string; p: Vec3 }) {
  const part = partDef(id);
  const selected = useStudio((s) => s.selected === id);
  const hovered = useStudio((s) => s.hovered === id);
  const labels = useStudio((s) => s.labels);
  const drawingMode = useStudio((s) => s.view === 'drawing');
  const set = useStudio((s) => s.set);
  const nested = usePartDepth() > 1;
  const shown = useStudio((s) => !s.hidden.includes(id) && (!s.solo || s.solo === id));
  if (!part || nested || !shown || drawingMode || (!labels && !selected && !hovered)) return null;
  return (
    <Html position={p} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`callout${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`}>
        <svg className="callout-leader" width="44" height="30" viewBox="0 0 44 30" aria-hidden="true">
          <circle cx="3" cy="27" r="2.2" />
          <path d="M3 27 C 10 12, 22 5, 40 4" />
        </svg>
        <button
          type="button"
          className="callout-label"
          onClick={() => set({ selected: selected ? null : id })}
          onPointerEnter={() => set({ hovered: id })}
          onPointerLeave={() => set({ hovered: null })}
        >
          <span className="callout-num">{String(part.index).padStart(2, '0')}</span>
          <span className="callout-name">{part.name}</span>
        </button>
      </div>
    </Html>
  );
}

export function overlayLine(points: THREE.Vector3[], { dashed = true, opacity = 0.55, tone = 'rust' as 'rust' | 'ink', dash = 0.22, gap = 0.09 } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = tint(dashed
    ? new THREE.LineDashedMaterial({ dashSize: dash, gapSize: gap, transparent: true, opacity, depthTest: false })
    : new THREE.LineBasicMaterial({ transparent: true, opacity, depthTest: false }), tone);
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  line.layers.set(OVERLAY_LAYER);
  line.raycast = () => {};
  line.frustumCulled = false;
  return line;
}

const v3 = (p: Vec3) => new THREE.Vector3(...p);
const scratch = new THREE.Vector3();

/** Current displacement of a guide's point: its part's travel plus, for bolts, the bolt's own. */
function guideOffset(g: GuideDef, out: THREE.Vector3) {
  const bolts = boltSetDef(g.stage);
  if (bolts && g.axis) {
    partOffset(bolts.owner, out);
    return out.addScaledVector(v3(g.axis), bolts.distance * stageProgress(g.stage));
  }
  partOffset(g.stage, out);
  return out;
}

/** Centre lines and dashed assembly guides for the current machine. */
export function Guides() {
  const { scene } = useThree();
  const machine = useMachine();
  const objects = useMemo(() => {
    const centre = { opacity: 0.42, dash: 0.34, gap: 0.08 };
    const centreLines = machine.centreLines.map(([a, b]) => overlayLine([v3(a), v3(b)], centre));
    const explodeGeometry = new THREE.BufferGeometry();
    explodeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(machine.guides.length * 6), 3));
    const explodeLines = new THREE.LineSegments(
      explodeGeometry,
      tint(new THREE.LineDashedMaterial({ dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.5, depthTest: false }), 'ink'),
    );
    explodeLines.layers.set(OVERLAY_LAYER);
    explodeLines.frustumCulled = false;
    explodeLines.raycast = () => {};
    return { centreLines, explodeLines };
  }, [machine]);

  useEffect(() => {
    const { centreLines, explodeLines } = objects;
    scene.add(...centreLines, explodeLines);
    return () => {
      scene.remove(...centreLines, explodeLines);
      for (const line of [...centreLines, explodeLines]) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [scene, objects]);

  useFrame(() => {
    const { explodeLines } = objects;
    const attr = explodeLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    let any = false;
    const unit = machine.unit ?? 1;
    machine.guides.forEach((g, i) => {
      const d = guideOffset(g, scratch).multiplyScalar(unit);
      // No guide for a part that is out of sight.
      if (!partVisible(boltSetDef(g.stage)?.owner ?? g.stage)) d.set(0, 0, 0);
      if (d.lengthSq() > 1e-4) any = true;
      const [x, y, z] = g.origin;
      attr.setXYZ(i * 2, x, y, z);
      attr.setXYZ(i * 2 + 1, x + d.x, y + d.y, z + d.z);
    });
    attr.needsUpdate = true;
    explodeLines.computeLineDistances();
    explodeLines.visible = any;
  });

  return null;
}

/** Depth range of the assembled machine along the section normal (world z), measured once per machine. */
const cutRange = { machine: '', near: 1.1, far: -1.1 };
const cutBox = new THREE.Box3();

/**
 * Where the section plane sits for a cut depth: 0 skims the near (camera) side,
 * 0.5 is the centre line z = 0 every machine is modelled around, 1 leaves only
 * the far skin. The two halves are scaled separately so 0.5 stays on z = 0.
 */
export function sectionConstant(depth: number) {
  const { near, far } = cutRange;
  const span = Math.max(near - far, 1e-3);
  const n = Math.max(near, span * 0.02);
  const f = Math.min(far, -span * 0.02);
  // Never quite reach either skin, so a sliver of the part always remains to read.
  const d = THREE.MathUtils.clamp(depth, 0.02, 0.98);
  // Squared, so the slider is fine near the centre line, where the insides are,
  // and coarse out at the skins (a 747's wings would otherwise eat most of it).
  return d <= 0.5 ? n * (1 - d * 2) ** 2 : f * ((d - 0.5) * 2) ** 2;
}

/** Eases the explode, local explode and section sweep toward the store. */
export function MotionDriver() {
  const scene = useThree((s) => s.scene);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { explode, section, sectionDepth, localExplode, deep, machineId } = useStudio.getState();
    motion.deep += Math.sign((deep ? 1 : 0) - motion.deep) * Math.min(Math.abs((deep ? 1 : 0) - motion.deep), dt * 0.2);
    // Constant-rate easing keeps the staged teardown evenly paced.
    const diff = explode - motion.explode;
    motion.explode += Math.sign(diff) * Math.min(Math.abs(diff), dt * motion.explodeRate);

    // Local explode: fold the previous part away before opening the next one.
    if (motion.localPart !== localExplode) {
      motion.local = Math.max(0, motion.local - dt * 1.4);
      if (motion.local === 0) motion.localPart = localExplode;
    } else if (localExplode) {
      motion.local = Math.min(1, motion.local + dt * 0.55);
    }

    // Measure the machine once it has assembled itself.
    if (cutRange.machine !== machineId && motion.explode < 0.01 && motion.local === 0) {
      const root = scene.getObjectByName('machine-root');
      if (root) {
        cutBox.setFromObject(root);
        if (!cutBox.isEmpty()) {
          cutRange.machine = machineId;
          cutRange.near = cutBox.max.z;
          cutRange.far = cutBox.min.z;
        }
      }
    }

    // Off is just beyond the near skin; past it the plane is parked far away.
    const off = Math.max(cutRange.near, 0) + 0.1;
    const cutTarget = section ? sectionConstant(sectionDepth) : off;
    const current = SECTION_PLANE.constant > 50 ? off : SECTION_PLANE.constant;
    const next = current + (cutTarget - current) * (1 - Math.exp(-dt * 3));
    SECTION_PLANE.constant = !section && next > off - 0.02 ? 100 : next;
  }, -1);
  return null;
}

/**
 * Smoothly moves the camera to the active view preset and shifts the
 * projection centre so the machine sits beside, not under, the text column.
 */
export function CameraRig({ shift }: { shift: number }) {
  const { camera, controls, size } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    size: { width: number; height: number };
  };
  const machine = useMachine();
  const view = useStudio((s) => s.view);
  const nonce = useStudio((s) => s.viewNonce);
  const focus = useStudio((s) => s.focus);
  const tween = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; fromFov: number; to?: { pos: THREE.Vector3; target: THREE.Vector3 } } | null>(null);
  const aim = useStudio((s) => s.aim);
  const { scene } = useThree();
  /** Explode-driven framing already applied, so only the change is added each frame. */
  const applied = useRef({ shift: new THREE.Vector3(), scale: 1 });

  useEffect(() => {
    tween.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: controls ? controls.target.clone() : v3(machine.camera.target),
      fromFov: camera.fov,
    };
  }, [view, nonce, focus, machine, camera, controls]);

  // Swing onto one part: keep the viewing direction, frame its bounding box.
  useEffect(() => {
    if (!aim || !controls) return;
    const object = scene.getObjectByName(`part-${aim.id}`);
    if (!object) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const target = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.6, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = camera.position.clone().sub(controls.target).normalize();
    // Never closer than 40 % of the machine's own viewing distance, so the part keeps its context.
    const nearest = Math.max(3.2, v3(machine.camera.offset).length() * 0.4);
    const distance = Math.min(150, Math.max(nearest, radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15));
    tween.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromFov: camera.fov,
      to: { pos: target.clone().addScaledVector(dir, distance), target },
    };
  }, [aim, scene, camera, controls, machine]);

  useEffect(() => {
    if (shift) camera.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, shift, size.width, size.height]);

  useFrame((_, dt) => {
    // Pull back and look higher as the machine comes apart, keeping whatever
    // orbit and zoom the viewer has chosen.
    const ex = machine.camera.exploded;
    const deep = machine.camera.deep;
    if ((ex || deep) && controls && !tween.current) {
      const k = ex ? Math.min(1, motion.explode + motion.local * 0.5) : 0;
      const d = deep ? motion.deep : 0;
      const base = v3(machine.camera.target);
      const look = base.clone().lerp(ex ? v3(ex.target) : base, k).lerp(deep ? v3(deep.target) : base, d);
      const shift = look.sub(base);
      const scale = THREE.MathUtils.lerp(1 + ((ex?.scale ?? 1) - 1) * k, deep?.scale ?? 1, d);
      const delta = shift.clone().sub(applied.current.shift);
      controls.target.add(delta);
      camera.position.add(delta);
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(scale / applied.current.scale);
      camera.position.copy(controls.target).add(offset);
      applied.current = { shift, scale };
      controls.update();
    }
    const tw = tween.current;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / 1.1);
    const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
    const { target, offset, orthoDistance, foci } = machine.camera;
    const presets: Record<Exclude<ViewMode, 'drawing'>, { offset: THREE.Vector3; fov: number }> = {
      perspective: { offset: v3(offset), fov: 30 },
      elevation: { offset: new THREE.Vector3(0, orthoDistance * 0.004, orthoDistance), fov: 13 },
      plan: { offset: new THREE.Vector3(0, orthoDistance, 0.02), fov: 13 },
    };
    // Drawing mode renders its own orthographic cameras; the perspective one waits.
    if (view === 'drawing') return;
    const preset = presets[view];
    // Fit the machine to narrow (portrait) viewports.
    const visibleWidth = Math.max(0.5, (size.width - shift * 2) / size.height);
    const fit = Math.max(1, 0.95 / visibleWidth);
    const close = view === 'perspective' && focus ? foci?.[focus] : null;
    const toTarget = tw.to ? tw.to.target : v3(close ? close.target : target);
    const toPos = tw.to ? tw.to.pos : toTarget.clone().addScaledVector(preset.offset, fit * (close ? close.scale : 1));
    camera.position.lerpVectors(tw.fromPos, toPos, e);
    camera.fov = THREE.MathUtils.lerp(tw.fromFov, preset.fov, e);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.lerpVectors(tw.fromTarget, toTarget, e);
      controls.update();
    } else {
      camera.lookAt(toTarget);
    }
    if (tw.t >= 1) {
      tween.current = null;
      // The preset framing is the un-exploded one; re-apply the explode framing from scratch.
      // (Aiming at a part already accounts for where the parts are.)
      if (!tw.to) applied.current = { shift: new THREE.Vector3(), scale: 1 };
    }
  });
  return null;
}
