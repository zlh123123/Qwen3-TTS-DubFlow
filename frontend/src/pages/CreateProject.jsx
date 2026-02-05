import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Trash2, Clock, Map, Compass, Sparkles, ChevronRight } from 'lucide-react';
import * as API from '../api/endpoints';
import SettingsModal from '../components/SettingsModal';
import CreateProjectModal from '../components/CreateProjectModal';
import { useLang } from '../contexts/LanguageContext';

export default function CreateProject() {
  const { t } = useLang();
  const nav = useNavigate();
  
  const [list, setList] = useState([]);
  const [showSet, setShowSet] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  // 初始化加载：适配后端 { total, items } 结构
  useEffect(() => {
    API.getProjects().then(res => {
      // 🟢 关键：根据 API 文档解构 items
      setList(res.data?.items || []);
      setLoading(false);
    }).catch(err => {
      console.error("Load Projects Failed:", err);
      setLoading(false);
    });
  }, []);

  // 跳转逻辑：基于 API 定义的 state
  const handleGo = async (p) => {
    if (!p) return;
    try {
      // 1. 获取最新详情以确保状态同步
      const detail = await API.getProjectDetail(p.id);
      const state = detail.data?.state;

      // 2. 根据状态机跳转
      // 文档定义：created, analyzing, characters_ready, script_ready, synthesizing, completed
      const isPrep = ['created', 'analyzing'].includes(state);
      
      nav(`/project/${p.id}/${isPrep ? 'workshop' : 'studio'}`);
    } catch (e) {
      console.error("Fetch detail failed, maybe project was deleted");
    }
  };

  const handleDel = async (e, pid) => {
    e.stopPropagation();
    if (!window.confirm(t('del_confirm') || 'Confirm Delete?')) return;
    
    // 乐观删除 UI 反馈
    setList(prev => prev.filter(item => item.id !== pid));
    
    try { 
      await API.deleteProject(pid); 
    } catch (err) { 
      console.error("Delete failed:", err);
      // 失败后刷新列表以保持同步
      API.getProjects().then(res => setList(res.data?.items || []));
    }
  };

  // 状态标签渲染：匹配 API 文档字段
  const StatusTag = ({ s }) => {
    const map = {
      'created': { text: t('status_created'), cls: 'text-gray-500 bg-gray-100 border-gray-200' },
      'analyzing': { text: t('status_analyzing'), cls: 'text-blue-500 bg-blue-50 border-blue-200 animate-pulse' },
      'characters_ready': { text: '角色就绪', cls: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
      'script_ready': { text: '剧本就绪', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      'synthesizing': { text: t('status_synthesizing'), cls: 'text-purple-600 bg-purple-50 border-purple-200' },
      'completed': { text: t('status_completed'), cls: 'text-[#9A7D48] bg-[#F5EBDA] border-[#D3BC8E]' },
    };
    const config = map[s] || { text: s, cls: 'text-gray-400 border-gray-200' };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${config.cls}`}>
        {config.text}
      </span>
    );
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold bg-[#F0F2F5] dark:bg-[#1B1D22]">
      {t('loading') || 'Loading...'}
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-[#F0F2F5] dark:bg-[#1B1D22] transition-colors duration-300">
      
      {/* 弹窗组件 */}
      <SettingsModal open={showSet} close={() => setShowSet(false)} />
      <CreateProjectModal 
        open={showNew} 
        close={() => setShowNew(false)} 
        onCreated={(newP) => setList([newP, ...list])} 
      />

      {/* Header */}
      <header className="sticky top-6 mx-auto max-w-7xl px-6 z-20">
        <div className="paimon-menu px-6 py-3 flex justify-between items-center border-2 border-[#D8CBA8] bg-white/90 dark:bg-[#12141A]/90 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ECE5D8] rounded-full flex items-center justify-center border-2 border-[#D3BC8E] shadow-[0_0_10px_#D3BC8E]">
              <Compass className="text-[#3B4255]" size={24}/>
            </div>
            <div>
              <h1 className="font-genshin font-bold text-xl text-[#D3BC8E] tracking-widest">{t('app_title') || 'DUBFLOW'}</h1>
              <div className="text-[10px] text-gray-400 font-medium uppercase">{t('rank')}</div>
            </div>
          </div>
          <button 
            onClick={() => setShowSet(true)} 
            className="w-10 h-10 rounded-full bg-[#3B4255] border-2 border-[#6A7080] hover:border-[#D3BC8E] flex items-center justify-center text-[#ECE5D8] transition-all shadow-md active:scale-90"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex items-center gap-4 mb-10">
           <div className="h-8 w-1.5 bg-[#D3BC8E] rounded-full shadow-sm"></div>
           <h2 className="text-3xl font-genshin font-bold text-[#495366] dark:text-[#ECE5D8] flex items-baseline gap-3 transition-colors">
             {t('quest_log')} 
             <span className="text-lg text-[#A4AAB6] font-sans font-normal italic">{t('quest_sub')}</span>
           </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          
          {/* Create Button */}
          <div 
            onClick={() => setShowNew(true)} 
            className="group h-[280px] border-4 border-dashed border-[#D8CBA8] bg-[#F7F3EB]/50 dark:bg-white/5 hover:bg-[#F7F3EB] dark:hover:bg-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-2 relative"
          >
             <div className="w-20 h-20 bg-gradient-to-b from-[#F2EBDC] to-[#D3BC8E] rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
               <Plus size={40} className="text-[#3B4255]" strokeWidth={3} />
             </div>
             <span className="font-genshin font-bold text-[#8C7D6B] dark:text-[#D3BC8E] text-xl transition-colors">{t('new_quest')}</span>
             <Sparkles className="absolute top-6 right-6 text-[#D3BC8E]/40" size={24}/>
          </div>

          {/* Project Items */}
          {(list || []).map(p => (
             <div 
               key={p.id} 
               onClick={() => handleGo(p)} 
               className="genshin-card dark:bg-[#2C313F] dark:border-[#4A5366] h-[280px] p-6 cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all group flex flex-col border-2 border-[#D8CBA8]"
             >
                <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 bg-[#3B4255] rounded-full flex items-center justify-center border-2 border-[#D3BC8E] text-[#D3BC8E] shadow-md group-hover:rotate-12 transition-transform">
                     <Map size={24}/>
                   </div>
                   <button 
                     onClick={(e) => handleDel(e, p.id)} 
                     className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-[#A4AAB6] hover:text-red-500 flex items-center justify-center transition-colors"
                   >
                     <Trash2 size={18}/>
                   </button>
                </div>

                <h3 className="font-genshin font-bold text-xl text-[#3B4255] dark:text-[#ECE5D8] line-clamp-2 mb-3 h-14 group-hover:text-[#BC9B67] transition-colors uppercase tracking-tight">
                  {p.name}
                </h3>

                <div className="mb-auto">
                  {/* 使用 p.state 对应 API 文档 */}
                  <StatusTag s={p.state} />
                </div>

                <div className="mt-4 pt-4 border-t-2 border-[#D8CBA8]/20 flex justify-between items-center text-xs text-[#8C7D6B] font-bold">
                   <div className="flex items-center gap-1.5 transition-colors">
                     <Clock size={14} className="text-[#D3BC8E]"/>
                     <span>{new Date(p.created_at).toLocaleDateString()}</span>
                   </div>
                   <ChevronRight size={14} className="text-[#D3BC8E] transition-transform group-hover:translate-x-1"/>
                </div>
             </div>
          ))}
        </div>
      </main>

      {/* Decorative Footer Deco */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D3BC8E]/50 to-transparent pointer-events-none"></div>
    </div>
  );
}