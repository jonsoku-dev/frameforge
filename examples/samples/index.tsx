import {Composition, registerRoot} from 'frameforge';
import {CafeMorning} from './cafe-morning/Spot';
import {KitLaunch} from './kit-launch/Spot';
import {LightFestivalSpot as LightFestival} from './light-festival/Spot';
import {TransitionsReel} from './transitions-reel/Spot';
import {ShapeNoise} from './shape-noise/Spot';
import {CaptionExplainer} from './caption-explainer/Spot';
import {VideoCollage} from './video-collage/Spot';
import {RouteStory} from './route-story/Spot';
import {Spot as ThreeSpin} from './three-spin/Spot';
import {BlocksReel} from './blocks-reel/Spot';
import {DataReel} from './data-reel/Spot';
import {SeamReel} from './seam-reel/Spot';
import {MorphUi} from './morph-ui/Spot';
import {NarratedExplainer} from './narrated-explainer/Spot';
import {TurntableSpot} from './turntable-spot/Spot';
import {GenerativeIdent} from './generative-ident/Spot';
import {ShowcaseSpot} from './showcase-spot/Spot';
import {MapStory} from './map-story/Spot';
import {LaunchFilm} from './launch-film/Spot';

// Every sample in one entry for the studio. Each folder's entry.tsx registers only itself for the CLI.
registerRoot(() => <>
  <Composition id="CafeMorning" component={CafeMorning} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="KitLaunch" component={KitLaunch} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="LightFestival" component={LightFestival} durationInFrames={1800} fps={30} width={1920} height={1080} />
  <Composition id="TransitionsReel" component={TransitionsReel} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="ShapeNoise" component={ShapeNoise} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="CaptionExplainer" component={CaptionExplainer} durationInFrames={750} fps={30} width={1920} height={1080} />
  <Composition id="VideoCollage" component={VideoCollage} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="RouteStory" component={RouteStory} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="ThreeSpin" component={ThreeSpin} durationInFrames={300} fps={30} width={1920} height={1080} />
  <Composition id="BlocksReel" component={BlocksReel} durationInFrames={900} fps={30} width={1920} height={1080} />
  <Composition id="DataReel" component={DataReel} durationInFrames={900} fps={30} width={1920} height={1080} />
  <Composition id="SeamReel" component={SeamReel} durationInFrames={900} fps={30} width={1920} height={1080} />
  <Composition id="MorphUi" component={MorphUi} durationInFrames={960} fps={60} width={1920} height={1080} />
  <Composition id="NarratedExplainer" component={NarratedExplainer} durationInFrames={870} fps={30} width={1920} height={1080} />
  <Composition id="TurntableSpot" component={TurntableSpot} durationInFrames={720} fps={30} width={1920} height={1080} />
  <Composition id="GenerativeIdent" component={GenerativeIdent} variables={GenerativeIdent.variables} durationInFrames={540} fps={30} width={1920} height={1080} />
  <Composition id="ShowcaseSpot" component={ShowcaseSpot} durationInFrames={720} fps={30} width={1920} height={1080} />
  <Composition id="MapStory" component={MapStory} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="LaunchFilm" component={LaunchFilm} durationInFrames={900} fps={30} width={1920} height={1080} />
</>);
