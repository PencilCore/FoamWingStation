import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useWing } from '../hooks/useWing';
import { airfoilPointsGenerator } from '../services/airfoilPointsGenerator';
import { offsetPolygonOutward } from '../services/pathEngine';
import type { WingModel } from '../types/wing.model';

export default function TwoPreview() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const { model } = useWing();

  // 实时参数覆盖：SliderTextField 拖动/输入中广播 wing-param-live（2D 计算量小 → 实时重绘，不必等松开滑块）；
  // 提交（wing-param-commit）后 model 已更新，清除对应 live 值，两者保持一致。
  const [liveParams, setLiveParams] = useState<Partial<WingModel>>({});
  useEffect(() => {
    const onLive = (e: Event) => {
      const { name, value } = (e as CustomEvent<{ name: string; value: number }>).detail;
      setLiveParams(prev => {
        const next: Record<string, unknown> = { ...prev };
        next[name] = value;
        return next as Partial<WingModel>;
      });
    };
    const onCommit = (e: Event) => {
      const { name } = (e as CustomEvent<{ name: string }>).detail;
      setLiveParams(prev => {
        if (!(name in prev)) return prev;
        const next: Record<string, unknown> = { ...prev };
        delete next[name];
        return next as Partial<WingModel>;
      });
    };
    window.addEventListener('wing-param-live', onLive);
    window.addEventListener('wing-param-commit', onCommit);
    return () => {
      window.removeEventListener('wing-param-live', onLive);
      window.removeEventListener('wing-param-commit', onCommit);
    };
  }, []);

  // 拖动中：live 值覆盖对应字段实时绘制；提交后 live 值被清除，回落为 model
  const effectiveModel = useMemo(() => ({ ...model, ...liveParams }), [model, liveParams]);
  const {
    rootAirfoil,
    tipAirfoil,
    rootChord,
    tipChord,
    rootRotation,
    tipRotation,
    unit,
  } = effectiveModel;
  const {
    generateBoth,
  } = effectiveModel;

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawTokenRef = useRef(0);

  // cache last sizing to avoid resetting backing store unnecessarily
  const sizeRef = useRef<{ cssW: number; cssH: number; dpr: number } | null>(null);
  // offscreen canvas cached to avoid realloc each draw
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  
  // debounce timer to batch redraws
  const redrawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // helper: get CSS pixel size of canvas
  const getCanvasCssSize = (c: HTMLCanvasElement) => {
    // prefer getBoundingClientRect for precise CSS size
    const rect = c.getBoundingClientRect();
    let cssW = rect.width;
    let cssH = rect.height;
    // fallback if height is 0 (e.g. height:auto) - derive from attributes / aspect
    if (!cssH || cssH === 0) {
      cssW = c.clientWidth || cssW || 800;
      cssH = (c.getAttribute('height') ? Number(c.getAttribute('height')) : 420);
    }
    return { cssW, cssH };
  };

  // main draw function
  const draw = useCallback(async () => {
    const drawId = ++drawTokenRef.current;
    const c = canvas.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH } = getCanvasCssSize(c);

    // Only update backing store if size or DPR changed to avoid flicker
    const last = sizeRef.current;
    if (!last || last.cssW !== cssW || last.cssH !== cssH || last.dpr !== dpr) {
      // update backing store
      c.width = Math.max(1, Math.round(cssW * dpr));
      c.height = Math.max(1, Math.round(cssH * dpr));
      sizeRef.current = { cssW, cssH, dpr };
      // reset main ctx ref so setTransform runs below
      ctxRef.current = null;
      // ensure offscreen canvas matches backing store
      if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
      offscreenRef.current.width = c.width;
      offscreenRef.current.height = c.height;
    }

    // get main context (2d)
    const ctx = ctxRef.current || c.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    // set transform so we can work in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // offscreen canvas and context
    let off = offscreenRef.current;
    if (!off) {
      off = document.createElement('canvas');
      off.width = c.width;
      off.height = c.height;
      offscreenRef.current = off;
    } else {
      // if backing store changed ensure off matches
      if (off.width !== c.width || off.height !== c.height) {
        off.width = c.width;
        off.height = c.height;
      }
    }
    const drawCtx = off.getContext('2d');
    if (!drawCtx) return;
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // clear offscreen (in CSS pixels)
    const w = cssW;
    const h = cssH;
    drawCtx.clearRect(0, 0, w, h);

    // enhanced gradient background (matching 3D theme)
    drawCtx.fillStyle = '#121212';
    drawCtx.fillRect(0, 0, w, h);

    // subtle grid background pattern
    drawCtx.strokeStyle = 'rgba(46, 46, 46, 0.8)';
    drawCtx.lineWidth = 0.5;
    drawCtx.setLineDash([]);
    const gridSize = 50;
    for (let x = 0; x <= w; x += gridSize) {
      drawCtx.beginPath();
      drawCtx.moveTo(x, 0);
      drawCtx.lineTo(x, h);
      drawCtx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
      drawCtx.beginPath();
      drawCtx.moveTo(0, y);
      drawCtx.lineTo(w, y);
      drawCtx.stroke();
    }

    /* ---------- 1. 生成并获取已变换的翼型点 ---------- */
    const gen = await airfoilPointsGenerator(effectiveModel);
    if (drawTokenRef.current !== drawId) return; // cancelled

    const rootTrans = gen.root;
    const tipTrans = gen.tip;

    /* ---------- 2. 自适应缩放逻辑 (Bounded Box) ---------- */
    // 获取场景中所有的点（包含前缘 LE）
    const allPoints = [
      ...(rootTrans?.points || []), 
      ...(tipTrans?.points || []),
      ...(rootTrans ? [rootTrans.le] : []),
      ...(tipTrans ? [tipTrans.le] : []),
      ...((effectiveModel as any).gcodePath || []).flatMap((p: any) => [
        { x: p.x, y: p.y },
        { x: p.u, y: p.z }
      ])
    ];

    if (allPoints.length === 0) {
      // 如果没有任何点，清空画布并返回
      const ctx = ctxRef.current;
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      return;
    }

    // 计算几何包围盒
    const geomMinX = Math.min(...allPoints.map(p => p.x));
    const geomMaxX = Math.max(...allPoints.map(p => p.x));
    const geomMinY = Math.min(...allPoints.map(p => p.y));
    const geomMaxY = Math.max(...allPoints.map(p => p.y));
    
    const geomW = Math.max(0.1, geomMaxX - geomMinX);
    const geomH = Math.max(0.1, geomMaxY - geomMinY);

    // 预留边距 (优化边距：删除顶部预留区域，撑到顶部)
    const marginL = 40; 
    const marginR = 40;
    const marginT = 10; // 大幅减少顶部边距，几乎撑到顶部
    const marginB = 30;

    const innerW = Math.max(50, w - marginL - marginR);
    const innerH = Math.max(50, h - marginT - marginB);

    // 计算最佳缩放比例
    const scaleX = innerW / geomW;
    const scaleY = innerH / geomH;
    let scale = Math.min(scaleX, scaleY) * 0.95; 

    // 安全检查：如果缩放比例无效，使用默认值
    if (!isFinite(scale) || scale <= 0) scale = 1.0;

    // 计算渲染中心点
    const sceneCenterX = (geomMinX + geomMaxX) / 2;
    const sceneCenterY = (geomMinY + geomMaxY) / 2;
    
    // 画布中的目标绘图中心
    const drawTargetX = marginL + innerW / 2;
    const drawTargetY = marginT + innerH / 2;

    /* ---------- 3. 绘制单个翼型 ---------- */
    const drawAirfoil = (
      transformed: { le: { x: number; y: number }; points: { x: number; y: number }[] },
      chord: number,
      color: string,
      lightColor: string,
      _label: string, // 已通过下划线表示未使用
      options?: { dashed?: boolean; opacity?: number; labelYOffset?: number }
    ) => {
      if (!transformed || !transformed.points || transformed.points.length === 0) return;
      
      // 转换函数
      const toViewX = (x: number) => drawTargetX + (x - sceneCenterX) * scale;
      const toViewY = (y: number) => drawTargetY - (y - sceneCenterY) * scale;

      const leX = toViewX(transformed.le.x);
      const leY = toViewY(transformed.le.y);

      drawCtx.save();

      drawCtx.strokeStyle = color;
      drawCtx.fillStyle = color;
      drawCtx.lineWidth = Math.max(1.5, 2.5 * (w / 1000)); // 只有大屏幕才使用粗线
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';

      if (options?.dashed) {
        drawCtx.setLineDash([6, 4]);
        drawCtx.globalAlpha = options.opacity ?? 0.5;
      } else {
        drawCtx.setLineDash([]);
        drawCtx.globalAlpha = options?.opacity ?? 1.0;
      }

      // 绘图
      drawCtx.beginPath();
      transformed.points.forEach((p, i) => {
        const vx = toViewX(p.x);
        const vy = toViewY(p.y);
        if (i === 0) drawCtx.moveTo(vx, vy);
        else drawCtx.lineTo(vx, vy);
      });
      drawCtx.closePath();
      
      if (!options?.dashed) {
        drawCtx.shadowColor = color + '40';
        drawCtx.shadowBlur = 8;
      }
      drawCtx.stroke();

      // 绘制LE点
      drawCtx.beginPath();
      drawCtx.arc(leX, leY, 3, 0, Math.PI * 2);
      drawCtx.fill();

      // 文字标注 (统一字体：Inter/JetBrains Mono 组合)
      drawCtx.globalAlpha = 1.0;
      drawCtx.shadowBlur = 0;
      // 这里的字体需要根据系统的 UI 字体同步，或者是更通用的无衬线风格
      drawCtx.font = `600 ${Math.max(12, Math.min(14, w/70))}px "Inter", "Segoe UI", "Roboto", sans-serif`;
      drawCtx.fillStyle = lightColor;
      drawCtx.textAlign = 'right';
      drawCtx.textBaseline = 'middle';
      
      // 标签基准线对齐 (已隐藏左侧文字)
      // const labelX = marginL - 25;
      // drawCtx.fillText(label, labelX, leY + (options?.labelYOffset || 0));

      drawCtx.font = `${Math.max(10, Math.min(11, w/90))}px "JetBrains Mono", "Fira Code", monospace`;
      drawCtx.fillStyle = color;
      drawCtx.textAlign = 'left';
      drawCtx.textBaseline = 'middle';
      const unitLabel = unit === 'mm' ? 'mm' : 'in';
      drawCtx.fillText(`${chord.toFixed(1)} ${unitLabel}`, leX + 8, leY);

      drawCtx.restore();
    };

    /* ---------- 4. 绘制双翼型 ---------- */
    // 收缩补偿预览：开启时在轮廓外沿等距外扩 compDist mm（虚线显示补偿后的切割路径）
    const compDist = !!effectiveModel.shrinkCompensationEnabled
      ? (effectiveModel.unit === 'inch' ? (effectiveModel.shrinkCompensation || 0) * 25.4 : (effectiveModel.shrinkCompensation || 0))
      : 0;
    const compRoot = compDist > 0 && rootTrans?.points?.length ? offsetPolygonOutward(rootTrans.points, compDist) : null;
    const compTip = compDist > 0 && tipTrans?.points?.length ? offsetPolygonOutward(tipTrans.points, compDist) : null;
    if (rootTrans?.points?.length) {
      drawAirfoil(rootTrans, rootChord, '#0ea5e9', '#38bdf8', `Root: ${rootAirfoil}`, { labelYOffset: -10 });
      if (compRoot) {
        drawAirfoil({ le: compRoot[0], points: compRoot }, rootChord, '#38bdf8', '#38bdf8', 'Root (收缩补偿)', { dashed: true, opacity: 0.8, labelYOffset: -25 });
      }
      if (generateBoth) {
        drawAirfoil(rootTrans, rootChord, '#0ea5e9', '#38bdf8', `Root (offset)`, { dashed: true, labelYOffset: -25 });
      }
    }
    if (tipTrans?.points?.length) {
      drawAirfoil(tipTrans, tipChord, '#f97316', '#fb923c', `Tip: ${tipAirfoil}`, { labelYOffset: 10 });
      if (compTip) {
        drawAirfoil({ le: compTip[0], points: compTip }, tipChord, '#fb923c', '#fb923c', 'Tip (收缩补偿)', { dashed: true, opacity: 0.8, labelYOffset: 25 });
      }
      if (generateBoth) {
        drawAirfoil(tipTrans, tipChord, '#f97316', '#fb923c', `Tip (offset)`, { dashed: true, labelYOffset: 25 });
      }
    }

    /* ---------- 5. 绘制 G-code 路径反推轨迹 (临时隐藏引用) ---------- */
    // @ts-ignore
    const gcodePath = (effectiveModel as any).gcodePath;
    if (gcodePath && gcodePath.length > 1) {
      drawCtx.save();
      
      const toViewX = (x: number) => drawTargetX + (x - sceneCenterX) * scale;
      const toViewY = (y: number) => drawTargetY - (y - sceneCenterY) * scale;

    const drawGcodePath = (isRightTower: boolean) => {
      drawCtx.beginPath();
      drawCtx.lineWidth = 1.5;
      drawCtx.strokeStyle = isRightTower ? '#fb923c' : '#38bdf8';
      drawCtx.setLineDash([2, 5]); // 虚线表示这是从 G-code 反推的预览
      
      const path = (effectiveModel as any).gcodePath || [];
      path.forEach((p: any) => {
        const px = isRightTower ? p.u : p.x;
        const py = isRightTower ? p.z : p.y;
        const screenX = toViewX(px);
        const screenY = toViewY(py);
        
        if (path.indexOf(p) === 0) drawCtx.moveTo(screenX, screenY);
        else drawCtx.lineTo(screenX, screenY);
      });
      drawCtx.stroke();
    };

    drawGcodePath(false); // 左塔 (X, Y)
    drawGcodePath(true);  // 右塔 (U, Z)
    drawCtx.restore();
  }

  /* ---------- 6. 增强的网格 (已删除标题) ---------- */
    // reset shadow
    drawCtx.shadowColor = 'transparent';
    
    // enhance vertical guide lines
    drawCtx.strokeStyle = 'rgba(64, 64, 64, 0.3)';
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([]);
    for (let x = marginL; x < w; x += 50) {
      drawCtx.beginPath();
      drawCtx.moveTo(x, 0); // 从 0 开始绘制，撑满顶部
      drawCtx.lineTo(x, h); // 撑满底部
      drawCtx.stroke();
    }
    
    // add horizontal center line
    drawCtx.strokeStyle = 'rgba(64, 64, 64, 0.2)';
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([4, 4]);
    drawCtx.beginPath();
    drawCtx.moveTo(marginL, drawTargetY);
    drawCtx.lineTo(w - marginR, drawTargetY);
    drawCtx.stroke();

    /* ---------- 7. Blit to visible canvas (only if still current) ---------- */
    if (drawTokenRef.current === drawId) {
      // Reset transform before blitting the offscreen canvas to the main canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height); 
      ctx.drawImage(off, 0, 0);
      
      // Restore transform if we were to draw more (though we're done)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [
    effectiveModel,
    rootAirfoil,
    tipAirfoil,
    rootChord,
    tipChord,
    unit,
    generateBoth,
    // note: we intentionally do not include every model prop individually here;
    // parent effect below triggers draw when relevant model props change.
  ]);

  /* ---------- 7. 生命周期 ---------- */
  useEffect(() => {
    if (!canvas.current) return;
    // ensure initial ctx ref
    ctxRef.current = canvas.current.getContext('2d');

    // initial draw
    void draw();

    const ro = new ResizeObserver(() => {
      void draw();
    });
    ro.observe(canvas.current);

    return () => {
      ro.disconnect();
      // cancel any in-flight draw
      drawTokenRef.current++;
    };
    // draw has stable identity due to useCallback deps; but we only want to attach observer once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever model parameters change (debounced to avoid excessive redraws)
  useEffect(() => {
    // Clear previous timer if it exists
    if (redrawTimeoutRef.current) {
      clearTimeout(redrawTimeoutRef.current);
    }
    
    // Schedule a redraw 50ms after last change
    redrawTimeoutRef.current = setTimeout(() => {
      void draw();
    }, 50);

    return () => {
      // Cancel pending redraw if dependencies change again
      if (redrawTimeoutRef.current) {
        clearTimeout(redrawTimeoutRef.current);
        redrawTimeoutRef.current = null;
      }
      drawTokenRef.current++;
    };
    // include model fields that affect the generated airfoils / layout
  }, [
    rootAirfoil,
    tipAirfoil,
    rootChord,
    tipChord,
    rootRotation,
    tipRotation,
    unit,
    effectiveModel.washout,
    effectiveModel.leadingEdgeSweep,
    effectiveModel.interWingOffsetX,
    effectiveModel.interWingOffsetY,
    effectiveModel.generateBoth,
    effectiveModel.rootOffsetX,
    effectiveModel.rootOffsetY,
    effectiveModel.tipOffsetX,
    effectiveModel.tipOffsetY,
    effectiveModel.shrinkCompensationEnabled,
    effectiveModel.shrinkCompensation,
    draw, // safe to include
  ]);

  /* ---------- 8. 渲染 ---------- */
  return (
    <div style={{
      background: '#121212',
      border: '1px solid #2e2e2e',
      borderRadius: 12,
      width: '100%',
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <canvas
        ref={canvas}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          imageRendering: 'crisp-edges',
          display: 'block',
          objectFit: 'contain',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
        }}
      />
    </div>
  );
}
