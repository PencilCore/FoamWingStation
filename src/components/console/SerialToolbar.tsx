import { useEffect, useState } from 'react'
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material'
import UsbIcon from '@mui/icons-material/Usb'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import * as serialService from '../../services/serialService'

interface SerialToolbarProps {
  /** true = 图标模式（用于窄侧边栏），false/省略 = 完整模式 */
  compact?: boolean
}

export default function SerialToolbar({ compact = false }: SerialToolbarProps) {
  const [connected, setConnected] = useState(false)
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const on = (e: any) => {
      setConnected(!!e.detail?.connected)
      setLabel(e.detail?.label ?? serialService.getConnectedLabel())
    }
    window.addEventListener('serial-connected', on as any)
    return () => window.removeEventListener('serial-connected', on as any)
  }, [])

  useEffect(() => {
    const currentLabel = serialService.getConnectedLabel()
    setLabel(currentLabel)
    setConnected(!!currentLabel)

    // 如果未连接，尝试静默连接历史端口 (启动时)
    if (!currentLabel) {
      serialService.connectExisting()
    }
  }, [])

  const handleRequestAndConnect = async () => {
    const lab = await serialService.requestAndConnect()
    if (lab) {
      setLabel(lab)
      setConnected(true)
    }
  }

  const handleDisconnect = async () => {
    await serialService.disconnect()
    setLabel(null)
    setConnected(false)
  }

  const handleReconnect = async () => {
    // Save current label to try and find it again
    await serialService.disconnect()

    // Give a small delay for port to release
    setTimeout(async () => {
      // Try to connect to the previously used port without showing the picker
      const success = await serialService.connectExisting()
      if (!success) {
        // Fallback to picker if silent reconnect fails
        await handleRequestAndConnect()
      }
    }, 500)
  }

  const handleEmergencyStop = () => {
    serialService.hardReset()
  }

  if (!serialService.isWebSerialAvailable()) {
    return (
      <Typography variant="caption" sx={{ color: '#f87171' }}>Web Serial 不可用</Typography>
    )
  }

  // ===== 图标模式（窄侧边栏） =====
  if (compact) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
        {/* 连接状态圆点 */}
        <Tooltip
          title={connected ? `已连接${label ? `: ${label}` : ''}` : '未连接'}
          placement="right"
          arrow
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: connected ? '#10b981' : '#525252',
              boxShadow: connected ? '0 0 10px #10b981' : 'none',
              cursor: 'default',
            }}
          />
        </Tooltip>

        {!connected ? (
          <Tooltip title="连接设备 / 选择端口" placement="right" arrow>
            <IconButton size="small" onClick={handleRequestAndConnect} sx={{ color: '#3b82f6' }}>
              <UsbIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <Tooltip title="强制停止 (STOP)" placement="right" arrow>
              <IconButton size="small" onClick={handleEmergencyStop} sx={{ color: '#ef4444', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%': { filter: 'drop-shadow(0 0 0 rgba(244,63,94,0.5))' }, '70%': { filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.8))' }, '100%': { filter: 'drop-shadow(0 0 0 rgba(244,63,94,0.5))' } } }}>
                <StopCircleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="重连" placement="right" arrow>
              <IconButton size="small" onClick={handleReconnect} sx={{ color: '#f59e0b' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="断开" placement="right" arrow>
              <IconButton size="small" onClick={handleDisconnect} sx={{ color: '#a3a3a3', '&:hover': { color: '#f87171' } }}>
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    )
  }

  // ===== 完整模式（宽侧边栏/顶栏） =====
  return (
    <Box display="flex" flexDirection="column" gap={1} width="100%">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          bgcolor: connected ? '#10b981' : '#525252',
          boxShadow: connected ? '0 0 10px #10b981' : 'none'
        }} />
        <Typography variant="caption" sx={{ color: '#a3a3a3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {connected ? '设备已连接' : '状态: 未连接'}
        </Typography>
      </Box>

      {!connected ? (
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={handleRequestAndConnect}
          sx={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: '#7dd3fc', bgcolor: 'rgba(56, 189, 248, 0.1)' }
          }}
        >
          连接设备 / 选择端口 ▼
        </Button>
      ) : (
        <>
          {label && (
            <Typography variant="caption" sx={{ color: '#f5f5f5', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
              {label}
            </Typography>
          )}
          <Button
            variant="contained"
            color="error"
            size="small"
            fullWidth
            onClick={handleEmergencyStop}
            sx={{
              fontWeight: 'bold',
              fontSize: '0.72rem',
              whiteSpace: 'nowrap',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { boxShadow: '0 0 0 0 rgba(244, 63, 94, 0.4)' },
                '70%': { boxShadow: '0 0 0 10px rgba(244, 63, 94, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(244, 63, 94, 0)' },
              }
            }}
          >
            强制停止 (STOP)
          </Button>

          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={handleReconnect}
              sx={{
                color: '#f59e0b',
                borderColor: '#f59e0b',
                fontSize: '0.72rem',
                '&:hover': { bgcolor: 'rgba(250, 204, 21, 0.1)' }
              }}
            >
              重连
            </Button>

            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={handleDisconnect}
              sx={{
                color: '#a3a3a3',
                borderColor: '#2e2e2e',
                fontSize: '0.72rem',
                '&:hover': { color: '#f87171', borderColor: '#f87171' }
              }}
            >
              断开
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
