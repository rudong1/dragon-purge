(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DragonPetMotion = api.DragonPetMotion;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODES = Object.freeze({ awake: 0, drowsy: 1, sleeping: 2, waking: 3, asking: 4, petting: 5, happy: 6, showcase: 7, tapping: 8, summer: 9 });
  const TRANSITION_MS = 1400;
  const gaussian = (x, y, cx, cy, rx, ry) => Math.exp(-2 * (((x-cx)/rx)**2 + ((y-cy)/ry)**2));
  const smooth = value => { const v = Math.max(0, Math.min(1, value)); return v*v*(3-2*v); };
  function displacement(x, y, t, mode = {}) {
    if (mode.reducedMotion) return { x: 0, y: 0 };
    const a = mode.activity || 'awake', tau = 2*Math.PI;
    const body = gaussian(x,y,.54,.53,.32,.34);
    let dx=0, dy=-.003*(.5-.5*Math.cos(tau*t/7))*body;
    if (mode.pose === 'sitting' && a === 'awake') {
      const legs = gaussian(x,y,.69,.84,.29,.25);
      dx += .016*Math.sin(tau*t/10)*legs;
      dy += .008*Math.sin(tau*t/10)*legs;
    }
    const tail = gaussian(x,y,.22,.79,.30,.22);
    let wave = Math.sin(tau*t/12), strength = .010;
    if (a === 'tapping') {
      const age = mode.elapsed ?? t;
      const envelope = smooth(age/1.2)*smooth((24-age)/1.2);
      const beat = Math.sin(tau*age/4);
      const left = Math.max(0,beat)**2*gaussian(x,y,.75,.93,.10,.09);
      const right = Math.max(0,-beat)**2*gaussian(x,y,.91,.93,.10,.09);
      dx += .003*(left-right)*envelope;
      dy -= .018*(left+right)*envelope;
      wave = beat; strength = .016*envelope;
    } else if (a === 'happy' || a === 'petting') {
      const elapsed = mode.elapsed || 0;
      const envelope = a === 'petting' ? Math.min(1,elapsed/3) : Math.min(1,Math.max(0,(45-elapsed)/5));
      wave = Math.sin(tau*t/2.8); strength = .010+.016*envelope;
    } else if (a === 'sleeping' || a === 'drowsy') { wave=Math.sin(tau*t/9); strength=.002; }
    dx += strength*wave*tail; dy += .5*strength*wave*tail;
    return { x: dx, y: dy };
  }
  const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}`;
  const fragment = `precision highp float;
    varying vec2 uv; uniform sampler2D currentImage; uniform sampler2D previousImage;
    uniform vec2 currentContain,previousContain;
    uniform float time,mode,previousMode,sitting,previousSitting,elapsed,previousElapsed,motionEnabled,blendAmount;
    const float TAU=6.28318530718;
    float region(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return exp(-2.*dot(q,q));}
    vec2 deform(vec2 p,float action,float seated,float age){
      float body=region(p,vec2(.54,.53),vec2(.32,.34));
      vec2 d=vec2(0.,-.003*(.5-.5*cos(TAU*time/7.))*body);
      if(seated>.5&&action<.5){
        float legs=region(p,vec2(.69,.84),vec2(.29,.25));
        d+=vec2(.016,.008)*sin(TAU*time/10.)*legs;
      }
      float tail=region(p,vec2(.22,.79),vec2(.30,.22));
      float wave=sin(TAU*time/12.), strength=.010;
      if(action>7.5&&action<8.5){
        float envelope=smoothstep(0.,1.2,age)*(1.-smoothstep(22.8,24.,age));
        float beat=sin(TAU*age/4.);
        float left=pow(max(0.,beat),2.)*region(p,vec2(.75,.93),vec2(.10,.09));
        float right=pow(max(0.,-beat),2.)*region(p,vec2(.91,.93),vec2(.10,.09));
        d+=vec2(.003*(left-right),-.018*(left+right))*envelope;
        wave=beat;strength=.016*envelope;
      }else if(action>4.5&&action<6.5){
        float envelope=action<5.5?min(1.,age/3.):clamp((45.-age)/5.,0.,1.);
        wave=sin(TAU*time/2.8);strength=.010+.016*envelope;
      }else if(action>.5&&action<2.5){wave=sin(TAU*time/9.);strength=.002;}
      d+=vec2(strength,.5*strength)*wave*tail;
      if(action>2.5&&action<3.5){
        float hand=region(p,vec2(.38,.30),vec2(.16,.14));
        d.x+=.004*sin(TAU*time/2.8)*hand;
      }
      if(action>3.5&&action<5.5){
        float head=region(p,vec2(.51,.23),vec2(.27,.24));
        d.y+=.002*sin(TAU*time/6.)*head;
      }
      return p-d*motionEnabled;
    }
    vec4 sampleSprite(sampler2D tex,vec2 contain,float action,float seated,float age){
      vec2 p=(uv-.5)/contain+.5;
      if(p.x<0.||p.y<0.||p.x>1.||p.y>1.)return vec4(0.);
      vec2 q=deform(p,action,seated,age);
      if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return vec4(0.);
      vec4 c=texture2D(tex,q); return vec4(c.rgb*c.a,c.a);
    }
    void main(){
      vec4 a=sampleSprite(previousImage,previousContain,previousMode,previousSitting,previousElapsed);
      vec4 b=sampleSprite(currentImage,currentContain,mode,sitting,elapsed);
      gl_FragColor=mix(a,b,blendAmount);
    }`;
  class DragonPetMotion {
    constructor(canvas,{onError=()=>{}}={}) {
      this.canvas=canvas;this.onError=onError;this.mode={pose:'sitting',activity:'awake',elapsed:0,reducedMotion:false};this.cache=new Map();this.token=0;this.running=false;this.transitionStart=-Infinity;this.timeOrigin=performance.now();
      this.gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
      this.rendererMode=this.gl?'webgl':'canvas2d';
      if(this.gl){
        const g=this.gl, compile=(type,code)=>{const s=g.createShader(type);g.shaderSource(s,code);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
        this.program=g.createProgram();g.attachShader(this.program,compile(g.VERTEX_SHADER,vertex));g.attachShader(this.program,compile(g.FRAGMENT_SHADER,fragment));g.linkProgram(this.program);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program));g.useProgram(this.program);
        const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);const p=g.getAttribLocation(this.program,'p');g.enableVertexAttribArray(p);g.vertexAttribPointer(p,2,g.FLOAT,false,0,0);
        this.locations={};for(const n of ['currentImage','previousImage','currentContain','previousContain','time','mode','previousMode','sitting','previousSitting','elapsed','previousElapsed','motionEnabled','blendAmount'])this.locations[n]=g.getUniformLocation(this.program,n);
      }else{this.context=canvas.getContext('2d');if(!this.context)throw Error('No canvas renderer available');}
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
      this.onContextLost=event=>{event.preventDefault();this.contextLost=true;this.stop();this.onError(new Error('Graphics context unavailable'));};canvas.addEventListener('webglcontextlost',this.onContextLost);
      this.onVisibility=()=>{if(!document.hidden&&this.running)this.frame();};document.addEventListener('visibilitychange',this.onVisibility);
    }
    async load(url) {
      if(!this.cache.has(url))this.cache.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{
        let texture;
        if(this.gl){const g=this.gl;texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,img);}
        resolve({img,texture,url});};img.onerror=()=>{this.cache.delete(url);reject(Error('Cannot load pet artwork'));};img.src=url;}));
      return this.cache.get(url);
    }
    async setSource(url) {
      if(this.contextLost)throw Error('Graphics context unavailable');
      const token=++this.token;const image=await this.load(url);if(token!==this.token||this.destroyed)return false;if(this.current?.url===url)return true;
      this.previous=this.current||image;this.previousMode={...this.mode};this.current=image;this.transitionStart=this.previous===image?-Infinity:performance.now();this.renderAt((performance.now()-this.timeOrigin)/1000);return true;
    }
    preload(urls){return Promise.allSettled(urls.map(u=>this.load(u)));}
    setMode(mode){this.mode={...this.mode,...mode};this.modeTime=performance.now();}
    resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(2,globalThis.devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(r.width*d));this.canvas.height=Math.max(1,Math.round(r.height*d));if(this.current)this.renderAt((performance.now()-this.timeOrigin)/1000);}
    contain(sprite){const c=this.canvas;const scale=.96*Math.min(c.width/sprite.img.naturalWidth,c.height/sprite.img.naturalHeight);return [sprite.img.naturalWidth*scale/c.width,sprite.img.naturalHeight*scale/c.height];}
    imagePoint(clientX,clientY){if(!this.current)return null;const r=this.canvas.getBoundingClientRect(),[sx,sy]=this.contain(this.current);return {x:((clientX-r.left)/r.width-.5)/sx+.5,y:((clientY-r.top)/r.height-.5)/sy+.5};}
    renderAt(seconds,{transitionProgress}={}) {
      if(!this.current||this.destroyed)return false;
      const progress=this.mode.reducedMotion?1:Math.max(0,Math.min(1,transitionProgress??((performance.now()-this.transitionStart)/TRANSITION_MS)));const mix=progress*progress*(3-2*progress);
      const mode=this.mode,old=this.previousMode||mode;const age=mode.elapsed+(this.running?(performance.now()-(this.modeTime||performance.now()))/1000:0);
      if(this.gl){const g=this.gl,l=this.locations;g.useProgram(this.program);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);
        for(const [n,v]of Object.entries({time:seconds,mode:MODES[mode.activity]||0,previousMode:MODES[old.activity]||0,sitting:mode.pose==='sitting'?1:0,previousSitting:old.pose==='sitting'?1:0,elapsed:age||0,previousElapsed:old.elapsed||0,motionEnabled:mode.reducedMotion?0:1,blendAmount:mix}))g.uniform1f(l[n],v);
        for(const [i,sprite,name]of [[0,this.current,'current'],[1,this.previous||this.current,'previous']]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,sprite.texture);g.uniform1i(l[name+'Image'],i);g.uniform2fv(l[name+'Contain'],this.contain(sprite));}g.drawArrays(g.TRIANGLE_STRIP,0,4);
      }else{const c=this.canvas,ctx=this.context;ctx.clearRect(0,0,c.width,c.height);for(const [s,alpha]of [[this.previous||this.current,1-mix],[this.current,mix]]){const [w,h]=this.contain(s);ctx.globalAlpha=alpha;ctx.drawImage(s.img,(1-w)*c.width/2,(1-h)*c.height/2,w*c.width,h*c.height);}ctx.globalAlpha=1;}
      return true;
    }
    frame(){cancelAnimationFrame(this.raf);if(!this.running||document.hidden)return;this.renderAt((performance.now()-this.timeOrigin)/1000);this.raf=requestAnimationFrame(()=>this.frame());}
    start(){if(this.destroyed)return;this.running=true;this.frame();}
    stop(){this.running=false;cancelAnimationFrame(this.raf);}
    destroy(){this.stop();this.destroyed=true;this.token++;this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);if(this.gl){for(const p of this.cache.values())p.then(s=>this.gl.deleteTexture(s.texture)).catch(()=>{});this.gl.deleteProgram(this.program);}this.cache.clear();}
  }
  return { DragonPetMotion, displacement, MODES, TRANSITION_MS };
});
