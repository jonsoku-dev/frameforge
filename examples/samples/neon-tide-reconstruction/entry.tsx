import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';
registerRoot(() => <Composition id="NeonTideReconstruction" component={Spot} durationInFrames={360} fps={30} width={1080} height={1920} />);
