/**
 * 自动驾驶模式 (Autopilot)
 *
 * 自动执行任务直到完成
 */

import { EventEmitter } from 'events'

/**
 * 自动驾驶模式状态
 */
export const AutoPilotState = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * 自动驾驶任务
 */
export class AutoPilotTask extends EventEmitter {
  constructor(taskId, description, options = {}) {
    super()
    this.taskId = taskId
    this.description = description
    this.maxIterations = options.maxIterations || 50
    this.verifyEachStep = options.verifyEachStep || false
    this.pauseOnError = options.pauseOnError || false
    this.iteration = 0
    this.state = AutoPilotState.IDLE
    this.steps = []
    this.result = null
    this.error = null
  }

  /**
   * 开始执行
   */
  async start(agent) {
    this.state = AutoPilotState.RUNNING
    this.emit('start', this)

    try {
      while (this.iteration < this.maxIterations && this.state === AutoPilotState.RUNNING) {
        this.iteration++
        this.emit('iteration', { iteration: this.iteration, max: this.maxIterations })

        // 执行一步
        const stepResult = await this.executeStep(agent)

        if (stepResult.done) {
          this.result = stepResult.result
          this.state = AutoPilotState.COMPLETED
          this.emit('complete', this.result)
          break
        }

        if (stepResult.error) {
          this.error = stepResult.error
          if (this.pauseOnError) {
            this.state = AutoPilotState.PAUSED
            this.emit('error', this.error)
          } else {
            this.state = AutoPilotState.FAILED
            this.emit('failed', this.error)
          }
          break
        }

        // 保存步骤
        this.steps.push({
          iteration: this.iteration,
          action: stepResult.action,
          result: stepResult.result
        })
      }

      if (this.iteration >= this.maxIterations && this.state === AutoPilotState.RUNNING) {
        this.state = AutoPilotState.COMPLETED
        this.emit('max-iterations', { iterations: this.iteration })
      }
    } catch (error) {
      this.error = error
      this.state = AutoPilotState.FAILED
      this.emit('failed', error)
    }

    return this
  }

  /**
   * 执行一步
   */
  async executeStep(agent) {
    // 通知 agent 执行下一步
    this.emit('step-start', { iteration: this.iteration })

    try {
      const result = await agent.execute(this.description, {
        iteration: this.iteration,
        steps: this.steps
      })

      if (result.done) {
        return { done: true, result: result.output }
      }

      if (result.error) {
        return { done: false, error: result.error }
      }

      return { done: false, result: result.output, action: result.action }
    } catch (error) {
      return { done: false, error: error.message }
    }
  }

  /**
   * 暂停
   */
  pause() {
    if (this.state === AutoPilotState.RUNNING) {
      this.state = AutoPilotState.PAUSED
      this.emit('pause')
    }
  }

  /**
   * 恢复
   */
  resume() {
    if (this.state === AutoPilotState.PAUSED) {
      this.state = AutoPilotState.RUNNING
      this.emit('resume')
    }
  }

  /**
   * 取消
   */
  cancel() {
    this.state = AutoPilotState.CANCELLED
    this.emit('cancel')
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      taskId: this.taskId,
      description: this.description,
      state: this.state,
      iteration: this.iteration,
      maxIterations: this.maxIterations,
      stepsCount: this.steps.length,
      result: this.result,
      error: this.error
    }
  }
}

/**
 * Ralph 模式 - 带验证的循环执行
 */
export class RalphTask extends AutoPilotTask {
  constructor(taskId, description, options = {}) {
    super(taskId, description, {
      ...options,
      maxIterations: options.maxIterations || 100,
      verifyEachStep: true
    })
    this.verifier = options.verifier || null
    this.verificationCount = 0
  }

  async executeStep(agent) {
    const stepResult = await super.executeStep(agent)

    if (stepResult.done && this.verifier) {
      // 验证结果
      this.verificationCount++
      const verified = await this.verifier.verify(stepResult.result, this.description)

      if (!verified) {
        return {
          done: false,
          error: `验证失败 (第 ${this.verificationCount} 次验证)`
        }
      }

      this.emit('verified', { iteration: this.iteration, result: stepResult.result })
    }

    return stepResult
  }
}

/**
 * Autopilot 管理器
 */
export class AutoPilotManager {
  constructor() {
    this.tasks = new Map()
    this.activeTask = null
  }

  /**
   * 创建并启动任务
   */
  createTask(description, options = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const task = new AutoPilotTask(taskId, description, options)
    this.tasks.set(taskId, task)
    this.activeTask = task
    return task
  }

  /**
   * 创建 Ralph 任务
   */
  createRalphTask(description, options = {}) {
    const taskId = `ralph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const task = new RalphTask(taskId, description, options)
    this.tasks.set(taskId, task)
    this.activeTask = task
    return task
  }

  /**
   * 获取任务
   */
  getTask(taskId) {
    return this.tasks.get(taskId)
  }

  /**
   * 获取当前活动任务
   */
  getActiveTask() {
    return this.activeTask
  }

  /**
   * 取消任务
   */
  cancelTask(taskId) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.cancel()
      return true
    }
    return false
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values()).map(t => t.getStatus())
  }

  /**
   * 获取状态摘要
   */
  getStatus() {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      active: tasks.filter(t => t.state === AutoPilotState.RUNNING).length,
      completed: tasks.filter(t => t.state === AutoPilotState.COMPLETED).length,
      failed: tasks.filter(t => t.state === AutoPilotState.FAILED).length,
      activeTask: this.activeTask?.getStatus() || null
    }
  }
}

// 导出单例
export const autoPilotManager = new AutoPilotManager()

export default autoPilotManager
