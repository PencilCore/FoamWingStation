---
name: compile-verification
description: 'FoamWingStation 前端代码修改后的编译验证流程：运行 tsc 类型检查 + vite build 构建，按"无新增错误"标准判定通过后收尾；明确不做 Playwright/浏览器验证。Use when: 完成代码修改后需要验证、提交前自检、确认编译是否通过、判断 tsc 报错是否本次引入、用户要求"只需编译通过"。'
argument-hint: '编译验证：tsc + vite build，不跑浏览器'
---

# 编译验证（Compile Verification）

修改 FoamWingStation 前端代码后，仅通过 TypeScript 类型检查与 Vite 构建来验证改动正确性，**不进行 Playwright / 浏览器验证**。

## 何时使用

- 完成 React/TypeScript 代码修改后，需要确认编译通过
- 提交前自检（commit 前验证）
- 用户明确要求"不需要 Playwright 验证，只需要运行编译通过"
- 需要判断某个 tsc 报错是否为本次修改引入

## 前提与准备工作

- 仓库根：`c:\Downloads\foamwingstation`；**项目目录是 `foam-wing-station/` 子目录**，所有命令都在其中执行
- 改代码前先 `git status` / `git diff`，确认工作区没有非本会话的脏改动（多 AI 并发时防互相覆盖）
- 终端用 `Push-Location foam-wing-station` 进入项目目录（`Set-Location` 在本工具会话不持久，且不能与 `&&` 混用）

## 流程

1. **进入项目目录**：`Push-Location foam-wing-station`
2. **类型检查**：`npx tsc -b`（等价逐项目 `tsconfig.app.json`/`tsconfig.node.json`）
3. **构建**：`npm run build`（即 `vite build`，不包含 tsc）
4. **判定结果**：
   - tsc 与 build 均无错误 → **通过**
   - 有报错 → 与下方"既有错误清单"逐条比对：
     - 报错全部命中既有清单 → **通过**（本次无新增错误），在总结中说明"剩余均为既有错误"
     - 存在清单之外的新增错误 → **不通过**，修复后重跑第 2、3 步
5. **收尾**：验证通过后总结时写明 `tsc 无新增错误` 与 `vite build 通过`；**不要**启动 dev server / 打开浏览器 / 运行 Playwright

## 既有 tsc 错误清单（2026-08-13 快照，非本次引入，判定时忽略）

- `MachineParams.tsx:82` — `setSectionTab` 未使用
- `Gcode3DPreview.tsx:186-188` — `<line frustumCulled>` / bufferAttribute args
- `ThreePreview.tsx:1214` — 导轨 bufferAttribute args
- 历史遗留：`LogPanel` / `GCodeInput` / `ModelDataDisplay` / `GcodeSimulator` / `winggenerator`

> 注意：此清单会随代码演进变化。若既有错误被修复，从清单中删除；发现新的长期遗留错误，追加进清单。

## 注意事项（项目经验）

- **双份 parseGcodeToPath**：`Gcode3DPreview.tsx` 与 `ThreePreview.tsx` 各有一份本地副本，改动需同步两处，否则 2D/3D 解析行为不一致
- **新增 @mui/icons-material 图标后 dev server 报 504 "Outdated Optimize Dep"**：缓存失效，删除 `node_modules/.vite` 后重启；与编译验证无关，但若后续要 dev 排查会碰到
- **DAT 资源**：翼型文件在 `src/assets/AIRFOILS/`（大写，17 个 .DAT）；动态 `import()` 变量路径不可用，必须用 `import.meta.glob`
- **色板**：使用 `theme.ts` 的 `design.*` token（`sx={{ color: 'design.sky' }}`），禁止硬编码色值；新增色板字段需同时声明 `Palette.design` 与 `PaletteOptions.design?`（否则 tsc TS2353）
