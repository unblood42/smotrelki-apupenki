// script.js

let container;

document.addEventListener("DOMContentLoaded", function () {
  container = document.getElementById("films-container");
  if (!container) {
    console.error('Ошибка: не найден элемент с id="films-container"');
    return;
  }

  loadAllFilmsFromFirebase()
    .then(async (films) => {
      allFilms = films;
      allFilms.forEach((film, index) => {
        if (film.id === undefined) film.id = index;
      });

      // Сразу рендерим по films.json — не ждём TMDB.
      filteredFilms = [...allFilms];

      // Оповещаем марафоны, что базовые фильмы загружены
      if (typeof window.onFilmsLoaded === "function") {
        window.onFilmsLoaded();
      }

      populateGenreList();
      loadFilterState();
      syncGenreCheckboxes();

      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = searchQuery;

      const yearFromInput = document.getElementById("year-from");
      const yearToInput = document.getElementById("year-to");
      if (yearFromInput) yearFromInput.value = yearFrom;
      if (yearToInput) yearToInput.value = yearTo;

      updateSortArrows();
      updateFilteredFilms(renderFilmCards);

      // Обогащаем в фоне, перерисовываем по мере готовности
      enrichFilmsProgressively(films, (updated) => {
        allFilms = updated;
        updateFilteredFilms(renderFilmCards);
      }).then((final) => {
        allFilms = final;
        window.dispatchEvent(new CustomEvent("films-enriched"));
      });
    })
    .catch((error) => {
      console.error("Не удалось загрузить фильмы:", error);
      container.innerHTML =
        '<p style="color: red; text-align: center;">Не удалось загрузить список фильмов. Попробуйте позже.</p>';
    });

  // ---------- Обработчики событий ----------

  const sortButtons = document.querySelectorAll(".filter-btn[data-sort]");
  sortButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const newSort = e.currentTarget.dataset.sort;
      if (newSort === currentSortType) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortType = newSort;
        sortDirection = "asc";
      }
      updateSortArrows();
      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  });

  const yearFromInput = document.getElementById("year-from");
  const yearToInput = document.getElementById("year-to");
  const applyYearBtn = document.getElementById("apply-year-filter");

  if (applyYearBtn) {
    applyYearBtn.addEventListener("click", () => {
      yearFrom = yearFromInput ? yearFromInput.value : "";
      yearTo = yearToInput ? yearToInput.value : "";
      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  }

  [yearFromInput, yearToInput].forEach((input) => {
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && applyYearBtn) {
          applyYearBtn.click();
        }
      });
    }
  });

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
      updateFilteredFilms(renderFilmCards);
    });
  }

  const favoritesBtn = document.getElementById("favorites-filter");
  if (favoritesBtn) {
    favoritesBtn.addEventListener("click", () => {
      showOnlyFavorites = !showOnlyFavorites;
      favoritesBtn.classList.toggle("active", showOnlyFavorites);
      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  }

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  }

  const searchClear = document.getElementById("search-clear");
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchQuery = "";
      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  }

  const resetBtn = document.getElementById("reset-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      searchQuery = "";
      if (searchInput) searchInput.value = "";

      yearFrom = "";
      yearTo = "";
      if (yearFromInput) yearFromInput.value = "";
      if (yearToInput) yearToInput.value = "";

      activeGenres = [];
      syncGenreCheckboxes();

      showOnlyFavorites = false;
      if (favoritesBtn) favoritesBtn.classList.remove("active");

      currentSortType = "year";
      sortDirection = "asc";
      updateSortArrows();

      saveFilterState();
      updateFilteredFilms(renderFilmCards);
    });
  }
});

// ---------- Рендер карточек ----------
function renderFilmCards() {
  container.innerHTML = "";
  const favorites = getFavorites();

  filteredFilms.forEach((film) => {
    const cardHtml = createFilmCard(film, favorites.includes(film.id));
    container.insertAdjacentHTML("beforeend", cardHtml);
  });

  document.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      toggleFavorite(filmId);
      updateFilteredFilms(renderFilmCards);
    });
  });
}

function createFilmCard(film, isFavorite) {
  const genresHtml = film.genres
    .map((genre) => `<span class="film-genre">${escapeHtml(genre)}</span>`)
    .join("");
  const durationText = film.duration || "—";
  const ratingText = film.rating ? `⭐ ${film.rating}` : "⭐";
  const safeTitle = escapeHtml(film.title);
  const safeDirector = escapeHtml(film.director);
  const year = film.year;
  const heartIcon = isFavorite ? "fas fa-heart" : "far fa-heart";

  return `
    <a href="film.html?id=${film.id}" class="film-card-link" style="text-decoration: none; color: inherit;">
        <div class="film-card">
            <div class="film-poster">
                ${film.poster ? `<img src="${film.poster}" alt="${safeTitle}">` : '<div class="poster-placeholder"><i class="fas fa-film"></i></div>'}            </div>
            <div class="film-info">
                <div class="film-header">
                    <h3 class="film-title">${safeTitle}</h3>
                    <span class="film-year film-genre">${year}</span>
                </div>
                <div class="film-director">${safeDirector}</div>
                <div class="film-genres">${genresHtml}</div>
                <div class="film-actions">
                    <div class="film-meta-left">
                        <span class="film-duration film-rating"><i class="far fa-clock"></i> ${durationText}</span>
                        <span class="film-rating">${ratingText}</span>
                    </div>
                    <button class="favorite-btn" data-film-id="${film.id}" aria-label="Добавить в избранное">
                        <i class="${heartIcon}"></i>
                    </button>
                </div>
            </div>
        </div>
    </a>
    `;
}

function updateSortArrows() {
  document.querySelectorAll(".sort-arrow").forEach((arrow) => {
    const arrowSort = arrow.dataset.sort;
    if (arrowSort === currentSortType) {
      arrow.textContent = sortDirection === "asc" ? "↑" : "↓";
    } else {
      arrow.textContent = "↑";
    }
  });
}
