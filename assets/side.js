const find = id => document.getElementById(id);
const canvas = find('figur');
const {topic} = document.body.dataset;

if(!topic){
  const drawCover=()=>{if(canvas.clientWidth) forside(canvas);};
  new ResizeObserver(drawCover).observe(canvas);
}else{
  const model=models[topic];
  let mode=0;
  const controls=[...model.controls,...(model.modeControls??[]).flat()];
  const defaults=Object.fromEntries(controls.map(c=>[c.id,c.value]));
  const values={...defaults};
  const tabs=find('faner');
  const inputs=find('indstillinger');
  const sketch=find('skitse');

  function format(value,unit,digits){
    return typeof value==='number'?`${tal(value,digits)}${unit?' '+unit:''}`:value;
  }

  function render(){
    if(!canvas.clientWidth) return;
    const result=model.draw(figur(canvas),values,mode);
    find('skitsetekst').textContent=skitser[topic](figur(sketch),values,mode,result);
    find('figurtekst').textContent=result.caption;
    find('resultater').innerHTML=result.metrics.map(([label,value,unit,digits])=>
      `<div class="metric">${label}<strong>${format(value,unit,digits)}</strong></div>`).join('');
    find('kurver').innerHTML=(result.legend??[]).map(([label,color])=>
      `<span><i style="--series:${color}"></i>${label}</span>`).join('');
    const table=result.table;
    find('dellag').hidden=!table;
    if(table){
      find('datatabel').innerHTML=`<thead><tr>${table.heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${
        table.rows.map(row=>`<tr>${row.map(value=>`<td>${typeof value==='number'?tal(value,2):value}</td>`).join('')}</tr>`).join('')
      }</tbody>`;
    }
  }

  function showControls(){
    inputs.replaceChildren();
    [...model.controls,...(model.modeControls?.[mode]??[])].forEach(control=>{
      const {id,label,min,max,step,unit}=control;
      const row=document.createElement('div');
      row.className='control';
      row.innerHTML=`<label for="in-${id}">${label}<output class="value" for="in-${id}"></output></label>
        <input type="range" id="in-${id}" min="${min}" max="${max}" step="${step}" value="${values[id]}">`;
      const slider=row.querySelector('input'), output=row.querySelector('output');
      const update=()=>{
        output.value=format(values[id],unit,3);
        slider.setAttribute('aria-valuetext',output.value);
      };
      update();
      slider.addEventListener('input',()=>{
        values[id]=slider.valueAsNumber;
        update();
        render();
      });
      inputs.append(row);
    });
  }

  (model.modes??[]).forEach((label,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.setAttribute('aria-pressed',String(index===0));
    button.addEventListener('click',()=>{
      mode=index;
      [...tabs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===mode)));
      showControls();
      render();
    });
    tabs.append(button);
  });
  tabs.hidden=!model.modes;

  find('nulstil').addEventListener('click',()=>{
    Object.assign(values,defaults);
    showControls();
    render();
  });
  showControls();
  render();
  new ResizeObserver(render).observe(canvas);
}
