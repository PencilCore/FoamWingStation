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
      <Typography variant="subtitle2" sx={{ color: 'design.sky', fontWeight: 'bold' }}>
        切割运动设置
      </Typography>

      <Box sx={{ p: 2, bgcolor: 'design.skyBg', borderRadius: 2, border: '1px dashed design.skyBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold' }}>
          翼型安全边距
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
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}