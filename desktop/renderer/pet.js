'use strict';
const pet = document.getElementById('pet');
const pose = document.getElementById('pose');
const notice = document.getElementById('notice');
const install = document.getElementById('install-update');
const api = window.desktopPet;
let currentPose = 'sitting';
let noticeTimer;
function showNotice(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = !message;
  if (message) noticeTimer = setTimeout(() => { notice.hidden = true; }, 6500);
}
function applyStatus(status) {
  currentPose = status.pose === 'standing' ? 'standing' : 'sitting';
  const file = currentPose === 'sitting' ? 'desktop-pet-sitting.png' : 'desktop-pet.png';
  if (!pet.src.endsWith(file)) pet.src = `../../docs/assets/${file}`;
  pet.alt = currentPose === 'sitting' ? '坐在地上的白色小龙娘' : '全身站姿的白色小龙娘';
  pose.textContent = currentPose === 'sitting' ? '站起来' : '坐下来';
  install.hidden = status.updater?.phase !== 'downloaded';
  if (['available', 'downloaded', 'error'].includes(status.updater?.phase)) showNotice(status.updater.message);
}
async function action(name, value) {
  if (!api) { showNotice('请通过桌面应用启动白龙娘。'); return; }
  try {
    const result = await api.action(name, value);
    if (result?.message) showNotice(result.message);
  } catch { showNotice('操作暂时没有完成，请从托盘菜单重试。'); }
}
pose.addEventListener('click', () => action('set-pose', currentPose === 'sitting' ? 'standing' : 'sitting'));
document.getElementById('menu').addEventListener('click', () => action('show-menu'));
install.addEventListener('click', () => action('install-update'));
if (api) {
  const unsubscribe = api.onStatus(applyStatus);
  window.addEventListener('pagehide', unsubscribe, { once: true });
  api.getStatus().then(applyStatus).catch(() => showNotice('状态正在载入，可右键打开菜单。'));
}
