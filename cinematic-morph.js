/**
 * Agent Orchard v2.6: GPU-accelerated illustration motion (2.5D).
 * Preserves the approved high-quality 3D artwork; animates selected image
 * regions (robot head/body/watering can and tree canopy/fruit) with smooth
 * texture deformation. NOT a rigged 3D model and NOT an on-chain action.
 * Optional: safely falls back to the original image when WebGL is unavailable.
 */
(function(global){
'use strict';
const VERT=`
attribute vec2 a_position;
varying vec2 v_screen;
void main(){v_screen=(a_position+1.0)*0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
const FRAG=`
precision highp float;
varying vec2 v_screen;
uniform sampler2D u_art;
uniform vec2 u_stage;
uniform vec2 u_offset;
uniform vec2 u_pointer;
uniform float u_scale;
uniform float u_time;
uniform float u_pour;
uniform float u_motion;
const vec2 IMG=vec2(1672.0,941.0);
const float PI=3.141592653589793;
float blob(vec2 p,vec2 ctr,vec2 radii){
  vec2 v=(p-ctr)/radii;
  float d=dot(v,v);
  return exp(-2.8*d);
}
vec2 rotateLocal(vec2 p,vec2 ctr,float angle){
  vec2 q=p-ctr;float ca=cos(angle),sa=sin(angle);
  return ctr+vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);
}
void main(){
  vec2 pixel=vec2(v_screen.x*u_stage.x,(1.0-v_screen.y)*u_stage.y);
  vec2 p=((pixel-u_offset)/u_scale)/IMG; // top-left normalized artwork space
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) discard;
  vec2 q=p;
  float t=u_time;
  float animate=u_motion;
  float breathing=sin(t*1.9)*animate;
  float treeWind=sin(t*.95)*.68+sin(t*1.62+.7)*.32;
  // Tree canopy flexes at the branches while the lower trunk stays rooted.
  float top=max(0.0,(.78-p.y)/.65);
  float canopy=blob(p,vec2(.63,.34),vec2(.29,.37));
  q.x -= animate*(.0053*treeWind*top*canopy);
  q.y -= animate*(.0019*sin(t*1.17+p.x*13.0)*canopy);
  // Local leaf flutter: keep amplitude under 3px for photorealistic texture.
  q.x += animate*.0010*sin(t*3.3+p.y*71.0+p.x*18.0)*canopy;
  // Fruit clusters nod independently of nearby leaves.
  float fruits=blob(p,vec2(.505,.388),vec2(.055,.078))+
               blob(p,vec2(.63,.295),vec2(.07,.075))+
               blob(p,vec2(.775,.408),vec2(.075,.09));
  q.x-=animate*.0019*sin(t*1.8+p.x*7.0)*min(fruits,1.0);
  // Robot torso, planted feet and face move with separate soft joint zones.
  float torso=blob(p,vec2(.285,.56),vec2(.155,.22));
  q.y+=animate*(.0026*breathing+.0032*u_pour)*torso;
  q.x+=animate*.0020*sin(t*.9+.8)*torso;
  float head=blob(p,vec2(.265,.345),vec2(.142,.16));
  float angle=animate*(.012*sin(t*1.22)+.026*u_pour);
  q=mix(q,rotateLocal(q,vec2(.28,.448),-angle),.9*head);
  q.y+=animate*.0016*sin(t*1.85)*head;
  float can=blob(p,vec2(.405,.535),vec2(.106,.15));
  float canAngle=animate*(.013*sin(t*.8)+.042*u_pour);
  q=mix(q,rotateLocal(q,vec2(.365,.505),-canAngle),min(1.0,can*.9));
  // Interactive parallax is depth-dependent: object regions respond more.
  q.x-=animate*u_pointer.x*(.0037*head+.0048*torso+.0065*canopy);
  q.y-=animate*u_pointer.y*(.0034*head+.0036*torso+.0040*canopy);
  vec4 color=texture2D(u_art,vec2(q.x,1.0-q.y));
  // Moving soft highlights simulate glossy metallic robot and leaf specularity.
  float highlight=sin(t*.85+p.x*18.0-p.y*11.0);
  float metal=blob(p,vec2(.265,.39),vec2(.14,.17))*.022;
  float leafGlow=canopy*.016;
  color.rgb+=animate*max(0.0,highlight)*(metal+leafGlow);
  color.rgb+=animate*.007*u_pour*canopy;
  gl_FragColor=vec4(color.rgb,1.0);
}`;
function compile(gl,type,src){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
    const err=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(err||'WebGL shader error');
  }
  return s;
}
class OrchardMorph{
  constructor(stage){
    this.stage=stage;
    this.layer=stage.querySelector('.cinematic-orchard');
    this.img=this.layer?.querySelector('.cinematic-image');
    this.canvas=stage.querySelector('#cinematicMorph');
    this.reduced=global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motion=!this.reduced;
    this.target=[0,0];this.pointer=[0,0];
    this.waterAt=-1e8;this.active=true;this.frameId=0;this.lastFrame=0;
    this.onWater=()=>{this.waterAt=performance.now();};
    this.onMove=(e)=>{
      const r=stage.getBoundingClientRect();
      if(e.pointerType==='touch'||!this.motion)return;
      this.target=[Math.max(-.5,Math.min(.5,(e.clientX-r.left)/r.width-.5)),
        Math.max(-.5,Math.min(.5,(e.clientY-r.top)/r.height-.5))];
    };
    this.onLeave=()=>{this.target=[0,0];};
    stage.addEventListener('orchard:water-preview',this.onWater);
    stage.addEventListener('pointermove',this.onMove,{passive:true});
    stage.addEventListener('pointerleave',this.onLeave);
    this.ro=global.ResizeObserver?new ResizeObserver(()=>this.size()):null;
    if(this.ro)this.ro.observe(stage);
    else global.addEventListener('resize',this.resize=()=>this.size());
    this.initialize();
  }
  async initialize(){
    if(!this.canvas||!this.img||!this.motion)return;
    try {
      if(!this.img.complete)await new Promise((res,rej)=>{
        this.img.addEventListener('load',res,{once:true});
        this.img.addEventListener('error',rej,{once:true});
      });
      if(!this.img.naturalWidth)return;
      const gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});
      if(!gl){this.installFallback();return;}
      this.gl=gl;
      const program=gl.createProgram();
      gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERT));
      gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FRAG));
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);this.program=program;
      const verts=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,verts);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      this.uniform={};
      for(const name of ['u_stage','u_offset','u_pointer','u_scale','u_time','u_pour','u_motion'])
        this.uniform[name]=gl.getUniformLocation(program,name);
      const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.img);
      gl.uniform1i(gl.getUniformLocation(program,'u_art'),0);
      this.size();this.render(performance.now());
      this.layer.classList.add('cinematic-motion-ready');
      this.frameId=global.requestAnimationFrame(t=>this.frame(t));
      this.canvas.addEventListener('webglcontextlost',e=>{
        e.preventDefault();this.layer.classList.remove('cinematic-motion-ready');
        global.cancelAnimationFrame(this.frameId);
      });
    }catch(err){
      console.warn('Orchard cinematic GPU animation unavailable; image fallback active:',err.message);
      this.layer?.classList.remove('cinematic-motion-ready');
      this.installFallback();
    }
  }
  installFallback(){
    // Gentle separate-domain animation for browsers with WebGL disabled.
    // The base artwork stays visible; small masked shifts add depth without
    // swapping or redrawing the approved robot/tree characters.
    if(!this.motion||!this.layer||this.layer.classList.contains('cinematic-cpu-motion'))return;
    for(const type of ['robot','tree']){
      const layer=this.img.cloneNode(false);
      layer.removeAttribute('id');layer.removeAttribute('fetchpriority');
      layer.setAttribute('aria-hidden','true');layer.alt='';
      layer.className='cinematic-depth-layer cinematic-depth-'+type;
      this.img.insertAdjacentElement('afterend',layer);
    }
    this.layer.classList.add('cinematic-cpu-motion');
  }
  setMotion(on){this.motion=!this.reduced&&!!on;
    if(!this.motion){this.target=[0,0];this.pointer=[0,0];
      this.stage.style.setProperty('--cinema-x','0px');this.stage.style.setProperty('--cinema-y','0px');}
    this.layer?.classList.toggle('cinematic-still',!this.motion);
  }
  size(){
    if(!this.gl)return;
    const rect=this.stage.getBoundingClientRect();this.w=rect.width;this.h=rect.height;
    const d=Math.min(global.devicePixelRatio||1,1.75);
    const w=Math.max(1,Math.round(this.w*d)),h=Math.max(1,Math.round(this.h*d));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
    this.gl.viewport(0,0,w,h);
    const s=Math.min(1.14*this.w/1672,1.14*this.h/941);
    this.s=s;this.ox=(this.w-1672*s)/2;this.oy=(this.h-941*s)/2;
  }
  frame(t){
    if(!this.active)return;
    this.frameId=global.requestAnimationFrame(v=>this.frame(v));
    if(global.document.hidden||!this.gl)return;
    // Limit mobile GPU work without slowing the actual animation clock.
    if(this.w<600&&t-this.lastFrame<30)return;
    this.lastFrame=t;
    this.pointer[0]+=(this.target[0]-this.pointer[0])*.06;
    this.pointer[1]+=(this.target[1]-this.pointer[1])*.06;
    this.render(t);
  }
  render(t){
    const gl=this.gl;if(!gl)return;
    const u=this.uniform;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.u_stage,this.w,this.h);
    gl.uniform2f(u.u_offset,this.ox,this.oy);
    gl.uniform2f(u.u_pointer,this.pointer[0],this.pointer[1]);
    gl.uniform1f(u.u_scale,this.s);
    gl.uniform1f(u.u_time,t*.001);
    const elapsed=(t-this.waterAt)/1000;
    const water=(this.motion&&elapsed>0&&elapsed<4.2)?Math.min(1,elapsed/.45,(4.2-elapsed)/.6):0;
    gl.uniform1f(u.u_pour,water);
    gl.uniform1f(u.u_motion,this.motion?1:0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  destroy(){
    this.active=false;global.cancelAnimationFrame(this.frameId);
    this.ro?.disconnect();if(this.resize)global.removeEventListener('resize',this.resize);
    this.stage.removeEventListener('orchard:water-preview',this.onWater);
    this.stage.removeEventListener('pointermove',this.onMove);
    this.stage.removeEventListener('pointerleave',this.onLeave);
  }
}
global.OrchardMorph=OrchardMorph;
})(globalThis);
