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
    if(model.extraFigure) model.drawTime(figur(find(model.extraFigure)),result);
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
    const refresh=[];
    [...model.controls,...(model.modeControls?.[mode]??[])].forEach(control=>{
      const {id,label,min,max,step,unit,options}=control;
      if(options){
        row.innerHTML=`<label for="in-${id}">${label}</label><select id="in-${id}">${options.map((option,i)=>`<option value="${i}">${option}</option>`).join('')}</select>`;
        const select=row.querySelector('select');
        select.value=values[id];
        select.addEventListener('change',()=>{
          values[id]=Number(select.value);
          refresh.forEach(update=>update());
          render();
        });
        inputs.append(row);
        return;
      }
      const row=document.createElement('div');
      row.className='control';
      row.innerHTML=`<label for="in-${id}">${label}<output class="value" for="in-${id}"></output></label>
        <input type="range" id="in-${id}" min="${min}" max="${max}" step="${step}" value="${values[id]}">`;
      const slider=row.querySelector('input'), output=row.querySelector('output');
      const update=()=>{
        row.hidden=model.visibleControl?.(id,values)===false;
        const bounds=model.bounds?.[id]?.(values,mode);
        slider.min=bounds?.min??min;
        slider.max=bounds?.max??max;
        slider.value=values[id];
        output.value=format(values[id],unit,3);
        slider.setAttribute('aria-valuetext',output.value);
      };
      refresh.push(update);
      slider.addEventListener('input',()=>{
        values[id]=slider.valueAsNumber;
        model.updateValues?.(values,mode);
        refresh.forEach(update=>update());
        render();
      });
      inputs.append(row);
    });
    refresh.forEach(update=>update());
  }

  (model.modes??[]).forEach((label,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.setAttribute('aria-pressed',String(index===0));
    button.addEventListener('click',()=>{
      mode=index;
      model.updateValues?.(values,mode);
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
