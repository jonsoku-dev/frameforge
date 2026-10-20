import React from 'react';
import {Composition,registerRoot,getInputProps,useCurrentFrame,useVideoConfig,AbsoluteFill} from 'frameforge';
const Scene=()=>{const frame=useCurrentFrame();const config=useVideoConfig();if(frame===1)throw new Error('intentional frame failure');return <AbsoluteFill>{`frame=${frame};duration=${config.durationInFrames}`}</AbsoluteFill>;};
const initial=getInputProps();
const Root=()=>{const input=getInputProps();return <Composition id="Probe" component={Scene} width={Number(initial.width ?? 320)} height={180} fps={30} durationInFrames={Number(input.duration ?? 10)}/>;};
registerRoot(Root);
