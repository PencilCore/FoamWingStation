import { useState, useMemo } from 'react';
import {
  TextField, RadioGroup, FormControlLabel, Radio, Checkbox,
  Box, Typography, Divider, Paper, MenuItem, Alert,
} from '@mui/material';
import { useWing } from '../../hooks/useWing';
import SliderTextField from './SliderTextField';
import PlatformOffsetPad from './PlatformOffsetPad';

// ========== 机床预设数据 ==========
interface MachinePreset {
  name: string;
  gantryDistance: number;
  machineWidth: number;
  machineLength: number;
  machineHeight: number;
  groundClearance: number;
  feedrate: number;
  safeHeight: number;
  foamOffsetZ: number;
  /** 水平马达沿泡沫长度方向向机器外侧的统一偏移 (mm) */
  towerOffsetX: number;
  /** 切割平台沿 X 方向的统一偏移 (mm) */
  platformOffset: number;
  /** 切割平台沿 Y 方向的统一偏移 (mm) */
  platformOffsetY: number;
  xyuvMode: [string, string, string, string];
}

const MACHINE_PRESETS: Record<string, MachinePreset> = {
  'FoamCut Neo': {
    name: 'FoamCut Neo',
    gantryDistance: 1200,
    machineWidth: 700,
    machineLength: 1000,
    machineHeight: 500,
    groundClearance: 140,
    feedrate: 200,
    safeHeight: 50,
    foamOffsetZ: 0,
    towerOffsetX: 0,
    platformOffset: 62, // FoamCut Neo：切割平台沿泡沫长度方向（两塔连线）默认偏移 62mm（马达保持原位）
    platformOffsetY: 0,
    xyuvMode: ['X', 'Y', 'U', 'Z'],
  },
  'FoamCut Pro': {
    name: 'FoamCut Pro',
    gantryDistance: 1500,
    machineWidth: 800,
    machineLength: 1200,
    machineHeight: 600,
    groundClearance: 200,
    feedrate: 300,
    safeHeight: 60,
    foamOffsetZ: 0,
    towerOffsetX: 0,
    platformOffset: 0,
    platformOffsetY: 0,
    xyuvMode: ['X', 'Y', 'U', 'Z'],
  },
  'Mini CNC': {
    name: 'Mini CNC',
    gantryDistance: 800,
    machineWidth: 500,
    machineLength: 600,
    machineHeight: 300,
    groundClearance: 100,
    feedrate: 150,
    safeHeight: 30,
    foamOffsetZ: 0,
    towerOffsetX: 0,
    platformOffset: 0,
    platformOffsetY: 0,
    xyuvMode: ['X', 'Y', 'U', 'Z'],
  },
};

// 侧边栏 Tab 定义
interface SectionDef {
  label: string;
  component: React.ReactNode;
}

interface MachineParamsProps {
  sectionTab?: number;
  onSectionTabChange?: (tab: number) => void;
}

export default function MachineParams({ sectionTab: externalSectionTab, onSectionTabChange }: MachineParamsProps) {
  const { model, setModel, handleRadioChange } = useWing();
  const [internalSectionTab, setInternalSectionTab] = useState(0);
  const sectionTab = externalSectionTab ?? internalSectionTab;
  const setSectionTab = onSectionTabChange ?? setInternalSectionTab;

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModel({ ...model, [e.target.name]: e.target.checked });
  };

  const handleSlider = (name: string, val: number) => {
    handleRadioChange(name as any, val);
  };

  // 检测当前参数是否匹配某个预设
  const currentPresetName = useMemo(() => {
    for (const [key, preset] of Object.entries(MACHINE_PRESETS)) {
      if (
        preset.gantryDistance === model.gantryDistance &&
        preset.machineWidth === model.machineWidth &&
        preset.machineLength === model.machineLength &&
        preset.machineHeight === model.machineHeight &&
        preset.groundClearance === model.groundClearance &&
        preset.feedrate === model.feedrate &&
        preset.safeHeight === model.safeHeight
      ) {
        return key;
      }
    }
    return 'Custom';
  }, [model]);

  const handlePresetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const preset = MACHINE_PRESETS[e.target.value];
    if (preset) {
      setModel({
        ...model,
        gantryDistance: preset.gantryDistance,
        machineWidth: preset.machineWidth,
        machineLength: preset.machineLength,
        machineHeight: preset.machineHeight,
        groundClearance: preset.groundClearance,
        feedrate: preset.feedrate,
        safeHeight: preset.safeHeight,
        foamOffsetZ: preset.foamOffsetZ,
        towerOffsetX: preset.towerOffsetX,
        platformOffset: preset.platformOffset,
        platformOffsetY: preset.platformOffsetY,
        xyuvMode: preset.xyuvMode,
      });
    }
  };

  // ========== 各面板内容 ==========

  // 物理机床面板
  const PhysicalPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 2, fontWeight: 'bold' }}>
        物理机床参数
      </Typography>

      <SliderTextField
        label="龙门架跨度 (Distance)"
        name="gantryDistance"
        value={model.gantryDistance}
        min={500}
        max={3000}
        unit="mm"
        onChange={handleSlider}
      />

      <SliderTextField
        label="泡沫离左塔架距离 (Offset)"
        name="foamOffsetZ"
        value={model.foamOffsetZ}
        min={0}
        max={model.gantryDistance - 50}
        unit="mm"
        onChange={handleSlider}
      />

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'design.slate' }}>轴映射模式 (GRBL 坐标定义)</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['X', 'Y', 'U', 'Z'].map((label, i) => (
            <TextField
              key={label}
              label={label}
              value={model.xyuvMode[i] || ''}
              onChange={e => {
                const arr = [...model.xyuvMode];
                arr[i] = e.target.value.toUpperCase();
                setModel({ ...model, xyuvMode: arr as [string, string, string, string] });
              }}
              inputProps={{ maxLength: 1, style: { textAlign: 'center' } }}
              size="small"
              placeholder={label}
              sx={{
                flex: 1,
                '& .MuiInputBase-input': { color: 'design.text', fontWeight: 'bold' },
                '& .MuiInputLabel-root': { color: 'design.slateDark' },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );

  // 视觉调谐面板
  const VisualPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 2, fontWeight: 'bold' }}>
        视觉调谐
      </Typography>

      <SliderTextField
        label="水平马达纵向偏移 (Tower Lengthwise Offset)"
        name="towerOffsetX"
        value={model.towerOffsetX ?? 0}
        min={-100}
        max={100}
        step={0.5}
        unit="mm"
        onChange={handleSlider}
        helperText="水平马达沿泡沫长度方向向机器外侧偏移；热丝挂点保持原位"
      />

      <PlatformOffsetPad
        x={model.platformOffset ?? 0}
        y={model.platformOffsetY ?? 0}
        onChange={(px, py) => setModel({ ...model, platformOffset: px, platformOffsetY: py })}
        helperText="点击/拖拽十字坐标轴同时调整平台偏移 X/Y（FoamCut Neo 默认 X=62）；马达与机架保持原位；偏移反映到 G-code：长度方向(X)并入泡沫定位、宽度方向(Y)进入 X/U 坐标"
      />
    </Box>
  );

  // 切割工艺面板
  const CuttingPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 2, fontWeight: 'bold' }}>
        切割工艺参数
      </Typography>

      <SliderTextField
        label="默认进给速度 (Feedrate)"
        name="feedrate"
        value={model.feedrate}
        min={30}
        max={1600}
        unit="mm/min"
        onChange={handleSlider}
      />

      <SliderTextField
        label="安全高度 (Safe H)"
        name="safeHeight"
        value={model.safeHeight}
        min={0}
        max={200}
        unit="mm"
        onChange={handleSlider}
        helperText="快速移动时热丝离开泡沫的高度"
      />

      <Divider sx={{ my: 2, opacity: 0.1 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <FormControlLabel
          control={<Checkbox checked={!!model.limitTrailingEdge} onChange={handleCheckbox} name="limitTrailingEdge" size="small" />}
          label={<Typography variant="body2">启用尾缘过切保护</Typography>}
        />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'design.slate' }}>切割路径方向</Typography>
          <RadioGroup
            row
            value={model.cutDirection}
            onChange={(e) => setModel({ ...model, cutDirection: Number(e.target.value) as 0 | 1 })}
          >
            <FormControlLabel value={0} control={<Radio size="small" />} label={<Typography variant="caption">先上后下</Typography>} />
            <FormControlLabel value={1} control={<Radio size="small" />} label={<Typography variant="caption">先下后上</Typography>} />
          </RadioGroup>
        </Box>
      </Box>
    </Box>
  );

  // 行程限制面板
  const TravelPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 2, fontWeight: 'bold' }}>
        机床有效行程
      </Typography>
      <SliderTextField label="最大行程 X (宽度)" name="machineWidth" value={model.machineWidth} min={100} max={3000} unit="mm" onChange={handleSlider} />
      <SliderTextField label="最大行程 Y (长度)" name="machineLength" value={model.machineLength} min={100} max={3000} unit="mm" onChange={handleSlider} />
      <SliderTextField label="最大高度 Z" name="machineHeight" value={model.machineHeight} min={100} max={1500} unit="mm" onChange={handleSlider} />
      <SliderTextField label="机台离地高度" name="groundClearance" value={model.groundClearance} min={0} max={500} unit="mm" onChange={handleSlider} />
    </Box>
  );

  // 统计概览面板
  const StatsPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 2, fontWeight: 'bold' }}>
        当前模型统计概览
      </Typography>
      <Paper sx={{ p: 2, bgcolor: 'design.skyBg', border: '1px dashed design.skyBorder', mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>翼展 (半翼)</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.wingSpan} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>龙门架跨度</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.gantryDistance} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>根/尖弦长</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.rootChord} / {model.tipChord} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>泡沫厚度</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.foamThickness} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>泡沫离左塔架</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.foamOffsetZ} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>泡沫弦长</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.foamChord} mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>进给速度</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.feedrate} mm/min</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'design.slate' }}>有效行程 (X×Y×Z)</Typography>
            <Typography variant="body2" sx={{ color: 'design.text', fontWeight: 700 }}>{model.machineWidth}×{model.machineLength}×{model.machineHeight} mm</Typography>
          </Box>
        </Box>
      </Paper>

      {/* 尺寸校验 */}
      {(() => {
        const spanOver = (model.wingSpan + (model.foamOffsetZ || 0)) > model.gantryDistance;
        const chordOver = model.foamChord > (model.machineWidth || 1000);
        const thickOver = model.foamThickness > (model.machineHeight || 500);
        if (!spanOver && !chordOver && !thickOver) {
          return (
            <Alert severity="success" sx={{ bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'design.green' }}>
              所有尺寸在机床范围内 ✓
            </Alert>
          );
        }
        return (
          <Alert severity="error" sx={{ bgcolor: 'design.redBg', border: '1px solid design.redBorder', color: 'design.redLight' }}>
            {spanOver && `⚠ 翼展+偏移 (${(model.wingSpan + (model.foamOffsetZ || 0)).toFixed(0)}mm) 超过龙门架跨度 (${model.gantryDistance}mm)`}
            {chordOver && `⚠ 泡沫弦长 (${model.foamChord}mm) 超出机床 X 范围 (${model.machineWidth}mm)`}
            {thickOver && `⚠ 泡沫厚度 (${model.foamThickness}mm) 超出机床 Y 范围 (${model.machineHeight}mm)`}
          </Alert>
        );
      })()}
    </Box>
  );

  // 侧边栏 Tab 列表
  const sections: SectionDef[] = [
    { label: '物理机床', component: PhysicalPanel },
    { label: '视觉调谐', component: VisualPanel },
    { label: '切割工艺', component: CuttingPanel },
    { label: '行程限制', component: TravelPanel },
    { label: '统计概览', component: StatsPanel },
  ];

  return (
    <Box display="flex" height="100%" width="100%" minHeight={0} bgcolor="background.default" position="relative">
      {/* 主内容区 */}
      <Box
        flex={1}
        overflow="auto"
        p={3}
        bgcolor="background.default"
        position="relative"
        minWidth={0}
        sx={{ scrollBehavior: 'smooth' }}
      >
        {/* 顶部：机床预设选择器 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: 'design.amber', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
          >
            机床设置
          </Typography>
          <TextField
            select
            value={currentPresetName}
            onChange={handlePresetChange}
            size="small"
            sx={{
              minWidth: 160,
              '& .MuiInputBase-input': {
                fontWeight: 700,
                fontSize: '0.8rem',
                color: currentPresetName !== 'Custom' ? 'design.green' : 'design.sky',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: currentPresetName !== 'Custom'
                  ? 'rgba(74, 222, 128, 0.3)'
                  : 'rgba(56, 189, 248, 0.2)',
              },
              '& .MuiSvgIcon-root': { color: 'design.slateDark' },
            }}
          >
            {Object.keys(MACHINE_PRESETS).map((key) => (
              <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>
                {key}
              </MenuItem>
            ))}
            <MenuItem value="Custom" disabled>
              <Typography variant="caption" sx={{ color: 'design.slateDark', fontStyle: 'italic' }}>
                自定义
              </Typography>
            </MenuItem>
          </TextField>
        </Box>

        {sections[sectionTab].component}
      </Box>
    </Box>
  );
}