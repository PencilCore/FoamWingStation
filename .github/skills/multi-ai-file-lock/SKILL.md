---
name: multi-ai-file-lock
description: '多 AI 并发协作文件锁。Use when: 多个 AI 会话/agent 同时在同一仓库工作；修改文件前先加锁防止互相覆盖；multi-agent concurrent editing; file lock; avoid overwriting each other; 冲突检测; 并发编辑同一仓库。提供原子锁 CLI（scripts/lock.mjs）与完整获取→编辑→释放流程。'
argument-hint: '对哪些文件加锁？例如：重构 src/components 下的组件'
user-invocable: true
---

# 多 AI 文件锁（Multi-AI File Lock）

多个 AI 会话同时修改同一仓库时，用 `.locks/` 目录下的锁文件互斥，保证**同一时刻每个文件只有一个 AI 在编辑**，避免互相覆盖、丢失改动。

## When to Use

- 多个 Copilot/Agent 窗口、多个终端会话同时在同一个仓库上工作
- 你要修改的文件可能也被其他 AI 修改（组件、公共工具、配置、样式）
- 开始任何 `edit` / `create` / `delete` 操作之前

## Golden Rules

1. **先锁后改，改完即释**：不持有锁的文件一律不编辑。
2. **一次锁定全部**：列出本次所有目标文件，全部锁定成功后才开始编辑。
3. **锁是最晚获取、最早释放的资源**：只在真正编辑前获取，校验完成后立即释放；不要在思考/等待期间持锁。
4. **编辑前重读**：即使持有锁，动手前也重新读取文件最新内容（其他 AI 可能改过相关文件）。
5. **只动自己的范围**：不做与任务无关的重排/重构，避免大面积 diff 增加冲突面。
6. **诚实处理冲突**：锁获取失败绝不绕过锁强改；先做无冲突文件，冲突文件放入等待清单，稍后重试。

## Procedure

### 0. 会话身份

本会话首次加锁前生成一个 `sessionId`，整个会话复用（例如 `ai-<时间戳>-<随机4位>`，可记到 `/memories/session/` 里），用于追溯残留锁和释放校验。

### 1. 规划 + 扫描

1. 列出本次要修改的**全部**文件（相对仓库根路径）。
2. 运行 `node .github/skills/multi-ai-file-lock/scripts/lock.mjs list` 查看现有锁；对每个目标文件运行 `check` 确认未被锁定。

### 2. 获取锁（冲突不阻塞，先做无冲突文件）

按路径字典序，对每个目标文件执行：

```
node .github/skills/multi-ai-file-lock/scripts/lock.mjs acquire <relative-path> <sessionId> "<intent>"
```

- 成功 → 继续下一个。
- **失败（冲突）** → 将该文件加入“等待清单”，**不中断、不提问、不释放已获取的锁**，继续尝试剩余文件。
- 全部尝试完成后：**先编辑全部已锁定成功的文件**；等待清单中的文件留到最后，稍后重试。
- `acquire` 用原子创建（`wx`），不存在“检查后创建”的竞态窗口；已存在且未过期的锁会直接拒绝。
- 过期锁（默认 **5 分钟**无更新）视为崩溃残留，`acquire` 会自动回收并重试。
- 路径参数支持相对或绝对路径（hook 传入绝对路径也能正确匹配锁）。

### 3. 编辑

- 每次编辑前重读文件最新内容。
- 只编辑持有锁的文件；使用小步、精确的 edit 操作（多文件改动用一次批量替换工具调用，减少中间态）。
- 不要触碰其他 AI 持有锁的文件，即使只是“顺手”。
- 已锁定文件全部编辑完后，对等待清单逐个重试 `acquire`，成功即补编辑（见“冲突等待与重试”）。

### 4. 校验 + 释放

1. 用 `get_errors` 校验改动无编译/语法错误。
2. 按获取的逆序逐个释放：

```
node .github/skills/multi-ai-file-lock/scripts/lock.mjs release <relative-path> <sessionId>
```

3. 汇报时列出：修改的文件 + 已释放的锁。

### 5. 冲突等待与重试

- 冲突文件进入“等待清单”后，**继续完成其他无冲突工作**（编辑已锁文件、跑校验），不让冲突阻塞整个任务。
- **不向用户提问**（不要用提问工具询问“怎么办”）；只需在每轮汇报时**通知**用户：哪些文件在等待、被哪个 session 锁定。
- 完成当前工作后（或收到用户新指令时）重试 `acquire`：成功 → 立即补编辑该文件；仍失败 → 保持等待并再次通知用户，继续等待。
- 等待期间绝不用 `force-release` 抢占别人的活跃锁；只有确认是残留锁（[STALE]）且重试自动回收无效时才手动清理。

### 6. 异常恢复

- 编辑中断（崩溃/被杀）会残留锁：其他会话的 `acquire` 会在 5 分钟后自动回收。
- 人为确认是残留锁时可用 `force-release` 立即清除（谨慎，会误伤在途编辑）。
- 本会话结束后，检查 `.locks/` 是否还有自己残留的锁并清理。

## CLI 参考

| 命令 | 说明 |
|------|------|
| `node lock.mjs list` | 列出全部锁（含 age 与 [STALE] 标记） |
| `node lock.mjs check <path>` | 检查单个文件是否被锁（相对/绝对路径均可） |
| `node lock.mjs acquire <path> <sessionId> "<intent>"` | 原子加锁；被占用或失败返回非 0 |
| `node lock.mjs release <path> <sessionId>` | 释放自己持有的锁（sessionId 不符会拒绝） |
| `node lock.mjs force-release <path>` | 强制清除锁（仅确认残留时用） |

脚本路径：`./scripts/lock.mjs`（相对本 SKILL.md）；锁目录：仓库根 `.locks/`（已加入 `.gitignore`，不入库）。

锁文件命名：相对路径中 `/` → `__`、`.` → `_`，如 `src/App.tsx` → `src__App_tsx.lock`。

## 硬性强制（PreToolUse hook）

仓库已配置 `.github/hooks/file-lock.json`：任何 AI 会话调用编辑类工具（`create_file` / `replace_string_in_file` / `multi_replace_string_in_file` / `edit_notebook_file` 等）前，hook 会自动检查目标文件锁：

- 无锁 → 放行；
- 有活跃锁 → **阻断编辑**（exit 2），stderr 提示哪个文件被谁锁定；
- 有残留锁 → 警告并放行。

因此即使某个 AI 忘记主动加锁，也改不了别人锁定的文件。注意：hook 只做“检查”，**加锁/释放仍必须由 AI 用 `acquire`/`release` 完成**（`acquire` 也是唯一能自动回收残留锁的入口）。

## 边界与 FAQ

- **锁不是安全网**：锁是协作信号，靠各 AI 自觉遵守纪律；`.github/hooks/file-lock.json` 的 PreToolUse hook 提供了硬性拦截（见上）。
- **只锁要改的文件**：新建文件在 `create` 前也先 `acquire`（路径尚未存在也可锁）。
- **STALE 阈值**：默认 5 分钟；如需调整改 `scripts/lock.mjs` 顶部的 `STALE_MS`。
- **命名碰撞**：编码规则理论上可能碰撞（如 `a/b.c` 与 `a__b_c`），罕见；遇到同名锁先 `check` 确认。
