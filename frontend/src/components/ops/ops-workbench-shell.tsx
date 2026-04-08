"use client";

import { motion } from "framer-motion";

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
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <OpsWorkbenchNavigation
            {...navigationProps}
          />
        </motion.section>

        <OpsWorkbenchMain {...mainProps} />
      </OpsPageLayout>

      {isWizardOpen ? (
        <IngestionWizard key={navigationProps.selectedBridgeId || "no-bridge"} {...wizardProps} />
      ) : null}
    </>
  );
}
