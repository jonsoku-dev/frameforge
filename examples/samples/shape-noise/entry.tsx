import {Composition, registerRoot} from 'frameforge';
import {ShapeNoise} from './Spot';

registerRoot(() => <Composition id="ShapeNoise" component={ShapeNoise} durationInFrames={600} fps={30} width={1920} height={1080} />);
