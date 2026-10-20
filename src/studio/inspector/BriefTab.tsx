import {ExternalLink} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Separator} from '@/components/ui/separator';
import type {CompositionEntry} from '../model';
import {Empty, Panel} from './Inspector';

export function BriefTab({entry, link}: {entry: CompositionEntry; link: (path: string) => string | null}) {
  const audio = entry.audio;
  const open = (path: string | null) => {
    const href = path ? link(path) : null;
    return href ? <Button asChild size="sm" variant="ghost"><a href={href}><ExternalLink aria-hidden="true" />에디터에서</a></Button> : null;
  };
  return <Panel>
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="mono">prompt.md</h3>{open(entry.files.brief)}</div>
      {entry.brief === null ? <Empty><code className="mono">prompt.md</code>가 없습니다. <code className="mono">{entry.folder}/prompt.md</code>에 만들면 여기에 보입니다.</Empty>
        : <pre className="font-[inherit] text-[13px] leading-5 break-words whitespace-pre-wrap" data-brief>{entry.brief}</pre>}
    </section>
    <Separator />
    <section>
      <div className="mb-2 flex items-center justify-between"><h3><span className="font-bold">소리</span> <span className="mono text-muted-foreground">audio.json</span></h3>{open(entry.files.audio)}</div>
      {'error' in audio ? <p className="text-fail" role="alert">audio.json을 읽지 못했습니다. {audio.error}</p>
        : !audio.value ? <Empty>이 컴포지션은 audio.json이 없습니다.</Empty>
        : <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] tnum">
          <dt className="text-muted-foreground">분위기</dt><dd>{[audio.value.mood, audio.value.bpm ? `${audio.value.bpm} bpm` : null, audio.value.key, audio.value.seed !== undefined ? `seed ${audio.value.seed}` : null].filter(Boolean).join(' · ')}</dd>
          <dt className="text-muted-foreground">구간</dt><dd>{audio.value.sections.map(section => <span key={`${section.label}${section.from}`} className="block">{section.label} {section.from}–{section.to}s {section.energy}</span>)}</dd>
          <dt className="text-muted-foreground">히트</dt><dd>{audio.value.hits.length ? audio.value.hits.map(hit => `${hit}s`).join(', ') : '없음'}</dd>
          <dt className="text-muted-foreground">음량 목표</dt><dd>{audio.value.loudness ? `${audio.value.loudness.I} LKFS, TP ${audio.value.loudness.TP} dBTP` : '−24 LKFS, TP −2 dBTP (기본)'}</dd>
          <dt className="text-muted-foreground">효과음</dt><dd>{audio.value.sfx.join(', ') || '없음'}</dd>
        </dl>}
    </section>
  </Panel>;
}
