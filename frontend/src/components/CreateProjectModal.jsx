import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, FileText, Plus, Trash2, Loader2, Type } from 'lucide-react';
import * as API from '../api/endpoints';
import { useLang } from '../contexts/LanguageContext';

export default function CreateProjectModal({ open, close, onCreated }) {
  const { t, lang } = useLang();
  const isZh = lang === 'zh-CN';
  const [title, setTitle] = useState('');
  const [filesData, setFilesData] = useState([]);
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setTitle('');
    setFilesData([]);
    setManualText('');
    setLoading(false);
    close();
  };

  const handleFiles = (files) => {
    const newFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.txt'));
    if (newFiles.length === 0) return;

    if (!title && newFiles.length > 0) {
      setTitle(newFiles[0].name.replace('.txt', ''));
    }

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilesData((prev) => [
          ...prev,
          { name: file.name, content: e.target.result }
        ]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index) => {
    setFilesData((prev) => prev.filter((_, i) => i !== index));
  };

  const mergedContent = useMemo(() => {
    const filePart = filesData
      .map((f) => `--- File: ${f.name} ---\n${f.content || ''}`)
      .join('\n\n');
    const manualPart = manualText.trim()
      ? `--- Manual Input ---\n${manualText.trim()}`
      : '';

    if (filePart && manualPart) return `${filePart}\n\n${manualPart}`;
    return filePart || manualPart;
  }, [filesData, manualText]);

  const contentForStats = useMemo(() => {
    return mergedContent.replace(/^---.*---$/gm, '').trim();
  }, [mergedContent]);

  const textLength = useMemo(() => contentForStats.length, [contentForStats]);
  const candidateLines = useMemo(() => {
    if (!contentForStats) return 0;
    return contentForStats
      .split(/[\r\n]+|(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z0-9"'“])/g)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 2).length;
  }, [contentForStats]);

  const canCreate = !!title.trim() && !!mergedContent.trim() && !loading;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);

    try {
      const res = await API.createProject({
        name: title.trim(),
        content: mergedContent
      });

      const d = res?.data || res;
      if (d && d.id) {
        const analyzeResponse = await API.analyzeCharacters(d.id);
        console.log('Character analyze task id:', analyzeResponse.task_id);

        d.state = 'analyzing_characters';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(2,12,27,0.38)] dark:border-[#343434] dark:bg-[#1a1a1a]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-[#343434]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-[#f0f0f0]">{t('new_quest')}</h2>
          <button
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2b2b2b] dark:hover:text-[#f0f0f0]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto bg-slate-50/50 p-6 dark:bg-[#1a1a1a]">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#aaaaaa]">
              {isZh ? '项目名称' : 'Project Name'}
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-800 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('project_codename')}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#aaaaaa]">
              {t('resources_label')}
            </label>
            <div
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${
                isDragging
                  ? 'border-blue-400 bg-blue-50/70 dark:border-[#4f6d96] dark:bg-[#2a2a2a]'
                  : 'border-slate-300 bg-white hover:border-slate-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:hover:border-[#555555]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Upload size={22} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-[#e6e6e6]">{t('upload_ph')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#9d9d9d]">.txt</p>
            </div>
          </div>

          {(filesData.length > 0 || manualText.trim()) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-[#3b3b3b] dark:bg-[#252526]">
                <span className="text-slate-500 dark:text-[#aaaaaa]">{t('word_count')}</span>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">{textLength}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-[#3b3b3b] dark:bg-[#252526]">
                <span className="text-slate-500 dark:text-[#aaaaaa]">{isZh ? '候选台词句' : 'Candidate Lines'}</span>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-[#f0f0f0]">
                  {candidateLines}
                </div>
              </div>
            </div>
          )}

          {filesData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#aaaaaa]">
                  {isZh ? '已上传文件' : 'Uploaded Files'}
                </label>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#dddddd] dark:hover:bg-[#2e2e2e]"
                >
                  <Plus size={12} />
                  {t('add_more')}
                </button>
              </div>
              <div className="space-y-2">
                {filesData.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-[#3b3b3b] dark:bg-[#252526]"
                  >
                    <div className="mr-2 flex min-w-0 items-center gap-2">
                      <FileText size={15} className="shrink-0 text-slate-500" />
                      <span className="truncate text-sm text-slate-700 dark:text-[#e1e1e1]">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:text-[#bbbbbb] dark:hover:bg-red-500/15 dark:hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#aaaaaa]">
              <span className="inline-flex items-center gap-1.5">
                <Type size={13} />
                {t('manual_input')}
              </span>
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={isZh ? '可直接粘贴文本内容，不上传文件也能创建项目。' : 'Paste text directly. You can create a project without uploading files.'}
              rows={6}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e6e6e6]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 dark:border-[#343434] dark:bg-[#1a1a1a]">
          <div className="text-xs text-slate-500 dark:text-[#9d9d9d]">
            {isZh ? '创建后将自动进入角色分析流程。' : 'Character analysis starts automatically after creation.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#3b3b3b] dark:bg-[#252526] dark:text-[#e0e0e0] dark:hover:bg-[#2e2e2e]"
            >
              {t('abandon')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-[#d9d9d9]"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
