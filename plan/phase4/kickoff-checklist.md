# Phase 4 开工清单

## 开工确认

- [x] `Phase 2` 已完成并通过真实单图链路验收
- [x] `Phase 3` 已完成，结果展示与历史回看能力已落地
- [x] 统一结果协议已稳定
- [x] 前端可消费统一 schema，无需读取模型原始输出

## 多模型基础

- [x] 增加模型版本注册机制基础骨架
- [x] 实现 `ModelSpec` / `ModelRegistry` / `RunnerManager`
- [x] 实现 `/predict` 按 `model_version` 选择 runner
- [x] 增加 `GET /models` 模型列表接口
- [x] 增加前端模型版本选择
- [x] 增加同图双模型对比
- [x] 增加历史记录再次模型对比
- [x] 增加图像级并排对比
- [x] 增加病害类别级差异对比

## 推理模式与可用性

- [x] 增加 `inference_mode` 参数 (`direct` / `sliced`)
- [x] 增加 `supports_sliced_inference` 字段
- [x] 增加模型可用性 (`is_available`) 检查
- [x] 增加 `sliced` 推理模式预留接口

## 仍需推进

- [ ] 接入第二个真实模型版本
- [ ] 验证“换权重 + 少量配置”的真实流程
- [ ] 增加更清晰的模型可用性提示
- [ ] 推进批量任务创建与查询
- [ ] 继续增强差异表达与模型对比体验

## 文档同步

- [x] `AGENTS/04-memory/009-progress.md` 已同步当前阶段进展
- [x] `AGENTS/04-memory/010-lessons.md` 已同步阶段经验
- [x] `README.md` 已更新当前阶段概览
- [ ] `plan/README.md` 已更新指向新的阶段目录
