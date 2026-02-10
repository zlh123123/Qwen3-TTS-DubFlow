import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Plus, Trash2, Clock, Map, Compass, 
  Sparkles, ChevronRight, Search, ArrowUpDown, Loader2, Lock 
} from 'lucide-react';
import * as API from '../api/endpoints';
import SettingsModal from '../components/SettingsModal';
import CreateProjectModal from '../components/CreateProjectModal';
import { useLang } from '../contexts/LanguageContext';

export default function CreateProject() {
  const { t, lang } = useLang(); 
  const nav = useNavigate();
  
  const [list, setList] = useState([]);
  const [showSet, setShowSet] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const fetchProjects = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await API.getProjects();
      const items = res?.items || (Array.isArray(res) ? res : []);
      
      setList(prev => {
        if (isSilent && items.length === 0 && prev.length > 0) return prev;
        return items;
      });
    } catch (err) {
      console.error("Load Projects Failed:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // 始终轮询逻辑
  useEffect(() => {
    fetchProjects();
    const timer = setInterval(() => {
      fetchProjects(true);
    }, 2000);
    console.log("Started global polling for project status...");
    return () => clearInterval(timer);
  }, []);

  const filteredList = useMemo(() => {
    let result = [...list];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(term));
    }
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      return 0;
    });
    return result;
  }, [list, searchTerm, sortBy]);

  // 🟢 核心修改 1：定义允许进入的状态白名单
  const ALLOWED_STATES = ['characters_ready', 'script_ready', 'synthesizing', 'completed'];

  const handleGo = (p) => {
    // 只有在白名单内的状态才能进入
    if (!ALLOWED_STATES.includes(p.state)) {
      const msg = lang === 'zh-CN' ? '项目尚未就绪，请等待分析完成...' : 'Project not ready, please wait...';
      alert(msg);
      return;
    }
    nav(`/project/${p.id}/workshop`);
  };

  const handleDel = async (e, pid) => {
    e.stopPropagation();
    if (!window.confirm(t('del_confirm'))) return;
    
    setList(prev => prev.filter(item => item.id !== pid));
    try { 
      await API.deleteProject(pid); 
    } catch (err) { 
      fetchProjects(true); 
    }
  };

  const StatusTag = ({ s }) => {
    const map = {
      'created': { text: t('status_created'), cls: 'text-gray-500 bg-gray-100 border-gray-200' },
      'analyzing': { text: t('status_analyzing'), cls: 'text-blue-500 bg-blue-50 border-blue-200 animate-pulse' },
      'characters_ready': { text: t('status_characters_ready'), cls: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
      'script_ready': { text: t('status_script_ready'), cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      'synthesizing': { text: t('status_synthesizing'), cls: 'text-purple-600 bg-purple-50 border-purple-200' },
      'completed': { text: t('status_completed'), cls: 'text-[#9A7D48] bg-[#F5EBDA] border-[#D3BC8E]' },
    };
    const config = map[s] || { text: s, cls: 'text-gray-400 bg-gray-50 border-gray-200' };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${config.cls}`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-[#D3BC8E] bg-[#F0F2F5] dark:bg-[#1B1D22] font-bold tracking-widest animate-pulse">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#F0F2F5] dark:bg-[#1B1D22] transition-colors duration-300">
      <SettingsModal open={showSet} close={() => setShowSet(false)} />
      
      <CreateProjectModal 
        open={showNew} 
        close={() => setShowNew(false)} 
        onCreated={(newP) => setList(prev => [newP, ...prev])} 
      />

      <header className="relative mt-6 mx-auto max-w-7xl px-6 z-20">
        <div className="paimon-menu px-6 py-3 flex justify-between items-center border-2 border-[#D8CBA8] bg-white/90 dark:bg-[#12141A]/90 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ECE5D8] rounded-full flex items-center justify-center border-2 border-[#D3BC8E] shadow-[0_0_10px_#D3BC8E]">
              <Compass className="text-[#3B4255]" size={24}/>
            </div>
            <div>
              <h1 className="font-genshin font-bold text-xl text-[#D3BC8E] tracking-widest leading-tight">{t('app_title')}</h1>
            </div>
          </div>
          <button 
            onClick={() => setShowSet(true)} 
            className="w-10 h-10 rounded-full bg-[#3B4255] border-2 border-[#6A7080] hover:border-[#D3BC8E] flex items-center justify-center text-[#ECE5D8] shadow-md transition-all active:scale-90"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
              <div className="h-8 w-1.5 bg-[#D3BC8E] rounded-full shadow-sm"></div>
              <h2 className="text-3xl font-genshin font-bold text-[#495366] dark:text-[#ECE5D8] flex items-baseline gap-3">
                {t('quest_log')} <span className="text-lg text-[#A4AAB6] font-sans font-normal italic">{t('quest_sub')}</span>
              </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D3BC8E]" size={18} />
              <input 
                type="text" 
                placeholder={t('search_ph')} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-11 pr-4 py-2.5 w-64 bg-white/80 dark:bg-[#2C313F] border-2 border-[#D8CBA8] rounded-full outline-none focus:border-[#D3BC8E] transition-all text-sm font-bold shadow-sm" 
              />
            </div>
            <div className="relative flex items-center">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)} 
                className="appearance-none pl-5 pr-12 py-2.5 bg-[#3B4255] border-2 border-[#D3BC8E] text-[#ECE5D8] rounded-full text-xs font-bold outline-none cursor-pointer"
              >
                <option value="newest">{t('sort_new')}</option> 
                <option value="oldest">{t('sort_old')}</option> 
                <option value="name">{t('sort_name')}</option>   
              </select>
              <ArrowUpDown className="absolute right-4 text-[#D3BC8E] pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <div 
            onClick={() => setShowNew(true)} 
            className="group h-[280px] border-4 border-dashed border-[#D8CBA8] bg-[#F7F3EB]/50 dark:bg-white/5 hover:bg-[#F7F3EB] dark:hover:bg-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-2 relative"
          >
              <div className="w-20 h-20 bg-gradient-to-b from-[#F2EBDC] to-[#D3BC8E] rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Plus size={40} className="text-[#3B4255]" strokeWidth={3} />
              </div>
              <span className="font-genshin font-bold text-[#8C7D6B] dark:text-[#D3BC8E] text-xl tracking-tighter">{t('new_quest')}</span>
              <Sparkles className="absolute top-6 right-6 text-[#D3BC8E]/40" size={24}/>
          </div>

          {filteredList.map(p => {
            // 🟢 核心修改 2：只有不在 ALLOWED_STATES 里的状态才算 Locked
            // 这样 'characters_ready'、'script_ready'、'completed' 都是解锁的
            const isLocked = !ALLOWED_STATES.includes(p.state);
            
            return (
              <div 
                key={p.id} 
                onClick={() => handleGo(p)} 
                className={`genshin-card dark:bg-[#2C313F] dark:border-[#4A5366] h-[280px] p-6 transition-all group flex flex-col border-2 border-[#D8CBA8] rounded-[2rem] bg-white 
                  ${isLocked 
                    ? 'opacity-80 grayscale-[0.6] cursor-not-allowed' // 锁定状态置灰
                    : 'cursor-pointer hover:-translate-y-2 hover:shadow-xl' // 活跃状态
                  }`}
              >
                <div className="flex justify-between items-start mb-4">
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-[#D3BC8E] shadow-md transition-transform ${isLocked ? 'bg-gray-200 text-gray-400' : 'bg-[#3B4255] text-[#D3BC8E] group-hover:rotate-12'}`}>
                     {/* 如果是 created/analyzing 显示加载中，其他非法状态显示锁，正常显示地图 */}
                     {(p.state === 'created' || p.state === 'analyzing') ? (
                       <Loader2 className="animate-spin" size={24} />
                     ) : (
                       isLocked ? <Lock size={20} /> : <Map size={24}/>
                     )}
                   </div>
                   <button 
                    onClick={(e) => handleDel(e, p.id)} 
                    className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-[#A4AAB6] hover:text-red-500 flex items-center justify-center transition-colors"
                   >
                     <Trash2 size={18}/>
                   </button>
                </div>
                
                <h3 className={`font-genshin font-bold text-xl line-clamp-2 mb-3 h-14 uppercase tracking-tight ${isLocked ? 'text-gray-500' : 'text-[#3B4255] dark:text-[#ECE5D8]'}`}>
                  {p.name}
                </h3>
                
                <div className="mb-auto">
                  <StatusTag s={p.state} />
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-[#D8CBA8]/20 text-[#8C7D6B] font-bold">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock size={14} className="text-[#D3BC8E] shrink-0"/>
                    <span className="truncate text-[10px]">
                      {p.created_at ? (
                        new Date(p.created_at).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-GB', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        }).replace(/\//g, '-') 
                      ) : '---'}
                    </span>
                  </div>
                  {!isLocked && <ChevronRight size={14} className="text-[#D3BC8E] transition-transform group-hover:translate-x-1"/>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}