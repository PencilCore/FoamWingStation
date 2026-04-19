// src/services/gcodeGenerator.ts

import type { WingModel } from '../types/wing.model';
import type { GeneratedAirfoilPoints } from './airfoilPointsGenerator';
import { airfoilPointsGenerator } from './airfoilPointsGenerator';
import { calculateWingPath } from './pathEngine';
import type { WingPathResult } from './pathEngine';
import type { Point } from './pathOverlapDetector';

export interface GcodeResult {
  left: string;
  right: string;
  both: string;
  warnings: string[];
}

/**
 * 核心 G-code 生成逻辑
 */
function wingsurfaceGcodeGen(
  rootPoints: [number, number][], 
  tipPoints: [number, number][], 
  model: WingModel, 
  warnings: string[],
  isRightWing: boolean = false,
  extraShiftX: number = 0,
  extraShiftY: number = 0,
  isNested: boolean = false,
  options: { 
    skipHeader?: boolean, 
    skipLeadIn?: boolean, 
    skipLeadOut?: boolean, 
    skipHome?: boolean,
    targetStartPos?: {x:number, y:number, u:number, z:number} 
  } = {}
): { 
  gcode: string[], 
  width: number, 
  height: number, 
  lastPos: {x:number,y:number,u:number,z:number}, 
  firstPos: {x:number,y:number,u:number,z:number},
  pathPoints: { x: Point[], u: Point[] }
} {
  const path: WingPathResult = calculateWingPath(rootPoints, tipPoints, model, isRightWing, extraShiftX, extraShiftY, isNested);
  const { orderedPoints, shiftX, shiftY, width, height } = path;
  
  const gcode: string[] = [];
  const feedrate = Math.min(model.feedrate || 300, 1200);
  const mm = (v: number) => (model.unit === 'inch' ? v * 25.4 : v);

  const formatG1 = (x: number, y: number, u: number, z: number, comment = '') => {
    const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z'];
    const parts = [
      `${axes[0]}${(x + shiftX).toFixed(3)}`,
      `${axes[1]}${(y + shiftY).toFixed(3)}`,
      `${axes[2]}${(u + shiftX).toFixed(3)}`,
      `${axes[3]}${(z + shiftY).toFixed(3)}`
    ];
    return `G1 ${parts.join(' ')} F${feedrate}${comment ? ' ; ' + comment : ''}`;
  };

  if (!options.skipHeader) {
    gcode.push('G21 ; Units: mm');
    gcode.push('G90 ; Absolute positioning');
    gcode.push(`G1 F${feedrate}`);
  }

  const finalMinX = path.minX + shiftX, finalMaxX = path.minX + width + shiftX, finalMinY = path.minY + shiftY, finalMaxY = path.minY + height + shiftY;
  const mWidth = mm(model.machineWidth || 1000), mHeight = mm(model.machineHeight || 500);
  if (finalMinX < -0.01 || finalMaxX > mWidth + 0.01 || finalMinY < -0.01 || finalMaxY > mHeight + 0.01) {
    warnings.push(`警告 [${isRightWing ? '右翼' : '左翼'}]: 切割路径超出范围! X:[${finalMinX.toFixed(1)}, ${finalMaxX.toFixed(1)}] Y:[${finalMinY.toFixed(1)}, ${finalMaxY.toFixed(1)}]`);
  }

  const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z'];
  const homePos = `G1 ${axes[0]}0.000 ${axes[1]}0.000 ${axes[2]}0.000 ${axes[3]}0.000`;
  if (!options.skipHome) gcode.push(`${homePos} ; Home`);
  
  let firstPos = { x: 0, y: 0, u: 0, z: 0 };
  let lastPos = { x: 0, y: 0, u: 0, z: 0 };

  if (orderedPoints.length > 0) {
    const p0 = orderedPoints[0];
    firstPos = { x: p0.x + shiftX, y: p0.y + shiftY, u: p0.u + shiftX, z: p0.z + shiftY };
    if (!options.skipLeadIn) gcode.push(formatG1(p0.x, p0.y, p0.u, p0.z, 'Lead-in'));
    for (let i = 1; i < orderedPoints.length; i++) {
        const pt = orderedPoints[i];
        gcode.push(formatG1(pt.x, pt.y, pt.u, pt.z));
    }
    const lastPt = orderedPoints[orderedPoints.length - 1];
    lastPos = { x: lastPt.x + shiftX, y: lastPt.y + shiftY, u: lastPt.u + shiftX, z: lastPt.z + shiftY };
  }

  if (!options.skipLeadOut && !options.skipHome) {
    gcode.push(`${homePos} ; Lead-out to Home`);
    lastPos = { x: 0, y: 0, u: 0, z: 0 };
  }

  const finalPathPoints = {
    x: orderedPoints.map(p => ({ x: p.x + shiftX, y: p.y + shiftY })),
    u: orderedPoints.map(p => ({ x: p.u + shiftX, y: p.z + shiftY }))
  };

  return { gcode, width, height, lastPos, firstPos, pathPoints: finalPathPoints };
}

/**
 * 异步生成 G-code 函数
 */
export async function generateGcode(model: WingModel): Promise<GcodeResult> {
  const warnings: string[] = [];

  try {
    const { root, tip }: GeneratedAirfoilPoints = await airfoilPointsGenerator(model);
    
    const rootProfile: [number, number][] = root.points.map(p => [p.x, p.y]);
    const tipProfile: [number, number][] = tip.points.map(p => [p.x, p.y]);

    // 生成左翼 (通常为基础)
    const leftRes = wingsurfaceGcodeGen(rootProfile, tipProfile, model, warnings, false);
    
    // 生成右翼 (镜像但无额外偏移，用于单翼文件)
    const rightRes = wingsurfaceGcodeGen(rootProfile, tipProfile, model, warnings, true);

    let bothGcodeLines: string[] = leftRes.gcode;

    if (model.generateBoth) {
      const isVert = model.stackingMode === 'vertical';
      const extraX = isVert ? (model.interWingOffsetX || 0) : (leftRes.width + (model.interWingOffsetX || 50));
      const extraY = isVert ? (leftRes.height + (model.interWingOffsetY || 20)) : (model.interWingOffsetY || 0);

      // 第一片机翼
      const firstWing = wingsurfaceGcodeGen(rootProfile, tipProfile, model, warnings, false, 0, 0, false, { 
        skipLeadOut: true, skipHome: true 
      });

      // 第二片机翼
      const secondWing = wingsurfaceGcodeGen(rootProfile, tipProfile, model, warnings, true, extraX, extraY, model.nestBoth, {
        skipHeader: true, skipHome: true, skipLeadIn: true
      });

      const axes = model.xyuvMode || ['X','Y','U','Z'];
      // 强制安全高度至少高出泡沫 10mm
      const sH = Math.max(model.safeHeight || 50, model.foamThickness + 10);
      
      const transition = [
        '\n; --- Safe Outer Perimeter Transition ---',
        // 1. 在当前点位置垂直抬升
        `G1 ${axes[1]}${sH.toFixed(3)} ${axes[3]}${sH.toFixed(3)} F1000 ; Lift up`,
        // 2. 先移动到后方安全坐标 (最大 X 之外)，确保绕过泡沫，而不是从中间穿过
        `G1 ${axes[0]}${(Math.max(firstWing.lastPos.x, secondWing.firstPos.x) + 20).toFixed(3)} ${axes[2]}${(Math.max(firstWing.lastPos.u, secondWing.firstPos.u) + 20).toFixed(3)} F1200 ; Move to outer safety margin`,
        // 3. 水平平移到第二片起始 X 位置
        `G1 ${axes[0]}${secondWing.firstPos.x.toFixed(3)} ${axes[2]}${secondWing.firstPos.u.toFixed(3)} F1200 ; Align with second wing start`,
        // 4. 下隆到起刀高度
        `G1 ${axes[1]}${secondWing.firstPos.y.toFixed(3)} ${axes[3]}${secondWing.firstPos.z.toFixed(3)} F800 ; Descent`,
      ];

      bothGcodeLines = [
        ...firstWing.gcode,
        ...transition,
        ...secondWing.gcode,
        '\n; --- Final Reset to Home ---',
        `G1 ${axes[1]}${sH} ${axes[2]}${sH} F1000 ; Final Lift`,
        `G1 ${axes[0]}0 ${axes[1]}0 ${axes[2]}0 ${axes[3]}0 F1200 ; Return Home`
      ];
    }

    return {
      left: leftRes.gcode.join('\n'),
      right: rightRes.gcode.join('\n'),
      both: bothGcodeLines.join('\n'),
      warnings,
    };

  } catch (error) {
    console.error('❌ [gcodeGenerator] Failed:', error);
    const msg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return { 
      left: msg, 
      right: msg, 
      both: msg, 
      warnings: [msg] 
    };
  }
}
