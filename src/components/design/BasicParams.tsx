import { TextField, RadioGroup, FormControlLabel, Radio, Box, Checkbox, Typography, Button } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function BasicParams() {
  const { model, setModel, handleRadioChange } = useWing();

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setModel({ ...model, [name]: finalValue });
  };

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box>
      <TextField label="模型名称" name="modelName" value={model.modelName} onChange={handle} fullWidth margin="dense" sx={{ mb: 3 }} />
      
      <SliderTextField 
        label="全翼展" 
        name="wingSpan" 
        value={model.wingSpan} 
        min={0} 
        max={2500} 
        unit="mm"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="前缘后掠" 
        name="leadingEdgeSweep" 
        value={model.leadingEdgeSweep} 
        min={-500} 
        max={500} 
        unit="mm"
        onChange={handleSlider} 
      />

      <SliderTextField 
        label="整体扭转 (Washout)" 
        name="washout" 
        value={model.washout} 
        min={-30} 
        max={30} 
        step={0.1}
        unit="deg"
        onChange={handleSlider} 
        helperText="负值鼻下"
      />

      <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel 
            control={<Checkbox name="flipZ" checked={!!model.flipZ} onChange={handle} size="small" />} 
            label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>换根尖部 (Flip Z)</Typography>} 
          />
          <FormControlLabel 
            control={<Checkbox name="mirrorX" checked={!!model.mirrorX} onChange={handle} size="small" />} 
            label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>左右镜像 (Mirror X)</Typography>} 
          />
          <FormControlLabel 
            control={<Checkbox name="mirrorY" checked={!!model.mirrorY} onChange={handle} size="small" />} 
            label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>上下镜像 (Mirror Y)</Typography>} 
          />
        </Box>
        <RadioGroup row name="unit" value={model.unit} onChange={handle} sx={{ mt: 1 }}>
          <FormControlLabel value="mm" control={<Radio size="small" />} label="计算单位: 毫米 (mm)" />
          <FormControlLabel value="inch" control={<Radio size="small" />} label="计算单位: 英寸 (inch)" />
        </RadioGroup>
      </Box>

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              modelName: defaultModel.modelName,
              wingSpan: defaultModel.wingSpan,
              leadingEdgeSweep: defaultModel.leadingEdgeSweep,
              washout: defaultModel.washout,
              unit: defaultModel.unit,
              flipZ: defaultModel.flipZ,
              mirrorX: defaultModel.mirrorX,
              mirrorY: defaultModel.mirrorY
            }));
          }}
          sx={{ color: '#38bdf8', borderColor: '#38bdf8', '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.1)' } }}
          fullWidth
        >
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}