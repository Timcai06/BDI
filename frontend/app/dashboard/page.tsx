import { redirect } from "next/navigation";

export const metadata = {
  title: "Ops Overview - BDI Infrastructure Scan",
};

export default function DashboardPage() {
  redirect("/dashboard/ops/overview");
}
