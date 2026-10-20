import {Composition, registerRoot} from 'frameforge';
import {Spot as SaasLaunch, variables as saasVariables} from './saas-launch/Spot';
import {Spot as KineticTypo} from './kinetic-typo/Spot';
import {Spot as DataStory} from './data-story/Spot';
import {Spot as EventTeaser} from './event-teaser/Spot';
import {Spot as AppOnboarding} from './app-onboarding/Spot';
import {Spot as LogoReveal} from './logo-reveal/Spot';
import {Spot as PodcastPromo} from './podcast-promo/Spot';
import {Spot as EducationExplainer} from './education-explainer/Spot';
import {Spot as CountdownHype} from './countdown-hype/Spot';
import {Spot as ProductFeature} from './product-feature/Spot';
import {Spot as RecipeSteps} from './recipe-steps/Spot';
import {Spot as FitnessTimer} from './fitness-timer/Spot';
import {Spot as TravelPoster} from './travel-poster/Spot';
import {Spot as WeatherBrief} from './weather-brief/Spot';

import {Spot as CmpMotionOpus} from './cmp-motion-opus/Spot';
import {Spot as CmpMotionSonnet} from './cmp-motion-sonnet/Spot';
import {Spot as CmpMotionHaiku} from './cmp-motion-haiku/Spot';
import {Spot as CmpMotionFable} from './cmp-motion-fable/Spot';
import {Spot as CmpMotionLuna6} from './cmp-motion-luna6/Spot';
import {CmpMotionTerra} from './cmp-motion-terra/Spot';
import {Spot as CmpMotionLuna56} from './cmp-motion-luna56/Spot';
import {Spot as CmpMotionGrok47} from './cmp-motion-grok47/Spot';
import {CmpMotionGrokfast} from './cmp-motion-grokfast/Spot';
import {CafeMorning} from './cafe-morning/Spot';
import {LightFestivalSpot as LightFestival} from './light-festival/Spot';
import {TransitionsReel} from './transitions-reel/Spot';
import {ShapeNoise} from './shape-noise/Spot';
import {CaptionExplainer} from './caption-explainer/Spot';
import {VideoCollage} from './video-collage/Spot';
import {RouteStory} from './route-story/Spot';
import {Spot as ThreeSpin} from './three-spin/Spot';
import {PluginSmokeCodex} from './plugin-smoke-codex/Spot';
import {KitLaunch} from './kit-launch/Spot';
import {PluginSmokeClaude} from './plugin-smoke-claude/Spot';

// All ten samples in one entry for the studio. Each folder's entry.tsx registers only itself for the CLI.
registerRoot(() => <>
  <Composition id="SaasLaunch" component={SaasLaunch} variables={saasVariables} durationInFrames={900} fps={30} width={1920} height={1080} />
  <Composition id="KineticTypo" component={KineticTypo} durationInFrames={450} fps={30} width={1080} height={1920} />
  <Composition id="DataStory" component={DataStory} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="EventTeaser" component={EventTeaser} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="AppOnboarding" component={AppOnboarding} durationInFrames={600} fps={30} width={1080} height={1920} />
  <Composition id="LogoReveal" component={LogoReveal} durationInFrames={300} fps={30} width={1920} height={1080} />
  <Composition id="PodcastPromo" component={PodcastPromo} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="EducationExplainer" component={EducationExplainer} durationInFrames={750} fps={30} width={1920} height={1080} />
  <Composition id="CountdownHype" component={CountdownHype} durationInFrames={300} fps={30} width={1920} height={1080} />
  <Composition id="ProductFeature" component={ProductFeature} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="RecipeSteps" component={RecipeSteps} durationInFrames={600} fps={30} width={1080} height={1920} />
  <Composition id="FitnessTimer" component={FitnessTimer} durationInFrames={300} fps={30} width={1080} height={1920} />
  <Composition id="TravelPoster" component={TravelPoster} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="WeatherBrief" component={WeatherBrief} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionOpus" component={CmpMotionOpus} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionSonnet" component={CmpMotionSonnet} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionHaiku" component={CmpMotionHaiku} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionFable" component={CmpMotionFable} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionLuna6" component={CmpMotionLuna6} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionTerra" component={CmpMotionTerra} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionLuna56" component={CmpMotionLuna56} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionGrok47" component={CmpMotionGrok47} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CmpMotionGrokfast" component={CmpMotionGrokfast} durationInFrames={450} fps={30} width={1920} height={1080} />
  <Composition id="CafeMorning" component={CafeMorning} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="LightFestival" component={LightFestival} durationInFrames={1800} fps={30} width={1920} height={1080} />
  <Composition id="TransitionsReel" component={TransitionsReel} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="ShapeNoise" component={ShapeNoise} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="CaptionExplainer" component={CaptionExplainer} durationInFrames={750} fps={30} width={1920} height={1080} />
  <Composition id="VideoCollage" component={VideoCollage} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="RouteStory" component={RouteStory} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="ThreeSpin" component={ThreeSpin} durationInFrames={300} fps={30} width={1920} height={1080} />
  <Composition id="PluginSmokeCodex" component={PluginSmokeCodex} durationInFrames={300} fps={30} width={1920} height={1080} />
  <Composition id="KitLaunch" component={KitLaunch} durationInFrames={600} fps={30} width={1920} height={1080} />
  <Composition id="PluginSmokeClaude" component={PluginSmokeClaude} durationInFrames={300} fps={30} width={1920} height={1080} />
</>);
