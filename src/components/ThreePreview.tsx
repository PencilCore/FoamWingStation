// src/components/ThreePreview.tsx
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
// 保留 OrbitControls, Grid
import { OrbitControls, Grid, Text, Line as DreiLine } from '@react-three/drei' 
import { useWing } from '../hooks/useWing'
import * as THREE from 'three'
import { useGenerateAirfoilPoints } from '../hooks/useGenerateAirfoilPoints'
import { ToggleButton, ToggleButtonGroup, Box } from '@mui/material'
import { calculateWingPath } from '../services/pathEngine'

// 彻底干掉 adoptedStyleSheets 报错（加在文件最上面）
if (typeof document !== 'undefined') {
  // @ts-ignores
  document.adoptedStyleSheets = document.adoptedStyleSheets || []
}

/** 从 G-code 字符串解析出 XY 和 UZ 平面路径点 */
function parseGcodeToPath(gcode: string, axes: string[], gd: number): { root: THREE.Vector3[], tip: THREE.Vector3[] } {
  const rootPts: THREE.Vector3[] = [];
  const tipPts: THREE.Vector3[] = [];
  const lines = gcode.split('\n');
  
  for (const line of lines) {
    const t = line.trim();
    // 匹配 G0 或 G1 指令
    if (!/^G[01]\b/i.test(t)) continue;
    
    const getVal = (axis: string) => {
      const m = t.match(new RegExp(`${axis}([\\-\\d.]+)`, 'i'));
      return m ? parseFloat(m[1]) : NaN;
    };
    
    const x = getVal(axes[0]), y = getVal(axes[1]), u = getVal(axes[2]), z = getVal(axes[3]);
    if (isNaN(x) && isNaN(y) && isNaN(u) && isNaN(z)) continue;
    
    // 使用上一个点的坐标作为默认（增量式逻辑简化：用第一个有效点填充）
    const prevR = rootPts.length > 0 ? rootPts[rootPts.length - 1] : new THREE.Vector3(0, 0, 0);
    const prevT = tipPts.length > 0 ? tipPts[tipPts.length - 1] : new THREE.Vector3(0, 0, gd);
    
    const rx = isNaN(x) ? prevR.x : x;
    const ry = isNaN(y) ? prevR.y : y;
    const ux = isNaN(u) ? prevT.x : u;
    const uz = isNaN(z) ? prevT.y : z;
    
    rootPts.push(new THREE.Vector3(rx, ry, 0));
    tipPts.push(new THREE.Vector3(ux, uz, gd));
  }
  return { root: rootPts, tip: tipPts };
}

function FoamBlock({ width, height, offsetX = 0, offsetY = 0 }: { width: number, height: number, offsetX: number, offsetY: number }) {
  const { model } = useWing()
  const { wingSpan, foamOffsetZ = 0 } = model
  
  const hx = offsetX + width / 2
  const hy = offsetY + height / 2
  const hz = foamOffsetZ + wingSpan / 2

  // 生成泡沫材质噪声纹理
  const foamTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 底色
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(0, 0, size, size);

    // 随机噪点（泡沫孔洞）
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 30;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    // 随机泡沫孔洞（小圆点）
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 1 + Math.random() * 4;
      const alpha = 0.1 + Math.random() * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 140, 110, ${alpha})`;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  return (
    <mesh position={[hx, hy, hz]}> 
      <boxGeometry args={[width, height, wingSpan]} />
      <meshStandardMaterial 
        color="#f5e6c8"
        map={foamTexture}
        transparent 
        opacity={0.18} 
        roughness={0.9}
        metalness={0}
        polygonOffset 
        polygonOffsetFactor={1} 
        polygonOffsetUnits={1}
        depthWrite={false}
      />
    </mesh>
  )
}

/** 跟随刀头移动的马达模拟盒 — 每塔 X/Y 双马达 + 丝杆 */
function LiveMotorBox({ viewMode, leftData, rightData, bothData, percent, gantryDistance }: {
  viewMode: 'left' | 'right' | 'both';
  leftData: any; rightData: any; bothData?: any;
  percent: number; gantryDistance: number;
}) {
  const { model } = useWing()
  const { machineHeight = 600 } = model

  const getPos = (path: THREE.Vector3[], pct: number) => {
    if (!path?.length) return { x: 0, y: 0 };
    const idx = Math.max(0, Math.min(path.length - 1, Math.floor(pct * (path.length - 1))));
    return { x: path[idx]?.x ?? 0, y: path[idx]?.y ?? 0 };
  };
  
  let leftPos: { x: number, y: number }, rightPos: { x: number, y: number };
  if (viewMode === 'both' && bothData) {
    leftPos = getPos(bothData.fullPathRoot, percent / 100);
    rightPos = getPos(bothData.fullPathTip, percent / 100);
  } else {
    const data = viewMode === 'left' ? leftData : rightData;
    leftPos = getPos(data?.fullPathRoot, percent / 100);
    rightPos = getPos(data?.fullPathTip, percent / 100);
  }
  
  const SCALE = 3;
  const xMotorW = 40 * SCALE, xMotorH = 20 * SCALE, xMotorD = 16 * SCALE;  // X 轴马达：宽扁
  const yMotorW = 24 * SCALE, yMotorH = 36 * SCALE, yMotorD = 16 * SCALE;  // Y 轴马达：窄高
  const PLATFORM_TOP_Y = 2;  // 切割平台顶面 Y 坐标（来自 Machine4Axis 底板）
  // X 轴马达顶部在平台下方 yMotorH 距离，与 Y 轴马达保持间距
  const xMotorTopY = PLATFORM_TOP_Y - yMotorH;
  const xMotorCenterY = xMotorTopY - xMotorH / 2;
  
  return (
    <group>
      {/* ===== 左塔 ===== */}
      {/* 丝杆 — 垂直穿过 X/Y 马达，长度与机台高度一致 */}
      <mesh position={[leftPos.x, machineHeight / 2, -xMotorD / 2]}>
        <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* X 轴马达 — 在平台下方 yMotorH 距离，顶部与 Y 马达保持间距 */}
      <mesh position={[leftPos.x, xMotorCenterY, -xMotorD / 2]}>
        <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Y 轴马达 — 顶部中心与路径点平齐（点位于马达顶面中心） */}
      <mesh position={[leftPos.x, leftPos.y - yMotorH / 2, -yMotorD / 2]}>
        <boxGeometry args={[yMotorW, yMotorH, yMotorD]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* ===== 右塔 ===== */}
      {/* 丝杆 — 垂直穿过 X/Y 马达 */}
      <mesh position={[rightPos.x, machineHeight / 2, gantryDistance + xMotorD / 2]}>
        <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* X 轴马达 — 在平台下方 yMotorH 距离 */}
      <mesh position={[rightPos.x, xMotorCenterY, gantryDistance + xMotorD / 2]}>
        <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Y 轴马达 — 顶部中心与路径点平齐 */}
      <mesh position={[rightPos.x, rightPos.y - yMotorH / 2, gantryDistance + yMotorD / 2]}>
        <boxGeometry args={[yMotorW, yMotorH, yMotorD]} />
        <meshStandardMaterial color="#fb923c" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

function WingOutline({ points, color = '#2196f3', opacity = 1 }: { points: THREE.Vector3[]; color?: string; opacity?: number }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  useEffect(() => {
    if (!geometryRef.current || points.length < 2) return
    const positions = new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))
    geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometryRef.current.computeBoundingSphere()
    geometryRef.current.computeBoundingBox()
    geometryRef.current.attributes.position.needsUpdate = true
  }, [points])

  if (points.length < 2) return null

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={true}
      />
    </line>
  )
}

function Hotwire({ realPos }: { realPos: { X: number; Y: number; U: number; Z: number } }) {
  const { model } = useWing();
  const { gantryDistance = 1200 } = model;
  
  // 修正 3D 界面坐标同步：
  // 左塔：实时的 X 对应 X 轴，实时的 Y 对应 Y 轴，位于 Z=0
  // 右塔：实时的 Z 对应 X 轴，实时的 U 对应 Y 轴，位于 Z=gantryDistance
  // (之前 UZ 的实时点显示相反，现已对调)
  const left = new THREE.Vector3(realPos.X, realPos.Y, 0);
  const right = new THREE.Vector3(realPos.Z, realPos.U, gantryDistance);

  return (
    <group>
      {/* 实时位置热丝 - 亮黄色 */}
      <mesh position={left.toArray()} frustumCulled={false}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} depthTest={false} />
      </mesh>
      <mesh position={right.toArray()}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} depthTest={false} />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              left.x, left.y, left.z,
              right.x, right.y, right.z,
            ])}
            itemSize={3}
            args={[new Float32Array([
              left.x, left.y, left.z,
              right.x, right.y, right.z,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffff00" linewidth={3} depthTest={false} />
      </line>
    </group>
  );
}

export default function ThreePreview() {
  const { model } = useWing()
  const { wingSpan, foamChord, foamThickness, gantryDistance = 1200 } = model
  const [viewMode, setViewMode] = useState<'left' | 'right' | 'both'>('right')
  
  // 1. 获取基础翼型点 (未经 G-code 移位处理的原始几何)
  const generatedAirfoilPoints = useGenerateAirfoilPoints()
  const [basePoints, setBasePoints] = useState<{ root: THREE.Vector3[], tip: THREE.Vector3[] } | null>(null)
  const loadTokenRef = useRef(0)
  const [realPos, setRealPos] = useState({ X: 0, Y: 0, U: 0, Z: 0 })
  const [percent, setPercent] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const startTimeRef = useRef(0)
  const internalDistRef = useRef(0)
  const sliderRef = useRef<HTMLInputElement>(null)
  const progressTextRef = useRef<HTMLSpanElement>(null)
  const ANIMATION_SPEED_MM_PER_SEC = 100

  useEffect(() => {
    let active = true
    const token = ++loadTokenRef.current
    ;(async () => {
      try {
        const gen = await generatedAirfoilPoints()
        if (!active || token !== loadTokenRef.current) return
        
        const foamZStart = model.foamOffsetZ || 0
        const foamZEnd = foamZStart + wingSpan
        
        const rPts = (gen.root?.points || []).map(p => new THREE.Vector3(p.x, p.y, foamZStart))
        const tPts = (gen.tip?.points || []).map(p => new THREE.Vector3(p.x, p.y, foamZEnd))
        setBasePoints({ root: rPts, tip: tPts })
      } catch (e) { /* ignore */ }
    })()
    return () => { active = false }
  }, [generatedAirfoilPoints, wingSpan, model.foamOffsetZ])

  // 2. 计算投影、移位和最终点位
  const processedData = useMemo(() => {
    if (!basePoints) return null
    const { root: rootPts, tip: tipPts } = basePoints
    
    const foamZStart = model.foamOffsetZ || 0
    const span = wingSpan || 600
    const gd = gantryDistance || 1200
    
    // Z 轴翻转逻辑
    const zRoot = model.flipZ ? foamZStart + span : foamZStart;
    const zTip = model.flipZ ? foamZStart : foamZStart + span;

    const rootXY: [number, number][] = rootPts.map(p => [p.x, p.y]);
    const tipXY: [number, number][] = tipPts.map(p => [p.x, p.y]);

    // --- Helper 函数 ---
    const toV3 = (x: number, y: number, z: number) => new THREE.Vector3(x || 0, y || 0, z || 0);

    // --- 计算镜像与偏移逻辑 (同步 G-code) ---
    const getPoints = (isRight: boolean, xOffset = 0, yOffset = 0, isNested = false) => {
      const path = calculateWingPath(rootXY, tipXY, model, isRight, xOffset, yOffset, isNested);
      const { orderedPoints, shiftX, shiftY, width, height } = path;

      const gR = orderedPoints.map(p => toV3(p.x + shiftX, p.y + shiftY, 0));
      const gT = orderedPoints.map(p => toV3(p.u + shiftX, p.z + shiftY, gd));

      const winR = orderedPoints.map(p => {
        const ratio = (zRoot - 0) / gd;
        return toV3(p.x + (p.u - p.x) * ratio + shiftX, p.y + (p.z - p.y) * ratio + shiftY, zRoot);
      });
      const winT = orderedPoints.map(p => {
        const ratio = (zTip - 0) / gd;
        return toV3(p.x + (p.u - p.x) * ratio + shiftX, p.y + (p.z - p.y) * ratio + shiftY, zTip);
      });

      return {
        wingRoot: winR,
        wingTip: winT,
        gantryRoot: gR,   // 龙门架左端点路径（XY 平面，Z=0）
        gantryTip: gT,    // 龙门架右端点路径（UZ 平面，Z=gd）
        fullPathRoot: [toV3(0, 0, 0), ...gR, toV3(0, 0, 0)],
        fullPathTip: [toV3(0, 0, gd), ...gT, toV3(0, 0, gd)],
        width,
        height
      };
    };

    const leftData = getPoints(false); // 原始左翼 (偏移 0,0)
    const rightDataBase = getPoints(true); // 原始右翼 (偏移 0,0)
    
    // 计算双翼模式下的右翼偏移位置
    const isVert = model.stackingMode === 'vertical';
    // 垂直堆叠：X 偏移 = interWingOffsetX（两翼X对齐，仅微小调整），Y 偏移 = 上翼高度 + 间隙
    // 水平堆叠：X 偏移 = 左翼宽度 + 间隙，Y 偏移 = interWingOffsetY（两翼Y对齐，仅微小调整）
    const xGap = isVert ? (model.interWingOffsetX ?? 0) : (leftData.width + (model.interWingOffsetX ?? 50));
    const yShift = isVert ? (leftData.height + (model.interWingOffsetY ?? 30)) : (model.interWingOffsetY ?? 0);
    const rightDataOffset = getPoints(true, xGap, yShift, !!model.nestBoth); 

    // 构建平面内过渡路径：翼1终点 → 原点(0,0) → 翼2起点
    const w1EndR = leftData.gantryRoot[leftData.gantryRoot.length - 1];
    const w1EndT = leftData.gantryTip[leftData.gantryTip.length - 1];
    const w2StartR = rightDataOffset.gantryRoot[0];
    const w2StartT = rightDataOffset.gantryTip[0];

    // 默认过渡路径（当 G-code 数据不可用时使用）
    const defaultBothRoot = [
      toV3(0, 0, 0),
      ...leftData.gantryRoot,
      w1EndR, toV3(0, 0, 0), w2StartR,
      ...rightDataOffset.gantryRoot,
      toV3(0, 0, 0)
    ];
    const defaultBothTip = [
      toV3(0, 0, gd),
      ...leftData.gantryTip,
      w1EndT, toV3(0, 0, gd), w2StartT,
      ...rightDataOffset.gantryTip,
      toV3(0, 0, gd)
    ];

    // 优先使用 G-code 解析的路径（保证与导出 G-code 完全一致）
    let bothPathRoot = defaultBothRoot;
    let bothPathTip = defaultBothTip;
    if (model.previewGcodeData?.both) {
      const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z'];
      const parsed = parseGcodeToPath(model.previewGcodeData.both, axes, gd);
      if (parsed.root.length > 0) {
        bothPathRoot = parsed.root;
        bothPathTip = parsed.tip;
      }
    }

    return {
      left: leftData,
      right: rightDataBase,
      rightOffset: rightDataOffset,
      both: {
        fullPathRoot: bothPathRoot,
        fullPathTip: bothPathTip
      },
      center: toV3(xGap / 2 + leftData.width / 2, yShift / 2, span / 2)
    }
  }, [
    basePoints, 
    gantryDistance, 
    model.flipZ, 
    model.mirrorX, 
    model.mirrorY,
    model.nestBoth,
    model.stackingMode,
    model.pathMargin,
    model.interWingOffsetX,
    model.interWingOffsetY,
    model.previewGcodeData,
    model.xyuvMode,
    wingSpan, 
    model.foamOffsetZ
  ])

  const { left, right, rightOffset } = processedData || {}

  useEffect(() => {
    const handleSerialData = (e: any) => {
      const line = e.detail.data as string
      const match = line.match(/<(?:[^|]+\|){1,2}WPos:([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)/)
      if (match) {
        setRealPos({
          X: parseFloat(match[1]),
          Y: parseFloat(match[2]),
          U: parseFloat(match[3]),
          Z: parseFloat(match[4]),
        })
      }
    }
    window.addEventListener('serial-data', handleSerialData)
    return () => window.removeEventListener('serial-data', handleSerialData)
  }, [])

  // OrbitControls 的目标设为移位后的机翼中心
  const centerTarget = useMemo(() => {
    if (left && right && rightOffset) {
       const isVert = model.stackingMode === 'vertical';
       const xGap = isVert ? (model.interWingOffsetX ?? 0) : (left.width + (model.interWingOffsetX ?? 50));
       const yShift = isVert ? (left.height + (model.interWingOffsetY ?? 30)) : (model.interWingOffsetY ?? 0);

       if (viewMode === 'both') {
          return new THREE.Vector3(xGap / 2 + 10, yShift / 2, wingSpan / 2);
       } else if (viewMode === 'right') {
          return new THREE.Vector3(xGap + 10, yShift, wingSpan / 2);
       } else {
          return new THREE.Vector3(left.width / 2 + 10, 0, wingSpan / 2);
       }
    }
    return new THREE.Vector3(foamChord / 2, foamThickness / 2, wingSpan / 2)
  }, [left, right, rightOffset, viewMode, model.interWingOffsetX, model.interWingOffsetY, model.stackingMode, foamChord, wingSpan, foamThickness])

  // 计算路径总长度（mm）
  const calcTotalDist = useCallback((paths: THREE.Vector3[][]): number => {
    let maxDist = 0;
    for (const path of paths) {
      let dist = 0;
      for (let i = 1; i < path.length; i++) {
        dist += path[i].distanceTo(path[i - 1]);
      }
      maxDist = Math.max(maxDist, dist);
    }
    return maxDist;
  }, []);

  // 获取当前视图的路径数组
  const getActivePaths = useCallback((): THREE.Vector3[][] => {
    if (viewMode === 'both' && processedData?.both) {
      return [processedData.both.fullPathRoot, processedData.both.fullPathTip];
    }
    const data = viewMode === 'left' ? processedData?.left : processedData?.right;
    if (data) {
      return [data.fullPathRoot, data.fullPathTip];
    }
    return [];
  }, [viewMode, processedData]);

  const totalDist = useMemo(() => calcTotalDist(getActivePaths()), [calcTotalDist, getActivePaths]);

  // 同步 percent → 内部距离值
  const percentToDist = useCallback((pct: number) => (pct / 100) * totalDist, [totalDist]);

  // 动画核心循环
  useEffect(() => {
    if (!isPlaying || totalDist <= 0) return;

    let animationFrameId: number;
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsedMs = time - startTimeRef.current;
      const currentDist = (elapsedMs / 1000) * ANIMATION_SPEED_MM_PER_SEC;

      if (currentDist >= totalDist) {
        // 播放完毕，循环
        startTimeRef.current = time;
        internalDistRef.current = 0;
        setPercent(0);
        if (sliderRef.current) sliderRef.current.value = '0';
        if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`;
      } else {
        internalDistRef.current = currentDist;
        const pct = (currentDist / totalDist) * 100;
        setPercent(pct);
        if (sliderRef.current) sliderRef.current.value = String(currentDist.toFixed(1));
        if (progressTextRef.current) progressTextRef.current.textContent = `${currentDist.toFixed(1)} / ${totalDist.toFixed(1)} mm`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDist]);

  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      // 从暂停恢复
      startTimeRef.current = performance.now() - (internalDistRef.current / ANIMATION_SPEED_MM_PER_SEC * 1000);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    internalDistRef.current = 0;
    setPercent(0);
    startTimeRef.current = performance.now();
    setIsPlaying(true);
    if (sliderRef.current) sliderRef.current.value = '0';
    if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`;
  }, [totalDist]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dist = Number(e.target.value);
    const pct = totalDist > 0 ? (dist / totalDist) * 100 : 0;
    internalDistRef.current = dist;
    setPercent(pct);
    if (progressTextRef.current) progressTextRef.current.textContent = `${dist.toFixed(1)} / ${totalDist.toFixed(1)} mm`;
  }, [totalDist]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#121212', border: '1px solid #2e2e2e', minHeight: 0, borderRadius: 12, overflow: 'hidden' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [
            centerTarget.x + Math.max(foamChord, wingSpan) * 1.2,
            centerTarget.y + Math.max(foamChord, wingSpan) * 0.8,
            centerTarget.z + Math.max(foamChord, wingSpan) * 0.6,
          ],
          fov: 35,
          near: 0.1,
          far: 10000,
          up: [0, 1, 0],
        }}
        shadows
      >
        
  {/* 移除雾效，保持视野清晰 */}

  {/* 灯光：明亮且干净的主光 + 补光 */}
  <ambientLight intensity={1.2} color="#ffffff" />
  <directionalLight
    position={[500, 800, 400]}
    intensity={6.0}
    color="#ffffff"
    castShadow
    shadow-mapSize-width={2048}
    shadow-mapSize-height={2048}
    shadow-bias={-0.001}
  />
  <directionalLight position={[-400, 300, -500]} intensity={2.5} color="#ffffff" />
  <directionalLight position={[0, -200, 500]} intensity={1.2} color="#e0f2fe" />
  <hemisphereLight intensity={0.8} color="#ffffff" groundColor="#94a3b8" />
  
  <OrbitControls
          makeDefault 
          target={centerTarget}
          enablePan={true}
          enableZoom={true}
          enableDamping={false}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
          panSpeed={0.8}
          minDistance={50}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.ROTATE
          }}
        />

        {/* 坐标轴保持不旋转 */}
        <Axes size={Math.max(foamChord, wingSpan, foamThickness, 200)} />

        <group rotation={[0, 0, 0]}>
          {/* 泡沫块 — 紧密包裹机翼 */}
          {left && right && (() => {
            const M = 5; // 紧贴边距
            const isBoth = viewMode === 'both';
            
            if (isBoth) {
              const pts1 = left.wingRoot;
              const pts2 = rightOffset?.wingRoot || right.wingRoot;
              if (!pts1.length && !pts2.length) return null;
              const allX = [...pts1.map(p => p.x), ...pts2.map(p => p.x)];
              const allY = [...pts1.map(p => p.y), ...pts2.map(p => p.y)];
              if (!allX.length) return null;
              const minX = Math.min(...allX), maxX = Math.max(...allX);
              const minY = Math.min(...allY), maxY = Math.max(...allY);
              return (
                <FoamBlock 
                  width={maxX - minX + M * 2} 
                  height={maxY - minY + M * 2} 
                  offsetX={minX - M} 
                  offsetY={minY - M} 
                />
              );
            }
            // 单翼模式
            const pts = (viewMode === 'right' ? right.wingRoot : left.wingRoot);
            if (!pts.length) return null;
            const allX = pts.map(p => p.x), allY = pts.map(p => p.y);
            const minX = Math.min(...allX), maxX = Math.max(...allX);
            const minY = Math.min(...allY), maxY = Math.max(...allY);
            return (
              <FoamBlock 
                width={maxX - minX + M * 2} 
                height={maxY - minY + M * 2} 
                offsetX={minX - M} 
                offsetY={minY - M} 
              />
            );
          })()}

          {/* 跟随刀头移动的马达盒 */}
          {left && right && rightOffset && (
            <LiveMotorBox
              viewMode={viewMode}
              leftData={left}
              rightData={viewMode === 'both' ? rightOffset : right}
              bothData={processedData?.both}
              percent={percent}
              gantryDistance={gantryDistance}
            />
          )}

          <Machine4Axis foamChord={foamChord} wingSpan={wingSpan} foamThickness={foamThickness} />
          
          {/* 右翼 (isRightWing=true) */}
          {(viewMode === 'right' || viewMode === 'both') && (viewMode === 'both' ? rightOffset : right) && (
            <group>
              {(() => {
                const r = viewMode === 'both' ? rightOffset : right;
                if (!r) return null;
                return (
                  <>
                    <WingSurface rootPts={r.wingRoot} tipPts={r.wingTip} color="#7c3aed" />
                    <WingEndCap points={r.wingRoot} color="#7c3aed" />
                    <WingEndCap points={r.wingTip} color="#7c3aed" />
                    <WingOutline points={r.wingRoot} color="#a78bfa" />
                    <WingOutline points={r.wingTip} color="#c4b5fd" />
                    {viewMode === 'right' && r.fullPathRoot.length > 0 && (
                      <>
                        <WingOutline points={r.fullPathRoot} color="#a78bfa" opacity={0.5} />
                        <WingOutline points={r.fullPathTip} color="#c4b5fd" opacity={0.5} />
                      </>
                    )}
                  </>
                );
              })()}
            </group>
          )}

          {/* 左翼 (isRightWing=false) */}
          {(viewMode === 'left' || viewMode === 'both') && left && (
            <group>
              <WingSurface rootPts={left.wingRoot} tipPts={left.wingTip} color="#7c3aed" />
              <WingEndCap points={left.wingRoot} color="#7c3aed" />
              <WingEndCap points={left.wingTip} color="#7c3aed" />
              <WingOutline points={left.wingRoot} color="#a78bfa" />
              <WingOutline points={left.wingTip} color="#c4b5fd" />
               {viewMode === 'left' && left.fullPathRoot.length > 0 && (
                <>
                  <WingOutline points={left.fullPathRoot} color="#a78bfa" opacity={0.5} />
                  <WingOutline points={left.fullPathTip} color="#c4b5fd" opacity={0.5} />
                </>
              )}
            </group>
          )}

          {/* 双翼模式下的完整路径 */}
          {viewMode === 'both' && processedData?.both && (
            <>
              <WingOutline points={processedData.both.fullPathRoot} color="#ef4444" opacity={0.8} />
              <WingOutline points={processedData.both.fullPathTip} color="#ef4444" opacity={0.8} />
            </>
          )}

          {/* 双翼模式翼面标签 */}
          {viewMode === 'both' && left && rightOffset && model.stackingMode === 'vertical' && (
            <>
              <Text
                position={[left.wingRoot[0]?.x - 15 || 0, (left.wingRoot[0]?.y || 0) + left.height / 2, wingSpan / 2]}
                fontSize={18}
                color="#a78bfa"
                anchorX="right"
                anchorY="middle"
                fillOpacity={0.8}
              >
                上翼 (先切)
              </Text>
              <Text
                position={[rightOffset.wingRoot[0]?.x - 15 || 0, (rightOffset.wingRoot[0]?.y || 0) + rightOffset.height / 2, wingSpan / 2]}
                fontSize={18}
                color="#38bdf8"
                anchorX="right"
                anchorY="middle"
                fillOpacity={0.8}
              >
                下翼 (后切)
              </Text>
            </>
          )}
          {viewMode === 'both' && left && rightOffset && model.stackingMode === 'horizontal' && (
            <>
              <Text
                position={[(left.wingRoot[0]?.x || 0) + left.width / 2, -20, wingSpan / 2]}
                fontSize={18}
                color="#a78bfa"
                anchorX="center"
                anchorY="middle"
                fillOpacity={0.8}
              >
                左翼 (先切)
              </Text>
              <Text
                position={[(rightOffset.wingRoot[0]?.x || 0) + rightOffset.width / 2, -20, wingSpan / 2]}
                fontSize={18}
                color="#38bdf8"
                anchorX="center"
                anchorY="middle"
                fillOpacity={0.8}
              >
                右翼 (后切)
              </Text>
            </>
          )}

          {/* 实时位置热丝 — 仅非双翼模式显示 */}
          {viewMode !== 'both' && <Hotwire realPos={realPos} />}
          
          {/* 预览热丝 — 鲜绿色，双翼模式用合并路径 */}
          {left && right && rightOffset && (
            <PreviewHotwire 
              leftData={left}
              rightData={viewMode === 'both' ? rightOffset : right}
              bothData={processedData?.both}
              viewMode={viewMode}
              percent={percent} 
            />
          )}
        </group>
      </Canvas>

      {/* 视图切换按钮 */}
      <Box sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 100,
        bgcolor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        p: '4px',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        backdropFilter: 'blur(8px)',
      }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: '#94a3b8',
              borderColor: 'transparent',
              px: 2,
              '&.Mui-selected': {
                color: '#38bdf8',
                bgcolor: 'rgba(56, 189, 248, 0.1)',
                '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.2)' }
              }
            }
          }}
        >
          <ToggleButton value="left">左翼</ToggleButton>
          <ToggleButton value="right">右翼</ToggleButton>
          <ToggleButton value="both">双翼</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 底部播放进度条 — 参照 2D 视图样式 */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        padding: '8px 16px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '12px',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        backdropFilter: 'blur(4px)',
        zIndex: 100
      }}>
        {/* START / 路程 / END */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>START</span>
          <span ref={progressTextRef} style={{ fontSize: '10px', color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
            0.0 / {totalDist.toFixed(1)} mm
          </span>
          <span style={{ fontSize: '10px', color: '#64748b' }}>END</span>
        </div>

        {/* 播放控制 + 滑块 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 重新开始 */}
          <button onClick={handleRestart}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: '16px', lineHeight: 1, padding: '4px',
              display: 'flex', alignItems: 'center'
            }}
            title="重新开始"
          >⏮</button>

          {/* 播放 / 暂停 */}
          <button onClick={togglePlay}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#38bdf8', fontSize: '18px', lineHeight: 1, padding: '4px',
              display: 'flex', alignItems: 'center'
            }}
            title={isPlaying ? '暂停' : '播放'}
          >{isPlaying ? '⏸' : '▶'}</button>

          {/* 进度滑块 */}
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={totalDist || 0}
            step="any"
            defaultValue={0}
            onChange={handleSliderChange}
            style={{
              flex: 1, height: 4,
              accentColor: '#38bdf8', cursor: 'pointer',
              background: '#334155', appearance: 'auto'
            }}
          />
        </div>
      </div>
    </div>
  )
}


function PreviewHotwire({ leftData, rightData, bothData, viewMode, percent }: { 
  leftData: any; 
  rightData: any; 
  bothData?: any;
  viewMode: 'left' | 'right' | 'both';
  percent: number 
}) {
  const getPosAt = (ptsR: THREE.Vector3[], ptsT: THREE.Vector3[], p: number) => {
    if (!ptsR?.length) return { start: new THREE.Vector3(), end: new THREE.Vector3() };
    const idx = Math.max(0, Math.min(ptsR.length - 1, Math.floor(p * (ptsR.length - 1))));
    return { start: ptsR[idx], end: ptsT[idx] };
  };

  let start = new THREE.Vector3(), end = new THREE.Vector3();

  if (viewMode === 'both' && bothData) {
    const pos = getPosAt(bothData.fullPathRoot, bothData.fullPathTip, percent / 100);
    start.copy(pos.start);
    end.copy(pos.end);
  } else {
    // @ts-ignore
    const data = viewMode === 'left' ? leftData : rightData;
    const pos = getPosAt(data?.fullPathRoot, data?.fullPathTip, percent / 100);
    start.copy(pos.start);
    end.copy(pos.end);
  }

  return (
    <group>
      <DreiLine points={[start, end]} color="#ef4444" lineWidth={viewMode === 'both' ? 4 : 3} />
      {/* 左塔球 */}
      <mesh position={start.toArray()} frustumCulled={false}>
        <sphereGeometry args={[viewMode === 'both' ? 3.5 : 2.5, 16, 16]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
      {/* 右塔球 */}
      <mesh position={end.toArray()} frustumCulled={false}>
        <sphereGeometry args={[viewMode === 'both' ? 3.5 : 2.5, 16, 16]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
    </group>
  );
}

export function Machine4Axis({ wingSpan: _wingSpan }: { wingSpan: number; foamChord: number; foamThickness?: number; washout?: number }) {
  const { model } = useWing()
  const { machineWidth = 1000, machineHeight = 600, gantryDistance = 1200 } = model

  const towerDistance = gantryDistance;

  // 立柱/导轨位置
  const colW = 12, colD = 12;
  const colPositions = [
    [0, 0, 0], [machineWidth, 0, 0],
    [0, 0, towerDistance], [machineWidth, 0, towerDistance],
  ];

  return (
    <group>
      {/* 4 根立柱 */}
      {colPositions.map((pos, i) => (
        <mesh key={i} position={[pos[0], machineHeight / 2, pos[2]]}>
          <boxGeometry args={[colW, machineHeight, colD]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.8}
            roughness={0.3}
            transparent
            opacity={0.65}
          />
        </mesh>
      ))}

      {/* 顶部横梁（左塔架） */}
      <mesh position={[machineWidth / 2, machineHeight, 0]}>
        <boxGeometry args={[machineWidth + colW, 6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} transparent opacity={0.6} />
      </mesh>
      {/* 顶部横梁（右塔架） */}
      <mesh position={[machineWidth / 2, machineHeight, towerDistance]}>
        <boxGeometry args={[machineWidth + colW, 6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} transparent opacity={0.6} />
      </mesh>

      {/* 底部底板 — 微厚度，上方覆盖遮挡grid，下方透明可见 */}
      <mesh position={[machineWidth / 2, 1, towerDistance / 2]}>
        <boxGeometry args={[machineWidth + colW, 2, towerDistance + colD]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0} roughness={0.9} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[machineWidth / 2, -1, towerDistance / 2]}>
        <boxGeometry args={[machineWidth + colW, 2, towerDistance + colD]} />
        <meshStandardMaterial color="#475569" metalness={0} roughness={0.9} transparent opacity={0.2} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* 导轨线（热丝路径参考）— 4 条水平线 */}
      {[
        [[0, machineHeight * 0.25, 0], [machineWidth, machineHeight * 0.25, 0]],
        [[0, machineHeight * 0.75, 0], [machineWidth, machineHeight * 0.75, 0]],
        [[0, machineHeight * 0.25, towerDistance], [machineWidth, machineHeight * 0.25, towerDistance]],
        [[0, machineHeight * 0.75, towerDistance], [machineWidth, machineHeight * 0.75, towerDistance]],
      ].map(([a, b], i) => (
        <line key={`rail-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([a[0], a[1], a[2], b[0], b[1], b[2]])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.25} />
        </line>
      ))}
    </group>
  );
}

function WingSurface({ rootPts, tipPts, color = '#7c3aed' }: { rootPts: THREE.Vector3[]; tipPts: THREE.Vector3[]; color?: string }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  const { positions, colors, count } = useMemo(() => {
    const n = Math.min(rootPts.length, tipPts.length)
    if (n < 2) return { positions: new Float32Array(0), colors: new Float32Array(0), count: 0 }

    const baseColor = new THREE.Color(color)
    const lightColor = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35)
    const darkColor = new THREE.Color(color).multiplyScalar(0.6)

    const verts: number[] = []
    const cols: number[] = []
    let triCount = 0

    for (let i = 0; i < n - 1; i++) {
      const r0 = rootPts[i]
      const r1 = rootPts[i + 1]
      const t0 = tipPts[i]
      const t1 = tipPts[i + 1]

      if (r0.distanceTo(t0) < 0.1) continue;

      // 计算每个顶点在弦长方向的位置（0=前缘，1=后缘）
      const ratio = i / (n - 1)
      const c = baseColor.clone().lerp(darkColor, ratio * 0.5)
      const cLight = baseColor.clone().lerp(lightColor, ratio * 0.3)

      // triangle 1: r0, r1, t0
      verts.push(r0.x, r0.y, r0.z)
      verts.push(r1.x, r1.y, r1.z)
      verts.push(t0.x, t0.y, t0.z)
      cols.push(c.r, c.g, c.b, cLight.r, cLight.g, cLight.b, c.r, c.g, c.b)
      triCount++

      // triangle 2: t0, r1, t1
      verts.push(t0.x, t0.y, t0.z)
      verts.push(r1.x, r1.y, r1.z)
      verts.push(t1.x, t1.y, t1.z)
      cols.push(c.r, c.g, c.b, cLight.r, cLight.g, cLight.b, cLight.r, cLight.g, cLight.b)
      triCount++
    }

    return {
      positions: new Float32Array(verts),
      colors: new Float32Array(cols),
      count: triCount * 3
    }
  }, [rootPts, tipPts, color])

  useEffect(() => {
    const geom = geometryRef.current
    if (!geom) return
    if (positions.length > 0) {
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geom.computeVertexNormals()
      geom.computeBoundingSphere()
      geom.computeBoundingBox()
      if (geom.attributes.normal) geom.attributes.normal.needsUpdate = true;
    }
  }, [positions, colors])

  if (count === 0) return null

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.75}
        roughness={0.3}
        metalness={0.4}
        depthWrite={true}
        depthTest={true}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/** 机翼端面封盖 — 填充根部和尖部截面 */
function WingEndCap({ points, color }: { points: THREE.Vector3[]; color?: string }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const { positions, count } = useMemo(() => {
    if (points.length < 3) return { positions: new Float32Array(0), count: 0 }
    
    // 计算中心点
    const centroid = new THREE.Vector3()
    points.forEach(p => centroid.add(p))
    centroid.divideScalar(points.length)
    
    const verts: number[] = []
    // 从中心点到连续边缘点组成三角形扇
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length
      verts.push(centroid.x, centroid.y, centroid.z)
      verts.push(points[i].x, points[i].y, points[i].z)
      verts.push(points[next].x, points[next].y, points[next].z)
    }
    
    return {
      positions: new Float32Array(verts),
      count: verts.length / 3
    }
  }, [points])

  useEffect(() => {
    const geom = geometryRef.current
    if (!geom) return
    if (positions.length > 0) {
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.computeVertexNormals()
      geom.computeBoundingSphere()
    }
  }, [positions])

  if (count === 0) return null

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <meshStandardMaterial
        color={color || '#ffffff'}
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
        roughness={0.3}
        metalness={0.2}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
}

// Axes helper: draws X (red), Y (green), Z (blue) arrows and labels positive directions
export function Axes({ size = 200 }: { size?: number }) {
  const s = size
  // line data for axes
  const xVerts = new Float32Array([0, 0, 0, s, 0, 0])
  const yVerts = new Float32Array([0, 0, 0, 0, s, 0])
  const zVerts = new Float32Array([0, 0, 0, 0, 0, s])

  return (
    <group>
      {/* X axis */}
      <line>
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute attach="attributes-position" count={2} array={xVerts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff4444" transparent opacity={0.4} linewidth={1} />
      </line>
      <mesh position={[s, 0, 0]} rotation={[0, 0, -Math.PI / 2]}> 
        <coneGeometry args={[3, 8, 12]} />
        <meshStandardMaterial color="#ff4444" transparent opacity={0.5} />
      </mesh>
      <Text position={[s + 10, 0, 0]} fontSize={12} color="#ff4444" fillOpacity={0.5}>+X</Text>

      {/* Y axis */}
      <line>
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute attach="attributes-position" count={2} array={yVerts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.4} linewidth={1} />
      </line>
      <mesh position={[0, s, 0]} rotation={[0, 0, 0]}> 
        <coneGeometry args={[3, 8, 12]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, s + 10, 0]} fontSize={12} color="#22c55e" fillOpacity={0.5}>+Y</Text>

      {/* Z axis */}
      <line>
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute attach="attributes-position" count={2} array={zVerts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.4} linewidth={1} />
      </line>
      <mesh position={[0, 0, s]} rotation={[Math.PI / 2, 0, 0]}> 
        <coneGeometry args={[3, 8, 12]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, 0, s + 10]} fontSize={12} color="#3b82f6" fillOpacity={0.5}>+Z</Text>
    </group>
  )
}