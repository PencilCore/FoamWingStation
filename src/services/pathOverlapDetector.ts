
// src/services/pathOverlapDetector.ts

export interface Point {
  x: number;
  y: number;
}

/**
 * 检查两条线段是否相交
 */
function isIntersecting(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denominator === 0) return false; // 平行或共线

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

  // 这里的 0.0001 是为了避免端点重合导致的假阳性
  const epsilon = 0.0001;
  return ua > epsilon && ua < 1 - epsilon && ub > epsilon && ub < 1 - epsilon;
}

/**
 * 检查一个点是否在多边形内部
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 检查两条路径（由点组成的封闭或非封闭曲线）是否重叠（相交）
 */
export function checkPathOverlap(pathA: Point[], pathB: Point[]): boolean {
  if (pathA.length < 2 || pathB.length < 2) return false;

  // 1. 快速 AABB 检查
  const getBounds = (path: Point[]) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  };

  const boundsA = getBounds(pathA);
  const boundsB = getBounds(pathB);

  // 如果包围盒都不重合，路径肯定不重合
  if (boundsA.maxX < boundsB.minX || boundsB.maxX < boundsA.minX ||
      boundsA.maxY < boundsB.minY || boundsB.maxY < boundsA.minY) {
    return false;
  }

  // 2. 详细的每条线段交点检查
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (isIntersecting(pathA[i], pathA[i+1], pathB[j], pathB[j+1])) {
        return true;
      }
    }
  }

  // 3. 检查一个路径是否完全包含在另一个路径内 (对于泡沫切割，这通常也意味着有问题)
  // 简化处理：检查 pathA 的第一个点是否在 pathB 内部，反之亦然
  if (isPointInPolygon(pathA[0], pathB) || isPointInPolygon(pathB[0], pathA)) {
    return true;
  }

  return false;
}
