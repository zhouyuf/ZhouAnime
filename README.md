# ZhouAnime

一个中文影视/动漫发现与本地媒体库管理的 Web 应用。界面采用 Netflix 风格的深色主题，支持浏览热门影视内容，并通过 TMDB API 自动匹配本地媒体文件夹的元数据信息。

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| UI 框架 | React | 19.2.6 |
| 路由 | React Router DOM | 7.17.0 |
| 组件库 | Ant Design (antd) | 6.4.3 |
| 构建工具 | Vite | 8.0.12 |
| 代码规范 | ESLint | 10.3.0 |
| 样式方案 | 原生 CSS（组件同目录） | - |

## 项目结构

```
ZhouAnime/
├── index.html                        # 入口 HTML（lang="zh-CN"）
├── vite.config.js                    # Vite 配置，含自定义插件
├── vite-plugin-local-media.js        # 自定义 Vite 服务器插件（本地媒体 + TMDB API）
├── data/
│   ├── config.json                   # 静态配置文件（本地路径 + TMDB API Key）
│   └── media-cache.json              # TMDB 元数据缓存（运行时生成）
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.jsx                      # React 入口
    ├── App.jsx                       # 根组件与路由配置
    ├── index.css                     # 全局基础样式
    ├── assets/                       # 静态资源
    ├── components/
    │   ├── Header.jsx                # 顶部导航栏（Logo、搜索、设置）
    │   ├── Footer.jsx                # 页脚
    │   ├── HeroBanner.jsx            # 首页轮播横幅
    │   ├── VideoCard.jsx             # 影视卡片组件
    │   ├── VideoCarousel.jsx         # 水平滚动轮播组件
    │   ├── LocalMedia.jsx            # 本地媒体库（核心组件，465 行）
    │   └── SettingsModal.jsx         # 设置弹窗（路径 + API Key）
    ├── data/
    │   └── mockData.js               # 模拟数据（33 条影视条目）
    └── pages/
        └── Admin.jsx                 # 管理后台页面
```

## 功能说明

### 首页

- **轮播横幅**：自动播放的 Hero Banner，淡入淡出效果，5 秒间隔，展示精选影视的背景图、标题、评分和简介
- **影视轮播**：三个水平滚动区域 —— 热门、最新、高分，每组 10 张卡片
- **影视卡片**：180×270 海报，悬停时上浮动画并显示评分叠加层
- **顶部导航**：Logo、搜索框、分类菜单（电影/电视剧/动漫/排行榜）、管理后台入口、设置按钮

### 管理后台（`/admin`）

- 面包屑导航
- 本地媒体库管理表格
- "配置路径"按钮打开设置弹窗
- 系统设置区域（开发中）

### 本地媒体库（核心功能）

这是项目最有价值的功能，工作流程如下：

1. 用户在设置中配置本地媒体文件夹路径和 TMDB API Key
2. 通过 Vite 服务器插件读取本地目录的子文件夹列表
3. 自动清洗文件夹名（去除 1080p、BluRay、x265 等编码标签）
4. 使用清洗后的名称查询 TMDB API 获取元数据
5. 匹配结果缓存到 `data/media-cache.json`
6. 以 Ant Design Table 展示：海报缩略图、标题、匹配状态、年份、评分、类型、简介
7. 支持单条重新匹配和删除操作

### 设置弹窗

- 本地媒体路径输入
- TMDB API Key 输入（密码遮罩）
- "测试"按钮验证路径有效性
- 配置保存到 `data/config.json` 静态文件（所有浏览器共享）

## 自定义 Vite 插件

`vite-plugin-local-media.js` 实现了 5 个 REST API 端点作为 Vite 开发服务器中间件：

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/config` | 读取配置（路径 + API Key） |
| PUT | `/api/config` | 写入配置 |
| GET | `/api/folders?path=xxx` | 列出指定路径的子目录 |
| GET | `/api/tmdb?query=xxx&apiKey=xxx` | 代理 TMDB 搜索 API（中文搜索） |
| GET | `/api/cache` | 读取完整媒体缓存 |
| POST | `/api/cache` | 合并新条目到缓存 |
| DELETE | `/api/cache?key=xxx` | 删除单条缓存记录 |

## 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | HomePage | 首页，含轮播横幅 + 影视轮播 + 设置弹窗 |
| `/admin` | Admin | 管理后台，含本地媒体库管理 |

## 设计主题

全站采用深色主题：

- **背景色**：`#141414`（主背景）、`#0a0a0a`（顶栏/页脚）、`#1a1a1a`（卡片/输入框）
- **强调色**：`#f5c518`（金色，用于评分、Logo 高亮、按钮）
- **文字色**：`#e0e0e0`（主文字）、`#aaa` / `#888` / `#666`（次要文字）
- Ant Design 配置 `darkAlgorithm`，主色 `#f5c518`，圆角 8px

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 使用本地媒体库功能

1. 访问 `/admin` 页面
2. 点击"配置路径"按钮
3. 输入本地媒体文件夹路径（如 `E:\Media\Movies`）
4. 前往 [TMDB](https://www.themoviedb.org/) 注册并获取 API Key
5. 输入 API Key 并点击"测试"验证路径
6. 保存后系统将自动扫描文件夹并通过 TMDB 匹配影视信息
