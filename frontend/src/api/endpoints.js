import client from './client';

/**
 * 🛠️ 生产模式建议将 USE_MOCK 设为 false
 * 联动后端 API 地址：/api/projects, /api/settings 等
 */
const USE_MOCK = false; 

// ==========================================
// 1. 项目仪表盘 (Dashboard)
// ==========================================

// 获取所有项目列表
export const getProjects = async () => {
  if (USE_MOCK) {
    return {
      data: {
        total: 2,
        items: [
          { id: "p1", name: "斗破苍穹", state: "synthesizing", created_at: "2026-02-02T10:00:00" },
          { id: "p2", name: "凡人修仙传", state: "characters_ready", created_at: "2026-02-01T14:20:00" }
        ]
      }
    };
  }
  return client.get('/projects');
};

// 创建新项目
export const createProject = async (data) => {
  // data: { name, content }
  return client.post('/projects', data);
};

// 获取单个项目详情 (用于状态路由判断)
export const getProjectDetail = async (pid) => {
  return client.get(`/projects/${pid}`);
};

// 删除项目 (级联删除)
export const deleteProject = async (pid) => {
  return client.delete(`/projects/${pid}`);
};

// 调用角色分析 (异步)
export const analyzeCharacters = async (pid) => {
  return client.post(`/projects/${pid}/characters/analyze`);
};

// ==========================================
// 2. 角色工坊 (Workshop)
// ==========================================

export const getCharacters = async (pid) => {
  return client.get(`/projects/${pid}/characters`);
};

// 语音试听 (异步任务)
export const previewVoice = async (data) => {
  return client.post('/voices/preview', data);
};

// 确认定妆
export const confirmVoice = async (charId, taskId) => {
  return client.post(`/characters/${charId}/confirm_voice`, { temp_audio_task_id: taskId });
};

// ==========================================
// 3. 演播室 (Studio)
// ==========================================

export const getScript = async (pid) => {
  return client.get(`/projects/${pid}/script`);
};

export const addLine = async (pid, prevLineId) => {
  return client.post(`/projects/${pid}/script/lines`, { prev_line_id: prevLineId });
};

export const deleteLine = async (lineId) => {
  return client.delete(`/script/${lineId}`);
};

// 提交合成任务 (异步任务)
export const synthesize = async (data) => {
  // data: { project_id, line_ids }
  return client.post('/synthesis', data);
};

// ==========================================
// 4. 任务系统 (Task Polling)
// ==========================================

// 轮询异步任务状态
export const getTaskStatus = async (taskId) => {
  return client.get(`/tasks/${taskId}`);
};

// ==========================================
// 5. 系统设置 (Settings)
// ==========================================

export const getSettings = async () => {
  if (USE_MOCK) {
    return {
      data: {
        app: { theme_mode: 'light', language: 'zh-CN' },
        llm: { active_provider: 'deepseek', deepseek: { api_key: '' }, qwen: { api_key: '' }, local: { url: 'http://localhost:11434' } },
        tts: { active_backend: 'local_docker', local: { url: 'http://tts-base:8000' }, remote: { url: '', token: '' }, aliyun: { app_key: '', token: '' } },
        syn: { default_speed: 1.0, silence_duration: 0.5, export_path: '/data/outputs', max_workers: 2, volume_gain: 1.0, audio_format: 'wav', auto_slice: true, text_clean: true }
      }
    };
  }
  return client.get('/settings');
};

export const updateSettings = async (settings) => {
  return client.put('/settings', settings);
};