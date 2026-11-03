"""New original twelve-second PCM scores, no recovered track or external samples.
python3 scripts/production/entertainment_audio.py [starfall|moonpost|neon-tide]
"""
import sys, wave, json, hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2];SR=48000;D=12;N=SR*D

def make(film):
 rng=np.random.default_rng(24011);mix=np.zeros((N,2));bpm=120 if film=='neon-tide' else 120;beat=60/bpm
 def put(at,signal,amp=1,pan=0):
  i=round(at*SR);n=min(len(signal),N-i)
  if n<=0:return
  mix[i:i+n,0]+=signal[:n]*amp*np.sqrt((1-pan)/2);mix[i:i+n,1]+=signal[:n]*amp*np.sqrt((1+pan)/2)
 def tone(hz,dur=.3,kind='bell'):
  t=np.arange(round(dur*SR))/SR
  if kind=='bass':return (np.sin(2*np.pi*hz*t)+.18*np.sin(4*np.pi*hz*t))*np.minimum(t/.012,1)*np.exp(-t*5)
  if kind=='pad':return (np.sin(2*np.pi*hz*t)+.2*np.sin(2*np.pi*hz*2.003*t))*np.minimum(t/.12,1)*np.minimum((dur-t)/.23,1)*.7
  return (np.sin(2*np.pi*hz*t)+.32*np.sin(2*np.pi*hz*2.01*t)+.1*np.sin(2*np.pi*hz*3.99*t))*np.minimum(t/.004,1)*np.exp(-t*(7 if film=='moonpost' else 5))
 def hz(m):return 440*2**((m-69)/12)
 roots=[45,41,48,43] if film=='neon-tide' else [50,55,47,57] if film=='starfall' else [62,57,59,54]
 for sec,root in zip([0,3,6,9],roots):
  for note in [root+12,root+15 if film=='neon-tide' else root+16,root+19]:put(sec,tone(hz(note),3,'pad'),.065 if film!='neon-tide' else .085,pan=(note-root-16)/8)
 for b in range(24):
  root=roots[min(3,b//6)];at=b*beat
  if film=='neon-tide':
   t=np.arange(int(.35*SR))/SR;phase=2*np.pi*(45*t+75*.03*(1-np.exp(-t/.03)));put(at,np.sin(phase)*np.exp(-t*15),.32)
   if b%2: t=np.arange(int(.16*SR))/SR;put(at,rng.normal(0,1,len(t))*np.exp(-t*32),.045,.1)
   for k in range(2):
    t=np.arange(int(.07*SR))/SR;noise=rng.normal(0,1,len(t));noise=np.concatenate([[0],np.diff(noise)]);put(at+k*.25,noise*np.exp(-t*70),.018,(-1 if k else 1)*.4)
   put(at+.25,tone(hz(root),.35,'bass'),.18)
   if b>=6:put(at,tone(hz(root+24+[0,7,3,10][b%4]),.5),.10,(-1 if b%2 else 1)*.25)
  elif film=='starfall':
   put(at,tone(hz(root+12),.42,'bass'),.11)
   for k in range(2):put(at+k*.25,tone(hz(root+24+[0,4,7,12][(b*2+k)%4]),.4),.10,(-1 if k else 1)*.35)
   t=np.arange(int(.1*SR))/SR;put(at,rng.normal(0,1,len(t))*np.exp(-t*45),.012)
  else:
   put(at,tone(hz(root+[0,7,4,12][b%4]),.55),.12,(-1 if b%2 else 1)*.25)
   if b%2==0:put(at,tone(hz(root-12),.6,'bass'),.07)
 cues=([106,158,218,244,320] if film=='starfall' else [94,118,154,215,226,282] if film=='moonpost' else [90,180,270])
 for i,frame in enumerate(cues):
  for k,note in enumerate([81,85,88] if film!='neon-tide' else [69,76]):put(frame/30+k*.035,tone(hz(note+i%3),.35),.14 if film!='neon-tide' else .10,.1)
 fade=np.minimum(np.arange(N)/(.025*SR),1)*np.minimum((N-np.arange(N))/(.5*SR),1);mix*=fade[:,None];peak=np.max(np.abs(mix));mix*=.78/max(peak,1e-6)
 out=ROOT/'public/audio/generated'/(film+'-reconstruction');out.mkdir(parents=True,exist_ok=True);path=out/'music.wav'
 if path.exists():raise RuntimeError('Preserving existing authored score; select a new output/version before rerun')
 pcm=(np.clip(mix,-1,1)*32767).astype('<i2')
 with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
 (out/'provenance.json').write_text(json.dumps({'label':'new original synthesized reconstruction score','source':'scripts/production/entertainment_audio.py','film':film,'duration':D,'bpm':bpm,'sample_rate':SR,'channels':2,'cue_frames':cues,'peak':float(np.max(np.abs(mix))),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'listening':'not performed'},indent=2));print(path)
for film in sys.argv[1:] or ['starfall','moonpost','neon-tide']:make(film)
