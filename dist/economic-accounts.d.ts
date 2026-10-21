export interface MoneyCommitment {readonly id:string;readonly accountId:string;readonly amountUnits:number;}
export type PaymentInput={accountId:string;amountUnits:number;amount?:number}|{accountId:string;amount:number;amountUnits?:never};
export interface Payment {readonly id:string;readonly payerId:string;readonly credits:readonly {readonly accountId:string;readonly amountUnits:number;readonly amount:number}[];readonly amountUnits:number;readonly amount:number;readonly reason:string;}
export interface PaymentReceipt extends Payment {readonly status:'committed';}
export interface PaymentEffects {apply?:()=>void;rollback?:()=>void;}
export interface AccountSnapshot {readonly id:string;readonly ownerType:string;readonly ownerId:string;readonly balance:number;readonly balanceUnits:number;readonly committedUnits:number;readonly spendableUnits:number;readonly committed:number;readonly spendable:number;readonly active:boolean;}
export interface BatchPaymentReceipt {readonly id:string;readonly payerId:null;readonly debits:readonly {readonly accountId:string;readonly amountUnits:number;readonly amount:number}[];readonly credits:readonly {readonly accountId:string;readonly amountUnits:number;readonly amount:number}[];readonly amountUnits:number;readonly amount:number;readonly reason:string;readonly status:'committed';}
export interface InitializationGrant {readonly accountId:string;readonly ownerType:string;readonly ownerId:string;readonly amountUnits:number;readonly amount:number;readonly reason:string;}
export interface FinancialSnapshot {readonly commitments:readonly MoneyCommitment[];readonly initializing:boolean;readonly openingTotalUnits:number|null;readonly totalUnits:number;readonly initializationTotalUnits:number;readonly changeSinceOpeningUnits:number|null;readonly legacyMutationUnits:Readonly<Record<string,number>>;readonly openingTotal:number|null;readonly initializationTotal:number;readonly total:number;readonly changeSinceOpening:number|null;readonly accounts:readonly AccountSnapshot[];readonly grants:readonly InitializationGrant[];readonly transactions:readonly (PaymentReceipt|BatchPaymentReceipt)[];readonly observerErrors:readonly string[];readonly legacyMutations:Readonly<Record<string,number>>;}
export function accountId(type:string,owner:string):string;
export class EconomicAccounts {
 settlementBatch<T>(commit:()=>T,options?:{allowReservations?:boolean;allowAccountCreation?:boolean}):T;
 hasSettlement(id:string):boolean;
 readonly initializing:boolean;
 readonly observerErrors:string[];
 subscribe(observer:(receipt:PaymentReceipt|BatchPaymentReceipt)=>void):()=>void;
 preparePayment(payer:string,credits:readonly PaymentInput[],options?:{id?:string|null;reason?:string}):Payment;
 inspectPayment(token:Payment):Readonly<Payment & {status:'prepared'|'committed'|'cancelled'}>;
 cancelPayment(token:Payment):Readonly<Payment & {status:'prepared'|'committed'|'cancelled'}>;
 commitPayment(token:Payment,effects?:PaymentEffects):PaymentReceipt;
 pay(payer:string,credits:readonly PaymentInput[],options?:{id?:string|null;reason?:string},effects?:PaymentEffects):PaymentReceipt;
 payMany(debits:readonly PaymentInput[],credits:readonly PaymentInput[],options?:{id?:string|null;reason?:string},effects?:PaymentEffects):BatchPaymentReceipt;
 create(id:string,ownerType:string,ownerId:string,options?:{balance?:number;reason?:string}):AccountSnapshot;
 inspect(id:string):AccountSnapshot;
 sealInitialization():number;
 total():number;
 totalUnits():number;
 legacySet(id:string,balance:number,reason?:string):void;
 bind(object:object,key:string,id:string,reason?:string):void;
 transfer(from:string,to:string,value:number,options?:{id?:string|null;reason?:string}):PaymentReceipt;
 reserve(id:string,accountId:string,amountUnits:number):MoneyCommitment|null;
 inspectReservation(id:string):MoneyCommitment|null;
 releaseReservation(id:string):void;
 settleReservation(id:string,credits:readonly PaymentInput[],options?:{id?:string|null;remainingUnits?:number|null;keepReservation?:boolean;reason?:string},effects?:PaymentEffects):PaymentReceipt;
 sweep(sourceIds:readonly string[],recipientId:string,options?:{reason?:string},effects?:PaymentEffects):BatchPaymentReceipt;
 retire(id:string,recipient:string,effects?:PaymentEffects):void;
 snapshot():FinancialSnapshot;
}
