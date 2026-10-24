import {Composition, registerRoot} from 'frameforge';
import {GenerativeIdent} from './Spot';

registerRoot(() => <Composition id="GenerativeIdent" component={GenerativeIdent} durationInFrames={900} fps={30} width={1920} height={1080} />);
