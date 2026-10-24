import {AbsoluteFill, Seekable} from 'frameforge';

const keyframes = [{transform: 'translateX(0px)', opacity: 0}, {transform: 'translateX(200px)', opacity: 1}];

export function Scene() {
  return (
    <AbsoluteFill style={{background: '#F4F4F1'}}>
      <Seekable animate={element => element.animate(keyframes, {duration: 1000, fill: 'both', easing: 'ease-out'})} style={{width: 60, height: 60, background: '#2F5BFF'}} />
    </AbsoluteFill>
  );
}
