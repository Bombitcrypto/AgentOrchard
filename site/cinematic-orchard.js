/**
 * Agent Orchard v2.5 — cinematic illustrated garden presentation.
 * Uses locally bundled, approved premium art. Adds atmospheric parallax,
 * moving pollen, foliage glints and visual watering effects without any
 * transaction, RPC call, wallet access or change to on-chain state.
 * The existing procedural WebGL scene remains available on demand.
 */
(function(global) {
'use strict';
const SRC_W=1672, SRC_H=941;
const reduced=global.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp=(a,b,t)=>a+(b-a)*t;
const fract=x=>x-Math.floor(x);
const rnd=n=>fract(Math.sin(n*72.613+13.21)*43758.5453);

class OrchardCinematic {
  constructor(stage,garden) {
    this.stage=stage;
    this.garden=garden;
    this.canvas=stage.querySelector('#cinematicEffects');
    this.ctx=this.canvas.getContext('2d',{alpha:true});
    this.button=stage.querySelector('#sceneMode');
    this.cinematic=true;
    this.waterStart=-1e6;
    this.last=0;
    this.raf=0;
    this.pointer=[0,0];
    this.active=true;
    this.resize=()=>this.size();
    this.onWater=()=>{this.waterStart=performance.now();};
    this.onMove=(e)=>{
      if (reduced||!this.cinematic||(this.morph&&!this.morph.motion)||e.pointerType==='touch') return;
      const r=stage.getBoundingClientRect();
      const nx=(e.clientX-r.left)/Math.max(1,r.width)-.5;
      const ny=(e.clientY-r.top)/Math.max(1,r.height)-.5;
      this.pointer=[nx,ny];
      stage.style.setProperty('--cinema-x',(-nx*10).toFixed(1)+'px');
      stage.style.setProperty('--cinema-y',(-ny*7).toFixed(1)+'px');
    };
    this.onLeave=()=>{
      this.pointer=[0,0];
      stage.style.setProperty('--cinema-x','0px');
      stage.style.setProperty('--cinema-y','0px');
    };
    stage.addEventListener('orchard:water-preview',this.onWater);
    stage.addEventListener('pointermove',this.onMove,{passive:true});
    stage.addEventListener('pointerleave',this.onLeave,{passive:true});
    this.ro=typeof ResizeObserver==='function'?new ResizeObserver(this.resize):null;
    if(this.ro)this.ro.observe(stage);
    else global.addEventListener('resize',this.resize);
    this.size();
    this.morph=typeof global.OrchardMorph==='function'?new global.OrchardMorph(stage):null;
    this.showArt();
    if(!reduced&&this.ctx) this.raf=global.requestAnimationFrame(t=>this.frame(t));
  }
  size(){
    if(!this.ctx)return;
    const r=this.stage.getBoundingClientRect();
    this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);
    this.d=Math.min(global.devicePixelRatio||1,2);
    this.canvas.width=Math.round(this.w*this.d);
    this.canvas.height=Math.round(this.h*this.d);
    // Match the illustration's 114%-size object-fit: contain layer.
    this.s=Math.min(1.14*this.w/SRC_W,1.14*this.h/SRC_H);
    this.ox=(this.w-SRC_W*this.s)/2;
    this.oy=(this.h-SRC_H*this.s)/2;
  }
  isActive(){return this.cinematic;}
  showArt(){
    this.cinematic=true;
    this.stage.classList.add('cinematic-mode');
    if(typeof this.garden.setCinematic==='function')this.garden.setCinematic(true);
    if(this.button){
      this.button.textContent='3D';
      this.button.setAttribute('aria-pressed','false');
      this.button.title='Switch to interactive 3D tree and robot';
    }
  }
  show3D(){
    this.cinematic=false;
    this.stage.classList.remove('cinematic-mode');
    if(typeof this.garden.setCinematic==='function')this.garden.setCinematic(false);
    if(this.button){
      this.button.textContent='ART';
      this.button.setAttribute('aria-pressed','true');
      this.button.title='Return to premium cinematic orchard art';
    }
  }
  toggle(){if(this.cinematic)this.show3D();else this.showArt();}
  frame(now){
    if(this.active&&!global.document.hidden&&this.cinematic&&(!this.morph||this.morph.motion)) this.draw(now);
    this.raf=global.requestAnimationFrame(t=>this.frame(t));
  }
  draw(now){
    const c=this.ctx;
    c.setTransform(1,0,0,1,0,0);
    c.clearRect(0,0,this.canvas.width,this.canvas.height);
    c.setTransform(this.d*this.s,0,0,this.d*this.s,this.d*this.ox,this.d*this.oy);
    // All locations are mapped to original artwork pixels, keeping the effects
    // aligned when the scene is cropped differently on mobile vs desktop.
    const t=now*.001;
    this.pollen(c,t);
    this.leafShimmer(c,t);
    if(now-this.waterStart<4200)this.water(c,t,(now-this.waterStart)/1000);
    this.last=now;
  }
  pollen(c,t){
    for(let i=0;i<22;i++){
      const baseX=250+rnd(i*3)*1290,baseY=70+rnd(i*7+8)*720;
      const x=baseX+Math.sin(t*.48+i*1.3)*(14+rnd(i*3+3)*24);
      const y=baseY-Math.sin(t*.64+i*.67)*19;
      const a=.12+.26*(.5+.5*Math.sin(t*1.3+i*1.1));
      c.beginPath();c.fillStyle=`rgba(255,247,187,${a})`;
      c.shadowColor='rgba(255,233,135,.9)';c.shadowBlur=7;
      c.arc(x,y,1+rnd(i*14)*2,0,Math.PI*2);c.fill();
    }
    c.shadowBlur=0;
  }
  leafShimmer(c,t){
    for(let i=0;i<9;i++){
      const x=795+randDrift(i*31)*420+Math.sin(t*.43+i)*12;
      const y=110+randDrift(i*12+19)*350+Math.cos(t*.63+i)*13;
      const a=.16+.20*(.5+.5*Math.sin(t*2+i));
      c.save();c.translate(x,y);c.rotate(Math.sin(t*.3+i));
      c.strokeStyle=`rgba(253,255,206,${a})`;c.lineWidth=2;c.beginPath();
      c.moveTo(-4,0);c.lineTo(4,0);c.moveTo(0,-4);c.lineTo(0,4);c.stroke();c.restore();
    }
    function randDrift(n){return rnd(n);}
  }
  water(c,t,elapsed){
    const fade=Math.min(1,elapsed/.35,(4.2-elapsed)/.45);
    if(fade<=0)return;
    // Fine cyan droplets over the original water stream.
    // Bezier begins at the real watering-can nozzle and lands at tree roots.
    function curve(u){
      const v=1-u;
      return [v*v*v*802+3*v*v*u*859+3*v*u*u*947+u*u*u*943,
        v*v*v*544+3*v*v*u*556+3*v*u*u*709+u*u*u*718];
    }
    c.save();c.globalAlpha=fade;c.lineCap='round';
    c.shadowColor='#33daff';c.shadowBlur=14;
    for(let j=0;j<3;j++){
      c.beginPath();
      for(let k=0;k<=36;k++){
        const u=k/36,p=curve(u),jitter=Math.sin(u*35+t*13+j*2)*2.4;
        if(k===0)c.moveTo(p[0]+jitter,p[1]);
        else c.lineTo(p[0]+jitter,p[1]);
      }
      c.setLineDash(j===0?[9,16]:[2,22]);
      c.lineDashOffset=-t*(j?100:170)+j*15;
      c.lineWidth=j===0?3.7:1.6;
      c.strokeStyle=j===0?'rgba(202,250,255,.96)':'rgba(33,205,255,.8)';
      c.stroke();
    }
    c.setLineDash([]);c.shadowBlur=6;
    for(let i=0;i<64;i++){
      const u=fract(rnd(i*41)+elapsed*(.27+rnd(i*2)*.2)),p=curve(u);
      const spread=(rnd(i*25)-.5)*(6+u*30);
      const x=p[0]+spread,y=p[1]+(rnd(i*73)-.5)*12;
      c.beginPath();c.fillStyle=i%3?'#a9f5ff':'#f1ffff';
      c.ellipse(x,y,1.6+rnd(i*3)*1.3,2.5+rnd(i*11)*1.4,0,0,Math.PI*2);c.fill();
    }
    for(let i=0;i<31;i++){
      const a=TAU*rnd(i*11+2)+elapsed*3.3;
      const r=rnd(i*5)*78*(.3+.7*fract(elapsed*1.6+i*.27));
      const x=945+Math.cos(a)*r,y=722-Math.abs(Math.sin(a))*(14+rnd(i*2)*40);
      c.beginPath();c.fillStyle=`rgba(192,251,255,${.18+.45*(1-r/90)})`;
      c.arc(x,y,1.5+rnd(i*14)*2.1,0,TAU);c.fill();
    }
    c.restore();
  }
  destroy(){
    this.active=false;cancelAnimationFrame(this.raf);
    this.morph?.destroy();
    this.ro?.disconnect();
    this.stage.removeEventListener('orchard:water-preview',this.onWater);
    this.stage.removeEventListener('pointermove',this.onMove);
    this.stage.removeEventListener('pointerleave',this.onLeave);
    if(!this.ro)global.removeEventListener('resize',this.resize);
  }
}
const TAU=Math.PI*2;
global.OrchardCinematic=OrchardCinematic;
})(globalThis);
