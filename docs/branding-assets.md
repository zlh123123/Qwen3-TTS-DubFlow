# 品牌资源与 Logo 规范

## 资源目录

统一放在：

`docs/assets/branding/`

## 文件命名（建议固定）

- `narratis-logo-wordmark.png`：带字版（README/官网头图）
- `narratis-logo-mark.png`：符号版（favicon/头像/侧边栏）
- `narratis-app-icon-1024.png`：应用图标母版（Tauri 生成多尺寸）
- `narratis-app-icon-square.png`：正方形打包输入图（给 `tauri icon` 用）

建议额外保留：

- `narratis-logo-wordmark.svg`
- `narratis-logo-mark.svg`

## 放置位置建议

- 仓库 README 头图：`docs/assets/branding/narratis-logo-wordmark.png`
- Web favicon：由 `narratis-logo-mark.svg/png` 生成并放入 `frontend/public/`
- 桌面图标：`frontend/src-tauri/icons/icon.png`（由 `narratis-app-icon-1024.png` 生成）

## Tauri 图标生成

在 `frontend/` 执行：

```bash
npx tauri icon ../docs/assets/branding/narratis-app-icon-square.png
```

会自动生成 `frontend/src-tauri/icons/` 下的多平台图标文件。

## 如果输入图不是正方形

`tauri icon` 要求源图是正方形。可先补边：

```bash
sips -p 432 432 docs/assets/branding/narratis-app-icon-1024.png --out docs/assets/branding/narratis-app-icon-square.png
```
