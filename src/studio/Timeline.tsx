import React, {useRef, useState} from 'react';
import {ChevronFirst, ChevronLast, Pause, Play, StepBack, StepForward, Volume2, VolumeX} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {SceneBand} from './brief';
import type {AudioSpec} from './model';
import {timecode} from './state';

export type Mark = {frame: number; to?: number; kind: 'empty' | 'static' | 'flash' | 'clip' | 'fail-static'; label: string};
export type Tick = {frame: number; kind: 'sheet' | 'request'; label: string; tile?: {src: string; index: number; columns: number; tileHeight: number}};

type Props = {
  fps: number; duration: number; frame: number; playing: boolean;
  bands: SceneBand[]; audio: AudioSpec | null; marks: Mark[]; ticks: Tick[];
  muted: boolean; volume: number; audioBlocked: boolean;
  onSeek: (frame: number) => void; onToggle: () => void; onStep: (delta: number) => void; onHome: () => void; onEnd: () => void;
  onMute: () => void; onVolume: (volume: number) => void;
};

const LABEL = 44;

export function Timeline({fps, duration, frame, playing, bands, audio, marks, ticks, muted, volume, audioBlocked, onSeek, onToggle, onStep, onHome, onEnd, onMute, onVolume}: Props) {
  const lanes = useRef<HTMLDivElement>(null);
  const [frameInput, setFrameInput] = useState<string | null>(null);
  const [hover, setHover] = useState<Tick | null>(null);
  const pct = (value: number) => `${(Math.min(duration, Math.max(0, value)) / duration) * 100}%`;
  const frameAt = (clientX: number) => {
    const rect = lanes.current!.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * (duration - 1));
  };
  const drag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    onSeek(frameAt(event.clientX));
    const move = (next: PointerEvent) => onSeek(frameAt(next.clientX));
    const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
  const seconds = duration / fps;
  const step = seconds > 40 ? 10 : seconds > 12 ? 5 : 1;
  const scene = bands.find(band => frame >= band.from && frame < band.to)?.name;
  const twoRows = bands.some(band => band.row === 1);
  const lastTwo = audio?.sections.filter(section => section.to > seconds - 2 && section.energy > 0.15);
  return <footer className="area-timeline flex min-w-0 flex-col border-t border-border bg-panel" aria-label="타임라인">
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2" style={{height: 'var(--transport)'}}>
      <Button size="icon" variant="ghost" aria-label={playing ? '일시정지 (Space)' : '재생 (Space)'} title={playing ? '일시정지 (Space)' : '재생 (Space)'} onClick={onToggle} data-play>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</Button>
      <Button size="icon" variant="ghost" aria-label="처음 (Home)" title="처음 (Home)" onClick={onHome}><ChevronFirst aria-hidden="true" /></Button>
      <Button size="icon" variant="ghost" aria-label="1프레임 뒤 (←)" title="1프레임 뒤 (←)" onClick={() => onStep(-1)}><StepBack aria-hidden="true" /></Button>
      <Button size="icon" variant="ghost" aria-label="1프레임 앞 (→)" title="1프레임 앞 (→)" onClick={() => onStep(1)}><StepForward aria-hidden="true" /></Button>
      <Button size="icon" variant="ghost" aria-label="끝 (End)" title="끝 (End)" onClick={onEnd}><ChevronLast aria-hidden="true" /></Button>
      <input className="ml-2 h-7 w-16 rounded-md border border-input bg-raised px-2 text-right tnum" aria-label="프레임 번호" inputMode="numeric" value={frameInput ?? String(frame)}
        onFocus={event => { setFrameInput(String(frame)); event.currentTarget.select(); }}
        onChange={event => setFrameInput(event.currentTarget.value.replace(/\D/g, ''))}
        onBlur={() => setFrameInput(null)}
        onKeyDown={event => { if (event.key === 'Enter' && frameInput) { onSeek(Number(frameInput)); event.currentTarget.blur(); } }} />
      <output className="ml-2 text-[13px] tnum" aria-label="현재 시간">{timecode(frame, fps)} <span className="text-subtle-foreground">/ {timecode(duration, fps)}</span></output>
      <div className="ml-auto flex items-center gap-2">
        {audioBlocked ? <span className="text-[12px] text-warn">눌러서 소리 켜기</span> : null}
        <Button size="icon" variant="ghost" aria-label={muted || audioBlocked ? '소리 켜기' : '음소거'} title="미리듣기 음소거" onClick={onMute}>{muted || audioBlocked ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</Button>
        <input type="range" className="w-24 accent-[var(--primary)]" min={0} max={1} step={0.05} value={volume} aria-label="미리듣기 음량" onChange={event => onVolume(Number(event.currentTarget.value))} />
      </div>
    </div>
    <div className="relative flex min-h-0 flex-1 flex-col pr-3 select-none">
      <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary" style={{left: `calc(${LABEL}px + (100% - ${LABEL + 12}px) * ${Math.min(frame, duration) / duration})`}} data-playhead />
      <Row label="" height={20}>
        {Array.from({length: Math.ceil(seconds / step)}, (_, index) => index * step).map(second => <span key={second} className="absolute top-0 h-full border-l border-border pl-1 text-[11px] leading-5 text-subtle-foreground tnum" style={{left: pct(second * fps)}}>{second}s</span>)}
      </Row>
      <div ref={lanes} className="absolute top-0 right-3 bottom-0 cursor-ew-resize" style={{left: LABEL}} onPointerDown={drag}
        role="slider" tabIndex={-1} aria-label="재생 위치" aria-valuemin={0} aria-valuemax={duration - 1} aria-valuenow={frame} aria-valuetext={`프레임 ${frame}, ${(frame / fps).toFixed(1)}초${scene ? `, 장면 ${scene}` : ''}`} />
      <Row label="장면" height={twoRows ? 'calc(var(--lane) * 2)' : 'var(--lane)'}>
        {bands.length ? bands.map((band, index) => <button key={index} type="button" className="absolute h-[calc(var(--lane)-4px)] overflow-hidden rounded-[4px] border border-border bg-raised px-1 text-left text-[11px] leading-4 text-ellipsis whitespace-nowrap hover:bg-card" style={{left: pct(band.from), width: pct(band.to - band.from), top: band.row ? 'calc(var(--lane) + 2px)' : 2}} title={`${band.from}–${band.to} ${band.detail}`} onClick={() => onSeek(band.from)} data-scene-band>{band.name}</button>)
          : <span className="px-2 text-[11px] leading-5 text-subtle-foreground">기획서에서 장면표를 찾지 못했습니다</span>}
      </Row>
      <Row label="소리">
        {audio ? <>
          {audio.sections.map((section, index) => <span key={index} className="pointer-events-none absolute bottom-0.5 rounded-t-[2px] bg-[oklch(0.72_0.08_250/45%)] text-[10px] leading-3 text-foreground/80" style={{left: pct(section.from * fps), width: pct((section.to - section.from) * fps), height: `calc((var(--lane) - 4px) * ${Math.max(0.15, Math.min(1, section.energy))})`}} title={`${section.label} ${section.from}–${section.to}초 ${section.energy}`} data-audio-section />)}
          {audio.hits.map(hit => <button key={hit} type="button" className="absolute top-1/2 z-[11] size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground" style={{left: pct(hit * fps)}} title={`히트 ${hit.toFixed(1)}초 (프레임 ${Math.round(hit * fps)})`} aria-label={`히트 ${hit}초`} onClick={() => onSeek(Math.round(hit * fps))} data-audio-hit />)}
          {lastTwo?.length ? <span className="absolute right-0 top-1/2 z-[11] size-2 -translate-y-1/2 rounded-full bg-warn" title={`규칙 위반 가능. 마지막 2초 에너지 ${Math.max(...lastTwo.map(item => item.energy))}`} /> : null}
        </> : <span className="px-2 text-[11px] leading-5 text-subtle-foreground">audio.json 없음</span>}
      </Row>
      <Row label="검사">
        {marks.map((mark, index) => <button key={index} type="button" title={mark.label} aria-label={mark.label} onClick={() => onSeek(mark.frame)}
          className={cn('absolute top-1 bottom-1 z-[11] min-w-1 rounded-[2px]', mark.kind === 'empty' && 'bg-[repeating-linear-gradient(45deg,oklch(1_0_0/30%)_0_2px,transparent_2px_5px)]', mark.kind === 'static' && 'bg-warn/60', mark.kind === 'fail-static' && 'bg-warn/60 ring-1 ring-fail', mark.kind === 'flash' && 'bg-fail/70', mark.kind === 'clip' && 'w-1 bg-fail')}
          style={{left: pct(mark.frame), width: mark.to === undefined ? undefined : pct(mark.to - mark.frame + 1)}} />)}
      </Row>
      <Row label="과정">
        {ticks.map((tick, index) => <button key={index} type="button" aria-label={tick.label} onClick={() => onSeek(tick.frame)} onMouseEnter={() => setHover(tick)} onMouseLeave={() => setHover(null)}
          className={cn('absolute top-0 z-[11] -translate-x-1/2', tick.kind === 'sheet' ? 'h-full w-1.5 before:absolute before:inset-y-1 before:left-0.5 before:w-0.5 before:bg-foreground' : 'top-1/2 size-3 -translate-y-1/2 rotate-45 bg-primary')}
          style={{left: pct(tick.frame)}} data-tick={tick.kind} />)}
      </Row>
      {hover ? <TickPreview tick={hover} left={pct(hover.frame)} /> : null}
    </div>
  </footer>;
}

function Row({label, height = 'var(--lane)', children}: {label: string; height?: number | string; children: React.ReactNode}) {
  return <div className="pointer-events-none relative flex shrink-0 border-b border-border/60" style={{height}}>
    <span className="w-11 shrink-0 px-2 text-[11px] leading-5 text-muted-foreground">{label}</span>
    <div className="pointer-events-none relative min-w-0 flex-1 [&>*]:pointer-events-auto">{children}</div>
  </div>;
}

/** 160 px crop of the sheet tile at the tick, using the render.mjs tile geometry (3.5). */
function TickPreview({tick, left}: {tick: Tick; left: string}) {
  const tile = tick.tile;
  return <div className="pointer-events-none absolute bottom-full z-50 mb-1 -translate-x-1/2 rounded-md border border-border bg-card p-1 text-[11px] shadow-xl" style={{left: `calc(${LABEL}px + (100% - ${LABEL + 12}px) * ${parseFloat(left) / 100})`}} data-tick-preview>
    {tile ? <div className="relative overflow-hidden" style={{width: 160, height: Math.round(160 * tile.tileHeight / 480)}}>
      <img src={tile.src} alt="" className="absolute top-0 left-0 max-w-none origin-top-left" style={{transform: `scale(${160 / 480}) translate(${-(tile.index % tile.columns) * 484}px, ${-Math.floor(tile.index / tile.columns) * (tile.tileHeight + 4)}px)`}} />
    </div> : null}
    <span className="block px-1 tnum">{tick.label}</span>
  </div>;
}
