'use strict';
/* ============================================================
   BEE SHELL — the one navigation + theme layer shared by every
   Bee surface (index=chat, squad, ops, super). First step of the
   demo→product consolidation: before this file existed the four
   surfaces had NO way to reach each other.
   Injected additively so no verified demo internals are touched.
   Test hook: window.BeeShell.
   ============================================================ */
(function(){
  const SURFACES=[
    ['index.html','Chat','M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12z'],
    ['squad.html','Squad','M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    ['ops.html','Ops','M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
    ['super.html','Super','M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z'],
  ];
  const here=(location.pathname.split('/').pop()||'index.html');

  const css=document.createElement('style');
  css.textContent=`
  .bee-shell{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);
    z-index:1000;display:flex;align-items:center;gap:4px;padding:6px;border-radius:999px;
    background:rgba(10,14,22,.72);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);
    border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px -20px rgba(0,0,0,.8),0 1px 0 rgba(255,255,255,.18) inset;
    font-family:'Inter',-apple-system,system-ui,sans-serif}
  .bee-shell a{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 16px;border-radius:999px;
    text-decoration:none;color:#93a0b8;font-size:12.5px;font-weight:500;letter-spacing:.02em;
    cursor:pointer;touch-action:manipulation;transition:color .3s cubic-bezier(.16,1,.3,1),background .3s cubic-bezier(.16,1,.3,1)}
  .bee-shell a:hover{color:#f4f7fc;background:rgba(255,255,255,.07)}
  .bee-shell a:focus-visible{outline:2px solid #4e93ff;outline-offset:2px}
  .bee-shell a.cur{color:#1c1305;background:linear-gradient(180deg,#ffdc9a,#f5bc55);
    box-shadow:0 8px 22px -8px rgba(245,188,85,.8),0 1px 0 rgba(255,255,255,.5) inset}
  .bee-shell svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
  @media(max-width:560px){.bee-shell a{padding:0 12px}.bee-shell a span{display:none}
    .bee-shell a.cur span{display:inline}}
  @media(prefers-reduced-motion:reduce){.bee-shell a{transition:none}}`;
  document.head.appendChild(css);

  const nav=document.createElement('nav');
  nav.className='bee-shell';
  nav.setAttribute('aria-label','Bee surfaces');
  nav.innerHTML=SURFACES.map(([href,label,path])=>
    `<a href="${href}" ${href===here?'class="cur" aria-current="page"':''}>
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span></a>`).join('');
  document.body.appendChild(nav);

  window.BeeShell={
    surfaces:SURFACES.map(s=>s[0]),
    current:here,
    get links(){ return [...nav.querySelectorAll('a')].map(a=>a.getAttribute('href')); },
    get currentMarked(){ const c=nav.querySelector('.cur'); return c?c.getAttribute('href'):null; },
  };
})();
