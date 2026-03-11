
import { useCallback } from 'react';
import { useWing } from './useWing';
import { airfoilPointsGenerator } from '../services/airfoilPointsGenerator';

export function useGenerateAirfoilPoints() {
  const { model } = useWing();
  // 返回统一的异步点集生成器
  return useCallback(() => airfoilPointsGenerator(model), [model]);
}

export default useGenerateAirfoilPoints;
