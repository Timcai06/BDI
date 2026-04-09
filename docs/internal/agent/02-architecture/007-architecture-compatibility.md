# 系统架构与兼容策略

## 作用

这份文档只回答：系统怎么兼容模型升级，哪些边界不能破。

## 总体结构

五层：

1. 前端交互层
2. 业务 API 层
3. 推理编排层
4. 模型适配层
5. 结果与可视化层

## 兼容策略

### 模型兼容

支持：

- 原始 `YOLOv8 .pt`
- 优化后的 `YOLOv8` 变体
- `ONNX`
- `TensorRT`

必须统一的不是模型名字，而是：

- 注册方式
- 调用入口
- 结果协议

 模型配置至少保留：

- `model_name`
- `model_version`
- `weights_path`
- `backend`
- `imgsz`
- `device`
- `supports_masks`
- `supports_sliced_inference`
- `fusion_strategy`（融合策略：`none` / `priority_takeover` / `union_merge`）
- `source_priority`（来源优先级：如渗水类优先专项模型）

### 推理兼容

统一模式：

- `direct`
- `sliced`

### 结果兼容

统一输出：

- `schema_version`
- `image_id`
- `inference_ms`
- `model_name`
- `model_version`
- `backend`
- `inference_mode`
- `detections`
- `artifacts`
- `fusion_info`（融合信息：融合策略、处理时长拆解）
- `detections[].source_model`（检测来源：`general` / `specialist` / `fusion`）

## YOLOv8 接入

- `FastAPI` 直接调用 `Ultralytics YOLOv8-seg`
- 模型启动时或首次请求时加载
- 原始结果进适配层
- 适配层输出统一协议

## 新模型接入

新模型不是"临时替换文件"，而是"注册一个新版本"。

接入时只改：

- 模型注册表
- 适配层
- 融合策略配置（如涉及多模型融合）

不改：

- 前端协议
- API 路径
- 结果结构

## 验证流程

每次接入新模型都走同一套检查：

1. 模型可加载
2. 单张图跑通
3. 结果字段符合协议
4. 前端展示正常
5. `JSON` 和叠加图可导出
6. 批量和历史不被破坏
7. 如涉及融合：融合结果来源标注正确、专项优先策略生效

## 边界

- 不随意改最终输出字段
- 不让前端依赖类别 ID 细节
- 不让前端解析原始 `Results`
- `Mask` 和类别变化优先在适配层、配置层解决
- 模型升级视为配置变化，不视为接口变化

## 原则

- 前端只依赖统一结果
- 后端只调用统一推理接口
- 模型可以升级，协议尽量不变
- 存储可升级，业务层不重构

## 增强处理

增强处理有两种触发方式：

1. **批次入库时自动增强**：`enhancement_mode` 默认值为 `always`，批次条目入库后自动触发双分支增强
2. **事后手动增强**：调用 `POST /results/{image_id}/enhance`，对已有结果手动触发增强识别，支持掩膜输出

增强结果作为 `secondary_result` 写入原始 JSON 产物，包含独立的 detections 列表、enhancement_info 和 artifacts。

变更记录：

- `enhancement_mode` 默认值从 `auto` 改为 `always`（始终增强）
- 新增事后增强接口 `POST /results/{image_id}/enhance`
- 增强 runner 支持 mask 输出（`supports_masks=true`）
