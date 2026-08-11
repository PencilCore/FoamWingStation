export interface AirfoilPoint { x: number; y: number; }

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