// components/WingRootConfig.tsx
import { TextField, CircularProgress, Box, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { useAirfoils } from '../../hooks/useAirfoils';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function WingRootConfig() {
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
        label="根翼型文件"
        name="rootAirfoil"
        value={model.rootAirfoil || ''}
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
        name="rootChord" 
        value={model.rootChord} 
        min={10} 
        max={1000} 
        unit="mm"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="根部厚度缩放" 
        name="rootThickness" 
        value={model.rootThickness} 
        min={10} 
        max={200} 
        unit="%"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="局部扭转/安装角" 
        name="rootRotation" 
        value={model.rootRotation} 
        min={-90} 
        max={90} 
        step={0.1}
        unit="deg"
        onChange={handleSlider} 
      />

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid design.skyBorder' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              rootAirfoil: defaultModel.rootAirfoil,
              rootChord: defaultModel.rootChord,
              rootThickness: defaultModel.rootThickness,
              rootRotation: defaultModel.rootRotation
            }));
          }}
          sx={{ color: 'design.sky', borderColor: 'design.sky', '&:hover': { bgcolor: 'design.skyBg' } }}
          fullWidth
        >
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}