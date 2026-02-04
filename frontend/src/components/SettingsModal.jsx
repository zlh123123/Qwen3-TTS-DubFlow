import React, { useState, useEffect } from 'react';
import { X, Server, Cpu, Key, AlertCircle, Radio } from 'lucide-react';
import * as API from '../api/endpoints';

export default function SettingsModal({ open, close }) {
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({ llm_provider: 'qwen', api_key: '', base_url: '' });

  // 这里的 useEffect 没必要写太复杂，开窗就拉数据
  useEffect(() => {
    if (open) API.getSettings().then(res => setCfg(res.data));
  }, [open]);

  const save = async () => {
    setLoading(true);
    try {
      await API.updateSettings(cfg);
      close();
    } catch (e) {
      alert('保存炸了，看下控制台');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      
      {/* 整个大卡片：原神菜单经典的左深右浅布局 */}
      <div className="w-full max-w-2xl bg-[#ECE5D8] rounded-[32px] flex border-[3px] border-[#4A5366]/20 overflow-hidden shadow-2xl relative">
        
        {/* 关闭按钮 - 绝对定位在右上角 */}
        <button 
          onClick={close} 
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-[#3B4255] border-2 border-[#6A7080] text-[#ECE5D8] flex items-center justify-center hover:scale-110 hover:border-[#D3BC8E] transition-all"
        >
          <X size={18} />
        </button>

        {/* --- 左侧导航栏 (深色) --- */}
        <div className="w-1/3 bg-[#3B4255] p-6 flex flex-col items-center border-r-2 border-[#D3BC8E]/30 relative overflow-hidden">
           {/* 装饰圆环 */}
           <div className="absolute -top-10 -left-10 w-40 h-40 border-[20px] border-[#424A5F] rounded-full opacity-50"></div>
           
           <div className="mt-8 mb-8 z-10 flex flex-col items-center">
             <div className="w-16 h-16 rounded-full bg-[#ECE5D8] border-4 border-[#D3BC8E] flex items-center justify-center text-[#3B4255] shadow-lg mb-3">
               <Server size={32} />
             </div>
             <div className="text-[#ECE5D8] font-genshin font-bold tracking-widest text-xl drop-shadow-md">设置</div>
             <div className="text-[#A4AAB6] text-[10px] tracking-[0.2em] mt-1 font-sans">SYSTEM</div>
           </div>

           {/* 菜单项 */}
           <div className="space-y-3 w-full z-10">
             <div className="bg-[#ECE5D8] text-[#3B4255] px-4 py-3 rounded-full font-bold text-sm shadow-[0_0_15px_#D3BC8E55] flex items-center gap-2 cursor-pointer scale-105 border-l-4 border-[#D3BC8E]">
               <Cpu size={16}/> 模型配置
             </div>
             <div className="text-[#787F8E] px-4 py-2 font-bold text-sm flex items-center gap-2 cursor-not-allowed select-none">
               <AlertCircle size={16}/> 图像设置
             </div>
           </div>
        </div>

        {/* --- 右侧内容区 (米色) --- */}
        <div className="flex-1 p-8 bg-[#F0F2F5] relative">
          {/* 背景纹理模拟 */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#3B4255_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <h3 className="font-genshin font-bold text-2xl text-[#3B4255] mb-8 flex items-center gap-2 border-b-2 border-[#D3BC8E]/20 pb-2">
             <span className="text-[#D3BC8E]">♦</span> Core Settings
          </h3>

          <div className="space-y-6 relative z-10">
            
            {/* LLM 选择 */}
            <div>
              <label className="block text-xs font-bold text-[#8C7D6B] mb-2 pl-2 tracking-widest">LLM PROVIDER</label>
              <div className="flex gap-3">
                {['qwen', 'deepseek', 'local'].map((key) => (
                  <label key={key} className="cursor-pointer relative group">
                    <input 
                      type="radio" 
                      className="peer hidden"
                      checked={cfg.llm_provider === key}
                      onChange={() => setCfg({ ...cfg, llm_provider: key })}
                    />
                    {/* 未选中 */}
                    <div className="px-4 py-2 rounded-full border-2 border-[#D8CBA8] bg-[#EBE5D9] text-[#8C7D6B] font-bold text-xs uppercase peer-checked:hidden hover:border-[#D3BC8E] transition-colors">
                      {key}
                    </div>
                    {/* 选中 (原神选中态通常是深色底+金色框) */}
                    <div className="hidden peer-checked:block px-4 py-2 rounded-full bg-[#3B4255] text-[#ECE5D8] border-2 border-[#D3BC8E] font-bold text-xs uppercase shadow-md">
                      {key}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 本地 URL */}
            {cfg.llm_provider === 'local' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-bold text-[#8C7D6B] mb-2 pl-2">LOCAL ENDPOINT</label>
                <input
                  className="genshin-input w-full px-4 py-2.5 font-bold text-sm"
                  placeholder="http://localhost:11434/v1"
                  value={cfg.base_url}
                  onChange={(e) => setCfg({...cfg, base_url: e.target.value})}
                />
              </div>
            )}

            {/* Key */}
            <div>
              <label className="block text-xs font-bold text-[#8C7D6B] mb-2 pl-2">API KEY</label>
              <div className="relative">
                <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D3BC8E]"/>
                <input
                  type="password"
                  className="genshin-input w-full pl-10 pr-4 py-2.5 font-bold text-sm tracking-widest"
                  placeholder="sk-........................"
                  value={cfg.api_key}
                  onChange={(e) => setCfg({...cfg, api_key: e.target.value})}
                />
              </div>
            </div>
            
            <div className="pt-8 flex justify-end">
               <button 
                 onClick={save} 
                 disabled={loading}
                 className="genshin-btn-primary px-8 py-2.5 text-base"
               >
                 {loading ? '保存中...' : '确认修改'}
               </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}