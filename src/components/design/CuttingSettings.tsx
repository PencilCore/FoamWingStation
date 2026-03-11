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
        切割偏移设置
      </Typography>

      <SliderTextField
        label="翼根偏移 (Root Offset) X"
        name="rootOffsetX"
        value={model.rootOffsetX}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

      <SliderTextField
        label="翼根偏移 (Root Offset) Y"
        name="rootOffsetY"
        value={model.rootOffsetY}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

      <SliderTextField
        label="翼尖偏移 (Tip Offset) X"
        name="tipOffsetX"
        value={model.tipOffsetX}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

      <SliderTextField
        label="翼尖偏移 (Tip Offset) Y"
        name="tipOffsetY"
        value={model.tipOffsetY}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

      <Box sx={{ mt: 1, p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', borderRadius: 2, border: '1px dashed rgba(56, 189, 248, 0.3)' }}>
        <Typography variant="subtitle2" sx={{ color: '#38bdf8', mb: 1, fontWeight: 'bold' }}>
          翼型安全边距 (安全距离)
        </Typography>
        <SliderTextField
          label="安全边距"
          name="pathMargin"
          value={model.pathMargin}
          min={0}
          max={100}
          unit="mm"
          onChange={handleSlider}
        />
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
          控制切割路径离开坐标原点的最小物理距离 (默认 10mm)。
        </Typography>
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2, color: '#fb923c' }}>
        双端位移 (Both Mode)
      </Typography>

      <SliderTextField
        label="端间 X 偏移"
        name="interWingOffsetX"
        value={model.interWingOffsetX || 0}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

      <SliderTextField
        label="端间 Y 偏移"
        name="interWingOffsetY"
        value={model.interWingOffsetY || 0}
        min={-500}
        max={500}
        unit="mm"
        onChange={handleSlider}
      />

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
              rootOffsetX: defaultModel.rootOffsetX,
              rootOffsetY: defaultModel.rootOffsetY,
              tipOffsetX: defaultModel.tipOffsetX,
              tipOffsetY: defaultModel.tipOffsetY,
              pathMargin: defaultModel.pathMargin,
              interWingOffsetX: defaultModel.interWingOffsetX,
              interWingOffsetY: defaultModel.interWingOffsetY
            }));
          }}
          sx={{ color: '#fb923c', borderColor: '#fb923c', '&:hover': { bgcolor: 'rgba(251, 146, 60, 0.1)' } }}
          fullWidth
        >
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}
