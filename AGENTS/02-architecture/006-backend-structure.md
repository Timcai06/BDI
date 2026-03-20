# BACKEND STRUCTURE

## 作用

这份文档只回答：后端在系统里负责什么，边界在哪里。

## 角色

后端是前端和算法之间的稳定中枢，负责：

- 接前端请求
- 调模型推理
- 做结果标准化
- 管结果、导出和历史

## 分层

后端按职责分层，不把所有逻辑塞进路由。

- `API` 层：路由、参数、校验、状态码
- `Service` 层：任务编排、调用适配层、组织返回结果
- `Model Adapter` 层：模型加载、版本切换、后端切换、屏蔽实现差异
- `Postprocess` 层：结果标准化、`Mask`、量化字段、可视化
- `Storage` 层：原图、`JSON`、叠加图、任务记录、日志
- `LLM Service` 层：AI专家诊断、流式markdown输出
- `Metrics Calculator` 层：物理测量计算（长度mm、宽度mm、面积mm²）

## 核心职责

### 请求接收

- 接收图像
- 校验参数
- 生成任务标识
- 先拦非法请求，再进入推理

### 推理编排

- 选择模型版本
- 选择推理模式
- 决定单图或批量
- 决定整图或切片

### 结果标准化

- 把 `YOLOv8` 原始输出转成统一 `JSON`
- 保证前端只看标准结构
- 新模型接入只改适配层，不改前端协议

### 结果管理

- 保存输入
- 保存输出
- 保存失败状态
- 支持历史查询

## 最小接口

- `POST /predict`
- `POST /predict-batch`
- `GET /results/{id}`
- `GET /results/{id}/overlay`
- `GET /tasks/{id}`
- `GET /health`
- `POST /diagnosis/stream`（LLM流式诊断）

## LLM智能诊断

后端集成了LLM服务，用于生成专业的桥梁病害诊断报告。

### 功能

- 接收检测结果，生成专家级病情评估和养护建议
- 支持流式markdown输出，实时显示生成内容
- 自动引用相关标准规范（如JTGT 5121-2021）
- 输出包含病害量化评估、风险预测、处置建议三个模块

### 配置

通过环境变量配置：

- `LLM_API_KEY`：OpenAI兼容API密钥
- `LLM_BASE_URL`：API基础URL（支持第三方兼容接口）
- `LLM_MODEL_NAME`：模型名称

### 实现

- 文件：`backend/app/services/llm_service.py`
- 类：`LLMService`
- 使用 `AsyncOpenAI` 客户端进行异步调用
- 支持流式输出（`generate_diagnosis_stream`）

## 物理测量计算（GSD）

后端实现了从像素到物理单位的转换，用于量化病害尺寸。

### 功能

- 从分割mask多边形计算物理尺寸
- 支持裂缝长度、宽度、面积计算
- 使用Shoelace公式计算多边形面积
- 使用最大Feret直径计算裂缝长度

### 配置

- `BDI_PIXELS_PER_MM`：像素到毫米的转换系数（GSD参数）
- 默认值为1.0（即1像素=1毫米）

### 输出字段

检测结果的`metrics`字段包含：

- `length_mm`：裂缝长度（毫米）
- `width_mm`：裂缝宽度（毫米）
- `area_mm2`：病害面积（平方毫米）

### 实现

- 文件：`backend/app/core/metrics_calculator.py`
- 核心函数：`calculate_metrics_from_mask(mask_points, pixels_per_mm)`
- 返回：`PhysicalMetrics(length_mm, width_mm, area_mm2)`

## 存储策略

- 第一阶段只用本地文件系统
- 结果、叠加图、日志先落本地
- 用抽象接口隔离未来云端存储

## 状态模型

- `pending`
- `running`
- `success`
- `failed`
- 批量可扩展 `partial_success`

## 错误返回

后端必须返回结构化错误，至少包含：

- 错误码
- 错误说明
- 可选上下文

## 承诺

- 路径稳定
- 字段稳定
- 成功/失败结构清楚
- 不暴露模型内部实现细节

前端看到的应始终是“系统结果”，而不是“模型原始输出”。

## 与算法层的关系

后端对算法层的核心约束是：

- 模型必须通过统一适配入口被调用
- 模型原始结果必须进入标准化流程
- 模型升级优先通过配置切换，而不是改 API

建议后端与算法层之间固定这种调用关系：

```text
load_runner(model_spec) -> runner
runner.predict(image, infer_spec) -> raw_result
adapt_result(raw_result, context) -> standardized_result
```

这样当前可以直接接 `YOLOv8 .pt`，后续也可以平滑接 `ONNX Runtime` 或 `TensorRT`。

这决定了你和算法同学可以真正并行协作。

## 与完整 UX 的关系

后端结构必须服务于前面定义的完整 UX，而不是单纯服务于模型调用。

具体来说，完整 UX 要求后端支持：

- 上传后的即时反馈
- 推理中的状态更新
- 统一结果展示
- 结果导出
- 历史任务回看
- 失败状态清楚可见

如果后端只会“收图 -> 跑模型 -> 返回结果”，那它支撑不了完整的系统体验。

## 第一阶段实现原则

第一阶段后端实现不必追求复杂分布式结构，但必须保证以下原则成立：

- 路由、推理编排、结果处理尽量分层
- 模型调用与业务逻辑分离
- 结果标准化独立存在
- 错误返回有统一结构
- 结果文件可追踪和可回放

## 关键原则

- API 不直接依赖某个权重文件
- 模型调用通过统一适配层完成
- 量化逻辑独立于模型调用逻辑
- 结果标准化优先于临时字段拼接
- 任务状态显式可见
- 存储实现可替换，但 API 和结果协议保持稳定

## 总结

后端的本质任务不是“提供一个推理接口”，而是把模型能力组织成一个可调用、可追踪、可导出、可演示的系统能力层。
