import React, {useLayoutEffect, useRef, useState} from 'react';
import {ChevronDown, ExternalLink, Grid3x3, Maximize, Scan} from 'lucide-react';
import {collectAudio, CurrentScaleContext, type AudioClip, type ResolvedComposition} from '../core/index';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {findClippedText, type ClippedText} from './textGuard';
import {Boundary, Scene} from './runtime';
import {timecode} from './state';

const SIDE_LABELS: Record<ClippedText['side'], string> = {top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽'};
export type Editor = 'vscode' | 'cursor';
export const editorLink = (editor: Editor, root: string, path: string, line = 1) => `${editor}://file/${root}/${path}:${line}:1`;

function Stage({composition, frame, zoom, safe, onClipped, onAudio, onCommit, onError}: {composition: ResolvedComposition; frame: number; zoom: 'fit' | 'full'; safe: boolean; onClipped: (clipped: ClippedText[]) => void; onAudio: (clips: AudioClip[]) => void; onCommit: () => void; onError: (message: string) => React.ReactNode}) {
  const well = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const outlined = useRef<HTMLElement[]>([]);
  const [box, setBox] = useState({width: 0, height: 0});
  useLayoutEffect(() => {
    const node = well.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setBox({width: rect.width, height: rect.height});
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const fit = box.width > 0 && box.height > 0 ? Math.min(box.width / composition.width, box.height / composition.height) : 0;
  const scale = zoom === 'full' ? 1 : fit;
  // Runs after every commit, so the registry holds exactly the clips the latest render mounted.
  useLayoutEffect(() => { onAudio(collectAudio()); onCommit(); });
  const fittedWidth = Math.floor(composition.width * scale);
  const fittedHeight = Math.floor(composition.height * scale);
  useLayoutEffect(() => {
    let live = true;
    const audit = () => {
      if (!live) return;
      for (const element of outlined.current) element.style.outline = element.style.outlineOffset = '';
      const clipped = canvas.current && scale > 0 ? findClippedText(canvas.current) : [];
      outlined.current = clipped.map(item => item.element).filter(element => element instanceof HTMLElement);
      for (const element of outlined.current) Object.assign(element.style, {outline: '3px solid #ff3b30', outlineOffset: '2px'});
      onClipped(clipped);
    };
    audit();
    void document.fonts.ready.then(audit); // ink metrics change once the web font swaps in
    return () => { live = false; };
  }, [composition, frame, scale]);
  const sx = fittedWidth / composition.width, sy = fittedHeight / composition.height;
  return <div className={cn('absolute inset-0 flex', zoom === 'full' ? 'overflow-auto' : 'items-center justify-center overflow-hidden')} ref={well}>
    <div className={cn('stage-frame relative shrink-0 overflow-hidden', zoom === 'full' && 'm-auto')} style={{width: fittedWidth, height: fittedHeight}} data-stage-frame>
      <div className="frame-canvas relative" ref={canvas} style={{width: composition.width, height: composition.height, transform: `scale(${sx}, ${sy})`, transformOrigin: 'top left'}}>
        <CurrentScaleContext.Provider value={sx}><Boundary key={composition.id} resetKey={`${frame}:${composition.durationInFrames}`} fallback={onError}><Scene composition={composition} frame={frame} /></Boundary></CurrentScaleContext.Provider>
      </div>
      {safe ? <SafeOverlay width={fittedWidth} height={fittedHeight} /> : null}
    </div>
  </div>;
}

/** Action safe 3.5%, title safe 5%, centre cross (5.3). Drawn over the stage only, never rendered. */
function SafeOverlay({width, height}: {width: number; height: number}) {
  return <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true" data-safe-overlay>
    <rect x={width * 0.035} y={height * 0.035} width={width * 0.93} height={height * 0.93} fill="none" stroke="oklch(1 0 0 / 40%)" strokeDasharray="6 4" />
    <rect x={width * 0.05} y={height * 0.05} width={width * 0.9} height={height * 0.9} fill="none" stroke="var(--safe-title)" data-title-safe />
    <path d={`M${width / 2 - 12} ${height / 2}h24M${width / 2} ${height / 2 - 12}v24`} stroke="oklch(1 0 0 / 40%)" />
  </svg>;
}

type HeaderProps = {
  title: string; composition: ResolvedComposition; version: number; frame: number; safe: boolean; zoom: 'fit' | 'full'; clipped: ClippedText[]; reflectMs: number | null;
  root: string | null; files: {label: string; path: string | null}[]; editor: Editor;
  onSafe: () => void; onZoom: () => void; onEditor: (editor: Editor) => void;
};

function StageHeader({title, composition, version, frame, safe, zoom, clipped, reflectMs, root, files, editor, onSafe, onZoom, onEditor}: HeaderProps) {
  const [popover, setPopover] = useState<'clip' | 'editor' | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = hovered === null ? null : clipped[hovered]?.element;
    if (!(element instanceof HTMLElement)) return;
    element.style.outlineWidth = '6px';
    return () => { element.style.outlineWidth = '3px'; };
  }, [hovered, clipped]);
  const primary = files[0];
  const ratio = composition.width >= composition.height ? '16:9' : '9:16';
  return <div className="relative flex h-9 min-w-0 shrink-0 items-center gap-3 border-b border-border bg-panel px-3" onKeyDown={event => { if (event.key === 'Escape') setPopover(null); }}>
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1 className="truncate text-[16px] leading-6 font-bold" title={title}>{title}</h1>
      <span className="hidden shrink-0 text-[12px] text-muted-foreground tnum xl:inline">{composition.width}×{composition.height} · {composition.fps}fps · {ratio}</span>
      {version > 0 ? <Badge className="shrink-0">v{version}</Badge> : null}
    </div>
    <output className="shrink-0 text-[13px] tnum" aria-label="현재 프레임">{frame} / {composition.durationInFrames - 1} <span className="text-muted-foreground">{timecode(frame, composition.fps)}</span></output>
    <div className="flex shrink-0 items-center gap-1">
      {reflectMs !== null ? <span className={cn('text-[11px] tnum', reflectMs > 100 ? 'text-warn' : 'text-subtle-foreground')} role="status" data-reflect>반영 {Math.round(reflectMs)} ms</span> : null}
      <Button size="sm" variant={safe ? 'secondary' : 'ghost'} aria-pressed={safe} title="안전 영역 (G)" onClick={onSafe}><Grid3x3 aria-hidden="true" /><span className="hidden 2xl:inline">안전 영역</span></Button>
      <Button size="sm" variant="ghost" className={clipped.length ? 'text-fail' : 'text-muted-foreground'} aria-expanded={popover === 'clip'} title="글자 잘림 목록" onClick={() => setPopover(popover === 'clip' ? null : 'clip')} data-clip-chip>
        <Scan aria-hidden="true" />잘림 {clipped.length}
      </Button>
      <Button size="sm" variant="ghost" title="맞춤 / 100% (F)" aria-pressed={zoom === 'full'} onClick={onZoom}><Maximize aria-hidden="true" />{zoom === 'fit' ? '맞춤' : '100%'}</Button>
      <div className="flex items-center">
        {primary?.path && root ? <Button asChild size="sm" variant="ghost" className="rounded-r-none"><a href={editorLink(editor, root, primary.path)} title="에디터에서 열기 (E)" data-open-editor><ExternalLink aria-hidden="true" /><span className="hidden 2xl:inline">에디터</span></a></Button> : null}
        <Button size="icon" variant="ghost" className="rounded-l-none" aria-label="다른 파일 열기" aria-expanded={popover === 'editor'} onClick={() => setPopover(popover === 'editor' ? null : 'editor')}><ChevronDown aria-hidden="true" /></Button>
      </div>
    </div>
    {popover === 'clip' ? <div className="slide-in absolute top-9 right-24 z-40 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
      <p className="mb-2 font-bold">글자 잘림 {clipped.length}곳</p>
      {clipped.length ? <ul className="space-y-1">{clipped.map((item, index) => <li key={index} className="truncate text-[12px]" onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>"{item.text}" · {SIDE_LABELS[item.side]} {item.px.toFixed(1)} px</li>)}</ul> : <p className="text-[12px] text-muted-foreground">이 프레임에서 잘린 글자가 없습니다.</p>}
    </div> : null}
    {popover === 'editor' ? <div className="slide-in absolute top-9 right-2 z-40 w-64 rounded-xl border border-border bg-card p-2 shadow-xl">
      {root ? files.map(file => file.path ? <a key={file.label} className="block rounded-md px-2 py-1.5 hover:bg-raised" href={editorLink(editor, root, file.path)}>{file.label}</a> : <span key={file.label} className="block px-2 py-1.5 text-subtle-foreground">{file.label} 없음</span>) : <p className="px-2 py-1.5 text-subtle-foreground">서버 정보를 읽지 못했습니다.</p>}
      <div className="mt-2 flex gap-1 border-t border-border pt-2" role="radiogroup" aria-label="에디터">
        {(['vscode', 'cursor'] as const).map(item => <Button key={item} size="sm" variant={editor === item ? 'secondary' : 'ghost'} role="radio" aria-checked={editor === item} onClick={() => onEditor(item)}>{item === 'vscode' ? 'VS Code' : 'Cursor'}</Button>)}
      </div>
    </div> : null}
  </div>;
}

export function StageView(props: HeaderProps & {onClipped: (clipped: ClippedText[]) => void; onAudio: (clips: AudioClip[]) => void; onCommit: () => void}) {
  const {composition, frame, zoom, safe, onClipped, onAudio, onCommit, root, editor, files} = props;
  const spot = files[0]?.path;
  const onError = (message: string) => <>
    <strong>프레임 {frame}에서 그리기 오류</strong>{'\n'}{message}
    {spot && root ? <>{'\n'}<a className="underline" href={editorLink(editor, root, spot)}>에디터에서 열기</a></> : null}
  </>;
  return <section className="area-stage flex min-h-0 min-w-0 flex-col" aria-label="무대">
    <StageHeader {...props} />
    <div className="stage-well relative min-h-0 flex-1" tabIndex={0} aria-label="컴포지션 무대. ←/→로 프레임 이동" data-stage>
      <Stage composition={composition} frame={frame} zoom={zoom} safe={safe} onClipped={onClipped} onAudio={onAudio} onCommit={onCommit} onError={onError} />
    </div>
  </section>;
}
