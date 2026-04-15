/**
 * Scheduler Pickup Verification Tests
 *
 * Verifies the scheduler correctly detects and picks up new tasks.
 *
 * Test environment is prepared by setupTestEnv.js which:
 * 1. Backs up production scheduler.json
 * 2. Loads clean base data (no residual tasks)
 * 3. Configures isolated workspace root
 * 4. Installs mock agent fixtures
 *
 * Run:
 *   node --test test/scheduler/scheduler.test.js
 *   # or with isolation:
 *   node cleanupTestState.js && node --test test/scheduler/scheduler.test.js
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import {
  setupTestEnv,
  teardownTestEnv,
  resetTestState,
  registerDb,
  createTestTask,
  seedBacklogTask,
  TASK_STATUSES
} from './setupTestEnv.js'

// ---------------------------------------------------------------------------
// Shared module references (loaded once, avoid re-import to prevent singleton reset)
// ---------------------------------------------------------------------------

let env = null
let db = null
let EnhancedScheduler = null

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

before(async () => {
  env = await setupTestEnv({ cleanWorkspace: true, seedTasks: false })
  // Load db and scheduler once — re-importing db resets the singleton
  const dbModule = await import('../../src/db.js')
  db = dbModule.default
  registerDb(db) // register so resetTestState() can reset without re-import
  const schedulerModule = await import('../../src/scheduler/enhancedScheduler.js')
  EnhancedScheduler = schedulerModule.EnhancedScheduler
})

after(async () => {
  await teardownTestEnv()
})

// ---------------------------------------------------------------------------
// Helper: fresh scheduler per test (to avoid singleton state leaking)
// ---------------------------------------------------------------------------

function freshScheduler(pollInterval = 999999, maxConcurrentAgents = 3) {
  return new EnhancedScheduler({ pollInterval, maxConcurrentAgents })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scheduler: Task Pickup Verification', () => {

  it('setup: test environment is accessible', () => {
    assert.ok(env, 'Test environment should be set up')
    assert.ok(env.testDataFile, 'Test data file path should be set')
    assert.ok(env.testWorkspaceRoot, 'Test workspace root should be set')
    assert.ok(db, 'db singleton should be loaded')
    assert.ok(EnhancedScheduler, 'EnhancedScheduler should be loaded')
  })

  it('db: starts empty after clean setup', () => {
    const board = db.getBoard()
    const totalTasks = Object.values(board).reduce((sum, t) => sum + t.length, 0)
    assert.strictEqual(totalTasks, 0, 'Board should be empty after clean setup')
  })

  it('findClaimableTasks: returns Backlog task as analysisTask', async () => {
    await resetTestState() // clears tasks in db singleton without re-importing
    await seedBacklogTask(db)
    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.ok(Array.isArray(result.analysisTasks))
    assert.ok(Array.isArray(result.executionTasks))
    assert.ok(Array.isArray(result.verificationTasks))
    assert.strictEqual(result.analysisTasks.length, 1, 'Should find 1 analysis task from Backlog')
    assert.strictEqual(result.executionTasks.length, 0, 'Should have no execution tasks')
    assert.strictEqual(result.verificationTasks.length, 0, 'Should have no verification tasks')
  })

  it('findClaimableTasks: ReadyForTest task becomes verificationTask', async () => {
    await resetTestState()
    await createTestTask({
      db,
      title: 'Completed implementation',
      description: 'Implementation done, needs QA',
      status: TASK_STATUSES.READY_FOR_TEST
    })

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.verificationTasks.length, 1, 'Should find 1 verification task')
    assert.strictEqual(result.analysisTasks.length, 0, 'Should have no analysis tasks')
    assert.strictEqual(result.executionTasks.length, 0, 'Should have no execution tasks')
  })

  it('findClaimableTasks: InDev task becomes executionTask', async () => {
    await resetTestState()
    await createTestTask({
      db,
      title: 'In-progress work',
      description: 'Started but not done',
      status: TASK_STATUSES.IN_DEV
    })

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.executionTasks.length, 1, 'Should find 1 execution task')
    assert.strictEqual(result.analysisTasks.length, 0, 'Should have no analysis tasks')
  })

  it('findClaimableTasks: InFix task becomes executionTask', async () => {
    await resetTestState()
    await createTestTask({
      db,
      title: 'Bug fix in progress',
      description: 'Fixing reported bug',
      status: TASK_STATUSES.IN_FIX
    })

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.executionTasks.length, 1, 'InFix task should be in execution queue')
    assert.strictEqual(result.executionTasks[0].status, 'InFix', 'Status should be preserved')
  })

  it('findClaimableTasks: skipped if assignedAgentId is set', async () => {
    await resetTestState()
    const agent = db.createAgent({ name: 'Test Dev', role: 'developer' })
    const task = await createTestTask({
      db,
      title: 'Already claimed',
      description: 'Assigned to an agent',
      status: TASK_STATUSES.IN_DEV
    })
    db.claimTask(task.id, agent.id)
    db.save()

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.executionTasks.length, 0, 'Claimed task should not be in queue')
  })

  it('findClaimableTasks: skipped if task has subTasks (parent task)', async () => {
    await resetTestState()
    const parent = await createTestTask({
      db,
      title: 'Parent with subtasks',
      description: 'Has subtasks, should not be directly scheduled',
      status: TASK_STATUSES.IN_DEV
    })
    db.createSubTask(parent.id, 'Subtask 1', 'Do part 1')

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.executionTasks.length, 0, 'Parent with subtasks should not be in queue')
  })

  it('findClaimableTasks: InFix task skipped if loopCount >= 3', async () => {
    await resetTestState()
    const task = await createTestTask({
      db,
      title: 'Stuck in fix loop',
      status: TASK_STATUSES.IN_FIX
    })
    task.loopCount = 3
    db.save()

    const scheduler = freshScheduler()
    const result = scheduler.findClaimableTasks()

    assert.strictEqual(result.executionTasks.length, 0, 'Task at max loop count should be skipped')
  })

  it('priority: InFix > ReadyForTest > ReadyForDeploy > InDev > Backlog', async () => {
    await resetTestState()

    // Create actual db tasks (have createdAt for age calculation)
    const t1 = await createTestTask({ db, title: 'T1 Backlog',         status: TASK_STATUSES.BACKLOG })
    const t2 = await createTestTask({ db, title: 'T2 InDev',           status: TASK_STATUSES.IN_DEV })
    const t3 = await createTestTask({ db, title: 'T3 ReadyForTest',     status: TASK_STATUSES.READY_FOR_TEST })
    const t4 = await createTestTask({ db, title: 'T4 InFix',            status: TASK_STATUSES.IN_FIX })
    const t5 = await createTestTask({ db, title: 'T5 ReadyForDeploy',   status: TASK_STATUSES.READY_FOR_DEPLOY })

    const scheduler = freshScheduler()

    // Use actual db task objects (they have createdAt set by db.createTask)
    const getPriority = (task) => scheduler.getTaskPriority(task)
    assert.ok(getPriority(t4) > getPriority(t3), 'InFix > ReadyForTest')
    assert.ok(getPriority(t3) > getPriority(t5), 'ReadyForTest > ReadyForDeploy')
    assert.ok(getPriority(t5) > getPriority(t2), 'ReadyForDeploy > InDev')
    assert.ok(getPriority(t2) > getPriority(t1), 'InDev > Backlog')
  })

  it('canAcceptTask: respects maxConcurrentAgents limit', async () => {
    const scheduler = freshScheduler(999999, 2)

    assert.strictEqual(scheduler.canAcceptTask(), true, 'Should accept at start')
    assert.strictEqual(scheduler.getActiveCount(), 0, 'Should have 0 active tasks')

    // Simulate full capacity by populating activeTasks
    scheduler.activeTasks.set('fake-task-1', { id: 'fake-task-1' })
    scheduler.activeTasks.set('fake-task-2', { id: 'fake-task-2' })

    assert.strictEqual(scheduler.canAcceptTask(), false, 'Should reject at max capacity')
    assert.strictEqual(scheduler.getActiveCount(), 2, 'Should show 2 active tasks')
  })

  it('cleanupOrphanedTasks: clears assignedAgentId for stale tasks', async () => {
    await resetTestState()
    const agent = db.createAgent({ name: 'Orphan Agent', role: 'developer' })
    const task = await createTestTask({
      db,
      title: 'Orphan task',
      status: TASK_STATUSES.IN_DEV
    })
    // Simulate task assigned to agent but not tracked by scheduler
    db.claimTask(task.id, agent.id)
    db.save()

    const scheduler = freshScheduler()
    // Scheduler has no active tasks, but task is assigned in db
    scheduler.cleanupOrphanedTasks()

    const updatedTask = db.getTaskById(task.id)
    assert.strictEqual(updatedTask.assignedAgentId, null, 'Orphan task should be released')
  })

  it('test isolation: residual state from one test does not leak to next', async () => {
    await resetTestState()
    const board = db.getBoard()
    const totalTasks = Object.values(board).reduce((sum, t) => sum + t.length, 0)
    assert.strictEqual(totalTasks, 0, 'Board should be clean before each test')
  })
})

// ---------------------------------------------------------------------------
// Run instructions (printed at end)
// ---------------------------------------------------------------------------

console.log(`
========================================
  Scheduler Test Environment — Ready
========================================

Files created:
  fixtures/scheduler.base.json   — Clean base data template
  fixtures/agents/*.md           — Mock agent definitions
  setupTestEnv.js               — Test environment setup module
  cleanupTestState.js            — Standalone cleanup / restore script

Usage in test files:
  import { setupTestEnv, teardownTestEnv, createTestTask } from './setupTestEnv.js'

  before(async () => { await setupTestEnv() })
  after(async () => { await teardownTestEnv() })

Standalone commands:
  node cleanupTestState.js         # Full reset + backup
  node cleanupTestState.js --check  # Inspect current state
  node cleanupTestState.js --restore # Restore from backup
`)
