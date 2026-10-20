import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="KineticTypo" component={Spot} durationInFrames={450} fps={30} width={1080} height={1920} />);
