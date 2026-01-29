**Qwen3-DubFlow API 文档**

版本: v1.0.0
# 概述
核心流程：用户上传小说 -> LLM 分析角色 -> 用户确认/调整人设与声线 -> LLM 切分剧本 -> 批量/单句合成语音 -> 导出音频。
技术栈：
+ 前端：React
+ 后端：FastAPI + Celery + Redis + SQLite
+ AI：vLLM （推理Qwen3-TTS）

# 文件树

```

Qwen3-DubFlow/
├── frontend/                   # [前端] React 项目目录
│   ├── Dockerfile              # [新增] 前端构建镜像 (Node build -> Nginx serve)
│   ├── nginx.conf              # [新增] Nginx 配置 (反向代理 /api 到后端)
│   ├── src/
│   │   ├── api/                # [API] 封装 axios 请求 (projects.js, tasks.js)
│   │   ├── hooks/              # [Hooks] 自定义 Hooks (useTaskPoller.js)
│   │   └── pages/              # [页面] (CreateProject, CharacterWorkshop, Studio)
│   └── ...
│
├── storage/                    # [存储] 本地文件存储根目录
│   ├── uploads/                # 存放用户上传的原始小说 (.txt)
│   ├── temp/                   # 存放试听/Reroll产生的临时音频 (定期清理)
│   ├── {project_id}/voices/    # 存放已确认的角色参考音频 (Ref Audio)
│   └── {project_id}/outputs/   # 存放最终合成的成品音频
│
├── backend/                    # [后端] FastAPI 项目目录
│   ├── .env                    # [配置] 基础设施环境变量 (DB, Redis, API Keys)
│   ├── pyproject.toml          # [依赖] uv配环境
│   ├── uv.lock                 # [依赖] uv配环境
│   ├── Dockerfile              # [部署] 后端镜像构建文件
│   ├── docker-compose.yml      # [部署] 一键启动 Web + Worker + Redis
│   │
│   ├── main.py                 # [入口] FastAPI 启动文件, 挂载路由
│   ├── database.py             # [数据库] DB 连接会话 (SessionLocal)
│   ├── celery_app.py           # [任务队列] Celery 实例初始化
│   ├── tasks.py                # [异步核心] 定义 @celery.task (vLLM 推理, TTS 生成)
│   │
│   ├── models/                 # [ORM模型 - 存数据库用] (SQLAlchemy)
│   │   ├── project.py          # 对应数据库中的 Project 表
│   │   └── ...                 # Character表和ScriptLine表
│   │
│   ├── schemas/                # [数据校验模型 - 交互用] (Pydantic)
│   │   │                       # 说明：这是后端的"安检员"。
│   │   │                       # 1. 验证前端发来的 JSON 格式是否正确 (Request Schema)
│   │   │                       # 2. 定义返回给前端的 JSON 长什么样 (Response Schema)
│   │   ├── project.py          # 定义 ProjectCreate (入参校验), ProjectResponse (出参格式)
│   │   ├── character.py        # 定义 CharacterUpdate 等
│   │   └── common.py           # 定义通用的 TaskResponse
│   │
│   ├── routers/                # [API路由] 接口实现逻辑 (Controller 层)
│   │   ├── projects.py         # 实现 /api/projects 相关接口
│   │   ├── characters.py       # 实现 /api/characters 相关接口
│   │   ├── scripts.py          # 实现 /api/script 相关接口
│   │   ├── synthesis.py        # 实现 /api/synthesis 相关接口
│   │   └── tasks.py            # 实现 /api/tasks (通用轮询接口)
│   │
│   └── utils/                  # [工具]
│       ├── llm_helper.py       # 封装 LLM 调用逻辑
│       └── audio_helper.py     # 音频处理工具

```

# 前端功能

+ 用户打开前端页面时显示的第一个界面，提供一个文本输入框和一个文件输入的选项。文本输入框可以统计字数等；文件输入用户可以点击后选择本地路径的文件，或者将文件拖拽进去。v1版本仅支持小说。v1版本中仅支持单文件，且仅支持txt文件。
+ 第二个界面，仅显示角色列和对角色的修改控件。用户点击每个角色的卡片，即可在修改控件中修改由LLM生成的角色描述与需要合成的参考音频的文本，点击reroll后即可提交TTS任务。此处需要支持用户进行角色的增删。当用户确认所有角色的参考音频ok，可以通过点击按钮进到下一步
+ 第三个界面，显示角色列、对话列和控件列。用户点击角色卡片，可以在控件中看到角色描述、参考音频文本（可显示为灰底代表无法修改），并可听参考音频。用户点击对话卡片，可以在控件中修改需要合成的对话内容以及修改语速等，点击reroll后即可提交TTS任务。此外需要支持用户进行对话的增删。这里还可能存在对话与人物不对应的错误情况，在控件中需要提供修改策略。
+ 第三个界面需要有批量合成选项，同时也包括根据筛选条件批量合成的功能（即仅合成某个人物，不合成旁白等，可以通过多选框的形式构建）；批量导出在v1版不提供，批量合成会将音频保存至本地默认位置；还需要提供设置按钮，包括1、用户选择的文本LLM的类型（Qwen or Deepseek or 自己本地部署或其他模型）与API key，2、用户选择的TTS模型的提供方式（本地部署 or Autodl部署后穿透 or 调用阿里云API），v1版仅提供本地部署即可，3、一些外观功能（可视情况，v1版也可不提供），4、开源协议与版权说明

## 页面 1: 项目创建 

功能目标：接收用户输入，初始化项目。

UI 元素：

+ 文本输入框：支持粘贴文本，右下角实时显示字数统计。
+ 文件上传区：支持点击选择或拖拽 .txt 文件 (v1仅支持txt)。
+ “开始创作”按钮：点击后调用 Create Project 接口，成功后跳转至页面 2。
+ 此处需要支持用户自定义项目名称

## 页面 2: 角色工坊 

功能目标：确认由 LLM 分析出的角色设定，并定妆音色。

UI 布局：

+ 左侧：角色列表卡片（显示头像/名字）。
+ 右侧：编辑控件。

交互逻辑：

+ 初始化：进入页面自动触发 Analyze Characters 异步任务，显示 Loading，完成后渲染列表。
+ 角色编辑：点击角色卡片，右侧显示：

```
姓名 

性别

年龄

人设描述/Prompt (Text Area, 由 LLM 生成，可修改)

参考文本 (Text Area, 用于生成音色的台词，可修改)
```

+ 音色试听 (Reroll)：点击“试听/生成”按钮 -> 触发 TTS 任务 -> 播放临时音频。如果不满意，修改 Prompt 或参考文本后再次点击。
+ 确认音色：点击“确认使用” -> 将当前试听的音频锁定为该角色的 ref_audio。
+ 增删角色：列表底部提供“添加角色”按钮；卡片右上角提供“删除”按钮。
+ 下一步：当用户确认所有关键角色后，点击“生成剧本”跳转至页面 3。

## 页面 3: 演播室 

功能目标：精修台词，指派角色，合成最终音频。

UI 布局：三栏式布局

+ 左栏 (角色库)：显示所有可用角色（方便拖拽或查看）。
+ 中栏 (剧本流)：垂直滚动的对话卡片流。
+ 右栏 (控制台)：当前选中台词的详细参数。

交互逻辑：

+ 初始化：进入页面自动触发 Parse Script 异步任务。
+ 剧本卡片：每张卡片代表一句台词，显示 角色头像 + 台词文本。
+ 修改文本：直接点击文本编辑。
+ 修改角色：发现 LLM 分配错误时，点击头像从下拉框重新指派角色。
+ 单句合成：点击卡片上的“播放/重试”按钮，单独合成这一句。
+ 控制台 (右栏)：选中某句台词时，可修改该句的 语速 等参数。
+ 此外，还需要提供台词增删功能

批量操作：

+ 筛选合成：Checkbox 勾选“仅合成未完成的”、“仅合成主角”、“不用合成旁白”等，反正全都能选。
+ 全部合成：点击“批量合成” -> 触发后台队列。

## 设置弹窗 

LLM 设置：选择模型 (Qwen/Deepseek/本地部署)、填写 API Key。

TTS 设置：选择后端 (Local/Cloud)、显卡指定。（这个v1版不需要）

# 数据库设计

用户可以创建多个Project。在v1版下，即一个project对应一个小说的配音任务。其数据库构成为：

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | String (UUID) | 主键 |
| name | String | 项目名称 (通常是小说名，用户可以自定义) |
| raw_content | Text | 小说原始文本 |
| created_at | DateTime | 创建时间 |


每个Project中包含一张角色表和对话表。其构成为：

角色表：
Character (角色表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | Integer | 主键 |
| project_id | String (FK) | 外键关联 Project |
| name | String | 角色名 (如: 萧炎) |
| gender | String | male/female/还有那种虚拟的未知的 |
| age | String | 可以是数字，也可以是大致的描述，例如中年人 |
| description | Text | 人设描述 (用于 LLM 指令) |
| prompt | Text | 音色提示词 (Timbre Prompt) |
| ref_audio_path | String | 定妆音频路径 (用户确认后的 wav 路径) |
| duration | Float | 音频时长(秒)|
| ref_text | String | 生成定妆音频时用的那句话 |


对话表：

ScriptLine
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | Integer | 主键 |
| project_id | String (FK) | 外键关联 Project |
| character_id | Integer (FK)| 外键关联 Character |
| order_index | Integer | 台词顺序 (1, 2, 3...) |
| text | Text | 台词内容 |
| speed | Float | 语速 |
| audio_path | String | 合成后的音频路径 (未合成为 Null) |
| duration | Float | 音频时长(秒)|
| status | String | pending / synthesized / failed |


每个用户还有一张配置表。其配置为：

UserConfig (用户配置表)

| 字段名 | 类型 | 示例值 |
| :--- | :--- | :--- |
| key | String (PK) | llm_provider |
| value | String | deepseek |
| group | String | ai_settings |

除了用户配置表外，项目后端运行还需要一些配置，这些配置放在.env环境变量中，仅开发人员使用，普通用户不使用

+ .env中包括数据库地址、Redis 端口、密钥这些。由开发/运维人员管理，代码运行前就必须存在，一旦修改通常需要重启服务。
+ UserConfig则由用户在前端 UI 修改，实时生效，不需要重启服务。

# API文档

**所有请求体 (Request Body) 和响应体 (Response Body) 均为 JSON；耗时任务（如分析、合成）均采用 异步模式 (返回 task_id)。**

## 页面 1: 项目创建 

#### 创建项目

URL: POST /api/projects

Request:

```
{
  "name": "斗破苍穹第一章",
  "content": "这里是小说全文内容..."
}
```

Response:
```
{ "id": "uuid-gen-001", "name": "...", "created_at": "..." }
```

## 页面 2: 角色工坊

#### 调用LLM角色分析 (异步)

URL: POST /api/projects/{pid}/characters/analyze
传参为需要分析的project的id，触发 LLM 阅读小说并提取角色。
Response: { "task_id": "task_char_001" }

#### 获取角色列表

URL: GET /api/projects/{pid}/characters
Response:
```
[
  {
    "id": 101,
    "name": "萧炎",
    "gender": "male",
    "age":"18岁",
    "description": "坚毅的少年...",
    "ref_text": "三十年河东，三十年河西！",
    "ref_audio_url": "/static/voices/101_confirmed.wav" // 若未定妆则为 null
  }
]
```

#### 修改角色信息

URL: PUT /api/characters/{char_id}

Request:
```
{
  "name": "萧炎(修改版)",
 "gender": "male",
    "age":"18岁",
  "description": "声音更加低沉...",
  "ref_text": "莫欺少年穷！"
}
```

#### 音色试听/Reroll (异步)

URL: POST /api/voices/preview

根据当前参数生成一个临时音频，**不保存到数据库**。

Request:
```
{
  "character_id": 101,
  "text": "莫欺少年穷！", // 试听文本
  "instruct": "声音低沉，充满怒火" // 提示词
}
```

Response: { "task_id": "task_preview_001" }

前端轮询该任务成功后，会拿到一个临时 URL ( /static/temp/preview_xyz.wav这种)

#### 确认音色

URL: POST /api/characters/{char_id}/confirm_voice

用户对某次试听满意，将该临时文件固化为角色的参考音频。

Request:
```
{
  "temp_audio_task_id": "task_preview_001" // 指明是哪一次生成的结果
}
```

## 页面 3: 演播室 

#### 触发剧本切分 (异步)

URL: POST /api/projects/{pid}/script/parse

LLM 将原文切分为对话列表。

Response: { "task_id": "task_script_001" }

#### 获取剧本详情

URL: GET /api/projects/{pid}/script

Response:
```
[
  {
    "id": 5001,
    "character_id": 101,
    "character_name": "萧炎", // 冗余字段方便前端展示
    "text": "老师，我们走吧。",
    "audio_url": null,
    "status": "pending"
  },
  {
    "id": 5002,
    "character_id": 102, // 药老
    "text": "好，小家伙。",
    "audio_url": "/static/outputs/line_5002.wav",
    "status": "synthesized"
  }
]
```

#### 修改单句台词

URL: PUT /api/script/{line_id}

Request:
```
{
  "character_id": 103, // 修改说话人
  "text": "老师，等等！" // 修改文本
}
```

#### 提交合成任务 (异步 - 批量或单句)

URL: POST /api/synthesis

Request:
```
{
  "project_id": "uuid-gen-001",
  "line_ids": [5001, 5003] // 传入要合成的台词ID列表。如果是单句试听，列表里就放一个ID。
}
```

Response: { "task_id": "task_syn_batch_001" }

## 系统配置页

#### 获取配置

URL: GET /api/settings

Response: { "llm_provider": "deepseek", "api_key": "sk-***" }

#### 更新配置

URL: PUT /api/settings

Request: { "llm_provider": "local", "api_key": "xxxx" }

## 通用轮询接口

用来查询这里所有异步任务进行的状态

URL: GET /api/tasks/{task_id}

状态定义:

+ pending: 排队中 (任务已提交到队列，Worker 尚未接单)
+ processing: 处理中 (AI 正在推理)
+ success: 成功 (处理完成，返回结果)
+ failed: 失败 (代码报错或资源不足)

Response (Pending - 排队中):
```
{ 
  "status": "pending",
  "position": 3 // (可选) 当前队列排队位置
}
```


Response (Processing - 处理中):
```
//分析/剧本任务/单句TTS任务：没有进度
{
  "status": "processing",
}
// 批量合成任务，返回进度
{
  "status": "processing",
  "progress": {
    "current": 15,
    "total": 50,
    "percent": 30
  }
}

```


Response (Success - 成功):
```
{
  "status": "success",
  "result": { 
    // 成功结果：如果是TTS任务，返回的就是wav的URL
    "audio_url": "/static/temp/preview_xyz.wav" 
    // 分析/剧本任务：通常返回简单的 {"message": "ok"}，提示前端去刷新列表接口
  }
}
```


Response (Failed - 失败):
```
{
  "status": "failed",
  "error": "GPU Out of Memory" // 错误原因，供前端 Toast 提示
}
```

# 未来更新内容
+ LLM分析角色特征：当小说非常长时（大于100w字），支持切分处理
+ LLM切分剧本：支持多线程切分加速
+ 对话合成中添加环境音功能
+ 两个对话之间支持控制静音片段时间长短
+ 输入文件类型支持多样化
+ 合成的东西更多，包括不限于游戏、播客、试题听力、漫画等
+ TTS模型支持autodl穿透与阿里云API接入
+ 用户在每次reroll后都可能觉得之前的更好，加入历史记录更难
+ 添加批量导出/打包功能，导出zip这种
+ 对合成音频支持音量控制
+ 引入类似剪辑软件的波形编辑器，用户可通过拖拽音频块实现整段音频的编辑
+ 提供字幕文件导出功能

---

书面版本：

**核心算法与性能**

+ 超长文本分析：优化上下文管理，支持百万字级长篇小说的分段增量分析。
+ 并行切分加速：引入多线程机制，大幅提升 LLM 剧本切分效率。
+ 异构后端接入：支持 AutoDL 穿透部署及阿里云等第三方 TTS API 接入。

**音频编辑与增强**

+ 环境音效集成：支持对话背景音 (BGM) 及环境音效 (SFX) 的自动/手动添加。
+ 精细化节奏控制：支持自定义句间静音时长 (Silence Duration) 与呼吸感调整。
+ 动态音量调节：支持单句及全局的音频增益/响度控制 (Gain/Loudness Control)。
+ 可视化波形编辑：引入非线性编辑 (NLE) 轨道视图，支持拖拽调整时间轴与音频块剪辑。

**工作流与交互体验**

+ 多格式文件支持：扩展输入格式，支持 EPUB, PDF, DOCX 等文档导入。
+ 多场景合成模版：新增游戏语音、播客 (Podcast)、听力试题、动态漫画等专用预设。
+ Reroll 历史回溯：保留生成历史记录，支持版本对比与一键回退 (Undo/Redo)。
+ 批量打包导出：支持按章节/角色归档，一键导出 ZIP 压缩包。
+ 字幕同步导出：基于音频时间戳，自动生成 SRT/ASS 字幕文件。
