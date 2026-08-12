import React, { useState } from 'react';
import { Box, Tabs, Tab, Tooltip } from '@mui/material';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PanToolIcon from '@mui/icons-material/PanTool';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import BuildIcon from '@mui/icons-material/Build';
import StraightenIcon from '@mui/icons-material/Straighten';
import BarChartIcon from '@mui/icons-material/BarChart';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import LeftDesignTabs from './components/LeftDesignTabs';
import MachineParams from './components/design/MachineParams';
import DesignPreview from './components/DesignPreview';
import CuttingConsole from './components/console/CuttingConsole';
import SerialToolbar from './components/console/SerialToolbar';
import logo from './assets/FAVICON.PNG';
import LicenseModal from './components/LicenseModal';
import FloatingIconBar from './components/FloatingIconBar';
import type { IconBarItem } from './components/FloatingIconBar';

export default function App() {
  const [topTab, setTopTab] = useState(0); // 0 机型设置  1 设计  2 控制台
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [subTab, setSubTab] = useState(0);       // 设计页子项索引
  const [sectionTab, setSectionTab] = useState(0); // 机床页子项索引

  // 浮动图标条定义
  const subTabIcons: IconBarItem[] = [
    { value: 0, label: '基本设计', icon: <AutoFixHighIcon /> },
    { value: 1, label: '翼根/尖配置', icon: <AccountTreeIcon /> },
    { value: 2, label: '双翼排布', icon: <CompareArrowsIcon /> },
    { value: 3, label: '碳杆配置', icon: <BuildIcon /> },
    { value: 4, label: '分段配置', icon: <ContentCutIcon /> },
    { value: 5, label: '切割设置', icon: <PanToolIcon /> },
  ];

  const sectionIcons: IconBarItem[] = [
    { value: 0, label: '物理机床', icon: <PrecisionManufacturingIcon /> },
    { value: 1, label: '切割工艺', icon: <BuildIcon /> },
    { value: 2, label: '行程限制', icon: <StraightenIcon /> },
    { value: 3, label: '统计概览', icon: <BarChartIcon /> },
  ];

  // 这里的 gcodeState 应该来自控制台页面的输入，
  // 暂时先定义一个状态，或者之后通过 Context/Redux 连接
  const [gcode, setGcode] = useState<string>('');
  const [currentGcodeLine, setCurrentGcodeLine] = useState(0);

  // 当切换标签页时，轨道平移，设计/控制台整页无缝滑动
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === topTab) return;
    setTopTab(newValue);
  };

  const handleLogoClick = () => {
    setLicenseOpen((open) => !open);
  };

  // 设计页导出：填入对应侧 G-Code 并自动切换到控制台页
  const handleExportGcode = (gcode: string) => {
    setGcode(gcode);
    setTopTab(1);
  };

    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0a0a0a', overflow: 'hidden' }}>
          {/* ===== 左侧图标边栏（与 logo 等宽） ===== */}
          <Box
            width={64}
            flexShrink={0}
            bgcolor="#121212"
            borderRight="1px solid #2e2e2e"
            display="flex"
            flexDirection="column"
            alignItems="center"
            sx={{ boxShadow: '4px 0 24px rgba(0,0,0,0.45)', zIndex: (theme) => theme.zIndex.modal + 1 }}
          >
            {/* Logo（点击打开授权框） */}
            <Tooltip title="关于 FoamWing Station" placement="right">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 1.5,
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: (theme) => theme.zIndex.modal + 2,
                  '& img': { transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' },
                  '&:hover img': { filter: 'brightness(1.3)' },
                }}
                onClick={handleLogoClick}
              >
                <img src={logo} alt="logo" style={{ width: 44, height: 44 }} />
              </Box>
            </Tooltip>

            {/* 页面切换 Tabs（纯图标） */}
            <Tabs
              orientation="vertical"
              value={topTab}
              onChange={handleTabChange}
              sx={{
                mt: 1,
                '& .MuiTabs-indicator': {
                  left: 0,
                  width: '3px',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'design.blue',
                },
                '& .MuiTab-root': {
                  minWidth: 48,
                  minHeight: '48px',
                  borderRadius: '8px',
                  mb: 0.5,
                  color: 'design.gray',
                  '&.Mui-selected': { color: 'design.sky', bgcolor: 'design.skyBg' },
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)', color: 'design.text' },
                  transition: 'all 0.2s',
                },
              }}
            >
              <Tooltip title="机型设置" placement="right" arrow>
                <Tab icon={<SettingsIcon fontSize="small" />} />
              </Tooltip>
              <Tooltip title="设计" placement="right" arrow>
                <Tab icon={<DesignServicesIcon fontSize="small" />} />
              </Tooltip>
              <Tooltip title="控制台" placement="right" arrow>
                <Tab icon={<ContentCutIcon fontSize="small" />} />
              </Tooltip>
            </Tabs>

            {/* 弹性空间：把串口工具栏推到底部 */}
            <Box sx={{ flexGrow: 1 }} />

            {/* 串口工具栏（图标适配） */}
            <Box sx={{ py: 1.5, borderTop: '1px solid #2e2e2e', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <SerialToolbar compact />
            </Box>
          </Box>

          {/* ===== 内容区 ===== */}
          <Box flex={1} minWidth={0} sx={{ p: 1.5, boxSizing: 'border-box', height: '100%' }}>
            <Box
              overflow="hidden"
              height="100%"
              borderRadius={2}
              sx={{
                border: '1px solid #2e2e2e',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* 轨道：设计页与切割页并排，切换时整体平移，无缝连接 */}
              <Box
                display="flex"
                height="100%"
                width="200%"
                flexShrink={0}
                sx={{
                  transform: topTab >= 2 ? 'translateX(-50%)' : 'translateX(0)',
                  // 强非线性：快速起步 + 平滑减速（惯性滑动感）
                  transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* ===== 机型设置/设计页：统一布局，仅右侧内容不同 ===== */}
                <Box display="flex" width="50%" height="100%" flexShrink={0} overflow="hidden">
                  {/* 左侧：3D预览（含可呼出的2D视图）+ 浮动图标条 */}
                  <Box flex={7} minWidth={240} p={1.5} display="flex" flexDirection="column" height="100%" minHeight={0} position="relative">
                    <DesignPreview />
                    <FloatingIconBar
                      items={topTab === 0 ? sectionIcons : subTabIcons}
                      value={topTab === 0 ? sectionTab : subTab}
                      onChange={topTab === 0 ? setSectionTab : setSubTab}
                    />
                  </Box>
                  {/* 右侧参数面板（30%） */}
                  <Box flex={3} minWidth={360} display="flex" flexDirection="column" bgcolor="#121212" borderLeft="1px solid #2e2e2e">
                    {topTab === 0
                      ? <MachineParams sectionTab={sectionTab} onSectionTabChange={setSectionTab} />
                      : <LeftDesignTabs onExportGcode={handleExportGcode} subTab={subTab} onSubTabChange={setSubTab} />
                    }
                  </Box>
                </Box>

                {/* ===== 控制台页 ===== */}
                <Box width="50%" height="100%" flexShrink={0} overflow="hidden">
                  <CuttingConsole
                    gcode={gcode}
                    onGcodeChange={setGcode}
                    currentIndex={currentGcodeLine}
                    onProgressChange={setCurrentGcodeLine}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
        <LicenseModal open={licenseOpen} onClose={() => setLicenseOpen(false)} />
      </ThemeProvider>
  );
}