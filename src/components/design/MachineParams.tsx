// src/components/MachineParams.tsx
import { RadioGroup, FormControlLabel, Radio, Box, Typography, Paper } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';

export default function MachineParams() {
  const { model, handleRadioChange } = useWing();

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="warning.main">DXF 导出设置 (开发中)</Typography>
      
      <Paper sx={{ p: 2, bgcolor: 'rgba(255,167,38,0.05)', border: '1px solid rgba(255,167,38,0.2)' }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: '#fb923c' }}>泡沫原材料尺寸</Typography>
        
        <SliderTextField 
          label="泡沫块弦长" 
          name="foamChord" 
          value={model.foamChord} 
          min={50} 
          max={1000} 
          unit="mm"
          onChange={handleSlider} 
        />

        <SliderTextField 
          label="泡沫块厚度" 
          name="foamThickness" 
          value={model.foamThickness} 
          min={5} 
          max={500} 
          unit="mm"
          onChange={handleSlider} 
        />
      </Paper>

      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>导出选项</Typography>
        
        <SliderTextField 
          label="导出比例" 
          name="exportScale" 
          value={1.0} 
          min={0.1} 
          max={10} 
          step={0.1}
          unit="x"
          onChange={() => {}} 
        />

        <RadioGroup
          row
          value={model.xySide}
          onChange={(e) => setModel(prev => ({ ...prev, xySide: e.target.value as 'left' | 'right' }))}
          sx={{ mt: 2 }}
        >
          <FormControlLabel value="right" control={<Radio color="warning" />} label="导出右翼" />
          <FormControlLabel value="left"  control={<Radio color="warning" />} label="导出左翼" />
        </RadioGroup>
      </Paper>
    </Box>
  );
}