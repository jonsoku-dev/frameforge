import {AbsoluteFill, ChromaticShift, Composition, Extrude, Glow, Scanlines, Shader, VhsGlitch, registerRoot, shaders, useCurrentFrame, type ShaderPreset} from 'frameforge';

const palette = {ink: '#14121c', paper: '#fff6ea', accent: '#ff5a36', soft: '#ffc9a8'};
const presets = Object.keys(shaders) as ShaderPreset[];

/** Every preset in turn, four frames each, so 30 frames compile and draw all of them. */
function Presets() {
  const preset = presets[Math.floor(useCurrentFrame() / 4) % presets.length]!;
  return <AbsoluteFill><Shader frag={shaders[preset]} width={320} height={180} palette={palette} seed="fixture" uniforms={{u_beat: 0.5}} /></AbsoluteFill>;
}
function Broken() {
  return <AbsoluteFill><Shader frag="void main() { fragColor = vec4(undefinedThing, 1.0); }" width={320} height={180} /></AbsoluteFill>;
}
/** Every DOM post effect on one word each, over a shader background. */
function Post() {
  const frame = useCurrentFrame();
  const word = {fontFamily: 'sans-serif', fontWeight: 900, fontSize: 30, color: palette.paper, lineHeight: 1.2} as const;
  return <AbsoluteFill style={{background: palette.ink}}>
    <Shader frag={shaders.streaks} width={320} height={180} palette={palette} seed="post" />
    <Scanlines frame={frame} density={4} opacity={0.3} roll={0.5} style={{position: 'absolute', inset: 0, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', alignContent: 'center', gap: 8}}>
      <Glow radius={6} intensity={0.5 + 0.5 * Math.sin(frame / 5)} color={palette.accent}><span style={word}>GLOW</span></Glow>
      <ChromaticShift amount={3} angle={frame * 12}><span style={word}>SPLIT</span></ChromaticShift>
      <VhsGlitch seed="post" frame={frame} amount={0.8}><span style={word}>VHS</span></VhsGlitch>
      <Extrude depth={8} color={palette.accent} angle={45}><span style={word}>DEPTH</span></Extrude>
    </Scanlines>
  </AbsoluteFill>;
}
registerRoot(() => <>
  <Composition id="PostEffects" component={Post} durationInFrames={30} fps={30} width={320} height={180} />
  <Composition id="ShaderPresets" component={Presets} durationInFrames={30} fps={30} width={320} height={180} />
  <Composition id="ShaderBroken" component={Broken} durationInFrames={2} fps={30} width={320} height={180} />
</>);
