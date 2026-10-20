import {Composition, registerRoot} from 'frameforge';
import {Opening} from './Opening';

function Root() {
  return <>
    <Composition id="Opening" component={Opening} durationInFrames={450} fps={30} width={1920} height={1080} />
  </>;
}

registerRoot(Root);
