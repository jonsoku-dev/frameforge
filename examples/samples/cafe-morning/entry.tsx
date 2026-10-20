import {Composition, registerRoot} from 'frameforge';
import {CafeMorning} from './Spot';

registerRoot(() => <Composition id="CafeMorning" component={CafeMorning} durationInFrames={600} fps={30} width={1920} height={1080} />);
