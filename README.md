# Qwen3-TTS-DubFlow

<div align="center">

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-compose-green)](https://www.docker.com/)

**Qwen3-TTS-DubFlow: Your AI-powered Audio Drama Studio**

[中文文档](README_zh.md)

</div>

## Introduction

Qwen3-TTS-DubFlow is a full-stack automated workflow designed to convert text into audio dramas. It leverages Large Language Models (LLM) for character analysis and script adaptation, combined with the **Qwen3-TTS** engine for high-quality voice synthesis, helping creators quickly transform **long novels, game scripts, and comic dialogues** into multi-character audio dramas.

### Core Workflow
Upload Novel -> AI Character Analysis -> Voice Design (Reroll) -> Script Editing -> Batch Synthesis -> Export Audio

## Features

| Feature | Description |
|---------|-------------|
| Character Analysis | Automatically extracts characters, personalities, and gender from the novel using LLM. |
| Voice Workshop | Customize character voices. Support "Reroll" to generate the perfect timbre and lock it. |
| Studio Editor | A professional script editor to assign roles, modify lines, and adjust speech speed. |
| Async Processing | Built on Celery + Redis for stable, non-blocking batch synthesis tasks. |
| Docker Ready | One-click deployment for Frontend, Backend, Database, and Redis using Docker Compose. |

## Architecture

- Frontend: React (Hooks, Axios)
- Backend: FastAPI (Python 3.12)
- Async Queue: Celery + Redis
- Database: SQLite (SQLAlchemy)
- AI Inference: vLLM (Qwen3-TTS)
- DevOps: Docker, Nginx, uv (Python Package Manager)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- NVIDIA GPU + NVIDIA Container Toolkit (For local AI inference)
- Node.js v22.14.0 (npm v10.9.2) if running locally without Docker

### Installation
1. Clone the repository
   ```bash
   git clone --recursive https://github.com/zlh123123/Qwen3-TTS-DubFlow.git
   cd Qwen3-TTS-DubFlow
   ```

2. Environment Setup
   Create a `.env` file in `backend/` directory (copy from example).
   ```bash
   cp backend/.env.example backend/.env
   # Database and Redis settings are configured here
   ```

3. Launch with Docker
   ```bash
   docker-compose up --build -d
   ```

4. Access the App
   - Frontend: `http://localhost:3000` (or configured port)
   - Backend API: `http://localhost:8000`
   - *Note: API Keys and Model Paths are configured in the Frontend Settings UI.*

## API Documentation

Detailed API documentation is available via Swagger UI when the backend is running:

- **Local Development**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Nginx Proxy**: [http://localhost/docs](http://localhost/docs)

See [backend/routers](backend/routers) for implementation details.

## Development

If you want to contribute or develop without Docker:

### Backend (Python)
We use uv for blazing fast package management.
```bash
# Install uv
pip install uv

# Setup Backend
cd backend
uv init
uv sync  # Install dependencies from uv.lock

# Run Redis (Required)
docker run -p 6379:6379 -d redis:alpine

# Run Worker (Terminal 1)
uv run celery -A celery_app worker --loglevel=info --pool=solo

# Run Server (Terminal 2)
uv run uvicorn main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
Qwen3-TTS-DubFlow/
├── frontend/                   # React Frontend Source
│   ├── Dockerfile              # Frontend Build Image
│   ├── nginx.conf              # Nginx Config
│   └── src/                    # Source Code
│
├── backend/                    # FastAPI Backend Source
│   ├── models/                 # Database Models (SQLAlchemy)
│   ├── schemas/                # Pydantic Schemas (API Contract)
│   ├── routers/                # API Routes
│   ├── tasks.py                # Celery Async Tasks
│   └── main.py                 # App Entry
│
├── storage/                    # Local File Storage
│   ├── uploads/                # Original Novels
│   ├── temp/                   # Temporary Audio
│   └── {project_id}/           # Project Specific Assets
│
└── docker-compose.yml          # Deployment Config
```

## Roadmap

### v1.1 - Workflow & Format Expansion
- [ ] **Batch Export**: Support zip archive export by chapter/character.
- [ ] **Subtitle Generation**: SRT/ASS export based on timestamps.
- [ ] **Multi-format Support**: Import EPUB, PDF, DOCX.
- [ ] **Rhythm Control**: Custom silence duration and breathing adjustments.

### v1.5 - Performance & Scalability
- [ ] **Parallel Splitting**: Multi-threaded LLM script splitting for speed.
- [ ] **Heterogeneous Backend**: Support for AutoDL tunneling and third-party API integration.
- [ ] **Ultra-long Text Analysis**: Optimized context management for million-word novels.

### v2.0 - Professional Studio
- [ ] **BGM/SFX Integration**: Automated/manual background music and sound effects.
- [ ] **Visual Waveform Editor**: Browser-based non-linear editing (NLE) timeline.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

This project stands on the shoulders of giants. We would like to thank the following open-source projects:

*   **[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)** - The core TTS engine.
*   **[vLLM](https://github.com/vllm-project/vllm)** - High-throughput and memory-efficient inference engine.
*   **[FastAPI](https://fastapi.tiangolo.com/)** - High performance backend framework.
*   **[React](https://react.dev/)** - Frontend UI library.
*   **[Celery](https://docs.celeryq.dev/)** - Distributed task queue.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
