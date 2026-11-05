import { describe, expect, it } from 'vitest';
import { CP } from './coupling/data';
import { normAngle, pinPosition } from './coupling';

/**
 * 运动学单元测试：把"动的逻辑"写成纯函数再测（见 .claude/skills/mechanical-drawing/SKILL.md 第 4 步）。
 * 改机器时照着这个文件加自己的极限位置 / 对称 / 行程检查。
 */
describe('弹性柱销联轴器 · 柱销分布', () => {
  it('一圈 6 根柱销，都落在分布圆上（半径 = boltR）', () => {
    for (let i = 0; i < CP.pins; i += 1) {
      const [x, y, z] = pinPosition(i, 0);
      expect(x).toBe(0);
      expect(Math.hypot(y, z)).toBeCloseTo(CP.boltR, 6);
    }
  });

  it('柱销绕轴线（x）在 y-z 平面内转：转角增加 θ，位置绕 x 轴转 θ', () => {
    const p0 = pinPosition(1, 0);
    const p1 = pinPosition(1, Math.PI / 2);
    expect(p0[0]).toBe(p1[0]); // x 不变（轴向不移动）
    expect(Math.hypot(p1[1], p1[2])).toBeCloseTo(Math.hypot(p0[1], p0[2]), 6);
  });

  it('转一整圈回到原位', () => {
    for (let i = 0; i < CP.pins; i += 1) {
      const a = pinPosition(i, 0);
      const b = pinPosition(i, Math.PI * 2);
      expect(a[1]).toBeCloseTo(b[1], 6);
      expect(a[2]).toBeCloseTo(b[2], 6);
    }
  });

  it('角度归一化落在 [0, 2π)', () => {
    for (const a of [-7, -0.1, 0, 9.9, 123]) {
      const n = normAngle(a);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(Math.PI * 2);
    }
  });

  it('柱销数、柱销长等关键尺寸为合理正值', () => {
    expect(CP.pins).toBeGreaterThanOrEqual(3);
    expect(CP.pinLen).toBeGreaterThan(CP.gap);
    expect(CP.discR).toBeGreaterThan(CP.boreR);
  });
});
