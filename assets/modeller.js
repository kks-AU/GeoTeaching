const input = (id,label,value,min,max,step,unit) => ({id,label,value,min,max,step,unit});
const kpa='kPa', metre='m', weight='kN/m³';
function lerToejning(stress,start,pc,K,Q){
  const reload=(Math.min(stress,pc)-start)/K;
  return reload+Q*Math.log10(Math.max(stress,pc)/pc);
}

function logSpændingTicks(min,max){
  const ticks=[];
  for(let decade=Math.floor(Math.log10(min));decade<=Math.ceil(Math.log10(max));decade++){
    for(const m of [1,2,5]){
      const value=m*10**decade;
      if(value>=min && value<=max) ticks.push(value);
    }
  }
  return ticks;
}

const models = {
spaendinger:{
  controls:[
    input('p','Terrænlast',20,0,100,1,kpa),
    input('water','Grundvandsspejlets dybde',2,0,12,.1,metre),
    input('hc','Kapillær stighøjde h꜀',0,0,12,.1,metre),
    input('layer','Laggrænsens dybde',5,.5,11.5,.1,metre),
    input('g1','Lag 1 · γ over KVS',17,12,23,.5,weight),
    input('gm1','Lag 1 · γₘ i vandmættet jord',20,17,25,.5,weight),
    input('g2','Lag 2 · γ over KVS',19,12,23,.5,weight),
    input('gm2','Lag 2 · γₘ i vandmættet jord',22,17,25,.5,weight),
    input('z','Aflæsningsdybde',8,0,12,.1,metre)
  ],
  bounds:{
    g1:v=>({max:Math.min(23,v.gm1-.5)}),
    gm1:v=>({min:Math.max(17,v.g1+.5)}),
    g2:v=>({max:Math.min(23,v.gm2-.5)}),
    gm2:v=>({min:Math.max(17,v.g2+.5)})
  },
  draw(f,v){
    const kvs=Math.max(0,v.water-v.hc);
    const breaks=[...new Set([0,kvs,v.water,v.layer,12])].sort((a,b)=>a-b);
    const stresses=(z,saturated=z>=kvs)=>{
      let total=v.p;
      for(let i=1;i<breaks.length;i++){
        const start=breaks[i-1], end=Math.min(z,breaks[i]);
        if(end<=start) continue;
        const gamma=start<v.layer?(start<kvs?v.g1:v.gm1):(start<kvs?v.g2:v.gm2);
        total+=(end-start)*gamma;
      }
      const u=saturated?10*(z-v.water):0;
      return [total,u,total-u];
    };
    const series=[['Totalspænding σz',farve.orange],['Poretryk u',farve.blue],['Effektiv spænding σ′z',farve.green]];
    const sections=kvs>0 && kvs<12
      ? [breaks.filter(z=>z<=kvs).map(z=>[z,stresses(z,false)]),
         breaks.filter(z=>z>=kvs).map(z=>[z,stresses(z)])]
      : [breaks.map(z=>[z,stresses(z)])];
    const left=-10*(v.water-kvs);
    const right=Math.ceil(Math.max(...sections.flat().flatMap(([,s])=>s))/40)*40;
    const g=diagram(f,{xMin:left,xMax:right,yMax:12,xLabel:'Spænding (kPa)',yLabel:'Dybde (m)',down:true,profile:true});
    jordprofil(f,g,[[0,v.layer,farve.soil],[v.layer,12,farve.clay]],v.water,12);
    if(kvs<v.water){
      f.rect(5,g.y(kvs),29,g.y(v.water)-g.y(kvs),'#5da9c960');
      f.line([[5,g.y(kvs)],[34,g.y(kvs)]],farve.blue,1,[3,3]);
    }
    g.plot([[left,v.z],[right,v.z]],farve.gray,[3,4]);
    series.forEach(([,color],i)=>{
      sections.forEach(section=>g.plot(section.map(([z,s])=>[s[i],z]),color));
      g.dot(stresses(v.z)[i],v.z,color);
    });
    return {metrics:[...series.map(([label],i)=>[label,stresses(v.z)[i],kpa]),['Kapillarvandsspejlets dybde',kvs,metre]],legend:series,kvs,
      caption:'Punkterne viser værdierne i den valgte dybde. Ved KVS aflæses poretrykket på den vandmættede side.'};
  }
},
rankine:{
  modes:['Mohrs cirkel','Jordtryk mod væggen'],
  controls:[
    input('motion','Væggens bevægelse · relativ til brud',0,-100,100,1,'%'),
    input('phi','Friktionsvinkel φ',32,10,45,1,'°'),
    input('gamma','Rumvægt γ',18,14,23,.5,weight),
    input('p','Terrænlast p',10,0,60,1,kpa),
    input('z','Dybde ved væggen',4,.5,10,.1,metre)
  ],
  draw(f,v,mode){
    const phi=rad(v.phi), sin=Math.sin(phi);
    const k0=1-sin, ka=k0/(1+sin), kp=1/ka;
    const k=k0+Math.abs(v.motion)/100*((v.motion<0?ka:kp)-k0);
    const vertical=v.gamma*v.z+v.p, horizontal=k*vertical;
    if(mode){
      const g=diagram(f,{xMax:kp*vertical,yMax:v.z,xLabel:'Vandret spænding (kPa)',yLabel:'Dybde langs væggen (m)',down:true,profile:true});
      jordprofil(f,g,[[0,v.z,farve.soil]],null,v.z);
      const wall=5+5*v.motion/100;
      f.line([[wall,g.y(0)],[wall,g.y(v.z)]],farve.gray,3);
      [ka,k0,kp].forEach(limit=>{
        g.plot([[limit*v.p,0],[limit*vertical,v.z]],farve.gray,[3,5]);
      });
      g.plot([[k*v.p,0],[horizontal,v.z]],farve.green);
      g.dot(horizontal,v.z,farve.green);
    }else{
      mohr(f,{phi,c:0,hi:Math.max(vertical,horizontal),lo:Math.min(vertical,horizontal),extra:1.12*kp*vertical});
    }
    const status=v.motion===-100?'Aktivt brud':v.motion===100?'Passivt brud':v.motion===0?'Hviletryk':v.motion<0?'Mod aktivt brud':'Mod passivt brud';
    return {metrics:[['Tilstand',status],['Lodret σ′z',vertical,kpa],['Vandret σ′x',horizontal,kpa],['K',k,'',3]],
      legend:mode?[['Mobiliseret jordtryk',farve.green],['Aktivt tryk, hviletryk og passivt tryk',farve.gray]]:
        [['Mohrs cirkel',farve.green],['Brudlinje',farve.orange]],
      caption:'Negative værdier flytter væggen væk fra jorden. Positive værdier flytter væggen ind mod jorden. ±100 % angiver brud.'};
  }
},
deformation:{
  modes:['Lineær spændingsakse','Log₁₀-spændingsakse'],
  controls:[
    input('start','Effektiv startspænding σ′f',50,10,200,5,kpa),
    input('inc','Spændingstilvækst Δσ′',100,0,600,5,kpa),
    input('ocr','Overkonsolideringsgrad · OCR',2,1,10,.1,''),
    input('depth','Lagtykkelse Z',3,.5,10,.1,metre),
    input('q','Tøjningsindeks Q',18,2,35,.5,'%'),
    input('mod','Genbelastningsmodul K',12,5,100,.5,'MPa')
  ],
  draw(f,v,mode){
    const end=v.start+v.inc, pc=v.start*v.ocr, K=v.mod*1000, Q=v.q/100;
    const strain=(stress,threshold)=>100*lerToejning(stress,v.start,threshold,K,Q);
    const xMax=Math.ceil(Math.max(end*1.22,pc*1.13,v.start*1.7)/10)*10;
    const g=diagram(f,{xMin:mode?v.start:0,xMax,yMax:Math.max(.5,strain(xMax,v.start),strain(xMax,pc))*1.1,
      scaleX:mode?Math.log10:undefined,ticks:mode?logSpændingTicks(v.start,xMax):null,
      xLabel:mode?'Effektiv spænding σ′ (kPa) · log₁₀':'Effektiv spænding σ′ (kPa) · lineær',
      yLabel:'Lodret tøjning εz (%)',down:true});
    const segment=(a,b,threshold,color,dash)=>g.plot(punkter(90,t=>{
      const stress=a+t*(b-a);
      return [stress,strain(stress,threshold)];
    }),color,dash);
    if(v.ocr>1){
      segment(v.start,xMax,v.start,farve.gray,[5,4]);
      segment(v.start,pc,pc,farve.orange);
      g.plot([[pc,0],[pc,strain(pc,pc)]],farve.gray,[3,3]);
      g.dot(pc,strain(pc,pc),farve.orange);
    }
    segment(pc,xMax,pc,farve.green);
    const actual=strain(end,pc), normally=strain(end,v.start);
    g.dot(end,normally,farve.gray);
    g.dot(end,actual,end<pc?farve.orange:farve.green);
    const branch=end<pc?'Genbelastning':end===pc && v.ocr>1?'Ved forbelastningsspændingen':v.ocr>1?'Forbi forbelastningen':'Stamkurve';
    return {metrics:[['Slutspænding σ′e',end,kpa],['Forbelastningsspænding σ′pc',pc,kpa],
      ['Tøjning',actual,'%'],['Sætning',v.depth*10*actual,'mm'],['Gren ved slutspænding',branch]],
      comparison:[v.depth*10*normally,v.depth*10*actual],
      legend:v.ocr>1?[['Genbelastning',farve.orange],['Stamkurve efter genbelastning',farve.green],['Normalkonsolideret reference',farve.gray]]:[['Stamkurve · normalkonsolideret',farve.green]],
      caption:'Punkterne viser sluttilstanden. Aksevalget ændrer afbildningen, mens tøjning og sætning bevares.'};
  }
},
konsolidering:{
  modes:['Ensidig dræning','Dobbeltsidig dræning'],
  controls:[
    input('time','Tid efter belastning',40,0,1000,1,'døgn'),
    input('depth','Lagtykkelse Z',4,1,10,.1,metre),
    input('cv','Konsolideringskoefficient cₖ',.025,.002,.15,.001,'m²/døgn'),
    input('p','Terrænlast p',50,5,150,1,kpa),
    {id:'historik',label:'Lerlagets spændingshistorie',value:0,options:['Normalkonsolideret','Forkonsolideret']},
    input('start','Effektiv startspænding σ′f',50,10,200,5,kpa),
    input('ocr','Overkonsolideringsgrad OCR',2,1.1,10,.1,''),
    input('mod','Genbelastningsmodul K',12,5,100,.5,'MPa'),
    input('q','Tøjningsindeks Q',18,2,35,.5,'%'),
    input('qs','Krybeindeks Qₛ',.5,0,2,.05,'%'),
    input('creepBelow','Krybehældning under forbelastningen',.05,0,2,.05,'%')
  ],
  bounds:{creepBelow:v=>({max:v.qs}),time:(v,mode)=>({max:Math.max(1000,Math.ceil(20*(v.depth/(mode+1))**2/v.cv))})},
  updateValues(v,mode){
    v.creepBelow=Math.min(v.creepBelow,v.qs);
    v.time=Math.min(v.time,this.bounds.time(v,mode).max);
  },
  visibleControl(id,v){
    return !['ocr','mod','creepBelow'].includes(id)||v.historik===1;
  },
  drawTime(f,result){
    const {time,t100,strain,curves}=result.timeData;
    const end=Math.max(3*t100,time*1.05);
    const g=diagram(f,{xMax:end,yMax:strain(end)[2]*1.12,xLabel:'Tid t (døgn)',yLabel:'Lodret tøjning (%)',down:true});
    const times=[...new Set([...punkter(120,r=>end*r*r),t100,time])].sort((a,b)=>a-b);
    g.plot([[t100,0],[t100,strain(end)[2]]],farve.gray,[4,4]);
    curves.forEach(([,color,dash],i)=>{
      g.plot(times.map(t=>[t,strain(t)[i]]),color,dash);
      g.dot(time,strain(time)[i],color);
    });
    f.label(g.x(t100)+5,g.y(0)+15,'t₁₀₀',farve.gray);
  },
  extraFigure:'toejningsfigur',
  draw(f,v,mode){
    const H=v.depth/(mode+1), T=v.cv*v.time/H**2;
    function residual(x,average=false,timeFactor=T){
      if(timeFactor===0) return 1;
      let sum=0;
      for(let n=1;n<401;n+=2){
        const a=n*Math.PI/2;
        sum+=Math.exp(-a*a*timeFactor)*(average?1/a:Math.sin(a*x))/n;
      }
      return Math.max(0,Math.min(1,4*sum/Math.PI));
    }
    const U=1-residual(0,true);
    const pc=v.start*(v.historik?v.ocr:1), end=v.start+v.p;
    const primary=lerToejning(end,v.start,pc,v.mod*1000,v.q/100);
    const t100=2*H**2/v.cv;
    const slope=(end>=pc?v.qs:v.creepBelow)/100;
    const primaryAtEnd=1-residual(0,true,2);
    const strain=t=>{
      const first=100*primary*(t>=t100?1:(1-residual(0,true,v.cv*t/H**2))/primaryAtEnd);
      const creep=t>t100?100*slope*Math.log10(t/t100):0;
      return [first,creep,first+creep];
    };
    const [primaryNow,creepNow,totalNow]=strain(v.time);
    const curves=[['Primær tøjning',farve.green,[5,4]],['Krybetøjning',farve.orange],['Samlet tøjning',farve.blue]];

    const g=diagram(f,{xMax:v.p,yMax:v.depth,xLabel:'Spændingstilvækst (kPa)',yLabel:'Dybde i lerlaget (m)',down:true,profile:true});
    jordprofil(f,g,[[0,v.depth,farve.clay]],null,v.depth);
    f.line([[5,g.y(0)],[34,g.y(0)]],farve.blue,4);
    f.line([[5,g.y(v.depth)],[34,g.y(v.depth)]],mode?farve.blue:farve.gray,4);
    const values=punkter(140,t=>{
      const z=t*v.depth, x=mode?Math.min(z,v.depth-z)/H:z/H;
      return [v.p*residual(x),z];
    });
    g.plot(values,farve.blue);
    g.plot(values.map(([u,z])=>[v.p-u,z]),farve.green);
    return {metrics:[['Tidsfaktor T',T,'',4],['Konsolideringsgrad',100*U,'%'],['Forbelastningsspænding σ′pc',pc,kpa],['Primær tøjning',primaryNow,'%',3],
        ['Krybetøjning',creepNow,'%',3],['Samlet sætning',totalNow*v.depth*10,'mm'],['Krybning starter ved t₁₀₀',t100,'døgn'],['Tid til ca. 50 %',.197*H**2/v.cv,'døgn']],
      timeData:{time:v.time,t100,strain,curves}, profile:values, legend:[['Poreovertryk Δu',farve.blue],['Effektiv spændingstilvækst Δσ′',farve.green]],
      caption:'Blå lagflader viser dræn. Til tiden 0 bæres lasttrinnet af poreovertrykket i lagets indre.'};
  }
},
baereevne:{
  controls:[
    input('b','Fundamentbredde b',1.5,.5,5,.1,metre),
    input('g','Rumvægt γ',18,0,24,.5,weight),
    input('q','Overlejringstryk q',20,0,100,1,kpa),
    input('c','Kohæsion c',5,0,80,1,kpa),
    input('phi','Friktionsvinkel φ',30,0,45,1,'°')
  ],
  draw(f,v){
    const phi=rad(v.phi), s=Math.sin(phi);
    const nq=Math.exp(Math.PI*Math.tan(phi))*(1+s)/(1-s);
    const nc=phi?(nq-1)/Math.tan(phi):Math.PI+2;
    const ng=.25*((nq-1)*Math.cos(phi))**1.5;
    const parts=[
      ['Rγ · Bidrag fra jordens egenvægt',.5*v.g*v.b**2*ng,farve.green],
      ['Rq · Bidrag fra overlejringstryk',v.q*v.b*nq,farve.blue],
      ['Rc · Bidrag fra kohæsion',v.c*v.b*nc,farve.orange]
    ];
    soejler(f,parts,'kN/m');
    return {metrics:[['Brudbæreevne R',parts.reduce((sum,p)=>sum+p[1],0),'kN/m'],['Nγ',ng],['Nq',nq],['Nc',nc],...parts.map(([label,value])=>[label,value,'kN/m'])],caption:'Hver søjle viser et bidrag til den lodrette brudbæreevne pr. løbende meter fundament. Søjlerne har fælles skala.'};
  }
},
paele:{
  modes:['Geostatik · ler','Rammeformel · sand'],
  controls:[
    input('b','Pælens sidelængde',.3,.2,.5,.01,metre),
    input('l','Pælelængde',10,3,15,.1,metre)
  ],
  modeControls:[
    [input('cu','Udrænet styrke cᵤ',55,15,150,1,kpa),
    input('m','Materialefaktor m',.9,.8,1,.01,''),
    input('r','Regenerationsfaktor r',.7,.1,1,.01,'')],
    [input('g','Ramklodsens tyngde G',40,10,100,1,'kN'),
    input('h','Faldhøjde h',.7,.1,1.5,.05,metre),
    input('eta','Effektivitet η',.7,.7,.95,.01,''),
    input('s','Nedsynkning pr. slag s',5,1,30,.5,'mm')]
  ],
  draw(f,v,mode){
    const area=v.b**2;
    if(mode){
      const E=20e6, energy=v.eta*v.h*v.g;
      const length=v.l<20*v.b?(v.l+20*v.b)/2:v.l;
      const s0=Math.sqrt(2*energy*length/(area*E));
      const s=v.s/1000;
      const resistance=energy/(s+s0/2);
      soejler(f,[['Blivende nedsynkning s',v.s,farve.green],['Elastisk led ½s₀',s0*500,farve.blue]],'mm');
      return {metrics:[['Dynamisk modstand',resistance,'kN'],['Effektiv slagenergi',energy,'kNm'],['Længde i formlen',length,'m']],
        caption:'Søjlerne viser de to længder i nævneren i rammeformlen. Modulet E for beton er 20 GPa som angivet på s. 418.'};
    }
    const shaft=4*v.b*v.l*v.cu*v.m*v.r, base=9*v.cu*area;
    soejler(f,[['Overflademodstand langs skaftet',shaft,farve.green],['Spidsmodstand',base,farve.orange]],'kN');
    return {metrics:[['Statisk modstand',shaft+base,'kN'],['Overfladeareal',4*v.b*v.l,'m²'],['Spidsareal',area,'m²',3]],
      caption:'Overflade- og spidsmodstanden summeres for den aksialt trykbelastede pæl.'};
  }
},
styrke:{
  controls:[
    input('tau1','Skæreboks · τf ved 50 kPa',38,5,110,1,kpa),
    input('tau2','Skæreboks · τf ved 150 kPa',96,5,230,1,kpa),
    input('s3','Triaksial · celletryk σ′₃',70,20,130,1,kpa),
    input('load','Triaksial · andel af deviator ved brud',85,0,100,1,'%')
  ],
  draw(f,v){
    const slope=(v.tau2-v.tau1)/100, c=v.tau1-50*slope;
    if(slope<0||c<0){
      return {metrics:[],caption:'Vælg målinger med stigende eller konstant forskydningsstyrke og en skæring med τ-aksen på mindst 0 kPa. Justér skæreboksværdierne for at fortsætte.'};
    }
    const phi=Math.atan(slope), sin=Math.sin(phi);
    const fail=2*(v.s3*sin+c*Math.cos(phi))/(1-sin);
    const hi=v.s3+fail*v.load/100;
    mohr(f,{phi,c,hi,lo:v.s3,points:[[50,v.tau1],[150,v.tau2]],extra:Math.max(180,1.13*(v.s3+fail))});
    return {metrics:[['Effektiv kohæsion c′',c,kpa],['Friktionsvinkel φ′',phi*180/Math.PI,'°'],['Deviator ved brud',fail,kpa],['Aktuel σ′₁',hi,kpa]],
      legend:[['Skæreboksens brudpunkter',farve.blue],['Triaksialprøvens Mohr-cirkel',farve.green],['Fælles brudlinje',farve.orange]],
      caption:'De blå punkter fastlægger brudlinjen. Sæt deviatorandelen til 100 % for at se triaksialcirklen tangere linjen.'};
  }
},
saetninger:{
  controls:[
    input('p','Sætningsgivende last P',600,50,2000,10,'kN'),
    input('b','Bredde B',2,.5,6,.1,metre),
    input('l','Længde L',3,.5,10,.1,metre),
    input('z1','Øvre lagtykkelse',2,.5,6,.1,metre),
    input('z2','Nedre lagtykkelse',4,.5,10,.1,metre),
    input('k1','Øvre lag · modul K',4,1,30,.1,'MPa'),
    input('k2','Nedre lag · modul K',12,1,50,.1,'MPa'),
    input('n','Dellag pr. materiale',4,1,12,1,'')
  ],
  draw(f,v){
    const pressure=z=>v.p/((v.b+z)*(v.l+z)), Z=v.z1+v.z2;
    const g=diagram(f,{xMax:pressure(0),yMax:Z,xLabel:'Spændingstilvækst Δσz (kPa)',yLabel:'Dybde under fundamentet (m)',down:true,profile:true});
    jordprofil(f,g,[[0,v.z1,farve.soil],[v.z1,Z,farve.clay]],null,Z);
    g.plot(punkter(80,t=>[pressure(t*Z),t*Z]),farve.green);
    const rows=[];
    [[0,v.z1,v.k1],[v.z1,v.z2,v.k2]].forEach(([start,depth,k],layer)=>{
      for(let i=0;i<v.n;i++){
        const dz=depth/v.n, mid=start+dz*(i+.5), p=pressure(mid);
        g.dot(p,mid,layer?farve.orange:farve.blue);
        rows.push([layer?'Nedre':'Øvre',mid,p,dz*p/k]);
      }
    });
    const upper=rows.slice(0,v.n).reduce((s,r)=>s+r[3],0);
    const lower=rows.slice(v.n).reduce((s,r)=>s+r[3],0);
    return {metrics:[['Samlet sætning',upper+lower,'mm'],['Øvre jordlag',upper,'mm'],['Nedre jordlag',lower,'mm']],
      legend:[['Trykspredning',farve.green],['Øvre dellag',farve.blue],['Nedre dellag',farve.orange]],
      caption:'Punkterne markerer de dybder, hvor spændingstilvæksten bruges til at beregne hvert sætningsbidrag.',
      table:{heads:['Materiale','Lagmidte (m)','Δσ′ (kPa)','Bidrag (mm)'],rows}};
  }
}
};
