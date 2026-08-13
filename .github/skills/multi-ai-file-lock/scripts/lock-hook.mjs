#!/usr/bin/env node
/**
 * multi-ai-file-lock — PreToolUse hook
 *
 * 在编辑类工具（create_file / replace_string_in_file / multi_replace_string_in_file /
 * edit_notebook_file 等）调用前，检查目标文件是否被其他 AI 会话锁定。
 * 被活跃锁占用 → exit 2 阻断编辑（stderr 提示如何加锁）。
 * 残留锁（过期）→ stderr 警告，放行。
 * 无锁 → 放行。
 *
 * 由 .github/hooks/file-lock.json 加载；退出码 2 = blocking error。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 编辑类工具 → tool_input 中提取文件路径的规则
const EDIT_TOOLS = {
  create_file: (i) => [i.filePath],
  replace_string_in_file: (i) => [i.filePath],
  multi_replace_string_in_file: (i) => (Array.isArray(i.replacements) ? i.replacements.map((r) => r.filePath).filter(Boolean) : []),
  edit_notebook_file: (i) => [i.filePath],
  delete_file: (i) => [i.filePath],
  rename_file: (i) => [i.filePath, i.newPath],
  write_file: (i) => [i.filePath],
  edit_file: (i) => [i.filePath],
};

function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(process.cwd()) ?? process.cwd();
const LOCK_SCRIPT = path.join(REPO_ROOT, '.github', 'skills', 'multi-ai-file-lock', 'scripts', 'lock.mjs');

function isFsPath(p) {
  return typeof p === 'string' && !p.startsWith('untitled:') && !p.includes('://');
}

function checkLock(absPath) {
  // check 退出码: 0=未锁 1=残留(可回收) 2=活跃锁
  const res = spawnSync(process.execPath, [LOCK_SCRIPT, 'check', absPath], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: REPO_ROOT,
  });
  return { status: res.status, out: (res.stdout ?? '') + (res.stderr ?? '') };
}

function main(event) {
  const toolName = event?.tool_name ?? '';
  const toolInput = event?.tool_input ?? {};
  const extract = EDIT_TOOLS[toolName];
  if (!extract) return; // 非编辑工具，放行

  const files = (extract(toolInput) ?? []).filter(isFsPath);
  if (files.length === 0) return;

  if (!fs.existsSync(LOCK_SCRIPT)) {
    console.error(`[lock-hook] 警告: 未找到锁脚本 ${LOCK_SCRIPT}，跳过锁检查`);
    return;
  }

  let blocked = false;
  for (const f of files) {
    const { status, out } = checkLock(f);
    if (status === 2) {
      blocked = true;
      console.error(
        `[lock-hook] 阻断: ${f} 被其他会话锁定（可能有多个 AI 同时在改）。\n` +
          `${out.trim()}\n` +
          `正确做法: 先用 node .github/skills/multi-ai-file-lock/scripts/lock.mjs acquire <path> <sessionId> \"<意图>\" 加锁，再编辑。`
      );
    } else if (status === 1) {
      console.warn(`[lock-hook] 警告: ${f} 存在残留锁（已过期可回收）。\n${out.trim()}`);
    }
  }
  if (blocked) process.exit(2); // blocking error，stderr 会展示给模型
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(input));
  } catch (err) {
    console.error(`[lock-hook] 输入解析失败（不阻断）: ${err.message}`);
  }
});
process.stdin.resume();
