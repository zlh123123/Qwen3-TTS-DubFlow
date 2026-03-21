import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ChevronRight,
  Search,
  ArrowUpDown,
  Loader2,
  Lock,
  FolderOpen,
  Gauge,
  Activity
} from 'lucide-react';
import * as API from '../api/endpoints';
import CreateProjectModal from '../components/CreateProjectModal';
import { useLang } from '../contexts/LanguageContext';

const ALLOWED_STATES = ['characters_ready', 'script_ready', 'synthesizing', 'completed'];
const PROCESSING_STATES = ['created', 'analyzing', 'analyzing_characters', 'synthesizing'];

export default function CreateProject() {
  const { t, lang } = useLang();
  const nav = useNavigate();
  const isZh = lang === 'zh-CN';

  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const fetchProjects = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await API.getProjects();
      const items = res?.items || (Array.isArray(res) ? res : []);
      setList((prev) => {
        if (isSilent && items.length === 0 && prev.length > 0) return prev;
        return items;
      });
    } catch (err) {
      console.error('Load Projects Failed:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const timer = setInterval(() => fetchProjects(true), 2000);
    return () => clearInterval(timer);
  }, []);

  const filteredList = useMemo(() => {
    let result = [...list];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((p) => p.name?.toLowerCase().includes(term));
    }
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      return 0;
    });
    return result;
  }, [list, searchTerm, sortBy]);

  const summary = useMemo(() => {
    const total = list.length;
    const ready = list.filter((p) => ALLOWED_STATES.includes(p.state)).length;
    const processing = list.filter((p) => PROCESSING_STATES.includes(p.state)).length;
    return { total, ready, processing };
  }, [list]);

  const formatTime = (input) => {
    if (!input) return '---';
    return new Date(input)
      .toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      .replace(/\//g, '-');
  };

  const handleGo = (p) => {
    if (!ALLOWED_STATES.includes(p.state)) {
      window.alert(isZh ? '项目尚未就绪，请等待分析完成。' : 'Project is not ready yet. Please wait.');
      return;
    }
    nav(`/project/${p.id}/workshop`);
  };

  const handleDel = async (e, pid) => {
    e.stopPropagation();
    if (!window.confirm(t('del_confirm'))) return;

    setList((prev) => prev.filter((item) => item.id !== pid));
    try {
      await API.deleteProject(pid);
    } catch (err) {
      fetchProjects(true);
    }
  };

  const StatusTag = ({ s }) => {
    const map = {
      created: { text: t('status_created'), cls: 'text-slate-500 bg-slate-100 border-slate-200' },
      analyzing: { text: t('status_analyzing'), cls: 'text-blue-600 bg-blue-50 border-blue-200 animate-pulse' },
      analyzing_characters: { text: t('status_analyzing'), cls: 'text-blue-600 bg-blue-50 border-blue-200 animate-pulse' },
      characters_ready: { text: t('status_characters_ready'), cls: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
      script_ready: { text: t('status_script_ready'), cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      synthesizing: { text: t('status_synthesizing'), cls: 'text-violet-700 bg-violet-50 border-violet-200' },
      completed: { text: t('status_completed'), cls: 'text-amber-700 bg-amber-50 border-amber-200' }
    };
    const config = map[s] || { text: s, cls: 'text-slate-500 bg-slate-50 border-slate-200' };
    return (
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${config.cls}`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent text-slate-600">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm font-semibold">{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-12">
      <CreateProjectModal
        open={showNew}
        close={() => setShowNew(false)}
        onCreated={(newP) => setList((prev) => [newP, ...prev])}
      />

      <main className="mx-auto max-w-6xl px-7 pb-10 pt-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles size={13} />
                {t('app_title')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t('quest_log')}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('quest_sub')}</p>
            </div>

            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              <Plus size={16} />
              {t('new_quest')}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard icon={<FolderOpen size={15} />} title={isZh ? '全部项目' : 'All Projects'} value={summary.total} />
            <SummaryCard icon={<Gauge size={15} />} title={isZh ? '可编辑' : 'Ready'} value={summary.ready} />
            <SummaryCard icon={<Activity size={15} />} title={isZh ? '处理中' : 'In Progress'} value={summary.processing} />
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('search_ph')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="newest">{t('sort_new')}</option>
                <option value="oldest">{t('sort_old')}</option>
                <option value="name">{t('sort_name')}</option>
              </select>
            </div>
          </div>

          <div className="hidden grid-cols-[2fr_1fr_1.3fr_88px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <span>{isZh ? '项目' : 'Project'}</span>
            <span>{isZh ? '状态' : 'Status'}</span>
            <span>{isZh ? '创建时间' : 'Created At'}</span>
            <span className="text-right">{isZh ? '操作' : 'Action'}</span>
          </div>

          {filteredList.length > 0 && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredList.map((p) => {
                const isLocked = !ALLOWED_STATES.includes(p.state);
                const isBusy = p.state === 'created' || p.state === 'analyzing' || p.state === 'analyzing_characters';
                return (
                  <article
                    key={p.id}
                    onClick={() => handleGo(p)}
                    className={`grid cursor-pointer gap-3 px-5 py-4 transition md:grid-cols-[2fr_1fr_1.3fr_88px] md:items-center ${
                      isLocked
                        ? 'bg-white text-slate-500 hover:bg-slate-50/80 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80'
                        : 'bg-white text-slate-800 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {isLocked
                          ? isZh
                            ? '处理中，暂不可进入编辑'
                            : 'Processing, editing is temporarily unavailable'
                          : isZh
                            ? '可进入角色工坊继续编辑'
                            : 'Ready to continue in Workshop'}
                      </p>
                    </div>

                    <div>
                      <StatusTag s={p.state} />
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock size={13} />
                      {formatTime(p.created_at)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {isBusy ? <Loader2 size={14} className="animate-spin text-blue-500" /> : isLocked ? <Lock size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-500" />}
                      <button
                        onClick={(e) => handleDel(e, p.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredList.length === 0 && (
            <div className="flex min-h-[220px] items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {searchTerm.trim()
                ? isZh
                  ? '没有匹配的项目，试试更短的关键词。'
                  : 'No matching projects. Try a shorter keyword.'
                : isZh
                  ? '还没有项目，先创建第一个项目。'
                  : 'No projects yet. Create your first one.'}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ icon, title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-300">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{icon}</span>
        {title}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
