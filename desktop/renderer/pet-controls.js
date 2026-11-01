'use strict';
class DragonPetControls {
  constructor({action}) {
    this.action=action;this.backdrop=document.getElementById('menu-backdrop');this.dialog=document.getElementById('pet-menu');this.toggle=document.getElementById('updates-toggle');this.feedback=document.getElementById('menu-feedback');
    this.tabs=[...document.querySelectorAll('[data-tab]')];
    document.getElementById('menu-close').addEventListener('click',()=>this.close());
    this.toggle.addEventListener('click',()=>this.show('updates'));
    this.backdrop.addEventListener('click',event=>{if(event.target===this.backdrop)this.close();});
    this.tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>this.select(tab.dataset.tab));tab.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();const next=this.tabs[(index+(event.key==='ArrowRight'?1:-1)+this.tabs.length)%this.tabs.length];this.select(next.dataset.tab);next.focus();}});});
    this.dialog.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async()=>{
      const actionName=button.dataset.action;
      if(['set-pose','sleep','wake','request-pat','pet-head','showcase','toggle-visible','quit'].includes(actionName))this.close();
      const result=await this.action(actionName,button.dataset.value);
      if(result?.message){this.feedback.textContent=result.message;this.feedback.hidden=false;}
    }));
    this.dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();this.close();}
      if(event.key==='Tab'){
        const all=[...this.dialog.querySelectorAll('button:not(:disabled)')].filter(e=>e.getClientRects().length&&e.tabIndex>=0),first=all[0],last=all.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
  }
  select(name) {
    if(!['actions','settings','updates'].includes(name))name='actions';
    for(const tab of this.tabs){const selected=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;document.getElementById(`panel-${tab.dataset.tab}`).hidden=!selected;}
    this.tab=name;this.feedback.hidden=true;
  }
  show(tab='actions'){this.select(tab);this.backdrop.hidden=false;document.body.classList.add('menu-open');this.toggle.setAttribute('aria-expanded','true');document.getElementById(`tab-${this.tab}`).focus();}
  close(){this.backdrop.hidden=true;document.body.classList.remove('menu-open');this.toggle.setAttribute('aria-expanded','false');document.getElementById('pet-surface').focus({preventScroll:true});}
  update(status) {
    const phase=status.updater?.phase||'idle',u=status.updater||{};
    document.getElementById('current-version').textContent=`v${status.version||'—'}`;
    this.toggle.title=`v${status.version||'—'} · ${u.message||'版本与自动更新'}`;
    this.toggle.setAttribute('aria-label',`版本与自动更新：${u.message||'正在初始化'}`);
    this.toggle.classList.toggle('has-update',['available','downloading','downloaded'].includes(phase));
    document.getElementById('update-schedule').textContent=u.enabled?'自动更新已开启 · 启动后约 10 秒检查，每 6 小时复查，后台下载。':(u.message||'当前模式未启用自动更新。');
    const percent=Math.max(0,Math.min(100,Number(u.percent)||0));
    document.getElementById('update-state').textContent=phase==='downloading'?`正在下载${u.version?' v'+u.version:''} · ${Math.round(percent)}%`:(u.message||'准备检查更新。');
    document.getElementById('update-state').dataset.phase=phase;
    const progress=document.getElementById('update-progress');progress.hidden=!['downloading','downloaded'].includes(phase);progress.value=percent;
    document.getElementById('panel-install').hidden=phase!=='downloaded';
    document.getElementById('check-update').disabled=!u.enabled||['checking','available','downloading','downloaded'].includes(phase);
    document.getElementById('setting-top').setAttribute('aria-checked',String(status.alwaysOnTop));
    document.getElementById('setting-startup').setAttribute('aria-checked',String(status.autostart));
    document.getElementById('setting-startup').disabled=!status.packaged||!['win32','darwin'].includes(status.platform);
    for(const button of this.dialog.querySelectorAll('[data-action="set-size"]'))button.setAttribute('aria-pressed',String(button.dataset.value===status.size));
    for(const button of this.dialog.querySelectorAll('[data-action="set-pose"]'))button.setAttribute('aria-pressed',String(button.dataset.value===status.pose));
    const activity=status.behavior?.activity||'awake';
    this.dialog.querySelector('[data-action="wake"]').disabled=!['sleeping','drowsy'].includes(activity);
    document.getElementById('menu-mood').textContent=({sleeping:'正抱着尾巴睡觉呢',drowsy:'有一点困了…',waking:'揉揉眼睛，慢慢醒来',asking:'等一个温柔的摸摸',petting:'摸摸头，好舒服呀',happy:'小尾巴藏不住开心',showcase:'换件衣服给你看看'})[activity]||'陪你待机，也陪你玩';
  }
}
window.DragonPetControls=DragonPetControls;
