import {Composition, registerRoot} from 'frameforge';
import {Spot} from './Spot';

registerRoot(() => <Composition id="RecipeSteps" component={Spot} durationInFrames={600} fps={30} width={1080} height={1920} />);
