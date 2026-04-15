/**
 * 数据访问层
 *
 * 封装数据库操作，提供统一的数据访问接口
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import os from 'os'
import { broadcast } from './wsBroadcast.js'
import { fileURLToPath } from 'url'

// 使用绝对路径，基于当前模块位置
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'scheduler.json')

// Claude Code agents 配置目录
const CLAUDE_AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents')

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// 生成 ID
export function genId() {
  return uuidv4()
}

function broadcastTaskUpdated(taskId, extra = {}) {
  if (!taskId) return
  broadcast({ type: 'task_updated', taskId, ...extra })
}

function broadcastAgentUpdated(agentId, extra = {}) {
  if (!agentId) return
  broadcast({ type: 'agent_updated', agentId, ...extra })
}

function normalizeTaskText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .trim()
}

function extractTaskSection(text, sectionName) {
  const content = String(text || '')
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = content.match(new RegExp(`【${escapedName}】\\s*([\\s\\S]*?)(?=\\n【[^】]+】|$)`))
  return match ? normalizeTaskText(match[1]) : ''
}

function extractOriginalTaskRequirement(task) {
  const explicitOriginal = normalizeTaskText(task?.originalDescription)
  if (explicitOriginal) return explicitOriginal

  const description = normalizeTaskText(task?.description)
  if (!description) return ''

  const sectionOriginal = extractTaskSection(description, '原始任务要求')
  if (sectionOriginal) return sectionOriginal

  const beforeParentContext = description.split('【父任务背景】')[0]
  const withoutQaContext = beforeParentContext.replace(/^【QA 验证失败】[\s\S]*$/, '').trim()

  return normalizeTaskText(withoutQaContext || beforeParentContext)
}

function buildRetryDescription(task, parent, bugReport) {
  const originalRequirement = extractOriginalTaskRequirement(task) || normalizeTaskText(task?.title)
  const sections = [
    '【QA 验证失败】',
    normalizeTaskText(bugReport) || '请根据验证反馈修复后重试。'
  ]

  if (parent) {
    sections.push(
      '',
      '【父任务背景】',
      `标题: ${parent.title}`
    )

    if (parent.decompositionNote) {
      sections.push(`分解说明: ${parent.decompositionNote}`)
    }
  }

  sections.push(
    '',
    '【原始任务要求】',
    originalRequirement
  )

  return sections.join('\n')
}

/**
 * 从 Claude Code agents 目录读取 agents
 */
export function loadClaudeCodeAgents() {
  const agents = []

  if (!existsSync(CLAUDE_AGENTS_DIR)) {
    console.log('[DB] Claude Code agents directory not found:', CLAUDE_AGENTS_DIR)
    return agents
  }

  try {
    const files = readdirSync(CLAUDE_AGENTS_DIR).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const agentName = file.replace('.md', '')
      const filePath = path.join(CLAUDE_AGENTS_DIR, file)
      const content = readFileSync(filePath, 'utf-8')

      // 解析 frontmatter
      let description = agentName
      let level = 2

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1]
        const descMatch = frontmatter.match(/description:\s*"?([^"\n]+)"?/)
        const levelMatch = frontmatter.match(/level:\s*(\d+)/)

        if (descMatch) description = descMatch[1].trim()
        if (levelMatch) level = parseInt(levelMatch[1])
      }

      agents.push({
        id: uuidv4(),
        name: agentName,
        role: agentName, // Claude Code agent 直接用名字作为 role
        capabilities: [],
        status: 'online',
        currentTaskId: null,
        lastHeartbeat: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        description: description,
        level: level
      })

      console.log(`[DB] Loaded Claude Code agent: ${agentName}`)
    }

    console.log(`[DB] Total Claude Code agents loaded: ${agents.length}`)
  } catch (e) {
    console.error('[DB] Error loading Claude Code agents:', e.message)
  }

  return agents
}

// 加载或初始化数据
function loadData() {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    } catch (e) {
      console.error('[DB] Failed to load data, starting fresh')
    }
  }
  return {
    agents: [],
    tasks: [],
    taskHistory: [],
    taskLogs: [],
    taskTagCounter: 0,  // 主任务标签计数器
    wikis: [],           // Wiki 文档存储
    schedulerConfig: {    // 调度器配置
      maxConcurrentAgents: 5
    }
  }
}

// 保存数据
function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// 内存中的数据
const db = {
  _data: loadData(),

  // 保存数据
  save() {
    saveData(this._data)
  },

  // 迁移旧任务数据（分配 taskTag）
  migrateTaskTags() {
    if (!this._data.tasks || this._data.tasks.length === 0) return

    let maxTag = this._data.taskTagCounter || 0
    let migrated = 0

    for (const task of this._data.tasks) {
      if (task.taskTag === undefined || task.taskTag === null) {
        // 顶级任务分配新标签
        if (!task.parentTaskId) {
          maxTag++
          task.taskTag = maxTag
          migrated++
        } else {
          // 子任务需要找父任务获取标签
          const parent = this._data.tasks.find(t => t.id === task.parentTaskId)
          if (parent && parent.taskTag) {
            task.taskTag = parent.taskTag
          } else {
            // 父任务也没有标签，先分配一个
            maxTag++
            parent.taskTag = maxTag
            task.taskTag = maxTag
            migrated++
          }
        }
      }
    }

    if (migrated > 0) {
      this._data.taskTagCounter = maxTag
      this.save()
      console.log(`[DB] Migrated ${migrated} tasks with new tags (max tag: ${maxTag})`)
    }
  },

  // ============ Agents ============

  // Claude Code agents 缓存（只加载一次）
  _claudeCodeAgents: null,

  getAgents() {
    // 只在第一次加载时读取 Claude Code agents
    // 之后使用缓存
    if (!this._claudeCodeAgents) {
      this._claudeCodeAgents = loadClaudeCodeAgents()
    }
    return this._claudeCodeAgents
  },

  getAgentById(id) {
    // 先从 Claude Code agents 缓存中查找
    if (this._claudeCodeAgents) {
      const found = this._claudeCodeAgents.find(a => a.id === id)
      if (found) return found
    }
    // 再从 data.agents 中查找（兼容旧数据）
    return this._data.agents.find(a => a.id === id)
  },

  getOnlineAgents() {
    return this._data.agents.filter(a => a.status !== 'offline')
  },

  createAgent(agent) {
    const newAgent = {
      id: genId(),
      name: agent.name,
      role: agent.role,
      capabilities: agent.capabilities || [],
      status: 'idle',
      currentTaskId: null,
      lastHeartbeat: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
    this._data.agents.push(newAgent)
    this.save()
    return newAgent
  },

  updateAgentHeartbeat(id) {
    const agent = this.getAgentById(id)
    if (agent) {
      agent.lastHeartbeat = new Date().toISOString()
      agent.status = 'idle'
      this.save()
    }
    return agent
  },

  // 释放 Agent（任务完成后调用）
  releaseAgent(agentId, taskId = null) {
    const agent = this.getAgentById(agentId)
    if (agent) {
      agent.currentTaskId = null
      agent.status = 'idle'
      this.save()
      console.log(`[DB] Released agent ${agent.name}`)
      broadcastAgentUpdated(agentId)
    }
    // 清除任务的 assignedAgentId（如果有）
    if (taskId) {
      const task = this.getTaskById(taskId)
      if (task) {
        task.assignedAgentId = null
        this.save()
        console.log(`[DB] Cleared assignedAgentId for task ${taskId}`)
        broadcastTaskUpdated(taskId)
      }
    }
    return !!agent
  },

  // ============ Tasks ============

  getTasks(filters = {}) {
    let tasks = [...this._data.tasks]

    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status)
    }

    if (filters.agentId) {
      tasks = tasks.filter(t => t.assignedAgentId === filters.agentId)
    }

    return tasks
  },

  getTaskById(id) {
    return this._data.tasks.find(t => t.id === id)
  },

  deleteTask(id) {
    const index = this._data.tasks.findIndex(t => t.id === id)
    if (index === -1) return false
    this._data.tasks.splice(index, 1)
    this.save()
    broadcastTaskUpdated(id, { deleted: true })
    return true
  },

  getBoard() {
    const statuses = ['Backlog', 'Analyzing', 'Collecting', 'InDev', 'ReadyForTest', 'InFix', 'Blocked', 'ReadyForDeploy', 'Done']
    const board = {}

    for (const status of statuses) {
      board[status] = this._data.tasks
        .filter(t => t.status === status)
        .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
    }

    return board
  },

  createTask(task) {
    // 主任务分配新标签，子任务继承父任务标签
    let taskTag = null
    if (task.parentTaskId) {
      // 子任务继承父任务标签
      const parent = this.getTaskById(task.parentTaskId)
      if (parent) {
        taskTag = parent.taskTag
      }
    } else {
      // 主任务分配新标签
      this._data.taskTagCounter++
      taskTag = this._data.taskTagCounter
    }

    const newTask = {
      id: genId(),
      title: task.title,
      description: task.description || '',
      originalDescription: task.description || '',
      status: task.status || 'Backlog',
      assignedAgentId: null,
      skills: task.skills || [],
      loopCount: 0,
      bugReport: null,
      attachments: {},
      acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
      verificationPlan: Array.isArray(task.verificationPlan) ? task.verificationPlan : [],
      qaRubric: task.qaRubric || null,
      handoffArtifacts: Array.isArray(task.handoffArtifacts) ? task.handoffArtifacts : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 父子任务关联
      parentTaskId: task.parentTaskId || null,
      taskTag: taskTag,  // 任务标签序号
      subTaskIds: [],
      decompositionNote: '',
      // 终端风格信息流
      currentOutput: '',      // 当前输出（卡片上显示的实时内容）
      outputLines: [],        // 输出行历史（完整信息流）
      messages: []            // 用户/系统消息（任务对话）
    }
    this._data.tasks.push(newTask)
    this.save()
    broadcastTaskUpdated(newTask.id)
    return newTask
  },

  // 创建子任务
  createSubTask(parentTaskId, title, description, meta = {}) {
    const parent = this.getTaskById(parentTaskId)
    if (!parent) return null

    const subTask = this.createTask({
      title,
      description,
      status: 'Backlog',
      parentTaskId
    })

    subTask.sequenceIndex = Number.isInteger(meta.sequenceIndex) ? meta.sequenceIndex : parent.subTaskIds.length
    subTask.dependsOnSubTaskIds = Array.isArray(meta.dependsOnSubTaskIds) ? meta.dependsOnSubTaskIds : []
    subTask.dependencyRefs = Array.isArray(meta.dependencyRefs) ? meta.dependencyRefs : []
    subTask.parallelGroup = meta.parallelGroup || null
    subTask.canRunInParallel = meta.canRunInParallel !== false
    subTask.acceptanceCriteria = Array.isArray(meta.acceptanceCriteria) ? meta.acceptanceCriteria : []
    subTask.verificationPlan = Array.isArray(meta.verificationPlan) ? meta.verificationPlan : []
    subTask.qaRubric = meta.qaRubric || null
    subTask.handoffArtifacts = Array.isArray(meta.handoffArtifacts) ? meta.handoffArtifacts : []

    // 更新父任务的 subTaskIds
    parent.subTaskIds.push(subTask.id)
    parent.updatedAt = new Date().toISOString()
    this.save()

    return subTask
  },

  // 获取子任务列表
  getSubTasks(parentTaskId) {
    const parent = this.getTaskById(parentTaskId)
    if (!parent || !parent.subTaskIds) return []
    return parent.subTaskIds
      .map(id => this.getTaskById(id))
      .filter(t => t !== undefined)
  },

  // 检查并更新父任务状态（当子任务完成时调用）
  checkAndUpdateParentCompletion(subTaskId) {
    const subTask = this.getTaskById(subTaskId)
    if (!subTask || !subTask.parentTaskId) return

    const parent = this.getTaskById(subTask.parentTaskId)
    if (!parent) return

    // 检查所有子任务是否都已完成（Done 状态）
    const subTasks = this.getSubTasks(parent.id)
    const allDone = subTasks.every(t => t.status === 'Done')

    if (allDone && subTasks.length > 0) {
      // 汇总所有子任务的输出到父任务
      const allOutputs = []
      for (const st of subTasks) {
        if (st.outputLines && st.outputLines.length > 0) {
          allOutputs.push(...st.outputLines.slice(-5)) // 只取最后5条
        }
      }
      if (allOutputs.length > 0) {
        parent.outputLines = [...(parent.outputLines || []), ...allOutputs]
        if (parent.outputLines.length > 50) {
          parent.outputLines = parent.outputLines.slice(-50)
        }
      }

      this.updateTaskStatus(parent.id, 'ReadyForTest')
      console.log(`[DB] Parent task ${parent.id} all subtasks done, moving to ReadyForTest`)
    }
  },

  updateTaskStatus(id, status, operatorId) {
    const task = this.getTaskById(id)
    if (!task) return null

    const fromStatus = task.status
    task.status = status
    task.updatedAt = new Date().toISOString()
    if (status !== 'Backlog') {
      delete task.retryAfter
      delete task.transientError
    }

    const resolvedStatuses = new Set(['ReadyForTest', 'ReadyForDeploy', 'Done'])
    if (resolvedStatuses.has(status)) {
      task.bugReport = null
      task.blockedReason = null
    }

    const activeStatuses = new Set(['Analyzing', 'InDev'])
    if (!activeStatuses.has(status) && task.assignedAgentId) {
      const assignedAgent = this.getAgentById(task.assignedAgentId)
      if (assignedAgent && assignedAgent.currentTaskId === id) {
        assignedAgent.currentTaskId = null
        assignedAgent.status = 'idle'
        assignedAgent.lastHeartbeat = new Date().toISOString()
        broadcastAgentUpdated(assignedAgent.id)
      }
      task.assignedAgentId = null
    }

    // 记录历史
    this._data.taskHistory.push({
      id: genId(),
      taskId: id,
      fromStatus,
      toStatus: status,
      operatorId: operatorId || null,
      createdAt: new Date().toISOString()
    })

    this.save()
    broadcastTaskUpdated(id, { status })

    if (status === 'Done' && task.parentTaskId) {
      this.checkAndUpdateParentCompletion(id)
    }

    return { task, fromStatus }
  },

  claimTask(taskId, agentId) {
    const task = this.getTaskById(taskId)
    if (!task || task.assignedAgentId) return null

    const agent = this.getAgentById(agentId)
    if (!agent) return null

    task.assignedAgentId = agentId
    task.status = 'InDev'
    task.updatedAt = new Date().toISOString()
    delete task.retryAfter
    delete task.transientError

    agent.currentTaskId = taskId
    agent.status = 'busy'

    this.save()
    broadcastTaskUpdated(taskId, { status: task.status })
    broadcastAgentUpdated(agentId)
    return { task, agent }
  },

  reportBug(taskId, bugReport) {
    const task = this.getTaskById(taskId)
    if (!task) return null

    const normalizedBugReport = normalizeTaskText(bugReport)
    if (!task.originalDescription) {
      task.originalDescription = extractOriginalTaskRequirement(task)
    }

    task.bugReport = normalizedBugReport
    task.updatedAt = new Date().toISOString()

    // 如果是子任务，在描述中追加父任务上下文，帮助后续 agent 理解完整背景
    if (task.parentTaskId) {
      const parent = this.getTaskById(task.parentTaskId)
      if (parent) {
        task.description = buildRetryDescription(task, parent, normalizedBugReport)
      }
    } else {
      task.description = buildRetryDescription(task, null, normalizedBugReport)
    }

    // 检测是否是不可解决的阻塞（如信息不全、无输出等）
    const blockingKeywords = ['无输出', '无实质性输出', '信息不全', '缺少关键信息', '无法执行', '缺少必要参数']
    const isBlocked = blockingKeywords.some(k => normalizedBugReport.includes(k))

    // 任务状态：阻塞任务进入 Blocked 状态，正常验证失败进入 InFix
    task.status = isBlocked ? 'Blocked' : 'InFix'
    // 清除 assignedAgentId，让任务可以被重新认领
    task.assignedAgentId = null
    // 阻塞任务不增加 loopCount（因为重试也没用）
    if (!isBlocked) {
      task.loopCount++
    }
    task.blockedReason = isBlocked ? normalizedBugReport : null

    // 记录历史
    this._data.taskHistory.push({
      id: genId(),
      taskId,
      fromStatus: 'InDev',
      toStatus: task.status,
      operatorId: null,
      note: normalizedBugReport,
      createdAt: new Date().toISOString()
    })

    this.save()
    broadcastTaskUpdated(taskId, { status: task.status })
    return { task, blocked: isBlocked, loopCount: task.loopCount }
  },

  // ============ Task Logs ============

  getTaskHistory(taskId) {
    return this._data.taskHistory
      .filter(h => h.taskId === taskId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  },

  getTaskLogs(taskId) {
    return this._data.taskLogs
      .filter(l => l.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  addTaskLog(taskId, log) {
    const newLog = {
      id: genId(),
      taskId,
      agentId: log.agentId || null,
      action: log.action,
      message: log.message || null,
      createdAt: new Date().toISOString()
    }
    this._data.taskLogs.push(newLog)
    this.save()
    broadcastTaskUpdated(taskId)
    return newLog
  },

  getTaskMessages(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return []
    if (!Array.isArray(task.messages)) {
      task.messages = []
    }
    return [...task.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  },

  addTaskMessage(taskId, message) {
    const task = this.getTaskById(taskId)
    if (!task) return null

    const content = String(message.content || '').trim()
    if (!content) return null

    if (!Array.isArray(task.messages)) {
      task.messages = []
    }

    const newMessage = {
      id: genId(),
      role: message.role || 'system',
      kind: message.kind || message.role || 'system',
      content,
      createdAt: new Date().toISOString(),
      meta: message.meta || {}
    }

    task.messages.push(newMessage)
    if (task.messages.length > 50) {
      task.messages = task.messages.slice(-50)
    }
    task.updatedAt = new Date().toISOString()
    this.save()

    broadcast({
      type: 'task_message',
      taskId,
      message: newMessage
    })
    broadcastTaskUpdated(taskId)

    return newMessage
  },

  emitTaskRefresh(taskId, extra = {}) {
    const task = this.getTaskById(taskId)
    if (!task) return false
    task.updatedAt = new Date().toISOString()
    this.save()
    broadcastTaskUpdated(taskId, extra)
    return true
  },

  // 追加任务输出行（跳过空行）
  appendTaskOutput(taskId, line) {
    const task = this.getTaskById(taskId)
    if (!task) return null

    // 跳过空行（不存储、不广播）
    if (line === undefined || line === null || line.trim() === '') {
      return null
    }

    const outputLine = {
      id: genId(),
      content: line,
      timestamp: new Date().toISOString()
    }

    task.outputLines.push(outputLine)
    // 保留最近50行
    if (task.outputLines.length > 50) {
      task.outputLines = task.outputLines.slice(-50)
    }
    task.currentOutput = line // 最新一行作为卡片显示
    task.updatedAt = new Date().toISOString()
    this.save()

    // 广播到所有 WebSocket 客户端（实时推送终端输出）
    broadcast({
      type: 'task_output',
      taskId,
      line: line,
      outputLine,
      currentOutput: task.currentOutput
    })

    return outputLine
  },

  // 清除任务输出
  clearTaskOutput(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return false
    task.outputLines = []
    task.currentOutput = ''
    this.save()

    // 广播清除事件到所有 WebSocket 客户端
    broadcast({ type: 'task_output_cleared', taskId })
    return true
  },

  // ============ Stats ============

  getStats() {
    const totalTasks = this._data.tasks.length
    // 调用 getAgents() 确保 Claude Code agents 已加载
    const allAgents = this.getAgents()
    const totalAgents = allAgents.length
    const onlineAgents = allAgents.filter(a => a.status !== 'offline').length

    const byStatus = {}
    for (const task of this._data.tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1
    }

    return { totalTasks, totalAgents, onlineAgents, byStatus }
  },

  // ============ Wiki ============

  // 创建 Wiki
  createWiki(wiki) {
    if (!this._data.wikis) {
      this._data.wikis = []
    }
    const newWiki = {
      id: genId(),
      title: wiki.title || '',
      content: wiki.content || '',
      keywords: wiki.keywords || [],
      taskTag: wiki.taskTag || null,
      parentTaskId: wiki.parentTaskId || null,
      subTaskIds: wiki.subTaskIds || [],
      sourceSummary: wiki.sourceSummary || null,
      artifactPaths: wiki.artifactPaths || [],
      generatedFromTaskIds: wiki.generatedFromTaskIds || [],
      requirementHighlights: wiki.requirementHighlights || [],
      decisionHighlights: wiki.decisionHighlights || [],
      issueHighlights: wiki.issueHighlights || [],
      verificationHighlights: wiki.verificationHighlights || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this._data.wikis.push(newWiki)
    this.save()
    console.log(`[DB] Created wiki: ${newWiki.title} (id: ${newWiki.id})`)
    return newWiki
  },

  // 获取所有 Wiki
  getWikis() {
    if (!this._data.wikis) {
      this._data.wikis = []
    }
    return this._data.wikis
  },

  // 根据 ID 获取 Wiki
  getWikiById(id) {
    return this._data.wikis.find(w => w.id === id)
  },

  // 根据 taskTag 获取 Wiki
  getWikiByTaskTag(taskTag) {
    return this._data.wikis.find(w => w.taskTag === taskTag)
  },

  // 获取 Wiki 数量
  getWikiCount() {
    return (this._data.wikis || []).length
  },

  // ============ Skill 沉淀统计 ============

  // 获取沉淀的 Skill 数量（通过统计 skills/沉淀/ 目录下的文件）
  getSkillPrecipitatedCount() {
    try {
      const skillsDir = path.join(process.cwd(), 'skills', '沉淀')
      if (!existsSync(skillsDir)) {
        return 0
      }
      const files = readdirSync(skillsDir).filter(f => f.endsWith('.skill.md'))
      return files.length
    } catch (e) {
      console.error('[DB] Error counting precipitated skills:', e.message)
      return 0
    }
  },

  // ============ 调度器配置 ============

  // 获取调度器配置
  getSchedulerConfig() {
    return this._data.schedulerConfig || { maxConcurrentAgents: 5 }
  },

  // 更新调度器配置
  updateSchedulerConfig(config) {
    if (!this._data.schedulerConfig) {
      this._data.schedulerConfig = {}
    }
    if (config.maxConcurrentAgents !== undefined) {
      this._data.schedulerConfig.maxConcurrentAgents = config.maxConcurrentAgents
    }
    this.save()
    return this._data.schedulerConfig
  }
}

// 首次加载时迁移旧任务数据
db.migrateTaskTags()

export default db
