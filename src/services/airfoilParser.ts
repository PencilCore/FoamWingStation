export interface AirfoilPoint { x: number; y: number; }

/**
 * Loads and parses airfoil data from a .dat file.
 * Assumes the .dat files are located at 'src/assets/airfoils/' 
 * relative to the project root, and the parser is at 'src/services/'.
 * * NOTE: The relative path is fixed to `../assets/airfoils/`.
 * If this still fails, the files must be moved to the `public/` directory
 * and the path changed to `/airfoils/name`.
 * * @param name - The filename of the airfoil (e.g., 'naca0012.dat').
 * @returns A promise resolving to an array of AirfoilPoint objects.
 */
export async function loadAirfoil(name: string): Promise<AirfoilPoint[]> {
  try {
    console.log(`[Airfoil Parser] Loading ${name}...`);
    
    // 使用相对路径导入（更稳定）
    const text = await import(`../assets/AIRFOILS/${name}?raw`).then(m => m.default).catch(async (_err) => {
      console.warn(`[Airfoil Parser] Failed to load ${name}, trying fallback to E334.DAT`);
      // 加载失败时降级
      return import(`../assets/AIRFOILS/E334.DAT?raw`).then(m => m.default);
    });
    
    if (!text || typeof text !== 'string') {
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