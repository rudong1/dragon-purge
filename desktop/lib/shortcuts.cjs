'use strict';

const path = require('node:path');

function windowsShortcutOptions({ executable, appDirectory, packaged, icon }) {
  return {
    target: executable,
    cwd: path.win32.dirname(executable),
    args: packaged ? '' : `"${appDirectory.replaceAll('"', '')}"`,
    description: '白龙娘 GPT 桌宠',
    icon: packaged ? executable : icon,
    iconIndex: 0,
    appUserModelId: 'com.rudong1.dragonpet'
  };
}

// Desktop-entry quoting is intentionally separate from shell quoting. Percent
// characters must be doubled because this format treats them as field codes.
function quoteDesktopExec(value) {
  return `"${value.replaceAll('%', '%%').replace(/[\\"`$]/g, '\\$&')}"`;
}

function linuxDesktopEntry({ executable, appDirectory, packaged, icon }) {
  const command = [quoteDesktopExec(executable), ...(packaged ? [] : [quoteDesktopExec(appDirectory)])].join(' ');
  return [
    '[Desktop Entry]', 'Version=1.0', 'Type=Application', 'Name=白龙娘 GPT',
    'Comment=白色小龙娘桌宠', `Exec=${command}`, `Icon=${icon.replace(/[\r\n]/g, '')}`,
    'Terminal=false', 'Categories=Game;Utility;', ''
  ].join('\n');
}

module.exports = { windowsShortcutOptions, quoteDesktopExec, linuxDesktopEntry };
