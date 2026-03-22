

<div align="center">

<img src="docs/assets/branding/narratis-logo-wordmark.png" alt="Narratis App Icon" width="300" />

### Narratis

---

**面向流水线处理的 AI 音频叙事工作台**
  
从脚本到成品音频：角色分析、音色设计、演播室编辑与批量合成。

[![Python](https://img.shields.io/badge/python-3.12-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![Desktop](https://img.shields.io/badge/desktop-tauri-24C8DB)](https://tauri.app/)
[![API](https://img.shields.io/badge/backend-fastapi-009688)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[桌面端指南](docs/client-desktop.md) • [Web 端指南](docs/client-web.md) • [服务端指南](docs/server-backend.md) • [TTS 服务接入](docs/tts-services.md) • [文档总览](docs/README.md)

[English](README.md)

</div>

---

## 选择你的路径

| 路径 | 适合人群 | 入口文档 |
|---|---|---|
| 创作者（桌面端优先） | 配音、内容创作者、个人用户 | [客户端（桌面版）](docs/client-desktop.md) |
| 开发者（Web + 服务端） | 需要联调前后端与 API 的开发者 | [客户端（Web 版）](docs/client-web.md) + [服务端（FastAPI）](docs/server-backend.md) |
| 服务接入（TTS/LLM） | 本地模型部署与外部 API 接入 | [AI TTS 服务接入](docs/tts-services.md) |

## 核心流程

1. 新建项目并导入文本脚本。
2. 进行角色分析并建立音色档案。
3. 批量生成草稿音频。
4. 在演播室进行编辑（时间轨能力持续增强）。
5. 导出最终素材。

## 注意事项

Narratis 当前以本地工作流和本地服务编排为主。  
具体操作细节统一以 `docs/` 中的文档为准。

> [!IMPORTANT]
> 本仓库代码采用 Apache-2.0。第三方模型/API 许可证独立生效。  
> Fish/Qwen 等 Provider 的商用与分发请先看：[模型与服务许可证策略](docs/model-license-policy.md)。

> [!WARNING]
> 音色克隆、语音生成与数据上传可能涉及版权和隐私合规责任，请在本地法规下使用。

## 致谢

- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- [vLLM](https://github.com/vllm-project/vllm)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Tauri](https://tauri.app/)

## 开源协议

本项目采用 Apache License 2.0，详见 [LICENSE](LICENSE)。
