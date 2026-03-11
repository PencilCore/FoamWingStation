// src/services/wingGenerator.ts
import { saveAs } from 'file-saver';

export interface WingParams {
  modelName: string;
  wingspan: number;
  washout: number;
  rootChord: number;
  tipChord: number;
  rootProfile: string;        // filename like "e374.dat"
  tipProfile: string;
  foamChord: number;
  foamThickness: number;
  trailingEdgeLimit: number;
  leadingEdgeSweep: number;
  gantryLength: number;
  feedrate: number;
  xySide: 0 | 1;              // 0 = right, 1 = left
  unit: 0 | 1;                // 0 = mm, 1 = inch
  mode: 'xyuv' | 'yz' | 'xz' | 'xyuz_grbl';
}

export interface GCodeResult {
  gcodeLeft: string;
  gcodeRight: string;
  gcodeBoth: string;
  message: string;
}

export class WingGenerator {
  private params: WingParams;
  private rootProfile: [number, number][] = [];
  private tipProfile: [number, number][] = [];
  private unitStr = 'mm';
  private prec = 3;
  private safeZ = 5;

  constructor(params: WingParams) {
    this.params = params;
    this.unitStr = params.unit === 1 ? 'in' : 'mm';
    this.prec = params.unit === 1 ? 4 : 3;
    this.safeZ = params.unit === 1 ? 0.2 : 5;
  }

  private fmt(val: number): string {
    return val.toFixed(this.prec);
  }

  async loadAirfoil(content: string): Promise<[number, number][]> {
    const lines = content.split('\n');
    const points: [number, number][] = [];
    let divisor = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line || /[a-zA-Z]/.test(line[0])) continue;
      const parts = line.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      if (parts.length < 2) continue;
      if (divisor === 0) divisor = parts[0];
      const x = 1 - parts[0] / divisor;
      const y = parts[1] / divisor;
      points.push([x, y]);
    }
    return points;
  }

  private resample(master: [number, number][], slave: [number, number][]): [number, number][] {
    if (master.length === slave.length) return slave;
    if (master.length < slave.length) return this.resample(slave, master);

    const result: [number, number][] = [];
    const slaveX = slave.map(p => p[0]);
    const slaveYUpper: number[] = [];
    const slaveYLower: number[] = [];
    let splitIdx = 0;
    for (let i = 0; i < slave.length; i++) {
      if (slave[i][0] < slave[splitIdx][0]) splitIdx = i;
    }
    for (let i = 0; i < slave.length; i++) {
      const idx = i <= splitIdx ? i : slave.length - 1 - (i - splitIdx - 1);
      (i <= splitIdx ? slaveYUpper : slaveYLower).push(slave[idx][1]);
    }

    for (const [mx, _my] of master) {
      let sy: number;
      if (mx >= slave[splitIdx][0]) {
        // upper surface
        const idx = slaveX.findIndex((x, i) => i <= splitIdx && x >= mx);
        if (idx === 0) sy = slaveYUpper[0];
        else if (idx === -1) sy = slaveYUpper[slaveYUpper.length - 1];
        else {
          const x1 = slaveX[idx - 1], y1 = slaveYUpper[idx - 1];
          const x2 = slaveX[idx], y2 = slaveYUpper[idx];
          sy = y1 + (y2 - y1) * (mx - x1) / (x2 - x1);
        }
      } else {
        // lower surface
        const idx = slaveX.slice(splitIdx + 1).findIndex(x => x >= mx);
        const realIdx = idx === -1 ? slave.length - 1 : splitIdx + 1 + idx;
        if (realIdx <= splitIdx + 1) sy = slaveYLower[0];
        else {
          const prev = slave[realIdx - 1], curr = slave[realIdx];
          sy = prev[1] + (curr[1] - prev[1]) * (mx - prev[0]) / (curr[0] - prev[0]);
        }
      }
      result.push([mx, sy]);
    }
    return result;
  }

  private rotate(points: [number, number][], degrees: number): [number, number][] {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return points.map(([x, y]) => [
      x * cos - y * sin,
      x * sin + y * cos
    ]);
  }

  async generate(
    rootDatContent: string,
    tipDatContent: string
  ): Promise<GCodeResult> {
    this.rootProfile = await this.loadAirfoil(rootDatContent);
    this.tipProfile = await this.loadAirfoil(tipDatContent);

    // Resample to same point count
    if (this.rootProfile.length !== this.tipProfile.length) {
      if (this.rootProfile.length > this.tipProfile.length) {
        this.tipProfile = this.resample(this.rootProfile, this.tipProfile);
      } else {
        this.rootProfile = this.resample(this.tipProfile, this.rootProfile);
      }
    }

    // Apply washout
    if (this.params.washout !== 0) {
      this.tipProfile = this.rotate(this.tipProfile, -this.params.washout);
    }

    const { wingspan, rootChord, tipChord, leadingEdgeSweep, gantryLength } = this.params;
    const gap = (gantryLength - wingspan) / 2;
    const teoff = rootChord - leadingEdgeSweep - tipChord;
    const sweepRad1 = Math.atan(leadingEdgeSweep / wingspan);
    const sweepRad2 = Math.atan(teoff / wingspan);

    const E1 = Math.tan(sweepRad1) * gap;
    const E2 = Math.tan(sweepRad2) * gap;
    const _waste = teoff < 0 ? E1 : E2;
    const toffset = E2 + Math.tan(sweepRad2) * (wingspan + gap);

    const rootLength = rootChord + E1 + E2;
    const tipLength = rootChord - Math.tan(sweepRad1) * (wingspan + gap) - Math.tan(sweepRad2) * (wingspan + gap);

    // Scale profiles
    const scaleProfile = (pts: [number, number][], length: number) =>
      pts.map(([x, y]) => [x * length, y * length]);

    const rootScaled = scaleProfile(this.rootProfile, rootLength) as [number, number][];
    const tipScaled = scaleProfile(this.tipProfile, tipLength < 0 ? rootLength : tipLength) as [number, number][];

    // Trailing edge limit
    const n = Math.floor(rootScaled.length / 4);
    for (let i = 0; i < n; i++) {
      const top = rootScaled[i][1];
      const bot = rootScaled[rootScaled.length - 1 - i][1];
      if (top - bot < this.params.trailingEdgeLimit) {
        rootScaled[i][1] = bot + this.params.trailingEdgeLimit;
      }
      const ttop = tipScaled[i][1];
      const tbot = tipScaled[tipScaled.length - 1 - i][1];
      if (ttop - tbot < this.params.trailingEdgeLimit) {
        tipScaled[i][1] = tbot + this.params.trailingEdgeLimit;
      }
    }

    // Calculate start height
    const rootMax = Math.max(...rootScaled.map(p => p[1]));
    const rootMin = Math.min(...rootScaled.map(p => p[1]));
    const actualThickness = rootMax - rootMin;
    const sp = actualThickness < this.params.foamThickness
      ? (this.params.foamThickness - actualThickness) / 2 - rootMin
      : -rootMin + 5;

    const header = [
      `%`,
      this.params.unit === 1 ? `G20` : `G21`,
      `G90`,
      `F${this.params.feedrate}`,
      `(Model: ${this.params.modelName})`,
      `(Wingspan: ${wingspan}${this.unitStr}, Root: ${rootChord}, Tip: ${tipChord})`,
      `(Sweep: ${leadingEdgeSweep}, Washout: ${this.params.washout}°)`,
    ].join('\n');

    const generateSide = (primary: [number, number][], secondary: [number, number][], invert: number): string => {
      const lines: string[] = [header];
      const isGRBL = this.params.mode === 'xyuz_grbl';
      const useV = this.params.mode === 'xyuv' && !isGRBL;

      let xOffset = toffset >= 0 ? 0 : -toffset;
      let uOffset = toffset >= 0 ? toffset : 0;

      if (this.params.xySide === 1) [xOffset, uOffset] = [uOffset, xOffset];

      const startX = primary[0][0] + xOffset;
      const startY = sp + primary[0][1] * invert;
      const startU = secondary[0][0] + uOffset;
      const startV = sp + secondary[0][1] * invert;

      lines.push(`G0 X${this.fmt(this.safeZ)} Y${this.fmt(startY)} U${this.fmt(this.safeZ)} ${useV ? `V${this.fmt(startV)}` : ''}`);

      if (toffset !== 0) {
        lines.push(`G1 X${this.fmt(startX)} Y${this.fmt(startY)} U${this.fmt(startU)} ${useV ? `V${this.fmt(startV)}` : ''}`);
      }

      for (let i = 0; i < primary.length; i++) {
        const px = primary[i][0] + xOffset;
        const py = sp + primary[i][1] * invert;
        const ux = secondary[i][0] + uOffset;
        const uy = sp + secondary[i][1] * invert;
        lines.push(`G1 X${this.fmt(px)} Y${this.fmt(py)} U${this.fmt(ux)} ${useV ? `V${this.fmt(uy)}` : ''}`);
      }

      lines.push(`G1 X${this.fmt(startX)} Y${this.fmt(startY)} U${this.fmt(startU)} ${useV ? `V${this.fmt(startV)}` : ''}`);
      lines.push(`G0 X${this.fmt(this.safeZ * 2)} Y${this.fmt(this.safeZ)} U${this.fmt(this.safeZ * 2)} ${useV ? `V${this.fmt(this.safeZ)}` : ''}`);
      lines.push(`M5`, `M30`, `%`);
      return lines.join('\n');
    };

    const gcodeLeft = this.params.xySide === 0
      ? generateSide(rootScaled, tipScaled, 1)
      : generateSide(tipScaled, rootScaled, 1);

    const gcodeRight = this.params.xySide === 0
      ? generateSide(tipScaled, rootScaled, 1)
      : generateSide(rootScaled, tipScaled, 1);

    const canBoth = this.params.foamThickness > actualThickness * 2 + 20;
    const gcodeBoth = canBoth
      ? generateSide(rootScaled, tipScaled, 1) + '\n' + generateSide(rootScaled, tipScaled, -1)
      : '';

    return {
      gcodeLeft,
      gcodeRight,
      gcodeBoth,
      message: canBoth ? 'All files generated' : 'Foam too thin for BOTH cut'
    };
  }

  // 便捷方法：下载文件
  download(file: 'left' | 'right' | 'both', content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, `${this.params.modelName}-${file}.nc`);
  }
}