import { loadDashboard, updateClock, advanceUsageRotation } from "./dashboard.js";
import { setupSettingsModal, loadSettingsModalPartial } from "./settings.js";
import { loadHistoryModalPartial, setupHistoryModal } from "./history.js";
import { loadCostUsageModalPartial, setupCostUsageModal } from "./costs.js";
import { loadPowerUsageModalPartial, setupPowerUsageModal } from "./power-usage.js";

async function init() {
    updateClock();

    await loadHistoryModalPartial();
    await loadSettingsModalPartial();
    await loadCostUsageModalPartial();
    await loadPowerUsageModalPartial();

    setupHistoryModal();

    setupCostUsageModal();

    setupPowerUsageModal();

    setupSettingsModal(async () => {
        await loadDashboard();
    });

    await loadDashboard();

    setInterval(updateClock, 1000);
    setInterval(loadDashboard, 6000);
    setInterval(advanceUsageRotation, 8000);
}

init();