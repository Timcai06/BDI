"use client";

function SettingCard({
  title,
  desc,
  value
}: {
  title: string;
  desc: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold tracking-wide text-white/90">{title}</h2>
      <p className="mt-2 text-xs text-white/55">{desc}</p>
      <div className="mt-4 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">{value}</div>
    </article>
  );
}

export function OpsSettingsShell() {
  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-xl lg:text-2xl font-semibold text-white">系统设置</h1>
        <p className="mt-1 text-sm text-white/60">预留模型策略、告警规则与角色权限的统一配置入口。</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SettingCard
          title="模型策略"
          desc="配置融合模型策略、默认阈值与回退逻辑。"
          value="fusion-default (占位)"
        />
        <SettingCard
          title="告警规则"
          desc="按类别、严重程度、数量变化设置触发条件。"
          value="category+count rule set (占位)"
        />
        <SettingCard
          title="角色权限"
          desc="区分巡检员、复核员、管理员的操作范围。"
          value="ops / reviewer / admin (占位)"
        />
      </section>
    </div>
  );
}
