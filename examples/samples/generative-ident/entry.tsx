import {Composition, registerRoot} from 'frameforge';
import {GenerativeIdent, variables} from './Spot';

registerRoot(() => <Composition id="GenerativeIdent" component={GenerativeIdent} variables={variables} durationInFrames={540} fps={30} width={1920} height={1080} />);
