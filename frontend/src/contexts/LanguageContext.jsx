import React, { createContext, useState, useContext, useEffect } from 'react';
import * as API from '../api/endpoints';

const LangCtx = createContext();

const DICT = {
  'zh-CN': {
    // 通用 (General)
    app_title: 'NARRATIS',
    loading: '载入中...',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    back: '返回',
    finish: '完成',
    abandon: '舍弃',
    action_go: '下一步',

    // 首页 (Home / Project List)
    quest_log: '项目列表',
    quest_sub: 'Quest Journal',
    new_quest: '新建项目',
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
    tab_about: '关于',
    
    'app.theme_mode': '主题模式',
    'app.language': '系统语言',
    'app.font_size': '字体大小',
    'llm_provider_pick': '模型提供方',
    'llm.active_provider': '当前 LLM 服务商',
    'llm.deepseek.api_key': 'DeepSeek API Key',
    'llm.deepseek.base_url': 'DeepSeek 接口地址',
    'llm.deepseek.model': 'DeepSeek 模型',
    'llm.qwen.api_key': 'Qwen API Key',
    'llm.qwen.base_url': 'Qwen 接口地址',
    'llm.qwen.model': 'Qwen 模型',
    'llm.selfdef.url': '自定义 LLM 地址',
    'llm.selfdef.api_key': '自定义 LLM API Key',
    'tts.backend': 'TTS 后端类型',
    'tts.local.model_base_path': '克隆模型路径 (Base)',
    'tts.local.model_vd_path': '设计模型路径 (VoiceDesign)',
    'tts.local.device': '计算设备',
    'tts.vllm.base_url': 'Base 服务地址',
    'tts.vllm.vd_url': 'VoiceDesign 服务地址',
    'tts.autodl.base_port': 'Base 本地端口',
    'tts.autodl.vd_port': 'VoiceDesign 本地端口',
    'tts.aliyun.api_key': 'DashScope API Key',
    'tts.aliyun.region': '服务区域',
    'syn.default_speed': '默认语速',
    'opt.light': '明亮',
    'opt.dark': '暗黑',
    'opt.system': '跟随系统',
    'opt.small': '小',
    'opt.medium': '中',
    'opt.large': '大',
    'opt.zh-CN': '简体中文',
    'opt.en-US': 'English',
    'opt.ja-JP': '日本語',
    'opt.ko-KR': '한국어',
    'opt.es-ES': 'Español',
    'opt.fr-FR': 'Français',
    'opt.de-DE': 'Deutsch',
    'opt.deepseek': 'DeepSeek',
    'opt.qwen': 'Qwen',
    'opt.selfdef': '自定义',
    'opt.local_vllm': '本地 vLLM',
    'opt.autodl': 'AutoDL',
    'opt.aliyun': '阿里云',
    'opt.cuda': 'CUDA',
    'opt.cpu': 'CPU',
    'opt.beijing': '北京',
    'opt.singapore': '新加坡',
    'llm.selfdef.model_name': '自定义模型名称',
    
    btn_save: '同步修改',
    btn_saving: '同步中...',
    save_fail: '配置保存失败',

    // 工坊与演播室 (Workshop)
    party_setup: '主要人物',
    members: '成员',
    voice_title: '语音调试', // 已合并重复项
    studio_title: '剧情回顾',
    cast_list: '角色表',
    params: '参数配置',
    btn_batch: '批量生成',
    chk_skip: '跳过已完成',

    // 角色字段映射 (Character Fields)
    attr_title: '档案资料',
    lbl_name: '名称',
    lbl_gender: '性别',
    lbl_age: '年龄',
    lbl_description: '人设描述',
    lbl_prompt: '音色提示词',
    lbl_ref_text: '测试文本',
    ph_gender: '男 / 女',
    ph_age: '例：18',
    ph_description: '描述性格、背景等...',
    ph_prompt: '描述音色，如：成熟、温柔...',
    ph_ref_text: '用于生成试听音频的文本...',
    ph_select: '请选择成员进行整备',
    btn_reroll: '生成音频',
    btn_syncing: '生成中...',
    del_confirm_char: '确定要删除这名成员吗？',
    msg_generate_failed: '生成失败',
  },

  'en-US': {
    app_title: 'NARRATIS',
    loading: 'Loading...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    back: 'Back',
    finish: 'Done',
    abandon: 'Abandon',
    action_go: 'Next',

    quest_log: 'Project List',
    quest_sub: 'Mission Records',
    new_quest: 'New Project',
    search_ph: 'Search projects...',
    sort_new: 'Newest First',
    sort_old: 'Oldest First',
    sort_name: 'Name (A-Z)',
    del_confirm: 'Are you sure? All related audio files will be deleted.',

    status_created: 'Created',
    status_analyzing: 'Analyzing',
    status_characters_ready: 'Characters Ready',
    status_script_ready: 'Script Ready',
    status_synthesizing: 'Synthesizing',
    status_completed: 'Completed',

    project_codename: 'Project Codename',
    resources_label: 'Resources (TXT Only)',
    upload_ph: 'Click or drag files here',
    add_more: 'Add More',
    manual_input: 'Skip upload, input manually',
    word_count: 'Words',
    est_time: 'Est. Duration',

    settings_title: 'Settings',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'Interface',
    tab_llm: 'LLM Core',
    tab_tts: 'TTS Backend',
    tab_syn: 'Strategy',
    tab_about: 'About',

    'app.theme_mode': 'Theme Mode',
    'app.language': 'System Language',
    'app.font_size': 'Font Size',
    'llm_provider_pick': 'Provider',
    'llm.active_provider': 'Active LLM Provider',
    'llm.deepseek.api_key': 'DeepSeek API Key',
    'llm.deepseek.base_url': 'DeepSeek Base URL',
    'llm.deepseek.model': 'DeepSeek Model',
    'llm.qwen.api_key': 'Qwen API Key',
    'llm.qwen.base_url': 'Qwen Base URL',
    'llm.qwen.model': 'Qwen Model',
    'llm.selfdef.url': 'Custom LLM URL',
    'llm.selfdef.api_key': 'Custom LLM API Key',
    'llm.selfdef.model_name': 'Custom Model Name',
    
    'tts.backend': 'TTS Engine Type',
    'tts.local.model_base_path': 'Model Base Path',
    'tts.local.model_vd_path': 'VoiceDesign Path',
    'tts.local.device': 'Compute Device',
    'tts.vllm.base_url': 'Base Service URL',
    'tts.vllm.vd_url': 'VoiceDesign Service URL',
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
    'opt.light': 'Light',
    'opt.dark': 'Dark',
    'opt.system': 'System',
    'opt.small': 'Small',
    'opt.medium': 'Medium',
    'opt.large': 'Large',
    'opt.zh-CN': 'Simplified Chinese',
    'opt.en-US': 'English',
    'opt.ja-JP': 'Japanese',
    'opt.ko-KR': 'Korean',
    'opt.es-ES': 'Spanish',
    'opt.fr-FR': 'French',
    'opt.de-DE': 'German',
    'opt.deepseek': 'DeepSeek',
    'opt.qwen': 'Qwen',
    'opt.selfdef': 'Custom',
    'opt.local_vllm': 'Local vLLM',
    'opt.autodl': 'AutoDL',
    'opt.aliyun': 'Aliyun',
    'opt.cuda': 'CUDA',
    'opt.cpu': 'CPU',
    'opt.beijing': 'Beijing',
    'opt.singapore': 'Singapore',

    btn_save: 'Save Changes',
    btn_saving: 'Saving...',
    save_fail: 'Failed to save config',

    party_setup: 'Key Characters',
    members: 'Members',
    voice_title: 'Voice Preview',
    studio_title: 'Story Review',
    cast_list: 'Cast List',
    params: 'Inspector',
    btn_batch: 'Batch Gen',
    chk_skip: 'Skip Ready',

    attr_title: 'Character Bio',
    lbl_name: 'Name',
    lbl_gender: 'Gender',
    lbl_age: 'Age',
    lbl_description: 'Description',
    lbl_prompt: 'Voice Prompt',
    lbl_ref_text: 'Ref Text',
    ph_gender: 'M / F',
    ph_age: 'e.g. 18',
    ph_description: 'Personality, background...',
    ph_prompt: 'Describe vibe, e.g. gentle...',
    ph_ref_text: 'Text for voice preview...',
    ph_select: 'Select a member to setup',
    btn_reroll: 'Generate Voice',
    btn_syncing: 'Syncing...',
    del_confirm_char: 'Delete this character?',
    msg_generate_failed: 'Failed to generate',
  },

  'ja-JP': {
    app_title: 'NARRATIS',
    loading: '読み込み中...',
    confirm: '確認',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    back: '戻る',
    finish: '完了',
    abandon: '中止',
    action_go: '次へ',

    quest_log: 'プロジェクト一覧',
    quest_sub: 'Quest Journal',
    new_quest: '新規作成',
    search_ph: 'プロジェクトを検索...',
    sort_new: '新しい順',
    sort_old: '古い順',
    sort_name: '名前順',
    del_confirm: 'このプロジェクトを削除しますか？関連する音声ファイルも削除されます。',

    status_created: '作成済み',
    status_analyzing: '分析中',
    status_characters_ready: 'キャラ準備完了',
    status_script_ready: '台本準備完了',
    status_synthesizing: '合成中',
    status_completed: '完了',

    project_codename: '任務コード',
    resources_label: 'リソース (TXTのみ)',
    upload_ph: 'クリックまたはファイルをドロップ',
    add_more: '追加',
    manual_input: 'アップロードをスキップして入力',
    word_count: '文字数',
    est_time: '予想時間',

    settings_title: 'システム設定',
    settings_sub: 'SYSTEM CONFIG',
    tab_app: 'インターフェース',
    tab_llm: '言語モデル',
    tab_tts: '音声エンジン',
    tab_syn: '合成戦略',
    tab_about: '情報',

    'app.theme_mode': 'テーマ',
    'app.language': '言語',
    'app.font_size': 'フォントサイズ',
    'llm_provider_pick': 'プロバイダー',
    'llm.active_provider': 'LLMプロバイダー',
    'llm.deepseek.api_key': 'DeepSeek APIキー',
    'llm.deepseek.base_url': 'DeepSeek ベースURL',
    'llm.deepseek.model': 'DeepSeek モデル',
    'llm.qwen.api_key': 'Qwen APIキー',
    'llm.qwen.base_url': 'Qwen ベースURL',
    'llm.qwen.model': 'Qwen モデル',
    'llm.selfdef.url': 'カスタムLLM URL',
    'llm.selfdef.api_key': 'カスタムLLMキー',
    'llm.selfdef.model_name': 'カスタムモデル名',

    'tts.backend': '音声合成エンジン',
    'tts.local.model_base_path': 'ベースモデルパス',
    'tts.local.model_vd_path': 'ボイスデザインパス',
    'tts.local.device': '演算デバイス',
    'tts.vllm.base_url': 'Baseサーバーアドレス',
    'tts.vllm.vd_url': 'VoiceDesignサーバーアドレス',
    'tts.autodl.base_port': 'ベースモデルポート',
    'tts.autodl.vd_port': 'ボイスデザインポート',
    'tts.aliyun.api_key': 'DashScopeキー',
    'tts.aliyun.region': 'サービス地域',
    'opt.light': 'ライト',
    'opt.dark': 'ダーク',
    'opt.system': 'システム',
    'opt.small': '小',
    'opt.medium': '中',
    'opt.large': '大',
    'opt.zh-CN': '簡体字中国語',
    'opt.en-US': '英語',
    'opt.ja-JP': '日本語',
    'opt.ko-KR': '韓国語',
    'opt.es-ES': 'スペイン語',
    'opt.fr-FR': 'フランス語',
    'opt.de-DE': 'ドイツ語',
    'opt.deepseek': 'DeepSeek',
    'opt.qwen': 'Qwen',
    'opt.selfdef': 'カスタム',
    'opt.local_vllm': 'ローカル vLLM',
    'opt.autodl': 'AutoDL',
    'opt.aliyun': '阿里雲',
    'opt.cuda': 'CUDA',
    'opt.cpu': 'CPU',
    'opt.beijing': '北京',
    'opt.singapore': 'シンガポール',

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

    party_setup: '主要登場人物',
    members: 'メンバー',
    voice_title: '音声調整', // 已合并重复项
    studio_title: 'ストーリー回想',
    cast_list: '登場人物',
    params: 'インスペクター',
    btn_batch: '一括生成',
    chk_skip: '生成済みをスキップ',

    attr_title: 'プロフィール',
    lbl_name: '名前',
    lbl_gender: '性別',
    lbl_age: '年齢',
    lbl_description: 'キャラクター説明',
    lbl_prompt: 'ボイスプロンプト',
    lbl_ref_text: 'テストテキスト',
    ph_gender: '男 / 女',
    ph_age: '例：18',
    ph_description: '性格、背景など...',
    ph_prompt: '音色の説明...',
    ph_ref_text: '音声プレビュー用のテキスト...',
    ph_select: 'メンバーを選択してください',
    btn_reroll: '生成音色',
    btn_syncing: '生成中...',
    del_confirm_char: 'このキャラを削除しますか？',
    msg_generate_failed: '生成に失敗しました',
  }
};

const LANG_FALLBACK_MAP = {
  'ko-KR': 'en-US',
  'es-ES': 'en-US',
  'fr-FR': 'en-US',
  'de-DE': 'en-US',
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en-US');
  const [theme, setThemeState] = useState('light');
  const [fontSize, setFontSizeState] = useState('medium');

  const applyFontSize = (size) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const normalized = typeof size === 'string' ? size : 'medium';
    root.setAttribute('data-font-scale', normalized);
    root.style.fontSize = '';
    setFontSizeState(normalized);
  };

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

  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await API.getSettings();
        const appearanceItems = res?.appearance || [];
        
        const langConfig = appearanceItems.find(i => i.key === 'app.language');
        const themeConfig = appearanceItems.find(i => i.key === 'app.theme_mode');
        const fontSizeConfig = appearanceItems.find(i => i.key === 'app.font_size');

        if (langConfig?.value) setLangState(langConfig.value);
        if (themeConfig?.value) applyTheme(themeConfig.value);
        if (fontSizeConfig?.value) applyFontSize(fontSizeConfig.value);
        else applyFontSize('medium');
        
      } catch (err) {
        console.warn("Using local defaults due to API error", err);
        applyTheme('system');
        applyFontSize('medium');
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
    const fallbackLang = LANG_FALLBACK_MAP[lang];
    const translationSet = DICT[lang] || (fallbackLang ? DICT[fallbackLang] : null) || DICT['en-US'];
    return translationSet[key] || key;
  };

  return (
    <LangCtx.Provider value={{ 
      lang, 
      setLang: setLangState, 
      theme, 
      setTheme: applyTheme, 
      fontSize,
      setFontSize: applyFontSize,
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
