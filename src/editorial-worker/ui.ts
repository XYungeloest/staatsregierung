function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function renderStudioHtml(csrfToken: string, editorEmail: string): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="editorial-csrf" content="${escapeHtml(csrfToken)}">
  <title>Redaktionsstudio · Ostdeutscher Freistaat</title>
  <link rel="stylesheet" href="/redaktion/styles.css">
</head>
<body>
  <header class="studio-header">
    <div><span class="eyebrow">Intern · geschützt</span><h1>Redaktionsstudio</h1></div>
    <p>Angemeldet als <strong>${escapeHtml(editorEmail)}</strong></p>
  </header>
  <main class="studio-shell">
    <aside class="studio-sidebar" aria-label="Inhaltsauswahl">
      <label for="type-filter">Inhaltstyp</label>
      <select id="type-filter"></select>
      <label for="content-search">Inhalte suchen</label>
      <input id="content-search" type="search" placeholder="Titel oder Slug">
      <button id="new-content" type="button">Neuen Inhalt anlegen</button>
      <ul id="content-list" class="content-list"></ul>
    </aside>
    <section class="studio-editor" aria-live="polite">
      <div id="status" class="status" hidden></div>
      <header class="editor-heading"><div><span class="eyebrow" id="editor-type"></span><h2 id="editor-title">Inhalt auswählen</h2></div></header>
      <form id="editor-form" hidden novalidate>
        <div id="field-container" class="field-grid"></div>
        <div class="editor-actions">
          <button id="preview-change" type="submit">Änderung prüfen</button>
        </div>
      </form>
      <section id="review" hidden>
        <h3>Prüfvorschau</h3>
        <div class="review-grid"><div><h4>Betroffene Dateien</h4><ul id="affected-files"></ul></div><div><h4>Betroffene Seiten</h4><ul id="affected-routes"></ul></div></div>
        <div id="workflow-preview"></div>
        <h4>Diff</h4><pre id="diff-output" tabindex="0"></pre>
        <label for="change-title">Titel des Pull Requests</label>
        <input id="change-title" required maxlength="180">
        <button id="submit-change" type="button">Als Entwurf einreichen</button>
      </section>
    </section>
  </main>
  <script src="/redaktion/app.js" defer></script>
</body>
</html>`;
}

export const studioStyles = `
:root{font-family:Jost,system-ui,sans-serif;color:#10253e;background:#eef3f6;line-height:1.45}*{box-sizing:border-box}body{margin:0}.studio-header{display:flex;justify-content:space-between;align-items:end;gap:2rem;padding:1.2rem 2rem;background:#fff;border-bottom:4px solid #155a78}.studio-header h1{margin:.1rem 0;font-size:1.75rem}.studio-header p{margin:0}.eyebrow{color:#155a78;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.studio-shell{display:grid;grid-template-columns:minmax(240px,320px) 1fr;min-height:calc(100vh - 94px)}.studio-sidebar{padding:1.5rem;background:#dfe9ee;border-right:1px solid #b9cad3}.studio-sidebar label,.studio-editor label{display:block;font-weight:700;margin:.9rem 0 .35rem}.studio-sidebar input,.studio-sidebar select,.studio-editor input,.studio-editor select,.studio-editor textarea{width:100%;padding:.7rem;border:1px solid #8099a8;border-radius:3px;background:#fff;color:inherit;font:inherit}.studio-sidebar button,.studio-editor button{margin-top:1rem;padding:.7rem 1rem;border:0;border-radius:3px;background:#155a78;color:#fff;font:inherit;font-weight:700;cursor:pointer}.studio-editor button.secondary{background:#4d6675}.content-list{list-style:none;padding:0;margin:1rem 0}.content-list button{display:block;width:100%;margin:.25rem 0;padding:.65rem;text-align:left;background:#fff;color:#10253e;border-left:4px solid transparent}.content-list button[aria-current=true]{border-left-color:#0b7048;background:#f5fffa}.studio-editor{padding:1.5rem 2rem;max-width:1100px}.editor-heading{display:flex;justify-content:space-between}.editor-heading h2{margin:.15rem 0 1rem}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.field{padding:1rem;background:#fff;border:1px solid #cad6dc;border-radius:4px}.field--wide{grid-column:1/-1}.field label{margin:0 0 .35rem}.field small{display:block;color:#4d5f69;margin:.35rem 0}.field textarea{min-height:8rem;font-family:ui-monospace,monospace}.field select[multiple]{min-height:10rem}.list-tools{display:flex;gap:.5rem;align-items:end}.list-tools input{width:6rem}.list-tools button{margin:0;padding:.55rem}.editor-actions{display:flex;justify-content:end}.status{padding:1rem;margin-bottom:1rem;border-left:5px solid #155a78;background:#fff}.status.error{border-color:#a12727;color:#711}.status.success{border-color:#0b7048;color:#064}.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}#review{margin-top:1.5rem;padding:1rem;background:#fff;border-top:4px solid #0b7048}pre{padding:1rem;max-height:32rem;overflow:auto;background:#10253e;color:#f5f8fa;white-space:pre-wrap}.reshuffle-row{display:grid;grid-template-columns:repeat(5,1fr) auto;gap:.5rem;padding:.7rem 0;border-bottom:1px solid #cad6dc}.reshuffle-row button{margin:0;background:#8a2f2f}.comparison{width:100%;border-collapse:collapse}.comparison th,.comparison td{padding:.5rem;text-align:left;border-bottom:1px solid #cad6dc}@media(max-width:800px){.studio-header{align-items:start;flex-direction:column}.studio-shell{display:block}.studio-sidebar{border-right:0}.field-grid,.review-grid{display:block}.field{margin-bottom:1rem}.reshuffle-row{grid-template-columns:1fr}}
`;

export const studioClientScript = `
(() => {
  'use strict';
  const state = { bootstrap:null, options:null, type:null, slug:null, value:null, preview:null, media:[] };
  const byId = (id) => document.getElementById(id);
  const csrf = document.querySelector('meta[name="editorial-csrf"]').content;
  const status = (message, kind='') => { const box=byId('status'); box.hidden=false; box.className='status '+kind; box.textContent=message; };
  const clearStatus = () => { byId('status').hidden=true; };
  async function api(path, options={}) {
    const response = await fetch('/redaktion/api/'+path, { ...options, headers:{ ...(options.body ? {'content-type':'application/json','x-editorial-csrf':csrf} : {}), ...(options.headers||{}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Die Anfrage ist fehlgeschlagen.');
    return body;
  }
  function getPath(object, path) { return path.split('.').reduce((value,key) => value?.[key], object); }
  function setPath(object, path, value) { const keys=path.split('.'); let cursor=object; keys.slice(0,-1).forEach(key => cursor=cursor[key] ||= {}); cursor[keys.at(-1)] = value; }
  function optionList(target) { const key=target==='ministry'?'ministries':target+'s'; return state.options?.[key] || []; }
  function renderField(field) {
    const wrapper=document.createElement('div'); wrapper.className='field '+(['textarea','sortable-list','object-list','reference-list','image'].includes(field.type)?'field--wide':'');
    const label=document.createElement('label'); label.htmlFor='field-'+field.name.replaceAll('.','-'); label.textContent=field.label+(field.required?' *':''); wrapper.append(label);
    if(field.description || field.help){ const small=document.createElement('small'); small.textContent=field.description||field.help; wrapper.append(small); }
    const current=getPath(state.value,field.name);
    let input;
    if(field.type==='boolean'){ input=document.createElement('input'); input.type='checkbox'; input.checked=Boolean(current); }
    else if(field.type==='textarea'){ input=document.createElement('textarea'); input.value=current||''; }
    else if(field.type==='enum' || field.type.endsWith('-reference')){
      input=document.createElement('select');
      const values=field.enumValues || optionList(field.referenceTarget||field.type.replace('-reference',''));
      input.append(new Option('Bitte auswählen',''));
      values.forEach(item=>input.append(new Option(item.label,item.value)));
      input.value=current||'';
    } else if(field.type==='reference-list') {
      input=document.createElement('select'); input.multiple=true;
      const values=optionList(field.referenceTarget||'topic');
      values.forEach(item=>{ const option=new Option(item.label,item.value); option.selected=(current||[]).includes(item.value); input.append(option); });
    } else if(['sortable-list','object-list'].includes(field.type)) {
      input=document.createElement('textarea'); input.value=JSON.stringify(current||[],null,2);
      const tools=document.createElement('div'); tools.className='list-tools';
      const index=document.createElement('input'); index.type='number'; index.min='1'; index.value='1'; index.setAttribute('aria-label','Listeneintrag');
      const up=document.createElement('button'); up.type='button'; up.textContent='↑';
      const down=document.createElement('button'); down.type='button'; down.textContent='↓';
      const move=(direction)=>{ try{const list=JSON.parse(input.value);const from=Number(index.value)-1,to=from+direction;if(to<0||to>=list.length)return;[list[from],list[to]]=[list[to],list[from]];index.value=String(to+1);input.value=JSON.stringify(list,null,2);}catch{status('Die Liste enthält noch kein gültiges JSON.','error');} };
      up.onclick=()=>move(-1); down.onclick=()=>move(1); tools.append(index,up,down); wrapper.append(input,tools);
    } else if(field.type==='image') {
      input=document.createElement('select'); input.append(new Option('Kein Bild',''));
      (state.options?.images||[]).forEach(item=>input.append(new Option(item.label,item.value))); if(current && ![...input.options].some(option=>option.value===current))input.append(new Option(current,current)); input.value=current||'';
      const upload=document.createElement('input'); upload.type='file'; upload.accept='image/jpeg,image/png,image/webp,image/avif'; upload.dataset.uploadFor=field.name; wrapper.append(input,upload);
    } else { input=document.createElement('input'); input.type=field.type==='date'?'date':field.type==='datetime'?'datetime-local':field.type==='number'?'number':'text'; input.value=current??''; }
    input.id='field-'+field.name.replaceAll('.','-'); input.dataset.field=field.name; input.dataset.fieldType=field.type; if(field.required) input.required=true;
    if(!wrapper.contains(input)) wrapper.append(input);
    return wrapper;
  }
  function renderReshuffle(definition){
    state.value ||= {effectiveDate:'',governmentSlug:state.options.governments[0]?.value||'',summary:'',changes:[]};
    const container=byId('field-container'); container.replaceChildren();
    ['effectiveDate','governmentSlug','summary'].forEach(name=>{
      const field=name==='effectiveDate'?definition.fields[0]:name==='governmentSlug'?definition.fields[1]:{name:'summary',label:'Zusammenfassung',type:'textarea',required:true};
      container.append(renderField(field));
    });
    const rows=document.createElement('div'); rows.className='field field--wide'; rows.innerHTML='<h3>Neue Ressortzuweisungen</h3><div id="reshuffle-rows"></div>';
    const add=document.createElement('button'); add.type='button'; add.textContent='Zuordnung ergänzen'; add.onclick=()=>{state.value.changes.push({ministrySlug:'',personSlug:'',officeSlug:state.options.offices.find(o=>o.canLeadMinistry)?.value||'',title:'',sortOrder:100,sourceRefs:['redaktionsstudio-v2']});renderRows();}; rows.append(add); container.append(rows); renderRows();
  }
  function renderRows(){
    const holder=byId('reshuffle-rows'); if(!holder)return; holder.replaceChildren();
    state.value.changes.forEach((change,index)=>{
      const row=document.createElement('div'); row.className='reshuffle-row';
      [['ministrySlug','ministries'],['personSlug','persons'],['officeSlug','offices']].forEach(([key,source])=>{const select=document.createElement('select');select.setAttribute('aria-label',key);select.append(new Option('Bitte auswählen',''));state.options[source].filter(o=>key!=='officeSlug'||o.canLeadMinistry).forEach(o=>select.append(new Option(o.label,o.value)));select.value=change[key];select.onchange=()=>change[key]=select.value;row.append(select);});
      const title=document.createElement('input');title.placeholder='Amtsbezeichnung';title.value=change.title;title.oninput=()=>change.title=title.value;row.append(title);
      const sort=document.createElement('input');sort.type='number';sort.value=change.sortOrder;sort.oninput=()=>change.sortOrder=Number(sort.value);row.append(sort);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Entfernen';remove.onclick=()=>{state.value.changes.splice(index,1);renderRows();};row.append(remove);holder.append(row);
    });
  }
  function collectForm(){
    if(state.type==='cabinet-reshuffle'){
      document.querySelectorAll('[data-field]').forEach(input=>{if(['effectiveDate','governmentSlug','summary'].includes(input.dataset.field))setPath(state.value,input.dataset.field,input.type==='checkbox'?input.checked:input.value);});
      return state.value;
    }
    const value=structuredClone(state.value||{});
    document.querySelectorAll('[data-field]').forEach(input=>{
      let fieldValue;
      if(input.type==='checkbox') fieldValue=input.checked;
      else if(input.multiple) fieldValue=[...input.selectedOptions].map(option=>option.value);
      else if(['sortable-list','object-list'].includes(input.dataset.fieldType)){try{fieldValue=JSON.parse(input.value);}catch{throw new Error('Das Feld „'+input.dataset.field+'“ enthält ungültiges JSON.');}}
      else if(input.dataset.fieldType==='number') fieldValue=input.value===''?undefined:Number(input.value);
      else fieldValue=input.value||undefined;
      setPath(value,input.dataset.field,fieldValue);
    });
    return value;
  }
  async function prepareUploads(){
    state.media=[];
    for(const upload of document.querySelectorAll('input[type="file"][data-upload-for]')){
      const file=upload.files?.[0]; if(!file) continue;
      const imageField=upload.dataset.uploadFor;
      const altField=imageField.endsWith('.image')?imageField.slice(0,-5)+'imageAlt':imageField==='bild'?'bildAlt':'imageAlt';
      const creditField=imageField.endsWith('.image')?imageField.slice(0,-5)+'imageCredit':imageField==='bild'?'bildnachweis':'imageCredit';
      const altInput=document.querySelector('[data-field="'+altField+'"]'); const creditInput=document.querySelector('[data-field="'+creditField+'"]');
      const alt=altInput?.value||''; const form=new FormData();form.append('file',file);form.append('alt',alt);
      const response=await fetch('/redaktion/api/media-check',{method:'POST',headers:{'x-editorial-csrf':csrf},body:form});const checked=await response.json();if(!response.ok)throw new Error(checked.error||'Das Bild konnte nicht geprüft werden.');
      const select=document.querySelector('select[data-field="'+imageField+'"]');if(![...select.options].some(option=>option.value===checked.publicPath))select.append(new Option(checked.publicPath,checked.publicPath));select.value=checked.publicPath;
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      state.media.push({name:file.name,type:file.type,alt,credit:creditInput?.value||'',contentBase64:btoa(binary)});
    }
  }
  async function listContent(){
    const type=state.type; const response=await api('list?type='+encodeURIComponent(type)); const query=byId('content-search').value.toLowerCase(); const list=byId('content-list'); list.replaceChildren();
    response.items.filter(item=>(item.label+' '+item.slug).toLowerCase().includes(query)).forEach(item=>{const li=document.createElement('li');const button=document.createElement('button');button.type='button';button.textContent=item.label;button.dataset.slug=item.slug;button.setAttribute('aria-current',String(item.slug===state.slug));button.onclick=()=>loadContent(item.slug);li.append(button);list.append(li);});
  }
  async function selectType(type){
    clearStatus(); state.type=type;state.slug=null;state.preview=null;byId('review').hidden=true;const definition=state.bootstrap.registry.find(item=>item.id===type);byId('editor-type').textContent=definition.label;byId('editor-title').textContent=definition.description;
    if(definition.mode==='workflow'){state.value=null;byId('editor-form').hidden=false;renderReshuffle(definition);}else{byId('editor-form').hidden=true;byId('field-container').replaceChildren();}
    await listContent();
  }
  async function loadContent(slug){
    clearStatus(); const response=await api('content?type='+encodeURIComponent(state.type)+'&slug='+encodeURIComponent(slug));state.slug=slug;state.value=response.value;state.preview=null;byId('review').hidden=true;const definition=state.bootstrap.registry.find(item=>item.id===state.type);byId('editor-title').textContent=response.label||slug;const container=byId('field-container');container.replaceChildren();definition.fields.forEach(field=>container.append(renderField(field)));byId('editor-form').hidden=false;await listContent();
  }
  function createNew(){const definition=state.bootstrap.registry.find(item=>item.id===state.type);if(definition.mode!=='collection'){status('Dieser Inhaltstyp ist eine einzelne Datei oder ein geführter Vorgang.','error');return;}state.slug=null;state.value={};byId('editor-title').textContent='Neuer Inhalt';const container=byId('field-container');container.replaceChildren();definition.fields.forEach(field=>container.append(renderField(field)));byId('editor-form').hidden=false;byId('review').hidden=true;}
  async function preview(event){event.preventDefault();clearStatus();try{await prepareUploads();state.value=collectForm();const response=await api('preview',{method:'POST',body:JSON.stringify({type:state.type,slug:state.slug,value:state.value,expectedBaseSha:state.bootstrap.baseSha,media:state.media})});state.preview=response;byId('affected-files').replaceChildren(...response.files.map(path=>{const li=document.createElement('li');li.textContent=path;return li;}));byId('affected-routes').replaceChildren(...response.routes.map(route=>{const li=document.createElement('li');const a=document.createElement('a');a.href=state.bootstrap.publicSiteOrigin+route;a.target='_blank';a.rel='noopener';a.textContent=route;li.append(a);return li;}));byId('diff-output').textContent=response.diff;byId('change-title').value='Redaktion: '+(byId('editor-title').textContent||state.type);const workflow=byId('workflow-preview');workflow.replaceChildren();if(response.workflowPreview){const table=document.createElement('table');table.className='comparison';table.innerHTML='<thead><tr><th>Ressort</th><th>Bisher</th><th>Neu</th></tr></thead>';const body=document.createElement('tbody');response.workflowPreview.forEach(row=>{const tr=document.createElement('tr');[row.ministryName,row.beforePersonName||'unbesetzt',row.afterPersonName].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});body.append(tr);});table.append(body);workflow.append(table);}byId('review').hidden=false;status('Die Änderung ist fachlich gültig. Bitte Diff und betroffene Seiten prüfen.','success');}catch(error){status(error.message,'error');}}
  async function submit(){if(!state.preview)return;try{const response=await api('submit',{method:'POST',body:JSON.stringify({type:state.type,slug:state.slug,value:state.value,expectedBaseSha:state.preview.baseSha,title:byId('change-title').value,media:state.media})});status('Draft Pull Request wurde '+(response.updated?'aktualisiert':'erstellt')+': '+response.pullRequestUrl,'success');state.bootstrap.baseSha=response.baseSha||state.bootstrap.baseSha;}catch(error){status(error.message,'error');}}
  async function init(){try{const [bootstrap,options]=await Promise.all([api('bootstrap'),api('options')]);state.bootstrap=bootstrap;state.options=options;const select=byId('type-filter');bootstrap.registry.forEach(item=>select.append(new Option(item.label,item.id)));select.onchange=()=>selectType(select.value);byId('content-search').oninput=()=>listContent();byId('new-content').onclick=createNew;byId('editor-form').onsubmit=preview;byId('submit-change').onclick=submit;await selectType(select.value);}catch(error){status(error.message,'error');}}
  init();
})();
`;
