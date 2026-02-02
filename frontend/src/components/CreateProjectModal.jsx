import React, { useState, useRef, useMemo } from 'react';
import { createProject } from '../api/endpoints';
import { X, Upload, FileText, ArrowRight, Clock, AlignLeft, BookOpen } from 'lucide-react';

export default function CreateProjectModal({ isOpen, onClose, onCreated }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 字数统计与时长预估
  const stats = useMemo(() => {
    const charCount = text.length;
    const totalSeconds = Math.ceil(charCount / 4.2); // 语速 250字/分
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { 
      charCount, 
      timeString: minutes > 0 ? `${minutes}分 ${seconds}秒` : `${seconds}秒` 
    };
  }, [text]);

  // 重置表单
  const resetForm = () => {
    setText('');
    setTitle('');
    setLoading(false);
  };

  // 关闭处理
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 文件处理
  const handleFileRead = (file) => {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') return alert('仅支持 .txt 文件');
    if (!title) setTitle(file.name.replace('.txt', ''));
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  // 提交逻辑
  const handleCreate = async () => {
    if (!text || !title) return alert("请填写完整信息");
    setLoading(true);
    try {
      const res = await createProject({ name: title, content: text });
      onCreated(res.data); // 通知父组件刷新列表
      handleClose(); // 关闭弹窗
    } catch (e) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <BookOpen className="text-blue-600" size={20}/> 新建配音项目
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <X size={20}/>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
           {/* 标题输入 */}
           <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">项目名称</label>
              <input 
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例如：斗破苍穹第一章"
                autoFocus
              />
           </div>

           {/* 文件拖拽与输入 */}
           <div className="flex-1 flex flex-col space-y-3">
              <label className="block text-sm font-bold text-gray-700">小说内容</label>
              
              {!text && (
                <div 
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleFileRead(e.dataTransfer.files[0]);
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                   <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={e => handleFileRead(e.target.files[0])} />
                   <Upload size={32} className="mx-auto text-gray-400 mb-2"/>
                   <p className="text-sm font-medium text-gray-600">点击上传 或 拖拽 .txt 文件</p>
                </div>
              )}

              {text && (
                 <div className="relative">
                   <textarea 
                     className="w-full h-48 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-600"
                     value={text}
                     onChange={e => setText(e.target.value)}
                   />
                   <button onClick={() => setText('')} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><X size={16}/></button>
                 </div>
              )}
              
              {/* 统计栏 */}
              <div className="flex justify-between items-center text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border">
                <div className="flex items-center gap-4">
                   <span className="flex items-center gap-1"><AlignLeft size={14}/> {stats.charCount.toLocaleString()} 字</span>
                   {stats.charCount > 0 && <span className="flex items-center gap-1 text-orange-600"><Clock size={14}/> {stats.timeString}</span>}
                </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">取消</button>
          <button 
            onClick={handleCreate}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-70"
          >
            {loading ? '创建中...' : <>立即创建 <ArrowRight size={18}/></>}
          </button>
        </div>

      </div>
    </div>
  );
}