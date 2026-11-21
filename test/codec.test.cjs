const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={TextEncoder,crypto:globalThis.crypto};context.globalThis=context;
vm.runInNewContext(fs.readFileSync('site/codec.js','utf8'),context);
const codec=context.OrchardCodec;
test('Keccak matches ERC721 balanceOf canonical selector',()=>{
 assert.equal(codec.keccak256('balanceOf(address)').slice(0,10),'0x70a08231');
});
test('statically ABI encode no-arg checkin and uint8 plant',()=>{
 assert.match(codec.encode('checkIn',[]),/^0x[0-9a-f]{8}$/);
 assert.match(codec.encode('plant',[2]),/^0x[0-9a-f]{8}0{63}2$/);
 assert.throws(()=>codec.encode('plant',[256]));
 assert.throws(()=>codec.encode('tend',[-1]));
});
test('project is configured Mainnet-only, without misleading contract address',()=>{
 const cfg=fs.readFileSync('site/config.js','utf8');
 assert.match(cfg,/CHAIN_ID:\s*56/);
 assert.match(cfg,/CONTRACT:\s*['\"](0x[0-9a-fA-F]{40})?['\"]/);
 assert.doesNotMatch(cfg,/0xCdDC5Fe00349c5594858f145451f254F184fe1e8/);
});
test('source has official Agent ID and no owner/admin fund-handling methods',()=>{
 const solidity=fs.readFileSync('contracts/AgentOrchard.sol','utf8');
 assert.match(solidity,/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F/);
 assert.match(solidity,/function checkIn\(\) external onlyAgent/);
 assert.match(solidity,/function mintBadge\(uint8 tier\) external onlyAgent/);
 assert.match(solidity,/data:application\/json;base64/);
 assert.doesNotMatch(solidity,/function (withdraw|setOwner|transferOwnership)\(/);
});

test('website is Mainnet-only, does not pretend copied prompts are successful transactions',()=>{
 const app=fs.readFileSync('site/app.js','utf8');
 const html=fs.readFileSync('site/index.html','utf8');
 assert.doesNotMatch(app,/initialDemo\s*=/);
 assert.doesNotMatch(app,/localStorage\.setItem\(.*demo/);
 assert.match(app,/eth_getTransactionReceipt/);
 assert.match(app,/eth_estimateGas/);
 assert.match(app,/Agent ID/);
 assert.match(html,/id="txHashInput"/);
 assert.match(html,/id="gasEstimate"/);
 assert.doesNotMatch(html,/onclick=/);
 const ids=new Set([...html.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map(m=>m[1]));
 const referred=[...app.matchAll(/byId\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
 for(const id of referred) assert.ok(ids.has(id),`Missing id: ${id}`);
});

// Fail early if non-ASCII punctuation is accidentally inserted into Solidity string literals.
test('Solidity source uses ASCII-only literals (compiler portability)',()=>{
 const solidity=fs.readFileSync('contracts/AgentOrchard.sol','utf8');
 assert.doesNotMatch(solidity,/[^\x00-\x7F]/,'Unexpected non-ASCII character in Solidity source');
});
