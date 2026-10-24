import {Composition, registerRoot} from 'frameforge';
import {BlocksReel} from './Spot';

registerRoot(() => <Composition id="BlocksReel" component={BlocksReel} durationInFrames={900} fps={30} width={1920} height={1080} />);
