# 前端开发部署指南

本地开发建议：

- Node.js `v22.14.0`
- npm `v10.9.2`

## 1. 安装依赖

```bash
npm install
```

## 2. Web 模式启动（仅前端）

```bash
npm run dev
```

## 3. 桌面模式启动（Tauri）

前置依赖：

- 已安装 Rust 工具链（`cargo` / `rustc` 可用）
- 首次运行会自动编译 Rust 依赖，耗时会更长
- 如果刚安装完 Rust，先执行：`source "$HOME/.cargo/env"`（或重开终端）

启动命令：

```bash
npm run desktop:dev
```

桌面模式下会自动尝试拉起本地后端 sidecar（优先使用 `backend/.venv/bin/python main.py`，失败时回退 `python3/python`）。

打包命令：

```bash
npm run desktop:build
```

## 4. 构建前端静态资源

```bash
npm run build
```

说明：

- `desktop:dev` 会自动启动前端 dev server + Tauri 桌面窗口。
- 若 sidecar 启动失败，可手动在另一个终端执行 `cd ../backend && uv run main.py`。
