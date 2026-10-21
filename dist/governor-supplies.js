import {appendPortSupplies,commodityName} from './port-supplies.js?v=babbc3d3950e';
export class GovernorSupplies {
 constructor({parent,getPort,getSupplies,getTraffic}){
  Object.assign(this,{getPort,getSupplies,getTraffic});const el=tag=>document.createElement(tag);
  this.panel=el('section');this.panel.className='governor-supplies';this.panel.setAttribute('aria-label','Governor supply allocation');
  const title=el('strong');title.textContent='Governor supplies';this.stock=el('div');this.commodity=el('select');this.commodity.setAttribute('aria-label','Goods to allocate');
  for(const c of (getPort()?getSupplies(getPort().id):[]).map(s=>s.commodity_id)){const option=el('option');option.value=c;option.textContent=commodityName(c);this.commodity.append(option);}
  this.quantity=el('input');this.quantity.type='number';this.quantity.min='0.1';this.quantity.step='0.1';this.quantity.value='10';this.quantity.setAttribute('aria-label','Quantity to allocate');
  this.toConsumption=el('button');this.toConsumption.textContent='To consumption';this.toTrade=el('button');this.toTrade.textContent='To trade';this.status=el('p');this.status.setAttribute('role','status');
  this.toConsumption.onclick=()=>this.move('TRADE');this.toTrade.onclick=()=>this.move('CONSUMPTION');
  this.panel.append(title,this.stock,this.commodity,this.quantity,this.toConsumption,this.toTrade,this.status);parent.append(this.panel);this.refresh();
 }
 move(fromPool){
  const port=this.getPort(),quantity=Number(this.quantity.value),commodity=this.commodity.value;if(!port||!Number.isFinite(quantity)||quantity<=0){this.status.textContent='Enter a quantity greater than zero.';return;}
  this.pending=true;this.refresh();this.getTraffic().allocateSupplies(port.id,commodity,quantity,fromPool,result=>{
   this.pending=false;this.status.textContent=result.ok?`Moved ${quantity} units of ${commodityName(commodity).toLowerCase()} at ${port.name}.`:({INSUFFICIENT_SUPPLIES:'Not enough available goods. Held trade materials cannot be moved.',TEST_ENDED:'Start a ship test to allocate supplies.'}[result.error.code]??'Could not move supplies. Check the quantity.');this.refresh();
  });
 }
 refresh(){
  const p=this.getPort(),traffic=this.getTraffic(),live=!!traffic?.worker;this.panel.hidden=!p;if(!p)return;
  const supplies=this.getSupplies(p.id),key=JSON.stringify([p.id,live,supplies]);
  if(key!==this.key){this.key=key;this.stock.replaceChildren();appendPortSupplies(this.stock,supplies);if(p.id!==this.portId){this.portId=p.id;this.status.textContent='';}}
  this.toConsumption.disabled=this.toTrade.disabled=!live||!!this.pending;
  if(live&&this.live===false)this.status.textContent='';this.live=live;
  if(!live)this.status.textContent='Start a ship test to allocate supplies. Values shown are initial stock.';
 }
}
