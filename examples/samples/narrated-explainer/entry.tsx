import {Composition, registerRoot} from 'frameforge';
import {NarratedExplainer} from './Spot';

// 870 frames: the last line ends at frame 789 (narration.timing.json), then 2.7 s of still.
registerRoot(() => <Composition id="NarratedExplainer" component={NarratedExplainer} durationInFrames={870} fps={30} width={1920} height={1080} />);
