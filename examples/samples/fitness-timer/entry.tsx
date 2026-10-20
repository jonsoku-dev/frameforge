import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="FitnessTimer" component={Spot} durationInFrames={300} fps={30} width={1080} height={1920} />);
