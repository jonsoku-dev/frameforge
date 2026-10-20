import {Composition,registerRoot} from 'frameforge';
import {Typewriter} from './compositions/TextAnimations/Typewriter';
import {FadeInFadeOut} from './compositions/TextAnimations/FadeInFadeOut';
import {BarChart} from './compositions/DataViz/BarChart';
import {SpringPhysics} from './compositions/ThreeD/SpringPhysics';
import {SlideTransition} from './compositions/Transitions/SlideTransition';
import {StarrySky} from './compositions/Particles/StarrySky';
const scenes=[['Typewriter',Typewriter,180],['FadeInFadeOut',FadeInFadeOut,120],['BarChart',BarChart,200],['SpringPhysics',SpringPhysics,180],['SlideTransition',SlideTransition,180],['StarrySky',StarrySky,300]];
registerRoot(()=> <>{scenes.map(([id,component,durationInFrames])=><Composition key={id} id={id} component={component} durationInFrames={durationInFrames} width={1920} height={1080} fps={30}/>)}</>);
