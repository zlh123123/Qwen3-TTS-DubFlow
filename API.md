# 概述

核心流程：用户上传小说 -> LLM 分析角色 -> 用户确认角色音色 -> 进入演播室做台词映射与批量合成 -> 全部完成后进入剪辑台做时间轨与后期处理。

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
│       ├── pages/Studio.jsx
│       └── pages/TimelineBoard.jsx
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
│       ├── assets/{character_refs|effects|bgms}/...
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

## 页面 3：演播室（已接入脚本与合成接口）

- 台词流编辑（前端有对应调用）
- 单句/批量合成
- 过期音频检测与处理（保留 / 清空 / 重新合成）

## 页面 4：剪辑台（Timeline）

- 默认按文章顺序上轨（对白轨）
- 长文本自动分段（避免单屏时间轴过长）
- 仅当“角色已确认 + 批量合成完成 + 无过期音频”时允许进入

## 设置

- LLM / TTS / 外观配置读写

## 流程门禁（当前实现）

1. 角色工坊 -> 演播室
- 必须存在角色且全部 `is_confirmed=true`

2. 演播室 -> 剪辑台
- 必须所有台词都已合成
- 且不存在过期音频（角色音色版本变化导致）

3. 已合成后改音色
- 若角色音色关键字段变更（如 `prompt/ref_text/ref_audio_path/description/...`），角色会自动退回未确认并增加音色版本
- 已合成台词会标记为 stale（过期），进入演播室时弹窗要求处理：
  - `keep`：保留音频并更新版本对齐
  - `clear`：清空过期音频并回到待合成
  - `resynthesize`：按新音色重合成过期台词

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
| voice_revision | Integer | 音色版本（字段变化自动 +1） |
| ref_audio_path | String | 当前确认参考音 |
| duration | Float | 时长 |
| ref_text | String | 参考文本 |

## ScriptLine

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | Integer | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| character_id | String(FK) | 关联 Character（SET NULL） |
| order_index | Integer | 台词顺序 |
| text | Text | 台词文本 |
| speed | Float | 语速倍率 |
| audio_path | String | 合成音频路径 |
| duration | Float | 音频时长 |
| status | String | `pending` / `processing` / `synthesized` / `failed` |
| last_synth_voice_revision | Integer | 最后一次合成使用的角色音色版本 |

## CharacterRefAsset（全局角色参考音资产）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
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

## EffectAsset（全局环境音/音效资产）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
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

## BgmAsset（全局 BGM 资产）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
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

## ProjectCharacterRefAssetLink（项目-角色语音引用）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| asset_id | String(FK) | 关联 CharacterRefAsset（CASCADE） |
| character_id | String(FK) | 关联 Character（SET NULL） |
| created_at | DateTime | 创建时间 |
| unique(project_id, asset_id) | 约束 | 一个项目只引用一次同一资产 |

## ProjectEffectAssetLink（项目-环境音引用）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| asset_id | String(FK) | 关联 EffectAsset（CASCADE） |
| created_at | DateTime | 创建时间 |
| unique(project_id, asset_id) | 约束 | 一个项目只引用一次同一资产 |

## ProjectBgmAssetLink（项目-BGM 引用）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | String(UUID) | 主键 |
| project_id | String(FK) | 关联 Project（CASCADE） |
| asset_id | String(FK) | 关联 BgmAsset（CASCADE） |
| created_at | DateTime | 创建时间 |
| unique(project_id, asset_id) | 约束 | 一个项目只引用一次同一资产 |

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

### 重命名项目
- `PUT /api/projects/{project_id}`
- 请求体示例：
```json
{
  "name": "新的项目名称"
}
```

### 删除项目
- `DELETE /api/projects/{project_id}`
- 会删除项目记录、项目引用关系和 `storage/projects/{project_id}` 目录
- 不会删除全局素材（`storage/assets/...`）

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

## 页面 3：演播室（Script / Synthesis）

### 获取剧本台词
- `GET /api/projects/{project_id}/script`
- 返回字段包含：
  - `is_stale`（是否过期）
  - `stale_reason`（`voice_changed` / `character_missing`）
  - `last_synth_voice_revision`

### 新增台词
- `POST /api/projects/{project_id}/script/lines`

### 更新台词
- `PUT /api/script/{line_id}`
- 若修改 `text/character_id/speed`，会自动把该行重置为待合成

### 删除台词
- `DELETE /api/script/{line_id}`

### 重排台词顺序
- `PUT /api/projects/{project_id}/script/reorder`

### 批量/单句合成
- `POST /api/synthesis`
- 请求示例：
```json
{
  "project_id": "project_uuid",
  "line_ids": [1001, 1002, 1003]
}
```

### 获取流程状态（门禁核心接口）
- `GET /api/projects/{project_id}/pipeline-status`
- 关键返回字段：
  - `can_enter_studio`
  - `can_enter_timeline`
  - `stale_total`
  - `stale_characters`
  - `stale_lines_preview`
  - `timeline_segments`

### 处理过期音频
- `POST /api/projects/{project_id}/synthesis/stale-audio/resolve`
- 请求示例：
```json
{
  "action": "keep"
}
```
- `action` 可选：
  - `keep`
  - `clear`
  - `resynthesize`

---

## 资产库：全局资产 + 项目引用

当前实现是双层结构：

- 全局资产层：真实音频资产，跨项目复用
- 项目引用层：项目只保存“引用关系”，删除项目不会删全局资产

### Character Ref Assets

- 项目引用列表：`GET /api/projects/{project_id}/character-refs`
- 全局列表（可带 project_id 返回 is_linked 状态）：`GET /api/assets/character-refs`
- 导入到全局并自动引用当前项目：`POST /api/projects/{project_id}/character-refs/import`
- 引用全局资产到项目：`POST /api/projects/{project_id}/character-refs/link`
- 更新项目引用（角色绑定）：`PUT /api/projects/{project_id}/character-refs/{asset_id}/link`
- 取消项目引用：`DELETE /api/projects/{project_id}/character-refs/{asset_id}/link`
- 更新全局资产元信息：`PUT /api/character-refs/{asset_id}`
- 删除全局资产（影响所有项目）：`DELETE /api/character-refs/{asset_id}`

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

引用请求示例：

```json
{
  "asset_id": "asset_uuid",
  "character_id": "char_uuid"
}
```

### Effect Assets

- 项目引用列表：`GET /api/projects/{project_id}/effects`
- 全局列表：`GET /api/assets/effects`
- 导入到全局并自动引用当前项目：`POST /api/projects/{project_id}/effects/import`
- 引用全局资产到项目：`POST /api/projects/{project_id}/effects/link`
- 取消项目引用：`DELETE /api/projects/{project_id}/effects/{asset_id}/link`
- 更新全局资产元信息：`PUT /api/effects/{asset_id}`
- 删除全局资产：`DELETE /api/effects/{asset_id}`

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

- 项目引用列表：`GET /api/projects/{project_id}/bgms`
- 全局列表：`GET /api/assets/bgms`
- 导入到全局并自动引用当前项目：`POST /api/projects/{project_id}/bgms/import`
- 引用全局资产到项目：`POST /api/projects/{project_id}/bgms/link`
- 取消项目引用：`DELETE /api/projects/{project_id}/bgms/{asset_id}/link`
- 更新全局资产元信息：`PUT /api/bgms/{asset_id}`
- 删除全局资产：`DELETE /api/bgms/{asset_id}`

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

## 后期处理（PostFX / Pedalboard）

> 用于对白/环境音后处理：预设管理、实时预览、生成后落盘应用。

### 预设管理

- 获取预设列表：`GET /api/postfx/presets`
- 创建自定义预设：`POST /api/postfx/presets`
- 更新自定义预设：`PUT /api/postfx/presets/{preset_id}`
- 删除自定义预设：`DELETE /api/postfx/presets/{preset_id}`

系统内置 4 个预设（只读）：
- `builtin_robot`（机器人）
- `builtin_broadcast`（广播）
- `builtin_echo_chamber`（回声室）
- `builtin_deep_voice`（低沉声音）

创建预设请求示例：

```json
{
  "name": "我的科幻音色",
  "config": {
    "pitch_shift_semitones": 4,
    "gain_db": -1,
    "highpass_hz": 120,
    "lowpass_hz": 9000,
    "reverb": { "enabled": true, "room_size": 0.3, "damping": 0.5, "wet_level": 0.2, "dry_level": 0.9 },
    "delay": { "enabled": false, "delay_seconds": 0.2, "feedback": 0.2, "mix": 0.2 },
    "modulation": { "enabled": true, "mode": "flanger", "rate_hz": 0.8, "depth": 0.6, "centre_delay_ms": 2.5, "feedback": 0.5, "mix": 0.35 },
    "compressor": { "enabled": true, "threshold_db": -20, "ratio": 4, "attack_ms": 4, "release_ms": 120 }
  }
}
```

### 角色默认预设（用于角色级默认后期）

- 获取项目角色默认预设：`GET /api/postfx/projects/{project_id}/character-defaults`
- 设置角色默认预设：`PUT /api/postfx/characters/{character_id}/default`

设置请求示例：

```json
{
  "preset_id": "preset_uuid_or_null"
}
```

### 实时预览与落盘应用

- 实时预览（返回临时音频 URL）：`POST /api/postfx/preview`
- 应用后期并写入项目目录：`POST /api/postfx/apply`

预览请求示例：

```json
{
  "source_path": "/static/projects/{project_id}/voices/line_1.wav",
  "preset_id": "preset_uuid",
  "config_override": {
    "gain_db": 2.5
  }
}
```

应用请求示例：

```json
{
  "project_id": "project_uuid",
  "source_path": "/static/projects/{project_id}/voices/line_1.wav",
  "preset_id": "preset_uuid",
  "config_override": {
    "pitch_shift_semitones": -2
  },
  "output_name": "line_1_postfx.wav"
}
```

支持效果（8 类）：
- 变调（Pitch Shift，±12 semitones）
- 混响（Reverb）
- 延迟（Delay）
- 合唱 / 弗兰德（Chorus / Flanger）
- 压缩器（Compressor）
- 增益（Gain，-40~+40 dB）
- 高通滤波器（High-pass）
- 低通滤波器（Low-pass）

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

- `GET /api/projects/{project_id}/timeline`
- `PUT /api/projects/{project_id}/timeline`
- `POST /api/projects/{project_id}/timeline/render`

说明：当前剪辑台以本地前端状态 + PostFX 接口为主，上述“工程化时间轨存储/渲染导出”接口仍是下一阶段规划。

---

# 未来更新内容（建议）

- 时间轨工程持久化与渲染导出接口落地
- 资产库标签/搜索/去重
- 角色参考音历史版本与回滚
- 任务取消与失败恢复
- 批量导出（zip）与工程打包
