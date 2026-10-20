import {Composition, registerRoot} from 'frameforge';
import {Scene} from './Scene';

registerRoot(() => <Composition id="Dirty" component={Scene} durationInFrames={60} fps={30} width={320} height={180} />);
