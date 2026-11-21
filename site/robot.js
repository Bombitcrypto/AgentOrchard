/** Visual-only robot watering scene. Never sends, signs or simulates on-chain transactions. */
(function(global){'use strict';
class OrchardRobot{
  constructor(actor,water,tree){this.actor=actor;this.water=water;this.tree=tree;this.busy=false;this.enabled=!global.matchMedia('(prefers-reduced-motion: reduce)').matches;this.timers=[];this.loop=null;if(this.enabled){this.loop=global.setInterval(()=>{if(document.visibilityState==='visible'&&!this.busy)this.play()},18000);global.setTimeout(()=>this.play(),1350)}}
  later(ms,fn){const t=global.setTimeout(fn,ms);this.timers.push(t)}
  play(){if(!this.enabled||this.busy)return;this.busy=true;
    this.actor?.closest('.orchard-stage')?.dispatchEvent(new CustomEvent('orchard:water-preview'));
    if(this.tree?.isWebGL3D){this.tree.playWatering();this.later(5200,()=>{this.busy=false;});return;}
    this.actor.classList.remove('is-watering','is-leaving','is-entering');this.water.classList.remove('is-active');void this.actor.offsetWidth;this.actor.classList.add('is-entering');
    this.later(970,()=>{this.actor.classList.remove('is-entering');this.actor.classList.add('is-watering')});
    this.later(1320,()=>{this.water.classList.add('is-active');this.tree?.waterTree()});
    this.later(2160,()=>this.tree?.waterTree());
    this.later(3400,()=>{this.water.classList.remove('is-active');this.actor.classList.remove('is-watering')});
    this.later(3850,()=>this.actor.classList.add('is-leaving'));
    this.later(4900,()=>{this.actor.classList.remove('is-leaving');this.busy=false});
  }
  destroy(){if(this.loop)clearInterval(this.loop);this.timers.forEach(clearTimeout)}
}
global.OrchardRobot=OrchardRobot;
})(globalThis);
