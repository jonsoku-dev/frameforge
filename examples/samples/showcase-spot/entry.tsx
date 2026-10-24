import {Composition, registerRoot} from 'frameforge';
import {ShowcaseSpot} from './Spot';

// 720 frames: the last line ends at frame 650 (narration.timing.json), then 2.3 s of still; 12 bars at 120 bpm.
registerRoot(() => <Composition id="ShowcaseSpot" component={ShowcaseSpot} durationInFrames={720} fps={30} width={1920} height={1080} />);
