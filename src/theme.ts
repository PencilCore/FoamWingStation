import { createTheme } from '@mui/material/styles';

/**
 * 设计界面统一色板（design tokens）。
 * 用法：sx={{ color: 'design.sky', bgcolor: 'design.skyBg' }} —— 所有颜色统一从这里取，
 * 禁止在组件中硬编码色值。
 */
export interface DesignColors {
  /** 主蓝 #3b82f6（Tabs 指示器/主按钮） */
  blue: string;
  /** 信息蓝 #38bdf8（滑块/信息高亮） */
  sky: string;
  /** 天蓝 #0ea5e9（方向控制盘） */
  skyBright: string;
  /** 琥珀 #f59e0b（导出组） */
  amber: string;
  /** 橙 #fb923c（强调橙/恢复按钮） */
  orange: string;
  /** 绿 #4ade80（成功/运动设置） */
  green: string;
  /** 红 #ef4444（错误/危险） */
  red: string;
  /** 浅红 #f87171（警告文本） */
  redLight: string;
  /** 更浅红 #fca5a5 */
  redLighter: string;
  /** 黄 #facc15（导入按钮） */
  yellow: string;
  /** 紫 #a855f7（NACA生成器高亮） */
  purple: string;
  /** 石板灰 #94a3b8（次要文本/标签） */
  slate: string;
  /** 深石板 #64748b（辅助文本/占位） */
  slateDark: string;
  /** 灰 #a3a3a3（Tab 未选中文字） */
  gray: string;
  /** 白 #f5f5f5（主要文字） */
  text: string;
  /** 代码底色 #0f172a */
  codeBg: string;
  /** 信息蓝 10% 背景 */
  skyBg: string;
  /** 信息蓝 30% 边框 */
  skyBorder: string;
  /** 主蓝 10% 背景（Tab 选中态） */
  blueBg: string;
  /** 琥珀 10% 背景（导出 Tab 选中态） */
  amberBg: string;
  /** 橙 10% 背景 */
  orangeBg: string;
  /** 橙 30% 边框 */
  orangeBorder: string;
  /** 红 10% 背景 */
  redBg: string;
  /** 红 30% 边框 */
  redBorder: string;
  /** 黄 40% 边框 */
  yellowBorder: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    design: DesignColors;
  }
  interface PaletteOptions {
    design?: Partial<DesignColors>;
  }
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6', // Blue 500
    },
    error: {
      main: '#ef4444', // Red 500
    },
    warning: {
      main: '#f59e0b', // Amber 500
    },
    secondary: {
      main: '#fb923c', // Orange 400
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#f5f5f5',
      secondary: '#a3a3a3',
    },
    divider: '#2e2e2e',
    design: {
      blue: '#3b82f6',
      sky: '#38bdf8',
      skyBright: '#0ea5e9',
      amber: '#f59e0b',
      orange: '#fb923c',
      green: '#4ade80',
      red: '#ef4444',
      redLight: '#f87171',
      redLighter: '#fca5a5',
      yellow: '#facc15',
      purple: '#a855f7',
      slate: '#94a3b8',
      slateDark: '#64748b',
      gray: '#a3a3a3',
      text: '#f5f5f5',
      codeBg: '#0f172a',
      skyBg: 'rgba(56, 189, 248, 0.1)',
      skyBorder: 'rgba(56, 189, 248, 0.3)',
      blueBg: 'rgba(59, 130, 246, 0.1)',
      amberBg: 'rgba(245, 158, 11, 0.1)',
      orangeBg: 'rgba(251, 146, 60, 0.1)',
      orangeBorder: 'rgba(251, 146, 60, 0.3)',
      redBg: 'rgba(239, 68, 68, 0.1)',
      redBorder: 'rgba(239, 68, 68, 0.3)',
      yellowBorder: 'rgba(250, 204, 21, 0.4)',
    },
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "-apple-system", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    htmlFontSize: 16,
    allVariants: {
      fontFamily: '"Inter", "system-ui", "-apple-system", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '0.025em',
    },
    subtitle1: {
      fontWeight: 500,
      color: '#3b82f6',
    },
    caption: {
      color: '#a3a3a3',
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e1e1e',
          border: '1px solid #2e2e2e',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#121212',
            '& fieldset': {
              borderColor: '#2e2e2e',
            },
            '&:hover fieldset': {
              borderColor: '#404040',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#3b82f6',
            },
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: ({ theme }) => ({
          backgroundColor: theme.palette.design.blue,
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: 'none',
          fontWeight: 600,
          color: theme.palette.text.secondary,
          '&.Mui-selected': {
            color: theme.palette.design.text,
          },
        }),
      },
    },
  },
});

export default theme;
