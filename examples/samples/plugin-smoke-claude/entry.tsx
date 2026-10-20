import {Composition, registerRoot} from 'frameforge';
import {PluginSmokeClaude} from './Spot';

registerRoot(() => <Composition id="PluginSmokeClaude" component={PluginSmokeClaude} durationInFrames={300} fps={30} width={1920} height={1080} />);
