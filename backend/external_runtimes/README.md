# Vendored model runtimes

本目录用于保存与模型权重强绑定的运行时代码，避免系统继续依赖个人桌面或下载目录。

当前结构：

- `prnet_ultralytics/`
  - 运行最新主模型 `backend/models/best-latest-main.pt`
  - 来源：`Downloads/PRnet-main`
- `water_ultralytics/`
  - 运行最新渗水专项模型 `backend/models/best-latest-water.pt`
  - 来源：桌面定制 `ultralytics`
  - 兼容 `Segment26`

约束：

- 不提交虚拟环境
- 运行时通过 `runtime_root` 配置和隔离子进程加载
- 不允许业务代码直接依赖 `Desktop/` 或 `Downloads/` 的模型路径
