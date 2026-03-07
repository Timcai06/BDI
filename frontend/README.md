# Frontend MVP

桥梁病害识别系统的前端 Phase 2 骨架，当前提供：

- 单图上传入口
- 五种状态反馈：`idle / uploading / running / success / error`
- mockable `predict` client，可在未联通后端时独立演示
- 结果总览、病害列表和量化字段占位
- `/results/demo` 结果页样例

## 启动方式

```bash
npm install
npm run dev
```

如需连接真实后端，设置：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

未设置时，页面会回退到 mock 结果，便于前后端并行联调。
