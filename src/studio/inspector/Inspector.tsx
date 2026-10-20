import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ScrollArea} from '@/components/ui/scroll-area';
import {cn} from '@/lib/utils';
import {api} from '../api';
import {TABS, type Drawer, type Tab} from '../state';

export function Inspector({tab, onTab, drawer, onDrawer, onSeek, children}: {tab: Tab; onTab: (tab: Tab) => void; drawer: Drawer | null; onDrawer: (drawer: Drawer | null) => void; onSeek: (frame: number) => void; children: React.ReactNode}) {
  const keys = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const next = TABS[(index + delta + TABS.length) % TABS.length]!;
    onTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return <aside className="area-inspector relative flex min-h-0 min-w-0 flex-col border-l border-border bg-panel" aria-label="검사기">
    <div className="flex h-9 shrink-0 items-stretch gap-1 border-b border-border px-2" role="tablist" aria-label="검사기 탭">
      {TABS.map((item, index) => <button key={item.id} id={`tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1}
        className={cn('relative px-2.5 text-[14px] font-bold text-muted-foreground hover:text-foreground', tab === item.id && 'text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:bg-primary')}
        title={`${item.label} (${index + 1})`} onClick={() => onTab(item.id)} onKeyDown={event => keys(event, index)}>{item.label}</button>)}
    </div>
    <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 flex-col" data-panel={tab}>{children}</div>
    {drawer ? <DrawerView drawer={drawer} onClose={() => onDrawer(null)} onSeek={frame => { onDrawer(null); onSeek(frame); }} /> : null}
  </aside>;
}

export const Empty = ({children}: {children: React.ReactNode}) => <div className="p-3 text-muted-foreground">{children}</div>;

export function Panel({children, footer}: {children: React.ReactNode; footer?: React.ReactNode}) {
  return <>
    <ScrollArea className="min-h-0 flex-1"><div className="flex flex-col gap-4 p-3">{children}</div></ScrollArea>
    {footer ? <div className="shrink-0 border-t border-border bg-panel p-3">{footer}</div> : null}
  </>;
}

const SHORTCUTS: [string, string][] = [
  ['Space', '재생, 일시정지'], ['← / →', '1프레임'], ['Shift + ← / →', '10프레임'], ['Home / End', '처음, 마지막 프레임'], ['[ / ]', '이전, 다음 장면'], [', / .', '이전, 다음 시트 프레임'],
  ['↑ / ↓', '이전, 다음 컴포지션 (레일)'], ['1–4', '기획, 과정, 조정, 출력'], ['I', '검사기 열고 닫기'], ['\\', '레일 접고 펼치기'], ['G', '안전 영역'], ['F', '맞춤 / 100%'],
  ['C', '변경 요청 작성'], ['E', 'Spot.tsx를 에디터에서'], ['R', 'MP4 만들기 버튼으로'], ['⌘S', '조정 저장'], ['⌘Enter', '요청 보내기'], ['Esc', '닫기, 초점 빼기'], ['?', '단축키 표'],
];

/** Reading drawer over the inspector: raw file text, a sheet with frame badges, a video, or the shortcut table (3.4, 3.6). */
function DrawerView({drawer, onClose, onSeek}: {drawer: Drawer; onClose: () => void; onSeek: (frame: number) => void}) {
  const [text, setText] = useState<{value: string} | {error: string} | null>(null);
  const [size, setSize] = useState<{width: number; height: number} | null>(null);
  useEffect(() => {
    if (drawer.kind !== 'file') return;
    let live = true;
    setText(null);
    api.file(drawer.path).then(result => live && setText({value: result.text}), (error: Error) => live && setText({error: error.message}));
    return () => { live = false; };
  }, [drawer]);
  const title = drawer.kind === 'help' ? '단축키' : drawer.path;
  return <div className="slide-in absolute inset-0 z-30 flex flex-col rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-label={title} data-drawer={drawer.kind} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border pr-1 pl-3">
      <span className="mono min-w-0 flex-1 truncate" title={title}>{title}</span>
      <Button size="icon" variant="ghost" aria-label="닫기 (Esc)" onClick={onClose} autoFocus><X aria-hidden="true" /></Button>
    </div>
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-3">
        {drawer.kind === 'help' ? <table className="w-full text-[13px]"><tbody>{SHORTCUTS.map(([key, label]) => <tr key={key} className="border-b border-border"><td className="mono py-1 pr-3 whitespace-nowrap">{key}</td><td className="py-1">{label}</td></tr>)}</tbody></table> : null}
        {drawer.kind === 'file' ? text === null ? <p className="text-muted-foreground">불러오는 중</p> : 'error' in text ? <p className="text-fail" role="alert">{text.error}</p> : <pre className="text-[13px] leading-5 break-words whitespace-pre-wrap">{text.value}</pre> : null}
        {drawer.kind === 'video' ? <video className="w-full rounded-md bg-black" src={api.media(drawer.path)} controls autoPlay /> : null}
        {drawer.kind === 'sheet' ? <div className="relative">
          <img src={api.media(drawer.path)} alt="콘택트 시트" className="block w-full" onLoad={event => setSize({width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight})} />
          {size && drawer.frames ? <SheetTiles frames={drawer.frames} size={size} onSeek={onSeek} /> : null}
          {!drawer.frames ? <p className="mt-2 text-[12px] text-muted-foreground">이 시트는 프레임 번호 기록이 없어 타일을 프레임으로 연결하지 못합니다.</p> : null}
        </div> : null}
      </div>
    </ScrollArea>
  </div>;
}

/** Tile i sits at column i mod c, row floor(i / c); tiles are 480 wide with 4 px gaps (3.5). */
function SheetTiles({frames, size, onSeek}: {frames: number[]; size: {width: number; height: number}; onSeek: (frame: number) => void}) {
  const columns = Math.min(4, frames.length);
  const rows = Math.ceil(frames.length / columns);
  const tileHeight = (size.height - (rows - 1) * 4) / rows;
  return <>{frames.map((frame, index) => {
    const x = (index % columns) * 484, y = Math.floor(index / columns) * (tileHeight + 4);
    return <button key={index} type="button" className="absolute border border-transparent hover:border-primary" aria-label={`프레임 ${frame}으로 이동`}
      style={{left: `${x / size.width * 100}%`, top: `${y / size.height * 100}%`, width: `${480 / size.width * 100}%`, height: `${tileHeight / size.height * 100}%`}} onClick={() => onSeek(frame)} data-sheet-tile={frame}>
      <span className="absolute top-1 left-1 rounded-[4px] bg-black/75 px-1 text-[11px] leading-4 text-white tnum">{frame}</span>
    </button>;
  })}</>;
}
