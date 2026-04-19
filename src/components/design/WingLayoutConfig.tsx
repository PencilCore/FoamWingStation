import React from 'react';
import { Box, Typography, Button, Divider, Chip } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';
import DirectionalLayout from './DirectionalLayout';

export default function WingLayoutConfig() {
  const { model, setModel } = useWing();

  const handleSlider = (name: string, val: number) => {
    setModel({ ...model, [name]: val });
  };

  const handleNumericChange = (name: string, newVal: number) => {
     setModel({ ...model, [name]: newVal });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ mb: 1, p: 2, bgcolor: 'rgba(56, 189, 248, 0.05)', borderRadius: 2, border: '1px dashed rgba(56, 189, 248, 0.3)' }}>
        <Typography variant="subtitle2" sx={{ color: '#38bdf8', mb: 1, fontWeight: 'bold' }}>
          整体切割偏移 (Coordinate Alignment)
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>
           设置机翼中心相对于机床坐标原点 (0,0) 的位置。
        </Typography>

        {/* 翼根偏移控制 */}
        <DirectionalLayout 
          label="翼根偏移 (Root)"
          xValue={model.rootOffsetX || 0}
          yValue={model.rootOffsetY || 0}
          onXChange={(val) => handleNumericChange('rootOffsetX', val)}
          onYChange={(val) => handleNumericChange('rootOffsetY', val)}
          step={1}
        />

        <SliderTextField
           label="翼根 X (mm)"
           name="rootOffsetX"
           value={model.rootOffsetX}
           min={-500}
           max={500}
           unit="mm"
           onChange={handleSlider}
        />
        <SliderTextField
           label="翼根 Y (mm)"
           name="rootOffsetY"
           value={model.rootOffsetY}
           min={-500}
           max={500}
           unit="mm"
           onChange={handleSlider}
        />

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

        {/* 翼尖偏移控制 */}
        <DirectionalLayout 
          label="翼尖偏移 (Tip)"
          xValue={model.tipOffsetX || 0}
          yValue={model.tipOffsetY || 0}
          onXChange={(val) => handleNumericChange('tipOffsetX', val)}
          onYChange={(val) => handleNumericChange('tipOffsetY', val)}
          step={1}
        />

        <SliderTextField
           label="翼尖 X (mm)"
           name="tipOffsetX"
           value={model.tipOffsetX}
           min={-500}
           max={500}
           unit="mm"
           onChange={handleSlider}
        />
        <SliderTextField
           label="翼尖 Y (mm)"
           name="tipOffsetY"
           value={model.tipOffsetY}
           min={-500}
           max={500}
           unit="mm"
           onChange={handleSlider}
        />
      </Box>

      {/* 双翼模式排布 */}
      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#fb923c', mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          双翼间距 (Both Wings Layout)
          <Chip label="仅 BOTH 模式有效" size="small" variant="outlined" sx={{ color: '#64748b', borderColor: '#334155', fontSize: '10px', height: 20 }} />
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
      </Box>
    </Box>
  );
}
