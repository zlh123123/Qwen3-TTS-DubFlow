import client from './client';

// ✅ 开启 Mock 模式：这就意味着不请求后端，直接返回假数据
const USE_MOCK = true;

// 模拟网络延迟 (1秒)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. 项目相关 ---
export const createProject = async (data) => {
  if (USE_MOCK) {
    await delay(800);
    return { data: { id: 'mock-project-001', name: data.name, created_at: new Date() } };
  }
  return client.post('/projects', data);
};

export const getProject = async (pid) => {
  if (USE_MOCK) return { data: { id: pid, name: '演示项目: 斗破苍穹' } };
  return client.get(`/projects/${pid}`);
};

// --- 2. 角色相关 ---
export const analyzeCharacters = async (pid) => {
  if (USE_MOCK) return { data: { task_id: 'mock-task-analyze-001' } };
  return client.post(`/projects/${pid}/characters/analyze`);
};

export const getCharacters = async (pid) => {
  if (USE_MOCK) {
    await delay(600);
    return {
      data: [
        { id: 101, name: 'Li Yunlong', desc: 'Middle-aged/Angry/Loud', active: true, avatar: '🪖' },
        { id: 102, name: 'Zhao Gang', desc: 'Young/Calm/Intellectual', active: false, avatar: '👓' },
        { id: 103, name: 'Fink Yunlong', desc: 'Female/Sarcastic', active: false, avatar: '👩' },
        { id: 104, name: 'Monk Wei', desc: 'Strong/Loyal', active: false, avatar: '🥋' },
      ]
    };
  }
  return client.get(`/projects/${pid}/characters`);
};

export const previewVoice = async (data) => {
  if (USE_MOCK) return { data: { task_id: 'mock-task-preview-001' } };
  return client.post('/voices/preview', data);
};

export const confirmVoice = async (charId, taskId) => {
  if (USE_MOCK) return { data: { message: 'ok' } };
  return client.post(`/characters/${charId}/confirm_voice`, { temp_audio_task_id: taskId });
};

// 模拟添加台词
export const addLine = async (pid, prevLineId) => {
  if (USE_MOCK) {
    return {
      data: {
        id: Date.now(), // 生成临时ID
        character_id: 101, // 默认分配给主角
        character_name: 'Li Yunlong',
        text: '（新增台词）',
        status: 'pending',
        audio_url: null
      }
    };
  }
  return client.post(`/projects/${pid}/script/lines`, { prev_line_id: prevLineId });
};

// 模拟删除台词
export const deleteLine = async (lineId) => {
  if (USE_MOCK) return { data: { success: true } };
  return client.delete(`/script/${lineId}`);
};

// --- 3. 剧本与合成 ---
export const getScript = async (pid) => {
  if (USE_MOCK) {
    await delay(500);
    return {
      data: [
        { 
          id: 5001, 
          character_id: 101, 
          character_name: 'Li Yunlong', 
          text: '二营长！你他娘的意大利炮呢？给我拉上来！', 
          status: 'synthesized', 
          // 这里放一个公网可访问的音频用于测试
          audio_url: 'https://p.scdn.co/mp3-preview/2f37da1d4221f40b9d1a98cd191f4d6f1646ad17' 
        },
        { 
          id: 5002, 
          character_id: 102, 
          character_name: 'Zhao Gang', 
          text: '老李，你冷静点！这可是敌人的阵地！', 
          status: 'pending', 
          audio_url: null 
        },
        { 
          id: 5003, 
          character_id: 101, 
          character_name: 'Li Yunlong', 
          text: '什么他娘的精锐，老子打的就是精锐！', 
          status: 'pending', 
          audio_url: null 
        },
      ]
    };
  }
  return client.get(`/projects/${pid}/script`);
};

export const synthesize = async (data) => {
  if (USE_MOCK) return { data: { task_id: 'mock-task-syn-001' } };
  return client.post('/synthesis', data);
};

// --- 4. 通用轮询 (模拟异步任务完成) ---
export const getTaskStatus = async (taskId) => {
  if (USE_MOCK) {
    // 假装等待 1.5 秒后任务成功
    await delay(1500); 
    return { 
      data: { 
        status: 'success', 
        result: { 
          // 返回一个假音频 URL
          audio_url: 'https://p.scdn.co/mp3-preview/2f37da1d4221f40b9d1a98cd191f4d6f1646ad17',
          message: 'Task Completed' 
        } 
      } 
    };
  }
  return client.get(`/tasks/${taskId}`);
};

// 获取设置
export const getSettings = async () => {
  if (USE_MOCK) {
    return {
      data: {
        llm_provider: 'qwen', // 默认 qwen
        api_key: '',          // 默认为空
        base_url: 'http://localhost:11434/v1' // 本地部署常用地址
      }
    };
  }
  return client.get('/settings');
};

// 更新设置
export const updateSettings = async (settings) => {
  if (USE_MOCK) {
    await delay(500); // 模拟保存延迟
    console.log("Settings Saved:", settings); // 方便调试看结果
    return { data: { success: true } };
  }
  return client.put('/settings', settings);
};