import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Trash2, Clock, MoreHorizontal, Github, FolderOpen } from 'lucide-react';
import { getProjects, deleteProject } from '../api/endpoints';
import SettingsModal from '../components/SettingsModal';
import CreateProjectModal from '../components/CreateProjectModal';

export default function CreateProject() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // 初始化加载项目
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      setProjects(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 智能路由逻辑
  const handleEnterProject = (project) => {
    const status = project.status;
    
    // 阶段1：角色相关 -> 去角色工坊
    if (['created', 'analyzing_characters', 'characters_ready'].includes(status)) {
      navigate(`/project/${project.id}/workshop`);
    } 
    // 阶段2：剧本与合成 -> 去演播室
    else if (['parsing_script', 'script_ready', 'synthesizing', 'completed'].includes(status)) {
      navigate(`/project/${project.id}/studio`);
    } 
    // 默认 Fallback
    else {
      navigate(`/project/${project.id}/workshop`);
    }
  };

  const handleDelete = async (e, pid) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这个项目吗？")) return;
    await deleteProject(pid);
    setProjects(prev => prev.filter(p => p.id !== pid));
  };

  // 状态标签渲染辅助函数
  const renderStatusBadge = (status) => {
    const map = {
      'created': { color: 'bg-gray-100 text-gray-600', text: '初始化' },
      'analyzing_characters': { color: 'bg-blue-100 text-blue-700', text: '🔵 角色分析中' },
      'characters_ready': { color: 'bg-green-100 text-green-700', text: '🟢 角色就绪' },
      'parsing_script': { color: 'bg-yellow-100 text-yellow-700', text: '剧本切分中' },
      'synthesizing': { color: 'bg-indigo-100 text-indigo-700', text: '🟣 合成中' },
      'completed': { color: 'bg-emerald-100 text-emerald-700', text: '✅ 已完成' },
    };
    const config = map[status] || map['created'];
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      
      {/* 弹窗挂载 */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <CreateProjectModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onCreated={(newProject) => {
            // 将新项目插入到列表最前面
            setProjects([newProject, ...projects]);
        }} 
      />

      {/* 顶部导航栏 */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">Q</div>
          <h1 className="font-bold text-xl tracking-tight">Qwen3-DubFlow</h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-gray-800 transition-colors">
            <Github size={20} />
          </a>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors"
          >
            <Settings size={16} /> 设置
          </button>
        </div>
      </header>

      {/* 主体内容区 */}
      <main className="max-w-6xl mx-auto p-8">
        
        {/* 标题与筛选 (预留) */}
        <div className="flex justify-between items-end mb-6">
           <div>
             <h2 className="text-2xl font-bold text-gray-900">我的项目</h2>
             <p className="text-gray-500 text-sm mt-1">管理您的小说配音工程</p>
           </div>
           {/* 未来可以加筛选器 */}
        </div>

        {/* 项目网格列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {/* 1. 新建卡片 (Big Button) */}
          <div 
            onClick={() => setIsCreateOpen(true)}
            className="group h-[220px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all active:scale-[0.98]"
          >
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform shadow-sm">
               <Plus size={32} />
             </div>
             <span className="font-bold text-gray-600 group-hover:text-blue-600">新建项目</span>
             <span className="text-xs text-gray-400 mt-1">支持 .txt 导入</span>
          </div>

          {/* 2. 项目列表渲染 */}
          {loading ? (
             <div className="col-span-full text-center py-20 text-gray-400">加载中...</div>
          ) : projects.map(project => (
             <div 
               key={project.id}
               onClick={() => handleEnterProject(project)}
               className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group flex flex-col h-[220px] relative"
             >
                {/* 顶部：标题与更多 */}
                <div className="flex justify-between items-start mb-3">
                   <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
                     <FolderOpen size={20}/>
                   </div>
                   <button 
                     onClick={(e) => handleDelete(e, project.id)}
                     className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                     title="删除项目"
                   >
                     <Trash2 size={16}/>
                   </button>
                </div>

                {/* 标题 */}
                <h3 className="font-bold text-lg text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                  {project.name}
                </h3>

                {/* 状态标签 */}
                <div className="mb-auto">
                  {renderStatusBadge(project.status)}
                </div>

                {/* 底部信息：进度条 & 时间 */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                   {/* 如果在合成中，显示进度条 */}
                   {project.status === 'synthesizing' && project.progress ? (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>合成进度</span>
                          <span>{project.progress.current}/{project.progress.total}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                            style={{width: `${(project.progress.current / project.progress.total) * 100}%`}}
                          ></div>
                        </div>
                      </div>
                   ) : (
                      // 否则显示时间
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12}/>
                        {new Date(project.created_at).toLocaleDateString()}
                      </div>
                   )}
                </div>
             </div>
          ))}

        </div>
      </main>
    </div>
  );
}