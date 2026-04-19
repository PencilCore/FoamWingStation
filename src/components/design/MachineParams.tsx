import { TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Box, Typography, Divider, Paper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';

export default function MachineParams() {
  const { model, setModel, handleRadioChange } = useWing();

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModel({ ...model, [e.target.name]: e.target.checked });
  };

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">机床设置</Typography>

      {/* 1. 物理机床参数 */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
        <Typography variant="subtitle1" sx={{ color: '#38bdf8', mb: 2, fontWeight: 'bold' }}>物理机床参数</Typography>
        
        <SliderTextField 
          label="龙门架跨度 (Distance)" 
          name="gantryDistance" 
          value={model.gantryDistance} 
          min={500} 
          max={3000} 
          unit="mm"
          onChange={handleSlider} 
          helperText="热丝固定点之间的物理总宽度"
        />

        <SliderTextField 
          label="泡沫离左塔架距离 (Offset)" 
          name="foamOffsetZ" 
          value={model.foamOffsetZ} 
          min={0} 
          max={model.gantryDistance - 50} 
          unit="mm"
          onChange={handleSlider} 
          helperText="泡沫块起始位置离左塔架（Z=0）的距离"
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#94a3b8' }}>轴映射模式 (GRBL 坐标定义)</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['X', 'Y', 'U', 'Z'].map((label, i) => (
              <TextField
                key={label}
                label={label}
                value={model.xyuvMode[i] || ''}
                onChange={e => {
                  const arr = [...model.xyuvMode];
                  arr[i] = e.target.value.toUpperCase();
                  setModel({ ...model, xyuvMode: arr as [string, string, string, string] });
                }}
                inputProps={{ maxLength: 1, style: { textAlign: 'center' } }}
                size="small"
                placeholder={label}
                sx={{ 
                  flex: 1,
                  '& .MuiInputBase-input': { color: '#f1f5f9', fontWeight: 'bold' },
                  '& .MuiInputLabel-root': { color: '#64748b' }
                }}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      {/* 2. 切割工艺全局参数 */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="subtitle1" sx={{ color: '#38bdf8', mb: 2, fontWeight: 'bold' }}>切割工艺参数</Typography>

        <SliderTextField 
          label="默认进给速度 (Feedrate)" 
          name="feedrate" 
          value={model.feedrate} 
          min={30} 
          max={1600} 
          unit="mm/min"
          onChange={handleSlider} 
        />

        <SliderTextField 
          label="安全高度 (Safe H)" 
          name="safeHeight" 
          value={model.safeHeight} 
          min={0} 
          max={200} 
          unit="mm"
          onChange={handleSlider} 
          helperText="快速移动时热丝离开泡沫的高度"
        />

        <Divider sx={{ my: 2, opacity: 0.1 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={!!model.limitTrailingEdge} onChange={handleCheckbox} name="limitTrailingEdge" size="small" />}
            label={<Typography variant="body2">启用尾缘过切保护</Typography>}
          />
          
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>切割路径方向</Typography>
            <RadioGroup
              row
              value={model.cutDirection}
              onChange={(e) => setModel({ ...model, cutDirection: Number(e.target.value) as 0 | 1 })}
            >
              <FormControlLabel value={0} control={<Radio size="small" />} label={<Typography variant="caption">先上后下</Typography>} />
              <FormControlLabel value={1} control={<Radio size="small" />} label={<Typography variant="caption">先下后上</Typography>} />
            </RadioGroup>
          </Box>
        </Box>
      </Paper>

      {/* 3. 机床工作空间限制 (预览校验用) */}
      <Accordion sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', backgroundImage: 'none' }}>
        <AccordionSummary expandIcon={<Box sx={{ color: '#64748b' }}>▼</Box>}>
          <Typography variant="subtitle2">机床有效行程设置</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <SliderTextField label="最大行程 X" name="machineWidth" value={model.machineWidth} min={100} max={3000} unit="mm" onChange={handleSlider} />
          <SliderTextField label="最大高度 Y" name="machineHeight" value={model.machineHeight} min={100} max={1500} unit="mm" onChange={handleSlider} />
          <Typography variant="caption" sx={{ color: '#64748b' }}>* 这些参数仅用于生成 3D 预览中的范围警告。</Typography>
        </AccordionDetails>
      </Accordion>

      {/* 4. 模型运行统计 (快速查看) */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', border: '1px dashed rgba(56, 189, 248, 0.2)' }}>
        <Typography variant="caption" sx={{ color: '#38bdf8', display: 'block', mb: 1, fontWeight: 'bold' }}>当前模型统计概览</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <Typography variant="caption" color="textSecondary">翼展: {model.wingSpan}mm</Typography>
          <Typography variant="caption" color="textSecondary">龙门跨度: {model.gantryDistance}mm</Typography>
          <Typography variant="caption" color="textSecondary">根/尖弦长: {model.rootChord}/{model.tipChord}mm</Typography>
          <Typography variant="caption" color="textSecondary">泡沫厚度: {model.foamThickness}mm</Typography>
          <Typography variant="caption" color="textSecondary">泡沫离左塔架: {model.foamOffsetZ}mm</Typography>
          <Typography variant="caption" color="textSecondary">泡沫弦长: {model.foamChord}mm</Typography>
        </Box>
      </Paper>
    </Box>
  );
}