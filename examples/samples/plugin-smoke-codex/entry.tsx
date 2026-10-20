import {Composition, registerRoot} from 'frameforge';
import {PluginSmokeCodex} from './Spot';

registerRoot(() => <Composition id="PluginSmokeCodex" component={PluginSmokeCodex} durationInFrames={300} fps={30} width={1920} height={1080} />);
