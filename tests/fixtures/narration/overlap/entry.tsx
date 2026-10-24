import {Composition, registerRoot} from 'frameforge';
import {AbsoluteFill} from 'frameforge';
registerRoot(() => <Composition id="Fixture" component={() => <AbsoluteFill />} durationInFrames={300} fps={30} width={1920} height={1080} />);
