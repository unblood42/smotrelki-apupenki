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
  updateRandomPreview();
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

// ---------- Превью ----------
function updateRandomPreview() {
  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  const titleEl = document.getElementById("wheel-title");
  const posterEl = document.getElementById("wheel-poster");

  if (available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    const film = available[randomIndex];
    if (titleEl) titleEl.textContent = `${film.title} (${film.year})`;
    if (posterEl) {
      if (film.poster) {
        posterEl.innerHTML = `<img src="${film.poster}" alt="${escapeHtml(film.title)}">`;
      } else {
        posterEl.innerHTML =
          '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
      }
    }
  } else {
    if (titleEl) titleEl.textContent = "🎡 Нет доступных фильмов";
    if (posterEl)
      posterEl.innerHTML = '<div class="poster-placeholder">?</div>';
  }
}

function updateWheelPreview(film) {
  const titleEl = document.getElementById("wheel-title");
  const posterEl = document.getElementById("wheel-poster");
  if (titleEl) titleEl.textContent = `${film.title} (${film.year})`;
  if (posterEl) {
    if (film.poster) {
      posterEl.innerHTML = `<img src="${film.poster}" alt="${escapeHtml(film.title)}">`;
    } else {
      posterEl.innerHTML =
        '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
    }
  }
}

// ---------- Анимация колеса ----------
let spinInterval;
let spinCount = 0;
const MAX_SPIN_STEPS = 20;
const SPIN_INTERVAL_MS = 100;

function spinWheel() {
  if (spinInterval) {
    clearInterval(spinInterval);
    spinInterval = null;
  }

  const available = filteredFilms.filter((f) => !excludedFilmIds.has(f.id));
  if (available.length === 0) {
    alert("Нет фильмов для выбора! Измените фильтры или исключения.");
    return;
  }

  spinCount = 0;
  spinInterval = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * available.length);
    updateWheelPreview(available[randomIndex]);
    spinCount++;
    if (spinCount >= MAX_SPIN_STEPS) {
      clearInterval(spinInterval);
      spinInterval = null;
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
      updateRandomPreview();

      document.addEventListener("click", (e) => {
        if (e.target.closest(".exclude-btn")) {
          const btn = e.target.closest(".exclude-btn");
          const filmId = Number(btn.dataset.filmId);
          toggleExcluded(filmId);
        }
      });

      // Обогащаем в фоне — UI уже работает
      enrichFilmsProgressively(films, (updated) => {
        allFilms = updated;
        updateFilteredFilms(() => {
          renderAvailableFilms();
          updateRandomPreview();
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
        updateRandomPreview();
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
        updateRandomPreview();
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
        updateRandomPreview();
      });
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target.closest(".genre-item input")) {
      setTimeout(() => {
        updateFilteredFilms(() => {
          renderAvailableFilms();
          updateRandomPreview();
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
        updateRandomPreview();
      });
    });
  }

  const spinBtn = document.getElementById("spin-button");
  if (spinBtn) spinBtn.addEventListener("click", spinWheel);
});
