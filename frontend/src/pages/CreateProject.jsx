import React, { useState, useRef, useMemo } from 'react'; // 引入 useMemo
import { useNavigate } from 'react-router-dom';
import { createProject } from '../api/endpoints';
import { BookOpen, ArrowRight, Upload, FileText, X, Clock, AlignLeft } from 'lucide-react';
import { Settings } from 'lucide-react'; // 引入图标
import SettingsModal from '../components/SettingsModal'; // 引入组件

export default function CreateProject() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 新增状态
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // --- 新增：计算预估时长 (基于 250字/分钟 的语速) ---
  const stats = useMemo(() => {
    const charCount = text.length;
    // 假设平均语速：每分钟 250 字 (约 4.2 字/秒)
    const totalSeconds = Math.ceil(charCount / 4.2);
    
    // 格式化为 MM:SS
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeString = minutes > 0 
      ? `${minutes}分 ${seconds}秒` 
      : `${seconds}秒`;

    return { charCount, timeString };
  }, [text]);

  const handleFileRead = (file) => {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      alert('目前版本仅支持 .txt 格式的小说文件');
      return;
    }
    if (!title) setTitle(file.name.replace('.txt', ''));

    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.onerror = () => alert('文件读取失败');
    reader.readAsText(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileRead(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) handleFileRead(e.target.files[0]);
  };

  const handleCreate = async () => {
    if (!text || !title) return alert("请填写项目名称并输入/上传小说内容");
    setLoading(true);
    try {
      const res = await createProject({ name: title, content: text });
      navigate(`/project/${res.data.id}/workshop`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      
      {/* 🔴 挂载弹窗组件 */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row relative">
        
        {/* 🔴 右上角设置按钮 (绝对定位) */}
        <button 
           onClick={() => setIsSettingsOpen(true)}
           className="absolute top-4 right-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors z-10"
           title="系统设置"
        >
           <Settings size={20} />
        </button>

        {/* 左侧装饰 */}
        <div className="hidden md:flex bg-blue-600 w-1/3 flex-col items-center justify-center p-8 text-white text-center">
          <div className="bg-white/10 p-4 rounded-full mb-6">
            <BookOpen size={48} className="text-white" />
          </div>
          {/* 🔴 更名 */}
          <h1 className="text-2xl font-bold mb-2">DubFlow</h1> 
          <p className="text-blue-100 text-sm leading-relaxed opacity-90">
            全自动 AI 配音工作台
          </p>
        </div>

        {/* 右侧表单 */}
        <div className="flex-1 p-8 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><FileText size={20}/></span>
            创建新项目
          </h2>

          <div className="space-y-5 flex-1 flex flex-col">
            {/* 项目名称 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">项目名称</label>
              <input 
                className="w-full border border-gray-200 bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例如：斗破苍穹第一章"
              />
            </div>

            {/* 文件上传/拖拽 */}
            {!text && (
              <div>
                 <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileSelect} />
                 <div 
                   onClick={() => fileInputRef.current.click()}
                   onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                   className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all group ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                 >
                    <div className="bg-white p-3 rounded-full shadow-sm w-fit mx-auto mb-3 group-hover:scale-110 transition-transform"><Upload size={24} className="text-blue-600" /></div>
                    <p className="text-sm text-gray-600 font-medium">点击上传 或 拖拽 .txt 文件</p>
                 </div>
              </div>
            )}

            {/* 文本编辑区 (带字数统计) */}
            <div className="relative group flex-1 flex flex-col">
              <div className="flex-1 relative">
                <textarea 
                  className="w-full h-48 border border-gray-200 p-3 pb-8 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm leading-relaxed text-gray-600 custom-scrollbar" 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="或者直接在这里粘贴小说正文..."
                />
                
                {/* 清空按钮 */}
                {text && (
                   <button onClick={() => setText('')} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="清空文本"><X size={16}/></button>
                )}
              </div>

              {/* ✨✨✨ 字数统计与时长预估栏 ✨✨✨ */}
              <div className="mt-2 flex justify-between items-center text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4">
                   <span className="flex items-center gap-1.5">
                      <AlignLeft size={14} className="text-blue-500"/> 
                      <span>{stats.charCount.toLocaleString()} 字</span>
                   </span>
                   {stats.charCount > 0 && (
                     <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        <Clock size={14}/> 
                        <span>预估时长: {stats.timeString}</span>
                     </span>
                   )}
                </div>
                {stats.charCount > 5000 && <span className="text-red-500">文本较长，建议分段</span>}
              </div>
            </div>

            {/* 提交按钮 */}
            <button 
              onClick={handleCreate} disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 active:scale-[0.98]'}`}
            >
              {loading ? (
                <> <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> <span>AI 分析中...</span> </>
              ) : (
                <> 开始创作 <ArrowRight size={20} /> </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}