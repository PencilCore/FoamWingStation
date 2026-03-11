import { loadAirfoil } from './airfoilParser';
import type { WingModel } from '../types/wing.model';

export interface AirfoilPoint { x: number; y: number }
export interface GeneratedAirfoilPoints {
  root: { le: AirfoilPoint; points: AirfoilPoint[] };
  tip: { le: AirfoilPoint; points: AirfoilPoint[] };
}

/**
 * 生成已变换的翼型点集（同步 useGenerateAirfoilPoints 算法，纯函数/无hook依赖）
 */
// 静态缓存，避免重复加载同名翼型文件
const cacheRef: Map<string, Promise<AirfoilPoint[]>> = new Map();

export async function airfoilPointsGenerator(model: WingModel): Promise<GeneratedAirfoilPoints> {
  const {
    rootAirfoil, tipAirfoil, rootChord, tipChord,
    rootRotation, tipRotation, rootOffsetX, rootOffsetY, tipOffsetX, tipOffsetY,
    rootThickness, tipThickness
  } = model;


  // 加载翼型原始点（带缓存）
  let rPromise = cacheRef.get(rootAirfoil);
  if (!rPromise) {
    rPromise = loadAirfoil(rootAirfoil);
    cacheRef.set(rootAirfoil, rPromise);
  }
  let tPromise = cacheRef.get(tipAirfoil);
  if (!tPromise) {
    tPromise = loadAirfoil(tipAirfoil);
    cacheRef.set(tipAirfoil, tPromise);
  }
  const [rRaw, tRaw] = await Promise.all([rPromise, tPromise]);

  // 变换算法（与 useGenerateAirfoilPoints 保持一致）
  const transform = (pts: AirfoilPoint[], chord: number, rotationDeg: number, offsetX = 0, offsetY = 0, thicknessPercent = 100) => {
    if (!pts || pts.length === 0) return { le: { x: 0, y: 0 }, points: [] as AirfoilPoint[] };
    const lePoint = pts.find(p => Math.abs(p.x) < 0.01) || pts[0];
    const angle = (rotationDeg || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const leX0 = lePoint.x * chord;
    const leY0 = lePoint.y * chord;
    const yScale = (thicknessPercent ?? 100) / 100;
    const points = pts.map(p => {
      const dx = p.x * chord - leX0;
      const dy = (p.y * chord - leY0) * yScale;
      const dxr = cos * dx - sin * dy;
      const dyr = sin * dx + cos * dy;
      const x = leX0 + dxr + offsetX;
      const y = leY0 + dyr + offsetY;
      return { x, y };
    });
    const le = { x: leX0 + offsetX, y: leY0 + offsetY };
    return { le, points };
  };

  // 先分别变换
  let root0 = transform(rRaw, rootChord, rootRotation as number, rootOffsetX || 0, rootOffsetY || 0, rootThickness);
  // 应用 leadingEdgeSweep 到翼尖 X 坐标，以及应用 washout 到尖部旋转
  const actualTipRotation = (tipRotation as number) + (model.washout || 0);
  let tip0 = transform(tRaw, tipChord, actualTipRotation, (tipOffsetX || 0) + (model.leadingEdgeSweep || 0), tipOffsetY || 0, tipThickness);

  // --- 插值较小点数的翼型，使两者点数一致 ---
  const nRoot = root0.points.length;
  const nTip = tip0.points.length;
  const targetN = Math.max(nRoot, nTip);
  function interpolatePoints(pts: AirfoilPoint[], n: number): AirfoilPoint[] {
    if (pts.length === n) return pts;
    if (pts.length < 2) return Array(n).fill(pts[0] || {x:0,y:0});
    // 计算每个点的累计弧长
    const arc: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i-1].x;
      const dy = pts[i].y - pts[i-1].y;
      arc.push(arc[arc.length-1] + Math.hypot(dx, dy));
    }
    const total = arc[arc.length-1];
    // 均匀采样
    const res: AirfoilPoint[] = [];
    for (let i = 0; i < n; i++) {
      const t = (total * i) / (n-1);
      // 找到区间
      let j = 1;
      while (j < arc.length && arc[j] < t) j++;
      const t0 = arc[j-1], t1 = arc[j];
      const p0 = pts[j-1], p1 = pts[j];
      const ratio = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      res.push({
        x: p0.x + (p1.x - p0.x) * ratio,
        y: p0.y + (p1.y - p0.y) * ratio
      });
    }
    return res;
  }
  if (nRoot !== nTip) {
    if (nRoot < targetN) root0 = { ...root0, points: interpolatePoints(root0.points, targetN) };
    if (nTip < targetN) tip0 = { ...tip0, points: interpolatePoints(tip0.points, targetN) };
  }

  // 合并所有点，找到全局最低点
  const allPoints = [...root0.points, ...tip0.points];
  const globalMinY = allPoints.length > 0 ? Math.min(...allPoints.map(p => p.y)) : 0;

  // 再整体y平移，使最低点为0
  const root = {
    le: { x: root0.le.x, y: root0.le.y - globalMinY },
    points: root0.points.map(p => ({ x: p.x, y: p.y - globalMinY }))
  };
  const tip = {
    le: { x: tip0.le.x, y: tip0.le.y - globalMinY },
    points: tip0.points.map(p => ({ x: p.x, y: p.y - globalMinY }))
  };

  return { root, tip };
}
