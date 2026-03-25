import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Trash2, RefreshCw, Plus, 
  Mic, Play, Pause, Shield, CheckCircle2, Loader2, Hourglass, X, FolderOpen, AlertCircle
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function Workshop() {
  const { t, lang } = useLang(); 
  const isZh = lang === 'zh-CN';
  const { pid } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const waveformRafRef = useRef(null);
  
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
  const [charRefs, setCharRefs] = useState([]);
  const [activeRefAssetId, setActiveRefAssetId] = useState('');
  const [refsLoading, setRefsLoading] = useState(false);
  const [applyingRef, setApplyingRef] = useState(false);
  const [refSourceMode, setRefSourceMode] = useState('tts');
  const [avatarErrorMap, setAvatarErrorMap] = useState({});
  const [notice, setNotice] = useState('');

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
  const confirmedCount = useMemo(() => chars.filter(c => c.is_confirmed).length, [chars]);
  const AVATAR_GRADIENTS = useMemo(
    () => [
      ['#1D4ED8', '#0F172A'],
      ['#7C3AED', '#1E1B4B'],
      ['#0F766E', '#134E4A'],
      ['#BE185D', '#500724'],
      ['#EA580C', '#7C2D12'],
      ['#475569', '#0F172A'],
      ['#15803D', '#14532D'],
      ['#B91C1C', '#450A0A'],
    ],
    []
  );
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

  const loadCharacterRefs = async (silent = false) => {
    if (!silent) setRefsLoading(true);
    try {
      const res = await API.getCharacterRefs(pid);
      setCharRefs(Array.isArray(res) ? res : (res?.data || []));
    } catch (err) {
      console.error('Load character refs failed:', err);
    } finally {
      if (!silent) setRefsLoading(false);
    }
  };

  useEffect(() => {
    loadCharacterRefs();
    const timer = setInterval(() => loadCharacterRefs(true), 5000);
    return () => clearInterval(timer);
  }, [pid]);

  // 3. 音频自动加载 (当路径变化时)
  useEffect(() => {
    if (audioRef.current && actChar?.ref_audio_path && !isRolling) {
      audioRef.current.load();
    }
  }, [actChar?.ref_audio_path, isRolling]);

  useEffect(() => {
    if (!actChar) {
      setActiveRefAssetId('');
      return;
    }
    const normalizedCurrentPath = (actChar.ref_audio_path || '').split('?')[0];
    const matched = charRefs.find((asset) => asset.file_path === normalizedCurrentPath);
    setActiveRefAssetId(matched?.id || '');
    setRefSourceMode(matched ? 'library' : 'tts');
  }, [actChar?.id, actChar?.ref_audio_path, charRefs]);

  useEffect(() => {
    return () => {
      if (waveformRafRef.current) {
        cancelAnimationFrame(waveformRafRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  // =================辅助函数=================

  // 路径补全
  const getFullAudioUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('file://')) return path;
    const baseURL = "http://127.0.0.1:8000"; 
    if (path.startsWith('/static/')) return `${baseURL}${path}`;
    if (path.startsWith('/')) return `file://${path}`;
    if (path.includes(':\\')) {
      const fileName = path.split(/[\\/]/).pop();
      return `${baseURL}/static/temp/${fileName}`;
    }
    if (!path.includes('/')) return `${baseURL}/static/temp/${path}`;
    return `${baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const ensureWaveformAnalyser = () => {
    if (!audioRef.current) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new window.AudioContext();
    }
    if (!analyserRef.current) {
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.75;
    }
    if (!sourceNodeRef.current) {
      sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioCtxRef.current.destination);
    }
    return analyserRef.current;
  };

  const drawWaveformFrame = () => {
    const canvas = waveformCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    if (!ctx || !width || !height) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = actChar?.is_confirmed ? '#22c55e' : '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const startWaveformLoop = async () => {
    const analyser = ensureWaveformAnalyser();
    if (!analyser || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    const loop = () => {
      drawWaveformFrame();
      waveformRafRef.current = requestAnimationFrame(loop);
    };
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
    loop();
  };

  const stopWaveformLoop = () => {
    if (waveformRafRef.current) {
      cancelAnimationFrame(waveformRafRef.current);
      waveformRafRef.current = null;
    }
    drawWaveformFrame();
  };

  const hashString = (value = '') => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const getAvatarMeta = (char) => {
    const base = `${char?.id || ''}:${char?.name || ''}`;
    const index = hashString(base) % AVATAR_GRADIENTS.length;
    const [from, to] = AVATAR_GRADIENTS[index];
    const name = (char?.name || '').trim();
    const initials = name
      ? (name.includes(' ')
          ? name.split(/\s+/).slice(0, 2).map((n) => n[0]).join('')
          : name.slice(0, 2))
      : 'NA';
    return {
      seed: encodeURIComponent(base || 'Narratis'),
      initials: initials.toUpperCase(),
      style: { background: `linear-gradient(135deg, ${from}, ${to})` },
    };
  };

  const renderAvatar = (char, sizeClass = 'h-10 w-10', textClass = 'text-sm') => {
    const meta = getAvatarMeta(char);
    const avatarKey = char?.id || char?.name || meta.seed;
    const failed = !!avatarErrorMap[avatarKey];
    return (
      <div
        className={`relative inline-flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full font-bold uppercase tracking-[0.06em] text-white ${textClass}`}
        style={meta.style}
      >
        {!failed && (
          <img
            src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${meta.seed}`}
            alt={char?.name || 'avatar'}
            className="h-full w-full object-cover"
            onError={() => setAvatarErrorMap((prev) => ({ ...prev, [avatarKey]: true }))}
          />
        )}
        {failed && <span>{meta.initials}</span>}
      </div>
    );
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

    setRefSourceMode('tts');
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

  const handleApplyRefAsset = async () => {
    if (!actChar || !activeRefAssetId) return;
    const selectedAsset = charRefs.find((asset) => asset.id === activeRefAssetId);
    if (!selectedAsset) return;

    setApplyingRef(true);
    setRefSourceMode('library');
    const nextPath = selectedAsset.file_path;
    mutate(actID, {
      ref_audio_path: nextPath,
      is_confirmed: false,
      duration: selectedAsset.duration || 0,
    });
    setIsPlaying(false);
    setCurrentTime(0);
    setReconfirmNotice({
      characterId: actID,
      changedField: 'ref_audio_path',
    });

    try {
      await API.updateCharacter(actID, {
        ref_audio_path: nextPath,
        is_confirmed: false,
        duration: selectedAsset.duration || 0,
      });
    } catch (err) {
      console.error('Apply character ref asset failed:', err);
      alert(isZh ? '应用素材失败，请重试' : 'Failed to apply asset');
      loadData(true);
    } finally {
      setApplyingRef(false);
    }
  };

  const goStudioWithGuard = () => {
    if (chars.length === 0) {
      setNotice(isZh ? '请先创建并确认至少一个角色。' : 'Create and confirm at least one character first.');
      return;
    }
    const unconfirmed = chars.filter((c) => !c.is_confirmed).map((c) => c.name);
    if (unconfirmed.length > 0) {
      const preview = unconfirmed.slice(0, 4).join('、');
      setNotice(
        isZh
          ? `以下角色尚未确认音色：${preview}${unconfirmed.length > 4 ? ' 等' : ''}`
          : `Unconfirmed voices: ${unconfirmed.slice(0, 4).join(', ')}${unconfirmed.length > 4 ? '...' : ''}`
      );
      return;
    }
    nav(`/project/${pid}/studio`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-[#111111] dark:text-[#d8d8d8]">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={16} className="animate-spin" />
          {t('loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 text-slate-700 dark:bg-[#111111] dark:text-[#d8d8d8]">
      {!!notice && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm dark:border-[#6e5a34] dark:bg-[#2f2719] dark:text-[#f0d9a7]">
            <AlertCircle size={14} />
            <span>{notice}</span>
          </div>
        </div>
      )}
      
      {/* =================弹窗 Modal================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#343434] dark:bg-[#1a1a1a] max-h-[88vh] custom-scrollbar">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2b2b2b] dark:hover:text-[#f0f0f0]"
            >
              <X size={18} />
            </button>
            
            <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-[#f0f0f0]">
              {isZh ? '新建角色' : 'Create Character'}
            </h2>

            <div className="space-y-4 text-sm">
              {/* 姓名 */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('lbl_name')}</label>
                <input 
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                  value={newCharForm.name}
                  onChange={e => setNewCharForm({...newCharForm, name: e.target.value})}
                  placeholder={isZh ? "例如：旁白" : "e.g. Narrator"}
                />
              </div>
              
              {/* 性别和年龄 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('lbl_gender')}</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                    value={newCharForm.gender}
                    onChange={e => setNewCharForm({...newCharForm, gender: e.target.value})}
                    placeholder={isZh ? "例如：女" : "e.g. Female"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('lbl_age')}</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                    value={newCharForm.age}
                    onChange={e => setNewCharForm({...newCharForm, age: e.target.value})}
                    placeholder="18"
                  />
                </div>
              </div>

              {/* 人设描述 */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('lbl_description')}</label>
                <textarea 
                  className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                  value={newCharForm.description}
                  onChange={e => setNewCharForm({...newCharForm, description: e.target.value})}
                  placeholder={isZh ? "简单的人设描述..." : "Short role profile..."}
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('ph_prompt')}</label>
                <textarea 
                  className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                  value={newCharForm.prompt}
                  onChange={e => setNewCharForm({...newCharForm, prompt: e.target.value})}
                  placeholder={isZh ? "例如：温柔、清澈、稍带气声..." : "e.g. gentle, clear, soft breathy tone..."}
                />
              </div>

              {/* Ref Text */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">{t('ph_ref_text')}</label>
                <textarea 
                  className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]" 
                  value={newCharForm.ref_text}
                  onChange={e => setNewCharForm({...newCharForm, ref_text: e.target.value})}
                  placeholder={isZh ? "参考台词，可留空" : "Reference script line (optional)"}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e0e0e0] dark:hover:bg-[#2e2e2e]"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button 
                onClick={confirmAddChar}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d9d9d9]"
              >
                <Plus size={14} />
                {isZh ? '创建角色' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================主头部================= */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-4 dark:border-[#343434] dark:bg-[#151515]">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav('/')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#dddddd] dark:hover:bg-[#2e2e2e]"
          >
            <ChevronRight className="rotate-180" size={16} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">{isZh ? '角色工坊' : 'Character Workshop'}</h1>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-[#a0a0a0]">
              {isZh ? `共 ${chars.length} 个角色，已确认 ${confirmedCount} 个` : `${chars.length} roles, ${confirmedCount} confirmed`}
            </div>
          </div>
        </div>
        <button
          onClick={goStudioWithGuard}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d9d9d9]"
        >
          <span>{isZh ? '进入演播室' : 'Go to Studio'}</span>
          <ChevronRight size={16} />
        </button>
        </div>
      </header>

      {/* =================主内容区================= */}
      <main className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 py-6">
        
        {/* 左侧列表 */}
        <aside className="w-80 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="border-b border-slate-200 p-4 dark:border-[#343434]">
            <button 
              onClick={openAddModal} 
              disabled={isRolling}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-[#4a4a4a] dark:bg-[#252526] dark:text-[#e0e0e0] dark:hover:bg-[#2e2e2e]"
            >
              <Plus size={14} />
              {isZh ? '添加角色' : 'Add Character'}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#3b3b3b] dark:bg-[#252526]">
                <div className="text-slate-500 dark:text-[#9a9a9a]">{isZh ? '角色总数' : 'Total'}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">{chars.length}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#3b3b3b] dark:bg-[#252526]">
                <div className="text-slate-500 dark:text-[#9a9a9a]">{isZh ? '已确认' : 'Confirmed'}</div>
                <div className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{confirmedCount}</div>
              </div>
            </div>
          </div>
          
          <div className="h-[calc(100%-126px)] overflow-y-auto p-3 custom-scrollbar">
            <div className="space-y-2">
            {chars.map(c => (
              <div
                key={c.id}
                onClick={() => { setActID(c.id); setIsPlaying(false); }}
                className={`group relative flex h-16 cursor-pointer items-center gap-3 rounded-xl border px-3 transition ${
                  actID === c.id
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2b2b2b]'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#dfdfdf] dark:hover:bg-[#2e2e2e]'
                }`}
              >
                {renderAvatar(c, 'h-10 w-10', 'text-[12px]')}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className={`text-xs ${actID === c.id ? 'text-slate-300 dark:text-[#b7b7b7]' : 'text-slate-500 dark:text-[#9d9d9d]'}`}>
                    {c.is_confirmed ? (isZh ? '已确认音色' : 'Voice Confirmed') : (isZh ? '待确认' : 'Pending')}
                  </div>
                </div>
                {c.is_confirmed && <CheckCircle2 size={14} className={`${actID === c.id ? 'text-emerald-300' : 'text-emerald-500'}`} />}
                <button 
                  onClick={(e) => delChar(e, c.id)} 
                  className={`p-1.5 rounded-md transition ${
                    actID === c.id
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-300'
                  }`}
                  title={isZh ? '删除角色' : 'Delete Character'}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
                </div>
          </div>
        </aside>

        {/* 右侧详情 */}
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#343434] dark:bg-[#1a1a1a]">
          {actChar ? (
            <div className="h-full space-y-5 overflow-y-auto custom-scrollbar">
              
              {/* 1. 顶部基础信息表单 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-[#3b3b3b] dark:bg-[#252526]">
                <div className="mb-4 flex items-center gap-3">
                  {renderAvatar(actChar, 'h-16 w-16', 'text-lg')}
                  <div>
                    <div className="text-base font-semibold text-slate-900 dark:text-[#f0f0f0]">{actChar.name}</div>
                    <div className="text-xs text-slate-500 dark:text-[#9d9d9d]">{isZh ? '角色基础信息' : 'Character Profile'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{t('lbl_name')}</label>
                    <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.name} onChange={e => handleCharacterFieldChange('name', e.target.value)} onBlur={e => syncToBackend(actID, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{t('lbl_gender')}</label>
                    <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.gender} onChange={e => handleCharacterFieldChange('gender', e.target.value)} onBlur={e => syncToBackend(actID, 'gender', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{t('lbl_age')}</label>
                    <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.age} onChange={e => handleCharacterFieldChange('age', e.target.value)} onBlur={e => syncToBackend(actID, 'age', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{t('lbl_description')}</label>
                    <textarea className="h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.description} onChange={e => handleCharacterFieldChange('description', e.target.value)} onBlur={e => syncToBackend(actID, 'description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 2. 底部语音调试区 */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-[#3b3b3b] dark:bg-[#252526]">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                      {isZh ? '参考音频来源' : 'Reference Audio Source'}
                    </div>
                    <button
                      type="button"
                      onClick={() => nav(`/project/${pid}/assets?tab=character_refs`)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#2a2a2a] dark:text-[#d3d3d3] dark:hover:bg-[#333333]"
                    >
                      <FolderOpen size={12} />
                      {isZh ? '素材库' : 'Library'}
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRefSourceMode('tts')}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                        refSourceMode === 'tts'
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2b2b2b]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#4a4a4a] dark:bg-[#252526] dark:text-[#d8d8d8]'
                      }`}
                    >
                      {isZh ? '音色设计生成' : 'Generate by Voice Design'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefSourceMode('library')}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                        refSourceMode === 'library'
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2b2b2b]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#4a4a4a] dark:bg-[#252526] dark:text-[#d8d8d8]'
                      }`}
                    >
                      {isZh ? '使用素材库语音' : 'Use Library Voice'}
                    </button>
                  </div>

                  {refSourceMode === 'library' ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        value={activeRefAssetId}
                        onChange={(e) => setActiveRefAssetId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
                      >
                        <option value="">{isZh ? '选择角色语音素材' : 'Select voice asset'}</option>
                        {charRefs.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.display_name}
                            {asset.character_name_snapshot ? ` · ${asset.character_name_snapshot}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleApplyRefAsset}
                        disabled={!activeRefAssetId || applyingRef || refsLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#4a4a4a] dark:bg-[#2a2a2a] dark:text-[#e0e0e0] dark:hover:bg-[#333333]"
                      >
                        {(applyingRef || refsLoading) ? <Loader2 size={14} className="animate-spin" /> : null}
                        {isZh ? '设为参考音频' : 'Set as Reference'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-[#9d9d9d]">
                      {isZh
                        ? '使用当前角色参数与参考台词，调用音色设计生成新的参考音频。'
                        : 'Generate a new reference audio from current role prompt and reference text.'}
                    </div>
                  )}
                </div>

                {refSourceMode === 'tts' && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{isZh ? '音色提示词' : 'Voice Prompt'}</label>
                      <textarea className="min-h-[148px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.prompt} onChange={e => handleCharacterFieldChange('prompt', e.target.value)} onBlur={e => syncToBackend(actID, 'prompt', e.target.value)} placeholder={t('ph_prompt')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">{isZh ? '参考台词' : 'Reference Text'}</label>
                      <textarea className="min-h-[148px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]" value={actChar.ref_text} onChange={e => handleCharacterFieldChange('ref_text', e.target.value)} onBlur={e => syncToBackend(actID, 'ref_text', e.target.value)} placeholder={t('ph_ref_text')} />
                    </div>
                  </div>
                )}
                {reconfirmNotice?.characterId === actID && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {isZh
                      ? '你修改了音色相关参数，已自动取消确认。请重新试听并确认该角色音色。'
                      : 'Voice-related fields changed. Confirmation was reset. Please preview and confirm again.'}
                  </div>
                )}

                {/* 播放器条 */}
                <div 
                  onClick={handleTogglePlay} 
                  className={`flex h-16 items-center gap-4 rounded-lg border px-4 transition
                    ${isRolling ? 'cursor-wait border-slate-300 bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#202020]' : (actChar.ref_audio_path ? 'cursor-pointer border-slate-300 bg-white hover:bg-slate-50 dark:border-[#4a4a4a] dark:bg-[#1f1f1f] dark:hover:bg-[#262626]' : 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]')}
                    ${actChar.is_confirmed ? 'ring-1 ring-emerald-500/60' : ''}`}
                >
                  <div className={`rounded-full p-2 ${isRolling ? 'bg-slate-200 text-slate-600 dark:bg-[#2e2e2e] dark:text-[#bdbdbd]' : (isPlaying ? 'bg-slate-900 text-white dark:bg-[#e5e5e5] dark:text-[#111]' : 'bg-slate-200 text-slate-700 dark:bg-[#2e2e2e] dark:text-[#d6d6d6]')}`}>
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : (isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>)}
                  </div>
                  
                  {/* 波形动画 */}
                  <div className="flex-1 flex items-center justify-center overflow-hidden">
                    {isRolling ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold tracking-[0.16em] text-slate-500 animate-pulse uppercase dark:text-[#a0a0a0]">
                          {isZh ? '语音合成中...' : 'Synthesizing...'}
                        </span>
                        <div className="flex gap-1 mt-1">
                          {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-slate-500 rounded-full animate-bounce dark:bg-[#9a9a9a]" style={{ animationDelay: `${i*0.15}s` }} />)}
                        </div>
                      </div>
                    ) : (
                      actChar.ref_audio_path ? (
                        <canvas
                          ref={waveformCanvasRef}
                          width={680}
                          height={48}
                          className="h-10 w-full max-w-[680px]"
                        />
                      ) : <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-[#777]">{isZh ? '暂无预览音频' : 'No Preview Audio'}</span>
                    )}
                  </div>
                  
                  {/* 🟢 时间显示：修复了被轮询清零的问题 */}
                  <span className="w-24 whitespace-nowrap text-right font-mono text-[11px] font-semibold text-slate-500 dark:text-[#9e9e9e]">
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
                    disabled={refSourceMode !== 'tts' || isRolling || cooldown > 0} 
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition
                    ${(refSourceMode !== 'tts' || isRolling || cooldown > 0)
                      ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500 dark:border-[#4a4a4a] dark:bg-[#202020] dark:text-[#8f8f8f]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#1f1f1f] dark:text-[#e0e0e0] dark:hover:bg-[#2a2a2a]'}`}
                  >
                    {isRolling ? <RefreshCw size={18} className="animate-spin" /> : (cooldown > 0 ? <Hourglass size={18} className="animate-pulse"/> : <Mic size={18} />)} 
                    <span>
                      {isRolling 
                        ? (isZh ? '生成中...' : 'Generating...')
                        : (refSourceMode !== 'tts'
                            ? (isZh ? '切换到“音色设计生成”可用' : 'Switch to Voice Design to enable')
                            : (cooldown > 0 ? (isZh ? `冷却中 (${cooldown}s)` : `Cooldown (${cooldown}s)`) : (isZh ? '生成参考音频' : 'Generate Reference Audio')))
                      }
                    </span>
                  </button>
                  {/* 确认按钮 */}
                  <button
                    onClick={handleConfirmVoice}
                    disabled={isRolling || !actChar.ref_audio_path}
                    className={`flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition ${
                      actChar.is_confirmed
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-slate-900 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#e5e5e5] dark:text-[#111] dark:hover:bg-[#d3d3d3]'
                    }`}
                  >
                    {isZh ? '确认此音色' : 'Confirm Voice'}
                  </button>
                </div>
              </div>
              
              {/* 🟢 修复后的 Audio 标签：自动计算时长并防止轮询覆盖 */}
              <audio 
                ref={audioRef} 
                src={getFullAudioUrl(actChar.ref_audio_path)} 
                crossOrigin="anonymous"
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                  stopWaveformLoop();
                }} 
                onPause={() => {
                  setIsPlaying(false);
                  stopWaveformLoop();
                }}
                onPlay={() => {
                  setIsPlaying(true);
                  startWaveformLoop().catch((err) => {
                    console.error('Waveform start failed:', err);
                  });
                }}
                onLoadedMetadata={(e) => {
                  const d = e.target.duration;
                  if (d && isFinite(d)) {
                    mutate(actID, { duration: d });
                  }
                  drawWaveformFrame();
                }}
                onTimeUpdate={(e) => {
                   setCurrentTime(e.target.currentTime);
                }}
                onError={(e) => {
                  console.error("Audio Load Error:", e.target.error);
                  setIsPlaying(false);
                  stopWaveformLoop();
                }}
                className="hidden" 
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center dark:border-[#3b3b3b]">
               <Shield size={56} className="mb-4 text-slate-400 dark:text-[#777]"/>
               <div className="text-base font-semibold text-slate-600 dark:text-[#9a9a9a]">
                 {chars.length === 0 ? (isZh ? "先创建第一个角色" : 'Create your first character') : t('ph_select')}
               </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
