import {Composition, registerRoot} from 'frameforge';
import {Translucent} from './Spot';

registerRoot(() => <Composition id="Translucent" component={Translucent} durationInFrames={60} fps={30} width={640} height={360} />);
