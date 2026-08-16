import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, ButtonGroup } from '@mui/material';

interface GCodePreviewProps {
  gcode: string;
  currentIndex?: number;
}

export default function GcodeSimulator({ gcode, currentIndex = 0 }: GCodePreviewProps) {
  const [viewMode, setViewMode] = useState<'XY' | 'UZ'>('XY');

  // 完全移除内部播放状态：播放进度统一由 3D 视图（Gcode3DPreview）驱动，
  // 这里仅通过 window 'gcode-progress' 事件 + 外部 currentIndex 同步绘制
  const currentDistRef = useRef(0);

  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. 解析 G-code 路径
  const { paths, bounds, totalLines, cumDists, totalDists } = useMemo(() => {
    const rawLines = gcode.split('\n');
    const xyPath: [number, number][] = [];
    const uzPath: [number, number][] = [];
    let curX = 0, curY = 0, curU = 0, curZ = 0;
    let minX = 0, maxX = 0, minY = 0, maxY = 0, minU = 0, maxU = 0, minZ = 0, maxZ = 0;
    let isRelative = false;

    rawLines.forEach((line) => {
      const cleanLine = line.split(';')[0].trim();
      if (!cleanLine) return;

      const gMatch = cleanLine.match(/G(0|1|90|91)/i);
      if (gMatch) {
        const cmd = gMatch[0].toUpperCase();
        if (cmd === 'G90') isRelative = false;
        if (cmd === 'G91') isRelative = true;
      }

      const xMatch = cleanLine.match(/X([-.\d]+)/i);
      const yMatch = cleanLine.match(/Y([-.\d]+)/i);
      const uMatch = cleanLine.match(/U([-.\d]+)/i);
      const zMatch = cleanLine.match(/Z([-.\d]+)/i);

      if (xMatch || yMatch || uMatch || zMatch) {
        if (isRelative) {
          if (xMatch) curX += parseFloat(xMatch[1]);
          if (yMatch) curY += parseFloat(yMatch[1]);
          if (uMatch) curU += parseFloat(uMatch[1]);
          if (zMatch) curZ += parseFloat(zMatch[1]);
        } else {
          if (xMatch) curX = parseFloat(xMatch[1]);
          if (yMatch) curY = parseFloat(yMatch[1]);
          if (uMatch) curU = parseFloat(uMatch[1]);
          if (zMatch) curZ = parseFloat(zMatch[1]);
        }
        xyPath.push([curX, curY]);
        uzPath.push([curU, curZ]);

        minX = Math.min(minX, curX); maxX = Math.max(maxX, curX);
        minY = Math.min(minY, curY); maxY = Math.max(maxY, curY);
        minU = Math.min(minU, curU); maxU = Math.max(maxU, curU);
        minZ = Math.min(minZ, curZ); maxZ = Math.max(maxZ, curZ);
      }
    });

    // 计算累计路程（用于路程驱动绘制，与 3D 视图广播的距离一致）
    const cumXY = [0];
    for (let i = 1; i < xyPath.length; i++) {
      const dx = xyPath[i][0] - xyPath[i-1][0];
      const dy = xyPath[i][1] - xyPath[i-1][1];
      cumXY.push(cumXY[i-1] + Math.sqrt(dx*dx + dy*dy));
    }
    const cumUZ = [0];
    for (let i = 1; i < uzPath.length; i++) {
      const du = uzPath[i][0] - uzPath[i-1][0];
      const dz = uzPath[i][1] - uzPath[i-1][1];
      cumUZ.push(cumUZ[i-1] + Math.sqrt(du*du + dz*dz));
    }

    return {
      paths: { XY: xyPath, UZ: uzPath },
      bounds: { 
        XY: { minX, maxX, minY, maxY }, 
        UZ: { minX: minU, maxX: maxU, minY: minZ, maxY: maxZ } 
      },
      totalLines: rawLines.length,
      cumDists: { XY: cumXY, UZ: cumUZ },
      totalDists: { 
        XY: cumXY.length > 0 ? cumXY[cumXY.length - 1] : 0,
        UZ: cumUZ.length > 0 ? cumUZ[cumUZ.length - 1] : 0
      }
    };
  }, [gcode]);

  const padding = 30;
  const svgWidth = 400;
  const svgHeight = 250;

  const currentPath = viewMode === 'XY' ? paths.XY : paths.UZ;
  const currentBounds = viewMode === 'XY' ? bounds.XY : bounds.UZ;
  const currentCumDist = viewMode === 'XY' ? cumDists.XY : cumDists.UZ;
  const currentTotalDist = viewMode === 'XY' ? totalDists.XY : totalDists.UZ;
  
  const contentWidth = Math.max(1, currentBounds.maxX - currentBounds.minX);
  const contentHeight = Math.max(1, currentBounds.maxY - currentBounds.minY);
  
  const availableWidth = svgWidth - 2 * padding;
  const availableHeight = svgHeight - 2 * padding;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

  const offsetX = (svgWidth - contentWidth * scale) / 2 - currentBounds.minX * scale;
  const offsetY = (svgHeight - contentHeight * scale) / 2 - currentBounds.minY * scale;

  const getSvgX = useCallback((x: number) => x * scale + offsetX, [scale, offsetX]);
  const getSvgY = useCallback((y: number) => svgHeight - (y * scale + offsetY), [scale, offsetY, svgHeight]);

  // 更新 Canvas 核心逻辑：最高性能的 2D 绘图（基于路程驱动，与 3D 广播的距离一致）
  const updateCanvasNodes = useCallback((distance: number) => {
    if (!canvasRef.current || currentPath.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const totalDist = currentTotalDist;
    const cumDist = currentCumDist;

    // 根据累计路程查找路径段索引
    const clampedDist = Math.max(0, Math.min(distance, totalDist));
    let idx = 0;
    let frac = 0;
    if (totalDist > 0 && cumDist.length > 1) {
      while (idx < cumDist.length - 2 && cumDist[idx + 1] <= clampedDist) {
        idx++;
      }
      const segLen = cumDist[idx + 1] - cumDist[idx];
      frac = segLen > 0 ? (clampedDist - cumDist[idx]) / segLen : 0;
    }

    ctx.clearRect(0, 0, svgWidth, svgHeight);

    // 绘制已完成的路径
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(getSvgX(currentPath[0][0]), getSvgY(currentPath[0][1]));
    
    // 性能要点：当路径点非常多时（比如几万个点），每帧循环几万次 lineTo 会严重拖慢 CPU
    // 导致 GC 或渲染拥塞，进而出现有规律的掉帧（每隔n帧卡一下）。
    // 我们仅循环截断到当前进度
    for (let i = 1; i <= idx; i++) {
      ctx.lineTo(getSvgX(currentPath[i][0]), getSvgY(currentPath[i][1]));
    }

    // 插值计算当前点
    let hx = currentPath[idx][0];
    let hy = currentPath[idx][1];
    
    if (idx >= 0 && idx < currentPath.length - 1) {
      const p1 = currentPath[idx];
      const p2 = currentPath[idx+1];
      if (p1 && p2) {
        hx = p1[0] + (p2[0] - p1[0]) * frac;
        hy = p1[1] + (p2[1] - p1[1]) * frac;
      }
    }
    
    const headX = getSvgX(hx);
    const headY = getSvgY(hy);
    
    ctx.lineTo(headX, headY);
    ctx.stroke();

    // 绘制刀头圆点
    ctx.beginPath();
    ctx.fillStyle = '#38bdf8';
    ctx.arc(headX, headY, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [currentPath, currentCumDist, currentTotalDist, getSvgX, getSvgY]);

  // 如果外部 currentIndex 改变（如 3D 视图暂停/重播/拖动进度条时同步过来）
  useEffect(() => {
    const currentDist = currentDistRef.current;
    // 将外部行索引转换为路程值
    const externalDist = currentTotalDist > 0
      ? (currentIndex / (totalLines - 1)) * currentTotalDist
      : 0;
    if (Math.abs(externalDist - currentDist) > 1) {
      currentDistRef.current = externalDist;
      updateCanvasNodes(externalDist);
    }
  }, [currentIndex, currentTotalDist, totalLines, updateCanvasNodes]);

  // 监听 3D 视图广播的播放进度事件，实时同步绘制（无需 60fps React 渲染）
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const distance = (e as CustomEvent<{ distance: number }>).detail?.distance;
      if (typeof distance !== 'number') return;
      if (Math.abs(distance - currentDistRef.current) < 0.05) return;
      currentDistRef.current = distance;
      updateCanvasNodes(distance);
    };
    window.addEventListener('gcode-progress', handleProgress);
    return () => window.removeEventListener('gcode-progress', handleProgress);
  }, [updateCanvasNodes]);

  // gcode 变化时重置进度并重绘
  useEffect(() => {
    currentDistRef.current = 0;
    updateCanvasNodes(0);
  }, [gcode, updateCanvasNodes]);

  const gridLines = useMemo(() => {
    const spacing = 50; 
    const lines = [];
    const startX = Math.floor(currentBounds.minX / spacing) * spacing;
    const endX = Math.ceil(currentBounds.maxX / spacing) * spacing;
    const startY = Math.floor(currentBounds.minY / spacing) * spacing;
    const endY = Math.ceil(currentBounds.maxY / spacing) * spacing;

    for (let x = startX; x <= endX; x += spacing) {
      lines.push(
        <g key={`x-${x}`}>
          <line x1={getSvgX(x)} y1={0} x2={getSvgX(x)} y2={svgHeight} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <text x={getSvgX(x) + 2} y={svgHeight - 4} fill="#475569" fontSize="8" fontFamily="monospace">{x}</text>
        </g>
      );
    }
    for (let y = startY; y <= endY; y += spacing) {
      lines.push(
        <g key={`y-${y}`}>
          <line x1={0} y1={getSvgY(y)} x2={svgWidth} y2={getSvgY(y)} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <text x={4} y={getSvgY(y) - 2} fill="#475569" fontSize="8" fontFamily="monospace">{y}</text>
        </g>
      );
    }
    return lines;
  }, [currentBounds, scale, offsetX, offsetY, svgWidth, svgHeight]);

  // 使用 memo 进一步避免不必要的渲染
  // 背景和网格由于是静态的，使用 useMemo 控制，不随动画进度产生任何变化
  const bgPathD = useMemo(() => {
    if (currentPath.length === 0) return '';
    return `M ${getSvgX(currentPath[0][0])},${getSvgY(currentPath[0][1])} ` + 
           currentPath.slice(1).map(p => `L ${getSvgX(p[0])},${getSvgY(p[1])}`).join(' ');
  }, [currentPath, getSvgX, getSvgY]);

  // 初始加载和视图切换时触发节点更新
  useEffect(() => {
    updateCanvasNodes(currentDistRef.current);
  }, [viewMode, gcode, updateCanvasNodes, currentPath.length]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', borderRadius: 1, overflow: 'hidden', position: 'relative', border: '1px solid #1e293b', transform: 'translateZ(0)' /* 开启硬件加速 */ }}>
      <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'none' }}>
          <Button onClick={() => setViewMode('XY')} sx={{ color: viewMode === 'XY' ? '#38bdf8' : '#94a3b8', borderColor: '#334155', bgcolor: viewMode === 'XY' ? 'rgba(56, 189, 248, 0.1)' : 'transparent' }}>XY</Button>
          <Button onClick={() => setViewMode('UZ')} sx={{ color: viewMode === 'UZ' ? '#38bdf8' : '#94a3b8', borderColor: '#334155', bgcolor: viewMode === 'UZ' ? 'rgba(56, 189, 248, 0.1)' : 'transparent' }}>UZ</Button>
        </ButtonGroup>
        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}> {contentWidth.toFixed(1)}x{contentHeight.toFixed(1)}mm </Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0, overflow: 'hidden', position: 'relative' }}>
        {/* 背景层依然使用被高度优化的 SVG，负责渲染坐标轴和暗色走线 */}
        <svg style={{ position: 'absolute', top: 0, left: 0 }} width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
          <g>
            {gridLines}
            <path d={bgPathD} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" style={{ shapeRendering: 'optimizeSpeed' }} />
          </g>
        </svg>
        {/* 画笔进度层改用 Canvas 接管，完全摆脱 DOM String 拼装带来的字符串回收 GC 卡顿 */}
        <canvas 
          ref={canvasRef} 
          width={svgWidth} 
          height={svgHeight} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            objectFit: 'contain' 
          }}
        />
      </Box>
    </Box>
  );
}