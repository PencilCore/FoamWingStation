// src/components/CameraCaptureButton.tsx
// 3D 视图「复制视角」工具：点击后把当前摄像机坐标（position）与角度（target 焦点 + fov 视野）
// 以 JSON 复制到剪贴板。把复制结果粘贴给 AI，即可把该视角设置为视图默认角度。
//
// 用法（两个部分缺一不可）：
//   1. Canvas 内部渲染 <CameraCaptureBridge captureRef={ref} /> —— 注册读取器
//   2. Canvas 外层渲染 <CameraCaptureButton captureRef={ref} /> —— 顶部按钮
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'

/** 摄像机视角快照：position = 相机坐标；target = OrbitControls 焦点（决定朝向）；fov = 视野角度 */
export interface CameraSnapshot {
  position: number[];
  target: number[];
  fov: number;
}

/** captureRef 的类型：指向「读取当前摄像机快照」的函数（Canvas 内部注册，外部按钮调用） */
export type CameraCaptureFn = () => CameraSnapshot | null;
export type CameraCaptureRef = RefObject<CameraCaptureFn | null>;

/**
 * 必须放在 <Canvas> 内部：通过 useThree 拿到当前 camera 与 makeDefault 的 OrbitControls，
 * 把读取函数注册到 captureRef 上，供外层按钮调用。
 */
export function CameraCaptureBridge({ captureRef }: { captureRef: CameraCaptureRef }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  useEffect(() => {
    captureRef.current = () => {
      if (!controls) return null
      const pos = camera.position
      const tgt = controls.target
      const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
        ? (camera as THREE.PerspectiveCamera).fov
        : 35
      const r2 = (n: number) => Math.round(n * 100) / 100
      return {
        position: [r2(pos.x), r2(pos.y), r2(pos.z)],
        target: [r2(tgt.x), r2(tgt.y), r2(tgt.z)],
        fov: Math.round(fov),
      }
    }
    return () => {
      captureRef.current = null
    }
  }, [camera, controls, captureRef])

  return null
}

/** 3D 视图顶部中央的「复制视角」按钮：读取并复制当前摄像机快照，成功后短暂显示反馈 */
export function CameraCaptureButton({ captureRef, style }: { captureRef: CameraCaptureRef; style?: CSSProperties }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  const handleCopy = useCallback(async () => {
    const snap = captureRef.current?.()
    if (!snap) return
    const text = JSON.stringify(snap, null, 2)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 剪贴板 API 不可用时的降级方案（execCommand，仅限非 https 环境）
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 2000)
  }, [captureRef])

  return (
    <button
      onClick={handleCopy}
      title="复制当前摄像机坐标与角度（JSON），粘贴给 AI 可设为默认视角"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.8)',
        color: copied ? '#34d399' : '#38bdf8',
        border: copied ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'monospace',
        cursor: 'pointer',
        lineHeight: 1.4,
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {copied ? '✓ 已复制' : '📷 复制视角'}
    </button>
  )
}
