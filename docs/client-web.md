# 客户端（Web 版）

## 启动

在 `frontend/` 目录执行：

```bash
npm install
npm run dev
```

默认会通过 Vite 代理把 `/api/*` 转发到 `http://127.0.0.1:8000`。

## 构建

```bash
npm run build
npm run preview
```

## 建议用途

- 迭代 UI、调接口、联调逻辑。
- 不建议把开源版直接公网部署（涉及模型服务、密钥和资源成本）。
