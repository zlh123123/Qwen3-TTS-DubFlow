# 概述
核心流程：用户上传小说 -> LLM 分析角色 -> 用户确认/调整人设与声线 -> LLM 切分剧本 -> 批量/单句合成语音 -> 导出音频。
技术栈：
+ 前端：React
+ 后端：FastAPI + SQLite
+ AI
  + 本地部署：采用基于pytorch库的Qwen3TTSModel部署，此部分将集成到后端（不推荐，速度慢，且对显卡配置有要求，易出现环境问题）
  + Autodl部署：采用vllm-omni推理框架，速度更快，穿透到本地主机（推荐大部分用户使用）
  + 调用阿里云API（推荐大部分用户使用，与Autodl部署相比成本更低）
  + vllm-omni部署（仅推荐linux用户或自有linux的高性能服务器的用户使用，不推荐windows和mac用户部署，易出现环境问题）

# 文件树

```

Qwen3-DubFlow/
├── .env                        # [全局配置] 根目录环境变量 (供 docker-compose 读取，如 PROJECT_NAME, GPU_IDS)
├── docker-compose.yml          # [核心编排] 定义 frontend 和 backend 服务
├── README.md                   # 项目说明文档
│
├── frontend/                   # [前端服务] React + Nginx
│   ├── Dockerfile              # [构建] 多阶段构建: Node编译 -> Nginx服务，前端镜像为 Nginx + React
│   ├── nginx.conf              # [配置] Nginx 反向代理配置 (转发 /api 到 backend, 转发 /static 到 storage)
│   ├── package.json            # [依赖] Node 依赖
│   ├── public/                 # [资源] 静态资源
│   └── src/                    # [源码]
│       ├── api/                # [API] axios 封装 (projects.js, tasks.js)
│       ├── hooks/              # [Hooks] 自定义 Hooks (useTaskPoller.js)
│       ├── pages/              # [页面] (CreateProject, CharacterWorkshop, Studio)
│       ├── components/         # [组件] 公共组件
│       ├── App.js              # 根组件
│       └── index.js            # 入口文件
│
├── backend/                    # [后端服务] FastAPI
│   ├── Dockerfile              # [构建] Python 环境构建 (安装 uv, 依赖)。
后端镜像将发布两个：1.dubflow-backend:lite (仅支持 AutoDL/阿里云，无 PyTorch，体积小)2.dubflow-backend:full (支持本地运行/AutoDL/阿里云，含 PyTorch，体积大)
│   ├── entrypoint.sh           # [启动] 启动脚本 
│   ├── .env                    # [局部配置] 后端专用环境变量 (DB_URL)
│   ├── pyproject.toml          # [依赖] uv 依赖管理
│   ├── uv.lock                 # [依赖] 锁定文件
│   │
│   ├── main.py                 # [入口] FastAPI App 初始化
│   ├── database.py             # [数据库] SessionLocal, Base
│   │
│   ├── models/                 # [ORM] 数据库表模型
│   │   ├── project.py          # Project 表定义
│   │   ├── character.py        # Character 表定义
│   │   ├── script.py           # ScriptLine 表定义
│   │   ├── task.py             # 任务队列表
│   │   └── config.py           # 用户设置表
│   │
│   ├── schemas/                # [Pydantic] 数据校验模型
│   │   ├── project.py          # ProjectCreate, ProjectResponse
│   │   ├── character.py        # CharacterUpdate
│   │   └── common.py           # TaskResponse
│   │
│   ├── routers/                # [路由] API 接口实现
│   │   ├── projects.py         # /api/projects
│   │   ├── characters.py       # /api/characters
│   │   ├── scripts.py          # /api/script
│   │   ├── synthesis.py        # /api/synthesis
│   │   └── tasks.py            # /api/tasks
│   │
│   └── utils/                  # [工具]
│       ├── llm_helper.py       # LLM 调用封装
│       └── audio_helper.py     # 音频处理工具
│
├── models_deploy/              # [AI模型服务] 独立的推理环境 (GPU)，此服务仅用于Autodl ubuntu环境部署
│   ├── Dockerfile              # [构建] 统一的推理镜像 (PyTorch + vLLM + 依赖)
│   ├── requirements.txt        # [依赖] 推理服务所需的 Python 包
│   ├── entrypoint.sh           # [启动] 容器启动脚本 (根据环境变量 TASK_TYPE 启动不同模型)
│   │
│   ├── vllm_omni/              # [引擎] vllm-omni 源码 (Git Submodule)
│   │   ├── model_executor/     # 模型执行逻辑
│   │   └── ...                 # 其他源码文件
│   │
│   └── models/                 # [权重] 模型文件挂载目录 (宿主机下载好后映射进容器)
│       ├── Qwen3-TTS-12Hz-1.7B-VoiceDesign/  # 捏人模型权重
│       └── Qwen3-TTS-12Hz-1.7B-Base/         # 基础模型权重
│
└── storage/                    # [持久化存储] 挂载到后端和 Nginx 容器
    ├── uploads/                # 原始小说文件
    ├── temp/                   # 临时音频 (Reroll用)
    └── projects/               # 项目数据
        └── {project_id}/       # 按项目隔离
            ├── voices/         # 确认的角色参考音 (Ref Audio)
            └── outputs/        # 最终合成音频

```

# 前端功能

+ 用户打开前端页面时显示的第一个界面，提供一个文本输入框和一个文件输入的选项。文本输入框可以统计字数等；文件输入用户可以点击后选择本地路径的文件，或者将文件拖拽进去。v1版本仅支持小说。v1版本中仅支持单文件，且仅支持txt文件。
+ 第二个界面，仅显示角色列和对角色的修改控件。用户点击每个角色的卡片，即可在修改控件中修改由LLM生成的角色描述与需要合成的参考音频的文本，点击reroll后即可提交TTS任务。此处需要支持用户进行角色的增删。当用户确认所有角色的参考音频ok，可以通过点击按钮进到下一步
+ 第三个界面，显示角色列、对话列和控件列。用户点击角色卡片，可以在控件中看到角色描述、参考音频文本（可显示为灰底代表无法修改），并可听参考音频。用户点击对话卡片，可以在控件中修改需要合成的对话内容以及修改语速等，点击reroll后即可提交TTS任务。此外需要支持用户进行对话的增删。这里还可能存在对话与人物不对应的错误情况，在控件中需要提供修改策略。
+ 第三个界面需要有批量合成选项，同时也包括根据筛选条件批量合成的功能（即仅合成某个人物，不合成旁白等，可以通过多选框的形式构建）；批量导出在v1版不提供，批量合成会将音频保存至本地默认位置；还需要提供设置按钮，包括1、用户选择的文本LLM的类型（Qwen or Deepseek or 自己本地部署或其他模型）与API key，2、用户选择的TTS模型的提供方式（本地部署 or Autodl部署后穿透 or 调用阿里云API），v1版仅提供本地部署即可，3、一些外观功能（可视情况，v1版也可不提供），4、开源协议与版权说明

## 页面 1: 项目仪表盘

顶部导航栏：Qwen3-DubFlow Logo | 设置按钮 (GitHub, API Key配置)

主体内容区：

+ 新建卡片 (Big Button)：一个显眼的“+ 新建项目”大卡片。
+ 项目列表 (Grid/List)：按时间倒序排列的卡片。这里也可以加入各种筛选显示的逻辑

项目卡片内容：

+ 标题：《斗破苍穹第一章》
+ 状态标签：🔵 角色分析中 / 🟢 待合成 / ✅ 已完成，所有的标签见上面的数据库
+ 进度条：(仅在 synthesizing 状态下显示) 例如 "35/100 句"
+ 时间：创建于 2026-02-02
+ 操作：继续编辑、删除项目

---

**交互逻辑：**

新建项目：

点击“+”号 -> 弹出一个 Modal (对话框) 或者跳转到一个 简单的 Form 页面。

*此页面就是原来的页面1，不过建议做成悬浮的小窗样式*

提交后：回到列表页，列表中多了一个 created 状态的卡片。

进入项目 (智能路由)：

用户点击卡片。

前端根据 state 判断跳转哪里：

+ created / analyzing_characters / characters_ready -> 跳转 Page 2 (角色工坊)
+ parsing_script / script_ready / synthesizing / completed -> 跳转 Page 3 (演播室)

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
| language | String | 语言，TTS仅支持Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian |
| raw_content | Text | 小说原始文本 |
| created_at | DateTime | 创建时间 |
| state | String | 当前状态，可能的所有状态如下 |

| 状态值 (State) | 中文含义 | 前端行为逻辑 | 触发条件 |
| :--- | :--- | :--- | :--- |
| **created** | 初始状态 | 在数据库中初始化一个project时的默认状态，理论上会马上进入analyzing_characters |
| **analyzing_characters** | 角色分析中 | 在首页上不允许用户点击这个project，前端可以显示转圈orloading这种 | project的内容存进数据库。用户已经上传了小说文件，点击“分析角色”按钮，Worker 开始跑 LLM。 |
| **characters_ready** | 角色待用户确认其音色 | 点击进入“角色工坊 (Page 2)”。 | LLM 分析完成，Character 表有数据了。现在用户开始试听并修改音色 |
| **parsing_script** | 剧本切分中 | 前端这块回到首页，列表页显示 Loading；禁止操作。 | 用户在 Page 2 点击“生成剧本”，Worker 开始跑 LLM。此时用户就不能再回到“角色工坊 (Page 2)”了 |
| **script_ready** | 剧本就绪/待合成 | 用户在首页点击项目后，进入“演播室 (Page 3)”。 | 剧本切分完成，ScriptLine 表有数据了。 |
| **synthesizing** | 合成进行中 | 列表页显示进度条；Page 3 锁定批量合成按钮。 | 用户点击了“批量合成”，后台正在疯狂跑 GPU。 |
| **completed** | 已完成 | 列表页显示“完成”角标；Page 3 允许导出。 | 所有的 ScriptLine status 都变成了 synthesized。 |
| **failed** | 处理失败 | 列表页显示红色警告，允许用户“重试”。 | 任何一个任务抛出异常 (如显存溢出、LLM 超时)。 |


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
| is_confirmed | Boolean | 用户是否已经确认音色 |
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

任务队列表：
Task (任务表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | String (UUID) | 任务 ID (对应 API 返回的 task_id) |
| project_id | String (FK to projects.id) | 外键关联 Project，用于判断project所处的状态 |
| type | String | 任务类型: analyze_char, parse_script, synthesis_voicedesign,synthesis_base |
| status | String | pending (排队), processing (进行中), success, failed |
| payload | JSON | 任务参数 (如: {"text": "你好", "char_id": 1}) |
| result | JSON | 任务结果 (如: {"audio_url": "/static/..."}) |
| error_msg | Text | 报错信息 |
| created_at | DateTime | 用于排队顺序 (ORDER BY created_at) |


每个用户还有一张配置表。其配置为：

Config
| 字段名 | 类型 | 说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| **key** | String (PK) | 唯一键名 (建议用点分法) | `llm.deepseek.api_key` |
| **value** | Text | 配置值 (不论什么类型都转字符串存) | `sk-123456` |
| **group** | String | 分组 (用于前端 Tab 切换) | `llm_settings` |
| **label** | String | 前端显示的中文名称 | `DeepSeek API Key` |
| **type** | String |  控件类型 | `password` / `text` / `select` / `boolean` / `color` |
| **options** | JSON | 如果是 select，这里存选项 | `["deepseek", "qwen", "openai"]` |
| **default** | String | 默认值 | `deepseek` |
| **is_public** | Boolean | 是否公开 (部分配置可能不给前端看) | `true` |

A. appearance (外观与交互)

| Key | Label | Type | Options / Default | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `app.theme_mode` | 主题模式 | `select` | `["light", "dark", "system"]` | 明亮/暗黑/跟随系统 |
| `app.language` | 语言 | `select` | `["zh-CN", "en-US", "ja-JP"]` | 国际化支持 |

B. llm_settings (LLM设置)

| Key | Label | Type | Default | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `llm.active_provider` | 当前 LLM 服务商 | `select` | `deepseek` | 下拉选 DeepSeek/Qwen/Self-defined |
| `llm.deepseek.api_key` | DeepSeek API Key | `password` | - | 存密钥，前端显示为 ****** |
| `llm.qwen.api_key` | Qwen API Key | `password` | - | 存密钥，前端显示为 ****** |
| `llm.selfdef.url` | 自定义 LLM 地址 | `text` | `http://localhost:11434` | Ollama 等本地服务地址 or 其他LLM供应商的API URL |
| `llm.selfdef.api_key` | 自定义 LLM API Key | `password` | - | 本地服务不需要key，其他LLM供应商需要key |
| `llm.selfdef.model_name` | 自定义 LLM 名称 | `test` | - | 本地服务和其他LLM供应商需要模型名称 |

C. tts_settings (语音合成设置)

| Key | Label | Type | Default | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `tts.backend` | TTS 后端类型 | `select` | - | 选项: local_pytorch / local_vllm / autodl / aliyun |
| **本地pytorch部署** | | | | |
| `tts.local.model_base_path` | 克隆模型路径 | `text` | - | - |
| `tts.local.model_vd_path` | 设计模型路径 | `text` | - | - |
| `tts.local.device` | 计算设备 | `select` | cuda | cuda or cpu |
| **本地vllm部署** | | | | |
| `tts.vllm.url` | vllm服务地址 | `text` | `http://localhost:8000` | Docker 容器内部地址 |
| **autodl穿透** | | | | |
| `tts.autodl.base_port` | 基础模型本地端口 | `text` | 6006 | - |
| `tts.autodl.vd_port` | 捏人模型本地端口 | `text` | 6007 | - |
| **阿里云API** | | | | |
| `tts.aliyun.api_key` | DashScope API Key | `password` | - | - |
| `tts.aliyun.region` | 服务区域 | `select` | `beijing` | 选项: beijing / singapore，国内beijing，国外 singapore |



D. synthesis_config (合成策略与高级参数)

| Key | Label | Type | Default | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **基础设置** | | | | |
| `syn.default_speed` | 默认语速 | `number` | `1.0` | 建议范围 0.8 - 1.5 比较自然。 |
| `syn.silence_duration` | 句间静音时长 | `number` | `0.5` | 单位：秒。合成长音频时，每句话之间插入的空白停顿。 |
| `syn.export_path` | 默认导出路径 | `text` | `/data/outputs` | 容器内路径，需挂载对应宿主机 storage 目录。 |
| `syn.max_workers` | 最大并发数 | `number` | `2` | 限制同时合成任务数。防止显存溢出 (OOM) 的关键。 |
| **音频处理** | | | | |
| `syn.volume_gain` | 音量增益 | `number` | `1.0` | 1.0 为原声。针对声音偏小的模型可设为 1.2 或 1.5。 |
| `syn.audio_format` | 音频导出格式 | `select` | `wav` | `["wav", "mp3"]`。wav 无损，mp3 体积小。 |
| **文本预处理** | | | | |
| `syn.auto_slice` | 自动切分过长文本 | `boolean` | `true` | 开启后防止单句超过模型字符限制导致报错。 |
| `syn.text_clean` | 文本清洗 | `boolean` | `true` | 自动去除无法朗读的特殊符号（如 ✨, ---, [] 等）。 |


除了用户配置表外，项目后端运行还需要一些配置，这些配置放在.env环境变量中，仅开发人员使用，普通用户不使用

+ .env中包括数据库地址、密钥这些。由开发/运维人员管理，代码运行前就必须存在，一旦修改通常需要重启服务。
+ UserConfig则由用户在前端 UI 修改，实时生效，不需要重启服务。

# API文档

**所有请求体 (Request Body) 和响应体 (Response Body) 均为 JSON；耗时任务（如分析、合成）均采用 异步模式 (返回 task_id)。**

## 页面 1: 项目仪表盘

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

#### 获取所有的project

URL: GET /api/projects

Response：

```
{
  "total": 5,
  "items": [
    {
      "id": "uuid-001",
      "name": "斗破苍穹",
      "state": "synthesizing",
      "created_at": "2026-02-02T10:00:00"
    },
    {
      "id": "uuid-002",
      "name": "凡人修仙传",
      "state": "characters_ready",
      "created_at": "2026-02-01T14:20:00"
    }
  ]
}
```

#### 获取单个project的详情

URL: GET /api/projects/{pid}

Response：

```
{
  "id": "uuid-001",
  "name": "斗破苍穹",
  "state": "script_ready", // 前端根据这个字段决定路由
  "raw_content_preview": "这里是小说前100字..."
}
```

#### 删除项目

URL: DELETE /api/projects/{pid}

后端不仅要删数据库里的记录，还要级联删除磁盘上 storage/projects/{pid}/ 下的所有音频文件

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

URL: POST /api/characters/{character_id}/voice

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

Response (按照 Group 分组返回):
```
{
  "appearance": [
    {
      "key": "app.theme_mode",
      "value": "light",
      "label": "主题模式",
      "type": "select",
      "options": ["light", "dark", "system"],
      "default": "system"
    }
  ],
  "llm_settings": [
    {
      "key": "llm.active_provider",
      "value": "deepseek",
      "label": "当前 LLM 服务商",
      "type": "select",
      "options": ["deepseek", "qwen", "local"]
    },
    {
      "key": "llm.deepseek.api_key",
      "value": "sk-******", // 注意：后端应脱敏返回
      "label": "DeepSeek API Key",
      "type": "password"
    }
  ],
  "tts_settings": [
    {
      "key": "tts.active_backend",
      "value": "local_docker",
      "label": "TTS 后端类型",
      "type": "select",
      "options": ["local_docker", "remote_autodl", "aliyun"]
    }
  ],
  "synthesis_config": [
    {
      "key": "syn.silence_duration",
      "value": "0.5",
      "label": "句间静音时长",
      "type": "number",
      "default": "0.5"
    }
  ]
}
```
#### 更新配置

URL: PUT /api/settings
前端只传修改了的 KV 对。

Request: 

```
{
  "updates": [
    { "key": "llm.active_provider", "value": "local" },
    { "key": "llm.local.url", "value": "http://localhost:11434" }
  ]
}
```

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
+ 用户在每次reroll后都可能觉得之前的更好，加入历史记录更难
+ 添加批量导出/打包功能，导出zip这种
+ 对合成音频支持音量控制
+ 引入类似剪辑软件的波形编辑器，用户可通过拖拽音频块实现整段音频的编辑
+ 提供字幕文件导出功能
+ 为剧本切分、批量合成提供进度条、显示剩余时间等
+ 页面 2: 角色工坊 支持用户自己上传自己的参考音频
+ 对于耗时任务添加“取消任务”API
+ 对于每个project，状态机为fail时，支持自动回到上一个状态重试
+ 对于任务task，假如正在有任务运行时后端宕机了，那project的状态就会一直卡比，要支持这里的异常处理
+ 返回所有project和返回所有character目前API为全部返回，在数据量少的个人场景可用；但是返回所有scripts数据量可能较大（与小说字数强相关），需要优化，例如加上分页返回的策略


---

界面1的流程：
场景 1：角色分析 (Analyze Characters)
前端 (Page 1): 用户点击“开始分析”。
API (Routers):
接收请求。
将 Project.state 设为 analyzing_characters (前端立即看到转圈)。
创建 Task (type=analyze_char, project_id=xxx)。
db.commit() 并返回 task_id。
Worker:
检测到 Pending 任务。
Task 变 processing。
LLM Handler 逻辑: 读取小说内容 -> 调用 LLM -> 解析 JSON -> 往 Character 表插入数据。
Task 变 success。
State Machine: Project.state 变 characters_ready。
前端 (轮询):
下一次轮询发现 state 变了，自动跳转到 Page 2。


# DubFlow 架构升级计划 v2

> 更新于 2026-03-16，基于 issue 讨论和与开发者的深入沟通。

## 一、核心矛盾

项目需要三大 AI 能力：

| 能力 | 说明 | 典型模型 |
|-----|------|---------|
| 语音合成 + 音色设计 | 文本转语音，带音色 prompt 控制 | Qwen3-TTS |
| 音色克隆 | 上传参考音频，复刻音色 | CosyVoice 2, Fish Audio, S2-Pro |
| 环境音 | 雨声、人群、机械声等氛围音效 | TangoFlux, 音效库 |

矛盾点：
- 普通用户无 GPU 或显存不足，本地部署不现实
- Fish Audio S2-Pro 无公开 API，且协议非商用，Docker 部署需 24GB 显存
- 不能假设每个人都会用 Docker

---

## 二、核心架构思路：一切皆 RESTful URL

### 设计原则

**DubFlow 本身不关心模型怎么部署，只关心"去哪个 URL 调用"。**

对于 DubFlow 后端来说，无论是：
- 阿里云 DashScope 的 API
- 硅基流动的 OpenAI 兼容 API
- 本地用 vLLM/SGLang 起的服务
- AutoDL 上部署后穿透到本地的服务
- 自己用 Flask/FastAPI 包装的 PyTorch 推理服务

**它们全部都是 RESTful endpoint，DubFlow 只需要 `base_url` + `api_key`（可选）。**

```
┌─────────────────────────────────────────────────────┐
│                  DubFlow (前端 + 后端)                 │
│                                                      │
│   前端 UI                                             │
│     │                                                │
│     ▼                                                │
│   FastAPI 后端                                        │
│     │                                                │
│     ├── TTS 调用层 ──────▶ {tts_base_url}/v1/audio   │
│     ├── 克隆调用层 ─────▶ {clone_base_url}/v1/clone  │
│     └── 环境音调用层 ───▶ {ambient_base_url}/...     │
│                                                      │
│   用户只需在设置里填 URL，不需要知道背后是什么           │
└─────────────────────────────────────────────────────┘

那些 URL 可能指向：
  ├── https://dashscope.aliyuncs.com    (云端 API)
  ├── https://api.siliconflow.cn        (云端 API)
  ├── http://localhost:6006             (本地 vLLM/SGLang)
  ├── http://localhost:8080             (本地 Docker 容器)
  └── http://your-autodl-host:6006      (远程 GPU 穿透)
```

### 为什么这个思路最好

1. **彻底解耦** — DubFlow 代码中零模型部署逻辑，只有 HTTP 调用
2. **用户选择最大化** — 云端/本地/远程随意切换，填个 URL 就行
3. **开发简单** — 不需要为每个模型写 Provider 类，只需要适配 API 格式
4. **本地部署的人** — 用 vLLM/SGLang 起服务天然就是 RESTful 的，不需要额外包装

---

## 三、统一 API 协议设计

关键问题：不同的后端 API 格式不同（DashScope vs OpenAI vs Fish Audio），需要一个薄薄的适配层。

### 方案：后端维护一个极轻的适配器

```
backend/
├── adapters/
│   ├── base.py              # 统一接口定义
│   ├── tts/
│   │   ├── openai_compat.py # OpenAI /v1/audio/speech 格式 (vLLM/SGLang/硅基流动都兼容)
│   │   └── dashscope.py     # 阿里云 DashScope 格式
│   ├── clone/
│   │   ├── cosyvoice.py     # CosyVoice 2 (DashScope API / 本地服务)
│   │   └── fish_audio.py    # Fish Audio API
│   └── ambient/
│       ├── freesound.py     # Freesound API
│       └── generic_rest.py  # 通用 RESTful（TangoFlux 等自部署服务）
```

适配器做的事情极简：
- 把 DubFlow 内部的统一请求格式转换成目标 API 的格式
- 把目标 API 的响应转换回 DubFlow 的统一格式
- 处理认证（API Key / Token）

```python
# adapters/base.py — 极简接口

class TTSAdapter(ABC):
    """所有 TTS 后端的统一接口"""

    def __init__(self, base_url: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    @abstractmethod
    async def synthesize(self, text: str, voice: dict, speed: float = 1.0) -> bytes:
        """输入文本 + 音色参数，返回音频 bytes"""
        ...

    @abstractmethod
    async def design_voice(self, prompt: str) -> tuple[bytes, dict]:
        """输入音色描述 prompt，返回 (预览音频, 音色参数)"""
        ...


class CloneAdapter(ABC):
    """所有音色克隆后端的统一接口"""

    def __init__(self, base_url: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    @abstractmethod
    async def clone_voice(self, ref_audio: bytes, ref_text: str = "") -> dict:
        """输入参考音频(+参考文本)，返回可复用的音色参数"""
        ...


class AmbientAdapter(ABC):
    """环境音后端"""

    def __init__(self, base_url: str = "", api_key: str = ""):
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.api_key = api_key

    @abstractmethod
    async def search(self, query: str, duration: float = 10.0) -> list[dict]:
        """搜索音效，返回 [{url, name, duration, preview_url}, ...]"""
        ...
```

### OpenAI 兼容的好处

vLLM 和 SGLang 起的服务天然是 OpenAI 兼容格式。这意味着：
- 本地用 vLLM 起 Qwen-TTS → `http://localhost:6006` → OpenAI 兼容适配器
- 硅基流动的 Qwen-TTS → `https://api.siliconflow.cn` → 同一个适配器
- 任何 OpenAI 兼容服务 → 同一个适配器

**用户本地部署后不需要额外包装，vLLM/SGLang 本身就是 RESTful 服务。**

---

## 四、各能力具体落地

### 1. 语音合成 + 音色设计（TTS）

| 用户选择 | 适配器 | 用户需要做的 |
|---------|--------|------------|
| 阿里云 DashScope | `dashscope.py` | 填 API Key |
| 硅基流动 / OpenAI 兼容 | `openai_compat.py` | 填 URL + API Key |
| 本地 vLLM/SGLang | `openai_compat.py` | 填 `http://localhost:6006`（无需 Key） |
| AutoDL 穿透 | `openai_compat.py` | 填穿透后的地址 |

**音色设计（Voice Design）是 Qwen3-TTS 独有的能力**，通过 prompt 描述生成音色。这个能力目前只有 Qwen3-TTS 支持，所以 TTS 适配器需要包含 `design_voice` 方法。当后端不支持时，返回"不支持"即可，前端隐藏对应功能。

**默认推荐：DashScope API（零门槛，对普通用户最友好）**

### 2. 音色克隆

Fish Audio S2-Pro 的问题：
- 协议非 Apache 2.0，有商用限制
- Docker 部署需 24GB 显存
- 无公开 API

**务实选择：**

| 用户选择 | 说明 | 门槛 |
|---------|------|-----|
| CosyVoice 2 (DashScope API) | 阿里系，zero-shot 克隆，质量好 | 填 API Key |
| CosyVoice 2 (本地) | 自己部署服务 | GPU ≥ 8GB |
| Fish Audio API | fish.audio 的在线 API（非 S2-Pro） | 填 API Key |
| S2-Pro 本地 | 保留为高级选项，明确标注协议风险 | GPU ≥ 24GB |
| 自定义 URL | 用户自己部署的任何克隆服务 | 自理 |

**默认推荐：CosyVoice 2 DashScope API**

### 3. 环境音

环境音的本质是"找到合适的声音"，而不是"生成全新的声音"。

| 用户选择 | 说明 | 门槛 |
|---------|------|-----|
| 内置音效库 | 项目自带分类音效（CC 授权） | 零门槛（下载音效包即可） |
| Freesound API | freesound.org，海量 CC 音效 | 免费注册 API Key |
| ElevenLabs SFX API | 文本描述→生成音效 | 付费 API Key |
| TangoFlux 本地 | 自部署 | GPU ≥ 6GB |
| 自定义 URL | 用户自己的音效生成服务 | 自理 |

**默认推荐：内置音效库 + Freesound API（完全免费，零 GPU）**

---

## 五、前端设置页面设计

核心理念：用户不需要理解技术细节，只需要"选引擎 → 填 URL → 测试连接"。

```
┌─────────────── 引擎设置 ───────────────────────────┐
│                                                     │
│  ── 语音合成 (TTS) ──────────────────────────────   │
│                                                     │
│  引擎:  [DashScope ▾]                               │
│                                                     │
│  API Key: [sk-xxxx________________] [测试连接 ✓]     │
│                                                     │
│  ℹ️ 支持音色设计(Reroll)功能                          │
│  ── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ── ──    │
│                                                     │
│  引擎:  [自定义 OpenAI 兼容 ▾]                       │
│                                                     │
│  URL:   [http://localhost:6006___] [测试连接 ✓]      │
│  Key:   [(可选)__________________]                   │
│                                                     │
│  ── 音色克隆 ─────────────────────────────────────   │
│                                                     │
│  引擎:  [CosyVoice 2 (DashScope) ▾]                │
│                                                     │
│  API Key: [sk-xxxx________________] [测试连接 ✓]     │
│                                                     │
│  ── 环境音 ──────────────────────────────────────    │
│                                                     │
│  引擎:  [内置音效库 + Freesound ▾]                    │
│                                                     │
│  Freesound Key: [(可选)___________]                  │
│                                                     │
│                              [保存设置]              │
└─────────────────────────────────────────────────────┘
```

每个引擎选择后，只显示该引擎需要的字段（URL / API Key）。
"测试连接"按钮验证 URL 和 Key 是否可用。

---

## 六、本地部署不需要 Docker 也能行

你说得对——不能假设每个人都会用 Docker。但反过来想：

### 对于"只用云端 API"的用户（多数人）

**根本不需要 Docker，也不需要本地部署任何模型。**

DubFlow 本身就是一个 Web 应用（React + FastAPI），启动就两步：
```bash
# 后端
cd backend && uv run main.py

# 前端
cd frontend && npm run dev
```

然后在设置里填 DashScope API Key 就能用了。零 GPU，零 Docker。

### 对于想本地部署模型的用户

他们已经是有技术基础的人了。提供三种方式，由简到繁：

#### 方式 1: 一键脚本（推荐）
```bash
# 我们提供的一键脚本，自动检测环境并启动
./scripts/start_local_tts.sh
# 内部逻辑：
# 1. 检测 nvidia-smi，确认 GPU 可用
# 2. 检测 vllm 是否安装，没有则用 pip/uv 安装
# 3. 下载模型（如果本地没有）
# 4. 启动 vLLM 服务在 localhost:6006
# 5. 输出："TTS 服务已启动，请在 DubFlow 设置中填入 http://localhost:6006"
```

#### 方式 2: Docker Compose（会 Docker 的人）
```bash
docker compose -f deploy/docker-compose.tts.yml up
# 自动拉取镜像、下载模型、启动服务
```

#### 方式 3: 云端 GPU（AutoDL / RunPod）
```
提供 AutoDL 镜像 或 一键脚本，
用户登录后执行脚本，
通过 SSH 隧道/公网穿透 把服务暴露出来，
在 DubFlow 设置里填远程 URL。
```

**关键点：无论哪种方式，最终结果都一样——产生一个 RESTful URL 填进 DubFlow 设置。**

### 终极形态：Tauri 桌面应用（Phase 5）

如果后续做了 Tauri 打包，可以做到：
- 应用内一键下载模型
- 应用内自动启动 vLLM sidecar
- 用户完全不需要碰命令行

但这是后续优化，不是第一优先级。

---

## 七、开发优先级路线图

### Phase 1: 架构重构 — 一切皆 URL

**目标：让 DubFlow 在纯云端 API 模式下完整可用**

- [ ] 实现 Adapter 抽象层（`base.py`）
- [ ] 实现 TTS 适配器
  - [ ] `openai_compat.py`（覆盖 vLLM/SGLang/硅基流动/本地部署）
  - [ ] `dashscope.py`（阿里云）
- [ ] 重构现有 worker 代码，改为通过 Adapter 调用
- [ ] 前端设置页面改造（引擎选择 + URL 填写 + 连接测试）
- [ ] 配置持久化（数据库已有 config 表，扩展字段）
- [ ] 端到端测试：DashScope API 走通全流程

### Phase 2: 音色克隆

- [ ] 实现 CosyVoice 2 适配器（DashScope API）
- [ ] 实现 Fish Audio 适配器
- [ ] 前端角色工坊增加"上传参考音频→克隆音色"功能
- [ ] 克隆结果与角色系统打通（克隆出的音色可以直接用于合成）

### Phase 3: 环境音

- [ ] 收集整理 CC 授权音效资源，建立分类索引
- [ ] 实现 Freesound API 适配器
- [ ] 前端 Studio 页面增加环境音轨道
- [ ] LLM 根据剧本场景描述自动推荐/匹配环境音

### Phase 4: 前端重构

- [ ] 参考 Voicebox 重新设计 UI/UX
- [ ] 多轨道时间线编辑器（对白轨 + 环境音轨）
- [ ] 波形可视化
- [ ] 拖拽编辑、音量调节

### Phase 5: 本地部署体验优化

- [ ] 提供 vLLM/SGLang 一键启动脚本
- [ ] 提供 Docker Compose 部署文件
- [ ] 提供 AutoDL 一键部署脚本
- [ ] 文档：各种部署方式的详细指南

### Phase 6: 桌面应用（Tauri）

- [ ] Tauri 集成 + Python sidecar
- [ ] 应用内模型管理（下载/启动/停止）
- [ ] 跨平台打包（macOS / Windows）

---

## 八、关键决策总结

### 1. 一切皆 URL，彻底解耦
DubFlow 不做任何模型部署的事。它只是一个调用 RESTful API 的客户端。模型在哪里、怎么部署，是用户（或我们提供的脚本）的事。

### 2. 云端 API 是默认路径
DashScope + CosyVoice 2 + Freesound，全部零 GPU。用户注册 API Key 就能完整使用所有功能。这是让"每个人都能用"的关键。

### 3. Fish Audio S2-Pro 仅作为高级本地选项
协议有商用限制，需 24GB 显存，无公开 API。在文档和 UI 中明确标注这些限制。不作为默认推荐。

### 4. 环境音采用音效库 + 搜索，而非 AI 生成
绝大多数场景不需要"生成全新的"环境音。预置音效库 + Freesound 搜索完全够用，零 GPU 需求。

### 5. Web 优先，桌面随后
先让 React + FastAPI 形态完善。Tauri 桌面打包是 Phase 6 的事，不影响核心功能开发。

### 6. OpenAI 兼容格式是最大公约数
vLLM、SGLang、硅基流动、本地部署——都支持 OpenAI 兼容格式。一个 `openai_compat.py` 适配器覆盖绝大多数本地/远程场景。DashScope 格式不同，单独一个适配器。

---

## 九、面向用户的三种体验路径

```
路径 A：我就想用，不想折腾（80% 用户）
  1. clone 项目，启动前后端
  2. 设置里选 DashScope，填 API Key
  3. 开始配音
  → 零 GPU，零 Docker，5 分钟内可用

路径 B：我有 GPU / 我租了 AutoDL（15% 用户）
  1. 运行一键脚本启动本地模型服务
  2. 设置里填 http://localhost:6006
  3. 开始配音
  → 完全免费（除电费），数据不出本机

路径 C：我要极致体验（5% 用户）
  1. 部署多个模型（TTS + 克隆 + 环境音）
  2. 每个能力填对应的本地 URL
  3. 全功能本地运行
  → 需要 24GB+ 显存，但功能最完整
```

# DubFlow 竞品分析与差异化策略

> 更新于 2026-03-16

## 一、竞品格局速览

### 直接竞品

| 项目 | Stars | 核心定位 | 输入 | LLM分析 | 音色设计 | 多角色 | 平台 |
|------|-------|---------|------|---------|---------|-------|------|
| **Voicebox** | 13.2k | 通用语音DAW | 手动输入文本 | 无 | 克隆 | 手动分配 | 桌面 |
| **Qwen3-Audiobook-Studio** | 新 | 有声书生成 | 预格式化脚本 | 无 | 有 | 有 | 桌面 |
| **TTS-Story** | 85 | 多引擎TTS台 | 预打标脚本 | 无 | 无 | 有 | Web |
| **EasyVoice** | 增长中 | 中文小说转语音 | 小说文本 | 无 | AI推荐 | 有 | Web |
| **ebook2audiobook** | 18.5k | 批量转有声书 | eBook文件 | 无 | 克隆 | 单角色 | CLI |
| **VoxNovel** | 340 | 多角色有声书 | 小说文本 | BookNLP | 随机分配 | 有 | 桌面 |

### 关键发现

1. **没有一个项目能做到"原始小说 → 自动分析 → 调音 → 完整广播剧"的全流程**
2. Voicebox 是最大的名气竞品，但它定位是通用 DAW，不是广播剧生产线
3. 所有竞品要么需要预格式化输入，要么没有真正的 AI 分析能力
4. 中文小说市场几乎没有像样的竞品

---

## 二、残酷现实：单个功能没有护城河

- 多角色 TTS？大家都在做
- 音色克隆？Qwen3-TTS / CosyVoice / GPT-SoVITS 人人可用
- 接 LLM 做角色分析？别人也能接
- 音色设计 Reroll？别人一天就能抄

**功能列表层面的竞争是死路。** 真正的差异化需要来自更深的层面。

---

## 三、差异化方向探讨

### 方向 A：做"广播剧的 Final Cut Pro"，而不是"批量TTS工具"

**核心洞察：** 现有竞品都是"文本进，音频出"的单向管道。没有人把它当作一个**制作工具**来做。

想想看：
- Final Cut Pro 之于视频 = ?之于广播剧
- 目前还没有人填这个空位

这意味着 DubFlow 应该成为一个**广播剧制作工作台**，而不只是一个"小说转语音"的管道。

差异化功能：

1. **多轨道时间线编辑器**
   - 对白轨、旁白轨、环境音轨、BGM 轨
   - 拖拽排列、重叠、淡入淡出
   - 像音频编辑软件一样可视化控制每一秒的内容

2. **导演模式（Director Mode）**
   - LLM 不仅仅是"提取角色"，而是扮演导演
   - 自动标注每句台词的情绪（愤怒、低语、哭泣、讽刺...）
   - 自动建议停顿、语速变化、重音位置
   - 自动在场景转换处插入环境音
   - 用户可以逐句 override 导演的决定

3. **场景化制作**
   - 不按"一整本小说"处理，而按"场景"组织
   - 每个场景有独立的环境音、参与角色、情绪基调
   - LLM 自动从小说中切分场景

4. **单句精修**
   - 对每一句台词可以调整：语速、情绪、停顿、重音
   - 不满意可以 Regenerate 单句（当前已有）
   - 可以手动画出语调曲线

**这个方向的价值：** 从"能用"到"好用到专业"，直接拉开与其他工具的差距。

---

### 方向 B：专注中文网文市场，做到极致

**核心洞察：** 中文网络小说是一个极其庞大且未被满足的市场。

- 中国网络文学市场规模巨大（起点、晋江、番茄小说...）
- 有声书/广播剧的需求量极高
- 但现有工具对中文网文的适配很差（英文工具不理解中文叙事结构）

专注中文网文的差异化：

1. **理解中文网文的叙事结构**
   - 中文网文有独特的对话标注习惯（"xxx说道"、无引号的内心独白）
   - 旁白和对话的界限比英文小说模糊
   - LLM 需要专门针对这个做优化

2. **角色关系图谱**
   - 自动构建角色关系（主角、反派、师父、恋人...）
   - 关系影响语气：同一个角色对不同人说话的语气不同
   - 支持"称呼变化"（从"公子"变成"夫君"，对应情感变化）

3. **长篇连载支持**
   - 网文动辄几百万字，按章节增量处理
   - 角色声线跨章节一致性保证
   - 新角色出场时自动分析并分配声线

4. **BGM/音效自动编排**
   - 战斗场景自动配上紧张 BGM
   - 温馨场景自动配柔和音乐
   - 场景转换自动加过渡音效

**这个方向的价值：** 在一个巨大且空白的市场里做到"最好用"，比到处都做一点强得多。

---

### 方向 C：开放的"广播剧 Pipeline"平台

**核心洞察：** 不做终端工具，做中间层平台。

类似于 ComfyUI 之于图像生成——提供一个可组合的工作流引擎：

1. **节点式工作流编辑器**
   - 每个步骤是一个可替换的节点
   - 文本分析节点 → 角色提取节点 → 音色分配节点 → TTS节点 → 混音节点
   - 用户自由组合和替换

2. **社区生态**
   - 用户可以分享工作流模板（武侠小说工作流、都市言情工作流...）
   - 分享音色 preset（标准正太音、御姐音、老者音...）
   - 分享环境音包

3. **插件机制**
   - 接入新的 TTS 模型只需写一个插件
   - LLM provider 也是插件
   - 社区可以贡献新的分析/后处理能力

**这个方向的价值：** 成为生态的基础设施，而不是孤立的工具。

---

## 四、我的建议

**不要三个方向都做。选一个，做到极致。**

### 推荐：方向 A（广播剧制作工作台） + 方向 B 的部分特性（中文网文优化）

理由：

1. **方向 A 的"多轨道时间线"和"导演模式"是真正的技术壁垒**
   - 别人一天能抄你的 LLM prompt，但抄不了一个完善的多轨道编辑器
   - "导演模式"的 prompt engineering + 情绪标注 + 自动编排是深度积累

2. **方向 B 的中文网文优化与方向 A 完全兼容**
   - 在"广播剧工作台"的框架下，专门优化中文网文的自动分析
   - 这不是另一个产品，而是核心工作台的一个杀手级用例

3. **方向 C（平台化）太早**
   - 没有用户基础就做平台，是空中楼阁
   - 先做好工具，有用户后再考虑开放插件/社区

### 不推荐（当前阶段）

- 做成 ComfyUI 那样的节点式系统（没有用户基数支撑）
- 追求"支持最多的模型"（TTS-Story 支持 8 个引擎，但只有 85 stars）
- 追求"开箱即用桌面应用"（Voicebox 已经占了这个位置）

---

## 五、一句话定位建议

**旧定位：** "AI 广播剧自动化工坊"
→ 听起来也还好，但"自动化"暗示了"一键生成"，这不是真正的价值

**新定位建议：**

> **DubFlow — AI-Powered Audio Drama Studio**
>
> 从原始小说到专业广播剧的完整制作工作台。
> AI 负责分析、推荐、编排；人负责创意决策和精修。

核心 slogan 可以是：**"AI 是你的副导演，你是总导演。"**

这个定位强调：
1. 这是一个**制作工作台**（Studio），不是一个批量转换器
2. AI 和人是**协作关系**，不是"一键全自动"
3. 输出是**专业级广播剧**，不只是"会读小说的语音"

---

## 六、与架构升级计划的关系

差异化方向对架构的影响：

1. **导演模式** → LLM 调用层需要更深度的 prompt 设计（情绪分析、场景切分、音效推荐）
2. **多轨道时间线** → 前端需要一个完善的音频编辑组件（可参考 wavesurfer.js / peaks.js）
3. **场景化制作** → 数据模型需要增加 Scene 层级（Project → Scene → ScriptLine）
4. **中文网文优化** → LLM prompt 需要针对中文叙事结构特训

这些都不改变"一切皆 RESTful URL"的架构基础，而是在此之上增加更深的应用层逻辑。

  React + FastAPI 完全能做多轨道编辑器，但有一个关键前提                                            
                                                                                                    
  音频编辑本质上是前端的活，后端只负责两件事：生成音频 和 最终导出。                                
                                                                                                    
  架构是这样的：                                                                                    
                                                                                                    
  ┌─────────── 浏览器 (React) ──────────────────────┐                                               
  │                                                   │                                             
  │  ┌─ 时间线 UI (Canvas 绑定) ──────────────────┐  │                                              
  │  │  Track 1: 角色A对白  [====▃▅▇▅▃====]       │  │
  │  │  Track 2: 角色B对白    [==▃▅▇▅▃==]         │  │                                              
  │  │  Track 3: 旁白          [===▃▅▇▅===]       │  │
  │  │  Track 4: 环境音  [▁▁▂▃▃▂▁▁▁▂▃▃▂▁▁]       │  │                                               
  │  │  Track 5: BGM    [▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁]       │  │                                               
  │  └────────────────────────────────────────────┘  │
  │                                                   │
  │  播放预览: Web Audio API                          │
  │    Source1 ──► Gain1 ──┐                         │
  │    Source2 ──► Gain2 ──┼──► 扬声器               │
  │    Source3 ──► Gain3 ──┘                         │
  │                                                   │
  │  波形显示: Canvas + 预计算的 peaks 数据            │
  │  拖拽/裁剪: 只修改 JSON 元数据，不动原始音频       │
  └───────────────────────┬───────────────────────────┘
                          │
            用户点击"导出"时发送 JSON
                          │
                          ▼
  ┌─────────── FastAPI 后端 ──────────────────────────┐
  │                                                    │
  │  收到时间线 JSON:                                   │
  │  { tracks: [                                       │
  │    {file: "roleA_01.wav", start: 0.0, gain: 0.8}, │
  │    {file: "roleB_01.wav", start: 2.3, gain: 1.0}, │
  │    {file: "rain.wav", start: 0.0, gain: 0.3},     │
  │  ]}                                                │
  │                                                    │
  │  → FFmpeg 混音 → 输出最终文件                       │
  │  → audiowaveform 生成波形数据 → 返回给前端          │
  └────────────────────────────────────────────────────┘

  核心答案

  前端做实时预览，后端做最终导出。 分工明确，性能完全够用。

  具体来说：

  ┌────────────────┬─────────────────────────────────────────────────────────────────────────────┐
  │   你担心的点   │                                  实际情况                                   │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │                │ 后端用 audiowaveform（BBC开源工具）预计算 peaks                             │
  │ 波形渲染性能   │ 数据，前端只画预计算好的曲线，不解码原始音频。1小时音频的 peaks             │
  │                │ 数据只有几十KB                                                              │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ 多轨道实时播放 │ Web Audio API 原生支持，每个轨道一个 GainNode 汇总到输出，20-30             │
  │                │ 轨道毫无压力                                                                │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ 长音频内存爆炸 │ 用 MediaElement（HTML5                                                      │
  │                │ Audio）流式播放，不要把整个文件解码到内存。1小时音频流式播放只占几MB内存    │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ 拖拽/裁剪操作  │ 只修改 JSON 元数据（起始时间、结束时间、增益值），不操作原始音频文件        │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ 最终导出       │ 前端发 JSON 给后端，后端用 FFmpeg 混合所有轨道，输出 MP3/WAV/FLAC           │
  ├────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ 打包成桌面应用 │ Tauri 完全支持 Canvas + Web Audio API，和浏览器里一样                       │
  └────────────────┴─────────────────────────────────────────────────────────────────────────────┘

  不需要从零写——有现成的库

  最推荐的起点是 waveform-playlist v5：
  - 这是一个完整的 React 多轨道编辑器组件
  - 基于 Canvas 画波形 + Tone.js 做音频引擎
  - 支持拖拽移动、裁剪、多种音频效果
  - WAV 导出
  - 有 React hooks + Provider 模式，可以直接嵌入你的项目

  你的工作量主要在：
  1. 把 waveform-playlist 集成进你的 React 项目
  2. 把 TTS 生成的音频片段自动加载到对应轨道
  3. 后端加一个 FFmpeg 导出接口 + audiowaveform 峰值生成接口
  4. UI 设计适配你的广播剧工作流（角色轨道、环境音轨道等）

  一个建议

  不要一上来就做完整的多轨道编辑器。 分步来：

  1. 第一步（现在）： 先把基础流程跑通（小说→分析→TTS→输出）
  2. 第二步： 加一个简单的时间线预览（只读，显示所有片段的排列和波形）
  3. 第三步： 允许拖拽调整片段顺序和间距
  4. 第四步： 加入环境音/BGM 轨道
  5. 第五步： 精修功能（单句重生成、音量调节、淡入淡出）

