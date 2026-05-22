import { API_BASE_URL } from "./config.js";

function formatPowerValue(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "0W";
    }

    if (value < 10) {
        return `${value.toFixed(1)}W`;
    }

    return `${Math.round(value)}W`;
}

async function fetchDevicePower() {
    const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to load device power usage: HTTP ${response.status}`);
    }

    return response.json();
}

function getPowerItems(data) {
    const items = data?.live?.device_power?.current?.items ?? [];

    return items
        .filter((item) => typeof item.power_w === "number" && item.power_w > 0)
        .sort((a, b) => b.power_w - a.power_w);
}

function renderPowerUsageList(items) {
    const list = document.getElementById("power-usage-list");
    const totalEl = document.getElementById("power-usage-total");

    if (!list) return;

    list.innerHTML = "";

    if (!items.length) {
        if (totalEl) {
            totalEl.textContent = "Total 0W";
        }

        list.innerHTML = `<div class="cost-usage-empty">No power data available</div>`;
        return;
    }

    const total = items.reduce((sum, item) => sum + item.power_w, 0);

    if (totalEl) {
        totalEl.textContent = `Total ${formatPowerValue(total)}`;
    }

    const maxValue = Math.max(...items.map((item) => item.power_w), 0.001);

    for (const item of items) {
        const row = document.createElement("div");
        row.className = "cost-usage-row";

        if (item.power_w < maxValue * 0.15) {
            row.dataset.low = "true";
        }

        const header = document.createElement("div");
        header.className = "cost-usage-row-header";

        const name = document.createElement("div");
        name.className = "cost-usage-name";
        name.textContent = item.name;

        const value = document.createElement("div");
        value.className = "cost-usage-value";

        const percentage = total > 0 ? (item.power_w / total) * 100 : 0;
        value.textContent = `${formatPowerValue(item.power_w)} (${percentage.toFixed(0)}%)`;

        header.appendChild(name);
        header.appendChild(value);

        const barTrack = document.createElement("div");
        barTrack.className = "cost-usage-bar-track";

        const barFill = document.createElement("div");
        barFill.className = "cost-usage-bar-fill cost-usage-bar-current";
        barFill.style.width = "0%";

        requestAnimationFrame(() => {
            barFill.style.width = `${Math.max((item.power_w / maxValue) * 100, 4)}%`;
        });

        barTrack.appendChild(barFill);
        row.appendChild(header);
        row.appendChild(barTrack);
        list.appendChild(row);
    }
}

export async function loadPowerUsageModalPartial() {
    const root = document.getElementById("power-usage-modal-root");
    if (!root) return;

    const response = await fetch(`/static/partials/power-usage-modal.html`, {
        headers: { Accept: "text/html" },
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to load power usage modal partial: HTTP ${response.status}`);
    }

    root.innerHTML = await response.text();
}

export async function loadPowerUsage() {
    const data = await fetchDevicePower();
    const items = getPowerItems(data);

    renderPowerUsageList(items);
}

export async function openPowerUsageModal() {
    const modal = document.getElementById("power-usage-modal");
    const backdrop = document.getElementById("power-usage-backdrop");

    if (!modal || !backdrop) return;

    modal.removeAttribute("hidden");
    backdrop.removeAttribute("hidden");

    await loadPowerUsage();
}

export function closePowerUsageModal() {
    const modal = document.getElementById("power-usage-modal");
    const backdrop = document.getElementById("power-usage-backdrop");

    if (!modal || !backdrop) return;

    modal.setAttribute("hidden", "");
    backdrop.setAttribute("hidden", "");
}

export function setupPowerUsageModal() {
    const openButton = document.getElementById("power-button");
    const root = document.getElementById("power-usage-modal-root");

    if (!openButton || !root) return;

    openButton.addEventListener("click", async () => {
        await openPowerUsageModal();
    });

    root.addEventListener("click", async (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) return;

        if (
            target.id === "power-usage-close-button" ||
            target.id === "power-usage-backdrop"
        ) {
            closePowerUsageModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePowerUsageModal();
        }
    });
}