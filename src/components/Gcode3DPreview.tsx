// src/components/Gcode3DPreview.tsx
// 控制台界面的 3D 预览：完全基于 G-code 路径（与 2D 视图同源），不再显示机翼几何。
// 拥有唯一的播放进度条（播放/暂停/重播/滑块），并通过 window 事件同步 2D 视图进度。
import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '@mui/material'
import { useWing } from '../hooks/useWing'
import { Machine4Axis, Axes, TowerMotors } from './ThreePreview'
import { TouchpadOrbitControls } from './TouchpadOrbitControls'
import { CameraCaptureBridge, CameraCaptureButton } from './CameraCaptureButton'
import type { CameraCaptureFn } from './CameraCaptureButton'

// 彻底干掉 adoptedStyleSheets 报错（加在文件最上面）
if (typeof document !== 'undefined') {
  // @ts-ignore
  document.adoptedStyleSheets = document.adoptedStyleSheets || []
}

/**
 * 从 G-code 字符串解析出 XY 和 UZ 平面路径点。
 * 解析逻辑与 2D 视图（GcodeSimulator）完全一致：
 *  - 支持 G90/G91 绝对/相对坐标模式
 *  - 任意含坐标的行均计入路径（不局限于 G0/G1 开头）
 *  - 未指定的轴沿用上一次的坐标
 * 额外解析每一行的真实进给速度（F 值，mm/min → mm/s），
 * 得到与路径点一一对应的累计时间数组 timeCum（秒），用于按真实速度驱动动画。
 */
function parseGcodeToPath(gcode: string, axes: string[], gd: number, offset = 0): {
  root: THREE.Vector3[];
  tip: THREE.Vector3[];
  timeCum: number[];   // 到达每个路径点的累计真实时间（秒）
  totalTime: number;   // 整段路径总真实时间（秒）
} {
  const rootPts: THREE.Vector3[] = [];
  const tipPts: THREE.Vector3[] = [];
  const timeCum: number[] = [];
  const lines = gcode.split('\n');
  let isRelative = false;
  let curX = 0, curY = 0, curU = 0, curZ = 0;
  let prevX = 0, prevY = 0, prevU = 0, prevZ = 0;
  let curF = 300; // 默认进给 mm/min（无 F 行时沿用）
  let cumTime = 0;
  let first = true;

  for (const line of lines) {
    const t = line.split(';')[0].trim();
    if (!t) continue;

    // 进给速度 F（mm/min）——必须在 continue 前解析，因为可能有仅含 F 的行
    const fMatch = t.match(/F([\-\d.]+)/i);
    if (fMatch) curF = parseFloat(fMatch[1]) || curF;

    // G90/G91 切换绝对/相对模式（与 2D 视图一致）
    const gMatch = t.match(/G(0|1|90|91)/i);
    if (gMatch) {
      const cmd = gMatch[0].toUpperCase();
      if (cmd === 'G90') isRelative = false;
      if (cmd === 'G91') isRelative = true;
    }

    const getVal = (axis: string) => {
      const m = t.match(new RegExp(`${axis}([\\-\\d.]+)`, 'i'));
      return m ? parseFloat(m[1]) : NaN;
    };

    const x = getVal(axes[0]), y = getVal(axes[1]), u = getVal(axes[2]), z = getVal(axes[3]);
    if (isNaN(x) && isNaN(y) && isNaN(u) && isNaN(z)) continue;

    if (isRelative) {
      if (!isNaN(x)) curX += x;
      if (!isNaN(y)) curY += y;
      if (!isNaN(u)) curU += u;
      if (!isNaN(z)) curZ += z;
    } else {
      if (!isNaN(x)) curX = x;
      if (!isNaN(y)) curY = y;
      if (!isNaN(u)) curU = u;
      if (!isNaN(z)) curZ = z;
    }

    // G-code 的 X/U 是马达指令位置（已反向扣除偏移），热丝挂点 = 指令 + 偏移 = 设计位置
    rootPts.push(new THREE.Vector3(curX + offset, curY, 0));
    tipPts.push(new THREE.Vector3(curU + offset, curZ, gd));

    // 真实时间：四轴合成位移 / 进给速度（F mm/min → mm/s）
    let segTime = 0;
    if (!first) {
      const dX = curX - prevX, dY = curY - prevY, dU = curU - prevU, dZ = curZ - prevZ;
      const segLen = Math.sqrt(dX * dX + dY * dY + dU * dU + dZ * dZ);
      const vMs = curF / 60;
      segTime = vMs > 0 ? segLen / vMs : 0;
    }
    cumTime += segTime;
    timeCum.push(cumTime);
    first = false;
    prevX = curX; prevY = curY; prevU = curU; prevZ = curZ;
  }
  return { root: rootPts, tip: tipPts, timeCum, totalTime: cumTime };
}

/** 由累计路程 + 累计时间，反查某时刻对应的路程（线性插值） */
function distAtTime(cumDist: number[], timeCum: number[], t: number): number {
  const n = cumDist.length;
  if (n <= 1) return 0;
  const totalT = timeCum[n - 1];
  const cl = Math.max(0, Math.min(t, totalT));
  let i = 0;
  while (i < n - 2 && timeCum[i + 1] <= cl) i++;
  const dt = timeCum[i + 1] - timeCum[i];
  const frac = dt > 0 ? (cl - timeCum[i]) / dt : 0;
  return cumDist[i] + (cumDist[i + 1] - cumDist[i]) * frac;
}

/** 由累计路程 + 累计时间，反查某路程对应的时刻（线性插值） */
function timeAtDist(cumDist: number[], timeCum: number[], d: number): number {
  const n = cumDist.length;
  if (n <= 1) return 0;
  const totalD = cumDist[n - 1];
  const cl = Math.max(0, Math.min(d, totalD));
  let i = 0;
  while (i < n - 2 && cumDist[i + 1] <= cl) i++;
  const dd = cumDist[i + 1] - cumDist[i];
  const frac = dd > 0 ? (cl - cumDist[i]) / dd : 0;
  return timeCum[i] + (timeCum[i + 1] - timeCum[i]) * frac;
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

/** 进度热丝：跟随播放进度的两塔热丝 + 头部圆点 + 双塔马达（与设计界面同一套马达） */
function ProgressHotwire({ rootPath, tipPath, rootCum, tipCum, timeCum, dist, gd, towerOffsetX = 0, machineHeight = 600 }: {
  rootPath: THREE.Vector3[]; tipPath: THREE.Vector3[];
  rootCum: number[]; tipCum: number[]; timeCum: number[];
  dist: number; gd: number; towerOffsetX?: number; machineHeight?: number;
}) {
  const zero = useMemo(() => new THREE.Vector3(), [])
  // XY 与 UZ 平面必须按同一真实时刻同步：G-code 每行四轴同时运动，共享同一时间轴。
  // 由 root 距离反算时刻 → 再用该时刻求 tip 距离 → 两条路径始终落在同一行上。
  const t = timeAtDist(rootCum, timeCum, dist)
  const tipDist = distAtTime(tipCum, timeCum, t)
  const start = getPointAtDist(rootPath, rootCum, dist, zero)
  const end = getPointAtDist(tipPath, tipCum, tipDist, zero)
  // 热丝端点（挂点）落在上方垂直马达的顶面中心：左塔 z=0、右塔 z=gd

  return (
    <group>
      {/* 热丝（两塔之间的连线） */}
      <line frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([start.x, start.y, 0, end.x, end.y, gd])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.9} />
      </line>
      {/* 左塔头部圆点 */}
      <mesh position={[start.x, start.y, 0]} frustumCulled={false}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
      {/* 右塔头部圆点 */}
      <mesh position={[end.x, end.y, gd]} frustumCulled={false}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} depthTest={false} />
      </mesh>
      {/* 双塔马达（X/Y 双马达 + 丝杆，与设计界面 TowerMotors 相同） */}
      <TowerMotors
        leftX={start.x}
        leftY={start.y}
        rightX={end.x}
        rightY={end.y}
        gantryDistance={gd}
        towerOffsetX={towerOffsetX}
        machineHeight={machineHeight}
      />
    </group>
  )
}

interface Gcode3DPreviewProps {
  gcode: string;
  currentIndex?: number;
  onProgressChange?: (index: number) => void;
}

/**
 * 默认视角（相对路径包围盒中心 center 的偏移）。
 * 在 3D 视图点「📷 复制视角」得到 { position, target, fov }，换算：offset = position - target。
 * 把 offset 填入 DEFAULT_CAMERA_OFFSET、fov 填入 DEFAULT_CAMERA_FOV，即可把该视角设为默认。
 * null = 使用自动视角（按路径包围盒尺寸推导）。
 */
const DEFAULT_CAMERA_OFFSET: [number, number, number] | null = null;
const DEFAULT_CAMERA_FOV = 35;

/** 由路径中心 + 默认偏移计算默认相机位置（未设置偏移时按包围盒尺寸自动推导） */
function defaultCameraPosition(center: THREE.Vector3, span: number): [number, number, number] {
  return [
    center.x + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[0] : span * 1.2),
    center.y + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[1] : span * 0.8),
    center.z + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[2] : span * 0.6),
  ];
}

export default function Gcode3DPreview({ gcode, currentIndex = 0, onProgressChange }: Gcode3DPreviewProps) {
  const { model } = useWing()
  const { gantryDistance = 1200 } = model

  const [isPlaying, setIsPlaying] = useState(false)
  const [dist, setDist] = useState(0)
  const [speedMult, setSpeedMult] = useState(8) // 默认 8 倍真实速度，点击切换 16x/8x
  const internalDistRef = useRef(0)
  const startTimeRef = useRef(0)
  const sliderRef = useRef<HTMLInputElement>(null)
  const progressTextRef = useRef<HTMLSpanElement>(null)

  // 「复制视角」按钮：Canvas 内部注册读取器（CameraCaptureBridge），此处持有引用供按钮调用
  const cameraCaptureRef = useRef<CameraCaptureFn | null>(null)

  // 1. 解析 G-code 路径（与 2D 视图同源：根路径 XY 平面，尖路径 UZ 平面）
  const { rootPath, tipPath, rootCum, tipCum, timeCum, totalDist, totalTime, totalLines, center, span } = useMemo(() => {
    const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z']
    const parsed = parseGcodeToPath(gcode, axes, gantryDistance, 0)
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
      timeCum: parsed.timeCum,
      totalDist: total,
      totalTime: parsed.totalTime,
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

  // 2. 动画核心循环 - 基于 G-code 真实时间（每行 F 进给速度）× 倍速
  useEffect(() => {
    if (!isPlaying || totalDist <= 0 || totalTime <= 0) return

    // 倍速切换时保持当前位置：按当前路程反算时间基准
    if (internalDistRef.current > 0) {
      const realSecAtDist = timeAtDist(rootCum, timeCum, internalDistRef.current)
      startTimeRef.current = performance.now() - (realSecAtDist / speedMult) * 1000
    }

    let animationFrameId: number
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time
      const elapsedMs = time - startTimeRef.current
      // 真实切割时间 = 流逝时间 × 倍速；再从时间反查当前路程
      const realSec = (elapsedMs / 1000) * speedMult
      const currentDist = distAtTime(rootCum, timeCum, realSec)

      if (realSec >= totalTime) {
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
  }, [isPlaying, totalDist, totalTime, speedMult, rootCum, timeCum, broadcastProgress])


  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      // 从暂停恢复：按当前路程反算真实时间起点（时间 = 路程对应的真实秒数 / 倍速）
      const realSecAtDist = timeAtDist(rootCum, timeCum, internalDistRef.current)
      startTimeRef.current = performance.now() - (realSecAtDist / speedMult) * 1000
      setIsPlaying(true)
    } else {
      // 暂停时同步外部行索引（G-code 输入框高亮）
      setIsPlaying(false)
      const lineIdx = totalDist > 0
        ? Math.floor((internalDistRef.current / totalDist) * (totalLines - 1))
        : 0
      onProgressChangeRef.current?.(lineIdx)
    }
  }, [isPlaying, totalDist, totalLines, rootCum, timeCum, speedMult])

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

  // —— 参数提交后的「模糊→清晰化」过渡 ——
  // 与设计界面（ThreePreview）一致：SliderTextField 松开滑条/数字框提交时 dispatch
  // 'wing-param-commit'，此处监听后对 Canvas 快速模糊，等 React 提交 + Three.js 场景
  // 重建完成后平滑恢复清晰，用视觉过渡掩盖重建瞬间，避免画面跳变。
  const [previewBlur, setPreviewBlur] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const handleParamCommit = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
      setPreviewBlur(true)
      // 等待重建完成（约 300ms）后恢复清晰，CSS transition 平滑过渡
      blurTimerRef.current = setTimeout(() => setPreviewBlur(false), 300)
    }
    window.addEventListener('wing-param-commit', handleParamCommit)
    return () => {
      window.removeEventListener('wing-param-commit', handleParamCommit)
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: defaultCameraPosition(center, span),
          fov: DEFAULT_CAMERA_FOV,
          near: 0.1,
          far: 20000,
          up: [0, 1, 0],
        }}
        shadows
        style={{
          filter: previewBlur ? 'blur(7px)' : 'none',
          opacity: previewBlur ? 0.5 : 1,
          // 进入模糊快（0.15s），恢复清晰慢（0.45s）：形成「模糊一下 → 平滑清晰化」节奏
          transition: previewBlur
            ? 'filter 0.15s ease-in, opacity 0.15s ease-in'
            : 'filter 0.45s ease-out, opacity 0.45s ease-out',
        }}
      >
        {/* 灯光 */}
        <ambientLight intensity={1.2} color="#ffffff" />
        <directionalLight position={[500, 800, 400]} intensity={6.0} color="#ffffff" castShadow />
        <directionalLight position={[-400, 300, -500]} intensity={2.5} color="#ffffff" />
        <directionalLight position={[0, -200, 500]} intensity={1.2} color="#e0f2fe" />
        <hemisphereLight intensity={0.8} color="#ffffff" groundColor="#94a3b8" />

        <TouchpadOrbitControls
          makeDefault
          target={center}
          enablePan={true}
          enableZoom={true}
          rotateSpeed={0.8}
          panSpeed={0.8}
          minDistance={50}
        />

        {/* 复制视角：把当前摄像机 position / target / fov 注册到外部 ref（供顶部按钮读取） */}
        <CameraCaptureBridge captureRef={cameraCaptureRef} />

        {/* 坐标轴保持不旋转 */}
        <Axes size={span} />

        <group>
          {/* 四轴机架 */}
          <Machine4Axis foamChord={1} wingSpan={Math.max(center.z, 1)} foamThickness={1} platformOffset={model.platformOffset ?? 0} platformOffsetY={model.platformOffsetY ?? 0} machineWidth={model.machineWidth ?? 1000} machineHeight={model.machineHeight ?? 600} gantryDistance={model.gantryDistance ?? 1200} />

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
              timeCum={timeCum}
              dist={dist}
              gd={gantryDistance}
              towerOffsetX={model.towerOffsetX ?? 0}
              machineHeight={model.machineHeight ?? 600}
            />
          )}
        </group>
      </Canvas>

      {/* 顶部中央：复制摄像机视角按钮（复制结果粘贴给 AI 可设为默认视角） */}
      <CameraCaptureButton captureRef={cameraCaptureRef} />

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

      {/* 右上角倍速按钮：默认 8x 真实速度，点击切换 16x/8x */}
      <button
        onClick={() => setSpeedMult((m) => (m === 8 ? 16 : 8))}
        title={`播放倍速：基于 G-code 每行真实进给速度的 ${speedMult}x`}
        style={{
          position: 'absolute', top: 10, right: 12, zIndex: 10,
          background: speedMult === 16 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.7)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 8, padding: '4px 12px',
          fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
          cursor: 'pointer', lineHeight: 1.4,
          backdropFilter: 'blur(4px)',
        }}
      >
        {speedMult}x
      </button>

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
