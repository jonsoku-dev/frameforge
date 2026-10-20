import {Composition, registerRoot} from 'frameforge';
import {Spot, variables} from './Spot';

registerRoot(() => <Composition id="SaasLaunch" component={Spot} variables={variables} durationInFrames={900} fps={30} width={1920} height={1080} />);
