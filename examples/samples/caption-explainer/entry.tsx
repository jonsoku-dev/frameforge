import {Composition, registerRoot} from 'frameforge';
import {CaptionExplainer} from './Spot';

registerRoot(() => <Composition id="CaptionExplainer" component={CaptionExplainer} durationInFrames={750} fps={30} width={1920} height={1080} />);
