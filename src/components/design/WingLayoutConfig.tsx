import { Box, Typography, Divider, Chip, ToggleButtonGroup, ToggleButton } from '@mui/material';
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

  const isVert = model.stackingMode === 'vertical';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ mb: 1, p: 2, bgcolor: 'design.skyBg', borderRadius: 2, border: '1px dashed design.skyBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold' }}>
          整体切割偏移 (Coordinate Alignment)
        </Typography>
        <Typography variant="caption" sx={{ color: 'design.slate', display: 'block', mb: 2 }}>
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
        <Typography variant="subtitle2" sx={{ color: 'design.orange', mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          双翼排布模式 (Both Wings Layout)
          <Chip label="仅 BOTH 模式有效" size="small" variant="outlined" sx={{ color: 'design.slateDark', borderColor: 'design.slateDark', fontSize: '10px', height: 20 }} />
        </Typography>

        {/* 堆叠方向切换 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'design.slate', display: 'block', mb: 1 }}>
            堆叠方向
          </Typography>
          <ToggleButtonGroup
            value={model.stackingMode}
            exclusive
            size="small"
            onChange={(_, val) => val && setModel({ ...model, stackingMode: val })}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'design.slate',
                borderColor: 'design.slateDark',
                px: 2,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: 'design.orange',
                  bgcolor: 'design.orangeBg',
                  borderColor: 'design.orangeBorder',
                }
              }
            }}
          >
            <ToggleButton value="horizontal">⟷ 横向 (X轴)</ToggleButton>
            <ToggleButton value="vertical">⟵ 纵向 (Y轴)</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <SliderTextField
          label={isVert ? "纵向间隙 (Y Gap)" : "横向间隙 (X Gap)"}
          name="interWingOffsetX"
          value={model.interWingOffsetX || 0}
          min={0}
          max={500}
          unit="mm"
          onChange={handleSlider}
          helperText={isVert ? "两翼 X 方向微调对齐" : "两翼之间的水平间距"}
        />

        <SliderTextField
          label={isVert ? "横向对齐 (X Align)" : "纵向间隙 (Y Gap)"}
          name="interWingOffsetY"
          value={model.interWingOffsetY || 0}
          min={0}
          max={500}
          unit="mm"
          onChange={handleSlider}
          helperText={isVert ? "两翼之间的纵向间距" : "两翼 Y 方向微调对齐"}
        />
      </Box>
    </Box>
  );
}
