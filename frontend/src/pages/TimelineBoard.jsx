import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  RefreshCw,
  Search,
  Plus,
  Play,
  Pause,
  Trash2,
  Mic2,
  Music4,
} from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

const asArray = (value) => (Array.isArray(value) ? value : value?.data || []);

const TRACK_HEADER_WIDTH = 152;
const DIALOGUE_TRACK_HEIGHT = 80;
const EFFECT_TRACK_HEIGHT = 112;
const TIMELINE_PADDING_RIGHT = 240;
const MIN_CLIP_DURATION = 0.6;
const PLAYHEAD_STEP = 0.2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const estimateDuration = (text, speed) => {
  const content = (text || '').trim();
  if (!content) return 0.8;
  const safeSpeed = speed && speed > 0 ? speed : 1;
  return Math.max(0.8, content.length / (6.5 * safeSpeed));
};

const formatSeconds = (seconds) => `${Math.max(0, Number(seconds || 0)).toFixed(1)}s`;

const resolveAudioUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('file://')) return path;
  if (path.startsWith('/static/')) return `http://127.0.0.1:8000${path}`;
  if (path.startsWith('/')) return `file://${path}`;
  return `http://127.0.0.1:8000/static/${path}`;
};

const normalizeClip = (clip) => {
  const duration = Math.max(MIN_CLIP_DURATION, Number(clip.duration || MIN_CLIP_DURATION));
  const maxFade = Math.max(0, duration - 0.1);
  let fadeIn = clamp(Number(clip.fadeIn || 0), 0, maxFade);
  let fadeOut = clamp(Number(clip.fadeOut || 0), 0, maxFade);
  if (fadeIn + fadeOut > maxFade) {
    const ratio = maxFade / (fadeIn + fadeOut);
    fadeIn *= ratio;
    fadeOut *= ratio;
  }
  return {
    ...clip,
    start: Math.max(0, Number(clip.start || 0)),
    duration,
    fadeIn,
    fadeOut,
    volume: clamp(Number(clip.volume || 1), 0, 2),
  };
};

const createEffectClip = (asset, start, duration = 4) => {
  const baseDuration = Math.max(MIN_CLIP_DURATION, Number(duration || 4));
  const fade = Math.min(0.8, baseDuration * 0.25);
  return normalizeClip({
    id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    assetId: asset.id,
    name: asset.display_name || 'Effect',
    filePath: asset.file_path,
    start,
    duration: baseDuration,
    fadeIn: fade,
    fadeOut: fade,
    volume: 1,
    postFxPresetId: null,
  });
};

const envelopeGain = (time, duration, fadeIn, fadeOut) => {
  let gain = 1;
  if (fadeIn > 0 && time <= fadeIn) gain = Math.min(gain, time / fadeIn);
  if (fadeOut > 0 && time >= duration - fadeOut) gain = Math.min(gain, (duration - time) / fadeOut);
  return clamp(gain, 0, 1);
};

const createDefaultPostFxConfig = () => ({
  pitch_shift_semitones: 0,
  gain_db: 0,
  highpass_hz: 20,
  lowpass_hz: 20000,
  reverb: {
    enabled: false,
    room_size: 0.35,
    damping: 0.45,
    wet_level: 0.2,
    dry_level: 0.9,
  },
  delay: {
    enabled: false,
    delay_seconds: 0.25,
    feedback: 0.2,
    mix: 0.2,
  },
  modulation: {
    enabled: false,
    mode: 'chorus',
    rate_hz: 1.2,
    depth: 0.25,
    centre_delay_ms: 8,
    feedback: 0.2,
    mix: 0.25,
  },
  compressor: {
    enabled: false,
    threshold_db: -18,
    ratio: 3,
    attack_ms: 5,
    release_ms: 120,
  },
});

const mergePostFxConfig = (base, patch) => {
  if (!patch) return JSON.parse(JSON.stringify(base));
  const next = JSON.parse(JSON.stringify(base));
  Object.entries(patch).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && next[key] && typeof next[key] === 'object') {
      next[key] = mergePostFxConfig(next[key], value);
    } else {
      next[key] = value;
    }
  });
  return next;
};

const findVisibleStartIndex = (clips, visibleStart) => {
  let low = 0;
  let high = clips.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const clipEnd = clips[mid].start + clips[mid].duration;
    if (clipEnd < visibleStart) low = mid + 1;
    else high = mid;
  }
  return low;
};

const hashSeed = (input) => {
  const raw = String(input || 'seed');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const createWaveform = (seed, bars = 38) => {
  const result = [];
  let value = (hashSeed(seed) % 1000) / 1000;
  for (let i = 0; i < bars; i += 1) {
    value = (value * 9301 + 49297) % 233280;
    const normalized = value / 233280;
    const edgeBoost = Math.sin((i / Math.max(1, bars - 1)) * Math.PI);
    result.push(clamp(0.12 + normalized * 0.72 * edgeBoost + 0.12, 0.08, 0.98));
  }
  return result;
};

function WaveformBars({ seed, dense = false, peaks = null }) {
  const bars = useMemo(() => {
    if (Array.isArray(peaks) && peaks.length > 0) return peaks;
    return createWaveform(seed, dense ? 44 : 32);
  }, [seed, dense, peaks]);
  return (
    <div className="mt-1 flex h-7 items-center gap-[2px] overflow-hidden rounded-md bg-white/8 px-1 dark:bg-white/10">
      {bars.map((v, idx) => (
        <span
          key={`${seed}_${idx}`}
          className="w-[2px] rounded-full bg-white/75 dark:bg-[#d8c186]"
          style={{ height: `${Math.max(9, v * 100)}%`, opacity: 0.45 + v * 0.4 }}
        />
      ))}
    </div>
  );
}

export default function TimelineBoard() {
  const { lang } = useLang();
  const isZh = lang === 'zh-CN';
  const { pid } = useParams();
  const nav = useNavigate();

  const storageKey = useMemo(() => `narratis.timeline.${pid}`, [pid]);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const [scriptLines, setScriptLines] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [effects, setEffects] = useState([]);
  const [effectClips, setEffectClips] = useState([]);

  const [effectSearch, setEffectSearch] = useState('');
  const [selectedClip, setSelectedClip] = useState(null); // {type,id}
  const [dragPreview, setDragPreview] = useState(null); // {clipId,start,duration}
  const [postFxReady, setPostFxReady] = useState(true);
  const [postFxPresets, setPostFxPresets] = useState([]);
  const [characterDefaultPresetMap, setCharacterDefaultPresetMap] = useState({});
  const [activePostFxPresetId, setActivePostFxPresetId] = useState('');
  const [activePostFxConfig, setActivePostFxConfig] = useState(createDefaultPostFxConfig());
  const [postFxPreviewLoading, setPostFxPreviewLoading] = useState(false);
  const [postFxApplyLoading, setPostFxApplyLoading] = useState(false);
  const [waveformCache, setWaveformCache] = useState({});

  const [pxPerSec, setPxPerSec] = useState(58);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewPlayingClipId, setPreviewPlayingClipId] = useState('');
  const [viewport, setViewport] = useState({ left: 0, width: 1200 });

  const scrollerRef = useRef(null);
  const dialogueTrackRef = useRef(null);
  const effectTrackRef = useRef(null);
  const dragStateRef = useRef(null);
  const dragRafRef = useRef(null);
  const dragClientXRef = useRef(0);
  const scrollRafRef = useRef(null);
  const playheadTimerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const previewTickerRef = useRef(null);
  const postFxPreviewAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const persistTimerRef = useRef(null);

  const charMap = useMemo(() => {
    const map = new Map();
    characters.forEach((char) => map.set(char.id, char.name));
    return map;
  }, [characters]);

  const dialogueClips = useMemo(() => {
    const ordered = [...scriptLines].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    let cursor = 0;
    return ordered.map((line) => {
      const duration = line.duration ?? estimateDuration(line.text, line.speed || 1);
      const clip = {
        id: line.id,
        lineId: line.id,
        characterId: line.character_id || null,
        start: cursor,
        duration,
        status: line.status || 'pending',
        text: line.text || '',
        speaker: charMap.get(line.character_id) || (isZh ? '未指定角色' : 'No Speaker'),
        audioPath: line.audio_url || line.audio_path || null,
      };
      cursor += duration;
      return clip;
    });
  }, [scriptLines, charMap, isZh]);

  const displayedEffectClips = useMemo(() => {
    if (!dragPreview) return effectClips;
    return effectClips.map((rawClip) =>
      rawClip.id === dragPreview.clipId
        ? normalizeClip({
            ...rawClip,
            start: dragPreview.start,
            duration: dragPreview.duration,
          })
        : rawClip
    );
  }, [effectClips, dragPreview]);

  const selectedEffectClip = useMemo(() => {
    if (selectedClip?.type !== 'effect') return null;
    return displayedEffectClips.find((clip) => clip.id === selectedClip.id) || null;
  }, [selectedClip, displayedEffectClips]);

  const selectedDialogueClip = useMemo(() => {
    if (selectedClip?.type !== 'dialogue') return null;
    return dialogueClips.find((clip) => clip.id === selectedClip.id) || null;
  }, [selectedClip, dialogueClips]);

  const activePostFxPreset = useMemo(
    () => postFxPresets.find((preset) => preset.id === activePostFxPresetId) || null,
    [postFxPresets, activePostFxPresetId]
  );

  const activeSourcePath = useMemo(() => {
    if (selectedEffectClip) return selectedEffectClip.filePath || null;
    if (selectedDialogueClip) return selectedDialogueClip.audioPath || null;
    return null;
  }, [selectedEffectClip, selectedDialogueClip]);

  const filteredEffects = useMemo(() => {
    const q = effectSearch.trim().toLowerCase();
    if (!q) return effects;
    return effects.filter((item) => (item.display_name || '').toLowerCase().includes(q));
  }, [effects, effectSearch]);

  const dialogueEnd = dialogueClips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const effectsEnd = displayedEffectClips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const timelineDuration = Math.max(30, dialogueEnd + 2, effectsEnd + 3);
  const timelineWidth = timelineDuration * pxPerSec + TIMELINE_PADDING_RIGHT;

  const timeTickStep = useMemo(() => {
    if (pxPerSec >= 92) return 1;
    if (pxPerSec >= 66) return 2;
    return 5;
  }, [pxPerSec]);

  const timeTicks = useMemo(() => {
    const ticks = [];
    for (let sec = 0; sec <= timelineDuration + 0.001; sec += timeTickStep) ticks.push(sec);
    return ticks;
  }, [timelineDuration, timeTickStep]);

  const visibleRange = useMemo(() => {
    const leftSec = viewport.left / pxPerSec;
    const rightSec = (viewport.left + viewport.width) / pxPerSec;
    return {
      start: Math.max(0, leftSec - 2.5),
      end: rightSec + 2.5,
    };
  }, [viewport.left, viewport.width, pxPerSec]);

  const visibleDialogueClips = useMemo(() => {
    if (dialogueClips.length === 0) return [];
    const startIdx = findVisibleStartIndex(dialogueClips, visibleRange.start);
    const result = [];
    for (let i = startIdx; i < dialogueClips.length; i += 1) {
      const clip = dialogueClips[i];
      if (clip.start > visibleRange.end) break;
      result.push(clip);
    }
    return result;
  }, [dialogueClips, visibleRange.start, visibleRange.end]);

  const visibleEffectClips = useMemo(
    () =>
      displayedEffectClips.filter(
        (clip) => clip.start + clip.duration >= visibleRange.start && clip.start <= visibleRange.end
      ),
    [displayedEffectClips, visibleRange.start, visibleRange.end]
  );

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const candidates = new Set();
    visibleEffectClips.forEach((clip) => {
      if (clip.filePath) candidates.add(clip.filePath);
    });
    visibleDialogueClips.forEach((clip) => {
      if (clip.audioPath) candidates.add(clip.audioPath);
    });
    const pendingPaths = Array.from(candidates).filter((p) => !(p in waveformCache));
    if (pendingPaths.length === 0) return;

    let cancelled = false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    const decodeOne = async (sourcePath) => {
      const resolved = resolveAudioUrl(sourcePath);
      if (!resolved || resolved.startsWith('file://')) return null;
      const response = await fetch(resolved);
      const audioData = await response.arrayBuffer();
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      const buffer = await audioContextRef.current.decodeAudioData(audioData.slice(0));
      const channel = buffer.getChannelData(0);
      const bucketCount = 46;
      const chunk = Math.max(1, Math.floor(channel.length / bucketCount));
      const peaks = [];
      for (let i = 0; i < bucketCount; i += 1) {
        const start = i * chunk;
        const end = Math.min(channel.length, start + chunk);
        let peak = 0;
        for (let j = start; j < end; j += 1) {
          const v = Math.abs(channel[j]);
          if (v > peak) peak = v;
        }
        peaks.push(clamp(peak, 0.03, 1));
      }
      return peaks;
    };

    const run = async () => {
      for (const sourcePath of pendingPaths) {
        try {
          const peaks = await decodeOne(sourcePath);
          if (cancelled) return;
          setWaveformCache((prev) => (sourcePath in prev ? prev : { ...prev, [sourcePath]: peaks }));
        } catch {
          if (cancelled) return;
          setWaveformCache((prev) => (sourcePath in prev ? prev : { ...prev, [sourcePath]: null }));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [visibleEffectClips, visibleDialogueClips, waveformCache]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [scriptRes, charRes, effectRes, presetsRes, defaultsRes] = await Promise.all([
          API.getScript(pid),
          API.getCharacters(pid),
          API.getEffects(pid),
          API.listPostFxPresets().catch((e) => e),
          API.getCharacterDefaultPostFx(pid).catch((e) => e),
        ]);
        setScriptLines(asArray(scriptRes));
        setCharacters(asArray(charRes));
        setEffects(asArray(effectRes));
        setCharacterDefaultPresetMap({});

        if (presetsRes instanceof Error) {
          setPostFxReady(false);
          setNotice(isZh ? '后期效果模块不可用，请先安装 pedalboard 依赖。' : 'PostFX unavailable. Install pedalboard dependencies.');
          setPostFxPresets([]);
          setActivePostFxPresetId('');
          setActivePostFxConfig(createDefaultPostFxConfig());
        } else {
          setPostFxReady(true);
          const presets = asArray(presetsRes);
          setPostFxPresets(presets);
          const firstPresetId = presets[0]?.id || '';
          setActivePostFxPresetId(firstPresetId);
          setActivePostFxConfig(
            mergePostFxConfig(createDefaultPostFxConfig(), presets[0]?.config || {})
          );
        }

        if (!(defaultsRes instanceof Error)) {
          const map = {};
          asArray(defaultsRes).forEach((item) => {
            if (item.character_id && item.preset_id) {
              map[item.character_id] = item.preset_id;
            }
          });
          setCharacterDefaultPresetMap(map);
        }
      } catch (error) {
        console.error('Load timeline data failed:', error);
        setNotice(isZh ? '剪辑台数据加载失败。' : 'Failed to load timeline data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pid, isZh]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const clips = Array.isArray(parsed.effects) ? parsed.effects.map(normalizeClip) : [];
      setEffectClips(clips);
      if (typeof parsed.zoom === 'number') setPxPerSec(clamp(parsed.zoom, 36, 130));
    } catch (error) {
      console.error('Parse timeline cache failed:', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          effects: effectClips,
          zoom: pxPerSec,
        })
      );
    }, 300);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [effectClips, pxPerSec, storageKey]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const syncViewport = () => {
      setViewport((prev) => {
        const next = {
          left: scroller.scrollLeft,
          width: scroller.clientWidth,
        };
        if (prev.left === next.left && prev.width === next.width) return prev;
        return next;
      });
    };

    const onScroll = () => {
      if (scrollRafRef.current != null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncViewport();
      });
    };

    syncViewport();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncViewport);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncViewport);
      if (scrollRafRef.current != null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!postFxReady || postFxPresets.length === 0) return;
    if (selectedEffectClip?.postFxPresetId) {
      const preset = postFxPresets.find((p) => p.id === selectedEffectClip.postFxPresetId);
      if (preset) {
        setActivePostFxPresetId(preset.id);
        setActivePostFxConfig(mergePostFxConfig(createDefaultPostFxConfig(), preset.config));
      }
      return;
    }
    if (selectedDialogueClip?.characterId) {
      const presetId = characterDefaultPresetMap[selectedDialogueClip.characterId];
      if (presetId) {
        const preset = postFxPresets.find((p) => p.id === presetId);
        if (preset) {
          setActivePostFxPresetId(preset.id);
          setActivePostFxConfig(mergePostFxConfig(createDefaultPostFxConfig(), preset.config));
          return;
        }
      }
    }
  }, [
    postFxReady,
    postFxPresets,
    selectedEffectClip?.id,
    selectedEffectClip?.postFxPresetId,
    selectedDialogueClip?.id,
    selectedDialogueClip?.characterId,
    characterDefaultPresetMap,
  ]);

  useEffect(() => {
    const stopPreview = () => {
      if (previewTickerRef.current) {
        clearInterval(previewTickerRef.current);
        previewTickerRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.onended = null;
        previewAudioRef.current.pause();
      }
      if (postFxPreviewAudioRef.current) {
        postFxPreviewAudioRef.current.onended = null;
        postFxPreviewAudioRef.current.pause();
      }
      setPreviewPlayingClipId('');
    };

    const computePatch = (drag, deltaSec) => {
      if (!drag) return null;
      if (drag.mode === 'move') {
        return { start: Math.max(0, drag.originStart + deltaSec), duration: drag.originDuration };
      }
      if (drag.mode === 'resize-start') {
        const maxStart = drag.originStart + drag.originDuration - MIN_CLIP_DURATION;
        const nextStart = clamp(drag.originStart + deltaSec, 0, maxStart);
        const nextDuration = Math.max(MIN_CLIP_DURATION, drag.originDuration - (nextStart - drag.originStart));
        return { start: nextStart, duration: nextDuration };
      }
      if (drag.mode === 'resize-end') {
        const nextDuration = Math.max(MIN_CLIP_DURATION, drag.originDuration + deltaSec);
        return { start: drag.originStart, duration: nextDuration };
      }
      return null;
    };

    const flushDragPreview = () => {
      const drag = dragStateRef.current;
      if (!drag) return;
      dragRafRef.current = null;
      const deltaSec = (dragClientXRef.current - drag.startClientX) / pxPerSec;
      const patch = computePatch(drag, deltaSec);
      if (!patch) return;
      setDragPreview({
        clipId: drag.clipId,
        start: patch.start,
        duration: patch.duration,
      });
    };

    const onMove = (event) => {
      if (!dragStateRef.current) return;
      dragClientXRef.current = event.clientX;
      if (dragRafRef.current == null) {
        dragRafRef.current = window.requestAnimationFrame(flushDragPreview);
      }
    };

    const onUp = () => {
      const drag = dragStateRef.current;
      if (drag) {
        const deltaSec = (dragClientXRef.current - drag.startClientX) / pxPerSec;
        const patch = computePatch(drag, deltaSec);
        if (patch) {
          setEffectClips((prev) =>
            prev.map((rawClip) =>
              rawClip.id === drag.clipId
                ? normalizeClip({
                    ...rawClip,
                    start: patch.start,
                    duration: patch.duration,
                  })
                : rawClip
            )
          );
        }
      }
      setDragPreview(null);
      dragStateRef.current = null;
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    if (dragStateRef.current) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setDragPreview(null);
      stopPreview();
    };
  }, [pxPerSec]);

  useEffect(() => {
    if (!isPlaying) {
      if (playheadTimerRef.current) {
        clearInterval(playheadTimerRef.current);
        playheadTimerRef.current = null;
      }
      return undefined;
    }
    playheadTimerRef.current = setInterval(() => {
      setPlayhead((prev) => {
        const next = prev + PLAYHEAD_STEP;
        if (next >= timelineDuration) {
          setIsPlaying(false);
          return timelineDuration;
        }
        return next;
      });
    }, PLAYHEAD_STEP * 1000);
    return () => {
      if (playheadTimerRef.current) {
        clearInterval(playheadTimerRef.current);
        playheadTimerRef.current = null;
      }
    };
  }, [isPlaying, timelineDuration]);

  const refreshDialogueTrack = async () => {
    try {
      const scriptRes = await API.getScript(pid);
      setScriptLines(asArray(scriptRes));
      setNotice(isZh ? '已同步对白轨。' : 'Dialogue synced.');
    } catch (error) {
      console.error('Sync dialogue failed:', error);
      setNotice(isZh ? '同步失败。' : 'Sync failed.');
    }
  };

  const setPlayheadByEvent = (event, trackRef) => {
    if (!trackRef.current || !scrollerRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = scrollerRef.current.scrollLeft + event.clientX - rect.left;
    setPlayhead(clamp(x / pxPerSec, 0, timelineDuration));
  };

  const addEffectAtPlayhead = (asset) => {
    const clip = createEffectClip(asset, playhead, Math.min(8, Math.max(2, asset.duration || 4)));
    setEffectClips((prev) => [...prev, clip]);
    setSelectedClip({ type: 'effect', id: clip.id });
  };

  const handleDropToEffectTrack = (event) => {
    event.preventDefault();
    const assetId = event.dataTransfer.getData('text/plain');
    if (!assetId) return;
    const asset = effects.find((item) => item.id === assetId);
    if (!asset || !effectTrackRef.current || !scrollerRef.current) return;
    const rect = effectTrackRef.current.getBoundingClientRect();
    const x = scrollerRef.current.scrollLeft + event.clientX - rect.left;
    const clip = createEffectClip(asset, Math.max(0, x / pxPerSec), Math.min(8, Math.max(2, asset.duration || 4)));
    setEffectClips((prev) => [...prev, clip]);
    setSelectedClip({ type: 'effect', id: clip.id });
  };

  const updateSelectedEffect = (patch) => {
    if (!selectedEffectClip) return;
    setEffectClips((prev) =>
      prev.map((clip) => (clip.id === selectedEffectClip.id ? normalizeClip({ ...clip, ...patch }) : clip))
    );
  };

  const removeSelectedEffect = () => {
    if (!selectedEffectClip) return;
    setEffectClips((prev) => prev.filter((clip) => clip.id !== selectedEffectClip.id));
    setSelectedClip(null);
  };

  const clearEffectTrack = () => {
    setEffectClips([]);
    setSelectedClip(null);
  };

  const handleChangePostFxPreset = (presetId) => {
    setActivePostFxPresetId(presetId);
    const preset = postFxPresets.find((p) => p.id === presetId);
    if (!preset) {
      setActivePostFxConfig(createDefaultPostFxConfig());
      return;
    }
    setActivePostFxConfig(mergePostFxConfig(createDefaultPostFxConfig(), preset.config));
  };

  const patchPostFxConfig = (path, value) => {
    setActivePostFxConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i += 1) {
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handlePreviewPostFx = async () => {
    if (!activeSourcePath) {
      setNotice(isZh ? '当前片段没有可预览音频。' : 'Selected clip has no audio source.');
      return;
    }
    setPostFxPreviewLoading(true);
    try {
      const resp = await API.previewPostFx({
        source_path: activeSourcePath,
        preset_id: activePostFxPresetId || null,
        config_override: activePostFxConfig,
      });
      const url = resolveAudioUrl(resp.output_url || resp.output_path);
      if (!url) throw new Error('Invalid preview audio path');

      if (!postFxPreviewAudioRef.current) postFxPreviewAudioRef.current = new Audio();
      const audio = postFxPreviewAudioRef.current;
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
      setNotice(isZh ? '后期效果预览中...' : 'PostFX preview playing...');
    } catch (error) {
      console.error('Preview postfx failed:', error);
      setNotice(isZh ? '后期效果预览失败。' : 'PostFX preview failed.');
    } finally {
      setPostFxPreviewLoading(false);
    }
  };

  const handleApplyPostFx = async () => {
    if (!activeSourcePath) {
      setNotice(isZh ? '当前片段没有可应用音频。' : 'Selected clip has no audio source.');
      return;
    }
    setPostFxApplyLoading(true);
    try {
      const resp = await API.applyPostFx({
        source_path: activeSourcePath,
        project_id: pid,
        preset_id: activePostFxPresetId || null,
        config_override: activePostFxConfig,
      });
      const outputUrl = resp.output_url || '';
      if (selectedEffectClip) {
        setEffectClips((prev) =>
          prev.map((clip) =>
            clip.id === selectedEffectClip.id
              ? { ...clip, filePath: outputUrl || clip.filePath, postFxPresetId: activePostFxPresetId || null }
              : clip
          )
        );
      }
      if (selectedDialogueClip && outputUrl) {
        await API.updateLine(selectedDialogueClip.id, { audio_path: outputUrl });
        setScriptLines((prev) =>
          prev.map((line) =>
            line.id === selectedDialogueClip.id
              ? { ...line, audio_path: outputUrl, audio_url: outputUrl, status: 'synthesized' }
              : line
          )
        );
      }
      setNotice(isZh ? '后期效果已应用。' : 'PostFX applied.');
    } catch (error) {
      console.error('Apply postfx failed:', error);
      setNotice(isZh ? '后期效果应用失败。' : 'PostFX apply failed.');
    } finally {
      setPostFxApplyLoading(false);
    }
  };

  const handleCreateCustomPreset = async () => {
    const name = window.prompt(isZh ? '输入新预设名称' : 'Preset name');
    if (!name || !name.trim()) return;
    try {
      const created = await API.createPostFxPreset({
        name: name.trim(),
        config: activePostFxConfig,
      });
      const row = created?.data || created;
      if (!row?.id) return;
      const next = [...postFxPresets, row];
      setPostFxPresets(next);
      setActivePostFxPresetId(row.id);
      setNotice(isZh ? '自定义预设已创建。' : 'Custom preset created.');
    } catch (error) {
      console.error('Create postfx preset failed:', error);
      setNotice(isZh ? '创建预设失败。' : 'Create preset failed.');
    }
  };

  const handleUpdateCustomPreset = async () => {
    if (!activePostFxPreset || activePostFxPreset.is_builtin) {
      setNotice(isZh ? '请选择一个自定义预设再更新。' : 'Select a custom preset first.');
      return;
    }
    try {
      const updated = await API.updatePostFxPreset(activePostFxPreset.id, {
        config: activePostFxConfig,
      });
      const row = updated?.data || updated;
      setPostFxPresets((prev) => prev.map((item) => (item.id === row.id ? row : item)));
      setNotice(isZh ? '预设已更新。' : 'Preset updated.');
    } catch (error) {
      console.error('Update postfx preset failed:', error);
      setNotice(isZh ? '更新预设失败。' : 'Update preset failed.');
    }
  };

  const handleDeleteCustomPreset = async () => {
    if (!activePostFxPreset || activePostFxPreset.is_builtin) return;
    if (!window.confirm(isZh ? '确定删除当前自定义预设？' : 'Delete current custom preset?')) return;
    try {
      await API.deletePostFxPreset(activePostFxPreset.id);
      const next = postFxPresets.filter((item) => item.id !== activePostFxPreset.id);
      setPostFxPresets(next);
      const fallbackId = next[0]?.id || '';
      setActivePostFxPresetId(fallbackId);
      const fallback = next.find((item) => item.id === fallbackId);
      setActivePostFxConfig(
        mergePostFxConfig(createDefaultPostFxConfig(), fallback?.config || {})
      );
      setNotice(isZh ? '预设已删除。' : 'Preset deleted.');
    } catch (error) {
      console.error('Delete postfx preset failed:', error);
      setNotice(isZh ? '删除预设失败。' : 'Delete preset failed.');
    }
  };

  const handleAssignPresetToCharacter = async () => {
    if (!selectedDialogueClip?.characterId) {
      setNotice(isZh ? '当前对白未绑定角色。' : 'Dialogue clip has no character.');
      return;
    }
    try {
      const presetId = activePostFxPresetId || null;
      await API.setCharacterDefaultPostFx(selectedDialogueClip.characterId, presetId);
      setCharacterDefaultPresetMap((prev) => {
        const next = { ...prev };
        if (!presetId) delete next[selectedDialogueClip.characterId];
        else next[selectedDialogueClip.characterId] = presetId;
        return next;
      });
      setNotice(isZh ? '已设置为角色默认预设。' : 'Assigned as character default preset.');
    } catch (error) {
      console.error('Assign character default preset failed:', error);
      setNotice(isZh ? '设置角色默认预设失败。' : 'Failed to assign character default preset.');
    }
  };

  const togglePreviewSelectedEffect = () => {
    if (!selectedEffectClip) return;
    const url = resolveAudioUrl(selectedEffectClip.filePath);
    if (!url) {
      setNotice(isZh ? '该素材无法试听。' : 'Cannot preview this asset.');
      return;
    }

    if (!previewAudioRef.current) previewAudioRef.current = new Audio();
    const audio = previewAudioRef.current;
    const baseVolume = clamp(selectedEffectClip.volume, 0, 2) / 2;
    const duration = selectedEffectClip.duration;

    if (previewPlayingClipId === selectedEffectClip.id && !audio.paused) {
      audio.pause();
      if (previewTickerRef.current) clearInterval(previewTickerRef.current);
      previewTickerRef.current = null;
      setPreviewPlayingClipId('');
      return;
    }

    if (previewTickerRef.current) clearInterval(previewTickerRef.current);
    previewTickerRef.current = null;
    audio.src = url;
    audio.currentTime = 0;
    audio.volume = 0;

    const tick = () => {
      const t = audio.currentTime;
      const gain = envelopeGain(t, duration, selectedEffectClip.fadeIn, selectedEffectClip.fadeOut);
      audio.volume = clamp(baseVolume * gain, 0, 1);
      if (t >= duration) {
        audio.pause();
        audio.currentTime = 0;
        if (previewTickerRef.current) clearInterval(previewTickerRef.current);
        previewTickerRef.current = null;
        setPreviewPlayingClipId('');
      }
    };

    audio
      .play()
      .then(() => {
        setPreviewPlayingClipId(selectedEffectClip.id);
        previewTickerRef.current = setInterval(tick, 50);
      })
      .catch((error) => {
        console.error('Preview failed:', error);
        setNotice(isZh ? '试听失败。' : 'Preview failed.');
        setPreviewPlayingClipId('');
      });

    audio.onended = () => {
      if (previewTickerRef.current) clearInterval(previewTickerRef.current);
      previewTickerRef.current = null;
      setPreviewPlayingClipId('');
    };
  };

  const renderDialogueClips = () =>
    visibleDialogueClips.map((clip) => {
      const left = clip.start * pxPerSec;
      const width = Math.max(58, clip.duration * pxPerSec);
      const selected = selectedClip?.type === 'dialogue' && selectedClip.id === clip.id;
      const tone =
        clip.status === 'synthesized'
          ? 'bg-[#b39b60] text-[#1d1b14] dark:bg-[#ab9557] dark:text-[#1a1711]'
          : clip.status === 'processing'
            ? 'bg-[#47617f] text-white dark:bg-[#5d7b9e] dark:text-white'
            : 'bg-[#303a4a] text-[#f2f4f8] dark:bg-[#2e3744] dark:text-[#f2f4f8]';
      return (
        <button
          key={clip.id}
          onClick={() => setSelectedClip({ type: 'dialogue', id: clip.id })}
          className={`absolute top-2 h-[64px] overflow-hidden rounded-lg border border-transparent px-2 py-1 text-left transition ${tone} ${selected ? 'ring-2 ring-[#f2e2aa]' : ''}`}
          style={{ left, width }}
          title={clip.text}
        >
          <div className="truncate text-[10px] font-semibold opacity-90">{clip.speaker}</div>
          <WaveformBars seed={clip.id} peaks={clip.audioPath ? waveformCache[clip.audioPath] : null} />
        </button>
      );
    });

  const renderEffectClips = () =>
    visibleEffectClips.map((rawClip) => {
      const clip = normalizeClip(rawClip);
      const left = clip.start * pxPerSec;
      const width = Math.max(62, clip.duration * pxPerSec);
      const selected = selectedClip?.type === 'effect' && selectedClip.id === clip.id;
      const fadeInPct = clip.duration > 0 ? (clip.fadeIn / clip.duration) * 100 : 0;
      const fadeOutPct = clip.duration > 0 ? (clip.fadeOut / clip.duration) * 100 : 0;

      return (
        <div
          key={clip.id}
          className={`absolute top-2 h-[94px] rounded-lg border transition ${
            selected
              ? 'border-cyan-400 bg-cyan-100 text-cyan-900 ring-2 ring-cyan-300 dark:border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-400/40'
              : 'border-slate-300 bg-white text-slate-800 dark:border-[#4a4a4a] dark:bg-[#171717] dark:text-[#e0e0e0]'
          }`}
          style={{ left, width }}
        >
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              setSelectedClip({ type: 'effect', id: clip.id });
              dragStateRef.current = {
                mode: 'move',
                clipId: clip.id,
                startClientX: event.clientX,
                originStart: clip.start,
                originDuration: clip.duration,
              };
              dragClientXRef.current = event.clientX;
            }}
            onClick={() => setSelectedClip({ type: 'effect', id: clip.id })}
            className="relative h-full w-full rounded-lg px-2 py-1 text-left"
            title={clip.name}
          >
            <div className="truncate text-[11px] font-semibold">{clip.name}</div>
            <div className="mt-0.5 text-[10px] opacity-75">
              {formatSeconds(clip.duration)} · IN {clip.fadeIn.toFixed(1)} / OUT {clip.fadeOut.toFixed(1)}
            </div>
            <WaveformBars seed={clip.id} dense peaks={clip.filePath ? waveformCache[clip.filePath] : null} />
            {clip.fadeIn > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/10 to-transparent dark:from-white/14"
                style={{ width: `${fadeInPct}%` }}
              />
            )}
            {clip.fadeOut > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/10 to-transparent dark:from-white/14"
                style={{ width: `${fadeOutPct}%` }}
              />
            )}
          </button>

          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              setSelectedClip({ type: 'effect', id: clip.id });
              dragStateRef.current = {
                mode: 'resize-start',
                clipId: clip.id,
                startClientX: event.clientX,
                originStart: clip.start,
                originDuration: clip.duration,
              };
              dragClientXRef.current = event.clientX;
            }}
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-lg bg-transparent hover:bg-black/10 dark:hover:bg-white/10"
          />
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              setSelectedClip({ type: 'effect', id: clip.id });
              dragStateRef.current = {
                mode: 'resize-end',
                clipId: clip.id,
                startClientX: event.clientX,
                originStart: clip.start,
                originDuration: clip.duration,
              };
              dragClientXRef.current = event.clientX;
            }}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-lg bg-transparent hover:bg-black/10 dark:hover:bg-white/10"
          />
        </div>
      );
    });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#eef2f7] text-slate-700 dark:bg-[#050505] dark:text-[#d8d8d8]">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-[#2f2f2f] dark:bg-[#121212]">
          <Loader2 size={16} className="animate-spin" />
          {isZh ? '加载剪辑台...' : 'Loading Timeline...'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-[#eef2f7] text-slate-700 dark:bg-[#050505] dark:text-[#d8d8d8]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif' }}
    >
      {!!notice && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-[#6b562e] dark:bg-[#2b2314] dark:text-[#efd29c]">
          {notice}
        </div>
      )}

      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-[#202020] dark:bg-[#090909]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(`/project/${pid}/studio`)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-[#dddddd] dark:hover:bg-[#1f1f1f]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-900 dark:text-[#f0f0f0]">
                {isZh ? '剪辑台' : 'Timeline'}
              </h1>
              <div className="text-xs text-slate-500 dark:text-[#a2a2a2]">
                {isZh ? '对白轨自动同步 + 环境音轨可编辑' : 'Auto dialogue track + editable effects'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshDialogueTrack}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-[#e2e2e2] dark:hover:bg-[#1f1f1f]"
            >
              <RefreshCw size={14} />
              {isZh ? '同步对白轨' : 'Sync'}
            </button>
            <button
              onClick={() => setIsPlaying((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-[#f2f2f2] dark:text-[#111111]"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? (isZh ? '暂停' : 'Pause') : (isZh ? '播放游标' : 'Playhead')}
            </button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-2 dark:border-[#202020] dark:bg-[#090909]">
        <div className="flex items-center gap-7 text-xs font-semibold text-slate-500 dark:text-[#a2a2a2]">
          <span>{isZh ? `总时长 ${formatSeconds(timelineDuration)}` : `Duration ${formatSeconds(timelineDuration)}`}</span>
          <div className="flex min-w-[210px] items-center gap-2">
            <span>{isZh ? '缩放' : 'Zoom'}</span>
            <input
              type="range"
              min={36}
              max={130}
              step={2}
              value={pxPerSec}
              onChange={(event) => setPxPerSec(Number(event.target.value))}
              className="w-full accent-slate-700"
            />
          </div>
          <div className="flex min-w-[300px] items-center gap-2">
            <span>{isZh ? '游标' : 'Playhead'} {formatSeconds(playhead)}</span>
            <input
              type="range"
              min={0}
              max={timelineDuration}
              step={0.1}
              value={playhead}
              onChange={(event) => setPlayhead(Number(event.target.value))}
              className="w-full accent-slate-700"
            />
          </div>
        </div>
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_360px] gap-5 px-6 py-5">
        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] custom-scrollbar dark:border-[#222222] dark:bg-[#0a0a0a] dark:shadow-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">
            {isZh ? '环境音素材' : 'Effects'}
          </h2>
          <div className="mt-1 text-xs text-slate-500 dark:text-[#a0a0a0]">
            {isZh ? '拖拽到轨道，或“加到游标”' : 'Drag to track or add at playhead'}
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={effectSearch}
              onChange={(event) => setEffectSearch(event.target.value)}
              placeholder={isZh ? '搜索环境音...' : 'Search effects...'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs outline-none focus:border-slate-400 dark:border-[#343434] dark:bg-[#171717] dark:text-[#e5e5e5]"
            />
          </div>

          <div className="mt-3 space-y-2">
            {filteredEffects.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', asset.id)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-[#363636] dark:bg-[#171717]"
              >
                <div className="truncate text-xs font-semibold text-slate-800 dark:text-[#f0f0f0]">{asset.display_name}</div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-[#a1a1a1]">{formatSeconds(asset.duration || 0)}</div>
                <button
                  onClick={() => addEffectAtPlayhead(asset)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#1d1d1d] dark:text-[#dddddd]"
                >
                  <Plus size={11} />
                  {isZh ? '加到游标' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)] dark:border-[#222222] dark:bg-[#0a0a0a] dark:shadow-none">
          <div ref={scrollerRef} className="h-full overflow-auto custom-scrollbar">
            <div style={{ width: TRACK_HEADER_WIDTH + timelineWidth }}>
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-[#232323] dark:bg-[#0a0a0a]/95">
                <div className="flex h-9">
                  <div
                    className="shrink-0 border-r border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:border-[#232323] dark:text-[#a2a2a2]"
                    style={{ width: TRACK_HEADER_WIDTH }}
                  >
                    {isZh ? '时间标尺' : 'Ruler'}
                  </div>
                  <div className="relative" style={{ width: timelineWidth }}>
                    {timeTicks.map((sec) => (
                      <div key={sec} className="absolute top-0 h-full" style={{ left: sec * pxPerSec }}>
                        <div className="h-2 w-px bg-slate-300 dark:bg-[#3e3e3e]" />
                        <span className="ml-1 text-[10px] font-semibold text-slate-500 dark:text-[#9f9f9f]">{sec}s</span>
                      </div>
                    ))}
                    <div className="pointer-events-none absolute top-0 h-full w-[2px] bg-rose-500/85" style={{ left: playhead * pxPerSec }} />
                  </div>
                </div>
              </div>

              <div className="flex border-b border-slate-200 dark:border-[#232323]">
                <div
                  className="shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#232323] dark:bg-[#101010]"
                  style={{ width: TRACK_HEADER_WIDTH, height: DIALOGUE_TRACK_HEIGHT }}
                >
                  <div className="text-sm font-semibold text-slate-800 dark:text-[#f0f0f0]">{isZh ? '对白轨' : 'Dialogue'}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-[#a0a0a0]">{dialogueClips.length} clips</div>
                </div>
                <div
                  ref={dialogueTrackRef}
                  onClick={(event) => setPlayheadByEvent(event, dialogueTrackRef)}
                  className="relative cursor-pointer bg-slate-50 dark:bg-[#0f0f0f]"
                  style={{ width: timelineWidth, height: DIALOGUE_TRACK_HEIGHT }}
                >
                  {renderDialogueClips()}
                  <div className="pointer-events-none absolute top-0 h-full w-[2px] bg-rose-500/85" style={{ left: playhead * pxPerSec }} />
                </div>
              </div>

              <div className="flex">
                <div
                  className="shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#232323] dark:bg-[#101010]"
                  style={{ width: TRACK_HEADER_WIDTH, height: EFFECT_TRACK_HEIGHT }}
                >
                  <div className="text-sm font-semibold text-slate-800 dark:text-[#f0f0f0]">{isZh ? '环境音轨' : 'Effects'}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-[#a0a0a0]">{effectClips.length} clips</div>
                  <button
                    onClick={clearEffectTrack}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-[#dddddd]"
                  >
                    <Trash2 size={11} />
                    {isZh ? '清空' : 'Clear'}
                  </button>
                </div>
                <div
                  ref={effectTrackRef}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDropToEffectTrack}
                  onClick={(event) => setPlayheadByEvent(event, effectTrackRef)}
                  className="relative cursor-copy bg-white dark:bg-[#0b0b0b]"
                  style={{ width: timelineWidth, height: EFFECT_TRACK_HEIGHT }}
                >
                  {renderEffectClips()}
                  <div className="pointer-events-none absolute top-0 h-full w-[2px] bg-rose-500/85" style={{ left: playhead * pxPerSec }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] custom-scrollbar dark:border-[#222222] dark:bg-[#0a0a0a] dark:shadow-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">{isZh ? '检查器' : 'Inspector'}</h2>
          {!selectedClip && (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-[#3b3b3b] dark:text-[#9f9f9f]">
              {isZh ? '选择片段后可编辑参数。' : 'Select a clip to edit.'}
            </div>
          )}

          {selectedDialogueClip && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#353535] dark:bg-[#141414]">
              <div className="font-semibold text-slate-900 dark:text-[#f0f0f0]">
                <Mic2 size={13} className="mr-1 inline" />
                {isZh ? '对白片段' : 'Dialogue'}
              </div>
              <div className="mt-2 space-y-1 text-slate-600 dark:text-[#bcbcbc]">
                <div>{isZh ? '角色' : 'Speaker'}: {selectedDialogueClip.speaker}</div>
                <div>{isZh ? '起始' : 'Start'}: {formatSeconds(selectedDialogueClip.start)}</div>
                <div>{isZh ? '时长' : 'Duration'}: {formatSeconds(selectedDialogueClip.duration)}</div>
              </div>
              <p className="mt-2 line-clamp-5 leading-5 text-slate-700 dark:text-[#dedede]">
                {selectedDialogueClip.text || (isZh ? '空白台词' : 'Empty line')}
              </p>
            </div>
          )}

          {selectedEffectClip && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#353535] dark:bg-[#141414]">
              <div className="font-semibold text-slate-900 dark:text-[#f0f0f0]">
                <Music4 size={13} className="mr-1 inline" />
                {selectedEffectClip.name}
              </div>

              <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                {isZh ? '起始时间 (s)' : 'Start (s)'}
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedEffectClip.start.toFixed(1)}
                onChange={(event) => updateSelectedEffect({ start: Math.max(0, Number(event.target.value || 0)) })}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-[#3d3d3d] dark:bg-[#111111] dark:text-[#e5e5e5]"
              />

              <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                {isZh ? '片段时长 (s)' : 'Duration (s)'}
              </label>
              <input
                type="number"
                min={MIN_CLIP_DURATION}
                step={0.1}
                value={selectedEffectClip.duration.toFixed(1)}
                onChange={(event) => updateSelectedEffect({ duration: Math.max(MIN_CLIP_DURATION, Number(event.target.value || MIN_CLIP_DURATION)) })}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-[#3d3d3d] dark:bg-[#111111] dark:text-[#e5e5e5]"
              />

              <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                {isZh ? '淡入 (s)' : 'Fade In (s)'}: {selectedEffectClip.fadeIn.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(0, selectedEffectClip.duration - selectedEffectClip.fadeOut - 0.1)}
                step={0.1}
                value={selectedEffectClip.fadeIn}
                onChange={(event) => updateSelectedEffect({ fadeIn: Number(event.target.value) })}
                className="mt-1 w-full accent-slate-700"
              />

              <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                {isZh ? '淡出 (s)' : 'Fade Out (s)'}: {selectedEffectClip.fadeOut.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(0, selectedEffectClip.duration - selectedEffectClip.fadeIn - 0.1)}
                step={0.1}
                value={selectedEffectClip.fadeOut}
                onChange={(event) => updateSelectedEffect({ fadeOut: Number(event.target.value) })}
                className="mt-1 w-full accent-slate-700"
              />

              <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                {isZh ? '音量' : 'Volume'}: {selectedEffectClip.volume.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={selectedEffectClip.volume}
                onChange={(event) => updateSelectedEffect({ volume: Number(event.target.value) })}
                className="mt-1 w-full accent-slate-700"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={togglePreviewSelectedEffect}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                >
                  {previewPlayingClipId === selectedEffectClip.id ? <Pause size={12} className="mr-1 inline" /> : <Play size={12} className="mr-1 inline" />}
                  {previewPlayingClipId === selectedEffectClip.id ? (isZh ? '暂停试听' : 'Pause') : (isZh ? '试听' : 'Preview')}
                </button>
                <button
                  onClick={removeSelectedEffect}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <Trash2 size={12} className="mr-1 inline" />
                  {isZh ? '删除片段' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#353535] dark:bg-[#141414]">
            <div className="font-semibold text-slate-900 dark:text-[#f0f0f0]">
              {isZh ? '后期处理效果（Pedalboard）' : 'PostFX (Pedalboard)'}
            </div>
            {!postFxReady ? (
              <p className="mt-2 text-slate-500 dark:text-[#9e9e9e]">
                {isZh ? '后端未安装 pedalboard，请在 backend 目录执行 uv sync。' : 'Pedalboard is not installed in backend. Run uv sync.'}
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <label className="block text-slate-500 dark:text-[#a3a3a3]">
                    {isZh ? '预设' : 'Preset'}
                  </label>
                  <select
                    value={activePostFxPresetId}
                    onChange={(event) => handleChangePostFxPreset(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-[#3d3d3d] dark:bg-[#111111] dark:text-[#e5e5e5]"
                  >
                    {postFxPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}{preset.is_builtin ? (isZh ? '（内置）' : ' (Builtin)') : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    onClick={handleCreateCustomPreset}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                  >
                    {isZh ? '另存预设' : 'Save As'}
                  </button>
                  <button
                    onClick={handleUpdateCustomPreset}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                  >
                    {isZh ? '更新预设' : 'Update'}
                  </button>
                  <button
                    onClick={handleDeleteCustomPreset}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                  >
                    {isZh ? '删除预设' : 'Delete'}
                  </button>
                </div>

                <label className="mt-3 block text-slate-500 dark:text-[#a3a3a3]">
                  {isZh ? '变调 (±12 半音)' : 'Pitch Shift (±12 semitones)'}: {Number(activePostFxConfig.pitch_shift_semitones || 0).toFixed(1)}
                </label>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={activePostFxConfig.pitch_shift_semitones || 0}
                  onChange={(event) => patchPostFxConfig('pitch_shift_semitones', Number(event.target.value))}
                  className="mt-1 w-full accent-slate-700"
                />

                <label className="mt-2 block text-slate-500 dark:text-[#a3a3a3]">
                  {isZh ? '增益 (-40~+40 dB)' : 'Gain (-40~+40 dB)'}: {Number(activePostFxConfig.gain_db || 0).toFixed(1)}
                </label>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={0.5}
                  value={activePostFxConfig.gain_db || 0}
                  onChange={(event) => patchPostFxConfig('gain_db', Number(event.target.value))}
                  className="mt-1 w-full accent-slate-700"
                />

                <label className="mt-2 block text-slate-500 dark:text-[#a3a3a3]">
                  {isZh ? '高通滤波器' : 'High-pass Filter'}: {Math.round(activePostFxConfig.highpass_hz || 20)}Hz
                </label>
                <input
                  type="range"
                  min={20}
                  max={2000}
                  step={10}
                  value={activePostFxConfig.highpass_hz || 20}
                  onChange={(event) => patchPostFxConfig('highpass_hz', Number(event.target.value))}
                  className="mt-1 w-full accent-slate-700"
                />

                <label className="mt-2 block text-slate-500 dark:text-[#a3a3a3]">
                  {isZh ? '低通滤波器' : 'Low-pass Filter'}: {Math.round(activePostFxConfig.lowpass_hz || 20000)}Hz
                </label>
                <input
                  type="range"
                  min={1000}
                  max={22000}
                  step={50}
                  value={activePostFxConfig.lowpass_hz || 20000}
                  onChange={(event) => patchPostFxConfig('lowpass_hz', Number(event.target.value))}
                  className="mt-1 w-full accent-slate-700"
                />

                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-[#3a3a3a] dark:bg-[#101010]">
                  <label className="flex items-center justify-between font-semibold text-slate-700 dark:text-[#e5e5e5]">
                    <span>{isZh ? '混响' : 'Reverb'}</span>
                    <input
                      type="checkbox"
                      checked={!!activePostFxConfig.reverb?.enabled}
                      onChange={(event) => patchPostFxConfig('reverb.enabled', event.target.checked)}
                    />
                  </label>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a3a3a3]">
                    room {Number(activePostFxConfig.reverb?.room_size || 0).toFixed(2)} / damping {Number(activePostFxConfig.reverb?.damping || 0).toFixed(2)} / wet {Number(activePostFxConfig.reverb?.wet_level || 0).toFixed(2)} / dry {Number(activePostFxConfig.reverb?.dry_level || 0).toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.reverb?.room_size || 0}
                    onChange={(event) => patchPostFxConfig('reverb.room_size', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.reverb?.damping || 0}
                    onChange={(event) => patchPostFxConfig('reverb.damping', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.reverb?.wet_level || 0}
                    onChange={(event) => patchPostFxConfig('reverb.wet_level', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.reverb?.dry_level || 0.9}
                    onChange={(event) => patchPostFxConfig('reverb.dry_level', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-[#3a3a3a] dark:bg-[#101010]">
                  <label className="flex items-center justify-between font-semibold text-slate-700 dark:text-[#e5e5e5]">
                    <span>{isZh ? '延迟' : 'Delay'}</span>
                    <input
                      type="checkbox"
                      checked={!!activePostFxConfig.delay?.enabled}
                      onChange={(event) => patchPostFxConfig('delay.enabled', event.target.checked)}
                    />
                  </label>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a3a3a3]">
                    time {Number(activePostFxConfig.delay?.delay_seconds || 0).toFixed(2)}s / feedback {Number(activePostFxConfig.delay?.feedback || 0).toFixed(2)} / mix {Number(activePostFxConfig.delay?.mix || 0).toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={2}
                    step={0.01}
                    value={activePostFxConfig.delay?.delay_seconds || 0.25}
                    onChange={(event) => patchPostFxConfig('delay.delay_seconds', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.01}
                    value={activePostFxConfig.delay?.feedback || 0.2}
                    onChange={(event) => patchPostFxConfig('delay.feedback', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.delay?.mix || 0.2}
                    onChange={(event) => patchPostFxConfig('delay.mix', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-[#3a3a3a] dark:bg-[#101010]">
                  <label className="flex items-center justify-between font-semibold text-slate-700 dark:text-[#e5e5e5]">
                    <span>{isZh ? '合唱 / 弗兰德' : 'Chorus / Flanger'}</span>
                    <input
                      type="checkbox"
                      checked={!!activePostFxConfig.modulation?.enabled}
                      onChange={(event) => patchPostFxConfig('modulation.enabled', event.target.checked)}
                    />
                  </label>
                  <select
                    value={activePostFxConfig.modulation?.mode || 'chorus'}
                    onChange={(event) => patchPostFxConfig('modulation.mode', event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none dark:border-[#3d3d3d] dark:bg-[#131313]"
                  >
                    <option value="chorus">{isZh ? '合唱' : 'Chorus'}</option>
                    <option value="flanger">{isZh ? '弗兰德' : 'Flanger'}</option>
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a3a3a3]">
                    rate {Number(activePostFxConfig.modulation?.rate_hz || 0).toFixed(2)} / depth {Number(activePostFxConfig.modulation?.depth || 0).toFixed(2)} / delay {Number(activePostFxConfig.modulation?.centre_delay_ms || 0).toFixed(1)}ms / fb {Number(activePostFxConfig.modulation?.feedback || 0).toFixed(2)} / mix {Number(activePostFxConfig.modulation?.mix || 0).toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={10}
                    step={0.01}
                    value={activePostFxConfig.modulation?.rate_hz || 1.2}
                    onChange={(event) => patchPostFxConfig('modulation.rate_hz', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.modulation?.depth || 0.25}
                    onChange={(event) => patchPostFxConfig('modulation.depth', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activePostFxConfig.modulation?.mix || 0.25}
                    onChange={(event) => patchPostFxConfig('modulation.mix', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={30}
                    step={0.1}
                    value={activePostFxConfig.modulation?.centre_delay_ms || 8}
                    onChange={(event) => patchPostFxConfig('modulation.centre_delay_ms', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={-0.95}
                    max={0.95}
                    step={0.01}
                    value={activePostFxConfig.modulation?.feedback || 0.2}
                    onChange={(event) => patchPostFxConfig('modulation.feedback', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-[#3a3a3a] dark:bg-[#101010]">
                  <label className="flex items-center justify-between font-semibold text-slate-700 dark:text-[#e5e5e5]">
                    <span>{isZh ? '压缩器' : 'Compressor'}</span>
                    <input
                      type="checkbox"
                      checked={!!activePostFxConfig.compressor?.enabled}
                      onChange={(event) => patchPostFxConfig('compressor.enabled', event.target.checked)}
                    />
                  </label>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a3a3a3]">
                    threshold {Number(activePostFxConfig.compressor?.threshold_db || 0).toFixed(1)}dB / ratio {Number(activePostFxConfig.compressor?.ratio || 0).toFixed(2)} / attack {Number(activePostFxConfig.compressor?.attack_ms || 0).toFixed(1)}ms / release {Number(activePostFxConfig.compressor?.release_ms || 0).toFixed(0)}ms
                  </div>
                  <input
                    type="range"
                    min={-80}
                    max={0}
                    step={0.5}
                    value={activePostFxConfig.compressor?.threshold_db || -18}
                    onChange={(event) => patchPostFxConfig('compressor.threshold_db', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={0.1}
                    value={activePostFxConfig.compressor?.ratio || 3}
                    onChange={(event) => patchPostFxConfig('compressor.ratio', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={200}
                    step={0.1}
                    value={activePostFxConfig.compressor?.attack_ms || 5}
                    onChange={(event) => patchPostFxConfig('compressor.attack_ms', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                  <input
                    type="range"
                    min={5}
                    max={3000}
                    step={5}
                    value={activePostFxConfig.compressor?.release_ms || 120}
                    onChange={(event) => patchPostFxConfig('compressor.release_ms', Number(event.target.value))}
                    className="mt-1 w-full accent-slate-700"
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePreviewPostFx}
                    disabled={postFxPreviewLoading || !activeSourcePath}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                  >
                    {postFxPreviewLoading ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Play size={12} className="mr-1 inline" />}
                    {isZh ? '实时预览' : 'Live Preview'}
                  </button>
                  <button
                    onClick={handleApplyPostFx}
                    disabled={postFxApplyLoading || !activeSourcePath}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                  >
                    {postFxApplyLoading ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Music4 size={12} className="mr-1 inline" />}
                    {isZh ? '应用到音频' : 'Apply'}
                  </button>
                </div>

                {selectedDialogueClip?.characterId && (
                  <button
                    onClick={handleAssignPresetToCharacter}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#191919] dark:text-[#e2e2e2]"
                  >
                    {isZh ? '设为该角色默认预设' : 'Set as Character Default'}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
