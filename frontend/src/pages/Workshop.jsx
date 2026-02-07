import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Plus, Trash2, RefreshCw, 
  Mic, User, Info, Play, Pause, Shield 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t } = useLang();
  const { pid } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);
  
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const { startPolling, loading: isRolling } = useTaskPoller();

  const getAvatar = (char) => {
    const name = char.name || 'Unknown';
    const gender = (char.gender || '').toLowerCase();
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash);
    const maleAvatars = ['👦', '👨‍🦱', '👨‍🎓', '👨‍🎨', '👨‍🚀', '🧔', '👱‍♂️', '👨‍💼'];
    const femaleAvatars = ['👧', '👩‍🦱', '👩‍🎓', '👩‍🎨', '👩‍🚀', '👸', '👱‍♀️', '👩‍💼'];
    const neutralAvatars = ['🧑', '🕵️', '🧙', '🧛', '🥷'];

    if (gender === 'male' || gender === '男') return maleAvatars[index % maleAvatars.length];
    if (gender === 'female' || gender === '女') return femaleAvatars[index % femaleAvatars.length];
    return neutralAvatars[index % neutralAvatars.length];
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await API.getCharacters(pid);
        const list = (res.data || res || []).map(c => ({
          ...c,
          gender: c.gender || '',
          age: c.age || '',
          description: c.description || '',
          prompt: c.prompt || '',
          ref_text: c.ref_text || '',
        }));
        setChars(list);
        if (list.length > 0) setActID(list[0].id);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    loadData();
  }, [pid]);

  const actChar = chars.find(c => c.id === actID);
  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));

  const syncToBackend = async (id, field, value) => {
    try { await API.updateCharacter(id, { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleTogglePlay = () => {
    if (audioRef.current && actChar?.preview_audio) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const reroll = async () => {
    if (!actChar) return;
    try {
      const res = await API.previewVoice({
        character_id: actChar.id,
        text: actChar.ref_text,
        prompt: actChar.prompt
      });
      startPolling(res.task_id || res.data.task_id, (result) => {
        mutate(actID, { preview_audio: result.audio_url });
      });
    } catch (err) { alert(t('msg_generate_failed')); }
  };

  const delChar = (e, id) => {
    e.stopPropagation();
    if (!confirm(t('del_confirm_char'))) return;
    API.deleteCharacter(id).then(() => {
      const rest = chars.filter(c => c.id !== id);
      setChars(rest);
      if (actID === id) setActID(rest[0]?.id || null);
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5] dark:bg-[#1B1D22]">{t('loading')}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366] dark:text-[#ECE5D8]">
      <header className="px-8 py-4 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => nav('/')} className="genshin-btn-circle"><ChevronRight className="rotate-180" /></button>
            <h1 className="font-genshin text-2xl font-bold tracking-tight">{t('party_setup')}</h1>
          </div>
          <button onClick={() => nav(`/project/${pid}/studio`)} className="genshin-btn-primary px-10 py-2.5">
            <span className="font-genshin text-lg">{t('action_go')}</span> 
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0 relative">
        <aside className="w-72 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 dark:bg-[#2c313f]/80 backdrop-blur rounded-[2.5rem] p-4 border-2 border-white dark:border-white/5 shadow-2xl">
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {chars.map(c => (
              <div key={c.id} onClick={() => { setActID(c.id); setIsPlaying(false); }} className={`group relative h-16 rounded-2xl cursor-pointer flex items-center gap-3 px-3 border-2 transition-all ${actID === c.id ? 'bg-[#F2EBDC] dark:bg-[#3b4255] border-[#D3BC8E] shadow-md' : 'bg-white/30 dark:bg-white/5 border-transparent'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl shrink-0 transition-transform ${actID === c.id ? 'avatar-gradient text-white scale-110' : 'bg-[#D8CBA8] dark:bg-[#4a5366]'}`}>
                  {getAvatar(c)}
                </div>
                <div className="flex-1 min-w-0 font-bold truncate text-sm uppercase">{c.name}</div>
                <button onClick={(e) => delChar(e, c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 genshin-card-flat overflow-hidden flex flex-col">
          {actChar ? (
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-8 animate-in">
              <div className="space-y-4">
                <div className="text-xs font-bold text-[#8C7D6B] dark:text-[#D3BC8E] border-b-2 border-[#D3BC8E]/30 pb-2 uppercase tracking-[0.2em] flex gap-2"><User size={16}/> {t('attr_title')}</div>
                <div className="bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem] border-2 border-white dark:border-white/5 shadow-inner grid grid-cols-12 gap-8">
                  <div className="col-span-2 aspect-square avatar-gradient rounded-3xl border-4 border-[#D3BC8E] flex items-center justify-center text-7xl shadow-xl">
                    {getAvatar(actChar)}
                  </div>
                  <div className="col-span-10 grid grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest">{t('lbl_name')}</label>
                      <input className="genshin-input-simple" value={actChar.name} onChange={e => mutate(actID, {name: e.target.value})} onBlur={e => syncToBackend(actID, 'name', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest">{t('lbl_gender')}</label>
                      <input className="genshin-input-simple" placeholder={t('ph_gender')} value={actChar.gender} onChange={e => mutate(actID, {gender: e.target.value})} onBlur={e => syncToBackend(actID, 'gender', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest">{t('lbl_age')}</label>
                      <input className="genshin-input-simple" placeholder={t('ph_age')} value={actChar.age} onChange={e => mutate(actID, {age: e.target.value})} onBlur={e => syncToBackend(actID, 'age', e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-3">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest">{t('lbl_description')}</label>
                      <textarea className="genshin-input-simple h-20 py-3 resize-none" placeholder={t('ph_description')} value={actChar.description} onChange={e => mutate(actID, {description: e.target.value})} onBlur={e => syncToBackend(actID, 'description', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pb-4">
                <div className="text-xs font-bold text-[#8C7D6B] dark:text-[#D3BC8E] border-b-2 border-[#D3BC8E]/30 pb-2 uppercase tracking-[0.2em] flex gap-2"><Mic size={16}/> {t('voice_title')}</div>
                <div className="bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem] border-2 border-white dark:border-white/5 shadow-inner space-y-6">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest ml-1">{t('lbl_prompt')}</label>
                      <textarea className="genshin-input-simple h-24 py-3 resize-none" placeholder={t('ph_prompt')} value={actChar.prompt} onChange={e => mutate(actID, {prompt: e.target.value})} onBlur={e => syncToBackend(actID, 'prompt', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8C7D6B] font-black uppercase tracking-widest ml-1">{t('lbl_ref_text')}</label>
                      <textarea className="genshin-input-simple h-24 py-3 resize-none" placeholder={t('ph_ref_text')} value={actChar.ref_text} onChange={e => mutate(actID, {ref_text: e.target.value})} onBlur={e => syncToBackend(actID, 'ref_text', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div 
                      onClick={handleTogglePlay}
                      className={`h-16 rounded-2xl bg-white/40 dark:bg-black/20 border-2 border-[#D8CBA8] dark:border-white/10 flex items-end px-6 pb-3 gap-[3px] cursor-pointer group transition-all hover:bg-white/60 ${actChar.preview_audio || isPlaying ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <div className="bg-[#3B4255] dark:bg-[#D3BC8E] p-2 rounded-full text-white dark:text-[#3B4255] self-center shrink-0 shadow-md transition-transform group-hover:scale-110">
                        {isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
                      </div>
                      <div className="flex-1 flex items-end gap-[1px] h-10 mb-1 justify-center overflow-hidden">
                        {Array.from({ length: 400 }).map((_, i) => {
                          const h = Math.abs(Math.sin(i * 0.2)) * 0.6 + Math.random() * 0.4;
                          return (
                            <div key={i} className={`waveform-bar ${isPlaying ? 'waveform-animate' : ''}`} style={{ width: '2px', height: `${h * 100}%`, animationDelay: `${i * 0.02}s`, backgroundColor: isPlaying ? '#3B4255' : '#D3BC8E' }} />
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-bold text-[#3B4255] dark:text-[#D3BC8E] self-center ml-2 italic shrink-0">00:04</span>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={reroll} disabled={isRolling} className="flex-1 py-3.5 rounded-2xl border-2 border-[#D3BC8E] text-[#D3BC8E] font-bold flex justify-center items-center gap-3 hover:bg-[#D3BC8E] hover:text-[#3B4255] transition-all disabled:opacity-50">
                        <RefreshCw size={18} className={isRolling ? 'animate-spin' : ''} /> 
                        <span className="tracking-widest uppercase text-xs">{isRolling ? t('btn_syncing') : t('btn_reroll')}</span>
                      </button>
                      <button className="flex-1 py-3.5 rounded-2xl bg-[#D3BC8E] text-[#3B4255] font-bold shadow-lg uppercase tracking-widest text-xs active:scale-95 transition-all">
                        {t('confirm')}
                      </button>
                    </div>
                  </div>
                </div>
                <audio ref={audioRef} src={actChar?.preview_audio} onEnded={() => setIsPlaying(false)} className="hidden" />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <Shield size={100} className="mb-6 text-[#3B4255] dark:text-[#D3BC8E]"/>
               <div className="font-genshin text-2xl font-bold uppercase tracking-[0.6em]">{t('ph_select')}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}