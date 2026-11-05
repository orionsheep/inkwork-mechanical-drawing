import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { machineById } from '../machines';
import type { MachineDef } from '../machines/types';
import { editOf, partEdits, partVisible, useStudio } from '../state';
import { createInkMaterial } from './ink';
import { deepProgress, partDef, partOffset } from './explode';

/** World-space section plane; its constant is animated to sweep the cut in. */
export const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);

interface PartMaterials {
  solid: THREE.ShaderMaterial;
  clipped: THREE.ShaderMaterial;
}

const PartContext = createContext<PartMaterials | null>(null);
/** How deep in Parts we are: a subassembly drawn inside a part of its parent is depth 2 and below. */
const DepthContext = createContext(0);
/** The subassembly whose parts are being drawn here (for its own explode inside its parent). */
const AssemblyContext = createContext<MachineDef | null>(null);

export const usePartDepth = () => useContext(DepthContext);

const childAssembly = (assembly: MachineDef | undefined | null, id: string) => {
  const child = assembly?.children?.[id];
  return child ? machineById(child) : null;
};

/**
 * One part of the current assembly. Inside another part (a subassembly drawn
 * whole within its parent) it is just geometry in its parent's ink, which
 * comes apart only when the whole tree is exploded.
 */
export function Part({ id, tone = 1, children }: { id: string; tone?: number; children: ReactNode }) {
  const depth = useContext(DepthContext);
  const assembly = useContext(AssemblyContext);
  if (depth > 0) return <NestedPart id={id} depth={depth} assembly={assembly}>{children}</NestedPart>;
  return (
    <DepthContext.Provider value={1}>
      <PartBody id={id} tone={tone}>{children}</PartBody>
    </DepthContext.Provider>
  );
}

function NestedPart({ id, depth, assembly, children }: { id: string; depth: number; assembly: MachineDef | null; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const def = assembly?.parts.find((p) => p.id === id);
  useFrame(() => {
    if (!group.current || !def) return;
    const t = deepProgress(def.stage);
    const [x, y, z] = def.explode;
    group.current.position.set(x * t, y * t, z * t);
  });
  return (
    <DepthContext.Provider value={depth + 1}>
      <AssemblyContext.Provider value={childAssembly(assembly, id)}>
        <group ref={group}>{children}</group>
      </AssemblyContext.Provider>
    </DepthContext.Provider>
  );
}

const scratch = new THREE.Vector3();
const box = new THREE.Box3();

function PartBody({ id, tone, children }: { id: string; tone: number; children: ReactNode }) {
  const index = partDef(id)?.index ?? 31;
  const machineId = useStudio((s) => s.machineId);
  const group = useRef<THREE.Group>(null);
  /** Centre of the part's own geometry relative to its group, measured once, for scaling in place. */
  const centre = useRef<THREE.Vector3 | null>(null);
  const drag = useRef<{ plane: THREE.Plane; last: THREE.Vector3 } | null>(null);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { enabled: boolean } | null };
  const materials = useMemo<PartMaterials>(() => {
    const partId = index / 64;
    return {
      solid: createInkMaterial({ partId, tone }),
      clipped: createInkMaterial({ partId, tone, clip: [SECTION_PLANE] }),
    };
  }, [index, tone]);
  const select = useStudio((s) => s.set);

  useEffect(() => () => {
    materials.solid.dispose();
    materials.clipped.dispose();
  }, [materials]);

  useFrame((_, dt) => {
    const { selected, hovered } = useStudio.getState();
    const g = group.current;
    if (g) {
      g.visible = partVisible(id);
      partOffset(id, g.position);
      const s = partEdits.get(id)?.scale ?? 1;
      if (s !== 1 && !centre.current && g.parent) {
        // Measure with the part at its natural size.
        g.scale.setScalar(1);
        g.updateWorldMatrix(true, true);
        box.setFromObject(g);
        centre.current = g.parent.worldToLocal(box.getCenter(scratch)).sub(g.position).clone();
      }
      if (centre.current) g.position.addScaledVector(centre.current, 1 - s);
      g.scale.setScalar(s);
    }
    const k = 1 - Math.exp(-dt * 10);
    for (const material of [materials.solid, materials.clipped]) {
      const u = material.uniforms;
      u.uSelected.value += ((selected === id ? 1 : 0) - u.uSelected.value) * k;
      u.uHover.value += ((hovered === id && selected !== id ? 1 : 0) - u.uHover.value) * k;
    }
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    // A hidden part lets the pointer through to whatever is behind it.
    if (!partVisible(id)) return;
    event.stopPropagation();
    if (event.delta > 4) return;
    select({ selected: useStudio.getState().selected === id ? null : id });
  };

  // Move mode: drag the part in the plane facing the camera.
  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    const { moveMode, view } = useStudio.getState();
    if (!moveMode || view === 'drawing' || !partVisible(id)) return;
    event.stopPropagation();
    try { (event.target as Element).setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    drag.current = { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, event.point), last: event.point.clone() };
    if (controls) controls.enabled = false;
    document.body.style.cursor = 'grabbing';
    select({ selected: id });
  };
  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !group.current?.parent) return;
    event.stopPropagation();
    const hit = event.ray.intersectPlane(d.plane, scratch);
    if (!hit) return;
    // World delta → the parent's (model) units.
    const unit = group.current.parent.getWorldScale(new THREE.Vector3()).x;
    const edit = editOf(id);
    edit.offset[0] += (hit.x - d.last.x) / unit;
    edit.offset[1] += (hit.y - d.last.y) / unit;
    edit.offset[2] += (hit.z - d.last.z) / unit;
    d.last.copy(hit);
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    try { (event.target as Element).releasePointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
    drag.current = null;
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'grab';
  };

  return (
    <PartContext.Provider value={materials}>
      <AssemblyContext.Provider value={childAssembly(machineById(machineId), id)}>
        <group
          ref={group}
          name={`part-${id}`}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(event) => {
            if (!partVisible(id)) return;
            event.stopPropagation();
            const { localExplode } = useStudio.getState();
            select({ selected: id, localExplode: localExplode === id ? null : id, explode: 0 });
          }}
          onPointerOver={(event) => {
            if (!partVisible(id)) return;
            event.stopPropagation();
            select({ hovered: id });
            document.body.style.cursor = useStudio.getState().moveMode ? 'grab' : 'pointer';
          }}
          onPointerOut={() => { if (useStudio.getState().hovered === id) select({ hovered: null }); if (!drag.current) document.body.style.cursor = ''; }}
        >
          {children}
        </group>
      </AssemblyContext.Provider>
    </PartContext.Provider>
  );
}

type Vec3 = [number, number, number];

/** A mesh drawn with the surrounding part's ink material. */
export function M({ geo, p, r, s, clip = false }: { geo: THREE.BufferGeometry; p?: Vec3; r?: Vec3; s?: Vec3; clip?: boolean }) {
  const materials = useContext(PartContext)!;
  return <mesh geometry={geo} material={clip ? materials.clipped : materials.solid} position={p} rotation={r} scale={s} />;
}
