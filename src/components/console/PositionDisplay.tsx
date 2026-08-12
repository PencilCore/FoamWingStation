import React, { type FC, useState, useEffect } from 'react'
import { Box, Typography, Button, Menu, MenuItem, TextField } from '@mui/material'
import Grid from '@mui/material/Grid'
import * as serialService from '../../services/serialService'

interface PositionItemProps {
  label: string
  value: string
  targetValue: string
  color: string
  onTargetChange: (val: string) => void
  onGo: () => void
}

const PositionItem: FC<PositionItemProps> = ({ label, value, targetValue, color, onTargetChange, onGo }) => {
  const [editing, setEditing] = useState(false)

  return (
    <Box sx={{ bgcolor: '#0f172a', p: 1.5, borderRadius: 1, border: '1px solid #334155', flex: 1 }}>
      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5, fontWeight: 'bold' }}>
        {label} AXIS
      </Typography>
      
      <Box sx={{ position: 'relative' }}>
        {editing ? (
          <TextField
            size="small"
            variant="standard"
            autoFocus
            value={targetValue}
            onChange={(e) => onTargetChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditing(false)
                onGo()
              }
            }}
            sx={{ 
              width: '100%',
              input: { 
                color, 
                fontFamily: 'JetBrains Mono, Consolas, monospace', 
                fontSize: '1.5rem',
                fontWeight: 600,
                p: 0
              }
            }}
          />
        ) : (
          <Box display="flex" flexDirection="column">
            <Typography 
              variant="h5" 
              onClick={() => setEditing(true)}
              sx={{ color, cursor: 'text', fontFamily: 'JetBrains Mono, Consolas, monospace', fontWeight: 600 }}
            >
              {value}
            </Typography>
            {value !== targetValue && (
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10 }}>
                Target: {targetValue}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

const PositionDisplay: FC = () => {
  const [pos, setPos] = useState({ x: '0.000', y: '0.000', u: '0.000', z: '0.000', status: 'Offline' })
  const [targetPos, setTargetPos] = useState({ x: '0.000', y: '0.000', u: '0.000', z: '0.000' })
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [manualSpeed, setManualSpeed] = useState(200)
  const [isHoming, setIsHoming] = useState(false)
  const [homingAxes, setHomingAxes] = useState<string[]>([])
  
  // 用于记录上次开始操作时的坐标，以便“撤回式归零”
  const [lastOpPos, setLastOpPos] = useState<{x:string, y:string, u:string, z:string} | null>(null)

  const startHoming = async (axes: string[]) => {
    setIsHoming(true)
    setHomingAxes(axes)
    const axisStr = axes.length === 4 ? 'ALL' : axes.join('')
    await serialService.startHardHoming(axisStr, 1000)
  }

  // 记录坐标偏移
  const recordOpPos = () => {
    setLastOpPos({ x: pos.x, y: pos.y, u: pos.u, z: pos.z })
  }

  const handleRetractionHoming = async () => {
    if (!lastOpPos) {
      // 如果没有记录，则默认回到 0
      await serialService.sendRaw(`G1 X0 Y0 U0 Z0 F1600\n`)
      return
    }
    // 回到记录的那个点，速度 1600
    await serialService.sendRaw(`G1 X${lastOpPos.x} Y${lastOpPos.y} U${lastOpPos.u} Z${lastOpPos.z} F1600\n`)
  }

  const handleAxisComplete = async (axis: string) => {
    const remaining = homingAxes.filter(a => a !== axis)
    setHomingAxes(remaining)
    if (remaining.length === 0) {
      await serialService.stopAndSetZero()
      setIsHoming(false)
    } else {
      await serialService.stopSpecificAxisAndContinue(axis, remaining)
    }
  }

  useEffect(() => {
    const onStatus = (e: any) => {
      setPos(prev => {
        const newPos = { ...prev, ...e.detail }
        return newPos
      })
    }
    const onConn = (e: any) => {
      if (!e.detail.connected) setPos(p => ({ ...p, status: 'Offline' }))
    }
    const onSpeed = (e: any) => setManualSpeed(e.detail)

    window.addEventListener('serial-status', onStatus as any)
    window.addEventListener('serial-connected', onConn as any)
    window.addEventListener('manual-speed-change', onSpeed as any)
    return () => {
      window.removeEventListener('serial-status', onStatus as any)
      window.removeEventListener('serial-connected', onConn as any)
      window.removeEventListener('manual-speed-change', onSpeed as any)
    }
  }, [])

  // Sync target to current if target is matching current (auto-follow)
  // But usually we want targets to be independent once user starts editing.
  // For simplicity, let's just initialize targets once on connection or when they are '0.000'
  useEffect(() => {
    if (pos.status !== 'Offline' && targetPos.x === '0.000' && targetPos.y === '0.000' && pos.x !== '0.000') {
      setTargetPos({ x: pos.x, y: pos.y, u: pos.u, z: pos.z })
    }
  }, [pos.status])

  const handleGo = () => {
    // 逻辑映射：
    // 用户看到的顺序: X (H), Y (V), U (H), Z (V)
    // 机器物理轴顺序: Axis1:X (H), Axis2:Y (V), Axis3:Z (V), Axis4:U (H)
    // 因此：UI(X)->X, UI(Y)->Y, UI(U)->U, UI(Z)->Z
    recordOpPos(); // 记录当前操作点，以便撤回
    serialService.sendRaw(`G1 X${targetPos.x} Y${targetPos.y} Z${targetPos.z} U${targetPos.u} F${manualSpeed}\n`)
  }

  const handleSetZero = () => {
    recordOpPos(); // 记录归零之前的点
    // 工业级归零序列：
    // 1. $10=0: 确保汇报 WPos
    // 2. G10 L2 P1: 清除当前坐标系偏移，回归机械基准
    // 3. G92: 建立新的逻辑零点
    serialService.sendRaw(`$10=0\n`)
    setTimeout(() => {
      serialService.sendRaw(`G10 L2 P1 X0 Y0 Z0 U0\n`)
      setTimeout(() => {
        serialService.sendRaw(`G92 X0 Y0 Z0 U0\n`)
      }, 50)
    }, 50)
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleMenuClose = (cmd?: string) => {
    setAnchorEl(null)
    if (cmd) serialService.sendRaw(cmd + '\n')
  }

  const statusColor = pos.status.toLowerCase().includes('alarm') ? '#f87171' : 
                    pos.status.toLowerCase().includes('hold') ? '#facc15' : 
                    pos.status.toLowerCase().includes('offline') ? '#64748b' : '#10b981'

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
          
          <Box sx={{ 
            px: 1, py: 0.2, borderRadius: 0.5, 
            bgcolor: 'rgba(255,255,255,0.05)', 
            border: `1px solid ${statusColor}` 
          }}>
            <Typography variant="caption" sx={{ color: statusColor, fontWeight: 'bold' }}>
              {pos.status.toUpperCase()}
            </Typography>
          </Box>
        </Box>
        
      </Box>
      
      <Box display="flex" gap={1} alignItems="stretch">
        <Grid container spacing={1} sx={{ flex: 1 }}>
          <Grid size={3}>
            <PositionItem 
              label="X" value={pos.x} color="#facc15" 
              targetValue={targetPos.x} 
              onTargetChange={(v) => setTargetPos(t => ({ ...t, x: v }))} 
              onGo={handleGo}
            />
          </Grid>
          <Grid size={3}>
            <PositionItem 
              label="Y" value={pos.y} color="#38bdf8" 
              targetValue={targetPos.y} 
              onTargetChange={(v) => setTargetPos(t => ({ ...t, y: v }))} 
              onGo={handleGo}
            />
          </Grid>
          <Grid size={3}>
            <PositionItem 
              label="U" value={pos.u} color="#facc15" 
              targetValue={targetPos.u} 
              onTargetChange={(v) => setTargetPos(t => ({ ...t, u: v }))} 
              onGo={handleGo}
            />
          </Grid>
          <Grid size={3}>
            <PositionItem 
              label="Z" value={pos.z} color="#38bdf8" 
              targetValue={targetPos.z} 
              onTargetChange={(v) => setTargetPos(t => ({ ...t, z: v }))} 
              onGo={handleGo}
            />
          </Grid>
        </Grid>
        
        <Button 
          variant="contained" 
          onClick={handleGo}
          sx={{ 
            minWidth: 60, 
            bgcolor: '#10b981', 
            '&:hover': { bgcolor: '#059669' },
            fontWeight: 'bold',
            fontSize: '0.8rem',
            lineHeight: 1.2
          }}
        >
          快速<br/>移动<br/>(G0)
        </Button>
      </Box>
    </Box>
  )
}

export default PositionDisplay
