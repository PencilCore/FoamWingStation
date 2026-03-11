// components/AirfoilConnectionConfig.tsx
import { TextField, CircularProgress, Box, Typography, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { useAirfoils } from '../../hooks/useAirfoils';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function AirfoilConnectionConfig() {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">翼型与插值设置</Typography>

      <TextField
        select
        label="根部翼型 (.dat)"
        name="rootAirfoil"
        value={model.rootAirfoil || ''}
        onChange={handleModelChange}
        SelectProps={{ native: true }}
        fullWidth
        margin="dense"
      >
        {airfoils.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </TextField>

      <TextField
        select
        label="尖部翼型 (.dat)"
        name="tipAirfoil"
        value={model.tipAirfoil || ''}
        onChange={handleModelChange}
        SelectProps={{ native: true }}
        fullWidth
        margin="dense"
      >
        {airfoils.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </TextField>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#38bdf8', mb: 1, fontWeight: 'bold' }}>翼根偏移 (Root Offset)</Typography>
        <SliderTextField label="翼根 X 偏移" name="rootOffsetX" value={model.rootOffsetX} min={0} max={500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="翼根 Y 偏移" name="rootOffsetY" value={model.rootOffsetY} min={0} max={500} unit="mm" onChange={handleSlider} />
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#fb923c', mb: 1, fontWeight: 'bold' }}>翼尖偏移 (Tip Offset)</Typography>
        <SliderTextField label="翼尖 X 偏移" name="tipOffsetX" value={model.tipOffsetX} min={0} max={500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="翼尖 Y 偏移" name="tipOffsetY" value={model.tipOffsetY} min={0} max={500} unit="mm" onChange={handleSlider} />
      </Box>

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(251, 146, 60, 0.2)' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              rootAirfoil: defaultModel.rootAirfoil,
              tipAirfoil: defaultModel.tipAirfoil,
              rootOffsetX: defaultModel.rootOffsetX,
              rootOffsetY: defaultModel.rootOffsetY,
              tipOffsetX: defaultModel.tipOffsetX,
              tipOffsetY: defaultModel.tipOffsetY
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