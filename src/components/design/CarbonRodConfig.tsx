// components/CarbonRodConfig.tsx
// 碳杆配置面板
import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';

export default function CarbonRodConfig() {
  const { model, setModel, handleRadioChange } = useWing();

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="subtitle2" sx={{ color: 'design.green', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        碳杆配置
      </Typography>

      {/* 启用 / 停用 */}
      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'design.slate', fontWeight: 600 }}>启用碳杆</Typography>
          <ToggleButtonGroup
            value={model.carbonRodEnabled ? 'on' : 'off'}
            exclusive
            size="small"
            onChange={(_, val) => val && setModel({ ...model, carbonRodEnabled: val === 'on' })}
            sx={{
              '& .MuiToggleButton-root': {
                border: '1px solid',
                borderColor: 'rgba(74,222,128,0.3)',
                color: 'design.slate',
                textTransform: 'none',
                px: 2,
                py: 0.3,
                fontSize: '0.75rem',
                borderRadius: '6px !important',
                '&.Mui-selected': {
                  color: 'design.green',
                  bgcolor: 'rgba(74,222,128,0.15)',
                  borderColor: 'design.green',
                },
              },
            }}
          >
            <ToggleButton value="on">开启</ToggleButton>
            <ToggleButton value="off">关闭</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {model.carbonRodEnabled && (
          <>
            <SliderTextField
              label="碳杆直径"
              name="carbonRodDiameter"
              value={model.carbonRodDiameter}
              min={1}
              max={20}
              step={0.5}
              unit="mm"
              onChange={handleSlider}
            />

            <SliderTextField
              label="碳杆位置 (从前缘起算)"
              name="carbonRodPosition"
              value={model.carbonRodPosition}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={handleSlider}
            />

            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'design.slate', mb: 1, display: 'block', fontWeight: 600 }}>
                碳杆数量
              </Typography>
              <ToggleButtonGroup
                value={model.carbonRodCount}
                exclusive
                size="small"
                onChange={(_, val) => val !== null && setModel({ ...model, carbonRodCount: val })}
                sx={{
                  '& .MuiToggleButton-root': {
                    border: '1px solid',
                    borderColor: 'rgba(74,222,128,0.3)',
                    color: 'design.slate',
                    textTransform: 'none',
                    px: 3,
                    py: 0.5,
                    fontSize: '0.75rem',
                    borderRadius: '6px !important',
                    '&.Mui-selected': {
                      color: 'design.green',
                      bgcolor: 'rgba(74,222,128,0.15)',
                      borderColor: 'design.green',
                    },
                  },
                }}
              >
                <ToggleButton value={1}>1 根</ToggleButton>
                <ToggleButton value={2}>2 根</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}