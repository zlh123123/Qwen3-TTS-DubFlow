import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Settings, Edit3, Play, MoreHorizontal, RefreshCw, 
  Layers, Plus, Trash2, Mic, Filter, Zap, ChevronDown 
} from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import { getScript, synthesize, getCharacters, addLine, deleteLine } from '../api/endpoints';
import SettingsModal from '../components/SettingsModal';

export default function Studio() {
  const { pid } = useParams();
  
  // 数据状态
  const [scriptLines, setScriptLines] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 批量操作状态
  const [batchFilters, setBatchFilters] = useState({
    onlyPending: true,  // 仅合成未完成
    skipAside: false,   // 跳过旁白 (假设旁白ID为0或特定标记)
  });

  // 轮询钩子
  const { startPolling, loading: isGlobalLoading } = useTaskPoller();

  // 初始化加载
  useEffect(() => {
    async function init() {
       try {
         // 并行加载角色库和剧本
         const [charRes, scriptRes] = await Promise.all([
           getCharacters(pid),
           getScript(pid)
         ]);
         setCharacters(charRes.data);
         setScriptLines(scriptRes.data);
       } catch (e) {
         console.error("加载失败", e);
       }
    }
    init();
  }, [pid]);

  const activeLine = scriptLines.find(l => l.id === selectedLineId) || null;

  // --- 核心逻辑 ---

  // 1. 修改本地台词数据 (通用更新函数)
  const updateLocalLine = (lineId, fields) => {
    setScriptLines(lines => lines.map(l => 
      l.id === lineId ? { ...l, ...fields } : l
    ));
  };

  // 2. 指派角色 (点击头像切换)
  const handleAssignCharacter = (lineId, newCharId) => {
    const targetChar = characters.find(c => c.id === parseInt(newCharId));
    if (targetChar) {
      updateLocalLine(lineId, { 
        character_id: targetChar.id, 
        character_name: targetChar.name 
      });
    }
  };

  // 3. 增删台词
  const handleAddLine = async (prevLineId) => {
    // 调用 API 创建新行
    const res = await addLine(pid, prevLineId);
    const newLine = res.data;
    
    // 插入到数组中正确位置
    const index = scriptLines.findIndex(l => l.id === prevLineId);
    const newScript = [...scriptLines];
    newScript.splice(index + 1, 0, newLine);
    setScriptLines(newScript);
    setSelectedLineId(newLine.id); // 选中新行
  };

  const handleDeleteLine = async (e, lineId) => {
    e.stopPropagation();
    if (!window.confirm("确定删除这句台词吗？")) return;
    
    await deleteLine(lineId);
    setScriptLines(lines => lines.filter(l => l.id !== lineId));
    if (selectedLineId === lineId) setSelectedLineId(null);
  };

  // 4. 单句合成
  const handleSynthesizeLine = async (lineId) => {
    updateLocalLine(lineId, { status: 'processing' });
    try {
      const res = await synthesize({ project_id: pid, line_ids: [lineId] });
      startPolling(res.data.task_id, (result) => {
        updateLocalLine(lineId, { status: 'synthesized', audio_url: result.audio_url });
      });
    } catch (e) {
      updateLocalLine(lineId, { status: 'failed' });
    }
  };

  // 5. 批量合成
  const handleBatchSynthesize = async () => {
    // 根据筛选条件过滤 ID
    const targetLines = scriptLines.filter(line => {
       if (batchFilters.onlyPending && line.status === 'synthesized') return false;
       // if (batchFilters.skipAside && line.character_name === 'Aside') return false;
       return true;
    });

    if (targetLines.length === 0) return alert("没有符合条件的台词需要合成");

    // 乐观更新所有目标状态
    const ids = targetLines.map(l => l.id);
    setScriptLines(lines => lines.map(l => 
      ids.includes(l.id) ? { ...l, status: 'processing' } : l
    ));

    // 提交批量任务
    const res = await synthesize({ project_id: pid, line_ids: ids });
    startPolling(res.data.task_id, (result) => {
       // 简单模拟：假设批量返回结果，实际可能需要重新拉取列表
       alert("批量任务已完成，请刷新查看结果 (模拟)");
       // 在真实场景下，这里通常会再次调用 getScript(pid) 刷新整个列表
    });
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden text-slate-800 font-sans">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 顶部 Header */}
      <header className="bg-white border-b px-4 py-2 flex justify-between items-center shadow-sm h-[60px] z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="text-blue-600"/>
          <div>
            {/* 🔴 更名 */}
            <h1 className="font-bold text-base">DubFlow Studio</h1>
            <div className="text-xs text-gray-400">Project: {pid}</div>
          </div>
        </div>
        
        {/* 中间：批量操作工具栏 */}
        <div className="flex items-center gap-4 bg-gray-50 px-3 py-1.5 rounded-lg border">
           <div className="flex items-center gap-2 text-sm text-gray-600 border-r pr-4">
              <Filter size={14}/>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={batchFilters.onlyPending}
                  onChange={e => setBatchFilters(f => ({...f, onlyPending: e.target.checked}))}
                  className="rounded text-blue-600 focus:ring-0"
                />
                仅合成未完成
              </label>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={batchFilters.skipAside}
                  onChange={e => setBatchFilters(f => ({...f, skipAside: e.target.checked}))}
                  className="rounded text-blue-600 focus:ring-0"
                />
                不含旁白
              </label>
           </div>
           <button 
             onClick={handleBatchSynthesize}
             className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
           >
             <Zap size={14}/> 批量合成
           </button>
        </div>

        {/* 右侧：设置 & 头像 */}
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setIsSettingsOpen(true)} 
             className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors"
             title="系统设置"
           >
             <Settings size={20}/>
           </button>
           <div className="w-8 h-8 bg-gray-200 rounded-full border border-gray-300"></div>
        </div>
      </header>

      {/* 三栏布局主体 */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 h-[calc(100vh-60px)] overflow-hidden">
        
        {/* 左栏：角色库 (支持拖拽 - 这里简化为点击指派参考) */}
        <section className="col-span-2 bg-white rounded-xl shadow-sm border flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b bg-gray-50 font-bold text-gray-600 text-sm">Roles ({characters.length})</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {characters.map(char => (
               <div key={char.id} className="flex items-center gap-2 p-2 rounded hover:bg-blue-50 cursor-grab active:cursor-grabbing border border-transparent hover:border-blue-100 transition-colors">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-lg border">{char.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{char.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{char.gender}</div>
                  </div>
               </div>
            ))}
          </div>
        </section>

        {/* 中栏：剧本流 (核心交互区) */}
        <section className="col-span-7 bg-white rounded-xl shadow-sm border flex flex-col h-full overflow-hidden relative">
           <div className="p-3 border-b bg-gray-50 font-bold text-gray-600 text-sm flex justify-between">
              <span>Script Timeline</span>
              <span className="text-xs bg-gray-200 px-2 rounded-full text-gray-500">{scriptLines.length} lines</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 scroll-smooth">
              {scriptLines.map((line, index) => (
                <div key={line.id} className="group relative">
                  
                  {/* 卡片主体 */}
                  <div 
                    onClick={() => setSelectedLineId(line.id)}
                    className={`flex gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedLineId === line.id 
                        ? 'bg-blue-50 border-blue-400 shadow-md z-10' 
                        : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {/* 头像与角色切换 */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                       <div className="relative group/avatar">
                         <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl border cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all">
                            {/* 根据ID查找头像，找不到显示默认 */}
                            {characters.find(c => c.id === line.character_id)?.avatar || '👤'}
                         </div>
                         {/* 悬停显示的下拉切换伪装 (实际建议用 Popover，这里用原生 select 覆盖实现) */}
                         <select 
                           className="absolute inset-0 opacity-0 cursor-pointer"
                           value={line.character_id}
                           onChange={(e) => handleAssignCharacter(line.id, e.target.value)}
                           onClick={(e) => e.stopPropagation()} // 防止触发选中行
                         >
                           {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                       </div>
                       <div className="text-xs font-bold text-gray-500 max-w-[60px] truncate text-center">
                         {characters.find(c => c.id === line.character_id)?.name || 'Unknown'}
                       </div>
                    </div>

                    {/* 内容区 */}
                    <div className="flex-1 min-w-0">
                      {/* 文本展示 (选中后在右侧编辑，点击此处只负责选中) */}
                      <div className="text-gray-800 text-base leading-relaxed font-medium break-words min-h-[1.5em]">
                        {line.text || <span className="text-gray-300 italic">Empty line...</span>}
                      </div>

                      {/* 状态与播放栏 */}
                      <div className="mt-3 flex items-center gap-3 h-8">
                          {line.status === 'processing' && (
                             <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full animate-pulse">
                               <RefreshCw size={12} className="animate-spin"/> AI Generating...
                             </div>
                          )}
                          
                          {line.status === 'synthesized' && line.audio_url && (
                             <div className="flex items-center gap-2 bg-gray-100 rounded-full pr-3 border border-gray-200 hover:bg-white transition-colors">
                                <button className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700 shrink-0 shadow-sm">
                                  <Play size={14} fill="white" className="ml-0.5"/>
                                </button>
                                <audio 
                                  src={line.audio_url} 
                                  controls 
                                  className="h-6 w-32 opacity-60 hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                />
                             </div>
                          )}

                          {/* 单句重试按钮 (仅在未生成或失败时显示) */}
                          {line.status !== 'processing' && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleSynthesizeLine(line.id); }}
                               className="text-gray-400 hover:text-indigo-600 p-1 rounded transition-colors"
                               title="Synthesize this line"
                             >
                               <RefreshCw size={16} />
                             </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* 悬停操作栏 (插入/删除) */}
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                    <button 
                      onClick={(e) => handleDeleteLine(e, line.id)}
                      className="p-1.5 bg-white text-gray-400 border shadow-sm rounded-full hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="删除台词"
                    >
                      <Trash2 size={14}/>
                    </button>
                    <button 
                      onClick={() => handleAddLine(line.id)}
                      className="p-1.5 bg-white text-gray-400 border shadow-sm rounded-full hover:text-green-600 hover:bg-green-50 transition-colors"
                      title="在下方插入"
                    >
                      <Plus size={14}/>
                    </button>
                  </div>
                  
                </div>
              ))}
              
              {/* 底部添加按钮 */}
              <button 
                onClick={() => handleAddLine(scriptLines[scriptLines.length-1]?.id)}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
              >
                <Plus size={20}/> Add End Line
              </button>
           </div>
        </section>

        {/* 右栏：控制台 (编辑器) */}
        <section className="col-span-3 bg-white rounded-xl shadow-sm border flex flex-col h-full">
           <div className="p-3 border-b bg-gray-50 font-bold text-gray-600 text-sm">Control Panel</div>
           
           {activeLine ? (
             <div className="p-4 space-y-6 flex-1 overflow-y-auto">
               
               {/* 1. 文本编辑 */}
               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Edit3 size={12}/> Content
                  </label>
                  <textarea 
                    className="w-full h-32 p-3 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-colors"
                    value={activeLine.text}
                    onChange={(e) => updateLocalLine(activeLine.id, { text: e.target.value })}
                    placeholder="Type dialogue here..."
                  />
                  <div className="text-right text-xs text-gray-400">{activeLine.text?.length || 0} chars</div>
               </div>

               {/* 2. 参数调整 */}
               <div className="space-y-4 pt-4 border-t">
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Speaker</label>
                   <select 
                     className="w-full p-2 border rounded-lg text-sm bg-white"
                     value={activeLine.character_id}
                     onChange={(e) => handleAssignCharacter(activeLine.id, e.target.value)}
                   >
                      {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                 </div>
                 
                 <div>
                   <div className="flex justify-between text-xs font-bold text-gray-500 uppercase mb-1">
                     <span>Speed</span>
                     <span>1.0x</span>
                   </div>
                   <input type="range" min="0.5" max="2.0" step="0.1" defaultValue="1.0" className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                 </div>
                 
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Emotion</label>
                   <select className="w-full p-2 border rounded-lg text-sm bg-white">
                      <option>Neutral (默认)</option>
                      <option>Angry (愤怒)</option>
                      <option>Happy (开心)</option>
                      <option>Sad (悲伤)</option>
                   </select>
                 </div>
               </div>

               {/* 3. 操作按钮 */}
               <div className="pt-6 mt-auto">
                 <button 
                   onClick={() => handleSynthesizeLine(activeLine.id)}
                   className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 transition-all active:scale-95"
                 >
                   <RefreshCw size={18} /> Update & Synthesize
                 </button>
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-60 p-8 text-center">
               <Settings size={48} strokeWidth={1} className="mb-4"/>
               <p className="font-medium">Select a line to edit parameters</p>
             </div>
           )}
        </section>

      </main>
    </div>
  );
}