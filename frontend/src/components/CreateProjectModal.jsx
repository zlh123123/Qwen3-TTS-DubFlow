import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, BookOpen, Clock, AlignLeft, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function CreateProjectModal({ open, close, onCreated }) {
  const { t } = useLang();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleClose = () => {
    setText('');
    setTitle('');
    setLoading(false);
    close();
  };

  const handleFileRead = (file) => {
    if (!file || !file.name.endsWith('.txt')) return alert('仅支持 .txt 文件');
    if (!title) setTitle(file.name.replace('.txt', ''));
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  const handleCreate = async () => {
    if (!text.trim() || !title.trim()) {
      alert("请填写完整的名称与脚本内容");
      return;
    }
    setLoading(true);
    try {
      // 🟢 这里的 res 已经是 response.data 了
      const res = await API.createProject({ 
        name: title.trim(), 
        content: text.trim() 
      });
      
      // 🟢 适配拦截器方案 A：判断 res 本身，如果 res.data 存在则用 res.data
      const d = res?.data || res; 
      
      if (d && d.id) {
        const safeProject = {
          id: String(d.id),
          name: String(d.name),
          state: String(d.state || 'created'),
          created_at: d.created_at || new Date().toISOString()
        };
        
        onCreated(safeProject); 
        handleClose();
      } else {
        throw new Error("后端返回格式无效");
      }
    } catch (e) {
      console.error("Submission Error:", e);
      alert('创建失败: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="genshin-card w-full max-w-2xl bg-[#ECE5D8] dark:bg-[#1B1D22] border-[3px] border-[#D3BC8E] p-0 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex justify-between items-center bg-[#3B4255] text-[#ECE5D8] border-b-2 border-[#D3BC8E]/30">
          <h2 className="text-xl font-genshin font-bold flex items-center gap-2 tracking-widest uppercase">
            <BookOpen className="text-[#D3BC8E]" size={22}/> INITIALIZE MISSION
          </h2>
          <button onClick={handleClose} className="text-[#D3BC8E] hover:scale-110 transition-transform p-1"><X size={24}/></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar text-[#495366] dark:text-[#ECE5D8]">
           <div className="space-y-2">
              <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={14} className="text-[#D3BC8E]"/> Project Codename
              </label>
              <input className="genshin-input w-full p-4 font-bold text-lg" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：提瓦特游记·第一卷" />
           </div>

           <div className="flex-1 flex flex-col space-y-2">
              <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest">Script Content</label>
              
              {/* 🟢 逻辑：如果没有文本显示上传框，有文本显示编辑框 */}
              {!text ? (
                <div 
                  onClick={() => fileInputRef.current.click()} 
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }} 
                  onDragLeave={e => { e.preventDefault(); setIsDragging(false); }} 
                  onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFileRead(e.dataTransfer.files[0]); }} 
                  className={`border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all ${isDragging ? 'border-[#D3BC8E] bg-[#D3BC8E]/10' : 'border-[#D8CBA8] hover:border-[#D3BC8E] bg-[#F7F3EB]/50 dark:bg-white/5'}`} 
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={e => handleFileRead(e.target.files[0])} />
                    <Upload size={48} className="mx-auto text-[#D3BC8E] mb-4 opacity-70"/>
                    <p className="text-[#8C7D6B] font-bold text-sm tracking-wide">拖拽 .txt 文件至此 或 点击上传</p>
                    <p className="text-[10px] text-gray-400 mt-2 italic">你也可以直接在下方输入或粘贴文本</p>
                </div>
              ) : (
                 <div className="relative group">
                    <textarea 
                      className="genshin-input w-full h-64 p-5 resize-none text-base leading-relaxed" 
                      value={text} 
                      onChange={e => setText(e.target.value)} 
                      placeholder="在此输入小说正文..."
                    />
                    <button onClick={() => setText('')} className="absolute top-4 right-4 w-8 h-8 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                      <X size={16}/>
                    </button>
                 </div>
              )}
              
              {/* 🟢 即使没有文件，也允许点击后直接开启输入模式 */}
              {!text && (
                <button 
                  onClick={() => setText(' ')} 
                  className="text-[10px] text-center text-[#D3BC8E] underline opacity-60 hover:opacity-100"
                >
                  跳过上传，手动输入文本
                </button>
              )}

              <div className="flex justify-between items-center bg-[#3B4255]/5 dark:bg-white/5 px-4 py-2 rounded-full border border-[#D3BC8E]/20">
                <div className="flex items-center gap-6 text-[10px] font-bold text-[#8C7D6B] tracking-widest">
                   <span className="flex items-center gap-1.5 uppercase"><AlignLeft size={14} className="text-[#D3BC8E]"/> {text.trim().length} Words</span>
                   {text.trim().length > 0 && <span className="flex items-center gap-1.5 uppercase text-orange-700/70"><Clock size={14} className="text-orange-400"/> EST: {stats.timeString}</span>}
                </div>
              </div>
           </div>
        </div>

        <div className="p-6 bg-[#3B4255]/5 dark:bg-black/20 flex justify-end gap-6 items-center border-t-2 border-[#D3BC8E]/10">
          <button onClick={handleClose} className="text-sm font-bold text-[#8C7D6B] hover:text-[#3B4255] transition-colors tracking-widest uppercase">Abandon</button>
          <button 
            onClick={handleCreate} 
            disabled={loading || !text.trim() || !title.trim()} 
            className="genshin-btn-primary px-12 py-3 shadow-xl flex items-center gap-3 font-genshin disabled:grayscale disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={20}/> : <><Wand2 size={20}/><span className="tracking-[0.2em]">{t('confirm')}</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}