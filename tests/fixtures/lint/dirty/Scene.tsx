import {useEffect, useState} from 'react';
import {AbsoluteFill, delayRender, continueRender} from 'frameforge';
import './scene.css';

export function Scene() {
  const [x, setX] = useState(0);
  const [data, setData] = useState('');
  useEffect(() => { setX(Math.random()); }, []);
  useEffect(() => {
    const handle = delayRender();
    setData('loaded');
    continueRender(handle);
  }, []);
  const started = Date.now() + performance.now() + new Date().getTime();
  useEffect(() => { const id = setInterval(() => {}, 100); requestAnimationFrame(() => {}); setTimeout(() => {}, 10); return () => clearInterval(id); }, []);
  return <AbsoluteFill style={{left: x + started, transitionDuration: '1s'}}>{data}</AbsoluteFill>;
}
