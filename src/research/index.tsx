import React,{useEffect,useState} from 'react';
import {Composition,registerRoot,AbsoluteFill,Audio,staticFile,useCurrentFrame,interpolate,spring,delayRender,continueRender,cancelRender} from 'remotion';
import timeline from './timeline.json';
import '../styles/global.css';
type Word={text:string;startFrame:number;endFrame:number};
type Scene={title:string;tag:string;startFrame:number;endFrame:number;anchorFrame:number;words:Word[]};
const C={bg:'#111D32',panel:'#1D3049',white:'#F4F7FC',muted:'#9BB0C8',mint:'#56E3BD',gold:'#F7C66A',blue:'#6C9AF5'};
const ease=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const Diagram:React.FC<{i:number;f:number;scene:Scene}>=({i,f,scene})=>{
 const local=f-scene.startFrame;const p=spring({frame:Math.max(0,f-scene.anchorFrame),fps:30,config:{damping:17,stiffness:115}});const on=f>=scene.anchorFrame;const grow=ease(local,0,18);const stroke=C.mint;const paper=(x:number,y:number,rot=0)=><g transform={'translate('+x+' '+y+') rotate('+rot+')'}><rect width="220" height="270" rx="22" fill="#F4F7FC"/><rect x="32" y="36" width="90" height="15" rx="7" fill="#7D96B1"/>{[0,1,2,3].map(k=><rect key={k} x="32" y={85+35*k} width={k===3?100:155} height="10" rx="5" fill="#A8BED0"/>)}</g>;
 return <svg width="880" height="720" viewBox="0 0 880 720" style={{overflow:'visible'}}>
 <defs><radialGradient id="glow"><stop stopColor="#28496A"/><stop offset="1" stopColor={C.bg}/></radialGradient></defs>
 <circle cx="440" cy="360" r="335" fill="url(#glow)"/><circle cx="440" cy="360" r="290" fill="none" stroke="#2D4763" strokeDasharray="6 14" strokeWidth="2"/>
 <g transform={'translate(440 360) scale('+(.83+.17*grow)+') translate(-440 -360)'}>
 {i===0&&<><path d="M440 340 L230 170 M440 340 L650 170 M440 340 L440 590" stroke="#6483A3" strokeWidth="5" strokeDasharray="12 10" fill="none"/>{[[230,170],[650,170],[440,590]].map(([x,y],k)=><g key={k}><circle cx={x} cy={y} r={74} fill={on&&k===1?C.mint:'#263F5D'} stroke={on&&k===1?C.mint:'#6B89A6'} strokeWidth="4"/><path d={'M'+(x-22)+' '+y+'h44m-22 -22v44'} stroke={on&&k===1?C.bg:C.white} strokeWidth="9" strokeLinecap="round"/></g>)}<circle cx="440" cy="340" r="112" fill="#223C57" stroke={stroke} strokeWidth="6"/><path d="M392 325 Q392 268 440 268 Q488 268 488 325 Q488 348 463 375 L463 403 H417 V375 Q392 348 392 325Z" fill={C.gold}/><path d="M419 419 H461 M429 436 H451" stroke={C.white} strokeWidth="9" strokeLinecap="round"/>{on&&<circle cx="650" cy="170" r={90+25*p} fill="none" stroke={stroke} opacity={1-p*.7} strokeWidth="5"/>}</>}
 {i===1&&<>{paper(272,184,-7)}{paper(354,205,7)}<g transform={'translate('+(560-100*p)+' '+(430-70*p)+')'}><circle r="106" stroke={stroke} strokeWidth="18" fill="#1A314D" fillOpacity=".35"/><path d="M76 76 L165 165" stroke={stroke} strokeWidth="26" strokeLinecap="round"/>{on&&<path d="M-42 4 L-12 38 L50 -38" stroke={C.gold} strokeWidth="17" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}</g></>}
 {i===2&&<>{paper(120,200,-12)}{paper(560,200,12)}<path d="M320 350 H390 M490 350 H560" stroke="#7D99B6" strokeWidth="8" strokeDasharray="10 10"/><rect x="355" y="240" width="170" height="230" rx="28" fill={on?'#244E50':'#223B56'} stroke={on?stroke:'#6C87A6'} strokeWidth="6" strokeDasharray={on?'0':'12 12'}/><path d="M408 314 Q440 275 472 314 Q485 345 444 373 V397 M444 425 v8" fill="none" stroke={on?C.gold:C.white} strokeWidth="15" strokeLinecap="round"/>{on&&<circle cx="440" cy="355" r={135+20*p} fill="none" stroke={stroke} strokeWidth="3" opacity={.7}/>}</>}
 {i===3&&<><rect x="150" y="175" width="580" height="360" rx="34" fill="#203B58" stroke="#6788A6" strokeWidth="5"/><path d="M150 265 H730 M150 355 H730 M150 445 H730 M295 175 V535 M440 175 V535 M585 175 V535" stroke="#375775" strokeWidth="3"/><rect x="285" y="260" width={on?300*p:20} height="184" rx="18" fill="#56E3BD" fillOpacity=".15" stroke={stroke} strokeWidth="5"/>{[0,1,2].map(k=><g key={k} transform={'translate('+(340+k*98)+' '+(400-k*35)+')'}><rect width="52" height={60+k*35} y={-60-k*35} rx="9" fill={on?stroke:'#7B95AE'} opacity={.7+.1*k}/></g>)}{on&&<path d="M600 500 l28 28 59 -62" fill="none" stroke={C.gold} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>}</>}
 {i===4&&<><g transform="translate(210 100)"><rect width="460" height="500" rx="36" fill="#F4F7FC"/><rect x="54" y="64" width={352*ease(local,0,22)} height="34" rx="12" fill="#345A7B"/>{[0,1,2].map(k=><g key={k}><rect x="54" y={148+k*93} width="38" height="38" rx="9" fill={on?stroke:'#BDD0E0'}/>{on&&<path d={'M62 '+(166+k*93)+'l10 10 17 -22'} fill="none" stroke="#16324A" strokeWidth="5" strokeLinecap="round"/>}<rect x="116" y={154+k*93} width={240-k*30} height="19" rx="8" fill="#8CA7BD"/></g>)}<rect x="54" y="419" width="352" height="14" rx="7" fill="#BCCDDD"/></g><g transform={'translate(660 530) scale('+(on?p:0)+')'}><circle r="64" fill={stroke}/><path d="M-26 0 L-8 21 L31 -27" fill="none" stroke={C.bg} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/></g></>}
 </g></svg>;
};
const Film:React.FC=()=>{
 const f=useCurrentFrame();const scenes=timeline.scenes as Scene[];const idx=Math.max(0,scenes.findIndex(s=>f>=s.startFrame&&f<s.endFrame));const scene=scenes[idx];const local=f-scene.startFrame;const [handle]=useState(()=>delayRender('Arabic font'));useEffect(()=>{document.fonts.load('800 50px "Noto Sans Arabic"','العربية').then(()=>continueRender(handle)).catch(cancelRender)},[handle]);
 const groups:Word[][]=[];for(let j=0;j<scene.words.length;j+=5)groups.push(scene.words.slice(j,j+5));const active=Math.max(0,groups.reduce((last,g,j)=>f>=g[0].startFrame?j:last,-1));const group=groups[active]??[];
 const step=ease(local,0,13);
 return <AbsoluteFill style={{background:C.bg,color:C.white,fontFamily:'Noto Sans Arabic',overflow:'hidden'}}>
 <Audio src={staticFile('research/mixed.wav')}/>
 <div style={{position:'absolute',top:105,left:76,right:76,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{color:C.mint,fontWeight:800,fontSize:32}}>RESEARCH METHODS</div><div dir="rtl" style={{fontSize:34,fontWeight:700,color:C.muted}}>طرق البحث العلمي</div></div>
 <div style={{position:'absolute',top:178,left:78,right:78,height:5,background:'#324760',borderRadius:5}}><div style={{height:5,width:(f/899*100)+'%',background:C.mint,borderRadius:5}}/></div>
 <div style={{position:'absolute',top:245,left:76,right:76,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:30,opacity:step}}><div dir="rtl" style={{fontSize:66,fontWeight:800,lineHeight:1.3}}>{scene.title}</div><div style={{fontSize:44,color:C.bg,background:C.mint,borderRadius:22,padding:'6px 21px',fontWeight:800}}>{scene.tag}</div></div>
 <div style={{position:'absolute',left:100,top:430}}><Diagram i={idx} f={f} scene={scene}/></div>
 <div dir="rtl" style={{position:'absolute',top:1200,left:72,right:72,minHeight:380,padding:'45px 28px',borderTop:'2px solid #36516F',textAlign:'center',fontSize:79,fontWeight:800,lineHeight:1.65}}>
 {group.map((w,j)=>{const age=f-w.startFrame;const scale=age<0?1: .96+.04*spring({frame:age,fps:30,config:{damping:20,stiffness:150}});return <React.Fragment key={w.startFrame+'-'+j}><span style={{display:'inline-block',visibility:age>=0?'visible':'hidden',color:f>=w.startFrame&&f<w.endFrame?C.mint:C.white,transform:'scale('+scale+')'}}>{w.text}</span>{' '}</React.Fragment>})}
 </div>
 <div style={{position:'absolute',bottom:132,left:78,right:78,display:'flex',gap:16,direction:'rtl'}}>{scenes.map((s,j)=><div key={s.tag} style={{flex:1,height:10,borderRadius:6,background:j<=idx?C.mint:'#354A64'}}/>)}</div>
 <div dir="rtl" style={{position:'absolute',bottom:60,left:78,right:78,color:C.muted,fontSize:31,textAlign:'center'}}>من الفكرة إلى عنوان مقترح الرسالة</div>
 </AbsoluteFill>;
};
const Root:React.FC=()=> <Composition id="ResearchTitle30" component={Film} width={1080} height={1920} fps={30} durationInFrames={900}/>;
registerRoot(Root);
