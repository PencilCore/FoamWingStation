import { useMemo } from 'react';
import type { WingModel } from '../types/wing.model';

export interface FoamHeightInfo {
  /** 根部所需的最大厚度 */
  rootMax: number;
  /** 尖部所需的最大厚度 */
  tipMax: number;
  /** 总体所需的最小泡沫块厚度 */
  required: number;
  /** 当前设置是否足够 */
  isAdequate: boolean;
  /** 警告信息 */
  warning?: string;
}

/**
 * 从翼型文件名中提取厚度百分比
 * 例如：NACA2412.dat -> 12（表示12%厚度）
 */
function extractThicknessFromAirfoilName(airfoilName: string): number {
  if (!airfoilName) return 12; // 默认值
  
  // NACA 四位数翼型：NACAXXTT，后两位是厚度百分比
  const match = airfoilName.match(/naca(\d{4})/i);
  if (match) {
    return parseInt(match[1].substring(2), 10) || 12;
  }
  
  return 12; // 默认值
}

/**
 * 计算所需的泡沫块最小厚度
 * @param model 翼模型参数
 * @returns 泡沫高度信息
 */
export function useRequiredFoamHeight(model: WingModel): FoamHeightInfo {
  return useMemo(() => {
    try {
      // 从翼型名提取厚度百分比
      const rootAirfoilThickness = extractThicknessFromAirfoilName(model.rootAirfoil);
      const tipAirfoilThickness = extractThicknessFromAirfoilName(model.tipAirfoil);

      // 计算根部所需厚度：弦长 × 翼型厚度百分比 × 根部厚度百分比
      const rootMax = (model.rootChord * rootAirfoilThickness / 100) * (model.rootThickness / 100);

      // 计算尖部所需厚度：弦长 × 翼型厚度百分比 × 尖部厚度百分比
      const tipMax = (model.tipChord * tipAirfoilThickness / 100) * (model.tipThickness / 100);

      // 所需的泡沫块厚度是两者之中的最大值
      const required = Math.max(rootMax, tipMax);
      const isAdequate = model.foamThickness >= required;

      // 生成警告信息
      let warning: string | undefined;
      const margin = model.foamThickness - required;

      if (!isAdequate) {
        warning = `泡沫块厚度不足 ${(required - model.foamThickness).toFixed(1)} mm，建议增加到至少 ${required.toFixed(1)} mm。`;
      } else if (margin < 5) {
        warning = `泡沫块厚度余量较小（仅 ${margin.toFixed(1)} mm），建议留至少 5-10 mm 的安全余量。`;
      }

      return {
        rootMax,
        tipMax,
        required,
        isAdequate,
        warning
      };
    } catch (err) {
      // 如果计算失败，返回安全值
      console.warn('Failed to compute required foam height:', err);
      return {
        rootMax: 0,
        tipMax: 0,
        required: 0,
        isAdequate: true
      };
    }
  }, [
    model.rootAirfoil,
    model.tipAirfoil,
    model.rootChord,
    model.tipChord,
    model.rootThickness,
    model.tipThickness,
    model.foamThickness
  ]);
}

export default useRequiredFoamHeight;
