import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  OpenAI as OpenAIIcon,
  Gemini as GeminiIcon,
  Claude as ClaudeIcon,
  DeepSeek as DeepSeekIcon,
  Qwen as QwenIcon,
  Ollama as OllamaIcon,
} from '@lobehub/icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  X,
  Monitor,
  Brain,
  Mic2,
  Settings2,
  CircleHelp,
  Loader2,
  Eye,
  EyeOff,
  Github,
  ExternalLink,
  ShieldAlert,
  FileText,
  Mail,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Plus,
  Trash2,
  Plug
} from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function SettingsModal({ open, close }) {
  const { setLang, setTheme, setFontSize, t, lang } = useLang();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [cfg, setCfg] = useState({});
  const [initialCfg, setInitialCfg] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [llmModelsLoading, setLlmModelsLoading] = useState(false);
  const [llmModelsError, setLlmModelsError] = useState('');
  const [llmModels, setLlmModels] = useState([]);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');

  const savedCfgRef = useRef({});
  const autoSaveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const latestCfgRef = useRef({});

  const isZh = lang === 'zh-CN';

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError('');
    API.getSettings()
      .then((res) => {
        if (res && typeof res === 'object') {
          const normalized = {
            appearance: Array.isArray(res.appearance) ? res.appearance : [],
            llm_settings: Array.isArray(res.llm_settings) ? res.llm_settings : [],
            tts_settings: Array.isArray(res.tts_settings) ? res.tts_settings : [],
            synthesis_config: Array.isArray(res.synthesis_config) ? res.synthesis_config : []
          };
          setMeta(normalized);
          const flatCfg = {};
          Object.values(normalized).forEach((groupItems) => {
            if (Array.isArray(groupItems)) {
              groupItems.forEach((item) => {
                if (item && typeof item.key === 'string') {
                  flatCfg[item.key] = item.value ?? item.default ?? '';
                }
              });
            }
          });
          setCfg(flatCfg);
          setInitialCfg(flatCfg);
          setSaveState('idle');
          savedCfgRef.current = flatCfg;
          latestCfgRef.current = flatCfg;
        } else {
          setMeta({
            appearance: [],
            llm_settings: [],
            tts_settings: [],
            synthesis_config: []
          });
          setLoadError(isZh ? '设置数据格式异常' : 'Invalid settings payload');
        }
      })
      .catch((err) => {
        console.error('Load settings failed:', err);
        setMeta({
          appearance: [],
          llm_settings: [],
          tts_settings: [],
          synthesis_config: []
        });
        setLoadError(isZh ? '设置加载失败，请检查后端服务' : 'Failed to load settings, check backend service');
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    latestCfgRef.current = cfg;
  }, [cfg]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const shouldShowItem = (item) => {
    if (!item || typeof item.key !== 'string') return false;
    if (item.key === 'llm.active_provider') return false;

    const activeTTS = cfg['tts.backend'] || 'aliyun';

    if (item.key.startsWith('tts.local.')) return activeTTS === 'local_pytorch';
    if (item.key.startsWith('tts.vllm.')) return activeTTS === 'local_vllm';
    if (item.key.startsWith('tts.autodl.')) return activeTTS === 'autodl';
    if (item.key.startsWith('tts.aliyun.')) return activeTTS === 'aliyun';

    return true;
  };

  const updateField = (key, value) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
    if (key === 'app.language') setLang(String(value));
    if (key === 'app.theme_mode') setTheme(String(value));
    if (key === 'app.font_size') setFontSize(String(value));
  };

  const humanizeKey = (key) => {
    const value = key.split('.').pop() || key;
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  const resolveLabel = (item) => {
    if (!item || typeof item !== 'object') return '';
    const translated = t(item.key);
    if (translated !== item.key) return translated;
    return item.label || humanizeKey(item.key);
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(cfg) !== JSON.stringify(initialCfg);
  }, [cfg, initialCfg]);

  const saveSnapshot = async (snapshot) => {
    const updates = Object.entries(snapshot).filter(([key, value]) => {
      const savedValue = savedCfgRef.current[key];
      return String(value ?? '') !== String(savedValue ?? '');
    });
    if (updates.length === 0) return;

    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveState('saving');

    try {
      const payload = {
        updates: updates.map(([key, value]) => ({
          key,
          value: String(value)
        }))
      };
      await API.updateSettings(payload);

      updates.forEach(([key, value]) => {
        savedCfgRef.current[key] = value;
      });
      setInitialCfg({ ...savedCfgRef.current });

      if (snapshot['app.language']) setLang(String(snapshot['app.language']));
      if (snapshot['app.theme_mode']) setTheme(String(snapshot['app.theme_mode']));
      if (snapshot['app.font_size']) setFontSize(String(snapshot['app.font_size']));

      setSaveState('saved');
    } catch (e) {
      console.error('Save failed:', e);
      setSaveState('error');
    } finally {
      setSaving(false);
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        saveSnapshot(latestCfgRef.current);
      }
    }
  };

  useEffect(() => {
    if (!open || loading) return;
    if (!isDirty) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveState('pending');
    autoSaveTimerRef.current = setTimeout(() => {
      saveSnapshot(latestCfgRef.current);
    }, 450);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [cfg, isDirty, open, loading]);

  useEffect(() => {
    if (saveState !== 'saved') return undefined;
    const timer = setTimeout(() => {
      setSaveState('idle');
    }, 1200);
    return () => clearTimeout(timer);
  }, [saveState]);

  const normalizeOptions = (options) => {
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
      const trimmed = options.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const renderInput = (item) => {
    const value = cfg[item.key] || '';
    const baseClass =
      'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6] dark:focus:border-[#6b7280] dark:focus:ring-[#3f3f46]/40';

    switch (item.type) {
      case 'select': {
        let filteredOptions = normalizeOptions(item.options);
        if (item.key === 'tts.backend') {
          filteredOptions = filteredOptions.filter((opt) => String(opt) !== 'local_pytorch');
        }

        return (
          <select value={value} onChange={(e) => updateField(item.key, e.target.value)} className={baseClass}>
            {filteredOptions.map((opt) => (
              <option key={String(opt)} value={String(opt)}>
                {t(`opt.${opt}`) !== `opt.${opt}` ? t(`opt.${opt}`) : String(opt)}
              </option>
            ))}
          </select>
        );
      }

      case 'boolean': {
        const isTrue = value === 'true' || value === true;
        return (
          <button
            type="button"
            onClick={() => updateField(item.key, isTrue ? 'false' : 'true')}
            className={`relative inline-flex h-7 w-14 items-center rounded-full border transition focus:outline-none ${
              isTrue
                ? 'border-blue-500 bg-blue-500 dark:border-[#7b7b7b] dark:bg-[#5a5a5a]'
                : 'border-slate-300 bg-slate-200 dark:border-[#4a4a4a] dark:bg-[#303030]'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow transition ${isTrue ? 'translate-x-[30px]' : 'translate-x-1'}`}
            />
          </button>
        );
      }

      case 'password': {
        const isVisible = showPassword[item.key];
        return (
          <div className="relative">
            <input
              type={isVisible ? 'text' : 'password'}
              value={value}
              onChange={(e) => updateField(item.key, e.target.value)}
              className={baseClass}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => ({ ...prev, [item.key]: !isVisible }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-100"
            >
              {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        );
      }

      default:
        return (
          <input
            type={item.type === 'number' ? 'number' : 'text'}
            step={item.type === 'number' ? '0.1' : undefined}
            value={value}
            onChange={(e) => updateField(item.key, e.target.value)}
            className={baseClass}
          />
        );
    }
  };

  const tabs = [
    {
      id: 'appearance',
      label: 'tab_app',
      icon: <Monitor size={17} />,
      desc: isZh ? '语言与交互' : 'Language and UI'
    },
    {
      id: 'llm_settings',
      label: 'tab_llm',
      icon: <Brain size={17} />,
      desc: isZh ? '文本模型配置' : 'Text model setup'
    },
    {
      id: 'tts_settings',
      label: 'tab_tts',
      icon: <Mic2 size={17} />,
      desc: isZh ? '语音服务配置' : 'Voice backend setup'
    },
    {
      id: 'synthesis_config',
      label: 'tab_syn',
      icon: <Settings2 size={17} />,
      desc: isZh ? '合成策略配置' : 'Synthesis policy'
    },
    {
      id: 'about',
      label: 'tab_about',
      icon: <CircleHelp size={17} />,
      desc: isZh ? '版权与协议信息' : 'License and legal'
    }
  ];

  const tabSubtitleMap = {
    appearance: isZh ? '管理界面语言与显示行为' : 'Manage language and interface behavior',
    llm_settings: isZh ? '配置脚本分析与生成的模型' : 'Configure script understanding and generation',
    tts_settings: isZh ? '配置语音服务地址与鉴权' : 'Configure voice service endpoint and auth',
    synthesis_config: isZh ? '配置批量合成的输出策略' : 'Configure export and synthesis behavior',
    about: isZh ? '查看版权、开源协议和第三方声明' : 'Copyright, license, and third-party notices'
  };

  const visibleItems = useMemo(() => {
    const raw = meta && Array.isArray(meta[activeTab]) ? meta[activeTab] : [];
    return raw.filter((item) => shouldShowItem(item));
  }, [meta, activeTab, cfg]);

  const ttsItems = useMemo(() => {
    return meta && Array.isArray(meta.tts_settings) ? meta.tts_settings : [];
  }, [meta]);

  const ttsItemMap = useMemo(() => {
    const map = {};
    ttsItems.forEach((item) => {
      if (item?.key) map[item.key] = item;
    });
    return map;
  }, [ttsItems]);

  const ttsBackendOptions = useMemo(() => {
    return normalizeOptions(ttsItemMap['tts.backend']?.options).map((x) => String(x));
  }, [ttsItemMap]);

  const ttsBackend = cfg['tts.backend'] || 'aliyun';
  const ttsBackendCards = useMemo(() => {
    const cards = [
      {
        id: 'local_vllm',
        title: isZh ? '本地服务（vLLM兼容）' : 'Local Service (vLLM-Compatible)',
        desc: isZh
          ? '适合本机或局域网部署，需兼容 /v1/audio/speech。'
          : 'For local/LAN deployment. Must provide /v1/audio/speech.',
        tag: isZh ? '推荐' : 'Recommended',
      },
      {
        id: 'autodl',
        title: 'AutoDL',
        desc: isZh
          ? '通过本地端口转发连接云端推理实例。'
          : 'Connect cloud instance via local port forwarding.',
        tag: isZh ? '穿透' : 'Tunnel',
      },
      {
        id: 'aliyun',
        title: isZh ? '阿里云 DashScope' : 'Aliyun DashScope',
        desc: isZh
          ? '使用官方 API，配置 Key 与区域即可。'
          : 'Use official API with key and region.',
        tag: 'API',
      },
      {
        id: 'local_pytorch',
        title: isZh ? '本地 PyTorch（旧方案）' : 'Local PyTorch (Legacy)',
        desc: isZh
          ? '保留兼容配置，不建议新部署使用。'
          : 'Legacy mode kept for compatibility.',
        tag: isZh ? '兼容' : 'Legacy',
      },
    ];
    return cards.filter((card) => ttsBackendOptions.includes(card.id) || card.id === ttsBackend);
  }, [isZh, ttsBackendOptions, ttsBackend]);

  const ttsActiveCard = useMemo(() => {
    return ttsBackendCards.find((card) => card.id === ttsBackend) || ttsBackendCards[0];
  }, [ttsBackendCards, ttsBackend]);

  const ttsDocUrl = 'https://github.com/zlh123123/Qwen3-TTS-DubFlow/blob/main/docs/tts-services.md';
  const ttsBackendSummary = useMemo(() => {
    if (ttsBackend === 'local_vllm') {
      return {
        primary: cfg['tts.vllm.vd_url'] || 'http://localhost:6006',
        secondary: cfg['tts.vllm.base_url'] || 'http://localhost:6008',
        labelPrimary: isZh ? 'VoiceDesign 服务' : 'VoiceDesign Service',
        labelSecondary: isZh ? 'Base 服务' : 'Base Service',
      };
    }
    if (ttsBackend === 'autodl') {
      const vdPort = cfg['tts.autodl.vd_port'] || '6006';
      const basePort = cfg['tts.autodl.base_port'] || '6008';
      return {
        primary: `127.0.0.1:${vdPort}`,
        secondary: `127.0.0.1:${basePort}`,
        labelPrimary: isZh ? 'VoiceDesign 端口' : 'VoiceDesign Port',
        labelSecondary: isZh ? 'Base 端口' : 'Base Port',
      };
    }
    if (ttsBackend === 'aliyun') {
      return {
        primary: cfg['tts.aliyun.region'] || 'beijing',
        secondary: cfg['tts.aliyun.api_key'] ? '******' : '-',
        labelPrimary: isZh ? '区域' : 'Region',
        labelSecondary: isZh ? 'API Key' : 'API Key',
      };
    }
    return {
      primary: '-',
      secondary: '-',
      labelPrimary: isZh ? '主配置' : 'Primary',
      labelSecondary: isZh ? '次配置' : 'Secondary',
    };
  }, [ttsBackend, cfg, isZh]);

  const getTtsItem = (key, fallback = {}) => {
    const existed = ttsItemMap[key];
    if (existed) return existed;
    return {
      key,
      type: fallback.type || 'text',
      label: fallback.label || humanizeKey(key),
      options: fallback.options || [],
    };
  };

  const renderTtsRow = (item, hint = '') => {
    if (!item) return null;
    return (
      <div key={item.key} className="grid gap-2 border-b border-slate-200 px-4 py-3 last:border-b-0 dark:border-[#343434]">
        <label className="text-sm font-semibold text-slate-900 dark:text-[#ededed]">{resolveLabel(item)}</label>
        <div>{renderInput(item)}</div>
        {!!hint && <p className="text-xs text-slate-500 dark:text-[#9a9a9a]">{hint}</p>}
      </div>
    );
  };

  const ttsKnownKeySet = useMemo(() => new Set([
    'tts.backend',
    'tts.local.model_base_path',
    'tts.local.model_vd_path',
    'tts.local.device',
    'tts.vllm.base_url',
    'tts.vllm.vd_url',
    'tts.autodl.base_port',
    'tts.autodl.vd_port',
    'tts.aliyun.api_key',
    'tts.aliyun.region',
  ]), []);

  const ttsExtraItems = ttsItems.filter((item) => !ttsKnownKeySet.has(item.key) && shouldShowItem(item));
  const llmBuiltinProviders = [
    {
      id: 'openai',
      name: 'OpenAI',
      renderAvatar: (size = 18) => <OpenAIIcon.Avatar size={size} />,
      docUrl: 'https://platform.openai.com/docs'
    },
    {
      id: 'gemini',
      name: 'Gemini',
      renderAvatar: (size = 18) => <GeminiIcon.Avatar size={size} />,
      docUrl: 'https://ai.google.dev/gemini-api/docs/openai'
    },
    {
      id: 'claude',
      name: 'Claude',
      renderAvatar: (size = 18) => <ClaudeIcon.Avatar size={size} />,
      docUrl: 'https://docs.anthropic.com'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      renderAvatar: (size = 18) => <DeepSeekIcon.Avatar size={size} />,
      docUrl: 'https://api-docs.deepseek.com'
    },
    {
      id: 'qwen',
      name: 'Qwen',
      renderAvatar: (size = 18) => <QwenIcon.Avatar size={size} />,
      docUrl: 'https://help.aliyun.com/zh/dashscope'
    },
    {
      id: 'ollama',
      name: 'Ollama',
      renderAvatar: (size = 18) => <OllamaIcon.Avatar size={size} />,
      docUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md'
    },
  ];
  const llmProviderConfigKeys = {
    openai: { apiKeyKey: 'llm.openai.api_key', baseUrlKey: 'llm.openai.base_url', modelKey: 'llm.openai.model' },
    gemini: { apiKeyKey: 'llm.gemini.api_key', baseUrlKey: 'llm.gemini.base_url', modelKey: 'llm.gemini.model' },
    claude: { apiKeyKey: 'llm.claude.api_key', baseUrlKey: 'llm.claude.base_url', modelKey: 'llm.claude.model' },
    deepseek: { apiKeyKey: 'llm.deepseek.api_key', baseUrlKey: 'llm.deepseek.base_url', modelKey: 'llm.deepseek.model' },
    qwen: { apiKeyKey: 'llm.qwen.api_key', baseUrlKey: 'llm.qwen.base_url', modelKey: 'llm.qwen.model' },
    ollama: { apiKeyKey: 'llm.ollama.api_key', baseUrlKey: 'llm.ollama.base_url', modelKey: 'llm.ollama.model' },
  };
  const customProviders = useMemo(() => {
    const raw = cfg['llm.custom_providers_json'];
    if (!raw || typeof raw !== 'string') return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          id: String(item.id || ''),
          name: String(item.name || (isZh ? '自定义提供方' : 'Custom Provider')),
          base_url: String(item.base_url || ''),
          api_key: String(item.api_key || ''),
          model: String(item.model || ''),
        }))
        .filter((item) => item.id);
    } catch (_) {
      return [];
    }
  }, [cfg, isZh]);
  const llmProviderCards = useMemo(() => {
    const builtin = llmBuiltinProviders.map((item) => ({
      ...item,
      kind: 'builtin',
      cardId: item.id,
      customId: null,
    }));
    const customs = customProviders.map((item) => ({
      id: item.id,
      name: item.name,
      renderAvatar: (size = 18) => (
        <span
          className="inline-flex items-center justify-center rounded-full bg-slate-500 text-white dark:bg-slate-600"
          style={{ width: size, height: size }}
        >
          <Plug size={Math.max(12, Math.floor(size * 0.6))} />
        </span>
      ),
      docUrl: '',
      kind: 'custom',
      cardId: `custom:${item.id}`,
      customId: item.id,
      base_url: item.base_url,
      api_key: item.api_key,
      model: item.model,
    }));
    return [...builtin, ...customs];
  }, [customProviders]);
  const llmActiveProvider = cfg['llm.active_provider'] || 'deepseek';
  const llmActiveCustomId = cfg['llm.custom_active_id'] || '';
  const selectedProvider = useMemo(() => {
    if (llmActiveProvider === 'custom') {
      const byId = llmProviderCards.find((item) => item.kind === 'custom' && item.customId === llmActiveCustomId);
      if (byId) return byId;
      return llmProviderCards.find((item) => item.kind === 'custom') || llmProviderCards[0];
    }
    return llmProviderCards.find((item) => item.kind === 'builtin' && item.id === llmActiveProvider) || llmProviderCards[0];
  }, [llmProviderCards, llmActiveProvider, llmActiveCustomId]);
  const selectedProviderIsCustom = selectedProvider?.kind === 'custom';
  const selectedProviderKeys = selectedProviderIsCustom ? null : llmProviderConfigKeys[selectedProvider?.id];
  const selectedProviderApiKey = selectedProviderIsCustom
    ? (selectedProvider?.api_key || '')
    : (selectedProviderKeys ? (cfg[selectedProviderKeys.apiKeyKey] || '') : '');
  const selectedProviderBaseUrl = selectedProviderIsCustom
    ? (selectedProvider?.base_url || '')
    : (selectedProviderKeys ? (cfg[selectedProviderKeys.baseUrlKey] || '') : '');
  const selectedProviderModel = selectedProviderIsCustom
    ? (selectedProvider?.model || '')
    : (selectedProviderKeys ? (cfg[selectedProviderKeys.modelKey] || '') : '');
  const selectedProviderDocUrl = selectedProvider?.docUrl || 'https://github.com/zlh123123/Qwen3-TTS-DubFlow/blob/main/docs/tts-services.md';
  const settingsInputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6] dark:focus:border-[#6b7280] dark:focus:ring-[#3f3f46]/40';
  const renderProviderLogo = (providerCard, size = 18) => {
    if (!providerCard?.renderAvatar) return null;
    return (
      <span className="inline-flex shrink-0 items-center justify-center">
        {providerCard.renderAvatar(size)}
      </span>
    );
  };
  const aboutLinks = [
    {
      title: 'GitHub',
      value: 'zlh123123/Qwen3-TTS-DubFlow',
      href: 'https://github.com/zlh123123/Qwen3-TTS-DubFlow',
      icon: <Github size={16} />
    },
    {
      title: isZh ? '许可证' : 'License',
      value: 'Apache-2.0',
      href: 'https://www.apache.org/licenses/LICENSE-2.0',
      icon: <FileText size={16} />
    },
    {
      title: isZh ? '模型许可证策略' : 'Model License Policy',
      value: isZh ? '第三方模型商用边界' : '3rd-party model compliance',
      href: 'https://github.com/zlh123123/Qwen3-TTS-DubFlow/blob/main/docs/model-license-policy.md',
      icon: <BookOpen size={16} />
    },
    {
      title: isZh ? '联系邮箱' : 'Contact',
      value: 'hi@narratis.app',
      href: 'mailto:hi@narratis.app',
      icon: <Mail size={16} />
    }
  ];

  const activeTabMeta = tabs.find((x) => x.id === activeTab);
  const activeTabTitle = activeTabMeta?.label ? t(activeTabMeta.label) : (isZh ? '系统设置' : 'Settings');

  useEffect(() => {
    setLlmModels([]);
    setLlmModelsError('');
  }, [selectedProvider?.cardId]);

  const updateCustomProviders = (nextProviders) => {
    updateField('llm.custom_providers_json', JSON.stringify(nextProviders));
  };

  const updateCurrentCustomProviderField = (field, value) => {
    if (!selectedProviderIsCustom) return;
    const nextProviders = customProviders.map((item) => {
      if (item.id !== selectedProvider.customId) return item;
      return { ...item, [field]: value };
    });
    updateCustomProviders(nextProviders);
  };

  const activateProvider = (providerCard) => {
    if (!providerCard) return;
    if (providerCard.kind === 'custom') {
      updateField('llm.active_provider', 'custom');
      updateField('llm.custom_active_id', providerCard.customId || '');
      return;
    }
    updateField('llm.active_provider', providerCard.id);
  };

  const handleAddCustomProvider = () => {
    const name = newProviderName.trim();
    if (!name) return;
    const newId = `custom_${Date.now()}`;
    const nextProviders = [
      ...customProviders,
      { id: newId, name, base_url: '', api_key: '', model: '' },
    ];
    updateCustomProviders(nextProviders);
    updateField('llm.active_provider', 'custom');
    updateField('llm.custom_active_id', newId);
    setNewProviderName('');
    setShowAddProvider(false);
  };

  const handleRemoveCustomProvider = (providerId) => {
    const nextProviders = customProviders.filter((item) => item.id !== providerId);
    updateCustomProviders(nextProviders);
    if (selectedProviderIsCustom && selectedProvider.customId === providerId) {
      if (nextProviders.length > 0) {
        updateField('llm.custom_active_id', nextProviders[0].id);
      } else {
        updateField('llm.custom_active_id', '');
        updateField('llm.active_provider', 'deepseek');
      }
    }
  };

  const handleFetchLLMModels = async () => {
    if (!selectedProvider) return;
    setLlmModelsLoading(true);
    setLlmModelsError('');
    try {
      const providerParam = selectedProviderIsCustom ? 'custom' : selectedProvider?.id;
      const customIdParam = selectedProviderIsCustom ? selectedProvider?.customId : undefined;
      const res = await API.fetchLLMModels(providerParam, customIdParam);
      const items = Array.isArray(res?.items) ? res.items : [];
      setLlmModels(items);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setLlmModelsError(typeof detail === 'string' ? detail : (isZh ? '获取模型列表失败' : 'Failed to fetch models'));
      setLlmModels([]);
    } finally {
      setLlmModelsLoading(false);
    }
  };

  const openExternalLink = async (href) => {
    if (!href) return;
    try {
      await openUrl(href);
      return;
    } catch (_) {
      // Fall through to browser fallback (web mode / opener unavailable).
    }
    if (href.startsWith('mailto:')) {
      window.location.href = href;
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-[min(86vh,820px)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(2,12,27,0.35)] dark:border-[#343434] dark:bg-[#1a1a1a]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 p-5 dark:border-[#343434] dark:bg-[#151515]">
          <div className="flex-1 space-y-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-[#2b2b2b] dark:text-[#f0f0f0]'
                    : 'text-slate-700 hover:bg-slate-200 dark:text-[#c8c8c8] dark:hover:bg-[#232323]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {tab.icon}
                  <div>
                    <div className="text-sm font-semibold">{t(tab.label)}</div>
                    <div className={`text-xs ${activeTab === tab.id ? 'text-slate-300 dark:text-[#a8a8a8]' : 'text-slate-500 dark:text-[#8f8f8f]'}`}>
                      {tab.desc}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-[#343434] dark:text-[#9a9a9a]">
            <button
              type="button"
              onClick={() => openExternalLink('https://github.com/zlh123123/Qwen3-TTS-DubFlow')}
              className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-[#bdbdbd] dark:hover:text-[#f0f0f0]"
            >
              <Github size={14} />
              GitHub
            </button>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-[#7f7f7f]">Build v1.0.0-stable</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 px-8 py-6 dark:border-[#343434]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-[#f0f0f0]">{activeTabTitle}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#a0a0a0]">{tabSubtitleMap[activeTab]}</p>
              </div>
              <button
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2b2b2b] dark:hover:text-[#efefef]"
              >
                <X size={20} />
              </button>
            </div>

          </header>

          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-8 py-6 dark:bg-[#1a1a1a]">
            {loading && (
              <div className="flex h-full min-h-[220px] items-center justify-center gap-3 text-slate-500 dark:text-[#a0a0a0]">
                <Loader2 className="animate-spin" size={18} />
                {t('loading')}
              </div>
            )}

            {!loading && !!loadError && (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-red-300 bg-white text-center text-sm text-red-600 dark:border-red-700 dark:bg-[#252526] dark:text-red-300">
                <p>{loadError}</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    setMeta(null);
                    setLoadError('');
                    API.getSettings()
                      .then((res) => {
                        const normalized = {
                          appearance: Array.isArray(res?.appearance) ? res.appearance : [],
                          llm_settings: Array.isArray(res?.llm_settings) ? res.llm_settings : [],
                          tts_settings: Array.isArray(res?.tts_settings) ? res.tts_settings : [],
                          synthesis_config: Array.isArray(res?.synthesis_config) ? res.synthesis_config : []
                        };
                        setMeta(normalized);
                        const flatCfg = {};
                        Object.values(normalized).forEach((groupItems) => {
                          groupItems.forEach((item) => {
                            if (item && typeof item.key === 'string') {
                              flatCfg[item.key] = item.value ?? item.default ?? '';
                            }
                          });
                        });
                        setCfg(flatCfg);
                        setInitialCfg(flatCfg);
                        savedCfgRef.current = flatCfg;
                        latestCfgRef.current = flatCfg;
                      })
                      .catch((err) => {
                        console.error('Reload settings failed:', err);
                        setLoadError(isZh ? '重试失败，请确认后端已启动' : 'Retry failed, make sure backend is running');
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  {isZh ? '重试' : 'Retry'}
                </button>
              </div>
            )}

            {!loading && !loadError && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(148,163,184,0.14)] dark:border-[#3b3b3b] dark:bg-[#252526]">
                {activeTab === 'about' ? (
                  <div className="space-y-4 px-6 py-6 text-sm text-slate-700 dark:text-[#d4d4d4]">
                    <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-[#4a4a4a] dark:bg-[#f3f3f3]">
                          <img src="/narratis-favicon.png" alt="Narratis" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">Narratis</h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#a0a0a0]">
                            {isZh ? '流水线式 AI 音频制作工作台' : 'Pipeline-style AI audio production studio'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-[#848484]">v0.1.0</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#e0e0e0] dark:hover:bg-[#343434]"
                      >
                        <RefreshCw size={13} />
                        {isZh ? '检查更新' : 'Check Update'}
                      </button>
                    </section>

                    <section className="rounded-2xl border border-amber-300/70 bg-amber-100/80 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-200">
                      <div className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
                        <ShieldAlert size={16} />
                        {isZh ? '版权与模型使用提示' : 'License & Model Notice'}
                      </div>
                      <p className="text-xs leading-relaxed">
                        {isZh
                          ? '项目代码采用 Apache-2.0，第三方模型/API 许可证独立生效。商用、再分发与托管能力请以对应服务条款为准。'
                          : 'Repository code is Apache-2.0. Third-party model/API licenses apply independently for commercial use, redistribution, and hosting.'}
                      </p>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#3b3b3b]">
                      {aboutLinks.map((item, idx) => (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => openExternalLink(item.href)}
                          className={`flex w-full items-center justify-between bg-white px-4 py-3 text-left transition hover:bg-slate-50 dark:bg-[#252526] dark:hover:bg-[#2d2d2e] ${
                            idx !== aboutLinks.length - 1 ? 'border-b border-slate-200 dark:border-[#343434]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-500 dark:text-[#b8b8b8]">{item.icon}</div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-[#e8e8e8]">{item.title}</div>
                              <div className="text-xs text-slate-500 dark:text-[#9e9e9e]">{item.value}</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-400 dark:text-[#8f8f8f]" />
                        </button>
                      ))}
                    </section>
                </div>
                ) : activeTab === 'llm_settings' ? (
                  <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
                    <aside className="border-b border-slate-200 p-4 md:border-b-0 md:border-r dark:border-[#343434]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9a9a9a]">
                        {t('llm_provider_pick')}
                      </div>
                      <div className="space-y-2">
                        {llmProviderCards.map((providerCard) => {
                          const active = selectedProvider?.cardId === providerCard.cardId;
                          return (
                            <div key={providerCard.cardId} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => activateProvider(providerCard)}
                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                                  active
                                    ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2f2f2f]'
                                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#dfdfdf] dark:hover:bg-[#2a2a2a]'
                                }`}
                              >
                                {renderProviderLogo(providerCard, 28)}
                                <span className="truncate text-sm font-semibold">{providerCard.name}</span>
                              </button>
                              {providerCard.kind === 'custom' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomProvider(providerCard.customId)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-red-600 dark:border-[#3b3b3b] dark:text-[#a0a0a0] dark:hover:bg-[#2a2a2a] dark:hover:text-red-300"
                                  title={isZh ? '删除提供方' : 'Remove provider'}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-[#343434]">
                        {!showAddProvider ? (
                          <button
                            type="button"
                            onClick={() => setShowAddProvider(true)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#e0e0e0] dark:hover:bg-[#343434]"
                          >
                            <Plus size={13} />
                            {isZh ? '添加' : 'Add'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <input
                              value={newProviderName}
                              onChange={(e) => setNewProviderName(e.target.value)}
                              placeholder={isZh ? '提供方名称' : 'Provider name'}
                              className={settingsInputClass}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={handleAddCustomProvider}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#e0e0e0] dark:hover:bg-[#343434]"
                              >
                                {isZh ? '确定' : 'Create'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddProvider(false);
                                  setNewProviderName('');
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#e0e0e0] dark:hover:bg-[#343434]"
                              >
                                {isZh ? '取消' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </aside>

                    <div className="space-y-5 px-6 py-6 md:px-8">
                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            {selectedProvider ? renderProviderLogo(selectedProvider, 36) : null}
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-slate-900 dark:text-[#efefef]">
                                {selectedProvider?.name}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openExternalLink(selectedProviderDocUrl)}
                            className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#dfdfdf] dark:hover:bg-[#343434]"
                          >
                            {isZh ? '接入说明' : 'Docs'}
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-[#9a9a9a]">
                          {isZh ? '连接配置' : 'Connection'}
                        </div>
                        <div className="grid gap-0 bg-white dark:bg-[#252526]">
                          <div className="grid gap-2 border-b border-slate-200 px-4 py-3 dark:border-[#343434]">
                            <label className="text-sm font-semibold text-slate-900 dark:text-[#ededed]">
                              {selectedProvider?.name} API Key
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword[`llm.api_key.${selectedProvider?.cardId}`] ? 'text' : 'password'}
                                value={selectedProviderApiKey}
                                onChange={(e) => {
                                  if (selectedProviderIsCustom) {
                                    updateCurrentCustomProviderField('api_key', e.target.value);
                                  } else if (selectedProviderKeys) {
                                    updateField(selectedProviderKeys.apiKeyKey, e.target.value);
                                  }
                                }}
                                className={settingsInputClass}
                                placeholder="••••••••"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPassword((prev) => ({
                                    ...prev,
                                    [`llm.api_key.${selectedProvider?.cardId}`]:
                                      !prev[`llm.api_key.${selectedProvider?.cardId}`],
                                  }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-100"
                              >
                                {showPassword[`llm.api_key.${selectedProvider?.cardId}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-2 px-4 py-3">
                            <label className="text-sm font-semibold text-slate-900 dark:text-[#ededed]">
                              {isZh ? '接口地址' : 'Base URL'}
                            </label>
                            <input
                              type="text"
                              value={selectedProviderBaseUrl}
                              onChange={(e) => {
                                if (selectedProviderIsCustom) {
                                  updateCurrentCustomProviderField('base_url', e.target.value);
                                } else if (selectedProviderKeys) {
                                  updateField(selectedProviderKeys.baseUrlKey, e.target.value);
                                }
                              }}
                              className={settingsInputClass}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                        <div className="flex flex-col items-start gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#343434] dark:bg-[#1f1f1f]">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9a9a9a]">
                            {isZh ? '模型目录' : 'Model Catalog'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500 dark:text-[#9a9a9a]">
                              {isZh ? '当前模型' : 'Current'}:{' '}
                              <span className="inline-block max-w-[230px] truncate align-bottom font-mono sm:max-w-[320px]">
                                {selectedProviderModel || '-'}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={handleFetchLLMModels}
                              disabled={llmModelsLoading}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#e0e0e0] dark:hover:bg-[#343434]"
                            >
                              {llmModelsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              {isZh ? '获取' : 'Fetch'}
                            </button>
                          </div>
                        </div>
                        {!!llmModelsError && (
                          <div className="bg-white px-4 py-3 text-xs text-red-600 dark:bg-[#252526] dark:text-red-300">{llmModelsError}</div>
                        )}
                        {!llmModelsError && llmModels.length === 0 && (
                          <div className="bg-white px-4 py-3 text-xs text-slate-500 dark:bg-[#252526] dark:text-[#a0a0a0]">
                            {isZh ? '点击“获取”从当前 API 读取可用模型，再点选写入配置。' : 'Fetch available models from current API, then click one to apply.'}
                          </div>
                        )}
                        {llmModels.length > 0 && (
                          <div className="max-h-56 overflow-y-auto bg-white dark:bg-[#252526]">
                            {llmModels.map((modelId, idx) => {
                              const active = selectedProviderModel === modelId;
                              return (
                                <div
                                  key={modelId}
                                  className={`flex items-center justify-between px-4 py-2.5 text-xs ${
                                    idx !== llmModels.length - 1 ? 'border-b border-slate-200 dark:border-[#343434]' : ''
                                  }`}
                                >
                                  <span className={`font-mono ${active ? 'text-slate-900 dark:text-[#f0f0f0]' : 'text-slate-700 dark:text-[#d4d4d4]'}`}>
                                    {modelId}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedProviderIsCustom) {
                                        updateCurrentCustomProviderField('model', modelId);
                                      } else if (selectedProviderKeys) {
                                        updateField(selectedProviderKeys.modelKey, modelId);
                                      }
                                    }}
                                    className={`rounded-md border px-2 py-1 font-semibold transition ${
                                      active
                                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#d8d8d8] dark:hover:bg-[#333333]'
                                    }`}
                                  >
                                    {active ? (isZh ? '已选中' : 'Selected') : (isZh ? '设为当前' : 'Use')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-[#9a9a9a]">
                          {isZh ? '模型名称' : 'Model'}
                        </div>
                        <div className="grid gap-2 bg-white px-4 py-3 dark:bg-[#252526]">
                          <input
                            type="text"
                            value={selectedProviderModel}
                            onChange={(e) => {
                              if (selectedProviderIsCustom) {
                                updateCurrentCustomProviderField('model', e.target.value);
                              } else if (selectedProviderKeys) {
                                updateField(selectedProviderKeys.modelKey, e.target.value);
                              }
                            }}
                            className={settingsInputClass}
                            placeholder={isZh ? '输入模型名称' : 'Enter model name'}
                          />
                        </div>
                      </section>
                    </div>
                  </div>
                ) : activeTab === 'tts_settings' ? (
                  <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
                    <aside className="border-b border-slate-200 p-4 md:border-b-0 md:border-r dark:border-[#343434]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9a9a9a]">
                        {isZh ? '后端类型' : 'Backend Type'}
                      </div>
                      <div className="space-y-2">
                        {ttsBackendCards.map((backendCard) => {
                          const active = backendCard.id === ttsBackend;
                          return (
                            <button
                              key={backendCard.id}
                              type="button"
                              onClick={() => updateField('tts.backend', backendCard.id)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                                active
                                  ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2f2f2f]'
                                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#dfdfdf] dark:hover:bg-[#2a2a2a]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold">{backendCard.title}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  active
                                    ? 'bg-white/15 text-white'
                                    : 'bg-slate-100 text-slate-600 dark:bg-[#2b2b2b] dark:text-[#a0a0a0]'
                                }`}>
                                  {backendCard.tag}
                                </span>
                              </div>
                              <p className={`mt-1 text-xs leading-5 ${
                                active ? 'text-slate-200 dark:text-[#cfcfcf]' : 'text-slate-500 dark:text-[#9a9a9a]'
                              }`}>
                                {backendCard.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </aside>

                    <div className="space-y-5 px-6 py-6 md:px-8">
                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900 dark:text-[#efefef]">
                              {ttsActiveCard?.title || (isZh ? '语音后端' : 'TTS Backend')}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-[#a0a0a0]">
                              {ttsActiveCard?.desc}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openExternalLink(ttsDocUrl)}
                            className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#dfdfdf] dark:hover:bg-[#343434]"
                          >
                            {isZh ? '接入文档' : 'Integration Docs'}
                            <ExternalLink size={12} />
                          </button>
                        </div>
                        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
                          {isZh
                            ? '提示：当前页面用于角色语音链路配置。Fish-Speech 与 MeanAudio 的独立服务部署请参考 models_deploy/README。'
                            : 'Note: This page configures character TTS pipeline. For standalone Fish-Speech/MeanAudio services, see models_deploy/README.'}
                        </p>
                      </section>

                      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-[#343434] dark:bg-[#1f1f1f]">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9a9a9a]">
                            {isZh ? '核心配置' : 'Core Configuration'}
                          </div>
                          {(ttsBackend === 'local_vllm' || ttsBackend === 'autodl') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (ttsBackend === 'local_vllm') {
                                  updateField('tts.vllm.base_url', 'http://localhost:6008');
                                  updateField('tts.vllm.vd_url', 'http://localhost:6006');
                                } else {
                                  updateField('tts.autodl.base_port', '6008');
                                  updateField('tts.autodl.vd_port', '6006');
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#dfdfdf] dark:hover:bg-[#343434]"
                            >
                              <RefreshCw size={12} />
                              {isZh ? '填充默认值' : 'Fill Defaults'}
                            </button>
                          )}
                        </div>

                        <div className="bg-white dark:bg-[#252526]">
                          {ttsBackend === 'local_pytorch' && (
                            <>
                              {renderTtsRow(
                                getTtsItem('tts.local.model_base_path', { type: 'text', label: isZh ? '克隆模型路径 (Base)' : 'Base Model Path' }),
                                isZh ? '本地 Base 模型目录或文件路径。' : 'Local path for Base model.'
                              )}
                              {renderTtsRow(
                                getTtsItem('tts.local.model_vd_path', { type: 'text', label: isZh ? '设计模型路径 (VoiceDesign)' : 'VoiceDesign Model Path' }),
                                isZh ? '本地 VoiceDesign 模型目录或文件路径。' : 'Local path for VoiceDesign model.'
                              )}
                              {renderTtsRow(
                                getTtsItem('tts.local.device', { type: 'select', options: ['cuda', 'cpu'], label: isZh ? '计算设备' : 'Compute Device' })
                              )}
                            </>
                          )}

                          {ttsBackend === 'local_vllm' && (
                            <>
                              {renderTtsRow(
                                getTtsItem('tts.vllm.vd_url', { type: 'text', label: isZh ? 'VoiceDesign 服务地址' : 'VoiceDesign URL' }),
                                isZh ? '用于角色音色设计预览。示例：http://localhost:6006' : 'Used by voice design preview. Example: http://localhost:6006'
                              )}
                              {renderTtsRow(
                                getTtsItem('tts.vllm.base_url', { type: 'text', label: isZh ? 'Base 服务地址' : 'Base URL' }),
                                isZh ? '用于克隆链路。示例：http://localhost:6008' : 'Used by clone pipeline. Example: http://localhost:6008'
                              )}
                            </>
                          )}

                          {ttsBackend === 'autodl' && (
                            <>
                              {renderTtsRow(
                                getTtsItem('tts.autodl.vd_port', { type: 'text', label: isZh ? 'VoiceDesign 本地端口' : 'VoiceDesign Local Port' }),
                                isZh ? '本机转发端口。示例：6006' : 'Local forwarded port. Example: 6006'
                              )}
                              {renderTtsRow(
                                getTtsItem('tts.autodl.base_port', { type: 'text', label: isZh ? 'Base 本地端口' : 'Base Local Port' }),
                                isZh ? '本机转发端口。示例：6008' : 'Local forwarded port. Example: 6008'
                              )}
                            </>
                          )}

                          {ttsBackend === 'aliyun' && (
                            <>
                              {renderTtsRow(
                                getTtsItem('tts.aliyun.api_key', { type: 'password', label: 'DashScope API Key' }),
                                isZh ? '用于调用阿里云语音服务。' : 'Used to access DashScope TTS.'
                              )}
                              {renderTtsRow(
                                getTtsItem('tts.aliyun.region', { type: 'select', options: ['beijing', 'singapore'], label: isZh ? '服务区域' : 'Region' })
                              )}
                            </>
                          )}
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-[#9a9a9a]">
                          {isZh ? '当前生效摘要' : 'Effective Summary'}
                        </div>
                        <div className="grid gap-2 bg-white px-4 py-3 text-xs dark:bg-[#252526]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-[#9a9a9a]">{ttsBackendSummary.labelPrimary}</span>
                            <span className="font-mono text-slate-800 dark:text-[#e6e6e6]">{ttsBackendSummary.primary}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-[#9a9a9a]">{ttsBackendSummary.labelSecondary}</span>
                            <span className="font-mono text-slate-800 dark:text-[#e6e6e6]">{ttsBackendSummary.secondary}</span>
                          </div>
                        </div>
                      </section>

                      {ttsExtraItems.length > 0 && (
                        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#3b3b3b]">
                          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-[#9a9a9a]">
                            {isZh ? '扩展配置' : 'Advanced'}
                          </div>
                          <div className="bg-white dark:bg-[#252526]">
                            {ttsExtraItems.map((item) => renderTtsRow(item))}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center text-sm text-slate-500 dark:text-[#a0a0a0]">
                    <p>{isZh ? '当前分组暂无可配置项' : 'No available settings in this section'}</p>
                  </div>
                ) : (
                  visibleItems.map((item, idx) => (
                    <div
                      key={item.key || `${activeTab}-${idx}`}
                      className={`grid gap-3 px-5 py-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-center ${
                        idx !== visibleItems.length - 1 ? 'border-b border-slate-200 dark:border-[#343434]' : ''
                      }`}
                    >
                      <label className="text-sm font-semibold text-slate-900 dark:text-[#ededed]">{resolveLabel(item)}</label>
                      <div>{renderInput(item)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end border-t border-slate-200 bg-white px-8 py-5 dark:border-[#343434] dark:bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <button
                onClick={close}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e0e0e0] dark:hover:bg-[#2f2f2f]"
              >
                {t('cancel')}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
