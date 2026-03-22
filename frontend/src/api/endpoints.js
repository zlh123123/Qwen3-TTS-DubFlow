import client from './client';

// ==========================================
// 1. 项目仪表盘 (Dashboard)
// ==========================================

// 获取项目列表
export const getProjects = async () => {
  return client.get('/projects');
};

// 创建项目
export const createProject = async (data) => {
  return client.post('/projects', data);
};

// 获取项目详情
export const getProjectDetail = async (pid) => {
  return client.get(`/projects/${pid}`);
};

// 重命名项目
export const renameProject = async (pid, data) => {
  return client.put(`/projects/${pid}`, data);
};

// 删除项目
export const deleteProject = async (pid) => {
  return client.delete(`/projects/${pid}`);
};

// 触发角色分析 (AI)
export const analyzeCharacters = async (pid) => {
  return client.post(`/projects/${pid}/characters/analyze`);
};

// ==========================================
// 2. 角色工坊 (Workshop)
// ==========================================

// 🟢 [核心修复 1] 获取角色列表
// 之前报错 405 是因为请求了 /characters/，但后端是在 /projects/{pid}/characters
export const getCharacters = async (pid) => {
  return client.get(`/projects/${pid}/characters`);
};

// 🟢 [核心修复 2] 新增角色
// 解决了 TypeError: API.createCharacter is not a function
export const createCharacter = async (data) => {
  return client.post('/characters/', data);
};

// 🟢 [核心修复 3] 删除角色
// 解决了 TypeError: API.deleteCharacter is not a function
export const deleteCharacter = async (charId) => {
  return client.delete(`/characters/${charId}`);
};

// 更新角色信息 (姓名、性别、人设等)
export const updateCharacter = async (charId, data) => {
  return client.put(`/characters/${charId}`, data);
};

// 预览/生成语音
export const previewVoice = async (characterId) => {
  return client.post(`/characters/${characterId}/voice`);
};

// ==========================================
// 3. 演播室 (Studio)
// ==========================================

// 获取剧本
export const getScript = async (pid) => {
  return client.get(`/projects/${pid}/script`);
};

// 新增台词
export const addLine = async (pid, prevLineId) => {
  return client.post(`/projects/${pid}/script/lines`, { prev_line_id: prevLineId });
};

// 删除台词
// 注意：如果后端路由是 /script/{id} 则保持不变，如果是 /lines/{id} 请自行调整
export const deleteLine = async (lineId) => {
  return client.delete(`/script/${lineId}`);
};

// 更新台词 (文本或状态)
export const updateLine = async (lineId, data) => {
  return client.put(`/script/${lineId}`, data);
};

// 语音合成 (批量或导出)
export const synthesize = async (data) => {
  return client.post('/synthesis', data);
};

// ==========================================
// 4. 任务系统 (Task Polling)
// ==========================================

// 获取任务状态 (用于轮询生成进度)
export const getTaskStatus = async (taskId) => {
  return client.get(`/tasks/${taskId}`);
};

// ==========================================
// 5. 音频资产库 (CharacterRef / Effect / BGM)
// ==========================================

export const getCharacterRefs = async (pid) => {
  return client.get(`/projects/${pid}/character-refs`);
};

export const getGlobalCharacterRefs = async (pid) => {
  const params = {};
  if (pid) params.project_id = pid;
  return client.get('/assets/character-refs', { params });
};

export const importCharacterRef = async (pid, data) => {
  return client.post(`/projects/${pid}/character-refs/import`, data);
};

export const linkCharacterRef = async (pid, data) => {
  return client.post(`/projects/${pid}/character-refs/link`, data);
};

export const updateCharacterRefLink = async (pid, assetId, data) => {
  return client.put(`/projects/${pid}/character-refs/${assetId}/link`, data);
};

export const updateCharacterRef = async (assetId, data) => {
  return client.put(`/character-refs/${assetId}`, data);
};

export const unlinkCharacterRef = async (pid, assetId) => {
  return client.delete(`/projects/${pid}/character-refs/${assetId}/link`);
};

export const deleteCharacterRef = async (assetId) => {
  return client.delete(`/character-refs/${assetId}`);
};

export const getEffects = async (pid) => {
  return client.get(`/projects/${pid}/effects`);
};

export const getGlobalEffects = async (pid) => {
  const params = {};
  if (pid) params.project_id = pid;
  return client.get('/assets/effects', { params });
};

export const importEffect = async (pid, data) => {
  return client.post(`/projects/${pid}/effects/import`, data);
};

export const linkEffect = async (pid, data) => {
  return client.post(`/projects/${pid}/effects/link`, data);
};

export const updateEffect = async (assetId, data) => {
  return client.put(`/effects/${assetId}`, data);
};

export const unlinkEffect = async (pid, assetId) => {
  return client.delete(`/projects/${pid}/effects/${assetId}/link`);
};

export const deleteEffect = async (assetId) => {
  return client.delete(`/effects/${assetId}`);
};

export const getBgms = async (pid) => {
  return client.get(`/projects/${pid}/bgms`);
};

export const getGlobalBgms = async (pid) => {
  const params = {};
  if (pid) params.project_id = pid;
  return client.get('/assets/bgms', { params });
};

export const importBgm = async (pid, data) => {
  return client.post(`/projects/${pid}/bgms/import`, data);
};

export const linkBgm = async (pid, data) => {
  return client.post(`/projects/${pid}/bgms/link`, data);
};

export const updateBgm = async (assetId, data) => {
  return client.put(`/bgms/${assetId}`, data);
};

export const unlinkBgm = async (pid, assetId) => {
  return client.delete(`/projects/${pid}/bgms/${assetId}/link`);
};

export const deleteBgm = async (assetId) => {
  return client.delete(`/bgms/${assetId}`);
};

// ==========================================
// 6. 系统设置 (Settings)
// ==========================================

export const getSettings = async () => {
  return client.get('/settings');
};

export const updateSettings = async (settings) => {
  return client.put('/settings', settings);
};

export const fetchLLMModels = async (provider, customId) => {
  const params = {};
  if (provider) params.provider = provider;
  if (customId) params.custom_id = customId;
  return client.get('/settings/llm/models', { params });
};
