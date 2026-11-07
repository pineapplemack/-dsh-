/* MACKOWN ORBITAL — interactive 3D observatory */
(function(){
  "use strict";
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const canvas = $('#space');
  const boot = $('#boot');
  const bootBar = $('#bootBar');
  const bootPct = $('#bootPct');
  const bootStatus = $('#bootStatus');
  const skipBoot = $('#skipBoot');

  if(!window.THREE){
    fatal();
    return;
  }

  /* ---------------- boot / fatal ---------------- */
  let bootFinished = false;
  function finishBoot(){
    if(bootFinished) return;
    bootFinished = true;
    document.body.classList.add('ready');
    if(boot) boot.classList.add('is-gone');
    setTimeout(()=>{ addLog('entering observation mode / 3D feed live'); }, 900);
  }
  function fatal(){
    document.body.classList.add('no-webgl','ready');
    bootFinished = true;
    if(boot) boot.classList.add('is-gone');
    const f=$('#fallback'); if(f) f.style.display='grid';
  }
  if(skipBoot) skipBoot.addEventListener('click',finishBoot);
  function runBoot(){
    if(bootFinished) return;
    const start=performance.now();
    const statuses=[
      [0,'Initializing star field'],
      [20,'Resolving planetary shaders'],
      [47,'Winding ring geometry'],
      [69,'Seeding three moons'],
      [86,'Locking gravitational field'],
      [96,'Opening the observatory']
    ];
    function tick(now){
      if(bootFinished) return;
      const progress=Math.min(100,Math.floor((now-start)/(reduce?550:1550)*100));
      if(bootBar) bootBar.style.width=progress+'%';
      if(bootPct) bootPct.textContent=String(progress).padStart(2,'0')+'%';
      let label=statuses[0][1];
      statuses.forEach(s=>{ if(progress>=s[0]) label=s[1]; });
      if(bootStatus) bootStatus.textContent=label;
      if(progress<100){ requestAnimationFrame(tick); }
      else setTimeout(finishBoot, reduce?80:260);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- cursor ---------------- */
  const cursor=$('#cursor');
  const cursorText=$('#cursorText');
  let cursorFocus=false;
  if(fine && cursor){
    let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
    addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
    (function loop(){
      cx+=(mx-cx)*.24; cy+=(my-cy)*.24;
      cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    function setCursor(label, focus){
      if(cursorText) cursorText.textContent=label;
      cursor.classList.toggle('is-focus',!!focus);
      cursorFocus=!!focus;
    }
    document.addEventListener('pointerover',e=>{
      const el=e.target.closest('a,button,input');
      if(!el) return;
      if(el.matches('input')) setCursor('Adjust',true);
      else if(el.matches('a')) setCursor('Open',true);
      else if(el.matches('[data-scan]')) setCursor('Scan',true);
      else if(el.matches('[data-focus]')) setCursor('Focus',true);
      else if(el.matches('#soundToggle')) setCursor('Listen',true);
      else setCursor('Select',true);
    });
    document.addEventListener('pointerout',e=>{
      if(!e.target.closest('a,button,input')) return;
      if(e.relatedTarget && e.relatedTarget.closest('a,button,input')) return;
      cursor.classList.remove('is-focus');
      cursorFocus=false;
    });
    window.setCursorState=setCursor;
  }

  /* ---------------- scene boot ---------------- */
  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  }catch(e){
    fatal();
    return;
  }
  const pixelCap=()=>innerWidth<700?1.6:2;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelCap()));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.setClearColor(0x050607,1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, .08, 400);
  const clock = new THREE.Clock();
  let time = 0;

  /* ---------------- procedural textures ---------------- */
  function makeDotTexture(){
    const c=document.createElement('canvas'); c.width=c.height=64;
    const g=c.getContext('2d');
    const grad=g.createRadialGradient(32,32,0,32,32,32);
    grad.addColorStop(0,'rgba(255,255,255,1)');
    grad.addColorStop(.25,'rgba(255,255,255,.9)');
    grad.addColorStop(.55,'rgba(255,255,255,.25)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grad; g.fillRect(0,0,64,64);
    const t=new THREE.CanvasTexture(c); t.needsUpdate=true;
    return t;
  }
  function makeGlowTexture(){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const g=c.getContext('2d');
    const grad=g.createRadialGradient(128,128,0,128,128,128);
    grad.addColorStop(0,'rgba(255,236,205,.95)');
    grad.addColorStop(.16,'rgba(244,184,118,.55)');
    grad.addColorStop(.45,'rgba(220,140,80,.14)');
    grad.addColorStop(1,'rgba(220,140,80,0)');
    g.fillStyle=grad; g.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
  }
  function mulberry32(a){
    return function(){
      a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  function makeMoonTexture(base, shade, seed, icy){
    const c=document.createElement('canvas'); c.width=768; c.height=384;
    const g=c.getContext('2d');
    const rnd=mulberry32(seed);
    g.fillStyle=base; g.fillRect(0,0,c.width,c.height);
    /* broad tonal patches */
    for(let i=0;i<130;i++){
      const x=rnd()*c.width, y=rnd()*c.height, r=16+rnd()*80;
      const grd=g.createRadialGradient(x,y,0,x,y,r);
      grd.addColorStop(0,shade+'55'); grd.addColorStop(1,shade+'00');
      g.fillStyle=grd; g.fillRect(x-r,y-r,r*2,r*2);
    }
    /* fine grain */
    for(let i=0;i<2600;i++){
      const x=rnd()*c.width,y=rnd()*c.height,r=rnd()*1.5;
      g.fillStyle=rnd()>.5?'rgba(255,255,255,.055)':'rgba(0,0,0,.07)';
      g.fillRect(x,y,r,r);
    }
    /* craters */
    for(let i=0;i<(icy?40:95);i++){
      const x=rnd()*c.width,y=24+rnd()*(c.height-48),r=1.5+rnd()*12;
      const grd=g.createRadialGradient(x-r*.22,y-r*.22,r*.1,x,y,r);
      grd.addColorStop(0,'rgba(255,255,255,.12)');
      grd.addColorStop(.55,'rgba(0,0,0,.18)');
      grd.addColorStop(.82,'rgba(255,255,255,.075)');
      grd.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    }
    /* ice fractures */
    if(icy){
      g.strokeStyle='rgba(225,244,244,.18)'; g.lineWidth=1;
      for(let i=0;i<24;i++){
        let x=rnd()*c.width,y=rnd()*c.height;
        g.beginPath(); g.moveTo(x,y);
        for(let j=0;j<5;j++){ x+=(rnd()-.5)*90; y+=(rnd()-.5)*38; g.lineTo(x,y); }
        g.stroke();
      }
    }
    const t=new THREE.CanvasTexture(c);
    t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
    t.encoding=THREE.sRGBEncoding;
    t.anisotropy=renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  const dotTexture=makeDotTexture();
  const glowTexture=makeGlowTexture();

  /* ---------------- background ---------------- */
  const bgUniforms={uTime:{value:0}};
  const bgMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthWrite:false,
    depthTest:false,
    uniforms:bgUniforms,
    vertexShader:`
      varying vec3 vDir;
      void main(){
        vDir=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      precision highp float;
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
      float noise(vec2 p){
        vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i); float b=hash(i+vec2(1.0,0.0));
        float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0.0; float a=0.5;
        for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(13.1,7.7); a*=0.5; }
        return v;
      }
      void main(){
        vec2 uv=vec2(atan(vDir.z,vDir.x)*0.1591549, asin(clamp(vDir.y,-1.0,1.0))*0.3183099+0.5);
        float t=uTime*0.004;
        float n1=fbm(uv*3.1+vec2(t,0.0));
        float n2=fbm(uv*6.4-vec2(t*0.7,uv.x*0.6));
        vec3 col=vec3(0.006,0.008,0.009);
        col+=vec3(0.018,0.048,0.052)*pow(n1,2.4)*1.7;
        col+=vec3(0.075,0.032,0.014)*pow(n2,3.2)*1.1;
        col+=vec3(0.018,0.034,0.032)*smoothstep(-0.1,0.8,uv.y)*0.45;
        float dust=smoothstep(0.55,0.9,n1)*0.02;
        col+=vec3(dust,dust*0.8,dust*0.5);
        gl_FragColor=vec4(col,1.0);
      }
    `
  });
  const bg=new THREE.Mesh(new THREE.SphereGeometry(180,48,32),bgMat);
  bg.renderOrder=-100; bg.frustumCulled=false; scene.add(bg);

  /* ---------------- stars ---------------- */
  const starCount=reduce?1600:3200;
  const starGeo=new THREE.BufferGeometry();
  const starPos=new Float32Array(starCount*3);
  const starCol=new Float32Array(starCount*3);
  const starSize=new Float32Array(starCount);
  const starPhase=new Float32Array(starCount);
  const starPalette=[
    new THREE.Color(0xf1e8d5),new THREE.Color(0xcfdcd8),new THREE.Color(0xe9b97f),
    new THREE.Color(0xb9d9d4),new THREE.Color(0xd8cbb2),new THREE.Color(0xfff4df)
  ];
  for(let i=0;i<starCount;i++){
    const r=48+Math.random()*96;
    const theta=Math.random()*Math.PI*2;
    const phi=Math.acos(2*Math.random()-1);
    starPos[i*3]=r*Math.sin(phi)*Math.cos(theta);
    starPos[i*3+1]=r*Math.cos(phi);
    starPos[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
    const col=starPalette[Math.floor(Math.random()*starPalette.length)];
    starCol[i*3]=col.r; starCol[i*3+1]=col.g; starCol[i*3+2]=col.b;
    starSize[i]=.5+Math.pow(Math.random(),3)*2.6;
    starPhase[i]=Math.random()*Math.PI*2;
  }
  starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
  starGeo.setAttribute('aColor',new THREE.BufferAttribute(starCol,3));
  starGeo.setAttribute('aSize',new THREE.BufferAttribute(starSize,1));
  starGeo.setAttribute('aPhase',new THREE.BufferAttribute(starPhase,1));
  const starUniforms={uTime:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio||1,2)}};
  const starMat=new THREE.ShaderMaterial({
    uniforms:starUniforms,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=max(0.7,aSize*uPixelRatio*(220.0/max(1.0,-mv.z)));
        gl_PointSize=min(gl_PointSize,26.0);
        vColor=aColor;
        vAlpha=0.42+0.58*(0.5+0.5*sin(uTime*0.72+aPhase));
      }
    `,
    fragmentShader:`
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        float d=length(gl_PointCoord-vec2(0.5));
        if(d>0.5) discard;
        float a=smoothstep(0.5,0.04,d);
        gl_FragColor=vec4(vColor,a*vAlpha);
      }
    `
  });
  const stars=new THREE.Points(starGeo,starMat);
  stars.renderOrder=-90; scene.add(stars);

  /* ---------------- lights ---------------- */
  scene.add(new THREE.AmbientLight(0x243839,0.9));
  const sunLight=new THREE.DirectionalLight(0xffd4a1,2.25);
  sunLight.position.set(-24,27,48);
  scene.add(sunLight);
  const rimLight=new THREE.DirectionalLight(0x6fb1ac,.55);
  rimLight.position.set(22,-8,-24);
  scene.add(rimLight);

  /* ---------------- planet system ---------------- */
  const planetSystem=new THREE.Group();
  planetSystem.rotation.x=.31;
  planetSystem.rotation.z=-.16;
  scene.add(planetSystem);

  const PLANET_RADIUS=2.55;
  const planetUniforms={
    uTime:{value:0},
    uScan:{value:-.2},
    uScanActive:{value:0},
    uLightDir:{value:new THREE.Vector3(-.30,.36,.88).normalize()},
    uCamPos:{value:new THREE.Vector3()}
  };
  const planetMat=new THREE.ShaderMaterial({
    uniforms:planetUniforms,
    vertexShader:`
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main(){
        vUv=uv;
        vWorldNormal=normalize(mat3(modelMatrix)*normal);
        vec4 wp=modelMatrix*vec4(position,1.0);
        vWorldPos=wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp;
      }
    `,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uScan;
      uniform float uScanActive;
      uniform vec3 uLightDir;
      uniform vec3 uCamPos;
      float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float noise(vec2 p){
        vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i); float b=hash(i+vec2(1.0,0.0));
        float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0.0; float a=0.5;
        for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.06+vec2(9.2,17.7); a*=0.5; }
        return v;
      }
      void main(){
        float t=uTime*.012;
        vec2 uv=vUv;
        float flow=fbm(vec2(uv.x*3.2+t,uv.y*8.0-t*.55));
        float bands=sin(uv.y*32.0+flow*4.6+sin(uv.x*6.283)*.55)*.5+.5;
        float detail=fbm(vec2(uv.x*11.0+t*2.1,uv.y*24.0-flow*1.4));
        float storm=smoothstep(.57,.83,fbm(vec2(uv.x*7.0-t,uv.y*15.0+flow)));
        vec3 deep=vec3(.020,.085,.100);
        vec3 sea=vec3(.110,.340,.360);
        vec3 amber=vec3(.820,.420,.180);
        vec3 cream=vec3(1.000,.840,.580);
        vec3 col=mix(deep,sea,smoothstep(.12,.78,bands));
        col=mix(col,amber,smoothstep(.42,.93,detail)*.64);
        col=mix(col,cream,storm*.38);
        col+=vec3(.045,.035,.02)*smoothstep(.8,1.0,detail);
        vec3 N=normalize(vWorldNormal);
        vec3 L=normalize(uLightDir);
        vec3 V=normalize(uCamPos-vWorldPos);
        float diff=max(dot(N,L),0.0);
        float rim=pow(1.0-max(dot(N,V),0.0),3.1);
        float lat=abs(uv.y-.5)*2.0;
        col*=mix(1.0,.82,smoothstep(.72,1.0,lat));
        vec3 lit=col*(.185+diff*1.28);
        lit+=rim*vec3(.26,.60,.56)*.82;
        lit+=(1.0-diff)*rim*vec3(.06,.15,.16)*.5;
        float scan=exp(-pow((uv.y-uScan)/.016,2.0))*uScanActive;
        lit+=vec3(.95,.68,.36)*scan*.45;
        float glow=pow(max(dot(N,V),0.0),8.0)*.045;
        lit+=vec3(.95,.76,.5)*glow;
        gl_FragColor=vec4(lit,1.0);
      }
    `
  });
  const planet=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS,128,96),planetMat);
  planet.userData.focus='planet';
  planetSystem.add(planet);

  /* atmosphere — front fresnel */
  const atmoMat=new THREE.ShaderMaterial({
    uniforms:{
      uCamPos:{value:new THREE.Vector3()},
      uColor:{value:new THREE.Color(0x89d0c6)},
      uWarm:{value:new THREE.Color(0xe2a164)}
    },
    vertexShader:`
      varying vec3 vN; varying vec3 vW;
      void main(){
        vN=normalize(mat3(modelMatrix)*normal);
        vec4 wp=modelMatrix*vec4(position,1.0);
        vW=wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp;
      }
    `,
    fragmentShader:`
      precision highp float;
      varying vec3 vN; varying vec3 vW;
      uniform vec3 uCamPos; uniform vec3 uColor; uniform vec3 uWarm;
      void main(){
        vec3 N=normalize(vN);
        vec3 V=normalize(uCamPos-vW);
        float rim=pow(1.0-max(dot(N,V),0.0),2.8);
        float lit=clamp(dot(N,normalize(vec3(-.30,.36,.88)))*.5+.5,0.0,1.0);
        vec3 col=mix(uColor,uWarm,lit*.55);
        gl_FragColor=vec4(col,rim*.48);
      }
    `,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending,
    side:THREE.FrontSide
  });
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.035,64,48),atmoMat);
  planetSystem.add(atmosphere);

  /* faint outer haze */
  const hazeMat=new THREE.ShaderMaterial({
    uniforms:{uCamPos:{value:new THREE.Vector3()}},
    vertexShader:`
      varying vec3 vN; varying vec3 vW;
      void main(){
        vN=normalize(mat3(modelMatrix)*normal);
        vec4 wp=modelMatrix*vec4(position,1.0);
        vW=wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp;
      }
    `,
    fragmentShader:`
      precision highp float;
      varying vec3 vN; varying vec3 vW;
      uniform vec3 uCamPos;
      void main(){
        vec3 N=normalize(vN);
        vec3 V=normalize(uCamPos-vW);
        float f=pow(1.0-abs(dot(N,V)),3.2);
        gl_FragColor=vec4(vec3(.23,.55,.51),f*.16);
      }
    `,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.BackSide
  });
  const haze=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.22,48,32),hazeMat);
  planetSystem.add(haze);

  /* rings */
  const ringUniforms={uInner:{value:3.36},uOuter:{value:5.16},uTime:{value:0}};
  const ringMat=new THREE.ShaderMaterial({
    uniforms:ringUniforms,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
    vertexShader:`
      varying vec2 vP;
      void main(){
        vP=position.xy;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      precision highp float;
      varying vec2 vP;
      uniform float uInner;
      uniform float uOuter;
      uniform float uTime;
      float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
      float noise(vec2 p){
        vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i); float b=hash(i+vec2(1.0,0.0));
        float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      void main(){
        float r=length(vP);
        float t=clamp((r-uInner)/(uOuter-uInner),0.0,1.0);
        float n=noise(vec2(t*38.0,1.7));
        float bands=.5+.5*sin(t*118.0+n*5.2);
        float fine=.75+.25*sin(t*360.0+n*2.0);
        float gaps=smoothstep(.0,.018,abs(t-.19))*smoothstep(.0,.02,abs(t-.48))*smoothstep(.0,.028,abs(t-.71));
        float edge=smoothstep(0.0,.045,t)*(1.0-smoothstep(.93,1.0,t));
        float alpha=edge*(0.07+0.5*bands*fine);
        alpha*=gaps;
        vec3 col=mix(vec3(.55,.45,.33),vec3(.94,.84,.66),bands);
        col=mix(col,vec3(.75,.37,.18),smoothstep(.55,.95,n)*.45);
        gl_FragColor=vec4(col,alpha*.62);
      }
    `
  });
  const ringGeo=new THREE.RingGeometry(3.36,5.16,256,1);
  const ring=new THREE.Mesh(ringGeo,ringMat);
  ring.rotation.x=-Math.PI/2;
  ring.renderOrder=3;
  planetSystem.add(ring);

  const ringOuter=new THREE.Mesh(
    new THREE.RingGeometry(5.3,5.52,256,1),
    new THREE.MeshBasicMaterial({color:0x9d7b51,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false})
  );
  ringOuter.rotation.x=-Math.PI/2;
  ringOuter.renderOrder=3;
  planetSystem.add(ringOuter);

  /* ring dust */
  const dustCount=reduce?650:1350;
  const dustGeo=new THREE.BufferGeometry();
  const dPos=new Float32Array(dustCount*3);
  const dCol=new Float32Array(dustCount*3);
  const dustColor=new THREE.Color();
  for(let i=0;i<dustCount;i++){
    const r=3.35+Math.random()*1.95;
    const a=Math.random()*Math.PI*2;
    dPos[i*3]=Math.cos(a)*r;
    dPos[i*3+1]=(Math.random()-.5)*.025;
    dPos[i*3+2]=Math.sin(a)*r;
    dustColor.setHSL(.09+Math.random()*.04,.32+Math.random()*.3,.56+Math.random()*.25);
    dCol[i*3]=dustColor.r; dCol[i*3+1]=dustColor.g; dCol[i*3+2]=dustColor.b;
  }
  dustGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3));
  dustGeo.setAttribute('color',new THREE.BufferAttribute(dCol,3));
  const dustMat=new THREE.PointsMaterial({
    size:.045,map:dotTexture,transparent:true,opacity:.7,depthWrite:false,
    vertexColors:true,blending:THREE.AdditiveBlending,sizeAttenuation:true,alphaTest:.01
  });
  const dust=new THREE.Points(dustGeo,dustMat);
  dust.renderOrder=4;
  planetSystem.add(dust);

  /* ---------------- moons ---------------- */
  const moonDefs=[
    {
      key:'luma',name:'LUMA',radius:6.2,ecc:.95,speed:.17,phase:1.2,inclination:.2,node:-.18,size:.28,
      base:'#806a54',shade:'#452f20',seed:12,icy:false,
      light:0xd7a46e
    },
    {
      key:'vessel',name:'VESSEL',radius:8.25,ecc:.9,speed:.105,phase:3.7,inclination:-.32,node:.5,size:.37,
      base:'#a3b8b7',shade:'#47666b',seed:31,icy:true,
      light:0xa5d5ce
    },
    {
      key:'echo',name:'ECHO',radius:10.7,ecc:.94,speed:.062,phase:5.1,inclination:.47,node:-.7,size:.24,
      base:'#514f49',shade:'#282722',seed:57,icy:false,
      light:0x9aa29b
    }
  ];
  const moons=[];
  const clickTargets=[planet];
  moonDefs.forEach(def=>{
    const group=new THREE.Group();
    group.rotation.x=def.inclination;
    group.rotation.z=def.node;
    scene.add(group);

    const pts=[];
    for(let i=0;i<=160;i++){
      const a=(i/160)*Math.PI*2;
      pts.push(new THREE.Vector3(Math.cos(a)*def.radius,0,Math.sin(a)*def.radius*def.ecc));
    }
    const lineGeo=new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat=new THREE.LineBasicMaterial({color:0xb69d78,transparent:true,opacity:.14,depthWrite:false});
    const line=new THREE.LineLoop(lineGeo,lineMat);
    line.renderOrder=1;
    group.add(line);

    const tex=makeMoonTexture(def.base,def.shade,def.seed,def.icy);
    const mat=new THREE.MeshStandardMaterial({
      map:tex,color:0xffffff,roughness:.95,metalness:.02,
      emissive:new THREE.Color(0x030404),emissiveIntensity:1
    });
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(def.size,48,32),mat);
    mesh.userData.focus=def.key;
    group.add(mesh);

    const hit=new THREE.Mesh(
      new THREE.SphereGeometry(def.size*2.05,16,12),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
    );
    hit.userData.focus=def.key;
    group.add(hit);
    clickTargets.push(hit);

    const glow=new THREE.Sprite(new THREE.SpriteMaterial({
      map:glowTexture,color:def.light,transparent:true,opacity:.17,
      depthWrite:false,blending:THREE.AdditiveBlending
    }));
    glow.scale.setScalar(def.size*5.5);
    mesh.add(glow);

    moons.push({
      key:def.key,def,group,mesh,hit,angle:def.phase,
      radius:def.radius,ecc:def.ecc,speed:def.speed,size:def.size,
      spin:.025+Math.random()*.04
    });
  });

  /* ---------------- scan pulses ---------------- */
  const scanPulses=[];
  function makePulse(type){
    let mesh,mat;
    if(type==='ring'){
      mat=new THREE.MeshBasicMaterial({
        color:0x9be0d3,transparent:true,opacity:.65,side:THREE.DoubleSide,
        depthWrite:false,blending:THREE.AdditiveBlending
      });
      mesh=new THREE.Mesh(new THREE.RingGeometry(3.3,3.315,160),mat);
      mesh.rotation.x=-Math.PI/2;
      mesh.renderOrder=5;
      planetSystem.add(mesh);
    }else{
      mat=new THREE.MeshBasicMaterial({
        color:0x9be0d3,transparent:true,opacity:.12,wireframe:true,
        depthWrite:false,blending:THREE.AdditiveBlending
      });
      mesh=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.02,28,18),mat);
      mesh.renderOrder=5;
      planetSystem.add(mesh);
    }
    scanPulses.push({mesh,mat,t:0,duration:type==='ring'?2.7:3.1,type});
  }

  /* ---------------- data / HUD ---------------- */
  const bodies={
    planet:{
      key:'planet',index:'Object 01 / planetary body',name:'MACKOWN-9',type:'Gas giant / ringed',
      desc:'An amber world in a slow, permanent fall. Its equator carries a ring of ice and iron; three moons keep its weather.',
      radius:'58,211 km',distance:'4.11 AU',period:'11.86 yr',signal:'0.82',
      stats:[.94,.77,.82],cam:6.6,freq:174.61,object:planet
    },
    luma:{
      key:'luma',index:'Object 02 / moon 01',name:'LUMA',type:'Warm moon / tidally locked',
      desc:'Closest to the giant and the warmest thing out here. Its surface is a palimpsest of impacts, lit by borrowed amber.',
      radius:'1,832 km',distance:'384,400 km',period:'7.4 d',signal:'0.31',
      stats:[.12,.02,.31],cam:2.1,freq:220,object:null
    },
    vessel:{
      key:'vessel',index:'Object 03 / moon 02',name:'VESSEL',type:'Ice moon / fractured',
      desc:'A shell of pale ice over a dark ocean. The fractures sing whenever the giant’s magnetic field shifts.',
      radius:'2,706 km',distance:'1.08M km',period:'16.2 d',signal:'0.57',
      stats:[.46,.18,.57],cam:2.3,freq:261.63,object:null
    },
    echo:{
      key:'echo',index:'Object 04 / moon 03',name:'ECHO',type:'Dark moon / radio-quiet',
      desc:'The outermost body. It returns no signal, only a small gravitational echo every forty-one days.',
      radius:'1,144 km',distance:'1.86M km',period:'41.0 d',signal:'0.02',
      stats:[.03,.01,.02],cam:1.9,freq:329.63,object:null
    }
  };
  moons.forEach(m=>{ bodies[m.key].object=m.mesh; });

  const dataEls={
    object:$('#dataObject'),name:$('#dataName'),type:$('#dataType'),desc:$('#dataDesc'),
    radius:$('#dataRadius'),distance:$('#dataDistance'),period:$('#dataPeriod'),signal:$('#dataSignal'),
    barAtmo:$('#barAtmo'),barMag:$('#barMag'),barSignal:$('#barSignal'),
    barAtmoVal:$('#barAtmoVal'),barMagVal:$('#barMagVal'),barSignalVal:$('#barSignalVal')
  };
  function updateHUD(key){
    const d=bodies[key]; if(!d) return;
    dataEls.object.textContent=d.index;
    dataEls.name.textContent=d.name;
    dataEls.type.textContent=d.type;
    dataEls.desc.textContent=d.desc;
    dataEls.radius.textContent=d.radius;
    dataEls.distance.textContent=d.distance;
    dataEls.period.textContent=d.period;
    dataEls.signal.textContent=d.signal;
    dataEls.barAtmo.style.width=(d.stats[0]*100)+'%';
    dataEls.barMag.style.width=(d.stats[1]*100)+'%';
    dataEls.barSignal.style.width=(d.stats[2]*100)+'%';
    dataEls.barAtmoVal.textContent=d.stats[0].toFixed(2);
    dataEls.barMagVal.textContent=d.stats[1].toFixed(2);
    dataEls.barSignalVal.textContent=d.stats[2].toFixed(2);
    $$('.target').forEach(b=>b.classList.toggle('active',b.dataset.focus===key));
    $$('.body-label').forEach(b=>b.classList.toggle('is-active',b.dataset.focus===key));
    const labels=$('#labels'); if(labels) labels.classList.add('is-focused');
  }

  /* ---------------- event log ---------------- */
  const eventLog=$('#eventLog');
  function shTime(){
    return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date());
  }
  function stampInitialLogs(){
    const times=$$('#eventLog li time');
    times.forEach((el,i)=>{
      const d=new Date(Date.now()-(times.length-1-i)*1100);
      el.textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(d);
    });
  }
  function addLog(text){
    if(!eventLog) return;
    const li=document.createElement('li');
    const tm=document.createElement('time'); tm.textContent=shTime();
    const sp=document.createElement('span'); sp.textContent=text;
    li.appendChild(tm); li.appendChild(sp);
    li.className='new';
    eventLog.prepend(li);
    while(eventLog.children.length>4) eventLog.removeChild(eventLog.lastElementChild);
  }

  /* ---------------- sound ---------------- */
  let actx=null, soundMaster=null, soundOn=false, drone=[];
  const soundBtn=$('#soundToggle'), soundLabel=$('#soundLabel');
  function initAudio(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    try{
      actx=new AC();
      soundMaster=actx.createGain();
      soundMaster.gain.value=.0001;
      const filter=actx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=520; filter.Q.value=.8;
      filter.connect(soundMaster);
      soundMaster.connect(actx.destination);
      const freqs=[55,82.41,110,164.81];
      freqs.forEach((f,i)=>{
        const o=actx.createOscillator();
        o.type=i===0?'sine':i===3?'triangle':'sine';
        o.frequency.value=f;
        o.detune.value=(i-1)*3;
        const g=actx.createGain(); g.gain.value=i===3?.035:.13;
        o.connect(g); g.connect(filter); o.start();
        drone.push(o);
      });
      const lfo=actx.createOscillator(); lfo.frequency.value=.06;
      const lfoGain=actx.createGain(); lfoGain.gain.value=.035;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
      soundMaster.gain.exponentialRampToValueAtTime(.09,actx.currentTime+2.2);
      return true;
    }catch(e){ return false; }
  }
  function toggleSound(){
    if(!actx){
      if(!initAudio()){ if(soundLabel) soundLabel.textContent='No audio'; return; }
      soundOn=true;
    }else{
      if(actx.state==='suspended') actx.resume();
      soundOn=!soundOn;
      if(soundOn){
        soundMaster.gain.cancelScheduledValues(actx.currentTime);
        soundMaster.gain.setValueAtTime(Math.max(soundMaster.gain.value,.0001),actx.currentTime);
        soundMaster.gain.exponentialRampToValueAtTime(.09,actx.currentTime+.9);
      }else{
        soundMaster.gain.cancelScheduledValues(actx.currentTime);
        soundMaster.gain.setValueAtTime(Math.max(soundMaster.gain.value,.0001),actx.currentTime);
        soundMaster.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.5);
      }
    }
    if(soundBtn){ soundBtn.classList.toggle('is-on',soundOn); soundBtn.setAttribute('aria-pressed',String(soundOn)); }
    if(soundLabel) soundLabel.textContent=soundOn?'Sound on':'Sound off';
    if(soundOn) chime(329.63,.05);
  }
  function chime(freq,vol=.05){
    if(!soundOn||!actx) return;
    const t=actx.currentTime;
    [1,2.01].forEach((mul,i)=>{
      const o=actx.createOscillator(); o.type='sine'; o.frequency.value=freq*mul;
      const g=actx.createGain();
      g.gain.setValueAtTime(.0001,t);
      g.gain.exponentialRampToValueAtTime(vol/(i+1),t+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+1.4);
      o.connect(g); g.connect(soundMaster); o.start(t); o.stop(t+1.5);
    });
  }
  function scanSound(){
    if(!soundOn||!actx) return;
    const t=actx.currentTime;
    const o=actx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(220,t);
    o.frequency.exponentialRampToValueAtTime(1100,t+2.4);
    const g=actx.createGain();
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.035,t+.3);
    g.gain.exponentialRampToValueAtTime(.0001,t+2.6);
    o.connect(g); g.connect(soundMaster); o.start(t); o.stop(t+2.7);
  }
  if(soundBtn) soundBtn.addEventListener('click',toggleSound);

  /* ---------------- focus ---------------- */
  let focusKey='planet';
  let desiredRadius=15.5;
  let cameraRadius=15.5;
  let focusObject=planet;
  const camTarget=new THREE.Vector3(0,0,0);
  const desiredTarget=new THREE.Vector3(0,0,0);
  const spherical={theta:.66,phi:1.22};
  let lastInteraction=performance.now();

  function focusBody(key,opts={}){
    const d=bodies[key]; if(!d) return;
    focusKey=key;
    focusObject=d.object;
    desiredRadius=d.cam;
    if(opts.wide) desiredRadius=15.5;
    updateHUD(key);
    if(!opts.silent){
      addLog('target acquired / '+d.name);
      chime(d.freq,.035);
    }
    if(opts.wide) cameraRadius=Math.max(cameraRadius,15.5);
    lastInteraction=performance.now();
  }
  $$('[data-focus]').forEach(el=>{
    el.addEventListener('click',()=>focusBody(el.dataset.focus));
  });
  const resetView=$('#resetView');
  if(resetView) resetView.addEventListener('click',()=>{
    focusBody('planet',{silent:false,wide:true});
    addLog('field reset / wide observation mode');
  });

  /* ---------------- scan ---------------- */
  const scanBtns=$$('[data-scan]');
  const scanBtn=$('.scan-btn');
  const scanLabel=$('#scanLabel');
  const scanProgressEl=$('#scanProgress');
  const scanProgressBar=scanProgressEl?scanProgressEl.firstElementChild:null;
  const scanState={active:false,elapsed:0,cooldown:false,start:0};
  function runScan(){
    if(scanState.active||scanState.cooldown) return;
    scanState.active=true; scanState.elapsed=0; scanState.start=performance.now();
    planetUniforms.uScanActive.value=1;
    planetUniforms.uScan.value=-.05;
    scanBtns.forEach(b=>b.classList.add('is-scanning'));
    if(scanLabel) scanLabel.textContent='Scanning 00%';
    if(scanProgressBar) scanProgressBar.style.width='0%';
    makePulse('ring');
    setTimeout(()=>{ if(scanState.active) makePulse('shell'); },360);
    addLog('spectral sweep initiated / wide band');
    scanSound();
  }
  scanBtns.forEach(b=>b.addEventListener('click',runScan));
  function finishScan(){
    scanState.active=false;
    planetUniforms.uScanActive.value=0;
    scanBtns.forEach(b=>b.classList.remove('is-scanning'));
    if(scanLabel) scanLabel.textContent='Scan complete';
    if(scanProgressBar) scanProgressBar.style.width='100%';
    addLog('spectral scan complete / no anomalies');
    chime(523.25,.04);
    scanState.cooldown=true;
    setTimeout(()=>{
      scanState.cooldown=false;
      if(scanLabel) scanLabel.textContent='Run spectral scan';
      if(scanProgressBar) scanProgressBar.style.width='0%';
    },1600);
  }

  /* ---------------- orbit speed ---------------- */
  const speedInput=$('#speed'), speedOut=$('#speedOut');
  let orbitSpeed=reduce?.4:1;
  if(speedInput){
    speedInput.value=String(orbitSpeed);
    speedInput.addEventListener('input',()=>{
      orbitSpeed=Number(speedInput.value);
      if(speedOut) speedOut.textContent=orbitSpeed.toFixed(1)+'×';
      lastInteraction=performance.now();
    });
  }
  if(speedOut) speedOut.textContent=orbitSpeed.toFixed(1)+'×';

  /* ---------------- camera interaction ---------------- */
  const pointers=new Map();
  let dragging=false, moved=false, lastX=0, lastY=0;
  let pinchDist=0, pinchRadius=0;
  let hoverKey=null;
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();

  function setRay(e){
    const r=canvas.getBoundingClientRect();
    ndc.x=((e.clientX-r.left)/r.width)*2-1;
    ndc.y=-((e.clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(ndc,camera);
  }
  function pick(e){
    setRay(e);
    const hits=raycaster.intersectObjects(clickTargets,false);
    if(hits.length){
      return hits[0].object.userData.focus || null;
    }
    return null;
  }
  function setHover(key){
    if(hoverKey===key) return;
    hoverKey=key;
    if(fine && window.setCursorState) window.setCursorState(key?'Focus':'Focus',!!key);
    $$('.body-label').forEach(b=>b.classList.toggle('is-hover',key!==null&&b.dataset.focus===key));
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){
      dragging=true; moved=false; lastX=e.clientX; lastY=e.clientY;
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
      lastInteraction=performance.now();
    }else if(pointers.size===2){
      dragging=false;
      const p=[...pointers.values()];
      pinchDist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      pinchRadius=desiredRadius;
    }
  });
  canvas.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){
      const p=[...pointers.values()];
      const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      if(pinchDist>0){
        desiredRadius=Math.max(minRadius(),Math.min(28,pinchRadius*(pinchDist/Math.max(1,d))));
        moved=true;
      }
      return;
    }
    if(!dragging){
      if(e.pointerType==='mouse'){ setHover(pick(e)); }
      return;
    }
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    if(Math.abs(dx)+Math.abs(dy)>2) moved=true;
    spherical.theta-=dx*.0042;
    spherical.phi=Math.max(.32,Math.min(2.82,spherical.phi-dy*.0037));
    lastX=e.clientX; lastY=e.clientY;
    lastInteraction=performance.now();
  });
  function endPointer(e){
    const wasDragging=dragging;
    const didMove=moved;
    pointers.delete(e.pointerId);
    if(pointers.size===0){
      if(wasDragging&&!didMove){
        const key=pick(e);
        if(key) focusBody(key);
      }
      dragging=false; moved=false;
    }else if(pointers.size===1){
      const p=[...pointers.values()][0];
      dragging=true; moved=true; lastX=p.x; lastY=p.y;
    }
    setHover(null);
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',e=>{ pointers.delete(e.pointerId); dragging=false; });
  canvas.addEventListener('pointerleave',()=>{ if(!dragging) setHover(null); });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    desiredRadius=Math.max(minRadius(),Math.min(28,desiredRadius+e.deltaY*.011));
    lastInteraction=performance.now();
  },{passive:false});
  canvas.addEventListener('dblclick',()=>{ focusBody('planet',{wide:true}); });
  function minRadius(){ return focusKey==='planet'?3.35:1.15; }

  /* ---------------- labels ---------------- */
  const labelData=$$('.body-label').map(el=>({
    el,key:el.dataset.focus,ox:parseFloat(el.dataset.ox)||0,oy:parseFloat(el.dataset.oy)||0,
    object:el.dataset.focus==='planet'?planet:bodies[el.dataset.focus].object
  }));
  const v3a=new THREE.Vector3(), v3b=new THREE.Vector3();
  let exclusions=[], lastExclusion=0;
  function refreshExclusions(){
    exclusions=[];
    ['.data','.top'].forEach(sel=>{
      const el=document.querySelector(sel); if(!el) return;
      const r=el.getBoundingClientRect();
      if(r.width>0&&r.height>0) exclusions.push({l:r.left-8,t:r.top-8,r:r.right+8,b:r.bottom+8});
    });
    const c=document.querySelector('.controls');
    if(c){ const r=c.getBoundingClientRect(); exclusions.push({l:r.left,t:r.top-4,r:r.right,b:r.bottom}); }
  }
  function updateLabels(){
    if(document.body.classList.contains('no-webgl')) return;
    camera.updateMatrixWorld();
    if(performance.now()-lastExclusion>500){ lastExclusion=performance.now(); refreshExclusions(); }
    const fovRad=camera.fov*Math.PI/180;
    const planetDist=camera.position.length();
    const planetRadiusPx=(PLANET_RADIUS/(planetDist*Math.tan(fovRad/2)))*(innerHeight/2);
    const planetScreen=v3a.set(0,0,0).project(camera);
    const planetX=(planetScreen.x*.5+.5)*innerWidth;
    const planetY=(-planetScreen.y*.5+.5)*innerHeight;
    labelData.forEach(item=>{
      if(!item.object){ item.el.classList.add('is-hidden'); return; }
      item.object.getWorldPosition(v3b);
      const dist=v3b.distanceTo(camera.position);
      const proj=v3b.clone().project(camera);
      let hide=false;
      if(proj.z<-1||proj.z>1) hide=true;
      let x=(proj.x*.5+.5)*innerWidth;
      let y=(-proj.y*.5+.5)*innerHeight;
      if(x<-40||x>innerWidth+40||y<-40||y>innerHeight+40) hide=true;
      if(item.key!=='planet' && dist>planetDist*1.02){
        const dx=x-planetX, dy=y-planetY;
        if(Math.sqrt(dx*dx+dy*dy)<planetRadiusPx*.9) hide=true;
      }
      if(hide){
        item.el.classList.add('is-hidden');
      }else{
        item.el.classList.remove('is-hidden');
        const w=item.el.offsetWidth||92;
        const h=item.el.offsetHeight||18;
        x=Math.max(10,Math.min(innerWidth-w-12,x));
        y=Math.max(64,Math.min(innerHeight-104,y));
        const bx=x+item.ox, by=y+item.oy;
        const overlap=exclusions.some(r=>bx<r.r&&bx+w>r.l&&by<r.b&&by+h>r.t);
        if(overlap){ item.el.classList.add('is-hidden'); return; }
        item.el.style.transform=`translate3d(${bx}px,${by}px,0)`;
      }
    });
  }

  /* ---------------- HUD live ---------------- */
  const simClock=$('#simClock'), zoomOut=$('#zoomOut'), raEl=$('#ra'), decEl=$('#dec');
  const startStamp=performance.now();
  function updateMeta(){
    if(zoomOut) zoomOut.textContent=cameraRadius.toFixed(1);
    if(simClock){
      const s=Math.floor((performance.now()-startStamp)/1000);
      simClock.textContent=String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
    }
    if(raEl){
      const total=Math.floor((18*3600+42*60+9+spherical.theta*220)%86400);
      const h=Math.floor(total/3600),m=Math.floor(total/60)%60,sec=total%60;
      raEl.textContent=`RA ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
    }
    if(decEl){
      const deg=Math.round(-23+ (spherical.phi-1.2)*8.4);
      decEl.textContent=`DEC ${deg<0?'−':'+'}${Math.abs(deg)}° ${String(Math.floor(Math.abs(deg*2.4)%60)).padStart(2,'0')}′`;
    }
  }
  setInterval(updateMeta,1000);
  updateMeta();

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea') return;
    if(e.key==='1'){ focusBody('planet'); e.preventDefault(); }
    else if(e.key==='2'){ focusBody('luma'); e.preventDefault(); }
    else if(e.key==='3'){ focusBody('vessel'); e.preventDefault(); }
    else if(e.key==='4'){ focusBody('echo'); e.preventDefault(); }
    else if(e.key==='0'||e.key==='Escape'){ focusBody('planet',{wide:true}); e.preventDefault(); }
    else if(e.key.toLowerCase()==='s'){ runScan(); e.preventDefault(); }
    else if(e.key.toLowerCase()==='m'){ toggleSound(); e.preventDefault(); }
    else if(e.key.toLowerCase()==='r'){ focusBody('planet',{wide:true}); e.preventDefault(); }
  });

  /* ---------------- resize ---------------- */
  function resize(){
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelCap()));
    renderer.setSize(innerWidth,innerHeight);
    starUniforms.uPixelRatio.value=Math.min(devicePixelRatio||1,pixelCap());
  }
  addEventListener('resize',resize);

  /* ---------------- animation ---------------- */
  const tmpVec=new THREE.Vector3();
  const targetVec=new THREE.Vector3();
  let hudAccumulator=0;

  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.05);
    time+=dt;
    bgUniforms.uTime.value=time;
    starUniforms.uTime.value=time;
    planetUniforms.uTime.value=time;
    ringUniforms.uTime.value=time;
    planetUniforms.uCamPos.value.copy(camera.position);
    atmoMat.uniforms.uCamPos.value.copy(camera.position);
    hazeMat.uniforms.uCamPos.value.copy(camera.position);

    /* orbital motion */
    moons.forEach(m=>{
      m.angle+=m.speed*orbitSpeed*dt;
      m.mesh.position.set(Math.cos(m.angle)*m.radius,0,Math.sin(m.angle)*m.radius*m.ecc);
      m.mesh.rotation.y+=m.spin*dt;
      const hover=m.key===hoverKey?1.16:1;
      const active=m.key===focusKey?1.09:1;
      const targetScale=hover*active;
      const s=m.mesh.scale.x+(targetScale-m.mesh.scale.x)*Math.min(1,dt*9);
      m.mesh.scale.setScalar(s);
    });
    planet.rotation.y+=dt*.018;
    ring.rotation.z+=dt*.006;
    ringOuter.rotation.z-=dt*.003;
    dust.rotation.y+=dt*.012;

    /* scan pulses */
    for(let i=scanPulses.length-1;i>=0;i--){
      const p=scanPulses[i]; p.t+=dt;
      const t=Math.min(1,p.t/p.duration);
      if(p.type==='ring'){
        const sc=1+t*2.0;
        p.mesh.scale.set(sc,sc,sc);
        p.mesh.material.opacity=(1-t)*.55;
      }else{
        const sc=1+t*2.5;
        p.mesh.scale.set(sc,sc,sc);
        p.mesh.material.opacity=(1-t)*.14;
      }
      if(t>=1){
        planetSystem.remove(p.mesh);
        p.mesh.geometry.dispose(); p.mat.dispose();
        scanPulses.splice(i,1);
      }
    }
    if(scanState.active){
      scanState.elapsed=(performance.now()-scanState.start)/1000;
      const t=Math.min(1,scanState.elapsed/2.7);
      planetUniforms.uScan.value=-.05+t*1.1;
      if(scanProgressBar) scanProgressBar.style.width=(t*100).toFixed(0)+'%';
      if(scanLabel) scanLabel.textContent='Scanning '+String(Math.round(t*100)).padStart(2,'0')+'%';
      if(t>=1) finishScan();
    }

    /* camera target follows the focused body */
    if(focusObject){
      focusObject.getWorldPosition(desiredTarget);
    }else{
      desiredTarget.set(0,0,0);
    }
    camTarget.lerp(desiredTarget,1-Math.exp(-4.2*dt));
    cameraRadius+=(desiredRadius-cameraRadius)*(1-Math.exp(-4.5*dt));
    if(performance.now()-lastInteraction>6500 && !reduce){
      spherical.theta+=dt*(focusKey==='planet'?.028:.012);
    }
    const sinPhi=Math.sin(spherical.phi);
    const desiredPos=tmpVec.set(
      camTarget.x+cameraRadius*sinPhi*Math.sin(spherical.theta),
      camTarget.y+cameraRadius*Math.cos(spherical.phi),
      camTarget.z+cameraRadius*sinPhi*Math.cos(spherical.theta)
    );
    camera.position.lerp(desiredPos,1-Math.exp(-7*dt));
    camera.lookAt(camTarget);

    updateLabels();

    renderer.render(scene,camera);
    hudAccumulator+=dt;
    if(hudAccumulator>.25){
      hudAccumulator=0;
      if(zoomOut) zoomOut.textContent=cameraRadius.toFixed(1);
    }
  }

  /* ---------------- initial state ---------------- */
  camera.position.set(
    cameraRadius*Math.sin(spherical.phi)*Math.sin(spherical.theta),
    cameraRadius*Math.cos(spherical.phi),
    cameraRadius*Math.sin(spherical.phi)*Math.cos(spherical.theta)
  );
  camera.lookAt(camTarget);
  updateHUD('planet');
  focusBody('planet',{silent:true,wide:true});
  cameraRadius=15.5;
  desiredRadius=15.5;
  stampInitialLogs();
  runBoot();
  animate();
})();
