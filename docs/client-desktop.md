# 客户端（桌面版）

## 目标

使用 Tauri 打包前端，并在应用启动时拉起本地 FastAPI sidecar。

## 前置条件

- macOS / Windows / Linux
- Rust 工具链（`cargo`、`rustc`）
- Node.js `v22+`
- Python `3.12+`（用于后端 sidecar）

## 开发模式启动

在 `frontend/` 目录执行：

```bash
npm install
npm run desktop:dev
```

说明：

- 会启动 Vite dev server + Tauri 桌面窗口。
- 会自动尝试拉起 `backend/main.py`（优先 `.venv/bin/python`）。

## 打包

```bash
npm run desktop:build
```

## 常见问题

- `cargo metadata ... No such file or directory`：未安装 Rust 或环境变量未生效。
- 打开应用但设置页空白：先升级到最新代码并重启 `desktop:dev`。
- sidecar 启动失败：单独在 `backend/` 执行 `uv run main.py` 观察错误。
