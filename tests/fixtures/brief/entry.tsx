import {Composition, registerRoot} from 'frameforge';

const WhoAmI = () => null;

registerRoot(() => <Composition id="WhoAmI" component={WhoAmI} durationInFrames={600} fps={60} width={1920} height={1080} />);
