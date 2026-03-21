import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Trash2, RefreshCw, Plus, 
  Mic, User, Play, Pause, Shield, CheckCircle2, Loader2, Hourglass, X 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t, lang } = useLang(); 
  const { pid } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);
  
  // =================状态管理=================
  const [chars, setChars] = useState([]);
  const [actID, setActID] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  
  // 生成冷却
  const [cooldown, setCooldown] = useState(0); 
  const [reconfirmNotice, setReconfirmNotice] = useState(null);

  // 弹窗控制
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCharForm, setNewCharForm] = useState({
    name: '',
    gender: '',
    age: '',
    description: '',
    prompt: '',    
    ref_text: ''   
  });

  const { startPolling, loading: isRolling } = useTaskPoller();
  const actChar = chars.find(c => c.id === actID);
  const VOICE_IMPACT_FIELDS = new Set(['gender', 'age', 'description', 'prompt', 'ref_text']);

  // =================副作用 (Effects)=================

  // 1. 冷却倒计时
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // 2. 数据加载与轮询 (🟢 核心修复：防止轮询覆盖本地已有的时长)
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await API.getCharacters(pid);
      const rawList = res.data || res || []; 
      
      setChars(prev => {
        // 如果是静默刷新，且数据长度一致且关键音频路径一致，则不更新状态
        if (isSilent && prev.length === rawList.length) {
            const hasChanged = rawList.some((newItem, index) => 
                newItem.ref_audio_path !== prev[index].ref_audio_path || 
                newItem.is_confirmed !== prev[index].is_confirmed
            );
            // 如果后端数据没变，直接返回旧数据（保留 duration）
            if (!hasChanged) return prev;
        }

        return rawList.map(c => {
          // 🟢 查找旧数据中对应的角色
          const prevChar = prev.find(p => p.id === c.id);
          
          return {
            ...c,
            ref_audio_path: c.ref_audio_path || '', 
            is_confirmed: c.is_confirmed || false,
            // 🟢 核心修复逻辑：
            // 如果后端传来的 c.duration 是 0 (或者不存在)，但我们本地 prevChar 有值，
            // 那就保留本地算出来的 duration，防止被轮询清零。
            duration: c.duration || prevChar?.duration || 0 
          };
        });
      });

      // 初始化选中第一个
      if (!isSilent && rawList.length > 0 && !actID) {
        setActID(rawList[0].id);
      }
    } catch (err) { console.error(err); } finally { if (!isSilent) setLoading(false); }
  };

  useEffect(() => {
    loadData();
    // 每 2 秒轮询一次
    const timer = setInterval(() => loadData(true), 2000);
    return () => clearInterval(timer);
  }, [pid]);

  // 3. 音频自动加载 (当路径变化时)
  useEffect(() => {
    if (audioRef.current && actChar?.ref_audio_path && !isRolling) {
      audioRef.current.load();
    }
  }, [actChar?.ref_audio_path, isRolling]);

  // =================辅助函数=================

  // 路径补全
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

  // 头像生成
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

  // 本地状态更新
  const mutate = (id, pl) => setChars(prev => prev.map(c => c.id === id ? { ...c, ...pl } : c));
  
  // 同步到后端 (onBlur)
  const syncToBackend = async (id, field, value) => {
    try { await API.updateCharacter(id, { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleCharacterFieldChange = (field, value) => {
    if (!actChar) return;
    const shouldResetConfirmed = actChar.is_confirmed && VOICE_IMPACT_FIELDS.has(field) && actChar[field] !== value;

    mutate(actID, {
      [field]: value,
      ...(shouldResetConfirmed ? { is_confirmed: false } : {})
    });

    if (shouldResetConfirmed) {
      setReconfirmNotice({
        characterId: actID,
        changedField: field
      });
      syncToBackend(actID, 'is_confirmed', false);
    }
  };

  // =================交互逻辑=================

  const openAddModal = () => {
    if (isRolling) return;
    setNewCharForm({ 
      name: '', 
      gender: '', 
      age: '', 
      description: '',
      prompt: '', 
      ref_text: ''
    }); 
    setShowAddModal(true);
  };

  const confirmAddChar = async () => {
    if (!newCharForm.name.trim()) {
      alert(lang === 'zh-CN' ? "请输入角色名称" : "Please enter character name");
      return;
    }

    const newCharPayload = {
      project_id: pid,
      name: newCharForm.name,
      gender: newCharForm.gender || "未知",
      age: newCharForm.age || "18",
      description: newCharForm.description || "...",
      prompt: newCharForm.prompt || "",
      ref_text: newCharForm.ref_text || "",
      ref_audio_path: null 
    };

    try {
      const res = await API.createCharacter(newCharPayload);
      if (res) {
        const newCharNode = { 
            ...res, 
            ref_audio_path: res.ref_audio_path || '', 
            is_confirmed: false,
            duration: 0
        };
        setChars(prev => [newCharNode, ...prev]); 
        setActID(res.id); 
        setIsPlaying(false);
        setShowAddModal(false);
      }
    } catch (err) {
      console.error("Add failed", err);
      alert("Create character failed: " + (err.message || "Server Error"));
    }
  };

  const delChar = async (e, id) => {
    e.stopPropagation();
    if (!confirm(t('del_confirm_char'))) return;

    try {
      await API.deleteCharacter(id);
      const rest = chars.filter(c => c.id !== id);
      setChars(rest);
      if (actID === id) {
        setActID(rest.length > 0 ? rest[0].id : null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Delete character failed");
    }
  };

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

  const handleGenerate = async () => {
    if (!actChar || isRolling || cooldown > 0) return;

    setCooldown(10); 
    mutate(actID, { ref_audio_path: '', is_confirmed: false }); 
    setReconfirmNotice(null);
    setIsPlaying(false);
    setCurrentTime(0);

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

  const handleConfirmVoice = async () => {
    if (!actChar?.ref_audio_path || isRolling) return;
    mutate(actID, { is_confirmed: true });
    setReconfirmNotice(null);
    try {
      await API.updateCharacter(actID, { is_confirmed: true });
    } catch (err) {
      mutate(actID, { is_confirmed: false });
      alert(lang === 'zh-CN' ? '确认失败，请重试' : 'Failed to confirm voice');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5] dark:bg-[#1B1D22]">{t('loading')}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#495366] dark:text-[#ECE5D8] relative">
      
      {/* =================弹窗 Modal================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#ECE5D8] dark:bg-[#2C313F] w-[600px] border-[3px] border-[#D3BC8E] rounded-[2rem] shadow-2xl p-8 flex flex-col gap-5 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-[#A4AAB6] hover:text-[#D3BC8E] transition-colors"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-genshin font-bold text-[#3B4255] dark:text-[#D3BC8E] text-center border-b-2 border-[#D3BC8E]/20 pb-4">
              {lang === 'zh-CN' ? '添加新成员' : 'Add New Member'}
            </h2>

            <div className="space-y-4">
              {/* 姓名 */}
              <div>
                <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('lbl_name')}</label>
                <input 
                  autoFocus
                  className="genshin-input-simple w-full bg-white/50 dark:bg-black/20" 
                  value={newCharForm.name}
                  onChange={e => setNewCharForm({...newCharForm, name: e.target.value})}
                  placeholder={lang === 'zh-CN' ? "例如：旅行者" : "e.g. Traveler"}
                />
              </div>
              
              {/* 性别和年龄 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('lbl_gender')}</label>
                  <input 
                    className="genshin-input-simple w-full bg-white/50 dark:bg-black/20" 
                    value={newCharForm.gender}
                    onChange={e => setNewCharForm({...newCharForm, gender: e.target.value})}
                    placeholder={lang === 'zh-CN' ? "例如：女" : "e.g. Female"}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('lbl_age')}</label>
                  <input 
                    className="genshin-input-simple w-full bg-white/50 dark:bg-black/20" 
                    value={newCharForm.age}
                    onChange={e => setNewCharForm({...newCharForm, age: e.target.value})}
                    placeholder="18"
                  />
                </div>
              </div>

              {/* 人设描述 */}
              <div>
                <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('lbl_description')}</label>
                <textarea 
                  className="genshin-input-simple w-full h-16 bg-white/50 dark:bg-black/20 py-2" 
                  value={newCharForm.description}
                  onChange={e => setNewCharForm({...newCharForm, description: e.target.value})}
                  placeholder={lang === 'zh-CN' ? "简单的性格描述..." : "Brief description..."}
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('ph_prompt')}</label>
                <textarea 
                  className="genshin-input-simple w-full h-16 bg-white/50 dark:bg-black/20 py-2" 
                  value={newCharForm.prompt}
                  onChange={e => setNewCharForm({...newCharForm, prompt: e.target.value})}
                  placeholder={lang === 'zh-CN' ? "例如：温柔、清澈、稍微带点气声..." : "e.g. Gentle, clear voice..."}
                />
              </div>

              {/* Ref Text */}
              <div>
                <label className="text-xs font-bold text-[#8C7D6B] uppercase block mb-1">{t('ph_ref_text')}</label>
                <textarea 
                  className="genshin-input-simple w-full h-16 bg-white/50 dark:bg-black/20 py-2" 
                  value={newCharForm.ref_text}
                  onChange={e => setNewCharForm({...newCharForm, ref_text: e.target.value})}
                  placeholder={lang === 'zh-CN' ? "如果不上传参考音频，请留空..." : "Leave empty if not uploading ref audio..."}
                />
              </div>
            </div>

            <button 
              onClick={confirmAddChar}
              className="genshin-btn-primary py-3 w-full text-lg font-bold mt-2"
            >
              {lang === 'zh-CN' ? '确认创建' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* =================主头部================= */}
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

      {/* =================主内容区================= */}
      <main className="flex-1 px-8 pb-8 flex gap-8 overflow-hidden min-h-0 relative">
        
        {/* 左侧列表 */}
        <aside className="w-72 flex flex-col overflow-hidden shrink-0 bg-[#EBE5D9]/80 dark:bg-[#2c313f]/80 backdrop-blur rounded-[2.5rem] p-4 border-2 border-white dark:border-white/5 shadow-2xl">
          
          <div className="mb-4 px-2">
            <button 
              onClick={openAddModal} 
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

        {/* 右侧详情 */}
        <section className="flex-1 genshin-card-flat overflow-hidden flex flex-col p-10">
          {actChar ? (
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar animate-in fade-in duration-300">
              
              {/* 1. 顶部基础信息表单 */}
              <div className="grid grid-cols-12 gap-8 bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem]">
                <div className="col-span-2 aspect-square avatar-gradient rounded-3xl border-4 border-[#D3BC8E] flex items-center justify-center text-7xl shadow-xl">{getAvatar(actChar)}</div>
                <div className="col-span-10 grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_name')}</label>
                    <input className="genshin-input-simple" value={actChar.name} onChange={e => handleCharacterFieldChange('name', e.target.value)} onBlur={e => syncToBackend(actID, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_gender')}</label>
                    <input className="genshin-input-simple" value={actChar.gender} onChange={e => handleCharacterFieldChange('gender', e.target.value)} onBlur={e => syncToBackend(actID, 'gender', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_age')}</label>
                    <input className="genshin-input-simple" value={actChar.age} onChange={e => handleCharacterFieldChange('age', e.target.value)} onBlur={e => syncToBackend(actID, 'age', e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] text-[#8C7D6B] font-black uppercase">{t('lbl_description')}</label>
                    <textarea className="genshin-input-simple h-20 py-3" value={actChar.description} onChange={e => handleCharacterFieldChange('description', e.target.value)} onBlur={e => syncToBackend(actID, 'description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 2. 底部语音调试区 */}
              <div className="bg-[#EBE5D9]/50 dark:bg-black/20 p-8 rounded-[2.5rem] space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.prompt} onChange={e => handleCharacterFieldChange('prompt', e.target.value)} onBlur={e => syncToBackend(actID, 'prompt', e.target.value)} placeholder={t('ph_prompt')} />
                  <textarea className="genshin-input-simple h-24 py-3" value={actChar.ref_text} onChange={e => handleCharacterFieldChange('ref_text', e.target.value)} onBlur={e => syncToBackend(actID, 'ref_text', e.target.value)} placeholder={t('ph_ref_text')} />
                </div>
                {reconfirmNotice?.characterId === actID && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-700 px-4 py-2 text-xs font-bold">
                    {lang === 'zh-CN'
                      ? '你修改了音色相关参数，已自动取消确认。请重新试听并确认该角色音色。'
                      : 'Voice-related fields changed. Confirmation was reset. Please preview and confirm again.'}
                  </div>
                )}

                {/* 播放器条 */}
                <div 
                  onClick={handleTogglePlay} 
                  className={`h-16 rounded-2xl bg-white/40 border-2 flex items-center px-6 gap-4 transition-all
                    ${isRolling ? 'border-[#D3BC8E] cursor-wait' : (actChar.ref_audio_path ? 'cursor-pointer hover:bg-white/60' : 'opacity-30 cursor-not-allowed')}
                    ${actChar.is_confirmed ? 'border-green-500' : 'border-[#D8CBA8]'}`}
                >
                  <div className={`p-2 rounded-full shadow-md ${isRolling ? 'bg-[#D3BC8E]/20 text-[#D3BC8E]' : (isPlaying ? 'bg-[#D3BC8E] text-white' : 'bg-[#3B4255] text-white')}`}>
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : (isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>)}
                  </div>
                  
                  {/* 波形动画 */}
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
                  
                  {/* 🟢 时间显示：修复了被轮询清零的问题 */}
                  <span className="text-[10px] font-bold opacity-60 font-mono w-20 text-right whitespace-nowrap">
                    {isRolling 
                      ? '--' 
                      : (isPlaying 
                          ? `${currentTime.toFixed(1)}s / ${(actChar.duration || 0).toFixed(1)}s` 
                          : `${(actChar.duration || 0).toFixed(1)}s`
                        )
                    }
                  </span>
                </div>

                <div className="flex gap-4">
                  {/* 生成按钮 */}
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
                  {/* 确认按钮 */}
                  <button onClick={handleConfirmVoice} disabled={isRolling || !actChar.ref_audio_path} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${actChar.is_confirmed ? 'bg-green-600 text-white' : 'bg-[#D3BC8E] text-[#3B4255] disabled:opacity-30'}`}>
                    {t('confirm')}
                  </button>
                </div>
              </div>
              
              {/* 🟢 修复后的 Audio 标签：自动计算时长并防止轮询覆盖 */}
              <audio 
                ref={audioRef} 
                src={getFullAudioUrl(actChar.ref_audio_path)} 
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }} 
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onLoadedMetadata={(e) => {
                  const d = e.target.duration;
                  if (d && isFinite(d)) {
                    mutate(actID, { duration: d });
                  }
                }}
                onTimeUpdate={(e) => {
                   setCurrentTime(e.target.currentTime);
                }}
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
