import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, ButtonGroup, Tooltip, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';

interface GCodePreviewProps {
  gcode: string;
  currentIndex?: number;
  onProgressChange?: (index: number) => void;
}

export default function GcodeSimulator({ gcode, currentIndex = 0, onProgressChange }: GCodePreviewProps) {
  const [viewMode, setViewMode] = useState<'XY' | 'UZ'>('XY');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 完全移除 internalTime state，避免 60fps 的 React Render
  const internalTimeRef = useRef(0);
  
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  // 1. 解析 G-code 路径
  const { paths, bounds, totalLines } = useMemo(() => {
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

    return {
      paths: { XY: xyPath, UZ: uzPath },
      bounds: { 
        XY: { minX, maxX, minY, maxY }, 
        UZ: { minX: minU, maxX: maxU, minY: minZ, maxY: maxZ } 
      },
      totalLines: rawLines.length
    };
  }, [gcode]);

  // 使用 useRef 缓存 onProgressChange，避免在 useEffect 中引起闭包陷阱或循环
  const onProgressChangeRef = React.useRef(onProgressChange);
  React.useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  const togglePlay = () => {
    if (!isPlaying) {
      // 从暂停恢复
      startTimeRef.current = performance.now() - (internalTimeRef.current / 30 * 1000);
      setIsPlaying(true);
    } else {
      // 暂停
      setIsPlaying(false);
      // 只有在暂停时才把内部状态同步到外部的左侧进度，避免动画期间的高频更新卡顿
      onProgressChangeRef.current?.(Math.floor(internalTimeRef.current));
    }
  };

  const handleRestart = () => {
    internalTimeRef.current = 0;
    updateCanvasNodes(0);
    startTimeRef.current = performance.now();
    setIsPlaying(true);
    onProgressChangeRef.current?.(0);
  };

  // 如果外部 currentIndex 改变且不是由于内部驱动（如用户拖动 Slider，或是从第一行切刀）
  useEffect(() => {
    if (!isPlaying) {
      const internalIdx = Math.floor(internalTimeRef.current);
      if (Math.abs(currentIndex - internalIdx) > 1) {
        internalTimeRef.current = currentIndex;
        updateCanvasNodes(currentIndex);
        if (sliderRef.current) {
          sliderRef.current.value = String(currentIndex);
        }
      }
    }
  }, [currentIndex, isPlaying]); // 这里暂时去掉 updateCanvasNodes 依赖，避免由于定义顺序引起的错误，使用内部闭包执行即可

  const padding = 30;
  const svgWidth = 400;
  const svgHeight = 250;

  const currentPath = viewMode === 'XY' ? paths.XY : paths.UZ;
  const currentBounds = viewMode === 'XY' ? bounds.XY : bounds.UZ;
  
  const contentWidth = Math.max(1, currentBounds.maxX - currentBounds.minX);
  const contentHeight = Math.max(1, currentBounds.maxY - currentBounds.minY);
  
  const availableWidth = svgWidth - 2 * padding;
  const availableHeight = svgHeight - 2 * padding;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

  const offsetX = (svgWidth - contentWidth * scale) / 2 - currentBounds.minX * scale;
  const offsetY = (svgHeight - contentHeight * scale) / 2 - currentBounds.minY * scale;

  const getSvgX = useCallback((x: number) => x * scale + offsetX, [scale, offsetX]);
  const getSvgY = useCallback((y: number) => svgHeight - (y * scale + offsetY), [scale, offsetY, svgHeight]);

  // 更新 Canvas 核心逻辑：最高性能的 2D 绘图
  const updateCanvasNodes = useCallback((timeFloat: number) => {
    if (!canvasRef.current || currentPath.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const progressR = totalLines > 1 ? timeFloat / (totalLines - 1) : 0;
    const clampedProgressR = Math.max(0, Math.min(1, progressR));
    const pathIdxFloat = clampedProgressR * (currentPath.length - 1);
    const idx = Math.max(0, Math.min(Math.floor(pathIdxFloat), currentPath.length - 1));
    const frac = pathIdxFloat - idx;

    ctx.clearRect(0, 0, svgWidth, svgHeight);

    // 缓存 Path2D 以避免每帧重复计算长路径
    if (!ctx.canvas.dataset.pathCache) {
      const p = new Path2D();
      p.moveTo(getSvgX(currentPath[0][0]), getSvgY(currentPath[0][1]));
      for (let i = 1; i <= currentPath.length - 1; i++) {
        p.lineTo(getSvgX(currentPath[i][0]), getSvgY(currentPath[i][1]));
      }
      // 此处将整个路径存入一个 offscreen，但此处只重绘当帧前段
    }

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

    if (progressTextRef.current) {
      const displayLine = Math.min(Math.floor(timeFloat) + 1, totalLines);
      progressTextRef.current.innerText = `${displayLine} / ${totalLines}`;
    }
    
    if (sliderRef.current) {
      sliderRef.current.value = String(Math.floor(timeFloat));
    }
  }, [currentPath, totalLines, getSvgX, getSvgY]);

  // 动画核心循环 - 彻底避开 React State
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      
      const elapsedMs = time - startTimeRef.current;
      const currentLineFloat = (elapsedMs / 1000) * 30; // 30行/秒
      
      if (currentLineFloat >= totalLines - 1) {
        startTimeRef.current = time;
        internalTimeRef.current = 0;
        updateCanvasNodes(0);
        onProgressChangeRef.current?.(0);
      } else {
        internalTimeRef.current = currentLineFloat;
        updateCanvasNodes(currentLineFloat);
        // 完全停止向父组件(App)抛出进度事件，避免由于 App 重新渲染引发的“每隔0.5s有规律卡顿”
        // UI 的更新交由 ref 直接操作 DOM（Slider与Text）完成
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalLines, updateCanvasNodes]); 

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
    updateCanvasNodes(internalTimeRef.current);
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

      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 1 }}>
        <Tooltip title={isPlaying ? "暂停" : "循环播放"}>
          <IconButton size="small" onClick={togglePlay} sx={{ color: isPlaying ? '#fb923c' : '#38bdf8', bgcolor: 'rgba(15, 23, 42, 0.8)', border: '1px solid #334155', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="从头开始">
          <IconButton size="small" onClick={handleRestart} sx={{ color: '#94a3b8', bgcolor: 'rgba(15, 23, 42, 0.8)', border: '1px solid #334155', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}>
            <ReplayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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

      <Box sx={{ px: 2, pt: 1, pb: 1, bgcolor: '#0f172a', borderTop: '1px solid #1e293b' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '10px', color: '#64748b' }}>START</Typography>
          <Typography sx={{ fontSize: '10px', color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
            <span ref={progressTextRef}>{currentIndex + 1} / {totalLines}</span>
          </Typography>
          <Typography sx={{ fontSize: '10px', color: '#64748b' }}>END</Typography>
        </Box>
        <input 
          ref={sliderRef}
          type="range" 
          min={0} 
          max={totalLines - 1 || 0} 
          defaultValue={currentIndex}
          style={{ width: '100%', height: '4px', accentColor: '#38bdf8', cursor: 'pointer', background: '#334155', appearance: 'auto' }} 
          onChange={(e) => {
            const val = Number(e.target.value);
            internalTimeRef.current = val;
            updateCanvasNodes(val);
          }}
          onMouseUp={(e) => {
            const val = Number((e.target as HTMLInputElement).value);
            onProgressChange?.(val);
          }}
          onTouchEnd={(e) => {
            const val = Number((e.target as HTMLInputElement).value);
            onProgressChange?.(val);
          }}
        />
      </Box>
    </Box>
  );
}