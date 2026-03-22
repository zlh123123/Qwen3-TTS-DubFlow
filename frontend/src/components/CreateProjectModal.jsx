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

  const textLength = useMemo(() => mergedContent.length, [mergedContent]);
  const estimatedMinutes = useMemo(() => {
    if (!textLength) return 0;
    return Math.max(1, Math.round(textLength / 220));
  }, [textLength]);

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
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(2,12,27,0.38)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('new_quest')}</h2>
          <button
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-900/30">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {isZh ? '项目名称' : 'Project Name'}
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('project_codename')}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                  ? 'border-blue-400 bg-blue-50/70 dark:bg-blue-900/20'
                  : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800'
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
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('upload_ph')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">.txt</p>
            </div>
          </div>

          {(filesData.length > 0 || manualText.trim()) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">{t('word_count')}</span>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{textLength}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">{t('est_time')}</span>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {isZh ? `${estimatedMinutes} 分钟` : `${estimatedMinutes} min`}
                </div>
              </div>
            </div>
          )}

          {filesData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isZh ? '已上传文件' : 'Uploaded Files'}
                </label>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Plus size={12} />
                  {t('add_more')}
                </button>
              </div>
              <div className="space-y-2">
                {filesData.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="mr-2 flex min-w-0 items-center gap-2">
                      <FileText size={15} className="shrink-0 text-slate-500" />
                      <span className="truncate text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isZh ? '创建后将自动进入角色分析流程。' : 'Character analysis starts automatically after creation.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('abandon')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
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
