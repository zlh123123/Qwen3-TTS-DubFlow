import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Monitor,
  Brain,
  Mic2,
  Settings2,
  Loader2,
  Eye,
  EyeOff,
  Github,
  Search
} from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function SettingsModal({ open, close }) {
  const { setLang, setTheme, t, lang } = useLang();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [cfg, setCfg] = useState({});
  const [initialCfg, setInitialCfg] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState('idle');

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
          setQuery('');
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
  }, [open, isZh]);

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
    if (item.key === 'app.theme_mode') return false;

    const activeLLM = cfg['llm.active_provider'];
    const activeTTS = cfg['tts.backend'];

    if (item.key.startsWith('llm.deepseek.')) return activeLLM === 'deepseek';
    if (item.key.startsWith('llm.qwen.')) return activeLLM === 'qwen';
    if (item.key.startsWith('llm.selfdef.')) return activeLLM === 'selfdef';

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

  const renderSaveState = () => {
    if (saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin" />
          {isZh ? '保存中...' : 'Saving...'}
        </span>
      );
    }
    if (saveState === 'pending') {
      return <span>{isZh ? '准备自动保存...' : 'Queued for autosave...'}</span>;
    }
    if (saveState === 'saved') {
      return <span className="text-emerald-600 dark:text-emerald-400">{isZh ? '已自动保存' : 'Autosaved'}</span>;
    }
    if (saveState === 'error') {
      return <span className="text-red-600 dark:text-red-400">{isZh ? '自动保存失败，请检查后端连接' : 'Autosave failed, check backend connection'}</span>;
    }
    return <span>{isZh ? '自动保存已开启' : 'Autosave enabled'}</span>;
  };

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
      'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900/30';

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
                ? 'border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400'
                : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700'
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
    }
  ];

  const tabSubtitleMap = {
    appearance: isZh ? '管理界面语言与显示行为' : 'Manage language and interface behavior',
    llm_settings: isZh ? '配置脚本分析与生成的模型' : 'Configure script understanding and generation',
    tts_settings: isZh ? '配置语音服务地址与鉴权' : 'Configure voice service endpoint and auth',
    synthesis_config: isZh ? '配置批量合成的输出策略' : 'Configure export and synthesis behavior'
  };

  const visibleItems = useMemo(() => {
    const raw = meta && Array.isArray(meta[activeTab]) ? meta[activeTab] : [];
    const items = raw.filter((item) => shouldShowItem(item));
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const key = item.key?.toLowerCase() || '';
      const label = String(resolveLabel(item) || '').toLowerCase();
      return key.includes(q) || label.includes(q);
    });
  }, [meta, activeTab, cfg, query]);

  const activeTabMeta = tabs.find((x) => x.id === activeTab);
  const activeTabTitle = activeTabMeta?.label ? t(activeTabMeta.label) : (isZh ? '系统设置' : 'Settings');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-[min(86vh,820px)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(2,12,27,0.35)] dark:border-slate-700 dark:bg-slate-900">
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <Settings2 size={16} />
            </div>
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('settings_title')}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isZh ? '系统偏好与模型配置' : 'System preferences and model setup'}</div>
          </div>

          <div className="flex-1 space-y-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {tab.icon}
                  <div>
                    <div className="text-sm font-semibold">{t(tab.label)}</div>
                    <div className={`text-xs ${activeTab === tab.id ? 'text-slate-300 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
                      {tab.desc}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-700/70">
              {isZh ? '已启用自动保存，无需手动保存' : 'Autosave enabled, manual save not required'}
            </div>
            <a
              href="https://github.com/zlh123123/Qwen3-TTS-DubFlow"
              target="_blank"
              rel="noreferrer"
              className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <Github size={14} />
              GitHub
            </a>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Build v1.0.0-stable</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 px-8 py-6 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{activeTabTitle}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tabSubtitleMap[activeTab]}</p>
              </div>
              <button
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mt-4 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isZh ? '搜索配置项（名称或 key）' : 'Search settings by name or key'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </header>

          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-8 py-6 dark:bg-slate-900/30">
            {loading && (
              <div className="flex h-full min-h-[220px] items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="animate-spin" size={18} />
                {t('loading')}
              </div>
            )}

            {!loading && !!loadError && (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-red-300 bg-white text-center text-sm text-red-600 dark:border-red-800 dark:bg-slate-800 dark:text-red-300">
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

            {!loading && !loadError && visibleItems.length === 0 && (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <p>{isZh ? '没有匹配的配置项' : 'No matching settings'}</p>
                <p className="mt-1 text-xs opacity-80">{isZh ? '试试搜索 key 的一部分，比如 api 或 speed' : 'Try searching keywords like api or speed'}</p>
              </div>
            )}

            {!loading &&
              !loadError &&
              visibleItems.map((item, idx) => (
                <div
                  key={item.key || `${activeTab}-${idx}`}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(148,163,184,0.14)] md:grid-cols-[1fr_320px] md:items-center dark:border-slate-700 dark:bg-slate-800"
                >
                  <div>
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resolveLabel(item)}</label>
                    <div className="mt-1 text-[11px] font-mono text-slate-400 dark:text-slate-500">{item.key}</div>
                  </div>
                  <div>{renderInput(item)}</div>
                </div>
              ))}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-8 py-5 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">{renderSaveState()}</div>

            <div className="flex items-center gap-2">
              <button
                onClick={close}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
