(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DragonPetBehavior=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const TIMING = Object.freeze({ idleAfterMs: 180000, askAfterMs: 75000, requestMs: 18000, drowsyMs: 7000, wakingMs: 10000, pettingMs: 7000, happyMs: 45000, showcaseMs: 22000, tappingMs: 24000, summerMs: 24000 });

function createBehavior({ onChange = () => {}, now = Date.now, setTimeout: later = setTimeout, clearTimeout: cancel = clearTimeout, timing = TIMING, quietMode = false } = {}) {
  let activity = 'awake';
  let activitySince = now();
  let visible = true;
  let disposed = false;
  let quiet = quietMode === true;
  let idleTimer, askTimer, phaseTimer;
  const clear = () => { for (const t of [idleTimer, askTimer, phaseTimer]) if (t !== undefined) cancel(t); idleTimer = askTimer = phaseTimer = undefined; };
  const schedule = (fn, delay) => { const id = later(fn, delay); id?.unref?.(); return id; };
  function getState() { return { activity, activitySince, quietMode: quiet, ...timing }; }
  function change(next, duration, after) {
    if (disposed) return;
    if (phaseTimer !== undefined) cancel(phaseTimer);
    phaseTimer = undefined;
    activity = next; activitySince = now(); onChange(getState());
    if (visible && duration) phaseTimer = schedule(() => change(after), duration);
  }
  function armAsk() {
    if (askTimer !== undefined) cancel(askTimer);
    askTimer = undefined;
    if (quiet || !visible || disposed || ['sleeping', 'drowsy'].includes(activity)) return;
    askTimer = schedule(() => {
      if (activity === 'awake') change('asking', timing.requestMs, 'awake');
    }, timing.askAfterMs);
  }
  function armIdle() {
    if (idleTimer !== undefined) cancel(idleTimer);
    idleTimer = undefined;
    armAsk();
    if (!visible || disposed) return;
    idleTimer = schedule(sleep, timing.idleAfterMs);
  }
  function sleep() {
    if (disposed || !visible || ['sleeping', 'drowsy'].includes(activity)) return;
    clear(); change('drowsy', timing.drowsyMs, 'sleeping');
  }
  function wake() {
    if (disposed || !visible) return;
    if (['sleeping', 'drowsy'].includes(activity)) change('waking', timing.wakingMs, 'awake');
    armIdle();
  }
  function interact({ preserveActivity = false } = {}) {
    if (disposed || !visible) return;
    if (['sleeping', 'drowsy'].includes(activity)) wake();
    else { if (!preserveActivity && activity === 'asking') change('awake'); armIdle(); }
  }
  function petHead() {
    if (disposed || !visible) return;
    if (['sleeping', 'drowsy', 'waking'].includes(activity)) { wake(); return; }
    change('petting');
    phaseTimer = schedule(() => change('happy', timing.happyMs, 'awake'), timing.pettingMs);
    armIdle();
  }
  function requestPat() {
    if (disposed || !visible) return;
    armIdle(); change('asking', timing.requestMs, 'awake');
  }
  function showcase() { if (disposed || !visible) return; armIdle(); change('showcase', timing.showcaseMs, 'awake'); }
  function tapFeet() { if (disposed || !visible) return; change('tapping', timing.tappingMs, 'awake'); armIdle(); }
  function summer() { if (disposed || !visible) return; change('summer', timing.summerMs, 'awake'); armIdle(); }
  function reset() { if (disposed) return; clear(); change('awake'); armIdle(); }
  function setVisible(value) {
    if (disposed || visible === Boolean(value)) return;
    visible = Boolean(value); clear(); change('awake'); if (visible) armIdle();
  }
  function setQuietMode(value) {
    if (disposed || quiet === Boolean(value)) return;
    quiet = Boolean(value); armAsk(); onChange(getState());
  }
  function dispose() { clear(); disposed = true; }
  armIdle();
  return { getState, interact, sleep, wake, petHead, requestPat, showcase, tapFeet, summer, reset, setVisible, setQuietMode, dispose };
}

return { createBehavior, TIMING };
});
