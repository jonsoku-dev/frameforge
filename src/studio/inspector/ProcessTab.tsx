import React, {useRef, useState} from 'react';
import {Bot, Camera, Copy, ExternalLink, Film, Flag, LayoutGrid, MessageSquarePlus, PenLine, ShieldAlert, ShieldCheck, Terminal, User, Wrench} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {api} from '../api';
import {checkLines, resolutions, versions, type Artifact, type Run} from '../model';
import {when, type Drawer} from '../state';

const KIND: Record<Run['kind'], {label: string; icon: React.ComponentType<{className?: string}>}> = {
  author: {label: '작성', icon: PenLine}, review: {label: '리뷰', icon: Flag}, fix: {label: '수정', icon: Wrench}, render: {label: '렌더', icon: Film},
  check: {label: '검사', icon: ShieldCheck}, capture: {label: '캡처', icon: Camera}, request: {label: '요청', icon: MessageSquarePlus},
};
export const actorLabel = (actor: string) => actor === 'human' ? '사람' : actor;
const ActorIcon = ({actor}: {actor: string}) => {
  const Icon = actor === 'human' ? User : actor === 'script' ? Terminal : Bot;
  return <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
};

type Props = {
  runs: Run[]; selectedRun: string | null; aspect: number;
  onSelect: (runId: string) => void; onSeek: (frame: number) => void; onDrawer: (drawer: Drawer) => void; onOutput: () => void; link: (path: string) => string | null;
};

export function SheetStrip({artifact, aspect, onOpen}: {artifact: Artifact; aspect: number; onOpen: () => void}) {
  const tiles = artifact.frames?.length ?? 4;
  const columns = Math.min(4, tiles);
  const rowAspect = (columns * 484 - 4) / Math.round(480 / aspect);
  return <button type="button" className="block w-full overflow-hidden rounded-md border border-border bg-raised" style={{aspectRatio: rowAspect}} onClick={onOpen} aria-label={`시트 ${artifact.frames ? `${artifact.frames.length}장` : ''} 열기`}>
    <img src={api.media(artifact.path)} alt="" loading="lazy" className="block w-full" />
  </button>;
}

export function ProcessList({runs, selectedRun, aspect, onSelect, onSeek, onDrawer, onOutput, link}: Props) {
  const vs = versions(runs);
  const resolved = resolutions(runs);
  const seen = useRef<Set<string> | null>(null);
  const fresh = seen.current ? new Set(runs.filter(run => !seen.current!.has(run.id)).map(run => run.id)) : new Set<string>();
  seen.current = new Set(runs.map(run => run.id));
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const reviewActor = (findingId: string) => runs.find(run => run.findings?.some(finding => finding.id === findingId))?.actor;
  return <ol className="flex flex-col gap-2" aria-label="실행 기록">
    {runs.map((run, index) => ({run, version: vs[index]!})).reverse().map(({run, version}) => {
      const {label} = KIND[run.kind];
      let Icon = KIND[run.kind].icon;
      const sheet = run.artifacts.find(item => item.kind === 'sheet' || item.kind === 'still');
      const mp4 = run.artifacts.find(item => item.kind === 'mp4');
      const review = run.artifacts.find(item => item.kind === 'review');
      const lines = run.kind === 'check' ? checkLines(run.metrics ?? {}, null) : null;
      if (run.kind === 'render' && !mp4) Icon = LayoutGrid;
      if (lines && Object.values(lines).some(line => line.pass === false)) Icon = ShieldAlert;
      const status = run.kind === 'request' ? (resolved.has(run.id) ? `해결 v${resolved.get(run.id)}` : '열림') : null;
      const selected = selectedRun === run.id;
      return <li key={run.id} className={cn('rounded-lg border border-border bg-card p-3', selected && 'ring-1 ring-primary', fresh.has(run.id) && 'fresh-card')} data-run={run.id} data-kind={run.kind}>
        <button type="button" className="flex w-full min-w-0 items-center gap-2 text-left" onClick={() => { onSelect(run.id); if ((run.kind === 'request' || run.kind === 'capture') && run.frame !== undefined) onSeek(run.frame); if (run.kind === 'check') onOutput(); }} aria-pressed={selected}>
          <Icon className={cn('size-4 shrink-0', run.kind === 'request' ? 'text-primary' : 'text-muted-foreground')} />
          <span className="font-bold">{label}</span>
          <ActorIcon actor={run.actor} />
          <span className="min-w-0 truncate text-[12px] text-muted-foreground">{actorLabel(run.actor)} · <time dateTime={run.at} title={run.at}>{when(run.at)}</time></span>
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {run.frame !== undefined ? <span className="text-[11px] text-muted-foreground tnum">프레임 {run.frame}</span> : null}
            {run.kind === 'review' ? <Badge>지적 {run.findings?.length ?? 0}개</Badge> : null}
            {status ? <Badge className={status === '열림' ? 'border-primary/60 text-primary' : 'text-pass'}>{status}</Badge> : null}
            {run.kind === 'author' || run.kind === 'fix' || run.kind === 'render' ? <Badge>v{version}</Badge> : null}
          </span>
        </button>
        <div className="mt-1.5 flex flex-col gap-1.5 pl-6">
          {run.kind === 'request' ? <p className="break-words">{run.prompt?.text ?? run.summary}</p> : null}
          {run.kind === 'fix' && run.changes?.length ? <div><p className="text-[12px] text-muted-foreground">바뀐 것</p><ul className="list-disc pl-4">{run.changes.map((change, index) => <li key={index}>{change}</li>)}</ul></div> : null}
          {run.kind !== 'request' && !(run.kind === 'fix' && run.changes?.length) && !lines ? <p className="break-words">{run.summary}</p> : null}
          {run.kind === 'fix' && run.resolves?.length ? <p className="text-[12px] text-muted-foreground">해결한 지적 {run.resolves.length}개{reviewActor(run.resolves[0]!) ? ` (리뷰 ${reviewActor(run.resolves[0]!)})` : ''}</p> : null}
          {lines ? <p className="text-[12px]">{(['flash', 'frame', 'loudness', 'colorSpace'] as const).map(name => `${{flash: '플래시', frame: '화면 구성', loudness: '음량', colorSpace: '색 태그'}[name]} ${lines[name].pass === null ? '기록 없음' : lines[name].pass ? '통과' : '실패'}`).join(' · ')}</p> : null}
          {run.findings?.length ? <ol className="flex flex-col gap-1">{run.findings.map((finding, index) => <li key={finding.id}><button type="button" className="flex w-full gap-2 text-left text-[12px] hover:text-primary" onClick={() => finding.from !== undefined && onSeek(finding.from)}>
            <span className="shrink-0 tnum">{index + 1}.{finding.from !== undefined ? ` ${finding.from}` : ''}{finding.to !== undefined ? `–${finding.to}` : ''}</span><span className="min-w-0 flex-1">{finding.text}</span>
            <span className={cn('shrink-0', resolved.has(finding.id) ? 'text-pass' : 'text-warn')}>{resolved.has(finding.id) ? `✓ v${resolved.get(finding.id)}` : '미해결'}</span>
          </button></li>)}</ol> : null}
          {sheet ? <SheetStrip artifact={sheet} aspect={aspect} onOpen={() => { onSelect(run.id); onDrawer({kind: 'sheet', path: sheet.path, frames: sheet.frames}); }} /> : null}
          <div className="flex flex-wrap gap-1">
            {sheet ? <Button size="sm" variant="secondary" onClick={() => { onSelect(run.id); onDrawer({kind: 'sheet', path: sheet.path, frames: sheet.frames}); }}><LayoutGrid aria-hidden="true" />시트{sheet.frames ? ` ${sheet.frames.length}장` : ''}</Button> : null}
            {mp4 ? <Button size="sm" variant="secondary" onClick={() => onDrawer({kind: 'video', path: mp4.path})}><Film aria-hidden="true" />재생</Button> : null}
            {mp4 ? <Button size="sm" variant="ghost" aria-label="경로 복사" title={mp4.path} onClick={() => { void navigator.clipboard?.writeText(mp4.path); }}><Copy aria-hidden="true" /></Button> : null}
            {review ? <Button size="sm" variant="secondary" onClick={() => onDrawer({kind: 'file', path: review.path})}>{review.path.split('/').pop()}</Button> : null}
            {run.prompt && run.kind !== 'request' ? <Button size="sm" variant="ghost" aria-expanded={openPrompt === run.id} onClick={() => run.prompt?.text ? setOpenPrompt(openPrompt === run.id ? null : run.id) : run.prompt?.path && onDrawer({kind: 'file', path: run.prompt.path})}>프롬프트 보기</Button> : null}
            {run.prompt?.path && link(run.prompt.path) && run.kind !== 'request' ? <Button asChild size="icon" variant="ghost"><a href={link(run.prompt.path)!} aria-label="프롬프트를 에디터에서 열기"><ExternalLink aria-hidden="true" /></a></Button> : null}
          </div>
          {openPrompt === run.id && run.prompt?.text ? <pre className="rounded-md bg-raised p-2 text-[12px] break-words whitespace-pre-wrap">{run.prompt.text}</pre> : null}
        </div>
      </li>;
    })}
  </ol>;
}

export function ProcessTab({log, folder, processPath, link, composer, ...list}: Omit<Props, 'runs'> & {log: {value: {runs: Run[]} | null} | {error: string}; folder: string; processPath: string; composer: React.ReactNode}) {
  const runs = 'value' in log && log.value ? log.value.runs : [];
  const vs = versions(runs);
  const open = runs.filter(run => run.kind === 'request' && !resolutions(runs).has(run.id)).length;
  const editor = link(processPath);
  return <>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-3">
        {'error' in log ? <div className="rounded-lg border border-fail/60 p-3" role="alert">
          <p className="font-bold text-fail">process.json을 읽지 못했습니다.</p>
          <p className="mono mt-1 break-words">{log.error}</p>
          {editor ? <Button asChild size="sm" variant="secondary" className="mt-2"><a href={editor}><ExternalLink aria-hidden="true" />에디터에서 열기</a></Button> : null}
        </div> : !runs.length ? <p className="text-muted-foreground">아직 기록이 없습니다. 에이전트가 <code className="mono">{folder}/process.json</code>에 실행을 남기면 여기에 보입니다.</p> : <>
          <p className="text-[13px] tnum">버전 v{vs.at(-1) ?? 0} · 실행 {runs.length} · 열린 요청 {open}</p>
          <ProcessList runs={runs} link={link} {...list} />
        </>}
      </div>
    </div>
    <div className="shrink-0 border-t border-border bg-panel p-3">{composer}</div>
  </>;
}
