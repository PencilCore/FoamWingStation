import { useCallback, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface PlatformOffsetPadProps {
  /** 平台沿泡沫长度方向（两塔连线）偏移，mm，正值向右 */
  x: number;
  /** 平台沿泡沫宽度方向偏移，mm，正值向上 */
  y: number;
  /** 单轴可调范围 ±range (mm) */
  range?: number;
  /** 调整步进 (mm) */
  step?: number;
  onChange: (x: number, y: number) => void;
  helperText?: string;
}

/** 十字坐标轴控制盘：点击/拖拽同时调整平台偏移 X/Y，比两根滑条更直观 */
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
  const center = PAD / 2;
  const scale = center / range; // px per mm

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const roundStep = (v: number) => Math.round(v / step) * step;

  const applyFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clamp(clientX - rect.left, 0, PAD);
    const py = clamp(clientY - rect.top, 0, PAD);
    // X: 向右为正；Y: 向下为负（屏幕上 Y 轴向下，向上为正则取反）
    const nextX = roundStep(clamp((px - center) / scale, -range, range));
    const nextY = roundStep(clamp(-(py - center) / scale, -range, range));
    onChange(nextX, nextY);
  }, [center, scale, range, step, roundStep, onChange]);

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

  // 值 → 像素位置
  const dotX = center + x * scale;
  const dotY = center - y * scale;

  const reset = () => onChange(0, 0);

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
        平台偏移 (Platform Offset Pad)
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
            {/* 中心十字线 */}
            <Box sx={{ position: 'absolute', left: center - 0.5, top: 0, width: 1, height: PAD, bgcolor: 'rgba(56,189,248,0.28)' }} />
            <Box sx={{ position: 'absolute', left: 0, top: center - 0.5, width: PAD, height: 1, bgcolor: 'rgba(56,189,248,0.28)' }} />

            {/* 坐标轴标注 */}
            <Box sx={{ position: 'absolute', left: center + 4, top: 2 }}>{axisLabel('Y+')}</Box>
            <Box sx={{ position: 'absolute', left: center + 4, top: PAD - 14 }}>{axisLabel('Y-')}</Box>
            <Box sx={{ position: 'absolute', right: 4, top: center - 9 }}>{axisLabel('X+')}</Box>
            <Box sx={{ position: 'absolute', left: 2, top: center - 9 }}>{axisLabel('X-')}</Box>

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
