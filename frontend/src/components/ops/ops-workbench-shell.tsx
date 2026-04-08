"use client";

import { BatchHeader } from "./batch-header";
import { IngestionWizard } from "./ingestion-wizard";
import { OpsPageLayout } from "./ops-page-layout";
import { OpsWorkbenchMain } from "./ops-workbench-main";
import { OpsWorkbenchNavigation } from "./ops-workbench-navigation";
import { useOpsWorkbenchController } from "./use-ops-workbench-controller";

export function OpsWorkbenchShell() {
  const { isWizardOpen, mainProps, navigationProps, wizardProps } = useOpsWorkbenchController();

  return (
    <>
      <OpsPageLayout
        contentClassName="space-y-8"
        header={
          <BatchHeader />
        }
      >
        <section className="relative page-enter">
          <OpsWorkbenchNavigation
            {...navigationProps}
          />
        </section>

        <OpsWorkbenchMain {...mainProps} />
      </OpsPageLayout>

      {isWizardOpen ? (
        <IngestionWizard key={navigationProps.selectedBridgeId || "no-bridge"} {...wizardProps} />
      ) : null}
    </>
  );
}

