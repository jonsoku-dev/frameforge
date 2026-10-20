import React, {useState} from 'react';
import {Check, Copy, Minus, TriangleAlert, X} from 'lucide-react';
import {BorderBeam} from '@/components/magicui/border-beam';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Separator} from '@/components/ui/separator';
import {cn} from '@/lib/utils';
import {api} from '../api';
import {normalizeFrames} from '../brief';
import {checkLines, versions, type CheckLine, type CheckName, type ImportedResults, type Run} from '../model';
import type {Info} from '../runtime';
import {when, type Drawer} from '../state';
import {Panel} from './Inspector';
import {SheetStrip} from './ProcessTab';

export type JobView = {
  id: string; compositionId: string; kind: 'mp4' | 'sheet'; state: 'queued' | 'running' | 'done' | 'failed' | 'gone';
  stage: string; position: number; rendered: number; total: number; startedAt: number | null; log: string[];
  checks: {name: string; pass: boolean; summary: string}[]; fault?: {fault: string; detail: string; frame?: number};
  artifact?: {kind: string; path: string; frames?: number[]}; endedAt?: number;
};
export const RENDER_BUTTON = 'render-mp4';
const STAGES: Record<string, string> = {queued: '대기', audio: '소리 만들기', frames: '프레임 그리기', encoding: '인코딩', checks: '검사', done: '끝', failed: '실패'};
const CHECK_LABELS: Record<CheckName, string> = {clip: '글자 잘림', flash: '플래시', frame: '화면 구성', loudness: '음량', colorSpace: '색 태그'};

type Props = {
  info: Info; runs: Run[]; imported: ImportedResults | null; initialFrames: number[]; frame: number; clippedNow: number; unsaved: number; jobs: JobView[];
  onRender: (kind: 'mp4' | 'sheet', frames?: number[]) => void; onSaveAndRender: () => void; onSeek: (frame: number) => void; onDrawer: (drawer: Drawer) => void; onTune: () => void;
};

function StatusIcon({pass}: {pass: boolean | null}) {
  if (pass === null) return <Minus className="size-4 shrink-0 text-subtle-foreground" aria-label="기록 없음" />;
  return pass ? <Check className="size-4 shrink-0 text-pass" aria-label="통과" /> : <X className="size-4 shrink-0 text-fail" aria-label="실패" />;
}

function CheckRows({lines, stale, onSeek, onTune}: {lines: Record<CheckName, CheckLine>; stale: boolean; onSeek: (frame: number) => void; onTune: () => void}) {
  return <ul className="flex flex-col gap-1" aria-label="검사 결과">
    {(Object.keys(CHECK_LABELS) as CheckName[]).map(name => {
      const line = lines[name];
      const failed = line.pass === false;
      return <li key={name} className="flex items-start gap-2" data-check={name} data-pass={String(line.pass)}>
        <StatusIcon pass={stale && failed ? null : line.pass} />
        <span className="w-16 shrink-0 font-bold">{CHECK_LABELS[name]}</span>
        <span className={cn('min-w-0 flex-1 break-words tnum', failed && !stale ? 'text-fail' : 'text-muted-foreground')}>{line.summary}
          {failed && line.frame !== undefined ? <Button size="sm" variant="ghost" className="ml-1 h-6" onClick={() => onSeek(line.frame!)}>{line.frame}으로 이동</Button> : null}
          {failed && name === 'loudness' ? <Button size="sm" variant="ghost" className="ml-1 h-6" onClick={onTune}>음악 음량 조정</Button> : null}
        </span>
      </li>;
    })}
  </ul>;
}

function JobCard({job, perFrame}: {job: JobView; perFrame: number | null}) {
  const [showLog, setShowLog] = useState(false);
  if (job.state === 'gone') return <div className="rounded-lg border border-border bg-card p-3" role="status">서버가 다시 시작되어 렌더가 중단되었습니다.</div>;
  if (job.state === 'done') return <div className="rounded-lg border border-border bg-card p-3" role="status">렌더를 마쳤습니다. <span className="mono break-all">{job.artifact?.path}</span></div>;
  if (job.state === 'queued') return <div className="rounded-lg border border-border bg-card p-3" role="status">{job.kind === 'mp4' ? 'MP4' : '시트'} · 앞 작업이 끝나면 시작합니다 (대기 {job.position}번째)</div>;
  if (job.state === 'failed') return <div className="rounded-lg border border-fail/70 bg-card p-3" role="alert">
    <p className="font-bold text-fail">렌더 실패</p>
    <p>{job.fault?.fault}</p>
    {job.fault?.frame !== undefined ? <p className="text-[12px] text-muted-foreground">프레임 {job.fault.frame}</p> : null}
    {job.fault?.detail ? <details className="mt-1"><summary className="cursor-pointer text-[12px] text-muted-foreground">원문 오류</summary><pre className="mono mt-1 break-words whitespace-pre-wrap">{job.fault.detail}</pre></details> : null}
  </div>;
  const elapsed = job.startedAt ? (Date.now() - job.startedAt) / 1000 : 0;
  const ratio = job.total ? job.rendered / job.total : 0;
  const speed = perFrame ?? (job.rendered ? elapsed / job.rendered : null);
  const remaining = speed !== null && job.total ? Math.max(0, Math.round((job.total - job.rendered) * speed)) : null;
  return <div className="relative rounded-lg border border-border bg-card p-3" role="status" aria-live="polite" data-job={job.id}>
    {job.state === 'running' ? <BorderBeam size={80} duration={6} colorFrom="oklch(0.72 0.13 250)" colorTo="oklch(0.6 0.1 250)" /> : null}
    <p className="font-bold">진행 중 · {job.kind === 'mp4' ? 'MP4' : '시트'} · {STAGES[job.stage] ?? job.stage}</p>
    <p className="tnum">프레임 <span data-rendered>{job.rendered}</span> / {job.total} <span className="text-muted-foreground">{Math.round(ratio * 100)}%</span></p>
    <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full bg-primary transition-[width] duration-[120ms] ease-linear" style={{width: `${ratio * 100}%`}} /></div>
    <p className="text-[12px] text-muted-foreground tnum">경과 {Math.round(elapsed)}초{remaining !== null && job.stage === 'frames' ? ` · 남은 시간 약 ${remaining}초` : ''}</p>
    <button type="button" className="mt-1 text-[12px] text-muted-foreground" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>{showLog ? '▾' : '▸'} 로그</button>
    {showLog ? <pre className="mono mt-1 max-h-40 overflow-auto break-words whitespace-pre-wrap">{job.log.slice(-20).join('\n')}</pre> : null}
    {job.checks.length ? <ul className="mt-1 text-[12px]">{job.checks.map(check => <li key={check.name} className={check.pass ? 'text-pass' : 'text-fail'}>{check.pass ? '✓' : '✗'} {check.name} {check.summary}</li>)}</ul> : null}
  </div>;
}

export function OutputTab({info, runs, imported, initialFrames, frame, clippedNow, unsaved, jobs, onRender, onSaveAndRender, onSeek, onDrawer, onTune}: Props) {
  const [frames, setFrames] = useState(initialFrames);
  const [adding, setAdding] = useState('');
  const [older, setOlder] = useState(false);
  const vs = versions(runs);
  const current = vs.at(-1) ?? 0;
  const renders = runs.map((run, index) => ({run, version: vs[index]!})).filter(({run}) => run.kind === 'render' && run.artifacts.some(item => item.kind === 'mp4' || item.kind === 'sheet')).reverse();
  const lastMp4 = renders.find(({run}) => run.artifacts.some(item => item.kind === 'mp4'));
  const seconds = (run: Run | undefined) => typeof run?.metrics?.seconds === 'number' ? run.metrics.seconds : null;
  const busy = jobs.some(job => job.state === 'running' || job.state === 'queued');
  const add = (values: number[]) => setFrames(normalizeFrames([...frames, ...values.filter(value => Number.isInteger(value) && value >= 0 && value < info.durationInFrames)]));
  const perFrame = (kind: 'mp4' | 'sheet') => {
    const last = renders.find(({run}) => run.artifacts.some(item => item.kind === kind))?.run;
    const total = typeof last?.metrics?.frames === 'number' ? last.metrics.frames : null;
    return seconds(last) !== null && total ? seconds(last)! / total : null;
  };
  const result = (run: Run, version: number, index: number) => {
    const mp4 = run.artifacts.find(item => item.kind === 'mp4');
    const sheet = run.artifacts.find(item => item.kind === 'sheet');
    const check = runs.find(item => item.kind === 'check' && item.metrics?.of === run.id);
    const stale = version < current;
    const artifact = (mp4 ?? sheet)!;
    return <div key={run.id} className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3', stale ? 'border-subtle-foreground/50' : 'border-border')} data-result={run.id}>
      <p className="flex items-center gap-2 font-bold">{index === 0 ? '결과' : '이전 결과'} · <time title={run.at}>{when(run.at)}</time> · v{version}{stale ? <Badge className="text-muted-foreground" data-stale>v{version} 결과. 지금은 v{current}</Badge> : null}</p>
      {mp4 ? <video className="w-full rounded-md bg-black" src={api.media(mp4.path)} controls preload="metadata" /> : sheet ? <SheetStrip artifact={sheet} aspect={info.width / info.height} onOpen={() => onDrawer({kind: 'sheet', path: sheet.path, frames: sheet.frames})} /> : null}
      <div className="flex items-center gap-1"><span className="mono min-w-0 flex-1 break-all text-muted-foreground">{artifact.path}</span><Button size="icon" variant="ghost" aria-label="경로 복사" onClick={() => { void navigator.clipboard?.writeText(artifact.path); }}><Copy aria-hidden="true" /></Button></div>
      {mp4 ? <CheckRows lines={checkLines(check?.metrics ?? null, null)} stale={stale} onSeek={onSeek} onTune={onTune} /> : <p className="flex items-center gap-2 text-[13px]"><StatusIcon pass={true} /><span className="font-bold">글자 잘림</span><span className="text-muted-foreground">렌더 중 0곳</span></p>}
    </div>;
  };
  return <Panel>
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-bold">MP4</h3>
      <p className="text-muted-foreground tnum">{info.width}×{info.height} · {info.durationInFrames}프레임{seconds(lastMp4?.run) !== null ? ` · 지난번 ${seconds(lastMp4?.run)}초` : ''}</p>
      {clippedNow ? <p className="flex gap-1 text-[12px] text-fail" role="alert"><TriangleAlert className="size-4 shrink-0" aria-hidden="true" />지금 프레임에서 글자가 잘립니다. MP4 렌더는 이 프레임에서 멈춥니다.</p> : null}
      {unsaved ? <p className="text-[12px] text-warn">저장 안 된 변경 {unsaved}개는 렌더에 들어가지 않습니다. <Button size="sm" variant="ghost" className="h-6" onClick={onSaveAndRender}>저장하고 렌더</Button></p> : null}
      <Button id={RENDER_BUTTON} className="self-start" onClick={() => onRender('mp4')}>MP4 만들기</Button>
    </section>
    <Separator />
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-bold">콘택트 시트</h3>
      <ul className="flex flex-wrap gap-1" aria-label="시트 프레임">
        {frames.map(item => <li key={item} className="flex h-6 items-center gap-0.5 rounded-[4px] border border-border bg-raised pl-1.5 text-[12px] tnum" data-sheet-chip={item}>
          <button type="button" onClick={() => onSeek(item)} title={`${item}으로 이동`}>{item}</button>
          <button type="button" className="flex size-5 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={`프레임 ${item} 빼기`} onClick={() => setFrames(frames.filter(value => value !== item))}><X className="size-3" aria-hidden="true" /></button>
        </li>)}
        <li><input className="h-6 w-16 rounded-[4px] border border-input bg-raised px-1.5 text-[12px] tnum" aria-label="프레임 더하기" placeholder="+" inputMode="numeric" value={adding} onChange={event => setAdding(event.currentTarget.value.replace(/[^\d,\s]/g, ''))} onKeyDown={event => { if (event.key === 'Enter') { add(adding.split(/[,\s]+/).filter(Boolean).map(Number)); setAdding(''); } }} /></li>
      </ul>
      <p className="text-[12px] text-subtle-foreground tnum">{frames.length}장 · 1–40장 · 기획서 검사 프레임에서 채움</p>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={() => add([frame])}>현재 프레임 추가</Button>
        <Button size="sm" disabled={!frames.length || frames.length > 40} onClick={() => onRender('sheet', frames)}>시트 만들기</Button>
      </div>
    </section>
    {jobs.length ? <section className="flex flex-col gap-2">{jobs.map(job => <JobCard key={job.id} job={job} perFrame={perFrame(job.kind)} />)}</section> : null}
    <Separator />
    {renders.length ? <section className="flex flex-col gap-2">
      {result(renders[0]!.run, renders[0]!.version, 0)}
      {renders.length > 1 ? <>
        <button type="button" className="self-start text-muted-foreground" aria-expanded={older} onClick={() => setOlder(!older)}>이전 결과 {renders.length - 1}개 {older ? '▾' : '▸'}</button>
        {older ? renders.slice(1).map(({run, version}, index) => result(run, version, index + 1)) : null}
      </> : null}
    </section> : imported ? <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3" data-result="imported">
      <p className="font-bold">가져온 결과 <span className="font-normal text-muted-foreground">renders/samples/results.json</span></p>
      <CheckRows lines={checkLines(null, imported)} stale={false} onSeek={onSeek} onTune={onTune} />
    </section> : busy ? null : <p className="text-muted-foreground" data-empty-output>아직 렌더가 없습니다.</p>}
  </Panel>;
}
