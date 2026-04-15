# Architecture Notes

TokenJuice 白板采用规划器、执行器、评估器三角色循环，目标是让长程 AI 编码更稳定，而不是让单个 agent 在一个巨大上下文里硬撑到底。

## Control Loop

1. Planner 接收用户需求，输出规格、子任务、依赖关系、验收标准和 QA Rubric。
2. Scheduler 根据任务状态、容量和依赖 DAG 领取任务。
3. Executor 在隔离 workspace 中实现任务，并输出真实产物、验证命令和交接摘要。
4. QA 使用独立提示进行怀疑式验证，失败则生成 bug report 并自动进入修复。
5. Wiki/Skill hooks 在任务完成后沉淀知识与可复用流程。

## Design Principles

- 不让同一个 agent 自己给自己打高分。
- 能并行的任务并行，依赖未满足的任务不抢跑。
- 临时模型错误要重试，不要污染任务 bug。
- 每个任务都要有可验证的完成定义。
- 产物、日志和知识要能跨会话传递。

## Important Runtime Directories

- `data/scheduler.json`: 本地运行数据，默认不提交。
- `workspaces/`: 每个任务的执行工作区，默认不提交。
- `skills/沉淀/`: 自动生成的 Skill，可筛选后提交。
- `agents/claude/`: 可复用 agent 角色模板。
