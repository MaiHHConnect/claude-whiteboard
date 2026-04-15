import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'workspaces',
  'memory',
  'dist',
  'coverage',
  'playwright-report',
  '.nyc_output'
])

const patterns = [
  ['github classic token', /ghp_[A-Za-z0-9_]{20,}/g],
  ['github fine-grained token', /github_pat_[A-Za-z0-9_]{20,}/g],
  ['openai-like key', /sk-[A-Za-z0-9_-]{20,}/g],
  ['bearer token', /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['url access token', /access_token=(?!xxx|example|\*{3,})[A-Za-z0-9._-]{16,}/gi],
  [
    'sensitive env value',
    /\b[A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD|WEBHOOK)[A-Z0-9_]*\s*=\s*(?!["']?(xxx|SECxxx|dingxxx|example|your_|YOUR_|<|\*{3,}|$))["']?[A-Za-z0-9._:/?&=+-]{16,}/g
  ]
]

function isLikelyText(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov', '.zip', '.gz', '.tgz'].includes(ext)) {
    return false
  }
  return true
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, files)
    } else if (stat.isFile() && isLikelyText(fullPath)) {
      files.push(fullPath)
    }
  }
  return files
}

function mask(line) {
  return line
    .replace(/ghp_[A-Za-z0-9_]{8,}/g, 'ghp_******')
    .replace(/github_pat_[A-Za-z0-9_]{8,}/g, 'github_pat_******')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-******')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer ******')
    .replace(/([:=]\s*["']?)[^"'\s#]{8,}/g, '$1******')
}

const findings = []

for (const file of walk(root)) {
  const rel = path.relative(root, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)

  lines.forEach((line, index) => {
    for (const [name, pattern] of patterns) {
      if (name === 'sensitive env value' && /xxx|SECxxx|dingxxx|example|YOUR_|your_|\*{3,}|process\.env|streamConfig\./i.test(line)) {
        continue
      }
      pattern.lastIndex = 0
      if (pattern.test(line)) {
        findings.push({
          file: rel,
          line: index + 1,
          type: name,
          snippet: mask(line.trim()).slice(0, 240)
        })
      }
    }
  })
}

if (findings.length > 0) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, scannedRoot: root }, null, 2))
