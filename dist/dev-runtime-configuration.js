// Developer-only JSON batches exercise the same transaction protocol as future UI.
export class DevRuntimeConfigurationPanel{
 constructor({requestApplication,requestWorld,restart,cancel,regenerate}){
  const $=id=>document.getElementById(id);let token=0;
  const report=(serial,m)=>{if(serial!==token)return;const diagnostics=(m.diagnostics??[]).map(d=>d.message).join(' '),position=m.position?JSON.stringify(m.position):'';$('runtime-config-status').textContent=`${m.status} · revision ${m.revision??m.activeRevision??'unchanged'} · ${m.activationBoundary??''} ${position} ${diagnostics}`;};
  $('runtime-config-apply').onclick=()=>{const serial=++token;try{const edits=JSON.parse($('runtime-config-edits').value);($('runtime-config-scope').value==='application'?requestApplication:requestWorld)(edits,m=>report(serial,m));}catch(error){report(serial,{status:'rejected',diagnostics:[{message:error.message}]});}};
  $('runtime-config-restart').onclick=()=>{const serial=++token;restart(m=>report(serial,m));};
  $('runtime-config-cancel').onclick=()=>{const serial=++token;cancel($('runtime-config-scope').value,m=>report(serial,m));};
  $('runtime-config-regenerate').onclick=()=>{token++;$('dev-adjust').close();regenerate();};
 }
}
