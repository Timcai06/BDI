# Troubleshooting

## 1. 批次入库失败

### 现象

- `POST /api/v1/batches/{id}/items` 返回 500
- 前端新建批次后无法稳定上传

### 优先检查

1. 查看后端日志里是否出现 `batch_ingest_service`
2. 确认 `batch_aggregate_service` 调用是否成功
3. 确认上传文件类型与大小是否通过 `_validate_upload`
4. 确认 `MediaAsset` 落盘路径可写

### 常见原因

- 服务拆分后遗漏聚合刷新入口
- 批次统计字段依赖数据库默认值，但服务层未做兜底
- 文件重复入库触发去重

## 2. 任务大量 fail

### 现象

- 批次内任务大量转为 `failed`
- `failure_code` 集中为 `TASK_EXECUTION_FAILED`

### 优先检查

1. 看 worker stderr 是否已落到日志
2. 确认当前 Python 版本
3. 手动复跑对应 runtime worker
4. 检查 `output_adapter.py` 是否存在版本不兼容语法

### 常见原因

- Python 3.9 / 3.10 与局部写法不兼容
- 外部 runtime import 路径不对
- 权重文件路径错误
- subprocess 失败但 stderr 未透传

## 3. 外部模型 worker 失败

### 现象

- 日志里只看到 `CalledProcessError`
- 前端只看到任务失败，没有明确细节

### 处理步骤

1. 确认 `external_ultralytics_runner.py` 已透传 stderr
2. 手动执行对应 worker 命令，验证：
   - 权重是否可加载
   - runtime 是否兼容
   - 输出 JSON 是否符合标准结构
3. 检查模型 runtime 目录与当前权重是否匹配

## 4. 增强按钮不可用

### 现象

- 详情页只显示“增强”按钮不可点
- 或只看到原图结果，无法切换增强

### 优先检查

1. 当前记录是否存在 `secondary_result`
2. 批次创建时 `enhancement_mode` 是否为 `always` 或实际触发了 `auto`
3. 增强 runner 权重与依赖是否就绪

### 说明

- 不是所有历史记录默认都有增强结果
- 没有 `secondary_result` 时，需要走记录级增强补算

## 5. 页面数据不一致

### 现象

- 详情、历史、检索页类别展示不一致

### 优先检查

1. 后端输出类别是否已被 `normalize_defect_category()` 归一化
2. 前端是否通过 `defect-visuals.ts` 做了兼容兜底
3. 是否直接消费了非 canonical 类别的旧数据

## 6. E2E 冒烟失败

### 优先检查

1. `bdi status` 是否显示 `Mode: real`
2. 前端 `:3000`、后端 `:8000` 是否都在线
3. `/health` 是否返回 `ready=true`
4. 当前 active model / runtime 是否可用
5. Playwright 失败截图、trace、video 是否已生成

### 定位顺序

1. 看 E2E 报错里的当前页面 URL
2. 看失败截图与浏览器控制台输出
3. 如果页面提示里带 `请求ID`，按该 ID 去查后端日志
4. 如果卡在上传后无素材，优先查：
   - `/api/v1/batches/{id}/items`
   - 任务 worker 日志
   - 当前批次统计刷新

### 说明

- 第一版 E2E 只做真实链路冒烟，不验证固定检测数量
- 如果模型推理较慢，优先看是否超时而不是先判断功能失效

## 最后手段

如果排查仍不清晰，按这个顺序收集信息：

1. 相关 API 路径
2. 失败记录 ID / batch ID / task ID
3. 后端错误日志原文
4. 当前 active model / runtime
5. 是否是旧数据还是新入库数据
