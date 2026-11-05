import { currentMachine } from '../machines';
import type { BoltSetDef, PartDef } from '../machines/types';
import { motion, partEdits } from '../state';

/**
 * Staged disassembly. Every part and every removable bolt set owns a window
 * of the 0–1 explode slider (in the machine's data), in reverse assembly
 * order, so dragging the slider plays the teardown.
 */

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function partDef(id: string): PartDef | undefined {
  return currentMachine().parts.find((p) => p.id === id);
}

export function boltSetDef(id: string): BoltSetDef | undefined {
  return currentMachine().boltSets[id];
}

/** 0–1 progress of one part or bolt set, from the global slider or the local explode. */
export function stageProgress(id: string): number {
  const machine = currentMachine();
  const window = machine.boltSets[id]?.stage ?? partDef(id)?.stage ?? [1, 1];
  const [a, b] = window;
  const global = b > a ? smooth((motion.explode - a) / (b - a)) : 0;
  let local = 0;
  if (motion.localPart && motion.local > 0) {
    const group = machine.neighbours[motion.localPart] ?? [motion.localPart];
    const index = group.indexOf(id);
    if (index >= 0) {
      // Within a local explode, keep the teardown order but spread it over the group.
      const n = group.length;
      const start = (index / n) * 0.7;
      local = smooth((motion.local - start) / 0.3 / Math.max(1, 3 / n));
    }
  }
  return Math.max(global, local);
}

/** Current travel of a part (its explode vector scaled by its progress). */
export function partOffset(id: string, out: { set: (x: number, y: number, z: number) => unknown }) {
  const def = partDef(id);
  const t = stageProgress(id);
  const [x, y, z] = def?.explode ?? [0, 0, 0];
  const [dx, dy, dz] = partEdits.get(id)?.offset ?? [0, 0, 0];
  // Exploding the whole tree first pulls each subassembly out beside the machine.
  const d = def?.deep ? smooth(motion.deep / 0.3) : 0;
  const [ax, ay, az] = def?.deep ?? [0, 0, 0];
  out.set(x * t + dx + ax * d, y * t + dy + ay * d, z * t + dz + az * d);
}

/**
 * Progress of a part inside a subassembly drawn within its parent: it only
 * comes apart when the whole tree is exploded, after the subassemblies have
 * been pulled out, in its own teardown order.
 */
export function deepProgress([a, b]: [number, number]) {
  if (b <= a) return 0;
  const t = (motion.deep - 0.3) / 0.7;
  return smooth((t - a) / (b - a));
}
