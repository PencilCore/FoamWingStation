// components/WingTipConfig.tsx
import { TextField, CircularProgress, Box, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { useAirfoils } from '../../hooks/useAirfoils';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function WingTipConfig() {
  const { model, setModel, handleModelChange, handleRadioChange } = useWing();
  const { airfoils, loading } = useAirfoils();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box>
      <TextField
        select
        label="尖部翼型文件"
        name="tipAirfoil"
        value={model.tipAirfoil || ''}
        onChange={handleModelChange}
        SelectProps={{ native: true }}
        fullWidth
        margin="dense"
        sx={{ mb: 3 }}
      >
        {airfoils.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </TextField>

      <SliderTextField 
        label="端面弦长 (Chord)" 
        name="tipChord" 
        value={model.tipChord} 
        min={10} 
        max={1000} 
        unit="mm"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="尖部厚度缩放" 
        name="tipThickness" 
        value={model.tipThickness} 
        min={10} 
        max={200} 
        unit="%"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="局部扭转/安装角" 
        name="tipRotation" 
        value={model.tipRotation} 
        min={-90} 
        max={90} 
        step={0.1}
        unit="deg"
        onChange={handleSlider} 
      />

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(251, 146, 60, 0.2)' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              tipAirfoil: defaultModel.tipAirfoil,
              tipChord: defaultModel.tipChord,
              tipThickness: defaultModel.tipThickness,
              tipRotation: defaultModel.tipRotation
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