# dsh-collapse-paste

[DSH（DeepSeek Harness）](https://github.com/deepseek-ai/deepseek-harness) 的纯客户端 UI 插件：把**输入框里的多行粘贴**和**已发送的长消息**都折叠成紧凑的药丸，避免聊天记录被长文本刷屏；发送给模型的始终是完整原文。

## 功能

**输入框**

- 粘贴达到阈值的文本时（默认 ≥ 3 行），整段内容原地折叠成一个内联药丸：`X 字符 / Y 行`；
- 药丸与 DSH 原生 `@文件` reference chip 同款（22px、同一套 token、省略号），Backspace 原子删除；
- 点击药丸展开原文，再点收起；
- **发送时还原全文**，模型收到的内容与普通粘贴完全一致。

**消息区（发送后）**

- 已发送的用户消息如果达到阈值（默认 600 字符或 12 行），折叠成右侧蓝色药丸：`X 字符 / Y 行 · 点击展开`；
- 点击就地展开，消息末尾还有第二个「↑ 点击收起」，不用滚回顶部；
- 折叠只隐藏正文，时间与复制/编辑/删除操作条仍然可用；
- 旁边的「复制」始终复制完整原文；只影响显示，不改存储内容；
- 助手回复不受影响。

## 兼容性

| 环境 | 状态 |
| --- | --- |
| DSH Desktop 0.2.1-rc.2 | 已在 Windows 桌面版手动验证 |
| DSH Web（同一版本） | 未单独验证，预期一致 |
| DSH ≤ 0.2.0 / ≥ 0.3 | 未验证，可能失效 |

插件对 0.2.1 的 Lexical 内部接口（`__lexicalEditor`、`_nodes`、文本叶子样式）有依赖；任何不匹配都会 fail-open（退回原生粘贴行为），不会阻塞启动。

## 安装

最简单（npm，一条命令，不需要构建）：

```sh
dsh plugin --profile desktop add dsh-collapse-paste
```

其他方式：

从 GitHub（源码，含已构建的 `lib/`）：

```sh
dsh plugin --profile desktop add github:Mrsong123456/dsh-collapse-paste
```

从本地目录：

```sh
dsh plugin --profile desktop add file:C:\path\to\dsh-collapse-paste
```

安装后重启 DSH（桌面版重启应用；Web 端重启 `dsh web`），或在 GUI 内刷新页面。卸载：

```sh
dsh plugin --profile desktop remove dsh-collapse-paste
```

## 配置

GUI 内：**设置 → 折叠多行粘贴**（Settings 侧栏里，靠近底部）。

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| 启用输入框折叠 | 开 | 关掉后输入框恢复原生粘贴 |
| 输入框：最小行数 | 3 | 粘贴至少这么多行才折叠 |
| 输入框：最小字符数 | 0 | 额外字符下限，0 = 只看行数 |
| 发送后折叠长消息 | 开 | 关掉后消息区不再折叠 |
| 消息折叠：最小字符数 | 600 | 与行数任一达到即折叠 |
| 消息折叠：最小行数 | 12 | 与字符数任一达到即折叠 |

设置保存在**当前浏览器**的 `localStorage`（key `dsh-collapse-paste.config.v1`），保存后立即生效，不需要重启；换浏览器或设备不会同步。

## 隐私与权限

插件运行在 DSH 页面内，会：

- 监听全局 `paste` 事件，只读取剪贴板纯文本，不写入、不拦截文件粘贴；
- 用 `MutationObserver` 观察聊天记录 DOM，只读取已发送消息的文本用于折叠；
- 使用 `navigator.clipboard.writeText` 复制折叠内容；
- 把阈值写入当前浏览器的 `localStorage`（不离开本机）。

**不发起任何网络请求，不收集、不上传任何数据。**

DSH 插件以你的用户权限运行，安装第三方插件前请自行审阅源码。

## 已知限制

- 依赖 Lexical 内部结构，DSH 升级后可能失效（失效时静默退回原生行为）；
- 展开/收起状态只保存在当前页面内存中，刷新后恢复默认折叠；
- 消息区折叠是纯显示层：滚动虚拟化导致的行重建会重新套用折叠；
- 设置保存在浏览器 `localStorage`，不随 DSH profile 同步，换浏览器/设备不共享。

## 开发

```sh
npm install
npm run build     # host: tsc → lib/；client: tsc 类型检查 → esbuild → lib/client.js
npm test          # 构建后运行 node --test
```

源码结构：

```
src/
├── index.ts              # Host 入口
├── core.ts               # 纯函数核心（阈值、diff、叶子定位）
├── host/                 # Host 半（空 apply + 身份）
└── client/
    ├── index.ts          # 浏览器半出口（apply + inject）
    ├── apply.ts          # 挂载：locale、设置、引擎、消息折叠、设置页
    ├── settings.ts       # 浏览器本地设置存储（localStorage）
    ├── settings-page.ts  # 设置页（settings.section）
    ├── engine/           # 输入框折叠引擎（chip 节点、文档隐藏、观察）
    ├── fold/transcript.ts# 发送后消息折叠
    ├── locales/          # 中英文案
    └── styles/           # 注入的 CSS
```

## 发布到 GitHub

仓库已按可直接推送的结构整理好（`lib/` 已提交，GitHub 安装无需构建）：

```sh
git init
git add .
git commit -m "feat: collapse multiline paste in composer and transcript"
git branch -M main
git remote add origin https://github.com/Mrsong123456/dsh-collapse-paste.git
git push -u origin main
```

发布到 npm（可选）：

```sh
npm publish --access public
```

发布前把 `package.json` 里的 `author`、`contributors` 和仓库地址补成你自己的。

## 致谢

- 原始实现：[`@comecaramelos/dsh-collapse-multiline-paste`](https://www.npmjs.com/package/@comecaramelos/dsh-collapse-multiline-paste)，作者 Robe ComeCaramelos，MIT；
- 输入框折叠的核心思路来自原项目的 `INLINE-CHIP` 设计：文本保留在普通 TextNode 中、只用 state-level `display:none` 隐藏，chip 节点不贡献文本，因此提交的草稿与原生粘贴逐字节一致。

## License

[MIT](LICENSE)
