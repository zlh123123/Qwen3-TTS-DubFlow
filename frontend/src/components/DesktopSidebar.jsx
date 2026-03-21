import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Clapperboard, FolderOpen, Settings } from 'lucide-react';

export default function DesktopSidebar({ onOpenSettings }) {
  const location = useLocation();
  const nav = useNavigate();

  const match = location.pathname.match(/^\/project\/([^/]+)/);
  const pid = match?.[1] || null;

  const handleOpenAssets = () => {
    window.alert('资产库页面待实现（API 已拆分为 CharacterRef / Effect / BGM）');
  };

  const mainItems = [
    {
      key: 'projects',
      label: '项目',
      icon: Home,
      active: location.pathname === '/',
      onClick: () => nav('/'),
      disabled: false,
    },
    {
      key: 'characters',
      label: '角色',
      icon: Users,
      active: location.pathname.includes('/workshop'),
      onClick: () => pid && nav(`/project/${pid}/workshop`),
      disabled: !pid,
    },
    {
      key: 'studio',
      label: '演播室',
      icon: Clapperboard,
      active: location.pathname.includes('/studio'),
      onClick: () => pid && nav(`/project/${pid}/studio`),
      disabled: !pid,
    },
    {
      key: 'assets',
      label: '资产库',
      icon: FolderOpen,
      active: false,
      onClick: handleOpenAssets,
      disabled: false,
    }
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[92px] border-r border-white/30 bg-gradient-to-b from-white/65 via-white/45 to-white/35 backdrop-blur-xl">
      <div className="flex h-full flex-col items-center py-4">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f2937] text-[#d3bc8e] shadow-[0_10px_24px_rgba(31,41,55,0.28)]">
          <span className="text-sm font-black tracking-tight">DF</span>
        </div>

        <div className="mb-4 flex flex-col items-center text-[10px] text-[#64748b]">
          <span className="font-bold tracking-wide">DubFlow</span>
          <span className="opacity-80">Desktop</span>
        </div>

        <div className="flex w-full flex-1 flex-col items-center gap-3">
        {mainItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              disabled={item.disabled}
              title={item.disabled ? `${item.label}（请先进入项目）` : item.label}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                item.active
                  ? 'border-[#D3BC8E]/80 bg-[#D3BC8E]/35 text-[#3B4255] shadow-md'
                  : 'border-transparent bg-white/55 text-[#475569] hover:border-[#D3BC8E]/50 hover:bg-white/90'
              } ${item.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <Icon size={20} />
              <span className="pointer-events-none absolute left-[62px] whitespace-nowrap rounded-lg border border-white/50 bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#334155] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </button>
          );
        })}
        </div>

        <button
          onClick={onOpenSettings}
          title="设置"
          className="group relative mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-transparent bg-white/55 text-[#475569] transition-all hover:border-[#D3BC8E]/50 hover:bg-white/90"
        >
          <Settings size={20} />
          <span className="pointer-events-none absolute left-[62px] whitespace-nowrap rounded-lg border border-white/50 bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#334155] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            设置
          </span>
        </button>
        <div className="mt-auto mb-2 text-[10px] font-semibold text-[#64748b]">v0.1</div>
      </div>
    </aside>
  );
}
