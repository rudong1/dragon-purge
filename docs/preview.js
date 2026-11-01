'use strict';
const preview = document.getElementById('pet-preview');
const fallback = document.getElementById('desktop-pet');
const bubble = document.getElementById('pet-bubble');
const download = document.getElementById('png-download');
const status = document.getElementById('activity-status');
const toggle = document.getElementById('motion-toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const phrases = { drowsy:'有点困了…',sleeping:'Zzz…',waking:'唔…我醒啦～',asking:'可以摸摸头吗？',petting:'好舒服呀～',happy:'谢谢你，陪我一会儿吧～',showcase:'今天的我好看吗？',tapping:'哒、哒，陪你慢慢来～',summer:'换上夏装，清清爽爽～' };
const names = {awake:'坐着晃腿 · 10 秒一轮',drowsy:'慢慢入睡 · 7 秒',sleeping:'抱尾巴打盹 · 点击叫醒',waking:'揉揉眼睛 · 10 秒',asking:'等待摸摸 · 18 秒',petting:'享受摸摸 · 7 秒',happy:'小尾巴持续轻拍 · 45 秒',showcase:'换装坐姿 · 22 秒',tapping:'脚尖交替点地 · 尾巴跟拍 · 24 秒',summer:'薄荷夏装 · 坐姿展示 · 24 秒'};
const files = {drowsy:'sleeping',sleeping:'sleeping',waking:'waking',asking:'asking',petting:'happy',happy:'happy',showcase:'showcase',tapping:'tapping',summer:'summer'};
let pose='sitting',state={activity:'awake',activitySince:Date.now()},sequence=0,paused=false,motion;
try { motion=new DragonPetMotion(document.getElementById('preview-canvas'),{onError:()=>preview.classList.remove('motion-ready')}); motion.start(); window.previewMotion=motion; } catch {}
async function render(next) {
  state=next; const id=++sequence; const file=`assets/desktop-pet${files[next.activity]?'-'+files[next.activity]:pose==='sitting'?'-sitting':''}.png`;
  fallback.src=file;fallback.alt=names[next.activity]||'白龙娘桌宠';download.href=file;
  bubble.textContent=phrases[next.activity]||'';bubble.hidden=!phrases[next.activity];status.textContent=next.activity==='awake'&&pose==='standing'?'站姿待机':names[next.activity];preview.dataset.activity=next.activity;
  if(motion){try{await motion.setSource(file);if(id!==sequence)return;motion.setMode({pose,activity:next.activity,elapsed:Math.max(0,(Date.now()-next.activitySince)/1000),reducedMotion:reduced.matches||paused});preview.classList.add('motion-ready');}catch{preview.classList.remove('motion-ready');}}
}
const behavior=DragonPetBehavior.createBehavior({onChange:render});window.previewBehavior=behavior;
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  switch(button.dataset.action){
    case 'sitting':pose='sitting';behavior.reset();break;
    case 'standing':pose='standing';behavior.reset();break;
    case 'sleep':behavior.sleep();break;
    case 'wake':behavior.wake();break;
    case 'ask':behavior.requestPat();break;
    case 'pat':behavior.petHead();break;
    case 'showcase':behavior.showcase();break;
    case 'tap-feet':behavior.tapFeet();break;
    case 'summer':behavior.summer();break;
  }
}));
function tap(event){if(['sleeping','drowsy','waking'].includes(state.activity)){behavior.wake();return;}const p=motion?.imagePoint(event.clientX,event.clientY);if(p&&p.x>.20&&p.x<.80&&p.y>.03&&p.y<.42)behavior.petHead();else behavior.interact();}
preview.addEventListener('click',tap);
preview.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();['sleeping','drowsy'].includes(state.activity)?behavior.wake():behavior.petHead();}});
toggle.addEventListener('click',()=>{paused=!paused;motion?.setMode({reducedMotion:reduced.matches||paused});toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'继续待机':'暂停待机';});
reduced.addEventListener('change',()=>motion?.setMode({reducedMotion:reduced.matches||paused}));
window.addEventListener('pagehide',()=>{behavior.dispose();motion?.destroy();},{once:true});
void render(behavior.getState());
