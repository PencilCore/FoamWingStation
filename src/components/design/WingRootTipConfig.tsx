// components/WingRootTipConfig.tsx
// 合并翼根 + 翼尖配置面板
import { useState } from 'react';
import { TextField, CircularProgress, Box, Button, FormControlLabel, Checkbox, Typography, Paper, Divider } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { useAirfoils } from '../../hooks/useAirfoils';
import { defaultModel } from '../../types/wing.model';
import SliderTextField from './SliderTextField';

type Section = 'root' | 'tip';

export default function WingRootTipConfig() {
  const { model, setModel, handleModelChange, handleRadioChange } = useWing();
  const { airfoils, loading } = useAirfoils();
  const [section, setSection] = useState<Section>('root');

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

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModel({ ...model, [e.target.name]: e.target.checked });
  };

  const handleNacaChange = (target: 'root' | 'tip') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    const key = target === 'root' ? 'nacaDigitsRoot' : 'nacaDigitsTip';
    setModel({ ...model, [key]: v });
  };

  const nacaDigits = section === 'root' ? model.nacaDigitsRoot : model.nacaDigitsTip;
  const nacaKey = section === 'root' ? 'nacaDigitsRoot' : 'nacaDigitsTip';

  // NACA 翼型说明
  const nacaDesc = (() => {
    const d = nacaDigits.padEnd(4, '0');
    const camber = parseInt(d[0]) || 0;
    const thick = parseInt(d.slice(2)) || 0;
    return { camber, thick };
  })();

  const isRoot = section === 'root';

  return (
    <Box>
      {/* 切换标签：翼根 / 翼尖 */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          mb: 2.5,
          p: 0.25,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 1.5,
          width: 'fit-content',
        }}
      >
        <Box
          onClick={() => setSection('root')}
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: isRoot ? '#38bdf8' : '#6b7280',
            bgcolor: isRoot ? 'rgba(56,189,248,0.12)' : 'transparent',
            transition: 'all 0.15s',
            '&:hover': { color: '#94a3b8' },
          }}
        >
          翼根配置
        </Box>
        <Box
          onClick={() => setSection('tip')}
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: !isRoot ? '#fb923c' : '#6b7280',
            bgcolor: !isRoot ? 'rgba(251,146,60,0.12)' : 'transparent',
            transition: 'all 0.15s',
            '&:hover': { color: '#94a3b8' },
          }}
        >
          翼尖配置
        </Box>
      </Box>

      {/* NACA 生成器开关 */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.3)' }}>
        <FormControlLabel
          control={
            <Checkbox
              name="useNacaGenerator"
              checked={!!model.useNacaGenerator}
              onChange={handleCheckbox}
              size="small"
              sx={{ color: 'design.purple', '&.Mui-checked': { color: 'design.purple' } }}
            />
          }
          label={
            <Typography variant="subtitle2" sx={{ color: 'design.text', fontWeight: 700 }}>
              ✦ 使用 NACA 4-digit 生成器
            </Typography>
          }
        />
        {model.useNacaGenerator && (
          <>
            <Divider sx={{ my: 1.5, opacity: 0.15 }} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label={`${isRoot ? '根部' : '尖部'} NACA 4 位数字`}
                value={nacaDigits}
                onChange={handleNacaChange(section)}
                placeholder="2412"
                size="small"
                inputProps={{ maxLength: 4, style: { fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 } }}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-input': { color: '#c084fc' }
                }}
              />
              <Box sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                <Typography variant="caption" sx={{ color: 'design.slate', display: 'block' }}>
                  弯度 {nacaDesc.camber}% / 厚 {nacaDesc.thick}%
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </Paper>

      {/* 翼型 DAT 文件选择 */}
      {!model.useNacaGenerator && (
        <TextField
          select
          label={isRoot ? '根翼型文件 (DAT)' : '尖部翼型文件 (DAT)'}
          name={isRoot ? 'rootAirfoil' : 'tipAirfoil'}
          value={isRoot ? (model.rootAirfoil || '') : (model.tipAirfoil || '')}
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
      )}

      {/* 端面弦长 */}
      <SliderTextField 
        label="端面弦长 (Chord)" 
        name={isRoot ? 'rootChord' : 'tipChord'} 
        value={isRoot ? model.rootChord : model.tipChord} 
        min={10} 
        max={1000} 
        unit="mm"
        onChange={handleSlider} 
      />

      {/* 厚度缩放 */}
      <SliderTextField 
        label={isRoot ? '根部厚度缩放' : '尖部厚度缩放'} 
        name={isRoot ? 'rootThickness' : 'tipThickness'} 
        value={isRoot ? model.rootThickness : model.tipThickness} 
        min={10} 
        max={200} 
        unit="%"
        onChange={handleSlider} 
      />

      {/* 局部扭转/安装角 */}
      <SliderTextField 
        label="局部扭转/安装角" 
        name={isRoot ? 'rootRotation' : 'tipRotation'} 
        value={isRoot ? model.rootRotation : model.tipRotation} 
        min={-90} 
        max={90} 
        step={0.1}
        unit="deg"
        onChange={handleSlider} 
      />

      {/* 恢复默认值 */}
      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${isRoot ? 'design.skyBorder' : 'design.orangeBorder'}` }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            if (isRoot) {
              setModel(prev => ({
                ...prev,
                rootAirfoil: defaultModel.rootAirfoil,
                rootChord: defaultModel.rootChord,
                rootThickness: defaultModel.rootThickness,
                rootRotation: defaultModel.rootRotation,
                nacaDigitsRoot: defaultModel.nacaDigitsRoot,
                useNacaGenerator: defaultModel.useNacaGenerator
              }));
            } else {
              setModel(prev => ({
                ...prev,
                tipAirfoil: defaultModel.tipAirfoil,
                tipChord: defaultModel.tipChord,
                tipThickness: defaultModel.tipThickness,
                tipRotation: defaultModel.tipRotation,
                nacaDigitsTip: defaultModel.nacaDigitsTip
              }));
            }
          }}
          sx={{ color: isRoot ? 'design.sky' : 'design.orange', borderColor: isRoot ? 'design.sky' : 'design.orange', '&:hover': { bgcolor: isRoot ? 'design.skyBg' : 'design.orangeBg' } }}
          fullWidth
        >
          恢复默认值
        </Button>
      </Box>
    </Box>
  );
}