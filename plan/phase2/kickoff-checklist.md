# Phase 2 开工清单

## Day 0

- [x] 建立 `backend/` 工程骨架
- [x] 建立 `frontend/` 工程骨架
- [x] 明确本地运行命令与依赖安装方式
- [x] 明确开发环境变量示例

## Backend First

- [x] 定义统一请求/响应 schema
- [x] 实现 `GET /health`
- [x] 实现 `POST /predict` mock 接口
- [x] 实现结构化错误返回
- [x] 建立本地文件存储目录与抽象
- [x] 为真实模型适配层预留 runner 接口
- [x] 编写后端单元与集成测试

## Frontend First Pass

- [x] 完成首页/上传页骨架
- [x] 完成结果页核心布局
- [x] 处理 `idle / uploading / running / success / error` 五种状态
- [x] 接入 mock `POST /predict`
- [x] 保证结果字段与统一 schema 一致
- [x] 编写前端基础测试

## Model Integration

- [ ] 接入本地 `YOLOv8-seg` runner
- [ ] 将原始结果转换为统一协议
- [ ] 生成标准 JSON 结果文件
- [ ] 生成 overlay 图并写入本地存储
- [ ] 前端消费真实返回结果无需改协议

## Verification

- [x] 后端测试通过
- [x] 前端测试通过
- [x] 前端构建通过
- [ ] 后端启动检查通过
- [ ] 单图上传联调通过
- [ ] 错误路径联调通过
