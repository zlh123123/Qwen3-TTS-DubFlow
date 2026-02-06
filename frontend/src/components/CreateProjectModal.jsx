import React, { useState, useRef } from 'react';
import { X, Upload, BookOpen, FileText, Plus, Wand2, RefreshCw, Trash2 } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function CreateProjectModal({ open, close, onCreated }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [filesData, setFilesData] = useState([]); // 存储 { name: string, content: string }
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setTitle('');
    setFilesData([]);
    setLoading(false);
    close();
  };

  // 处理文件读取（支持多选）
  const handleFiles = (files) => {
    const newFiles = Array.from(files).filter(f => f.name.endsWith('.txt'));
    if (newFiles.length === 0) return; // 建议此处也可以国际化 alert 消息

    if (!title && newFiles.length > 0) {
      setTitle(newFiles[0].name.replace('.txt', ''));
    }

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilesData(prev => [
          ...prev,
          { name: file.name, content: e.target.result }
        ]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index) => {
    setFilesData(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (filesData.length === 0 || !title.trim()) return;
    setLoading(true);

    try {
      const mergedContent = filesData.map(f => `--- File: ${f.name} ---\n${f.content}`).join('\n\n');
      const res = await API.createProject({
        name: title.trim(),
        content: mergedContent
      });

      const d = res?.data || res;
      if (d && d.id) {
        // 立即调用角色分析
        const analyzeResponse = await API.analyzeCharacters(d.id);
        console.log('角色分析任务ID:', analyzeResponse.task_id);

        // 更新项目状态为 analyzing（前端立即显示）
        d.state = 'analyzing';

        onCreated(d);
        handleClose();
      }
    } catch (e) {
      console.error("Create project failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="genshin-card w-full max-w-2xl bg-[#ECE5D8] dark:bg-[#1B1D22] border-[3px] border-[#D3BC8E] p-0 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl rounded-[2rem]">

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center bg-[#3B4255] text-[#ECE5D8] border-b-2 border-[#D3BC8E]/30">
          <h2 className="text-xl font-genshin font-bold flex items-center gap-2 tracking-widest uppercase">
            <BookOpen className="text-[#D3BC8E]" size={22} /> {t('new_quest')}
          </h2>
          <button onClick={handleClose} className="text-[#D3BC8E] hover:rotate-90 transition-transform p-1"><X size={24} /></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {/* 项目名称 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest flex items-center gap-1">
              {t('project_codename')}
            </label>
            <input
              className="genshin-input w-full p-4 font-bold text-lg"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('project_codename')}
            />
          </div>

          {/* 文件上传区域 */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-[#8C7D6B] uppercase tracking-widest">{t('resources_label')}</label>

            <div
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${isDragging ? 'border-[#D3BC8E] bg-[#D3BC8E]/10' : 'border-[#D8CBA8] bg-[#F7F3EB]/50 dark:bg-white/5 hover:border-[#D3BC8E]'
                }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept=".txt" multiple onChange={e => handleFiles(e.target.files)} />
              <Upload size={32} className="text-[#D3BC8E] opacity-70" />
              <p className="text-[#8C7D6B] font-bold text-sm">{t('upload_ph')}</p>
            </div>

            {/* 文件名列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filesData.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/60 dark:bg-black/20 border border-[#D3BC8E]/30 rounded-xl animate-scale-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={18} className="text-[#D3BC8E] shrink-0" />
                    <span className="text-sm font-bold text-[#495366] dark:text-[#ECE5D8] truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {filesData.length > 0 && (
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#D8CBA8] rounded-xl text-[#8C7D6B] hover:bg-[#D3BC8E]/10 transition-all text-sm font-bold"
                >
                  <Plus size={16} /> {t('add_more')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#3B4255]/5 dark:bg-black/20 flex justify-end gap-6 items-center border-t-2 border-[#D3BC8E]/10">
          <button onClick={handleClose} className="text-sm font-bold text-[#8C7D6B] hover:text-[#3B4255] transition-colors tracking-widest uppercase">{t('abandon')}</button>
          <button
            onClick={handleCreate}
            disabled={loading || filesData.length === 0 || !title.trim()}
            className="genshin-btn-primary px-12 py-3 shadow-xl flex items-center gap-3 font-genshin disabled:grayscale disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <><Wand2 size={20} /><span className="tracking-[0.2em]">{t('confirm')}</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}