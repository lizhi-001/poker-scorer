# Claude Code + Gas Town 全流程操作手册

## 目录

- [环境准备](#环境准备)
- [项目初始化全流程](#项目初始化全流程)
- [开发编排流程](#开发编排流程)
- [监控与进度查看](#监控与进度查看)
- [异常恢复手册](#异常恢复手册)
- [常用命令速查](#常用命令速查)
- [踩坑记录与注意事项](#踩坑记录与注意事项)

---

## 环境准备

### 必需软件清单

| 软件 | 最低版本 | 验证命令 | 安装方式 |
|------|----------|----------|----------|
| Go | 1.23+ | `go version` | [go.dev/dl](https://go.dev/dl/) |
| Git | 2.25+ | `git --version` | `brew install git` |
| Gas Town (gt) | 0.5+ | `gt version` | `npm install -g @gastown/gt` |
| beads (bd) | 0.44+ | `bd --version` | 源码编译（见下方） |
| tmux | 3.0+ | `tmux -V` | `brew install tmux` |
| Claude Code | 最新 | `claude --version` | `npm install -g @anthropic-ai/claude-code` |
| GitHub CLI | 最新 | `gh --version` | `brew install gh` |
| sqlite3 | 系统自带 | `sqlite3 --version` | macOS 预装 |
| Dolt | 最新 | `dolt version` | `brew install dolt` |

### 关键配置

```bash
# Git 身份（必需）
git config --global user.name "你的名字"
git config --global user.email "your@email.com"

# Dolt 身份（必需，否则 gt rig add 会失败）
dolt config --global --add user.email "your@email.com"
dolt config --global --add user.name "你的名字"

# GitHub CLI 登录
gh auth login

# Claude Code 登录验证
claude --version
claude "hello"

# beads 安装（必须从源码，不能用 go install @latest）
git clone --depth 1 https://github.com/steveyegge/beads /tmp/beads
cd /tmp/beads && go install ./cmd/bd

# PATH 配置（~/.zshrc 或 ~/.bashrc）
export PATH="$PATH:$HOME/go/bin"
export PATH="$PATH:$HOME/.local/bin"
```

### 一键验证

```bash
echo "=== 环境检查 ==="
echo -n "Go:      " && go version
echo -n "Git:     " && git --version
echo -n "tmux:    " && tmux -V
echo -n "sqlite3: " && sqlite3 --version | head -1
echo -n "dolt:    " && dolt version
echo -n "claude:  " && claude --version 2>/dev/null || echo "未安装"
echo -n "bd:      " && bd --version 2>/dev/null || echo "未安装"
echo -n "gt:      " && gt version 2>/dev/null || echo "未安装"
echo -n "gh:      " && gh --version 2>/dev/null | head -1 || echo "未安装"
echo "================"
```

---

## 项目初始化全流程

### 第一步：创建 Town 工作区

```bash
gt install ~/gt --git
cd ~/gt
```

### 第二步：初始化 Dolt 数据库

> ⚠️ 这一步容易遗漏，必须在 `gt rig add` 之前完成。

```bash
# 如果 gt rig add 报错 "Dolt server unreachable"，执行以下步骤：
gt dolt init-rig <rig_name>    # 初始化 rig 数据库
gt dolt start                   # 启动 Dolt 服务（监听 127.0.0.1:3307）
gt dolt status                  # 验证服务状态
```

### 第三步：创建 GitHub 仓库并添加为 Rig

```bash
# 创建远程仓库
gh repo create <project-name> --public --description "项目描述" --clone

# 移动到工作目录（可选）
mv ~/<project-name> ~/Developer/<project-name>

# 初始化项目代码、提交并推送
cd ~/Developer/<project-name>
git add . && git commit -m "feat: 初始化项目" && git push origin main

# 添加为 Gas Town Rig
cd ~/gt
gt rig add <rig_name> https://github.com/<user>/<project-name>.git
```

> ⚠️ **Rig 命名规则**：不能包含连字符 `-`、点 `.` 或空格。使用下划线 `_` 代替。
> 例如：`poker-scorer` → `poker_scorer`

### 第四步：处理 Rig 添加失败

如果 `gt rig add` 中途失败（常见于 Dolt 未配置），会留下残留目录：

```bash
# 清理残留目录后重试
rm -rf ~/gt/<rig_name>
gt rig add <rig_name> https://github.com/<user>/<project-name>.git
```

如果目录已存在且有效，使用 `--adopt`：

```bash
gt rig add <rig_name> --adopt --url https://github.com/<user>/<project-name>.git
```

### 第五步：创建 Crew 工作区

```bash
gt crew add <your_name> --rig <rig_name>
# 工作目录：~/gt/<rig_name>/crew/<your_name>
```

### 第六步：设置 Town 级 beads 前缀

> ⚠️ 如果 `gt convoy create` 报错 "issue_prefix config is missing"：

```bash
cd ~/gt
bd config set issue_prefix gt
```

---

## 开发编排流程

### 0. 启动 Mayor（关键步骤，不可跳过）

> ⚠️ **这是最容易遗漏但最重要的步骤。** 没有 Mayor，整个自动恢复链条会断裂。

```bash
gt mayor attach
```

Mayor 是 Gas Town 的核心编排者，负责：
- 接收 Witness 的异常报告并自动 respawn 失败的 Polecat
- 监控 Convoy 整体进度
- 协调 Refinery 合并冲突
- 在所有任务完成后汇报结果

**Gas Town 自动恢复链条：**

```
Polecat 异常退出（上下文耗尽/网络中断/API 限流）
    ↓
Witness 巡检发现（每 60s 检查 tmux 会话状态）
    ↓
Witness 通过 gt mail 发送异常报告给 Mayor
    ↓
Mayor 评估后自动调用 gt sling 重新分配任务
    ↓
新 Polecat 在新的 worktree 中继续工作
```

**如果没有 Mayor 会怎样：**
- Witness 能发现问题，能做有限补救（如帮 Polecat 手动提交 MR）
- 但 Witness 没有权限 respawn Polecat — 那是 Mayor 的职责
- Witness 日志会反复出现 "cannot reach mayor" 的警告
- 失败的任务需要人工手动 `gt sling` 重新分配

**启动顺序建议：**

```bash
# 1. 先启动 Mayor（编排者）
gt mayor attach
# Ctrl+B D 退出观察（Mayor 继续在后台运行）

# 2. Witness 和 Refinery 会在 gt rig add 时自动启动
# 如果没有，手动启动：
gt witness start <rig_name>
gt refinery start <rig_name>

# 3. 然后再 sling 任务
gt sling <issue-id> <rig_name> --hook-raw-bead
```

### 1. 创建 Issue

```bash
cd ~/gt/<rig_name>

# 创建带优先级的 Issue
bd create --title "功能描述" --type task --priority 1

# 查看所有 Issue
bd list

# Issue ID 格式：<prefix>-<hash>，如 ps-o6d
```

> 💡 建议加 `--description` 提供详细上下文，Polecat 会读取。

### 2. 创建 Convoy（批量任务追踪）

```bash
cd ~/gt
gt convoy create "任务批次名称" <issue-1> <issue-2> <issue-3> --notify
```

### 3. Sling Issue 给 Polecat

```bash
# 标准方式（自动创建 Polecat + worktree + 启动 Claude Code）
gt sling <issue-id> <rig_name>

# 如果报 formula 缺失错误，使用 --hook-raw-bead 跳过 formula
gt sling <issue-id> <rig_name> --hook-raw-bead
```

> ⚠️ **关键注意**：首次使用时 `mol-polecat-work` formula 可能不存在，
> 必须加 `--hook-raw-bead` 标志，否则 sling 会失败并回滚。

每个 `gt sling` 会自动：
1. 分配一个 Polecat（如 obsidian、quartz、jasper、onyx）
2. 从 mayor/rig 创建 git worktree
3. 在 tmux 中启动 `claude --dangerously-skip-permissions`
4. 通过 `gt prime` 注入工作上下文
5. Polecat 自动开始编码

### 4. 并行开发注意事项

- P0（骨架/基础设施）必须先完成，再 sling P1
- 同优先级的 Issue 可以并行 sling
- 有依赖关系的 Issue 不要同时 sling，会产生合并冲突
- 每个 Polecat 在独立的 git worktree 中工作，互不干扰
- 但如果修改了相同文件，Refinery 合并时可能冲突

---

## 监控与进度查看

### Convoy 进度

```bash
gt convoy list                    # 列出所有 convoy
gt convoy status <convoy-id>      # 查看详细进度（含每个 issue 状态）
```

### 代理状态

```bash
gt agents list                    # 列出 refinery + witness
gt agents list -a                 # 包含所有 polecat
```

### tmux 会话

```bash
tmux list-sessions                # 列出所有会话

# 会话命名规则：
# ps-<polecat-name>    → Polecat 工作会话（如 ps-obsidian）
# ps-refinery          → Refinery 合并队列
# ps-witness           → Witness 健康监控
```

### 查看 Polecat 实时输出

```bash
# 方式 1：附加到 tmux 会话（交互式）
tmux attach -t ps-obsidian
# Ctrl+B D 退出（不会终止代理）

# 方式 2：捕获最近输出（非交互式）
tmux capture-pane -t ps-obsidian -p -S -30

# 方式 3：通过 gt peek
gt peek <rig_name>/<polecat-name> 30
```

### 查看 Git 分支和提交

```bash
# 查看所有分支
cd ~/gt/<rig_name>/.repo.git
git branch -a

# 查看某个 Polecat 的提交
git log main..<branch-name> --oneline

# 查看改动统计
git diff --stat main..<branch-name>
```

### 查看 Issue 状态

```bash
cd ~/gt/<rig_name>
bd show <issue-id>     # 查看单个 issue 详情
bd list                # 列出所有 issue
bd list --status closed  # 列出已关闭的 issue
```

---

## 异常恢复手册

### 异常 1：Polecat 会话退出但 Issue 未关闭

**症状**：`tmux list-sessions` 中 Polecat 会话消失，但 `bd show` 显示 Issue 仍为 `IN_PROGRESS`。

**原因**：Polecat 可能因上下文耗尽、网络中断或 Claude Code 崩溃退出，未执行 `gt done`。

**恢复步骤**：

```bash
# 1. 检查分支是否已推送
cd ~/gt/<rig_name>/.repo.git
git branch -a | grep <polecat-name>

# 2. 如果分支存在且有提交，说明代码已完成
git log main..<branch-name> --oneline

# 3. 手动关闭 Issue
bd close <issue-id>

# 4. 如果需要 Refinery 合并，手动触发
# （见异常 3）
```

### 异常 2：Refinery 合并冲突

**症状**：`gt convoy status` 显示某个 Issue 仍为 `▶`（进行中），Refinery 日志显示 "rebase conflict"。

**原因**：多个 Polecat 修改了相同文件，后合并的分支与已合并的代码冲突。

**恢复步骤**：

```bash
# 1. 进入 refinery 的 rig 目录
cd ~/gt/<rig_name>/refinery/rig

# 2. 创建临时分支并 rebase
git checkout -b temp-rebase <conflicting-branch>
git rebase main

# 3. 手动解决冲突
# 编辑冲突文件，保留两边的有效代码
git add <resolved-files>
GIT_EDITOR=true git rebase --continue

# 4. 合并到 main
git checkout main
git merge --ff-only temp-rebase

# 5. 推送并清理
git push origin main
git branch -d temp-rebase

# 6. 关闭 Issue
bd close <issue-id>
```

### 异常 3：Witness / Refinery 会话卡死或退出

**症状**：`tmux list-sessions` 中 witness/refinery 消失或长时间无输出。

**恢复步骤**：

```bash
# 1. 终止旧会话（如果还在）
tmux kill-session -t ps-witness 2>/dev/null
tmux kill-session -t ps-refinery 2>/dev/null

# 2. 重新启动
gt witness start <rig_name>
gt refinery start <rig_name>

# 3. 验证
tmux list-sessions
```

### 异常 4：Dolt Server 未启动

**症状**：各种命令报错 "dial tcp 127.0.0.1:3307: connect: connection refused"。

**恢复步骤**：

```bash
gt dolt status          # 检查状态
gt dolt start           # 启动服务

# 如果报 "no databases found"
gt dolt init-rig <rig_name>
gt dolt start
```

### 异常 5：gt rig add 失败留下残留

**症状**：重新执行 `gt rig add` 报 "directory already exists"。

**恢复步骤**：

```bash
# 清理残留目录
rm -rf ~/gt/<rig_name>

# 重新添加
gt rig add <rig_name> <git-url>
```

### 异常 6：gt sling 报 formula 缺失

**症状**：`Error: parsing formula: read mol-polecat-work: no such file or directory`

**恢复步骤**：

```bash
# 使用 --hook-raw-bead 跳过 formula
gt sling <issue-id> <rig_name> --hook-raw-bead
```

### 异常 7：GitHub 推送超时

**症状**：`git push` 报 "Failed to connect to github.com port 443"

**恢复步骤**：

```bash
# 方式 1：配置代理
git config --global http.proxy http://127.0.0.1:<proxy-port>
git config --global https.proxy http://127.0.0.1:<proxy-port>

# 方式 2：切换到 SSH
git remote set-url origin git@github.com:<user>/<repo>.git

# 方式 3：等待网络恢复后重试
git push origin main
```

### 异常 8：Convoy 进度不更新

**症状**：Issue 已关闭但 Convoy 仍显示未完成。

**恢复步骤**：

```bash
# 确认所有 Issue 已关闭
bd show <issue-id>   # 应显示 CLOSED

# Convoy 会自动检测 Issue 状态变化
# 如果仍未更新，等待 witness 下一次巡检
# 或手动检查
gt convoy status <convoy-id>
```

---

## 常用命令速查

### 工作区管理

```bash
gt install <path> --git              # 初始化 Town
gt rig add <name> <repo-url>         # 添加项目
gt rig list                          # 列出项目
gt crew add <name> --rig <rig>       # 创建个人工作区
```

### 代理操作

```bash
gt agents list -a                    # 查看所有代理（含 polecat）
gt sling <bead-id> <rig>             # 分配工作
gt sling <bead-id> <rig> --hook-raw-bead  # 跳过 formula 分配
gt mayor attach                      # 启动 Mayor
gt witness start <rig>               # 启动 Witness
gt refinery start <rig>              # 启动 Refinery
gt refinery status <rig>             # 查看合并队列
```

### Issue 追踪

```bash
bd create --title "标题" --type task --priority 1
bd list                              # 列出所有 issue
bd show <id>                         # 查看详情
bd close <id>                        # 关闭 issue
bd update <id> --status in_progress  # 更新状态
```

### Convoy 管理

```bash
gt convoy create "名称" <issues...> --notify
gt convoy list
gt convoy status <id>
```

### tmux 操作

```bash
tmux list-sessions                   # 列出会话
tmux attach -t <session>             # 附加会话（Ctrl+B D 退出）
tmux capture-pane -t <session> -p -S -30  # 捕获最近 30 行
tmux kill-session -t <session>       # 终止会话
```

### Dolt 数据库

```bash
gt dolt status                       # 检查状态
gt dolt start                        # 启动服务
gt dolt init-rig <name>              # 初始化 rig 数据库
```

### 系统诊断

```bash
gt doctor                            # 完整诊断
gt doctor --check dolt
gt doctor --check hooks
gt doctor --check agents
```

---

## 踩坑记录与注意事项

### 1. Rig 命名不能用连字符

❌ `gt rig add poker-scorer ...`
✅ `gt rig add poker_scorer ...`

Gas Town 用连字符解析 agent ID，rig 名称中的连字符会导致解析歧义。

### 2. Dolt 必须先配置身份再启动

如果 Dolt 没有配置 `user.name` 和 `user.email`，`gt rig add` 会在 "Creating mayor clone" 之后失败，且不会自动清理残留目录。

### 3. Town 级 beads 需要手动设置 prefix

`gt install` 创建的 Town 级 `.beads` 目录可能没有 `issue_prefix`，导致 `gt convoy create` 失败。需要手动：

```bash
cd ~/gt && bd config set issue_prefix gt
```

### 4. 首次 sling 需要 --hook-raw-bead

新项目没有 `mol-polecat-work` formula，直接 `gt sling` 会失败。加 `--hook-raw-bead` 跳过。

### 5. 并行 Polecat 的合并冲突是常态

多个 Polecat 同时修改相同文件（如 `app.ts`、`models.ts`）时，Refinery 合并后续分支必然冲突。建议：
- 尽量让 Issue 的文件修改范围不重叠
- 基础设施类 Issue（骨架、类型定义）先完成再并行
- 预期会有冲突的 Issue 安排在不同批次

### 6. Polecat 退出不一定代表完成

Polecat 可能因为以下原因退出而未完成：
- Claude Code 上下文耗尽
- API 限流或网络中断
- 代码编译错误导致循环失败

检查方法：看分支是否有提交、Issue 是否被 Polecat 自己关闭。

### 7. Witness 和 Refinery 是长驻代理

它们应该一直运行。如果退出了，用 `gt witness start` / `gt refinery start` 重启。它们会自动恢复状态。

### 8. Mayor 模式更简单

如果不想手动创建 Issue + Convoy + Sling，可以直接用 Mayor：

```bash
gt mayor attach
# 然后用自然语言描述需求，Mayor 会自动编排
```

### 9. 网络问题（国内环境）

GitHub 访问不稳定时：
- 配置 git 代理
- 或使用 SSH 协议
- `git push` 失败后直接重试通常能成功

### 10. 查看 Polecat 产出的最佳方式

```bash
# 查看分支改动概览
cd ~/gt/<rig_name>/.repo.git
git diff --stat main..<branch>

# 查看具体代码变更
git diff main..<branch> -- <specific-file>

# 查看提交信息
git log main..<branch> --oneline
```

### 11. 必须先启动 Mayor 再 sling

这是本次开发中最大的教训。没有 Mayor：
- Witness 发现 Polecat 异常后无法自动 respawn
- 合并冲突无法自动协调
- 失败任务需要人工介入

正确顺序：`gt mayor attach` → `gt sling`

### 12. Witness 的能力边界

Witness 能做的：
- 检测 Polecat 会话是否存活
- 检查 git 分支和提交状态
- 帮 Polecat 手动提交 MR（如果 Polecat 忘了）
- 记录状态到 state.json

Witness 不能做的：
- 重新 sling / respawn Polecat（需要 Mayor）
- 解决合并冲突（需要 Refinery 或人工）
- 修改代码（只有 Polecat 可以）

