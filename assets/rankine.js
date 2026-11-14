const byId = id => document.getElementById(id);
const fmt = (n,d=1) => new Intl.NumberFormat('da-DK',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const rad = x => x*Math.PI/180;
function coefficients(phi){
  const sin=Math.sin(rad(phi));
  const active=(1-sin)/(1+sin);
  return {active,rest:1-sin,passive:1/active};
}
const names={active:'Aktivt jordtryk',rest:'Hviletryk',passive:'Passivt jordtryk'};
const line=(x1,y1,x2,y2,cls='',attrs='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${attrs}/>`;
const label=(x,y,value,cls='',anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${value}</text>`;
const point=(x,y,fill,r=4)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#f6f5ef" stroke-width="1.4"/>`;
function arrow(x1,y1,x2,y2,color='#006d62'){
  const angle=Math.atan2(y2-y1,x2-x1), l=9;
  return line(x1,y1,x2,y2,'',`stroke="${color}" stroke-width="2.6"`)+
    `<path d="M${x2-l*Math.cos(angle-.5)} ${y2-l*Math.sin(angle-.5)} L${x2} ${y2} L${x2-l*Math.cos(angle+.5)} ${y2-l*Math.sin(angle+.5)}" stroke="${color}" stroke-width="2.6" fill="none"/>`;
}

const H=3,travelMin=-6,travelMax=60,gammaWater=10;
const activeLimit=-3,passiveLimit=30,visualScale=.65;
const limits=[{key:'active',delta:activeLimit,name:'Aktiv',color:'#96472d'},
  {key:'rest',delta:0,name:'Hvile',color:'#536572'},
  {key:'passive',delta:passiveLimit,name:'Passiv',color:'#315781'}];
const buttons=[...document.querySelectorAll('[data-delta]')];
for(const button of buttons)button.addEventListener('click',()=>{
  byId('travel').value=button.dataset.delta;
  draw();
});
const inputs=['travel','depth','phi','gamma','surcharge','water','saturated'];
for(const id of inputs)byId(id).addEventListener('input',draw);

function mobilizedK(delta,K){
  if(delta<=activeLimit)return K.active;
  if(delta>=passiveLimit)return K.passive;
  const a=K.rest-K.active, p=K.passive-K.rest;
  // Kubisk overgang med fælles hældning ved hvile og vandrette plateauer.
  const atRestSlope=3*Math.min(a/(-activeLimit),p/passiveLimit);
  if(delta<0){
    const t=1-delta/activeLimit;
    return K.active+a*t*t*(3-2*t)+atRestSlope*(-activeLimit)*t*t*(t-1);
  }
  const t=delta/passiveLimit;
  return K.rest+p*t*t*(3-2*t)+atRestSlope*passiveLimit*t*(1-t)**2;
}
function currentState(delta,z,phi,gamma,q,zWater,saturated){
  const K=coefficients(phi);
  const wetDepth=Math.max(0,z-zWater);
  const reduced=saturated-gammaWater;
  const weightStress=gamma*Math.min(z,zWater)+reduced*wetDepth;
  const vertical=weightStress+q, k=mobilizedK(delta,K);
  const horizontal=k*vertical, u=gammaWater*wetDepth;
  const mode=delta<=activeLimit?'active':delta>=passiveLimit?'passive':delta===0?'rest':null;
  const theta=mode==='active'?45+phi/2:mode==='passive'?45-phi/2:null;
  return {delta,z,phi,gamma,q,zWater,saturated,reduced,weightStress,K,k,vertical,horizontal,u,total:horizontal+u,mode,theta};
}
function draw(){
  const gammaInput=byId('gamma'), saturatedInput=byId('saturated');
  gammaInput.max=Math.min(25,+saturatedInput.value-.5);
  saturatedInput.min=Math.max(12,+gammaInput.value+.5);
  const values=inputs.map(id=>+byId(id).value);
  const state=currentState(...values);
  const {delta,z,phi,gamma,q,zWater,saturated,reduced,weightStress,k,vertical,horizontal,u,total,mode,theta}=state;
  const stage=mode?names[mode]:delta<0?'På vej mod aktivt brud':'På vej mod passivt brud';
  byId('travelValue').textContent=fmt(delta)+' mm';
  byId('depthValue').textContent=fmt(z)+' m';
  byId('phiValue').textContent=fmt(phi,0)+'°';
  byId('gammaValue').textContent=fmt(gamma)+' kN/m³';
  byId('qValue').textContent=fmt(q,0)+' kPa';
  byId('waterValue').textContent=fmt(zWater)+' m';
  byId('satValue').textContent=fmt(saturated)+' kN/m³';
  byId('stressBreakdown').textContent=`Reduceret rumvægt under vandspejlet γ′ = ${fmt(reduced,2)} kN/m³. Ved den valgte dybde er σ′ᵥ = ${fmt(weightStress)} + ${fmt(q)} = ${fmt(vertical)} kPa. Vandret totaltryk = ${fmt(horizontal)} kPa jordtryk + ${fmt(u)} kPa vandtryk = ${fmt(total)} kPa.`;
  for(const button of buttons)button.setAttribute('aria-pressed',String(+button.dataset.delta===delta));
  byId('readout').innerHTML=`<strong>${stage}</strong><span>K = ${fmt(k,3)}</span><span>σ′ₕ = ${fmt(horizontal)} kPa</span><span>σ′ᵥ = ${fmt(vertical)} kPa</span><span>u = ${fmt(u)} kPa</span><span>Totaltryk ${fmt(total)} kPa</span>`+
    (theta===null?'':`<span>Brudplan θ = ${fmt(theta,1)}° fra vandret</span>`);
  const principal=Math.abs(horizontal-vertical)<1e-8?'De to viste normalspændinger er ens.':
    horizontal<vertical?'Lodret spænding er σ′₁, og vandret spænding er σ′₃.':
    'Vandret spænding er σ′₁, og lodret spænding er σ′₃.';
  byId('explain').textContent=principal+' '+(theta===null?
    'Brudlinjen er endnu ikke nået.':
    'Cirklen tangerer brudlinjen. Trykket holder grænseværdien ved videre flytning. P–tangering er parallel med brudlinjerne.');
  drawSoil(state);
  drawCircle(state);
  drawPressure(state);
}
function drawSoil({delta,z,phi,horizontal,vertical,q,zWater,theta}){
  const reference=56,dx=visualScale*delta,x=reference+dx;
  const top=86,toe=161,end=344;
  const motionAngle=45+(delta<=0?1:-1)*phi/2;
  const slope=Math.tan(rad(motionAngle));
  const particleTravel=.55*dx,dy=-particleTravel*slope;
  const localTop=top+dy;
  const crest=x+(toe-localTop)/slope;
  const outerMotion=.2;
  const surface=`M${x},${localTop} H${crest} V${top} H${end}`;
  const soilShape=`${surface} V${toe} H${x} Z`;
  const wedgeShape=`M${x},${toe} L${crest},${localTop} H${x} Z`;

  const y=top+(toe-top)*z/H;
  const ex=296,half=10;
  // Samme illustrative længdeskala for begge spændingsretninger.
  const arrowLength=stress=>10+18*Math.sqrt(stress/(stress+75));
  const horizontalArrow=arrowLength(horizontal),verticalArrow=arrowLength(vertical);
  const soil=byId('soil');
  soil.setAttribute('aria-label',`Jordelement i ${fmt(z)} meters dybde med vandret spænding ${fmt(horizontal)} og lodret spænding ${fmt(vertical)} kilopascal.`);
  let wedge='';
  if(theta!==null){
    const r=21;
    const family=[.17,.34,.51,.68,.85].map(f=>{
      const yi=toe-f*(toe-localTop);
      return line(x,yi,x+260,yi-260*slope,'shear');
    }).join('');
    wedge=`<path d="${wedgeShape}" fill="#a8d0c2"/>`+
      `<g clip-path="url(#wedge-area)">${family}</g>`+
      line(x,toe,crest,localTop,'teal','id="failure-plane"')+line(x,toe,x+45,toe,'axis dash')+
      `<path d="M${x+r},${toe} A${r} ${r} 0 0 0 ${x+r*Math.cos(rad(theta))},${toe-r*Math.sin(rad(theta))}" fill="none" stroke="#315781" stroke-width="1.4"/>`+
      label(x+28,toe-6,'θ','small on-plot');
  }
  let particles='';
  for(let row=0;top+7+row*16<toe;row++){
    const py=top+7+row*16;
    for(let col=0;col<16;col++){
      const px=reference+4+col*17+(row%2)*2;
      // Forskydning langs planet ændrer ikke partiklens afstand til brudlinjen.
      const edge=x+(toe-py)/slope;
      const moves=delta!==0&&px<=edge;
      const relativePosition=Math.max(0,(px-x)/(edge-x));
      const factor=moves ? 1-(1-outerMotion)*relativePosition : 0;
      const pxNew=px+factor*particleTravel,pyNew=py+factor*dy;
      const inFailureZone=theta!==null&&moves&&pxNew>=x&&pyNew>=localTop&&pyNew<=toe;
      const appearance=inFailureZone
        ? ['kile','#548e80','#215c51']
        : moves&&theta===null ? ['bevaegelse','#efbc67','#94551f'] : ['udenfor','#e5d5b4','#a78e67'];
      const [zone,fill,stroke]=appearance;
      if(moves&&(row+col)%4===0)
        particles+=line(px,py,pxNew,pyNew,'','stroke="#547f74" stroke-width="1" opacity=".65"');
      particles+=`<circle data-zone="${zone}" data-moving="${moves}" cx="${pxNew}" cy="${pyNew}" r="${2.4+((row+col)%3)*.32}" fill="${fill}" stroke="${stroke}" stroke-width=".9"/>`;
    }
  }
  const motion=delta===0?label(reference,19,'Væg i hvile','small','middle'):
    arrow(reference,16,reference+Math.sign(delta)*37,16)+
    label(delta<0?67:104,20,delta<0?'Væk fra jorden':'Ind i jorden','small');
  let groundLoad='';
  if(q>0){
    const loadLength=12+q*.18;
    for(let i=0;i<5;i++){
      const at=x+25+i*32;
      const surfaceY=at<crest ? localTop : top;
      groundLoad+=arrow(at,Math.max(28,surfaceY-loadLength),at,surfaceY-2,'#96472d');
    }
    groundLoad=`<g id="ground-load">${groundLoad}</g>`+label(end,22,'q = '+fmt(q,0)+' kPa','small','end');
  }
  const waterY=top+(toe-top)*zWater/H;
  const waterTint=zWater<H?`<rect x="${x}" y="${waterY}" width="${end-x}" height="${toe-waterY}" fill="#75b6df" opacity=".22"/>`:'';
  const waterLine=zWater<H?line(x,waterY,end,waterY,'water-level')+
    label(Math.min(x+37,123),waterY+12,'Vandspejl','small water-label'):'';
  soil.innerHTML=`<defs><clipPath id="soil-area"><path d="${soilShape}"/></clipPath><clipPath id="wedge-area"><path d="${wedgeShape}"/></clipPath></defs><path d="${soilShape}" fill="#e9e0cb"/>`+
    wedge+`<g clip-path="url(#soil-area)">${waterTint}${particles}</g>`+waterLine+`<path d="${surface}" class="axis" fill="none"/>`+
    line(reference,35,reference,173,'axis dash')+
    `<rect id="wall" x="${x-7}" y="57" width="7" height="${toe-57}" fill="#142735"/>`+
    groundLoad+motion+label(end,top-8,'Terræn','small muted','end')+
    line(x,y,ex-half,y,'depth-guide')+
    `<g id="wall-depth-marker" data-z="${z}">${arrow(x+21,y,x,y,'#006d62')}</g>`+
    label(8,y+18,'z = '+fmt(z)+' m','small on-plot')+
    `<rect id="element" data-crest="${crest}" x="${ex-half}" y="${y-half}" width="${2*half}" height="${2*half}" fill="#f6f5ef" stroke="#142735" stroke-width="1.5"/>`+
    `<g id="horizontal-stress">${arrow(ex-half-horizontalArrow,y,ex-half-1,y,'#96472d')}${arrow(ex+half+horizontalArrow,y,ex+half+1,y,'#96472d')}</g>`+
    `<g id="vertical-stress">${arrow(ex,y-half-verticalArrow,ex,y-half-1,'#315781')}${arrow(ex,y+half+verticalArrow,ex,y+half+1,'#315781')}</g>`+
    label(ex+half+horizontalArrow+3,y-6,'σ′ₕ','small on-plot')+
    label(ex+5,y-half-verticalArrow+3,'σ′ᵥ','small on-plot')+
    label(12,218,theta===null?'Ingen mobiliseret brudzone':`Brudzone · θ = ${fmt(theta,1)}° fra vandret`,'small')+
    label(12,239,'Den grønne pil peger på dybden på væggen.','small muted')+
    point(17,201,'#efbc67',4)+label(26,205,'I bevægelse før brud','small muted')+
    point(174,201,'#548e80',4)+label(183,205,'Brudzone i bevægelse','small muted');
}
function drawCircle({phi,K,vertical,horizontal,theta,mode}){
  const l=46,r=335,t=16,b=206,mid=(t+b)/2;
  const maxP=Math.max(1,K.passive*vertical), ratio=Math.tan(rad(phi));
  const scale=Math.min((r-l-12)/(1.1*maxP),(b-t-17)/(maxP-vertical));
  const X=s=>l+s*scale,Y=s=>mid-s*scale;
  const xEnd=Math.min((r-l)/scale,(mid-t)/scale/ratio);
  const circle=(h,stroke,width,opacity)=>{
    const R=Math.abs(h-vertical)*scale/2,C=X((h+vertical)/2);
    return `<circle cx="${C}" cy="${mid}" r="${Math.max(.8,R)}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
  };
  const env=line(l,mid,X(xEnd),Y(xEnd*ratio),'accent dash')+line(l,mid,X(xEnd),Y(-xEnd*ratio),'accent dash');
  const muted=limits.filter(item=>item.key!==mode).map(item=>circle(K[item.key]*vertical,'#899c96',1.25,.6)).join('');
  let tangent='';
  if(theta!==null){
    const c=(horizontal+vertical)/2, tx=c*Math.cos(rad(phi))**2;
    const ty=(mode==='active'?1:-1)*tx*ratio;
    tangent=line(X(horizontal),mid,X(tx),Y(ty),'','stroke="#315781" stroke-width="2"')+
      point(X(tx),Y(ty),'#96472d',4);
  }
  const n=niceStep((r-l)/scale/4), ticks=[];
  for(let s=n;X(s)<r-13;s+=n)ticks.push(s);
  byId('circle').innerHTML=ticks.map(s=>line(X(s),t,X(s),b,'grid')+
    label(X(s),b+15,fmt(s,Number.isInteger(n)?0:1),'small muted','middle')).join('')+
    line(l,t,l,b,'axis')+line(l,mid,r,mid,'axis')+
    label(27,22,'τ','small')+label(r,mid-7,'σ′ₙ','small','end')+
    label(l,b+15,'0','small muted','middle')+env+muted+circle(horizontal,'#006d62',2.5,1)+tangent+
    point(X(vertical),mid,'#315781')+point(X(horizontal),mid,'#006d62')+
    label(X(vertical),mid-8,'σ′ᵥ','small on-plot','middle')+
    label(X(horizontal),mid+18,'P = σ′ₕ','small on-plot','middle')+
    label(18,241,'Stiplede linjer · τ = ±σ′ₙ tan φ′ · kPa','small muted');
}
function niceStep(raw){
  const scale=10**Math.floor(Math.log10(raw));
  return scale*[1,2,2.5,5,10].find(n=>n>=raw/scale);
}
function drawPressure({delta,K,vertical,horizontal,u,total,z}){
  const l=49,r=333,t=25,b=167;
  const max=Math.max(1,K.passive*vertical+u), step=niceStep(max/4), ceiling=Math.ceil(max/step)*step;
  const X=d=>l+(d-travelMin)*(r-l)/(travelMax-travelMin), Y=p=>b-(b-t)*p/ceiling;
  const pts=limits.map(item=>({...item,p:K[item.key]*vertical}));
  let grid='';
  for(let p=0;p<=ceiling+step/100;p+=step)grid+=line(l,Y(p),r,Y(p),'grid')+
    label(l-7,Y(p)+4,fmt(p,Number.isInteger(step)?0:1),'small muted','end');
  const refs=pts.map(item=>line(l,Y(item.p),X(item.delta),Y(item.p),'axis dash')+line(X(item.delta),Y(item.p),X(item.delta),b,'axis dash')+
    point(X(item.delta),Y(item.p),item.color,4.5)).join('');
  const active=point(X(delta),Y(horizontal),'#006d62',5);
  const totalPoint=u>0?point(X(delta),Y(total),'#142735',5):'';
  const curve=(offset,cls)=>`<polyline points="${Array.from({length:133},(_,i)=>travelMin+i*.5).map(d=>X(d)+','+Y(mobilizedK(d,K)*vertical+offset)).join(' ')}" class="${cls}"/>`;
  const key=[[12,'teal','Effektivt jordtryk'],[153,'water-curve','Vandtryk'],[256,'total-curve','Totaltryk']];

  const xAxis=[travelMin,0,15,passiveLimit,45,travelMax].map(d=>line(X(d),b,X(d),b+4,'axis')+
    label(X(d),b+16,d<0?'−'+Math.abs(d):d,'small muted','middle')).join('');
  const pressure=byId('pressure');
  pressure.setAttribute('aria-label',`Ved ${fmt(z)} meter er effektivt jordtryk ${fmt(horizontal)}, vandtryk ${fmt(u)} og totaltryk ${fmt(total)} kilopascal. `+
    pts.map(item=>item.name+' '+fmt(item.p)).join(', ')+'.');
  pressure.innerHTML=grid+line(l,t,l,b,'axis')+line(l,b,r,b,'axis')+xAxis+
    label(l,16,'Vandret tryk [kPa]','small muted')+label(r,b+34,'Vægflytning [mm]','small muted','end')+
    line(X(delta),Y(total),X(delta),b,'axis dash')+
    line(l,Y(u),r,Y(u),'water-curve')+curve(0,'teal')+curve(u,'total-curve')+
    refs+active+totalPoint+
    pts.map((item,i)=>point(19+113*i,217,item.color,4)+
      label(27+113*i,221,`${item.name} ${fmt(item.p)}`,'small')).join('')+
    key.map(([x,cls,name])=>line(x,241,x+17,241,cls)+label(x+21,245,name,'small')).join('');

}
draw();
