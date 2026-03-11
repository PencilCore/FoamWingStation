import { useEffect, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import * as serialService from '../../services/serialService'

export default function SerialToolbar() {
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
      <Typography variant="subtitle2" sx={{ color: '#f87171' }}>Web Serial 不可用</Typography>
    )
  }

  return (
    <Box display="flex" alignItems="center" gap={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ 
          width: 10, height: 10, borderRadius: '50%', 
          bgcolor: connected ? '#10b981' : '#475569',
          boxShadow: connected ? '0 0 10px #10b981' : 'none'
        }} />
        <Typography variant="body2" sx={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {connected ? '设备已连接:' : '状态: 未连接'}
        </Typography>
        {connected && (
          <Typography variant="body2" sx={{ color: '#f1f5f9', fontWeight: 'bold' }}>
            {label}
          </Typography>
        )}
      </Box>

      {!connected ? (
        <Button
          variant="outlined"
          size="small"
          onClick={handleRequestAndConnect}
          sx={{ 
            color: '#38bdf8', 
            borderColor: '#38bdf8',
            '&:hover': { borderColor: '#7dd3fc', bgcolor: 'rgba(56, 189, 248, 0.1)' }
          }}
        >
          连接设备 / 选择端口 ▼
        </Button>
      ) : (
        <Box display="flex" gap={1}>
           <Button
            variant="contained"
            color="error"
            size="small"
            onClick={handleEmergencyStop}
            sx={{ 
              fontWeight: 'bold',
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

          <Button
            variant="outlined"
            size="small"
            onClick={handleReconnect}
            sx={{ 
              color: '#facc15', 
              borderColor: '#facc15',
              '&:hover': { bgcolor: 'rgba(250, 204, 21, 0.1)' }
            }}
          >
            重连
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={handleDisconnect}
            sx={{ 
              color: '#94a3b8', 
              borderColor: '#334155',
              '&:hover': { color: '#f87171', borderColor: '#f87171' }
            }}
          >
            断开
          </Button>
        </Box>
      )}
    </Box>
  )
}
