import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';
registerRoot(() => <Composition id="MoonpostReconstruction" component={Spot} durationInFrames={360} fps={30} width={720} height={1280} />);
