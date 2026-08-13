import { useEffect, useRef, useState } from 'react';
import { Box, Slider, TextField, Typography } from '@mui/material';

interface SliderTextFieldProps {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (name: string, value: number) => void;
  helperText?: string;
  unit?: string;
}

export default function SliderTextField({
  label,
  name,
  value,
  min,
  max,
  step = 1,
  onChange,
  helperText,
  unit = ''
}: SliderTextFieldProps) {
  // 本地显示值：拖动/输入时立即更新（滑条拇指 + 数字框即时跟随）；
  // 松开滑条 / 数字框失焦或回车时才提交外部（model），拖动全程 3D 预览不重建
  const [localValue, setLocalValue] = useState<number>(value);
  // 数字框柔和淡入动画开关：每次输入变化重放一次（不重挂载，保住输入焦点）
  const [flash, setFlash] = useState(false);
  // 始终引用最新 onChange（父组件每次渲染都会新建函数，ref 避免闭包拿到旧引用）
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 外部值变化（提交回写 / 恢复默认 / 其他组件联动修改）→ 同步本地显示
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // 拖动/输入过程中：只更新本地显示 + 重放淡入动画，不提交
  const handleChange = (v: number) => {
    setLocalValue(v); // 立即反映到滑条/数字框
    // 柔和淡入：先移除动画类再添加，保证 CSS animation 重放
    setFlash(false);
    requestAnimationFrame(() => setFlash(true));
  };

  // 提交到外部 model：松开滑条（onChangeCommitted）/ 数字框失焦或回车时调用一次
  const commit = (v: number) => {
    onChangeRef.current(name, v);
    // 通知 3D 预览做「模糊→清晰化」过渡（掩盖场景重建瞬间）
    window.dispatchEvent(new CustomEvent('wing-param-commit', { detail: { name } }));
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: 'design.slate', mb: 0.5, display: 'block', fontWeight: 600 }}>
        {label} {unit && `(${unit})`}
      </Typography>
      <Box display="flex" alignItems="center" gap={3}>
        <Box flex={1}>
          <Slider
            value={localValue}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => handleChange(v as number)}
            onChangeCommitted={(_, v) => commit(v as number)}
            sx={{
              color: 'design.sky',
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                '&:before': {
                  boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
                },
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0px 0px 0px 8px rgba(56, 189, 248, 0.16)',
                },
              },
            }}
          />
        </Box>
        <Box sx={{ width: 100 }}>
          <TextField
            type="number"
            value={localValue}
            onChange={(e) => handleChange(Number(e.target.value))}
            onBlur={() => commit(localValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit(localValue);
                (e.target as HTMLInputElement).blur();
              }
            }}
            size="small"
            fullWidth
            helperText={helperText}
            inputProps={{ step }}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
                fontSize: '0.9rem',
                animation: flash ? 'valueFadeIn 0.3s ease-out' : undefined,
                '@keyframes valueFadeIn': {
                  from: { opacity: 0.15, transform: 'translateY(2px)' },
                  to: { opacity: 1, transform: 'translateY(0)' }
                }
              }
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
