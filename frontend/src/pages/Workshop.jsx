import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Plus, Trash2, Mic, RefreshCw, User, Star, Shield, Sword } from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
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

  useEffect(() => {
    API.getCharacters(pid).then(res => {
      const list = (res.data || []).map(c => ({
        ...c, gender: c.gender||'?', avatar: c.avatar||'👤', prompt: c.prompt||'', ref_text: c.ref_text||'Start!', element: c.element||'⭐'
      }));
      setChars(list);
      if (list.length) setActID(list[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pid]);

  const actChar = chars.find(c => c.id === actID);
  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));
  
  const add = () => { 
    const nc = { id: Date.now(), name: 'Traveler', gender: '?', avatar: '✨', element: '⭐', ref_text: 'Ready!' }; 
    setChars([...chars, nc]); setActID(nc.id); 
  };
  
  const del = (e, id) => { 
    e.stopPropagation(); if(!confirm('要剔除这名成员吗？')) return;
    const rest = chars.filter(c => c.id !== id); setChars(rest); 
    if (actID === id) setActID(rest[0]?.id || null); 
  };

  const reroll = async () => {
    if (!actChar) return;
    const res = await API.previewVoice({ character_id: actChar.id, text: actChar.ref_text, prompt: actChar.prompt });
    startPolling(res.data.task_id, (r) => mutate(actID, { preview_audio: r.audio_url }));
  };

  const confirmVoice = () => actChar?.preview_audio && mutate(actID, { is_confirmed: true });

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold">{t('loading')}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366] bg-[#F0F2F5]">
      {/* 顶部：只有返回首页和“出击”按钮 */}
      <header className="px-8 py-4 z-20 bg-gradient-to-b from-[#D8CBA8]/50 to-transparent shrink-0">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-3">
              <button onClick={() => nav('/')} className="genshin-btn-circle border-none bg-white/50 hover:bg-white shadow-sm">
                <ChevronRight className="rotate-180"/>
              </button>
              <h1 className="font-genshin text-2xl text-[#3B4255] font-bold drop-shadow-sm flex items-center gap-2">
                 {t('party_setup')} <span className="text-sm font-sans text-[#8C7D6B] font-normal ml-2">{t('party_sub')}</span>
              </h1>
           </div>
           
           {/* 这里的按钮是“出击”，去 Studio 页面 */}
           <button 
             onClick={() => nav(`/project/${pid}/studio`)} 
             className="genshin-btn-primary px-8 py-2.5"
           >
             <span className="font-genshin text-lg">{t('action_go')}</span> 
             <ChevronRight size={20} strokeWidth={3}/>
           </button>
        </div>
      </header>

      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0 relative">
        <aside className="w-80 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 backdrop-blur rounded-[2rem] p-4 border-2 border-[#FFF] shadow-inner">
           <div className="flex justify-between items-center px-2 mb-2">
             <span className="text-xs font-bold text-[#8C7D6B]">{t('members')} ({chars.length}/4)</span>
             <button onClick={add} className="w-6 h-6 bg-[#D3BC8E] text-white rounded-full flex items-center justify-center hover:scale-110 transition"><Plus size={14}/></button>
           </div>
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {chars.map(c => (
               <div key={c.id} onClick={() => setActID(c.id)} className={`relative h-20 rounded-[1.5rem] cursor-pointer flex items-center gap-3 px-3 border-2 transition-all ${actID === c.id ? 'bg-[#F2EBDC] border-[#D3BC8E] shadow-[0_0_10px_#D3BC8E]' : 'bg-[#3B4255]/5 border-transparent hover:bg-[#3B4255]/10'}`}>
                 <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 z-10 ${actID === c.id ? 'bg-[#3B4255] border-[#D3BC8E]' : 'bg-[#D8CBA8] border-white'}`}>{c.avatar}</div>
                 <div className="flex-1 min-w-0 z-10 font-bold text-[#3B4255] truncate">{c.name}</div>
                 <button onClick={(e) => del(e, c.id)} className="absolute right-2 top-2 text-[#FF7F7F] opacity-0 group-hover:opacity-100 transition"><Trash2 size={14}/></button>
               </div>
             ))}
           </div>
        </aside>

        <section className="flex-1 genshin-card flex flex-col bg-[#F0F2F5]/90">
          {actChar ? (
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="flex gap-8 mb-8">
                 <div className="w-32 h-32 bg-gradient-to-b from-[#5C5C70] to-[#3B4255] rounded-t-full rounded-b-[2rem] border-4 border-[#D3BC8E] shadow-xl flex items-center justify-center text-7xl relative">
                    {actChar.avatar}
                    <div className="absolute -bottom-3 w-10 h-10 bg-[#EBE5D9] rounded-full border-2 border-[#D3BC8E] flex items-center justify-center text-xl shadow-md">{actChar.element}</div>
                 </div>
                 <div className="pt-4 flex-1">
                    <h2 className="text-4xl font-genshin text-[#3B4255] mb-2">{actChar.name}</h2>
                    <div className="flex gap-1">{[1,2,3,4,5].map(i => <Star key={i} size={20} className="fill-[#F3A530] text-[#F3A530]"/>)}</div>
                    <div className="mt-4 flex gap-4 opacity-80">
                       <div className="flex items-center gap-2 bg-[#EBE5D9] px-3 py-1 rounded-full border border-[#D8CBA8]">
                          <Shield size={14} className="text-[#8C7D6B]"/> <span className="text-sm font-bold">DEF 876</span>
                       </div>
                       <div className="flex items-center gap-2 bg-[#EBE5D9] px-3 py-1 rounded-full border border-[#D8CBA8]">
                          <Sword size={14} className="text-[#8C7D6B]"/> <span className="text-sm font-bold">ATK 2k</span>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div className="text-sm font-genshin text-[#8C7D6B] border-b border-[#D8CBA8] pb-1">{t('attr_title')}</div>
                    <div className="bg-[#EBE5D9] p-4 rounded-xl border border-[#D8CBA8] space-y-3">
                       <div><label className="text-xs text-[#8C7D6B] font-bold">{t('lbl_name')}</label><input className="w-full bg-transparent border-b border-[#D8CBA8] font-bold text-[#3B4255] py-1 outline-none" value={actChar.name} onChange={e => mutate(actID, {name: e.target.value})}/></div>
                       <div><label className="text-xs text-[#8C7D6B] font-bold">{t('lbl_prompt')}</label><textarea className="w-full bg-transparent text-sm h-24 resize-none outline-none mt-1" value={actChar.prompt} onChange={e => mutate(actID, {prompt: e.target.value})}/></div>
                    </div>
                 </div>
                 <div className="flex flex-col">
                    <div className="text-sm font-genshin text-[#8C7D6B] border-b border-[#D8CBA8] pb-1">{t('voice_title')}</div>
                    <div className="bg-[#3B4255] text-[#ECE5D8] p-6 rounded-xl flex-1 flex flex-col relative overflow-hidden mt-4">
                       <textarea className="w-full bg-transparent text-lg font-bold text-white resize-none outline-none mb-6 border-b border-white/20 focus:border-[#D3BC8E] transition-colors" rows="2" value={actChar.ref_text} onChange={e => mutate(actID, { ref_text: e.target.value })}/>
                       <div className="mt-auto flex gap-3 z-10">
                         <button onClick={reroll} disabled={isRolling} className="flex-1 py-2.5 rounded-full border-2 border-[#D3BC8E] text-[#D3BC8E] font-bold flex justify-center items-center gap-2 hover:bg-[#D3BC8E] hover:text-[#3B4255] transition-all">
                            <RefreshCw size={16} className={isRolling?'animate-spin':''}/> {isRolling ? 'Cooking...' : t('btn_reroll')}
                         </button>
                         <button onClick={confirmVoice} disabled={!actChar.preview_audio} className="flex-1 py-2.5 rounded-full bg-[#D3BC8E] text-[#3B4255] font-bold shadow-lg disabled:grayscale">Confirm</button>
                       </div>
                       {actChar.preview_audio && <audio controls src={actChar.preview_audio} className="mt-4 w-full h-8 opacity-80 mix-blend-screen"/>}
                    </div>
                 </div>
              </div>
            </div>
          ) : <div className="h-full flex items-center justify-center opacity-40 font-genshin text-xl font-bold">{t('ph_select')}</div>}
        </section>
      </main>
    </div>
  );
}