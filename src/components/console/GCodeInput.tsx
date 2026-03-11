import React, { useEffect, useState, useRef } from 'react'
import { Box, Typography, Button, Checkbox, FormControlLabel, Menu, MenuItem, TextField, Select, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel } from '@mui/material'
import * as serialService from '../../services/serialService'
import { useWing } from '../../hooks/useWing'

const EXAMPLES = [
  {
    label: '100mm上下往复 (20次)',
    code: 'G91\n' + Array(20).fill('G1 Y100 Z100 F400\nG1 Y-100 Z-100 F400').join('\n') + '\nG90'
  },
  {
    label: '100mm左右往复 (20次)',
    code: 'G91\n' + Array(20).fill('G1 X100 U100 F400\nG1 X-100 U-100 F400').join('\n') + '\nG90'
  },
  {
    label: '速度与高度阶梯测试 (200-1600)',
    code: 'G91\n' + [200, 400, 600, 800, 1000, 1200, 1400, 1600].map(f => `G1 X100 U100 F${f}\nG1 X-100 U-100 F${f}\nG1 Y10 Z10 F1600`).join('\n') + '\nG90'
  },
  {
    label: '阶梯速度高度综合测试',
    code: 'G91\n' + 
      'G1 Y10 Z10 F1600\n' + // 先上升1cm
      'G1 X10 U10 F1600\n' + // 正向1cm
      'G1 X20 U20 F200\n' + // 200速度正向2cm
      'G1 Y5 Z5 F1600\n' + // 上升0.5cm
      'G1 X20 U20 F400\n' + // 400速度正向2cm
      'G1 Y10 Z10 F1600\n' + // 上升1cm
      'G1 X20 U20 F600\n' + // 600速度正向2cm
      'G1 Y10 Z10 F1600\n' + // 再次上升 (接续直到800)
      'G1 X20 U20 F800\n' + // 800速度正向2cm
      'G1 Y15 Z15 F1600\n' + // 上升1.5cm
      'G1 X-20 U-20 F1000\n' + // 反向1000速度2cm
      'G1 Y-5 Z-5 F1600\n' + // 下降0.5cm
      'G1 X-20 U-20 F1200\n' + // 反向1200速度2cm
      'G1 Y-5 Z-5 F1600\n' + // 下降0.5cm
      'G1 X-20 U-20 F1400\n' + // 持续加速
      'G1 Y-5 Z-5 F1600\n' + // 下降0.5cm
      'G1 X-20 U-20 F1600\n' + // 1600速度
      'G90'
  },
  {
    label: '速度阶梯测试 (200-1200)',
    code: 'G91\n' + [200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200].map(f => `G1 X100 U100 F${f}\nG1 X-100 U-100 F${f}`).join('\n') + '\nG90'
  },
  {
    label: '向上200mm并F600下切至0',
    code: 'G90\nG1 Y200 Z200 F1600\nG1 Y0 Z0 F600'
  },
  {
    label: '四轴100mm同步拉丝 (20次)',
    code: 'G91\n' + Array(20).fill('G1 X100 Y100 U100 Z100 F1500\nG1 X-100 Y-100 U-100 Z-100 F1500').join('\n') + '\nG90'
  }
]

// 使用 Vite raw 导入 demo 文件内容（如果项目设置支持 ?raw）
// 相对路径从当前文件到 src/assets/gcode/demo.gcode
let demoRaw: string | null = null
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Vite raw import
  demoRaw = require('../../assets/gcode/demo.gcode?raw') as string
} catch (e) {
  demoRaw = null
}

export default function GCodeInput() {
  const { model } = useWing()
  const [value, setValue] = useState<string>('')
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [lineMap, setLineMap] = useState<number[]>([]) // Maps index in 'lines' to original line index in 'value'
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [followScroll, setFollowScroll] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const awaitingAckRef = useRef(false)
  const [status, setStatus] = useState<string>('')
  const TIMEOUT_MS = 8000
  const MAX_RETRIES = 2

  // 碳管打孔参数控制
  const [sparDiameter, setSparDiameter] = useState<number>(5)
  const [sparDepthY, setSparDepthY] = useState<number>(5)
  const [sparDepthX, setSparDepthX] = useState<number>(0)
  const [sparAlign, setSparAlign] = useState<'left' | 'center' | 'right'>('center')
  const [sparDialogOpen, setSparDialogOpen] = useState(false)
  const [cylinderDialogOpen, setCylinderDialogOpen] = useState(false)
  const [cylinderDiameter, setCylinderDiameter] = useState<number>(20)
  const [cylinderEntryY, setCylinderEntryY] = useState<number>(10)
  const [cylinderAspectRatio, setCylinderAspectRatio] = useState<number>(1.0)

  // SVG 导入相关状态
  const [svgDialogOpen, setSvgDialogOpen] = useState(false)
  const [svgCode, setSvgCode] = useState<string>('')
  const [svgScale, setSvgScale] = useState<number>(1.0)
  const [svgEntryY, setSvgEntryY] = useState<number>(10)

  const generateSvgGCode = () => {
    const paths = svgCode.match(/d="([^"]+)"/g);
    if (!paths) {
      setStatus('错误：未找到路径 (d 属性)');
      return;
    }

    let gcode = `G91\n; SVG Import Scale: ${svgScale}, Entry Y: ${svgEntryY}\n`;
    
    // 1. 垂直进刀 (向上同步移动 Y/Z)
    if (svgEntryY !== 0) {
      gcode += `G1 Y${svgEntryY.toFixed(3)} Z${svgEntryY.toFixed(3)} F1600\n`;
    }

    let pathFound = false;

    paths.forEach(pAttr => {
      const d = pAttr.slice(3, -1);
      // 正则解析：命令字母 + 坐标数值
      const tokens = d.match(/([a-df-z])|([-.\d]+)/gi);
      if (!tokens) return;

      pathFound = true;
      let lastX = 0, lastY = 0;
      let startX = 0, startY = 0;
      let currentCmd = '';

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (/[a-df-z]/i.test(token)) {
          currentCmd = token;
          continue;
        }

        const isRelative = currentCmd === currentCmd.toLowerCase();
        const cmdType = currentCmd.toUpperCase();

        if (cmdType === 'M' || cmdType === 'L') {
          const nx = parseFloat(token) * svgScale;
          const ny = parseFloat(tokens[++i]) * svgScale;
          
          const dx = isRelative ? nx : (nx - lastX);
          const dy = isRelative ? -ny : -(ny - lastY); // Y轴镜像

          gcode += `G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} U${dx.toFixed(3)} Z${dy.toFixed(3)} F400\n`;
          
          lastX = isRelative ? (lastX + nx) : nx;
          lastY = isRelative ? (lastY + ny) : ny;
          if (cmdType === 'M') { startX = lastX; startY = lastY; }
        } 
        else if (cmdType === 'H') { // 水平直线
          const nx = parseFloat(token) * svgScale;
          const dx = isRelative ? nx : (nx - lastX);
          gcode += `G1 X${dx.toFixed(3)} U${dx.toFixed(3)} F400\n`;
          lastX = isRelative ? (lastX + nx) : nx;
        }
        else if (cmdType === 'V') { // 垂直直线
          const ny = parseFloat(token) * svgScale;
          const dy = isRelative ? -ny : -(ny - lastY);
          gcode += `G1 Y${dy.toFixed(3)} Z${dy.toFixed(3)} F400\n`;
          lastY = isRelative ? (lastY + ny) : ny;
        }
        else if (cmdType === 'C') { // 三次贝塞尔曲线 (转化为4段直线逼近)
          const x1 = parseFloat(token), y1 = parseFloat(tokens[++i]);
          const x2 = parseFloat(tokens[++i]), y2 = parseFloat(tokens[++i]);
          const x3 = parseFloat(tokens[++i]), y3 = parseFloat(tokens[++i]);
          
          const px0 = lastX / svgScale, py0 = lastY / svgScale;
          const px1 = isRelative ? (px0 + x1) : x1;
          const py1 = isRelative ? (py0 + y1) : y1;
          const px2 = isRelative ? (px0 + x2) : x2;
          const py2 = isRelative ? (py0 + y2) : y2;
          const px3 = isRelative ? (px0 + x3) : x3;
          const py3 = isRelative ? (py0 + y3) : y3;

          for (let t = 0.25; t <= 1.0; t += 0.25) {
            const tx = Math.pow(1-t,3)*px0 + 3*Math.pow(1-t,2)*t*px1 + 3*(1-t)*t*t*px2 + Math.pow(t,3)*px3;
            const ty = Math.pow(1-t,3)*py0 + 3*Math.pow(1-t,2)*t*py1 + 3*(1-t)*t*t*py2 + Math.pow(t,3)*py3;
            const dx = (tx * svgScale) - lastX;
            const dy = -(ty * svgScale - lastY); 
            gcode += `G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} U${dx.toFixed(3)} Z${dy.toFixed(3)} F400\n`;
            lastX = tx * svgScale; lastY = ty * svgScale;
          }
        }
        else if (cmdType === 'A') { // 椭圆弧 (简化：仅移动到终点)
          i += 5; // 跳过 rx, ry, axis-rot, large-arc, sweep
          const nx = parseFloat(tokens[++i]) * svgScale;
          const ny = parseFloat(tokens[++i]) * svgScale;
          const dx = isRelative ? nx : (nx - lastX);
          const dy = isRelative ? -ny : -(ny - lastY);
          gcode += `G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} U${dx.toFixed(3)} Z${dy.toFixed(3)} F400\n`;
          lastX = isRelative ? (lastX + nx) : nx;
          lastY = isRelative ? (lastY + ny) : ny;
        }
        else if (cmdType === 'Z') { // 闭合路径
          const dx = startX - lastX;
          const dy = -(startY - lastY);
          gcode += `G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} U${dx.toFixed(3)} Z${dy.toFixed(3)} F400\n`;
          lastX = startX; lastY = startY;
        }
      }
    });

    if (!pathFound) {
      setStatus('未能解析出有效的坐标点');
      return;
    }

    // 2. 原路退回 (垂直向下退出)
    if (svgEntryY !== 0) {
      gcode += `G1 Y-${svgEntryY.toFixed(3)} Z-${svgEntryY.toFixed(3)} F1600\n`;
    }

    gcode += `G90`;
    setValue(gcode);
    setStatus(`已从 SVG 生成 G-Code (缩放: ${svgScale}, 进刀: ${svgEntryY})`);
    setSvgDialogOpen(false);
  }

  const generateCylinderGCode = () => {
    const r = cylinderDiameter / 2;
    const fCut = 400; 
    const fFast = 1600;
    const segments = 36;
    const ky = cylinderAspectRatio; // 纵向修正系数
    
    let gcode = `G91\n`;
    gcode += `; Solid Cylinder: D${cylinderDiameter}mm, AspectRatio:${ky}\n`;
    
    // 1. 切入：向上进刀，应用修正系数
    gcode += `G1 Y${(cylinderEntryY * ky).toFixed(3)} Z${(cylinderEntryY * ky).toFixed(3)} F${fFast}\n`;
    
    // 2. 分段模拟圆周运动
    for (let i = 1; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI - Math.PI / 2;
        const prevAngle = ((i - 1) / segments) * 2 * Math.PI - Math.PI / 2;
        
        const dx = r * (Math.cos(angle) - Math.cos(prevAngle));
        // 对 Y/Z 轴应用修正系数
        const dy = r * (Math.sin(angle) - Math.sin(prevAngle)) * ky;
        
        gcode += `G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} U${dx.toFixed(3)} Z${dy.toFixed(3)} F${fCut}\n`;
    }
    
    // 3. 原路退出
    gcode += `G1 Y-${(cylinderEntryY * ky).toFixed(3)} Z-${(cylinderEntryY * ky).toFixed(3)} F${fFast}\n`;
    gcode += `G90`;
    
    setValue(gcode);
    setStatus(`已生成圆柱程序 (修正系数: ${ky})`);
    setCylinderDialogOpen(false);
  }

  const generateSparGCode = () => {
    const r = sparDiameter / 2;
    const fCut = 400; // 切割速度
    const fFast = 1600; // 快速移动
    
    let gcode = `G91\n`;
    gcode += `; Carbon Spar Hole: D${sparDiameter}mm, Depth Y:${sparDepthY}mm, Depth X:${sparDepthX}mm, Align ${sparAlign}\n`;
    
    // 1. 进入切入点 (先向里纵深，再横向平移，到达打孔参考点)
    gcode += `G1 Y${sparDepthY} Z${sparDepthY} F${fFast}\n`; 
    if (sparDepthX !== 0) {
      gcode += `G1 X${sparDepthX} U${sparDepthX} F${fFast}\n`;
    }
    
    // 2. 根据对齐方式调整圆心偏移并画圆
    if (sparAlign === 'center') {
      gcode += `G1 X${r} U${r} F${fCut}\n`;
      gcode += `G2 X0 Y0 I-${r} J0 F${fCut}\n`;
      gcode += `G1 X-${r} U-${r} F${fCut}\n`; 
    } else if (sparAlign === 'left') {
      gcode += `G2 X0 Y0 I${r} J0 F${fCut}\n`;
    } else if (sparAlign === 'right') {
      gcode += `G2 X0 Y0 I-${r} J0 F${fCut}\n`;
    }
    
    // 3. 原路退出
    if (sparDepthX !== 0) {
      gcode += `G1 X-${sparDepthX} U-${sparDepthX} F${fFast}\n`;
    }
    gcode += `G1 Y-${sparDepthY} Z-${sparDepthY} F${fFast}\n`;
    gcode += `G90`;
    
    setValue(gcode);
    setStatus(`已生成碳管打孔程序 (分步进刀)`);
    setSparDialogOpen(false); 
  }

  useEffect(() => {
    if (demoRaw != null) {
      setValue(demoRaw)
      return
    }
    // Fallback: try fetch from public path
    fetch('/src/assets/gcode/demo.gcode')
      .then(r => r.ok ? r.text() : '')
      .then(t => { if (t) setValue(t) })
      .catch(() => { /* ignore */ })
  }, [])

  const handleImportFromDesign = () => {
    if (model.previewGcode) {
      setValue(model.previewGcode)
      setStatus('从设计面板导入成功')
    } else {
      setStatus('设计预览暂无 G-code 可导入')
    }
  }

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    // 优先使用粘贴板内容替换当前文本
    const pasted = e.clipboardData.getData('text')
    if (pasted) {
      e.preventDefault()
      setValue(pasted)
    }
  }

  useEffect(() => {
    const onData = (e: any) => {
      const d = String(e.detail?.data ?? '')
      d.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
        // clear pending timeout if waiting for ack
        if (awaitingAckRef.current) {
          // accept 'ok' as a word anywhere, or lines containing error/alarm
          if (/\bok\b/i.test(line) || /error/i.test(line) || /alarm/i.test(line)) {
            awaitingAckRef.current = false
            if (lineTimerRef.current) { clearTimeout(lineTimerRef.current); lineTimerRef.current = null }
            setStatus(`ACK: ${line}`)
            setCurrentIndex(ci => ci + 1)
            return
          }
        }
        // not an ack — ignore for advance, but update status/log
      })
    }
    window.addEventListener('serial-data', onData as any)
    return () => window.removeEventListener('serial-data', onData as any)
  }, [])

  useEffect(() => {
    // when currentIndex changes, if running and not paused and not awaiting ack, send next
    if (!running) return
    if (paused) return
    if (awaitingAckRef.current) return
    if (currentIndex >= lines.length) {
      setRunning(false)
      setStatus('Completed')
      return
    }
    // fire-and-forget async
    void sendLine(currentIndex)
  }, [currentIndex, running, paused, lines])

  const lineTimerRef = useRef<number | null>(null)
  const retriesRef = useRef<Record<number, number>>({})

  const sendLine = async (index: number) => {
    if (index < 0 || index >= lines.length) return
    const line = lines[index]
    if (!line) {
      // skip empty
      setCurrentIndex(i => i + 1)
      return
    }
    if (!serialService.getConnectedLabel()) {
      setStatus('Not connected')
      setRunning(false)
      return
    }
    const ok = await serialService.sendRaw(line + '\n')
    if (!ok) {
      setStatus('Send failed (not connected)')
      setRunning(false)
      return
    }
    awaitingAckRef.current = true
    setStatus(`Sent: ${line}`)
    // highlight line and scroll
    if (followScroll) {
      const ta = taRef.current
      if (ta) {
        const rawIdx = lineMap[index];
        // 估算行高 (fontSize 13px * lineHeight 1.5 = ~19.5px)
        const lineHeight = 19.5 
        const visibleLines = ta.clientHeight / lineHeight
        const targetScroll = Math.max(0, (rawIdx - Math.floor(visibleLines / 2)) * lineHeight)
        ta.scrollTop = targetScroll
      }
    }
    // start timeout for this line
    try {
      if (lineTimerRef.current) { clearTimeout(lineTimerRef.current); lineTimerRef.current = null }
      lineTimerRef.current = window.setTimeout(() => {
        // timeout occurred waiting for ack
        const retries = retriesRef.current[index] || 0
        if (retries < MAX_RETRIES) {
          retriesRef.current[index] = retries + 1
          // try resend once/more
          awaitingAckRef.current = false
          setStatus(`Retrying line (${retries + 1}) after timeout`)
          // resend same index directly
          void sendLine(index)
        } else {
          setStatus('Timeout waiting for ACK')
          setRunning(false)
          awaitingAckRef.current = false
        }
      }, TIMEOUT_MS)
    } catch (e) {}
  }

  const handleStart = () => {
    const rawLines = String(value).split(/\r?\n/);
    const parsed: string[] = [];
    const mapping: number[] = [];

    rawLines.forEach((l, i) => {
      let processed = l.replace(/\s+$/,'');
      const commentIdx = processed.indexOf(';');
      if (commentIdx >= 0) processed = processed.slice(0, commentIdx).trim();
      else processed = processed.trim();

      if (processed.length > 0) {
        parsed.push(processed);
        mapping.push(i);
      }
    });

    setLines(parsed)
    setLineMap(mapping)
    setCurrentIndex(0)
    setRunning(true)
    setPaused(false)
    setStatus('Started')
  }

  const handlePause = () => {
    if (!running) return
    if (!paused) {
      // send feed hold '!' to GRBL
      serialService.sendRaw('!')
      setPaused(true)
      setStatus('Paused')
    } else {
      // resume with '~'
      serialService.sendRaw('~')
      setPaused(false)
      setStatus('Resumed')
      // if not awaiting ack, trigger send
      if (!awaitingAckRef.current) setCurrentIndex(ci => ci)
    }
  }

  const handleStop = () => {
    if (!running && !paused) return
    // send soft reset Ctrl-X (0x18) to GRBL to stop
    try { serialService.sendRaw('\x18') } catch (e) {}
    setRunning(false)
    setPaused(false)
    awaitingAckRef.current = false
    setCurrentIndex(0)
    setStatus('Stopped')
  }

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLoadExample = (code: string) => {
    setValue(code);
    setStatus('示例加载成功');
    handleCloseMenu();
  };

  return (
    <Box flex={1} display="flex" flexDirection="column" sx={{ height: '100%' }}>
      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>G-Code Editor</Typography>
          <FormControlLabel
            control={
              <Checkbox 
                size="small" 
                checked={followScroll} 
                onChange={(e) => setFollowScroll(e.target.checked)}
                sx={{ color: '#64748b', '&.Mui-checked': { color: '#38bdf8' }, p: 0.5 }}
              />
            }
            label={<Typography variant="caption" sx={{ color: '#94a3b8', userSelect: 'none' }}>跟随滚动</Typography>}
            sx={{ ml: 1, mr: 0 }}
          />
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          {/* 碳管打孔触发按钮 */}
          <Button 
            size="small" 
            variant="outlined" 
            color="secondary" 
            onClick={() => setSparDialogOpen(true)}
            sx={{ fontWeight: 'bold', fontSize: 12, borderColor: '#334155' }}
          >
            碳管打孔
          </Button>

          {/* 实心圆柱触发按钮 */}
          <Button 
            size="small" 
            variant="outlined" 
            color="info" 
            onClick={() => setCylinderDialogOpen(true)}
            sx={{ fontWeight: 'bold', fontSize: 12, borderColor: '#334155' }}
          >
            实心圆柱
          </Button>

          {/* SVG 导入触发按钮 */}
          <Button 
            size="small" 
            variant="outlined" 
            color="success" 
            onClick={() => setSvgDialogOpen(true)}
            sx={{ fontWeight: 'bold', fontSize: 12, borderColor: '#334155' }}
          >
            SVG 导入
          </Button>

          {/* SVG 参数弹窗 */}
          <Dialog open={svgDialogOpen} onClose={() => setSvgDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', minWidth: 400 } }}>
            <DialogTitle sx={{ fontSize: 16, pb: 1 }}>SVG 代码导入</DialogTitle>
            <DialogContent>
              <Box display="flex" flexDirection="column" gap={2} pt={1}>
                <TextField
                  label="SVG 代码 (粘贴 <svg> 或 <path> 标签)"
                  multiline
                  rows={6}
                  fullWidth
                  value={svgCode}
                  onChange={(e) => setSvgCode(e.target.value)}
                  placeholder="例如: <path d='M10 10 L20 20' />"
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9', fontFamily: 'monospace', fontSize: 12 }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="缩放比例"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  fullWidth
                  value={svgScale}
                  onChange={(e) => setSvgScale(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="缩放比例"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  fullWidth
                  value={svgScale}
                  onChange={(e) => setSvgScale(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="垂直切入长度 (mm)"
                  type="number"
                  fullWidth
                  value={svgEntryY}
                  onChange={(e) => setSvgEntryY(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  提示：解析器支持 M/L/C/Z 指令。程序会先向上切入，完成图形后原路返回。
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSvgDialogOpen(false)} sx={{ color: '#94a3b8' }}>取消</Button>
              <Button onClick={generateSvgGCode} variant="contained" color="success">解析并生成</Button>
            </DialogActions>
          </Dialog>

          {/* 碳管参数动态弹窗 */}
          <Dialog open={sparDialogOpen} onClose={() => setSparDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', minWidth: 280 } }}>
            <DialogTitle sx={{ fontSize: 16, pb: 1 }}>碳管打孔参数</DialogTitle>
            <DialogContent>
              <Box display="flex" flexDirection="column" gap={2} pt={1}>
                <TextField
                  label="直径 (mm)"
                  type="number"
                  fullWidth
                  value={sparDiameter}
                  onChange={(e) => setSparDiameter(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="纵向深度 (Y/Z进刀, mm)"
                  type="number"
                  fullWidth
                  value={sparDepthY}
                  onChange={(e) => setSparDepthY(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="横向偏移 (X/U偏移, mm)"
                  type="number"
                  fullWidth
                  value={sparDepthX}
                  onChange={(e) => setSparDepthX(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#94a3b8' }}>对齐方向</InputLabel>
                  <Select
                    value={sparAlign}
                    label="对齐方向"
                    onChange={(e) => setSparAlign(e.target.value as any)}
                    sx={{ color: '#f1f5f9', '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' } }}
                  >
                    <MenuItem value="center">中间 (当前点为圆心)</MenuItem>
                    <MenuItem value="left">左侧 (当前点为最左边缘)</MenuItem>
                    <MenuItem value="right">右侧 (当前点为最右边缘)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSparDialogOpen(false)} sx={{ color: '#94a3b8' }}>取消</Button>
              <Button onClick={generateSparGCode} variant="contained" color="secondary">生成并关闭</Button>
            </DialogActions>
          </Dialog>

          {/* 实心圆柱参数弹窗 */}
          <Dialog open={cylinderDialogOpen} onClose={() => setCylinderDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', minWidth: 280 } }}>
            <DialogTitle sx={{ fontSize: 16, pb: 1 }}>实心圆柱切割参数</DialogTitle>
            <DialogContent>
              <Box display="flex" flexDirection="column" gap={2} pt={1}>
                <TextField
                  label="直径 (mm)"
                  type="number"
                  fullWidth
                  value={cylinderDiameter}
                  onChange={(e) => setCylinderDiameter(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="垂直切入长度 (Y/Z, mm)"
                  type="number"
                  fullWidth
                  value={cylinderEntryY}
                  onChange={(e) => setCylinderEntryY(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <TextField
                  label="纵向比例修正 (1.0=原样, <1.0为向内压缩)"
                  type="number"
                  fullWidth
                  inputProps={{ step: 0.01 }}
                  value={cylinderAspectRatio}
                  onChange={(e) => setCylinderAspectRatio(Number(e.target.value))}
                  sx={{ '& .MuiInputBase-input': { color: '#f1f5f9' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                />
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  提示：如果切出来是“垂直长的椭圆”，请尝试将比例减小（如 0.9 或更低）。
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setCylinderDialogOpen(false)} sx={{ color: '#94a3b8' }}>取消</Button>
              <Button onClick={generateCylinderGCode} variant="contained" color="info">生成并关闭</Button>
            </DialogActions>
          </Dialog>

          <Button 
            size="small" 
            variant="outlined" 
            onClick={handleOpenMenu}
            sx={{ color: '#38bdf8', borderColor: '#334155' }}
          >
            加载示例
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
            PaperProps={{
              sx: { bgcolor: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }
            }}
          >
            {EXAMPLES.map((ex, idx) => (
              <MenuItem 
                key={idx} 
                onClick={() => handleLoadExample(ex.code)}
                sx={{ '&:hover': { bgcolor: '#334155' } }}
              >
                {ex.label}
              </MenuItem>
            ))}
          </Menu>

          <Button size="small" variant="outlined" onClick={handleImportFromDesign} sx={{ color: '#38bdf8', borderColor: '#334155' }}>导入设计</Button>
          <Button size="small" variant="contained" color="success" onClick={handleStart} disabled={running} sx={{ fontWeight: 'bold' }}>开始</Button>
          <Button size="small" variant="contained" onClick={handlePause} disabled={!running} sx={{ bgcolor: '#facc15', color: '#000', '&:hover': { bgcolor: '#eab308' } }}>{paused ? '继续' : '暂停'}</Button>
          <Button size="small" variant="contained" color="error" onClick={handleStop} disabled={!running && !paused}>停止</Button>
        </Box>
      </Box>

      {status && (
        <Box mb={1} p={1} bgcolor="#334155" borderRadius={1} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" sx={{ color: '#38bdf8' }}>{status}</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>{lines.length > 0 ? `Progress: ${Math.min(currentIndex+1, lines.length)} / ${lines.length}` : ''}</Typography>
        </Box>
      )}

      <Box
        ref={taRef}
        sx={{ 
          flex: 1, 
          width: '100%', 
          background: '#0f172a', 
          border: '1px solid #334155', 
          borderRadius: 1,
          overflowY: 'auto',
          position: 'relative',
          lineHeight: 1.5
        }}
      >
        <textarea
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
          onPaste={handlePaste}
          spellCheck={false}
          style={{
            width: '100%',
            height: running ? '0px' : '100%',
            visibility: running ? 'hidden' : 'visible',
            background: 'transparent',
            color: '#38bdf8',
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            fontSize: 13,
            padding: '12px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            lineHeight: 'inherit',
            display: running ? 'none' : 'block'
          }}
        />
        {running && (
          <Box p={1.5} sx={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13 }}>
            {value.split(/\r?\n/).map((line, idx) => {
              const executingRawIndex = lineMap[currentIndex];
              const isCurrent = executingRawIndex === idx;
              
              return (
                <Box key={idx} sx={{ 
                  color: isCurrent ? '#4ade80' : '#38bdf8',
                  bgcolor: isCurrent ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                  px: 0.5,
                  borderRadius: 0.5,
                  whiteSpace: 'pre-wrap',
                  minHeight: '1.5em'
                }}>
                  {line || ' '}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
