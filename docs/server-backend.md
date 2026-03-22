# 服务端（FastAPI）

## 技术现状

- 框架：FastAPI
- 数据库：SQLite（SQLAlchemy）
- 任务：内置 Worker 线程（不是 Celery）
- 路由：`projects` / `characters` / `tasks` / `settings` / `assets`

## 启动

在 `backend/` 目录执行：

```bash
uv sync
uv run main.py
```

服务默认监听：`http://0.0.0.0:8000`

Swagger：`http://localhost:8000/docs`

## 数据库

- 使用 SQLite 文件。
- 配置来自 `backend/.env`：
  - `DATABASE_URL=sqlite:///./storage/dubflow.db`

## 说明

- 你当前项目以“真实代码”为准，API 文档需随实现同步维护。
- 删除项目时已考虑级联清理相关角色与资产。
