import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, BookOpen, Clock, AlignLeft, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

// 🟢 修改 Prop 名为 open 和 close，确保首页点击能生效
export default function CreateProjectModal({ open, close, onCreated }) {
  const { t } = useLang();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 时长预估逻辑
  const stats = useMemo(() => {
    const charCount = text.length;
    const totalSeconds = Math.ceil(charCount / 4.2); 
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { 
      charCount, 
      timeString: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s` 
    };
  }, [text]);

  const resetForm = () => {
    setText('');
    setTitle('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    close(); // 🟢 调用父组件传下来的 close
  };

  // 读取 TXT 文件
  const handleFileRead = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.txt')) return alert('Only .txt supported');
    if (!title) setTitle(file.name.replace('.txt', ''));
    
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  // 🟢 接入后端提交逻辑
  const handleCreate = async () => {
    if (!text.trim() || !title.trim()) return;
    setLoading(true);
    try {
      const res = await API.createProject({ 
        name: title.trim(), 
        content: text.trim() 
      });
      
      // Axios 的数据在 res.data
      if (res?.data) {
        const d = res.data;
        
        // 🛡️ 预处理数据：将 datetime 强制转为字符串或 Date 对象
        const newProject = {
          id: String(d.id),
          name: String(d.name),
          state: String(d.state || 'created'),
          // 关键：如果 created_at 是对象，转成字符串防止渲染报错
          created_at: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString()
        };

        console.log("Safe project data sending to list:", newProject);
        onCreated(newProject); 
        handleClose();
      }
    } catch (e) {
      console.error("Submission Error:", e);
      alert('创建失败: ' + (e.response?.data?.detail?.[0]?.msg || e.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null; // 🟢 对应首页的 showNew 状态

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="genshin-card w-full max-w-2xl bg-[#ECE5D8] dark:bg-[#1B1D22] border-[3px] border-[#D3BC8E] p-0 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
        
        {/* Header - 原神任务风格 */}
        <div className="px-6 py-4 flex justify-between items-center bg-[#3B4255] text-[#ECE5D8] border-b-2 border-[#D3BC8E]/30">
          <h2 className="text-xl font-genshin font-bold flex items-center gap-2 tracking-widest uppercase">
            <BookOpen className="text-[#D3BC8E]" size={22}/> INITIALIZE MISSION
          </h2>
          <button onClick={handleClose} className="text-[#D3BC8E] hover:scale-110 transition-transform p-1">
            <X size={24}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar text-[#495366] dark:text-[#ECE5D8]">
           {/* 项目标题 */}
           <div className="space-y-2">
              <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={14} className="text-[#D3BC8E]"/> Project Codename
              </label>
              <input 
                className="genshin-input w-full p-4 font-bold text-lg"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例如：提瓦特游记·第一卷"
              />
           </div>

           {/* 文本区域 */}
           <div className="flex-1 flex flex-col space-y-2">
              <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest">Script / Text Content</label>
              
              {!text ? (
                <div 
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleFileRead(e.dataTransfer.files[0]);
                  }}
                  className={`border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-[#D3BC8E] bg-[#D3BC8E]/10' : 'border-[#D8CBA8] hover:border-[#D3BC8E] bg-[#F7F3EB]/50 dark:bg-white/5'
                  }`}
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={e => handleFileRead(e.target.files[0])} />
                    <Upload size={48} className="mx-auto text-[#D3BC8E] mb-4 opacity-70"/>
                    <p className="text-[#8C7D6B] font-bold text-sm tracking-wide">
                      拖拽 .txt 文件至此 或 点击上传
                    </p>
                </div>
              ) : (
                 <div className="relative group">
                    <textarea 
                      className="genshin-input w-full h-64 p-5 resize-none text-base leading-relaxed"
                      value={text}
                      onChange={e => setText(e.target.value)}
                    />
                    <button 
                      onClick={() => setText('')} 
                      className="absolute top-4 right-4 w-8 h-8 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <X size={16}/>
                    </button>
                 </div>
              )}
              
              {/* 统计底栏 */}
              <div className="flex justify-between items-center bg-[#3B4255]/5 dark:bg-white/5 px-4 py-2 rounded-full border border-[#D3BC8E]/20">
                <div className="flex items-center gap-6 text-[10px] font-bold text-[#8C7D6B] tracking-widest">
                   <span className="flex items-center gap-1.5 uppercase"><AlignLeft size={14} className="text-[#D3BC8E]"/> {text.length} Words</span>
                   {text.length > 0 && <span className="flex items-center gap-1.5 uppercase text-orange-700/70"><Clock size={14} className="text-orange-400"/> EST: {stats.timeString}</span>}
                </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#3B4255]/5 dark:bg-black/20 flex justify-end gap-6 items-center border-t-2 border-[#D3BC8E]/10">
          <button onClick={handleClose} className="text-sm font-bold text-[#8C7D6B] hover:text-[#3B4255] dark:hover:text-white transition-colors tracking-widest uppercase">
            Abandon
          </button>
          
          <button 
            onClick={handleCreate}
            disabled={loading || !text || !title}
            className="genshin-btn-primary px-12 py-3 shadow-xl flex items-center gap-3 font-genshin disabled:grayscale disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={20}/>
            ) : (
              <>
                <Wand2 size={20}/>
                <span className="tracking-[0.2em]">{t('confirm')}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}