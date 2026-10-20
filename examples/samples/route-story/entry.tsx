import {Composition, registerRoot} from 'frameforge';
import {RouteStory} from './Spot';

registerRoot(() => <Composition id="RouteStory" component={RouteStory} durationInFrames={600} fps={30} width={1920} height={1080} />);
