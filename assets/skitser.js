// Principskitserne bruger de samme input som diagrammerne.
const steel = '#304e4a';
const earth = '#f1dfb6';
const clay = '#d8b699';
const water = '#1c6a9a';
const load = '#a34828';

function pil(f,x,y,toX,toY,color=load,width=2,tip=7) {
  const angle=Math.atan2(toY-y,toX-x);
  f.line([[x,y],[toX,toY]],color,width);
  f.polygon([[toX,toY],
    [toX-tip*Math.cos(angle-.45),toY-tip*Math.sin(angle-.45)],
    [toX-tip*Math.cos(angle+.45),toY-tip*Math.sin(angle+.45)]],color);
}

function lag(f,x,y,w,h,color,texture='#574b323b') {
  f.rect(x,y,w,h,color);
  for(let row=10;row<h-4;row+=11){
    for(let col=9+(row%3)*4;col<w-5;col+=17){
      f.dot(x+col,y+row,texture,(row+col)%3===0?1.25:.75);
    }
  }
}

function lodretMaal(f,x,top,bottom,label,color=steel) {
  f.line([[x-4,top],[x+4,top]],color,1);
  f.line([[x,top],[x,bottom]],color,1);
  f.line([[x-4,bottom],[x+4,bottom]],color,1);
  f.label(x+7,(top+bottom)/2+4,label,color);
}

function vandretMaal(f,left,right,y,label) {
  f.line([[left,y-4],[left,y+4]],steel,1);
  f.line([[left,y],[right,y]],steel,1);
  f.line([[right,y-4],[right,y+4]],steel,1);
  f.label((left+right)/2,y-6,label,steel,'center');
}

function terrænlast(f,left,right,y,rel,label) {
  f.label((left+right)/2,17,label,load,'center');
  if(rel<=0) return;
  punkter(4,t=>left+(right-left)*t).forEach(x=>pil(f,x,y-9-23*rel,x,y-2));
}

const skitser = {
  spaendinger(f,v,mode,{kvs}){
    const x=18, end=f.w-69, top=58, bottom=f.h-23;
    const y=z=>top+(bottom-top)*z/12;
    lag(f,x,top,end-x,y(v.layer)-top,earth);
    lag(f,x,y(v.layer),end-x,bottom-y(v.layer),clay);
    f.rect(x,y(kvs),end-x,y(v.water)-y(kvs),'#5da9c966');
    f.rect(x,y(v.water),end-x,bottom-y(v.water),'#5da9c93c');
    f.line([[x,top],[end,top]],steel,2);
    f.line([[x,y(v.layer)],[end,y(v.layer)]],'#876c50',1);
    f.line([[x,y(v.water)],[end,y(v.water)]],water,2,[6,4]);
    f.label(end+6,y(v.water)+4,'GVS',water);
    if(kvs<v.water){
      f.line([[x,y(kvs)],[end,y(kvs)]],water,1,[2,4]);
      f.label(end+6,y(kvs)+(y(v.water)-y(kvs)<17?-8:4),'KVS',water);
    }
    f.line([[x,y(v.z)],[end,y(v.z)]],farve.green,2,[2,4]);
    f.dot(end,y(v.z),farve.green,4);
    f.label(end+48,y(v.z)+4,'z',farve.green);
    if(y(v.layer)-top>26) f.label(x+12,(top+y(v.layer))/2+4,'Lag 1');
    if(bottom-y(v.layer)>26) f.label(x+12,(bottom+y(v.layer))/2+4,'Lag 2');
    terrænlast(f,x+12,end-12,top,v.p/100,`Terrænlast p = ${tal(v.p)} kPa`);
    const zone=kvs<v.water?` Kapillarzonen ligger mellem KVS i ${tal(kvs)} m og GVS i ${tal(v.water)} m dybde. Her er jorden vandmættet og poretrykket negativt over GVS.`:' KVS og GVS falder sammen.';
    return `Den grønne linje markerer aflæsningsdybden z = ${tal(v.z)} m.${zone}`;
  },
  rankine(f,v,mode,result){
    const wall=f.w*.27+v.motion*.18, top=68, bottom=f.h-27, end=f.w-18;
    lag(f,wall,top,end-wall,bottom-top,earth);
    f.line([[f.w*.27,top-15],[f.w*.27,bottom]],'#87938b',1,[4,4]);
    f.rect(wall-9,top-14,9,bottom-top+14,steel);
    f.label(12,bottom+18,'Glat væg');
    if(v.motion) pil(f,f.w*.27,top-22,wall,top-22,farve.green);
    terrænlast(f,wall+22,end-15,top,v.p/60,`p = ${tal(v.p)} kPa`);
    const k=result.metrics[3][1], max=1/((1-Math.sin(rad(v.phi)))/(1+Math.sin(rad(v.phi))));
    for(let i=1;i<=4;i++){
      const y=top+(bottom-top)*i/4-7;
      const z=v.z*i/4;
      const share=k*(v.gamma*z+v.p)/(max*(v.gamma*v.z+v.p));
      const arrow=10+(end-wall-30)*share;
      pil(f,wall+arrow,y,wall+2,y,load);
    }
    f.label(wall+18,bottom+18,`e = σ′ₓ = ${tal(result.metrics[2][1])} kPa`,load);
    lodretMaal(f,end-30,top,bottom-7,`z`);
    return `${result.metrics[0][1]}. Den stiplede lodrette linje viser væggens hvileposition. De orange pile viser jordtrykket mod væggen. Nederste pil svarer til z = ${tal(v.z)} m. Væggens flytning er overdrevet i skitsen.`;
  },
  deformation(f,v,mode,result){
    const bottom=f.h-26, top=62, width=Math.min(118,f.w*.28);
    const H=(bottom-top)*v.depth/10;
    const baseline=bottom-H;
    const heights=result.comparison.map(mm=>H*mm/(v.depth*1000));
    const samples=[['Normalkonsolideret',.27,farve.gray],[v.ocr===1?'Valgt · OCR = 1':'Valgt · OCR > 1',.72,load]];
    samples.forEach(([name,pos,color],i)=>{
      const x=f.w*pos-width/2, head=baseline+heights[i];
      lag(f,x,head,width,bottom-head,clay);
      f.rect(x-4,head-4,width+8,4,steel);
      f.line([[x-4,baseline],[x+width+4,baseline]],color,1,[3,3]);
      f.line([[x-3,baseline-4],[x-3,bottom],[x+width+3,bottom],[x+width+3,baseline-4]],steel,2);
      if(v.inc) pil(f,x+width/2,head-8-24*v.inc/200,x+width/2,head-6,color);
      f.label(x+width/2,bottom+17,name,steel,'center');
    });
    f.label(f.w/2,19,`Lasttrin Δσ′ = ${tal(v.inc)} kPa`,load,'center');
    lodretMaal(f,12,baseline,bottom,'Z');
    return `Stive sider holder bredden fast. Den stiplede linje viser prøvens overkant før lasttrinnet. For laget på ${tal(v.depth)} m giver den normalkonsoliderede reference δ = ${tal(result.comparison[0])} mm. Den valgte spændingshistorie giver δ = ${tal(result.comparison[1])} mm.`;
  },
  konsolidering(f,v,mode,result){
    const x=19, right=f.w-83, top=78, bottom=f.h-40;
    const layerHeight=57+(bottom-top-57)*v.depth/10;
    const end=top+layerHeight;
    lag(f,x,top,right-x,layerHeight,clay);
    const relative=result.profile;
    for(let i=0;i<45;i++){
      const slice=i/45, alpha=relative[Math.round(slice*(relative.length-1))][0]/v.p*.75;
      f.rect(x,top+slice*layerHeight,right-x,layerHeight/45+.6,`rgba(55,135,184,${alpha})`);
    }
    f.rect(x,top-7,right-x,7,water);
    f.rect(x,end,right-x,7,mode?water:steel);
    f.label(x,end+23,mode?'Dræn i bund':'Tæt bund');
    f.label(right-4,top-15,'Dræn øverst',water,'right');
    f.label(x,18,`t = ${tal(v.time)} døgn`);
    f.label(right,18,`Terrænlast p = ${tal(v.p)} kPa`,load,'right');
    for(const fraction of [.31,.54,.77]){
      const px=x+(right-x)*fraction;
      pil(f,px,57-(8+21*v.p/150),px,63,load,3.5,10);
    }
    const H=v.depth/(mode+1);
    lodretMaal(f,right+9,top,end,'Z');
    lodretMaal(f,right+37,top,top+layerHeight/(mode+1),'H',water);
    for(const fraction of [.2,.43,.66]){
      const px=x+(right-x)*fraction;
      pil(f,px,top+25,px,top-15,'#fffefa',8,16);
      pil(f,px,top+25,px,top-15,'#084a78',4,12);
      if(mode){
        pil(f,px,end-25,px,end+16,'#fffefa',8,16);
        pil(f,px,end-25,px,end+16,'#084a78',4,12);
      }
    }
    return `Mørkere blåt betyder større poreovertryk Δu i forhold til terrænlasten p. Orange pile viser terrænlasten. Blå pile viser drænretningen. Den længste drænvej H er ${tal(H)} m ved ${mode?'dobbeltsidig':'ensidig'} dræning.`;
  },
  baereevne(f,v,mode,{footing}){
    const {eb,el,width,length}=footing;
    const x=f.w/2, b=(f.w-54)*(.19+.35*v.b/5), top=102, edge=16;
    const bottom=mode?225:f.h-21;
    const left=x-b/2, right=x+b/2, loadX=x+b*eb/v.b;
    const half=b*width/v.b/2;
    const a=loadX-half, z=loadX+half;
    const depth=Math.min(55,(bottom-top)*.52,half*1.9);
    const extent=Math.min(half*1.45,a-edge-5,f.w-edge-z-5);
    const toe=[loadX,top+depth*1.17];
    const fan=(side,start)=>punkter(16,t=>[start+side*extent*t,top+depth*(.9*Math.cos(Math.PI*t/2))]);
    const leftFan=fan(-1,a),rightFan=fan(1,z);
    const boundary=[...leftFan.reverse(),toe,...rightFan];
    lag(f,edge,top,f.w-2*edge,bottom-top,earth);
    f.polygon(boundary,'#47887940');
    f.polygon([[a,top],toe,[z,top]],'#377f6a58');
    f.line(boundary,farve.green,2);
    f.line([[a,top],toe,[z,top]],farve.green,1.5);
    f.rect(left,top-15,b,15,steel);
    f.rect(a,top,2*half,5,farve.green);
    f.line([[x,44],[x,top-15]],farve.gray,1,[4,3]);
    vandretMaal(f,left,right,32,`b = ${tal(v.b)} m`);
    if(eb) vandretMaal(f,Math.min(x,loadX),Math.max(x,loadX),55,'eᵦ');
    pil(f,loadX,61,loadX,top-17);
    f.label(loadX+10,73,'V',load);
    const sideLeft=(edge+left)/2, sideRight=f.w-sideLeft;
    if(v.q) for(const px of [sideLeft,sideRight]) pil(f,px,top-12-v.q/5,px,top-2,farve.blue);
    for(const px of [sideLeft,sideRight]) f.label(px,top+16,'q',farve.blue,'center');
    f.label(x,bottom-9,`Effektiv kontaktbredde i snittet: ${tal(width,2)} m`,steel,'center');
    if(mode){
      const scale=Math.min(124/v.b,88/v.l);
      const planW=v.b*scale, planL=v.l*scale, y=296;
      f.label(18,246,'Set ovenfra');
      f.rect(x-planW/2,y-planL/2,planW,planL,'#dce4df');
      const centerX=x+eb*scale, centerY=y+el*scale;
      f.rect(centerX-width*scale/2,centerY-length*scale/2,width*scale,length*scale,'#87b5a3');
      f.dot(x,y,steel,3);
      f.dot(centerX,centerY,load,4);
      f.label(x+planW/2+8,y+4,'l');
      f.label(x,y+planL/2+16,'b',steel,'center');
    }
    return 'Den grønne kontaktflade og brudzone flytter sig med lastresultanten V. Brudfiguren er skematisk. Ved punktfundament viser planen fundamentsmidten som en mørk prik og lastens angrebspunkt som en orange prik.';
  },
  paele(f,v,mode,{penetration}){
    const x=f.w*.47, y=mode?91:57, bottom=f.h-21, edge=17;
    const b=14+56*v.b, toe=y+(bottom-y)*(.2+.74*v.l/15);
    lag(f,edge,y,f.w-2*edge,bottom-y,mode?earth:clay);
    f.rect(x-b/2,y-10,b,toe-y+10,steel);
    if(mode){
      const hammer=y-27-25*v.h/1.5;
      f.rect(x-b/2-5,hammer,b+10,12,load);
      f.label(x-b/2-12,hammer+10,'G',load,'right');
      lodretMaal(f,x+b/2+12,hammer+12,y-10,'h',load);
      f.line([[x-b/2-6,toe],[x+b/2+6,toe]],steel,1,[3,3]);
      pil(f,x,toe+3,x,Math.min(bottom+4,toe+7+penetration*.62),load);
      f.label(x+12,toe+14,'s',load);
      f.label(edge+8,bottom-7,'Sand');
    }else{
      for(const fraction of [.3,.56,.82]){
        const arrowY=y+fraction*(toe-y);
        for(const side of [-1,1]) pil(f,x+side*(b/2+12),arrowY+6,x+side*(b/2+12),arrowY-8,farve.green);
      }
      pil(f,x,toe+18,x,toe+2,load);
      f.label(x+27,toe+14,'Rᵦ',load);
      f.label(x-b/2-20,y+16,'Rₛ',farve.green,'right');
      f.label(edge+8,bottom-7,'Ler');
    }
    lodretMaal(f,f.w-58,y,toe,'L');
    return mode?'Ramklodsen med tyngde G falder højden h. Pilen ved spidsen markerer den blivende nedsynkning s pr. slag, tegnet forstørret.':'Ved aksialt tryk virker den grønne overflademodstand Rₛ langs pæleskaftet, mens den orange spidsmodstand Rᵦ virker ved pælespidsen.';
  },
  styrke(f,v){
    const x1=f.w*.23, x2=f.w*.74, base=f.h-54;
    const half=Math.min(55,f.w*.16), box=34;
    const slip=12;
    const sample=Math.min(29,f.w*.075), head=base-66+v.load/13;
    lag(f,x1-half,base-box,2*half,box,earth);
    lag(f,x1-half+slip,base-2*box,2*half,box,earth);
    f.line([[x1-half,base-box],[x1+half+slip,base-box]],load,2,[4,3]);
    f.line([[x1-half,base-box],[x1-half,base],[x1+half,base],[x1+half,base-box]],steel,2);
    f.line([[x1-half+slip,base-box],[x1-half+slip,base-2*box],[x1+half+slip,base-2*box],[x1+half+slip,base-box]],steel,2);
    pil(f,x1,base-2*box-35,x1,base-2*box-3);
    f.label(x1,base-2*box-43,'σ′ₙ = 50 / 150 kPa',load,'center');
    pil(f,x1+half+slip-26,base-box-13,x1+half+slip-4,base-box-13);
    f.label(x1+half+slip-14,base-box-22,'τf',load,'center');
    f.rect(x2-sample-13,base-94,2*sample+26,101,'#c9e3ec');
    lag(f,x2-sample,head,2*sample,base-head,clay);
    f.rect(x2-sample-2,head-5,2*sample+4,5,steel);
    f.rect(x2-sample-2,base,2*sample+4,5,steel);
    pil(f,x2,head-13-27*v.load/100,x2,head-7);
    f.label(x2+11,base-92,'σ′₁',load);
    const pressureArrow=12+15*v.s3/130;
    pil(f,x2-sample-pressureArrow,base-25,x2-sample-2,base-25,water);
    pil(f,x2+sample+pressureArrow,base-25,x2+sample+2,base-25,water);
    f.label(x2+sample+7,base-33,'σ′₃',water);
    f.label(x1+3,base+30,'Skæreboks',steel,'center');
    f.label(x2,base+30,'Triaksialprøve',steel,'center');
    return 'I skæreboksen viser den lodrette pil den effektive normalspænding σ′ₙ på brudplanet. Den holdes ved 50 kPa i det ene forsøg og 150 kPa i det andet. Den vandrette pil viser forskydningsspændingen τf ved brud. I triaksialforsøget påvirker hovedspændingerne prøven aksialt og fra siden. De viste flytninger er skematiske.';
  },
  saetninger(f,v){
    const x=f.w*.48, left=16, right=f.w-18, top=57;
    const maxDepth=v.z1+v.z2;
    const scale=Math.min((right-left-42)/(v.b+maxDepth),(f.h-top-24)/maxDepth);
    const zY=z=>top+z*scale;
    const bottom=zY(maxDepth), width=v.b*scale;
    lag(f,left,top,right-left,zY(v.z1)-top,earth);
    lag(f,left,zY(v.z1),right-left,bottom-zY(v.z1),clay);
    const leftAt=z=>x-width/2-z*scale/2;
    const rightAt=z=>x+width/2+z*scale/2;
    f.polygon([[leftAt(0),top],[rightAt(0),top],[rightAt(maxDepth),bottom],[leftAt(maxDepth),bottom]],'#3d8d7040');
    for(const [start,depth] of [[0,v.z1],[v.z1,v.z2]]){
      for(let i=0;i<v.n;i++){
        const z=start+depth*i/v.n, mid=z+depth/(2*v.n);
        if(z>0) f.line([[leftAt(z),zY(z)],[rightAt(z),zY(z)]],farve.green,1,[2,4]);
        f.dot(x,zY(mid),farve.green,2.2);
      }
    }
    f.line([[leftAt(0),top],[leftAt(maxDepth),bottom]],farve.green,2);
    f.line([[rightAt(0),top],[rightAt(maxDepth),bottom]],farve.green,2);
    f.rect(x-width/2,top-9,width,9,steel);
    pil(f,x,30,x,top-11);
    f.label(x,19,`P = ${tal(v.p)} kN`,load,'center');
    if(zY(v.z1)-top>17) f.label(left+7,top+15,'Øvre lag');
    if(bottom-zY(v.z1)>17) f.label(left+7,zY(v.z1)+15,'Nedre lag');
    f.label(x,bottom+17,'Spredningsbredde B + z',steel,'center');
    return `Lasten P spredes 1:2. Ved dybden z er bredden B + z og længden på tværs af snittet L + z. Prikkerne viser dellagenes midtpunkter, hvor spændingstilvæksten aflæses. B = ${tal(v.b)} m og L = ${tal(v.l)} m.`;
  }
};
