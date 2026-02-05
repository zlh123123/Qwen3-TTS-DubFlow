import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, RefreshCw, Layers, Plus, Trash2, Zap, 
  Edit, Volume2, ChevronLeft, Home 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Studio() {
  const { t } = useLang();
  const { pid } = useParams();
  const nav = useNavigate();
  
  // 数据存取
  const [lines, setLines] = useState([]);
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null); // 当前选中的行ID
  const [filters, setFilters] = useState({ onlyPending: true });
  const [loading, setLoading] = useState(true);
  
  const { startPolling } = useTaskPoller();

  // 初始化拉取数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          API.getCharacters(pid),
          API.getScript(pid)
        ]);
        setChars(cRes?.data || []);
        setLines(sRes?.data || []);
      } catch (e) {
        console.error("数据加载失败:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [pid]);

  // 获取当前选中的行数据
  const activeLine = lines.find(l => l.id === actID) || null;

  // --- 业务逻辑 ---
  
  // 乐观更新本地状态
  const mutate = (id, payload) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...payload } : l));
  };

  const handleAddLine = async (prevId) => {
    try {
      const res = await API.addLine(pid, prevId);
      const newLine = res.data;
      const idx = lines.findIndex(l => l.id === prevId);
      const newArr = [...lines];
      newArr.splice(idx + 1, 0, newLine);
      setLines(newArr);
      setActID(newLine.id);
    } catch (e) {
      alert(t('msg_add_fail'));
    }
  };

  const handleDelLine = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm(t('msg_del_confirm'))) return;
    setLines(prev => prev.filter(l => l.id !== id));
    API.deleteLine(id); // 后台异步删
    if (actID === id) setActID(null);
  };

  const handleSynth = async (id) => {
    mutate(id, { status: 'processing' });
    try {
      const res = await API.synthesize({ project_id: pid, line_ids: [id] });
      startPolling(res.data.task_id, (result) => {
        mutate(id, { status: 'synthesized', audio_url: result.audio_url });
      });
    } catch (e) {
      mutate(id, { status: 'failed' });
    }
  };

  const handleBatch = async () => {
    const targetIds = lines
      .filter(l => (filters.onlyPending ? l.status !== 'synthesized' : true))
      .map(l => l.id);
    
    if (targetIds.length === 0) return;

    setLines(prev => prev.map(l => targetIds.includes(l.id) ? { ...l, status: 'processing' } : l));
    const res = await API.synthesize({ project_id: pid, line_ids: targetIds });
    startPolling(res.data.task_id, () => {
      alert(t('msg_batch_done'));
      // 实际开发中此处通常会重新请求一次 getScript 刷新全部音频状态
    });
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5]">
      {t('loading')}
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col text-[#495366] overflow-hidden bg-[#F0F2F5]">
      
      {/* 顶部菜单栏 */}
      <header className="px-8 py-4 z-20 shrink-0">
        <div className="paimon-menu px-6 py-3 flex justify-between items-center bg-white/90 border-2 border-[#D8CBA8] shadow-sm">
          
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)} className="hover:bg-[#F7F3EB] p-2 rounded-full transition text-[#8C7D6B]">
              <ChevronLeft size={24} />
            </button>
            <div className="w-10 h-10 bg-[#D3BC8E] rounded-full flex items-center justify-center text-white border-2 border-white shadow">
              <Layers size={20}/>
            </div>
            <div>
              <h1 className="font-genshin font-bold text-lg text-[#3B4255] leading-tight">{t('studio_title')}</h1>
              <div className="text-[10px] text-gray-400 font-sans tracking-tighter">PID: {pid}</div>
            </div>
          </div>
          
          {/* 中间筛选与批量按钮 */}
          <div className="flex items-center gap-4 bg-[#F7F3EB] px-4 py-1.5 rounded-full border border-[#EBE5D9]">
             <label className="flex items-center gap-2 text-xs font-bold text-[#8C7D6B] cursor-pointer pr-4 border-r border-[#D8CBA8]">
               <input 
                 type="checkbox" 
                 checked={filters.onlyPending} 
                 onChange={e => setFilters({ ...filters, onlyPending: e.target.checked })} 
                 className="accent-[#D3BC8E] w-4 h-4"
               />
               <span>{t('chk_skip')}</span>
             </label>
             <button onClick={handleBatch} className="text-[#3B4255] hover:text-[#D3BC8E] text-xs font-bold flex items-center gap-1 transition-colors">
               <Zap size={14} className="fill-[#D3BC8E] text-[#D3BC8E]"/> {t('btn_batch')}
             </button>
          </div>

          {/* 右侧完成按钮 */}
          <button 
            onClick={() => nav('/')} 
            className="px-6 py-1.5 rounded-full border-2 border-[#D3BC8E] text-[#8C7D6B] font-bold bg-[#F7F3EB]/50 hover:bg-[#fff] transition-all flex items-center gap-2 active:scale-95 shadow-sm text-sm"
          >
            <Home size={16} /> <span className="pt-0.5">{t('finish')}</span>
          </button>
        </div>
      </header>

      {/* 三栏主体 */}
      <main className="flex-1 px-8 pb-8 grid grid-cols-12 gap-8 min-h-0">
        
        {/* 左：演员名单 */}
        <aside className="col-span-2 bg-white/80 border-2 border-[#EBE5D9] rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 bg-[#F9F7F4] font-bold text-[#8C7D6B] text-xs text-center border-b border-[#EBE5D9] tracking-widest">{t('cast_list')}</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {chars.map(c => (
              <div key={c.id} className="flex flex-col items-center p-3 rounded-2xl bg-[#F7F3EB] border border-transparent hover:border-[#D3BC8E] transition-all">
                <div className="text-3xl mb-1">{c.avatar || '👤'}</div>
                <div className="text-xs font-bold text-[#3B4255] truncate w-full text-center">{c.name}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* 中：剧本回顾流水 */}
        <section className="col-span-7 flex flex-col overflow-hidden relative">
           <div className="absolute inset-0 bg-[#EBE5D9]/30 rounded-[2rem] border-2 border-[#D8CBA8]/50 pointer-events-none"></div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24 scroll-smooth custom-scrollbar relative z-10">
              {lines.map((l) => (
                <div 
                  key={l.id} 
                  onClick={() => setActID(l.id)} 
                  className={`flex gap-4 p-5 rounded-[1.5rem] cursor-pointer transition-all border-2 relative group ${
                    actID === l.id ? 'bg-white border-[#D3BC8E] shadow-md scale-[1.01]' : 'bg-white/60 border-transparent hover:bg-white'
                  }`}
                >
                    <div className="relative shrink-0 flex flex-col items-center gap-1 pt-1">
                       <div className="w-12 h-12 bg-[#3B4255] rounded-full flex items-center justify-center text-2xl border-2 border-[#D3BC8E] shadow-sm z-10 overflow-hidden">
                         {chars.find(c => c.id === l.character_id)?.avatar || '👤'}
                       </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#D3BC8E] mb-1 ml-1 uppercase tracking-wider">
                        {chars.find(c => c.id === l.character_id)?.name || 'Unknown'}
                      </div>
                      <div className="text-[#3B4255] text-base font-medium leading-relaxed bg-[#F7F3EB] px-4 py-2 rounded-xl rounded-tl-none border border-[#EBE5D9] shadow-inner">
                        {l.text || "..."}
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2 h-8 ml-1">
                          {l.status === 'processing' && (
                             <span className="text-xs text-[#D3BC8E] flex gap-1 font-bold items-center">
                               <RefreshCw size={12} className="animate-spin"/> {t('loading')}
                             </span>
                          )}
                          {l.status === 'synthesized' && l.audio_url && (
                             <div className="flex items-center gap-2 bg-white rounded-full pr-2 border border-[#EBE5D9]" onClick={e => e.stopPropagation()}>
                                <button className="w-8 h-8 bg-[#D3BC8E] rounded-full flex justify-center items-center text-white hover:brightness-110 shadow-sm transition-all">
                                  <Play size={14} fill="white" className="ml-0.5" />
                                </button>
                                <audio src={l.audio_url} controls className="h-6 w-24 opacity-60" />
                             </div>
                          )}
                          {l.status !== 'processing' && (
                             <button onClick={(e) => { e.stopPropagation(); handleSynth(l.id); }} className="text-[#A4AAB6] hover:text-[#D3BC8E] p-1 transition-all">
                               <RefreshCw size={16} />
                             </button>
                          )}
                      </div>
                    </div>

                    <div className="absolute right-2 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleDelLine(e, l.id)} className="p-2 bg-white rounded-full shadow text-[#FF7F7F] hover:scale-110 transition-transform">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => handleAddLine(l.id)} className="p-2 bg-white rounded-full shadow text-[#D3BC8E] hover:scale-110 transition-transform">
                        <Plus size={14} />
                      </button>
                    </div>
                </div>
              ))}
              
              <button 
                onClick={() => handleAddLine(lines[lines.length - 1]?.id)} 
                className="w-full py-4 border-2 border-dashed border-[#D3BC8E]/50 rounded-[2rem] text-[#D3BC8E] font-bold hover:bg-white hover:border-[#D3BC8E] transition-all"
              >
                + {t('new_quest')}
              </button>
           </div>
        </section>

        {/* 右：参数面板 */}
        <section className="col-span-3 bg-white/90 border-2 border-[#D8CBA8] rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
           <div className="p-4 bg-[#F9F7F4] border-b border-[#EBE5D9] font-bold text-[#8C7D6B] text-xs text-center tracking-widest">{t('params')}</div>
           
           {activeLine ? (
             <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-[#D3BC8E] flex gap-1 items-center uppercase tracking-wider">
                   <Edit size={12} /> {t('lbl_text')}
                 </label>
                 <textarea 
                   className="w-full h-32 p-3 bg-[#F7F3EB] border-2 border-[#D8CBA8] rounded-xl text-[#3B4255] outline-none resize-none focus:border-[#D3BC8E] shadow-inner transition-colors" 
                   value={activeLine.text || ''} 
                   onChange={e => mutate(actID, { text: e.target.value })}
                 />
               </div>
               
               <div className="pt-4 border-t border-[#EBE5D9] space-y-4">
                 <div>
                   <label className="text-xs font-bold text-[#8C7D6B] mb-2 block uppercase tracking-wider">{t('lbl_speaker')}</label>
                   <select 
                     className="w-full p-2 bg-[#F7F3EB] border-2 border-[#EBE5D9] rounded-xl text-[#3B4255] outline-none focus:border-[#D3BC8E] transition-colors" 
                     value={activeLine.character_id || ''} 
                     onChange={e => mutate(actID, { character_id: parseInt(e.target.value) })}
                   >
                     {chars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                 </div>

                 <div>
                    <div className="flex justify-between text-xs font-bold text-[#8C7D6B] mb-2 uppercase tracking-wider">
                      <span>{t('lbl_speed')}</span>
                      <span className="text-[#D3BC8E]">1.0x</span>
                    </div>
                    <input type="range" className="w-full accent-[#D3BC8E] h-2 bg-[#EBE5D9] rounded-lg cursor-pointer" />
                 </div>
               </div>
               
               <div className="pt-4 mt-auto">
                 <button 
                   onClick={() => handleSynth(actID)} 
                   className="genshin-btn-primary w-full py-3 shadow-lg flex justify-center items-center gap-2 font-genshin"
                 >
                   <RefreshCw size={18} /> {t('btn_update_play')}
                 </button>
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-[#D3BC8E] opacity-50 px-8 text-center">
               <Volume2 size={64} strokeWidth={1} />
               <p className="font-bold mt-4 font-genshin text-lg">{t('ph_bubble')}</p>
             </div>
           )}
        </section>

      </main>
    </div>
  );
}