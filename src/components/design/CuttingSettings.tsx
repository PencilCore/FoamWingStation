import { Box, Typography, Button, Switch, FormControlLabel } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';

export default function CuttingSettings() {
  const { model, setModel } = useWing();

  const handleSlider = (name: string, val: number) => {
    setModel({ ...model, [name]: val });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', fontWeight: 'bold' }}>
        切割调校
      </Typography>

      <Box sx={{ p: 2, bgcolor: 'design.skyBg', borderRadius: 2, border: '1px dashed design.skyBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold' }}>
          安全边距设置
        </Typography>
        <SliderTextField
          label="安全边距 (Margin)"
          name="pathMargin"
          value={model.pathMargin}
          min={0}
          max={100}
          unit="mm"
          onChange={handleSlider}
        />
      </Box>

      {/* 收缩补偿：热丝切割使泡沫收缩、切槽变宽，开启后切割路径沿外沿等距外扩 */}
      <Box sx={{ p: 2, bgcolor: 'design.amberBg', borderRadius: 2, border: '1px dashed design.yellowBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.amber', mb: 1, fontWeight: 'bold' }}>
          收缩补偿
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!model.shrinkCompensationEnabled}
              onChange={(e) => setModel(prev => ({ ...prev, shrinkCompensationEnabled: e.target.checked }))}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: 'design.amber' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'design.amber', opacity: 0.4 },
              }}
            />
          }
          label="启用热丝收缩补偿"
          sx={{ mb: 1, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', color: 'text.secondary' } }}
        />
        {!!model.shrinkCompensationEnabled && (
          <SliderTextField
            label="路径外扩量 (Compensation)"
            name="shrinkCompensation"
            value={model.shrinkCompensation ?? 1}
            min={0}
            max={10}
            step={0.1}
            unit="mm"
            onChange={handleSlider}
          />
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          热丝切割会使泡沫收缩、切槽变宽。开启后切割路径沿外沿等距外扩设定值（形状变大，而非单纯增加周长），进刀路径相应缩短。
        </Typography>
      </Box>

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid design.orangeBorder' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setModel(prev => ({ ...prev, pathMargin: 10, shrinkCompensationEnabled: false, shrinkCompensation: 1 }));
          }}
          sx={{ color: 'design.orange', borderColor: 'design.orange', '&:hover': { bgcolor: 'design.orangeBg' } }}
          fullWidth
        >
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}