import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, RefreshCw, Star, Shield, Sword } from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller'; // 假设你有一个轮询 Hook
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t } = useLang();
  const { pid } = useParams();
  const nav = useNavigate();
  
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null);
  const [loading, setLoading] = useState(true);
  const { startPolling, loading: isRolling } = useTaskPoller();

  // 🟢 1. 加载角色：对接后端 project_id
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await API.getCharacters(pid);
        const list = (res.data || res || []).map(c => ({
          ...c,
          // 增加兜底数据，防止后端字段缺失导致 UI 崩溃
          gender: c.gender || '?',
          avatar: c.avatar || '👤', 
          prompt: c.prompt || '',
          ref_text: c.ref_text || 'Hello World',
          element: c.element || '⭐'
        }));
        setChars(list);
        if (list.length > 0) setActID(list[0].id);
      } catch (err) {
        console.error("Failed to fetch characters:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [pid]);

  const actChar = chars.find(c => c.id === actID);

  // 🟢 2. 本地状态修改（防抖或离开页面时保存）
  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));

  // 🟢 3. 实时同步到后端：修改名字或 Prompt
  const syncToBackend = async (id, field, value) => {
    try {
      await API.updateCharacter(id, { [field]: value });
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  // 🟢 4. 语音试听：对接后端 Task 系统
  const reroll = async () => {
    if (!actChar) return;
    try {
      // 发起异步生成请求
      const res = await API.previewVoice({
        character_id: actChar.id,
        text: actChar.ref_text,
        prompt: actChar.prompt
      });
      
      // 开始轮询任务结果 (taskId -> audioUrl)
      startPolling(res.task_id || res.data.task_id, (result) => {
        mutate(actID, { preview_audio: result.audio_url });
      });
    } catch (err) {
      alert("Voice generation failed.");
    }
  };

  const del = async (e, id) => {
    e.stopPropagation();
    if (!confirm(t('del_confirm_char'))) return;
    try {
      await API.deleteCharacter(id);
      const rest = chars.filter(c => c.id !== id);
      setChars(rest);
      if (actID === id) setActID(rest[0]?.id || null);
    } catch (err) {
      alert("Delete failed");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5] animate-pulse">{t('loading')}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366] bg-[#F0F2F5]">
      {/* Header */}
      <header className="px-8 py-4 z-20 bg-gradient-to-b from-[#D8CBA8]/50 to-transparent shrink-0">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-3">
              <button onClick={() => nav('/')} className="w-10 h-10 rounded-full border-none bg-white/50 hover:bg-white shadow-sm flex items-center justify-center transition-all active:scale-90">
                <ChevronRight className="rotate-180 text-[#3B4255]"/>
              </button>
              <h1 className="font-genshin text-2xl text-[#3B4255] font-bold drop-shadow-sm flex items-center gap-2">
                 {t('party_setup')} 
                 <span className="text-xs font-sans text-[#8C7D6B] font-normal px-2 py-0.5 bg-white/40 rounded-full">Lv.90</span>
              </h1>
           </div>
           
           <button 
             onClick={() => nav(`/project/${pid}/studio`)} 
             className="genshin-btn-primary px-10 py-2.5 flex items-center gap-2 group shadow-xl"
           >
             <span className="font-genshin text-lg tracking-widest">{t('action_go')}</span> 
             <ChevronRight size={20} strokeWidth={3} className="group-hover:translate-x-1 transition-transform"/>
           </button>
        </div>
      </header>

      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0 relative">
        {/* 左侧角色列表 */}
        <aside className="w-80 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 backdrop-blur rounded-[2rem] p-4 border-2 border-white/50 shadow-xl">
           <div className="flex justify-between items-center px-4 mb-4">
             <span className="text-[10px] font-bold text-[#8C7D6B] uppercase tracking-tighter">{t('members')}</span>
             <span className="text-[10px] font-bold text-[#D3BC8E] bg-[#3B4255] px-2 py-0.5 rounded-full">{chars.length} / 20</span>
           </div>
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {chars.map(c => (
               <div 
                key={c.id} 
                onClick={() => setActID(c.id)} 
                className={`group relative h-20 rounded-[1.5rem] cursor-pointer flex items-center gap-4 px-4 border-2 transition-all duration-300 ${actID === c.id ? 'bg-[#F2EBDC] border-[#D3BC8E] scale-105 shadow-lg' : 'bg-white/40 border-transparent hover:bg-white/60'}`}
               >
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 shrink-0 transition-transform ${actID === c.id ? 'bg-[#3B4255] border-[#D3BC8E] rotate-6' : 'bg-[#D8CBA8] border-white'}`}>
                   {c.avatar}
                 </div>
                 <div className="flex-1 min-w-0 font-bold text-[#3B4255] truncate text-lg uppercase tracking-tight">{c.name}</div>
                 <button onClick={(e) => del(e, c.id)} className="opacity-0 group-hover:opacity-100 p-2 text-[#FF7F7F] hover:bg-red-50 rounded-full transition-all">
                    <Trash2 size={16}/>
                 </button>
               </div>
             ))}
           </div>
        </aside>

        {/* 右侧详情区 */}
        <section className="flex-1 genshin-card-flat bg-white/40 backdrop-blur rounded-[3rem] border-2 border-white/60 shadow-2xl overflow-hidden flex flex-col">
          {actChar ? (
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar animate-in fade-in slide-in-from-right-4">
              {/* 角色顶部 Banner */}
              <div className="flex gap-10 mb-10 items-end">
                 <div className="w-40 h-40 bg-gradient-to-b from-[#5C5C70] to-[#3B4255] rounded-t-full rounded-b-[3rem] border-4 border-[#D3BC8E] shadow-2xl flex items-center justify-center text-8xl relative group">
                    {actChar.avatar}
                    <div className="absolute -bottom-4 w-12 h-12 bg-[#EBE5D9] rounded-full border-2 border-[#D3BC8E] flex items-center justify-center text-2xl shadow-lg ring-4 ring-[#F0F2F5]">{actChar.element}</div>
                 </div>
                 <div className="flex-1 pb-4">
                    <h2 className="text-5xl font-genshin text-[#3B4255] mb-3 tracking-tighter uppercase italic">{actChar.name}</h2>
                    <div className="flex gap-1.5 mb-6">{[1,2,3,4,5].map(i => <Star key={i} size={22} className="fill-[#F3A530] text-[#F3A530] drop-shadow-sm"/>)}</div>
                    <div className="flex gap-4 opacity-90">
                       <div className="flex items-center gap-3 bg-[#3B4255] text-[#ECE5D8] px-5 py-2 rounded-full shadow-md">
                          <Shield size={16} className="text-[#D3BC8E]"/> <span className="text-sm font-bold tracking-widest uppercase">DEF 1240</span>
                       </div>
                       <div className="flex items-center gap-3 bg-[#3B4255] text-[#ECE5D8] px-5 py-2 rounded-full shadow-md">
                          <Sword size={16} className="text-[#D3BC8E]"/> <span className="text-sm font-bold tracking-widest uppercase">ATK 2480</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* 编辑区域 */}
              <div className="grid grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="text-xs font-bold text-[#8C7D6B] border-b-2 border-[#D3BC8E]/30 pb-2 uppercase tracking-[0.2em]">{t('attr_title')}</div>
                    <div className="bg-[#EBE5D9]/50 p-6 rounded-[2rem] border-2 border-white/50 space-y-5 shadow-inner">
                       <div className="space-y-2">
                         <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest ml-1">{t('lbl_name')}</label>
                         <input 
                            className="w-full bg-white/60 rounded-xl px-4 py-3 font-bold text-[#3B4255] outline-none focus:ring-2 ring-[#D3BC8E] transition-all" 
                            value={actChar.name} 
                            onChange={e => mutate(actID, {name: e.target.value})}
                            onBlur={e => syncToBackend(actID, 'name', e.target.value)}
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest ml-1">{t('lbl_prompt')}</label>
                         <textarea 
                            className="w-full bg-white/60 rounded-xl px-4 py-4 text-sm h-32 resize-none outline-none focus:ring-2 ring-[#D3BC8E] transition-all leading-relaxed" 
                            value={actChar.prompt} 
                            onChange={e => mutate(actID, {prompt: e.target.value})}
                            onBlur={e => syncToBackend(actID, 'prompt', e.target.value)}
                         />
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-col">
                    <div className="text-xs font-bold text-[#8C7D6B] border-b-2 border-[#D3BC8E]/30 pb-2 uppercase tracking-[0.2em]">{t('voice_title')}</div>
                    <div className="bg-[#3B4255] text-[#ECE5D8] p-8 rounded-[2rem] flex-1 flex flex-col relative overflow-hidden mt-6 shadow-2xl">
                       <div className="absolute top-0 right-0 p-8 opacity-10"><Mic size={120}/></div>
                       <textarea 
                          className="w-full bg-transparent text-xl font-bold text-white resize-none outline-none mb-8 border-b-2 border-white/10 focus:border-[#D3BC8E] transition-colors leading-relaxed placeholder:text-white/20" 
                          rows="3" 
                          placeholder="Type reference text..."
                          value={actChar.ref_text} 
                          onChange={e => mutate(actID, { ref_text: e.target.value })}
                       />
                       <div className="mt-auto flex gap-4 z-10">
                         <button 
                            onClick={reroll} 
                            disabled={isRolling} 
                            className="flex-1 py-4 rounded-2xl border-2 border-[#D3BC8E] text-[#D3BC8E] font-bold flex justify-center items-center gap-3 hover:bg-[#D3BC8E] hover:text-[#3B4255] transition-all active:scale-95 disabled:grayscale"
                         >
                            <RefreshCw size={20} className={isRolling?'animate-spin':''}/> 
                            <span className="tracking-widest uppercase">{isRolling ? 'Resonating...' : t('btn_reroll')}</span>
                         </button>
                         <button className="flex-1 py-4 rounded-2xl bg-[#D3BC8E] text-[#3B4255] font-bold shadow-lg active:scale-95 transition-transform disabled:grayscale uppercase tracking-widest">
                            {t('confirm')}
                         </button>
                       </div>
                       {actChar.preview_audio && (
                         <div className="mt-6 p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/5">
                            <audio controls src={actChar.preview_audio} className="w-full h-8"/>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20 animate-pulse">
               <Shield size={80} className="mb-4 text-[#3B4255]"/>
               <div className="font-genshin text-2xl font-bold uppercase tracking-[0.5em]">{t('ph_select')}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}