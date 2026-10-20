import {Composition, registerRoot} from 'frameforge';
import {VideoCollage} from './Spot';

registerRoot(() => <Composition id="VideoCollage" component={VideoCollage} durationInFrames={600} fps={30} width={1920} height={1080} />);
