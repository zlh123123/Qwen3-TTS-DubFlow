

<div align="center">

<img src="docs/assets/branding/narratis-logo-wordmark.png" alt="Narratis App Icon" width="300" />

### Narratis

---

**A pipeline-oriented AI audio storytelling studio**
  
From script to finished audio: character analysis, voice design, studio editing, and batch TTS generation.

[![Python](https://img.shields.io/badge/python-3.12-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![Desktop](https://img.shields.io/badge/desktop-tauri-24C8DB)](https://tauri.app/)
[![API](https://img.shields.io/badge/backend-fastapi-009688)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[Desktop Guide](docs/client-desktop.md) • [Web Guide](docs/client-web.md) • [Server Guide](docs/server-backend.md) • [TTS Services](docs/tts-services.md) • [Docs Home](docs/README.md)

[中文文档](README_zh.md)

</div>

---

## Choose Your Track

| Track | Best for | Start here |
|---|---|---|
| Creator (Desktop-first) | Writers, dubbers, and solo creators | [Desktop Guide](docs/client-desktop.md) |
| Builder (Web + Backend) | Developers integrating UI and APIs | [Web Guide](docs/client-web.md) + [Server Guide](docs/server-backend.md) |
| Service Operator (TTS/LLM) | Local model runners and API provider integration | [TTS Services](docs/tts-services.md) |

## Core Workflow

1. Create a project and import script text.
2. Analyze roles and build character voice profiles.
3. Generate draft audio in batches.
4. Refine in Studio (timeline/editing capabilities expanding).
5. Export final assets.

## Notes

Narratis focuses on local workflow and local service orchestration.  
For operation details, always use the docs under `docs/` as the source of truth.

> [!IMPORTANT]
> This repository is Apache-2.0. Third-party model/API licenses are independent.  
> For Fish/Qwen and other providers, read [Model License Policy](docs/model-license-policy.md) before commercial use.

> [!WARNING]
> Voice generation and voice cloning may involve legal and privacy obligations in your region.

## Acknowledgements

- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- [vLLM](https://github.com/vllm-project/vllm)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Tauri](https://tauri.app/)

## License

Apache License 2.0. See [LICENSE](LICENSE).
