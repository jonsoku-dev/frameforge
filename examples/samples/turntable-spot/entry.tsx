import {Composition, registerRoot} from 'frameforge';
import {TurntableSpot} from './Spot';

registerRoot(() => <Composition id="TurntableSpot" component={TurntableSpot} durationInFrames={900} fps={30} width={1920} height={1080} />);
