import {AbsoluteFill, Audio, ImageSequence, useCurrentFrame} from 'frameforge';
const SLUG = 'neon-tide-reconstruction';
const FONT = 'DejaVu Sans, sans-serif';
const S = 1;
export function Spot() {
 const f = useCurrentFrame();
 const music = true; // explicit newly authored local score
 const neon = SLUG.startsWith('neon');
 const moon = SLUG.startsWith('moon');
 const count = moon ? (f >= 154 ? 3 : f >= 118 ? 2 : f >= 94 ? 1 : 0) : (f >= 218 ? 3 : f >= 158 ? 2 : f >= 106 ? 1 : 0);
 const title = neon ? ['NEON', 'TIDE'] : moon ? ['MOONPOST'] : ['STARFALL', 'RUN'];
 const line = neon ? (f<90 ? 'A NEW CURRENT' : f<180 ? 'FEEL THE UNDERTOW' : f<270 ? 'LET IT PULL YOU IN' : 'NEON TIDE / ORIGINAL MIX') : moon ? (f<165 ? 'COLLECT 3 MOON LETTERS' : f<226 ? 'DELIVER THE LAST LETTER' : 'ONE LETTER. A LITTLE LIGHT.') : (f<240 ? 'COLLECT 3 STARS' : 'YOUR NEXT ADVENTURE, EARNED.');
 return <AbsoluteFill style={{background:'#091322', overflow:'hidden',fontFamily:FONT,color:'#fff5df'}}>
  <ImageSequence src={`/assets/generated/${SLUG}/scene`} frames={360} fps={30} fit="cover" />
  {music && <Audio src={`/audio/generated/${SLUG}/music.wav`} volume={0.92} />}
  <div style={{position:'absolute',inset:'0 0 68%',background:'linear-gradient(#081020b0,#08102000)',pointerEvents:'none'}} />
  {!neon && f < 60 && <div style={{position:'absolute',left:64*S,right:64*S,top:108*S}}>
   <div style={{fontSize:25*S,letterSpacing:4*S,fontWeight:700,color:'#ffc760',marginBottom:22*S}}>{moon?'A LITTLE MAIL. A LITTLE MAGIC.':'THE SKY IS YOUR PLAYGROUND'}</div>
   <div style={{fontSize:(moon?84:116)*S,fontWeight:900,letterSpacing:-5*S,lineHeight:0.94,textShadow:'0 4px 24px #111b'}}>{title.map(t=><div key={t}>{t}</div>)}</div>
   <div style={{fontSize:36*S,fontWeight:700,marginTop:28*S}}>{moon?'COLLECT 3 MOON LETTERS':'COLLECT 3 STARS'}</div>
  </div>}
  {!neon && f >= 60 && f < 165 && <div style={{position:'absolute',left:64*S,top:112*S,fontSize:34*S,fontWeight:800,color:'#ffd083'}}>{moon?'FOLLOW THE MOON MAIL':'THREE STARS. ONE ADVENTURE.'}</div>}
  {!neon && ((f>=106&&f<126)||(f>=158&&f<178)||(f>=218&&f<238)) && <div style={{position:'absolute',left:64*S,bottom:150*S,fontSize:56*S,fontWeight:900,color:'#ffd083'}}>{count} / 3 {moon?'LETTERS':'STARS'}</div>}
  {moon && f>=180 && f<226 && <div style={{position:'absolute',left:64*S,right:64*S,top:112*S,fontSize:42*S,fontWeight:800}}>ONE LAST DELIVERY.</div>}
  {moon && f>=240 && f<280 && <div style={{position:'absolute',left:64*S,right:64*S,top:112*S,fontSize:46*S,fontWeight:800}}>A LITTLE LIGHT, DELIVERED.</div>}
  {!neon && f>=300 && <div style={{position:'absolute',left:64*S,right:64*S,top:110*S}}>
    <div style={{fontSize:82*S,fontWeight:900,lineHeight:1.02}}>{moon?'YOU MADE IT':'ADVENTURE, EARNED.'}</div>
    <div style={{fontSize:48*S,fontWeight:800,color:'#ffd083',marginTop:22*S}}>{moon?'THE VILLAGE IS AWAKE':'CAPE + 500 GEMS'}</div>
    <div style={{fontSize:32*S,lineHeight:1.35,marginTop:22*S}}>{moon?'Collect 3 letters. Complete the route.':'Collect all 3 stars to unlock both rewards.'}</div>
  </div>}
  {neon && <div style={{position:'absolute',left:64*S,right:64*S,top:112*S,fontSize:(f>=270?42:29)*S,fontWeight:700,letterSpacing:4*S,color:'#9ae7ef'}}>{f<90?'A NEW CURRENT':f<180?'FEEL THE UNDERTOW':f<270?'LET IT PULL YOU IN':'NEON TIDE / ORIGINAL MIX'}</div>}
  {neon && f>=300 && <div style={{position:'absolute',left:64*S,right:64*S,bottom:150*S,fontSize:36*S,fontWeight:800}}>LISTEN TO THE ORIGINAL MIX</div>}
  <div style={{position:'absolute',left:64*S,bottom:62*S,fontSize:20*S,color:'#aaaabd'}}>FICTIONAL {neon?'MUSIC RELEASE':'GAME EVENT'} · NEW RECONSTRUCTION</div>
 </AbsoluteFill>;
}
