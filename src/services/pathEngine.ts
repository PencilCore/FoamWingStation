
import type { WingModel } from '../types/wing.model';

export interface Point4D {
  x: number;
  y: number;
  u: number;
  z: number;
}

export interface WingPathResult {
  /** 外扩后的路径点（含闭合点）——切割路径 / G-code 使用 */
  orderedPoints: Point4D[];
  /** 未外扩的原始轮廓点（含闭合点）——机翼本体/设计尺寸渲染使用 */
  basePoints: Point4D[];
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
/**
 * 计算影响 G-code 输出/3D 路径的全部关键参数签名。
 * 任何一项变化都会改变签名 → 消费端据此判定 previewGcodeData 快照是否过期。
 */
export function computeGcodeSig(model: WingModel): string {
  return [
    // 翼型与形状
    model.rootAirfoil, model.tipAirfoil, model.useNacaGenerator,
    model.nacaDigitsRoot, model.nacaDigitsTip,
    model.rootChord, model.tipChord, model.rootRotation, model.tipRotation,
    model.washout, model.rootThickness, model.tipThickness,
    model.leadingEdgeSweep, model.trailingEdgeSweep, model.dihedral,
    model.rootOffsetX, model.rootOffsetY, model.tipOffsetX, model.tipOffsetY,
    // 泡沫定位（z/x 方向）
    model.wingSpan, model.foamOffsetZ, model.platformOffset, model.platformOffsetY,
    model.foamRotation,
    // 机床与轴映射
    model.gantryDistance, model.xySide, model.xyuvMode?.join(','),
    model.machineWidth, model.machineLength, model.machineHeight,
    // 路径生成
    model.pathMargin, model.shrinkCompensationEnabled, model.shrinkCompensation,
    model.nestBoth, model.stackingMode, model.interWingOffsetX, model.interWingOffsetY,
    model.flipZ, model.mirrorX, model.mirrorY,
    model.cutDirection, model.safeHeight, model.limitTrailingEdge, model.trailingEdgeLimit,
    model.feedrate,
  ].join('|');
}

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
  // 右塔截面位于龙门架纵向 dist 处
  const dist = mm(model.gantryDistance || 1200);
  // 平台偏移（长度方向，两塔连线）合并进泡沫定位：与「泡沫离左塔架距离」等效，
  // 让翼型投影整体沿泡沫长度平移，间接影响 G-code（根/尖投影插值权重）
  const offset = mm((model.foamOffsetZ || 0) + (model.platformOffset || 0));

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

  // 3. 计算偏移量 (Safety Margin) —— 基于原始（未外扩）轮廓计算，保证开启收缩补偿后
  //    路径起点（前缘）向原点靠近，进刀/退刀路径相应缩短
  const allX = orderedPoints.flatMap(p => [p.x, p.u]);
  const allY = orderedPoints.flatMap(p => [p.y, p.z]);
  const origMinX = Math.min(...allX);
  const origMinY = Math.min(...allY);
  const origMaxX = Math.max(...allX);
  const origMaxY = Math.max(...allY);
  
  const margin = mm(model.pathMargin || 10);
  // 平台偏移（宽度方向）直接进入 G-code 的 X/U 坐标（左/右塔水平马达）：
  // 切割路径与 3D 中偏移后的泡沫/翼面保持视觉一致（所见即所得）
  const shiftX = margin - origMinX + extraShiftX + (model.platformOffsetY || 0);
  const shiftY = margin - origMinY + extraShiftY;

  // 4. 收缩补偿：热丝切割使泡沫收缩、切槽变宽。开启后把切割路径沿外沿等距外扩 comp mm
  //    （形状整体变大，而非单纯增加周长），左塔 (x,y) 与右塔 (u,z) 各自外扩。
  //    安全边距按原始轮廓计算，因此外扩后路径起点（前缘）距原点更近 → 进刀路径缩短。
  let finalPoints = orderedPoints;
  let minX = origMinX, minY = origMinY, maxX = origMaxX, maxY = origMaxY;
  const compEnabled = !!model.shrinkCompensationEnabled && (model.shrinkCompensation || 0) > 0;
  if (compEnabled) {
    const comp = mm(model.shrinkCompensation || 0);
    if (comp > 0) {
      const xy = offsetPolygonOutward(finalPoints.map(p => ({ x: p.x, y: p.y })), comp);
      const uz = offsetPolygonOutward(finalPoints.map(p => ({ x: p.u, y: p.z })), comp);
      finalPoints = finalPoints.map((p, i) => ({
        ...p,
        x: xy[i].x, y: xy[i].y,
        u: uz[i].x, z: uz[i].y,
      }));
      const fAllX = finalPoints.flatMap(p => [p.x, p.u]);
      const fAllY = finalPoints.flatMap(p => [p.y, p.z]);
      minX = Math.min(...fAllX);
      minY = Math.min(...fAllY);
      maxX = Math.max(...fAllX);
      maxY = Math.max(...fAllY);
    }
  }

  return {
    orderedPoints: finalPoints,
    basePoints: orderedPoints,
    shiftX,
    shiftY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY
  };
}

/** 2D 点 */
export interface XYPoint {
  x: number;
  y: number;
}

/**
 * 多边形等距外扩偏移：把闭合轮廓沿外法线方向向外平移 dist mm（形状整体变大，
 * 而非单纯增加周长）。算法：顶点法线 = 相邻两条边外法线之和的归一化，
 * 顶点沿该方向移动 dist；对平滑曲线（翼型）即标准的等距偏移。
 * 自动判定多边形绕向（有符号面积），镜像/翻转后的轮廓也能得到正确的外扩方向。
 */
export function offsetPolygonOutward(pts: XYPoint[], dist: number): XYPoint[] {
  if (!pts || pts.length < 3 || dist <= 0) return pts;
  const closed =
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-9 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-9;
  const poly = closed ? pts.slice(0, -1) : [...pts];
  const n = poly.length;
  if (n < 3) return pts;

  // 判定绕向：有符号面积 > 0 为逆时针
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  const isCCW = area > 0;

  // 每条边的外法线（单位向量）：CCW 取 (dy, -dx)，CW 取 (-dy, dx)
  const edgeNormals: XYPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    let dx = q.x - p.x;
    let dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1e-9;
    dx /= len;
    dy /= len;
    edgeNormals.push(isCCW ? { x: dy, y: -dx } : { x: -dy, y: dx });
  }

  const out: XYPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const n0 = edgeNormals[i];
    const n1 = edgeNormals[(i - 1 + n) % n];
    let nx = n0.x + n1.x;
    let ny = n0.y + n1.y;
    const nl = Math.hypot(nx, ny);
    if (nl > 1e-9) {
      nx /= nl;
      ny /= nl;
    } else {
      nx = n0.x;
      ny = n0.y;
    }
    out.push({ x: p.x + nx * dist, y: p.y + ny * dist });
  }
  if (closed) out.push({ ...out[0] });
  return out;
}
