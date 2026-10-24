import {Composition, registerRoot} from 'frameforge';
import {SeamReel} from './Spot';

registerRoot(() => <Composition id="SeamReel" component={SeamReel} durationInFrames={900} fps={30} width={1920} height={1080} />);
