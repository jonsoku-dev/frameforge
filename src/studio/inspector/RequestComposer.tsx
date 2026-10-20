import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {api} from '../api';

export const REQUEST_FIELD = 'request-text';

export function RequestComposer({compositionId, frame, duration, draftLines, onSent}: {compositionId: string; frame: number; duration: number; draftLines: string[]; onSent: () => void}) {
  const [text, setText] = useState('');
  const [pinned, setPinned] = useState<number | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [attach, setAttach] = useState(true);
  const [state, setState] = useState<{sending: boolean; fault: string | null; sent: boolean}>({sending: false, fault: null, sent: false});
  const target = pinned === undefined ? frame : pinned;
  const send = async () => {
    const body = text.trim();
    if (!body || state.sending) return;
    const full = attach && draftLines.length ? `${body}\n\n지금 값\n${draftLines.map(line => `- ${line}`).join('\n')}` : body;
    setState({sending: true, fault: null, sent: false});
    try {
      await api.request(compositionId, full.slice(0, 2000), target);
      setText('');
      setPinned(undefined);
      setState({sending: false, fault: null, sent: true});
      onSent();
    } catch (error) {
      setState({sending: false, fault: error instanceof Error ? error.message : '요청을 보내지 못했습니다.', sent: false});
    }
  };
  return <div className="flex flex-col gap-2" data-request-composer>
    <div className="flex items-center justify-between">
      <label htmlFor={REQUEST_FIELD} className="font-bold">변경 요청</label>
      <div className="relative">
        <Button size="sm" variant="ghost" aria-expanded={picking} onClick={() => setPicking(!picking)}><span className="tnum">{target === null ? '프레임 없음' : `프레임 ${target}`}</span><ChevronDown aria-hidden="true" /></Button>
        {picking ? <div className="slide-in absolute right-0 bottom-8 z-40 flex w-48 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
          <input className="h-7 rounded-md border border-input bg-raised px-2 tnum" type="number" min={0} max={duration - 1} aria-label="요청 프레임" defaultValue={target ?? frame}
            onKeyDown={event => { if (event.key === 'Enter') { const value = Number(event.currentTarget.value); if (Number.isInteger(value) && value >= 0 && value < duration) { setPinned(value); setPicking(false); } } }} />
          <Button size="sm" variant="ghost" onClick={() => { setPinned(undefined); setPicking(false); }}>지금 무대 프레임</Button>
          <Button size="sm" variant="ghost" onClick={() => { setPinned(null); setPicking(false); }}>프레임 없음</Button>
        </div> : null}
      </div>
    </div>
    <Textarea id={REQUEST_FIELD} rows={3} maxLength={2000} placeholder="무엇을 바꾸면 좋을지 적어 주세요" value={text}
      onChange={event => { setText(event.currentTarget.value); if (state.sent || state.fault) setState({...state, sent: false}); }}
      onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void send(); } }} />
    {draftLines.length ? <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={attach} onChange={event => setAttach(event.currentTarget.checked)} />저장 안 된 값 {draftLines.length}개 포함</label> : null}
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-subtle-foreground tnum">{text.length} / 2000자</span>
      <Button size="sm" disabled={!text.trim() || state.sending} onClick={() => { void send(); }} title="⌘Enter">{state.sending ? '보내는 중' : '요청 ⌘Enter'}</Button>
    </div>
    {state.fault ? <p className="text-[12px] text-fail" role="alert">{state.fault}</p> : null}
    {state.sent ? <p className="text-[12px] text-pass" role="status">요청을 남겼습니다.</p> : null}
  </div>;
}
