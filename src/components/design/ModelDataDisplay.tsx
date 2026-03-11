import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider,
  Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useWing } from '../../hooks/useWing';
import type { WingModel } from '../../types/wing.model';

// 字段标签映射 - 将英文字段名映射为中文显示
const fieldLabels: Record<string, string> = {
  modelName: '模型名称',
  wingSpan: '翼展',
  rootChord: '根弦长',
  tipChord: '尖弦长',
  washout: '扭角',
  rootAirfoil: '根部翼型',
  tipAirfoil: '尖部翼型',
  foamChord: '泡沫块弦向长度',
  foamThickness: '泡沫块厚度',
  trailingEdgeLimit: '尾缘最小厚度',
  leadingEdgeSweep: '前缘后掠量',
  feedrate: '进给速度',
  gantryDistance: '龙门架间距',
  xySide: 'XY侧边',
  xyuvMode: '轴映射模式', // 四轴
  unit: '单位',
  wireKerf: '热丝过切补偿',
  limitTrailingEdge: '限制尾缘厚度',
  generateBoth: '生成双面文件',
  rootOffsetX: '根部X偏移',
  rootOffsetY: '根部Y偏移',
  tipOffsetX: '尖部X偏移',
  tipOffsetY: '尖部Y偏移',
  interWingOffsetX: '机翼间X偏移',
  interWingOffsetY: '机翼间Y偏移',
  cutDirection: '切割方向',
  safeHeight: '安全高度',
  minFoamHeight: '最小泡沫高度'
};

// 字段分组
const fieldGroups = {
  '基本信息': ['modelName', 'wingSpan', 'rootChord', 'tipChord', 'washout'],
  '翼型文件': ['rootAirfoil', 'tipAirfoil'],
  '泡沫与加工': ['foamChord', 'foamThickness', 'trailingEdgeLimit', 'leadingEdgeSweep', 'minFoamHeight'],
  '机床设置': ['feedrate', 'gantryDistance', 'xySide', 'xyuvMode', 'unit'],
  '高级参数': ['wireKerf', 'limitTrailingEdge', 'generateBoth', 'rootOffsetX', 'rootOffsetY', 'tipOffsetX', 'tipOffsetY', 'interWingOffsetX', 'interWingOffsetY', 'cutDirection', 'safeHeight']
};

export default function ModelDataDisplay() {
  const { model } = useWing();

  const formatValue = (fieldKey: keyof WingModel, value: any): string => {
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    if (typeof value === 'number') {
      return `${value} mm`;
    }
    // xyuvMode 特殊显示
    if (Array.isArray(value) && value.length === 4) {
      return value.map(v => (v||'').toUpperCase()).join(' / ');
    }
    return String(value);
  };

  const renderFieldValue = (key: keyof WingModel, value: any): React.ReactNode => {
    const displayValue = formatValue(key, value);
    
    // 特殊处理布尔值
    if (typeof value === 'boolean') {
      return (
        <Chip 
          label={displayValue} 
          color={value ? 'success' : 'default'} 
          size="small" 
          variant="outlined"
        />
      );
    }
    
    // 特殊处理单位
    if (typeof value === 'number') {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight="medium">
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            mm
          </Typography>
        </Box>
      );
    }
    
    return (
      <Typography variant="body2" fontWeight="medium">
        {displayValue}
      </Typography>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        模型参数数据
      </Typography>
      
      <Grid container spacing={3}>
        {Object.entries(fieldGroups).map(([groupName, fields]) => (
          <Grid item xs={12} md={6} lg={4} key={groupName}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography 
                variant="h6" 
                color="primary" 
                gutterBottom
                sx={{ 
                  borderBottom: '2px solid #1976d2', 
                  pb: 1, 
                  mb: 2 
                }}
              >
                {groupName}
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={1.5}>
                {fields.map((field) => {
                  const value = model[field as keyof WingModel];
                  const label = fieldLabels[field];
                  
                  return (
                    <Box key={field}>
                      <Box 
                        display="flex" 
                        justifyContent="space-between" 
                        alignItems="center"
                        sx={{ py: 0.5 }}
                      >
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ minWidth: '120px' }}
                        >
                          {label}:
                        </Typography>
                        <Box flex={1} textAlign="right">
                          {renderFieldValue(field as keyof WingModel, value)}
                        </Box>
                      </Box>
                      <Divider sx={{ opacity: 0.3 }} />
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
      
      {/* 统计信息 */}
      <Box mt={3}>
        <Paper elevation={1} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            统计信息
          </Typography>
          <Typography variant="body2" color="text.secondary">
            总计 {Object.keys(model).length} 个参数 · 最后更新：{new Date().toLocaleString('zh-CN')}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}