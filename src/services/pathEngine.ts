
import type { WingModel } from '../types/wing.model';

export interface Point4D {
  x: number;
  y: number;
  u: number;
  z: number;
}

export interface WingPathResult {
  orderedPoints: Point4D[];
  shiftX: number;
  shiftY: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
}

/**
 * 核心路径引擎：负责将原始翼型点转换为带偏移、镜像、投影和排序的物理路径
 * 此逻辑与 G-code 文本生成和 3D 渲染完全解耦
 */
export function calculateWingPath(
  rootPoints: [number, number][],
  tipPoints: [number, number][],
  model: WingModel,
  isRightWing: boolean = false,
  extraShiftX: number = 0,
  extraShiftY: number = 0,
  isNested: boolean = false
): WingPathResult {
  const mm = (v: number) => (model.unit === 'inch' ? v * 25.4 : v);
  const span = mm(model.wingSpan);
  const dist = mm(model.gantryDistance || 1200);
  const offset = mm(model.foamOffsetZ || 0);

  let zRoot = offset;
  let zTip = offset + span;
  if (model.flipZ) [zRoot, zTip] = [zTip, zRoot];

  // 1. 投影与镜像逻辑
  const rawPoints = rootPoints.map((r, i) => {
    const t = i < tipPoints.length ? tipPoints[i] : tipPoints[tipPoints.length - 1];
    const zDiff = zTip - zRoot;
    if (Math.abs(zDiff) < 0.001) return { x: r[0], y: r[1], u: t[0], z: t[1] };
    const w0 = (0 - zRoot) / zDiff, w1 = (dist - zRoot) / zDiff;
    let x = r[0] + w0 * (t[0] - r[0]), y = r[1] + w0 * (t[1] - r[1]);
    let u = r[0] + w1 * (t[0] - r[0]), z = r[1] + w1 * (t[1] - r[1]);
    
    // 镜像逻辑
    if (model.mirrorX || (isRightWing && !model.mirrorX)) { x = -x; u = -u; }
    if (model.mirrorY || (isNested && !model.mirrorY)) { y = -y; z = -z; }
    return { x, y, u, z };
  });

  // 2. 寻找起刀点 (默认前缘 minX)
  let startIndex = 0;
  let minXFound = Infinity;
  for (let i = 0; i < rawPoints.length; i++) {
    if (rawPoints[i].x < minXFound) {
      minXFound = rawPoints[i].x;
      startIndex = i;
    }
  }

  const orderedPoints = [...rawPoints.slice(startIndex), ...rawPoints.slice(0, startIndex)];
  if (orderedPoints.length > 0) orderedPoints.push(orderedPoints[0]);

  // 3. 计算偏移量 (Safety Margin)
  const allX = orderedPoints.flatMap(p => [p.x, p.u]);
  const allY = orderedPoints.flatMap(p => [p.y, p.z]);
  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  
  const margin = mm(model.pathMargin || 10);
  const shiftX = margin - minX + extraShiftX;
  const shiftY = margin - minY + extraShiftY;

  return {
    orderedPoints,
    shiftX,
    shiftY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY
  };
}
