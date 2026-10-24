import {Composition, registerRoot} from 'frameforge';
import {MapStory} from './Spot';

registerRoot(() => <Composition id="MapStory" component={MapStory} durationInFrames={600} fps={30} width={1920} height={1080} />);
