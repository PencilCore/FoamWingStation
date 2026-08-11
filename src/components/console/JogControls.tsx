import React, { useEffect, useCallback, useState, useRef } from 'react'
import { Box, Typography, Button, Menu, MenuItem } from '@mui/material'
import { useWing } from '../../hooks/useWing'
import * as serialService from '../../services/serialService'
import { KeyboardArrowDown } from '@mui/icons-material'

const padStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 48px 48px',
  gridTemplateRows: '48px 48px 48px',
  gap: '6px',
  justifyContent: 'center',
  alignItems: 'center',
}

interface JogButtonProps {
  axis: string
  delta: number
  label: string
  id?: string
  color?: string
  active: Record<string, boolean>
  onClick: () => void
}

const JogButton = ({ axis, delta, label, id, color = '#38bdf8', active, onClick }: JogButtonProps) => (
  <Button
    variant="contained"
    onClick={onClick}
    sx={{
      width: 58,
      height: 58,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: active[id || ''] ? color : '#1e293b',
      border: `1px solid ${active[id || ''] ? '#fff' : '#334155'}`,
      '&:hover': { bgcolor: color + 'cc' },
      borderRadius: 2,
      p: 0,
      color: '#fff',
      boxShadow: active[id || ''] ? `0 0 15px ${color}` : 'none',
      transition: 'all 0.1s'
    }}
  >
    <Typography sx={{ fontSize: 24, fontWeight: 'bold', lineHeight: 1 }}>{label.includes('↑') ? '↑' : label.includes('↓') ? '↓' : label.includes('←') ? '←' : label.includes('→') ? '→' : label}</Typography>
    <Typography sx={{ fontSize: 10, opacity: 0.8, fontWeight: 'bold' }}>{axis}{delta > 0 ? '+' : '-'}</Typography>
  </Button>
)

function JogControls() {
  const { model } = useWing()
  const xyuv = model.xyuvMode || ['x', 'y', 'u', 'z']
  const [stepSize, setStepSize] = useState(1);
  const [manualSpeed, setManualSpeed] = useState(400);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleSpeedClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleSpeedClose = (speed?: number) => {
    if (speed) setManualSpeed(speed);
    setAnchorEl(null);
  };

  useEffect(() => {
    // Notify other components about manual speed change
    window.dispatchEvent(new CustomEvent('manual-speed-change', { detail: manualSpeed }))
  }, [manualSpeed])

  const dispatchJog = useCallback((axisLetter: string, delta: number) => {
    if (!axisLetter) return
    // 直接发送 UI 对应的轴字母，不再进行逻辑转换，由底层的 parseStatus 负责解析
    const cmd = `$J=G21G91${axisLetter.toUpperCase()}${delta}F${manualSpeed}\n`
    serialService.sendRaw(cmd)
  }, [manualSpeed])

  const [active, setActive] = useState<Record<string, boolean>>({})
  const timersRef = useRef<Record<string, number>>({})

  const flash = useCallback((id: string, ms = 140) => {
    setActive(prev => ({ ...prev, [id]: true }))
    if (timersRef.current[id]) window.clearTimeout(timersRef.current[id])
    timersRef.current[id] = window.setTimeout(() => {
      setActive(prev => ({ ...prev, [id]: false }))
      delete timersRef.current[id]
    }, ms)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) return

      const step = e.shiftKey ? stepSize * 10 : stepSize
      switch (e.key) {
        case 'w': case 'W':
          dispatchJog(xyuv[1] || 'y', step)
          flash('left-up'); e.preventDefault(); break
        case 's': case 'S':
          dispatchJog(xyuv[1] || 'y', -step)
          flash('left-down'); e.preventDefault(); break
        case 'a': case 'A':
          dispatchJog(xyuv[0] || 'x', -step)
          flash('left-left'); e.preventDefault(); break
        case 'd': case 'D':
          dispatchJog(xyuv[0] || 'x', step)
          flash('left-right'); e.preventDefault(); break
        case 'ArrowUp':
          dispatchJog(xyuv[3] || 'z', step) // UI Z (Vertical Right)
          flash('right-up'); e.preventDefault(); break
        case 'ArrowDown':
          dispatchJog(xyuv[3] || 'z', -step)
          flash('right-down'); e.preventDefault(); break
        case 'ArrowLeft':
          dispatchJog(xyuv[2] || 'u', -step) // UI U (Horizontal Right)
          flash('right-left'); e.preventDefault(); break
        case 'ArrowRight':
          dispatchJog(xyuv[2] || 'u', step)
          flash('right-right'); e.preventDefault(); break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatchJog, xyuv, stepSize, flash])

  const onButton = (axis: string, delta: number, id?: string) => () => {
    dispatchJog(axis || '', delta)
    if (id) flash(id)
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Jog Control</Typography>
        <Box display="flex" gap={0.5} alignItems="center">
          {/* 手动速度下拉按钮 */}
          <Button
            size="small"
            variant="outlined"
            onClick={handleSpeedClick}
            endIcon={<KeyboardArrowDown sx={{ fontSize: 12 }} />}
            sx={{ 
              minWidth: 80, 
              height: 24, 
              fontSize: 10, 
              mr: 1, 
              borderColor: '#10b981', 
              color: '#10b981',
              '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16, 185, 129, 0.05)' }
            }}
          >
            F: {manualSpeed}
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={() => handleSpeedClose()}
            PaperProps={{
              sx: { bgcolor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }
            }}
          >
            {[400, 800, 1600, 3200].map(s => (
              <MenuItem 
                key={s} 
                onClick={() => handleSpeedClose(s)}
                sx={{ fontSize: 11, '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
              >
                {s} mm/min
              </MenuItem>
            ))}
          </Menu>

          {[0.1, 1, 10, 25, 50].map(s => (
            <Button
              key={s}
              size="small"
              variant={stepSize === s ? "contained" : "outlined"}
              onClick={() => setStepSize(s)}
              sx={{ minWidth: 32, p: '2px 4px', fontSize: 10, borderColor: '#334155', color: stepSize === s ? '#fff' : '#94a3b8' }}
            >
              {s}
            </Button>
          ))}
        </Box>
      </Box>

      {/* 归零面板 (原有的速度设置面板已整合到上方菜单，此处可留空或移除) */}
      <Box sx={{ display: 'none', gap: 1.5, alignItems: 'stretch' }}>
        {/* 原速度设置 HTML 已隐藏 */}
      </Box>

      <Box display="flex" justifyContent="space-around" alignItems="start">
        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', mb: 1.5, display: 'block', textAlign: 'center', fontWeight: 'bold' }}>LEFT TOWER (WASD)</Typography>
          <div style={padStyle}>
            <div />
            <JogButton axis={xyuv[1]} delta={stepSize} label="y↑" id="left-up" color="#38bdf8" active={active} onClick={onButton(xyuv[1], stepSize, 'left-up')} />
            <div />
            <JogButton axis={xyuv[0]} delta={-stepSize} label="x←" id="left-left" color="#facc15" active={active} onClick={onButton(xyuv[0], -stepSize, 'left-left')} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14, fontWeight: 'bold' }}>XY</Box>
            <JogButton axis={xyuv[0]} delta={stepSize} label="→x" id="left-right" color="#facc15" active={active} onClick={onButton(xyuv[0], stepSize, 'left-right')} />
            <div />
            <JogButton axis={xyuv[1]} delta={-stepSize} label="↓y" id="left-down" color="#38bdf8" active={active} onClick={onButton(xyuv[1], -stepSize, 'left-down')} />
            <div />
          </div>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', mb: 1.5, display: 'block', textAlign: 'center', fontWeight: 'bold' }}>RIGHT TOWER (Arrows)</Typography>
          <div style={padStyle}>
            <div />
            <JogButton axis={xyuv[3]} delta={stepSize} label="z↑" id="right-up" color="#38bdf8" active={active} onClick={onButton(xyuv[3], stepSize, 'right-up')} />
            <div />
            <JogButton axis={xyuv[2]} delta={-stepSize} label="u←" id="right-left" color="#facc15" active={active} onClick={onButton(xyuv[2], -stepSize, 'right-left')} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14, fontWeight: 'bold' }}>UZ</Box>
            <JogButton axis={xyuv[2]} delta={stepSize} label="→u" id="right-right" color="#facc15" active={active} onClick={onButton(xyuv[2], stepSize, 'right-right')} />
            <div />
            <JogButton axis={xyuv[3]} delta={-stepSize} label="↓z" id="right-down" color="#38bdf8" active={active} onClick={onButton(xyuv[3], -stepSize, 'right-down')} />
            <div />
          </div>
        </Box>
      </Box>
    </Box>
  )
}

export default JogControls
