# 概述

核心流程：用户上传小说 -> LLM 分析角色 -> 用户调整角色并生成/导入参考音 -> 进入演播室做台词与音频资产管理 -> 逐句/批量合成（脚本与合成接口待补齐）。

技术栈：

- 前端：React
- 后端：FastAPI + SQLite
- 任务执行：后端内置 Worker 线程（非 Celery）
- TTS：`autodl` / `local_vllm` / `aliyun`（当前已接入角色试听链路）

---

# 文件树（当前实现）

```text
Narratis/
├── frontend/
│   └── src/
│       ├── api/endpoints.js
│       ├── pages/CreateProject.jsx
│       ├── pages/Workshop.jsx
│       └── pages/Studio.jsx
│
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database/
│   │   ├── database.py       # SQLite 连接 + 全部 ORM 模型
│   │   └── init_db.py        # 建表脚本
│   ├── routers/
│   │   ├── projects.py
│   │   ├── characters.py
│   │   ├── tasks.py
│   │   ├── config.py
│   │   └── assets.py         # character-ref/effect/bgm 资产接口
│   ├── workers/
│   │   ├── worker.py
│   │   ├── analyze_characters.py
│   │   └── synthesis_voicedesign.py
│   └── storage/
│       ├── database.db
│       ├── temp/
│       └── projects/{project_id}/...
```

---

# 前端功能（产品视角）

## 页面 1：项目仪表盘

- 新建项目（TXT 内容汇总）
- 列表查看项目状态
- 根据状态进入角色工坊

## 页面 2：角色工坊

- 角色增删改
- 角色试听（异步任务）
- 角色音色确认（可回退，字段变更后要求重确认）

## 页面 3：演播室（UI 已有，后端脚本/合成接口待补齐）

- 台词流编辑（前端有对应调用）
- 单句/批量合成按钮（后端接口暂未实现）
- 时间轨（规划中）：支持类似 Premiere Pro 的多轨排布（人声轨 / BGM 轨 / 环境音轨 / 音效轨）、片段拖拽、对齐吸附、裁剪、淡入淡出和音量包络
- 时间轨不在当前迭代实现，仅先在产品与 API 设计中占位

## 设置

- LLM / TTS / 外观配置读写

---

# 桌面版左侧导航建议（你当前需求）

你提到的“打包桌面应用左侧到底有什么选项、逻辑怎么走”，建议固定为 5 个一级入口：

1. 项目（Projects）
- 新建/打开项目

2. 角色与音色（Characters）
- 角色编辑
- 音色设计（生成）
- 角色参考音导入（导入）
- 已确认参考音管理

3. 资产库（Assets）
- Effect（环境音/音效）
- BGM
- 资产标签、试听、删除

4. 演播室（Studio）
- 台词、角色映射、批量合成

5. 设置（Settings）
- 模型服务、下载状态、日志、API Key

结论：音色设计功能属于“角色与音色”主流程，不放在通用资产库里；资产库主要存可复用音频（Effect/BGM），角色参考音走单独表和单独入口。

---

# 数据库设计（当前重构方案）

> 已按你要求拆分，不再使用单一 `media_assets` 通用表。

## Project

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| name | String | 项目名称 |
| language | String | 语言 |
| raw_content | Text | 原文 |
| created_at | DateTime | 创建时间 |
| state | String | 状态机字段 |

## Character

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| name | String | 角色名 |
| gender | String | 性别 |
| age | String | 年龄/描述 |
| description | Text | 人设描述 |
| prompt | Text | 音色提示 |
| is_confirmed | Boolean | 是否确认 |
| ref_audio_path | String | 当前确认参考音 |
| duration | Float | 时长 |
| ref_text | String | 参考文本 |

## CharacterRefAsset（角色参考音资产）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| character_id | String(FK) | 关联 Character（SET NULL） |
| source_type | String | `imported` / `generated` / `voice_design` |
| display_name | String | 显示名 |
| file_path | String | 文件路径 |
| file_format | String | 文件格式 |
| file_size | Integer | 文件大小 |
| duration | Float | 时长 |
| sample_rate | Integer | 采样率 |
| channels | Integer | 声道数 |
| managed_file | Boolean | 是否托管 |
| note | Text | 备注 |
| created_at | DateTime | 创建时间 |
| character_name_snapshot | String | 导入时角色名快照 |
| character_gender_snapshot | String | 导入时性别快照 |
| character_age_snapshot | String | 导入时年龄快照 |
| character_description_snapshot | Text | 导入时人设快照 |
| character_prompt_snapshot | Text | 导入时音色提示快照 |
| character_ref_text_snapshot | Text | 导入时参考文本快照 |

## EffectAsset（环境音/音效）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| source_type | String | `imported` / `generated` |
| effect_category | String | `ambience` / `effect` |
| display_name | String | 显示名 |
| file_path | String | 文件路径 |
| file_format | String | 文件格式 |
| file_size | Integer | 文件大小 |
| duration | Float | 时长 |
| sample_rate | Integer | 采样率 |
| channels | Integer | 声道数 |
| managed_file | Boolean | 是否托管 |
| note | Text | 备注 |
| created_at | DateTime | 创建时间 |

## BgmAsset

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| source_type | String | `imported` / `generated` |
| display_name | String | 显示名 |
| file_path | String | 文件路径 |
| file_format | String | 文件格式 |
| file_size | Integer | 文件大小 |
| duration | Float | 时长 |
| sample_rate | Integer | 采样率 |
| channels | Integer | 声道数 |
| bpm | Float | BPM（可选） |
| mood | String | 情绪标签（可选） |
| managed_file | Boolean | 是否托管 |
| note | Text | 备注 |
| created_at | DateTime | 创建时间 |

## Task

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| type | String | `analyze_char` / `synthesis_voicedesign` |
| status | String | `pending` / `processing` / `success` / `failed` |
| payload | JSON | 入参 |
| result | JSON | 结果 |
| error_msg | Text | 错误 |
| created_at | DateTime | 创建时间 |

## Config

| 字段名 | 类型 | 说明 |
|---|---|---|
| key | String(PK) | 唯一键 |
| value | Text | 配置值 |
| group | String | 配置分组 |
| label | String | 显示文案 |
| type | String | 控件类型 |
| options | JSON | 选项 |
| default | String | 默认值 |
| is_public | Boolean | 是否对前端可见 |

---

# API 文档（当前实现）

## 页面 1：项目仪表盘

### 创建项目
- `POST /api/projects`

### 获取项目列表
- `GET /api/projects`
- 返回数组（不是 `{total, items}`）

### 获取项目详情
- `GET /api/projects/{project_id}`

### 删除项目
- `DELETE /api/projects/{project_id}`
- 会删除数据库记录和 `storage/projects/{project_id}` 目录

### 触发角色分析（异步）
- `POST /api/projects/{project_id}/characters/analyze`
- 返回：`{ "task_id": "..." }`

---

## 页面 2：角色工坊

### 获取角色列表
- `GET /api/projects/{project_id}/characters`

### 新建角色
- `POST /api/characters/`

### 更新角色
- `PUT /api/characters/{character_id}`
- 支持：`name/gender/age/description/prompt/ref_text/is_confirmed/ref_audio_path/duration`

### 删除角色
- `DELETE /api/characters/{character_id}`

### 试听生成（异步）
- `POST /api/characters/{character_id}/voice`
- 当前实现：不接 body，直接读取角色当前字段
- 返回：`{ "task_id": "..." }`

---

## 资产库：角色参考音 / 环境音 / BGM

### Character Ref Assets

- `GET /api/projects/{project_id}/character-refs`
- `POST /api/projects/{project_id}/character-refs/import`
- `PUT /api/character-refs/{asset_id}`
- `DELETE /api/character-refs/{asset_id}`

导入请求示例：

```json
{
  "source_path": "/Users/xxx/Desktop/ref.wav",
  "character_id": "char_uuid",
  "display_name": "萧炎-参考音1",
  "copy_to_project": true,
  "source_type": "imported",
  "note": "第一版"
}
```

### Effect Assets

- `GET /api/projects/{project_id}/effects`
- `POST /api/projects/{project_id}/effects/import`
- `PUT /api/effects/{asset_id}`
- `DELETE /api/effects/{asset_id}`

导入请求示例：

```json
{
  "source_path": "/Users/xxx/Desktop/rain.wav",
  "effect_category": "ambience",
  "display_name": "雨声",
  "copy_to_project": true
}
```

### BGM Assets

- `GET /api/projects/{project_id}/bgms`
- `POST /api/projects/{project_id}/bgms/import`
- `PUT /api/bgms/{asset_id}`
- `DELETE /api/bgms/{asset_id}`

导入请求示例：

```json
{
  "source_path": "/Users/xxx/Desktop/intro.mp3",
  "display_name": "片头BGM",
  "bpm": 110,
  "mood": "warm",
  "copy_to_project": true
}
```

---

## Studio 时间轨（规划接口，占位）

> 以下接口为“规划接口”，当前后端尚未实现，仅用于先确定 API 契约。

### 获取时间轨工程

- `GET /api/projects/{project_id}/timeline`

响应示例：

```json
{
  "project_id": "pid",
  "fps": 30,
  "sample_rate": 48000,
  "duration_sec": 120.0,
  "tracks": [
    { "id": "track_voice_1", "type": "voice", "name": "角色对白", "locked": false, "muted": false },
    { "id": "track_bgm_1", "type": "bgm", "name": "BGM", "locked": false, "muted": false },
    { "id": "track_amb_1", "type": "ambience", "name": "环境音", "locked": false, "muted": false }
  ],
  "clips": [
    {
      "id": "clip_001",
      "track_id": "track_voice_1",
      "asset_type": "line_audio",
      "asset_id": "line_5001",
      "start_sec": 12.4,
      "duration_sec": 3.2,
      "offset_sec": 0.0,
      "gain": 1.0,
      "fade_in_sec": 0.05,
      "fade_out_sec": 0.12
    }
  ]
}
```

### 保存时间轨工程

- `PUT /api/projects/{project_id}/timeline`

请求体：完整 timeline 对象（建议整包保存，避免并发冲突）

### 导出时间轨混音

- `POST /api/projects/{project_id}/timeline/render`

响应示例：

```json
{ "task_id": "task_timeline_render_001" }
```

---

## 设置页

### 获取配置
- `GET /api/settings`

### 更新配置
- `PUT /api/settings`

请求示例：

```json
{
  "updates": [
    { "key": "llm.active_provider", "value": "deepseek" },
    { "key": "tts.backend", "value": "aliyun" }
  ]
}
```

---

## 通用轮询接口

### 查询异步任务
- `GET /api/tasks/{task_id}`

状态：
- `pending`
- `processing`
- `success`
- `failed`

---

# 当前缺口（未实现接口）

- `GET /api/projects/{project_id}/script`
- `POST /api/projects/{project_id}/script/parse`
- `PUT /api/script/{line_id}`
- `POST /api/synthesis`

以上前端已有调用，后端路由仍待补。

---

# 未来更新内容（建议）

- 脚本切分与合成接口补齐
- 资产库标签/搜索/去重
- 角色参考音历史版本与回滚
- 任务取消与失败恢复
- 批量导出（zip）与工程打包
