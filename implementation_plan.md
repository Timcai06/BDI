# Google Flow 视觉风格重构计划

本计划旨在将 BDI 基础设施巡检前端重构为类似于 [Google Flow (Labs)](https://labs.google/flow/about#gallery) 的高端电影级感官风格。

## 拟议变更

### 核心设计系统
1. **[修改] [globals.css](file:///Users/justin/Desktop/BDI/frontend/app/globals.css)**
   - 背景色从 `#0B1120` 切换为 **纯黑 `#000000`**。
   - 引入标志性的 **蓝 (`#4285F4`) 与紫 (`#A06EE1`) 荧光效果**，在视口边缘使用固定位置的径向渐变。
   - 定义“电影感”排版：全大写字母、增加字间距 (Tracking)、半粗体状态。
   - 优化 `.surface` 类，提高透明度并增强 `backdrop-filter` (20px-32px)，实现更通透的毛玻璃质感。

### 组件重构
2. **[修改] [history-panel.tsx](file:///Users/justin/Desktop/BDI/frontend/src/components/history-panel.tsx)**
   - **瀑布流布局 (Masonry)**：将原本的线性列表改为 2 或 3 列的错落网格，动态适配不同比例的巡检图片。
   - **电影级动态模糊 (Cinematic Blur)**：通过 Intersection Observer 监听滚动，计算卡片与屏幕垂直中心的距离。远离中心的卡片将自动应用 `blur(8px)` 滤镜。
   - **极简卡片**：去除沉重的边框，使用全大写电影字体展示 ID，仅在悬停时显示详细元数据。

3. **[修改] [home-shell.tsx](file:///Users/justin/Desktop/BDI/frontend/src/components/home-shell.tsx)**
   - 进一步简化侧边栏和顶栏，提升空间感。
   - 使用新定义的毛玻璃变量更新顶栏背景。

## 验证计划

### 自动化验证
- 使用浏览器工具捕获不同滚动位置的截图，确认模糊效果转换平滑。
- 验证瀑布流布局在不同屏幕宽度下的响应式表现。

### 手动验证
1. **滚动体验**：手动滚动历史面板，确保模糊动画流畅且无性能抖动。
2. **视觉一致性**：检查蓝紫荧光在不同页面下的环境氛围感。
