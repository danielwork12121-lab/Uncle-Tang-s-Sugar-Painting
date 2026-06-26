/**
 * GameEconomy — Shared economy state for the sugar painting game
 *
 * Uses localStorage key: "sugarGameEconomy"
 *
 * Runtime state:
 *   - money: number (runtime-only, resets on page reload)
 *
 * Persisted state (localStorage):
 *   - upgrades: object with upgrade levels
 *
 * Safe: never NaN, never negative, graceful corruption recovery.
 */

const GAME_ECONOMY_STORAGE_KEY = "sugarGameEconomy";

const DEFAULT_UPGRADES_STATE = {
  candySellValue: 0,
  dailyCustomers: 0,
  newCandyUnlock: 0,
  skilledHands: 0
};

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function _safeParse(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// Runtime-only money (resets on page reload)
let _money = 0;

// Persisted upgrades (survives page reload)
let _upgrades = _deepClone(DEFAULT_UPGRADES_STATE);

/** Load upgrades from localStorage, with graceful corruption recovery */
function loadEconomy() {
  try {
    const raw = localStorage.getItem(GAME_ECONOMY_STORAGE_KEY);
    if (!raw) return;

    const parsed = _safeParse(raw);
    if (!parsed) {
      console.warn("[GameEconomy] Corrupted localStorage, resetting to defaults");
      _upgrades = _deepClone(DEFAULT_UPGRADES_STATE);
      saveEconomy();
      return;
    }

    // Load upgrades from localStorage, ignore money (runtime-only)
    if (parsed.upgrades && typeof parsed.upgrades === "object") {
      for (const key of Object.keys(DEFAULT_UPGRADES_STATE)) {
        if (typeof parsed.upgrades[key] === "number" && !isNaN(parsed.upgrades[key])) {
          _upgrades[key] = Math.max(0, parsed.upgrades[key]);
        }
      }
    }
  } catch (e) {
    console.warn("[GameEconomy] Failed to load economy:", e);
  }
}

/** Save economy to localStorage (upgrades only, money is runtime-only) */
function saveEconomy() {
  try {
    const dataToSave = { upgrades: _upgrades };
    localStorage.setItem(GAME_ECONOMY_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn("[GameEconomy] Failed to save economy:", e);
  }
}

// Initialize: load upgrades from localStorage
loadEconomy();

/** Get current money (runtime-only) */
function getMoney() {
  return _money;
}

/** Set money to exact value (clamped to >= 0) */
function setMoney(value) {
  if (typeof value !== "number" || isNaN(value)) {
    console.warn("[GameEconomy] setMoney called with NaN, ignoring");
    return;
  }
  _money = Math.max(0, value);
  // Do NOT save to localStorage
}

/** Add money (can be negative for spending) */
function addMoney(amount) {
  if (typeof amount !== "number" || isNaN(amount)) {
    console.warn("[GameEconomy] addMoney called with NaN, ignoring");
    return;
  }
  _money = Math.max(0, _money + amount);
  // Do NOT save to localStorage
}

/** Spend money if affordable. Returns true if successful. */
function spendMoney(amount) {
  if (typeof amount !== "number" || isNaN(amount)) {
    console.warn("[GameEconomy] spendMoney called with NaN, ignoring");
    return false;
  }
  if (_money >= amount) {
    _money -= amount;
    return true;
  }
  return false;
}

/** Get upgrade level by id */
function getUpgradeLevel(id) {
  if (_upgrades && typeof _upgrades[id] === "number") {
    return _upgrades[id];
  }
  return 0;
}

/** Check if player can afford a cost */
function canAfford(cost) {
  if (typeof cost !== "number" || isNaN(cost)) return false;
  return _money >= cost;
}

/** Buy upgrade: spend cost, increment level, save. Returns true if successful. */
function buyUpgrade(id, cost) {
  if (!canAfford(cost)) return false;
  if (!spendMoney(cost)) return false;

  if (!_upgrades) _upgrades = {};
  _upgrades[id] = (_upgrades[id] || 0) + 1;
  saveEconomy();
  return true;
}

/** Get candy value multiplier: 1 + level * 0.1 */
function getCandyValueMultiplier() {
  const level = getUpgradeLevel("candySellValue");
  return 1 + level * 0.1;
}

/** Get daily customer bonus: level * 2 */
function getDailyCustomerBonus() {
  const level = getUpgradeLevel("dailyCustomers");
  return level * 2;
}

/** Force reload upgrades from localStorage (useful for debugging) */
function reloadEconomy() {
  // Don't change _money - it's runtime-only
  _upgrades = _deepClone(DEFAULT_UPGRADES_STATE);
  loadEconomy();
}

/** Reset economy to defaults (for debugging) */
function resetEconomy() {
  _money = 0;
  _upgrades = _deepClone(DEFAULT_UPGRADES_STATE);
  saveEconomy();
}

export {
  GAME_ECONOMY_STORAGE_KEY,
  loadEconomy,
  saveEconomy,
  getMoney,
  setMoney,
  addMoney,
  spendMoney,
  getUpgradeLevel,
  canAfford,
  buyUpgrade,
  getCandyValueMultiplier,
  getDailyCustomerBonus,
  reloadEconomy,
  resetEconomy
};
