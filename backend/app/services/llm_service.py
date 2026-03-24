from typing import List, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import Settings
from app.models.schemas import PredictResponse

class LLMService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = None
        if settings.llm_api_key:
            import logging
            self.logger = logging.getLogger(__name__)
            self.logger.info(f"Initializing LLMService with base_url: {settings.llm_base_url}, model: {settings.llm_model_name}")
            self.client = AsyncOpenAI(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url
            )

    async def generate_diagnosis_stream(self, result: PredictResponse) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "错误：未配置 LLM API Key，请检查后端 .env 配置。"
            return

        # 整理检测数据摘要
        detection_summary = []
        for i, d in enumerate(result.detections):
            metrics = d.metrics
            info = f"- 病害{i+1}: {d.category} (置信度: {d.confidence:.2f})"
            if metrics.length_mm:
                info += f", 估计长度: {metrics.length_mm:.1f}mm"
            if metrics.width_mm:
                info += f", 估计宽度: {metrics.width_mm:.2f}mm"
            if metrics.area_mm2:
                info += f", 面积: {metrics.area_mm2:.1f}mm²"
            detection_summary.append(info)

        summary_text = "\n".join(detection_summary) if detection_summary else "未发现明确病害。"

        prompt = f"""
你是一名资深桥梁巡检专家。请根据以下无人机桥梁初检识别出的结构化数据，给出一段专业的病情评估和养护建议。

本系统重点识别六类典型病害：Crack（裂缝）、Breakage（破损）、Comb（梳齿缺陷）、Hole（孔洞）、Reinforcement（钢筋外露）、Seepage（渗水）。

【巡检摘要】
模型名称: {result.model_name}
检测总数: {len(result.detections)}
检测详情:
{summary_text}

【要求】
1. 口吻需极其专业、严谨，像一份正式的桥梁健康监测报告。
2. 必须使用 Markdown 格式输出，排版需层次分明：
   - 使用 `###` 级标题区分部分。
   - 使用 `-` 或 `1.` 列表项陈列具体细节。
   - 使用 **加粗** 强调关键病害或数据。
3. 报告必须包含以下三个模块：
   - ### 1. 病害现状量化评估：分析病害类型、置信度以及测量出的具体几何参数。
   - ### 2. 结构安全性风险预测：基于病害位置和程度，评估对桥梁承载力或耐久性的潜在影响。
   - ### 3. 分级养护与工程处置建议：给出具体的修补、复查或进一步检测建议（如：高频观察、化学灌浆、封闭交通等）。
4. 需要针对不同病害类型给出差异化判断：
   - 裂缝（Crack）：关注扩展趋势、贯通风险与耐久性劣化，可引用相关桥梁养护规范。
   - 破损（Breakage）：关注构件边角剥损、受冲击破坏及局部承载退化。
   - 梳齿缺陷（Comb）：关注伸缩缝/梳齿构造功能退化、行车舒适性与构造安全。
   - 孔洞（Hole）：关注局部脱空、空蚀、材料流失及水损进一步扩展。
   - 钢筋外露（Reinforcement）：重点评估保护层失效、锈蚀扩展及承载风险，必要时提高风险等级。
   - 渗水（Seepage）：关注长期水侵、冻融、钢筋腐蚀与附属构造劣化。
5. 总字数控制在 400 字左右，确保内容充实而非空谈。
6. 直接输出诊断内容，不要任何开场白或结尾套话。
"""

        try:
            stream = await self.client.chat.completions.create(
                model=self.settings.llm_model_name,
                messages=[
                    {"role": "system", "content": "你是一名精准、专业的桥梁工程健康监测专家助手。"},
                    {"role": "user", "content": prompt}
                ],
                stream=True
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            self.logger.error(f"LLM Diagnosis Error: {str(e)}", exc_info=True)
            error_text = str(e)
            if "invalid_api_key" in error_text or "Incorrect API key provided" in error_text:
                yield (
                    "诊断生成失败: 当前 API Key 对该接口地址无效。"
                    f" 现在使用的 BaseURL 是 {self.settings.llm_base_url}。"
                    " 如果这是第三方 OpenAI 兼容服务的 Key，请在后端 .env 中同时配置正确的 "
                    "BDI_LLM_BASE_URL 和 BDI_LLM_MODEL_NAME。"
                )
                return
            yield f"诊断生成失败: {error_text} (BaseURL: {self.settings.llm_base_url})"
