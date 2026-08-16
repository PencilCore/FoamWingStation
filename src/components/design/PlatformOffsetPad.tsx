import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Slider, TextField } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface PlatformOffsetPadProps {
  /** 平台沿泡沫长度方向（两塔连线）偏移，mm，正值向右 */
  x: number;
  /** 平台沿泡沫宽度方向偏移，mm，正值向上 */
  y: number;
  /** 单轴可调范围 0..range (mm)，仅第一象限 X≥0、Y≥0 */
  range?: number;
  /** 调整步进 (mm) */
  step?: number;
  onChange: (x: number, y: number) => void;
  helperText?: string;
}

/** 第一象限坐标控制盘：点击/拖拽同时调整平台偏移 X/Y（仅 X≥0、Y≥0），附 X/Y 滑块与输入框精确调节 */
export default function PlatformOffsetPad({
  x,
  y,
  range = 200,
  step = 0.5,
  onChange,
  helperText,
}: PlatformOffsetPadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const PAD = 240; // 画布像素尺寸
  const scale = PAD / range; // px per mm

  // 滑块/输入框本地显示值（即时跟随；提交时才回写外部）
  const [localX, setLocalX] = useState(x);
  const [localY, setLocalY] = useState(y);
  useEffect(() => {
    setLocalX(x);
    setLocalY(y);
  }, [x, y]);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const roundStep = (v: number) => Math.round(v / step) * step;

  // 画布拖拽：指针 → 第一象限值（原点左下，X 向右、Y 向上）
  const applyFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clamp(clientX - rect.left, 0, PAD);
    const py = clamp(clientY - rect.top, 0, PAD);
    const nextX = roundStep(clamp(px / scale, 0, range));
    const nextY = roundStep(clamp((PAD - py) / scale, 0, range));
    onChange(nextX, nextY);
  }, [scale, range, step, roundStep, onChange]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    applyFromPointer(e.clientX, e.clientY);
  }, [applyFromPointer]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    applyFromPointer(e.clientX, e.clientY);
  }, [applyFromPointer]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // 值 → 像素位置（左下原点）
  const dotX = x * scale;
  const dotY = PAD - y * scale;

  // 提交通知 3D 预览做模糊过渡（与 SliderTextField 一致）
  const notifyCommit = (axis: string) => {
    window.dispatchEvent(new CustomEvent('wing-param-commit', { detail: { name: axis } }));
  };

  // 滑块/输入框提交 X
  const commitX = (v: number) => {
    const next = roundStep(clamp(v, 0, range));
    setLocalX(next);
    onChange(next, y);
    notifyCommit('platformOffset');
  };

  // 滑块/输入框提交 Y
  const commitY = (v: number) => {
    const next = roundStep(clamp(v, 0, range));
    setLocalY(next);
    onChange(x, next);
    notifyCommit('platformOffsetY');
  };

  const reset = () => {
    onChange(0, 0);
    setLocalX(0);
    setLocalY(0);
    notifyCommit('platformOffset');
  };

  const axisLabel = (t: string) => (
    <Typography
      component="span"
      sx={{ color: 'design.slateDark', fontSize: '0.6rem', fontWeight: 700, userSelect: 'none' }}
    >
      {t}
    </Typography>
  );

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: 'design.slate', mb: 1, display: 'block', fontWeight: 600 }}>
        平台偏移 (Platform Offset Pad) · 仅第一象限 X/Y ≥ 0
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'relative', width: PAD + 30, height: PAD + 30 }}>
          {/* 画布 */}
          <Box
            ref={padRef}
            data-testid="platform-offset-pad"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            sx={{
              position: 'absolute',
              top: 15,
              left: 15,
              width: PAD,
              height: PAD,
              borderRadius: 2,
              cursor: 'crosshair',
              touchAction: 'none',
              bgcolor: 'design.codeBg',
              border: '1px solid',
              borderColor: 'design.skyBorder',
              backgroundImage: `
                linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px)
              `,
              backgroundSize: `${PAD / 8}px ${PAD / 8}px`,
            }}
          >
            {/* 坐标轴：左边界 Y 轴、底边界 X 轴 */}
            <Box sx={{ position: 'absolute', left: 0, top: 0, width: 1, height: PAD, bgcolor: 'rgba(56,189,248,0.35)' }} />
            <Box sx={{ position: 'absolute', left: 0, top: PAD - 1, width: PAD, height: 1, bgcolor: 'rgba(56,189,248,0.35)' }} />

            {/* 坐标轴标注：X+ 底部右侧、Y+ 左侧顶部、原点 0 */}
            <Box sx={{ position: 'absolute', right: 4, top: PAD - 14 }}>{axisLabel('X+')}</Box>
            <Box sx={{ position: 'absolute', left: 4, top: 2 }}>{axisLabel('Y+')}</Box>
            <Box sx={{ position: 'absolute', left: 4, top: PAD - 14 }}>{axisLabel('0')}</Box>

            {/* 当前位置圆点 */}
            <Box
              sx={{
                position: 'absolute',
                left: dotX - 6,
                top: dotY - 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: 'design.sky',
                boxShadow: '0 0 0 4px rgba(56,189,248,0.25), 0 0 12px rgba(56,189,248,0.6)',
                pointerEvents: 'none',
                transition: draggingRef.current ? 'none' : 'left 0.08s ease, top 0.08s ease',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* X / Y 滑块 + 输入框 */}
      <Box sx={{ mt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'design.slate', width: 70, fontWeight: 600 }}>X 偏移</Typography>
          <Slider
            value={localX}
            min={0}
            max={range}
            step={step}
            onChange={(_, v) => setLocalX(v as number)}
            onChangeCommitted={(_, v) => commitX(v as number)}
            size="small"
            sx={{ flex: 1, color: 'design.sky' }}
          />
          <TextField
            type="number"
            value={localX}
            onChange={(e) => setLocalX(Number(e.target.value))}
            onBlur={() => commitX(localX)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitX(localX);
                (e.target as HTMLInputElement).blur();
              }
            }}
            size="small"
            sx={{ width: 90 }}
            inputProps={{ step, min: 0, max: range }}
          />
          <Typography variant="caption" sx={{ color: 'design.slateDark', width: 24 }}>mm</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'design.slate', width: 70, fontWeight: 600 }}>Y 偏移</Typography>
          <Slider
            value={localY}
            min={0}
            max={range}
            step={step}
            onChange={(_, v) => setLocalY(v as number)}
            onChangeCommitted={(_, v) => commitY(v as number)}
            size="small"
            sx={{ flex: 1, color: 'design.sky' }}
          />
          <TextField
            type="number"
            value={localY}
            onChange={(e) => setLocalY(Number(e.target.value))}
            onBlur={() => commitY(localY)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitY(localY);
                (e.target as HTMLInputElement).blur();
              }
            }}
            size="small"
            sx={{ width: 90 }}
            inputProps={{ step, min: 0, max: range }}
          />
          <Typography variant="caption" sx={{ color: 'design.slateDark', width: 24 }}>mm</Typography>
        </Box>
      </Box>

      {/* 读数 + 归零 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 1 }}>
        <Typography
          variant="caption"
          sx={{ color: 'design.text', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
        >
          X: {x.toFixed(1)} mm
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'design.text', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
        >
          Y: {y.toFixed(1)} mm
        </Typography>
        <Button
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={reset}
          sx={{
            color: 'design.sky',
            borderColor: 'design.skyBorder',
            fontSize: '0.7rem',
            minHeight: 24,
            py: 0,
            '&:hover': { bgcolor: 'design.skyBg' },
          }}
          variant="outlined"
        >
          归零
        </Button>
      </Box>

      {helperText && (
        <Typography variant="caption" sx={{ color: 'design.slateDark', display: 'block', textAlign: 'center', mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
