import {AbsoluteFill, useCurrentFrame} from 'frameforge';

// Placeholder: the narrated-explainer workstream replaces this file.
export function NarratedExplainer() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: '#111111', color: '#F4F4F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120}}>{frame}</AbsoluteFill>;
}
