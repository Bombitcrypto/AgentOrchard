'use strict';
const { expect } = require('chai');
const hre = require('hardhat');

const REGISTRY = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const SEC_DAY = 86400;

describe('AgentOrchard — BNB Mainnet logic (local EVM, NO testnet deploy)', function () {
  let app, registry, alice, bob;
  beforeEach(async () => {
    await hre.network.provider.send('hardhat_reset', []);
    [, alice, bob] = await hre.ethers.getSigners();
    const mockFactory = await hre.ethers.getContractFactory('MockAgentID');
    const fake = await mockFactory.deploy();
    await fake.waitForDeployment();
    const runtime = await hre.ethers.provider.getCode(await fake.getAddress());
    await hre.network.provider.send('hardhat_setCode', [REGISTRY, runtime]);
    registry = await hre.ethers.getContractAt('MockAgentID', REGISTRY);
    await registry.setBalance(alice.address, 1);
    app = await (await hre.ethers.getContractFactory('AgentOrchard')).deploy();
    await app.waitForDeployment();
  });
  async function advanceDays(days) {
    await hre.network.provider.send('evm_increaseTime', [days * SEC_DAY]);
    await hre.network.provider.send('evm_mine', []);
  }
  it('rejects a wallet that does not directly hold Agent ID', async () => {
    await expect(app.connect(bob).checkIn()).to.be.revertedWithCustomError(app, 'AgentIDRequired');
    await expect(app.connect(bob).plant(0)).to.be.revertedWithCustomError(app, 'AgentIDRequired');
  });
  it('one check-in per UTC day; rewards and streak increase on consecutive days', async () => {
    await expect(app.connect(alice).checkIn()).to.emit(app, 'CheckIn');
    await expect(app.connect(alice).checkIn()).to.be.revertedWithCustomError(app, 'OneCheckinPerDay');
    let f = await app.farmers(alice.address);
    expect(f.streak).to.equal(1n); expect(f.seeds).to.equal(1n);
    await advanceDays(1); await app.connect(alice).checkIn();
    await advanceDays(1); await app.connect(alice).checkIn();
    f = await app.farmers(alice.address);
    expect(f.streak).to.equal(3n);
    expect(f.bestStreak).to.equal(3n);
    expect(f.seeds).to.equal(2n);
    expect(f.water).to.equal(3n);
    expect(await app.totalCheckIns()).to.equal(3n);
    await advanceDays(2); await app.connect(alice).checkIn();
    f = await app.farmers(alice.address);
    expect(f.streak).to.equal(1n); expect(f.bestStreak).to.equal(3n);
  });
  it('uses real resources; needs 3 distinct tending days before a harvest', async () => {
    await app.connect(alice).checkIn();
    await expect(app.connect(alice).plant(2)).to.emit(app, 'TreePlanted');
    const id = 1;
    await expect(app.connect(alice).tend(id)).to.emit(app, 'TreeTended');
    await expect(app.connect(alice).tend(id)).to.be.revertedWithCustomError(app, 'AlreadyTended');
    await expect(app.connect(bob).tend(id)).to.be.revertedWithCustomError(app, 'AgentIDRequired');
    await expect(app.connect(alice).harvest(id)).to.be.revertedWithCustomError(app, 'TreeNotReady');
    for (let day = 0; day < 2; day++) {
      await advanceDays(1);
      await app.connect(alice).checkIn();
      await app.connect(alice).tend(id);
    }
    await expect(app.connect(alice).harvest(id)).to.emit(app, 'FruitHarvested');
    const f = await app.farmers(alice.address);
    expect(f.mangoes).to.equal(3n);
    expect(await app.totalHarvests()).to.equal(1n);
    await expect(app.connect(alice).harvest(id)).to.be.revertedWithCustomError(app, 'TreeNotReady');
    expect(await app.getTrees(alice.address)).to.deep.equal([1n]);
  });
  it('mints a locked ERC-721 streak badge with valid on-chain JSON+SVG', async () => {
    for (let i = 0; i < 3; i++) {
      if (i) await advanceDays(1);
      await app.connect(alice).checkIn();
    }
    await expect(app.connect(alice).mintBadge(1)).to.emit(app, 'Locked').withArgs(1n);
    expect(await app.ownerOf(1)).to.equal(alice.address);
    expect(await app.balanceOf(alice.address)).to.equal(1n);
    expect(await app.locked(1)).to.equal(true);
    expect(await app.supportsInterface('0xb45a3c0e')).to.equal(true);
    await expect(app.connect(alice).mintBadge(1)).to.be.revertedWithCustomError(app, 'AlreadyMinted');
    await expect(app.connect(alice).transferFrom(alice.address, bob.address, 1)).to.be.revertedWithCustomError(app, 'Soulbound');
    const metadataURI = await app.tokenURI(1);
    expect(metadataURI).to.match(/^data:application\/json;base64,/);
    const json = JSON.parse(Buffer.from(metadataURI.split(',')[1], 'base64').toString());
    expect(json.name).to.contain('First Roots');
    expect(json.image).to.match(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(json.image.split(',')[1], 'base64').toString()).to.include('AGENT ORCHARD');
  });
  it('cannot mint the 7 or 14 day badge with a 3-day streak', async () => {
    for (let i = 0; i < 3; i++) {
      if (i) await advanceDays(1);
      await app.connect(alice).checkIn();
    }
    await expect(app.connect(alice).mintBadge(2)).to.be.revertedWithCustomError(app, 'StreakTooShort');
    await expect(app.connect(alice).mintBadge(3)).to.be.revertedWithCustomError(app, 'StreakTooShort');
  });
});
