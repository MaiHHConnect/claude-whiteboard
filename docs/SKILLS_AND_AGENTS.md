# Skills And Agents

## Included Skills

仓库内 `skills/` 包含项目可直接加载的 Skill 示例：

- `task-manager`
- `multi-agent`
- `hello-world`
- `skill-creator`
- `code-reviewer`
- `沉淀/minimal-dependency-tool-selection`

这些文件用于演示 Skill 管理器的目录结构、触发词、说明文本和自动沉淀格式。

## Included Claude Agents

`agents/claude/` 包含项目运行时常用的 Claude Code agent 角色模板，例如：

- `planner`
- `executor`
- `qa-tester`
- `architect`
- `designer`
- `security-reviewer`
- `test-engineer`
- `document-specialist`

本项目运行时代码默认从 `~/.claude/agents` 读取 Claude Code agents。若要复用本仓库模板，可以执行：

```bash
mkdir -p ~/.claude/agents
cp agents/claude/*.md ~/.claude/agents/
```

## Self-Optimization

`.omc/skills/self-optimization/` 保留为自优化追踪结构入口。真实运行日志和 raw execution records 默认不提交，避免泄露本地路径、任务内容或密钥。
