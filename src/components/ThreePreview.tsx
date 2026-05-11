// src/components/ThreePreview.tsx
import { useEffect, useMemo, useState, useRef } from 'react'
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
  
  return (
    <mesh position={[hx, hy, hz]}> 
      <boxGeometry args={[width, height, wingSpan]} />
      <meshStandardMaterial 
        color="#64748b" 
        transparent 
        opacity={0.12} 
        roughness={0.8}
        metalness={0}
        polygonOffset 
        polygonOffsetFactor={1} 
        polygonOffsetUnits={1}
        depthWrite={false}
      />
    </mesh>
  )
}

/** 跟随刀头移动的马达模拟盒 — X+Y 联动 */
function LiveMotorBox({ viewMode, leftData, rightData, bothData, percent, gantryDistance }: {
  viewMode: 'left' | 'right' | 'both';
  leftData: any; rightData: any; bothData?: any;
  percent: number; gantryDistance: number;
}) {
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
  
  const motorW = 30, motorH = 40, motorD = 20;
  
  return (
    <group>
      {/* 左塔马达 (Z=0 外侧) — 跟随 leftPos (X,Y) */}
      <mesh position={[leftPos.x - motorW / 2 - 8, leftPos.y, -motorD / 2]}>
        <boxGeometry args={[motorW, motorH, motorD]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.25} roughness={0.4} metalness={0.7} depthWrite={false} />
      </mesh>
      {/* 右塔马达 (Z=gd 外侧) — 跟随 rightPos (U,Z) */}
      <mesh position={[rightPos.x - motorW / 2 - 8, rightPos.y, gantryDistance + motorD / 2]}>
        <boxGeometry args={[motorW, motorH, motorD]} />
        <meshStandardMaterial color="#f97316" transparent opacity={0.25} roughness={0.4} metalness={0.7} depthWrite={false} />
      </mesh>
    </group>
  )
}

function WingOutline({ points, color = '#2196f3', opacity = 1, lineWidth = 2 }: { points: THREE.Vector3[]; color?: string; opacity?: number; lineWidth?: number }) {
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
        linewidth={lineWidth} 
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

	return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 70%)', minHeight: 0, borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [centerTarget.x + foamChord * 1.5, centerTarget.y + foamThickness * 2, centerTarget.z + wingSpan * 0.8],
          fov: 40,
          near: 0.1,
          far: 10000,
          up: [0, 1, 0],
        }}
        shadows
      >
        
  {/* 增强灯光：主光 + 补光 + 环境 */}
  <ambientLight intensity={0.8} color="#bae6fd" /> 
  <directionalLight position={[300, 400, 200]} intensity={2.5} color="#ffffff" castShadow /> 
  <directionalLight position={[-200, 100, -300]} intensity={0.8} color="#e0f2fe" />
  <directionalLight position={[0, -50, 100]} intensity={0.4} color="#94a3b8" />
  <hemisphereLight intensity={0.5} color="#bae6fd" groundColor="#1e293b" />
        
        <OrbitControls
          makeDefault 
          target={centerTarget}
          enablePan={true}
          enableZoom={true}
        />
        
        <Grid 
          args={[3000, 60]} 
          cellColor="#334155" 
          sectionColor="#1e293b"
          sectionSize={10}
          fadeDistance={2000}
          position={[centerTarget.x, -2, centerTarget.z]} 
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
                    <WingSurface rootPts={r.wingRoot} tipPts={r.wingTip} color="#38bdf8" />
                    <WingOutline points={r.wingRoot} color="#38bdf8" lineWidth={2} />
                    <WingOutline points={r.wingTip} color="#fb923c" lineWidth={2} />
                    {viewMode === 'right' && r.fullPathRoot.length > 0 && (
                      <>
                        <WingOutline points={r.fullPathRoot} color="#38bdf8" opacity={0.4} lineWidth={1} />
                        <WingOutline points={r.fullPathTip} color="#fb923c" opacity={0.4} lineWidth={1} />
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
              <WingSurface rootPts={left.wingRoot} tipPts={left.wingTip} color="#a78bfa" />
              <WingOutline points={left.wingRoot} color="#a78bfa" lineWidth={2} />
              <WingOutline points={left.wingTip} color="#fb923c" lineWidth={2} />
               {viewMode === 'left' && left.fullPathRoot.length > 0 && (
                <>
                  <WingOutline points={left.fullPathRoot} color="#a78bfa" opacity={0.4} lineWidth={1} />
                  <WingOutline points={left.fullPathTip} color="#fb923c" opacity={0.4} lineWidth={1} />
                </>
              )}
            </group>
          )}

          {/* 双翼模式下的完整路径 */}
          {viewMode === 'both' && processedData?.both && (
            <>
              <WingOutline points={processedData.both.fullPathRoot} color="#4ade80" opacity={0.6} lineWidth={2} />
              <WingOutline points={processedData.both.fullPathTip} color="#f87171" opacity={0.6} lineWidth={2} />
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

      {/* 恢复进度显示滑块 */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '12px',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        backdropFilter: 'blur(4px)',
        zIndex: 100
      }}>
        <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: '50px' }}>Preview</div>
        <input
          type="range"
          min="0"
          max="100"
          value={percent}
          onChange={e => setPercent(Number(e.target.value))}
          style={{
            flex: 1,
            height: 4,
            background: `linear-gradient(90deg, #38bdf8 ${percent}%, rgba(56, 189, 248, 0.1) ${percent}%)`,
            borderRadius: 2,
            appearance: 'none',
            outline: 'none',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="number"
            value={percent}
            onChange={e => setPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
            style={{
              width: '50px',
              background: 'transparent',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              color: '#38bdf8',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px',
              textAlign: 'center',
              outline: 'none'
            }}
          />
          <span style={{ color: '#38bdf8', fontSize: '14px', fontWeight: 'bold' }}>%</span>
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
      <DreiLine points={[start, end]} color="#4ade80" lineWidth={viewMode === 'both' ? 4 : 3} />
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

function Machine4Axis({ wingSpan: _wingSpan }: { wingSpan: number; foamChord: number; foamThickness?: number; washout?: number }) {
  const { model } = useWing()
  const { machineWidth = 1000, machineHeight = 600, xyuvMode = ['x', 'y', 'u', 'z'], gantryDistance = 1200 } = model

  const towerDistance = gantryDistance;
  let leftText = (xyuvMode[0] || '').toUpperCase() + (xyuvMode[1] || '').toUpperCase();
  let rightText = (xyuvMode[2] || '').toUpperCase() + (xyuvMode[3] || '').toUpperCase();

  return (
    <group>
      {/* 增强塔架平面的可见性 */}
      <mesh position={[machineWidth / 2, machineHeight / 2, 0]}>
        <planeGeometry args={[machineWidth, machineHeight]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <Text
        position={[machineWidth / 2, machineHeight / 2 + 50, 2]}
        fontSize={40}
        color="#3b82f6"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.6}
      >{leftText}</Text>

      {/* 右侧塔架 */}
      <group position={[0, 0, towerDistance]}>
        <mesh position={[machineWidth / 2, machineHeight / 2, 0]}>
          <planeGeometry args={[machineWidth, machineHeight]} />
          <meshStandardMaterial color="#fb923c" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Text
          position={[machineWidth / 2, machineHeight / 2 + 50, -2]}
          rotation={[0, Math.PI, 0]}
          fontSize={40}
          color="#fb923c"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.6}
        >{rightText}</Text>
      </group>

      {/* 地面平面 - 略微下移以避开 Y=0 平面 */}
      <mesh position={[machineWidth / 2, -0.5, towerDistance / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[machineWidth, towerDistance]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function WingSurface({ rootPts, tipPts, color = '#7c3aed' }: { rootPts: THREE.Vector3[]; tipPts: THREE.Vector3[]; color?: string }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  const { positions, count } = useMemo(() => {
    const n = Math.min(rootPts.length, tipPts.length)
    if (n < 2) return { positions: new Float32Array(0), count: 0 }

    // Each spanwise segment creates 2 triangles = 6 vertices
    const verts = new Float32Array((n - 1) * 6 * 3)
    let offset = 0
    for (let i = 0; i < n - 1; i++) {
      const r0 = rootPts[i]
      const r1 = rootPts[i + 1]
      const t0 = tipPts[i]
      const t1 = tipPts[i + 1]

      // 只有当两个端面不重合时（翼展不为0）才渲染面
      if (r0.distanceTo(t0) < 0.1) continue;

      // triangle 1: r0, r1, t0
      verts[offset++] = r0.x; verts[offset++] = r0.y; verts[offset++] = r0.z
      verts[offset++] = r1.x; verts[offset++] = r1.y; verts[offset++] = r1.z
      verts[offset++] = t0.x; verts[offset++] = t0.y; verts[offset++] = t0.z

      // triangle 2: t0, r1, t1
      verts[offset++] = t0.x; verts[offset++] = t0.y; verts[offset++] = t0.z
      verts[offset++] = r1.x; verts[offset++] = r1.y; verts[offset++] = r1.z
      verts[offset++] = t1.x; verts[offset++] = t1.y; verts[offset++] = t1.z
    }

    return { positions: verts.slice(0, offset), count: offset / 3 }
  }, [rootPts, tipPts])

  useEffect(() => {
    const geom = geometryRef.current
    if (!geom) return
    if (positions.length > 0) {
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.computeVertexNormals()
      geom.computeBoundingSphere()
      geom.computeBoundingBox()
      if (geom.attributes.normal) geom.attributes.normal.needsUpdate = true;
    }
  }, [positions])

  if (count === 0) return null

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <meshStandardMaterial 
        color={color} 
        side={THREE.DoubleSide} 
        transparent={true} 
        opacity={0.35}
        roughness={0.4}
        metalness={0.6}
        depthWrite={true}
        depthTest={true}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

// Axes helper: draws X (red), Y (green), Z (blue) arrows and labels positive directions
function Axes({ size = 200 }: { size?: number }) {
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
        <lineBasicMaterial color="#ff4444" linewidth={2} />
      </line>
      <mesh position={[s, 0, 0]} rotation={[0, 0, -Math.PI / 2]}> 
        <coneGeometry args={[4, 10, 12]} />
        <meshStandardMaterial color="#ff4444" />
      </mesh>
      <Text position={[s + 10, 0, 0]} fontSize={12} color="#ff4444">+X</Text>

      {/* Y axis */}
      <line>
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute attach="attributes-position" count={2} array={yVerts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#22c55e" linewidth={2} />
      </line>
      <mesh position={[0, s, 0]} rotation={[0, 0, 0]}> 
        <coneGeometry args={[4, 10, 12]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <Text position={[0, s + 10, 0]} fontSize={12} color="#22c55e">+Y</Text>

      {/* Z axis */}
      <line>
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute attach="attributes-position" count={2} array={zVerts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#3b82f6" linewidth={2} />
      </line>
      <mesh position={[0, 0, s]} rotation={[Math.PI / 2, 0, 0]}> 
        <coneGeometry args={[4, 10, 12]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <Text position={[0, 0, s + 10]} fontSize={12} color="#3b82f6">+Z</Text>
    </group>
  )
}