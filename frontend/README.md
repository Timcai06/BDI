# Frontend MVP

桥梁病害识别系统的前端当前已完成 Phase 2 闭环，正在进入 Phase 3 展示增强阶段。当前提供：

- 单图上传入口
- 五种状态反馈：`idle / uploading / running / success / error`
- mockable `predict` client，可在未联通后端时独立演示
- 结果总览、病害列表和量化字段占位
- `/results/demo` 结果页样例

当前已验证：

- `vitest` 测试通过
- `eslint` 校验通过
- `next build --webpack` 构建通过
- 页面消费的是统一协议字段，而不是模型原始输出
- 浏览器侧连接真实后端后的上传到结果展示链路已跑通
- 真实 runner 返回结果的前端消费已完成端到端验证

当前 Phase 3 优先补齐的是：

- 更完整的结果页展示与联动交互
- overlay / JSON 导出入口
- 历史结果基础回看能力
- 更清晰的错误态与空态展示

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

所有开发任务开始前，应先参考 `AGENTS/` 目录确认当前阶段和执行规范，再继续调整前端实现。
