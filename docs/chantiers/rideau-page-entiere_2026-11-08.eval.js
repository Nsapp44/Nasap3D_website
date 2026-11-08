(async()=>{const f=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const h=document.querySelector('header.hero');const sb=document.querySelector('.sb-ph');const vh=innerHeight;
scrollTo(0,0);await f();const r0=h.getBoundingClientRect();const top0=r0.top+scrollY,H=h.offsetHeight;
const ex0=Math.max(top0,top0+H-vh);const ex1=top0+H;const out={vh,H,top0:Math.round(top0),ex0:Math.round(ex0),ex1:Math.round(ex1),sh:document.documentElement.scrollHeight,rows:[]};
for(const k of [0,.5,1,1.3]){const Y=Math.round(ex0+(ex1-ex0)*k);scrollTo(0,Y);await f();const s=getComputedStyle(h);const hr=h.getBoundingClientRect();const x=innerWidth/2,yy=Math.min(vh-5,Math.round(hr.top+20));const el=document.elementFromPoint(x,Math.max(5,yy));
out.rows.push({k,Y:scrollY,tr:s.translate,sc:s.scale,op:(+s.opacity).toFixed(2),heroVisTop:Math.round(hr.top),heroVisBot:Math.round(hr.bottom),sbTop:Math.round(sb.getBoundingClientRect().top),hit:el&&(el.closest('.rideau')?'rideau':el.closest('header.hero')?'hero':el.tagName)});}
return out})()
