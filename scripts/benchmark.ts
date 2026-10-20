import {readFile} from 'node:fs/promises';
import * as core from '../src/core/math.ts';
const fixture=JSON.parse(await readFile(new URL('../compatibility-benchmark.json',import.meta.url),'utf8'));
const EASINGS=['linear','quad','cubic','sin','circle','exp','bounce'];
const live=(v:any):any=>typeof v==='string'&&EASINGS.includes(v)?(core.Easing as any)[v]:Array.isArray(v)?v.map(live):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,live(x)])):v;
const numbers=(v:unknown)=>typeof v==='string'?(/^rgba\((.*)\)$/.exec(v)?.[1]?.split(', ').map(Number)??[NaN]):[v as number];
const compare=(actual:unknown,reference:any)=>{
  if(reference&&typeof reference==='object')return {delta:null,status:'regression',error:`expected an error like "${reference.error}", got ${JSON.stringify(actual)}`};
  if(reference===null)return {delta:0,status:actual===undefined?'match':'regression'};
  const a=numbers(actual),r=numbers(reference);
  const delta=a.length===r.length?Math.max(...a.map((x,i)=>Math.abs(x-r[i]!))):Infinity;
  return {delta,status:delta<=1e-6?'match':'regression'};
};
const results=fixture.results.map((item:any)=>{const fn=item.fn.split('.').reduce((v:any,key:string)=>v[key],core);let actual;try{actual=fn(...live(item.args));}catch(error){return {name:item.name,status:item.reference?.error?'match':'regression',error:(error as Error).message};}return {name:item.name,...compare(actual,item.reference)};});
const summary=results.reduce((s:any,item:any)=>({...s,[item.status]:(s[item.status]||0)+1}),{});
console.log(JSON.stringify({method:'Replay results captured by executing the reference package 4.0.537 from compatibility-benchmark.json; it is not installed or run here. An error reference passes when the call throws.',summary,differences:results.filter((x:any)=>x.status!=='match')},null,2));
if(summary.regression)process.exitCode=1;
