# Qwen3-TTS-DubFlow

<div align="center">

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-compose-green)](https://www.docker.com/)

**Qwen3-TTS-DubFlow：你的 AI 广播剧自动化工坊**

[English](README.md)

</div>

## 项目介绍

Qwen3-TTS-DubFlow 是一个全栈式的广播剧自动化制作工作流。它利用大语言模型（LLM）进行深入的角色分析和剧本改编，并结合 Qwen3-TTS 引擎进行高质量的语音合成，帮助创作者将长篇小说、游戏剧本、漫画对话等创作题材快速转化为多人有声剧。

### 核心流程
上传小说 -> AI 角色分析 -> 音色铸造 (Reroll) -> 剧本演播室 -> 批量合成 -> 导出音频

## 核心特性

| 功能模块 | 说明 |
|----------|------|
| AI 角色分析 | 利用 LLM 自动提取小说中的角色、性格、性别及年龄特征。 |
| 角色工坊 | 自定义角色音色。支持“Reroll”机制生成完美声线并定妆。 |
| 演播室 | 专业的剧本编辑器，支持指派角色、修改台词、调整语速。 |
| 异步处理 | 基于 Celery + Redis 构建，稳定处理耗时的批量合成任务。 |
| 容器化部署 | 支持 Docker Compose 一键拉起前端、后端、数据库及中间件。 |

## 技术架构

- 前端: React (Hooks, Axios)
- 后端: FastAPI (Python 3.12)
- 异步队列: Celery + Redis
- 数据库: SQLite (SQLAlchemy)
- AI 推理: vLLM (Qwen3-TTS)
- DevOps: Docker, Nginx, uv (Python 包管理器)

## 快速开始

### 前置要求
- Docker & Docker Compose
- NVIDIA GPU + NVIDIA Container Toolkit (仅本地 AI 推理需要)
- Node.js v22.14.0 (npm v10.9.2) 如需本地运行前端

### 安装步骤
1. 克隆仓库
   ```bash
   git clone --recursive https://github.com/zlh123123/Qwen3-TTS-DubFlow.git
   cd Qwen3-TTS-DubFlow
   ```

2. 环境配置
   在 `backend/` 目录下创建 `.env` 文件（从示例文件复制）。
   ```bash
   cp backend/.env.example backend/.env
   # 数据库及Redis配置在此文件中
   ```

3. 使用 Docker 启动
   ```bash
   docker-compose up --build -d
   ```

4. 访问应用
   - 前端页面: `http://localhost:3000` (或配置端口)
   - 后端服务: `http://localhost:8000`
   - *注意：API 密钥或本地模型路径请在前端设置页面进行配置。*

## API 文档

后端服务启动后，可以通过 Swagger UI 查看完整的 API 接口文档：

- **本地开发**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Nginx 代理**: [http://localhost/docs](http://localhost/docs)

详细接口定义请参考 [backend/routers](backend/routers)。

## 本地开发指南

如果您希望在本地进行开发（非 Docker 模式），请参考以下步骤：

### 后端 (Python)
我们推荐使用 uv 进行极速依赖管理。

```bash
# 安装 uv
pip install uv

# 初始化后端环境
cd backend
uv init
uv sync  # 根据 uv.lock 安装依赖

# 启动 Redis (必须)
docker run -p 6379:6379 -d redis:alpine

# 启动 Worker (终端 1 - 处理 AI 任务)
uv run celery -A celery_app worker --loglevel=info --pool=solo

# 启动 Server (终端 2 - Web 服务)
uv run uvicorn main:app --reload
```

### 前端 (React)
```bash
cd frontend
npm install
npm run dev
```

## 目录结构

```
Qwen3-TTS-DubFlow/
├── frontend/                   # [前端] React 项目目录
│   ├── Dockerfile              # 前端构建镜像
│   ├── nginx.conf              # Nginx 配置
│   └── src/                    # 源码目录
│
├── backend/                    # [后端] FastAPI 项目目录
│   ├── models/                 # [ORM模型] (SQLAlchemy)
│   ├── schemas/                # [数据校验模型] (Pydantic)
│   ├── routers/                # [API路由]
│   ├── tasks.py                # [异步核心] Celery 任务
│   └── main.py                 # 应用入口
│
├── storage/                    # [存储] 本地文件存储
│   ├── uploads/                # 原始小说
│   ├── temp/                   # 临时音频
│   └── {project_id}/           # 项目相关资源
│
└── docker-compose.yml          # 部署配置
```

## 开发路线图

### v1.1 - 工作流优化与格式扩展
- [ ] **批量打包导出**：按章节/角色归档，一键导出 ZIP。
- [ ] **字幕生成**：基于时间戳自动生成 SRT/ASS 字幕。
- [ ] **多格式支持**：兼容 EPUB, PDF, DOCX 等文档导入。
- [ ] **节奏控制**：自定义句间静音时长与呼吸感调整。

### v1.5 - 性能与架构升级
- [ ] **并行切分加速**：引入多线程机制，大幅提升剧本切分效率。
- [ ] **异构后端接入**：支持 AutoDL 穿透及阿里云等第三方 API 接入。
- [ ] **超长文本分析**：优化百万字级长篇小说的分段增量分析。

### v2.0 - 专业演播室
- [ ] **音效集成**：支持 BGM 与环境音效 (SFX) 的混合编辑。
- [ ] **可视化波形编辑**：引入 Web 端非线性编辑轨道，支持拖拽剪辑。

## 贡献指南

欢迎提交 Issue 或 Pull Request 来改进本项目！

## 致谢

本项目建立在以下伟大的开源项目之上：

*   **[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)** - 如果没有阿里的开源模型，本项目将不复存在。
*   **[vLLM](https://github.com/vllm-project/vllm)** - 提供了极其强大的推理加速能力。
*   **[FastAPI](https://fastapi.tiangolo.com/)** - 现代、快速（高性能）的 Web 框架。
*   **[React](https://react.dev/)** - 构建用户界面的核心库。

## 开源协议

本项目采用 Apache License 2.0 协议 - 详情见 [LICENSE](LICENSE) 文件。