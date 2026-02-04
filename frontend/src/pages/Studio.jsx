import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// 记得引入 Home 图标
import { Play, RefreshCw, Layers, Plus, Trash2, Zap, Edit3, Volume2, ChevronLeft, Home } from 'lucide-react';
import { useTaskPoller } from '../hooks/useTaskPoller';
import * as API from '../api/endpoints';

export default function Studio() {
  const { pid } = useParams();
  const nav = useNavigate();
  
  // 数据状态
  const [lines, setLines] = useState([]);
  const [chars, setChars] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [filters, setFilters] = useState({ onlyPending: true });
  const [loading, setLoading] = useState(true);
  
  const { startPolling } = useTaskPoller();

  // 初始化加载
  useEffect(() => {
    Promise.all([API.getCharacters(pid), API.getScript(pid)])
      .then(([c, s]) => {
        setChars(c.data || []);
        setLines(s.data || []);
        setLoading(false);
      })
      .catch(e => {
        console.error("Studio炸了:", e);
        setLoading(false);
      });
  }, [pid]);

  const activeLine = lines.find(l => l.id === activeId);

  // --- 操作逻辑 (简写版) ---
  const mutate = (id, pl) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...pl } : l));
  
  const add = async (prevId) => { 
    try {
      const res = await API.addLine(pid, prevId); 
      const idx = lines.findIndex(l => l.id === prevId); 
      const n = [...lines]; 
      n.splice(idx+1, 0, res.data); 
      setLines(n); 
      setActiveId(res.data.id);
    } catch(e) { alert("添加失败"); }
  };

  const del = async (e, id) => { 
    e.stopPropagation(); 
    if(!confirm('删这句？')) return; 
    setLines(p => p.filter(l => l.id !== id)); 
    API.deleteLine(id); 
    if(activeId === id) setActiveId(null); 
  };

  const synth = async (id) => { 
    mutate(id, {status:'processing'}); 
    const res = await API.synthesize({project_id:pid, line_ids:[id]}); 
    startPolling(res.data.task_id, r => mutate(id, {status:'synthesized', audio_url: r.audio_url})); 
  };

  const batch = async () => { 
    const ids = lines.filter(l => filters.onlyPending ? l.status !== 'synthesized' : true).map(l => l.id); 
    if(!ids.length) return alert('没啥可生成的'); 
    setLines(p => p.map(l => ids.includes(l.id) ? {...l, status: 'processing'} : l)); 
    const r = await API.synthesize({project_id: pid, line_ids: ids}); 
    startPolling(r.data.task_id, () => alert('批量任务完成')); 
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-[#D3BC8E] font-bold">读取剧本中...</div>;

  return (
    <div className="h-screen w-full flex flex-col text-[#495366] overflow-hidden bg-[#F0F2F5]">
      
      {/* 顶部 Header */}
      <header className="px-8 py-4 z-20 shrink-0">
        <div className="paimon-menu px-6 py-3 flex justify-between items-center bg-white/90 border-2 border-[#D8CBA8] rounded-[32px] text-[#3B4255] shadow-sm">
          
          {/* 左侧：返回 + 标题 */}
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)} className="hover:bg-[#F7F3EB] p-2 rounded-full transition text-[#8C7D6B]">
              <ChevronLeft />
            </button>
            <div className="w-10 h-10 bg-[#D3BC8E] rounded-full flex items-center justify-center text-white border-2 border-white shadow">
              <Layers size={20}/>
            </div>
            <div>
              <h1 className="text-lg text-[#3B4255] font-bold" style={{ fontFamily: 'serif' }}>剧情回顾</h1>
              <div className="text-[10px] text-gray-400 font-sans">PID: {pid}</div>
            </div>
          </div>
          
          {/* 中间：筛选栏 */}
          <div className="flex items-center gap-4 bg-[#F7F3EB] px-4 py-1.5 rounded-full border border-[#EBE5D9]">
             <label className="flex items-center gap-2 text-xs font-bold text-[#8C7D6B] cursor-pointer select-none border-r border-[#D8CBA8] pr-4">
               <input type="checkbox" checked={filters.onlyPending} onChange={e => setFilters({ onlyPending: e.target.checked })} className="accent-[#D3BC8E] rounded-full"/>
               <span>跳过已完成</span>
             </label>
             <button onClick={batch} className="text-[#3B4255] hover:text-[#D3BC8E] text-xs font-bold flex items-center gap-1 transition-colors">
               <Zap size={14} className="fill-[#D3BC8E] text-[#D3BC8E]"/> 批量生成
             </button>
          </div>

          {/* 右侧：完成按钮 */}
          <div>
            <button 
               onClick={() => nav('/')}
               className="px-5 py-1.5 rounded-full border-2 border-[#D3BC8E] text-[#8C7D6B] font-bold bg-[#F7F3EB]/50 hover:bg-[#fff] transition-all flex items-center gap-2 active:scale-95 shadow-sm text-sm"
             >
               <Home size={16} /> <span className="pt-0.5">完成</span>
             </button>
          </div>
        </div>
      </header>

      {/* 主体三栏布局 */}
      <main className="flex-1 px-8 pb-8 grid grid-cols-12 gap-8 min-h-0">
        
        {/* 左栏：角色表 (Cast) */}
        <aside className="col-span-2 bg-white/80 border-2 border-[#EBE5D9] rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 bg-[#F9F7F4] font-bold text-[#8C7D6B] text-xs text-center border-b border-[#EBE5D9]">CAST</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {chars.map(c => (
              <div key={c.id} className="flex flex-col items-center p-3 rounded-2xl bg-[#F7F3EB] border border-transparent hover:border-[#D3BC8E] transition-all">
                <div className="text-3xl drop-shadow-sm">{c.avatar}</div>
                <div className="text-xs font-bold mt-1 text-[#3B4255] truncate w-full text-center">{c.name}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* 中栏：剧情流 (Timeline) */}
        <section className="col-span-7 flex flex-col overflow-hidden relative">
           <div className="absolute inset-0 bg-[#EBE5D9]/30 rounded-[2rem] border-2 border-[#D8CBA8]/50 pointer-events-none"></div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24 scroll-smooth custom-scrollbar relative z-10">
              {lines.map((l) => (
                <div 
                  key={l.id} 
                  onClick={() => setActiveId(l.id)} 
                  className={`flex gap-4 p-5 rounded-[1.5rem] cursor-pointer transition-all border-2 relative group ${
                    activeId === l.id 
                    ? 'bg-white border-[#D3BC8E] shadow-md scale-[1.01]' 
                    : 'bg-white/60 border-transparent hover:bg-white'
                  }`}
                >
                    {/* 头像 */}
                    <div className="relative shrink-0 flex flex-col items-center gap-1 pt-1">
                       <div className="w-12 h-12 bg-[#3B4255] rounded-full flex items-center justify-center text-2xl border-2 border-[#D3BC8E] shadow-sm z-10">
                         {chars.find(c => c.id === l.character_id)?.avatar || '👤'}
                       </div>
                    </div>
                    
                    {/* 气泡内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#D3BC8E] mb-1 ml-1 uppercase">
                        {chars.find(c => c.id === l.character_id)?.name || '???'}
                      </div>
                      <div className="text-[#3B4255] text-base font-medium leading-relaxed bg-[#F7F3EB] px-4 py-2 rounded-xl rounded-tl-none border border-[#EBE5D9]">
                        {l.text || "..."}
                      </div>
                      
                      {/* 播放条 */}
                      <div className="mt-2 flex items-center gap-2 h-8 ml-1">
                          {l.status === 'processing' && (
                             <span className="text-xs text-[#D3BC8E] flex gap-1 font-bold">
                               <RefreshCw size={12} className="animate-spin"/> 思考中...
                             </span>
                          )}
                          {l.status === 'synthesized' && l.audio_url && (
                             <div className="flex items-center gap-2 bg-white rounded-full pr-2 border border-[#EBE5D9] cursor-default" onClick={e => e.stopPropagation()}>
                                <button className="w-8 h-8 bg-[#D3BC8E] rounded-full flex justify-center items-center text-white hover:brightness-110">
                                  <Play size={14} fill="white" className="ml-0.5"/>
                                </button>
                                <audio src={l.audio_url} controls className="h-6 w-24 opacity-60"/>
                             </div>
                          )}
                          {l.status !== 'processing' && (
                             <button onClick={(e) => { e.stopPropagation(); synth(l.id); }} className="text-[#A4AAB6] hover:text-[#D3BC8E] p-1 transition">
                               <RefreshCw size={16}/>
                             </button>
                          )}
                      </div>
                    </div>

                    {/* 悬停操作 */}
                    <div className="absolute right-2 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => del(e, l.id)} className="p-2 bg-white rounded-full shadow text-[#FF7F7F] hover:scale-110"><Trash2 size={14}/></button>
                      <button onClick={() => add(l.id)} className="p-2 bg-white rounded-full shadow text-[#D3BC8E] hover:scale-110"><Plus size={14}/></button>
                    </div>
                </div>
              ))}
              
              <button 
                onClick={() => add(lines[lines.length-1]?.id)} 
                className="w-full py-4 border-2 border-dashed border-[#D3BC8E]/50 rounded-[2rem] text-[#D3BC8E] font-bold hover:bg-white transition-colors"
              >
                + 继续对话
              </button>
           </div>
        </section>

        {/* 右栏：参数配置 (Inspector) */}
        <section className="col-span-3 bg-white/90 border-2 border-[#D8CBA8] rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
           <div className="p-4 bg-[#F9F7F4] border-b border-[#EBE5D9] font-bold text-[#8C7D6B] text-xs text-center">PARAMETERS</div>
           
           {activeLine ? (
             <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
               {/* 文本编辑 */}
               <div className="space-y-2">
                 <label className="text-xs font-bold text-[#D3BC8E] flex gap-1"><Edit3 size={12}/> TEXT</label>
                 <textarea 
                   className="w-full h-32 p-3 bg-[#F7F3EB] border-2 border-[#D8CBA8] rounded-xl text-[#3B4255] outline-none resize-none focus:border-[#D3BC8E]" 
                   value={activeLine.text} 
                   onChange={e => mutate(activeId, { text: e.target.value })}
                 />
               </div>
               
               {/* 角色选择 */}
               <div className="pt-4 border-t border-[#EBE5D9]">
                 <label className="text-xs font-bold text-gray-400 mb-1 block">SPEAKER</label>
                 <select 
                   className="w-full p-2 bg-[#F7F3EB] border-2 border-[#EBE5D9] rounded-xl text-[#3B4255] outline-none" 
                   value={activeLine.character_id} 
                   onChange={e => {
                     const c = chars.find(x => x.id == e.target.value);
                     if (c) mutate(activeId, { character_id: c.id });
                   }}
                 >
                   {chars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               
               {/* 底部按钮 */}
               <div className="pt-4 mt-auto">
                 <button 
                   onClick={() => synth(activeId)} 
                   className="bg-gradient-to-b from-[#F2EBDC] to-[#D3BC8E] border border-[#CBAA76] text-[#4A5366] font-bold rounded-full w-full py-3 shadow-md hover:brightness-110 active:scale-95 flex justify-center items-center gap-2"
                 >
                   <RefreshCw size={18}/> Update & Play
                 </button>
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-[#D3BC8E] opacity-50">
               <Volume2 size={48}/>
               <p className="font-bold mt-2">Select Bubble</p>
             </div>
           )}
        </section>

      </main>
    </div>
  );
}