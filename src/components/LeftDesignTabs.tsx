import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Divider,
} from '@mui/material';

// 三个页面的组件（这里先用占位，实际替换成你的组件）
import BasicParams from './design/BasicParams';
import WingTipConfig from './design/WingTipConfig';
import WingRootConfig from './design/WingRootConfig';
import MachineParams from './design/MachineParams';
import GcodeExporter from './design/GcodeExporter';
import AirfoilConnectionConfig from './design/AirfoilConnectionConfig';
import CuttingSettings from './design/CuttingSettings';
import WingLayoutConfig from './design/WingLayoutConfig';
import { useWing } from '../hooks/useWing';

// 扩展 tabConfig 以包含导出设置的 Tab，便于演示 design_idx = 7 的效果
const tabConfig = [
  { label: '基本设计', component: <BasicParams /> },      // 0
  { label: '翼根配置', component: <WingRootConfig /> },    // 1
  { label: '翼尖配置', component: <WingTipConfig /> },    // 2
  { label: '双翼排布', component: <WingLayoutConfig /> },    // 3
  { label: '翼型连接', component: <AirfoilConnectionConfig /> },    // 4
  { label: '机床设置', component: <MachineParams /> },   // 5
  { label: '切割设置', component: <CuttingSettings /> },     // 6

  // 索引 7 开始是“导出设置”
  { label: 'G-Code导出', component: <GcodeExporter /> }, // 7
  { label: 'DXF导出 (开发中)', component: <Box sx={{ p: 2, color: 'text.secondary' }}>此功能正在开发中</Box> },    // 8
];

// 定义分割点：前 design_idx 个 Tab 属于设计参数
const design_idx = 7;

// 辅助函数：渲染单个 Tab 的样式和逻辑
const renderTabItem = (item: typeof tabConfig[0], idx: number, activeTab: number, color: string = '#38bdf8') => (
    <Tab
        key={idx}
        label={item.label}
        id={`vertical-tab-${idx}`}
        aria-controls={`vertical-tabpanel-${idx}`}
        value={idx} 
        sx={{
            alignItems: 'flex-start',
            textAlign: 'left',
            color: '#94a3b8',
            fontSize: '0.85rem',
            minHeight: '44px',
            py: 1.5,
            px: 2,
            opacity: activeTab === idx ? 1 : 0.7,
            '&.Mui-selected': {
                color: '#f8fafc',
                bgcolor: activeTab === idx ? `rgba(${color === '#38bdf8' ? '56, 189, 248' : '251, 146, 60'}, 0.1)` : 'transparent',
            },
            '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.04)',
            },
            transition: 'all 0.2s',
            borderRadius: '6px',
            mb: 0.5,
            textTransform: 'none',
        }}
    />
);


export default function LeftDesignTabs() {
  const { model } = useWing();
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const designTabs = tabConfig.slice(0, design_idx);
  const exportTabs = tabConfig.slice(design_idx);

  // 校验逻辑
  const isSpanOver = (model.wingSpan + (model.foamOffsetZ || 0)) > model.gantryDistance;
  const isChordOver = model.foamChord > (model.machineWidth || 1000);
  const isThicknessOver = model.foamThickness > (model.machineHeight || 500);
  const isWarning = isSpanOver || isChordOver || isThicknessOver;

  return (
    <Box display="flex" height="100vh" bgcolor="#0f172a">
      {/* 左侧 Tab 栏 */}
      <Box
        width={180}
        bgcolor="#1e293b"
        color="#f8fafc"
        p={2}
        borderRight="1px solid #334155"
        display="flex"
        flexDirection="column"
      >
        {/* 1. 参数设置标题 */}
        <Typography variant="h6" sx={{ mb: 2, pl: 1, color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} align='left'>
          Design config
        </Typography>

        <Tabs
          orientation="vertical"
          value={activeTab < design_idx ? activeTab : false}
          onChange={handleChange}
          sx={{
            '& .MuiTabs-indicator': {
              left: 0,
              width: '3px',
              borderRadius: '0 4px 4px 0',
              backgroundColor: '#38bdf8',
            },
          }}
        >
          {designTabs.map((item, idx) => renderTabItem(item, idx, activeTab, '#38bdf8'))}
        </Tabs>

        {/* 2. 导出设置标题 */}
        <Typography variant="h6" sx={{ mt: 4, mb: 1, pl: 1, color: '#fb923c', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }} align='left'>
          Exports
        </Typography>

        <Tabs
          orientation="vertical"
          value={activeTab >= design_idx ? activeTab : false}
          onChange={handleChange}
          sx={{
            '& .MuiTabs-indicator': {
              left: 0,
              width: '3px',
              borderRadius: '0 4px 4px 0',
              backgroundColor: '#fb923c',
            },
          }}
        >
          {exportTabs.map((item, idx) => renderTabItem(item, idx + design_idx, activeTab, '#fb923c'))}
        </Tabs>

        {/* 自动弹性空间，将警告推到底部 */}
        <Box sx={{ flexGrow: 1 }} />

        {/* 底部警告通知栏 */}
        {isWarning && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: '8px',
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 0.8 },
                '50%': { opacity: 1, transform: 'scale(1.02)' },
                '100%': { opacity: 0.8 },
              }
            }}
          >
            <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span> 尺寸超限警报
            </Typography>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(239, 68, 68, 0.2)' }} />
            {isSpanOver && (
              <Typography variant="caption" sx={{ color: '#f87171', display: 'block', mt: 0.5 }}>
                • 长度({model.wingSpan + model.foamOffsetZ}mm) 超过龙门架!
              </Typography>
            )}
            {isChordOver && (
              <Typography variant="caption" sx={{ color: '#fca5a5', display: 'block' }}>
                • 泡沫弦长超出机床 X 范围
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* 右侧内容区 */}
      <Box flex={1} overflow="auto" p={4} bgcolor="#0f172a" position="relative">
        <Box sx={{ display: activeTab === design_idx ? 'block' : 'none', width: '100%', height: '100%' }}>
          <GcodeExporter />
        </Box>
        {activeTab !== design_idx && (tabConfig[activeTab] ? tabConfig[activeTab].component : null)}
      </Box>
    </Box>
  );
}