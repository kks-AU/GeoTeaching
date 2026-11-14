const farve = {green:'#216958',blue:'#14649a',orange:'#a64a25',gold:'#b17b19',gray:'#657775',soil:'#ead7ac',clay:'#c7ad91'};
const tal = (n, digits=1) => n.toLocaleString('da-DK',{maximumFractionDigits:digits});
const punkter = (count, fn) => Array.from({length:count+1},(_,i)=>fn(i/count));
const rad = d => d * Math.PI / 180;

function figur(canvas) {
  const {width:w,height:h} = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(w*scale);
  canvas.height = Math.round(h*scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale,scale);
  ctx.font = '12px system-ui';
  function line(points,color,width=2,dash=[]) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    points.slice(1).forEach(point=>ctx.lineTo(...point));
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function label(x,y,str,color='#213d37',align='left') {
    ctx.fillStyle=color;
    ctx.textAlign=align;
    ctx.fillText(str,x,y);
  }
  function rect(x,y,width,height,color) {
    ctx.fillStyle=color;
    ctx.fillRect(x,y,width,height);
  }
  function dot(x,y,color,r=4) {
    ctx.beginPath();
    ctx.arc(x,y,r,0,2*Math.PI);
    ctx.fillStyle=color;
    ctx.fill();
  }
  function polygon(points,color) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    points.slice(1).forEach(point=>ctx.lineTo(...point));
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
  }
  return {w,h,line,label,rect,dot,polygon};
}

function diagram(f,{xMin=0,xMax,yMax,xLabel,yLabel,down=false,profile=false,equal=false}) {
  const left=profile?86:56, top=30, bottom=f.h-44;
  const width=f.w-left-15, height=bottom-top;
  const span=xMax-xMin;
  const unit=Math.min(width/span,height/yMax);
  const xs=equal?unit:width/span, ys=equal?unit:height/yMax;
  const x=v=>left+(v-xMin)*xs;
  const y=v=>down?top+v*ys:bottom-v*ys;
  for(let i=0;i<=4;i++){
    const a=xMin+span*i/4, b=yMax*i/4;
    f.line([[x(a),y(0)],[x(a),y(yMax)]],'#e0e6da',1);
    f.line([[x(xMin),y(b)],[x(xMax),y(b)]],'#e0e6da',1);
    f.label(x(a),bottom+18,tal(a,2),'#52645e','center');
    f.label(left-7,y(b)+4,tal(b,2),'#52645e','right');
  }
  if(xMin<0) f.line([[x(0),y(0)],[x(0),y(yMax)]],'#61736e',1,[3,3]);
  f.line([[left,y(yMax)],[left,y(0)],[x(xMax),y(0)]],'#61736e',1);
  f.label(left,17,yLabel);
  f.label(f.w-14,f.h-5,xLabel,'#213d37','right');
  return {x,y,plot:(points,color,dash)=>f.line(points.map(([a,b])=>[x(a),y(b)]),color,2.6,dash),
    dot:(a,b,color)=>f.dot(x(a),y(b),color)};
}

function mohr(f,{phi,c,hi,lo,points=[],extra=0}) {
  const m=(hi+lo)/2, r=(hi-lo)/2;
  const max=Math.max(60,hi*1.14,extra);
  const g=diagram(f,{xMax:max,yMax:Math.max(max*.43,r*1.2,c+max*Math.tan(phi)+8),
    xLabel:'Effektiv normalspænding σ′ (kPa)',yLabel:'Forskydningsspænding τ (kPa)',equal:true});
  g.plot([[0,c],[max,c+max*Math.tan(phi)]],farve.orange);
  g.plot(punkter(120,t=>[m+r*Math.cos(Math.PI*t),r*Math.sin(Math.PI*t)]),farve.green);
  g.dot(hi,0,farve.green);
  g.dot(lo,0,farve.green);
  points.forEach(([x,y])=>g.dot(x,y,farve.blue,5));
  if(Math.abs(r-(m*Math.sin(phi)+c*Math.cos(phi)))<1e-6){
    g.dot(m-r*Math.sin(phi),r*Math.cos(phi),farve.orange);
  }
}

function soejler(f,items,unit) {
  const max=Math.max(1,...items.map(item=>item[1]))*1.1;
  const left=16, width=f.w-32;
  items.forEach(([name,val,color],i)=>{
    const y=25+i*(Math.min(88,(f.h-25)/items.length));
    f.label(left,y,name);
    f.rect(left,y+10,width,26,'#e9ede4');
    f.rect(left,y+10,(width-84)*val/max,26,color);
    f.label(f.w-22,y+28,`${tal(val)} ${unit}`,'#213d37','right');
  });
}

function jordprofil(f,g,lag,water,max) {
  lag.forEach(([start,end,color])=>f.rect(5,g.y(start),29,g.y(end)-g.y(start),color));
  if(water!==null){
    f.rect(5,g.y(water),29,g.y(max)-g.y(water),'#1477b030');
    f.line([[5,g.y(water)],[34,g.y(water)]],farve.blue,2);
    f.label(5,g.y(water)-4,'GVS',farve.blue);
  }
}

function forside(canvas) {
  const f=figur(canvas), x=f.w, y=f.h;
  f.rect(4,y*.22,x-8,y*.2,'#e9d1a2');
  f.rect(4,y*.42,x-8,y*.25,'#c5a784');
  f.rect(4,y*.67,x-8,y*.25,'#8eaa9d');
  for(let i=0;i<140;i++){
    const px=8+(i*47)%(x-16), py=y*.23+(i*61)%(y*.67);
    f.dot(px,py,'#254b4640',i%3+0.5);
  }
  f.line([[4,y*.52],[x-4,y*.52]],'#e6f7ff',2,[5,5]);
  f.rect(x*.24,y*.16,x*.52,y*.06,'#f8f3df');
  f.line([[x*.24,y*.22],[x*.07,y*.92]],'#fff4cb',2);
  f.line([[x*.76,y*.22],[x*.93,y*.92]],'#fff4cb',2);
}
