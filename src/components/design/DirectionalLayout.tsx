import React from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import { 
  KeyboardArrowUp, 
  KeyboardArrowDown, 
  KeyboardArrowLeft, 
  KeyboardArrowRight 
} from '@mui/icons-material';

interface DirectionalLayoutProps {
  label: string;
  xValue: number;
  yValue: number;
  onXChange: (newVal: number) => void;
  onYChange: (newVal: number) => void;
  step?: number;
}

export default function DirectionalLayout({ 
  label, 
  xValue, 
  yValue, 
  onXChange, 
  onYChange, 
  step = 1 
}: DirectionalLayoutProps) {
  
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ color: '#94a3b8', mb: 1, fontWeight: 'bold' }}>
        {label} (X: {xValue}mm, Y: {yValue}mm)
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 方向控制盘 */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 36px)', 
          gridTemplateRows: 'repeat(3, 36px)',
          gap: 0.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          p: 1,
          borderRadius: 2,
          border: '1px solid #334155'
        }}>
          <div />
          <IconButton 
            size="small" 
            onClick={() => onYChange(yValue + step)}
            sx={{ color: '#0ea5e9', bgcolor: 'rgba(14, 165, 233, 0.1)' }}
          >
            <KeyboardArrowUp fontSize="small" />
          </IconButton>
          <div />
          
          <IconButton 
            size="small" 
            onClick={() => onXChange(xValue - step)}
            sx={{ color: '#0ea5e9', bgcolor: 'rgba(14, 165, 233, 0.1)' }}
          >
            <KeyboardArrowLeft fontSize="small" />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 10, fontWeight: 'bold' }}>
            MOVE
          </Box>
          <IconButton 
            size="small" 
            onClick={() => onXChange(xValue + step)}
            sx={{ color: '#0ea5e9', bgcolor: 'rgba(14, 165, 233, 0.1)' }}
          >
            <KeyboardArrowRight fontSize="small" />
          </IconButton>
          
          <div />
          <IconButton 
            size="small" 
            onClick={() => onYChange(yValue - step)}
            sx={{ color: '#0ea5e9', bgcolor: 'rgba(14, 165, 233, 0.1)' }}
          >
            <KeyboardArrowDown fontSize="small" />
          </IconButton>
          <div />
        </Box>

        {/* 输入微调区可以根据需要添加，这里暂时只用方向键 */}
        <Box sx={{ flex: 1 }}>
           <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
             使用方向键进行 {step}mm 步进微调。
           </Typography>
        </Box>
      </Box>
    </Box>
  );
}
