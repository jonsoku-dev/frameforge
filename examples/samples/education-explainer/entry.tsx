import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="EducationExplainer" component={Spot} durationInFrames={750} fps={30} width={1920} height={1080} />);
