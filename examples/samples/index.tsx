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
</>);
