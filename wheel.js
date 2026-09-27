// wheel.js

// ---------- Переключение исключения фильма ----------
function toggleExcluded(filmId) {
  const set = getExcluded();
  if (set.has(filmId)) {
    set.delete(filmId);
  } else {
    set.add(filmId);
  }
  saveExcluded(set);
  excludedFilmIds = set;
  renderAvailableFilms();
  renderExcludedList();
  refreshWheel();
}

// ---------- Рендер доступных фильмов ----------
function renderAvailableFilms() {
  const container = document.getElementById("films-container");
  if (!container) return;

  let available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));

  // Текстовый поиск
  if (availableSearchQuery.trim()) {
    available = available.filter((f) => matchesSearch(f, availableSearchQuery));
  }

  if (available.length === 0) {
    const msg = availableSearchQuery.trim()
      ? "По вашему запросу ничего не найдено"
      : "Нет доступных фильмов";
    container.innerHTML = `<p class="empty-message">${msg}</p>`;
    return;
  }

  container.innerHTML = available.map((film) => createFilmCard(film)).join("");
}

function createFilmCard(film) {
  const genresHtml = film.genres
    .map((genre) => `<span class="film-genre">${escapeHtml(genre)}</span>`)
    .join("");
  const durationText = film.duration || "—";
  const safeTitle = escapeHtml(film.title);
  const year = film.year;

  return `
    <div class="film-card" data-id="${film.id}">
        <div class="film-poster">
            ${film.poster ? `<img src="${film.poster}" alt="${safeTitle}">` : '<div class="poster-placeholder"><i class="fas fa-film"></i></div>'}
        </div>
        <div class="film-info">
            <div class="film-header">
                <h3 class="film-title">${safeTitle}</h3>
                <span class="film-year film-genre">${year}</span>
            </div>
            <div class="film-genres">${genresHtml}</div>
            <div class="film-actions">
                <span class="film-duration film-rating"><i class="far fa-clock"></i> ${durationText}</span>
                <button class="exclude-btn" data-film-id="${film.id}" title="Исключить из колеса">
                    <i class="fas fa-ban"></i>
                </button>
            </div>
        </div>
    </div>
    `;
}

// ---------- Рендер исключённых ----------
function renderExcludedList() {
  const container = document.getElementById("excluded-list");
  if (!container) return;

  const excludedArray = Array.from(excludedFilmIds);
  if (excludedArray.length === 0) {
    container.innerHTML =
      '<p class="empty-excluded">Нет исключённых фильмов</p>';
    return;
  }

  const films = allFilms.filter((f) => excludedFilmIds.has(f.id));
  container.innerHTML = films
    .map(
      (film) => `
        <div class="excluded-item" data-id="${film.id}">
            <span class="excluded-title">${escapeHtml(film.title)} (${film.year})</span>
            <i class="fas fa-undo-alt return-icon" title="Вернуть в колесо"></i>
        </div>
    `,
    )
    .join("");

  document.querySelectorAll(".excluded-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = Number(item.dataset.id);
      toggleExcluded(id);
    });
  });
}

// ---------- Утилита: перемешивание ----------
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Состояние пула ----------
const POOL_STORAGE_KEY = "spinPool";
const POOL_MAX_SIZE = 50;

// Поиск в блоке «Доступные фильмы»
let availableSearchQuery = "";

let poolState = {
  mode: "all", // "all" | "custom"
  customIds: [],
};

function loadPoolState() {
  try {
    const raw = localStorage.getItem(POOL_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.mode === "all" || parsed.mode === "custom")) {
      poolState.mode = parsed.mode;
      poolState.customIds = Array.isArray(parsed.customIds)
        ? parsed.customIds
        : [];
    }
  } catch (e) {
    warn("Не удалось загрузить пул:", e.message);
  }
}

function savePoolState() {
  try {
    localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(poolState));
  } catch (e) {
    warn("Не удалось сохранить пул:", e.message);
  }
}

function getActivePool() {
  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));

  if (poolState.mode === "custom") {
    const idSet = new Set(poolState.customIds);
    return available.filter((f) => idSet.has(f.id));
  }

  return available;
}

function getPoolStats() {
  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  if (poolState.mode === "custom") {
    const idSet = new Set(poolState.customIds);
    const matched = available.filter((f) => idSet.has(f.id));
    return {
      total: matched.length,
      storedTotal: poolState.customIds.length,
    };
  }
  return { total: available.length, storedTotal: available.length };
}

// ---------- Обновление UI пула ----------
function renderPoolControls() {
  const tabs = document.querySelectorAll(".wheel-pool-tab");
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === poolState.mode);
  });

  const countEl = document.getElementById("wheel-pool-count");
  if (countEl) {
    if (poolState.mode === "custom" && poolState.customIds.length > 0) {
      countEl.textContent = ` (${poolState.customIds.length})`;
      countEl.style.display = "inline";
    } else {
      countEl.textContent = "";
      countEl.style.display = "none";
    }
  }

  const editBtn = document.getElementById("wheel-pool-edit");
  if (editBtn) {
    editBtn.style.display =
      poolState.mode === "custom" ? "inline-flex" : "none";
  }

  const statusEl = document.getElementById("wheel-pool-status");
  if (statusEl) {
    const stats = getPoolStats();
    const viz = stats.total <= MAX_RING_CARDS ? "колесо" : "рулетка";

    if (poolState.mode === "custom") {
      const lost =
        poolState.customIds.length - stats.total > 0
          ? ` · недоступно: ${poolState.customIds.length - stats.total}`
          : "";
      statusEl.textContent = `Пул: ${stats.total} · источник: свой список · визуализация: ${viz}${lost}`;
    } else {
      const excludedCount = filteredFilms.length - stats.total;
      const ex = excludedCount > 0 ? ` · исключено: ${excludedCount}` : "";
      statusEl.textContent = `Пул: ${stats.total} · источник: все отфильтрованные · визуализация: ${viz}${ex}`;
    }
  }
}

// ---------- Модалка пула ----------
let poolModalSelection = new Set();

function openPoolModal() {
  const modal = document.getElementById("pool-modal");
  if (!modal) return;

  poolModalSelection = new Set(poolState.customIds);

  const searchInput = document.getElementById("pool-search-input");
  if (searchInput) searchInput.value = "";

  const onlySelectedCb = document.getElementById("pool-only-selected");
  if (onlySelectedCb) onlySelectedCb.checked = false;

  renderPoolModalList();
  updatePoolModalCounter();

  modal.style.display = "flex";
  setTimeout(() => {
    if (searchInput) searchInput.focus();
  }, 50);
}

function closePoolModal() {
  const modal = document.getElementById("pool-modal");
  if (modal) modal.style.display = "none";
}

function renderPoolModalList() {
  const container = document.getElementById("pool-modal-list");
  const searchInput = document.getElementById("pool-search-input");
  const onlySelectedCb = document.getElementById("pool-only-selected");
  if (!container) return;

  const query = (searchInput?.value || "").trim().toLowerCase();
  const onlySelected = !!onlySelectedCb?.checked;

  let available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));

  if (onlySelected) {
    available = available.filter((f) => poolModalSelection.has(f.id));
  }

  if (query) {
    available = available.filter((f) => matchesSearch(f, query));
  }

  if (available.length === 0) {
    container.innerHTML = `
      <p class="pool-modal-empty">
        ${onlySelected ? "Ничего не выбрано." : "Ничего не найдено."}
      </p>
    `;
    return;
  }

  container.innerHTML = available
    .map((film) => {
      const checked = poolModalSelection.has(film.id);
      const isMaxed = !checked && poolModalSelection.size >= POOL_MAX_SIZE;
      const disabled = isMaxed ? "disabled" : "";
      const posterUrl = film.poster
        ? `<img src="${film.poster}" alt="">`
        : `<div class="pool-modal-poster-ph"><i class="fas fa-film"></i></div>`;

      return `
        <label class="pool-modal-item ${checked ? "checked" : ""} ${isMaxed ? "disabled" : ""}">
          <input type="checkbox" data-film-id="${film.id}" ${checked ? "checked" : ""} ${disabled}>
          <div class="pool-modal-poster">${posterUrl}</div>
          <div class="pool-modal-info">
            <div class="pool-modal-title">${escapeHtml(film.title)}</div>
            <div class="pool-modal-year">${film.year || "—"}</div>
          </div>
        </label>
      `;
    })
    .join("");

  container.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = Number(e.target.dataset.filmId);
      if (e.target.checked) {
        if (poolModalSelection.size >= POOL_MAX_SIZE) {
          e.target.checked = false;
          alert(`Максимум ${POOL_MAX_SIZE} фильмов в пуле`);
          return;
        }
        poolModalSelection.add(id);
      } else {
        poolModalSelection.delete(id);
      }
      updatePoolModalCounter();
      renderPoolModalList();
    });
  });
}

function updatePoolModalCounter() {
  const counterEl = document.getElementById("pool-selected-count");
  if (counterEl) counterEl.textContent = poolModalSelection.size;
}

function poolModalSave() {
  if (poolModalSelection.size === 0) {
    if (confirm("Пул пустой. Переключиться на режим «Все фильмы»?")) {
      poolState.mode = "all";
      poolState.customIds = [];
      savePoolState();
      closePoolModal();
      refreshWheel();
      renderPoolControls();
    }
    return;
  }

  poolState.mode = "custom";
  poolState.customIds = Array.from(poolModalSelection);
  savePoolState();
  closePoolModal();
  refreshWheel();
  renderPoolControls();
}

function poolModalClear() {
  if (poolModalSelection.size === 0) return;
  if (!confirm("Снять выделение со всех фильмов?")) return;
  poolModalSelection.clear();
  updatePoolModalCounter();
  renderPoolModalList();
}

function poolModalRandom() {
  const maxAvailable = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  if (maxAvailable.length === 0) {
    alert("Нет доступных фильмов");
    return;
  }

  const input = prompt(
    `Сколько фильмов случайно выбрать? (1-${POOL_MAX_SIZE})`,
    "12",
  );
  if (input === null) return;
  const n = parseInt(input, 10);
  if (isNaN(n) || n < 1 || n > POOL_MAX_SIZE) {
    alert(`Введите число от 1 до ${POOL_MAX_SIZE}`);
    return;
  }

  const shuffled = shuffleArray(maxAvailable);
  const picked = shuffled.slice(0, Math.min(n, maxAvailable.length));

  poolModalSelection = new Set(picked.map((f) => f.id));
  updatePoolModalCounter();
  renderPoolModalList();
}

// ---------- Состояние колеса ----------
let currentRotation = 0;
let wheelPool = [];
let wheelMode = null; // "ring" | "reel"
let wheelReelState = null;
let isSpinning = false;
let spinTimeouts = []; // активные setTimeout от спина — чтобы отменить их при прерывании
const MAX_RING_CARDS = 12;

// ==================== КОЛЬЦО ====================
function renderRingInto(container, pool) {
  const ringContainer = document.getElementById("wheel-ring-container");
  const reelContainer = document.getElementById("wheel-reel-container");
  const ring = document.getElementById("wheel-ring");
  const loading = document.getElementById("wheel-ring-loading");
  if (!ring || !ringContainer) return;

  ringContainer.style.display = "block";
  if (reelContainer) reelContainer.style.display = "none";

  if (!pool || pool.length === 0) {
    wheelPool = [];
    ring.innerHTML = "";
    if (loading) {
      loading.style.display = "flex";
      loading.innerHTML = `
        <i class="fas fa-exclamation-circle" style="font-size:2rem;"></i>
        <span>Нет доступных фильмов</span>
      `;
    }
    return;
  }

  if (loading) loading.style.display = "none";

  wheelMode = "ring";
  wheelPool = [...pool];

  const N = pool.length;
  const angleStep = 360 / N;

  const size = ringContainer.offsetWidth;
  const cardW = size <= 400 ? 64 : 90;
  const cardH = size <= 400 ? 115 : 160;
  const radius = (size - cardH) / 2 - 14;

  ring.innerHTML = "";
  ring.style.transition = "none";

  currentRotation = Math.random() * 360;
  ring.style.transform = `rotate(${currentRotation}deg)`;

  pool.forEach((film, i) => {
    const angle = i * angleStep;
    const card = document.createElement("div");
    card.className = "wheel-ring-card";
    card.dataset.index = i;
    card.style.width = cardW + "px";
    card.style.height = cardH + "px";
    card.style.marginLeft = -(cardW / 2) + "px";
    card.style.marginTop = -(cardH / 2) + "px";
    card.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;

    if (film.poster) {
      const img = document.createElement("img");
      img.src = film.poster;
      img.alt = "";
      img.style.width = cardW + "px";
      img.style.height = cardH + "px";
      card.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "wheel-ring-card-placeholder";
      ph.style.width = cardW + "px";
      ph.style.height = cardH + "px";
      ph.innerHTML = '<i class="fas fa-film"></i>';
      card.appendChild(ph);
    }

    ring.appendChild(card);
  });
}

function spinRing() {
  const ring = document.getElementById("wheel-ring");
  if (!ring) return;

  const N = wheelPool.length;
  const angleStep = 360 / N;
  const winnerIndex = Math.floor(Math.random() * N);
  const winner = wheelPool[winnerIndex];

  const durationSec = getSpinDurationSeconds();
  const fullRotations = Math.max(2, Math.round(2 + durationSec * 1.4));

  const currentMod = ((currentRotation % 360) + 360) % 360;
  const targetMod = (((360 - winnerIndex * angleStep) % 360) + 360) % 360;

  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  delta += 360 * fullRotations;

  const overshoot = 4;
  const overshootRotation = currentRotation + delta + overshoot;
  const finalRotation = currentRotation + delta;
  currentRotation = finalRotation;

  ring.style.transition = `transform ${durationSec}s cubic-bezier(0.12, 0.62, 0.28, 1)`;
  ring.style.transform = `rotate(${overshootRotation}deg)`;

  const t1 = setTimeout(
    () => {
      ring.style.transition = `transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`;
      ring.style.transform = `rotate(${finalRotation}deg)`;

      const t2 = setTimeout(() => {
        const winnerCard = ring.querySelector(
          `.wheel-ring-card[data-index="${winnerIndex}"]`,
        );
        if (winnerCard) winnerCard.classList.add("winner");
        finishSpin(winner);
      }, 350);
      spinTimeouts.push(t2);
    },
    Math.round(durationSec * 1000) + 50,
  );
  spinTimeouts.push(t1);
}

// ==================== РУЛЕТКА ====================
function renderReelInto(container, pool) {
  const ringContainer = document.getElementById("wheel-ring-container");
  const reelContainer = document.getElementById("wheel-reel-container");
  const reel = document.getElementById("wheel-reel");
  if (!reel || !reelContainer) return;

  if (ringContainer) ringContainer.style.display = "none";
  reelContainer.style.display = "block";

  wheelMode = "reel";
  wheelPool = [...pool];

  const cardW = 110;
  const cardH = 165;
  const gap = 12;
  const step = cardW + gap;

  const K = 3;
  const fullArray = [];
  for (let i = 0; i < K; i++) fullArray.push(...pool);

  reel.style.transition = "none";
  reel.style.transform = "translateX(0) translateY(-50%)";

  reel.innerHTML = fullArray
    .map((film) => {
      const posterHtml = film.poster
        ? `<img src="${film.poster}" alt="">`
        : `<div class="wheel-reel-poster-ph"><i class="fas fa-film"></i></div>`;
      return `<div class="wheel-reel-card" style="width:${cardW}px;height:${cardH}px;">${posterHtml}</div>`;
    })
    .join("");

  wheelReelState = {
    cardW,
    cardH,
    step,
    K,
    poolLength: pool.length,
    pool: [...pool],
  };
}

function spinReel() {
  const reel = document.getElementById("wheel-reel");
  const reelContainer = document.getElementById("wheel-reel-container");
  if (!reel || !reelContainer || !wheelReelState) return;

  const { cardW, step, poolLength, pool } = wheelReelState;
  const wrapW = reelContainer.offsetWidth;

  const winnerIndex = Math.floor(Math.random() * poolLength);
  const winner = pool[winnerIndex];

  const repeatIdx = 1;
  const winnerFullIdx = repeatIdx * poolLength + winnerIndex;

  reel.style.transition = "none";
  reel.style.transform = "translateX(0) translateY(-50%)";

  const durationSec = getSpinDurationSeconds();
  const targetX = wrapW / 2 - (winnerFullIdx * step + cardW / 2);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reel.style.transition = `transform ${durationSec}s cubic-bezier(0.12, 0.62, 0.28, 1)`;
      reel.style.transform = `translateX(${targetX}px) translateY(-50%)`;

      const t = setTimeout(
        () => {
          const cards = reel.querySelectorAll(".wheel-reel-card");
          if (cards[winnerFullIdx])
            cards[winnerFullIdx].classList.add("winner");
          finishSpin(winner);
        },
        Math.round(durationSec * 1000) + 50,
      );
      spinTimeouts.push(t);
    });
  });
}

// ==================== ОБЩЕЕ ====================
function renderWheelStage() {
  const stage = document.getElementById("wheel-stage");
  if (!stage) return;

  const pool = getActivePool();
  if (pool.length === 0) {
    wheelMode = null;
    wheelPool = [];
    const ringContainer = document.getElementById("wheel-ring-container");
    const reelContainer = document.getElementById("wheel-reel-container");
    if (ringContainer) ringContainer.style.display = "none";
    if (reelContainer) reelContainer.style.display = "none";
    return;
  }

  if (pool.length <= MAX_RING_CARDS) {
    renderRingInto(stage, pool);
  } else {
    renderReelInto(stage, pool);
  }
}

function finishSpin(winner) {
  isSpinning = false;

  const resultEl = document.getElementById("wheel-result");
  if (resultEl) {
    const posterHtml = winner.poster
      ? `<img src="${winner.poster}" alt="">`
      : `<div class="wheel-result-poster-ph"><i class="fas fa-film"></i></div>`;

    resultEl.innerHTML = `
      <div class="wheel-result-card">
        <div class="wheel-result-poster">${posterHtml}</div>
        <div class="wheel-result-text">
          <div class="wheel-result-name">${escapeHtml(winner.title)}</div>
          <div class="wheel-result-year">${winner.year || "—"}</div>
        </div>
      </div>
    `;
  }

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.innerHTML = '<i class="fas fa-dice"></i> Крутить ещё раз';
  }
}

function spinWheel() {
  if (isSpinning) return;
  if (!wheelPool || wheelPool.length === 0) return;
  if (!allFilms || allFilms.length === 0) return;

  isSpinning = true;
  resetWheelResult();

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Крутим...';
  }

  if (wheelMode === "ring") {
    spinRing();
  } else if (wheelMode === "reel") {
    spinReel();
  } else {
    isSpinning = false;
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Крутить!';
    }
  }
}

function resetWheelResult() {
  const resultEl = document.getElementById("wheel-result");
  if (resultEl) resultEl.innerHTML = "";

  const ring = document.getElementById("wheel-ring");
  if (ring) {
    ring
      .querySelectorAll(".wheel-ring-card.winner")
      .forEach((c) => c.classList.remove("winner"));
  }

  const reel = document.getElementById("wheel-reel");
  if (reel) {
    reel
      .querySelectorAll(".wheel-reel-card.winner")
      .forEach((c) => c.classList.remove("winner"));
  }
}

// ---------- Отмена активного спина ----------
// Останавливает все setTimeout, гасит transition на элементе
// и сбрасывает флаг isSpinning. Используется, когда пользователь
// меняет пул прямо во время вращения.
function cancelSpin() {
  spinTimeouts.forEach((id) => clearTimeout(id));
  spinTimeouts = [];

  if (!isSpinning) return;
  isSpinning = false;

  const ring = document.getElementById("wheel-ring");
  if (ring) ring.style.transition = "none";

  const reel = document.getElementById("wheel-reel");
  if (reel) reel.style.transition = "none";
}

function setWheelReady() {
  const spinBtn = document.getElementById("spin-button");
  if (!spinBtn) return;
  spinBtn.disabled = false;
  spinBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Крутить!';
}

function refreshWheel() {
  cancelSpin();
  resetWheelResult();
  renderWheelStage();
  renderPoolControls();
  setWheelReady();
}

// ---------- Настройка длительности ----------
const SPIN_DURATION_STORAGE_KEY = "spinDuration";
const SPIN_DURATION_MIN = 0.5;
const SPIN_DURATION_MAX = 15;

function loadSpinDuration() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  const randomCb = document.getElementById("spin-duration-random");
  if (!minInput || !maxInput || !randomCb) return;

  try {
    const stored = JSON.parse(
      localStorage.getItem(SPIN_DURATION_STORAGE_KEY) || "{}",
    );

    if (typeof stored.min === "number") minInput.value = stored.min;
    if (typeof stored.max === "number") maxInput.value = stored.max;
    randomCb.checked = !!stored.random;

    applySpinDurationView();
  } catch (e) {
    /* ignore */
  }
}

function applySpinDurationView() {
  const randomCb = document.getElementById("spin-duration-random");
  const maxInput = document.getElementById("spin-duration-max");
  const sep = document.getElementById("spin-duration-sep");
  if (!randomCb || !maxInput || !sep) return;

  const isRandom = randomCb.checked;
  maxInput.style.display = isRandom ? "inline-block" : "none";
  sep.style.display = isRandom ? "inline" : "none";
}

function saveSpinDuration() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  const randomCb = document.getElementById("spin-duration-random");
  if (!minInput || !maxInput || !randomCb) return;

  const min = parseFloat(minInput.value);
  const max = parseFloat(maxInput.value);
  try {
    localStorage.setItem(
      SPIN_DURATION_STORAGE_KEY,
      JSON.stringify({ min, max, random: randomCb.checked }),
    );
  } catch (e) {
    /* ignore */
  }
}

function getSpinDurationSeconds() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  const randomCb = document.getElementById("spin-duration-random");
  if (!minInput || !maxInput || !randomCb) return 2;

  const isRandom = randomCb.checked;

  let min = parseFloat(minInput.value);
  let max = isRandom ? parseFloat(maxInput.value) : min;

  if (isNaN(min)) min = 2;
  if (isNaN(max)) max = min;

  min = Math.max(SPIN_DURATION_MIN, Math.min(SPIN_DURATION_MAX, min));
  max = Math.max(SPIN_DURATION_MIN, Math.min(SPIN_DURATION_MAX, max));

  if (min > max) [min, max] = [max, min];

  return min === max ? min : min + Math.random() * (max - min);
}

// ---------- Инициализация ----------
document.addEventListener("DOMContentLoaded", function () {
  loadAllFilmsFromFirebase()
    .then((films) => {
      allFilms = films;
      allFilms.forEach((film, index) => {
        if (film.id === undefined) film.id = index;
      });

      filteredFilms = [...allFilms];
      excludedFilmIds = getExcluded();

      if (typeof window.onFilmsLoaded === "function") {
        window.onFilmsLoaded();
      }

      loadFilterState();
      populateGenreList();
      syncGenreCheckboxes();

      const yearFromInput = document.getElementById("year-from");
      const yearToInput = document.getElementById("year-to");
      if (yearFromInput) yearFromInput.value = yearFrom;
      if (yearToInput) yearToInput.value = yearTo;

      renderAvailableFilms();
      renderExcludedList();

      // Пул
      loadPoolState();
      renderPoolControls();

      renderWheelStage();
      setWheelReady();

      // Настройка длительности
      loadSpinDuration();
      const durMinInput = document.getElementById("spin-duration-min");
      const durMaxInput = document.getElementById("spin-duration-max");
      const durRandomCb = document.getElementById("spin-duration-random");
      if (durMinInput) durMinInput.addEventListener("change", saveSpinDuration);
      if (durMaxInput) durMaxInput.addEventListener("change", saveSpinDuration);
      if (durRandomCb) {
        durRandomCb.addEventListener("change", () => {
          applySpinDurationView();
          saveSpinDuration();
        });
      }

      document.addEventListener("click", (e) => {
        if (e.target.closest(".exclude-btn")) {
          const btn = e.target.closest(".exclude-btn");
          const filmId = Number(btn.dataset.filmId);
          toggleExcluded(filmId);
        }
      });

      enrichFilmsProgressively(films, (updated) => {
        allFilms = updated;
        updateFilteredFilms(() => {
          renderAvailableFilms();
        });
        renderExcludedList();
      });
    })
    .catch((error) => {
      console.error("Ошибка загрузки фильмов:", error);
      const loading = document.getElementById("wheel-ring-loading");
      if (loading) {
        loading.innerHTML = `<span style="color: red;">Ошибка загрузки данных</span>`;
      }
    });

  // ---------- Фильтры ----------
  const yearFromInput = document.getElementById("year-from");
  const yearToInput = document.getElementById("year-to");
  const applyYearBtn = document.getElementById("apply-year-filter");
  if (applyYearBtn) {
    applyYearBtn.addEventListener("click", () => {
      yearFrom = yearFromInput ? yearFromInput.value : "";
      yearTo = yearToInput ? yearToInput.value : "";
      saveFilterState();
      updateFilteredFilms(() => {
        renderAvailableFilms();
        refreshWheel();
      });
    });
  }
  [yearFromInput, yearToInput].forEach((input) => {
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && applyYearBtn) applyYearBtn.click();
      });
    }
  });

  const minDurInput = document.getElementById("duration-min");
  const maxDurInput = document.getElementById("duration-max");
  const applyDurBtn = document.getElementById("apply-duration-filter");
  if (applyDurBtn) {
    applyDurBtn.addEventListener("click", () => {
      const min = minDurInput ? parseInt(minDurInput.value, 10) : null;
      const max = maxDurInput ? parseInt(maxDurInput.value, 10) : null;
      if (min || max) {
        durationFilter = { min: min || 0, max: max || 999 };
      } else {
        durationFilter = null;
      }
      updateFilteredFilms(() => {
        renderAvailableFilms();
        refreshWheel();
      });
    });
  }

  const genreFilterBtn = document.querySelector(".genre-filter-btn");
  const genreDropdown = document.querySelector(".genre-dropdown");
  if (genreFilterBtn && genreDropdown) {
    genreFilterBtn.addEventListener("click", () => {
      genreDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (
        !genreFilterBtn.contains(e.target) &&
        !genreDropdown.contains(e.target)
      ) {
        genreDropdown.classList.add("hidden");
      }
    });
  }

  const genreSearch = document.querySelector(".genre-search");
  if (genreSearch) {
    genreSearch.addEventListener("input", (e) => {
      filterGenreList(e.target.value);
    });
  }

  const genreClear = document.querySelector(".genre-clear");
  if (genreClear) {
    genreClear.addEventListener("click", () => {
      clearGenreFilter();
      updateFilteredFilms(() => {
        renderAvailableFilms();
        refreshWheel();
      });
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target.closest(".genre-item input")) {
      setTimeout(() => {
        updateFilteredFilms(() => {
          renderAvailableFilms();
          refreshWheel();
        });
      }, 0);
    }
  });

  const resetBtn = document.getElementById("reset-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      yearFrom = "";
      yearTo = "";
      if (yearFromInput) yearFromInput.value = "";
      if (yearToInput) yearToInput.value = "";
      if (minDurInput) minDurInput.value = "";
      if (maxDurInput) maxDurInput.value = "";
      durationFilter = null;
      activeGenres = [];
      syncGenreCheckboxes();
      saveFilterState();
      updateFilteredFilms(() => {
        renderAvailableFilms();
        refreshWheel();
      });
    });
  }

  // ---------- Поиск в блоке доступных фильмов ----------
  const availableSearchInput = document.getElementById(
    "available-search-input",
  );
  const availableSearchClear = document.getElementById(
    "available-search-clear",
  );
  if (availableSearchInput) {
    availableSearchInput.addEventListener("input", (e) => {
      availableSearchQuery = e.target.value;
      renderAvailableFilms();
    });
  }
  if (availableSearchClear) {
    availableSearchClear.addEventListener("click", () => {
      availableSearchQuery = "";
      if (availableSearchInput) availableSearchInput.value = "";
      renderAvailableFilms();
    });
  }

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) spinBtn.addEventListener("click", spinWheel);

  // ---------- Обработчики пула ----------
  document.querySelectorAll(".wheel-pool-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      if (mode === "all") {
        poolState.mode = "all";
        poolState.customIds = [];
        savePoolState();
        refreshWheel();
      } else if (mode === "custom") {
        openPoolModal();
      }
    });
  });

  const poolEditBtn = document.getElementById("wheel-pool-edit");
  if (poolEditBtn) {
    poolEditBtn.addEventListener("click", openPoolModal);
  }

  const poolSearchInput = document.getElementById("pool-search-input");
  if (poolSearchInput) {
    poolSearchInput.addEventListener("input", renderPoolModalList);
  }

  const poolOnlySelected = document.getElementById("pool-only-selected");
  if (poolOnlySelected) {
    poolOnlySelected.addEventListener("change", renderPoolModalList);
  }

  const poolRandomBtn = document.getElementById("pool-random-btn");
  if (poolRandomBtn) poolRandomBtn.addEventListener("click", poolModalRandom);

  const poolClearBtn = document.getElementById("pool-clear-btn");
  if (poolClearBtn) poolClearBtn.addEventListener("click", poolModalClear);

  const poolCancelBtn = document.getElementById("pool-cancel-btn");
  if (poolCancelBtn) poolCancelBtn.addEventListener("click", closePoolModal);

  const poolSaveBtn = document.getElementById("pool-save-btn");
  if (poolSaveBtn) poolSaveBtn.addEventListener("click", poolModalSave);

  const poolModal = document.getElementById("pool-modal");
  if (poolModal) {
    poolModal.addEventListener("click", (e) => {
      if (e.target.id === "pool-modal") closePoolModal();
    });
  }
});
