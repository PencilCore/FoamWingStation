// components/SegmentConfig.tsx
// 分段配置面板
import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';

export default function SegmentConfig() {
  const { model, setModel, handleRadioChange } = useWing();

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="subtitle2" sx={{ color: 'design.amber', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        分段配置
      </Typography>

      {/* 启用 / 停用 */}
      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'design.slate', fontWeight: 600 }}>启用分段切割</Typography>
          <ToggleButtonGroup
            value={model.segmentEnabled ? 'on' : 'off'}
            exclusive
            size="small"
            onChange={(_, val) => val && setModel({ ...model, segmentEnabled: val === 'on' })}
            sx={{
              '& .MuiToggleButton-root': {
                border: '1px solid',
                borderColor: 'rgba(245,158,11,0.3)',
                color: 'design.slate',
                textTransform: 'none',
                px: 2,
                py: 0.3,
                fontSize: '0.75rem',
                borderRadius: '6px !important',
                '&.Mui-selected': {
                  color: 'design.amber',
                  bgcolor: 'rgba(245,158,11,0.15)',
                  borderColor: 'design.amber',
                },
              },
            }}
          >
            <ToggleButton value="on">开启</ToggleButton>
            <ToggleButton value="off">关闭</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {model.segmentEnabled && (
          <>
            <Box sx={{ mt: 1, mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'design.slate', mb: 1, display: 'block', fontWeight: 600 }}>
                分段数量
              </Typography>
              <ToggleButtonGroup
                value={model.segmentCount}
                exclusive
                size="small"
                onChange={(_, val) => val !== null && setModel({ ...model, segmentCount: val })}
                sx={{
                  display: 'flex',
                  '& .MuiToggleButton-root': {
                    border: '1px solid',
                    borderColor: 'rgba(245,158,11,0.3)',
                    color: 'design.slate',
                    textTransform: 'none',
                    flex: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                    borderRadius: '6px !important',
                    '&.Mui-selected': {
                      color: 'design.amber',
                      bgcolor: 'rgba(245,158,11,0.15)',
                      borderColor: 'design.amber',
                    },
                  },
                }}
              >
                {[2, 3, 4, 5].map(n => (
                  <ToggleButton key={n} value={n}>{n} 段</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <SliderTextField
              label="分段间距"
              name="segmentGap"
              value={model.segmentGap}
              min={0}
              max={50}
              step={1}
              unit="mm"
              onChange={handleSlider}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}