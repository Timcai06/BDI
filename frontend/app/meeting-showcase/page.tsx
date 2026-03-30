import type { Metadata } from "next";
import { MeetingShowcase } from "@/components/meeting-showcase";

export const metadata: Metadata = {
  title: "组会汇报",
  description: "组会汇报专用的横向翻页展示页，聚焦双模型识别优化和系统架构设计。",
};

export default function ShowcasePage() {
  return <MeetingShowcase />;
}
