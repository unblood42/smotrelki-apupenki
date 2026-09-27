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

  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  if (available.length === 0) {
    container.innerHTML = '<p class="empty-message">Нет доступных фильмов</p>';
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

// ---------- Активный пул ----------
function getActivePool() {
  return filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
}

// Перемешивание
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Состояние колеса ----------
let currentRotation = 0;
let wheelPool = [];
let isSpinning = false;
const MAX_RING_CARDS = 12;

// ---------- Рендер кольца ----------
function renderWheelRing(pool) {
  const ring = document.getElementById("wheel-ring");
  const container = document.getElementById("wheel-ring-container");
  const loading = document.getElementById("wheel-ring-loading");
  if (!ring || !container) return;

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

  // Для > 12 берём случайную выборку — пока (до варианта 2)
  let displayPool = pool;
  if (pool.length > MAX_RING_CARDS) {
    displayPool = shuffleArray(pool).slice(0, MAX_RING_CARDS);
  }
  wheelPool = displayPool;

  const N = displayPool.length;
  const angleStep = 360 / N;

  // Динамический радиус по размеру контейнера
  const size = container.offsetWidth;
  const cardW = size <= 400 ? 64 : 90;
  const cardH = size <= 400 ? 115 : 160;
  const radius = (size - cardH) / 2 - 14;

  ring.innerHTML = "";
  ring.style.transition = "none";

  // Случайный стартовый угол, чтобы никто не был "выбран" по умолчанию
  currentRotation = Math.random() * 360;
  ring.style.transform = `rotate(${currentRotation}deg)`;

  displayPool.forEach((film, i) => {
    const angle = i * angleStep;
    const card = document.createElement("div");
    card.className = "wheel-ring-card";
    card.dataset.index = i;
    card.style.width = cardW + "px";
    card.style.height = cardH + "px";
    card.style.marginLeft = -(cardW / 2) + "px";
    card.style.marginTop = -(cardH / 2) + "px";
    card.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;

    const imgHeight = cardH - 30;

    if (film.poster) {
      const img = document.createElement("img");
      img.src = film.poster;
      img.alt = "";
      img.style.width = cardW + "px";
      img.style.height = imgHeight + "px";
      card.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "wheel-ring-card-placeholder";
      ph.style.width = cardW + "px";
      ph.style.height = imgHeight + "px";
      ph.innerHTML = '<i class="fas fa-film"></i>';
      card.appendChild(ph);
    }

    const title = document.createElement("div");
    title.className = "wheel-ring-card-title";
    title.textContent = film.title;
    card.appendChild(title);

    ring.appendChild(card);
  });
}

// ---------- Обновление колеса (пересборка пула + сброс результата) ----------
function refreshWheel() {
  resetWheelResult();
  renderWheelRing(getActivePool());
  if (!isSpinning) {
    setWheelReady();
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
}

function setWheelReady() {
  const spinBtn = document.getElementById("spin-button");
  if (!spinBtn) return;
  spinBtn.disabled = false;
  spinBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Крутить!';
}

// ---------- Настройка длительности ----------
const SPIN_DURATION_STORAGE_KEY = "spinDuration";
const SPIN_DURATION_MIN = 0.5;
const SPIN_DURATION_MAX = 15;

function loadSpinDuration() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  if (!minInput || !maxInput) return;
  try {
    const stored = JSON.parse(
      localStorage.getItem(SPIN_DURATION_STORAGE_KEY) || "{}",
    );
    if (typeof stored.min === "number") minInput.value = stored.min;
    if (typeof stored.max === "number") maxInput.value = stored.max;
  } catch (e) {
    /* ignore */
  }
}

function saveSpinDuration() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  if (!minInput || !maxInput) return;
  const min = parseFloat(minInput.value);
  const max = parseFloat(maxInput.value);
  try {
    localStorage.setItem(
      SPIN_DURATION_STORAGE_KEY,
      JSON.stringify({ min, max }),
    );
  } catch (e) {
    /* ignore */
  }
}

function getSpinDurationSeconds() {
  const minInput = document.getElementById("spin-duration-min");
  const maxInput = document.getElementById("spin-duration-max");
  if (!minInput || !maxInput) return 2;

  let min = parseFloat(minInput.value);
  let max = parseFloat(maxInput.value);
  if (isNaN(min)) min = 2;
  if (isNaN(max)) max = min;

  min = Math.max(SPIN_DURATION_MIN, Math.min(SPIN_DURATION_MAX, min));
  max = Math.max(SPIN_DURATION_MIN, Math.min(SPIN_DURATION_MAX, max));
  if (min > max) [min, max] = [max, min];

  return min === max ? min : min + Math.random() * (max - min);
}

// ---------- Спин ----------
function spinWheel() {
  if (isSpinning) return;
  if (!wheelPool || wheelPool.length === 0) return;
  if (!allFilms || allFilms.length === 0) return;

  const ring = document.getElementById("wheel-ring");
  if (!ring) return;

  isSpinning = true;
  resetWheelResult();

  const N = wheelPool.length;
  const angleStep = 360 / N;
  const winnerIndex = Math.floor(Math.random() * N);
  const winner = wheelPool[winnerIndex];

  const durationSec = getSpinDurationSeconds();
  // Больше секунд → больше полных оборотов
  const fullRotations = Math.max(2, Math.round(2 + durationSec * 1.4));

  // Текущий угол по модулю 360
  const currentMod = ((currentRotation % 360) + 360) % 360;
  // Победитель должен оказаться на позиции 0 (верх)
  const targetMod = (((360 - winnerIndex * angleStep) % 360) + 360) % 360;

  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  delta += 360 * fullRotations;

  // Лёгкий перелёт (микро-отскок) — 4 градуса
  const overshoot = 4;
  const overshootRotation = currentRotation + delta + overshoot;
  const finalRotation = currentRotation + delta;
  currentRotation = finalRotation;

  // Кнопка
  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Крутим...';
  }

  // Фаза 1: основной пролёт с перелётом
  ring.style.transition = `transform ${durationSec}s cubic-bezier(0.12, 0.62, 0.28, 1)`;
  ring.style.transform = `rotate(${overshootRotation}deg)`;

  // Фаза 2: отскок на место
  setTimeout(
    () => {
      ring.style.transition = `transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`;
      ring.style.transform = `rotate(${finalRotation}deg)`;

      setTimeout(() => {
        // Подсветка победителя
        const winnerCard = ring.querySelector(
          `.wheel-ring-card[data-index="${winnerIndex}"]`,
        );
        if (winnerCard) winnerCard.classList.add("winner");

        // Результат
        const resultEl = document.getElementById("wheel-result");
        if (resultEl) {
          resultEl.innerHTML = `
          <div class="wheel-result-title">
            🎉 ${escapeHtml(winner.title)}
            <span class="wheel-result-year">(${winner.year || "—"})</span>
          </div>
        `;
        }

        isSpinning = false;
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.innerHTML = '<i class="fas fa-dice"></i> Крутить ещё раз';
        }
      }, 350);
    },
    Math.round(durationSec * 1000) + 50,
  );
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
      renderWheelRing(getActivePool());
      setWheelReady();

      // Настройка длительности
      loadSpinDuration();
      const durMinInput = document.getElementById("spin-duration-min");
      const durMaxInput = document.getElementById("spin-duration-max");
      if (durMinInput) durMinInput.addEventListener("change", saveSpinDuration);
      if (durMaxInput) durMaxInput.addEventListener("change", saveSpinDuration);

      // Делегирование клика по кнопке исключения
      document.addEventListener("click", (e) => {
        if (e.target.closest(".exclude-btn")) {
          const btn = e.target.closest(".exclude-btn");
          const filmId = Number(btn.dataset.filmId);
          toggleExcluded(filmId);
        }
      });

      // Фоновое обогащение — не трогаем кольцо, чтобы не сбрасывать позицию
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

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) spinBtn.addEventListener("click", spinWheel);
});
