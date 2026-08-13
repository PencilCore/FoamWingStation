// src/components/TouchpadOrbitControls.tsx
// 触摸板友好的轨道控制器，设计界面与控制台 3D 视图共用。
// 针对笔记本触摸板的改进：
//  - 两指滑动（wheel，非 ctrlKey）→ 平移场景（默认会变成缩放）
//  - 双指捏合（pinch，wheel + ctrlKey）→ 缩放
//  - 鼠标滚轮（大步长 wheel / 行模式）→ 仍为缩放
//  - 无阻尼，操作即时响应；降低缩放灵敏度（触摸板滚动增量大）
//  - 按键映射：左键旋转 / 右键平移 / 中键缩放（标准 3D 软件习惯）
import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'

/**
 * 触摸板/鼠标滚轮事件是否来自触摸板两指滑动。
 * 触摸板产生平滑的小增量（deltaMode=0 且 |delta| 通常 <60）；
 * 鼠标滚轮通常是 ±100/±120 或按行滚动（deltaMode=1）。
 */
function isTouchpadSwipe(e: WheelEvent): boolean {
  if (e.ctrlKey) return false // ctrlKey = 捏合缩放
  if (e.deltaMode !== 0) return false // 按行/按页滚动：鼠标滚轮
  return Math.abs(e.deltaX) < 60 && Math.abs(e.deltaY) < 60
}

/**
 * 手动平移：three-stdlib 的 OrbitControls 未公开 pan()，
 * 复刻其内部算法（以像素为单位，自动适配透视/正交相机）。
 */
function panControls(controls: OrbitControlsImpl, deltaX: number, deltaY: number) {
  const cam = controls.object
  const el = controls.domElement
  const clientHeight = el?.clientHeight || 1
  const clientWidth = el?.clientWidth || 1
  const panOffset = new THREE.Vector3()
  const v = new THREE.Vector3()

  let tx: number
  let ty: number
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const perspective = cam as THREE.PerspectiveCamera
    const targetDistance = cam.position.distanceTo(controls.target)
    const scale = 2 * targetDistance * Math.tan((perspective.fov / 2) * Math.PI / 180) / clientHeight
    tx = deltaX * scale
    ty = deltaY * scale
  } else {
    const ortho = cam as THREE.OrthographicCamera
    tx = deltaX * (ortho.right - ortho.left) / ortho.zoom / clientWidth
    ty = deltaY * (ortho.top - ortho.bottom) / ortho.zoom / clientHeight
  }

  // 左方向（相机世界矩阵第 0 列的负向）→ 与 OrbitControls 的 panLeft 一致
  cam.updateMatrixWorld()
  v.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(-tx)
  panOffset.add(v)

  // 上方向：screenSpacePanning 时用相机本地 Y 轴，否则投影到地平面上
  if (controls.screenSpacePanning === true) {
    v.setFromMatrixColumn(cam.matrixWorld, 1)
  } else {
    v.setFromMatrixColumn(cam.matrixWorld, 0)
    v.crossVectors(cam.up, v)
  }
  v.multiplyScalar(ty)
  panOffset.add(v)

  controls.target.add(panOffset)
  cam.position.add(panOffset)
  controls.update()
}

export function TouchpadOrbitControls(props: ComponentProps<typeof OrbitControls>) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      const controls = controlsRef.current
      if (!controls) return
      if (isTouchpadSwipe(e)) {
        // 捕获阶段拦截，阻止 OrbitControls 把它当作缩放
        e.preventDefault()
        e.stopPropagation()
        // 两指滑动方向反转后平移（场景向滑动反方向移动）
        panControls(controls, -e.deltaX, -e.deltaY)
      }
      // 捏合（ctrlKey）或鼠标滚轮：放行给 OrbitControls 处理缩放
    }
    // 捕获阶段注册，先于 OrbitControls 内部（冒泡阶段）的 wheel 监听
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true } as AddEventListenerOptions)
  }, [gl])

  return (
    <OrbitControls
      ref={controlsRef}
      {...props}
      enableDamping={props.enableDamping ?? false}
      dampingFactor={props.dampingFactor ?? 0.08}
      zoomSpeed={props.zoomSpeed ?? 0.6}
      mouseButtons={
        props.mouseButtons ?? {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }
      }
    />
  )
}
