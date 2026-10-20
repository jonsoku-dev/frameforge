import React from 'react';
import {PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ScrollArea} from '@/components/ui/scroll-area';
import {cn} from '@/lib/utils';
import type {Info} from './runtime';
import {lengthLabel} from './state';

export type RailItem = {
  info: Info; title: string; actor: string | null; version: number; openRequests: number; unsaved: boolean;
  check: 'pass' | 'fail' | 'stale' | 'none'; progress: number | null; thumb: {src: string} | null;
};

const DOT: Record<RailItem['check'], {className: string; label: string}> = {
  pass: {className: 'bg-pass border-pass', label: '검사 통과'},
  fail: {className: 'bg-fail border-fail', label: '검사 실패'},
  stale: {className: 'border-2 border-subtle-foreground bg-subtle-foreground/30', label: '결과가 지금 버전보다 오래됨'},
  none: {className: 'border-subtle-foreground bg-transparent', label: '결과 없음'},
};

function Thumb({item}: {item: RailItem}) {
  const portrait = item.info.height > item.info.width;
  const [w, h] = portrait ? [27, 48] : [48, 27];
  return <span className="relative block shrink-0 overflow-hidden rounded-[4px] bg-raised" style={{width: w, height: h}}>
    {item.thumb ? <img src={item.thumb.src} alt="" loading="lazy" className="absolute top-0 left-0 max-w-none origin-top-left" style={{transform: `scale(${w / 480})`}} /> : null}
    {item.unsaved ? <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-warn" aria-hidden="true" /> : null}
  </span>;
}

export function Rail({items, selected, expanded, loading, onPick, onToggle}: {items: RailItem[]; selected: string; expanded: boolean; loading: boolean; onPick: (id: string) => void; onToggle: () => void}) {
  const move = (event: React.KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : -1;
    if (next < 0 || next >= items.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    event.stopPropagation();
    onPick(items[next]!.info.id);
    (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return <nav className="area-rail flex min-h-0 min-w-0 flex-col border-r border-border bg-panel" aria-label="컴포지션" data-rail-width={expanded ? 248 : 64}>
    <div className={cn('flex h-9 shrink-0 items-center border-b border-border', expanded ? 'justify-between pr-1 pl-3' : 'justify-center')}>
      {expanded ? <h2 className="text-[14px] font-bold">컴포지션 <span className="font-normal text-muted-foreground tnum">{items.length}</span></h2> : null}
      <Button size="icon" variant="ghost" aria-label={expanded ? '레일 접기 (\\)' : '레일 펼치기 (\\)'} title={expanded ? '레일 접기 (\\)' : '레일 펼치기 (\\)'} onClick={onToggle}>{expanded ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}</Button>
    </div>
    <ScrollArea className="min-h-0 flex-1">
      {loading ? <div className="space-y-2 p-2">{Array.from({length: 5}, (_, index) => <div key={index} className="h-12 rounded-md bg-raised" />)}</div> : null}
      <div className="flex flex-col gap-0.5 p-1.5" role="listbox" aria-label="컴포지션 목록">
        {items.map((item, index) => {
          const active = item.info.id === selected;
          const dot = DOT[item.check];
          return <button key={item.info.id} type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} title={expanded ? undefined : item.title}
            className={cn('relative flex w-full items-center gap-2 rounded-md text-left transition-colors duration-[80ms] hover:bg-raised', expanded ? 'min-h-12 px-2 py-1.5' : 'flex-col px-1 py-1.5', active && 'bg-raised ring-1 ring-primary/60')}
            onClick={() => onPick(item.info.id)} onKeyDown={event => move(event, index)} data-rail-item={item.info.id}>
            <Thumb item={item} />
            {expanded ? <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{item.title}</span>
              <span className="block truncate text-[11px] leading-4 text-muted-foreground tnum">{item.info.width >= item.info.height ? '16:9' : '9:16'} · {lengthLabel(item.info.durationInFrames, item.info.fps)}{item.actor ? ` · ${item.actor}` : ''}{item.version ? ` · v${item.version}` : ''}</span>
            </span> : null}
            <span className="flex shrink-0 items-center gap-1">
              <span className={cn('size-2.5 rounded-full border', dot.className)} title={dot.label} role="img" aria-label={dot.label} data-check-dot={item.check} />
              {item.openRequests ? <span className="text-[11px] leading-4 text-primary tnum" aria-label={`열린 요청 ${item.openRequests}개`}>{item.openRequests}</span> : null}
            </span>
            {item.progress !== null ? <span className="absolute right-1 bottom-0 left-1 h-0.5 bg-raised"><span className="block h-full bg-primary transition-[width] duration-[120ms] ease-linear" style={{width: `${item.progress * 100}%`}} /></span> : null}
          </button>;
        })}
      </div>
    </ScrollArea>
  </nav>;
}
