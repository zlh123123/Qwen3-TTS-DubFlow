import React, { createContext, useState, useContext, useEffect } from 'react';
import * as API from '../api/endpoints';

const LangCtx = createContext();

// 词典：仅保留纯净的状态描述，去掉元素前缀
const DICT = {
  'zh-CN': {
    // 通用
    app_title: 'DUBFLOW',
    rank: '冒险等阶 60',
    loading: '载入中...',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    back: '返回',
    finish: '完成',
    action_go: '出击',
    
    // 首页 (CreateProject)
    quest_log: '项目委托',
    quest_sub: 'Quest Journal',
    new_quest: '新委托',
    del_confirm: '确定要删除这个项目吗？相关音频文件将一并清理。',
    
    // 对应后端 API 的 state 字段 (去掉元素味)
    status_created: '已创建',
    status_analyzing: '分析中',
    status_characters_ready: '角色已就绪',
    status_script_ready: '剧本已就绪',
    status_synthesizing: '合成中',
    status_completed: '已完成',
    
    // 设置 (Settings)
    settings_title: '系统设置',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: '外观交互',
    tab_llm: '语言模型',
    tab_tts: '语音后端',
    tab_syn: '合成策略',
    lbl_theme: '主题模式',
    lbl_lang: '系统语言',
    lbl_provider: '当前服务商',
    btn_save: '保存配置',
    btn_saving: '保存中...',
    save_fail: '配置保存失败',

    // 工坊与演播室
    party_setup: '队伍配置',
    members: '成员',
    voice_title: '语音试听',
    studio_title: '剧情回顾',
    cast_list: '角色表',
    params: '参数配置',
    btn_batch: '批量生成',
    chk_skip: '跳过已完成',
    lbl_text: '台词文本',
    lbl_speaker: '发言人',
    lbl_speed: '播放语速',
    btn_update_play: '更新并预览',
    msg_add_fail: '行添加失败',
    msg_del_confirm: '确定删除此行台词吗？',
    msg_batch_done: '批量合成任务已提交',
    ph_bubble: '点击台词气泡进行编辑',
  },
  'en-US': {
    // Common
    app_title: 'DUBFLOW',
    rank: 'RANK 60',
    loading: 'Loading...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    back: 'Back',
    finish: 'Done',
    action_go: 'Deploy',

    // Home
    quest_log: 'Quest Log',
    quest_sub: 'Mission Records',
    new_quest: 'New Commission',
    del_confirm: 'Are you sure? All related audio files will be deleted.',
    
    // API States
    status_created: 'Created',
    status_analyzing: 'Analyzing',
    status_characters_ready: 'Characters Ready',
    status_script_ready: 'Script Ready',
    status_synthesizing: 'Synthesizing',
    status_completed: 'Completed',

    // Settings
    settings_title: 'Settings',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'Interface',
    tab_llm: 'LLM Core',
    tab_tts: 'TTS Backend',
    tab_syn: 'Strategy',
    lbl_theme: 'Theme Mode',
    lbl_lang: 'Language',
    lbl_provider: 'Provider',
    btn_save: 'Save Changes',
    btn_saving: 'Saving...',
    save_fail: 'Failed to save config',

    // Workshop & Studio
    party_setup: 'Party Setup',
    members: 'Members',
    voice_title: 'Voice Preview',
    studio_title: 'Story Review',
    cast_list: 'Cast',
    params: 'Inspector',
    btn_batch: 'Batch Gen',
    chk_skip: 'Skip Ready',
    lbl_text: 'Text Content',
    lbl_speaker: 'Speaker',
    lbl_speed: 'Speed',
    btn_update_play: 'Update & Play',
    msg_add_fail: 'Failed to add line',
    msg_del_confirm: 'Delete this line?',
    msg_batch_done: 'Batch tasks submitted',
    ph_bubble: 'Select a bubble to edit',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('zh-CN');
  const [theme, setThemeState] = useState('light');

  // 🟢 核心方法：切换暗黑模式 Class
  const applyTheme = (mode) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    
    // 逻辑：判断是否应该激活 dark class
    const isDark = 
      mode === 'dark' || 
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setThemeState(mode);
  };

  // 🟢 初始化：从后端拉取用户偏好
  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await API.getSettings();
        const appCfg = res?.data?.app;
        if (appCfg) {
          if (appCfg.language) setLangState(appCfg.language);
          if (appCfg.theme_mode) applyTheme(appCfg.theme_mode);
        }
      } catch (err) {
        console.warn("Using local defaults due to API error");
        applyTheme('system'); // 失败时默认跟随系统
      }
    };

    initApp();

    // 监听系统主题实时变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      // 只有在 system 模式下才需要响应变化
      setThemeState(prev => {
        if (prev === 'system') applyTheme('system');
        return prev;
      });
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  // 翻译函数：增加 key 存在性校验
  const t = (key) => {
    const translationSet = DICT[lang] || DICT['zh-CN'];
    return translationSet[key] || key;
  };

  return (
    <LangCtx.Provider value={{ 
      lang, 
      setLang: setLangState, 
      theme, 
      setTheme: applyTheme, 
      t 
    }}>
      {children}
    </LangCtx.Provider>
  );
}

export const useLang = () => {
  const context = useContext(LangCtx);
  if (!context) {
    throw new Error("useLang must be used within a LanguageProvider");
  }
  return context;
};