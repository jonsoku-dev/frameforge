import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="ThreeSpin" component={Spot} durationInFrames={300} fps={30} width={1920} height={1080} />);
