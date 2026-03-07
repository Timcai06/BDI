# Backend

桥梁病害识别系统的后端骨架，负责：

- 接收前端上传请求
- 调用推理 runner
- 将原始结果适配为统一协议
- 保存标准 JSON 等本地产物

## 快速开始

1. 创建虚拟环境
2. 安装依赖
3. 启动开发服务

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

## 当前接口

- `GET /health`
- `POST /predict`

## 当前状态

当前默认使用 mock runner，真实 `YOLOv8-seg` 接入将在 adapter 层替换完成。
