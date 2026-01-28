Qwen3-DubFlow API 文档

版本: v1.0.0
Base URL: http://localhost:8000/api/v1 (开发环境)

⚡️ 核心交互逻辑：异步任务 (Async Task)

本项目涉及大量 GPU 耗时操作（LLM 分析、语音合成），因此采用 "触发 -> 轮询 -> 获取" 的异步模式。

前端交互流程：

调用耗时接口（如合成），后端立刻返回 { "task_id": "..." }。

前端拿着 task_id 每隔 2-3秒 调用 GET /tasks/{task_id} 查询状态。

当状态变为 SUCCESS 时，通过结果中的 url 获取资源或刷新页面数据。

📦 1. 通用接口 (General)

1.1 查询异步任务状态

用于轮询所有耗时操作的进度。

URL: /tasks/{task_id}

Method: GET

Response:

{
  "code": 200,
  "data": {
    "task_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PROCESSING",  // PENDING (排队中), PROCESSING (处理中), SUCCESS (成功), FAILURE (失败)
    "progress": 45,          // 进度百分比 (0-100, 可选)
    "message": "正在加载 vLLM 模型...", // 当前步骤描述 (可选)
    "result": {              // 只有当 status == SUCCESS 时才有此字段
       "file_url": "/static/outputs/full_drama.wav",
       "data": { ... }
    },
    "error": null            // 只有当 status == FAILURE 时才有错误信息
  }
}


📂 2. 项目管理 (Projects)

2.1 创建新项目

上传小说文本，初始化项目。

URL: /projects

Method: POST

Body:

{
  "name": "我的广播剧项目",
  "content": "第一章... (小说全文文本)"
}


Response:

{
  "code": 200,
  "data": {
    "id": "proj_001",
    "name": "我的广播剧项目",
    "created_at": "2026-01-28T12:00:00"
  }
}


2.2 获取项目列表

URL: /projects

Method: GET

🎭 3. 角色分析与管理 (Characters)

3.1 [异步] 触发角色分析

使用 LLM 分析小说文本，提取角色设定。

URL: /projects/{project_id}/characters/analyze

Method: POST

Response: { "code": 200, "data": { "task_id": "task_char_001" } }

轮询结果: 任务成功后，请调用 3.2 获取角色列表 刷新界面。

3.2 获取角色列表

URL: /projects/{project_id}/characters

Method: GET

Response:

{
  "code": 200,
  "data": [
    {
      "id": "char_1",
      "name": "小林",
      "gender": "male",
      "instruct": "25岁男性，声音清亮但时常犹豫...", // 用于 Voice Design 的提示词
      "ref_text": "啊？我、我……我其实不太会喝酒……",   // 用于克隆的参考文本
      "ref_audio_url": null,  // 如果还没有生成过参考音频，则为 null
      "is_confirmed": false   // 用户是否确认了该角色的音色
    },
    {
      "id": "char_2",
      "name": "御姐",
      "gender": "female",
      "instruct": "成熟御姐音...",
      "ref_text": "小弟弟，喝一杯？",
      "ref_audio_url": "/static/refs/ref_char_2.wav",
      "is_confirmed": true
    }
  ]
}


3.3 修改角色设定

用户手动修正 LLM 分析不准确的地方。使用 PUT 是因为是对已有资源的更新。

URL: /characters/{character_id}

Method: PUT

Body:

{
  "name": "小林 (修正版)",
  "instruct": "修改后的 Prompt...",
  "ref_text": "修改后的定妆台词..."
}


Response: { "code": 200, "message": "updated" }

🎙️ 4. 音色铸造 (Voice Design)

4.1 [异步] 试听/生成参考音频

调用 VoiceDesign 模型生成一段音频供用户试听。

URL: /voices/preview

Method: POST

Body:

{
  "project_id": "proj_001",
  "character_id": "char_1",
  "instruct": "25岁男性，声音清亮...", // 如果不传，使用数据库里存的
  "ref_text": "啊？我不太会喝酒..."
}


Response: { "code": 200, "data": { "task_id": "task_preview_001" } }

轮询结果: 任务成功后，result.file_url 即为试听音频地址。

4.2 确认定妆 (Confirm Voice)

用户对试听满意，锁定该音色用于后续合成。

URL: /voices/confirm

Method: POST

Body:

{
  "character_id": "char_1",
  "preview_task_id": "task_preview_001" // 指定哪一次试听的结果是满意的
}


Response: { "code": 200, "message": "Voice confirmed and baked." }

📜 5. 剧本编辑 (Script)

5.1 [异步] 触发剧本切分

使用 LLM 将小说原文切分为对话列表。

URL: /projects/{project_id}/script/parse

Method: POST

Response: { "code": 200, "data": { "task_id": "task_script_001" } }

5.2 获取剧本详情

URL: /projects/{project_id}/script

Method: GET

Response:

{
  "code": 200,
  "data": [
    {
      "line_id": 101,
      "role_id": "char_1",
      "role_name": "小林",
      "text": "老板，我真的错了！",
      "audio_url": null // 未合成
    },
    {
      "line_id": 102,
      "role_id": "char_2",
      "role_name": "御姐",
      "text": "没关系。",
      "audio_url": "/static/outputs/line_102.wav" // 已合成
    }
  ]
}


5.3 修改单句台词

用于修正 LLM 识别错误的说话人或文本。

URL: /script/{line_id}

Method: PUT

Body:

{
  "role_id": "char_2", // 改为御姐说的
  "text": "其实也没关系啦。" // 修改台词
}


🎬 6. 最终合成 (Synthesis)

6.1 [异步] 开始批量合成

触发 vLLM Base Clone 模型进行全书或选段合成。

URL: /projects/{project_id}/synthesize

Method: POST

Body:

{
  "lines": [101, 200] // 可选：只合成第101到200句。不传则合成全部。
}


Response: { "code": 200, "data": { "task_id": "task_syn_001" } }

6.2 下载完整音频

URL: /projects/{project_id}/download

Method: GET

Response: 直接返回 `.
