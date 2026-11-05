import { useStudio } from '../state';
import { coupling } from './coupling';
import { macbook } from './macbook';
import { model3 } from './model3';
import type { MachineDef } from './types';

/**
 * 机器注册表 / machine registry.
 *
 * 每组架子一个；新增顶层的机器加进对应组的 machines 数组。
 * 子组件（多层次拆解里单独打开的层级）不放进 GROUPS，放进下面的 ALL。
 *
 * 例：叶轮是 `pump/impeller` 这样的子组件，就在文件末尾
 *   import { PUMP_LEVELS, pump } from './pump';
 * 然后 `const ALL: MachineDef[] = [...MACHINES, ...PUMP_LEVELS];`
 */
export const GROUPS: Array<{ name: string; machines: MachineDef[] }> = [
  { name: '基础机构', machines: [coupling] },
  { name: '机床', machines: [] },
  { name: '日常器物', machines: [macbook] },
  { name: '动力传动', machines: [] },
  { name: '大型装备', machines: [model3] },
];

export const MACHINES: MachineDef[] = GROUPS.flatMap((g) => g.machines);

/** 所有装配，包含只能通过打开某个零件才进入的子组件。 */
const ALL: MachineDef[] = [...MACHINES];

export const allMachines = () => ALL;

// 给 scripts/ 里的脚本用：应用真正注册的每一级装配。
if (typeof window !== 'undefined') {
  (window as unknown as { gewu: unknown }).gewu = { assemblies: () => ALL.map((m) => ({ id: m.id, parent: m.parent ?? null })) };
}
export const hasMachine = (id: string) => ALL.some((m) => m.id === id);

export function machineById(id: string): MachineDef {
  return ALL.find((m) => m.id === id) ?? MACHINES[0];
}

/** 从顶层到这一级的装配链。 */
export function lineage(machine: MachineDef): MachineDef[] {
  const chain = [machine];
  while (chain[0].parent) chain.unshift(machineById(chain[0].parent));
  return chain;
}

/** 此刻在图纸上的机器（给非 React 代码：每帧与导出用）。 */
export function currentMachine(): MachineDef {
  return machineById(useStudio.getState().machineId);
}

export function useMachine(): MachineDef {
  return machineById(useStudio((s) => s.machineId));
}
