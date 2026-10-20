import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="CmpMotionOpus" component={Spot} durationInFrames={450} fps={30} width={1920} height={1080} />);
