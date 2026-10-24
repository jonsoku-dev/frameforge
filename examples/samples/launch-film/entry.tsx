import {Composition, registerRoot} from 'frameforge';
import {LaunchFilm} from './Spot';

registerRoot(() => <Composition id="LaunchFilm" component={LaunchFilm} durationInFrames={900} fps={30} width={1920} height={1080} />);
