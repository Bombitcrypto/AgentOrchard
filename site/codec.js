/** AgentProof v0.8 browser ABI codec. No dependencies, secrets, signing, or network calls. */
(function(global){'use strict';
const MASK=(1n<<64n)-1n;
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const RC=[1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
function rot(v,n){return n===0?v:((v<<BigInt(n))|(v>>BigInt(64-n)))&MASK;}
function permute(a){for(const rc of RC){const c=Array.from({length:5},(_,x)=>a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]);const d=c.map((_,x)=>c[(x+4)%5]^rot(c[(x+1)%5],1));for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]^=d[x];const b=Array(25).fill(0n);for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rot(a[x+5*y],ROT[x+5*y]);for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]);a[0]^=rc;}}
function keccak256(input){const data=typeof input==='string'?new TextEncoder().encode(input):new Uint8Array(input);const rate=136, n=Math.ceil((data.length+1)/rate)*rate;const bytes=new Uint8Array(n);bytes.set(data);bytes[data.length]^=1;bytes[n-1]^=128;const state=Array(25).fill(0n);for(let off=0;off<n;off+=rate){for(let j=0;j<rate;j++)state[Math.floor(j/8)]^=BigInt(bytes[off+j])<<BigInt((j%8)*8);permute(state);}let out='0x';for(let j=0;j<32;j++)out+=(Number((state[Math.floor(j/8)]>>BigInt((j%8)*8))&255n)).toString(16).padStart(2,'0');return out;}

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const SIGNATURES=Object.freeze({
 checkIn:'checkIn()', plant:'plant(uint8)', tend:'tend(uint256)',
 harvest:'harvest(uint256)', mintBadge:'mintBadge(uint8)',
 balanceOf:'balanceOf(address)', farmers:'farmers(address)',
 getTrees:'getTrees(address)', trees:'trees(uint256)',
 earnedBadges:'earnedBadges(address,uint8)', agentId:'agentId()',
 totalCheckIns:'totalCheckIns()', totalHarvests:'totalHarvests()'
});
function pad(v){return BigInt(v).toString(16).padStart(64,'0');}
function encodeWord(type,v){
 if(type==='uint256'||type==='uint8'){if(!Number.isSafeInteger(Number(v))||Number(v)<0||(type==='uint8'&&Number(v)>255))throw Error('Invalid unsigned integer');return pad(v);}
 if(type==='bytes32'){if(!HASH.test(v))throw Error('Invalid SHA-256 digest');return v.slice(2).toLowerCase();}
 if(type==='bool'){if(typeof v!=='boolean')throw Error('Invalid review type');return pad(v?1:0);}
 if(type==='address'){if(!ADDRESS.test(v))throw Error('Invalid wallet address');return v.slice(2).toLowerCase().padStart(64,'0');}
 throw Error('Unsupported parameter type');
}
function encode(method,args){
 const signature=SIGNATURES[method];if(!signature)throw Error('Unsupported contract action');
 const typesText=signature.slice(signature.indexOf('(')+1,-1); const types=typesText?typesText.split(','):[];
 if(types.length!==args.length)throw Error('Wrong number of arguments');
 let head='',tail='';
 for(let i=0;i<types.length;i++){
  const type=types[i],v=args[i];
  if(type==='string'){
   if(typeof v!=='string')throw Error('String required');
   const bytes=new TextEncoder().encode(v);if(bytes.length>240)throw Error('Text exceeds contract field limit');
   head+=pad(32*types.length+tail.length/2);
   tail+=pad(bytes.length)+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('').padEnd(Math.ceil(bytes.length/32)*64,'0');
  }else head+=encodeWord(type,v);
 }
 return keccak256(signature).slice(0,10)+head+tail;
}
async function sha256(data){
 const bytes=typeof data==='string'?new TextEncoder().encode(data):data;
 return '0x'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const codec=Object.freeze({encode,sha256,keccak256,SIGNATURES,ADDRESS,HASH});
global.OrchardCodec=codec;
})(globalThis);
