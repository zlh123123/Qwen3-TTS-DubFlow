import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskPoller } from '../hooks/useTaskPoller';
import { getCharacters, previewVoice, confirmVoice } from '../api/endpoints';
import { 
  Play, Check, ChevronRight, Plus, Trash2, User, 
  Mic, RefreshCw, Volume2, Save 
} from 'lucide-react';
import { Settings } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';

export default function Workshop() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 核心状态
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 轮询器 (用于 Reroll)
  const { startPolling, loading: isGenerating } = useTaskPoller();

  // 初始化：获取角色列表
  useEffect(() => {
    loadCharacters();
  }, [pid]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const res = await getCharacters(pid);
      // 给数据补全默认字段 (防止旧数据报错)
      const formatted = res.data.map(c => ({
        ...c,
        gender: c.gender || 'Male',
        age: c.age || 'Unknown',
        prompt: c.desc || '',
        ref_text: c.ref_text || '三十年河东，三十年河西，莫欺少年穷！',
        preview_audio: null, // 临时试听音频
        confirmed_audio: null, // 已确认的定妆音频
        is_confirmed: false
      }));
      setCharacters(formatted);
      // 默认选中第一个
      if (formatted.length > 0) setSelectedCharId(formatted[0].id);
    } catch (err) {
      alert('加载角色失败');
    } finally {
      setLoading(false);
    }
  };

  // --- 交互逻辑 ---

  // 1. 选中角色
  const activeChar = characters.find(c => c.id === selectedCharId);

  // 2. 修改角色信息 (实时更新本地 State)
  const updateChar = (field, value) => {
    setCharacters(chars => chars.map(c => 
      c.id === selectedCharId ? { ...c, [field]: value } : c
    ));
  };

  // 3. 添加角色
  const handleAddChar = () => {
    const newId = Date.now(); // 临时生成一个ID
    const newChar = {
      id: newId,
      name: 'New Character',
      gender: 'Male',
      age: '20',
      prompt: 'Describe the voice tone here...',
      ref_text: 'Hello, this is a test line.',
      avatar: '👤'
    };
    setCharacters([...characters, newChar]);
    setSelectedCharId(newId);
  };

  // 4. 删除角色
  const handleDeleteChar = (e, id) => {
    e.stopPropagation(); // 防止触发选中
    if (!window.confirm('确定删除该角色吗？')) return;
    
    const newList = characters.filter(c => c.id !== id);
    setCharacters(newList);
    if (selectedCharId === id && newList.length > 0) {
      setSelectedCharId(newList[0].id); // 选中剩下列表的第一个
    }
  };

  // 5. 试听 / Reroll
  const handleReroll = async () => {
    if (!activeChar) return;
    
    try {
      // 发起请求
      const res = await previewVoice({
        character_id: activeChar.id,
        text: activeChar.ref_text,
        prompt: activeChar.prompt
      });

      // 开始轮询
      startPolling(res.data.task_id, (result) => {
        // 轮询成功：更新 preview_audio
        setCharacters(chars => chars.map(c => 
          c.id === selectedCharId ? { ...c, preview_audio: result.audio_url } : c
        ));
      });
    } catch (e) {
      alert('生成请求失败');
    }
  };

  // 6. 确认定妆
  const handleConfirm = async () => {
    if (!activeChar || !activeChar.preview_audio) return;
    
    // 乐观更新：直接标记为已确认
    setCharacters(chars => chars.map(c => 
      c.id === selectedCharId ? { 
        ...c, 
        confirmed_audio: c.preview_audio, 
        is_confirmed: true 
      } : c
    ));

    // 调用后端接口 (可选，如果只是前端演示可不调)
    // await confirmVoice(activeChar.id, ...);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden text-slate-800 font-sans">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 顶部导航 */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0 z-10">
        <h1 className="text-lg font-bold flex items-center gap-2">
          {/* 🔴 更名 */}
          <User className="text-blue-600"/> DubFlow Workshop
        </h1>
        
        <div className="flex items-center gap-3">
           {/* 🔴 设置按钮 */}
           <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
             <Settings size={20}/>
           </button>
           
           <button 
             onClick={() => navigate(`/project/${pid}/studio`)}
             className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-all active:scale-95"
           >
             生成剧本 <ChevronRight size={16} />
           </button>
        </div>
      </header>

      {/* 主体：左右分栏布局 */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* 左侧：角色列表 */}
        <aside className="w-80 bg-white border-r flex flex-col">
           <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
             <span className="text-xs font-bold text-gray-500 uppercase">Character List</span>
             <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{characters.length}</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-3 space-y-2">
             {loading ? <div className="text-center p-4 text-gray-400">Loading...</div> : characters.map(char => (
               <div 
                 key={char.id}
                 onClick={() => setSelectedCharId(char.id)}
                 className={`group relative p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                   selectedCharId === char.id 
                     ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                     : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                 }`}
               >
                 <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-xl shrink-0 border border-gray-300">
                   {char.avatar || char.name[0]}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="font-bold text-sm truncate text-gray-800">{char.name}</div>
                   <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                     {char.is_confirmed ? <span className="text-green-600 flex items-center gap-0.5"><Check size={10}/> Ready</span> : 'Not set'}
                   </div>
                 </div>
                 
                 {/* 删除按钮 (悬停显示) */}
                 <button 
                   onClick={(e) => handleDeleteChar(e, char.id)}
                   className="absolute right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                   <Trash2 size={14}/>
                 </button>
               </div>
             ))}
           </div>

           <div className="p-4 border-t bg-gray-50">
             <button 
               onClick={handleAddChar}
               className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
             >
               <Plus size={16}/> Add Character
             </button>
           </div>
        </aside>

        {/* 右侧：编辑区域 */}
        <section className="flex-1 bg-gray-50 p-6 overflow-y-auto">
          {activeChar ? (
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* 编辑器头部 */}
              <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-4xl border shadow-sm">
                    {activeChar.avatar || '👤'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{activeChar.name}</h2>
                    <p className="text-sm text-gray-500">ID: {activeChar.id}</p>
                  </div>
                </div>
                {activeChar.is_confirmed && (
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Check size={16}/> Voice Confirmed
                  </div>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. 基础信息 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                    <input 
                      className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={activeChar.name}
                      onChange={(e) => updateChar('name', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                      <select 
                        className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={activeChar.gender}
                        onChange={(e) => updateChar('gender', e.target.value)}
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Age</label>
                      <input 
                        className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={activeChar.age}
                        onChange={(e) => updateChar('age', e.target.value)}
                        placeholder="e.g. 25, Middle-aged"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. 人设 Prompt */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                    <span>Prompt / Description</span>
                    <span className="text-blue-600 cursor-pointer hover:underline text-[10px]">Auto-Optimize</span>
                  </label>
                  <textarea 
                    className="w-full h-[124px] p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors"
                    value={activeChar.prompt}
                    onChange={(e) => updateChar('prompt', e.target.value)}
                    placeholder="Describe the voice timbre, emotion, and style..."
                  />
                </div>

                {/* 3. 参考文本 & 试听 */}
                <div className="md:col-span-2 border-t pt-6 mt-2">
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                       <Mic size={14}/> Reference Text (定妆台词)
                     </label>
                   </div>
                   <textarea 
                      className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-yellow-50/50 border-yellow-200 text-gray-700 font-medium"
                      rows="2"
                      value={activeChar.ref_text}
                      onChange={(e) => updateChar('ref_text', e.target.value)}
                    />
                   
                   {/* 试听控制区 */}
                   <div className="mt-4 bg-gray-50 rounded-xl p-4 flex items-center gap-4 border border-gray-100">
                      {/* 播放器 */}
                      <div className="flex-1">
                        {activeChar.preview_audio ? (
                          <div className="flex items-center gap-3">
                             <button className="w-10 h-10 bg-white border shadow-sm rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50">
                               <Play size={18} fill="currentColor"/>
                             </button>
                             <div className="h-10 flex-1 bg-gray-200 rounded-lg overflow-hidden relative group">
                                <audio controls src={activeChar.preview_audio} className="w-full h-full opacity-80" />
                             </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 italic flex items-center gap-2">
                            <Volume2 size={16}/> 点击 Reroll 生成试听音频...
                          </div>
                        )}
                      </div>

                      <div className="h-8 w-px bg-gray-300 mx-2"></div>

                      {/* 按钮组 */}
                      <div className="flex gap-2">
                        <button 
                          onClick={handleReroll}
                          disabled={isGenerating}
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''}/>
                          {isGenerating ? 'Generating...' : 'Reroll / 试听'}
                        </button>
                        
                        <button 
                          onClick={handleConfirm}
                          disabled={!activeChar.preview_audio}
                          className={`px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all ${
                            activeChar.preview_audio 
                              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95' 
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Check size={16} strokeWidth={3}/> 
                          Confirm Use
                        </button>
                      </div>
                   </div>
                </div>

              </div>
            </div>
          ) : (
            // 空状态
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
              <User size={64} strokeWidth={1}/>
              <p className="mt-4 text-lg font-medium">Select a character to edit</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}