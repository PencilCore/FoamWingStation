// src/components/GcodeExporter.tsx
import { useEffect, useState } from 'react';
import { Tabs, Tab, Box, TextField, Alert, Button, Typography } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { generateGcode } from '../../services/gcodeGenerator';

interface GcodeExporterProps {
  activeTab?: number;
}

export default function GcodeExporter({ activeTab }: GcodeExporterProps) {
  const { model, handleRadioChange } = useWing();
  const [tab, setTab] = useState(0);
  const [gcode, setGcode] = useState({ left: '', right: '', both: '', warnings: [] as string[] });

  useEffect(() => {
    const fetchGcode = async () => {
      try {
        console.log('[GcodeExporter] Starting generateGcode with model:', model);
        const result = await generateGcode(model);
        console.log('[GcodeExporter] Resolved result:', result);
        setGcode(result);
        
        // 自动更新 model 中的预览 G-code 数据组
        if (result.both && JSON.stringify(model.previewGcodeData) !== JSON.stringify(result)) {
          handleRadioChange('previewGcodeData', result);
        }
      } catch (error) {
        console.error('[GcodeExporter] Error in generateGcode:', error);
        setGcode({ left: 'Error generating G-code', right: '', both: '', warnings: ['Internal error'] });
      }
    };
    fetchGcode();
  }, [model, activeTab]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const currentCode = tab === 0 ? gcode.left : tab === 1 ? gcode.right : gcode.both;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ color: '#fb923c', mb: 2 }}>G-Code 生成预览</Typography>
      
      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        sx={{ 
          borderBottom: '1px solid #334155',
          mb: 2,
          '& .MuiTabs-indicator': { backgroundColor: '#fb923c' }
        }}
      >
        <Tab label="左翼 Left Wing" sx={{ textTransform: 'none' }} />
        <Tab label="右翼 Right Wing" sx={{ textTransform: 'none' }} />
        <Tab label="双面 Both (XYUV)" sx={{ textTransform: 'none' }} />
      </Tabs>

      {gcode.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2, bgcolor: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.2)' }}>
          {gcode.warnings.map(w => <div key={w}>{w}</div>)}
        </Alert>
      )}

      <Box sx={{ position: 'relative', mt: 3 }}>
        <TextField
          multiline
          fullWidth
          minRows={20}
          value={currentCode || '正在计算几何投影...'}
          InputProps={{ readOnly: true }}
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'JetBrains Mono, SFMono-Regular, Consolas, monospace',
              fontSize: '0.85rem',
              bgcolor: '#0f172a',
              color: '#38bdf8',
              p: 2,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#334155',
            },
          }}
        />
        
        <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 2 }}>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => copyToClipboard(currentCode)}
            sx={{ boxShadow: '0 4px 12px rgba(251, 146, 60, 0.3)' }}
          >
            复制代码 (COPY)
          </Button>
        </Box>
      </Box>
    </Box>
  );
}