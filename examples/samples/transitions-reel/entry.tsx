import {Composition, registerRoot} from 'frameforge';
import {TransitionsReel} from './Spot';

registerRoot(() => <Composition id="TransitionsReel" component={TransitionsReel} durationInFrames={600} fps={30} width={1920} height={1080} />);
