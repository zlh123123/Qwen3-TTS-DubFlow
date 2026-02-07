import React, { createContext, useState, useContext, useEffect } from 'react';
import * as API from '../api/endpoints';

const LangCtx = createContext();

// 🟢 词典：已增加 ja-JP 支持
const DICT = {
  'zh-CN': {
    // 通用 (General)
    app_title: 'DUBFLOW',
    rank: '冒险等阶 60',
    loading: '载入中...',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    back: '返回',
    finish: '完成',
    abandon: '舍弃',
    action_go: '出击',

    // 首页 (Home / Project List)
    quest_log: '项目委托',
    quest_sub: 'Quest Journal',
    new_quest: '新委托',
    search_ph: '搜索项目...',
    sort_new: '最新创建',
    sort_old: '最早创建',
    sort_name: '名称排序',
    del_confirm: '确定要删除这个项目吗？相关音频文件将一并清理。',
    
    // 状态 (States)
    status_created: '已创建',
    status_analyzing: '分析中',
    status_characters_ready: '角色已就绪',
    status_script_ready: '剧本已就绪',
    status_synthesizing: '合成中',
    status_completed: '已完成',

    // 创建弹窗 (Create Modal)
    project_codename: '项目代号',
    resources_label: '资源文件 (仅限 TXT)',
    upload_ph: '点击或拖拽多个文本文件',
    add_more: '添加更多',
    manual_input: '跳过上传，手动输入文本',
    word_count: '字数',
    est_time: '预计时长',

    // 设置 (Settings Labels)
    settings_title: '系统设置',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: '外观交互',
    tab_llm: '语言模型',
    tab_tts: '语音后端',
    tab_syn: '合成策略',
    
    'app.theme_mode': '主题模式',
    'app.language': '系统语言',
    'llm.active_provider': '当前 LLM 服务商',
    'llm.deepseek.api_key': 'DeepSeek API Key',
    'tts.backend': 'TTS 后端类型',
    'syn.default_speed': '默认语速',
    'opt.light': '明亮',
    'opt.dark': '暗黑',
    'opt.system': '跟随系统',
    'llm.selfdef.model_name': '自定义模型名称',
    
    btn_save: '同步修改',
    btn_saving: '同步中...',
    save_fail: '配置保存失败',

    // 工坊与演播室 (Workshop - 未来页面)
    party_setup: '队伍配置',
    members: '成员',
    voice_title: '语音试听',
    studio_title: '剧情回顾',
    cast_list: '角色表',
    params: '参数配置',
    btn_batch: '批量生成',
    chk_skip: '跳过已完成',
  },

  'en-US': {
    // General
    app_title: 'DUBFLOW',
    rank: 'RANK 60',
    loading: 'Loading...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    back: 'Back',
    finish: 'Done',
    abandon: 'Abandon',
    action_go: 'Deploy',

    // Home
    quest_log: 'Quest Log',
    quest_sub: 'Mission Records',
    new_quest: 'New Commission',
    search_ph: 'Search projects...',
    sort_new: 'Newest First',
    sort_old: 'Oldest First',
    sort_name: 'Name (A-Z)',
    del_confirm: 'Are you sure? All related audio files will be deleted.',

    // States
    status_created: 'Created',
    status_analyzing: 'Analyzing',
    status_characters_ready: 'Characters Ready',
    status_script_ready: 'Script Ready',
    status_synthesizing: 'Synthesizing',
    status_completed: 'Completed',

    // Create Modal
    project_codename: 'Project Codename',
    resources_label: 'Resources (TXT Only)',
    upload_ph: 'Click or drag files here',
    add_more: 'Add More',
    manual_input: 'Skip upload, input manually',
    word_count: 'Words',
    est_time: 'Est. Duration',

    // Settings
    settings_title: 'Settings',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'Interface',
    tab_llm: 'LLM Core',
    tab_tts: 'TTS Backend',
    tab_syn: 'Strategy',

    'app.theme_mode': 'Theme Mode',
    'app.language': 'System Language',

    'llm.active_provider': 'Active LLM Provider',
    'llm.deepseek.api_key': 'DeepSeek API Key',
    'llm.qwen.api_key': 'Qwen API Key',
    'llm.selfdef.url': 'Custom LLM URL',
    'llm.selfdef.api_key': 'Custom LLM API Key',
    'llm.selfdef.model_name': 'Custom Model Name',
    
    'tts.backend': 'TTS Engine Type',
    'tts.local.model_base_path': 'Model Base Path',
    'tts.local.model_vd_path': 'VoiceDesign Path',
    'tts.local.device': 'Compute Device',
    'tts.vllm.url': 'vLLM Service URL',
    'tts.autodl.base_port': 'Base Model Port',
    'tts.autodl.vd_port': 'VoiceDesign Port',
    'tts.aliyun.api_key': 'DashScope API Key',
    'tts.aliyun.region': 'Service Region',

    'syn.default_speed': 'Default Speed',
    'syn.silence_duration': 'Silence Between Sentences',
    'syn.export_path': 'Export Directory',
    'syn.max_workers': 'Max Parallel Workers',
    'syn.volume_gain': 'Volume Gain',
    'syn.audio_format': 'Audio Format',
    'syn.auto_slice': 'Auto Text Slicing',
    'syn.text_clean': 'Text Pre-cleaning',

    btn_save: 'Save Changes',
    btn_saving: 'Saving...',
    save_fail: 'Failed to save config',

    // Workshop
    party_setup: 'Party Setup',
    members: 'Members',
    voice_title: 'Voice Preview',
    studio_title: 'Story Review',
    cast_list: 'Cast List',
    params: 'Inspector',
    btn_batch: 'Batch Gen',
    chk_skip: 'Skip Ready',
  },

  'ja-JP': {
    // General
    app_title: 'DUBFLOW',
    rank: '冒険ランク 60',
    loading: '読み込み中...',
    confirm: '確認',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    back: '戻る',
    finish: '完了',
    abandon: '中止',
    action_go: '出撃',

    // Home
    quest_log: '任務記録',
    quest_sub: 'Quest Journal',
    new_quest: '新規依頼',
    search_ph: 'プロジェクトを検索...',
    sort_new: '新しい順',
    sort_old: '古い順',
    sort_name: '名前順',
    del_confirm: 'このプロジェクトを削除しますか？関連する音声ファイルも削除されます。',

    // States
    status_created: '作成済み',
    status_analyzing: '分析中',
    status_characters_ready: 'キャラ準備完了',
    status_script_ready: '台本準備完了',
    status_synthesizing: '合成中',
    status_completed: '完了',

    // Create Modal
    project_codename: '任務コード',
    resources_label: 'リソース (TXTのみ)',
    upload_ph: 'クリックまたはファイルをドロップ',
    add_more: '追加',
    manual_input: 'アップロードをスキップして入力',
    word_count: '文字数',
    est_time: '予想時間',

    // Settings
    settings_title: 'システム設定',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'インターフェース',
    tab_llm: '言語モデル',
    tab_tts: '音声エンジン',
    tab_syn: '合成戦略',

    'app.theme_mode': 'テーマ',
    'app.language': '言語',
    'llm.active_provider': 'LLMプロバイダー',
    'llm.deepseek.api_key': 'DeepSeek APIキー',
    'llm.qwen.api_key': 'Qwen APIキー',
    'llm.selfdef.url': 'カスタムLLM URL',
    'llm.selfdef.api_key': 'カスタムLLMキー',
    'llm.selfdef.model_name': 'カスタムモデル名',

    'tts.backend': '音声合成エンジン',
    'tts.local.model_base_path': 'ベースモデルパス',
    'tts.local.model_vd_path': 'ボイスデザインパス',
    'tts.local.device': '演算デバイス',
    'tts.vllm.url': 'vLLMサーバーアドレス',
    'tts.autodl.base_port': 'ベースモデルポート',
    'tts.autodl.vd_port': 'ボイスデザインポート',
    'tts.aliyun.api_key': 'DashScopeキー',
    'tts.aliyun.region': 'サービス地域',

    'syn.default_speed': 'デフォルト速度',
    'syn.silence_duration': '休止時間(秒)',
    'syn.export_path': '出力パス',
    'syn.max_workers': '最大並列数',
    'syn.volume_gain': '音量増益',
    'syn.audio_format': '音声フォーマット',
    'syn.auto_slice': '自動テキスト分割',
    'syn.text_clean': 'テキストクリーニング',

    btn_save: '変更を保存',
    btn_saving: '保存中...',
    save_fail: '保存に失敗しました',

    // Workshop
    party_setup: 'チーム編成',
    members: 'メンバー',
    voice_title: '音声プレビュー',
    studio_title: 'ストーリー回想',
    cast_list: '登場人物',
    params: 'インスペクター',
    btn_batch: '一括生成',
    chk_skip: '生成済みをスキップ',
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