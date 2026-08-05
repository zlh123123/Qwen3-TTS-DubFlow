

<div align="center">

<img src="docs/assets/branding/narratis-logo-wordmark.png" alt="Icono de la aplicación Narratis" width="300" />

### Narratis

---

**Un estudio de narración de audio con IA orientado a pipelines**
  
Desde el guion hasta el audio final: análisis de personajes, diseño de voz, edición en estudio y generación de TTS por lotes.

[![Python](https://img.shields.io/badge/python-3.12-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![Desktop](https://img.shields.io/badge/desktop-tauri-24C8DB)](https://tauri.app/)
[![API](https://img.shields.io/badge/backend-fastapi-009688)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[Guía de Escritorio](docs/client-desktop.md) • [Guía Web](docs/client-web.md) • [Guía del Servidor](docs/server-backend.md) • [Servicios TTS](docs/tts-services.md) • [Inicio de la Documentación](docs/README.md)

[中文文档](README_zh.md)

</div>

---

## Elige tu ruta

| Ruta | Ideal para | Comienza aquí |
|---|---|---|
| Creador (Enfoque 1escritorio) | Escritores, dobladores y creadores independientes | [Guía de Escritorio](docs/client-desktop.md) |
| Constructor (Web + Backend) | Desarrolladores que integran UI y APIs | [Guía Web](docs/client-web.md) + [Guía del Servidor](docs/server-backend.md) |
| Operador de Servicio (TTS/LLM) | Ejecutores de modelos locales e integración de proveedores de API | [Servicios TTS](docs/tts-services.md) |

## Flujo de trabajo principal

1. Crea un proyecto e importa el texto del guion.
2. Analiza los roles y crea perfiles de voz para los personajes.
3. Genera audio en borrador por lotes.
4. Refina en el Estudio (capacidades de línea de tiempo y edición en expansión).
5. Exporta los activos finales.

## Notas

Narratis se centra en flujos de trabajo locales y en la orquestación de servicios locales.  
Para los detalles de operación, usa siempre la documentación bajo `docs/` como la fuente de verdad.

> [!IMPORTANT]
> Este repositorio está bajo la licencia Apache-2.0. Las licencias de modelos/API de terceros son independientes.  
> Para Fish/Qwen y otros proveedores, lee [Política de Licencias de Modelos](docs/model-license-policy.md) antes de usarlo comercialmente.

> [!WARNING]
> La generación y clonación de voz pueden implicar obligaciones legales y de privacidad en tu región.

## Reconocimientos

- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- [vLLM](https://github.com/vllm-project/vllm)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Tauri](https://tauri.app/)

## Licencia

Licencia Apache 2.0. Consulta [LICENSE](LICENSE).
