const forsog = {
  normal:{start:25,pc:25,K:10000,Q:.16,cv:3e-7,Qs:.005},
  forud:{start:25,pc:100,K:12000,Q:.20,cv:5e-7,Qs:.007}
};
const find = id => document.getElementById(id);
const inputs=['proeve','tykkelse','trin','aflaesning','krybevalg'].map(find);
const aendringer=[find('tidskurve'),find('arbejdskurve'),find('apparat')];
const T50=.2;

function konsolideringsgrad(T){
  if(T===0) return 0;
  if(T<.04) return 2*Math.sqrt(T/Math.PI);
  let rest=0;
  for(let n=1;n<35;n+=2){
    const a=n*Math.PI/2;
    rest+=2*Math.exp(-a*a*T)/(a*a);
  }
  return 1-rest;
}

function simulerTrin(sample,Z,step){
  const from=sample.start*2**step, to=from*2;
  const strain=s=>lerToejning(s,sample.start,sample.pc,sample.K,sample.Q);
  const before=strain(from), after=strain(to);
  const primary=after-before;
  const H=Z/2000*(1-(before+after)/2);
  const timeScale=H**2/sample.cv/60;
  const t100=2*timeScale;
  const slope=to>sample.pc?sample.Qs:0;
  const eps=t=>{
    if(t>=t100) return before+primary+slope*Math.log10(t/t100);
    return before+primary*konsolideringsgrad(t/timeScale)/konsolideringsgrad(2);
  };
  return {from,to,before,after,primary,H,timeScale,t100,slope,eps,strain};
}

function renderForsog(){
  if(!aendringer[0].clientWidth) return;
  const sample=forsog[inputs[0].value], Z=Number(inputs[1].value);
  const step=Number(inputs[2].value);
  const data=simulerTrin(sample,Z,step);
  const {from,to,before,after,primary,H,timeScale,t100,slope,eps,strain}=data;
  const minT=timeScale*.001, maxT=timeScale*200;
  const time=minT*(maxT/minT)**(Number(inputs[3].value)/100);
  const timeTicks=logSpændingTicks(minT,maxT).filter((_,i)=>i%3===0);
  const late1=t100*2, late2=late1*Number(inputs[4].value);
  const measuredU=100*(Math.min(after,eps(time))-before)/primary;
  find('tykkelsevaerdi').textContent=tal(Z)+' mm';
  find('aflaesningvaerdi').textContent=tal(time,2)+' min';
  inputs[3].setAttribute('aria-valuetext',tal(time,2)+' minutter');
  const endpoints=Array.from({length:6},(_,i)=>sample.start*2**i);
  const plot=diagram(figur(aendringer[0]),{xMin:minT,xMax:maxT,yMax:Math.max(.5,100*(eps(maxT)-before)*1.1),
    ticks:timeTicks,scaleX:Math.log10,xLabel:'Tid t (min) · log₁₀',yLabel:'Tøjning i lasttrinnet (%)',down:true});
  const strainOnStep=t=>100*(eps(t)-before);
  plot.plot(punkter(160,r=>{const t=minT*(maxT/minT)**r;return [t,strainOnStep(t)];}),farve.green);
  plot.plot([[minT,50*primary],[maxT,50*primary]],farve.orange,[4,4]);
  plot.plot([[minT,100*primary],[maxT,100*primary]],farve.gray,[4,4]);
  plot.plot([[time,0],[time,strainOnStep(time)]],farve.blue,[3,3]);
  plot.dot(time,strainOnStep(time),farve.blue);
  [late1,late2].forEach(t=>plot.dot(t,strainOnStep(t),farve.orange));
  const work=diagram(figur(aendringer[1]),{xMin:25,xMax:800,yMax:100*strain(800)*1.12,
    ticks:[25,50,100,200,400,800],scaleX:Math.log10,xLabel:'Effektiv spænding σ′ (kPa) · log₁₀',yLabel:'Primær tøjning (%)',down:true});
  work.plot(punkter(140,r=>{const s=25*32**r;return [s,100*strain(s)];}),farve.green);
  endpoints.forEach(s=>work.dot(s,100*strain(s),farve.gray));
  [from,to].forEach(s=>work.dot(s,100*strain(s),farve.blue));
  const f=figur(aendringer[2]), x=f.w/2, w=Math.min(180,f.w*.4), top=46, base=f.h-24;
  const head=top+(base-top)*Math.min(.4,eps(time))*1.7;
  f.rect(x-w/2-14,top-2,w+28,base-top+11,'#b5d9e8');
  lag(f,x-w/2,head,w,base-head,clay);
  f.rect(x-w/2-5,top-8,5,base-top+12,steel);
  f.rect(x+w/2,top-8,5,base-top+12,steel);
  f.rect(x-w/2,head-7,w,7,water);
  f.rect(x-w/2,base,w,7,water);
  f.line([[x-w/2,top],[x+w/2,top]],steel,1,[3,3]);
  pil(f,x,20,x,head-9);
  f.label(x+9,20,`Δσ′ = ${tal(to-from)} kPa`,load);
  lodretMaal(f,x-w/2-31,top,base,'Z');
  f.label(x,base+20,'Filtersten på begge sider',water,'center');
  // The laboratory readings are interpreted with the selected time as an estimate of t50.
  const K=(to-from)/primary;
  const Q=to<=sample.pc?null:(after-strain(Math.max(from,sample.pc)))/Math.log10(to/Math.max(from,sample.pc));
  const cv=T50*H**2/(time*60);
  const k=cv*10/K;
  const qs=(eps(late2)-eps(late1))/Math.log10(late2/late1);
  const near50=Math.abs(measuredU-50)<=3;
  const pct=e=>tal(100*e,3)+' %';
  const expText=n=>n.toExponential(2).replace('.',',').replace('e-',' × 10^−');
  find('aflaesningstatus').textContent=`Ved ${tal(time,2)} min er prøvens konsolideringsgrad ${tal(measuredU)} %. ${near50?'Markøren ligger tæt på 50 %.':'Flyt den blå markør til den orange stiplede hjælpelinje ved 50 %.'}`;
  find('trininfo').textContent=`Prøven belastes fra ${from} til ${to} kPa. De blå punkter markerer trinnet på arbejdskurven.`;
  const interpretation=[
    ['K · konsolideringsmodul',`${tal(to-from)} kPa / ${tal(primary,5)} = ${tal(K/1000,2)} MPa`],
    ['Q · tøjningsindeks',Q===null?'Vælg et lasttrin over forbelastningsspændingen.':`På stamkurven fra ${Math.max(from,sample.pc)} til ${to} kPa fås ${pct(Q)} pr. dekade.`],
    ['cᵥ · konsolideringskoefficient',`0,2 · (${tal(H,5)} m)² / ${tal(time*60,2)} s = ${expText(cv)} m²/s.`],
    ['k · hydraulisk ledningsevne',`${expText(cv)} m²/s · 10 kN/m³ / ${tal(K)} kPa = ${expText(k)} m/s.`],
    ['Qₛ · krybningens tøjningsindeks',slope===0?'Vælg et lasttrin over forbelastningsspændingen. Krybning under forbelastningen er udeladt i øvelsen.':`Fra ${tal(late1,1)} til ${tal(late2,1)} min stiger tøjningen med ${pct(eps(late2)-eps(late1))} af prøvehøjden. Det giver ${pct(qs)} pr. dekade.`]
  ];
  find('afledte').replaceChildren(...interpretation.map(([title,value])=>{
    const node=document.createElement('div');
    const term=document.createElement('dt'), text=document.createElement('dd');
    term.textContent=title;
    text.textContent=value;
    node.append(term,text);
    return node;
  }));
  find('aflaesninger').textContent=`Primær tøjning i trinnet ${pct(primary)}. Drænvej ved 50 % ${tal(H*1000,2)} mm. Den stiplede grå linje viser 100 % primær konsolidering.`;
}

inputs.forEach(control=>control.addEventListener('input',renderForsog));
new ResizeObserver(renderForsog).observe(aendringer[0]);
renderForsog();
