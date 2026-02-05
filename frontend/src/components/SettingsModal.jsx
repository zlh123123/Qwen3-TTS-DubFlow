import React, { useState, useEffect } from 'react';
import { X, Save, Cpu, Mic, Settings as SettingsIcon, Sliders, RefreshCw, Monitor } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function SettingsModal({ open, close }) {
  const { t, setLang, setTheme } = useLang();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('app');
  
  const [cfg, setCfg] = useState({
    app: { theme_mode: 'system', language: 'zh-CN' },
    llm: { active_provider: 'deepseek', deepseek: { api_key: '' }, qwen: { api_key: '' }, local: { url: '' } },
    tts: { active_backend: 'local_docker', local: { url: '' }, remote: { url: '', token: '' }, aliyun: { app_key: '', token: '' } },
    syn: { default_speed: 1.0, silence_duration: 0.5, export_path: '', max_workers: 2, volume_gain: 1.0, audio_format: 'wav', auto_slice: true, text_clean: true }
  });

  useEffect(() => {
    if (open) {
      API.getSettings().then(res => {
        // 🟢 连通后端：确保后端返回的数据结构能正确覆盖初始状态
        if (res?.data) setCfg(prev => ({ ...prev, ...res.data }));
      }).catch(err => console.error("Backend Connection Error:", err));
    }
  }, [open]);

  const updatePath = (path, val) => {
    setCfg(prev => {
      const newCfg = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let curr = newCfg;
      for (let i = 0; i < keys.length - 1; i++) {
        curr = curr[keys[i]];
      }
      curr[keys[keys.length - 1]] = val;
      return newCfg;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 🟢 提交到后端：发送完整的 JSON 配置
      await API.updateSettings(cfg);
      if (setLang) setLang(cfg.app.language);
      if (setTheme) setTheme(cfg.app.theme_mode); 
      close();
    } catch (e) {
      alert(t('save_fail') || 'Save Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const FieldLabel = ({ children }) => (
    <label className="text-xs font-bold text-[#8C7D6B] mb-2 block tracking-widest uppercase">
      {children}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-[#ECE5D8] dark:bg-[#1b1d22] rounded-[32px] flex border-[3px] border-[#D3BC8E]/30 overflow-hidden shadow-2xl h-[650px] relative text-[#495366] transition-colors duration-300">
        
        <button onClick={close} className="absolute top-5 right-5 z-20 w-8 h-8 rounded-full bg-[#3B4255] text-[#ECE5D8] flex items-center justify-center hover:scale-110 transition-transform">
          <X size={18} />
        </button>

        {/* 左侧导航栏 */}
        <div className="w-64 bg-[#3B4255] dark:bg-[#12141a] p-6 flex flex-col border-r-2 border-[#D3BC8E]/30 shrink-0">
           <div className="mb-10 mt-4 text-center">
             <div className="text-[#D3BC8E] font-genshin font-bold text-2xl tracking-widest">{t('settings_title')}</div>
             <div className="text-[#787F8E] text-[10px] tracking-[0.3em] uppercase mt-1">System Core</div>
           </div>

           <div className="space-y-2 flex-1">
             {[
               { id: 'app', icon: Monitor, label: t('tab_app') },
               { id: 'llm', icon: Cpu, label: t('tab_llm') },
               { id: 'tts', icon: Mic, label: t('tab_tts') },
               { id: 'syn', icon: Sliders, label: t('tab_syn') },
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)} 
                 className={`w-full px-4 py-3 rounded-full font-bold text-sm flex items-center gap-3 transition-all ${activeTab === tab.id ? 'bg-[#ECE5D8] text-[#3B4255] border-l-4 border-[#D3BC8E]' : 'text-[#8C7D6B] hover:text-[#ECE5D8] hover:bg-white/10'}`}
               >
                 <tab.icon size={18} /> {tab.label}
               </button>
             ))}
           </div>

           <button onClick={handleSave} disabled={loading} className="genshin-btn-primary w-full py-3 shadow-lg">
             {loading ? <RefreshCw className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18}/>}
             {loading ? t('btn_saving') : t('btn_save')}
           </button>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 bg-[#F0F2F5] dark:bg-[#2c313f] flex flex-col overflow-hidden transition-colors">
          <div className="p-8 pb-4 border-b border-[#D3BC8E]/20">
             <h2 className="text-2xl font-genshin font-bold text-[#3B4255] dark:text-[#ece5d8] flex items-center gap-2 uppercase tracking-tighter">
               <span className="text-[#D3BC8E]">♦</span> {t(`tab_${activeTab}`)}
             </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
            {activeTab === 'app' && (
              <div className="animate-fade-in space-y-8">
                <div>
                  <FieldLabel>{t('lbl_lang')}</FieldLabel>
                  <div className="flex gap-4">
                    {['zh-CN', 'en-US'].map(l => (
                      <button 
                        key={l}
                        onClick={() => updatePath('app.language', l)}
                        className={`px-6 py-2 rounded-full border-2 font-bold text-sm transition-all ${cfg.app.language === l ? 'bg-[#3B4255] text-[#ECE5D8] border-[#D3BC8E]' : 'bg-white dark:bg-gray-800 border-[#D8CBA8] text-[#8C7D6B]'}`}
                      >
                        {l === 'zh-CN' ? '简体中文' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('lbl_theme')}</FieldLabel>
                  <select 
                    className="genshin-input w-full p-3 font-bold"
                    value={cfg.app.theme_mode}
                    onChange={e => updatePath('app.theme_mode', e.target.value)}
                  >
                    <option value="system">Follow System</option>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'llm' && (
              <div className="animate-fade-in space-y-6">
                <div>
                  <FieldLabel>{t('lbl_provider')}</FieldLabel>
                  <select 
                    className="genshin-input w-full p-3 font-bold"
                    value={cfg.llm.active_provider}
                    onChange={e => updatePath('llm.active_provider', e.target.value)}
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="qwen">Qwen</option>
                    <option value="local">Local (Ollama)</option>
                  </select>
                </div>
                {/* 动态渲染 API Key 输入框 */}
                {cfg.llm.active_provider !== 'local' && (
                   <div className="space-y-4">
                     <FieldLabel>{cfg.llm.active_provider.toUpperCase()} API Key</FieldLabel>
                     <input type="password" 
                       className="genshin-input w-full p-3" 
                       placeholder="sk-..." 
                       value={cfg.llm[cfg.llm.active_provider]?.api_key} 
                       onChange={e => updatePath(`llm.${cfg.llm.active_provider}.api_key`, e.target.value)} 
                     />
                   </div>
                )}
              </div>
            )}

            {activeTab === 'tts' && (
               <div className="animate-fade-in space-y-6">
                 <FieldLabel>TTS Engine Backend</FieldLabel>
                 <select className="genshin-input w-full p-3 font-bold" value={cfg.tts.active_backend} onChange={e => updatePath('tts.active_backend', e.target.value)}>
                   <option value="local_docker">Local Docker</option>
                   <option value="remote">AutoDL (Remote)</option>
                   <option value="aliyun">Aliyun (Cloud)</option>
                 </select>
                 <div className="p-4 bg-black/5 dark:bg-black/20 rounded-2xl border border-dashed border-[#D3BC8E]">
                    <p className="text-[10px] text-[#8C7D6B] font-bold">ADDRESS CONFIG</p>
                    <input type="text" className="w-full bg-transparent border-b border-[#D8CBA8] py-2 outline-none text-sm" 
                      placeholder="http://..."
                      value={cfg.tts[cfg.tts.active_backend === 'local_docker' ? 'local' : 'remote'].url}
                      onChange={e => updatePath(cfg.tts.active_backend === 'local_docker' ? 'tts.local.url' : 'tts.remote.url', e.target.value)} 
                    />
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}