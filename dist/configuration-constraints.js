import {validateSchema} from './catalog-loader.js?v=babbc3d3950e';
const numeric=d=>['number','integer'].includes(d.type);
const argsSchema=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const integerRatio=(a,b)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||b<=0)return false;const ratio=a/b;return Number.isFinite(ratio)&&Math.abs(ratio-Math.round(ratio))<=Math.min(1e-8,Number.EPSILON*32*Math.max(1,Math.abs(ratio)));};
// Fixed implementations only: configuration never supplies executable expressions.
const OPERATORS=Object.freeze({
 less_than_or_equal:{arity:2,numeric:true,args:argsSchema({}),test:([a,b])=>a<=b},
 integer_multiple:{arity:2,numeric:true,args:argsSchema({}),test:([a,b])=>a>=0&&integerRatio(a,b)},
 compatible_timing_intervals:{arity:2,numeric:true,args:argsSchema({mode:{enum:['whole_steps','bounded_step']}}),test:([interval,step],args)=>interval>0&&step>0&&step<=interval&&(args.mode==='bounded_step'||integerRatio(interval,step))},
 mutually_exclusive:{minimumArity:2,boolean:true,args:argsSchema({}),test:values=>values.filter(Boolean).length<=1},
 required_when:{arity:2,args:argsSchema({equals:{},required_value:{}}),test:([condition,target],args)=>condition!==args.equals||target===args.required_value}
});
export const CONFIGURATION_OPERATORS=Object.freeze(Object.keys(OPERATORS));
export function compileConstraint(definition,registry,schema,validateValue){
 validateSchema(definition,schema);const c=structuredClone(definition),operator=OPERATORS[c.operator];
 if(!operator)throw TypeError(c.id+': unknown constraint operator');
 if(new Set(c.setting_ids).size!==c.setting_ids.length)throw TypeError(c.id+': duplicate setting references');
 if(operator.arity&&c.setting_ids.length!==operator.arity||operator.minimumArity&&c.setting_ids.length<operator.minimumArity)throw TypeError(c.id+': invalid operator arity');
 const settings=c.setting_ids.map(id=>registry.get(id));
 if(new Set(settings.map(d=>d.scope)).size!==1)throw TypeError(c.id+': constraints cannot cross application/world scopes');
 if(operator.numeric&&!settings.every(numeric)||operator.boolean&&!settings.every(d=>d.type==='boolean'))throw TypeError(c.id+': incompatible setting types');
 validateSchema(c.args,operator.args,c.id+'.args');
 if(c.operator==='required_when'){validateValue(settings[0],c.args.equals);validateValue(settings[1],c.args.required_value);}
 return {definition:c,scope:settings[0].scope,evaluate:values=>operator.test(c.setting_ids.map(id=>values[id]),c.args)};
}
