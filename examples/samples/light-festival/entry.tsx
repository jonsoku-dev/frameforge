import {Composition, registerRoot} from 'frameforge';
import {LightFestivalSpot} from './Spot';

registerRoot(() => <Composition id="LightFestival" component={LightFestivalSpot} durationInFrames={1800} fps={30} width={1920} height={1080} />);
