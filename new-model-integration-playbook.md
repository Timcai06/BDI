# 新模型接入操作手册

更新时间：2026-03-14

## 这份文档解决什么问题

这份文档用于指导你后续如何把新的模型版本接入当前项目，包括：

1. 怎么接新的 `YOLOv8` 权重
2. 怎么接同一模型的不同推理后端
3. 怎么接完全不同的模型
4. 每种情况下应该改哪些文件
5. 接入后应该如何验证

## 一、先判断你要接入的是哪一类

在动代码前，先判断新模型属于下面哪一类。

### A 类：同一条 YOLOv8 路线，只换权重

典型情况：

- 同学训练了一个更好的 `YOLOv8-seg`
- 只是权重变了
- 仍然可以被 `Ultralytics YOLO(...)` 正常加载
- 输出仍然是当前 runner 能处理的结构

这是最简单、最推荐优先支持的一类。

### B 类：还是同一模型路线，但换推理后端

典型情况：

- 从 `.pt` 切到 `ONNX`
- 从 `.pt` 切到 `TensorRT`
- 仍然是同一模型家族，但推理框架变了

这类通常需要新 runner，但业务层改动仍然可以很小。

### C 类：完全不同的模型

典型情况：

- 换成其他检测模型
- 换成其他分割模型
- 换成多任务模型

这类不只是换权重，通常需要新增完整适配层。

## 二、当前系统的接入思路

当前后端的模型接入主线是：

```text
Settings / 环境变量
  ->
ModelRegistry
  ->
RunnerManager
  ->
具体 Runner
  ->
RawPrediction
  ->
PredictResponse
```

所以今后无论接什么模型，原则都一样：

1. 先注册
2. 再选择 runner
3. 最终统一输出

## 三、A 类接入：新增一个 YOLOv8 权重版本

这是你最常见、最容易成功的情况。

## 目标

把一个新的 `YOLOv8-seg` 权重接进系统，并且：

- 前端不用改协议
- 结果页不用重写
- 只多出一个新的模型版本可选项

## 操作步骤

### 第 1 步：拿到新权重

例如：

```text
/absolute/path/to/yolov8-bridge-v2.pt
```

确认它能被当前 `Ultralytics` 路线正常加载。

### 第 2 步：注册成新版本

当前系统支持通过环境变量注册额外模型。

位置参考：

- `backend/.env.example`
- `backend/app/core/config.py`

示例：

```bash
export BDI_MODEL_NAME=yolov8-seg
export BDI_MODEL_VERSION=v1-real
export BDI_MODEL_WEIGHTS_PATH=/absolute/path/to/yolov8-bridge-v1.pt

export BDI_EXTRA_MODELS='[
  {
    "model_version":"v2-real",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/yolov8-bridge-v2.pt"
  }
]'
```

### 第 3 步：启动后检查模型目录

查看：

```text
GET /models
```

确认返回中已经出现：

- `yolov8-seg / v1-real`
- `yolov8-seg / v2-real`

### 第 4 步：前端选择新版本试跑

在分析面板里选择：

```text
yolov8-seg / v2-real
```

然后发起单图推理。

### 第 5 步：验证结果页和导出

至少检查：

1. 结果页是否正常展示
2. 病害列表是否正常
3. overlay 是否正常
4. JSON 导出是否正常
5. 历史记录是否能正确记录模型版本

## 这种方式的本质

这一类接入，本质上是：

**同一 runner + 新权重 + 新版本注册**

这也是你当前系统最理想的接入模式。

## 四、B 类接入：同一模型，换推理后端

例如：

- `YOLOv8 .pt`
- `YOLOv8 onnx`
- `YOLOv8 TensorRT`

## 这时候需要做什么

这时通常不能只改权重路径，还要新增 runner。

### 需要新增的部分

1. 新 runner 文件
   - 参考：`backend/app/adapters/ultralytics_runner.py`

2. 在 factory 中支持新的 `runner_kind`
   - 位置：`backend/app/adapters/factory.py`

3. 在模型配置里声明它属于哪个 runner
   - 位置：`backend/app/core/config.py`
   - 位置：`backend/app/adapters/registry.py`

## 例子

如果你要接一个 `onnx` runner，思路会像这样：

```text
OnnxRunner
  ->
接收 image_bytes 和 options
  ->
执行 ONNX Runtime 推理
  ->
输出 RawPrediction
```

这时前端仍然不需要知道底层已经不是 `.pt` 了。

## 五、C 类接入：完全不同模型

这是成本最高的一类，但也是你系统架构真正体现价值的地方。

## 最少需要做的三件事

### 1. 新增 runner

你需要写一个新的 runner，例如：

```text
backend/app/adapters/your_model_runner.py
```

它必须符合统一接口：

参考：

```text
backend/app/adapters/base.py
```

也就是最终都要实现：

```python
predict(...) -> RawPrediction
```

### 2. 把模型原始输出适配到统一结构

这一点最关键。

无论底层模型怎么输出，最终都要映射回：

- `model_name`
- `model_version`
- `backend`
- `inference_mode`
- `detections`
- `bbox`
- `mask`
- `metrics`

否则前端和导出逻辑就会被破坏。

位置参考：

- `backend/app/models/schemas.py`
- `backend/app/services/predict_service.py`

### 3. 在 registry / factory 中注册

让系统知道：

- 这个模型版本对应哪个 runner
- 它是不是支持 mask
- 它是不是支持 sliced

## 六、推荐的接入顺序

为了降低风险，建议按下面顺序推进。

### 第一优先级

先接第二个真实 `YOLOv8` 权重版本。

原因：

- 成本最低
- 最符合当前架构
- 最容易验证“多模型切换”这件事真的成立

### 第二优先级

再接 `ONNX` 或 `TensorRT` 版本。

原因：

- 可以验证后端 runner 抽象是否够稳
- 但仍然没有跨模型家族

### 第三优先级

最后再接完全不同模型。

原因：

- 难度更高
- 输出差异更大
- 更适合在你已经把当前系统打磨稳后再做

## 七、接新模型时必须准备哪些材料

每次让同学交付新模型时，建议至少一起交付：

1. 模型名称
2. 模型版本
3. 权重文件路径
4. 推理框架
5. 输入尺寸要求
6. 类别映射说明
7. 是否支持 mask
8. 是否支持 sliced
9. 一组测试图片
10. 一组参考结果

这样接入会从“拍脑袋试”变成“有边界的版本升级”。

## 八、接入新模型时应该改哪些文件

## 只换权重时

通常只会动：

- 环境变量
- `backend/.env.example`
- 模型配置

## 新增 runner 时

通常会动：

- `backend/app/adapters/base.py`
- `backend/app/adapters/factory.py`
- `backend/app/adapters/registry.py`
- `backend/app/adapters/your_runner.py`

## 输出有差异时

通常会动：

- `backend/app/models/schemas.py`
- `backend/app/services/predict_service.py`

但原则是：

**尽量只改适配层，不改前端协议。**

## 九、每次接入后必须做的验证

每次接入新模型版本后，建议都执行这套检查。

### 基础验证

1. 模型是否能加载
2. `/models` 是否能列出该版本
3. 单图推理是否成功

### 产品验证

1. 结果页是否正常显示
2. overlay 是否正常
3. JSON 是否正常导出
4. 历史记录是否带上正确模型版本
5. 模型对比是否能正常运行

### 兼容验证

1. 前端是否无需改协议
2. 旧模型版本是否没有被破坏
3. mock runner 是否仍然可用

## 十、当前最推荐的一条实践路线

如果你现在要真正接下一个模型，我建议按下面做：

1. 保留当前 `yolov8-seg / v1-real`
2. 再接一个 `yolov8-seg / v2-real`
3. 用同一张图做模型对比
4. 确认结果页、历史页、对比页都正常
5. 再考虑接其他模型家族

## 十一、可以直接拿来用的最小接入模板

### 方式一：把新 YOLOv8 权重注册成新版本

```bash
export BDI_MODEL_NAME=yolov8-seg
export BDI_MODEL_VERSION=v1-real
export BDI_MODEL_WEIGHTS_PATH=/absolute/path/to/yolov8-v1.pt

export BDI_EXTRA_MODELS='[
  {
    "model_version":"v2-real",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/yolov8-v2.pt"
  }
]'
```

### 方式二：增加一个 mock 版本用于演示

```bash
export BDI_EXTRA_MODELS='[
  {
    "model_version":"mock-v2",
    "backend":"mock",
    "runner_kind":"mock"
  }
]'
```

## 十二、最后一句最重要的话

**接入新模型，不要把它理解成“往项目里丢一个文件”，而是“把一个新的推理能力注册进系统，并确保它最终说统一的结果语言”。**
