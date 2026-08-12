import React, { useRef } from 'react';
import { TextField, Box, Typography, Button, Paper, Stack, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
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
          bgcolor: foamHeightInfo.isAdequate ? 'design.skyBg' : 'design.redBg',
          borderColor: foamHeightInfo.isAdequate ? 'design.skyBorder' : 'design.redBorder',
          color: foamHeightInfo.isAdequate ? 'design.sky' : 'design.red',
          py: 0.5,
        }}
      >
        <Typography variant="caption">
          所需泡沫高度: <strong>{foamHeightInfo.required.toFixed(1)}</strong> mm &nbsp;|&nbsp; 当前: <strong>{model.foamThickness.toFixed(1)}</strong> mm
          {!foamHeightInfo.isAdequate && ` — ${foamHeightInfo.warning}`}
        </Typography>
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
          sx={{ mb: 3, '& .MuiInputBase-input': { color: 'design.text', fontWeight: 'bold' } }} 
        />
        
        <SliderTextField label="全翼展 (半翼单侧)" name="wingSpan" value={model.wingSpan} min={0} max={2500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="前缘后掠 (LE Sweep)" name="leadingEdgeSweep" value={model.leadingEdgeSweep} min={-500} max={500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="后缘后掠 (TE Sweep)" name="trailingEdgeSweep" value={model.trailingEdgeSweep} min={-500} max={500} unit="mm" onChange={handleSlider} />
        <SliderTextField label="整体扭转 (Washout)" name="washout" value={model.washout} min={-30} max={30} step={0.1} unit="deg" onChange={handleSlider} />
        <SliderTextField label="上反角 (Dihedral)" name="dihedral" value={model.dihedral} min={-45} max={45} step={0.5} unit="deg" onChange={handleSlider} />
      </Box>

      {/* 2. 变换与单位 */}
      <Paper sx={{ p: 2, bgcolor: 'design.skyBg', border: '1px solid design.skyBorder', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1.5, fontWeight: 'bold', fontSize: '0.8rem' }}>
          镜像变换
        </Typography>
        <ToggleButtonGroup
          value={[]}
          exclusive
          size="small"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            mb: 2,
            '& .MuiToggleButton-root': {
              border: '1px solid',
              borderColor: 'design.skyBorder',
              color: 'design.slate',
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              fontSize: '0.75rem',
              borderRadius: '6px !important',
              '&.Mui-selected': {
                color: 'design.sky',
                bgcolor: 'rgba(56,189,248,0.2)',
                borderColor: 'design.sky',
              },
            },
          }}
        >
          <ToggleButton
            value="mirrorX"
            selected={!!model.mirrorX}
            onChange={() => setModel({ ...model, mirrorX: !model.mirrorX })}
          >
            左右镜像 (Mirror X)
          </ToggleButton>
          <ToggleButton
            value="mirrorY"
            selected={!!model.mirrorY}
            onChange={() => setModel({ ...model, mirrorY: !model.mirrorY })}
          >
            上下镜像 (Mirror Y)
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold', fontSize: '0.8rem' }}>
            单位
          </Typography>
          <ToggleButtonGroup
            value={model.unit}
            exclusive
            size="small"
            onChange={(_, val) => val && setModel({ ...model, unit: val })}
            sx={{
              '& .MuiToggleButton-root': {
                border: '1px solid',
                borderColor: 'design.skyBorder',
                color: 'design.slate',
                textTransform: 'none',
                px: 2,
                py: 0.5,
                fontSize: '0.75rem',
                borderRadius: '6px !important',
                '&.Mui-selected': {
                  color: 'design.sky',
                  bgcolor: 'rgba(56,189,248,0.2)',
                  borderColor: 'design.sky',
                },
              },
            }}
          >
            <ToggleButton value="mm">毫米 (mm)</ToggleButton>
            <ToggleButton value="inch">英寸 (inch)</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* 3. 配置存档管理 (原 ConfigManager) */}
      <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="caption" sx={{ color: 'design.slate', mb: 1.5, display: 'block', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          配置存档管理
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleExport}
            sx={{ flex: 1, borderColor: 'design.skyBorder', color: 'design.sky', transform: 'scale(0.95)', '&:hover': { borderColor: 'design.sky', bgcolor: 'design.skyBg' } }}
          >
            导出 JSON
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => fileInputRef.current?.click()}
            sx={{ flex: 1, borderColor: 'design.yellowBorder', color: 'design.yellow', transform: 'scale(0.95)', '&:hover': { borderColor: 'design.yellow', bgcolor: 'rgba(250, 204, 21, 0.1)' } }}
          >
            导入 JSON
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleReset}
            sx={{ flex: 1, borderColor: 'design.redBorder', color: 'design.red', transform: 'scale(0.95)', '&:hover': { borderColor: 'design.red', bgcolor: 'design.redBg' } }}
          >
            全部重置
          </Button>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
        </Stack>
      </Box>
    </Box>
  );
}