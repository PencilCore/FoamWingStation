// src/services/serialService.ts
// Minimal Web Serial wrapper for listing/requesting and connect/disconnect.
let portRef: any = null
let reader: any = null
let writer: any = null
let connectedLabel: string | null = null
let readLoopRunning = false
let pollTimer: any = null
let pollInterval = 500
let autoReconnectEnabled = true

const LAST_PORT_KEY = 'foam_wing_last_port_label'

// 启动时自动重连
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (localStorage.getItem(LAST_PORT_KEY)) {
      console.log('检测到历史设备，开始尝试自动重连...');
      reconnectAttempts = 0; // 重置计数器
      attemptAutoReconnect();
    }
  }, 1000);
}

// 监听硬件拔出事件
if (typeof navigator !== 'undefined' && (navigator as any).serial) {
  (navigator as any).serial.addEventListener('disconnect', (event: any) => {
    console.warn('串口硬件已断开', event.port);
    // 即使不是当前 port，只要列表变了也触发检查，增加健壮性
    handleUnexpectedDisconnect();
  });
  
  // 监听硬件插入事件
  (navigator as any).serial.addEventListener('connect', (event: any) => {
    console.log('串口硬件已插入', event.port);
    if (autoReconnectEnabled && !portRef) {
      attemptAutoReconnect();
    }
  });
}

function handleUnexpectedDisconnect() {
  stopPolling();
  readLoopRunning = false;
  portRef = null;
  reader = null;
  writer = null;
  connectedLabel = null;
  window.dispatchEvent(new CustomEvent('serial-connected', { detail: { connected: false, label: null, unexpected: true } }));
  
  if (autoReconnectEnabled) {
    reconnectAttempts = 0; // 重置重连计数，新一轮尝试
    console.log('检测到意外断开，开启自动重连...');
    attemptAutoReconnect();
  }
}

// 自动重连定时器句柄
let reconnectTimer: any = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5; // 最多尝试 5 次
const RECONNECT_BASE_INTERVAL = 2000; // 基础重连间隔 2 秒
let isAttemptingReconnect = false; // 防止并发重连

async function attemptAutoReconnect() {
  if (portRef || !autoReconnectEnabled || isAttemptingReconnect) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    return;
  }
  
  // 确保没有并行的定时器
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const hasHistory = !!localStorage.getItem(LAST_PORT_KEY);
  if (!hasHistory) return;

  // 达到最大重连次数，停止尝试
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('自动重连已达到最大尝试次数，已停止。');
    return;
  }

  isAttemptingReconnect = true;
  try {
    reconnectAttempts++;
    console.log(`[尝试 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}] 正在寻找历史设备...`);
    const success = await connectExisting();
    if (success) {
      console.log('自动重连成功！');
      reconnectAttempts = 0; // 重置计数器
    } else {
      // 延迟后再次尝试，使用退避机制：随着尝试次数增加，间隔时间也增加
      const delay = RECONNECT_BASE_INTERVAL * (1 + reconnectAttempts * 0.5);
      reconnectTimer = setTimeout(attemptAutoReconnect, delay);
    }
  } finally {
    isAttemptingReconnect = false;
  }
}

async function labelForPort(port: any) {
  try {
    const info = port.getInfo ? port.getInfo() : null
    if (info) {
      const v = info.usbVendorId ? info.usbVendorId.toString(16).padStart(4, '0') : ''
      const p = info.usbProductId ? info.usbProductId.toString(16).padStart(4, '0') : ''
      return `USB ${v ? `v${v}` : ''}${p ? ` p${p}` : ''}`
    }
  } catch (e) {
    // ignore
  }
  return 'COM device'
}

export async function listPorts(): Promise<string[]> {
  try {
    // @ts-ignore
    const nav: any = navigator
    if (!nav || !nav.serial) return []
    const ports = await nav.serial.getPorts()
    const labels = await Promise.all(ports.map(async (p: any, i: number) => {
      const lab = await labelForPort(p)
      return lab || `Port ${i+1}`
    }))
    return labels
  } catch (e) {
    return []
  }
}

/**
 * requestAndConnect: ask user to pick a port (browser prompt), open it and save label
 */
export async function requestAndConnect(): Promise<string | null> {
  try {
    // @ts-ignore
    const nav: any = navigator
    if (!nav || !nav.serial) return null
    const port = await nav.serial.requestPort()
    if (!port) return null
    await port.open({ baudRate: 9600 })
    portRef = port
    if (port.readable) {
      reader = port.readable.getReader()
      startReadLoop()
    }
    if (port.writable) {
      writer = port.writable.getWriter()
    }
    connectedLabel = await labelForPort(port)
    if (connectedLabel) {
      localStorage.setItem(LAST_PORT_KEY, connectedLabel)
    }
    startPolling()
    autoReconnectEnabled = true;
    reconnectAttempts = 0; // 重置重连计数
    window.dispatchEvent(new CustomEvent('serial-connected', { detail: { connected: true, label: connectedLabel } }))
    return connectedLabel
  } catch (e) {
    console.warn('requestAndConnect failed', e)
    return null
  }
}

export async function connectExisting(index = 0): Promise<boolean> {
  try {
    // @ts-ignore
    const nav: any = navigator
    if (!nav || !nav.serial) return false
    const ports = await nav.serial.getPorts()
    
    // 如果没有指定 index 且有历史记录，则寻找匹配的端口
    const lastLabel = localStorage.getItem(LAST_PORT_KEY)
    let port = null
    
    if (lastLabel) {
       for (const p of ports) {
         const lbl = await labelForPort(p)
         if (lbl === lastLabel) {
           port = p
           break
         }
       }
    }

    if (!port) {
      if (lastLabel) {
        // 如果有历史记录但当前列表中没找到，说明设备还没插上，返回 false 触发重连定时器
        return false;
      }
      if (ports.length > 0) {
        port = ports[index] || ports[0]
      }
    }

    if (!port) return false
    
    try {
      await port.open({ baudRate: 9600 })
    } catch (e: any) {
      if (e.name === 'InvalidStateError' || e.message?.includes('already open')) {
         // Ignore
      } else {
         throw e;
      }
    }

    portRef = port
    if (port.readable && !reader) {
      reader = port.readable.getReader()
      startReadLoop()
    }
    if (port.writable && !writer) {
      writer = port.writable.getWriter()
    }
    connectedLabel = await labelForPort(port)
    startPolling()
    autoReconnectEnabled = true;
    window.dispatchEvent(new CustomEvent('serial-connected', { detail: { connected: true, label: connectedLabel } }))
    return true
  } catch (e) {
    console.warn('connectExisting failed', e)
    return false
  }
}

export async function disconnect() {
  autoReconnectEnabled = false;
  reconnectAttempts = 0; // 重置重连计数
  try {
    stopPolling()
    readLoopRunning = false
    if (reader) { 
      try { await reader.cancel(); reader.releaseLock() } catch (e) {} 
      reader = null 
    }
    if (writer) { 
      try { writer.releaseLock() } catch (e) {}
      writer = null 
    }
    if (portRef) { 
      try { await portRef.close() } catch (e) {}
      portRef = null 
    }
    connectedLabel = null
    window.dispatchEvent(new CustomEvent('serial-connected', { detail: { connected: false, label: null } }))
  } catch (e) {
    console.warn('disconnect failed', e)
  }
}

export function isWebSerialAvailable(): boolean {
  // @ts-ignore
  return typeof navigator !== 'undefined' && !!(navigator as any).serial
}

export async function sendRaw(data: string) {
  if (!writer) return false
  const encoder = new TextEncoder()
  try {
    // writer.write may return a promise in the streams API
    await writer.write(encoder.encode(data))
    return true
  } catch (e) {
    console.warn('sendRaw failed', e)
    return false
  }
}
/**
 * Sends a hard reset (Ctrl+X) to GRBL
 */
export async function hardReset() {
  if (!writer) return false
  try {
    const resetChar = new Uint8Array([0x18])
    await writer.write(resetChar)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 暴力归零逻辑：支持单个轴或全轴同步
 * axis: 'X' | 'Y' | 'U' | 'Z' | 'ALL'
 */
export async function startHardHoming(axis: string = 'ALL', distance: number = 1000) {
  // 1. 发送解锁指令
  await sendRaw('$X\n'); 
  await new Promise(r => setTimeout(r, 100));

  // 2. 依次发送 G-Code
  await sendRaw('G91\n');
  await new Promise(r => setTimeout(r, 50));
  
  let moveCmd = '';
  if (axis === 'ALL') {
    moveCmd = `G1 X-${distance} Y-${distance} U-${distance} Z-${distance} F1600\n`;
  } else {
    moveCmd = `G1 ${axis.toUpperCase()}-${distance} F1600\n`;
  }
  
  await sendRaw(moveCmd);

  await new Promise(r => setTimeout(r, 50));
  await sendRaw('G90\n');
}

/**
 * 停止归零运动并重置坐标（包含全轴清零逻辑）
 */
export async function stopAndSetZero() {
  // 1. 立即停止当前运动
  await sendRaw('!');

  // 2. 软复位 (Ctrl+X)
  await new Promise(r => setTimeout(r, 100));
  await sendRaw(String.fromCharCode(0x18));
  await new Promise(r => setTimeout(r, 1000));
  
  // 3. 解锁并归零
  await sendRaw('$X\n');
  await new Promise(r => setTimeout(r, 100));
  await sendRaw('G92 X0 Y0 U0 Z0\n');
}

/**
 * 紧急停止特定轴的移动（用于暴力归零时单个轴先撞墙的情况）
 */
export async function stopSpecificAxisAndContinue(completedAxis: string, remainingAxes: string[]) {
  // 1. 先全部停下
  await sendRaw('!');
  await new Promise(r => setTimeout(r, 100));
  await sendRaw(String.fromCharCode(0x18));
  await new Promise(r => setTimeout(r, 1000));
  await sendRaw('$X\n');
  
  // 2. 将完成的轴设为零且保持现状
  await sendRaw(`G92 ${completedAxis.toUpperCase()}0\n`);
  await new Promise(r => setTimeout(r, 100));

  // 3. 如果还有剩下的轴，继续以增量模式跑
  if (remainingAxes.length > 0) {
    const axesStr = remainingAxes.map(ax => `${ax.toUpperCase()}-1000`).join(' ');
    await sendRaw('G91\n');
    await sendRaw(`G1 ${axesStr} F1600\n`);
    await sendRaw('G90\n');
  }
}

function startReadLoop() {
  if (!reader || readLoopRunning) return
  readLoopRunning = true
  const decoder = new TextDecoder()
  let buffer = ''

  ;(async () => {
    try {
      while (readLoopRunning && reader) {
        const res = await reader.read()
        if (!res) break
        const { value, done } = res as any
        if (done) break
        if (value) {
          // decode chunk (stream mode handles partial multi-byte sequences)
          let chunk = ''
          try {
            chunk = decoder.decode(value, { stream: true })
          } catch (e) {
            try { chunk = String(value) } catch (e2) { chunk = '' }
          }
          if (!chunk) continue
          buffer += chunk
          // split into complete lines, keep remainder in buffer
          const parts = buffer.split(/\r?\n/)
          buffer = parts.pop() || ''
          for (const line of parts) {
            const trimmed = line.replace(/\r$/, '')
            
            // GRBL Real-time Status Parsing
            if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
              parseStatus(trimmed)
            }

            window.dispatchEvent(new CustomEvent('serial-data', { detail: { data: trimmed } }))
          }
        }
      }
    } catch (e) {
      console.warn('serial read loop error', e)
    } finally {
      readLoopRunning = false
      try {
        if (reader) { await reader.cancel(); try { reader.releaseLock() } catch (e) {} ; reader = null }
      } catch (e) {}
      // if there's any leftover partial data, flush it as a line
      try {
        if (buffer && buffer.length > 0) {
          window.dispatchEvent(new CustomEvent('serial-data', { detail: { data: buffer } }))
          buffer = ''
        }
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('serial-connected', { detail: { connected: false, label: null } }))
    }
  })()
}

export function getConnectedLabel() { return connectedLabel }

/**
 * 控制自动重连功能
 */
export function setAutoReconnect(enabled: boolean) {
  autoReconnectEnabled = enabled;
  if (!enabled && reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  console.log(`自动重连已${enabled ? '启用' : '禁用'}`);
}

/**
 * 获取自动重连状态
 */
export function isAutoReconnectEnabled() {
  return autoReconnectEnabled;
}

/**
 * 重置重连计数器，允许重新开始重连尝试
 */
export function resetReconnectAttempts() {
  reconnectAttempts = 0;
  console.log('重连计数器已重置');
}

/**
 * Parsing logic for GRBL status reports: <Idle|WPos:0.000,0.000,0.000,0.000|...>
 */
function parseStatus(line: string) {
  const inner = line.slice(1, -1)
  const parts = inner.split('|')
  const status = parts[0].toUpperCase()
  
  // 查找工作坐标 WPos 或机械坐标 MPos
  const wposPart = parts.find(p => p.startsWith('WPos:'))
  const mposPart = parts.find(p => p.startsWith('MPos:'))
  
  let coords: string[] = []
  if (wposPart) {
    // 优先使用工作坐标，这是 G92 影响的坐标
    coords = wposPart.split(':')[1].split(',')
  } else if (mposPart) {
    // 如果只有机械坐标，则使用它
    coords = mposPart.split(':')[1].split(',')
  }

  if (coords.length >= 3) {
    window.dispatchEvent(new CustomEvent('serial-status', {
      detail: {
        status, // 这里的 status 包含了原始大写状态名
        x: coords[0] || '0.000',
        y: coords[1] || '0.000',
        z: coords[2] || '0.000',
        u: coords[3] || '0.000'
      }
    }))
  }
}

export function setPollInterval(ms: number) {
  pollInterval = ms
  if (pollTimer) {
    startPolling() // restart with new interval
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (writer) sendRaw('?')
  }, pollInterval)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export default {
  listPorts,
  requestAndConnect,
  connectExisting,
  disconnect,
  isWebSerialAvailable,
  sendRaw,
  getConnectedLabel,
  setAutoReconnect,
  isAutoReconnectEnabled,
  resetReconnectAttempts,
}
