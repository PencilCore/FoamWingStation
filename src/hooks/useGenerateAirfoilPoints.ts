
import { useCallback } from 'react';
import { useWing } from './useWing';
import { airfoilPointsGenerator } from '../services/airfoilPointsGenerator';

// 只影响翼型点几何的字段 —— 改 wingSpan/龙门架/机床等无关参数时
// 不再重新生成翼型点（避免 3D 预览 basePoints 引用变化 → 全链路重算）
const AIRFOIL_FIELDS: (keyof import('../types/wing.model').WingModel)[] = [
  'rootAirfoil', 'tipAirfoil', 'rootChord', 'tipChord',
  'rootRotation', 'tipRotation', 'rootOffsetX', 'rootOffsetY',
  'tipOffsetX', 'tipOffsetY', 'rootThickness', 'tipThickness',
  'useNacaGenerator', 'nacaDigitsRoot', 'nacaDigitsTip',
  'leadingEdgeSweep', 'trailingEdgeSweep',
];

export function useGenerateAirfoilPoints() {
  const { model } = useWing();
  // 返回统一的异步点集生成器
  return useCallback(() => airfoilPointsGenerator(model), AIRFOIL_FIELDS.map(f => model[f]));
}

export default useGenerateAirfoilPoints;
