/*
 * The ledger's presentation contract.  These definitions contain no economy
 * logic: a live port adapter only needs to provide the same page-shaped data.
 */
export const LEDGER_TABS=Object.freeze([
 {id:'dock',title:'Dock',icon:{src:'./gfx/ledger/tabs/folio.svg',alt:'Dock'},template:'dock'},
 {id:'tavern',title:'Tavern',icon:{src:'./gfx/ledger/tabs/notes.svg',alt:'Tavern'},template:'tavern'},
 {id:'industries',title:'Industries',icon:{src:'./gfx/ledger/tabs/accounts.svg',alt:'Industries'},template:'industries'},
 {id:'markets',title:'Markets',icon:{src:'./gfx/ledger/tabs/markets.svg',alt:'Markets'},template:'markets'},
 {id:'trades',title:'Trades',icon:{src:'./gfx/ledger/tabs/voyages.svg',alt:'Trades'},template:'trades'},
 {id:'accounts',title:'Accounts',icon:{src:'./gfx/ledger/tabs/accounts.svg',alt:'Accounts'},template:'accounts'}
]);

const heading=path=>({type:'heading',path});
const sectionHeader=(path,icon)=>({type:'sectionHeader',path,icon});
const eyebrow=path=>({type:'eyebrow',path});
const paragraph=path=>({type:'paragraph',path});
const note=path=>({type:'note',path});
const metrics=path=>({type:'metrics',path});
const keyValues=path=>({type:'keyValues',path});
const list=path=>({type:'list',path});
const timeline=path=>({type:'timeline',path});
const chart=path=>({type:'chart',path});
const marketKnowledge=path=>({type:'marketKnowledge',path});
const source=path=>({type:'source',path});
const callout=path=>({type:'callout',path});
const table=(path,columns,interactive=null)=>({type:'table',path,columns,interactive});

export const LEDGER_TEMPLATES=Object.freeze({
 dock:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/folio.svg'),paragraph('summary'),callout('context'),keyValues('facts')],right:[eyebrow('eyebrow'),sectionHeader('summaryTitle','./gfx/ledger/tabs/folio.svg'),metrics('metrics'),table('rows',[{label:'Dock',key:'dock'},{label:'Status',key:'status'},{label:'Ships',key:'ships'}]),note('context')]},
 tavern:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/notes.svg'),paragraph('summary'),list('bulletins'),callout('context')],right:[eyebrow('eyebrow'),sectionHeader('ledgerTitle','./gfx/ledger/tabs/notes.svg'),table('stories',[{label:'Kind',key:'kind'},{label:'Report',key:'report'},{label:'Age',key:'age'}]),note('context')]},
 industries:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/accounts.svg'),paragraph('summary'),metrics('metrics'),list('productionNotes')],right:[eyebrow('eyebrow'),sectionHeader('registerTitle','./gfx/ledger/tabs/accounts.svg'),table('rows',[{label:'Industry',key:'industry'},{label:'Instance',key:'instance'},{label:'Inputs',key:'inputs'},{label:'Outputs',key:'outputs'},{label:'Status',key:'status'}]),note('context')]},
 accounts:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/accounts.svg'),metrics('metrics'),keyValues('facts'),paragraph('summary')],right:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/accounts.svg'),table('rows',[{label:'Account',key:'account'},{label:'Balance',key:'balance',format:'money'},{label:'Status',key:'status'}]),note('context')]},
 trades:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/voyages.svg'),paragraph('summary'),table('rows',[{label:'Time',key:'time'},{label:'Ship',key:'vessel'},{label:'Action',key:'action'},{label:'Goods',key:'goods'},{label:'Quantity',key:'quantity'},{label:'Buyer',key:'buyer'}])],right:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/voyages.svg'),timeline('timeline'),note('context')]},
 markets:{left:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/markets.svg'),paragraph('summary'),table('rows',[{label:'Goods',key:'goods',interactive:'marketCommodity'},{label:'Wanted',key:'wanted'},{label:'Offers',key:'offers'}],'marketCommodity'),sectionHeader('knowledgeTitle','./gfx/ledger/tabs/markets.svg'),marketKnowledge('knowledge')],right:[eyebrow('eyebrow'),sectionHeader('title','./gfx/ledger/tabs/markets.svg'),chart('priceHistory'),source('source'),note('context')]}
});

export const LEDGER_BLOCK_TYPES=Object.freeze(['sectionHeader','eyebrow','heading','paragraph','note','metrics','metric','keyValues','resource','list','timeline','chart','marketKnowledge','source','callout','table','divider']);

export function resolveLedgerPath(source,path){
 if(!path)return source;
 return String(path).split('.').reduce((value,key)=>value==null?undefined:value[key],source);
}

export function formatLedgerValue(value,format='text'){
 if(value==null)return '';
 if(format==='money')return `${Number(value).toFixed(2)} gold`;
 if(format==='integer')return Number(value).toLocaleString('en-US',{maximumFractionDigits:0});
 if(format==='percent')return `${Math.round(Number(value)*100)}%`;
 return String(value);
}
