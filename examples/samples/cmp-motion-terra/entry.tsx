import {Composition, registerRoot} from 'frameforge';
import {CmpMotionTerra} from './Spot';

registerRoot(() => <Composition id="CmpMotionTerra" component={CmpMotionTerra} durationInFrames={450} fps={30} width={1920} height={1080} />);
