export interface AirfoilPoint { x: number; y: number; }

/**
 * NACA 4-digit 翼型生成器
 * 基于标准 NACA 4-digit 公式生成翼型坐标点
 * @param digits - 4位数字字符串，如 "2412"
 * @param numPoints - 生成的点数（默认 80，上表面+下表面各40+前缘）
 * @returns 归一化翼型点数组 (x: 0~1, y: 相对厚度)
 */
export function generateNaca4Digit(digits: string, numPoints: number = 80): AirfoilPoint[] {
  digits = digits.trim();
  if (!/^\d{4}$/.test(digits)) {
    console.warn('[NACA Generator] Invalid 4-digit format, fallback to NACA 2412');
    digits = '2412';
  }

  const m = parseInt(digits[0]) / 100;      // 最大弯度 %chord
  const p = parseInt(digits[1]) / 10;       // 最大弯度位置 /10 chord
  const t = parseInt(digits.slice(2)) / 100; // 最大厚度 %chord

  const halfN = Math.floor(numPoints / 2);
  const points: AirfoilPoint[] = [];

  // 余弦分布采样（前缘更密集）
  const xCoords: number[] = [];
  for (let i = 0; i <= halfN; i++) {
    const beta = (i * Math.PI) / halfN;
    xCoords.push(0.5 * (1 - Math.cos(beta)));
  }

  // 厚度分布公式（NACA标准）
  const thickness = (x: number) => {
    const a0 = 0.2969, a1 = -0.1260, a2 = -0.3516, a3 = 0.2843, a4 = -0.1015;
    return 5 * t * (a0 * Math.sqrt(x) + a1 * x + a2 * x * x + a3 * x * x * x + a4 * x * x * x * x);
  };

  // 中弧线方程
  const meanLine = (x: number) => {
    if (m === 0 || p === 0) return 0;
    if (x < p) {
      return (m / (p * p)) * (2 * p * x - x * x);
    } else {
      return (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * x - x * x);
    }
  };

  // 中弧线斜率（用于计算实际翼型表面法线方向偏移）
  const dMdx = (x: number) => {
    if (m === 0 || p === 0) return 0;
    if (x < p) {
      return (2 * m / (p * p)) * (p - x);
    } else {
      return (2 * m / ((1 - p) * (1 - p))) * (p - x);
    }
  };

  // 先上表面（从前缘向后），再下表面（从后缘向前）
  // 上表面: x从1→0
  for (let i = xCoords.length - 1; i >= 0; i--) {
    const x = xCoords[i];
    const yc = meanLine(x);
    const yt = thickness(x);
    const dyc = dMdx(x);
    const theta = Math.atan(dyc);
    const xu = x - yt * Math.sin(theta);
    const yu = yc + yt * Math.cos(theta);
    points.push({ x: xu, y: yu });
  }

  // 下表面: x从0→1 (跳过前缘点避免重复)
  for (let i = 1; i < xCoords.length; i++) {
    const x = xCoords[i];
    const yc = meanLine(x);
    const yt = thickness(x);
    const dyc = dMdx(x);
    const theta = Math.atan(dyc);
    const xl = x + yt * Math.sin(theta);
    const yl = yc - yt * Math.cos(theta);
    points.push({ x: xl, y: yl });
  }

  return points;
}

/**
 * 构建时静态收集 src/assets/AIRFOILS/ 下所有 .DAT 文件。
 * 用 import.meta.glob 而非变量动态导入（`import(\`../assets/AIRFOILS/${name}?raw\`)`），
 * 因为 Vite 无法静态分析变量动态导入，dev 下会退化为运行时 URL 请求（404），
 * 生产构建也无法正确打包这些文件。
 */
const airfoilModules = import.meta.glob('../assets/AIRFOILS/*.DAT', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * 加载并解析翼型 .dat 文件。
 * 文件位于 'src/assets/AIRFOILS/'。
 * @param name - 翼型文件名（如 'naca0012.dat'）。
 * @returns 解析为 AirfoilPoint 数组的 Promise。
 */
export async function loadAirfoil(name: string): Promise<AirfoilPoint[]> {
  try {
    console.log(`[Airfoil Parser] Loading ${name}...`);
    
    // 从构建时收集的模块表中直接取文本（无运行时网络请求）
    let text = airfoilModules[`../assets/AIRFOILS/${name}`];
    if (typeof text !== 'string') {
      console.warn(`[Airfoil Parser] Failed to load ${name}, trying fallback to E334.DAT`);
      // 加载失败时降级
      text = airfoilModules['../assets/AIRFOILS/E334.DAT'];
    }
    
    if (typeof text !== 'string' || text.length === 0) {
      console.error(`[Airfoil Parser] Invalid data for ${name}`);
      return [];
    }
    
    console.log(`[Airfoil Parser] Successfully loaded ${name || 'fallback'}`);
    
    const points: AirfoilPoint[] = [];
    const lines = text.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) continue;
      
      const parts = line.split(/\s+/).filter(Boolean);

      if (parts.length >= 2) {
        const x = Number(parts[0]);
        const y = Number(parts[1]);

        if (isFinite(x) && isFinite(y)) {
          points.push({ x, y });
        } else {
          console.warn(`[Airfoil Parser] Skipping invalid coordinate at line ${i + 1}: ${line}`);
        }
      }
    }
    
    if (points.length < 2) {
      console.warn(`[Airfoil Parser] Not enough valid points. Count: ${points.length}`);
    }
    
    return points;
  } catch (err) {
    console.error(`[Airfoil Parser] Exception loading airfoil:`, err);
    return [];
  }
}