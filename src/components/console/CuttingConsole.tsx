import { Box } from '@mui/material'
import GCodeInput from './GCodeInput'
import JogControls from './JogControls'
import LogPanel from './LogPanel'
import PositionDisplay from './PositionDisplay'
import GcodeSimulator from '../GcodeSimulator'
import Gcode3DPreview from '../Gcode3DPreview'

interface CuttingConsoleProps {
  gcode: string;
  onGcodeChange: (code: string) => void;
  currentIndex: number;
  onProgressChange?: (index: number) => void;
}

export default function CuttingConsole({ gcode, onGcodeChange, currentIndex, onProgressChange }: CuttingConsoleProps) {
  return (
    <Box display="flex" width="100%" height="100%" minWidth={0} bgcolor="#121212" color="#f5f5f5" overflow="hidden">
      {/* 左侧：G-code 编辑器 + 控制台日志（上下排列） */}
      <Box flex={1.15} minWidth={0} display="flex" flexDirection="column" borderRight="1px solid #2e2e2e">
        <Box flex={1} minHeight={0} p={2} display="flex" flexDirection="column" overflow="hidden">
          <GCodeInput value={gcode} onValueChange={onGcodeChange} currentIndex={currentIndex} />
        </Box>
        <Box height="36%" minHeight={150} borderTop="1px solid #2e2e2e">
          <LogPanel />
        </Box>
      </Box>

      {/* 中间：G-code 2D 预览 + 3D 预览（上下排列）
      * 播放进度统一由 3D 视图（Gcode3DPreview）驱动，2D 视图通过 'gcode-progress' 事件同步绘制 */}
      <Box flex={1} minWidth={0} display="flex" flexDirection="column" p={1} gap={1} borderRight="1px solid #2e2e2e">
        <Box flex={0.4} minHeight={0}>
          <GcodeSimulator gcode={gcode} currentIndex={currentIndex} />
        </Box>
        <Box flex={0.6} minHeight={0}>
          <Gcode3DPreview gcode={gcode} currentIndex={currentIndex} onProgressChange={onProgressChange} />
        </Box>
      </Box>

      {/* 右侧：实时位置 + Jog 控制（上下排列），约占 30% */}
      <Box width="30%" minWidth={320} display="flex" flexDirection="column" overflow="hidden">
        <Box p={2} borderBottom="1px solid #2e2e2e">
          <PositionDisplay />
        </Box>
        <Box flex={1} minHeight={0} p={2} sx={{ overflowY: 'auto' }}>
          <JogControls />
        </Box>
      </Box>
    </Box>
  )
}
