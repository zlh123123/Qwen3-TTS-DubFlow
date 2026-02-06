import React, { createContext, useState, useContext, useEffect } from 'react';
import * as API from '../api/endpoints';

const LangCtx = createContext();

// 🟢 词典：已增加 ja-JP 支持
const DICT = {
  'zh-CN': {
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
    quest_log: '项目委托',
    quest_sub: 'Quest Journal',
    new_quest: '新委托',
    del_confirm: '确定要删除这个项目吗？相关音频文件将一并清理。',
    status_created: '已创建',
    status_analyzing: '分析中',
    status_characters_ready: '角色已就绪',
    status_script_ready: '剧本已就绪',
    status_synthesizing: '合成中',
    status_completed: '已完成',
    settings_title: '系统设置',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: '外观交互',
    tab_llm: '语言模型',
    tab_tts: '语音后端',
    tab_syn: '合成策略',
  },
  'en-US': {
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
    quest_log: 'Quest Log',
    quest_sub: 'Mission Records',
    new_quest: 'New Commission',
    del_confirm: 'Are you sure? All related audio files will be deleted.',
    status_created: 'Created',
    status_analyzing: 'Analyzing',
    status_characters_ready: 'Characters Ready',
    status_script_ready: 'Script Ready',
    status_synthesizing: 'Synthesizing',
    status_completed: 'Completed',
    settings_title: 'Settings',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'Interface',
    tab_llm: 'LLM Core',
    tab_tts: 'TTS Backend',
    tab_syn: 'Strategy',
  },
  // 🟢 新增日语词典
  'ja-JP': {
    app_title: 'DUBFLOW',
    rank: '冒険ランク 60',
    loading: '読み込み中...',
    confirm: '確認',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    back: '戻る',
    finish: '完了',
    action_go: '出撃',
    quest_log: '任務記録',
    quest_sub: 'Quest Journal',
    new_quest: '新規依頼',
    del_confirm: 'このプロジェクトを削除しますか？関連する音声ファイルも削除されます。',
    status_created: '作成済み',
    status_analyzing: '分析中',
    status_characters_ready: 'キャラ準備完了',
    status_script_ready: '台本準備完了',
    status_synthesizing: '合成中',
    status_completed: '完了',
    settings_title: 'システム設定',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'インターフェース',
    tab_llm: '言語モデル',
    tab_tts: '音声エンジン',
    tab_syn: '合成戦略',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('zh-CN');
  const [theme, setThemeState] = useState('light');

  const applyTheme = (mode) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
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

  // 🟢 初始化：适配 client.js 剥离 .data 后的数据结构
  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await API.getSettings();
        // res 现在直接是 { appearance: [...], llm_settings: [...] }
        const appearanceItems = res?.appearance || [];
        
        // 从列表中寻找对应的 key
        const langConfig = appearanceItems.find(i => i.key === 'app.language');
        const themeConfig = appearanceItems.find(i => i.key === 'app.theme_mode');

        if (langConfig?.value) setLangState(langConfig.value);
        if (themeConfig?.value) applyTheme(themeConfig.value);
        
      } catch (err) {
        console.warn("Using local defaults due to API error", err);
        applyTheme('system');
      }
    };

    initApp();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      setThemeState(prev => {
        if (prev === 'system') applyTheme('system');
        return prev;
      });
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

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
  if (!context) throw new Error("useLang must be used within a LanguageProvider");
  return context;
};