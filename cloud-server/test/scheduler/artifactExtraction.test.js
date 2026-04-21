import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { EnhancedScheduler } from '../../src/scheduler/enhancedScheduler.js'

describe('artifact path extraction', () => {
  it('does not split a dotfile absolute path into an extra non-dot filename artifact', () => {
    const scheduler = new EnhancedScheduler()
    const candidates = scheduler.extractArtifactPathCandidates(
      '请检查 /Users/linhao/Downloads/444/.omc_context_scan.md 是否生成',
      ['/Users/linhao/Downloads/444']
    )

    const absolutePaths = candidates.map(item => item.absolutePath)

    assert.deepEqual(absolutePaths, [
      '/Users/linhao/Downloads/444/.omc_context_scan.md'
    ])
  })

  it('still extracts standalone filenames including dotfiles', () => {
    const scheduler = new EnhancedScheduler()
    const candidates = scheduler.extractArtifactPathCandidates(
      '交付物包括 .omc_context_scan.md 和 hot_stocks_20260421.json',
      ['/Users/linhao/Downloads/444']
    )

    const absolutePaths = candidates.map(item => item.absolutePath).sort()

    assert.deepEqual(absolutePaths, [
      '/Users/linhao/Downloads/444/.omc_context_scan.md',
      '/Users/linhao/Downloads/444/hot_stocks_20260421.json'
    ])
  })
})
