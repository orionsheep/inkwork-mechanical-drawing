import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useMachine } from '../machines';
import { useStudio } from '../state';
import { computeLayout, drawing, type DrawingLayout } from './layout';

/** What the DOM sheet needs: the layout and the focused part's world box. */
export const useDrawing = create<{ layout: DrawingLayout | null; box: THREE.Box3 | null }>(() => ({ layout: null, box: null }));

/** Space the title column and title block leave for the views. */
function insets(width: number) {
  if (width < 1100) return { left: 12, right: 12, top: 12, bottom: 12 };
  return { left: 450, right: 44, top: 96, bottom: 36 };
}

function partOf(object: THREE.Object3D | null): string | null {
  for (let o = object; o; o = o.parent) {
    if (o.name.startsWith('part-')) return o.name.slice(5);
  }
  return null;
}

/**
 * Drawing mode inside the canvas: keeps the three-view layout in step with
 * the stage size, picks parts in whichever view is under the pointer, and
 * tracks the focused part's bounding box for the projection lines.
 */
export function DrawingRig() {
  const machine = useMachine();
  const active = useStudio((s) => s.view === 'drawing');
  const { gl, scene, size, raycaster } = useThree();

  useEffect(() => {
    if (!active) {
      drawing.layout = null;
      useDrawing.setState({ layout: null, box: null });
      return;
    }
    const layout = computeLayout(size.width, size.height, machine.bounds, insets(size.width));
    drawing.layout = layout;
    useDrawing.setState({ layout });
  }, [active, machine, size.width, size.height]);

  // R3F's own picking uses the perspective camera, which is not on screen in drawing mode.
  useEffect(() => {
    if (active) raycaster.layers.set(31);
    else raycaster.layers.set(0);
  }, [active, raycaster]);

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const hit = (event: PointerEvent | MouseEvent) => {
      const layout = drawing.layout;
      if (!layout) return null;
      const r = el.getBoundingClientRect();
      const x = event.clientX - r.left;
      const y = event.clientY - r.top;
      const view = layout.views.find((v) => x >= v.rect.x && x <= v.rect.x + v.rect.w && y >= v.rect.y && y <= v.rect.y + v.rect.h);
      if (!view) return null;
      const ndc = new THREE.Vector2(((x - view.rect.x) / view.rect.w) * 2 - 1, -((y - view.rect.y) / view.rect.h) * 2 + 1);
      ray.setFromCamera(ndc, view.camera);
      ray.layers.set(0);
      const hits = ray.intersectObjects(scene.children, true);
      return hits.length ? partOf(hits[0].object) : null;
    };
    const set = useStudio.getState().set;
    const onMove = (e: PointerEvent) => {
      const id = hit(e);
      if (useStudio.getState().hovered !== id) set({ hovered: id });
      el.style.cursor = id ? 'pointer' : '';
    };
    const onClick = (e: MouseEvent) => {
      const id = hit(e);
      set({ selected: id && useStudio.getState().selected !== id ? id : null });
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('click', onClick);
      el.style.cursor = '';
    };
  }, [active, gl, scene]);

  // Bounding box of the focused part, refreshed a few times a second.
  useFrame(({ clock }) => {
    if (!active) return;
    if (Math.floor(clock.elapsedTime * 8) === Math.floor((clock.elapsedTime - 1 / 60) * 8)) return;
    const { selected, hovered } = useStudio.getState();
    const id = hovered ?? selected;
    const group = id ? scene.getObjectByName(`part-${id}`) : undefined;
    const box = group ? new THREE.Box3().setFromObject(group) : null;
    const prev = useDrawing.getState().box;
    if ((box && prev && box.equals(prev)) || (!box && !prev)) return;
    useDrawing.setState({ box });
  });

  return null;
}
