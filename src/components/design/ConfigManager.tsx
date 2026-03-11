import React, { useRef } from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import { useWing } from '../../hooks/useWing';
import { saveAs } from 'file-saver';
import { defaultModel } from '../../types/wing.model';

export default function ConfigManager() {
  const { model, setModel } = useWing();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert('配置已成功加载！');
      } catch (err) {
        alert('解析配置文件失败，请检查文件格式。');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleReset = () => {
    if (window.confirm('确定要重置所有配置吗？此操作不可撤销。')) {
      setModel(defaultModel);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: 2, border: '1px solid #334155' }}>
      <Typography variant="subtitle2" sx={{ color: '#94a3b8', mb: 2, textTransform: 'uppercase' }}>
        配置管理 (DESIGN STORAGE)
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button 
          variant="outlined" 
          size="small" 
          onClick={handleExport}
          sx={{ borderColor: '#38bdf8', color: '#38bdf8', '&:hover': { borderColor: '#7dd3fc', bgcolor: 'rgba(56, 189, 248, 0.1)' } }}
        >
          导出 JSON (SAVE)
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => fileInputRef.current?.click()}
          sx={{ borderColor: '#facc15', color: '#facc15', '&:hover': { borderColor: '#fde047', bgcolor: 'rgba(250, 204, 21, 0.1)' } }}
        >
          导入 JSON (LOAD)
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={handleReset}
          sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#f87171', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
        >
          重置默认 (RESET)
        </Button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </Stack>
      <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>
        * 您的设计会自动保存在浏览器本地（LocalStorage），即使刷新页面也不会丢失。
      </Typography>
    </Box>
  );
}
