import {Composition, registerRoot} from 'frameforge';
import {DataReel} from './Spot';

registerRoot(() => <Composition id="DataReel" component={DataReel} durationInFrames={900} fps={30} width={1920} height={1080} />);
