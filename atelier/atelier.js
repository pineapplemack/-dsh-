/* MACKOWN ATELIER — interactions */
(function(){
  "use strict";
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  /* ---------------- time ---------------- */
  const clock = $('#clock');
  const contactClock = $('#contactClock');
  function time(){
    const now = new Date();
    const full = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(now);
    const short = full.slice(0,5);
    if(clock) clock.textContent = full;
    if(contactClock) contactClock.textContent = 'Shanghai · ' + short;
  }
  time(); setInterval(time, 1000);

  /* ---------------- lights ---------------- */
  const lamp = $('#lamp');
  const lampLabel = $('#lampLabel');
  let night = false;
  try{ night = localStorage.getItem('mackown-atelier-night') === '1'; }catch(e){}
  function setNight(on, save=true){
    night = on;
    document.body.classList.toggle('night', on);
    lamp.setAttribute('aria-pressed', String(on));
    if(lampLabel) lampLabel.textContent = on ? 'Day' : 'Night';
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', on ? '#151512' : '#e7e0d4');
    if(save){ try{ localStorage.setItem('mackown-atelier-night', on ? '1' : '0'); }catch(e){} }
  }
  if(lamp){
    setNight(night, false);
    lamp.addEventListener('click', ()=>setNight(!night));
  }

  /* ---------------- mobile menu ---------------- */
  const menuBtn = $('#menuBtn');
  const nav = $('#mainNav');
  function setMenu(open){
    if(!menuBtn || !nav) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }
  if(menuBtn){
    menuBtn.addEventListener('click', ()=>setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    $$('a', nav).forEach(a=>a.addEventListener('click', ()=>setMenu(false)));
  }
  window.addEventListener('resize', ()=>{ if(innerWidth > 980) setMenu(false); });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') setMenu(false); });

  /* ---------------- cursor ---------------- */
  const cursor = $('#cursor');
  const cursorLabel = $('#cursorLabel');
  let mx = innerWidth/2, my = innerHeight/2, cx = mx, cy = my;
  if(fine && cursor){
    addEventListener('pointermove', e=>{ mx=e.clientX; my=e.clientY; }, {passive:true});
    function loop(){
      cx += (mx-cx)*.22; cy += (my-cy)*.22;
      cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    }
    loop();
    function label(text, active){
      if(!cursorLabel) return;
      cursorLabel.textContent = text;
      cursor.classList.toggle('is-view', active);
    }
    $$('.plate').forEach(el=>{
      el.addEventListener('pointerenter',()=>label('View', true));
      el.addEventListener('pointerleave',()=>label('View', false));
      el.addEventListener('focus',()=>label('View', true));
      el.addEventListener('blur',()=>label('View', false));
    });
    $$('.main-nav a,.back-link,.contact-mail').forEach(el=>{
      el.addEventListener('pointerenter',()=>label('Open', false));
      el.addEventListener('pointerleave',()=>label('View', false));
    });
  }

  /* ---------------- scroll header ---------------- */
  const head = $('#siteHead');
  function onScroll(){
    if(head) head.classList.toggle('is-scrolled', scrollY > 30);
  }
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  /* ---------------- reveals ---------------- */
  const reveals = $$('.reveal');
  if('IntersectionObserver' in window && !reduce){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },{threshold:.12, rootMargin:'0px 0px -7% 0px'});
    reveals.forEach((el,i)=>{
      const heroIndex = Array.from(el.closest('.hero') ? el.closest('.hero').querySelectorAll('.reveal') : []).indexOf(el);
      if(heroIndex >= 0) el.style.transitionDelay = `${100 + heroIndex*75}ms`;
      io.observe(el);
    });
  }else{
    reveals.forEach(el=>el.classList.add('is-in'));
  }

  /* ---------------- hero artwork ---------------- */
  const tilt = $('#tilt');
  const frame = $('#hvFrame');
  const disc = $('#disc');
  const dragHint = $('#dragHint');
  if(fine && tilt && frame && !reduce){
    tilt.addEventListener('pointermove', e=>{
      const r = tilt.getBoundingClientRect();
      const nx = (e.clientX-r.left)/r.width-.5;
      const ny = (e.clientY-r.top)/r.height-.5;
      frame.style.transform = `rotateX(${-ny*4.2}deg) rotateY(${nx*5.4}deg) translateY(${-ny*4}px)`;
    });
    tilt.addEventListener('pointerleave', ()=>{ frame.style.transform=''; });
  }
  if(disc){
    let dragging=false, sx=0, sy=0, dx=0, dy=0, moved=false;
    const apply = ()=>{
      disc.style.setProperty('--dx', dx+'px');
      disc.style.setProperty('--dy', dy+'px');
    };
    disc.addEventListener('pointerdown', e=>{
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      disc.classList.add('is-dragging');
      disc.setPointerCapture(e.pointerId);
    });
    disc.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const mxv = e.clientX-sx, myv = e.clientY-sy;
      if(Math.abs(mxv)+Math.abs(myv) > 6) moved = true;
      dx = Math.max(-52, Math.min(52, mxv*.72));
      dy = Math.max(-52, Math.min(52, myv*.72));
      apply();
    });
    function endDrag(e){
      if(!dragging) return;
      dragging = false;
      disc.classList.remove('is-dragging');
      if(disc.hasPointerCapture(e.pointerId)) disc.releasePointerCapture(e.pointerId);
      if(moved && dragHint){
        dragHint.textContent = 'A little off-centre / 刚刚好';
        setTimeout(()=>{ if(dragHint) dragHint.textContent = 'Drag the sun · 拖动太阳'; }, 2600);
      }
    }
    disc.addEventListener('pointerup', endDrag);
    disc.addEventListener('pointercancel', endDrag);
    disc.addEventListener('dblclick', ()=>{ dx=0; dy=0; apply(); });
  }

  /* ---------------- projects ---------------- */
  const projects = [
    {
      title:'Salt, Wind, Repeat', year:'2026', type:'Campaign · Film',
      desc:'A campaign for a slow-travel collective, shot over four mornings on the Fujian coast. We chased the same five kilometres of shoreline until the weather agreed to become part of the story.',
      role:'Art direction, photography, film edit',
      collab:'O—D Studio, Lin Wei (film), Salt Co.',
      note:'The final edit is five minutes of almost nothing. It is the most watched thing I have made.'
    },
    {
      title:'Fold No. 4', year:'2025', type:'Identity · Publishing',
      desc:'A small press for essays that refuse to fit neatly. The identity folds: one mark, three states, a spine that changes colour with every title. The fourth issue is about the things we keep in drawers.',
      role:'Identity system, editorial design, type',
      collab:'Object Press, 22 contributors',
      note:'Print run of 600. The red insert was a happy accident at the risograph.'
    },
    {
      title:'Aperture', year:'2025', type:'Film · Title design',
      desc:'Titles and poster world for a short film about a woman who photographs empty rooms. Aperture is an exercise in opening and closing: circles that contract as the story does, type that keeps its distance.',
      role:'Title design, poster, motion direction',
      collab:'Director June Lam, A24 (no, not that one)',
      note:'Seven minutes twelve. We watched it thirty-eight times in the grade.'
    },
    {
      title:'Tide Index', year:'2024', type:'Editorial · Art direction',
      desc:'An independent journal mapping the emotional weather of the East China Sea. Each issue is set around a tide table, printed in two inks, and designed to be read in one sitting beside water.',
      role:'Art direction, editorial system, image edit',
      collab:'Tide Index editorial, 9 writers',
      note:'The grid is built from the lunar cycle. You can feel it, even if you cannot see it.'
    },
    {
      title:'The Long Table', year:'2023', type:'Hospitality · Brand',
      desc:'A supper club that began in a Shanghai apartment and grew into a restaurant. The brand is a table you are always welcome at: warm clay, generous type, one long line from the door to the kitchen.',
      role:'Brand identity, menus, environment',
      collab:'Chef Miao, Studio June',
      note:'The menu prints every week. The mark stays the same, which is the point.'
    },
    {
      title:'Loose Ends', year:'2022', type:'Publication · Self-initiated',
      desc:'A self-published collection of unfinished things: abandoned essays, half-plans, photographs I could not throw away. Printed as an edition of 150 and given to people who might finish something of their own.',
      role:'Editor, designer, publisher',
      collab:'25 contributors, one very patient printer',
      note:'No index. No conclusion. It remains my favourite thing with my name on it.'
    }
  ];

  const modal = $('#projectModal');
  const modalArt = $('#modalArt');
  const modalIndex = $('#modalIndex');
  const modalTitle = $('#modalTitle');
  const modalYear = $('#modalYear');
  const modalType = $('#modalType');
  const modalDesc = $('#modalDesc');
  const modalRole = $('#modalRole');
  const modalCollab = $('#modalCollab');
  const modalNote = $('#modalNote');
  const modalClose = $('#modalClose');
  let current = 0, lastFocus = null;

  function renderProject(i){
    current = (i + projects.length) % projects.length;
    const p = projects[current];
    const plate = document.querySelector(`.plate[data-project="${current}"] .plate-art`);
    if(modalArt && plate){
      modalArt.innerHTML = '';
      modalArt.appendChild(plate.cloneNode(true));
    }
    if(modalIndex) modalIndex.textContent = String(current+1).padStart(2,'0') + ' / ' + String(projects.length).padStart(2,'0');
    if(modalTitle) modalTitle.textContent = p.title;
    if(modalYear) modalYear.textContent = p.year;
    if(modalType) modalType.textContent = p.type;
    if(modalDesc) modalDesc.textContent = p.desc;
    if(modalRole) modalRole.textContent = p.role;
    if(modalCollab) modalCollab.textContent = p.collab;
    if(modalNote) modalNote.textContent = p.note;
  }
  function openProject(i, trigger){
    if(!modal) return;
    lastFocus = trigger || document.activeElement;
    renderProject(i);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    setTimeout(()=>{ if(modalClose) modalClose.focus(); }, 60);
    modalIndex && (modalIndex.style.color = 'var(--red)');
  }
  function closeProject(){
    if(!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
    if(lastFocus && lastFocus.classList) lastFocus.focus();
  }
  $$('.plate').forEach(plate=>{
    plate.addEventListener('click', ()=>openProject(Number(plate.dataset.project), plate));
  });
  $$('[data-project]').forEach(el=>{
    if(!el.classList.contains('plate')) el.addEventListener('click', ()=>openProject(Number(el.dataset.project), el));
  });
  if(modalClose) modalClose.addEventListener('click', closeProject);
  $$('[data-close]').forEach(el=>el.addEventListener('click', closeProject));
  const prev = $('#prevProject'), next = $('#nextProject');
  if(prev) prev.addEventListener('click', ()=>renderProject(current-1));
  if(next) next.addEventListener('click', ()=>renderProject(current+1));
  document.addEventListener('keydown', e=>{
    if(!modal || !modal.classList.contains('is-open')) return;
    if(e.key === 'Escape'){ closeProject(); return; }
    if(e.key === 'ArrowLeft'){ renderProject(current-1); return; }
    if(e.key === 'ArrowRight'){ renderProject(current+1); return; }
    if(e.key === 'Tab'){
      const f = $$('button,[href],input,[tabindex]:not([tabindex="-1"])', modal).filter(x=>x.offsetParent!==null);
      if(!f.length) return;
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- poster machine ---------------- */
  const palettes = [
    {bg:'#e7e0d4', ink:'#191814', accent:'#b43f2b'},
    {bg:'#191814', ink:'#e7e0d4', accent:'#c9f64d'},
    {bg:'#c4d1cf', ink:'#1e3436', accent:'#ef6c3a'},
    {bg:'#c17745', ink:'#f0e6d2', accent:'#273d65'},
    {bg:'#263c5b', ink:'#e8e2d3', accent:'#d2583d'}
  ];
  const phrases = [
    {a:'soft',b:'focus',c:'/ 04',small:'A study in the almost<br>MACKOWN EDITIONS',no:'M—026'},
    {a:'warm',b:'error',c:'/ 07',small:'Notes on getting it<br>beautifully wrong',no:'M—031'},
    {a:'slow',b:'light',c:'/ 02',small:'An afternoon, held<br>longer than necessary',no:'M—012'},
    {a:'almost',b:'there',c:'/ 11',small:'A poster for the<br>last five minutes',no:'M—044'},
    {a:'after',b:'hours',c:'/ 09',small:'For rooms with<br>the lamps still on',no:'M—019'},
    {a:'tender',b:'noise',c:'/ 03',small:'A small edition<br>about feeling things',no:'M—007'}
  ];
  const poster = $('#poster');
  const posterType = $('#posterType');
  const posterSmall = $('#posterSmall');
  const posterNo = $('#posterNo');
  const posterShape = $('#posterShape');
  const intensity = $('#intensity');
  const intensityOut = $('#intensityOut');
  const remix = $('#remix');
  const swatches = $$('.swatch');
  let pState = {palette:0, phrase:0, font:0, align:0, shape:0, intensity:48};

  function applyPoster(soft=false){
    if(!poster) return;
    const pal = palettes[pState.palette];
    const ph = phrases[pState.phrase];
    poster.style.setProperty('--poster-bg', pal.bg);
    poster.style.setProperty('--poster-ink', pal.ink);
    poster.style.setProperty('--poster-accent', pal.accent);
    poster.style.setProperty('--intensity', pState.intensity);
    poster.dataset.font = String(pState.font);
    poster.dataset.align = String(pState.align);
    poster.dataset.shape = String(pState.shape);
    posterType.innerHTML = `<span class="pt-a">${ph.a}</span><span class="pt-b">${ph.b}</span><span class="pt-c">${ph.c}</span>`;
    posterSmall.innerHTML = ph.small;
    posterNo.textContent = ph.no;
    if(intensity) intensity.value = pState.intensity;
    if(intensityOut) intensityOut.textContent = String(pState.intensity);
    swatches.forEach((s,i)=>s.classList.toggle('active', i===pState.palette));
    if(!soft && !reduce){
      poster.animate(
        [{transform:poster.style.transform||'rotate(0deg) scale(1)'},{transform:'rotate(1.4deg) scale(1.012)'},{transform:poster.style.transform||'rotate(0deg) scale(1)'}],
        {duration:520,easing:'cubic-bezier(.22,.61,.36,1)'}
      );
    }
  }
  function remixPoster(){
    if(!poster) return;
    const old = {...pState};
    pState.palette = Math.floor(Math.random()*palettes.length);
    pState.phrase = Math.floor(Math.random()*phrases.length);
    pState.font = Math.floor(Math.random()*3);
    pState.align = Math.floor(Math.random()*3);
    pState.shape = Math.floor(Math.random()*4);
    pState.intensity = 18 + Math.floor(Math.random()*73);
    if(pState.palette===old.palette) pState.palette=(pState.palette+2)%palettes.length;
    if(pState.phrase===old.phrase) pState.phrase=(pState.phrase+1)%phrases.length;
    applyPoster();
  }
  swatches.forEach((s,i)=>s.addEventListener('click',()=>{
    pState.palette=i; applyPoster();
  }));
  if(intensity) intensity.addEventListener('input',()=>{
    pState.intensity = Number(intensity.value);
    if(intensityOut) intensityOut.textContent = intensity.value;
    poster.style.setProperty('--intensity', pState.intensity);
  });
  if(remix) remix.addEventListener('click', remixPoster);
  if(poster){
    let down=false, moved=false, sx=0, sy=0, ox=0, oy=0, px=0, py=0;
    poster.addEventListener('pointerdown', e=>{
      down=true; moved=false; sx=e.clientX; sy=e.clientY; ox=px; oy=py;
      poster.setPointerCapture(e.pointerId);
    });
    poster.addEventListener('pointermove', e=>{
      if(!down) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>4) moved=true;
      px = Math.max(-24,Math.min(24,ox+dx*.24));
      py = Math.max(-24,Math.min(24,oy+dy*.24));
      poster.style.setProperty('--px',px+'px');
      poster.style.setProperty('--py',py+'px');
    });
    function up(e){
      if(!down) return;
      down=false;
      if(poster.hasPointerCapture(e.pointerId)) poster.releasePointerCapture(e.pointerId);
      if(!moved) remixPoster();
    }
    poster.addEventListener('pointerup', up);
    poster.addEventListener('pointercancel', up);
    poster.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); remixPoster(); }
    });
    applyPoster(true);
  }

  /* ---------------- hash links get a little breathing room ---------------- */
  $$('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',()=>{ if(modal && modal.classList.contains('is-open')) closeProject(); });
  });
})();
