import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="DataStory" component={Spot} durationInFrames={600} fps={30} width={1920} height={1080} />);
