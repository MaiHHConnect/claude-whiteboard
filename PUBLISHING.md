# 白白板仓库管理与发布说明

本文档放在项目根目录，供后续维护者统一参考。

## 仓库地址

- GitHub: [MaiHHConnect/claude-whiteboard](https://github.com/MaiHHConnect/claude-whiteboard)
- 默认分支：`main`

## 发布原则

- 只发布说明文件、源码、测试、部署配置和程序运行必需的 Skill 文件。
- 不发布本机工作区、内部任务记录、知识沉淀、修复记录和临时文件。
- 发布前先检查 `.gitignore` 是否仍然覆盖这些内容。

## 当前不应发布的内容

- `project-knowledge/`
- `knowledge/`
- `workspaces/`
- `.claude/`
- `cloud-server/workspaces/`
- `cloud-server/memory/`
- `cloud-server/.omc/`
- `cloud-server/skills/沉淀/`
- `改善总结.md`
- `改善计划执行.md`
- `cloud-server/修复记录.md`
- `cloud-server/修复详情-*.md`

## 发布前检查

先在项目根目录执行：

```bash
git status --short
git diff --stat
git ls-files '*.md'
```

再检查是否混入敏感信息或不该发布的文件：

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9]{20,}|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|api[_-]?key|access[_-]?token|secret)'
git ls-files | rg '(^|/)(project-knowledge/|knowledge/|workspaces/|改善总结\.md|改善计划执行\.md|修复记录\.md|修复详情-)'
```

如果扫描结果命中了真实密钥或内部记录，先清掉再发布。

## 标准发布流程

```bash
git status --short
git add .
git commit -m "docs: update release"
git push origin main:main
```

## 需要覆盖远端时

只有在确认要用本地版本整体替换 GitHub 当前内容时，才使用强制推送：

```bash
git push --force origin main:main
```

这会覆盖远端 `main` 的当前内容，执行前务必确认。

## GitHub Token 使用方式

不要把 Personal Access Token 明文写进仓库、README、脚本或提交历史。

本机发布时使用环境变量：

```bash
export GITHUB_TOKEN='你的 GitHub PAT'
git -c credential.helper='!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f' push origin main:main
```

如需强制覆盖：

```bash
git -c credential.helper='!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f' push --force origin main:main
```

发布完成后，如果 Token 曾经在聊天、截图或文档里暴露过，应立刻到 GitHub 撤销并重新生成。

## 文档同步要求

每次发布如果涉及产品定位、端口、仓库地址或授权方式，请同步检查这些文件：

- `README.md`
- `cloud-server/README.md`
- `docs/SCHEDULER.md`
- `cloud-server/WORKFLOW.md`
- `cloud-server/WORKFLOW.md.example`
- `cloud-server/Dockerfile`
- `cloud-server/docker-compose.yml`
- `cloud-server/public/index.html`

## 当前对外口径

- 产品名：`白白板`
- 标题：`白白板 - 榨干每单位代币效率的 Claude Code 多代理白板工作台 | Maximize Every Token`
- 核心目标：`目标就一个：一句话出结果。`
- 默认端口：`8085`
- 授权：`Apache-2.0`
