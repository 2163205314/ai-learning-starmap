# Git 团队开发实战教程

本文以当前项目为例，默认使用 Windows PowerShell，远程仓库名为 `origin`，主要分支为 `main`，个人开发分支示例为 `dev01`。

> 本文中的姓名、邮箱、GitHub 账号、仓库地址和本地路径均为虚构示例。命令前面的 `PS D:\Projects\team-demo>` 是 PowerShell 提示符，不需要复制。命令输出会因电脑、分支和提交不同而变化。

## 1. 先理解 Git 在管理什么

日常使用 Git 时，代码会依次经过四个位置：

```text
工作区  --git add-->  暂存区  --git commit-->  本地仓库  --git push-->  远程仓库
```

- 工作区：电脑上正在编辑的文件。
- 暂存区：准备放进下一次提交的改动。
- 本地仓库：已经提交到本机 Git 历史中的内容。
- 远程仓库：GitHub 上供团队共享的仓库。

三个最重要的动作：

```powershell
git add <文件>        # 选择本次准备提交的改动
git commit -m "说明"  # 把暂存区保存为一个本地提交
git push              # 把本地提交上传到远程仓库
```

`commit` 只保存到本地，`push` 后团队成员才能在远程仓库看到。

## 2. 第一次使用前的配置

### 2.1 配置提交者姓名和邮箱

```powershell
PS> git config --global user.name "Li Ming"
PS> git config --global user.email "liming@example.com"
```

检查配置：

```powershell
PS> git config --global --list
user.name=Li Ming
user.email=liming@example.com
```

姓名和邮箱会写入每一次提交记录。邮箱最好使用 GitHub 已验证邮箱，或者 GitHub 提供的隐私邮箱。

只想对当前仓库设置时，去掉 `--global`：

```powershell
PS> git config user.name "Li Ming"
PS> git config user.email "liming@example.com"
```

### 2.2 克隆项目

使用 SSH：

```powershell
PS D:\Projects> git clone git@github.com:example-org/team-demo.git
PS D:\Projects> cd team-demo
```

查看远程地址：

```powershell
PS> git remote -v
origin  git@github.com:example-org/team-demo.git (fetch)
origin  git@github.com:example-org/team-demo.git (push)
```

`origin` 是远程仓库的默认简称，不是固定关键字。

## 3. 每天开始开发前

先确认当前分支和文件状态：

```powershell
PS> git status
On branch dev01
Your branch is up to date with 'origin/dev01'.
nothing to commit, working tree clean
```

再获取远程最新信息：

```powershell
PS> git fetch origin
```

`fetch` 只更新远程分支信息，不会修改当前工作区，适合先安全地查看变化。

查看所有分支：

```powershell
PS> git branch -a
* dev01
  main
  remotes/origin/dev01
  remotes/origin/main
```

让本地 `main` 同步远程最新代码：

```powershell
PS> git switch main
PS> git pull --ff-only origin main
```

`--ff-only` 可以避免一次普通拉取意外产生额外的合并提交；如果无法快进，Git 会停止并提示处理分叉。

然后从最新 `main` 创建任务分支：

```powershell
PS> git switch -c feature/login main
Switched to a new branch 'feature/login'
```

推荐一个任务使用一个分支，不要长期把所有工作都堆在个人分支里。

常用分支命名：

```text
feature/login        新功能
fix/login-timeout    Bug 修复
docs/git-guide       文档修改
refactor/user-api    重构
chore/update-deps    工程或依赖维护
```

## 4. 查看和提交改动

### 4.1 随时查看状态

```powershell
PS> git status --short
 M learning/views.py
?? learning/tests/test_views.py
```

状态含义：

- ` M`：工作区中已修改，但还没有暂存。
- `M `：已经暂存。
- `MM`：暂存后又继续修改。
- `??`：新文件，Git 还没有跟踪。
- `D`：文件被删除。

### 4.2 查看具体改了什么

查看尚未暂存的改动：

```powershell
PS> git diff
```

查看已经暂存、即将提交的改动：

```powershell
PS> git diff --staged
```

只看文件和改动量：

```powershell
PS> git diff --stat
```

### 4.3 把相关改动加入暂存区

推荐明确添加文件：

```powershell
PS> git add learning/views.py learning/tests/test_views.py
```

确认暂存内容：

```powershell
PS> git diff --staged
PS> git status
```

确定当前目录下所有改动都属于同一任务时，也可以：

```powershell
PS> git add .
```

不要不检查就执行 `git add .`，否则日志、临时文件、密钥或不相关修改可能一起进入提交。

只暂存一个文件中的部分改动：

```powershell
PS> git add -p learning/views.py
```

Git 会逐段询问是否暂存，常用回答为 `y`（是）、`n`（否）、`s`（继续拆分）。

### 4.4 创建提交

```powershell
PS> git commit -m "feat: add user login validation"
[feature/login 1a2b3c4] feat: add user login validation
 2 files changed, 35 insertions(+), 4 deletions(-)
```

一个好提交应满足：

- 只解决一个明确问题。
- 提交前能正常运行或通过相关测试。
- 提交说明能让别人快速理解目的。
- 不提交 `.env`、密码、Token、数据库和大型生成文件。

推荐提交格式：

```text
<类型>: <简短说明>
```

常用类型：

```text
feat: 新功能
fix: 修复 Bug
docs: 文档变化
style: 仅格式变化，不影响逻辑
refactor: 重构
test: 测试相关
chore: 构建、依赖、配置等维护工作
```

示例：

```text
feat: add learning progress API
fix: handle empty conversation data
docs: add deployment instructions
test: cover login failure cases
```

## 5. 把任务分支推送到 GitHub

第一次推送新分支：

```powershell
PS> git push -u origin feature/login
branch 'feature/login' set up to track 'origin/feature/login'.
```

`-u` 会建立本地分支和远程分支的跟踪关系，以后可以直接使用：

```powershell
PS> git push
```

推送后，在 GitHub 创建 Pull Request（PR）：

```text
feature/login  ──Pull Request──>  main
```

PR 中应写明：

- 为什么修改。
- 修改了什么。
- 如何测试。
- 是否影响配置、数据库或接口。
- 相关任务或 Issue。

团队推荐开启 `main` 分支保护：禁止直接推送，要求 PR、代码评审和自动测试通过后才能合并。

## 6. 你刚才执行的命令代表什么

### 6.1 暂存、提交、推送

```powershell
PS> git add .
PS> git commit -m "githubConfig"
[main c89aa03] githubConfig
 1 file changed, 2 insertions(+)
 create mode 100644 .github/CODEOWNERS
PS> git push
To github.com:example-org/team-demo.git
   bf91111..c89aa03  main -> main
```

含义：

1. `git add .` 把当前目录下的改动加入暂存区。
2. `git commit` 在本地 `main` 创建提交 `c89aa03`。
3. `git push` 把本地 `main` 从 `bf91111` 推进到 `c89aa03`，并上传到远程。

这次操作成功了，但在标准团队流程中，通常应在任务分支提交，再通过 PR 合入 `main`。

### 6.2 查看并切换远程分支

```powershell
PS> git branch -r
  origin/HEAD -> origin/main
  origin/dev01
  origin/main
```

- `origin/main`：远程主分支。
- `origin/dev01`：远程开发分支。
- `origin/HEAD -> origin/main`：远程仓库默认分支是 `main`。

基于远程分支创建本地分支并建立跟踪：

```powershell
PS> git switch -c dev01 --track origin/dev01
branch 'dev01' set up to track 'origin/dev01'.
Switched to a new branch 'dev01'
```

你使用的旧写法效果相同：

```powershell
PS> git checkout -b dev01 origin/dev01
```

推荐日常使用语义更清楚的 `git switch`；老版本 Git 没有 `switch` 时再使用 `checkout`。

查看详细分支关系：

```powershell
PS> git branch -vv
* dev01 bf91111 [origin/dev01] Use a single Docker command for persistent container
  main  c89aa03 [origin/main] githubConfig
```

星号表示当前位于 `dev01`，方括号表示它正在跟踪的远程分支。

## 7. `fetch`、`pull` 和 `push` 的区别

```text
git fetch：下载远程最新提交和分支信息，不改工作区
git pull ：下载并把远程变化整合到当前分支
git push ：把本地提交上传到远程
```

`git pull` 大致相当于：

```powershell
git fetch
git merge   # 默认配置下
```

因为 `pull` 会修改当前分支，团队开发时可以先执行：

```powershell
PS> git fetch origin
PS> git log --oneline --graph --decorate --all -15
```

看清分支关系后再决定如何整合。

## 8. 让开发分支跟上最新 `main`

开发过程中，其他人的 PR 可能已经进入 `main`。先确保工作区干净：

```powershell
PS> git status
nothing to commit, working tree clean
```

获取远程最新状态：

```powershell
PS> git fetch origin
```

团队应统一选择 merge 或 rebase，不要在同一分支上随意混用。

### 8.1 方式一：merge，保留分支合并历史

```powershell
PS> git switch feature/login
PS> git merge origin/main
```

优点是不会改写已有提交；缺点是可能产生额外合并提交。多人共同使用的分支通常优先考虑 merge。

### 8.2 方式二：rebase，保持线性历史

```powershell
PS> git switch feature/login
PS> git rebase origin/main
```

rebase 会把本分支提交重新放到最新 `main` 后面，提交哈希会改变。

重要规则：不要对其他人正在使用的共享提交随意 rebase。若已经推送过该个人分支，rebase 后通常需要：

```powershell
PS> git push --force-with-lease
```

只使用 `--force-with-lease`，不要使用危险性更高的 `--force`。前者会在远程分支出现自己未知的新提交时拒绝覆盖。

## 9. 合并分支

### 9.1 本地合并演示

```powershell
PS> git switch main
PS> git pull --ff-only origin main
PS> git merge feature/login
PS> git push origin main
```

实际团队中更推荐在 GitHub 上通过 PR 合并，让评审、自动测试和权限规则生效。

### 9.2 GitHub 常见三种合并方式

- Merge commit：保留分支结构和所有提交。
- Squash and merge：把 PR 的多个提交压成一个，主分支较整洁。
- Rebase and merge：逐个提交接到主分支后面，历史保持线性。

如果团队没有特殊要求，功能分支常用 Squash and merge；重要的是整个团队保持一致。

## 10. 解决代码冲突

当两个人修改同一文件的同一区域时，merge、rebase 或 pull 可能出现：

```powershell
PS> git merge origin/main
Auto-merging learning/views.py
CONFLICT (content): Merge conflict in learning/views.py
Automatic merge failed; fix conflicts and then commit the result.
```

先查看冲突文件：

```powershell
PS> git status
both modified: learning/views.py
```

文件中会出现：

```text
<<<<<<< HEAD
当前分支的内容
=======
准备合入分支的内容
>>>>>>> origin/main
```

处理步骤：

1. 和相关同学确认正确逻辑。
2. 编辑文件，保留最终需要的内容。
3. 删除 `<<<<<<<`、`=======`、`>>>>>>>` 标记。
4. 运行测试。
5. 标记冲突已解决并继续操作。

merge 冲突解决后：

```powershell
PS> git add learning/views.py
PS> git commit
```

rebase 冲突解决后：

```powershell
PS> git add learning/views.py
PS> git rebase --continue
```

想放弃本次操作：

```powershell
PS> git merge --abort
```

或：

```powershell
PS> git rebase --abort
```

不要直接删除冲突文件，也不要没理解业务逻辑就选择“全部保留我方”或“全部保留对方”。

## 11. 撤销错误操作

撤销前先执行 `git status` 和 `git diff`，确认影响范围。

### 11.1 文件修改了，但还没有 `git add`

恢复某个文件到上一次提交状态：

```powershell
PS> git restore learning/views.py
```

这会丢弃该文件未暂存的修改，执行前一定确认这些修改不再需要。

### 11.2 已经 `git add`，但还没有 commit

只取消暂存，保留工作区修改：

```powershell
PS> git restore --staged learning/views.py
```

### 11.3 刚提交，发现漏了文件或说明写错

仅适合还没有推送、并且确定无人基于该提交继续工作时：

```powershell
PS> git add learning/tests/test_views.py
PS> git commit --amend
```

只修改最近一次提交说明：

```powershell
PS> git commit --amend -m "fix: validate empty login form"
```

`amend` 会产生新的提交哈希。已经共享的提交通常不要 amend。

### 11.4 已经推送到共享分支

使用 `revert` 创建一个反向提交，不改写历史：

```powershell
PS> git revert c89aa03
PS> git push
```

这是撤销远程公共提交的推荐方法。

### 11.5 找回“消失”的提交

Git 会记录本地 HEAD 的移动历史：

```powershell
PS> git reflog
c89aa03 HEAD@{0}: checkout: moving from main to dev01
```

找到需要的提交后，先创建救援分支最安全：

```powershell
PS> git switch -c rescue-work <提交哈希>
```

不要把 `git reset --hard` 当成常规撤销手段，它会直接丢弃工作区和暂存区改动。

## 12. 临时保存未完成工作：stash

正在开发时需要临时切换分支：

```powershell
PS> git stash push -u -m "WIP: login validation"
Saved working directory and index state On feature/login: WIP: login validation
```

`-u` 会同时保存尚未跟踪的新文件。

查看列表：

```powershell
PS> git stash list
stash@{0}: On feature/login: WIP: login validation
```

恢复并保留 stash 备份：

```powershell
PS> git stash apply "stash@{0}"
```

恢复成功后删除对应 stash：

```powershell
PS> git stash drop "stash@{0}"
```

`git stash pop` 会恢复后立即尝试删除 stash；重要修改建议先 `apply`，确认无误再 `drop`。

stash 适合短期切换，不应长期代替提交。

## 13. 查看提交历史

简洁查看：

```powershell
PS> git log --oneline -10
c89aa03 githubConfig
bf91111 Use a single Docker command for persistent container
```

图形化查看所有分支：

```powershell
PS> git log --oneline --graph --decorate --all -20
```

查看某次提交：

```powershell
PS> git show c89aa03
```

查看某个文件的历史：

```powershell
PS> git log --oneline -- .github/CODEOWNERS
```

查看每一行最后由谁修改：

```powershell
PS> git blame learning/views.py
```

`blame` 用来寻找上下文和相关负责人，不应用来指责同事。

## 14. 删除已经合并的任务分支

PR 合并后，先更新主分支：

```powershell
PS> git switch main
PS> git pull --ff-only origin main
```

安全删除已经合并的本地分支：

```powershell
PS> git branch -d feature/login
```

删除远程任务分支：

```powershell
PS> git push origin --delete feature/login
```

清理本地已经失效的远程分支引用：

```powershell
PS> git fetch --prune origin
```

不要删除仍有同学使用或尚未合并的分支。

## 15. `.gitignore`、敏感信息和大文件

`.gitignore` 只对尚未被 Git 跟踪的文件生效。本项目已经忽略 `.env`、虚拟环境、数据库、日志和缓存等本地文件。

检查某文件为什么被忽略：

```powershell
PS> git check-ignore -v .env
.gitignore:...:.env  .env
```

如果文件已经提交过，后来再写入 `.gitignore` 并不会自动停止跟踪。应先确认团队影响，再将它从版本控制中移除，同时保留本地文件：

```powershell
PS> git rm --cached <文件>
PS> git commit -m "chore: stop tracking local config"
```

如果密码或 Token 曾经提交并推送，删除文件还不够：应立即作废并更换密钥，再联系仓库管理员清理历史。

大型模型、数据集、视频和生成文件不适合直接提交到普通 Git 仓库；应使用对象存储、制品库或经团队同意的 Git LFS。

## 16. LF 和 CRLF 换行提示

你看到的提示：

```text
warning: in the working copy of '.github/CODEOWNERS',
LF will be replaced by CRLF the next time Git touches it
```

不是错误，提交已经成功。LF 是 Linux/macOS 常用换行，CRLF 是 Windows 常用换行。

当前项目的 `.gitattributes` 已明确规定：

```gitattributes
*.md text eol=lf
*.py text eol=lf
*.ps1 text eol=crlf
*.bat text eol=crlf
```

这能保证代码和文档在仓库中使用一致的换行符。团队成员不要随意修改全局换行策略，也不要因为换行提示反复转换整个项目，否则容易产生大量无意义 diff。

检查某文件实际应用的属性：

```powershell
PS> git check-attr text eol -- .github/CODEOWNERS
.github/CODEOWNERS: text: auto
.github/CODEOWNERS: eol: unspecified
```

如果希望 `CODEOWNERS` 也明确使用 LF，可由团队统一决定是否在 `.gitattributes` 中补充规则；这不影响 GitHub 识别文件。

## 17. CODEOWNERS 的作用

`.github/CODEOWNERS` 可以为文件指定默认评审人。例如：

```text
# 全仓库默认负责人
* @demo-maintainer

# Python 代码负责人
*.py @backend-team

# 指定目录负责人
/learning/ @learning-team
```

注意：

- 所有者必须是有仓库访问权限的 GitHub 用户名或团队名。
- `@demo-maintainer` 必须替换为实际 GitHub 登录名，不能使用显示昵称。
- 邮箱只能写在注释中，不能代替 `@用户名` 成为规则所有者。
- 可配合 GitHub 分支保护，要求 CODEOWNERS 批准 PR。

## 18. 发布版本：tag

创建带说明的版本标签：

```powershell
PS> git switch main
PS> git pull --ff-only origin main
PS> git tag -a v1.0.0 -m "Release v1.0.0"
PS> git push origin v1.0.0
```

查看标签：

```powershell
PS> git tag --list
```

版本号通常采用 `主版本.次版本.修订号`，例如：

- `v1.0.1`：兼容的 Bug 修复。
- `v1.1.0`：兼容的新功能。
- `v2.0.0`：不兼容的重大变化。

已经发布的标签不要随意移动或复用。

## 19. 常见错误及处理

### 19.1 推送被拒绝：远程有新提交

```text
! [rejected] feature/login -> feature/login (non-fast-forward)
```

先获取变化并检查：

```powershell
PS> git fetch origin
PS> git log --oneline --graph --decorate --all -15
```

确认后按团队策略 merge 或 rebase，再推送。不要看到拒绝就直接强制推送。

### 19.2 当前分支没有上游分支

```text
fatal: The current branch feature/login has no upstream branch.
```

第一次推送时建立跟踪关系：

```powershell
PS> git push -u origin feature/login
```

### 19.3 切换分支会覆盖本地修改

```text
error: Your local changes ... would be overwritten by checkout
```

先选择以下一种方式：

- 修改已经完成：提交它。
- 修改还没完成：使用有说明的 stash。
- 修改不再需要：确认后使用 `git restore`。

### 19.4 SSH 权限失败

```text
Permission denied (publickey).
```

检查连接：

```powershell
PS> ssh -T git@github.com
```

确认 SSH 公钥已添加到正确 GitHub 账号，并且自己拥有仓库权限。

### 19.5 不确定自己做了什么

先停止继续执行命令，收集以下信息：

```powershell
PS> git status
PS> git branch -vv
PS> git log --oneline --graph --decorate --all -15
PS> git reflog -10
```

把命令和完整输出发给熟悉 Git 的同学。不要在不理解影响时使用 `reset --hard`、`clean -fd`、`push --force`。

## 20. 推荐的团队协作流程

### 开始一个任务

```powershell
PS> git status
PS> git switch main
PS> git pull --ff-only origin main
PS> git switch -c feature/task-name
```

### 开发和提交

```powershell
PS> git status --short
PS> git diff
PS> git add <相关文件>
PS> git diff --staged
PS> git commit -m "feat: describe the change"
```

### 推送并创建 PR

```powershell
PS> git push -u origin feature/task-name
```

然后在 GitHub 创建 PR，请队友评审，修复问题并等待自动测试通过。

### PR 合并后清理

```powershell
PS> git switch main
PS> git pull --ff-only origin main
PS> git branch -d feature/task-name
PS> git fetch --prune origin
```

## 21. 团队约定建议

为了减少冲突和误操作，建议团队明确以下规则：

1. `main` 始终保持可运行、可部署。
2. 禁止直接推送 `main`，所有修改通过 PR。
3. 一个任务一个短期分支，一个提交只做一类改动。
4. 合并前至少一名同学评审，相关测试必须通过。
5. 统一选择 merge、squash 或 rebase 策略。
6. 不提交密钥、本地环境、数据库、缓存和无关大文件。
7. 解决冲突后重新测试，不只满足于“可以合并”。
8. 不改写公共分支历史，不随意强制推送。
9. 大改动尽早开 Draft PR，降低最后集中冲突的风险。
10. 提交和 PR 说明重点写清楚“为什么改”。

## 22. 日常命令速查表

| 目的 | 命令 |
| --- | --- |
| 查看状态 | `git status` |
| 查看分支 | `git branch -vv` |
| 查看远程分支 | `git branch -r` |
| 获取远程信息 | `git fetch origin` |
| 更新当前分支 | `git pull --ff-only` |
| 切换分支 | `git switch <分支>` |
| 新建并切换分支 | `git switch -c <新分支>` |
| 查看未暂存改动 | `git diff` |
| 查看已暂存改动 | `git diff --staged` |
| 暂存指定文件 | `git add <文件>` |
| 提交 | `git commit -m "说明"` |
| 首次推送分支 | `git push -u origin <分支>` |
| 查看提交图 | `git log --oneline --graph --decorate --all` |
| 取消暂存 | `git restore --staged <文件>` |
| 暂存未完成工作 | `git stash push -u -m "说明"` |
| 安全撤销公共提交 | `git revert <提交哈希>` |
| 清理失效远程引用 | `git fetch --prune origin` |

最后牢记：提交前看 `status` 和 `diff`，同步前确认当前分支，推送前确认提交历史；遇到不确定的情况先停下来检查，不要用强制命令碰运气。
