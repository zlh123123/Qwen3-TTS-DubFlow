import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Trash2, RefreshCw, 
  Mic, User, Play, Pause, Shield, CheckCircle2, Loader2 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t, lang } = useLang(); // 🟢 从 Context 获取 t 和当前语言 lang
  const { pid } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);
  
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const { startPolling, loading: isRolling } = useTaskPoller();

  const actChar = chars.find(c => c.id === actID);

  // 1. 路径补全 (8000 端口)
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

  // 2. 头像逻辑 (保留你的哈希逻辑)
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
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await API.getCharacters(pid);
        const list = (res.data || res || []).map(c => ({
          ...c,
          ref_audio_path: c.ref_audio_path || '', 
          is_confirmed: c.is_confirmed || false
        }));
        setChars(list);
        if (list.length > 0) setActID(list[0].id);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    loadData();
  }, [pid]);

  // 4. 音频重载
  useEffect(() => {
    if (audioRef.current && actChar?.ref_audio_path && !isRolling) {
      audioRef.current.load();
    }
  }, [actChar?.ref_audio_path, isRolling]);

  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));
  const syncToBackend = async (id, field, value) => {
    try { await API.updateCharacter(id, { [field]: value }); } catch (e) { console.error(e); }
  };

  // 🟢 5. 播放控制：生成中锁定
  const handleTogglePlay = () => {
    if (isRolling || !actChar?.ref_audio_path) return;
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  };

  // 🟢 6. 生成按钮：点击即进入 Loading，直到轮询结束
  const handleGenerate = async () => {
    if (!actChar || isRolling) return;

    // 重点：立即清空本地路径，强制 UI 进入“生成状态”
    mutate(actID, { ref_audio_path: '' });
    setIsPlaying(false);

    try {
      const res = await API.previewVoice(actChar.id);
      const taskId = res.task_id || res.data?.task_id;
      
      startPolling(taskId, (result) => {
        const newPath = result.audio_url || result.ref_audio_path;
        if (newPath) {
          mutate(actID, { 
            ref_audio_path: `${newPath}${newPath.includes('?') ? '&' : '?' }t=${Date.now()}`, 
            is_confirmed: false 
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
        {/* 角色列表 */}
        <aside className="w-72 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 dark:bg-[#2c313f]/80 backdrop-blur rounded-[2.5rem] p-4 border-2 border-white dark:border-white/5 shadow-2xl">
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {chars.map(c => (
              <div key={c.id} onClick={() => { setActID(c.id); setIsPlaying(false); }} className={`group relative h-16 rounded-2xl cursor-pointer flex items-center gap-3 px-3 border-2 transition-all ${actID === c.id ? 'bg-[#F2EBDC] dark:bg-[#3b4255] border-[#D3BC8E] shadow-md' : 'bg-white/30 border-transparent'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl shrink-0 ${actID === c.id ? 'avatar-gradient text-white' : 'bg-[#D8CBA8]'}`}>
                  {getAvatar(c)}
                </div>
                <div className="flex-1 min-w-0 font-bold truncate text-sm uppercase flex items-center gap-2">
                  {c.name} {c.is_confirmed && <CheckCircle2 size={14} className="text-green-500" />}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 详情编辑区 */}
        <section className="flex-1 genshin-card-flat overflow-hidden flex flex-col p-10">
          {actChar ? (
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
              {/* 属性表单 (保留你的结构) */}
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

              {/* 语音调试区 */}
              <div className="bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem] space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.prompt} onChange={e => mutate(actID, {prompt: e.target.value})} onBlur={e => syncToBackend(actID, 'prompt', e.target.value)} placeholder={t('ph_prompt')} />
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.ref_text} onChange={e => mutate(actID, {ref_text: e.target.value})} onBlur={e => syncToBackend(actID, 'ref_text', e.target.value)} placeholder={t('ph_ref_text')} />
                </div>

                {/* 音频条状态联动 */}
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
                      <span className="text-[10px] font-black tracking-[0.2em] text-[#D3BC8E] animate-pulse uppercase">
                        {lang === 'zh-CN' ? '语音合成中...' : 'Synthesizing...'}
                      </span>
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
                  {/* 使用 t('btn_reroll') */}
                  <button 
                    onClick={handleGenerate} 
                    disabled={isRolling} 
                    className={`flex-1 py-4 rounded-2xl border-2 font-bold flex justify-center items-center gap-3 transition-all
                    ${isRolling ? 'bg-[#D3BC8E]/10 border-[#D3BC8E] text-[#D3BC8E] cursor-wait' : 'border-[#D3BC8E] text-[#D3BC8E] hover:bg-[#D3BC8E] hover:text-[#3B4255]'}`}
                  >
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : <Mic size={18} />} 
                    <span className="tracking-widest uppercase text-xs">
                      {isRolling ? t('btn_syncing') : t('btn_reroll')}
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
                className="hidden" 
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <Shield size={100} className="mb-6"/>
               <div className="text-2xl font-bold tracking-[0.6em] uppercase">{t('ph_select')}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}