import {AbsoluteFill, Audio, Canvas2D, MotionSound, Shader, beatsFromSpec, googleFont, rng, useCurrentFrame, useVideoConfig} from 'frameforge';
import spec from './template.audio.json';

// A bespoke starter: three layers you replace with the film's own rendering code (skills/frameforge-best-practices/references/bespoke.md).
// Every placeholder below is grey on purpose: nothing here is a design to keep. Replace every TODO, keep the sizes and the contracts.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
// Minimums from docs/samples/rules.md (구성 최소치). Go bigger, never smaller.
const SIZES = {headline: S * 0.1, label: Math.ceil(S * 0.035), marginX: W * 0.05, marginY: H * 0.05};
// TODO the concept's own faces (Google Fonts; never a system font). The same string works in CSS and in ctx.font.
const display = googleFont('Inter', {weights: [800], fallback: 'sans-serif'});
// TODO the palette derived from the concept (four colours at most).
const palette = {ink: '#111111', paper: '#EEEEEE', accent: '#888888', soft: '#444444'};
// TODO every seeded value the film needs, made once here so each frame draws from the same numbers.
const SEEDS = (() => { const next = rng('TODO-slug'); return Array.from({length: 64}, () => [next(), next(), next()] as const); })();

// TODO the film's own shader (GLSL ES 3.00). Without a #version line it gets u_time, u_frame, u_resolution, u_seed, centred(),
// hash/vnoise/fbm and every uniform passed below; with its own #version line it is compiled as written.
const FRAG = `
void main() {
  vec2 p = centred();
  float n = fbm(p * 3.0 + vec2(u_time * 0.15, -u_time * 0.1));
  fragColor = vec4(mix(u_ink, u_soft, n + u_pulse * 0.2), 1.0);
}`;

export function TemplateSpot() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // The beat grid of the score this film plays: cuts on bar lines, accents on beats and hits.
  const beats = beatsFromSpec(spec, fps);
  const pulse = beats.pulse(frame, beats.framesPerBeat / 2);
  return <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/template/music.wav" volume={0.9} />
    {/* Sound effects are derived from motion: TODO report each big move with <MotionProbe id value family axis /> (camera push, a word
        landing); quiet lists the frames where the music's own hits play. */}
    <MotionSound src="/audio/generated/template/whoosh.wav" role="move" families={['camera']} quiet={[]} />
    <MotionSound src="/audio/generated/template/impact.wav" role="land" families={['text']} quiet={[]} />
    {/* Layer 1, WebGL: TODO the world of the concept. */}
    <Shader frag={FRAG} width={W} height={H} palette={palette} uniforms={{u_pulse: pulse}} seed="TODO-slug" style={{position: 'absolute', inset: 0}} />
    {/* Layer 2, canvas 2D: TODO particles, geometry or type the film paints itself. */}
    <Canvas2D width={W} height={H} style={{position: 'absolute', inset: 0}} draw={(ctx, f) => {
      ctx.fillStyle = palette.accent;
      for (const [x, y, z] of SEEDS) ctx.fillRect((x * W + f * (1 + z * 3)) % W, y * H, 6 + z * 10, 6 + z * 10);
    }} />
    {/* Layer 3, DOM type: TODO the copy, each line with a behaviour that does what it says. DOM text is checked by the render audit. */}
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: `${SIZES.marginY}px ${SIZES.marginX}px`}}>
      <div style={{fontFamily: display, fontWeight: 800, fontSize: SIZES.headline * 1.4, color: palette.paper, transform: `scale(${1 + pulse * 0.04})`}}>TODO</div>
    </AbsoluteFill>
  </AbsoluteFill>;
}
