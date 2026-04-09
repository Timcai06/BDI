# Phase 3 开工清单

## 开工确认

- [x] 真实 `YOLOv8-seg` runner 已完成单图联调验收
- [x] 浏览器侧上传到结果展示的完整链路已跑通
- [x] 前端消费真实结果无需协议改动
- [x] 标准 JSON 结果导出已验证
- [x] overlay 产物生成已验证
- [x] `Phase 2` 已达到完成定义，可进入 `Phase 3`

## Phase 3 基线能力

- [x] 已有结果页基础布局
- [x] 已有病害列表与基础详情信息
- [x] 已有分类与置信度筛选
- [x] 已有统一错误返回结构
- [x] 已有本地结果文件保存能力
- [x] 历史结果读取入口
- [x] overlay / JSON 前端导出入口
- [ ] 结果页联动高亮与更清晰展示
- [ ] 完整错误态与空态演示

## 当前已落地

- [x] 后端新增 `GET /results`
- [x] 后端新增 `GET /results/{image_id}`
- [x] 后端新增 `GET /results/{image_id}/overlay`
- [x] 后端新增 `GET /results/{image_id}/image`
- [x] 前端已增加历史结果列表与回看入口
- [x] 前端已增加 JSON / overlay 导出入口
- [x] 前端已增加历史记录图片预览
- [x] 前端已增加结果页继续操作入口
- [x] 前端已增加病害列表与图像框联动聚焦
- [x] 首页已增加最近记录与引导动作区
- [x] 历史空态与错误态已增加操作引导
- [x] 图片展示已切换到更规范的组件方案
- [x] 已增加默认主页入口与双入口分流
- [x] 已将新建分析改为弹出式分析面板
- [x] 已增加分析记录删除能力
- [x] 已增加记录搜索能力
- [x] 已增加按病害类别筛选历史记录
- [x] 后端测试、前端测试、前端构建均已通过

## 文档同步

- [x] `README.md` 已更新当前阶段
- [x] `docs/plan/README.md` 已更新当前实施阶段
- [x] `docs/plan/phase2/README.md` 已标记完成
- [x] `docs/plan/phase2/kickoff-checklist.md` 已回写验收结果
- [x] `docs/internal/agent/04-memory/009-progress.md` 已同步最新进展
- [x] `docs/internal/agent/04-memory/010-lessons.md` 已同步阶段经验
