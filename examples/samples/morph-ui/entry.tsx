import {Composition, registerRoot} from 'frameforge';
import {MorphUi} from './Spot';

registerRoot(() => <Composition id="MorphUi" component={MorphUi} durationInFrames={960} fps={60} width={1920} height={1080} />);
