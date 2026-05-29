# 皮老板智能阅卷工具 - 代码审查清单

> 审查日期：2026-05-29 | 版本：2.1.2 | 审查范围：全部代码

---

## 🔴 高优先级（必须修复）

### 安全问题

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 1 | **IPC 通道无白名单** | `electron/preload.ts:29-30` | 暴露了通用 `invoke`/`send` 方法，渲染进程可调用任意 IPC 通道，完全绕过 contextIsolation 安全隔离 |
| 2 | **IPC 事件监听无白名单** | `electron/preload.ts:33-38` | 暴露了通用 `on`/`off` 方法，可监听任意事件，`off` 会移除所有监听器 |
| 3 | **文件读写无路径验证** | `electron/main.ts:286-316` | `file:read`/`file:write`/`file:readImage` 接受任意路径，可读写系统任意文件 |
| 4 | **shell:openExternal 无 URL 验证** | `electron/main.ts:319` | 可打开任意协议 URL（file://、自定义协议等） |

### 功能缺陷

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 5 | **handlePause 逻辑反转** | `SimpleGradingPage.tsx:458-469` | 暂停时调用 start()，恢复时调用 stop()，暂停/继续行为完全相反 |
| 6 | **bot:capture-auto 返回值错误** | `electron/main.ts:688-691` | 使用 `ipcMain.emit` 而非直接调用，返回 boolean 而非图片数据，功能完全失效 |
| 7 | **统计数据竞态条件** | `SimpleGradingPage.tsx:328,353,380` | while 循环中 `stats` 值不更新（闭包陷阱），多次计数基于同一旧值，统计不准确 |

### CI/CD 问题

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 8 | **release.yml 使用废弃 API** | `.github/workflows/release.yml:38,55` | `actions/create-release@v1` 和 `actions/upload-release-asset@v1` 已废弃 |
| 9 | **release.yml upload_url 为空** | `.github/workflows/release.yml:42` | 引用不存在的 `github.event.inputs.upload_url`，上传步骤会失败 |
| 10 | **release.yml EXE_NAME 未定义** | `.github/workflows/release.yml:43` | `env.EXE_NAME` 从未定义，上传文件名无效 |
| 11 | **release.yml job 并行执行** | `.github/workflows/release.yml` | `release` job 依赖 `create-release` 的 output 但未声明 `needs` |

---

## 🟡 中优先级（建议修复）

### 代码质量

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 12 | **组件卸载未取消批改循环** | `SimpleGradingPage.tsx:285-456` | 切换页面时批改循环继续运行，导致内存泄漏和卸载后状态更新 |
| 13 | **settingsStore async 调用无 catch** | `settingsStore.ts:96-124` | `syncProvidersToMain` 是 async 但调用时未 await 也无 .catch()，未处理的 Promise rejection |
| 14 | **secureStorage.has 同步调用** | `settingsStore.ts:140` | 在 `set()` 回调中同步调用异步方法，得到 Promise 而非布尔值 |
| 15 | **UpdateChecker 事件监听未清理** | `UpdateChecker.tsx:26-48` | useEffect 注册了 3 个监听器但无清理函数，内存泄漏 |
| 16 | **onkip 拼写错误** | `IntroGuide.tsx:129` | 应为 `onskip`，跳过引导时不会保存完成状态 |
| 17 | **confirmResolveRef 可能永不 resolve** | `SimpleGradingPage.tsx:214-227` | 用户点停止时 Promise 永远悬挂 |
| 18 | **useEffect 依赖数组不完整** | `SimpleGradingPage.tsx:108-113` | 使用了 `url` 和 `browserConnected` 但依赖数组为空 |

### 样式问题

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 19 | **CSS 变量 --danger-100/200 未定义** | `global.scss` | `ApiTestPage.scss` 使用了未定义的变量 |
| 20 | **CSS 变量 --gradient-danger 未定义** | `RecordsPage.scss:357` | danger 按钮渐变背景无效 |
| 21 | **UpdateChecker.scss 硬编码颜色** | `UpdateChecker.scss` | 18 处硬编码颜色值，暗色主题下不会切换 |

### 配置问题

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 22 | **BrowserWindow 缺少 sandbox** | `electron/main.ts:242-247` | 未设置 `sandbox: true`，缺少额外安全层 |
| 23 | **CSP connect-src 不完整** | `index.html:6` | 只允许 `api.deepseek.com`，但实际连接多个 AI 服务商 |
| 24 | **日志仅输出到 console** | `electron/logger.ts` | 无持久化，生产环境（Windows）看不到日志 |
| 25 | **selectors.json 含 jQuery 伪选择器** | `config/selectors.json:27-28` | `:contains()` 在 Playwright 中无效 |
| 26 | **版本号不一致** | 多处 | `index.html` v1.0.0、`main.ts` v2.1.1、`TitleBar` v2.1.1、`package.json` v2.1.2 |

### 架构问题

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 27 | **SecureStorage/SelectorManager 位置错误** | `src/utils/` | 导入了 Electron 模块但位于渲染进程目录 |
| 28 | **main.ts 过大（1240行）** | `electron/main.ts` | 所有逻辑集中在一个文件，应拆分模块 |
| 29 | **选择器多处重复定义** | `main.ts:170-227` + `config/selectors.json` | 硬编码和外部配置并存，维护困难 |
| 30 | **ErrorBoundary 重复定义** | `src/components/` + `src/components/common/` | 两个功能相同的文件 |

---

## 🟢 低优先级（可选优化）

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| 31 | 大量 `as any` 类型断言（17处） | 多个文件 | 降低 TypeScript 类型安全性 |
| 32 | `playwright` 在 dependencies 而非 devDependencies | `package.json` | 增加安装包大小 |
| 33 | `electron-store` 未使用 | `package.json` | 冗余依赖 |
| 34 | `tesseract.js` 未使用 | `package.json` | 冗余依赖 |
| 35 | `onnxruntime-web` 应使用 node 版本 | `package.json` + `main.ts` | 浏览器版用在 Node.js 环境 |
| 36 | `Notification.tsx` 未使用 | `src/components/common/` | 与 react-hot-toast 功能重叠的死代码 |
| 37 | `ProgressBar.tsx` 未使用 | `src/components/common/` | 未被任何页面导入 |
| 38 | `ApiTestPage.tsx` 无路由 | `src/pages/` | 页面存在但未在 App.tsx 中注册路由 |
| 39 | `PenTool` 图标未使用 | `Sidebar.tsx:3` | 无用导入 |
| 40 | `useSound` 所有音效相同 | `useSound.tsx:28-34` | 7 种音效使用相同 Base64 数据 |
| 41 | `SettingsProvider` 无实际作用 | `settingsStore.ts:356-358` | 不提供 Context，只是透传 children |
| 42 | 测试覆盖严重不足 | `src/tests/` | 只有 2 个测试文件 17 个用例，核心模块零覆盖 |
| 43 | `require()` 风格不一致 | `electron/main.ts` | 混用 require 和 import |
| 44 | `.gitignore` 未排除 tar 文件 | 项目根目录 | 压缩包不应提交到版本控制 |
| 45 | CI 无 lint/typecheck 步骤 | `.github/workflows/ci.yml` | 缺少代码检查环节 |
| 46 | `ThemedToaster` 不响应系统主题变化 | `App.tsx:14-34` | 切换系统深浅色时 Toaster 颜色不更新 |

---

## 📊 问题统计

| 严重程度 | 数量 | 占比 |
|---------|------|------|
| 🔴 高 | 11 | 24% |
| 🟡 中 | 19 | 41% |
| 🟢 低 | 16 | 35% |
| **总计** | **46** | 100% |

## 🎯 建议修复优先级

### 第一批（安全 + 功能阻断）
1. 修复 IPC 白名单（#1, #2）
2. 添加文件路径验证（#3）
3. 添加 URL 协议验证（#4）
4. 修复 handlePause 逻辑（#5）
5. 修复 bot:capture-auto（#6）
6. 修复统计数据竞态（#7）

### 第二批（稳定性）
7. 组件卸载清理（#12）
8. settingsStore async 处理（#13, #14）
9. UpdateChecker 事件清理（#15）
10. 修复 onkip 拼写（#16）
11. 统一版本号（#26）

### 第三批（CI/CD + 样式）
12. 重写 release.yml（#8, #9, #10, #11）
13. 补全 CSS 变量（#19, #20, #21）
14. 更新 CSP 策略（#23）
15. 日志持久化（#24）

### 第四批（代码质量）
16. 拆分 main.ts（#28）
17. 移除死代码（#33, #34, #36, #37）
18. 补充测试（#42）
19. 清理 as any（#31）
