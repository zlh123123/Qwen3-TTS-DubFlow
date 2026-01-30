import React, { useState, useEffect } from 'react';
import { X, Save, Server, Key, Cpu } from 'lucide-react';
import { getSettings, updateSettings } from '../api/endpoints';

export default function SettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    llm_provider: 'qwen',
    api_key: '',
    base_url: ''
  });

  // 打开弹窗时加载配置
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await getSettings();
      setFormData(res.data);
    } catch (e) {
      console.error("加载配置失败", e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings(formData);
      onClose(); // 保存成功后关闭
      alert("设置已保存！");
    } catch (e) {
      alert("保存失败");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        
        {/* 标题栏 */}
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server size={20} className="text-blue-600"/> 系统设置
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1 transition">
            <X size={20} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-5">
          
          {/* 1. 模型选择 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Cpu size={16}/> LLM 模型提供商
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['qwen', 'deepseek', 'local'].map((provider) => (
                <button
                  key={provider}
                  onClick={() => setFormData({ ...formData, llm_provider: provider })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    formData.llm_provider === provider
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {provider === 'local' ? '本地部署' : provider === 'qwen' ? '通义千问' : 'DeepSeek'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 本地部署地址 (仅在 Local 模式显示) */}
          {formData.llm_provider === 'local' && (
            <div className="animate-fade-in-down">
              <label className="block text-sm font-bold text-gray-700 mb-2">API Base URL</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="http://localhost:11434/v1"
                value={formData.base_url}
                onChange={(e) => setFormData({...formData, base_url: e.target.value})}
              />
            </div>
          )}

          {/* 3. API Key */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Key size={16}/> API Key
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={formData.llm_provider === 'local' ? '本地模式通常无需 Key' : 'sk-................'}
              value={formData.api_key}
              onChange={(e) => setFormData({...formData, api_key: e.target.value})}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              * 您的 Key 仅存储在本地或直接发送至服务端，不会泄露。
            </p>
          </div>

        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 transition disabled:opacity-70"
          >
            {loading ? '保存中...' : <><Save size={18}/> 保存设置</>}
          </button>
        </div>

      </div>
    </div>
  );
}