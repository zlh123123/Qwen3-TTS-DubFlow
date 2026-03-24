import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  FolderOpen,
  Mic2,
  Waves,
  Upload,
  Trash2,
  Loader2,
  Link2,
  Unlink,
  Library,
  FolderSearch,
} from 'lucide-react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

const TAB_OPTIONS = [
  { key: 'character_refs', labelZh: '角色语音', labelEn: 'Character Voice', icon: Mic2 },
  { key: 'effects', labelZh: '环境/音效', labelEn: 'Effects', icon: Waves },
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
  const [globalCharacterRefs, setGlobalCharacterRefs] = useState([]);
  const [globalEffects, setGlobalEffects] = useState([]);

  const [sourcePath, setSourcePath] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [note, setNote] = useState('');
  const [selectedCharId, setSelectedCharId] = useState('');
  const [effectCategory, setEffectCategory] = useState('ambience');

  const refreshAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [
        charsRes,
        projectRefsRes,
        projectEffectsRes,
        globalRefsRes,
        globalEffectsRes,
      ] = await Promise.all([
        API.getCharacters(pid),
        API.getCharacterRefs(pid),
        API.getEffects(pid),
        API.getGlobalCharacterRefs(pid),
        API.getGlobalEffects(pid),
      ]);
      setChars(asArray(charsRes));
      setProjectCharacterRefs(asArray(projectRefsRes));
      setProjectEffects(asArray(projectEffectsRes));
      setGlobalCharacterRefs(asArray(globalRefsRes));
      setGlobalEffects(asArray(globalEffectsRes));
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
    return projectEffects;
  }, [activeTab, projectCharacterRefs, projectEffects]);

  const globalItems = useMemo(() => {
    if (activeTab === 'character_refs') return globalCharacterRefs;
    return globalEffects;
  }, [activeTab, globalCharacterRefs, globalEffects]);

  const handleSwitchTab = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const resetImportForm = () => {
    setSourcePath('');
    setDisplayName('');
    setNote('');
    setEffectCategory('ambience');
  };

  const handlePickFile = async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [
          { name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'm4a', 'aac', 'ogg'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!selected) return;
      if (typeof selected === 'string') {
        setSourcePath(selected);
      }
    } catch (err) {
      console.error('Pick file failed:', err);
      alert(isZh ? '打开文件选择器失败，请重试。' : 'Failed to open file picker.');
    }
  };

  const handleImport = async () => {
    const src = sourcePath.trim();
    if (!src) {
      alert(isZh ? '请先选择要导入的音频文件。' : 'Please choose an audio file first.');
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
      } else {
        await API.importEffect(pid, {
          source_path: src,
          effect_category: effectCategory,
          display_name: displayName.trim() || null,
          copy_to_project: true,
          source_type: 'imported',
          note: note.trim() || null,
        });
      }
      resetImportForm();
      await refreshAll(true);
    } catch (error) {
      console.error('Import asset failed:', error);
      alert(isZh ? '导入失败，请重试。' : 'Import failed.');
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
      } else {
        await API.linkEffect(pid, { asset_id: asset.id });
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
      } else {
        await API.unlinkEffect(pid, asset.id);
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
      } else {
        await API.deleteEffect(asset.id);
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
            <h1 className="text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">{isZh ? '素材库' : 'Assets Library'}</h1>
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
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-[#343434]">
            {TAB_OPTIONS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeTab;
              const projectCount = tab.key === 'character_refs' ? projectCharacterRefs.length : projectEffects.length;
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
                  {isZh ? '全局素材库' : 'Global Library'}
                </div>
                {globalItems.length === 0 ? (
                  <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center dark:border-[#3b3b3b]">
                    <FolderOpen size={44} className="mb-3 text-slate-400 dark:text-[#777]" />
                    <div className="text-sm font-semibold text-slate-500 dark:text-[#9a9a9a]">
                      {isZh ? '还没有全局素材，先从右侧导入' : 'No global assets yet. Import from right panel.'}
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
                                {isZh ? '引用' : 'Link'}
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

        <aside className="w-[360px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-[#f0f0f0]">
            {isZh ? '导入素材' : 'Import Asset'}
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9d9d9d]">
                {isZh ? '文件' : 'File'}
              </label>
              <button
                onClick={handlePickFile}
                className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#d9d9d9] dark:hover:bg-[#2e2e2e]"
              >
                <span className="truncate pr-2">{sourcePath || (isZh ? '选择音频文件' : 'Choose audio file')}</span>
                <FolderSearch size={15} className="shrink-0" />
              </button>
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
                  {isZh ? '关联角色（当前项目）' : 'Bind Character (Current Project)'}
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
              {isZh ? '导入并引用到当前项目' : 'Import & Link'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
