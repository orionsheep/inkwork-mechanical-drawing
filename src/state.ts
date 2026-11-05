import { create } from 'zustand';

export type ViewMode = 'perspective' | 'elevation' | 'plan' | 'drawing';

export interface StudioState {
  machineId: string;
  explode: number;
  section: boolean;
  /** How deep the section cuts, 0 (skims the near face) – 1 (leaves only the far skin); 0.5 is the centre line. */
  sectionDepth: number;
  running: boolean;
  view: ViewMode;
  /** Optional close-up within the perspective view (a key of the machine's camera foci). */
  focus: string | null;
  /** Bumped to make the camera return to the current view preset. */
  viewNonce: number;
  selected: string | null;
  hovered: string | null;
  /** Part opened on its own (local explode), with its neighbours. */
  localExplode: string | null;
  step: number;
  /** Show numbered balloons for every part. */
  labels: boolean;
  /** Drawing mode: dashed hidden outlines, and projection lines for the selected part. */
  hiddenLines: boolean;
  projection: boolean;
  /** Drag parts around instead of orbiting the view. */
  moveMode: boolean;
  /** Explode the whole tree: subassemblies come out beside the machine and come apart too. */
  deep: boolean;
  /** Parts put out of sight, and the one part shown on its own. */
  hidden: string[];
  solo: string | null;
  /** Bumped (with the part) to swing the camera onto one part. */
  aim: { id: string; nonce: number } | null;
  /** Bumped when a part's size or position is edited from the UI. */
  editNonce: number;
  set: (patch: Partial<Omit<StudioState, 'set'>>) => void;
}

export const useStudio = create<StudioState>((set) => ({
  machineId: 'jack',
  explode: 0,
  section: false,
  sectionDepth: 0.5,
  running: true,
  view: 'perspective',
  focus: null,
  viewNonce: 0,
  selected: null,
  hovered: null,
  localExplode: null,
  step: 0,
  labels: typeof window === 'undefined' || window.innerWidth >= 700,
  hiddenLines: true,
  projection: true,
  moveMode: false,
  deep: false,
  hidden: [],
  solo: null,
  aim: null,
  editNonce: 0,
  set: (patch) => set(patch),
}));

/**
 * Per-frame values eased toward the store's targets. Kept outside React so
 * the scene can animate without re-rendering. Machine-specific motion lives
 * with each machine.
 */
export const motion = {
  /** Starts apart so the machine assembles itself on load. */
  explode: 1,
  /** Slider units per second; slowed down while recording the teardown. */
  explodeRate: 0.55,
  /** Local explode: which part, and its 0–1 progress. */
  localPart: null as string | null,
  local: 0,
  /** 0–1 progress of the whole-tree explode. */
  deep: 0,
};

/**
 * The viewer's own edits to parts of the current assembly: where they have
 * been dragged (in model units, on top of the explode) and how big they are.
 */
export const partEdits = new Map<string, { offset: [number, number, number]; scale: number }>();

export function editOf(id: string) {
  let edit = partEdits.get(id);
  if (!edit) {
    edit = { offset: [0, 0, 0], scale: 1 };
    partEdits.set(id, edit);
  }
  return edit;
}

/** Forget one part's edits, or all of them. */
export function clearEdits(id?: string) {
  if (id) partEdits.delete(id);
  else partEdits.clear();
  useStudio.setState((s) => ({ editNonce: s.editNonce + 1 }));
}

/**
 * Put everything back as it was when the machine was opened: reassembled,
 * no edits, no section, default camera and switches, first study step. The
 * view mode (perspective, three-view, …) stays as it is.
 */
export function restoreAll(first: { state: { running: boolean; select: string | null; focus: string | null }; apply?: () => void }) {
  partEdits.clear();
  motion.localPart = null;
  motion.local = 0;
  first.apply?.();
  useStudio.setState((s) => ({
    explode: 0, deep: false, section: false, sectionDepth: 0.5, running: first.state.running, focus: first.state.focus,
    viewNonce: s.viewNonce + 1, selected: first.state.select, hovered: null, localExplode: null, step: 0, moveMode: false,
    labels: typeof window === 'undefined' || window.innerWidth >= 700, hiddenLines: true, projection: true, editNonce: s.editNonce + 1, hidden: [], solo: null,
  }));
  document.body.style.cursor = '';
}

/** Point the camera at one part of the current assembly. */
export function aimAt(id: string) {
  const { aim } = useStudio.getState();
  useStudio.setState({ aim: { id, nonce: (aim?.nonce ?? 0) + 1 } });
}

/** Whether a part is drawn at all (hidden, or another part shown on its own). */
export function partVisible(id: string) {
  const { hidden, solo } = useStudio.getState();
  return !hidden.includes(id) && (!solo || solo === id);
}

/** Switch machine: reset the study state and let the new machine assemble itself. */
export function selectMachine(id: string) {
  const { viewNonce, machineId } = useStudio.getState();
  if (id === machineId) return;
  motion.explode = 1;
  motion.local = 0;
  motion.localPart = null;
  motion.deep = 0;
  partEdits.clear();
  useStudio.getState().set({
    machineId: id, explode: 0, section: false, sectionDepth: 0.5, running: true, view: 'perspective', focus: null,
    viewNonce: viewNonce + 1, selected: null, hovered: null, localExplode: null, step: 0, deep: false, hidden: [], solo: null,
  });
}
