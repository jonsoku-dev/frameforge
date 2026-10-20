import React from 'react';
import {ExternalLink, RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Separator} from '@/components/ui/separator';
import {Slider} from '@/components/ui/slider';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/lib/utils';
import type {Overrides, Variable} from '../model';
import {Panel} from './Inspector';

type Value = string | number | boolean;
type Props = {
  variables: Variable[]; saved: Overrides; values: Overrides; unsaved: number; ignored: string[]; fps: number; rendering: boolean;
  saveState: {saving: boolean; fault: string | null; savedAt: number | null};
  spotLink: string | null;
  onChange: (key: string, value: Value | undefined, timeStamp: number) => void; onPreview: (frame: number) => void; onSave: () => void; onRevert: () => void;
};

const input = 'h-7 w-full min-w-0 rounded-md border border-input bg-raised px-2';
const db = (value: number) => value <= 0 ? '무음' : `${(20 * Math.log10(value)).toFixed(1).replace('-', '−')}dB`;

function Control({variable, value, fps, onChange}: {variable: Variable; value: Value; fps: number; onChange: (value: Value, timeStamp: number) => void}) {
  const id = `var-${variable.key}`;
  switch (variable.type) {
    case 'string':
      return variable.multiline
        ? <Textarea id={id} rows={2} maxLength={variable.maxLength} value={String(value)} onChange={event => onChange(event.currentTarget.value, event.timeStamp)} />
        : <input id={id} className={input} maxLength={variable.maxLength} value={String(value)} onChange={event => onChange(event.currentTarget.value, event.timeStamp)} />;
    case 'color':
      return <div className="flex gap-2">
        <input type="color" className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-raised p-0.5" aria-label={`${variable.label} 견본`} value={/^#[0-9A-F]{6}$/i.test(String(value)) ? String(value).toLowerCase() : '#000000'} onChange={event => onChange(event.currentTarget.value.toUpperCase(), event.timeStamp)} />
        <input id={id} className={cn(input, 'mono uppercase')} value={String(value)} maxLength={7} onChange={event => { const next = event.currentTarget.value.toUpperCase(); if (/^#[0-9A-F]{0,6}$/.test(next)) onChange(next, event.timeStamp); }} />
      </div>;
    case 'number':
    case 'audioVolume': {
      const [min, max, step] = variable.type === 'number' ? [variable.min, variable.max, variable.step] : [0, 1, 0.05];
      const n = Number(value);
      const note = variable.type === 'audioVolume' ? `${n.toFixed(2)} ${db(n)}` : variable.unit === 'frames' ? `${String(n).replace('-', '−')} 프레임 (${(n / fps).toFixed(2).replace('-', '−')}초)` : `${n}${variable.unit ?? ''}`;
      return <div className="flex items-center gap-2">
        <Slider id={id} aria-label={variable.label} min={min} max={max} step={step} value={[n]} onValueChange={values => values[0] !== undefined && onChange(Number(values[0].toFixed(4)), performance.now())} />
        {variable.type === 'number' ? <input className={cn(input, 'w-16 shrink-0 text-right tnum')} type="number" min={min} max={max} step={step} aria-label={`${variable.label} 값`} value={n} onChange={event => { const next = Number(event.currentTarget.value); if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)), event.timeStamp); }} /> : null}
        <span className="w-28 shrink-0 text-right text-[12px] text-muted-foreground tnum">{note}</span>
      </div>;
    }
    case 'enum':
      return variable.options.length <= 3
        ? <div className="flex gap-1" role="radiogroup" aria-labelledby={`${id}-label`}>{variable.options.map(option => <Button key={option.value} size="sm" variant={value === option.value ? 'secondary' : 'ghost'} role="radio" aria-checked={value === option.value} onClick={event => onChange(option.value, event.timeStamp)}>{option.label}</Button>)}</div>
        : <select id={id} className={input} value={String(value)} onChange={event => onChange(event.currentTarget.value, event.timeStamp)}>{variable.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    case 'boolean':
      return <input id={id} type="checkbox" className="size-4" checked={Boolean(value)} onChange={event => onChange(event.currentTarget.checked, event.timeStamp)} />;
  }
}

export function TuneTab({variables, saved, values, unsaved, ignored, fps, rendering, saveState, spotLink, onChange, onPreview, onSave, onRevert}: Props) {
  if (!variables.length) return <Panel>
    <p className="font-bold">이 컴포지션은 조정 변수를 선언하지 않았습니다.</p>
    <p className="text-muted-foreground"><code className="mono">Spot.tsx</code> 옆에서 <code className="mono">export const variables = [...]</code>로 key, type, label, default를 선언하고, 진입 파일의 <code className="mono">&lt;Composition variables={'{variables}'} /&gt;</code>로 넘기면 여기에 조정 칸이 생깁니다. 값은 <code className="mono">Spot</code>이 props로 받습니다.</p>
    {spotLink ? <Button asChild size="sm" variant="secondary" className="self-start"><a href={spotLink}><ExternalLink aria-hidden="true" />Spot.tsx 열기</a></Button> : null}
  </Panel>;
  const differing = variables.filter(variable => (values[variable.key] ?? variable.default) !== variable.default).length;
  const groups = [...new Set(variables.map(variable => variable.group ?? '기타'))];
  return <Panel footer={<div className="flex flex-col gap-2">
    {rendering && unsaved ? <p className="text-[12px] text-muted-foreground">진행 중인 렌더는 시작할 때의 값으로 만듭니다.</p> : null}
    <div className="flex items-center gap-2">
      <span className={cn('flex-1 tnum', unsaved ? 'text-warn' : 'text-muted-foreground')} role="status">{saveState.saving ? '저장하는 중' : unsaved ? `저장 안 된 변경 ${unsaved}` : saveState.savedAt ? '저장했습니다' : '저장된 값과 같습니다'}</span>
      <Button size="sm" variant="ghost" disabled={!unsaved} onClick={onRevert}>되돌리기</Button>
      <Button size="sm" disabled={!unsaved || saveState.saving} onClick={onSave} title="⌘S">저장 ⌘S</Button>
    </div>
    {saveState.fault ? <p className="text-[12px] text-fail" role="alert">{saveState.fault}</p> : null}
  </div>}>
    <p className="tnum">변수 {variables.length} · 기본값과 다름 {differing}</p>
    {ignored.length ? <p className="rounded-md border border-warn/50 px-2 py-1 text-[12px] text-warn" role="status">{ignored.map(key => `overrides.json의 ${key}`).join(', ')}는 선언되지 않았거나 형식이 맞지 않아 무시합니다.</p> : null}
    {groups.map((group, index) => <section key={group} className="flex flex-col gap-2">
      {index ? <Separator className="mb-2" /> : null}
      <h3 className="text-[14px] font-bold">{group}</h3>
      {variables.filter(variable => (variable.group ?? '기타') === group).map(variable => {
        const value = values[variable.key] ?? variable.default;
        const changed = value !== variable.default;
        const dirty = value !== (saved[variable.key] ?? variable.default);
        return <div key={variable.key} className="flex flex-col gap-1" onFocusCapture={() => variable.preview !== undefined && onPreview(variable.preview)} data-variable={variable.key}>
          <div className="flex items-center gap-1">
            <label id={`var-${variable.key}-label`} htmlFor={`var-${variable.key}`} className="flex-1 font-bold">{variable.label}{dirty ? <span className="ml-1 text-warn" aria-label="저장 안 됨">*</span> : null}</label>
            {changed ? <span className="size-1.5 rounded-full bg-primary" title="기본값과 다름" aria-label="기본값과 다름" /> : null}
            {changed ? <Button size="icon" variant="ghost" aria-label={`${variable.label} 기본값으로`} title="기본값으로" onClick={event => onChange(variable.key, variable.default, event.timeStamp)}><RotateCcw aria-hidden="true" /></Button> : null}
          </div>
          <Control variable={variable} value={value} fps={fps} onChange={(next, timeStamp) => onChange(variable.key, next, timeStamp)} />
          {variable.help ? <p className="text-[12px] text-muted-foreground">{variable.help}</p> : null}
        </div>;
      })}
    </section>)}
  </Panel>;
}
