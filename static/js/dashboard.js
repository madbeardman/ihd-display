import { state } from "./state.js";
import { renderAgileChart } from "./agile.js";
import {
    clamp,
    formatClock,
    formatGbp,
    formatPrice,
} from "./utils.js";
import { API_BASE_URL } from "./config.js";

const DAILY_ELECTRICITY_BUDGET_GBP = 2.0;
const DAILY_GAS_BUDGET_GBP = 5.0;
const BATTERY_MAX_KWH = 4.0;

function getHouseUsageColour(watts) {
    if (watts < 100) return "var(--usage-green-bright)";
    if (watts < 200) return "var(--usage-green-soft)";
    if (watts < 1000) return "var(--normal)";
    if (watts < 2000) return "var(--usage-orange)";
    return "var(--usage-red)";
}

let pollPulseTimer = null;

function pulsePollIndicator() {
    const el = document.getElementById("poll-indicator");
    if (!el) return;

    el.classList.add("pulse");

    if (pollPulseTimer) {
        clearTimeout(pollPulseTimer);
    }

    pollPulseTimer = setTimeout(() => {
        el.classList.remove("pulse");
        pollPulseTimer = null;
    }, 1000);
}

function setPollIndicatorOk() {
    const el = document.getElementById("poll-indicator");
    if (!el) return;

    el.classList.remove("error");
}

function setPollIndicatorError() {
    const el = document.getElementById("poll-indicator");
    if (!el) return;

    el.classList.remove("pulse");
    el.classList.add("error");
}

function updateSolarExportIcon(octopusDemandW) {
    const icon = document.getElementById("solar-export-icon");
    const amount = document.getElementById("solar-export-amount");
    const value = document.getElementById("solar-export-value");

    const isExporting =
        typeof octopusDemandW === "number" && octopusDemandW < -5;

    if (icon) {
        icon.toggleAttribute("hidden", !isExporting);
    }

    if (amount) {
        amount.toggleAttribute("hidden", !isExporting);
    }

    if (value) {
        value.textContent = isExporting
            ? `${Math.round(Math.abs(octopusDemandW))}W`
            : "--";
    }
}

function updateBudgetGauge(gaugeId, percentId, cost, budget) {
    const gauge = document.getElementById(gaugeId);
    const percentEl = document.getElementById(percentId);

    if (!gauge || !percentEl || typeof cost !== "number") return;

    const ratio = budget > 0 ? cost / budget : 0;
    const percentage = Math.min(Math.max(ratio * 100, 0), 100);

    gauge.setAttribute(
        "stroke-dasharray",
        `${Math.max(percentage, cost > 0 ? 4 : 0)} 100`,
    );

    percentEl.textContent = `${Math.round(percentage)}%`;
}

function updateCostsTodayPanel(metrics) {
    const totalEl = document.getElementById("costs-today-total");
    const electricityEl = document.getElementById("costs-today-electricity");
    const gasEl = document.getElementById("costs-today-gas");

    const electricity =
        typeof metrics?.cost_today_gbp === "number"
            ? metrics.cost_today_gbp
            : null;

    const gas =
        typeof metrics?.gas_cost_today_gbp === "number"
            ? metrics.gas_cost_today_gbp
            : null;

    const total =
        (typeof electricity === "number" ? electricity : 0) +
        (typeof gas === "number" ? gas : 0);

    if (totalEl) {
        totalEl.textContent =
            typeof electricity === "number" || typeof gas === "number"
                ? formatGbp(total)
                : "--";
    }

    if (electricityEl) {
        electricityEl.textContent =
            typeof electricity === "number" ? formatGbp(electricity) : "--";
    }

    if (gasEl) {
        gasEl.textContent =
            typeof gas === "number" ? formatGbp(gas) : "--";
    }

    updateBudgetGauge(
        "costs-electricity-gauge",
        "costs-electricity-percent",
        electricity,
        DAILY_ELECTRICITY_BUDGET_GBP,
    );

    updateBudgetGauge(
        "costs-gas-gauge",
        "costs-gas-percent",
        gas,
        DAILY_GAS_BUDGET_GBP,
    );

    document.getElementById("costs-electricity-budget").textContent =
        `Budget ${formatGbp(DAILY_ELECTRICITY_BUDGET_GBP)}`;

    document.getElementById("costs-gas-budget").textContent =
        `Budget ${formatGbp(DAILY_GAS_BUDGET_GBP)}`;
}

export function updateClock() {
    const clock = document.getElementById("header-time");
    if (!clock) return;
    clock.textContent = formatClock();
}

function updateBatteryPanel(battery) {
    const percentEl = document.getElementById("battery-percentage");
    const kwhEl = document.getElementById("battery-kwh");
    const fillEl = document.getElementById("battery-fill");
    const statusEl = document.getElementById("battery-status");

    if (!percentEl || !kwhEl || !fillEl || !statusEl) return;

    if (!battery || typeof battery.soc !== "number") {
        percentEl.textContent = "--";
        kwhEl.textContent = "--";
        statusEl.textContent = "Unavailable";
        fillEl.style.height = "0%";
        return;
    }

    const soc = Math.round(battery.soc);
    const kwh = (soc / 100) * BATTERY_MAX_KWH;

    percentEl.textContent = `${soc}%`;
    kwhEl.textContent = `${kwh.toFixed(1)}kWh`;

    fillEl.style.height = `${soc}%`;

    // status logic
    if (battery.power_w > 50) {
        statusEl.textContent = "Charging";
        statusEl.style.color = "var(--cheap)";
    } else if (battery.power_w < -50) {
        statusEl.textContent = "Discharging";
        statusEl.style.color = "var(--usage-orange)";
    } else {
        statusEl.textContent = "Idle";
        statusEl.style.color = "var(--muted)";
    }
}

function updateHouseUsageGauge(watts) {
    const gaugeArc = document.getElementById("usage-gauge-electric");

    if (!gaugeArc || typeof watts !== "number") return;

    const maxWatts = 4000;
    const clampedWatts = clamp(watts, 0, maxWatts);
    const colour = getHouseUsageColour(clampedWatts);
    gaugeArc.style.opacity = "1";

    if (clampedWatts <= 0) {
        gaugeArc.setAttribute("stroke-dasharray", "1 100"); // Show a small sliver to indicate 0 usage
        gaugeArc.style.stroke = "var(--usage-green-soft)";
        return;
    }

    const linearRatio = clampedWatts / maxWatts;
    const percentage = Math.max(Math.sqrt(linearRatio) * 100, 10);

    gaugeArc.setAttribute("stroke-dasharray", `${percentage} 100`);
    gaugeArc.style.stroke = colour;
}

function updateSolarGauge(watts) {
    const gaugeArc = document.getElementById("solar-gauge-fill");
    const gaugeTrack = document.getElementById("solar-gauge-track");

    if (!gaugeArc || !gaugeTrack || typeof watts !== "number") return;

    const maxWatts = 3480;
    const clampedWatts = clamp(watts, 0, maxWatts);

    const linearRatio = clampedWatts / maxWatts;
    let percentage = Math.sqrt(linearRatio) * 100;

    if (clampedWatts > 0) {
        percentage = Math.max(percentage, 8);
    } else {
        percentage = 0;
    }

    gaugeArc.setAttribute("stroke-dasharray", `${percentage} 100`);
    gaugeArc.style.stroke = "#16a34a";
    gaugeTrack.style.stroke = "";
}

function updateApplianceRow(appliances) {
    const washerEl = document.getElementById("appliance-washing-machine");
    const dishwasherEl = document.getElementById("appliance-dishwasher");
    const dryerEl = document.getElementById("appliance-tumble-dryer");

    if (!washerEl || !dishwasherEl || !dryerEl || !appliances) return;

    const washer = appliances.washing_machine?.display ?? "--";
    const dishwasher = appliances.dishwasher?.display ?? "--";
    const dryer = appliances.tumble_dryer?.display ?? "--";

    washerEl.textContent = washer;
    dishwasherEl.textContent = dishwasher;
    dryerEl.textContent = dryer;

    washerEl.classList.toggle("running", appliances.washing_machine?.running === true);
    dishwasherEl.classList.toggle("running", appliances.dishwasher?.running === true);
    dryerEl.classList.toggle("running", appliances.tumble_dryer?.running === true);
}

function updateHouseUsagePanel(metrics) {
    const loadEl = document.getElementById("usage-load-value");
    const costEl = document.getElementById("usage-cost-value");
    const rateEl = document.getElementById("usage-cost-rate");

    if (!metrics || !loadEl || !costEl || !rateEl) return;

    const watts = metrics.current_power_w ?? 0;
    const costPerHour = metrics.current_cost_per_hour_gbp ?? 0;
    const price = metrics.current_price_p_per_kwh ?? null;

    // --- Main values ---
    loadEl.textContent = `${Math.round(Math.abs(watts))}W`;
    costEl.textContent = `${formatGbp(costPerHour)}/hr`;
    rateEl.textContent =
        typeof price === "number" ? `At ${formatPrice(price)}` : "--";
}

export async function loadDashboard() {
    if (state.dashboardRequestInFlight) return;
    state.dashboardRequestInFlight = true;

    try {
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/api/dashboard`,
            {
                headers: { Accept: "application/json" },
                cache: "no-store",
            },
            5000,
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setPollIndicatorOk();
        pulsePollIndicator();

        updateHouseUsagePanel(data.usage_metrics);
        updateCostsTodayPanel(data.usage_metrics);
        updateBatteryPanel(data.battery);

        const housePower =
            typeof data.usage_metrics?.current_power_w === "number"
                ? data.usage_metrics.current_power_w
                : 0;

        updateHouseUsageGauge(Math.round(housePower));

        if (typeof data.live?.solar_generation_w === "number") {
            let solar = Math.round(data.live.solar_generation_w);

            if (solar < 10) {
                solar = 0;
            }

            const valueEl = document.querySelector("#solar-panel .panel-value");
            if (valueEl) valueEl.textContent = `${solar}W`;

            updateSolarGauge(solar);
        } else {
            const valueEl = document.querySelector("#solar-panel .panel-value");
            if (valueEl) valueEl.textContent = "--";

            updateSolarGauge(0);
        }

        updateSolarExportIcon(data.live?.octopus_current_demand_w);

        const agileSignature = getAgileSignature(data.agile);

        if (state.lastAgileSignature !== agileSignature) {
            state.lastAgileSignature = agileSignature;
            renderAgileChart(data.agile);
        }

        updateApplianceRow(data.appliances);
    } catch (error) {
        updateSolarExportIcon(0);
        setPollIndicatorError();

    } finally {
        state.dashboardRequestInFlight = false;
    }
}

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(`Request timed out after ${timeout}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
}

function getAgileSignature(agile) {
    if (!agile?.slots) return "";

    return agile.slots
        .map((slot) => `${slot.source_day}:${slot.source_index}:${slot.value_inc_vat}:${slot.is_now}`)
        .join("|");
}