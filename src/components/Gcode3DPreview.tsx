// src/components/Gcode3DPreview.tsx
// 控制台界面的 3D 预览：完全基于 G-code 路径（与 2D 视图同源），不再显示机翼几何。
// 拥有唯一的播放进度条（播放/暂停/重播/滑块），并通过 window 事件同步 2D 视图进度。
import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Box } from '@mui/material'
import { useWing } from '../hooks/useWing'
import { Machine4Axis, Axes } from './ThreePreview'

// 彻底干掉 adoptedStyleSheets 报错（加在文件最上面）
if (typeof document !== 'undefined') {
  // @ts-ignore
  document.adoptedStyleSheets = document.adoptedStyleSheets || []
}

/** 从 G-code 字符串解析出 XY 和 UZ 平面路径点（与 ThreePreview 相同逻辑） */
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

    // 使用上一个点的坐标作为默认
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

/** 累计路径长度 */
function buildCumulative(path: THREE.Vector3[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
  }
  return cum;
}

/** 按累计路程插值取点 */
function getPointAtDist(path: THREE.Vector3[], cum: number[], d: number, fallback: THREE.Vector3) {
  if (!path?.length) return fallback.clone();
  if (path.length === 1) return path[0].clone();
  const total = cum[cum.length - 1];
  const clamped = Math.max(0, Math.min(d, total));
  let idx = 0;
  while (idx < cum.length - 2 && cum[idx + 1] <= clamped) idx++;
  const segLen = cum[idx + 1] - cum[idx];
  const frac = segLen > 0 ? (clamped - cum[idx]) / segLen : 0;
  return new THREE.Vector3().lerpVectors(path[idx], path[idx + 1], frac);
}

/** 静态路径线（暗色底图） */
function PathLine({ points, color, opacity = 0.35 }: { points: THREE.Vector3[]; color: string; opacity?: number }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  useEffect(() => {
    const geom = geometryRef.current
    if (!geom || points.length < 2) return
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3))
    geom.computeBoundingSphere()
  }, [points])

  if (points.length < 2) return null

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

/** 进度热丝：跟随播放进度的两塔热丝 + 头部圆点 + 塔架滑座 */
function ProgressHotwire({ rootPath, tipPath, rootCum, tipCum, dist, gd }: {
  rootPath: THREE.Vector3[]; tipPath: THREE.Vector3[];
  rootCum: number[]; tipCum: number[];
  dist: number; gd: number;
}) {
  const zero = useMemo(() => new THREE.Vector3(), [])
  const start = getPointAtDist(rootPath, rootCum, dist, zero)
  const end = getPointAtDist(tipPath, tipCum, dist, zero)

  return (
    <group>
      {/* 热丝（两塔之间的连线） */}
      <line frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([start.x, start.y, start.z, end.x, end.y, end.z])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.9} />
      </line>
      {/* 左塔头部圆点 */}
      <mesh position={start.toArray()} frustumCulled={false}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
      {/* 右塔头部圆点 */}
      <mesh position={end.toArray()} frustumCulled={false}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
      {/* 左塔滑座 */}
      <mesh position={[start.x, start.y, -10]} frustumCulled={false}>
        <boxGeometry args={[18, 18, 22]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.85} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* 右塔滑座 */}
      <mesh position={[end.x, end.y, gd + 10]} frustumCulled={false}>
        <boxGeometry args={[18, 18, 22]} />
        <meshStandardMaterial color="#f97316" transparent opacity={0.85} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

interface Gcode3DPreviewProps {
  gcode: string;
  currentIndex?: number;
  onProgressChange?: (index: number) => void;
}

export default function Gcode3DPreview({ gcode, currentIndex = 0, onProgressChange }: Gcode3DPreviewProps) {
  const { model } = useWing()
  const { gantryDistance = 1200 } = model

  const [isPlaying, setIsPlaying] = useState(false)
  const [dist, setDist] = useState(0)
  const internalDistRef = useRef(0)
  const startTimeRef = useRef(0)
  const sliderRef = useRef<HTMLInputElement>(null)
  const progressTextRef = useRef<HTMLSpanElement>(null)
  const ANIMATION_SPEED_MM_PER_SEC = 100

  // 1. 解析 G-code 路径（与 2D 视图同源：根路径 XY 平面，尖路径 UZ 平面）
  const { rootPath, tipPath, rootCum, tipCum, totalDist, totalLines, center, span } = useMemo(() => {
    const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z']
    const parsed = parseGcodeToPath(gcode, axes, gantryDistance)
    const root = parsed.root
    const tip = parsed.tip
    const rCum = buildCumulative(root)
    const tCum = buildCumulative(tip)
    const total = rCum.length > 1 ? rCum[rCum.length - 1] : 0
    const lines = gcode.split('\n').length

    // 计算包围盒中心，用于相机定位
    const all = [...root, ...tip]
    let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = gantryDistance
    for (const p of all) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
    }
    const s = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 200)

    return {
      rootPath: root,
      tipPath: tip,
      rootCum: rCum,
      tipCum: tCum,
      totalDist: total,
      totalLines: lines,
      center: new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
      span: s,
    }
  }, [gcode, gantryDistance, model.xyuvMode])

  // 使用 useRef 缓存 onProgressChange，避免闭包陷阱
  const onProgressChangeRef = useRef(onProgressChange)
  useEffect(() => {
    onProgressChangeRef.current = onProgressChange
  }, [onProgressChange])

  // 广播进度事件（供 2D 视图同步，避免高频 React 渲染）
  const broadcastProgress = useCallback((distance: number) => {
    window.dispatchEvent(new CustomEvent('gcode-progress', { detail: { distance } }))
  }, [])

  // 2. 动画核心循环 - 基于路程/秒
  useEffect(() => {
    if (!isPlaying || totalDist <= 0) return

    let animationFrameId: number
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time
      const elapsedMs = time - startTimeRef.current
      const currentDist = (elapsedMs / 1000) * ANIMATION_SPEED_MM_PER_SEC

      if (currentDist >= totalDist) {
        // 播放完毕，循环
        startTimeRef.current = time
        internalDistRef.current = 0
        setDist(0)
        if (sliderRef.current) sliderRef.current.value = '0'
        if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`
        onProgressChangeRef.current?.(0)
        broadcastProgress(0)
      } else {
        internalDistRef.current = currentDist
        setDist(currentDist)
        if (sliderRef.current) sliderRef.current.value = String(currentDist.toFixed(1))
        if (progressTextRef.current) progressTextRef.current.textContent = `${currentDist.toFixed(1)} / ${totalDist.toFixed(1)} mm`
        broadcastProgress(currentDist)
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrameId)
  }, [isPlaying, totalDist, broadcastProgress])

  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      // 从暂停恢复（路程/秒）
      startTimeRef.current = performance.now() - (internalDistRef.current / ANIMATION_SPEED_MM_PER_SEC * 1000)
      setIsPlaying(true)
    } else {
      // 暂停时同步外部行索引（G-code 输入框高亮）
      setIsPlaying(false)
      const lineIdx = totalDist > 0
        ? Math.floor((internalDistRef.current / totalDist) * (totalLines - 1))
        : 0
      onProgressChangeRef.current?.(lineIdx)
    }
  }, [isPlaying, totalDist, totalLines])

  const handleRestart = useCallback(() => {
    internalDistRef.current = 0
    setDist(0)
    startTimeRef.current = performance.now()
    setIsPlaying(true)
    if (sliderRef.current) sliderRef.current.value = '0'
    if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`
    onProgressChangeRef.current?.(0)
    broadcastProgress(0)
  }, [totalDist, broadcastProgress])

  const handleSliderChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    internalDistRef.current = val
    setDist(val)
    if (progressTextRef.current) progressTextRef.current.textContent = `${val.toFixed(1)} / ${totalDist.toFixed(1)} mm`
    broadcastProgress(val)
  }, [totalDist, broadcastProgress])

  const handleSliderCommit = useCallback(() => {
    const lineIdx = totalDist > 0
      ? Math.floor((internalDistRef.current / totalDist) * (totalLines - 1))
      : 0
    onProgressChangeRef.current?.(lineIdx)
  }, [totalDist, totalLines])

  // 3. 外部 currentIndex 变化时同步（暂停状态下，如 G-code 输入框切换行）
  useEffect(() => {
    if (isPlaying || totalDist <= 0) return
    const externalDist = totalDist > 0
      ? (currentIndex / (totalLines - 1)) * totalDist
      : 0
    if (Math.abs(externalDist - internalDistRef.current) > 1) {
      internalDistRef.current = externalDist
      setDist(externalDist)
      if (sliderRef.current) sliderRef.current.value = String(externalDist.toFixed(1))
      if (progressTextRef.current) progressTextRef.current.textContent = `${externalDist.toFixed(1)} / ${totalDist.toFixed(1)} mm`
    }
  }, [currentIndex, isPlaying, totalDist, totalLines])

  // gcode 变化时重置进度并广播（2D 同步）
  useEffect(() => {
    internalDistRef.current = 0
    setDist(0)
    broadcastProgress(0)
  }, [gcode, broadcastProgress])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [center.x + span * 1.2, center.y + span * 0.8, center.z + span * 0.6],
          fov: 35,
          near: 0.1,
          far: 20000,
          up: [0, 1, 0],
        }}
        shadows
      >
        {/* 灯光 */}
        <ambientLight intensity={1.2} color="#ffffff" />
        <directionalLight position={[500, 800, 400]} intensity={6.0} color="#ffffff" castShadow />
        <directionalLight position={[-400, 300, -500]} intensity={2.5} color="#ffffff" />
        <directionalLight position={[0, -200, 500]} intensity={1.2} color="#e0f2fe" />
        <hemisphereLight intensity={0.8} color="#ffffff" groundColor="#94a3b8" />

        <OrbitControls
          makeDefault
          target={center}
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
        <Axes size={span} />

        <group>
          {/* 四轴机架 */}
          <Machine4Axis foamChord={1} wingSpan={Math.max(center.z, 1)} foamThickness={1} />

          {/* 完整 G-code 路径（暗色底图）：根路径 XY 平面，尖路径 UZ 平面 */}
          <PathLine points={rootPath} color="#38bdf8" opacity={0.35} />
          <PathLine points={tipPath} color="#fb923c" opacity={0.35} />

          {/* 跟随播放进度的热丝 */}
          {rootPath.length > 1 && tipPath.length > 1 && (
            <ProgressHotwire
              rootPath={rootPath}
              tipPath={tipPath}
              rootCum={rootCum}
              tipCum={tipCum}
              dist={dist}
              gd={gantryDistance}
            />
          )}
        </group>
      </Canvas>

      {/* 顶部图例 */}
      <Box sx={{ position: 'absolute', top: 10, left: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(15, 23, 42, 0.7)', px: 1.5, py: 0.5, borderRadius: 1, border: '1px solid #1e293b' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#38bdf8' }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>XY 左塔</span>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fb923c' }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>UZ 右塔</span>
        </Box>
      </Box>

      {/* 底部播放进度条（唯一的播放控制，2D 视图已合并至此） */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>START</span>
          <span ref={progressTextRef} style={{ fontSize: '10px', color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
            0.0 / {totalDist.toFixed(1)} mm
          </span>
          <span style={{ fontSize: '10px', color: '#64748b' }}>END</span>
        </div>

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
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
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
