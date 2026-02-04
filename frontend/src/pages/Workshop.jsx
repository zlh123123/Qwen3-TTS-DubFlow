import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { Play, Check, ChevronRight, Plus, Trash2, Mic, RefreshCw, User, Star, Shield, Sword } from 'lucide-react';

export default function Workshop() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const [chars, setChars] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const { startPolling, loading: isRerolling } = useTaskPoller();

  useEffect(() => {
    API.getCharacters(pid).then(res => {
      // 数据清洗一下，防止没字段报错
      const list = res.data.map(c => ({ 
        ...c, 
        prompt: c.prompt || '', 
        ref_text: c.ref_text || '异世相遇，尽享美味！',
        element: '⚡' // 假装有个属性
      }));
      setChars(list);
      if (list.length) setActiveId(list[0].id);
    });
  }, [pid]);

  const activeChar = chars.find(c => c.id === activeId);
  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));
  
  // 简单的 CRUD
  const add = () => {
    const nc = { id: Date.now(), name: 'Traveler', gender: '?', avatar: '✨', element: '⭐', ref_text: 'Start!' };
    setChars([...chars, nc]); setActiveId(nc.id);
  };
  const del = (e, id) => {
    e.stopPropagation(); if (!confirm('Del?')) return;
    const rest = chars.filter(c => c.id !== id); setChars(rest); 
    if (activeId === id) setActiveId(rest[0]?.id || null);
  };
  const reroll = async () => {
    if (!activeChar) return;
    const res = await API.previewVoice({ character_id: activeChar.id, text: activeChar.ref_text, prompt: activeChar.prompt });
    startPolling(res.data.task_id, (r) => mutate(activeId, { preview_audio: r.audio_url }));
  };
  const confirmVoice = () => activeChar?.preview_audio && mutate(activeId, { is_confirmed: true });

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366]">
      {/* 顶部只有返回和继续，没有设置按钮 */}
      <header className="px-8 py-4 z-20 bg-gradient-to-b from-[#D8CBA8]/50 to-transparent">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="genshin-btn-circle border-none bg-white/50 hover:bg-white"><ChevronRight className="rotate-180"/></button>
              <h1 className="font-genshin text-2xl text-[#3B4255] font-bold drop-shadow-sm">
                 队伍配置 <span className="text-sm font-sans text-[#8C7D6B] font-normal ml-2">Party Setup</span>
              </h1>
           </div>
           
           <button onClick={() => navigate(`/project/${pid}/studio`)} className="genshin-btn-primary">
             <span className="font-genshin">出击</span> <ChevronRight size={18} strokeWidth={3}/>
           </button>
        </div>
      </header>

      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0">
        {/* 左侧角色列表 */}
        <aside className="w-80 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 backdrop-blur rounded-[2rem] p-4 border-2 border-[#FFF] shadow-inner">
           <div className="flex justify-between items-center px-2 mb-2">
             <span className="text-xs font-bold text-[#8C7D6B]">MEMBERS ({chars.length}/4)</span>
             <button onClick={add} className="w-6 h-6 bg-[#D3BC8E] text-white rounded-full flex items-center justify-center hover:scale-110"><Plus size={14}/></button>
           </div>
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {chars.map(c => (
               <div key={c.id} onClick={() => setActiveId(c.id)} className={`relative h-20 rounded-[1.5rem] cursor-pointer flex items-center gap-3 px-3 border-2 ${activeId === c.id ? 'bg-[#F2EBDC] border-[#D3BC8E] shadow-[0_0_10px_#D3BC8E]' : 'bg-[#3B4255]/5 border-transparent'}`}>
                 <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 z-10 ${activeId === c.id ? 'bg-[#3B4255] border-[#D3BC8E]' : 'bg-[#D8CBA8] border-white'}`}>{c.avatar}</div>
                 <div className="flex-1 min-w-0 z-10 font-bold text-[#3B4255] truncate">{c.name}</div>
                 <button onClick={(e) => del(e, c.id)} className="absolute right-2 top-2 text-[#FF7F7F]"><Trash2 size={14}/></button>
               </div>
             ))}
           </div>
        </aside>

        {/* 右侧面板 */}
        <section className="flex-1 genshin-card flex flex-col bg-[#F0F2F5]/90">
          {activeChar ? (
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="flex gap-8 mb-8">
                 <div className="w-32 h-32 bg-gradient-to-b from-[#5C5C70] to-[#3B4255] rounded-t-full rounded-b-[2rem] border-4 border-[#D3BC8E] shadow-xl flex items-center justify-center text-7xl relative">
                    {activeChar.avatar}
                    <div className="absolute -bottom-3 w-10 h-10 bg-[#EBE5D9] rounded-full border-2 border-[#D3BC8E] flex items-center justify-center text-xl shadow-md">{activeChar.element}</div>
                 </div>
                 <div className="pt-4">
                    <h2 className="text-4xl font-genshin text-[#3B4255] mb-2">{activeChar.name}</h2>
                    <div className="flex gap-2">
                       {[1,2,3,4,5].map(i => <Star key={i} size={20} className="fill-[#F3A530] text-[#F3A530]"/>)}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div className="text-sm font-genshin text-[#8C7D6B] border-b border-[#D8CBA8] pb-1">Attributes</div>
                    <div className="bg-[#EBE5D9] p-4 rounded-xl border border-[#D8CBA8] space-y-3">
                       <div><label className="text-xs text-[#8C7D6B] font-bold">NAME</label><input className="w-full bg-transparent border-b border-[#D8CBA8] font-bold text-[#3B4255]" value={activeChar.name} onChange={e => mutate(activeId, {name: e.target.value})}/></div>
                       <div><label className="text-xs text-[#8C7D6B] font-bold">PROMPT</label><textarea className="w-full bg-transparent text-sm h-20 resize-none" value={activeChar.prompt} onChange={e => mutate(activeId, {prompt: e.target.value})}/></div>
                    </div>
                 </div>

                 <div className="flex flex-col">
                    <div className="text-sm font-genshin text-[#8C7D6B] border-b border-[#D8CBA8] pb-1">Voice</div>
                    <div className="bg-[#3B4255] text-[#ECE5D8] p-6 rounded-xl flex-1 flex flex-col relative overflow-hidden mt-4">
                       <textarea className="w-full bg-transparent text-lg font-bold text-white resize-none outline-none mb-6" rows="2" value={activeChar.ref_text} onChange={e => mutate(activeId, { ref_text: e.target.value })}/>
                       <div className="mt-auto flex gap-3 z-10">
                         <button onClick={reroll} disabled={isRerolling} className="flex-1 py-2 rounded-full border-2 border-[#D3BC8E] text-[#D3BC8E] font-bold flex justify-center items-center gap-2">
                            <RefreshCw size={16} className={isRerolling?'animate-spin':''}/> Reroll
                         </button>
                         <button onClick={confirmVoice} disabled={!activeChar.preview_audio} className="flex-1 py-2 rounded-full bg-[#D3BC8E] text-[#3B4255] font-bold shadow-lg disabled:grayscale">Confirm</button>
                       </div>
                       {activeChar.preview_audio && <audio controls src={activeChar.preview_audio} className="mt-4 w-full h-8 opacity-80"/>}
                    </div>
                 </div>
              </div>
            </div>
          ) : <div className="h-full flex items-center justify-center opacity-40 font-genshin text-xl font-bold">Select Character</div>}
        </section>
      </main>
    </div>
  );
}