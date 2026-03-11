import { TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Box, Typography, Divider, Paper, Accordion, AccordionSummary, AccordionDetails, Button } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useWing } from '../../hooks/useWing';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

export default function AdvancedMachineParams() {
  const { model, setModel, handleRadioChange } = useWing();

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModel({ ...model, [e.target.name]: e.target.checked });
  };

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">机床与高级设置</Typography>

      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
        <Typography variant="subtitle1" sx={{ color: '#38bdf8', mb: 2 }}>龙门架与切割参数</Typography>
        
        <SliderTextField 
          label="龙门架跨度 (Distance)" 
          name="gantryDistance" 
          value={model.gantryDistance} 
          min={500} 
          max={3000} 
          unit="mm"
          onChange={handleSlider} 
        />

        <SliderTextField 
          label="进给速度 (Feedrate)" 
          name="feedrate" 
          value={model.feedrate} 
          min={30} 
          max={1600} 
          unit="mm/min"
          onChange={handleSlider} 
        />

        <SliderTextField 
          label="安全移动高度" 
          name="safeHeight" 
          value={model.safeHeight} 
          min={0} 
          max={200} 
          unit="mm"
          onChange={handleSlider} 
        />
        
        <SliderTextField 
          label="泡沫位置偏移 (Z)" 
          name="foamOffsetZ" 
          value={model.foamOffsetZ} 
          min={0} 
          max={1000} 
          unit="mm"
          onChange={handleSlider} 
          helperText="距离左塔架的距离"
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" sx={{ color: '#38bdf8', mb: 2 }}>双翼排布 (BOTH 模式)</Typography>
        
        <FormControlLabel
          control={<Checkbox checked={model.generateBoth} name="generateBoth" onChange={handleCheckbox} />}
          label="启用双翼一次性切割 (BOTH)"
        />

        {model.generateBoth && (
          <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">堆叠方式：</Typography>
              <RadioGroup
                row
                name="stackingMode"
                value={model.stackingMode || 'horizontal'}
                onChange={(e) => setModel({ ...model, stackingMode: e.target.value as any })}
              >
                <FormControlLabel value="horizontal" control={<Radio size="small" />} label="左右 (X轴)" />
                <FormControlLabel value="vertical" control={<Radio size="small" />} label="上下 (Y轴)" />
              </RadioGroup>
            </Box>

            <FormControlLabel
              control={<Checkbox checked={model.nestBoth} name="nestBoth" onChange={handleCheckbox} />}
              label="启用嵌套布局 (旋转180°)"
            />
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1, ml: 4 }}>
              提示：嵌套模式会将第二只机翼反转，使其与第一只机翼“头尾交错”，显著减少由于机翼尖部变细导致的泡沫浪费。
            </Typography>
          </>
        )}

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <SliderTextField 
              label="双翼 X 间距" 
              name="interWingOffsetX" 
              value={model.interWingOffsetX} 
              min={0} 
              max={1000} 
              unit="mm"
              onChange={handleSlider} 
            />
          </Grid>
          <Grid item xs={6}>
            <SliderTextField 
              label="双翼 Y 间距" 
              name="interWingOffsetY" 
              value={model.interWingOffsetY} 
              min={0} 
              max={1000} 
              unit="mm"
              onChange={handleSlider} 
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 2 }}>轴映射模式 (L-H, L-V, R-H, R-V)</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[0, 1, 2, 3].map(i => (
            <TextField
              key={i}
              label={['X', 'Y', 'U', 'Z'][i]}
              value={model.xyuvMode[i] || ''}
              onChange={e => {
                const arr = [...model.xyuvMode];
                arr[i] = e.target.value.toUpperCase();
                setModel({ ...model, xyuvMode: arr as [string, string, string, string] });
              }}
              inputProps={{ maxLength: 1, style: { textAlign: 'center' } }}
              size="small"
              sx={{ flex: 1 }}
            />
          ))}
        </Box>
      </Paper>

      <Accordion sx={{ bgcolor: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
        <AccordionSummary expandIcon={<Box sx={{ color: '#fff' }}>▼</Box>}>
          <Typography>分段与挖孔设置 (TODO)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="textSecondary">
            此功能正在开发中。未来将支持机翼垂直分段、水平分段以及内部减重孔/线槽的参数化生成。
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ bgcolor: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
        <AccordionSummary expandIcon={<Box sx={{ color: '#fff' }}>▼</Box>}>
          <Typography>模型概览数据</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">翼展:</Typography>
              <Typography variant="caption">{model.wingSpan} mm</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">弦长 (根/尖):</Typography>
              <Typography variant="caption">{model.rootChord} / {model.tipChord} mm</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">泡沫块尺寸:</Typography>
              <Typography variant="caption">{model.foamChord} x {model.foamThickness} mm</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">龙门位置:</Typography>
              <Typography variant="caption">Z=0 / Z={model.gantryDistance}</Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <FormControlLabel
        control={<Checkbox checked={model.limitTrailingEdge} onChange={handleCheckbox} name="limitTrailingEdge" />}
        label="启用尾缘过切保护"
      />
      <FormControlLabel
        control={<Checkbox checked={model.generateBoth} onChange={handleCheckbox} name="generateBoth" />}
        label="生成对称副翼"
      />

      <Typography variant="subtitle2" sx={{ mt: 1 }}>切割顺序</Typography>
      <RadioGroup
        row
        value={model.cutDirection}
        onChange={(e) => setModel({ ...model, cutDirection: Number(e.target.value) as 0 | 1 })}
      >
        <FormControlLabel value={0} control={<Radio size="small" />} label="先上后下" />
        <FormControlLabel value={1} control={<Radio size="small" />} label="先下后上" />
      </RadioGroup>

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setModel(prev => ({
              ...prev,
              foamChord: defaultModel.foamChord,
              foamThickness: defaultModel.foamThickness,
              foamLength: defaultModel.foamLength,
              machineWidth: defaultModel.machineWidth,
              machineHeight: defaultModel.machineHeight,
              machineLength: defaultModel.machineLength,
              groundClearance: defaultModel.groundClearance,
              gantryDistance: defaultModel.gantryDistance,
              feedrate: defaultModel.feedrate,
              safeHeight: defaultModel.safeHeight,
              trailingEdgeLimit: defaultModel.trailingEdgeLimit,
              limitTrailingEdge: defaultModel.limitTrailingEdge,
              generateBoth: defaultModel.generateBoth,
              cutDirection: defaultModel.cutDirection,
              xySide: defaultModel.xySide,
              xyuvMode: defaultModel.xyuvMode,
              foamRotation: defaultModel.foamRotation,
              foamOffsetZ: defaultModel.foamOffsetZ
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