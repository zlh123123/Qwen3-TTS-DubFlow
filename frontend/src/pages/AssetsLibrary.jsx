import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  FolderOpen,
  Mic2,
  Waves,
  Music2,
  Upload,
  Trash2,
  Loader2,
  Link2,
  Unlink,
  Library,
} from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

const TAB_OPTIONS = [
  { key: 'character_refs', labelZh: '角色语音', labelEn: 'Character Voice', icon: Mic2 },
  { key: 'effects', labelZh: '环境/音效', labelEn: 'Effects', icon: Waves },
  { key: 'bgms', labelZh: '背景音乐', labelEn: 'BGM', icon: Music2 },
];

const resolveAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('file://')) return path;
  const baseURL = 'http://127.0.0.1:8000';
  if (path.startsWith('/static/')) return `${baseURL}${path}`;
  if (path.startsWith('/')) return `file://${path}`;
  return `${baseURL}/static/${path}`;
};

const asArray = (value) => (Array.isArray(value) ? value : value?.data || []);

export default function AssetsLibrary() {
  const { lang } = useLang();
  const isZh = lang === 'zh-CN';
  const { pid } = useParams();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const defaultTab = TAB_OPTIONS.some((x) => x.key === requestedTab) ? requestedTab : 'character_refs';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [linkingId, setLinkingId] = useState('');
  const [unlinkingId, setUnlinkingId] = useState('');
  const [deletingGlobalId, setDeletingGlobalId] = useState('');

  const [chars, setChars] = useState([]);
  const [projectCharacterRefs, setProjectCharacterRefs] = useState([]);
  const [projectEffects, setProjectEffects] = useState([]);
  const [projectBgms, setProjectBgms] = useState([]);
  const [globalCharacterRefs, setGlobalCharacterRefs] = useState([]);
  const [globalEffects, setGlobalEffects] = useState([]);
  const [globalBgms, setGlobalBgms] = useState([]);

  const [sourcePath, setSourcePath] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [note, setNote] = useState('');
  const [selectedCharId, setSelectedCharId] = useState('');
  const [effectCategory, setEffectCategory] = useState('ambience');
  const [bgmMood, setBgmMood] = useState('');
  const [bgmBpm, setBgmBpm] = useState('');

  const refreshAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [
        charsRes,
        projectRefsRes,
        projectEffectsRes,
        projectBgmRes,
        globalRefsRes,
        globalEffectsRes,
        globalBgmRes,
      ] = await Promise.all([
        API.getCharacters(pid),
        API.getCharacterRefs(pid),
        API.getEffects(pid),
        API.getBgms(pid),
        API.getGlobalCharacterRefs(pid),
        API.getGlobalEffects(pid),
        API.getGlobalBgms(pid),
      ]);
      setChars(asArray(charsRes));
      setProjectCharacterRefs(asArray(projectRefsRes));
      setProjectEffects(asArray(projectEffectsRes));
      setProjectBgms(asArray(projectBgmRes));
      setGlobalCharacterRefs(asArray(globalRefsRes));
      setGlobalEffects(asArray(globalEffectsRes));
      setGlobalBgms(asArray(globalBgmRes));
    } catch (error) {
      console.error('Load assets failed:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [pid]);

  useEffect(() => {
    if (chars.length > 0 && !selectedCharId) {
      setSelectedCharId(chars[0].id);
    }
  }, [chars, selectedCharId]);

  useEffect(() => {
    if (TAB_OPTIONS.some((x) => x.key === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const projectItems = useMemo(() => {
    if (activeTab === 'character_refs') return projectCharacterRefs;
    if (activeTab === 'effects') return projectEffects;
    return projectBgms;
  }, [activeTab, projectCharacterRefs, projectEffects, projectBgms]);

  const globalItems = useMemo(() => {
    if (activeTab === 'character_refs') return globalCharacterRefs;
    if (activeTab === 'effects') return globalEffects;
    return globalBgms;
  }, [activeTab, globalCharacterRefs, globalEffects, globalBgms]);

  const handleSwitchTab = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const resetImportForm = () => {
    setSourcePath('');
    setDisplayName('');
    setNote('');
    setEffectCategory('ambience');
    setBgmMood('');
    setBgmBpm('');
  };

  const handleImport = async () => {
    const src = sourcePath.trim();
    if (!src) {
      alert(isZh ? '请填写 source_path（本地绝对路径）' : 'Please enter source_path (absolute local path)');
      return;
    }
    if (activeTab === 'character_refs' && !selectedCharId) {
      alert(isZh ? '请先选择关联角色' : 'Please select target character');
      return;
    }

    setImporting(true);
    try {
      if (activeTab === 'character_refs') {
        await API.importCharacterRef(pid, {
          source_path: src,
          character_id: selectedCharId,
          display_name: displayName.trim() || null,
          copy_to_project: true,
          source_type: 'imported',
          note: note.trim() || null,
        });
      } else if (activeTab === 'effects') {
        await API.importEffect(pid, {
          source_path: src,
          effect_category: effectCategory,
          display_name: displayName.trim() || null,
          copy_to_project: true,
          source_type: 'imported',
          note: note.trim() || null,
        });
      } else {
        await API.importBgm(pid, {
          source_path: src,
          display_name: displayName.trim() || null,
          copy_to_project: true,
          source_type: 'imported',
          mood: bgmMood.trim() || null,
          bpm: bgmBpm ? Number(bgmBpm) : null,
          note: note.trim() || null,
        });
      }
      resetImportForm();
      await refreshAll(true);
    } catch (error) {
      console.error('Import asset failed:', error);
      alert(isZh ? '导入失败，请检查文件路径是否有效' : 'Import failed, check if source path is valid');
    } finally {
      setImporting(false);
    }
  };

  const handleLinkAsset = async (asset) => {
    setLinkingId(asset.id);
    try {
      if (activeTab === 'character_refs') {
        await API.linkCharacterRef(pid, {
          asset_id: asset.id,
          character_id: selectedCharId || null,
        });
      } else if (activeTab === 'effects') {
        await API.linkEffect(pid, { asset_id: asset.id });
      } else {
        await API.linkBgm(pid, { asset_id: asset.id });
      }
      await refreshAll(true);
    } catch (error) {
      console.error('Link asset failed:', error);
      alert(isZh ? '引用失败' : 'Link failed');
    } finally {
      setLinkingId('');
    }
  };

  const handleUnlinkAsset = async (asset) => {
    if (!window.confirm(isZh ? '确认将该素材从当前项目移除？' : 'Remove this asset from current project?')) return;
    setUnlinkingId(asset.id);
    try {
      if (activeTab === 'character_refs') {
        await API.unlinkCharacterRef(pid, asset.id);
      } else if (activeTab === 'effects') {
        await API.unlinkEffect(pid, asset.id);
      } else {
        await API.unlinkBgm(pid, asset.id);
      }
      await refreshAll(true);
    } catch (error) {
      console.error('Unlink asset failed:', error);
      alert(isZh ? '移除失败' : 'Unlink failed');
    } finally {
      setUnlinkingId('');
    }
  };

  const handleDeleteGlobalAsset = async (asset) => {
    if (!window.confirm(isZh ? '确认从全局素材库彻底删除？会影响所有项目。' : 'Delete from global library? This affects all projects.')) return;
    setDeletingGlobalId(asset.id);
    try {
      if (activeTab === 'character_refs') {
        await API.deleteCharacterRef(asset.id);
      } else if (activeTab === 'effects') {
        await API.deleteEffect(asset.id);
      } else {
        await API.deleteBgm(asset.id);
      }
      await refreshAll(true);
    } catch (error) {
      console.error('Delete global asset failed:', error);
      alert(isZh ? '删除失败' : 'Delete failed');
    } finally {
      setDeletingGlobalId('');
    }
  };

  const handleCharacterRefBindChange = async (assetId, nextCharId) => {
    try {
      await API.updateCharacterRefLink(pid, assetId, { character_id: nextCharId || null });
      await refreshAll(true);
    } catch (error) {
      console.error('Update character ref failed:', error);
      alert(isZh ? '更新角色关联失败' : 'Failed to update character binding');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-[#111111] dark:text-[#d8d8d8]">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={16} className="animate-spin" />
          {isZh ? '加载素材库...' : 'Loading Assets...'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 text-slate-700 dark:bg-[#111111] dark:text-[#d8d8d8]">
      <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-4 dark:border-[#343434] dark:bg-[#151515]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(`/project/${pid}/workshop`)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#dddddd] dark:hover:bg-[#2e2e2e]"
            >
              <ChevronRight className="rotate-180" size={16} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">{isZh ? '素材库' : 'Assets Library'}</h1>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-[#a0a0a0]">
                {isZh ? '全局资产可跨项目复用，项目内只做引用。' : 'Global assets are reusable across projects; project uses links.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => nav(`/project/${pid}/studio`)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d9d9d9]"
          >
            {isZh ? '进入演播室' : 'Go to Studio'}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 py-6">
        <section className="w-[360px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">
            {isZh ? '导入到全局素材库' : 'Import to Global Library'}
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                source_path
              </label>
              <input
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/Users/.../voice.wav"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-[#9a9a9a]">
                {isZh ? '填写本机绝对路径，导入后会复制到全局资产目录。' : 'Use absolute local path. File will be copied to global asset storage.'}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                {isZh ? '显示名' : 'Display Name'}
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
              />
            </div>

            {activeTab === 'character_refs' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                  {isZh ? '默认绑定角色（当前项目）' : 'Default Character (Current Project)'}
                </label>
                <select
                  value={selectedCharId}
                  onChange={(e) => setSelectedCharId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
                >
                  {chars.map((char) => (
                    <option key={char.id} value={char.id}>{char.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'effects' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                  {isZh ? '音效类型' : 'Effect Category'}
                </label>
                <select
                  value={effectCategory}
                  onChange={(e) => setEffectCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
                >
                  <option value="ambience">{isZh ? '环境音' : 'Ambience'}</option>
                  <option value="effect">{isZh ? '音效' : 'Effect'}</option>
                </select>
              </div>
            )}

            {activeTab === 'bgms' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">BPM</label>
                  <input
                    value={bgmBpm}
                    onChange={(e) => setBgmBpm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                    {isZh ? '情绪' : 'Mood'}
                  </label>
                  <input
                    value={bgmMood}
                    onChange={(e) => setBgmMood(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                {isZh ? '备注' : 'Note'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
              />
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d9d9d9]"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isZh ? '导入并引用到当前项目' : 'Import and Link to Project'}
            </button>
          </div>
        </section>

        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-[#343434]">
            {TAB_OPTIONS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeTab;
              const projectCount = tab.key === 'character_refs' ? projectCharacterRefs.length : tab.key === 'effects' ? projectEffects.length : projectBgms.length;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleSwitchTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-[#5a5a5a] dark:bg-[#2b2b2b]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#d8d8d8] dark:hover:bg-[#2e2e2e]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{isZh ? tab.labelZh : tab.labelEn}</span>
                  <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[11px] dark:bg-white/15">{projectCount}</span>
                </button>
              );
            })}
          </div>

          <div className="h-[calc(100%-56px)] overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-6">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                  <Link2 size={13} />
                  {isZh ? '当前项目已引用' : 'Linked in Current Project'}
                </div>
                {projectItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-semibold text-slate-500 dark:border-[#3b3b3b] dark:text-[#9a9a9a]">
                    {isZh ? '当前项目还没有引用该类型素材' : 'No linked assets in current project'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#3b3b3b] dark:bg-[#252526]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">{item.display_name}</div>
                            <div className="mt-0.5 break-all text-[11px] text-slate-500 dark:text-[#9a9a9a]">{item.file_path}</div>
                          </div>
                          <button
                            onClick={() => handleUnlinkAsset(item)}
                            disabled={unlinkingId === item.id}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-45 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                            title={isZh ? '从当前项目移除' : 'Remove from current project'}
                          >
                            {unlinkingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                          </button>
                        </div>

                        <div className="mt-3">
                          <audio src={resolveAssetUrl(item.file_path)} controls className="h-9 w-full" />
                        </div>

                        {activeTab === 'character_refs' && (
                          <div className="mt-2">
                            <select
                              value={item.character_id || ''}
                              onChange={(e) => handleCharacterRefBindChange(item.id, e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]"
                            >
                              <option value="">{isZh ? '不绑定角色' : 'No Character Binding'}</option>
                              {chars.map((char) => (
                                <option key={char.id} value={char.id}>{char.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                  <Library size={13} />
                  {isZh ? '全局素材库（跨项目）' : 'Global Library (Cross-Project)'}
                </div>
                {globalItems.length === 0 ? (
                  <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center dark:border-[#3b3b3b]">
                    <FolderOpen size={44} className="mb-3 text-slate-400 dark:text-[#777]" />
                    <div className="text-sm font-semibold text-slate-500 dark:text-[#9a9a9a]">
                      {isZh ? '还没有全局素材，先在左侧导入' : 'No global assets yet. Import from left panel.'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {globalItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">{item.display_name}</div>
                            <div className="mt-0.5 break-all text-[11px] text-slate-500 dark:text-[#9a9a9a]">{item.file_path}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.is_linked ? (
                              <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                {isZh ? '已引用' : 'Linked'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleLinkAsset(item)}
                                disabled={linkingId === item.id}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-45 dark:border-[#4a4a4a] dark:bg-[#2a2a2a] dark:text-[#d3d3d3] dark:hover:bg-[#333333]"
                              >
                                {linkingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                                {isZh ? '引用到项目' : 'Link'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteGlobalAsset(item)}
                              disabled={deletingGlobalId === item.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-45 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                              title={isZh ? '从全局库删除' : 'Delete from global library'}
                            >
                              {deletingGlobalId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <audio src={resolveAssetUrl(item.file_path)} controls className="h-9 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
