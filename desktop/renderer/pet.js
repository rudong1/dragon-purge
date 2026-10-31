'use strict';
const pet = document.getElementById('pet');
const surface = document.getElementById('pet-surface');
const canvas = document.getElementById('pet-canvas');
const poseButton = document.getElementById('pose');
const notice = document.getElementById('notice');
const speech = document.getElementById('speech');
const install = document.getElementById('install-update');
const api = window.desktopPet;
const media = matchMedia('(prefers-reduced-motion: reduce)');
let currentPose = 'sitting', activity = 'awake', currentKey = '', renderRequest = 0, noticeTimer, lastUpdate = '', down = null, dragFrame;
let motion;
const images = {
  sleeping: 'desktop-pet-sleeping.png', drowsy: 'desktop-pet-sleeping.png', waking: 'desktop-pet-waking.png',
  asking: 'desktop-pet-asking.png', petting: 'desktop-pet-happy.png', happy: 'desktop-pet-happy.png', showcase: 'desktop-pet-showcase.png'
};
const phrases = { drowsy: '有点困了…', sleeping: 'Zzz…', waking: '唔…我醒啦～', asking: '可以摸摸头吗？', petting: '好舒服呀～', happy: '谢谢你，陪我一会儿吧～', showcase: '今天的我好看吗？' };
function showNotice(message) {
  clearTimeout(noticeTimer); notice.textContent = message; notice.hidden = !message;
  if (message) noticeTimer = setTimeout(() => { notice.hidden = true; }, 6500);
}
try {
  motion = new DragonPetMotion(canvas, { onError: () => {document.body.classList.remove('motion-ready');showNotice('当前使用简化待机效果。');} });
  window.petMotion = motion;
  motion.start();
} catch { showNotice('当前使用简化待机效果。'); }
async function applyStatus(status) {
  currentPose = status.pose === 'standing' ? 'standing' : 'sitting';
  const behavior = status.behavior || { activity: 'awake', activitySince: Date.now() };
  activity = Object.hasOwn(phrases, behavior.activity) ? behavior.activity : 'awake';
  const file = images[activity] || (currentPose === 'sitting' ? 'desktop-pet-sitting.png' : 'desktop-pet.png');
  poseButton.textContent = currentPose === 'sitting' ? '站起来' : '坐下来';
  install.hidden = status.updater?.phase !== 'downloaded';
  const updateKey = `${status.updater?.phase}:${status.updater?.message}`;
  if (updateKey !== lastUpdate && ['available', 'downloaded', 'error'].includes(status.updater?.phase)) showNotice(status.updater.message);
  lastUpdate = updateKey;
  const key = `${currentPose}:${activity}:${behavior.activitySince}`;
  if (key === currentKey) return;
  currentKey = key;
  const request = ++renderRequest;
  pet.src = `../../docs/assets/${file}`;
  pet.alt = activity === 'awake' ? (currentPose === 'sitting' ? '坐着晃腿的小白龙' : '站姿小白龙') : phrases[activity];
  speech.textContent = phrases[activity] || ''; speech.hidden = !phrases[activity];
  document.body.dataset.activity = activity;
  if (motion) {
    try {
      await motion.setSource(pet.src);
      if (request !== renderRequest) return;
      motion.setMode({ pose: currentPose, activity, elapsed: Math.max(0, (Date.now()-behavior.activitySince)/1000), reducedMotion: media.matches });
      document.body.classList.add('motion-ready');
      canvas.dataset.renderer = motion.rendererMode;
    } catch { document.body.classList.remove('motion-ready'); showNotice('立绘正在载入，请稍后重试。'); }
  }
}
async function action(name, value) {
  if (!api) { showNotice('请通过桌面应用启动白龙娘。'); return; }
  try { const result = await api.action(name, value); if (result?.message) showNotice(result.message); return result; }
  catch { showNotice('操作暂时没有完成，请从托盘菜单重试。'); }
}
function finishPointer(event, cancelled = false) {
  if (!down || (event.pointerId !== undefined && event.pointerId !== down.id)) return;
  const press = down; down = null; cancelAnimationFrame(dragFrame); surface.classList.remove('dragging');
  if (surface.hasPointerCapture(press.id)) surface.releasePointerCapture(press.id);
  void action('drag-end');
  if (!cancelled && !press.moved) {
    if (press.wasSleeping) void action('wake');
    else void action(press.head ? 'pet-head' : 'pet-interact');
  }
}
surface.addEventListener('pointerdown', event => {
  if (event.button !== 0 || down) return;
  const point = motion?.imagePoint(event.clientX, event.clientY);
  down = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false, wasSleeping: ['sleeping','drowsy','waking'].includes(activity), head: !!point && point.x > .20 && point.x < .80 && point.y > .03 && point.y < .42 };
  surface.setPointerCapture(event.pointerId); void action('drag-begin');
});
surface.addEventListener('pointermove', event => {
  if (!down || event.pointerId !== down.id) return;
  if (Math.hypot(event.screenX-down.x,event.screenY-down.y) > 6) down.moved = true;
  if (!down.moved) return;
  surface.classList.add('dragging');
  cancelAnimationFrame(dragFrame); dragFrame=requestAnimationFrame(()=>{if(down)void action('drag-move');});
});
surface.addEventListener('pointerup', event => finishPointer(event));
surface.addEventListener('pointercancel', event => finishPointer(event,true));
surface.addEventListener('lostpointercapture', event => finishPointer(event,true));
surface.addEventListener('keydown', event => { if(event.key==='Enter'||event.key===' '){event.preventDefault();void action(['sleeping','drowsy'].includes(activity)?'wake':'pet-head');} });
window.addEventListener('blur', ()=>{if(down)finishPointer({pointerId:down.id},true);});
poseButton.addEventListener('click', () => action('set-pose', currentPose === 'sitting' ? 'standing' : 'sitting'));
document.getElementById('pat').addEventListener('click', () => action('pet-head'));
document.getElementById('menu').addEventListener('click', () => action('show-menu'));
install.addEventListener('click', () => action('install-update'));
media.addEventListener('change', () => { motion?.setMode({reducedMotion: media.matches}); });
if (api) {
  const unsubscribe = api.onStatus(applyStatus);
  window.addEventListener('pagehide', () => {unsubscribe();motion?.destroy();}, { once: true });
  api.getStatus().then(applyStatus).catch(() => showNotice('状态正在载入，可右键打开菜单。'));
}
