import {Composition, registerRoot} from 'frameforge';
import {TemplateSpot} from './Spot';

registerRoot(() => <Composition id="TemplateSpot" component={TemplateSpot} durationInFrames={600} fps={30} width={1920} height={1080} />);
