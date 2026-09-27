// wheel.js

// ---------- Переключение исключения фильма ----------
// Использует getExcluded()/saveExcluded() из shared.js — работает и с Firebase, и с localStorage
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
  resetWheelPreview();
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

// ---------- Пустое состояние колеса ----------
function resetWheelPreview() {
  const titleEl = document.getElementById("wheel-title");
  const posterEl = document.getElementById("wheel-poster");
  const previewEl = document.getElementById("wheel-preview");

  if (previewEl) {
    previewEl.classList.remove("loading", "result");
    previewEl.classList.add("idle");
  }

  if (titleEl) titleEl.textContent = "🎡 Нажми «Крутить!»";
  if (posterEl) {
    posterEl.classList.remove("result-pop");
    posterEl.innerHTML =
      '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
  }

  // Кнопка возвращается в исходное состояние
  const spinBtn = document.getElementById("spin-button");
  if (spinBtn && !spinBtn.disabled) {
    spinBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Крутить!';
  }
}

// ---------- Переключение колеса в состояние «готов к спину» ----------
function setWheelReady() {
  const titleEl = document.getElementById("wheel-title");
  const posterEl = document.getElementById("wheel-poster");
  const previewEl = document.getElementById("wheel-preview");
  const spinBtn = document.getElementById("spin-button");

  if (previewEl) {
    previewEl.classList.remove("loading", "result");
    previewEl.classList.add("idle");
  }

  if (titleEl) titleEl.textContent = "🎡 Нажми «Крутить!»";
  if (posterEl) {
    posterEl.classList.remove("result-pop");
    posterEl.innerHTML =
      '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
  }

  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Крутить!';
  }
}

// ---------- Отрисовка превью в процессе анимации ----------
function updateWheelPreview(film, isFinal = false) {
  const titleEl = document.getElementById("wheel-title");
  const posterEl = document.getElementById("wheel-poster");
  const previewEl = document.getElementById("wheel-preview");

  if (titleEl) titleEl.textContent = `${film.title} (${film.year})`;

  if (posterEl) {
    if (film.poster) {
      posterEl.innerHTML = `<img src="${film.poster}" alt="${escapeHtml(film.title)}">`;
    } else {
      posterEl.innerHTML =
        '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
    }
  }

  if (previewEl) {
    previewEl.classList.remove("idle");
    if (isFinal) {
      previewEl.classList.add("result");
    } else {
      previewEl.classList.remove("result");
    }
  }

  // При финале — лёгкая pop-анимация на постере
  if (isFinal && posterEl) {
    posterEl.classList.remove("result-pop");
    // reflow, чтобы анимация перезапустилась
    void posterEl.offsetWidth;
    posterEl.classList.add("result-pop");
  }
}

// ---------- Загрузка / сохранение длительности спина ----------
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

// Возвращает длительность в секундах.
// Если min === max — фикс. время, иначе случайное в диапазоне.
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

// ---------- Анимация колеса ----------
let spinInterval;
const SPIN_INTERVAL_MS = 100;
const SPIN_DURATION_STORAGE_KEY = "spinDuration";
const SPIN_DURATION_MIN = 0.5;
const SPIN_DURATION_MAX = 15;

function spinWheel() {
  // Защита: не крутим, пока фильмы не загружены
  if (!allFilms || allFilms.length === 0) {
    return;
  }

  if (spinInterval) {
    clearInterval(spinInterval);
    spinInterval = null;
  }

  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  if (available.length === 0) {
    alert("Нет фильмов для выбора! Измените фильтры или исключения.");
    return;
  }

  // Определяем длительность и количество шагов анимации
  const durationSeconds = getSpinDurationSeconds();
  const totalSteps = Math.max(
    3,
    Math.round((durationSeconds * 1000) / SPIN_INTERVAL_MS),
  );

  // Меняем кнопку
  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Крутим...';
  }

  let step = 0;
  spinInterval = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * available.length);
    updateWheelPreview(available[randomIndex], false);
    step++;
    if (step >= totalSteps) {
      clearInterval(spinInterval);
      spinInterval = null;

      const finalFilm = available[Math.floor(Math.random() * available.length)];
      setTimeout(() => {
        updateWheelPreview(finalFilm, true);
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.innerHTML = '<i class="fas fa-dice"></i> Крутить ещё раз';
        }
      }, 300);
    }
  }, SPIN_INTERVAL_MS);
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
      setWheelReady();

      // Настройка длительности спина
      loadSpinDuration();
      const durMinInput = document.getElementById("spin-duration-min");
      const durMaxInput = document.getElementById("spin-duration-max");
      if (durMinInput) durMinInput.addEventListener("change", saveSpinDuration);
      if (durMaxInput) durMaxInput.addEventListener("change", saveSpinDuration);

      document.addEventListener("click", (e) => {
        if (e.target.closest(".exclude-btn")) {
          const btn = e.target.closest(".exclude-btn");
          const filmId = Number(btn.dataset.filmId);
          toggleExcluded(filmId);
        }
      });

      // Обогащаем в фоне — UI уже работает.
      // НЕ сбрасываем превью: если пользователь уже крутил, результат сохраняется.
      enrichFilmsProgressively(films, (updated) => {
        allFilms = updated;
        updateFilteredFilms(() => {
          renderAvailableFilms();
          // Превью не трогаем — сохранённый результат не должен сбрасываться
        });
        renderExcludedList();
      });
    })
    .catch((error) => {
      console.error("Ошибка загрузки фильмов:", error);
      document.querySelector(".wheel-preview").innerHTML =
        '<p style="color: red;">Ошибка загрузки данных</p>';
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
        resetWheelPreview();
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
        resetWheelPreview();
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
        resetWheelPreview();
      });
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target.closest(".genre-item input")) {
      setTimeout(() => {
        updateFilteredFilms(() => {
          renderAvailableFilms();
          resetWheelPreview();
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
        resetWheelPreview();
      });
    });
  }

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) spinBtn.addEventListener("click", spinWheel);
});
