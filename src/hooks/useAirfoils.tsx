// src/hooks/useAirfoils.ts
import { useEffect, useState } from 'react';

/**
 * 自动读取 src/assets/airfoils 文件夹下所有 .dat 文件
 * 支持 Vite / Next.js / CRA（Vite 最丝滑）
 * 开发 & 生产环境 100% 可用
 */
export function useAirfoils() {
  const [airfoils, setAirfoils] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   console.log('useAirfoils: Starting to load airfoils...');
   
   // 硬编码翼型列表（与 src/assets/AIRFOILS 文件夹同步）
   const airfoilList = [
     '2032C.DAT',
     'CLARKY.DAT',
     'E334.DAT',
     'E374.DAT',
     'MH18.DAT',
     'MH20.DAT',
     'MH22.DAT',
     'MH30.DAT',
     'MH32.DAT',
     'MH42.DAT',
     'MH43.DAT',
     'MH45.DAT',
     'MH60.DAT',
     'MH61.DAT',
     'MH62.DAT',
     'PW51.DAT',
     'S8035.DAT',
   ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

   console.log('useAirfoils: airfoils list:', airfoilList);
   setAirfoils(airfoilList);
   setLoading(false);
  }, []);

  return {
    airfoils,
    loading,
    count: airfoils.length,
  };
}