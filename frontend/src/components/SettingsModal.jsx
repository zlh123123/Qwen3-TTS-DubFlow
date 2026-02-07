import React, { useState, useEffect } from 'react';
import { X, Monitor, Brain, Mic2, Settings2, Save, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function SettingsModal({ open, close }) {
  const { setLang, setTheme, t } = useLang();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');
  
  const [meta, setMeta] = useState(null);
  const [cfg, setCfg] = useState({});
  const [showPassword, setShowPassword] = useState({});

  // 1. 初始化加载
  useEffect(() => {
    if (open) {
      setLoading(true);
      API.getSettings().then(res => {
        if (res && typeof res === 'object') {
          setMeta(res);
          const flatCfg = {};
          Object.values(res).forEach(groupItems => {
            if (Array.isArray(groupItems)) {
              groupItems.forEach(item => {
                flatCfg[item.key] = item.value ?? item.default ?? '';
              });
            }
          });
          setCfg(flatCfg);
        }
      }).catch(err => {
        console.error("Load settings failed:", err);
      }).finally(() => setLoading(false));
    }
  }, [open]);

  // 2. 动态联动过滤逻辑
  const shouldShowItem = (item) => {
    const activeLLM = cfg['llm.active_provider'];
    const activeTTS = cfg['tts.backend'];

    // LLM 相关显示逻辑
    if (item.key.startsWith('llm.deepseek.')) return activeLLM === 'deepseek';
    if (item.key.startsWith('llm.qwen.')) return activeLLM === 'qwen';
    if (item.key.startsWith('llm.selfdef.')) return activeLLM === 'selfdef';

    // TTS 相关显示逻辑
    if (item.key.startsWith('tts.local.')) return activeTTS === 'local_pytorch';
    if (item.key.startsWith('tts.vllm.')) return activeTTS === 'local_vllm';
    if (item.key.startsWith('tts.autodl.')) return activeTTS === 'autodl';
    if (item.key.startsWith('tts.aliyun.')) return activeTTS === 'aliyun';

    return true; // 默认显示的公共项
  };

  // 3. 统一保存
  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        updates: Object.entries(cfg).map(([key, value]) => ({
          key,
          value: String(value)
        }))
      };
      
      await API.updateSettings(payload);

      // 同步前端 Context 状态
      if (cfg['app.language']) setLang(cfg['app.language']);
      if (cfg['app.theme_mode']) setTheme(cfg['app.theme_mode']);
      
      close();
    } catch (e) {
      console.error("Save failed:", e);
      alert(t('save_fail'));
    } finally {
      setLoading(false);
    }
  };

  // 4. 控件渲染函数
  const renderInput = (item) => {
    const value = cfg[item.key] || '';
    const baseClass = "genshin-input w-full px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-[#D3BC8E]/20";

    switch (item.type) {
      case 'select':
        return (
          <select 
            value={value} 
            onChange={(e) => setCfg({...cfg, [item.key]: e.target.value})}
            className={baseClass}
          >
            {item.options?.map(opt => (
              <option key={opt} value={opt}>
                {t(`opt.${opt}`) !== `opt.${opt}` ? t(`opt.${opt}`) : opt}
              </option>
            ))}
          </select>
        );
      case 'boolean':
        const isTrue = value === 'true' || value === true;
        return (
          <div 
            onClick={() => setCfg({...cfg, [item.key]: isTrue ? 'false' : 'true'})}
            className={`w-14 h-7 rounded-full relative cursor-pointer transition-all border-2 ${
              isTrue ? 'bg-[#D3BC8E] border-[#D3BC8E] shadow-[0_0_8px_rgba(211,188,142,0.4)]' : 'bg-gray-400/20 border-gray-400/30'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isTrue ? 'left-8' : 'left-1'}`} />
          </div>
        );
      case 'password':
        const isVisible = showPassword[item.key];
        return (
          <div className="relative">
            <input 
              type={isVisible ? 'text' : 'password'}
              value={value}
              onChange={(e) => setCfg({...cfg, [item.key]: e.target.value})}
              className={baseClass}
              placeholder="••••••••"
            />
            <button 
              onClick={() => setShowPassword({...showPassword, [item.key]: !isVisible})}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D3BC8E] hover:text-[#3B4255]"
            >
              {isVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        );
      case 'number':
        return (
          <input 
            type="number" 
            step="0.1"
            value={value}
            onChange={(e) => setCfg({...cfg, [item.key]: e.target.value})}
            className={baseClass}
          />
        );
      default:
        return (
          <input 
            type="text" 
            value={value}
            onChange={(e) => setCfg({...cfg, [item.key]: e.target.value})}
            className={baseClass}
          />
        );
    }
  };

  if (!open) return null;

  const tabs = [
    { id: 'appearance', label: 'tab_app', icon: <Monitor size={18}/> },
    { id: 'llm_settings', label: 'tab_llm', icon: <Brain size={18}/> },
    { id: 'tts_settings', label: 'tab_tts', icon: <Mic2 size={18}/> },
    { id: 'synthesis_config', label: 'tab_syn', icon: <Settings2 size={18}/> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="genshin-card w-full max-w-5xl h-[700px] flex overflow-hidden border-[3px] border-[#D3BC8E] bg-[#ECE5D8] dark:bg-[#1B1D22]">
        
        {/* 左侧导航栏 */}
        <div className="w-56 bg-[#3B4255] p-6 flex flex-col gap-2 border-r-2 border-[#D3BC8E]/30">
          <div className="flex items-center gap-2 mb-8 px-2 text-[#D3BC8E]">
             <Settings2 size={24}/>
             <span className="font-genshin text-[#ECE5D8] text-xl">{t('settings_title')}</span>
          </div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl font-bold text-sm transition-all ${
                activeTab === tab.id 
                ? 'bg-[#D3BC8E] text-[#3B4255] shadow-lg translate-x-1' 
                : 'text-[#ECE5D8]/60 hover:text-[#ECE5D8] hover:bg-white/5'
              }`}
            >
              {tab.icon} {t(tab.label)} 
            </button>
          ))}
          <div className="mt-auto p-4 bg-black/20 rounded-2xl text-[10px] text-[#D3BC8E]/50 border border-[#D3BC8E]/10 italic">
            <ShieldCheck size={14} className="mb-1 inline mr-1"/>
            Paimon Cloud Sync Active.
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-10 py-6 flex justify-between items-center bg-white/5 border-b border-[#D3BC8E]/20">
            <div>
              <h3 className="text-2xl font-genshin font-bold text-[#3B4255] dark:text-[#ECE5D8] tracking-widest uppercase">
                {t(tabs.find(t => t.id === activeTab)?.label)}
              </h3>
              <div className="text-[10px] text-[#D3BC8E]/60 font-bold tracking-tighter -mt-1">{t('settings_sub')}</div>
            </div>
            <button onClick={close} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all"><X size={32}/></button>
          </div>

          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-8 bg-gradient-to-b from-transparent to-black/5">
            {!meta ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40 italic text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32}/>
                {t('loading')}
              </div>
            ) : (
              (meta[activeTab] || [])
                .filter(item => shouldShowItem(item)) // 🟢 动态过滤逻辑
                .map(item => (
                  <div 
                    key={item.key} 
                    className="flex items-start justify-between gap-12 group animate-in fade-in slide-in-from-left-2 duration-300"
                  >
                    <div className="flex-1">
                      <label className="text-sm font-bold text-[#495366] dark:text-[#ECE5D8] group-hover:text-[#D3BC8E] transition-colors">
                        {t(item.key) !== item.key ? t(item.key) : item.label}
                      </label>
                      <div className="text-[10px] text-gray-400 font-mono mt-1 opacity-50 select-all tracking-tighter lowercase">{item.key}</div>
                    </div>
                    <div className="w-80 flex-shrink-0">
                      {renderInput(item)}
                    </div>
                  </div>
                ))
            )}
          </div>

          <div className="px-10 py-6 bg-[#3B4255]/5 border-t-2 border-[#D3BC8E]/10 flex justify-end">
             <button 
              onClick={handleSave}
              disabled={loading}
              className="genshin-btn-primary px-16 py-3 shadow-2xl flex items-center gap-3 active:scale-95 disabled:opacity-50"
             >
               {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
               <span className="font-genshin tracking-widest font-bold">{t('btn_save')}</span>
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}