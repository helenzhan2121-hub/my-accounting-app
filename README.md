# 对账本 · 个人对账

一个纯前端、零依赖的移动端记账 Web App，可「添加到主屏幕」当原生 App 使用。

## 功能

- 记一笔：支出/收入切换、金额输入、分类图标、日期、备注
- 首页：本月结余、累计笔数、本月收支、最近流水
- 明细：按日期分组展示，点击可删除
- 统计：月度切换、每日收支柱状图、支出分类环形饼图
- 换肤：内置 5 套主题，支持上传头像与背景壁纸
- 数据：IndexedDB 本机持久化，支持 JSON 备份导入导出、Excel 对账单导出
- PWA：支持 iOS/Android 添加到主屏幕

## 使用

1. 用浏览器打开部署链接；
2. iOS Safari：分享 → 添加到主屏幕；
3. Android Chrome：菜单 → 添加到主屏幕。

## 数据说明

所有记账数据仅保存在你当前设备的浏览器中（IndexedDB），不会上传到任何服务器。换设备或清除浏览器数据前，请先用「我的 → 导出备份(JSON)」保存。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript
- IndexedDB 持久化
- 手写 ZIP+OOXML 生成真 .xlsx（无第三方库）

## 部署（GitHub Actions 自动发布）

本仓库已配置 `.github/workflows/deploy.yml`：每次向 `main` 分支推送代码，GitHub Actions 会自动构建并部署到 GitHub Pages，**全程使用 `GITHUB_TOKEN`，无需任何个人 Token**。

使用步骤：
1. 仓库 Settings → Pages → Source 选择 **GitHub Actions**；
2. `git push` 到 `main`，Actions 自动跑完即上线；
3. 个人 PAT 可随时删除，不影响部署。

正式链接：https://helenzhan2121-hub.github.io/my-accounting-app/

