import client from './client';

const USE_MOCK = false; 

// ==========================================
// 1. 项目仪表盘 (Dashboard)
// ==========================================
export const getProjects = async () => {
  return client.get('/projects');
};

export const createProject = async (data) => {
  return client.post('/projects', data);
};

export const getProjectDetail = async (pid) => {
  return client.get(`/projects/${pid}`);
};

export const deleteProject = async (pid) => {
  return client.delete(`/projects/${pid}`);
};

export const analyzeCharacters = async (pid) => {
  return client.post(`/projects/${pid}/characters/analyze`);
};

// ==========================================
// 2. 角色工坊 (Workshop)
// ==========================================

export const getCharacters = async (pid) => {
  return client.get(`/projects/${pid}/characters`);
};

// 🟢 修复：匹配后端 @router.post("/{character_id}/voice")
export const previewVoice = async (characterId) => {
  return client.post(`/characters/${characterId}/voice`);
};

// 更新角色信息 (姓名、性别、人设等同步后端)
export const updateCharacter = async (charId, data) => {
  return client.put(`/characters/${charId}`, data);
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

export const synthesize = async (data) => {
  return client.post('/synthesis', data);
};

// ==========================================
// 4. 任务系统 (Task Polling)
// ==========================================
export const getTaskStatus = async (taskId) => {
  return client.get(`/tasks/${taskId}`);
};

// ==========================================
// 5. 系统设置 (Settings)
// ==========================================
export const getSettings = async () => {
  return client.get('/settings');
};

export const updateSettings = async (settings) => {
  return client.put('/settings', settings);
};