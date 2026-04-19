import React, { useState, useRef } from 'react';
import { AppBar, Toolbar, Typography, Box, Tabs, Tab } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import LeftDesignTabs from './components/LeftDesignTabs';
import ThreePreview from './components/ThreePreview';
import TwoPreview from './components/TwoPreview';
import CuttingConsole from './components/console/CuttingConsole';
import SerialToolbar from './components/console/SerialToolbar';
import logo from './assets/FAVICON.PNG';
import LicenseModal from './components/LicenseModal';
import GcodeSimulator from './components/GcodeSimulator';

export default function App() {
  const [topTab, setTopTab] = useState(0); // 0 设计  1 切割
  const [leftWidth, setLeftWidth] = useState(37); // 设计界面建议比例
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [logoClicked, setLogoClicked] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dragging = useRef(false);

  // 这里的 gcodeState 应该来自切割页面的输入，
  // 暂时先定义一个状态，或者之后通过 Context/Redux 连接
  const [gcode, setGcode] = useState<string>('');
  const [currentGcodeLine, setCurrentGcodeLine] = useState(0);

  // 当切换标签页时，自动调整比例
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === topTab) return;
    
    setIsTransitioning(true);
    setTopTab(newValue);
    
    if (newValue === 0) {
      setLeftWidth(37); // 设计界面 37分
    } else {
      setLeftWidth(73); // 控制界面 73分
    }

    // 400ms 后解除模糊（与 CSS 过渡时间对应）
    setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
  };

  const handleLogoClick = () => {
    if (licenseOpen) {
      setLicenseOpen(false);
      setLogoClicked(false);
    } else {
      setLogoClicked(true);
      setLicenseOpen(true); // 同步开启
    }
  };

  // 拖动事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = leftWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientX - startX;
      // 以窗口宽度为基准
      const winWidth = window.innerWidth;
      let newLeftWidth = ((startWidth / 100) * winWidth + delta) / winWidth * 100;
      newLeftWidth = Math.max(20, Math.min(80, newLeftWidth)); // 限制范围
      setLeftWidth(newLeftWidth);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
    return (
      <ThemeProvider theme={theme}>
        <AppBar position="static" sx={{ height: 64, bgcolor: '#0f172a', zIndex: (theme) => theme.zIndex.modal + 1 }}>
          <Toolbar>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mr: 2, 
                cursor: 'pointer',
                position: 'relative',
                zIndex: (theme) => theme.zIndex.modal + 2,
                '& img': {
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: logoClicked ? 'scale(1.5) translate(16px, 24px)' : 'scale(1) translate(0, 0)',
                  filter: logoClicked ? 'brightness(1.5)' : 'none',
                }
              }} 
              onClick={handleLogoClick}
            >
              <img src={logo} alt="logo" style={{ width: 48, height: 48, marginRight: 8 }} />
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                letterSpacing: 1, 
                display: { xs: 'none', md: 'block' },
                color: '#fff',
                transition: 'opacity 0.2s ease',
                opacity: logoClicked ? 0 : 1, 
              }}>
              </Typography>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Tabs value={topTab} onChange={handleTabChange} textColor="inherit" sx={{ minWidth: 200 }}>
                <Tab label="设计" />
                <Tab label="切割" />
              </Tabs>
            </Box>

            <Box sx={{ ml: 2 }}>
              <SerialToolbar />
            </Box>
          </Toolbar>
        </AppBar>

        <Box 
          height="calc(100vh - 64px)" 
          display="flex" 
          overflow="hidden" 
          width="100%"
          sx={{
            transition: 'filter 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
            filter: isTransitioning ? 'blur(5px) brightness(0.9)' : 'none',
            pointerEvents: isTransitioning ? 'none' : 'auto'
          }}
        >
          {/* 左侧参数区：设计菜单+数据面板 */}
          <Box width={`${leftWidth}%`} minWidth={300} display="flex" flexDirection="column" bgcolor="#fafafa" p={0}>
            {topTab === 0 && <LeftDesignTabs />}
            {/* <Box flex={1} overflow="auto" bgcolor="white" p={2} borderRadius={1}>
              <ModelDataDisplay />
            </Box> */}
                     {topTab === 1 && <CuttingConsole gcode={gcode} onGcodeChange={setGcode} currentIndex={currentGcodeLine} />}
          </Box>       

          {/* 拉手分隔条 (美化：灰色，垂直居中三个点) */}
          <Box
            sx={{
              width: '12px',
              cursor: 'col-resize',
              background: '#324657ff',
              zIndex: 10,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
          >
            <Box 
              className="drag-dots"
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                opacity: 0.5,
                transition: 'opacity 0.2s'
              }}
            >
              {[1, 2, 3].map((i) => (
                <Box 
                  key={i} 
                  sx={{ 
                    width: '4px', 
                    height: '4px', 
                    borderRadius: '50%', 
                    bgcolor: '#94a3b8' 
                  }} 
                />
              ))}
            </Box>
          </Box>

          {/* 右侧预览区：2D/3D视图 or G-Code 预览 */}
          <Box width={`${100 - leftWidth}%`} p={2} display="flex" flexDirection="column" height="100%" minHeight={0}>
            {topTab === 0 ? (
              <Box flex={1} display="flex" flexDirection="column" height="100%" minHeight={0}>
                <Box flex={0.5} minHeight={0} style={{ minHeight:0}}>
                  <TwoPreview />
                </Box>
                <Box flex={1} minHeight={0} style={{ minHeight:0}}>
                  <ThreePreview />
                </Box>
              </Box>
            ) : (
              <Box flex={1} display="flex" flexDirection="column" height="100%" minHeight={0} gap={2}>
                 <Box flex={0.4} minHeight={0}>
                    <GcodeSimulator 
                      gcode={gcode} 
                      currentIndex={currentGcodeLine} 
                      onProgressChange={setCurrentGcodeLine}
                    />
                 </Box>
                 <Box flex={0.6} minHeight={0}>
                    <ThreePreview />
                 </Box>
              </Box>
            )}
          </Box>
        
        </Box>
        <LicenseModal open={licenseOpen} onClose={() => setLicenseOpen(false)} />
      </ThemeProvider>
  );
}