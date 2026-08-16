import { Box } from '@mui/material';
import logo from '../assets/FAVICON.PNG';

interface BootSplashProps {
  /** 当前加载进度 0-100 */
  progress: number;
  /** 为 true 时淡出（主界面已就绪） */
  leaving: boolean;
}

/** 启动画面：居中静态 Logo + 进度条；主界面就绪后整体淡出 */
export default function BootSplash({ progress, leaving }: BootSplashProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        bgcolor: '#0a0a0a',
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? 'none' : 'auto',
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* 静态 Logo（无动画）；alt 留空：纯装饰，避免图片加载前闪现文字 */}
      <img src={logo} alt="" style={{ width: 96, height: 96 }} />

      {/* 进度条 */}
      <Box
        sx={{
          width: 300,
          height: 3,
          borderRadius: 2,
          bgcolor: 'rgba(56,189,248,0.15)',
          overflow: 'hidden',
          mt: 0.5,
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: 2,
            background: 'linear-gradient(90deg, rgba(56,189,248,0.55), #38bdf8)',
            boxShadow: '0 0 12px rgba(56,189,248,0.6)',
            transition: 'width 0.12s linear',
          }}
        />
      </Box>
    </Box>
  );
}
