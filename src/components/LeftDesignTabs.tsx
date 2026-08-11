import React, { lazy, Suspense, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { useWing } from '../hooks/useWing';
import { useRequiredFoamHeight } from '../hooks/useRequiredFoamHeight';
import { generateGcode } from '../services/gcodeGenerator';

// ===== 懒加载：所有设计/导出组件按需加载，缩小首屏 bundle =====
const BasicParams = lazy(() => import('./design/BasicParams'));
const WingRootConfig = lazy(() => import('./design/WingRootConfig'));
const WingTipConfig = lazy(() => import('./design/WingTipConfig'));
const WingLayoutConfig = lazy(() => import('./design/WingLayoutConfig'));
const AirfoilConnectionConfig = lazy(() => import('./design/AirfoilConnectionConfig'));
const MachineParams = lazy(() => import('./design/MachineParams'));
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
  // lazy 组件（LazyExoticComponent）与普通函数组件均结构兼容 ComponentType
  Component: React.ComponentType;
}

// 机翼设置子项（除机型设置外的机翼参数面板）
const wingSubTabs: TabDef[] = [
  { label: '基本设计', Component: BasicParams },                 // 0
  { label: '翼根配置', Component: WingRootConfig },              // 1
  { label: '翼尖配置', Component: WingTipConfig },               // 2
  { label: '双翼排布', Component: WingLayoutConfig },            // 3
  { label: '翼型连接', Component: AirfoilConnectionConfig },     // 4
  { label: '切割设置', Component: CuttingSettings },             // 5
];

// 机型设置（泡沫切割机机型）
const machineTabs: TabDef[] = [
  { label: '机床设置', Component: MachineParams },               // 0
];

type TabIssue = 'error' | 'warning' | undefined;

// 辅助函数：渲染单个 Tab 的样式和逻辑（含校验徽标圆点）
const renderTabItem = (
  item: TabDef,
  idx: number,
  activeTab: number,
  issue: TabIssue,
  accent: 'blue' | 'amber',
) => (
  <Tab
    key={idx}
    value={idx}
    id={`vertical-tab-${idx}`}
    aria-controls={`vertical-tabpanel-${idx}`}
    label={
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {item.label}
        {issue && (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: issue === 'error' ? 'design.red' : 'design.amber',
              boxShadow: `0 0 6px ${issue === 'error' ? 'design.red' : 'design.amber'}`,
              animation: 'blink 1.5s infinite',
              '@keyframes blink': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.35 },
              },
            }}
          />
        )}
      </Box>
    }
    sx={{
      alignItems: 'flex-start',
      textAlign: 'left',
      color: 'design.gray',
      fontSize: '0.85rem',
      minHeight: '44px',
      py: 1.5,
      px: 2,
      opacity: activeTab === idx ? 1 : 0.7,
      '&.Mui-selected': {
        color: 'design.text',
        bgcolor: accent === 'blue' ? 'design.blueBg' : 'design.amberBg',
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


interface LeftDesignTabsProps {
  /** 导出按钮回调：回传对应侧 G-Code，由 App 自动切换到切割页 */
  onExportGcode?: (gcode: string, side: 'left' | 'right' | 'both') => void;
}

export default function LeftDesignTabs({ onExportGcode }: LeftDesignTabsProps) {
  const { model, handleRadioChange } = useWing();
  const [mainTab, setMainTab] = useState(0);   // 0 机翼设计  1 图案设计（预留）
  const [groupTab, setGroupTab] = useState(1); // 0 机型设置  1 机翼设置
  const [subTab, setSubTab] = useState(0);     // 机翼设置子项索引
  const [exporting, setExporting] = useState(false);

  // ===== 校验状态（供 Tab 徽标与内容区摘要条使用） =====
  const foamInfo = useRequiredFoamHeight(model);
  const isSpanOver = (model.wingSpan + (model.foamOffsetZ || 0)) > model.gantryDistance;
  const isChordOver = model.foamChord > (model.machineWidth || 1000);
  const isThicknessOver = model.foamThickness > (model.machineHeight || 500);
  const isSizeOver = isSpanOver || isChordOver || isThicknessOver;

  // 分组 -> 校验状态（undefined = 正常）
  const groupIssue: Record<number, TabIssue> = {
    0: isSizeOver ? 'error' : undefined,             // 机型设置：尺寸超限
    1: foamInfo.isAdequate ? undefined : 'warning',  // 机翼设置：泡沫高度不足
  };

  // 当前激活组件
  const ActiveComponent: React.ComponentType =
    mainTab === 1
      ? PatternPlaceholder
      : groupTab === 0
        ? machineTabs[0].Component
        : wingSubTabs[subTab].Component;

  const handleMainChange = (_e: React.SyntheticEvent, v: number) => setMainTab(v);
  const handleGroupChange = (_e: React.SyntheticEvent, v: number) => setGroupTab(v);
  const handleSubChange = (_e: React.SyntheticEvent, v: number) => setSubTab(v);

  // 导出：生成对应侧 G-Code 并回传 App 切换到切割页
  const handleExport = async (side: 'left' | 'right' | 'both') => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await generateGcode(model);
      const code = side === 'left' ? result.left : side === 'right' ? result.right : result.both;
      // 同步预览数据，供切割页与徽标使用
      if (result.both && JSON.stringify(model.previewGcodeData) !== JSON.stringify(result)) {
        handleRadioChange('previewGcodeData', result);
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
    if (mainTab === 0 && groupTab === 1 && subTab === 0 && !foamInfo.isAdequate) {
      return (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: 'design.redBg', color: 'design.redLight', border: '1px solid', borderColor: 'design.redBorder' }}>
          {foamInfo.warning}
        </Alert>
      );
    }
    if (mainTab === 0 && groupTab === 0 && isSizeOver) {
      return (
        <Alert severity="error" sx={{ mb: 2, bgcolor: 'design.redBg', color: 'design.redLight', border: '1px solid', borderColor: 'design.redBorder' }}>
          {isSpanOver && `长度(${(model.wingSpan + (model.foamOffsetZ || 0)).toFixed(0)}mm) 超过龙门架跨度 (${model.gantryDistance}mm)`}
          {isChordOver && ' ｜ 泡沫弦长超出机床 X 范围'}
          {isThicknessOver && ' ｜ 泡沫厚度超出机床 Y 范围'}
        </Alert>
      );
    }
    return null;
  };

  return (
    <Box display="flex" height="100%" width="100%" minHeight={0} bgcolor="background.default">
      {/* 左侧栏 */}
      <Box
        width={200}
        bgcolor="background.paper"
        color="design.text"
        p={2}
        borderRight="1px solid divider"
        display="flex"
        flexDirection="column"
        minHeight={0}
        overflow="hidden"
      >
        {/* 标题 */}
        <Typography
          variant="h6"
          sx={{ mb: 1.5, pl: 0.5, color: 'design.blue', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          align="left"
        >
          Design config
        </Typography>

        {/* 顶部两栏：机翼设计 / 图案设计（预留） */}
        <Tabs
          value={mainTab}
          onChange={handleMainChange}
          variant="fullWidth"
          sx={{
            mb: 1.5,
            minHeight: '36px',
            '& .MuiTabs-indicator': { backgroundColor: 'design.blue' },
            '& .MuiTab-root': {
              minHeight: '36px',
              fontSize: '0.78rem',
              color: 'design.gray',
              '&.Mui-selected': { color: 'design.sky' },
            },
          }}
        >
          <Tab label="机翼设计" />
          <Tab label="图案设计" />
        </Tabs>

        {mainTab === 0 ? (
          <>
            {/* 分组：机型设置 / 机翼设置 */}
            <Tabs
              orientation="vertical"
              value={groupTab}
              onChange={handleGroupChange}
              sx={{
                '& .MuiTabs-indicator': {
                  left: 0,
                  width: '3px',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'design.blue',
                },
                '& .MuiTab-root': {
                  minHeight: '44px',
                  py: 1.5,
                  px: 2,
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  color: 'design.gray',
                  borderRadius: '6px',
                  mb: 0.5,
                  '&.Mui-selected': { color: 'design.sky', bgcolor: 'design.skyBg' },
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' },
                  transition: 'all 0.2s',
                },
              }}
            >
              <Tab
                value={0}
                label={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    机型设置
                    {groupIssue[0] && (
                      <Box
                        component="span"
                        sx={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          bgcolor: groupIssue[0] === 'error' ? 'design.red' : 'design.amber',
                          boxShadow: `0 0 6px ${groupIssue[0] === 'error' ? 'design.red' : 'design.amber'}`,
                        }}
                      />
                    )}
                  </Box>
                }
              />
              <Tab
                value={1}
                label={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    机翼设置
                    {groupIssue[1] && (
                      <Box
                        component="span"
                        sx={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          bgcolor: groupIssue[1] === 'error' ? 'design.red' : 'design.amber',
                          boxShadow: `0 0 6px ${groupIssue[1] === 'error' ? 'design.red' : 'design.amber'}`,
                        }}
                      />
                    )}
                  </Box>
                }
              />
            </Tabs>

            {/* 机翼设置子项 */}
            {groupTab === 1 && (
              <Tabs
                orientation="vertical"
                value={subTab}
                onChange={handleSubChange}
                sx={{
                  '& .MuiTabs-indicator': {
                    left: 0,
                    width: '3px',
                    borderRadius: '0 4px 4px 0',
                    backgroundColor: 'design.blue',
                  },
                }}
              >
                {wingSubTabs.map((item, idx) =>
                  renderTabItem(item, idx, subTab, idx === 0 ? groupIssue[1] : undefined, 'blue')
                )}
              </Tabs>
            )}

            {/* 弹性空间：把导出区推到底部 */}
            <Box sx={{ flexGrow: 1 }} />

            {/* 底部导出区：左翼 / 右翼 / 双翼，点击后自动切换到切割页 */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid divider' }}>
              <Typography
                variant="caption"
                sx={{ display: 'block', mb: 1, pl: 0.5, color: 'design.amber', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                导出
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  disabled={exporting}
                  onClick={() => handleExport('left')}
                  sx={{
                    minWidth: 0, textTransform: 'none', color: 'design.amber', borderColor: 'design.amberBorder',
                    '&:hover': { borderColor: 'design.amber', bgcolor: 'design.amberBg' },
                  }}
                >
                  左翼
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  disabled={exporting}
                  onClick={() => handleExport('right')}
                  sx={{
                    minWidth: 0, textTransform: 'none', color: 'design.amber', borderColor: 'design.amberBorder',
                    '&:hover': { borderColor: 'design.amber', bgcolor: 'design.amberBg' },
                  }}
                >
                  右翼
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  disabled={exporting}
                  onClick={() => handleExport('both')}
                  sx={{
                    minWidth: 0, textTransform: 'none', fontWeight: 700,
                    bgcolor: 'design.amber', color: '#121212',
                    '&:hover': { bgcolor: 'design.orange' },
                  }}
                >
                  双翼
                </Button>
              </Box>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ mt: 1, px: 0.5, color: 'design.gray' }}>
              图案设计（预留）
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
          </>
        )}
      </Box>

      {/* 右侧内容区 */}
      <Box flex={1} overflow="auto" p={3} bgcolor="background.default" position="relative" minWidth={0}>
        {renderSummary()}
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}><CircularProgress size={28} /></Box>}>
          <ActiveComponent key={`${mainTab}-${groupTab}-${subTab}`} />
        </Suspense>
      </Box>
    </Box>
  );
}