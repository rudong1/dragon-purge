# 白龙娘 GPT · Windows 桌宠

白发、珍珠龙角、薄荷绿眼睛，搭配 GPT 标志头饰的小龙娘形象。

## 安装与使用

前往 [GitHub Releases](https://github.com/rudong1/dragon-purge/releases) 下载 Windows x64 的 `DragonGPT-版本号-x64-Setup.exe` 安装程序。首次版本由仓库的 Windows 发布工作流构建，下载列表以工作流实际产物为准。

- 安装时创建桌面快捷方式；安装完成后即可启动桌宠。
- 拖动人物可以移动桌宠，位置、大小和姿势会保存。
- 右键人物，或右键系统托盘图标，可以切换站姿 / 坐姿、大小、置顶、开机启动和检查更新。
- 菜单中选择 **退出桌宠** 即可关闭；也支持 Alt+F4。
- 安装版启动后检查更新，每六小时自动复查并下载。下载完成后选择 **重启并安装更新**；不会未经选择就重启。
- 已安装时，可从菜单再次创建桌面快捷方式。

快捷方式由 Windows 上的安装程序和应用创建；云端开发环境不会直接操作你的电脑桌面。当前 Windows 安装器尚未配置代码签名证书。

## 坐姿桌宠

默认使用坐在地上的姿势，双脚自然向前、脚底可见。图片含透明通道，适合无边框桌宠窗口。

![白龙娘 GPT 坐在地上的透明底立绘](docs/assets/desktop-pet-sitting.png)

[下载坐姿透明 PNG](docs/assets/desktop-pet-sitting.png) · [站姿透明 PNG](docs/assets/desktop-pet.png)

## 开发与发布

需要 Node.js 22.12+。在仓库目录执行：

```sh
npm ci
npm start
```

Windows 上构建安装程序：

```sh
npm test
npm run dist:win
```

安装器输出在 `release/`。自动更新读取此仓库 GitHub Releases 的公开发布版，不需要用户填写 GitHub Token。

发布新版本时先更新 `package.json` 和 `package-lock.json` 的版本号，再推送匹配的版本标签，例如 `v0.1.1`。`.github/workflows/release.yml` 会在 Windows 上运行锁定依赖安装、测试和 NSIS 构建，上传安装器、blockmap 与 `latest.yml`；更新文件保留 electron-updater 的完整性校验。

应用由 Electron 主进程管理窗口、托盘、快捷方式和更新；渲染进程只通过限定的 IPC 调用桌宠操作，不具备 Node.js 权限。设置保存在应用用户数据目录的 `preferences.json`。目前是桌宠框架与立绘待机效果，尚未接入 GPT 对话、眨眼、口型或完整 Live2D 绑定。

## 全身桌宠 · 透明 PNG

完整站姿，从龙角到双脚都保留；白色小龙娘、薄荷绿 GPT 头饰、赤脚造型。

![白龙娘 GPT 全身透明底桌宠立绘](docs/assets/desktop-pet.png)

[查看 / 下载全身透明 PNG](docs/assets/desktop-pet.png)

网页预览使用这张全身立绘，提供轻微的待机浮动与暂停控制。

## 早期半身动效

六秒循环待机：轻轻呼吸、发梢与龙尾缓慢摆动，头饰和聊天气泡微微发光。

<details>
<summary>展开查看早期半身动效</summary>

![白龙娘 GPT 六秒循环动图](docs/assets/idle.gif)

[查看高清原画](docs/assets/preview.png) · [查看 MP4 动画](docs/assets/idle.mp4) · [查看 GIF 动图](docs/assets/idle.gif)

</details>

## 网页预览

预览网页位于 [docs/index.html](docs/index.html)。支持手机和电脑，可查看全身桌宠与下载透明 PNG。

如需启用 GitHub Pages，在仓库 **Settings → Pages** 中选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/docs**。网站是否上线以 Pages 设置中的部署状态为准。

当前动效是基于立绘的轻量待机效果；尚未加入眨眼、口型或完整 Live2D 绑定。
