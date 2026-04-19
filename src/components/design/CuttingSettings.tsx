import { Box, Typography, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function CuttingSettings() {
  const { model, setModel } = useWing();

  const handleSlider = (name: string, val: number) => {
    setModel({ ...model, [name]: val });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">
        切割运动设置
      </Typography>

      <Box sx={{ mt: 1, p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', borderRadius: 2, border: '1px dashed rgba(56, 189, 248, 0.3)' }}>
        <Typography variant="subtitle2" sx={{ color: '#38bdf8', mb: 1, fontWeight: 'bold' }}>
          翼型安全边距 (起始位置)
        </Typography>
        <SliderTextField
          label="安全边距 (Margin)"
          name="pathMargin"
          value={model.pathMargin}
          min={0}
          max={100}
          unit="mm"
          onChange={handleSlider}
        />
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
          控制切割起始点相对于当前逻辑零点的偏移 (默认 10mm)。
        </Typography>
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2, color: '#4ade80' }}>
        运动控制 (Motion Settings)
      </Typography>

      <SliderTextField
        label="切割速度 (Feedrate)"
        name="feedrate"
        value={model.feedrate || 300}
        min={10}
        max={1500}
        unit="mm/min"
        onChange={handleSlider}
      />

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(251, 146, 60, 0.2)' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              pathMargin: 10,
              feedrate: 300
            }));
          }}
          sx={{ color: '#fb923c', borderColor: '#fb923c', '&:hover': { bgcolor: 'rgba(251, 146, 60, 0.1)' } }}
          fullWidth
        >
          恢复运动默认值
        </Button>
      </Box>
    </Box>
  );
}
