import {flushSync} from 'react-dom';
import {setInputProps, setStaticFiles, collectAudio, collectFrameHints, collectMotion, collectSoundMaps, deriveSoundEvents, mapSoundEvents, type AudioClip, type ClipRect, type StaticFile, type MotionSample, type SoundMap, type DerivedClip} from '../core/index';
import {collectArtifacts, collectVideos, type ArtifactEntry, type VideoClip} from '../core/index';
import {findClippedText, type ClippedText} from './textGuard';
import {activeInput, Boundary, definitions, discover, info, renderMode, root, Scene, settle, target, type Info, type Props} from './runtime';
import './style.css';

declare global {
  interface Window {
    __FRAMEFORGE_INPUT__?: Props;
    __FRAMEFORGE_ERROR__?: string;
    __FRAMEFORGE__?: {
      compositions: Info[];
      configure: (props: Props) => Promise<Info[]>;
      /** skip: the frame rendered Experimental.Null; clip: the Experimental.Clipper rectangle to capture. */
      renderFrame: (id: string, frame: number, props?: Props) => Promise<{skip: boolean; clip: ClipRect | null}>;
      audit: () => Omit<ClippedText, 'element'>[];
      audio: () => AudioClip[];
      /** The <Video> elements rendered since the last call; read-only, the frame server extracts on demand. */
      video: () => VideoClip[];
      /** The <Artifact> files rendered since the last call, for scripts/artifacts.mjs. */
      artifacts: () => ArtifactEntry[];
      /** Clips derived from the motion reported by every frame rendered so far (reset when frame 0 renders). */
      soundClips: (fps: number) => DerivedClip[];
    };
  }
}

async function start() {
  if (!renderMode) root.render(<p className="studio-boot">장면을 불러오는 중</p>);
  try {
    setInputProps(window.__FRAMEFORGE_INPUT__ ?? {});
    // getStaticFiles() is synchronous, so the listing loads before any composition renders; without it the list stays empty.
    setStaticFiles(await fetch('/__frameforge/static-files').then(response => response.json() as Promise<StaticFile[]>).catch(() => []));
    await import('@video-entry');
    await discover(window.__FRAMEFORGE_INPUT__ ?? {});
    if (renderMode) {
      document.body.classList.add('render-mode');
      const motion: MotionSample[] = [];
      let maps: SoundMap[] = [];
      window.__FRAMEFORGE__ = {
        compositions: [...definitions.values()].map(info),
        configure: async input => {
          const result = await discover(input);
          window.__FRAMEFORGE__!.compositions = result;
          return result;
        },
        renderFrame: async (id, frame, input = activeInput) => {
          if (JSON.stringify(input) !== JSON.stringify(activeInput)) await window.__FRAMEFORGE__!.configure(input);
          const composition = definitions.get(id);
          if (!composition) throw new Error(`Unknown composition ${id}`);
          if (!Number.isInteger(frame) || frame < 0 || frame >= composition.durationInFrames) throw new Error(`Frame out of range: ${frame}`);
          window.__FRAMEFORGE_ERROR__ = undefined;
          setInputProps(input);
          collectAudio();
          collectFrameHints();
          collectMotion();
          if (frame === 0) { motion.length = 0; maps = []; }
          flushSync(() => root.render(<Boundary key={id} resetKey={`${frame}:${composition.durationInFrames}:${JSON.stringify(input)}`}><Scene composition={composition} frame={frame} /></Boundary>));
          await settle();
          motion.push(...collectMotion());
          const declared = collectSoundMaps();
          if (declared.length) maps = declared;
          return collectFrameHints();
        },
        soundClips: () => mapSoundEvents(deriveSoundEvents(motion), maps, definitions.values().next().value?.fps ?? 30),
        audit: () => findClippedText(target).map(({element, ...rest}) => rest),
        audio: collectAudio,
        video: collectVideos,
        artifacts: collectArtifacts,
      };
    } else {
      const {App} = await import('./App');
      root.render(<App />);
    }
  } catch (error) {
    window.__FRAMEFORGE_ERROR__ = String(error);
    root.render(renderMode ? <div className="error" role="alert">{String(error)}</div> : <div className="error studio-boot" role="alert">
      <strong>진입 파일을 불러오지 못했습니다.</strong>{'\n'}{String(error)}{'\n\n'}파일 {__VIDEO_ENTRY__}{'\n'}파일을 고치면 Vite가 다시 불러옵니다. <button type="button" onClick={() => location.reload()}>다시 시도</button>
    </div>);
  }
}

void start();
