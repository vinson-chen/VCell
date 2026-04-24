# 多电脑开发同步操作指南

本文档定义 vc-design 和 VCell 项目的开发、发布、同步流程，确保不同电脑间迭代保持一致。

---

## 一、项目结构概览

| 项目 | GitHub 仓库 | npm 包名 | 说明 |
|------|-------------|----------|------|
| vc-design | `git@github.com:vinson-chen/vc-design.git` | `@vinson.hx/vc-design` | UI 组件库 |
| vc-biz | 同上（子包） | `@vinson.hx/vc-biz` | 业务组件（依赖 vc-design） |
| VCell | `git@github.com:vinson-chen/VCell.git` | - | 应用层（依赖 vc-design、vc-biz） |

---

## 二、新电脑环境配置

### 2.1 前置条件

- Node.js >= 18
- Git
- npm 账号（用户名：`vinson.hx`）
- npm access token（bypass 2FA，用于发布）

### 2.2 配置步骤

```bash
# 1. 配置 npm access token（用于发布）
npm config set //registry.npmjs.org/:_authToken <你的token>

# 2. Clone 项目
git clone git@github.com:vinson-chen/vc-design.git
git clone git@github.com:vinson-chen/VCell.git

# 3. 安装依赖
cd vc-design && npm install
cd VCell && npm install
```

---

## 三、vc-design 开发流程

### 3.1 日常开发

```bash
cd vc-design

# 1. 拉取最新代码
git pull origin main

# 2. 开发修改...

# 3. 本地测试（运行 demo）
npm run demo
```

### 3.2 发布新版本

```bash
cd vc-design

# 1. 确保代码已提交
git add -A
git commit -m "feat: 新功能描述"
git push origin main

# 2. 更新版本号
# patch: 修复 bug（1.0.0 → 1.0.1）
# minor: 新功能（1.0.0 → 1.1.0）
# major: 重大变更（1.0.0 → 2.0.0）
npm version patch  # 或 minor / major

# 3. 发布到 npm
npm publish --access public

# 4. 发布 vc-biz（如有修改）
cd packages/vc-biz
npm version patch
npm publish --access public
```

### 3.3 版本同步原则

**重要：vc-design 和 vc-biz 版本号应保持同步更新**

修改 vc-design → 发布 vc-design → 检查 vc-biz 是否需要更新 → 发布 vc-biz

---

## 四、VCell 开发流程

### 4.1 日常开发

```bash
cd VCell

# 1. 拉取最新代码
git pull origin main

# 2. 更新依赖（vc-design/vc-biz 有新版本时）
npm install @vinson.hx/vc-design@latest @vinson.hx/vc-biz@latest

# 3. 本地运行（完整前后端）
npm run dev

# 4. 仅前端（无后端 API）
npm run dev:web
```

### 4.2 发布更新

```bash
cd VCell

# 1. 提交代码
git add -A
git commit -m "feat: 新功能描述"
git push origin main

# 2. GitHub Pages 自动部署（推送后自动触发）
# 访问 https://github.com/vinson-chen/VCell/actions 查看进度
# 部署完成后访问 https://vinson-chen.github.io/VCell/
```

---

## 五、依赖更新流程

当 vc-design 或 vc-biz 发布新版本后，VCell 需更新依赖：

```bash
cd VCell

# 1. 更新 package.json 中的版本号
# 编辑 apps/web/package.json:
# "@vinson.hx/vc-design": "^x.x.x"
# "@vinson.hx/vc-biz": "^x.x.x"

# 2. 重新安装依赖
npm install

# 3. 本地测试构建
npm run build -w vcell-web

# 4. 提交并推送
git add -A
git commit -m "chore: 更新 vc-design/vc-biz 依赖"
git push origin main
```

---

## 六、常见问题处理

### 6.1 npm 发布失败

```
错误：E403 - Two-factor authentication required
```

解决方案：使用 bypass 2FA token

```bash
npm config set //registry.npmjs.org/:_authToken <token>
```

### 6.2 包名冲突

如果包名被占用，使用 scoped package：

```
@vinson.hx/vc-design  # 正确格式
vc-design             # 可能被他人占用
```

### 6.3 本地依赖 vs npm 依赖

开发阶段可使用本地引用：

```json
{
  "vc-design": "file:../vc-design"
}
```

发布前改为 npm 引用：

```json
{
  "@vinson.hx/vc-design": "^1.0.0"
}
```

### 6.4 Git 推送失败

```
错误：remote unpack failed
```

解决方案：创建全新仓库

```bash
# 复制代码到新目录（排除 node_modules 和 .git）
rsync -av --exclude='node_modules' --exclude='.git' vc-design/ vc-design-clean/

# 初始化新仓库
cd vc-design-clean
git init
git branch -m main
git add -A
git commit -m "初始化"
git remote add origin git@github.com:vinson-chen/vc-design.git
git push -u origin main
```

---

## 七、关键配置文件

### 7.1 vc-design/package.json

```json
{
  "name": "@vinson.hx/vc-design",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist", "README.md"]
}
```

### 7.2 vc-biz/package.json

```json
{
  "name": "@vinson.hx/vc-biz",
  "version": "1.0.2",
  "peerDependencies": {
    "@vinson.hx/vc-design": ">=1.0.0"
  }
}
```

### 7.3 VCell/apps/web/package.json

```json
{
  "dependencies": {
    "@vinson.hx/vc-design": "^1.0.0",
    "@vinson.hx/vc-biz": "^1.0.2"
  }
}
```

---

## 八、操作清单

### 开始开发前

- [ ] `git pull` 拉取最新代码
- [ ] `npm install` 更新依赖

### 开发完成后

- [ ] `git add -A` 暂存修改
- [ ] `git commit -m "..."` 提交
- [ ] `git push origin main` 推送

### vc-design 有更新时

- [ ] 更新版本号 `npm version patch`
- [ ] 发布 npm `npm publish --access public`
- [ ] 同步更新 vc-biz（如有依赖变化）
- [ ] 更新 VCell 依赖引用

---

## 九、相关链接

| 资源 | 链接 |
|------|------|
| vc-design GitHub | https://github.com/vinson-chen/vc-design |
| VCell GitHub | https://github.com/vinson-chen/VCell |
| vc-design npm | https://www.npmjs.com/package/@vinson.hx/vc-design |
| vc-biz npm | https://www.npmjs.com/package/@vinson.hx/vc-biz |
| VCell Pages | https://vinson-chen.github.io/VCell/ |
| npm token 创建 | https://www.npmjs.com/settings/vinson.hx/tokens/granular-access-tokens/new |