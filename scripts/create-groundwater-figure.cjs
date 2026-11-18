// Rebuild the schematic with: node scripts/create-groundwater-figure.cjs
// Illustrative steady Laplace solution in homogeneous isotropic soil.
// Prescribed upper heads; impermeable sheet pile, sides and bottom.
const fs = require('node:fs');
const path = require('node:path');
const nx=241, ny=73, dx=2.5, split=120, bed=30, toe=50;
const at=(i,j)=>j*nx+i;
const active=(i,j)=>i>=0&&i<nx&&j>=0&&j<ny&&(i<split||j>=bed);
const fixed=(i,j)=>i<split?j===0:j===bed;
const blocked=(i,j,k,l)=>j===l&&Math.min(i,k)===split-1&&j<=toe;
const h=new Float64Array(nx*ny);
for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)h[at(i,j)]=i<split?1:0;
let change=1, iterations=0;
while(change>1e-9&&iterations<30000){
  change=0; iterations++;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if(!active(i,j)||fixed(i,j))continue;
    let sum=0,n=0;
    for(const [k,l] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]])
      if(active(k,l)&&!blocked(i,j,k,l)){sum+=h[at(k,l)];n++;}
    const d=1.9*(sum/n-h[at(i,j)]);h[at(i,j)]+=d;change=Math.max(change,Math.abs(d));
  }
}
if(change>1e-8)throw Error('Head solution did not converge');
// Integrate horizontal Darcy flux upward from the impermeable bottom.
const psi=new Float64Array(nx*ny);
for(let i=0;i<nx-1;i++){
  let q=0;
  for(let j=ny-1;j>=0;j--){
    if(active(i,j)&&active(i+1,j)&&!blocked(i,j,i+1,j))q+=h[at(i,j)]-h[at(i+1,j)];
    psi[at(i,j)]=q;
  }
}
// Marching squares. The head discontinuity across the wall is excluded.
function contours(field,levels,color){
  let out='';
  for(const level of levels){
    let d='';
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-2;i++){
      if(!active(i,j)||!active(i+1,j)||!active(i,j+1)||!active(i+1,j+1))continue;
      if(i===split-1&&j<=toe)continue;
      const corners=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],cross=[];
      for(let k=0;k<4;k++){
        const a=corners[k],b=corners[(k+1)%4],v=field[at(...a)],w=field[at(...b)];
        if((v<level)!==(w<level)){
          const t=(level-v)/(w-v);
          cross.push([20+dx*(a[0]+t*(b[0]-a[0])),70+dx*(a[1]+t*(b[1]-a[1]))]);
        }
      }
      if(cross.length===2)d+=`M${cross[0].map(v=>v.toFixed(2)).join(',')}L${cross[1].map(v=>v.toFixed(2)).join(',')}`;
    }
    out+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" opacity=".9"/>`;
  }
  return out;
}
const q=psi[at(split-1,0)];
const levels=Array.from({length:9},(_,i)=>(i+1)/10);
let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" role="img" aria-labelledby="title desc">
<title id="title">Strømnet omkring en tynd spunsvæg ved en havn</title>
<desc id="desc">Grundvandsspejlet til venstre ligger lige under terræn. Til højre ligger det lavere frie havnevandspejl over havbunden. Blå strømlinjer løber under spunsens fod, og orange kurver viser samme hydrauliske potentiale. Idealiseret stationær strømning i homogen, isotrop jord med fastholdte potentialer.</desc>
<defs><pattern id="soil" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="5" r=".7" fill="#aa9471" opacity=".45"/></pattern></defs>
<rect width="640" height="280" fill="#f5f4ed"/>
<path d="M20 52H320V145H620V250H20Z" fill="#e2cfaa"/>
<path d="M20 52H320V145H620V250H20Z" fill="url(#soil)"/>
<path d="M320 107H620V145H320Z" fill="#b9d8df"/>
<path d="M20 70H320V145H620V250H20Z" fill="#8bb8be" opacity=".13"/>
${contours(h,levels,'#a85b32')}
${contours(psi,Array.from({length:7},(_,i)=>q*(i+1)/8),'#14649a')}
<path d="M20 52H318M322 145H620" fill="none" stroke="#71654f" stroke-width="2"/>
<path d="M20 70H317" stroke="#14649a" stroke-width="2.5" stroke-dasharray="8 4"/>
<path d="M322 107H620" stroke="#14649a" stroke-width="2.5"/>
<path d="M319 33V196" stroke="#34474b" stroke-width="4"/>
<g font-family="system-ui,sans-serif" font-size="12" fill="#172c29">
<text x="24" y="44">Terræn</text><text x="24" y="65">Grundvandsspejl</text>
<text x="395" y="97">Frit vandspejl · havn</text><text x="527" y="160">Havbund</text>
<text x="345" y="32">Tynd spunsvæg</text><path d="M342 36L322 48" stroke="#34474b"/>
<text x="23" y="23" font-size="11" fill="#52645e">IDEALISERET STRØMNET · HAVNEVÆG</text>
<path d="M25 268H55" stroke="#14649a" stroke-width="2"/><text x="63" y="272">Strømlinjer → mod havnen</text>
<path d="M328 268H358" stroke="#a85b32" stroke-width="2"/><text x="366" y="272">Potentialkurver (h = konstant)</text>
</g></svg>`;
fs.writeFileSync(path.join(__dirname,'../assets/emner/grundvand-havn.svg'),svg);
console.log(`Groundwater figure: ${iterations} iterations, residual update ${change.toExponential(2)}, flux ${q.toFixed(4)}.`);
