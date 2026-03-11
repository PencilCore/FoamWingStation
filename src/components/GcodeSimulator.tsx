// src/components/GcodeSimulator.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Box, Typography } from '@mui/material';

interface Pos { X: number; Y: number; U: number; Z: number }

const WING_SPAN = 600; // mm（你的机翼展长）

export default function GcodeSimulator({ gcode }: { gcode: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current || !gcode.trim()) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 3000);
    camera.position.set(900, 700, 900);
    camera.lookAt(300, 0, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // 灯光 + 地面
    scene.add(new THREE.DirectionalLight(0xffffff, 1.5));
    scene.add(new THREE.AmbientLight(0x404060));
    const grid = new THREE.GridHelper(1000, 50, 0x303030, 0x202020);
    grid.rotation.x = -Math.PI / 2;
    scene.add(grid);

    // 泡沫块（半透明）
    const foam = new THREE.Mesh(
      new THREE.BoxGeometry(220, 50, WING_SPAN),
      new THREE.MeshPhongMaterial({ color: 0x88ccff, opacity: 0.25, transparent: true })
    );
    foam.position.set(110, 25, WING_SPAN / 2);
    scene.add(foam);

    // 当前热丝（红）
    const wireGeo = new THREE.BufferGeometry();
    const wire = new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 4 }));
    scene.add(wire);

    // 已切割轨迹（青）
    const maxPoints = 50000;
    const positions = new Float32Array(maxPoints * 3);
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pathGeo.setDrawRange(0, 0);
    const path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0x00ff99, transparent: true, opacity: 0.8 }));
    scene.add(path);

    // 刀头小球
    const sphere = new THREE.SphereGeometry(7);
    const leftBall = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x0099ff }));
    const rightBall = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    scene.add(leftBall);
    scene.add(rightBall);

    // 解析 G-code
    const lines = gcode.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('(') && !l.startsWith('%'));

    const commands: Pos[] = [];
    let cur: Pos = { X: 0, Y: 0, U: 0, Z: 0 };

    for (const line of lines) {
      if (/G0*([01])/.test(line)) {
        const x = parseFloat(line.match(/X([-\d.]+)/i)?.[1] ?? 'NaN');
        const y = parseFloat(line.match(/Y([-\d.]+)/i)?.[1] ?? 'NaN');
        const u = parseFloat(line.match(/U([-\d.]+)/i)?.[1] ?? 'NaN');
        const z = parseFloat(line.match(/Z([-\d.]+)/i)?.[1] ?? 'NaN');
        if (!isNaN(x)) cur.X = x;
        if (!isNaN(y)) cur.Y = y;
        if (!isNaN(u)) cur.U = u;
        if (!isNaN(z)) cur.Z = z;
        commands.push({ ...cur });
      }
    }

    // 开始动画
    let i = 0;
    const animate = () => {
      if (i >= commands.length) {
        renderer.render(scene, camera);
        return;
      }

      const p = commands[i];
      const left = new THREE.Vector3(p.X, p.Y, 0);
      const right = new THREE.Vector3(p.U, p.Z, WING_SPAN);

      // 更新热丝
      wire.geometry.setFromPoints([left, right]);
      leftBall.position.copy(left);
      rightBall.position.copy(right);

      // 添加轨迹
      const posAttr = path.geometry.attributes.position;
      const count = posAttr.count;
      if (count + 2 < maxPoints * 3) {
        posAttr.setXYZ(count, p.X, p.Y, 0);
        posAttr.setXYZ(count + 1, p.U, p.Z, WING_SPAN);
        // @ts-ignore - position.count is read-only but this logic expects to update it
        posAttr.count += 2;
        posAttr.needsUpdate = true;
        path.geometry.setDrawRange(0, count + 2);
      }

      renderer.render(scene, camera);
      i++;
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    // 鼠标拖动旋转视角
    let isDragging = false;
    let previousMouse = { x: 0, y: 0 };
    const onMouseDown = () => isDragging = true;
    const onMouseUp = () => isDragging = false;
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - previousMouse.x;
      const dy = e.clientY - previousMouse.y;
      camera.position.x += dx * 0.8;
      camera.position.y -= dy * 0.8;
      camera.lookAt(300, 0, 300);
      previousMouse = { x: e.clientX, y: e.clientY };
    };
    mountRef.current.addEventListener('mousedown', onMouseDown);
    mountRef.current.addEventListener('mouseup', onMouseUp);
    mountRef.current.addEventListener('mousemove', onMouseMove);
    mountRef.current.addEventListener('mouseleave', onMouseUp);

    // 响应式
    const resize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      mountRef.current?.removeEventListener('mousedown', onMouseDown);
      mountRef.current?.removeEventListener('mouseup', onMouseUp);
      mountRef.current?.removeEventListener('mousemove', onMouseMove);
      mountRef.current?.removeEventListener('mouseleave', onMouseUp);
      renderer.dispose();
                                if (mountRef.current) {
                                mountRef.current.innerHTML = '';
                                }
    };
  }, [gcode]);

  return (
    <Box flex={1} display="flex" flexDirection="column" minWidth={350}>
      <Typography mb={1} color="#ff9800" fontWeight="bold">
        离线 3D 热线切割预览（鼠标拖动旋转）
      </Typography>
      <Box
        ref={mountRef}
        sx={{
          flex: 1,
          bgcolor: '#000',
          border: '2px solid #444',
          borderRadius: 2,
          minHeight: 420,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' }
        }}
      />
      <Typography fontSize={12} mt={1} color="#aaa" textAlign="center">
        红线 = 当前热丝 青线 = 已切割路径 蓝色/橙色球 = 左右刀头
      </Typography>
    </Box>
  );
}