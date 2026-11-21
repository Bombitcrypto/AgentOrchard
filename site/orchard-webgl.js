/*
 * Agent Orchard 2.9 — rebuilt 3D robot mesh and responsive garden.
 * Robot and tree are real lit 3-D meshes with animated joints and foliage.
 * No CDNs, remote models, dependencies, or wallet calls. Visual only.
 * WebGL failure falls back to the previous Canvas2D/SVG scene.
 */
(function(global) {
'use strict';
const LegacyGarden3D = global.Garden3D;
const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const mix = (a,b,t) => a+(b-a)*t;
const ease = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
const rand = n => { let v=Math.sin(n*72.72+10.37)*43291.129; return v-Math.floor(v); };
const V=(x,y,z)=>[x,y,z], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>{const l=len(a)||1;return a.map(v=>v/l);};
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mult(a,b){const r=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[col*4+row]+=a[k*4+row]*b[col*4+k];return r;}
function transform(...mats){return mats.reduce((a,b)=>mult(a,b),I());}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m;}
function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m;}
function Rx(t){const m=I(),c=Math.cos(t),s=Math.sin(t);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function Ry(t){const m=I(),c=Math.cos(t),s=Math.sin(t);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function Rz(t){const m=I(),c=Math.cos(t),s=Math.sin(t);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
function Ra(axis,angle){
 const [x,y,z]=norm(axis),c=Math.cos(angle),s=Math.sin(angle),t=1-c;
 const m=I();
 m[0]=c+x*x*t;m[1]=x*y*t+z*s;m[2]=x*z*t-y*s;
 m[4]=y*x*t-z*s;m[5]=c+y*y*t;m[6]=y*z*t+x*s;
 m[8]=z*x*t+y*s;m[9]=z*y*t-x*s;m[10]=c+z*z*t;
 return m;
}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;}
function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x),m=I();m[0]=x[0];m[4]=x[1];m[8]=x[2];m[1]=y[0];m[5]=y[1];m[9]=y[2];m[2]=z[0];m[6]=z[1];m[10]=z[2];m[12]=-dot(x,eye);m[13]=-dot(y,eye);m[14]=-dot(z,eye);return m;}
function toRGB(hex){const v=parseInt(hex.replace('#',''),16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}
function shader(gl,type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function makeMesh(gl,vertices,normals,indices){
 const data=new Float32Array(vertices.length*2);
 for(let i=0;i<vertices.length/3;i++){for(let j=0;j<3;j++){data[i*6+j]=vertices[i*3+j];data[i*6+j+3]=normals[i*3+j];}}
 const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
 return {vb,ib,count:indices.length};
}
function sphere(gl,lat=17,lon=24){
 const v=[],n=[],idx=[];
 for(let i=0;i<=lat;i++){const a=Math.PI*i/lat;for(let j=0;j<=lon;j++){const b=TAU*j/lon,x=Math.sin(a)*Math.cos(b),y=Math.cos(a),z=Math.sin(a)*Math.sin(b);v.push(x,y,z);n.push(x,y,z);}}
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=i*(lon+1)+j,b=a+lon+1;idx.push(a,a+1,b,b,a+1,b+1);}
 return makeMesh(gl,v,n,idx);
}
// Smooth bevelled hard-surface shell geometry for the upgraded robot.
// Unlike scaled spheres, the panels have broad flat faces and rounded corners.
function roundedPanel(gl, lat=26, lon=40, power=.46){
 const v=[],n=[],idx=[];
 const pw=(t,p)=>Math.sign(t)*Math.pow(Math.abs(t),p);
 for(let i=0;i<=lat;i++){
  const a=-Math.PI/2+i*Math.PI/lat;
  for(let j=0;j<=lon;j++){
   const b=TAU*j/lon, ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   const x=pw(ca,power)*pw(cb,power),y=pw(sa,power),z=pw(ca,power)*pw(sb,power);
   v.push(x,y,z);
   n.push(...norm([pw(ca,2-power)*pw(cb,2-power), pw(sa,2-power), pw(ca,2-power)*pw(sb,2-power)]));
  }
 }
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=i*(lon+1)+j,b=a+lon+1;
  idx.push(a,b,a+1,b,b+1,a+1);
 }
 return makeMesh(gl,v,n,idx);
}
function cylinder(gl,steps=24){
 const v=[],n=[],idx=[];
 for(let i=0;i<=1;i++){const y=i-.5;for(let j=0;j<=steps;j++){const a=j/steps*TAU,x=Math.cos(a),z=Math.sin(a);v.push(x,y,z);n.push(x,0,z);}}
 for(let j=0;j<steps;j++){const a=j,b=j+steps+1;idx.push(a,b,a+1,b,b+1,a+1);}
 const top=v.length/3;v.push(0,.5,0);n.push(0,1,0);
 const bot=v.length/3;v.push(0,-.5,0);n.push(0,-1,0);
 for(let j=0;j<steps;j++){idx.push(top,steps+2+j,steps+1+j);idx.push(bot,j,j+1);}
 return makeMesh(gl,v,n,idx);
}
// A continuous tapered branch avoids the visible rings created by stacked cylinders.
function frustum(gl, rings=10, segments=30){
 const v=[],n=[],idx=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings,r=(1-.56*t);
  for(let i=0;i<=segments;i++){
   const a=TAU*i/segments;
   const bark=1+.022*Math.sin(a*7+t*14)+.014*Math.cos(a*13-t*20);
   const co=Math.cos(a),si=Math.sin(a);
   v.push(co*r*bark,t-.5,si*r*bark);
   n.push(...norm([co,.19,si]));
  }
 }
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
  const a=j*(segments+1)+i,b=a+segments+1;
  idx.push(a,b,a+1,b,b+1,a+1);
 }
 return makeMesh(gl,v,n,idx);
}
function leaf(gl){
 const v=[],n=[],idx=[],segments=8;
 for(let side=0;side<2;side++){
  for(let i=0;i<=segments;i++){
   const t=i/segments,w=Math.sin(Math.PI*t)*.23;
   for(let sign of [-1,1]){v.push(sign*w,t-.5,Math.sin(Math.PI*t)*.10*(1-(sign*sign)*.2)+(side?-.015:.015));n.push(sign*.19,.18,side?-0.96:.96);}
  }
  const start=side*(segments+1)*2;
  for(let i=0;i<segments;i++){const a=start+i*2,b=a+2;if(!side)idx.push(a,a+1,b,b,a+1,b+1);else idx.push(a,b,a+1,b,b+1,a+1);}
 }
 return makeMesh(gl,v,n,idx);
}
function torus(gl){
 const v=[],n=[],idx=[],R=40,r=8;
 for(let i=0;i<=R;i++){let a=i/R*TAU;for(let j=0;j<=r;j++){let b=j/r*TAU,co=Math.cos(b),si=Math.sin(b);v.push((1+.035*co)*Math.cos(a),.035*si,(1+.035*co)*Math.sin(a));n.push(co*Math.cos(a),si,co*Math.sin(a));}}
 for(let i=0;i<R;i++)for(let j=0;j<r;j++){let a=i*(r+1)+j,b=a+r+1;idx.push(a,a+1,b,b,a+1,b+1);}
 return makeMesh(gl,v,n,idx);
}
const vs=`
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uVP;
varying vec3 vNormal;
varying vec3 vPosition;
void main(){
 vec4 world=uModel*vec4(aPosition,1.0);
 vPosition=world.xyz;
 mat3 basis=mat3(uModel);
 vec3 len2=vec3(max(dot(basis[0],basis[0]),.0001),max(dot(basis[1],basis[1]),.0001),max(dot(basis[2],basis[2]),.0001));
 vNormal=normalize(basis*(aNormal/len2));
 gl_Position=uVP*world;
}`;
const fs=`
precision highp float;
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 uColor;
uniform vec3 uEye;
uniform float uGlow;
uniform float uGloss;
uniform float uAlpha;
void main(){
 vec3 n=normalize(vNormal);
 vec3 view=normalize(uEye-vPosition);
 vec3 key=normalize(vec3(-.60,.81,.65));
 vec3 fill=normalize(vec3(.78,.35,-.45));
 float lambert=max(dot(n,key),0.);
 float bounce=max(dot(n,fill),0.);
 float hemi=.5+.5*n.y;
 vec3 h=normalize(key+view);
 float spec=pow(max(dot(n,h),0.),mix(14.,105.,uGloss));
 float fresnel=pow(1.-max(dot(n,view),0.),4.);
 vec3 diffuse=uColor*(.18+.17*hemi+.49*lambert+.10*bounce);
 vec3 reflection=(vec3(1.,1.,.96)*spec*.44+vec3(.25,.62,.77)*fresnel*.12)*uGloss;
 vec3 color=diffuse+reflection+uGlow*(uColor*.29+vec3(.06,.18,.17));
 color=pow(clamp(color,0.,1.),vec3(.90));
 gl_FragColor=vec4(color,uAlpha);
}`;
class OrchardWebGL {
 constructor(canvas,gl){
  this.canvas=canvas;this.gl=gl;this.isWebGL3D=true;this.time=0;this.last=0;this.yaw=-.17;this.zoom=1;
  this.kind=0;this.phase=3;this.targetPhase=3;this.actionStart=-100;
  this.reduced=global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.drag=false;this.cinematicMode=false;this.frame=this.frame.bind(this);
  this.program=program(gl,vs,fs);gl.useProgram(this.program);
  this.loc={aPosition:gl.getAttribLocation(this.program,'aPosition'),aNormal:gl.getAttribLocation(this.program,'aNormal'),model:gl.getUniformLocation(this.program,'uModel'),vp:gl.getUniformLocation(this.program,'uVP'),color:gl.getUniformLocation(this.program,'uColor'),eye:gl.getUniformLocation(this.program,'uEye'),glow:gl.getUniformLocation(this.program,'uGlow'),gloss:gl.getUniformLocation(this.program,'uGloss'),alpha:gl.getUniformLocation(this.program,'uAlpha')};
  this.mesh={sphere:sphere(gl,24,36),panel:roundedPanel(gl),cylinder:cylinder(gl,30),frustum:frustum(gl),leaf:leaf(gl),torus:torus(gl)};
  gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.pointerX=e.clientX;this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointermove',e=>{if(this.drag){this.yaw=clamp(this.yaw+(e.clientX-this.pointerX)*.008,-1.5,1.5);this.pointerX=e.clientX;}});
  this.canvas.addEventListener('pointerup',()=>{this.drag=false;});
  this.canvas.addEventListener('pointercancel',()=>{this.drag=false;});
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;});
  this.canvas.addEventListener('webglcontextrestored',()=>{global.location.reload();});
  this.colors={};
  this.resizeObserver=new ResizeObserver(()=>this.size());this.resizeObserver.observe(this.canvas);this.size();
  this.stage=this.canvas.closest('.orchard-stage');this.stage?.classList.add('orchard-webgl-ready');
  requestAnimationFrame(this.frame);
 }
 size(){
  const rect=this.canvas.getBoundingClientRect();this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);
  const d=Math.min(global.devicePixelRatio||1,this.w<600?1.5:1.8),w=Math.floor(this.w*d),h=Math.floor(this.h*d);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h);}
 }
 color(c){return this.colors[c]||(this.colors[c]=toRGB(c));}
 draw(mesh,m,color,glow=0,alpha=1){
  const gl=this.gl,loc=this.loc,data=this.mesh[mesh];
  gl.bindBuffer(gl.ARRAY_BUFFER,data.vb);gl.vertexAttribPointer(loc.aPosition,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(loc.aPosition);
  gl.vertexAttribPointer(loc.aNormal,3,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(loc.aNormal);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,data.ib);
  gl.uniformMatrix4fv(loc.model,false,m);gl.uniform3fv(loc.color,this.color(color));
  gl.uniform1f(loc.glow,glow);
  const red=parseInt(color.slice(1,3),16),green=parseInt(color.slice(3,5),16),blue=parseInt(color.slice(5,7),16);
  const greenDominant=green>red*1.13&&green>blue*1.08;
  const brownDominant=red>green*1.14&&green>blue*1.10;
  const darkFace=red<50&&green<76&&blue<110;
  gl.uniform1f(loc.gloss,darkFace?.88:greenDominant?.16:brownDominant?.11:(red>180&&green>190&&blue>185)?.62:.38);
  gl.uniform1f(loc.alpha,alpha);
  gl.drawElements(gl.TRIANGLES,data.count,gl.UNSIGNED_SHORT,0);
 }
 ball(parent,x,y,z,sx,sy,sz,color,glow=0,alpha=1){this.draw('sphere',transform(parent,T(x,y,z),S(sx,sy,sz)),color,glow,alpha);}
 panel(parent,x,y,z,sx,sy,sz,color,rot=0,glow=0){this.draw('panel',transform(parent,T(x,y,z),Ry(rot),S(sx,sy,sz)),color,glow);}
 ring(parent,x,y,z,r,yScale,color,glow=0){this.draw('torus',transform(parent,T(x,y,z),S(r,yScale,r)),color,glow);}
 tapRod(parent,a,b,r1,r2,color){
  const dv=sub(b,a),hh=len(dv);if(hh<.0001)return;
  const axis=cross([0,1,0],norm(dv)),an=Math.acos(clamp(dv[1]/hh,-1,1));
  const rot=len(axis)<.0001?(dv[1]<0?Rz(Math.PI):I()):Ra(axis,an);
  const mid=a.map((v,i)=>(v+b[i])/2);
  this.draw('frustum',transform(parent,T(...mid),rot,S(r1,hh,r1)),color);
 }

 rod(parent,a,b,r,color){
  const delta=sub(b,a),height=len(delta);
  if(height<.0001)return;
  const axis=cross([0,1,0],norm(delta)),an=Math.acos(clamp(delta[1]/height,-1,1));
  const rot=len(axis)<.0001?(delta[1]<0?Rz(Math.PI):I()):Ra(axis,an);
  const middle=a.map((v,i)=>(v+b[i])/2);
  this.draw('cylinder',transform(parent,T(...middle),rot,S(r,height,r)),color);
 }
 circle(parent,x,y,z,r,h,color){this.draw('cylinder',transform(parent,T(x,y,z),S(r,h,r)),color);}
 petal(parent,x,y,z,scale,rotY,rotZ,color){
  this.draw('leaf',transform(parent,T(x,y,z),Ry(rotY),Rz(rotZ),S(scale,scale,scale)),color);
 }
 drawGround(){
  this.ball(I(),.1,-.30,0,3.45,.28,1.72,'#46733d');
  this.ball(I(),.1,-.20,0,3.35,.19,1.60,'#80b85c');
  this.ball(I(),.1,-.14,0,3.26,.16,1.52,'#93ca68');
  this.draw('torus',transform(T(.1,-.035,0),S(3.0,.9,1.42)),'#f6dc7a',.28);
  for(let i=0;i<(this.w<600?24:38);i++){
    const a=rand(i*15)*TAU,r=Math.sqrt(rand(i*34))*2.9,x=.1+Math.cos(a)*r,z=Math.sin(a)*r*.45;
    this.ball(I(),x,-.02,z,.03,.04,.036,i%4===0?'#fff8dc':'#5f9a43');
    if(i%5===0){this.petal(I(),x,.065,z,.20,a,.78,'#5c9b49');this.petal(I(),x+.05,.04,z,.16,a+1,-.8,'#9cca63');}
  }
 }
 drawTree(){
  const t=this.time,wind=this.reduced?0:Math.sin(t*.63)*.015;
  const growth=clamp(.22+.78*this.phase/3,.22,1);
  const base=transform(T(1.0,.04,-.05),Rz(wind),S(growth,growth,growth));
  this.ball(base,0,.08,0,.29,.13,.23,'#5b422b');
  // Root flare and taper, visible bark grooves and organic branching.
  const bark='#795133',lightBark='#a97850',shadowBark='#5e412b';
  this.tapRod(base,[0,.05,0],[.09,1.68,0],.265,.115,bark);
  for(let k=0;k<5;k++){
   const a=TAU*k/5+0.2;
   this.tapRod(base,[.01,.15,.01],[Math.cos(a)*.43,-.01,Math.sin(a)*.29],.10,.025,shadowBark);
  }
  for(let k=0;k<5;k++){
   const a=k*TAU/5+.35;
   const z=.09*Math.sin(a),x=.09*Math.cos(a);
   this.tapRod(base,[x,.25,z],[x*.47+.04,1.50,z*.42],.024,.012,k%2?lightBark:shadowBark);
  }
  const branchList=[
   [[.09,1.23,.02],[-.67,2.10,.04],.12],
   [[.10,1.44,0],[.75,2.14,-.06],.13],
   [[.07,1.63,0],[-.21,2.57,-.37],.085],
   [[.10,1.59,0],[.35,2.70,.40],.09],
   [[.08,1.76,0],[.13,3.12,-.07],.075],
   [[.72,2.13,-.04],[1.0,2.55,-.25],.05],
   [[-.64,2.08,.04],[-.90,2.47,.20],.05]
  ];
  for(const [a,b,r] of branchList)this.tapRod(base,a,b,r,r*.38,bark);
  const crowns=[
    [-.14,2.64,-.05,.65],[.57,2.60,0,.61],[-.67,2.47,.16,.56],[.2,2.95,-.40,.52],[-.12,3.05,.40,.51],
    [.18,2.36,.50,.47],[-.20,2.30,-.52,.49],[.82,2.78,-.25,.39],[-.83,2.64,.12,.36]
  ];
  // Subtle inner foliage depth; most visible geometry is separately modelled leaves.
  for(let i=0;i<crowns.length;i++){
   const [x,y,z,r]=crowns[i];this.ball(base,x,y,z,r*.76,r*.51,r*.66,i%3===0?'#246c37':i%3===1?'#34803a':'#2f7837');
  }
  const count=this.w<600?160:290;
  for(let i=0;i<count;i++){
   const k=i%crowns.length,[cx,cy,cz,r]=crowns[k];
   const az=TAU*rand(i*29+14),phi=Math.acos(2*rand(i*37+3)-1),rr=.65+.38*rand(i*17+7);
   const x=cx+Math.sin(phi)*Math.cos(az)*r*rr;
   const y=cy+Math.cos(phi)*r*.78*rr;
   const z=cz+Math.sin(phi)*Math.sin(az)*r*.85*rr;
   const gust=this.reduced?0:Math.sin(t*.84+i*1.21)*.064;
   const col=['#5ba847','#80c45d','#a1d56d','#4f9744','#6ab84d','#91d36b'][i%6];
   this.petal(base,x,y,z,.24+rand(i*9)*.18,az+gust,rand(i*23)*TAU,col);
  }
  if(this.phase>2.88){
    const fruitColors=[['#f14d38','#d73630'],['#f3a22c','#e97c25'],['#ecca47','#f0ad28']][this.kind];
    for(let i=0;i<(this.w<600?14:20);i++){
     const k=(i*7)%crowns.length,[cx,cy,cz,r]=crowns[k],az=TAU*rand(i*17+8);
     const x=cx+r*.72*Math.cos(az),y=cy+(rand(i*13)-.5)*.50,z=cz+r*.75*Math.sin(az);
     const wiggle=this.reduced?0:Math.sin(t*1.2+i)*.010;
     this.rod(base,[x,y+.13,z],[x,y+.04,z],.012,'#5e5230');
     this.ball(base,x,y+wiggle,z,.088,.102,.087,fruitColors[i%2]);
     this.ball(base,x-.036,y+.046,z+.076,.02,.017,.012,'#fff5d3',.16);
     this.petal(base,x+.07,y+.12,z,.15,az,.95,'#5fab42');
    }
  }
 }

 drawRobot(){
  const elapsed=this.time-this.actionStart;
  const active=elapsed>=0&&elapsed<6.45;
  // Full animation state machine: approach -> brake -> pour -> recover -> depart.
  const arrival=active?ease(elapsed/1.38):1;
  const exit=active?ease((elapsed-5.05)/1.32):0;
  const move=active&&(elapsed<1.38||elapsed>5.05);
  const anim=this.reduced?0:1;
  const phase=elapsed*10.1;
  const stride=move?Math.sin(phase)*.25*anim:0;
  const heelL=move?Math.max(0,Math.sin(phase))*anim*.080:0;
  const heelR=move?Math.max(0,-Math.sin(phase))*anim*.080:0;
  const pouring=active&&elapsed>1.8&&elapsed<4.95;
  const liftPour=active?ease((elapsed-1.35)/.55)*(1-ease((elapsed-4.75)/.42)):0;
  const bodyTilt=liftPour*.045;
  const posX=active?mix(-2.30,-1.61,arrival)-exit*.69:-2.30;
  const bob=anim*(Math.sin(this.time*2.4)*.018+(move?Math.abs(stride)*.080:0));
  const base=transform(T(posX,.035+bob,.48),Ry(-.16),Rz(bodyTilt));
  const ceramic='#eef6f7', bright='#ffffff', shade='#c8dade', trim='#7d9ca5', rubber='#30454c';
  const steel='#668995', visor='#101f31', aqua='#64e5ed', softGlow='#ddffff';

  // Armored tapered torso, mechanical waist and back pack.
  this.panel(base,0,.84,-.02,.34,.43,.27,ceramic);
  this.panel(base,0,.86,.205,.27,.35,.08,bright);
  this.panel(base,0,.96,.298,.106,.115,.029,'#02b795',0,.13);
  this.ball(base,0,.977,.327,.048,.047,.015,'#e7ffcb',.34);
  this.ring(base,0,.605,-.04,.24,.115,'#5b7983');
  this.panel(base,0,.58,.04,.24,.13,.20,shade);
  this.panel(base,-.01,1.19,-.15,.31,.33,.16,'#41ad79');
  this.panel(base,-.04,1.15,-.32,.21,.23,.07,'#174b57');
  this.ball(base,-.01,1.17,-.395,.058,.065,.021,aqua,.24);

  // Mechanical legs with dark rubber kneecaps and layered boot soles.
  for(const side of [-1,1]){
   const hip=[side*.185,.53,.0],knee=[side*.21,.32,.07+side*stride*.42],ankle=[side*.20,.12+ (side<0?heelL:heelR),.13+side*stride*.72];
   this.ball(base,...hip,.115,.111,.109,rubber);
   this.panel(base,side*.195,.425,.04+side*stride*.2,.123,.19,.107,ceramic);
   this.rod(base,hip,knee,.078,steel);
   this.panel(base,...knee,.117,.106,.109,shade);
   this.ball(base,knee[0],knee[1],knee[2]+.070,.075,.071,.045,'#5f8792');
   this.rod(base,knee,ankle,.077,steel);
   this.panel(base,ankle[0],ankle[1],ankle[2]+.115,.174,.105,.245,ceramic);
   this.panel(base,ankle[0],ankle[1]-.06,ankle[2]+.135,.184,.052,.252,rubber);
   this.panel(base,ankle[0],ankle[1]-.082,ankle[2]+.192,.155,.021,.088,aqua,0,.13);
  }

  // Oval helmet shell, dark sapphire curved faceplate with subtle inset silver lip.
  const headTilt=anim*Math.sin(this.time*1.32)*.03+liftPour*.13;
  const head=transform(base,T(0,1.56,0),Rz(headTilt));
  this.panel(head,0,.072,0,.51,.405,.406,ceramic);
  this.panel(head,0,.090,.310,.454,.282,.158,shade);
  this.panel(head,0,.090,.352,.425,.260,.141,visor);
  this.panel(head,-.16,.165,.475,.11,.048,.015,'#36697d'); // visor glossy reflection
  this.panel(head,.174,.106,.472,.095,.069,.018,'#203d50');
  // Smiling luminous eye arcs, with blinking to avoid static stare.
  const blink=anim&&Math.sin(this.time*.63)> .995? .16:1;
  for(const side of [-1,1]){
   const ex=side*.153;
   this.ball(head,ex,.107,.495,.064,.086*blink,.028,aqua,.32);
   this.ball(head,ex-.014,.132,.519,.024,.030*blink,.009,softGlow,.42);
   this.panel(head,side*.445,.051,.045,.109,.130,.122,steel);
   this.ball(head,side*.462,.052,.129,.081,.091,.042,aqua,.16);
  }
  for(let j=0;j<7;j++){
   const x=(j-3)*.036;
   const y=-.064-.032*(1-Math.abs(j-3)/3);
   this.ball(head,x,y,.489,.014,.010,.012,'#e5b65b',.08);
  }
  // Soft backpack antenna and planter straw-style hat with woven edge rings.
  this.rod(head,[.30,.34,-.17],[.38,.63,-.24],.026,'#a3b6b4');
  this.ball(head,.38,.655,-.24,.051,.049,.049,aqua,.16);
  this.ring(head,0,.51,-.019,.57,.038,'#bf8745');
  this.draw('cylinder',transform(head,T(0,.535,-.016),S(.55,.054,.53)),'#e2b878');
  this.draw('cylinder',transform(head,T(0,.64,-.016),S(.34,.20,.325)),'#e4bf80');
  this.ring(head,0,.62,-.016,.343,.060,'#b6884b');
  this.petal(head,.12,.72,.28,.27,.7,.8,'#55ad64');
  this.petal(head,.23,.73,.21,.20,1.5,-.6,'#8dd875');

  // Articulated shoulder pads, elbows, fingers and a distinct can handle.
  const reach=liftPour*.28;
  for(const side of [-1,1]){
   const shoulder=[side*.355,1.22,0];
   const elbow=side>0?[.54,1.03-reach*.14,.08]:[-.50,1.05,.17];
   const hand=side>0?[.66,.85-reach*.12,.42]:[-.32,.93,.37];
   this.ball(base,...shoulder,.13,.12,.12,rubber);
   this.panel(base,shoulder[0],shoulder[1],.06,.152,.155,.14,ceramic);
   this.rod(base,shoulder,elbow,.087,steel);
   this.panel(base,...elbow,.092,.102,.085,shade);
   this.rod(base,elbow,hand,.075,ceramic);
   this.panel(base,...hand,.088,.074,.086,rubber);
   for(let j=0;j<3;j++)this.ball(base,hand[0]+(j-1)*.046,hand[1]-.046,hand[2]+.05,.024,.046,.031,shade);
  }
  const pourAngle=liftPour*.72;
  const can=transform(base,T(.71,.76,.46),Rz(-.09-pourAngle));
  this.draw('cylinder',transform(can,S(.213,.325,.213)),'#9ab6b9');
  this.draw('cylinder',transform(can,T(0,.174,0),S(.215,.044,.215)),'#e9f7f1');
  this.ring(can,0,.176,0,.209,.043,steel);
  this.ball(can,0,.014,.218,.055,.055,.024,'#36c18d');
  this.rod(can,[.155,.065,0],[.42,.133,0],.033,'#a4c8d0');
  this.ball(can,.451,.14,0,.079,.06,.073,'#e6eff1');
  this.rod(can,[-.146,.175,0],[-.06,.335,0],.030,steel);
  this.rod(can,[-.06,.335,0],[.126,.177,0],.030,steel);

  if(pouring)this.drawStream(posX,elapsed);
 }

 drawStream(botX,t){
  const originX=botX+1.30,endX=.62,originZ=.84,endZ=.54;
  const droplets=this.w<600?34:52;
  const tempo=(t-1.12)*.62;
  for(let i=0;i<droplets;i++){
    const f=(i/droplets+tempo)%1;
    const arc=Math.sin(f*Math.PI);
    const x=mix(originX,endX,f), y=mix(1.02,.14,f)+arc*.28, z=mix(originZ,endZ,f);
    const wob=.012*Math.sin(this.time*11+i*1.7);
    const size=.016+.014*rand(i*6);
    this.ball(I(),x,y+wob,z,size,size*1.95,size,'#4fdcf7',.72,.92);
  }
  for(let i=0;i<(this.w<600?18:28);i++){
    const a=rand(i*9)*TAU,r=rand(i*5+.6)*.28+Math.abs(Math.sin(this.time*5.3+i))*0.018;
    this.ball(I(),endX+Math.cos(a)*r,.09+.18*rand(i*3),endZ+Math.sin(a)*r,.017,.028,.017,'#c9f8ff',.52,.92);
  }
  for(let i=0;i<(this.w<600?10:16);i++){
    const mist=(i/16+tempo*1.5)%1;
    this.ball(I(),mix(originX+.03,endX-.02,mist),mix(.95,.18,mist),mix(originZ,endZ,mist)+Math.sin(i)*.02,.010,.020,.010,'#dbffff',.22,.75);
  }
 }
 drawSkyEffects(){
  if(this.reduced)return;
  // Sunlit fireflies and drifting pollen. Only visual elements.
  for(let i=0;i<(this.w<600?7:13);i++){
    const x=(rand(i*11)-.5)*6.5,y=.8+rand(i*25)*2.5+Math.sin(this.time*.6+i)*.14,z=(rand(i*6)-.5)*1.7;
    this.ball(I(),x,y,z,.022,.022,.022,i%3===0?'#f8e8a5':'#c7f6ad',.8,.8);
  }
 }
 setCinematic(on){this.cinematicMode=!!on;}
 waterTree(){ /* Single visual cycle: repeated splash calls must not restart the walking animation. */ if(!this.reduced&&(this.time-this.actionStart>6.5))this.actionStart=this.time; }
 playWatering(){this.waterTree();}
 startWatering(){this.playWatering();}
 stopWatering(){ /* Animated timeline ends naturally. */ }
 setTree(kind,care=3){
  this.kind=clamp(Number(kind)||0,0,2);
  this.targetPhase=care===0?1:care===1?2.3:care===2?2.78:3;
 }
 rotate(){this.yaw+=.45;}
 frame(stamp){
  if(this.contextLost)return;
  if(global.document.hidden){this.last=stamp;return requestAnimationFrame(this.frame);}
  if(this.last&&stamp-this.last<(this.w<650?32:16))return requestAnimationFrame(this.frame);
  const dt=this.last?clamp((stamp-this.last)/1000,0,.07):.016;this.last=stamp;
  if(!this.reduced)this.time+=dt;
  this.phase=mix(this.phase,this.targetPhase,Math.min(1,dt*3));
  if(!this.drag&&!this.reduced)this.yaw+=dt*.026;
  if(!this.cinematicMode)this.render();
  requestAnimationFrame(this.frame);
 }
 render(){
  const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(this.program);
  const aspect=this.w/this.h;
  const far=aspect<.9;
  const eye=[Math.sin(this.yaw)*(far?7.5:6.85),3.05,Math.cos(this.yaw)*(far?7.5:6.85)+(far?1.1:1.05)];
  const vp=mult(perspective(far?Math.PI/3.5:Math.PI/5.25,aspect,.1,80),lookAt(eye,[0,1.57,0]));
  gl.uniformMatrix4fv(this.loc.vp,false,vp);
  gl.uniform3fv(this.loc.eye,eye);
  this.drawGround();
  this.drawTree();
  this.drawRobot();
  this.drawSkyEffects();
 }
 destroy(){this.resizeObserver.disconnect();}
}
function Garden3D(canvas){
 let gl=null;
 try{
  if(!global.WebGLRenderingContext)throw Error('WebGL unavailable');
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)throw Error('WebGL context unavailable');
  return new OrchardWebGL(canvas,gl);
 }catch(err){
  console.warn('Agent Orchard WebGL fallback:',err.message);
  // A canvas with a WebGL context cannot be switched to 2-D; replace it first.
  if(gl){
   const copy=canvas.cloneNode(false);canvas.replaceWith(copy);canvas=copy;
  }
  return new LegacyGarden3D(canvas);
 }
}
global.Garden3D=Garden3D;
})(globalThis);
