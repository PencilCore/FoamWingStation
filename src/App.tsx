import React, { useState } from 'react';
import { Box, Tabs, Tab, Tooltip } from '@mui/material';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import LeftDesignTabs from './components/LeftDesignTabs';
import ThreePreview from './components/ThreePreview';
import TwoPreview from './components/TwoPreview';
import CuttingConsole from './components/console/CuttingConsole';
import SerialToolbar from './components/console/SerialToolbar';
import logo from './assets/FAVICON.PNG';
import LicenseModal from './components/LicenseModal';

export default function App() {
  const [topTab, setTopTab] = useState(0); // 0 设计  1 切割
  const [designLeftWidth, setDesignLeftWidth] = useState(37); // 设计页左侧比例
  const [licenseOpen, setLicenseOpen] = useState(false);

  // 这里的 gcodeState 应该来自切割页面的输入，
  // 暂时先定义一个状态，或者之后通过 Context/Redux 连接
  const [gcode, setGcode] = useState<string>('');
  const [currentGcodeLine, setCurrentGcodeLine] = useState(0);

  // 当切换标签页时，轨道平移，设计/切割整页无缝滑动
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === topTab) return;
    setTopTab(newValue);
  };

  const handleLogoClick = () => {
    setLicenseOpen((open) => !open);
  };

  // 设计页导出：填入对应侧 G-Code 并自动切换到切割页
  const handleExportGcode = (gcode: string) => {
    setGcode(gcode);
    setTopTab(1);
  };

  // 拖动事件处理（泛化：任意页面 + 任意宽度状态）
  const startDrag = (
    e: React.MouseEvent,
    startWidth: number,
    setWidth: React.Dispatch<React.SetStateAction<number>>
  ) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      // 以窗口宽度为基准
      const winWidth = window.innerWidth;
      let newLeftWidth = ((startWidth / 100) * winWidth + delta) / winWidth * 100;
      newLeftWidth = Math.max(20, Math.min(80, newLeftWidth)); // 限制范围
      setWidth(newLeftWidth);
    };
    const onMouseUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
              <Tooltip title="设计" placement="right" arrow>
                <Tab icon={<DesignServicesIcon fontSize="small" />} />
              </Tooltip>
              <Tooltip title="切割" placement="right" arrow>
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
                  transform: topTab === 0 ? 'translateX(0)' : 'translateX(-50%)',
                  // 强非线性：快速起步 + 平滑减速（惯性滑动感）
                  transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* ===== 设计页 ===== */}
                <Box display="flex" width="50%" height="100%" flexShrink={0} overflow="hidden">
                  {/* 左侧参数区：设计菜单+数据面板 */}
                  <Box width={`${designLeftWidth}%`} minWidth={280} display="flex" flexDirection="column" bgcolor="#121212">
                    <LeftDesignTabs onExportGcode={handleExportGcode} />
                  </Box>

                  {/* 拉手分隔条 */}
                  <Splitter onMouseDown={(e) => startDrag(e, designLeftWidth, setDesignLeftWidth)} />

                  {/* 右侧预览区：2D/3D视图 */}
                  <Box flex={1} minWidth={0} p={2} display="flex" flexDirection="column" height="100%" minHeight={0}>
                    <Box flex={0.5} minHeight={0}>
                      <TwoPreview />
                    </Box>
                    <Box flex={1} minHeight={0}>
                      <ThreePreview />
                    </Box>
                  </Box>
                </Box>

                {/* ===== 切割页 ===== */}
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

/** 拉手分隔条（灰色，垂直居中三个点） */
function Splitter({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <Box
      sx={{
        width: '12px',
        cursor: 'col-resize',
        background: '#1e1e1e',
        borderLeft: '1px solid #2e2e2e',
        borderRight: '1px solid #2e2e2e',
        zIndex: 10,
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseDown={onMouseDown}
    >
      <Box
        className="drag-dots"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          opacity: 0.5,
          transition: 'opacity 0.2s',
        }}
      >
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{ width: '4px', height: '4px', borderRadius: '50%', bgcolor: '#737373' }}
          />
        ))}
      </Box>
    </Box>
  );
}