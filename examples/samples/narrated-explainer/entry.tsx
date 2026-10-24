import {Composition, registerRoot} from 'frameforge';
import {NarratedExplainer} from './Spot';

registerRoot(() => <Composition id="NarratedExplainer" component={NarratedExplainer} durationInFrames={900} fps={30} width={1920} height={1080} />);
