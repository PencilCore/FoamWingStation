import React, { lazy, Suspense, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { useWing } from '../hooks/useWing';
import { useRequiredFoamHeight } from '../hooks/useRequiredFoamHeight';
import { generateGcode } from '../services/gcodeGenerator';
import { computeGcodeSig } from '../services/pathEngine';
import TwoPreview from './TwoPreview';

// ===== 懒加载：所有机翼设计组件按需加载，缩小首屏 bundle =====
const BasicParams = lazy(() => import('./design/BasicParams'));
const WingRootTipConfig = lazy(() => import('./design/WingRootTipConfig'));
const WingLayoutConfig = lazy(() => import('./design/WingLayoutConfig'));
const CarbonRodConfig = lazy(() => import('./design/CarbonRodConfig'));
const SegmentConfig = lazy(() => import('./design/SegmentConfig'));
const CuttingSettings = lazy(() => import('./design/CuttingSettings'));

/** 图案设计占位面板（预留） */
function PatternPlaceholder() {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h6" sx={{ mb: 1, color: 'design.gray' }}>图案设计</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>此功能正在开发中，敬请期待</Typography>
    </Box>
  );
}

// 组件引用而非 JSX 实例，避免每次渲染重建组件
interface TabDef {
  label: string;
  Component: React.ComponentType;
}

// 机翼设计子项面板列表
const wingSubTabs: TabDef[] = [
  { label: '基本设计', Component: BasicParams },                 // 0
  { label: '翼根/尖配置', Component: WingRootTipConfig },        // 1
  { label: '双翼排布', Component: WingLayoutConfig },            // 2
  { label: '碳杆配置', Component: CarbonRodConfig },             // 3
  { label: '分段配置', Component: SegmentConfig },               // 4
  { label: '切割调校', Component: CuttingSettings },             // 5
];

interface LeftDesignTabsProps {
  /** 导出按钮回调：回传对应侧 G-Code，由 App 自动切换到切割页 */
  onExportGcode?: (gcode: string, side: 'left' | 'right' | 'both') => void;
  /** 当前激活的子项索引 */
  subTab?: number;
  /** 子项切换回调 */
  onSubTabChange?: (tab: number) => void;
}

export default function LeftDesignTabs({ onExportGcode, subTab: externalSubTab, onSubTabChange: _onSubTabChange }: LeftDesignTabsProps) {
  const { model, handleRadioChange } = useWing();
  const [mainTab, setMainTab] = useState(0);   // 0 机翼设计  1 图案设计（预留）
  const [internalSubTab] = useState(0);     // 机翼设计子项索引（受控模式由 App 提供）
  const [exporting, setExporting] = useState(false);

  // 使用外部状态（如果提供），否则使用内部状态
  const subTab = externalSubTab ?? internalSubTab;

  // ===== 校验状态 =====
  const foamInfo = useRequiredFoamHeight(model);

  // 当前激活组件
  const ActiveComponent: React.ComponentType =
    mainTab === 1
      ? PatternPlaceholder
      : wingSubTabs[subTab].Component;

  // 导出：生成对应侧 G-Code 并回传 App 切换到切割页
  const handleExport = async (side: 'left' | 'right' | 'both') => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await generateGcode(model);
      const code = side === 'left' ? result.left : side === 'right' ? result.right : result.both;
      // 同步预览数据，供切割页与徽标使用（附带参数签名，供 3D 预览校验快照是否过期）
      const snap = { ...result, sig: computeGcodeSig(model) };
      if (result.both && JSON.stringify(model.previewGcodeData) !== JSON.stringify(snap)) {
        handleRadioChange('previewGcodeData', snap);
      }
      onExportGcode?.(code || '', side);
    } catch (error) {
      console.error('[LeftDesignTabs] G-Code 生成失败:', error);
      alert('G-Code 生成失败，请检查机翼与机床参数');
    } finally {
      setExporting(false);
    }
  };

  /** 当前面板的校验摘要（显示在内容区顶部） */
  const renderSummary = () => {
    if (mainTab === 0 && subTab === 0 && !foamInfo.isAdequate) {
      return (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: 'design.redBg', color: 'design.redLight', border: '1px solid', borderColor: 'design.redBorder' }}>
          {foamInfo.warning}
        </Alert>
      );
    }
    return null;
  };

  return (
    <Box display="flex" flexDirection="column" height="100%" width="100%" minHeight={0} bgcolor="background.default" position="relative">
      {/* 顶部：2D 设计视图（默认常驻显示） */}
      <Box
        height="30%"
        minHeight={160}
        flexShrink={0}
        display="flex"
        flexDirection="column"
        borderBottom="1px solid #2e2e2e"
        overflow="hidden"
      >
        {/* 标题条 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            bgcolor: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'design.sky', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            2D 设计视图
          </Typography>
        </Box>
        <Box flex={1} minHeight={0} p={0.75}>
          <TwoPreview />
        </Box>
      </Box>

      {/* 主内容区 */}
      <Box flex={1} overflow="auto" p={3} bgcolor="background.default" position="relative" minWidth={0}>
        {/* 顶部：机翼设计/图案设计切换 */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            mb: 2,
            p: 0.25,
            bgcolor: 'rgba(255,255,255,0.04)',
            borderRadius: 1.5,
            width: 'fit-content',
          }}
        >
          <Box
            onClick={() => setMainTab(0)}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: mainTab === 0 ? '#60a5fa' : '#6b7280',
              bgcolor: mainTab === 0 ? 'rgba(96,165,250,0.12)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': { color: '#94a3b8' },
            }}
          >
            机翼设计
          </Box>
          <Box
            onClick={() => setMainTab(1)}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: mainTab === 1 ? '#60a5fa' : '#6b7280',
              bgcolor: mainTab === 1 ? 'rgba(96,165,250,0.12)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': { color: '#94a3b8' },
            }}
          >
            图案设计
          </Box>
        </Box>

        {renderSummary()}
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}><CircularProgress size={28} /></Box>}>
          <ActiveComponent key={`${mainTab}-${subTab}`} />
        </Suspense>

        {/* 底部导出按钮 */}
        {mainTab === 0 && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'design.amber', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              导出
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" disabled={exporting} onClick={() => handleExport('left')}
                sx={{ minWidth: 0, flex: 1, textTransform: 'none', color: 'design.amber', borderColor: 'design.amberBorder', fontSize: '0.75rem',
                  '&:hover': { borderColor: 'design.amber', bgcolor: 'design.amberBg' } }}>
                左翼
              </Button>
              <Button size="small" variant="outlined" disabled={exporting} onClick={() => handleExport('right')}
                sx={{ minWidth: 0, flex: 1, textTransform: 'none', color: 'design.amber', borderColor: 'design.amberBorder', fontSize: '0.75rem',
                  '&:hover': { borderColor: 'design.amber', bgcolor: 'design.amberBg' } }}>
                右翼
              </Button>
              <Button size="small" variant="contained" disabled={exporting} onClick={() => handleExport('both')}
                sx={{ minWidth: 0, flex: 1, textTransform: 'none', fontWeight: 700, fontSize: '0.75rem',
                  bgcolor: 'design.amber', color: '#121212', '&:hover': { bgcolor: 'design.orange' } }}>
                双翼
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}