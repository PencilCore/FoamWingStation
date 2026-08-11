import { Box, Typography, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
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

      <Box sx={{ mt: 1, p: 2, bgcolor: 'design.skyBg', borderRadius: 2, border: '1px dashed design.skyBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold' }}>
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
        <Typography variant="caption" sx={{ color: 'design.slate', display: 'block', mt: 0.5 }}>
          控制切割起始点相对于当前逻辑零点的偏移 (默认 10mm)。
        </Typography>
      </Box>

      <Box sx={{ mt: 1, p: 2, borderRadius: 2, border: '1px solid rgba(74, 222, 128, 0.25)', bgcolor: 'rgba(74, 222, 128, 0.05)' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.green', mb: 1, fontWeight: 'bold' }}>
          切割速度 (Feedrate)
        </Typography>
        <Typography variant="caption" sx={{ color: 'design.slate', display: 'block' }}>
          当前进给速度 <strong style={{ color: 'design.green' }}>{model.feedrate || 300} mm/min</strong>。
          修改请前往「机床设置 → 切割工艺参数」。
        </Typography>
      </Box>

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid design.orangeBorder' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setModel(prev => ({ ...prev, pathMargin: 10 }));
          }}
          sx={{ color: 'design.orange', borderColor: 'design.orange', '&:hover': { bgcolor: 'design.orangeBg' } }}
          fullWidth
        >
          恢复安全边距默认值
        </Button>
      </Box>
    </Box>
  );
}
