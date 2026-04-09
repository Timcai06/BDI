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

- [x] 增加基于环境变量的真实 runner 选择逻辑
- [x] 在兼容 Python 环境中安装 `ultralytics`
- [x] 接入本地 `YOLOv8-seg` 权重并完成真实推理
- [x] 将原始结果转换为统一协议的 adapter 结构已落位
- [x] 生成标准 JSON 结果文件
- [x] 生成 overlay 图并写入本地存储
- [x] 前端消费真实返回结果无需改协议

注：

- 已确认真实 `YOLOv8-seg` 权重链路可跑通，浏览器侧联调已完成
- `UltralyticsRunner`、runner factory 与统一 schema 已通过真实场景验收
- `.venv-yolo` 已安装 `ultralytics`，并已通过 `numpy<2` 约束维持可用依赖组合
- 当前阶段阻塞已从“真实联调”切换为“Phase 3 展示增强与历史回看能力建设”

## Verification

- [x] 后端测试通过
- [x] 前端测试通过
- [x] 前端构建通过
- [x] 后端启动检查通过
- [x] 单图上传联调通过
- [x] 错误路径联调通过

注：

- 已通过 `FastAPI TestClient` 验证 `GET /health` 与 `POST /predict` API 路径
- 已完成浏览器侧上传到结果展示的端到端联调
- 已完成真实权重场景下的基础错误路径验证

## 阶段结论

- [x] `Phase 2` 完成
- [x] 进入 `Phase 3`
