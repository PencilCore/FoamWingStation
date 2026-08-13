#!/usr/bin/env node
/**
 * multi-ai-file-lock — 文件锁 CLI（多 AI 并发协作）
 *
 * 用法:
 *   node lock.mjs list
 *   node lock.mjs check <path>
 *   node lock.mjs acquire <path> <sessionId> "<intent>"
 *   node lock.mjs release <path> <sessionId>
 *   node lock.mjs force-release <path>
 *
 * <path> 支持相对路径或绝对路径（hook 传入绝对路径时自动换算为仓库相对路径）。
 *
 * 锁目录: <repo-root>/.locks/
 * 锁文件命名: 相对路径中的 / → __, . → _，末尾追加 .lock
 *   例: src/App.tsx → src__App_tsx.lock
 * 原子性: acquire 用 fs.openSync(path, 'wx') 原子创建，文件已存在则失败（真正的互斥）
 * 过期: 锁超过 STALE_MS（默认 5 分钟）视为崩溃残留，acquire 时自动回收
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STALE_MS = 5 * 60 * 1000; // 5 分钟

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 仓库根优先从 cwd 向上探测（.git / package.json），找不到再退回 skill 目录推断
function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const REPO_ROOT =
  findRepoRoot(process.cwd()) ??
  findRepoRoot(path.resolve(__dirname, '..', '..', '..', '..')) ??
  process.cwd();
const LOCK_DIR = path.join(REPO_ROOT, '.locks');

// 任意路径（相对/绝对）→ 仓库相对路径（正斜杠）；仓库外路径原样返回
function toRel(p) {
  if (!p || /^[a-z]+:/i.test(p) && !/^[a-zA-Z]:[\\/]/.test(p)) return p; // untitled: / vscode-userdata: 等 URI
  const abs = path.resolve(p);
  const rel = path.relative(REPO_ROOT, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return p;
  return rel.split(path.sep).join('/');
}

function encodePath(rel) {
  return rel.replace(/[/\\]/g, '__').replace(/\./g, '_') + '.lock';
}

function lockFileFor(rel) {
  return path.join(LOCK_DIR, encodePath(rel));
}

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function isStale(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    return Date.now() - stat.mtimeMs > STALE_MS;
  } catch {
    return true;
  }
}

function acquire(rel, sessionId, intent) {
  rel = toRel(rel);
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = lockFileFor(rel);
  const now = Date.now();
  try {
    const fd = fs.openSync(lockPath, 'wx'); // 原子创建，已存在则 EEXIST
    fs.writeFileSync(
      fd,
      JSON.stringify(
        { file: rel, sessionId, intent, lockedAt: new Date(now).toISOString() },
        null,
        2
      ) + '\n'
    );
    fs.closeSync(fd);
    console.log(`[lock] acquired  ${rel}  (session=${sessionId}, intent=${intent})`);
    return 0;
  } catch (err) {
    if (err.code === 'EEXIST') {
      if (isStale(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        console.warn(`[lock] recycled stale lock: ${rel}`);
        return acquire(rel, sessionId, intent); // 重试一次
      }
      const info = readLock(lockPath);
      console.error(
        `[lock] FAILED: ${rel} 已被 session=${info?.sessionId ?? 'unknown'} 锁定 ` +
          `(intent=${info?.intent ?? '?'}, since=${info?.lockedAt ?? '?'})。禁止编辑该文件。`
      );
      return 1;
    }
    console.error(`[lock] ERROR: ${err.message}`);
    return 2;
  }
}

function release(rel, sessionId) {
  rel = toRel(rel);
  const lockPath = lockFileFor(rel);
  if (!fs.existsSync(lockPath)) {
    console.log(`[lock] no lock for ${rel} (already released)`);
    return 0;
  }
  const info = readLock(lockPath);
  if (info && info.sessionId !== sessionId) {
    console.error(
      `[lock] REFUSED: ${rel} 的锁属于 session=${info.sessionId}，不属于 ${sessionId}。` +
        `只有确认是残留锁时才用 force-release。`
    );
    return 1;
  }
  fs.rmSync(lockPath, { force: true });
  console.log(`[lock] released  ${rel}`);
  return 0;
}

function forceRelease(rel) {
  rel = toRel(rel);
  const lockPath = lockFileFor(rel);
  if (!fs.existsSync(lockPath)) {
    console.log(`[lock] no lock for ${rel}`);
    return 0;
  }
  fs.rmSync(lockPath, { force: true });
  console.warn(`[lock] force-released ${rel}`);
  return 0;
}

function listLocks() {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const files = fs.existsSync(LOCK_DIR) ? fs.readdirSync(LOCK_DIR) : [];
  if (files.length === 0) {
    console.log('[lock] (no locks)');
    return 0;
  }
  for (const f of files.sort()) {
    const info = readLock(path.join(LOCK_DIR, f));
    const age = info ? Math.round((Date.now() - new Date(info.lockedAt).getTime()) / 1000) : '?';
    const stale = typeof age === 'number' && age * 1000 > STALE_MS ? ' [STALE]' : '';
    console.log(`  ${f}\n      file=${info?.file ?? '?'}  session=${info?.sessionId ?? '?'}` +
      `  since=${info?.lockedAt ?? '?'}  age=${age}s${stale}  intent=${info?.intent ?? '?'}`);
  }
  return 0;
}

function check(rel) {
  rel = toRel(rel);
  const lockPath = lockFileFor(rel);
  if (!fs.existsSync(lockPath)) {
    console.log(`[lock] ${rel} 未被锁定，可以编辑`);
    return 0;
  }
  const info = readLock(lockPath);
  const age = info ? Math.round((Date.now() - new Date(info.lockedAt).getTime()) / 1000) : '?';
  const stale = typeof age === 'number' && age * 1000 > STALE_MS;
  console.log(`[lock] ${rel} 被锁定: session=${info?.sessionId ?? '?'} intent=${info?.intent ?? '?'}` +
    ` since=${info?.lockedAt ?? '?'} age=${age}s${stale ? ' [STALE]' : ''}`);
  return stale ? 1 : 2; // 1=可回收, 2=活跃锁
}

const [cmd, ...args] = process.argv.slice(2);
let code;
switch (cmd) {
  case 'list':
    code = listLocks();
    break;
  case 'check':
    code = args[0] ? check(args[0]) : (console.error('用法: node lock.mjs check <relative-path>'), 2);
    break;
  case 'acquire':
    code = args.length >= 2 ? acquire(args[0], args[1], args[2] ?? '') : (console.error('用法: node lock.mjs acquire <path> <sessionId> "<intent>"'), 2);
    break;
  case 'release':
    code = args.length >= 2 ? release(args[0], args[1]) : (console.error('用法: node lock.mjs release <path> <sessionId>'), 2);
    break;
  case 'force-release':
    code = args[0] ? forceRelease(args[0]) : (console.error('用法: node lock.mjs force-release <path>'), 2);
    break;
  default:
    console.error('未知命令: ' + (cmd ?? '(空)'));
    console.error('用法: node lock.mjs <list|check|acquire|release|force-release> [...]');
    code = 2;
}
process.exit(code);
