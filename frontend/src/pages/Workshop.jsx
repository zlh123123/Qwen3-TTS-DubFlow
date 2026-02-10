import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Trash2, RefreshCw, Plus, // 🟢 新增 Plus 图标
  Mic, User, Play, Pause, Shield, CheckCircle2, Loader2, Hourglass 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t, lang } = useLang(); 
  const { pid } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);
  
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cooldown, setCooldown] = useState(0); // 冷却倒计时

  const { startPolling, loading: isRolling } = useTaskPoller();
  const actChar = chars.find(c => c.id === actID);

  // 倒计时副作用
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // 1. 路径补全
  const getFullAudioUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const baseURL = "http://127.0.0.1:8000"; 
    if (path.includes(':\\')) {
      const fileName = path.split(/[\\/]/).pop();
      return `${baseURL}/static/temp/${fileName}`;
    }
    if (!path.includes('/')) return `${baseURL}/static/temp/${path}`;
    return `${baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  // 2. 头像逻辑
  const getAvatar = (char) => {
    const name = char.name || 'Unknown';
    const gender = (char.gender || '').toLowerCase();
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash);
    const maleAvatars = ['👦', '👨‍🦱', '👨‍🎓', '👨‍🎨', '👨‍🚀', '🧔', '👱‍♂️', '👨‍💼'];
    const femaleAvatars = ['👧', '👩‍🦱', '👩‍🎓', '👩‍🎨', '👩‍🚀', '👸', '👱‍♀️', '👩‍💼'];
    const neutralAvatars = ['🧑', '🕵️', '🧙', '🧛', '🥷'];
    if (gender === 'male' || gender === '男') return maleAvatars[index % maleAvatars.length];
    if (gender === 'female' || gender === '女') return femaleAvatars[index % femaleAvatars.length];
    return neutralAvatars[index % neutralAvatars.length];
  };

  // 3. 数据加载
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await API.getCharacters(pid);
      const rawList = res.data || res || []; 
      setChars(prev => {
        // 简单对比长度避免不必要的渲染，实际可做深对比
        if (isSilent && prev.length === rawList.length && prev.every((c, i) => c.ref_audio_path === rawList[i].ref_audio_path)) {
            return prev;
        }
        return rawList.map(c => ({
          ...c,
          ref_audio_path: c.ref_audio_path || '', 
          is_confirmed: c.is_confirmed || false,
          duration: c.duration || 0
        }));
      });
      // 如果没有选中项且有数据，默认选中第一个
      if (!isSilent && rawList.length > 0 && !actID) {
        setActID(rawList[0].id);
      }
    } catch (err) { console.error(err); } finally { if (!isSilent) setLoading(false); }
  };

  // 始终轮询
  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(true), 2000);
    return () => clearInterval(timer);
  }, [pid]);

  // 4. 音频加载
  useEffect(() => {
    if (audioRef.current && actChar?.ref_audio_path && !isRolling) {
      audioRef.current.load();
    }
  }, [actChar?.ref_audio_path, isRolling]);

  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));
  
  const syncToBackend = async (id, field, value) => {
    try { await API.updateCharacter(id, { [field]: value }); } catch (e) { console.error(e); }
  };

  // 🟢 5. 新增角色功能
const handleAddChar = async () => {
    if (isRolling) return; 
    
    // 构造新角色默认数据
    // ⚠️ 注意：确保这里的数据类型符合后端 Pydantic (schemas/character.py) 的定义
    const newCharPayload = {
      project_id: pid,
      name: lang === 'zh-CN' ? "新角色" : "New Character",
      // 如果后端允许为空，传空字符串；如果必须有值，给个默认值
      gender: "未知", 
      // ⚠️ 关键点：如果后端 age 是 int 类型，这里传 "" 会报错 500 或 422
      // 建议传 0 或者 18，或者确保后端 schemas 允许 str
      age: "18", 
      description: "新建立的角色...",
      prompt: "",
      ref_text: "",
      // ref_audio_path 通常由后端处理默认值，或者前端传 null
      ref_audio_path: null 
    };

    try {
      const res = await API.createCharacter(newCharPayload);
      if (res) {
        const newCharNode = { 
            ...res, 
            ref_audio_path: res.ref_audio_path || '', // 防止 null 导致前端报错
            is_confirmed: false 
        };
        setChars(prev => [newCharNode, ...prev]); 
        setActID(res.id); 
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Add failed", err);
      // 可以在这里把 err.response.data 打印出来看具体后端报什么错
      alert("Create character failed: " + (err.message || "Server Error"));
    }
  };
  // 🟢 6. 删除角色功能
  const delChar = async (e, id) => {
    e.stopPropagation();
    if (!confirm(t('del_confirm_char'))) return;

    try {
      await API.deleteCharacter(id);
      
      const rest = chars.filter(c => c.id !== id);
      setChars(rest);
      
      // 如果删除的是当前选中的角色，自动切换到剩下列表的第一个
      if (actID === id) {
        setActID(rest.length > 0 ? rest[0].id : null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Delete character failed");
    }
  };

  // 7. 播放控制
  const handleTogglePlay = () => {
    if (isRolling || !actChar?.ref_audio_path) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true))
        .catch(error => {
          console.error("Play error:", error);
          setIsPlaying(false);
        });
      }
    }
  };

  // 8. 生成按钮逻辑
  const handleGenerate = async () => {
    if (!actChar || isRolling || cooldown > 0) return;

    setCooldown(5);
    mutate(actID, { ref_audio_path: '' });
    setIsPlaying(false);

    try {
      const res = await API.previewVoice(actChar.id);
      const taskId = res.task_id || res.data?.task_id;
      
      startPolling(taskId, (result) => {
        const newPath = result.audio_url || result.ref_audio_path || result?.result?.audio_url;
        if (newPath) {
          mutate(actID, { 
            ref_audio_path: `${newPath}${newPath.includes('?') ? '&' : '?' }t=${Date.now()}`, 
            is_confirmed: false,
            duration: result.duration || 0
          });
        }
      });
    } catch (err) { alert(t('msg_generate_failed')); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5] dark:bg-[#1B1D22]">{t('loading')}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366] dark:text-[#ECE5D8]">
      <header className="px-8 py-4 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="genshin-btn-circle"><ChevronRight className="rotate-180" /></button>
          <h1 className="font-genshin text-2xl font-bold">{t('party_setup')}</h1>
        </div>
        <button onClick={() => nav(`/project/${pid}/studio`)} className="genshin-btn-primary px-10 py-2.5">
          <span className="font-genshin text-lg">{t('action_go')}</span> 
          <ChevronRight size={20} strokeWidth={3} />
        </button>
      </header>

      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0 relative">
        <aside className="w-72 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 dark:bg-[#2c313f]/80 backdrop-blur rounded-[2.5rem] p-4 border-2 border-white dark:border-white/5 shadow-2xl">
          
          {/* 🟢 新增角色按钮区 */}
          <div className="mb-4 px-2">
            <button 
              onClick={handleAddChar}
              disabled={isRolling}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[#D3BC8E] text-[#D3BC8E] font-bold flex items-center justify-center gap-2 hover:bg-[#D3BC8E]/10 hover:border-solid transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} strokeWidth={3} />
              <span className="uppercase tracking-widest text-xs">{lang === 'zh-CN' ? '添加成员' : 'ADD MEMBER'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {chars.map(c => (
              <div key={c.id} onClick={() => { setActID(c.id); setIsPlaying(false); }} className={`group relative h-16 rounded-2xl cursor-pointer flex items-center gap-3 px-3 border-2 transition-all ${actID === c.id ? 'bg-[#F2EBDC] dark:bg-[#3b4255] border-[#D3BC8E] shadow-md' : 'bg-white/30 border-transparent hover:bg-white/50'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl shrink-0 ${actID === c.id ? 'avatar-gradient text-white' : 'bg-[#D8CBA8]'}`}>
                  {getAvatar(c)}
                </div>
                <div className="flex-1 min-w-0 font-bold truncate text-sm uppercase flex items-center gap-2">
                  {c.name} {c.is_confirmed && <CheckCircle2 size={14} className="text-green-500" />}
                </div>
                {/* 🟢 删除按钮 */}
                <button 
                  onClick={(e) => delChar(e, c.id)} 
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                  title="Delete Character"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 genshin-card-flat overflow-hidden flex flex-col p-10">
          {actChar ? (
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar animate-in fade-in duration-300">
              <div className="grid grid-cols-12 gap-8 bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem]">
                <div className="col-span-2 aspect-square avatar-gradient rounded-3xl border-4 border-[#D3BC8E] flex items-center justify-center text-7xl shadow-xl">{getAvatar(actChar)}</div>
                <div className="col-span-10 grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_name')}</label>
                    <input className="genshin-input-simple" value={actChar.name} onChange={e => mutate(actID, {name: e.target.value})} onBlur={e => syncToBackend(actID, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_gender')}</label>
                    <input className="genshin-input-simple" value={actChar.gender} onChange={e => mutate(actID, {gender: e.target.value})} onBlur={e => syncToBackend(actID, 'gender', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_age')}</label>
                    <input className="genshin-input-simple" value={actChar.age} onChange={e => mutate(actID, {age: e.target.value})} onBlur={e => syncToBackend(actID, 'age', e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_description')}</label>
                    <textarea className="genshin-input-simple h-20 py-3" value={actChar.description} onChange={e => mutate(actID, {description: e.target.value})} onBlur={e => syncToBackend(actID, 'description', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem] space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.prompt} onChange={e => mutate(actID, {prompt: e.target.value})} onBlur={e => syncToBackend(actID, 'prompt', e.target.value)} placeholder={t('ph_prompt')} />
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.ref_text} onChange={e => mutate(actID, {ref_text: e.target.value})} onBlur={e => syncToBackend(actID, 'ref_text', e.target.value)} placeholder={t('ph_ref_text')} />
                </div>

                <div 
                  onClick={handleTogglePlay} 
                  className={`h-16 rounded-2xl bg-white/40 border-2 flex items-center px-6 gap-4 transition-all
                    ${isRolling ? 'border-[#D3BC8E] cursor-wait' : (actChar.ref_audio_path ? 'cursor-pointer hover:bg-white/60' : 'opacity-30 cursor-not-allowed')}
                    ${actChar.is_confirmed ? 'border-green-500' : 'border-[#D8CBA8]'}`}
                >
                  <div className={`p-2 rounded-full shadow-md ${isRolling ? 'bg-[#D3BC8E]/20 text-[#D3BC8E]' : (isPlaying ? 'bg-[#D3BC8E] text-white' : 'bg-[#3B4255] text-white')}`}>
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : (isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>)}
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center overflow-hidden">
                    {isRolling ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black tracking-[0.2em] text-[#D3BC8E] animate-pulse uppercase">
                          {lang === 'zh-CN' ? '语音合成中...' : 'Synthesizing...'}
                        </span>
                        <div className="flex gap-1 mt-1">
                          {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-[#D3BC8E] rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                        </div>
                      </div>
                    ) : (
                      actChar.ref_audio_path ? (
                        <div className="flex-1 flex items-end gap-[1px] h-10 justify-center overflow-hidden">
                          {Array.from({ length: 120 }).map((_, i) => (
                            <div key={i} className={`waveform-bar ${isPlaying ? 'waveform-animate' : ''}`} style={{ width: '2px', height: `${(Math.random()*0.6+0.2)*100}%`, animationDelay: `${i*0.02}s`, backgroundColor: actChar.is_confirmed ? '#22c55e' : (isPlaying ? '#D3BC8E' : '#A89E8C') }} />
                          ))}
                        </div>
                      ) : <span className="text-xs opacity-30 font-bold uppercase tracking-widest">{t('ph_ref_text')}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold opacity-60 font-mono w-10 text-right">
                    {isRolling ? '--' : (actChar.duration ? actChar.duration.toFixed(1) + 's' : '0.0s')}
                  </span>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleGenerate} 
                    disabled={isRolling || cooldown > 0} 
                    className={`flex-1 py-4 rounded-2xl border-2 font-bold flex justify-center items-center gap-3 transition-all
                    ${(isRolling || cooldown > 0) ? 'bg-[#D3BC8E]/10 border-[#D3BC8E] text-[#D3BC8E] cursor-not-allowed' : 'border-[#D3BC8E] text-[#D3BC8E] hover:bg-[#D3BC8E] hover:text-[#3B4255]'}`}
                  >
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : (cooldown > 0 ? <Hourglass size={18} className="animate-pulse"/> : <Mic size={18} />)} 
                    <span className="tracking-widest uppercase text-xs">
                      {isRolling 
                        ? t('btn_syncing') 
                        : (cooldown > 0 ? `冷却中 (${cooldown}s)` : t('btn_reroll'))
                      }
                    </span>
                  </button>
                  <button onClick={() => mutate(actID, {is_confirmed: true})} disabled={isRolling || !actChar.ref_audio_path} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${actChar.is_confirmed ? 'bg-green-600 text-white' : 'bg-[#D3BC8E] text-[#3B4255] disabled:opacity-30'}`}>
                    {t('confirm')}
                  </button>
                </div>
              </div>
              
              <audio 
                ref={audioRef} 
                src={getFullAudioUrl(actChar.ref_audio_path)} 
                onEnded={() => setIsPlaying(false)} 
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onError={(e) => {
                  console.error("Audio Load Error:", e.target.error);
                  setIsPlaying(false);
                }}
                className="hidden" 
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <Shield size={100} className="mb-6"/>
               <div className="text-2xl font-bold tracking-[0.6em] uppercase">
                 {chars.length === 0 ? "请添加角色" : t('ph_select')}
               </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}