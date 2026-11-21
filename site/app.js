/**
 * Agent Orchard MAINNET frontend — noncustodial, prompt-led, no false login.
 * Adapted from the user's AgentProof ABI/Agentic Wallet prompt architecture.
 * All statistics come from BNB Smart Chain; there is no simulated user state.
 */
(function () {
  'use strict';

  const CONFIG = window.ORCHARD_CONFIG;
  const codec = window.OrchardCodec;
  const byId = id => document.getElementById(id);
  const all = selector => Array.from(document.querySelectorAll(selector));
  const isAddress = value => codec.ADDRESS.test(String(value || '').trim());
  const isHash = value => codec.HASH.test(String(value || '').trim());
  const CONTRACT_READY = isAddress(CONFIG.CONTRACT)
    && !['0xcddc5fe00349c5594858f145451f254f184fe1e8',
      '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
      '0x0000000000000000000000000000000000000000'].includes(CONFIG.CONTRACT.toLowerCase());
  const SPECIES = ['Ruby Apple', 'Sun Orange', 'Golden Mango'];
  const FRUITS = ['🍎', '🍊', '🥭'];
  const FALLBACK = Object.freeze({
    streak: 0, best: 0, totalDays: 0, water: 0, sunlight: 0,
    seeds: 0, apples: 0, oranges: 0, mangoes: 0, xp: 0,
    lastDay: -1, trees: [], badges: [false, false, false, false]
  });

  let garden;
  let chosenTree = 0;
  let farmerAddress = '';
  let verifiedAgent = false;
  let chainState = null;
  let toastTimer = null;
  let stateRequest = 0;
  let robot;
  let cinematic;
  let lastGlobal = null;

  function toast(message, error = false) {
    const el = byId('toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 4300);
  }
  function shorten(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : ''; }
  function todayUtc() { return Math.floor(Date.now() / 86400000); }
  function projectUrl() { return CONFIG.APP_URL || `${location.origin}${location.pathname}`; }
  function bscLink(path) { return `${CONFIG.EXPLORER.replace(/\/$/, '')}/${path}`; }
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast('Copied. Paste only into the official Binance Agentic Wallet environment.');
    } catch (_) {
      toast('Clipboard unavailable. Select the prompt text and copy it manually.', true);
    }
  }
  function setText(id, value) { const node = byId(id); if (node) node.textContent = String(value); }

  function setupPrompt() {
    return `AGENT ORCHARD — CONNECT WITH OFFICIAL BINANCE AGENTIC WALLET

Website: ${projectUrl()}
Read the agent instructions: https://agentorchard.pages.dev/skill.md
BNB Smart Chain Mainnet: 56
Agent ID registry: ${CONFIG.AGENT_ID}
Orchard contract: ${CONFIG.CONTRACT}

I am the owner of this Agentic Wallet. Use only the official Binance Agentic Wallet Skill already built into Binance AI Pro. Check my official session using the skill's current documented commands; if disconnected, start official Binance App authentication. Never present a website-created QR, collect secrets, or pretend this website has logged me in.

After authenticating, report my public BSC (56) wallet address, Agent ID balanceOf address > 0, Developer Mode state/expiration, and BNB gas balance. Check the published Orchard contract source and read my existing game state.

This prompt is READ-ONLY. Do not sign, approve, broadcast, or make any on-chain transaction. Tell me my public wallet address so I can paste it into Agent Orchard and press "I've Connected — Sync My Garden". Reading skill.md or copying this prompt is NOT a website login.`;
  }

  function skillTaskPrompt() {
    return `Read https://agentorchard.pages.dev/skill.md and follow the instructions to participate in Agent Orchard with MY OWN official Binance Agentic Wallet on BNB Mainnet (56). Check my Agent ID, read my on-chain garden, identify today's eligible check-in / watering / harvest / planting / NFT tasks, then PREVIEW the first transaction and ask my explicit separate approval before any execution. Do not execute this message as blanket approval. Return actual verified transaction hashes only.`;
  }

  function transactionPrompt(method, args, data) {
    const printedArgs = args.length ? args.map(String).join(', ') : '(none)';
    return `AGENT ORCHARD — BNB SMART CHAIN MAINNET ACTION REQUEST

Independent project. Not affiliated with Binance. Smart contracts are unaudited.
Website: ${projectUrl()}
Chain ID: 56 (BNB Mainnet)
Orchard CONTRACT TO: ${CONFIG.CONTRACT}
Official Agent ID: ${CONFIG.AGENT_ID}
Function: ${codec.SIGNATURES[method]}
Arguments: ${printedArgs}
Calldata (inputData): ${data}
Transaction value: 0 wei. A small amount of native BNB GAS WILL BE SPENT by my wallet.
${farmerAddress ? `The read-only profile I viewed: ${farmerAddress} — do NOT use this as a replacement for authenticating MY wallet.` : ''}

Perform these steps with the official Binance Agentic Wallet Skill only:
1. Authenticate me in the OFFICIAL Binance environment, using my wallet's OWN authenticated address. No website QR or pairing code, keys or session tokens.
2. Confirm chain 56, Agent ID balanceOf(official-wallet-address) > 0 at ${CONFIG.AGENT_ID}.
3. Run 'baw wallet settings --json'. If Developer Mode is off/expired, STOP and guide me to enable it in the official Binance App.
4. Verify the destination is the published SOURCE-VERIFIED AgentOrchard contract on BscScan; verify the calldata decodes to the function/arguments shown and amount 0 wei.
5. Preview the SINGLE contract call using the current official Skill/CLI interface (including --binanceChainId 56, --to, --inputData and --value 0 where documented). Show full transaction destination, parsed method, estimated gas fee in BNB, account changes and risk signals. No token approvals, withdrawals, transfers, or other transactions are authorized.
6. STOP at preview and ask for my SEPARATE explicit confirmation to execute this exact transaction through the official wallet. Do not treat this prompt as approval to broadcast.
7. After approval and finalized execution, return the actual transaction hash and receipt status. I will verify it on BscScan and sync my garden.

If the official Skill does not support this call, or any parameter differs, STOP. Never guess alternative destination addresses or circumvent security checks.`;
  }

  function ensureReady() {
    if (CONTRACT_READY) return true;
    toast('Mainnet contract not configured. Deploy and verify AgentOrchard, then update site/config.js.', true);
    return false;
  }

  async function rpc(method, params = []) {
    const response = await fetch(CONFIG.RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    if (!response.ok) throw Error(`RPC HTTP ${response.status}`);
    const json = await response.json();
    if (json.error) throw Error(json.error.message || 'RPC error');
    if (!Object.prototype.hasOwnProperty.call(json, 'result')) throw Error('Invalid JSON-RPC response');
    return json.result;
  }
  async function ethCall(to, data) { return rpc('eth_call', [{ to, data }, 'latest']); }
  function word(data, index) {
    const text = String(data || '');
    const start = 2 + index * 64;
    if (!/^0x[0-9a-f]*$/i.test(text) || text.length < start + 64) throw Error('Malformed contract response');
    const value = BigInt(`0x${text.slice(start, start + 64)}`);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Unexpected integer larger than JS safe range');
    return Number(value);
  }
  function decodeIdArray(data) {
    const ptr = word(data, 0) * 2 + 2;
    if (ptr < 2 || ptr > data.length - 64) throw Error('Malformed array offset');
    const count = Number(BigInt(`0x${data.slice(ptr, ptr + 64)}`));
    if (!Number.isSafeInteger(count) || count > 100) throw Error('Unexpected tree count');
    const out = [];
    for (let i = 0; i < count; i++) {
      const slice = data.slice(ptr + 64 + 64 * i, ptr + 128 + 64 * i);
      if (slice.length !== 64) throw Error('Truncated tree ID array');
      out.push(Number(BigInt(`0x${slice}`)));
    }
    return out;
  }
  async function assertMainnetContract() {
    const [chainId, bytecode] = await Promise.all([
      rpc('eth_chainId'), rpc('eth_getCode', [CONFIG.CONTRACT, 'latest'])
    ]);
    if (Number(BigInt(chainId)) !== 56) throw Error('RPC is not BNB Mainnet (56)');
    if (!bytecode || bytecode === '0x') throw Error('No Orchard bytecode at the configured address');
    const registryCall = await ethCall(CONFIG.CONTRACT, codec.encode('agentId', []));
    const returnedRegistry = `0x${registryCall.slice(-40)}`;
    if (returnedRegistry.toLowerCase() !== CONFIG.AGENT_ID.toLowerCase()) {
      throw Error('Configured contract does not reference official Agent ID');
    }
  }

  function formatGas(gas, gasPrice) {
    const wei = gas * gasPrice;
    const int = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 9);
    return `${int}.${frac} BNB`;
  }
  async function estimatedGas(method, args) {
    if (!farmerAddress || !verifiedAgent) return 'Verify your public Agent ID address to estimate gas.';
    const data = codec.encode(method, args);
    try {
      const [estimate, gasPrice] = await Promise.all([
        rpc('eth_estimateGas', [{ from: farmerAddress, to: CONFIG.CONTRACT, value: '0x0', data }]),
        rpc('eth_gasPrice')
      ]);
      return `Estimated network gas: ${formatGas(BigInt(estimate), BigInt(gasPrice))} (variable; wallet gives final quote).`;
    } catch (error) {
      return `Gas estimate unavailable: ${error.message}. The call may revert or RPC may be limited.`;
    }
  }

  function localPreflight(method, args) {
    // Only uses recently read BNB chain data as a UX hint. The actual contract remains authoritative.
    const st = chainState;
    if (!st) return true;
    let error = '';
    const tree = ['tend', 'harvest'].includes(method) ? st.trees.find(t => t.id === args[0]) : null;
    if (method === 'checkIn' && checkedToday()) error = 'Already checked in today (UTC).';
    if (method === 'plant' && st.seeds < 1) error = 'No seeds available. Check in to earn a seed.';
    if (method === 'tend') {
      if (!tree || tree.harvested || tree.care >= 3) error = 'Tree is not available for watering.';
      else if (tree.lastTendedDay === todayUtc()) error = 'This tree was already watered today.';
      else if (st.water < 1 || st.sunlight < 1) error = 'Need 1 water and 1 sunlight to care for this tree.';
    }
    if (method === 'harvest' && (!tree || tree.harvested || tree.care < 3 || todayUtc() < tree.plantedDay + 2)) {
      error = 'This tree is not ready for harvest.';
    }
    if (method === 'mintBadge') {
      const tier = args[0];
      const needed = tier === 1 ? 3 : tier === 2 ? 7 : 14;
      if (st.badges[tier]) error = 'This badge is already minted.';
      else if (st.streak < needed || st.lastDay + 1 < todayUtc()) error = `Need an active ${needed}-day streak to mint this badge.`;
    }
    if (error) { toast(error + ' Refresh Mainnet state if you recently transacted.', true); return false; }
    return true;
  }

  async function prepareAction(method, args = []) {
    if (!ensureReady() || !localPreflight(method, args)) return;
    const data = codec.encode(method, args);
    const titles = {
      checkIn: 'Daily on-chain check-in', plant: 'Plant a fruit tree',
      tend: 'Water and nurture your tree', harvest: 'Harvest fruit',
      mintBadge: 'Mint soulbound streak NFT'
    };
    setText('actionTitle', titles[method]);
    setText('actionDesc', 'Copy the prompt to your authenticated Binance Agentic Wallet. Your wallet must preview the transaction and request your separate approval to broadcast.');
    setText('actionData', `Network: BNB Mainnet (56)\nTo: ${CONFIG.CONTRACT}\nMethod: ${codec.SIGNATURES[method]}\nArgs: ${args.join(', ') || '(none)'}\nValue: 0 BNB\nCalldata: ${data}`);
    byId('actionPrompt').value = transactionPrompt(method, args, data);
    setText('gasEstimate', 'Fetching a live gas estimate…');
    byId('actionDialog').showModal();
    estimatedGas(method, args).then(text => setText('gasEstimate', text));
  }

  function checkedToday() { return Boolean(chainState && chainState.totalDays && chainState.lastDay === todayUtc()); }
  function renderStreakAndBadges(st, active) {
    // Streak rewards reflect the immutable Solidity tiers 3/7/14, not invented rewards.
    const effective = active && st.lastDay + 1 >= todayUtc() ? st.streak : 0;
    const next = [3, 7, 14].find(n => effective < n);
    setText('nextReward', !active ? 'Connect to see' : next ? `${next}-day NFT` : 'All tiers unlocked!');
    setText('streakHint', !active ? 'Verify an Agent ID address to see your on-chain progress.' : effective === 0 && st.totalDays ? 'Your previous streak expired. Check in to restart.' : checkedToday() ? '✓ Today’s on-chain check-in is recorded.' : 'Check in today (UTC) to keep your streak.');
    const weekBase = effective ? Math.floor((effective - 1) / 7) * 7 : 0;
    all('#checkinDays .day-tile').forEach((el, idx) => {
      const day = weekBase + idx + 1;
      const done = active && day <= effective;
      const current = active && day === effective + 1;
      el.classList.toggle('done', done);
      el.classList.toggle('current', current);
      el.classList.toggle('upcoming', !done && !current);
      el.querySelector('b').textContent = `Day ${day}`;
      el.querySelector('span').textContent = done ? '✅' : day % 3 === 0 ? '🎁' : day === 7 || day === 14 ? '🏅' : ['🌱','🌞','🌼','🌿','💧','🌳','🍎'][idx];
    });
    all('#streakTrack span').forEach((el, i) => { const value = [1,3,7,14,14][i]; el.classList.toggle('complete', active && effective >= value); });
    all('#streakTrack i').forEach((el, i) => el.classList.toggle('complete', active && effective >= [3,7,14,14][i]));
    const count = active ? [1,2,3].filter(tier => st.badges[tier]).length : 0;
    setText('badgeCount', active ? count : '—');
    all('#miniBadges span').forEach((el, i) => el.classList.toggle('earned', active && st.badges[i + 1]));
    all('.badge-tile').forEach(el => el.classList.toggle('owned', active && st.badges[Number(el.dataset.tier)]));
  }
  function updateProgress(tree) {
    const care = tree ? tree.care : 0;
    const pct = Math.round(care / 3 * 100);
    setText('harvestPct', `${pct}%`);
    setText('harvestCare', `${care} / 3 care sessions`);
    setText('harvestStatus', tree ? (tree.harvested ? 'Already harvested ✓' : care === 3 && todayUtc() >= tree.plantedDay + 2 ? 'Ready to harvest!' : 'Care once per UTC day') : 'Select an on-chain tree');
    const bar = byId('harvestBar'); if (bar) bar.style.width = `${pct}%`;
  }
  async function refreshGlobalCounters() {
    if (!CONTRACT_READY) return;
    try {
      const [chain, a, b] = await Promise.all([rpc('eth_chainId'), ethCall(CONFIG.CONTRACT, codec.encode('totalCheckIns', [])), ethCall(CONFIG.CONTRACT, codec.encode('totalHarvests', []))]);
      if (Number(BigInt(chain)) !== 56) throw Error('RPC is not BNB Mainnet');
      lastGlobal = {checkins: word(a,0), harvests: word(b,0)};
      setText('communityCheckins', lastGlobal.checkins.toLocaleString('en-US'));
      setText('communityHarvests', lastGlobal.harvests.toLocaleString('en-US'));
      setText('globalStats', `${lastGlobal.checkins} total check-ins · ${lastGlobal.harvests} harvests on contract`);
    } catch(err) {
      setText('globalStats', `Live network counters unavailable: ${err.message}`);
    }
  }
  function addVerifiedActivity(hash) {
    const feed = byId('activityFeed');
    if (!feed) return;
    const empty = feed.querySelector('p'); if (empty) empty.remove();
    const item = document.createElement('div'); item.className = 'activity-item';
    item.append(document.createTextNode('✅ Confirmed BNB Mainnet transaction · '));
    const link = document.createElement('a'); link.href = bscLink('tx/' + hash); link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=shorten(hash) + ' ↗';
    item.append(link); feed.prepend(item);
  }
  function selectedTree() { const trees = chainState?.trees || []; return trees.length ? trees[Math.min(chosenTree, trees.length-1)] : null; }
  function harvestSelected() {
    const tree = selectedTree();
    if (!tree) return toast('No on-chain tree selected. Check in and plant a tree first.', true);
    return prepareAction('harvest', [tree.id]);
  }
  function navigateTo(id) { document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}); }
  function mintNext() {
    if (!chainState) return navigateTo('badges');
    const tier = [1,2,3].find(t => !chainState.badges[t] && chainState.streak >= [0,3,7,14][t] && chainState.lastDay + 1 >= todayUtc());
    if (tier) return prepareAction('mintBadge',[tier]);
    navigateTo('badges'); toast('See NFT unlock requirements below. Your streak and badge ownership come from BNB Mainnet.');
  }
  function displayState() {
    const st = chainState || FALLBACK;
    const active = Boolean(chainState);
    const profileValue = v => active ? v.toLocaleString('en-US') : '—';
    setText('streakValue', profileValue(st.streak)); setText('waterValue', profileValue(st.water));
    setText('sunValue', profileValue(st.sunlight)); setText('seedValue', profileValue(st.seeds));
    setText('xpValue', profileValue(st.xp)); setText('appleCount', profileValue(st.apples));
    setText('orangeCount', profileValue(st.oranges)); setText('mangoCount', profileValue(st.mangoes));
    setText('treeCount', st.trees.length);
    setText('heroCheckin', checkedToday() ? '✓ Checked in today' : '✦ Daily Check-in ↗');
    setText('missionCheck', checkedToday() ? 'DONE ✓' : '+10 XP');
    setText('missionCheckin', checkedToday() ? '✓' : 'GO');
    byId('missionCheckin').setAttribute('aria-label', checkedToday() ? 'Checked in today' : 'Check in for today');
    const demoNext = byId('nextDay'); if (demoNext) demoNext.hidden = true;
    byId('heroCheckin').disabled = active && checkedToday();
    byId('missionCheckin').disabled = active && checkedToday();
    renderStreakAndBadges(st, active);

    const list = byId('ownedTrees');
    list.replaceChildren();
    if (!st.trees.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-text';
      empty.textContent = active ? 'No trees yet. Plant your first seed ✿' : 'Your on-chain trees appear here after you verify your Agent ID wallet.';
      list.append(empty);
    }
    st.trees.forEach(tree => {
      const row = document.createElement('div'); row.className = 'own-tree';
      const art = document.createElement('span'); art.className = 'emoji';
      art.textContent = tree.harvested ? FRUITS[tree.species] : tree.care >= 1 ? '🌿' : '🌱';
      const body = document.createElement('div'); body.className = 'own-content';
      const name = document.createElement('strong'); name.textContent = `${SPECIES[tree.species]} · #${tree.id}`;
      const hint = document.createElement('small');
      const ready = tree.care >= 3 && todayUtc() >= tree.plantedDay + 2;
      hint.textContent = tree.harvested ? 'Harvested ✓' : ready ? 'Ready to harvest' : `${tree.care}/3 care sessions · one per UTC day`;
      body.append(name, hint);
      const button = document.createElement('button');
      button.textContent = tree.harvested ? 'View ↗' : ready ? 'Harvest ↗' : 'Water ↗';
      button.addEventListener('click', () => {
        chosenTree = st.trees.indexOf(tree);
        garden.setTree(tree.species, tree.care);
        displayState();
        if (tree.harvested) return toast('This tree has already been harvested.');
        if (ready) return prepareAction('harvest', [tree.id]);
        prepareAction('tend', [tree.id]);
      });
      if (st.trees.indexOf(tree) === Math.min(chosenTree, st.trees.length - 1)) row.classList.add('selected');
      row.append(art, body, button); list.append(row);
    });
    [1, 2, 3].forEach(tier => {
      const days = tier === 1 ? 3 : tier === 2 ? 7 : 14;
      const button = document.querySelector(`[data-mint="${tier}"]`);
      const minted = st.badges[tier];
      button.disabled = active && minted;
      button.textContent = minted ? 'Minted ✓' : st.streak >= days ? 'Mint NFT ↗' : `Unlock at ${days} days ↗`;
    });
    if (st.trees.length) {
      const selected = st.trees[Math.min(chosenTree, st.trees.length - 1)];
      garden.setTree(selected.species, selected.care);
      garden.setOrchardTrees?.(st.trees,selected.id);
      setText('worldOnchainStatus','LIVE BNB MAINNET · VERIFIED AGENT ID');
      setText('worldOrchardCount',`${st.trees.length} on-chain tree${st.trees.length===1?'':'s'} · viewing #${selected.id}`);
      const stage = selected.harvested ? 4 : selected.care === 0 ? 1 : selected.care === 1 ? 2 : selected.care === 2 ? 3 : 4;
      setText('treeStage', selected.harvested ? 'HARVESTED ✓' : ['','SEED · LEVEL 1','SAPLING · LEVEL 2','GROWING · LEVEL 3','FRUITFUL · LEVEL 4'][stage]);
      setText('treeSubtitle', `${SPECIES[selected.species]} #${selected.id} · ${selected.care}/3 care sessions · drag to rotate`);
      updateProgress(selected);
      all('.growth-stage').forEach(el => el.classList.toggle('active', Number(el.dataset.stage) === stage));
    } else {
      garden.setTree(0, 2);
      garden.setOrchardTrees?.([],null);
      setText('worldOnchainStatus',active?'NO PLANTED TREES YET · MAINNET':(garden?.isWebGL3D?'SCENIC PREVIEW · NO WALLET CONNECTED':'CINEMATIC PREVIEW · WEBGL UNAVAILABLE'));
      setText('worldOrchardCount',active?'Your first tree will appear after a verified planting transaction':'Connect your Agent ID wallet to load your on-chain garden');
      setText('treeStage', 'THE GARDEN AWAITS');
      setText('treeSubtitle', 'Interactive 3D orchard · Verify Agent ID to load your trees');
      updateProgress(null);
      all('.growth-stage').forEach(el => el.classList.remove('active'));
    }
  }

  async function verifyPublicAddress() {
    const value = byId('agentAddress').value.trim();
    if (!isAddress(value)) return toast('Enter an EVM public address (0x plus 40 hex characters).', true);
    setText('verifyResult', 'Verifying on BNB Mainnet…');
    verifiedAgent = false;
    chainState = null;
    farmerAddress = '';
    setText('walletText', 'Connect with Binance');
    displayState();
    try {
      if (!CONTRACT_READY) throw Error('Orchard contract address is not configured');
      await assertMainnetContract();
      const result = await ethCall(CONFIG.AGENT_ID, codec.encode('balanceOf', [value]));
      if (word(result, 0) === 0) {
        setText('verifyResult', '✕ This address does not hold an official Agent ID. No site login was performed.');
        return toast('An official Agent ID is required to play.', true);
      }
      farmerAddress = value;
      verifiedAgent = true;
      try { localStorage.setItem('agent-orchard-public-address', value); } catch (_) { /* storage optional, never session auth */ }
      setText('walletText', `Agent ID: ${shorten(value)}`);
      setText('verifyResult', '✓ Official Agent ID found on chain 56. Read-only profile: this does not authenticate the wallet or authorize transactions.');
      await refreshState();
    } catch (error) {
      setText('verifyResult', `Unable to verify: ${error.message}`);
      toast('Mainnet verification failed. Check contract and RPC configuration.', true);
    }
  }

  async function refreshState() {
    if (!verifiedAgent || !farmerAddress || !CONTRACT_READY) return toast('Verify an Agent ID address first.', true);
    const serial = ++stateRequest;
    setText('syncStatus', 'Syncing BNB Mainnet…');
    try {
      await assertMainnetContract();
      const [raw, idsRaw, checkinsRaw, harvestRaw] = await Promise.all([
        ethCall(CONFIG.CONTRACT, codec.encode('farmers', [farmerAddress])),
        ethCall(CONFIG.CONTRACT, codec.encode('getTrees', [farmerAddress])),
        ethCall(CONFIG.CONTRACT, codec.encode('totalCheckIns', [])),
        ethCall(CONFIG.CONTRACT, codec.encode('totalHarvests', []))
      ]);
      const a = Array.from({ length: 11 }, (_, index) => word(raw, index));
      const ids = decodeIdArray(idsRaw);
      const treeRecords = await Promise.all(ids.map(async id => {
        const row = await ethCall(CONFIG.CONTRACT, codec.encode('trees', [id]));
        return { id, plantedDay: word(row, 1), lastTendedDay: word(row, 2),
          species: word(row, 3), care: word(row, 4), harvested: Boolean(word(row, 5)) };
      }));
      const badges = [false];
      for (let tier = 1; tier <= 3; tier++) {
        badges[tier] = Boolean(word(await ethCall(CONFIG.CONTRACT, codec.encode('earnedBadges', [farmerAddress, tier])), 0));
      }
      if (serial !== stateRequest) return;
      chainState = {
        streak: a[0], best: a[1], totalDays: a[2], water: a[3], sunlight: a[4], seeds: a[5],
        apples: a[6], oranges: a[7], mangoes: a[8], xp: a[9], lastDay: a[2] ? a[10] : -1,
        trees: treeRecords, badges
      };
      setText('globalStats', `${word(checkinsRaw, 0)} total check-ins · ${word(harvestRaw, 0)} harvests on contract`);
      setText('communityCheckins', word(checkinsRaw, 0).toLocaleString('en-US'));
      setText('communityHarvests', word(harvestRaw, 0).toLocaleString('en-US'));
      setText('syncStatus', `✓ Mainnet synced · ${new Date().toLocaleTimeString()}`);
      displayState();
    } catch (error) {
      setText('syncStatus', `Sync failed: ${error.message}`);
      toast('Unable to load on-chain garden: ' + error.message, true);
    }
  }

  async function verifyTransaction() {
    if (!CONTRACT_READY) return ensureReady();
    const hash = byId('txHashInput').value.trim();
    if (!isHash(hash)) return toast('Invalid transaction hash (requires 0x + 64 hex chars).', true);
    setText('txResult', 'Checking transaction on BNB Mainnet…');
    try {
      const [network, tx, receipt] = await Promise.all([
        rpc('eth_chainId'), rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])
      ]);
      if (Number(BigInt(network)) !== 56) throw Error('Wrong RPC chain');
      if (!tx) throw Error('Transaction not found yet');
      if ((tx.to || '').toLowerCase() !== CONFIG.CONTRACT.toLowerCase()) throw Error('Transaction is not to AgentOrchard');
      if (farmerAddress && tx.from.toLowerCase() !== farmerAddress.toLowerCase()) throw Error('Transaction sender does not match viewed wallet');
      if (!receipt) return setText('txResult', 'Transaction broadcast but not confirmed yet. Check BscScan shortly.');
      if (receipt.status !== '0x1') throw Error('Transaction reverted; gas may still have been charged');
      const anchor = document.createElement('a');
      anchor.href = bscLink('tx/' + hash);
      anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.textContent = `✓ Confirmed on chain 56 · ${shorten(hash)} · View BscScan ↗`;
      byId('txResult').replaceChildren(anchor);
      toast('Confirmed transaction detected. Syncing your garden.');
      addVerifiedActivity(hash);
      refreshGlobalCounters();
      if (farmerAddress && verifiedAgent) await refreshState();
    } catch (error) {
      setText('txResult', `Not verified: ${error.message}`);
      toast(error.message, true);
    }
  }

  function waterSelected() {
    robot?.play();
    const trees = chainState?.trees || [];
    if (!trees.length) {
      if (!robot?.enabled) garden.waterTree();
      toast('Robot watering is a visual preview only. Plant an on-chain tree to grow it.');
      return;
    }
    const tree = trees[Math.min(chosenTree, trees.length - 1)];
    if (tree.harvested) return toast('This tree has already been harvested.', true);
    if (!robot?.enabled) garden.waterTree();
    prepareAction('tend', [tree.id]);
  }

  function openWallet() {
    byId('promptBox').value = setupPrompt();
    byId('walletDialog').showModal();
  }

  function initialize() {
    garden = new window.Garden3D(byId('gardenCanvas'));
    cinematic = new window.OrchardCinematic(document.querySelector('.orchard-stage'), garden);
    robot = new window.OrchardRobot(byId('robotActor'), byId('robotWater'), garden);
    byId('promptBox').value = setupPrompt();
    byId('demoAlert').replaceChildren();
    const tag = document.createElement('b');
    tag.textContent = CONTRACT_READY ? 'BNB MAINNET 56' : 'SETUP REQUIRED';
    byId('demoAlert').append(tag, document.createTextNode(CONTRACT_READY
      ? ' — Real on-chain actions cost BNB gas. The website only reads on-chain data and prepares official-wallet prompts; every transaction requires wallet confirmation.'
      : ' — Deploy and source-verify your AgentOrchard contract, then set CONTRACT in config.js. No transactions can be initiated until it is configured.'));
    setText('sidebarNetwork', CONTRACT_READY ? 'MAINNET 56 · ON-CHAIN' : 'MAINNET · NOT CONFIGURED');
    const next = byId('nextDay'); if (next) next.remove();
    byId('connectBtn').addEventListener('click', openWallet);
    byId('openWalletFromConsole').addEventListener('click', openWallet);
    byId('walletPromptAgain').addEventListener('click', openWallet);
    byId('robotReplay').addEventListener('click', () => robot.play());
    byId('missionPlant').addEventListener('click', () => navigateTo('trees'));
    byId('plantNow').addEventListener('click', () => navigateTo('trees'));
    byId('heroHarvest').addEventListener('click', harvestSelected);
    byId('heroMint').addEventListener('click', mintNext);
    byId('heroCheckin').addEventListener('click', () => prepareAction('checkIn'));
    byId('missionCheckin').addEventListener('click', () => prepareAction('checkIn'));
    byId('heroWater').addEventListener('click', waterSelected);
    byId('sceneRain').addEventListener('click', waterSelected);
    byId('sceneRotate').addEventListener('click', () => { if (cinematic?.isActive()) cinematic.show3D(); garden.rotate(); });
    byId('sceneMode').addEventListener('click', () => cinematic?.toggle());
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const motionBtn=byId('sceneMotion');
      motionBtn.disabled=true;motionBtn.setAttribute('aria-pressed','false');
      motionBtn.textContent='▶';motionBtn.title='Animation disabled by your reduced-motion setting';
    }
    byId('sceneMotion')?.addEventListener('click',(e)=>{
      const button=e.currentTarget;
      const next=button.getAttribute('aria-pressed')!=='true';
      button.setAttribute('aria-pressed',String(next));
      button.textContent=next?'❚❚':'▶';
      button.title=next?'Pause scene animation':'Resume scene animation';
      if(cinematic?.isActive())cinematic?.morph?.setMotion(next);
      garden.setMotion?.(next);
    });
    const setView=(mode)=>{
      if(!garden?.isWebGL3D)return;
      cinematic?.show3D();garden.setView?.(mode);
      document.querySelectorAll('.world3d-view').forEach(button=>{
        const active=button.id==={overview:'worldOverview',close:'worldClose',side:'worldSide'}[mode];
        button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
      });
    };
    byId('worldOverview')?.addEventListener('click',()=>setView('overview'));
    byId('worldClose')?.addEventListener('click',()=>setView('close'));
    byId('worldSide')?.addEventListener('click',()=>setView('side'));
    byId('worldZoomIn')?.addEventListener('click',()=>{if(!garden?.isWebGL3D)return;cinematic?.show3D();garden.zoomBy?.(-.12);});
    byId('worldZoomOut')?.addEventListener('click',()=>{if(!garden?.isWebGL3D)return;cinematic?.show3D();garden.zoomBy?.(.12);});
    if(garden?.isWebGL3D){
      cinematic?.show3D();
    }else{
      cinematic?.showArt();
      document.querySelector('.orchard-stage')?.classList.add('world3d-fallback');
      setText('worldOnchainStatus','CINEMATIC FALLBACK · WEBGL UNAVAILABLE');
    }
    byId('copyPrompt').addEventListener('click', () => copy(byId('promptBox').value));
    byId('copySkillTask').addEventListener('click', () => copy(skillTaskPrompt()));
    byId('connectedSync').addEventListener('click', async () => {
      if (!isAddress(byId('agentAddress').value)) {
        setText('verifyResult', 'Paste your PUBLIC BSC wallet address first. The website cannot read your Binance AI Pro session.');
        byId('agentAddress').focus(); return;
      }
      await verifyPublicAddress();
      if (verifiedAgent && byId('walletDialog').open) byId('walletDialog').close();
    });
    byId('verifyAgent').addEventListener('click', verifyPublicAddress);
    byId('copyAction').addEventListener('click', () => copy(byId('actionPrompt').value));
    byId('closeAction').addEventListener('click', () => byId('actionDialog').close());
    byId('syncBtn').addEventListener('click', refreshState);
    byId('verifyTxBtn').addEventListener('click', verifyTransaction);
    all('[data-plant]').forEach(btn => btn.addEventListener('click', () => prepareAction('plant', [Number(btn.dataset.plant)])));
    all('[data-mint]').forEach(btn => btn.addEventListener('click', () => prepareAction('mintBadge', [Number(btn.dataset.mint)])));
    byId('cycleTree').addEventListener('click', () => {
      if (!chainState?.trees.length) return toast('No on-chain trees for this wallet.');
      chosenTree = (chosenTree + 1) % chainState.trees.length;
      displayState();
    });
    all('.nav').forEach(el => el.addEventListener('click', () => {
      all('.nav').forEach(node => node.classList.remove('active'));
      el.classList.add('active');
      setText('crumb', el.textContent.trim().toUpperCase());
    }));
    let saved = ''; try { saved = localStorage.getItem('agent-orchard-public-address'); } catch (_) { /* storage not required */ }
    if (isAddress(saved)) byId('agentAddress').value = saved;
    setText('syncStatus', CONTRACT_READY ? 'Enter public Agent ID address to load the garden' : 'Owner must deploy a verified mainnet contract');
    displayState();
    refreshGlobalCounters();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
