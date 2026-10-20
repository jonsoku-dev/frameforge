import {Composition, registerRoot} from 'frameforge';
import {KitLaunch} from './Spot';

registerRoot(() => <Composition id="KitLaunch" component={KitLaunch} durationInFrames={600} fps={30} width={1920} height={1080} />);
