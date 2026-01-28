import React, { useState } from 'react';
import { Settings, Edit3, MoreHorizontal, Play, Plus, RefreshCw, User } from 'lucide-react';

export default function App() {
  const characters = [
    { id: 1, name: 'Li Yunlong', desc: 'Middle-aged/Angry', active: true, avatar: '🪖' },
    { id: 2, name: 'Zhao Gang', desc: 'Young/Calm', active: false, avatar: '👓' },
    { id: 3, name: 'Fink Yunlong', desc: 'Middle-aged/Angry', active: false, avatar: '👩' },
    { id: 4, name: 'Zhao Gang', desc: 'Young/Calm', active: false, avatar: '🧑' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-slate-800 font-sans">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm h-[60px]">
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-gray-100 rounded"><span className="text-xl">≡</span></button>
          <h1 className="font-semibold text-lg">AI Fully Automated Dubbing Workbench</h1>
        </div>
        <div className="flex gap-4 text-gray-500 items-center">
          <Edit3 size={20} className="cursor-pointer hover:text-blue-600"/>
          <Settings size={20} className="cursor-pointer hover:text-blue-600"/>
          <div className="w-8 h-8 bg-gray-200 rounded-full cursor-pointer"></div>
        </div>
      </header>

      <main className="flex-1 p-4 grid grid-cols-12 gap-4 h-[calc(100vh-60px)] overflow-hidden">
        <section className="col-span-3 bg-white rounded-xl shadow-sm border p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="font-medium text-lg">Character Cast</h2>
            <MoreHorizontal size={20} className="text-gray-400 cursor-pointer"/>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {characters.map((char) => (
              <div key={char.id} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${char.active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className="text-gray-400">⋮⋮</div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl border border-gray-200">{char.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{char.name}</div>
                  <div className="text-xs text-gray-500 bg-white border border-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{char.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 shrink-0 w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 hover:border-gray-400 flex justify-center items-center gap-2 transition-colors font-medium">
            <Plus size={18} /> Add Character
          </button>
        </section>

        <section className="col-span-6 bg-white rounded-xl shadow-sm border p-4 flex flex-col relative h-full">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="font-medium text-lg">Script Workbench</h2>
            <MoreHorizontal size={20} className="text-gray-400 cursor-pointer"/>
          </div>
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div className="flex gap-4 opacity-30">
              <div className="w-full space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div></div>
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            </div>
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl border border-orange-200 flex-shrink-0">🪖</div>
              <div className="flex-1 bg-white border border-blue-200 shadow-md rounded-xl p-5 relative ring-2 ring-blue-50">
                <div className="font-semibold text-gray-800 mb-2">Li Yunlong</div>
                <div className="text-gray-700 mb-4 text-lg leading-relaxed">二营长！你他娘的意大利炮呢？</div>
                <div className="bg-indigo-50 rounded-lg p-2 flex items-center gap-3 border border-indigo-100">
                  <button className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700 transition-colors shadow-sm"><Play size={16} fill="white" className="ml-0.5" /></button>
                  <div className="flex-1 h-8 flex items-center gap-[3px] overflow-hidden px-2">
                    {[...Array(35)].map((_, i) => (<div key={i} className="w-1.5 bg-indigo-400 rounded-full opacity-80" style={{height: `${30 + Math.random() * 70}%`}}></div>))}
                  </div>
                  <span className="text-xs text-indigo-700 font-mono font-medium mr-2">00:04</span>
                </div>
              </div>
            </div>
             <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-3">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">AI Generating...</span>
             </div>
          </div>
        </section>

        <section className="col-span-3 bg-white rounded-xl shadow-sm border p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="font-medium text-lg">Director Panel</h2>
            <MoreHorizontal size={20} className="text-gray-400 cursor-pointer"/>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-6 border border-gray-100 flex-1 overflow-y-auto">
             <h3 className="font-medium text-sm text-gray-800">Director Settings</h3>
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Emotion</label>
                 <select className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-sm outline-none"><option>Angry (愤怒)</option><option>Happy (开心)</option><option>Sad (悲伤)</option></select>
               </div>
               <div><div className="flex justify-between text-xs font-semibold text-gray-500 mb-2"><span>Intensity</span><span>5.0</span></div><input type="range" className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>
               <div><div className="flex justify-between text-xs font-semibold text-gray-500 mb-2"><span>Speed</span><span>1.0x</span></div><input type="range" className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>
             </div>
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 relative group cursor-text">
                <div className="text-gray-400 text-xs mb-1 font-medium">Fine-tune Text</div>
                <div className="text-gray-800 text-sm leading-relaxed">二营长！你他娘的意大利炮呢？</div>
                <Edit3 size={14} className="absolute top-3 right-3 text-yellow-600 opacity-50 group-hover:opacity-100 transition-opacity"/>
             </div>
          </div>
           <div className="mt-4 pt-4 border-t border-gray-100">
             <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold shadow-sm flex justify-center items-center gap-2 transition-all hover:shadow-md active:scale-95"><RefreshCw size={18} /> Re-roll (单句重录)</button>
           </div>
        </section>
      </main>
    </div>
  )
}