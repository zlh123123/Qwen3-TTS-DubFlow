import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Trash2, Clock, Map, Compass, Sparkles } from 'lucide-react';
import * as API from '../api/endpoints';
import SettingsModal from '../components/SettingsModal';
import CreateProjectModal from '../components/CreateProjectModal';

export default function CreateProject() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [showSet, setShowSet] = useState(false); // 设置弹窗开关
  const [showNew, setShowNew] = useState(false); // 新建弹窗开关

  useEffect(() => {
    API.getProjects().then(res => setList(res.data));
  }, []);

  const go = (p) => {
    // 简单的状态判断：还在准备阶段去 Page2，否则去 Page3
    const isPrep = ['created', 'analyzing_characters'].includes(p.status);
    navigate(`/project/${p.id}/${isPrep ? 'workshop' : 'studio'}`);
  };

  const del = async (e, pid) => {
    e.stopPropagation();
    if (!confirm('确定要放弃这个委托吗？')) return;
    setList(prev => prev.filter(p => p.id !== pid));
    await API.deleteProject(pid);
  };

  // 元素属性状态
  const StatusTag = ({ s }) => {
    const map = {
      created: { t: '草·构思', c: 'text-green-600 bg-green-100 border-green-200' },
      analyzing_characters: { t: '水·分析', c: 'text-blue-500 bg-blue-50 border-blue-200' },
      synthesizing: { t: '雷·合成', c: 'text-purple-600 bg-purple-50 border-purple-200' },
      completed: { t: '金·完成', c: 'text-[#9A7D48] bg-[#F5EBDA] border-[#D3BC8E]' },
    };
    const conf = map[s] || map.created;
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${conf.c}`}>{conf.t}</span>;
  };

  return (
    <div className="min-h-screen pb-20">
      {/* 只有这里挂载了设置组件 */}
      <SettingsModal open={showSet} close={() => setShowSet(false)} />
      <CreateProjectModal isOpen={showNew} onClose={() => setShowNew(false)} onCreated={(p) => setList([p, ...list])} />

      {/* 派蒙菜单栏 */}
      <header className="sticky top-6 mx-auto max-w-7xl px-6 z-20">
        <div className="paimon-menu px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ECE5D8] rounded-full flex items-center justify-center border-2 border-[#D3BC8E] shadow-[0_0_10px_#D3BC8E]">
              <Compass className="text-[#3B4255]" size={24}/>
            </div>
            <div>
              <h1 className="font-genshin font-bold text-xl text-[#D3BC8E] tracking-widest drop-shadow-sm">DUBFLOW</h1>
              <div className="text-[10px] text-gray-300 tracking-wide">ADVENTURE RANK 60</div>
            </div>
          </div>
          
          {/* 这里是唯一的设置按钮入口 */}
          <button 
            onClick={() => setShowSet(true)} 
            className="w-10 h-10 rounded-full bg-[#3B4255] border-2 border-[#6A7080] hover:border-[#D3BC8E] flex items-center justify-center text-[#ECE5D8] transition-all active:scale-90"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* 任务列表 */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex items-center gap-4 mb-8">
           <div className="h-8 w-1.5 bg-[#D3BC8E] rounded-full"></div>
           <h2 className="text-3xl font-genshin font-bold text-[#495366]">委托记录</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          
          {/* 新委托按钮 */}
          <div 
            onClick={() => setShowNew(true)}
            className="group h-[280px] border-4 border-dashed border-[#D8CBA8] bg-[#F7F3EB]/50 hover:bg-[#F7F3EB] rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-1 relative"
          >
             <div className="w-20 h-20 bg-gradient-to-b from-[#F2EBDC] to-[#D3BC8E] rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
               <Plus size={40} className="text-[#3B4255]" />
             </div>
             <span className="font-genshin font-bold text-[#8C7D6B] text-lg group-hover:text-[#D3BC8E]">新委托</span>
             <Sparkles className="absolute top-6 right-6 text-[#D3BC8E]/40" size={20}/>
          </div>

          {/* 委托卡片 */}
          {list.map(p => (
             <div 
               key={p.id}
               onClick={() => go(p)}
               className="genshin-card h-[280px] p-6 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group flex flex-col"
             >
                <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 bg-[#3B4255] rounded-full flex items-center justify-center border-2 border-[#D3BC8E] text-[#D3BC8E] shadow-md">
                     <Map size={24}/>
                   </div>
                   <button onClick={(e) => del(e, p.id)} className="w-8 h-8 rounded-full hover:bg-red-50 text-[#A4AAB6] hover:text-red-500 flex items-center justify-center transition">
                     <Trash2 size={18}/>
                   </button>
                </div>

                <h3 className="font-genshin font-bold text-xl text-[#3B4255] line-clamp-2 mb-2 group-hover:text-[#BC9B67] transition-colors">
                  {p.name}
                </h3>

                <div className="mb-auto">
                  <StatusTag s={p.status} />
                </div>

                <div className="mt-4 pt-4 border-t-2 border-[#D8CBA8]/20 flex justify-between items-center text-xs text-[#8C7D6B] font-bold">
                   <div className="flex items-center gap-1.5">
                     <Clock size={14}/>
                     {new Date(p.created_at).toLocaleDateString()}
                   </div>
                </div>
             </div>
          ))}
        </div>
      </main>
    </div>
  );
}