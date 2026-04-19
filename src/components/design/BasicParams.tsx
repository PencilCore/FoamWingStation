import React, { useRef } from 'react';
import { TextField, RadioGroup, FormControlLabel, Radio, Box, Checkbox, Typography, Button, Paper, Stack, Divider, Alert } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { useRequiredFoamHeight } from '../../hooks/useRequiredFoamHeight';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';
import { saveAs } from 'file-saver';

export default function BasicParams() {
  const { model, setModel, handleRadioChange } = useWing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const foamHeightInfo = useRequiredFoamHeight(model);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setModel({ ...model, [name]: finalValue });
  };

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  // 配置管理逻辑
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    saveAs(blob, `${model.modelName || 'wing-design'}.json`);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setModel(prev => ({ ...prev, ...json }));
      } catch (err) {
        alert('解析配置文件失败，请检查文件格式。');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleReset = () => {
    if (window.confirm('确定要重置所有配置吗？')) {
      setModel(defaultModel);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 所需泡沫高度提示 */}
      <Alert 
        severity={foamHeightInfo.isAdequate ? 'info' : 'warning'}
        sx={{ 
          bgcolor: foamHeightInfo.isAdequate ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderColor: foamHeightInfo.isAdequate ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          color: foamHeightInfo.isAdequate ? '#38bdf8' : '#ef4444'
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            所需泡沫块高度
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '0.875rem' }}>
            <Typography>根部厚度: <strong>{foamHeightInfo.rootMax.toFixed(1)}</strong> mm</Typography>
            <Typography>尖部厚度: <strong>{foamHeightInfo.tipMax.toFixed(1)}</strong> mm</Typography>
            <Typography sx={{ gridColumn: '1 / -1', color: foamHeightInfo.isAdequate ? '#38bdf8' : '#ef4444', fontWeight: 'bold' }}>
              ✓ 最小要求: <strong>{foamHeightInfo.required.toFixed(1)}</strong> mm | 当前设置: <strong>{model.foamThickness.toFixed(1)}</strong> mm
            </Typography>
          </Box>
          {foamHeightInfo.warning && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#ef4444' }}>
              {foamHeightInfo.warning}
            </Typography>
          )}
        </Box>
      </Alert>

      {/* 1. 模型基本属性 */}
      <Box>
        <TextField 
          label="模型名称" 
          name="modelName" 
          value={model.modelName} 
          onChange={handle} 
          fullWidth 
          size="small"
          sx={{ mb: 3, '& .MuiInputBase-input': { color: '#f8fafc', fontWeight: 'bold' } }} 
        />
        
        <SliderTextField label="全翼展" name="wingSpan" value={model.wingSpan} min={0} max={2500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="前缘后掠" name="leadingEdgeSweep" value={model.leadingEdgeSweep} min={-500} max={500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="整体扭转 (Washout)" name="washout" value={model.washout} min={-30} max={30} step={0.1} unit="deg" onChange={handleSlider} helperText="负值鼻下" />
      </Box>

      {/* 2. 变换与单位 */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel control={<Checkbox name="flipZ" checked={!!model.flipZ} onChange={handle} size="small" />} label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>换根尖部 (Flip Z)</Typography>} />
          <FormControlLabel control={<Checkbox name="mirrorX" checked={!!model.mirrorX} onChange={handle} size="small" />} label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>左右镜像 (Mirror X)</Typography>} />
          <FormControlLabel control={<Checkbox name="mirrorY" checked={!!model.mirrorY} onChange={handle} size="small" />} label={<Typography variant="caption" sx={{ color: '#38bdf8' }}>上下镜像 (Mirror Y)</Typography>} />
        </Box>
        <Divider sx={{ my: 1.5, opacity: 0.1 }} />
        <RadioGroup row name="unit" value={model.unit} onChange={handle}>
          <FormControlLabel value="mm" control={<Radio size="small" />} label={<Typography variant="caption">毫米 (mm)</Typography>} />
          <FormControlLabel value="inch" control={<Radio size="small" />} label={<Typography variant="caption">英寸 (inch)</Typography>} />
        </RadioGroup>
      </Paper>

      {/* 3. 配置存档管理 (原 ConfigManager) */}
      <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1.5, display: 'block', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          配置存档管理
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleExport}
            sx={{ flex: 1, borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', transform: 'scale(0.95)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56, 189, 248, 0.1)' } }}
          >
            导出 JSON
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => fileInputRef.current?.click()}
            sx={{ flex: 1, borderColor: 'rgba(250, 204, 21, 0.4)', color: '#facc15', transform: 'scale(0.95)', '&:hover': { borderColor: '#facc15', bgcolor: 'rgba(250, 204, 21, 0.1)' } }}
          >
            导入 JSON
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleReset}
            sx={{ flex: 1, borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', transform: 'scale(0.95)', '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
          >
            全部重置
          </Button>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
        </Stack>
        <Typography variant="caption" sx={{ color: '#64748b', mt: 1.5, display: 'block', fontSize: '0.65rem' }}>
          * 提示：您的设计会自动实时保存在浏览器中项。
        </Typography>
      </Box>
    </Box>
  );
}