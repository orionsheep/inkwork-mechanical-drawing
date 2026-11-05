import type { ComponentType } from 'react';

export type Vec3 = [number, number, number];

export interface PartDef {
  id: string;
  /** 1-based drawing index; also the ink part id used by the line renderer (max 31). */
  index: number;
  name: string;
  en: string;
  role: string;
  material: string;
  description: string;
  /** Direction and distance the part travels when exploded. */
  explode: Vec3;
  /** Window of the 0–1 explode slider in which this part travels (teardown order). */
  stage: [number, number];
  /** For a subassembly: extra travel when the whole tree is exploded, to set it out beside the machine. */
  deep?: Vec3;
}

/** Fasteners that back out along their own axis before their owner part moves. */
export interface BoltSetDef {
  owner: string;
  distance: number;
  stage: [number, number];
}

/** A dashed assembly guide: from where a point sits assembled to where it is now. */
export interface GuideDef {
  /** Part id or bolt-set id whose travel the guide follows. */
  stage: string;
  origin: Vec3;
  /** For a bolt set: the bolt's own axis. */
  axis?: Vec3;
}

export interface StepDef {
  title: string;
  en: string;
  body: string;
  state: { explode: number; section: boolean; running: boolean; select: string | null; focus: string | null };
  /** Machine-specific state for this step (e.g. load). */
  apply?: () => void;
}

export interface CameraDef {
  /** Point the views look at. */
  target: Vec3;
  /** Perspective camera offset from the target. */
  offset: Vec3;
  /** Distance used for the near-orthographic elevation and plan views. */
  orthoDistance: number;
  /** When fully exploded: where to look, and how much further back (multiplies distance). */
  exploded?: { target: Vec3; scale: number };
  /** When the whole tree is exploded: where to look and how far back. */
  deep?: { target: Vec3; scale: number };
  /** Close-ups used by the study steps. */
  foci?: Record<string, { target: Vec3; scale: number }>;
}

export interface MachineDef {
  id: string;
  /** Assembled bounding box [min, max], used to lay out the three views. */
  bounds: [Vec3, Vec3];
  name: string;
  en: string;
  subtitle: string;
  /** One-line description in the machine switcher. */
  summary: string;
  drawingNo: string;
  scale: string;
  parts: PartDef[];
  boltSets: Record<string, BoltSetDef>;
  /** What comes apart when one part is opened on its own (local explode). */
  neighbours: Record<string, string[]>;
  guides: GuideDef[];
  /**
   * Dash-dot axis lines drawn over the model. The optional radius marks a
   * revolved feature: where the axis points at a view, that view gets a
   * centre cross of that size (圆的十字中心线).
   */
  centreLines: Array<[Vec3, Vec3, number?]>;
  steps: StepDef[];
  camera: CameraDef;
  /** The model, rendered inside the R3F canvas. */
  Model: ComponentType;
  /** Per-frame motion (inside the canvas). */
  Driver?: ComponentType;
  /** Machine-specific controls in the title column. */
  Controls?: ComponentType;
  /** Machine-specific switches, shown in the row with 运转 / 剖视 / 标注. */
  Toggles?: ComponentType;
  /** Faint orthographic drawings behind the plate. */
  Backdrop?: ComponentType;
  /** Model units → scene units (the model is drawn inside a group of this scale). */
  unit?: number;
  /** For a subassembly: the assembly it belongs to. */
  parent?: string;
  /** Parts that are subassemblies in their own right: part id → machine id. */
  children?: Record<string, string>;
}
