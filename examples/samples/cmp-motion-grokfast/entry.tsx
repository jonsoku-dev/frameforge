import {Composition, registerRoot} from 'frameforge';
import {CmpMotionGrokfast} from './Spot';

registerRoot(() => <Composition id="CmpMotionGrokfast" component={CmpMotionGrokfast} durationInFrames={450} fps={30} width={1920} height={1080} />);
