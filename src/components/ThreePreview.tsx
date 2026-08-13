// src/components/ThreePreview.tsx
import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraCaptureBridge, CameraCaptureButton } from './CameraCaptureButton'
import type { CameraCaptureFn } from './CameraCaptureButton'
// 保留 Text（DreiLine 已随 PreviewHotwire 移除，热丝线改为原生 line + useFrame 更新）
import { Text } from '@react-three/drei' 
import { useWing } from '../hooks/useWing'
import * as THREE from 'three'
import { useGenerateAirfoilPoints } from '../hooks/useGenerateAirfoilPoints'
import { ToggleButton, ToggleButtonGroup, Box } from '@mui/material'
import { calculateWingPath, computeGcodeSig } from '../services/pathEngine'
import { TouchpadOrbitControls } from './TouchpadOrbitControls'

// 彻底干掉 adoptedStyleSheets 报错（加在文件最上面）
if (typeof document !== 'undefined') {
  // @ts-ignores
  document.adoptedStyleSheets = document.adoptedStyleSheets || []
}

/**
 * 从 G-code 字符串解析出 XY 和 UZ 平面路径点。
 * 解析逻辑与 2D 视图 / 控制台 3D 预览完全一致：
 *  - 支持 G90/G91 绝对/相对坐标模式
 *  - 任意含坐标的行均计入路径（不局限于 G0/G1 开头）
 *  - 未指定的轴沿用上一次的坐标
 * 额外解析每行真实进给速度（F 值 mm/min → mm/s），得到累计时间数组。
 */
function parseGcodeToPath(gcode: string, axes: string[], gd: number, offset = 0): {
  root: THREE.Vector3[];
  tip: THREE.Vector3[];
  timeCum: number[];
  totalTime: number;
} {
  const rootPts: THREE.Vector3[] = [];
  const tipPts: THREE.Vector3[] = [];
  const timeCum: number[] = [];
  const lines = gcode.split('\n');
  let isRelative = false;
  let curX = 0, curY = 0, curU = 0, curZ = 0;
  let prevX = 0, prevY = 0, prevU = 0, prevZ = 0;
  let curF = 300; // 默认进给 mm/min
  let cumTime = 0;
  let first = true;

  for (const line of lines) {
    const t = line.split(';')[0].trim();
    if (!t) continue;

    // 进给速度 F（mm/min）——必须在 continue 前解析
    const fMatch = t.match(/F([\-\d.]+)/i);
    if (fMatch) curF = parseFloat(fMatch[1]) || curF;

    // G90/G91 切换绝对/相对模式
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

/** 累计路径长度（弧长数组），用于按路程插值 */
function buildCumulative(path: THREE.Vector3[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
  }
  return cum;
}

/** 按累计路程插值取点：在路径段内线性插值，保证动画时间与真实距离成正比（进刀/退刀段不再跳变） */
function getPointAtDist(path: THREE.Vector3[], cum: number[], d: number, fallback: THREE.Vector3): THREE.Vector3 {
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

/**
 * 默认视角（相对翼面中心 centerTarget 的偏移）。
 * 在 3D 视图点「📷 复制视角」得到 { position, target, fov }，换算：offset = position - target。
 * 把 offset 填入 DEFAULT_CAMERA_OFFSET、fov 填入 DEFAULT_CAMERA_FOV，即可把该视角设为默认。
 * null = 使用自动视角（按翼面尺寸推导）。
 *
 * 当前默认视角来自用户复制的视角（2026-08-13）：
 *   position=[-2052.59, 1272.46, -2317.11]，target=[169.73, 74.54, 334.57]
 *   → offset = position - target = [-2222.32, 1197.92, -2651.68]，fov = 35
 * 想改回自动视角：把 DEFAULT_CAMERA_OFFSET 设为 null 即可。
 */
const DEFAULT_CAMERA_OFFSET: [number, number, number] | null = [-2222.32, 1197.92, -2651.68];
const DEFAULT_CAMERA_FOV = 35;

/** 由翼面中心 + 默认偏移计算默认相机位置（未设置偏移时按翼面尺寸自动推导） */
function defaultCameraPosition(center: THREE.Vector3, foamChord: number, wingSpan: number): [number, number, number] {
  const maxDim = Math.max(foamChord, wingSpan);
  return [
    center.x + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[0] : maxDim * 1.2),
    center.y + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[1] : maxDim * 0.8),
    center.z + (DEFAULT_CAMERA_OFFSET ? DEFAULT_CAMERA_OFFSET[2] : maxDim * 0.6),
  ];
}

function FoamBlock({ width, height, offsetX = 0, offsetY = 0, wingSpan = 600, foamOffsetZ = 0, platformOffset = 0 }: {
  width: number, height: number, offsetX: number, offsetY: number,
  wingSpan?: number, foamOffsetZ?: number, platformOffset?: number,
}) {
  
  // 泡沫包紧翼面：offsetX/offsetY 由翼面边界（已含平台宽度偏移 platformOffsetY）外扩而来，
  // 因此宽度方向偏移自动跟随翼面；长度方向平台偏移 platformOffset 合并进泡沫定位（与 foamOffsetZ 同效）
  const hx = offsetX + width / 2
  const hy = offsetY + height / 2
  const hz = foamOffsetZ + wingSpan / 2 + platformOffset

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

/**
 * 双塔马达渲染（纯几何，位置由外部传入）— 每塔 X/Y 双马达 + 丝杆。
 * 与设计界面（SceneDynamic useFrame 内联马达盒）使用同一套马达，控制台 3D 预览复用本组件。
 */
export function TowerMotors({ leftX, leftY, rightX, rightY, gantryDistance, towerOffsetX = 0, machineHeight = 600 }: {
  leftX: number; leftY: number; rightX: number; rightY: number; gantryDistance: number;
  towerOffsetX?: number; machineHeight?: number;
}) {

  const SCALE = 3;
  const xMotorW = 40 * SCALE, xMotorH = 20 * SCALE, xMotorD = 16 * SCALE;  // X 轴马达：宽扁
  const yMotorW = 24 * SCALE, yMotorH = 36 * SCALE, yMotorD = 16 * SCALE;  // Y 轴马达：窄高
  const PLATFORM_TOP_Y = 2;  // 切割平台顶面 Y 坐标（来自 Machine4Axis 底板）
  // X 轴马达顶部在平台下方 yMotorH 距离，与 Y 轴马达保持间距
  const xMotorTopY = PLATFORM_TOP_Y - yMotorH;
  const xMotorCenterY = xMotorTopY - xMotorH / 2;
  // 水平马达（X/U）相对上方垂直马达（Y/Z，固定 z=0/gantryDistance）的纵向偏移：
  // towerOffsetX=0 时上下马达在同一竖直平面（对齐）；左塔 z=-towerOffsetX、右塔 z=gd+towerOffsetX
  // 丝杆与水平马达同 z（底部中心对准底下水平马达中心），热丝挂点保持原位
  const leftMotorZ = -towerOffsetX;
  const rightMotorZ = gantryDistance + towerOffsetX;

  return (
    <group>
      {/* ===== 左塔 ===== */}
      {/* 丝杆 — 垂直穿过 X/Y 马达，长度与机台高度一致；底部中心对准底下 X 马达（水平马达）中心 */}
      <mesh position={[leftX, machineHeight / 2, leftMotorZ]}>
        <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* X 轴马达（水平）— 沿泡沫长度方向向机器外侧（z 负方向）偏移 */}
      <mesh position={[leftX, xMotorCenterY, leftMotorZ]}>
        <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Y 轴马达（上方垂直马达）— 顶面中心与热丝挂点同 y；热丝端点落在其顶面中心；马达保持原位，不随平台移动 */}
      <mesh position={[leftX, leftY - yMotorH / 2, 0]}>
        <boxGeometry args={[yMotorW, yMotorH, yMotorD]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* ===== 右塔 ===== */}
      {/* 丝杆 — 垂直穿过 X/Y 马达；底部中心对准底下 U 马达（水平马达）中心 */}
      <mesh position={[rightX, machineHeight / 2, rightMotorZ]}>
        <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* U 轴马达（水平）— 沿泡沫长度方向向机器外侧（z 正方向）偏移 */}
      <mesh position={[rightX, xMotorCenterY, rightMotorZ]}>
        <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Z 轴马达（上方垂直马达）— 顶面中心与热丝挂点同 y；热丝端点落在其顶面中心；马达保持原位，不随平台移动 */}
      <mesh position={[rightX, rightY - yMotorH / 2, gantryDistance]}>
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

function Hotwire({ realPos, gantryDistance = 1200 }: { realPos: { X: number; Y: number; U: number; Z: number }; gantryDistance?: number }) {
  
  // 修正 3D 界面坐标同步：
  // 左塔：实时的 X 对应 X 轴，实时的 Y 对应 Y 轴，位于 Z=0
  // 右塔：实时的 Z 对应 X 轴，实时的 U 对应 Y 轴，位于 Z=gantryDistance
  // (之前 UZ 的实时点显示相反，现已对调)
  // 热丝端点（挂点）落在上方垂直马达的顶面中心：左塔 z=0、右塔 z=gantryDistance
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
  // G-code 解析结果缓存：改无关参数时 previewGcodeData 字符串引用未变 → 跳过重复正则解析
  const gcodeParseCacheRef = useRef(new Map<string, ReturnType<typeof parseGcodeToPath>>());
  const [realPos, setRealPos] = useState({ X: 0, Y: 0, U: 0, Z: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const startTimeRef = useRef(0)
  const internalDistRef = useRef(0)
  const sliderRef = useRef<HTMLInputElement>(null)
  const progressTextRef = useRef<HTMLSpanElement>(null)
  // 播放倍速：默认真实速度的 8 倍，点击切换 16x / 8x
  const [speedMult, setSpeedMult] = useState(8)

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
    // 只依赖翼型生成器：basePoints 的 z 坐标在后续计算中未被使用（rootXY/tipXY 只取 x/y），
    // 改 wingSpan / foamOffsetZ 时无需重建翼型点，避免 3D 预览全链路重算
  }, [generatedAirfoilPoints])

  // 2. 计算投影、移位和最终点位
  const processedData = useMemo(() => {
    if (!basePoints) return null
    const { root: rootPts, tip: tipPts } = basePoints
    
    // 平台偏移（长度方向）合并进泡沫定位：与 foamOffsetZ 一起决定翼面本体沿长度（Z）的摆放
    const foamZStart = (model.foamOffsetZ || 0) + (model.platformOffset || 0)
    const span = wingSpan || 600
    // 右塔纵向位置 = 龙门架跨度
    const gd = gantryDistance || 1200
    
    // Z 轴翻转逻辑
    const zRoot = model.flipZ ? foamZStart + span : foamZStart;
    const zTip = model.flipZ ? foamZStart : foamZStart + span;

    const rootXY: [number, number][] = rootPts.map(p => [p.x, p.y]);
    const tipXY: [number, number][] = tipPts.map(p => [p.x, p.y]);

    // --- Helper 函数 ---
    const toV3 = (x: number, y: number, z: number) => new THREE.Vector3(x || 0, y || 0, z || 0);

    // --- 计算镜像与偏移逻辑 (同步 G-code) ---
    const axes = model.xyuvMode || ['X', 'Y', 'U', 'Z'];

    // 快照签名校验：previewGcodeData 是否由当前参数生成。
    // 签名不匹配 = 过期快照（如用户在非 G-Code 预览 Tab 下改了 foamOffsetZ 等）→ 回退实时几何路径，
    // 保证虚线轮廓/动画路径跟随参数实时更新，不被旧 G-code 卡住。
    const snapshotFresh = !!model.previewGcodeData?.sig && model.previewGcodeData.sig === computeGcodeSig(model);

    // 解析缓存：key = axes + gd + gcode 字符串；previewGcodeData 引用未变时命中，跳过重复正则解析
    const parseCached = (gcode: string) => {
      const key = `${axes.join(',')}|${gd}|${gcode}`;
      let p = gcodeParseCacheRef.current.get(key);
      if (!p) {
        p = parseGcodeToPath(gcode, axes, gd, 0);
        gcodeParseCacheRef.current.set(key, p);
        if (gcodeParseCacheRef.current.size > 20) gcodeParseCacheRef.current.clear();
      }
      return p;
    };

    /**
     * 构建单侧路径数据。
     * 优先使用已导出的 G-code 解析路径（与导出文件完全一致，进刀/退刀/Home 段都在其中）；
     * 未导出 G-code 时回退到几何计算（原点 → 翼型轮廓 → 原点）。
     */
    const getPoints = (isRight: boolean, xOffset = 0, yOffset = 0, isNested = false, gcodeKey?: 'left' | 'right') => {
      const path = calculateWingPath(rootXY, tipXY, model, isRight, xOffset, yOffset, isNested);
      const { orderedPoints, basePoints, shiftX, shiftY, width, height } = path;

      // 龙门架切割路径：使用外扩后的路径点（收缩补偿生效时热丝走刀轨迹外扩）
      const gR = orderedPoints.map(p => toV3(p.x + shiftX, p.y + shiftY, 0));
      const gT = orderedPoints.map(p => toV3(p.u + shiftX, p.z + shiftY, gd));

      // 机翼本体（翼面/泡沫块）：使用未外扩的 basePoints，保持设计尺寸不变
      const winR = basePoints.map(p => {
        const ratio = (zRoot - 0) / gd;
        return toV3(p.x + (p.u - p.x) * ratio + shiftX, p.y + (p.z - p.y) * ratio + shiftY, zRoot);
      });
      const winT = basePoints.map(p => {
        const ratio = (zTip - 0) / gd;
        return toV3(p.x + (p.u - p.x) * ratio + shiftX, p.y + (p.z - p.y) * ratio + shiftY, zTip);
      });

      // 默认路径：原点 → 翼型轮廓 → 原点（几何回退）
      let fullPathRoot = [toV3(0, 0, 0), ...gR, toV3(0, 0, 0)];
      let fullPathTip = [toV3(0, 0, gd), ...gT, toV3(0, 0, gd)];

      // 优先使用 G-code 解析的路径（保证与导出 G-code 完全一致，含进刀/退刀段）
      // 仅当快照新鲜（签名匹配当前参数）时使用，过期快照一律回退实时几何计算
      const gcodeData = gcodeKey && snapshotFresh ? model.previewGcodeData?.[gcodeKey] : undefined;
      let parsedTimeCum: number[] | null = null;
      if (gcodeData) {
        const parsed = parseCached(gcodeData);
        if (parsed.root.length > 0) {
          fullPathRoot = parsed.root;
          fullPathTip = parsed.tip;
          parsedTimeCum = parsed.timeCum;
        }
      }
      // 时间数组：优先用 G-code 每行真实速度，几何回退时按默认进给 300mm/min 合成
      const rootCum = buildCumulative(fullPathRoot);
      const timeCum = parsedTimeCum ?? rootCum.map((d) => d / (300 / 60));

      return {
        wingRoot: winR,
        wingTip: winT,
        gantryRoot: gR,   // 龙门架左端点路径（XY 平面，Z=0）
        gantryTip: gT,    // 龙门架右端点路径（UZ 平面，Z=gd）
        fullPathRoot,
        fullPathTip,
        fullPathRootCum: rootCum, // 弧长累计数组（按路程插值用）
        fullPathTipCum: buildCumulative(fullPathTip),
        timeCum,
        totalTime: timeCum[timeCum.length - 1] || 0,
        width,
        height
      };
    };

    const leftData = getPoints(false, 0, 0, false, 'left'); // 左翼（优先用 left G-code）
    const rightDataBase = getPoints(true, 0, 0, false, 'right'); // 右翼（优先用 right G-code）
    
    // 计算双翼模式下的右翼偏移位置
    const isVert = model.stackingMode === 'vertical';
    // 垂直堆叠：X 偏移 = interWingOffsetX（两翼X对齐，仅微小调整），Y 偏移 = 上翼高度 + 间隙
    // 水平堆叠：X 偏移 = 左翼宽度 + 间隙，Y 偏移 = interWingOffsetY（两翼Y对齐，仅微小调整）
    const xGap = isVert ? (model.interWingOffsetX ?? 0) : (leftData.width + (model.interWingOffsetX ?? 50));
    const yShift = isVert ? (leftData.height + (model.interWingOffsetY ?? 30)) : (model.interWingOffsetY ?? 0);
    // 偏移后的右翼几何（双翼模式动画统一走 both G-code，因此此处不用 G-code 覆盖）
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
    let bothTimeCum: number[] | null = null;
    if (snapshotFresh && model.previewGcodeData?.both) {
      const parsed = parseCached(model.previewGcodeData.both);
      if (parsed.root.length > 0) {
        bothPathRoot = parsed.root;
        bothPathTip = parsed.tip;
        bothTimeCum = parsed.timeCum;
      }
    }
    const bothRootCum = buildCumulative(bothPathRoot);
    const bothTimeCumArr = bothTimeCum ?? bothRootCum.map((d) => d / (300 / 60));

    return {
      left: leftData,
      right: rightDataBase,
      rightOffset: rightDataOffset,
      both: {
        fullPathRoot: bothPathRoot,
        fullPathTip: bothPathTip,
        fullPathRootCum: bothRootCum,
        fullPathTipCum: buildCumulative(bothPathTip),
        timeCum: bothTimeCumArr,
        totalTime: bothTimeCumArr[bothTimeCumArr.length - 1] || 0
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
    model.shrinkCompensationEnabled,
    model.shrinkCompensation,
    model.interWingOffsetX,
    model.interWingOffsetY,
    model.previewGcodeData,
    model.xyuvMode,
    // 快照签名：任何影响 G-code 路径的参数变化都会改变签名 → 重新评估快照是否新鲜
    computeGcodeSig(model),
    // 注意：towerOffsetX 不参与翼面几何计算（仅 SceneDynamic 马达盒位置使用），
    // 若放入 deps 会导致改视觉调谐参数时整个 3D 场景（翼面/机架/Text）全量重建 —— 已移除
    wingSpan, 
    model.foamOffsetZ,
    model.platformOffset,
    model.platformOffsetY
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
       // 平台偏移修正：翼面/泡沫整体沿宽度方向(X)平移 platformOffsetY、沿长度方向(Z)平移 foamOffsetZ+platformOffset
       const platY = model.platformOffsetY ?? 0;
       const platZ = (model.platformOffset ?? 0) + (model.foamOffsetZ ?? 0);

       if (viewMode === 'both') {
          return new THREE.Vector3(xGap / 2 + 10 + platY, yShift / 2, wingSpan / 2 + platZ);
       } else if (viewMode === 'right') {
          return new THREE.Vector3(xGap + 10 + platY, yShift, wingSpan / 2 + platZ);
       } else {
          return new THREE.Vector3(left.width / 2 + 10 + platY, 0, wingSpan / 2 + platZ);
       }
    }
    return new THREE.Vector3(foamChord / 2, foamThickness / 2, wingSpan / 2)
  }, [left, right, rightOffset, viewMode, model.interWingOffsetX, model.interWingOffsetY, model.stackingMode, model.platformOffset, model.platformOffsetY, model.foamOffsetZ, foamChord, wingSpan, foamThickness])

  // —— 视角固定策略 ——
  // 相机位置 + OrbitControls target 只在「翼面数据首次就绪」与「viewMode 切换」时设置：
  //  - 首次就绪：挂载初期 basePoints 异步加载，centerTarget 是回退值，就绪后聚焦到真实翼面中心
  //  - viewMode 切换：主动切换左/右/双翼，聚焦到对应翼中心（保留缩放/旋转状态，只移动焦点）
  //  - 改参数（防抖提交后 model 变化 → centerTarget/翼尺寸变化）：视角完全保持，不重置、不移动
  const [cameraSettings, setCameraSettings] = useState<{
    position: [number, number, number];
    fov: number;
    near: number;
    far: number;
    up: [number, number, number];
  }>(() => ({
    position: defaultCameraPosition(centerTarget, foamChord, wingSpan),
    fov: DEFAULT_CAMERA_FOV,
    near: 0.1,
    far: 10000,
    up: [0, 1, 0],
  }));
  const [controlsTarget, setControlsTarget] = useState<THREE.Vector3>(() => centerTarget.clone());
  const camInitializedRef = useRef(false);
  const prevViewModeRef = useRef(viewMode);

  // 「复制视角」按钮：Canvas 内部注册读取器（CameraCaptureBridge），此处持有引用供按钮调用
  const cameraCaptureRef = useRef<CameraCaptureFn | null>(null);

  useEffect(() => {
    const modeChanged = prevViewModeRef.current !== viewMode;
    prevViewModeRef.current = viewMode;
    if (modeChanged) {
      // viewMode 切换：聚焦到对应翼中心（保留用户缩放/旋转状态，只移动焦点）
      setControlsTarget(centerTarget.clone());
      return;
    }
    // 翼面数据首次就绪：设置正确的初始相机与 target（挂载初期 basePoints 为 null，centerTarget 是回退值）
    if (!camInitializedRef.current && processedData) {
      camInitializedRef.current = true;
      setCameraSettings({
        position: defaultCameraPosition(centerTarget, foamChord, wingSpan),
        fov: DEFAULT_CAMERA_FOV,
        near: 0.1,
        far: 10000,
        up: [0, 1, 0],
      });
      setControlsTarget(centerTarget.clone());
    }
  }, [viewMode, processedData, centerTarget, foamChord, wingSpan]);

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

  // 获取当前视图的累计路程 + 累计时间数组（真实 G-code 速度时间轴）
  const getActiveTimeData = useCallback((): { rootCum: number[]; timeCum: number[]; totalTime: number } => {
    if (viewMode === 'both' && processedData?.both) {
      return {
        rootCum: processedData.both.fullPathRootCum,
        timeCum: processedData.both.timeCum,
        totalTime: processedData.both.totalTime,
      };
    }
    const data = viewMode === 'left' ? processedData?.left : processedData?.right;
    if (data) {
      return {
        rootCum: data.fullPathRootCum,
        timeCum: data.timeCum,
        totalTime: data.totalTime,
      };
    }
    return { rootCum: [], timeCum: [], totalTime: 0 };
  }, [viewMode, processedData]);

  const totalDist = useMemo(() => calcTotalDist(getActivePaths()), [calcTotalDist, getActivePaths]);

  // 动画核心循环 - 基于 G-code 真实时间（每行 F 进给速度）× 倍速。
  // 关键：每帧只写 internalDistRef + 滑条/进度文本 DOM 直写，不再 setState ——
  // SceneDynamic 内 useFrame 每帧读取 distRef 直接更新 Three.js 对象，播放期间零 React 重渲染。
  useEffect(() => {
    if (!isPlaying || totalDist <= 0) return;

    const { rootCum, timeCum, totalTime } = getActiveTimeData();
    if (!timeCum.length || totalTime <= 0) return;

    // 倍速切换时保持当前位置：按当前路程反算时间基准
    if (internalDistRef.current > 0) {
      const realSecAtDist = timeAtDist(rootCum, timeCum, internalDistRef.current);
      startTimeRef.current = performance.now() - (realSecAtDist / speedMult) * 1000;
    }

    let animationFrameId: number;
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsedMs = time - startTimeRef.current;
      // 真实切割时间 = 流逝时间 × 倍速；再从时间反查当前路程
      const realSec = (elapsedMs / 1000) * speedMult;
      const currentDist = distAtTime(rootCum, timeCum, realSec);

      if (realSec >= totalTime) {
        // 播放完毕，循环
        startTimeRef.current = time;
        internalDistRef.current = 0;
        if (sliderRef.current) sliderRef.current.value = '0';
        if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`;
      } else {
        internalDistRef.current = currentDist;
        if (sliderRef.current) sliderRef.current.value = String(currentDist.toFixed(1));
        if (progressTextRef.current) progressTextRef.current.textContent = `${currentDist.toFixed(1)} / ${totalDist.toFixed(1)} mm`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDist, speedMult, getActiveTimeData]);

  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      // 从暂停恢复：按当前路程反算真实时间起点（时间 = 路程对应的真实秒数 / 倍速）
      const { rootCum, timeCum } = getActiveTimeData();
      const realSecAtDist = timeAtDist(rootCum, timeCum, internalDistRef.current);
      startTimeRef.current = performance.now() - (realSecAtDist / speedMult) * 1000;
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isPlaying, speedMult, getActiveTimeData]);

  const handleRestart = useCallback(() => {
    internalDistRef.current = 0;
    startTimeRef.current = performance.now();
    setIsPlaying(true);
    if (sliderRef.current) sliderRef.current.value = '0';
    if (progressTextRef.current) progressTextRef.current.textContent = `0.0 / ${totalDist.toFixed(1)} mm`;
  }, [totalDist]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dist = Number(e.target.value);
    internalDistRef.current = dist;
    if (progressTextRef.current) progressTextRef.current.textContent = `${dist.toFixed(1)} / ${totalDist.toFixed(1)} mm`;
  }, [totalDist]);

  // —— 参数提交后的「模糊→清晰化」过渡 ——
  // SliderTextField 松开滑条/数字框提交时，3D 视图先快速模糊，等 React 提交 +
  // Three.js 场景重建完成后平滑恢复清晰，用视觉过渡掩盖重建瞬间，避免画面跳变。
  const [previewBlur, setPreviewBlur] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleParamCommit = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      setPreviewBlur(true);
      // 等待重建完成（约 300ms）后恢复清晰，CSS transition 平滑过渡
      blurTimerRef.current = setTimeout(() => setPreviewBlur(false), 300);
    };
    window.addEventListener('wing-param-commit', handleParamCommit);
    return () => {
      window.removeEventListener('wing-param-commit', handleParamCommit);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#121212', border: '1px solid #2e2e2e', minHeight: 0, borderRadius: 12, overflow: 'hidden' }}>
      <Canvas
        dpr={[1, 2]}
        camera={cameraSettings}
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
  
  <TouchpadOrbitControls
          makeDefault
          target={controlsTarget}
          enablePan={true}
          enableZoom={true}
          rotateSpeed={0.8}
          panSpeed={0.8}
          minDistance={50}
        />

        {/* 复制视角：把当前摄像机 position / target / fov 注册到外部 ref（供顶部按钮读取） */}
        <CameraCaptureBridge captureRef={cameraCaptureRef} />

        {/* 静态几何（机架/泡沫/翼面/路径/标签）与动态热丝分离：
            SceneStatic 用 React.memo —— 播放动画时 distRef 每帧变化但不触发 React 渲染（ref 引用稳定），
            SceneStatic/SceneDynamic 均零重渲染，热丝与马达盒由 SceneDynamic 内 useFrame 每帧直接更新 Three.js 对象 */}
        <SceneStatic
          processedData={processedData}
          viewMode={viewMode}
          // axesSize 只依赖机架尺寸（不依赖弦长/翼展/厚度）：
          // 改翼型参数时坐标轴不重建，MachineRig memo 完全命中，避免无谓的 WebGL buffer 重传
          axesSize={Math.max(model.machineWidth ?? 1000, model.machineHeight ?? 600, gantryDistance, 200)}
          machineWidth={model.machineWidth ?? 1000}
          machineHeight={model.machineHeight ?? 600}
          gantryDistance={gantryDistance}
          platformOffset={model.platformOffset ?? 0}
          platformOffsetY={model.platformOffsetY ?? 0}
          wingSpan={wingSpan}
          foamOffsetZ={model.foamOffsetZ ?? 0}
          stackingMode={model.stackingMode}
        />

        <SceneDynamic
          processedData={processedData}
          viewMode={viewMode}
          distRef={internalDistRef}
          realPos={realPos}
          gantryDistance={gantryDistance}
          machineHeight={model.machineHeight ?? 600}
          towerOffsetX={model.towerOffsetX ?? 0}
        />
      </Canvas>

      {/* 顶部中央：复制摄像机视角按钮（复制结果粘贴给 AI 可设为默认视角） */}
      <CameraCaptureButton captureRef={cameraCaptureRef} />

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

      {/* 右上角倍速按钮：默认 8x 真实速度，点击切换 16x/8x */}
      <button
        onClick={() => setSpeedMult((m) => (m === 8 ? 16 : 8))}
        title={`播放倍速：基于 G-code 每行真实进给速度的 ${speedMult}x`}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 100,
          background: speedMult === 16 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.8)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 8, padding: '6px 12px',
          fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
          cursor: 'pointer', lineHeight: 1.4,
          backdropFilter: 'blur(8px)',
        }}
      >
        {speedMult}x
      </button>

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


// ===== 静态场景：机架 / 泡沫 / 翼面 / 路径 / 标签 =====
// 用 React.memo 隔离：播放动画时（distRef 每帧变化但不触发渲染）props 未变 → 零重渲染；
// 只有 processedData / viewMode / 机器参数真正变化时才重建几何。
interface SceneStaticProps {
  processedData: any;
  viewMode: 'left' | 'right' | 'both';
  axesSize: number;
  machineWidth: number;
  machineHeight: number;
  gantryDistance: number;
  platformOffset: number;
  platformOffsetY: number;
  wingSpan: number;
  foamOffsetZ: number;
  stackingMode?: string;
}

// ===== 机器框架（坐标轴 + 4 轴机架）— 独立 memo =====
// 与翼面几何分离：改翼型参数（弦长/翼型点等）时机器框架不重建，避免无谓的 WebGL buffer 重传。
interface MachineRigProps {
  axesSize: number;
  machineWidth: number;
  machineHeight: number;
  gantryDistance: number;
  platformOffset: number;
  platformOffsetY: number;
}

const MachineRig = memo(function MachineRig({
  axesSize, machineWidth, machineHeight, gantryDistance, platformOffset, platformOffsetY,
}: MachineRigProps) {
  return (
    <>
      <Axes size={axesSize} />
      <Machine4Axis
        foamChord={0}
        wingSpan={0}
        foamThickness={0}
        platformOffset={platformOffset}
        platformOffsetY={platformOffsetY}
        machineWidth={machineWidth}
        machineHeight={machineHeight}
        gantryDistance={gantryDistance}
      />
    </>
  );
});

const SceneStatic = memo(function SceneStatic({
  processedData, viewMode, axesSize, machineWidth, machineHeight, gantryDistance,
  platformOffset, platformOffsetY, wingSpan, foamOffsetZ,
  stackingMode,
}: SceneStaticProps) {
  const left: any = processedData?.left;
  const right: any = processedData?.right;
  const rightOffset: any = processedData?.rightOffset;

  return (
    <>
      {/* 机器框架（坐标轴 + 机架）— 独立 memo，改翼型参数时不重建 */}
      <MachineRig
        axesSize={axesSize}
        machineWidth={machineWidth}
        machineHeight={machineHeight}
        gantryDistance={gantryDistance}
        platformOffset={platformOffset}
        platformOffsetY={platformOffsetY}
      />

      <group rotation={[0, 0, 0]}>
        {/* 泡沫块 — 紧密包裹机翼 */}
        {left && right && (() => {
          const M = 5; // 紧贴边距
          const isBoth = viewMode === 'both';
          
          if (isBoth) {
            const pts1 = left.wingRoot;
            const pts2 = rightOffset?.wingRoot || right.wingRoot;
            if (!pts1.length && !pts2.length) return null;
            const allX = [...pts1.map((p: { x: number; y: number }) => p.x), ...pts2.map((p: { x: number; y: number }) => p.x)];
            const allY = [...pts1.map((p: { x: number; y: number }) => p.y), ...pts2.map((p: { x: number; y: number }) => p.y)];
            if (!allX.length) return null;
            const minX = Math.min(...allX), maxX = Math.max(...allX);
            const minY = Math.min(...allY), maxY = Math.max(...allY);
            return (
              <FoamBlock 
                width={maxX - minX + M * 2} 
                height={maxY - minY + M * 2} 
                offsetX={minX - M} 
                offsetY={minY - M} 
                wingSpan={wingSpan}
                foamOffsetZ={foamOffsetZ}
                platformOffset={platformOffset}
              />
            );
          }
          // 单翼模式
          const pts = (viewMode === 'right' ? right.wingRoot : left.wingRoot);
          if (!pts.length) return null;
          const allX = pts.map((p: { x: number; y: number }) => p.x), allY = pts.map((p: { x: number; y: number }) => p.y);
          const minX = Math.min(...allX), maxX = Math.max(...allX);
          const minY = Math.min(...allY), maxY = Math.max(...allY);
          return (
            <FoamBlock 
              width={maxX - minX + M * 2} 
              height={maxY - minY + M * 2} 
              offsetX={minX - M} 
              offsetY={minY - M} 
              wingSpan={wingSpan}
              foamOffsetZ={foamOffsetZ}
              platformOffset={platformOffset}
            />
          );
        })()}

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
        {viewMode === 'both' && left && rightOffset && stackingMode === 'vertical' && (
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
        {viewMode === 'both' && left && rightOffset && stackingMode === 'horizontal' && (
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
      </group>
    </>
  );
});

// ===== 动态热丝 / 马达盒：随播放进度 distRef 与实时位置 realPos 变化 =====
// 播放动画时每帧只更新 distRef.current（不触发 React 渲染），本组件内 useFrame
// 每帧读取 distRef 直接更新 Three.js 对象（热丝几何/马达/球位置），播放与拖动期间零 React 重渲染。
interface SceneDynamicProps {
  processedData: any;
  viewMode: 'left' | 'right' | 'both';
  distRef: { current: number };
  realPos: { X: number; Y: number; U: number; Z: number };
  gantryDistance: number;
  machineHeight: number;
  towerOffsetX: number;
}

const SceneDynamic = memo(function SceneDynamic({
  processedData, viewMode, distRef, realPos, gantryDistance, machineHeight, towerOffsetX,
}: SceneDynamicProps) {
  const left = processedData?.left;
  const right = processedData?.right;
  const rightOffset = processedData?.rightOffset;

  // 马达盒几何参数（与 TowerMotors 保持一致）
  const SCALE = 3;
  const xMotorW = 40 * SCALE, xMotorH = 20 * SCALE, xMotorD = 16 * SCALE;  // X 轴马达：宽扁
  const yMotorW = 24 * SCALE, yMotorH = 36 * SCALE, yMotorD = 16 * SCALE;  // Y 轴马达：窄高
  const PLATFORM_TOP_Y = 2;  // 切割平台顶面 Y 坐标
  const xMotorTopY = PLATFORM_TOP_Y - yMotorH;
  const xMotorCenterY = xMotorTopY - xMotorH / 2;
  // towerOffsetX=0 时上下马达同平面（对齐）：左塔 z=-towerOffsetX、右塔 z=gd+towerOffsetX
  const leftMotorZ = -towerOffsetX;
  const rightMotorZ = gantryDistance + towerOffsetX;

  // 热丝线 — 一次性创建（含几何+材质），useFrame 只更新 position attribute（避免每帧重建 BufferGeometry）
  const wireLine = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const m = new THREE.LineBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.9, depthTest: false });
    const line = new THREE.Line(g, m);
    line.frustumCulled = false;
    return line;
  }, []);
  const leftBallRef = useRef<THREE.Mesh>(null);
  const rightBallRef = useRef<THREE.Mesh>(null);

  // 马达盒 meshes
  const leftScrewRef = useRef<THREE.Mesh>(null);
  const leftXRef = useRef<THREE.Mesh>(null);
  const leftYRef = useRef<THREE.Mesh>(null);
  const rightScrewRef = useRef<THREE.Mesh>(null);
  const rightXRef = useRef<THREE.Mesh>(null);
  const rightYRef = useRef<THREE.Mesh>(null);

  // 预分配 Vector3，避免每帧 new
  const zero = useMemo(() => new THREE.Vector3(), []);
  const startV = useMemo(() => new THREE.Vector3(), []);
  const endV = useMemo(() => new THREE.Vector3(), []);

  // XY 与 UZ 平面必须按同一真实时刻同步：G-code 每行四轴同时运动，共享同一时间轴（timeCum）。
  // 由 root 距离反算时刻 → 再用该时刻求 tip 距离 → 两塔/热丝两端始终落在同一行上。
  const getSyncPos = (data: any, d: number) => {
    if (!data?.fullPathRoot?.length) return null;
    const rootCum = data.fullPathRootCum || buildCumulative(data.fullPathRoot);
    const timeCum = data.timeCum || rootCum.map((x: number) => x / (300 / 60)); // 几何回退时按默认 300mm/min 合成
    const t = timeAtDist(rootCum, timeCum, d);
    const tipCum = data.fullPathTipCum || buildCumulative(data.fullPathTip || data.fullPathRoot);
    const tipDist = distAtTime(tipCum, timeCum, t);
    return {
      left: getPointAtDist(data.fullPathRoot, rootCum, d, zero),
      right: getPointAtDist(data.fullPathTip || data.fullPathRoot, tipCum, tipDist, zero),
    };
  };

  useFrame(() => {
    const d = distRef.current;
    const data = (viewMode === 'both' && processedData?.both)
      ? processedData.both
      : (viewMode === 'left' ? left : right);
    const pos = getSyncPos(data, d);
    if (!pos) return;

    // 热丝线 + 左右球（端点落在上方垂直马达的顶面中心：左塔 z=0、右塔 z=gd）
    startV.set(pos.left.x, pos.left.y, 0);
    endV.set(pos.right.x, pos.right.y, gantryDistance);
    const attr = wireLine.geometry.getAttribute('position');
    if (attr) {
      attr.setXYZ(0, startV.x, startV.y, startV.z);
      attr.setXYZ(1, endV.x, endV.y, endV.z);
      attr.needsUpdate = true;
    }
    wireLine.geometry.computeBoundingSphere();
    leftBallRef.current?.position.copy(startV);
    rightBallRef.current?.position.copy(endV);

    // 马达盒：丝杆/马达 position 跟随刀头（丝杆底部中心对准底下水平马达中心）
    leftScrewRef.current?.position.set(pos.left.x, machineHeight / 2, leftMotorZ);
    leftXRef.current?.position.set(pos.left.x, xMotorCenterY, leftMotorZ);
    leftYRef.current?.position.set(pos.left.x, pos.left.y - yMotorH / 2, 0);
    rightScrewRef.current?.position.set(pos.right.x, machineHeight / 2, rightMotorZ);
    rightXRef.current?.position.set(pos.right.x, xMotorCenterY, rightMotorZ);
    rightYRef.current?.position.set(pos.right.x, pos.right.y - yMotorH / 2, gantryDistance);
  });

  return (
    <group rotation={[0, 0, 0]}>
      {/* 跟随刀头移动的马达盒（position 由 useFrame 更新） */}
      {left && right && rightOffset && (
        <group>
          {/* ===== 左塔 ===== */}
          {/* 丝杆 — 垂直穿过 X/Y 马达，长度与机台高度一致；底部中心对准底下 X 马达中心 */}
          <mesh ref={leftScrewRef} position={[0, machineHeight / 2, leftMotorZ]}>
            <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
          </mesh>
          {/* X 轴马达（水平）— 沿泡沫长度方向向机器外侧（z 负方向）偏移 */}
          <mesh ref={leftXRef} position={[0, xMotorCenterY, leftMotorZ]}>
            <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Y 轴马达 — 顶面中心与热丝挂点同 y；热丝端点落在其「靠近机器的面」的顶边中心；马达保持原位，不随平台移动 */}
          <mesh ref={leftYRef} position={[0, 0, 0]}>
            <boxGeometry args={[yMotorW, yMotorH, yMotorD]} />
            <meshStandardMaterial color="#60a5fa" roughness={0.4} metalness={0.6} />
          </mesh>

          {/* ===== 右塔 ===== */}
          {/* 丝杆 — 垂直穿过 X/Y 马达；底部中心对准底下 U 马达中心 */}
          <mesh ref={rightScrewRef} position={[0, machineHeight / 2, rightMotorZ]}>
            <boxGeometry args={[4 * SCALE, machineHeight, 4 * SCALE]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
          </mesh>
          {/* U 轴马达（水平）— 沿泡沫长度方向向机器外侧（z 正方向）偏移 */}
          <mesh ref={rightXRef} position={[0, xMotorCenterY, rightMotorZ]}>
            <boxGeometry args={[xMotorW, xMotorH, xMotorD]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Z 轴马达（垂直）— 顶面中心与热丝挂点同 y；热丝端点落在其「靠近机器的面」的顶边中心；马达保持原位，不随平台移动 */}
          <mesh ref={rightYRef} position={[0, 0, gantryDistance]}>
            <boxGeometry args={[yMotorW, yMotorH, yMotorD]} />
            <meshStandardMaterial color="#fb923c" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      )}

      {/* 实时位置热丝 — 仅非双翼模式显示 */}
      {viewMode !== 'both' && <Hotwire realPos={realPos} gantryDistance={gantryDistance} />}
      
      {/* 预览热丝 — 鲜红色（几何/位置由 useFrame 更新） */}
      {left && right && rightOffset && (
        <group>
          <primitive object={wireLine} />
          {/* 左塔球 */}
          <mesh ref={leftBallRef} position={[0, 0, 0]} frustumCulled={false}>
            <sphereGeometry args={[viewMode === 'both' ? 3.5 : 2.5, 16, 16]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} depthTest={false} />
          </mesh>
          {/* 右塔球 */}
          <mesh ref={rightBallRef} position={[0, 0, 0]} frustumCulled={false}>
            <sphereGeometry args={[viewMode === 'both' ? 3.5 : 2.5, 16, 16]} />
            <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
});


export function Machine4Axis({ wingSpan: _wingSpan, platformOffset = 0, platformOffsetY = 0, machineWidth = 1000, machineHeight = 600, gantryDistance = 1200 }: {
  wingSpan: number; foamChord: number; foamThickness?: number; washout?: number;
  platformOffset?: number; platformOffsetY?: number;
  machineWidth?: number; machineHeight?: number; gantryDistance?: number;
}) {

  // 右塔立柱/横梁/底板/导轨位于龙门架跨度 gantryDistance 处
  const towerDistance = gantryDistance;

  // 立柱/导轨位置
  const colW = 12, colD = 12;
  const colPositions = [
    [0, 0, 0], [machineWidth, 0, 0],
    [0, 0, towerDistance], [machineWidth, 0, towerDistance],
  ];

  // 切割平台沿长度方向（两塔连线）偏移 platformOffset、沿宽度方向偏移 platformOffsetY；马达/立柱/横梁保持原位
  const platformX = machineWidth / 2 + platformOffsetY;
  const platformZ = towerDistance / 2 + platformOffset;

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

      {/* 底部底板 — 微厚度，上方覆盖遮挡grid，下方透明可见；沿长度方向偏移 platformOffset、宽度方向偏移 platformOffsetY */}
      <mesh position={[platformX, 1, platformZ]}>
        <boxGeometry args={[machineWidth + colW, 2, towerDistance + colD]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0} roughness={0.9} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[platformX, -1, platformZ]}>
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
    // 复用两个临时 Color 对象，避免每段 2 次 clone().lerp() 分配（n=121 时约 240 次 → 0 次）
    const c = new THREE.Color()
    const cLight = new THREE.Color()

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
      c.copy(baseColor).lerp(darkColor, ratio * 0.5)
      cLight.copy(baseColor).lerp(lightColor, ratio * 0.3)

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