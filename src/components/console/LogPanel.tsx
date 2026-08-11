import { Box, Typography, TextField, Button, Checkbox, FormControlLabel, Select, MenuItem } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import serialService, { setPollInterval } from '../../services/serialService'

export default function LogPanel() {
  const [logs, setLogs] = useState<string[]>([])
  const [lastStatus, setLastStatus] = useState('')
  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [pollMs, setPollMs] = useState(500)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onData = (e: CustomEvent<{ data?: string }>) => {
      const d = e.detail?.data ?? String(e.detail)
      // split incoming chunk into lines, skip empty lines to avoid excessive blank rows
      const parts = String(d).split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0)
      if (parts.length === 0) return

      const normalLogs: string[] = []
      parts.forEach(p => {
        // Filter out polling status reports like <Idle|MPos:...>
        if (p.startsWith('<') && p.endsWith('>')) {
          setLastStatus(p)
        } else {
          normalLogs.push(`< ${p}`)
        }
      })

      if (normalLogs.length > 0) {
        setLogs(prev => {
          const merged = [...prev, ...normalLogs]
          // keep only the last 1000 lines
          return merged.slice(-1000)
        })
      }
    }
    const onConn = (e: CustomEvent<{ connected: boolean; label?: string }>) => {
      const lbl = e.detail?.label ?? (e.detail?.connected ? serialService.getConnectedLabel() : null)
      setLogs(prev => [...prev, `* serial ${e.detail?.connected ? 'connected' : 'disconnected'}${lbl ? ` (${lbl})` : ''}`])
    }
    window.addEventListener('serial-data', onData)
    window.addEventListener('serial-connected', onConn)
    return () => {
      window.removeEventListener('serial-data', onData)
      window.removeEventListener('serial-connected', onConn)
    }
  }, [])

  useEffect(() => {
    // scroll to bottom if autoScroll is enabled
    const el = containerRef.current
    if (el && autoScroll) el.scrollTop = el.scrollHeight
  }, [logs, autoScroll])

  const handleSend = () => {
    if (!input) return
    // append to log and send via serialService
    setLogs(prev => [...prev, `> ${input}`])
    const ok = serialService.sendRaw(input + '\n')
    if (!ok) setLogs(prev => [...prev, '* send failed (not connected)'])
    setInput('')
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" sx={{ height: '100%', bgcolor: '#0f172a' }}>
      <Box p={1} display="flex" justifyContent="space-between" alignItems="center" bgcolor="#1e293b" borderBottom="1px solid #334155">
        <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1, overflow: 'hidden', height: 24 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>Console Output</Typography>
          
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            {lastStatus && (
              <Typography variant="caption" sx={{ 
                color: '#38bdf8', 
                fontFamily: 'JetBrains Mono, Consolas, monospace',
                fontSize: '0.7rem',
                ml: 1.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                bgcolor: 'rgba(56, 189, 248, 0.1)',
                px: 0.5,
                borderRadius: 0.5,
                lineHeight: '1.1rem',
                height: '1.1rem',
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 1,
                minWidth: 0
              }}>
                {lastStatus}
              </Typography>
            )}
          </Box>

          <FormControlLabel
            control={
              <Checkbox 
                size="small" 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)}
                sx={{ color: '#64748b', '&.Mui-checked': { color: '#38bdf8' }, p: 0.5 }}
              />
            }
            label={<Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>自动滚动</Typography>}
            sx={{ ml: 1, my: -1, flexShrink: 0 }}
          />

          <Box display="flex" alignItems="center" gap={1} ml={2}>
            <Typography variant="caption" sx={{ color: '#64748b' }}>频率:</Typography>
            <Select
              size="small"
              value={pollMs}
              onChange={(e) => {
                const ms = Number(e.target.value);
                setPollMs(ms);
                setPollInterval(ms);
              }}
              sx={{ 
                height: 20, 
                fontSize: '0.7rem', 
                color: '#94a3b8',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                '.MuiSvgIcon-root': { fontSize: '1rem', color: '#64748b' }
              }}
            >
              {[100, 200, 500, 1000, 2000].map(ms => (
                <MenuItem key={ms} value={ms} sx={{ fontSize: '0.75rem' }}>{ms}ms</MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: '#64748b', flexShrink: 0 }}>9600, 8, N, 1</Typography>
      </Box>

      <Box ref={containerRef} flex={1} sx={{ color: '#10b981', fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 12, p: 1, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic' }}>Waiting for data...</Typography>
        ) : (
          logs.map((l, i) => (
            <div key={i} style={{ 
              whiteSpace: 'pre-wrap', 
              marginBottom: '2px',
              color: l.startsWith('>') ? '#38bdf8' : (l.startsWith('*') ? '#facc15' : '#10b981')
            }}>
              {l}
            </div>
          ))
        )}
      </Box>

      <Box p={1} display="flex" gap={1} alignItems="center" bgcolor="#1e293b" borderTop="1px solid #334155">
        <TextField 
          size="small" 
          placeholder="Command..." 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          fullWidth 
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
          sx={{ 
            '& .MuiInputBase-input': { color: '#f8fafc', fontSize: 13, py: 0.5 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
          }}
        />
        <Button variant="contained" size="small" onClick={handleSend} sx={{ minWidth: 60 }}>Send</Button>
      </Box>
    </Box>
  )
}
