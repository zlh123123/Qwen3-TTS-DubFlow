import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  Loader2,
  Save,
  Sparkles,
  FolderOpen,
  Clapperboard,
  AlertCircle,
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

const asArray = (value) => (Array.isArray(value) ? value : value?.data || []);
const ROW_HEIGHT = 104;
const ROW_OVERSCAN = 8;

const estimateDuration = (text, speed) => {
  const content = (text || '').trim();
  if (!content) return 0.8;
  const safeSpeed = speed && speed > 0 ? speed : 1;
  return Math.max(0.8, content.length / (6.5 * safeSpeed));
};

const formatSeconds = (seconds) => `${Math.max(0, Number(seconds || 0)).toFixed(1)}s`;

const lineStatusClass = (status) => {
  if (status === 'synthesized') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300';
  if (status === 'processing') return 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300';
  if (status === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-400/20 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
};

const resolveAudioUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('file://')) return path;
  if (path.startsWith('/static/')) return `http://127.0.0.1:8000${path}`;
  if (path.startsWith('/')) return `file://${path}`;
  return `http://127.0.0.1:8000/static/${path}`;
};

export default function Studio() {
  const { lang } = useLang();
  const isZh = lang === 'zh-CN';
  const { pid } = useParams();
  const nav = useNavigate();
  const { startPolling } = useTaskPoller();

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [lines, setLines] = useState([]);
  const [chars, setChars] = useState([]);
  const [activeLineId, setActiveLineId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [dirtyIds, setDirtyIds] = useState([]);
  const [savingLineId, setSavingLineId] = useState('');
  const [synthLineId, setSynthLineId] = useState('');
  const [synthAllLoading, setSynthAllLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const listRef = useRef(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [listViewportHeight, setListViewportHeight] = useState(0);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const orderedLines = useMemo(
    () => [...lines].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [lines]
  );

  const charMap = useMemo(() => {
    const map = new Map();
    chars.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [chars]);

  const filteredLines = useMemo(() => {
    let result = [...orderedLines];
    if (onlyPending) result = result.filter((line) => line.status !== 'synthesized');
    const q = deferredSearchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter((line) => (line.text || '').toLowerCase().includes(q));
    }
    return result;
  }, [orderedLines, onlyPending, deferredSearchTerm]);

  const activeLine = useMemo(
    () => lines.find((line) => line.id === activeLineId) || null,
    [lines, activeLineId]
  );

  const stats = useMemo(() => {
    const total = orderedLines.length;
    const done = orderedLines.filter((line) => line.status === 'synthesized').length;
    return { total, done, pending: total - done };
  }, [orderedLines]);

  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [charsRes, scriptRes] = await Promise.all([
        API.getCharacters(pid),
        API.getScript(pid),
      ]);
      const nextChars = asArray(charsRes);
      const nextLines = asArray(scriptRes).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setChars(nextChars);
      setLines(nextLines);
      setDirtyIds((prev) => prev.filter((id) => nextLines.some((line) => line.id === id)));
      setActiveLineId((prev) => {
        if (prev && nextLines.some((line) => line.id === prev)) return prev;
        return nextLines[0]?.id || null;
      });
    } catch (err) {
      console.error('Load studio data failed:', err);
      setNotice(isZh ? '演播室数据加载失败。' : 'Failed to load studio data.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [pid]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!listRef.current) return undefined;
    const el = listRef.current;
    const sync = () => setListViewportHeight(el.clientHeight);
    sync();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', sync);
      return () => window.removeEventListener('resize', sync);
    }

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalRows = filteredLines.length;
  const startIndex = Math.max(0, Math.floor(listScrollTop / ROW_HEIGHT) - ROW_OVERSCAN);
  const visibleCount = Math.ceil((listViewportHeight || 1) / ROW_HEIGHT) + ROW_OVERSCAN * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);
  const visibleLines = filteredLines.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  const markDirty = (lineId) => {
    setDirtyIds((prev) => (prev.includes(lineId) ? prev : [...prev, lineId]));
  };

  const clearDirty = (lineId) => {
    setDirtyIds((prev) => prev.filter((id) => id !== lineId));
  };

  const patchLine = (lineId, patch) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const saveLine = async (lineId, silent = false) => {
    const target = lines.find((line) => line.id === lineId);
    if (!target) return;
    setSavingLineId(lineId);
    try {
      await API.updateLine(lineId, {
        text: target.text || '',
        character_id: target.character_id || null,
        speed: Number(target.speed || 1),
      });
      clearDirty(lineId);
      if (!silent) setNotice(isZh ? '已保存。' : 'Saved.');
    } catch (err) {
      console.error('Save line failed:', err);
      setNotice(isZh ? '保存失败。' : 'Save failed.');
    } finally {
      setSavingLineId('');
    }
  };

  const addLine = async () => {
    try {
      const created = await API.addLine(pid, activeLineId || orderedLines[orderedLines.length - 1]?.id || null);
      const row = created?.data || created;
      await refreshData(true);
      if (row?.id) setActiveLineId(row.id);
      setNotice(isZh ? '已新增台词。' : 'Line added.');
    } catch (err) {
      console.error('Add line failed:', err);
      setNotice(isZh ? '新增失败。' : 'Failed to add line.');
    }
  };

  const deleteActiveLine = async () => {
    if (!activeLine) return;
    try {
      await API.deleteLine(activeLine.id);
      setDeleteConfirmOpen(false);
      await refreshData(true);
      setNotice(isZh ? '台词已删除。' : 'Line deleted.');
    } catch (err) {
      console.error('Delete line failed:', err);
      setNotice(isZh ? '删除失败。' : 'Delete failed.');
    }
  };

  const synthesizeLines = async (lineIds, singleId = null) => {
    const ids = Array.from(new Set(lineIds.filter(Boolean)));
    if (ids.length === 0) return;

    if (singleId) setSynthLineId(singleId);
    else setSynthAllLoading(true);

    try {
      const dirtyTargets = ids.filter((id) => dirtyIds.includes(id));
      for (const lineId of dirtyTargets) {
        // eslint-disable-next-line no-await-in-loop
        await saveLine(lineId, true);
      }

      setLines((prev) => prev.map((line) => (ids.includes(line.id) ? { ...line, status: 'processing' } : line)));
      const resp = await API.synthesize({ project_id: pid, line_ids: ids });
      const taskId = resp?.task_id || resp?.data?.task_id;
      if (taskId) {
        startPolling(taskId, async () => {
          await refreshData(true);
          setSynthLineId('');
          setSynthAllLoading(false);
          setNotice(singleId ? (isZh ? '该条合成完成。' : 'Line synthesized.') : (isZh ? '全部待处理已合成。' : 'All pending synthesized.'));
        });
      } else {
        await refreshData(true);
        setSynthLineId('');
        setSynthAllLoading(false);
      }
    } catch (err) {
      console.error('Synthesis failed:', err);
      await refreshData(true);
      setSynthLineId('');
      setSynthAllLoading(false);
      setNotice(isZh ? '合成失败，请检查后端。' : 'Synthesis failed.');
    }
  };

  const synthesizeActive = () => {
    if (!activeLine) return;
    void synthesizeLines([activeLine.id], activeLine.id);
  };

  const synthesizeAllPending = () => {
    const pendingIds = orderedLines.filter((line) => line.status !== 'synthesized').map((line) => line.id);
    void synthesizeLines(pendingIds);
  };

  const activeAudioUrl = resolveAudioUrl(activeLine?.audio_url || activeLine?.audio_path);
  const activeDuration = activeLine ? (activeLine.duration ?? estimateDuration(activeLine.text, activeLine.speed || 1)) : 0;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-[#000000] dark:text-[#d8d8d8]">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-[#2f2f2f] dark:bg-[#121212]">
          <Loader2 size={16} className="animate-spin" />
          {isZh ? '加载演播室...' : 'Loading Studio...'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 text-slate-700 dark:bg-[#000000] dark:text-[#d8d8d8]">
      {!!notice && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm dark:border-[#6b562e] dark:bg-[#2b2314] dark:text-[#efd29c]">
            <AlertCircle size={14} />
            <span>{notice}</span>
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-[#2d2d2d] dark:bg-[#101010]">
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#f0f0f0]">
              {isZh ? '删除当前台词' : 'Delete Current Line'}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-[#b8b8b8]">
              {isZh ? '删除后不可恢复，确认继续吗？' : 'This cannot be undone. Continue?'}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#343434] dark:bg-[#1b1b1b] dark:text-[#e0e0e0] dark:hover:bg-[#242424]"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={deleteActiveLine}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                {isZh ? '确认删除' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-[#202020] dark:bg-[#090909]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => nav(`/project/${pid}/workshop`)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-[#dddddd] dark:hover:bg-[#1f1f1f]"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">
                {isZh ? '演播室' : 'Studio'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#a1a1a1]">
                {isZh
                  ? `仅用于台词编辑与合成 · 共 ${stats.total} 条 · 已合成 ${stats.done} 条`
                  : `Script editing & synthesis only · ${stats.done}/${stats.total} done`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => nav(`/project/${pid}/assets`)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-[#e2e2e2] dark:hover:bg-[#1f1f1f]"
            >
              <FolderOpen size={14} />
              {isZh ? '素材库' : 'Assets'}
            </button>
            <button
              onClick={() => nav(`/project/${pid}/timeline`)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-[#e2e2e2] dark:hover:bg-[#1f1f1f]"
            >
              <Clapperboard size={14} />
              {isZh ? '剪辑台' : 'Timeline'}
            </button>
            <button
              onClick={synthesizeAllPending}
              disabled={synthAllLoading || stats.pending === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d8d8d8]"
            >
              {synthAllLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isZh ? '合成全部待处理' : 'Synthesize Pending'}
            </button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-12 gap-4 px-6 py-4">
        <section className="col-span-4 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#212121] dark:bg-[#090909]">
          <div className="border-b border-slate-200 p-3 dark:border-[#212121]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={isZh ? '搜索台词...' : 'Search lines...'}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-[#343434] dark:bg-[#121212] dark:text-[#e7e7e7]"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#a2a2a2]">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(event) => setOnlyPending(event.target.checked)}
                  className="accent-slate-700"
                />
                {isZh ? '仅显示待合成' : 'Pending only'}
              </label>
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#343434] dark:bg-[#151515] dark:text-[#e4e4e4] dark:hover:bg-[#202020]"
              >
                <Plus size={12} />
                {isZh ? '新增' : 'Add'}
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            onScroll={(event) => setListScrollTop(event.currentTarget.scrollTop)}
            className="h-[calc(100%-89px)] overflow-y-auto p-3 custom-scrollbar"
          >
            {totalRows === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400 dark:text-[#777777]">
                {isZh ? '无匹配台词' : 'No matching lines'}
              </div>
            ) : (
              <div>
                <div style={{ height: topSpacer }} />
                <div className="space-y-2">
                  {visibleLines.map((line) => {
                    const active = line.id === activeLineId;
                    const dirty = dirtyIds.includes(line.id);
                    return (
                      <button
                        key={line.id}
                        onClick={() => setActiveLineId(line.id)}
                        className={`block h-[96px] w-full rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-[#3f3f3f] dark:bg-[#171717]'
                            : 'border-slate-200 bg-slate-50 hover:bg-white dark:border-[#2b2b2b] dark:bg-[#111111] dark:hover:bg-[#181818]'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`text-[11px] font-semibold ${active ? 'text-slate-300' : 'text-slate-500 dark:text-[#9f9f9f]'}`}>
                              #{line.order_index}
                            </span>
                            <span className="truncate text-xs font-semibold">
                              {charMap.get(line.character_id) || (isZh ? '未指定角色' : 'No Speaker')}
                            </span>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClass(line.status)}`}>
                            {line.status || 'pending'}
                          </span>
                        </div>
                        <p className={`line-clamp-2 text-sm leading-6 ${active ? 'text-slate-100' : 'text-slate-700 dark:text-[#dadada]'}`}>
                          {line.text || (isZh ? '（空白台词）' : '(Empty line)')}
                        </p>
                        {dirty && (
                          <div className="mt-1 text-[11px] font-semibold text-amber-500 dark:text-amber-300">
                            {isZh ? '未保存' : 'Unsaved'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div style={{ height: bottomSpacer }} />
              </div>
            )}
          </div>
        </section>

        <section className="col-span-8 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#212121] dark:bg-[#090909]">
          {!activeLine ? (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400 dark:text-[#757575]">
              {isZh ? '请选择一条台词进行编辑与合成' : 'Select a line to edit and synthesize'}
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-5 custom-scrollbar">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-[#f0f0f0]">
                    {isZh ? `台词 #${activeLine.order_index}` : `Line #${activeLine.order_index}`}
                  </h2>
                  <div className="mt-1 text-xs text-slate-500 dark:text-[#a2a2a2]">
                    {isZh
                      ? `角色：${charMap.get(activeLine.character_id) || '未指定'} · 时长：${formatSeconds(activeDuration)}`
                      : `Speaker: ${charMap.get(activeLine.character_id) || 'Not set'} · ${formatSeconds(activeDuration)}`}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClass(activeLine.status)}`}>
                  {activeLine.status || 'pending'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#a3a3a3]">
                    {isZh ? '说话角色' : 'Speaker'}
                  </label>
                  <select
                    value={activeLine.character_id || ''}
                    onChange={(event) => {
                      patchLine(activeLine.id, { character_id: event.target.value || null });
                      markDirty(activeLine.id);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#343434] dark:bg-[#121212] dark:text-[#e6e6e6]"
                  >
                    <option value="">{isZh ? '未指定角色' : 'No Speaker'}</option>
                    {chars.map((char) => (
                      <option key={char.id} value={char.id}>
                        {char.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#a3a3a3]">
                    {isZh ? '语速' : 'Speed'}
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#343434] dark:bg-[#121212]">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1a1]">
                      <span>{isZh ? '倍率' : 'Rate'}</span>
                      <span className="font-semibold text-slate-700 dark:text-[#e6e6e6]">
                        {Number(activeLine.speed || 1).toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.3}
                      step={0.05}
                      value={Number(activeLine.speed || 1)}
                      onChange={(event) => {
                        patchLine(activeLine.id, { speed: Number(event.target.value) });
                        markDirty(activeLine.id);
                      }}
                      className="w-full accent-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#a3a3a3]">
                  {isZh ? '台词文本' : 'Line Text'}
                </label>
                <textarea
                  value={activeLine.text || ''}
                  onChange={(event) => {
                    patchLine(activeLine.id, { text: event.target.value });
                    markDirty(activeLine.id);
                  }}
                  className="h-[260px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#343434] dark:bg-[#121212] dark:text-[#e6e6e6]"
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#2f2f2f] dark:bg-[#101010]">
                <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-[#a1a1a1]">
                  {isZh ? '试听' : 'Preview'}
                </div>
                {activeAudioUrl ? (
                  <audio src={activeAudioUrl} controls className="h-10 w-full" />
                ) : (
                  <div className="flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-400 dark:border-[#3f3f3f] dark:text-[#8a8a8a]">
                    {isZh ? '尚无可播放音频，先合成当前台词' : 'No audio yet. Synthesize this line first.'}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-500 dark:text-[#a3a3a3]">
                  {dirtyIds.includes(activeLine.id)
                    ? (isZh ? '当前台词有未保存修改' : 'Unsaved changes on current line')
                    : (isZh ? '已同步' : 'Saved')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveLine(activeLine.id)}
                    disabled={savingLineId === activeLine.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#3f3f3f] dark:bg-[#151515] dark:text-[#e4e4e4] dark:hover:bg-[#212121]"
                  >
                    {savingLineId === activeLine.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {isZh ? '保存' : 'Save'}
                  </button>
                  <button
                    onClick={synthesizeActive}
                    disabled={synthLineId === activeLine.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d8d8d8]"
                  >
                    {synthLineId === activeLine.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isZh ? '合成当前台词' : 'Synthesize Line'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                    title={isZh ? '删除当前台词' : 'Delete current line'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
