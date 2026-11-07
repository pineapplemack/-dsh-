/* MACKOWN SIGNAL — radio, sequencer and soft synth */
(function(){
  "use strict";
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------------- time ---------------- */
  const clock = $('#clock');
  function tickClock(){
    if(!clock) return;
    clock.textContent = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date());
  }
  tickClock(); setInterval(tickClock,1000);

  /* ---------------- cursor ---------------- */
  const cursor = $('#cursor');
  if(fine && cursor){
    let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
    addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
    (function loop(){
      cx+=(mx-cx)*.2; cy+=(my-cy)*.2;
      cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover',e=>{
      if(e.target.closest('a,button,input,[role="button"]')) cursor.classList.add('is-active');
    });
    document.addEventListener('pointerout',e=>{
      if(!e.relatedTarget || !e.relatedTarget.closest('a,button,input,[role="button"]')) cursor.classList.remove('is-active');
    });
  }

  /* ---------------- reveal ---------------- */
  const reveals = $$('.reveal');
  if('IntersectionObserver' in window && !reduce){
    const io = new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } });
    },{threshold:.1,rootMargin:'0px 0px -7% 0px'});
    reveals.forEach(el=>io.observe(el));
  }else{
    reveals.forEach(el=>el.classList.add('is-in'));
  }

  /* ================================================================
     AUDIO
  ================================================================ */
  let ctx=null, master=null, analyser=null, noiseBuffer=null, pad=null;
  let timer=null, nextTime=0, step=0, progressTimer=null;
  const state = {
    playing:false, bpm:96, track:0, accent:'#d3ff45',
    elapsed:0, duration:227, custom:false, step:-1
  };

  function ensureAudio(){
    if(ctx){
      if(ctx.state==='suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = .62;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .22;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; analyser.smoothingTimeConstant = .82;
      master.connect(comp);
      comp.connect(analyser);
      analyser.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate*1.6);
      noiseBuffer = ctx.createBuffer(1,len,ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for(let i=0;i<len;i++) data[i] = Math.random()*2-1;
      if(ctx.state==='suspended') ctx.resume();
      return ctx;
    }catch(e){
      ctx = null; return null;
    }
  }

  function kick(t){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(155,t);
    o.frequency.exponentialRampToValueAtTime(43,t+.19);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.8,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+.34);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+.36);
  }
  function snare(t){
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1300;
    const g=ctx.createGain();
    g.gain.setValueAtTime(.28,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.23);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(t); src.stop(t+.25);
  }
  function hat(t){
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7200;
    const g=ctx.createGain();
    g.gain.setValueAtTime(.12,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.045);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(t); src.stop(t+.06);
  }
  function clap(t){
    for(let i=0;i<3;i++){
      const src=ctx.createBufferSource(); src.buffer=noiseBuffer;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1500; bp.Q.value=1.4;
      const g=ctx.createGain(); const at=t+i*.015;
      g.gain.setValueAtTime(.14,at);
      g.gain.exponentialRampToValueAtTime(.0001,at+.11);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(at); src.stop(at+.13);
    }
  }

  function startPad(){
    if(!ctx) return;
    stopPad(0.35);
    const chord = Tracks[state.track].chord;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(.0001,t);
    bus.gain.exponentialRampToValueAtTime(.055,t+1.8);
    const filter = ctx.createBiquadFilter();
    filter.type='lowpass'; filter.frequency.value=720; filter.Q.value=.7;
    chord.forEach((f,i)=>{
      const o=ctx.createOscillator();
      o.type = i===0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i-1)*4;
      const g=ctx.createGain(); g.gain.value = i===0 ? .5 : .22;
      o.connect(g); g.connect(filter); o.start(t);
      bus._oscs = bus._oscs || [];
      bus._oscs.push(o);
    });
    filter.connect(bus); bus.connect(master);
    const nsrc=ctx.createBufferSource(); nsrc.buffer=noiseBuffer; nsrc.loop=true;
    const nf=ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1100; nf.Q.value=.4;
    const ng=ctx.createGain(); ng.gain.value=.012;
    nsrc.connect(nf); nf.connect(ng); ng.connect(master); nsrc.start(t);
    bus._noise = nsrc;
    pad = bus;
  }
  function stopPad(fade=1.1){
    if(!pad || !ctx) return;
    const old=pad; pad=null;
    const t=ctx.currentTime;
    try{
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(Math.max(old.gain.value,.0001),t);
      old.gain.exponentialRampToValueAtTime(.0001,t+fade);
    }catch(e){}
    (old._oscs||[]).forEach(o=>{ try{ o.stop(t+fade+.1); }catch(e){} });
    if(old._noise){ try{ old._noise.stop(t+fade+.1); }catch(e){} }
  }

  function playStep(i,t){
    const p=pattern;
    if(p.kick[i]) kick(t);
    if(p.snare[i]) snare(t);
    if(p.hat[i]) hat(t);
    if(p.clap[i]) clap(t);
  }
  function scheduler(){
    if(!state.playing || !ctx) return;
    while(nextTime < ctx.currentTime + .12){
      playStep(step,nextTime);
      const delay = Math.max(0,(nextTime-ctx.currentTime)*1000);
      const s=step;
      setTimeout(()=>{ if(state.playing) setPlayhead(s); },delay);
      nextTime += (60/state.bpm)/4;
      step = (step+1)%16;
    }
    timer=setTimeout(scheduler,24);
  }
  function startTransport(){
    if(!ensureAudio()) return;
    if(ctx.state==='suspended') ctx.resume();
    if(state.playing) return;
    state.playing=true;
    step=0;
    nextTime=ctx.currentTime+.06;
    startPad();
    scheduler();
    updateTransportUI();
    runProgress();
  }
  function stopTransport(){
    if(!state.playing) return;
    state.playing=false;
    clearTimeout(timer);
    stopPad();
    updateTransportUI();
    setPlayhead(-1);
    clearInterval(progressTimer);
    progressTimer=null;
  }
  function toggleTransport(){
    if(state.playing) stopTransport(); else startTransport();
  }

  /* ================================================================
     PATTERNS / TRACKS
  ================================================================ */
  const Tracks = [
    {
      title:'Bedroom Static', bpm:96, duration:227, chord:[110.00,164.81,220.00],
      pattern:{
        kick:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
        clap:[0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,1]
      }
    },
    {
      title:'Glass Elevator', bpm:112, duration:252, chord:[98.00,146.83,196.00],
      pattern:{
        kick:[1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
        clap:[0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0]
      }
    },
    {
      title:'Three AM Weather', bpm:78, duration:178, chord:[82.41,123.47,164.81],
      pattern:{
        kick:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
        hat:[0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
        clap:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0]
      }
    },
    {
      title:'Soft Static', bpm:100, duration:320, chord:[130.81,196.00,261.63],
      pattern:{
        kick:[1,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
        snare:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        hat:[0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
        clap:[0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0]
      }
    }
  ];

  const instrumentDefs = [
    {id:'kick', label:'Kick', num:'01'},
    {id:'snare', label:'Snare', num:'02'},
    {id:'hat', label:'Hat', num:'03'},
    {id:'clap', label:'Clap', num:'04'}
  ];
  let pattern = JSON.parse(JSON.stringify(Tracks[0].pattern));
  const stepButtons = {};

  function buildSequencer(){
    const host = $('#sequencer');
    if(!host) return;
    host.innerHTML='';
    instrumentDefs.forEach(inst=>{
      const row=document.createElement('div');
      row.className='seq-row';
      row.dataset.track=inst.id;
      const name=document.createElement('div');
      name.className='seq-name';
      name.innerHTML = `<b>${inst.num}</b><i class="name-dot"></i><span>${inst.label}</span>`;
      const steps=document.createElement('div');
      steps.className='seq-steps';
      const arr=[];
      for(let i=0;i<16;i++){
        const b=document.createElement('button');
        b.className='step';
        b.type='button';
        b.setAttribute('aria-label',`${inst.label} step ${i+1}`);
        b.setAttribute('aria-pressed','false');
        b.dataset.step=i;
        b.addEventListener('click',()=>{
          pattern[inst.id][i] = pattern[inst.id][i] ? 0 : 1;
          b.classList.toggle('active',!!pattern[inst.id][i]);
          b.setAttribute('aria-pressed',String(!!pattern[inst.id][i]));
          markCustom();
        });
        steps.appendChild(b); arr.push(b);
      }
      row.appendChild(name); row.appendChild(steps); host.appendChild(row);
      stepButtons[inst.id]=arr;
    });
    syncPattern();
  }
  function syncPattern(){
    instrumentDefs.forEach(inst=>{
      const arr=stepButtons[inst.id]||[];
      for(let i=0;i<16;i++){
        if(!arr[i]) continue;
        const on=!!pattern[inst.id][i];
        arr[i].classList.toggle('active',on);
        arr[i].setAttribute('aria-pressed',String(on));
      }
    });
  }
  function setPlayhead(i){
    state.step=i;
    Object.values(stepButtons).forEach(arr=>arr.forEach((b,j)=>b.classList.toggle('is-now',j===i)));
    const readout=$('#stepReadout');
    if(readout) readout.textContent = i<0 ? 'STEP --' : 'STEP '+String(i+1).padStart(2,'0');
  }
  function setPattern(p){
    pattern = JSON.parse(JSON.stringify(p));
    syncPattern();
  }
  function markCustom(){
    state.custom=true;
    const t=$('#nowTitle'), m=$('#nowMeta');
    if(t) t.textContent='Untitled Pattern';
    if(m) m.textContent='MACKOWN — LIVE EDIT / '+state.bpm+' BPM';
    $$('.track').forEach(x=>x.classList.remove('is-current'));
    state.elapsed=0; updateProgress();
  }

  /* ---------------- transport UI ---------------- */
  const playMain=$('#playMain'), machinePlay=$('#machinePlay');
  const playIcon=$('#playIcon'), playLabel=$('#playLabel');
  const machineIcon=$('#machineIcon'), machinePlayLabel=$('#machinePlayLabel');
  const vinyl=$('#vinyl'), tonearm=$('#tonearm');
  const playSVG='<svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5Z" fill="currentColor"/></svg>';
  const pauseSVG='<svg viewBox="0 0 24 24" fill="none"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

  function updateTransportUI(){
    [playMain,machinePlay].forEach(b=>{
      if(!b) return;
      b.classList.toggle('is-playing',state.playing);
      b.setAttribute('aria-pressed',String(state.playing));
    });
    if(playIcon) playIcon.innerHTML = state.playing ? pauseSVG : playSVG;
    if(playLabel) playLabel.textContent = state.playing ? 'Pause' : 'Play';
    if(machineIcon) machineIcon.textContent = state.playing ? '❚❚' : '▶';
    if(machinePlayLabel) machinePlayLabel.textContent = state.playing ? 'Pause loop' : 'Start loop';
    if(vinyl) vinyl.classList.toggle('is-playing',state.playing);
    if(tonearm) tonearm.classList.toggle('is-playing',state.playing);
    if(!state.playing){ setPlayhead(-1); }
  }
  if(playMain) playMain.addEventListener('click', toggleTransport);
  if(machinePlay) machinePlay.addEventListener('click', toggleTransport);

  /* ---------------- progress ---------------- */
  function fmt(sec){
    sec=Math.max(0,Math.floor(sec));
    return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  }
  function updateProgress(){
    const bar=$('#progressBar'), time=$('#progressTime'), total=$('#totalTime');
    if(bar) bar.style.width = Math.min(100,(state.elapsed/state.duration)*100)+'%';
    if(time) time.textContent = fmt(state.elapsed);
    if(total) total.textContent = fmt(state.duration);
  }
  function runProgress(){
    clearInterval(progressTimer);
    progressTimer=setInterval(()=>{
      if(!state.playing) return;
      state.elapsed++;
      if(state.elapsed>=state.duration) state.elapsed=0;
      updateProgress();
    },1000);
  }

  /* ---------------- track selection ---------------- */
  const nowTitle=$('#nowTitle'), nowMeta=$('#nowMeta');
  function selectTrack(i, autoplay=true){
    const tr=Tracks[i];
    if(!tr) return;
    state.track=i; state.bpm=tr.bpm; state.duration=tr.duration; state.elapsed=0; state.custom=false;
    setPattern(tr.pattern);
    if(nowTitle) nowTitle.textContent=tr.title;
    if(nowMeta) nowMeta.textContent='MACKOWN — SIDE A / '+tr.bpm+' BPM';
    const bpmInput=$('#bpm'), bpmOut=$('#bpmOut');
    if(bpmInput) bpmInput.value=tr.bpm;
    if(bpmOut) bpmOut.textContent=tr.bpm;
    updateProgress();
    $$('.track').forEach((el,j)=>{
      el.classList.toggle('active',j===i);
      el.classList.toggle('is-current',j===i);
    });
    if(autoplay){
      if(state.playing){ stopPad(.4); setTimeout(()=>{ if(state.playing) startPad(); },120); }
      else startTransport();
    }
  }
  $$('.track').forEach(btn=>{
    btn.addEventListener('click',()=>selectTrack(Number(btn.dataset.track),true));
  });

  /* ---------------- generate / clear ---------------- */
  function generatePattern(){
    const probs={kick:.26,snare:.17,hat:.34,clap:.07};
    const next={kick:Array(16).fill(0),snare:Array(16).fill(0),hat:Array(16).fill(0),clap:Array(16).fill(0)};
    instrumentDefs.forEach(inst=>{
      for(let i=0;i<16;i++) next[inst.id][i] = Math.random()<probs[inst.id]?1:0;
    });
    next.kick[0]=1;
    if(!next.snare[4]&&!next.snare[12]) next.snare[4]=1;
    pattern=next; syncPattern(); markCustom();
  }
  const gen=$('#generate'); if(gen) gen.addEventListener('click',generatePattern);
  const clr=$('#clearGrid');
  if(clr) clr.addEventListener('click',()=>{
    pattern={kick:Array(16).fill(0),snare:Array(16).fill(0),hat:Array(16).fill(0),clap:Array(16).fill(0)};
    syncPattern(); markCustom();
  });

  /* ---------------- bpm ---------------- */
  const bpmInput=$('#bpm'), bpmOut=$('#bpmOut');
  if(bpmInput){
    bpmInput.addEventListener('input',()=>{
      state.bpm=Number(bpmInput.value);
      if(bpmOut) bpmOut.textContent=String(state.bpm);
      const m=$('#nowMeta');
      if(m && state.custom) m.textContent='MACKOWN — LIVE EDIT / '+state.bpm+' BPM';
    });
  }

  /* ================================================================
     TUNER
  ================================================================ */
  const Stations=[
    {freq:89.3,name:'MACKOWN SIGNAL',note:'clear skies, low signal',accent:'#d3ff45'},
    {freq:96.7,name:'GLASS ELEVATOR',note:'going up, slowly, forever',accent:'#ff7a3d'},
    {freq:104.2,name:'SUNDAY SERVICE',note:'hymns for the happily late',accent:'#ffb1d9'}
  ];
  const tuner=$('#tuner'), needle=$('#needle'), freqOut=$('#freqOut');
  const stationName=$('#stationName'), stationNote=$('#stationNote');
  const labelFreq=$('#labelFreq'), captionFreq=$('#captionFreq');
  function applyAccent(accent){
    state.accent=accent;
    document.documentElement.style.setProperty('--acid',accent);
  }
  function setFrequency(value, fromPreset=false){
    value=Math.max(88,Math.min(108,Number(value)));
    if(tuner && !fromPreset) tuner.value=String(value);
    if(freqOut) freqOut.textContent=value.toFixed(1);
    if(needle) needle.style.left=((value-88)/20*100)+'%';
    if(labelFreq) labelFreq.textContent=value.toFixed(1);
    if(captionFreq) captionFreq.textContent=value.toFixed(1)+' FM';
    let found=null;
    Stations.forEach(s=>{ if(Math.abs(s.freq-value) <= .22) found=s; });
    $$('.preset').forEach(p=>p.classList.toggle('active',found && Math.abs(Number(p.dataset.freq)-value)<.001));
    if(found){
      if(stationName) stationName.textContent=found.name;
      if(stationNote) stationNote.textContent=found.note;
      applyAccent(found.accent);
    }else{
      if(stationName) stationName.textContent='UNIDENTIFIED SIGNAL';
      if(stationNote) stationNote.textContent='static, and something underneath';
      applyAccent('#b7b9a7');
    }
  }
  if(tuner){
    tuner.addEventListener('input',()=>setFrequency(tuner.value));
    setFrequency(tuner.value,true);
  }
  $$('.preset').forEach(p=>{
    p.addEventListener('click',()=>{
      setFrequency(Number(p.dataset.freq));
    });
  });

  /* ================================================================
     SCOPE
  ================================================================ */
  const scope=$('#scope');
  let sctx=null, dataArray=null, scopeW=0, scopeH=0, dpr=1;
  function resizeScope(){
    if(!scope) return;
    const r=scope.getBoundingClientRect();
    dpr=Math.min(devicePixelRatio||1,2);
    scopeW=Math.max(1,r.width); scopeH=Math.max(1,r.height);
    scope.width=Math.floor(scopeW*dpr); scope.height=Math.floor(scopeH*dpr);
    sctx=scope.getContext('2d');
    if(sctx) sctx.setTransform(dpr,0,0,dpr,0,0);
    if(analyser) dataArray=new Uint8Array(analyser.fftSize);
  }
  if(scope){
    resizeScope();
    new ResizeObserver(resizeScope).observe(scope);
    addEventListener('resize',resizeScope);
  }
  function hexA(hex,a){
    const h=hex.replace('#','');
    const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function drawScope(ts){
    requestAnimationFrame(drawScope);
    if(!sctx || !scopeW) return;
    sctx.clearRect(0,0,scopeW,scopeH);
    const acc=state.accent;
    sctx.strokeStyle=hexA(acc,.13);
    sctx.lineWidth=1;
    for(let y=1;y<4;y++){
      sctx.beginPath();sctx.moveTo(0,scopeH*y/4);sctx.lineTo(scopeW,scopeH*y/4);sctx.stroke();
    }
    sctx.beginPath();
    if(state.playing && analyser && dataArray){
      analyser.getByteTimeDomainData(dataArray);
      const n=dataArray.length;
      for(let i=0;i<n;i+=3){
        const x=(i/(n-1))*scopeW;
        const y=scopeH/2 + ((dataArray[i]-128)/128)*scopeH*.37;
        if(i===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
      }
    }else{
      const t=ts*.001;
      for(let x=0;x<=scopeW;x+=2){
        const p=x/scopeW;
        const env=Math.sin(p*Math.PI);
        const y=scopeH/2 + (Math.sin(p*13+t*1.4)*.24 + Math.sin(p*29-t*.9)*.08)*scopeH*env;
        if(x===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
      }
    }
    sctx.strokeStyle=acc;
    sctx.lineWidth=1.1;
    sctx.shadowColor=hexA(acc,.5);
    sctx.shadowBlur=8;
    sctx.stroke();
    sctx.shadowBlur=0;
    sctx.beginPath();
    const t=ts*.001;
    for(let x=0;x<=scopeW;x+=3){
      const p=x/scopeW;
      const y=scopeH/2 + Math.sin(p*7-t*.6)*scopeH*.12;
      if(x===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
    }
    sctx.strokeStyle=hexA(acc,.22);
    sctx.lineWidth=.7;
    sctx.stroke();
  }
  if(scope) requestAnimationFrame(drawScope);

  /* ================================================================
     PIANO
  ================================================================ */
  const toneTypes=[{type:'triangle',name:'SOFT'},{type:'sawtooth',name:'BRIGHT'},{type:'square',name:'DUST'}];
  let toneIndex=0;
  const pianoTone=$('#pianoTone');
  if(pianoTone){
    pianoTone.addEventListener('click',()=>{
      toneIndex=(toneIndex+1)%toneTypes.length;
      pianoTone.textContent='TONE / '+toneTypes[toneIndex].name;
      if(ensureAudio()){
        const v=noteOn(440,0.22);
        setTimeout(()=>noteOff(v),240);
      }
    });
  }
  const keyEls=$$('.pkey,.bkey');
  const keyMap={};
  keyEls.forEach(el=>{ keyMap[el.dataset.key]=el; });

  function noteOn(freq,vol=.15){
    if(!ensureAudio()) return null;
    if(ctx.state==='suspended') ctx.resume();
    const t=ctx.currentTime;
    const o1=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
    o1.type=toneTypes[toneIndex].type; o1.frequency.value=freq;
    o2.type='sine'; o2.frequency.value=freq*2.005;
    f.type='lowpass'; f.frequency.value=1600; f.Q.value=.6;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+.018);
    g.gain.exponentialRampToValueAtTime(vol*.62,t+.28);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(t); o2.start(t);
    return {o1,o2,g,released:false};
  }
  function noteOff(v){
    if(!v||v.released||!ctx) return;
    v.released=true;
    const t=ctx.currentTime;
    try{
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(Math.max(v.g.gain.value,.0001),t);
      v.g.gain.exponentialRampToValueAtTime(.0001,t+.4);
    }catch(e){}
    setTimeout(()=>{try{v.o1.stop();v.o2.stop();}catch(e){}},430);
  }
  function pressKey(el){
    if(!el || el._voice) return;
    const voice=noteOn(Number(el.dataset.freq),.16);
    if(!voice) return;
    el._voice=voice;
    el.classList.add('is-active');
  }
  function releaseKey(el){
    if(!el || !el._voice) return;
    noteOff(el._voice); el._voice=null;
    el.classList.remove('is-active');
  }
  keyEls.forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      try{ el.setPointerCapture(e.pointerId); }catch(err){}
      pressKey(el);
    });
    el.addEventListener('pointerup',()=>releaseKey(el));
    el.addEventListener('pointercancel',()=>releaseKey(el));
    el.addEventListener('lostpointercapture',()=>releaseKey(el));
    el.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse' && e.buttons===0) releaseKey(el); });
    el.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pressKey(el); }
    });
    el.addEventListener('keyup',e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); releaseKey(el); }
    });
    el.addEventListener('blur',()=>releaseKey(el));
  });
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.metaKey||e.ctrlKey||e.altKey) return;
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select') return;
    const key=e.key.toLowerCase();
    const el=keyMap[key];
    if(el){ e.preventDefault(); pressKey(el); }
  });
  document.addEventListener('keyup',e=>{
    const key=e.key.toLowerCase();
    const el=keyMap[key];
    if(el){ e.preventDefault(); releaseKey(el); }
  });
  addEventListener('blur',()=>keyEls.forEach(releaseKey));

  /* ---------------- initial drawing ---------------- */
  buildSequencer();
  selectTrack(0,false);
  updateProgress();
  updateTransportUI();

  /* ---------------- tiny tuning flavour ---------------- */
  if(tuner){
    tuner.addEventListener('change',()=>{
      if(state.playing && ctx && master){
        const t=ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value,t);
        master.gain.linearRampToValueAtTime(.18,t+.05);
        master.gain.linearRampToValueAtTime(.62,t+.35);
      }
    });
  }
})();
