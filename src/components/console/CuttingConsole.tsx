import { Box } from '@mui/material'
import GCodeInput from './GCodeInput'
import JogControls from './JogControls'
import LogPanel from './LogPanel'
import PositionDisplay from './PositionDisplay'

export default function CuttingConsole() {
  return (
    <Box display="flex" flexDirection="column" height="100%" bgcolor="#1e293b" color="#f8fafc" overflow="hidden">
      {/* 顶部：实时状态与位置显示 */}
      <Box p={2} borderBottom="1px solid #334155" display="flex" flexDirection="column" gap={2}>
        <PositionDisplay />
      </Box>

      {/* 中部：包含 Jog 控制和 G-code 输入的区域 */}
      <Box flex={1} display="flex" overflow="hidden">
        {/* 左侧：G-code 查看器 */}
        <Box flex={1.2} p={2} borderRight="1px solid #334155" display="flex" flexDirection="column">
          <GCodeInput />
        </Box>

        {/* 右侧：Jog 手柄和动作按钮 */}
        <Box flex={1} p={2} display="flex" flexDirection="column" gap={2} bgcolor="#0f172a" sx={{ overflowY: 'auto' }}>
          <JogControls />
        </Box>
      </Box>

      {/* 底部：控制台日志 */}
      <Box height="200px" borderTop="1px solid #334155">
        <LogPanel />
      </Box>
    </Box>
  )
}
