const input = (id,label,value,min,max,step,unit) => ({id,label,value,min,max,step,unit});
const kpa='kPa', metre='m', weight='kN/m³';
const models = {
spaendinger:{
  controls:[
    input('p','Terrænlast',20,0,100,1,kpa),
    input('water','Grundvandsspejlets dybde',2,0,12,.1,metre),
    input('layer','Laggrænsens dybde',5,.5,11.5,.1,metre),
    input('g1','Lag 1 · γ over GVS',17,12,23,.5,weight),
    input('gm1','Lag 1 · γ under GVS',20,17,25,.5,weight),
    input('g2','Lag 2 · γ over GVS',19,12,23,.5,weight),
    input('gm2','Lag 2 · γ under GVS',22,17,25,.5,weight),
    input('z','Aflæsningsdybde',8,0,12,.1,metre)
  ],
  draw(f,v){
    const breaks=[0,v.water,v.layer,12].sort((a,b)=>a-b);
    const stresses=z=>{
      let total=v.p;
      for(let i=1;i<breaks.length;i++){
        const start=breaks[i-1], end=Math.min(z,breaks[i]);
        if(end<=start) continue;
        const gamma=start<v.layer?(start<v.water?v.g1:v.gm1):(start<v.water?v.g2:v.gm2);
        total+=(end-start)*gamma;
      }
      const u=10*Math.max(0,z-v.water);
      return [total,u,total-u];
    };
    const g=diagram(f,{xMax:Math.ceil(stresses(12)[0]/40)*40,yMax:12,xLabel:'Spænding (kPa)',yLabel:'Dybde (m)',down:true,profile:true});
    jordprofil(f,g,[[0,v.layer,farve.soil],[v.layer,12,farve.clay]],v.water,12);
    const series=[['Totalspænding σz',farve.orange],['Poretryk u',farve.blue],['Effektiv spænding σ′z',farve.green]];
    g.plot([[0,v.z],[stresses(12)[0],v.z]],farve.gray,[3,4]);
    series.forEach(([,color],i)=>{
      g.plot(breaks.map(z=>[stresses(z)[i],z]),color);
      g.dot(stresses(v.z)[i],v.z,color);
    });
    return {metrics:series.map(([label],i)=>[label,stresses(v.z)[i],kpa]),legend:series,
      caption:'Jordprofil til venstre. Punkterne på kurverne viser værdier i den valgte aflæsningsdybde.'};
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
  controls:[
    input('start','Effektiv startspænding σ′f',50,10,200,5,kpa),
    input('inc','Spændingstilvækst Δσ′',60,0,200,5,kpa),
    input('depth','Lagtykkelse Z',3,.5,10,.1,metre),
    input('q','Tøjningsindeks Q',18,2,35,.5,'%'),
    input('mod','Konsolideringsmodul K',3,1,30,.1,'MPa')
  ],
  draw(f,v){
    const xMax=Math.max(100,v.start+v.inc+25);
    const nc=s=>v.q*Math.log10(s/v.start), lin=s=>100*(s-v.start)/(v.mod*1000);
    const g=diagram(f,{xMax,yMax:Math.max(5,nc(xMax),lin(xMax))*1.08,xLabel:'Effektiv spænding σ′ (kPa)',yLabel:'Tøjning (%)',down:true});
    [[nc,farve.green],[lin,farve.orange]].forEach(([fn,color])=>{
      g.plot(punkter(70,t=>{const s=v.start+t*(xMax-v.start);return [s,fn(s)];}),color);
      const end=v.start+v.inc;
      g.dot(end,fn(end),color);
    });
    return {metrics:[['Slutspænding',v.start+v.inc,kpa],['Sætning · stamkurve',v.depth*10*nc(v.start+v.inc),'mm'],['Sætning · konstant K',v.depth*10*lin(v.start+v.inc),'mm']],
      legend:[['Stamkurve',farve.green],['Konstant K',farve.orange]],caption:'Tøjningen måles fra startspændingen. Punkterne viser tøjningen efter lasttrinnet.'};
  }
},
konsolidering:{
  modes:['Ensidig dræning','Dobbeltsidig dræning'],
  controls:[
    input('time','Tid efter belastning',40,0,1000,1,'døgn'),
    input('depth','Lagtykkelse Z',4,1,10,.1,metre),
    input('cv','Konsolideringskoefficient cₖ',.025,.002,.15,.001,'m²/døgn'),
    input('p','Lasttrin p',50,5,150,1,kpa),
    input('mod','Konsolideringsmodul K',4,1,20,.1,'MPa')
  ],
  draw(f,v,mode){
    const H=v.depth/(mode+1), T=v.cv*v.time/H**2;
    function residual(x,average=false){
      if(T===0) return 1;
      let sum=0;
      for(let n=1;n<401;n+=2){
        const a=n*Math.PI/2;
        sum+=Math.exp(-a*a*T)*(average?1/a:Math.sin(a*x))/n;
      }
      return Math.max(0,Math.min(1,4*sum/Math.PI));
    }
    const U=1-residual(0,true);
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
    return {metrics:[['Tidsfaktor T',T,'',4],['Konsolideringsgrad',100*U,'%'],['Sætning nu',U*v.p*v.depth/v.mod,'mm'],['Slutsætning',v.p*v.depth/v.mod,'mm'],['Tid til ca. 50 %',.197*H**2/v.cv,'døgn']],
      profile:values, legend:[['Poreovertryk Δu',farve.blue],['Effektiv spændingstilvækst Δσ′',farve.green]],
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
