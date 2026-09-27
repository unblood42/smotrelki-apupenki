// marathons.js
// Использует глобальный массив allFilms из shared.js

// ---------- Глобальные переменные ----------
const marathonsList = document.getElementById("marathons-list");
const createBtn = document.getElementById("create-marathon-btn");
const modal = document.getElementById("create-modal");

// ---------- Загрузка фильмов ----------
async function fetchAndSetFilms() {
  if (allFilms && allFilms.length > 0) {
    if (typeof window.onFilmsLoaded === "function") window.onFilmsLoaded();
    return;
  }

  try {
    const films = await loadAllFilmsFromFirebase();

    // Обогащаем данными TMDB (как на главной)
    const enrichedPromises = films.map(async (film) => {
      const tmdbData = await getMovieDataFromTMDB(film);
      if (tmdbData) {
        return {
          ...film,
          poster: tmdbData.poster || film.poster,
          genres:
            film.genres && film.genres.length > 0
              ? film.genres
              : tmdbData.genres.length
                ? tmdbData.genres
                : film.genres,
          rating: tmdbData.rating || film.rating,
          description: tmdbData.description || film.description || "",
          director: film.director || tmdbData.director || "",
          duration: tmdbData.duration || film.duration || "—",
          durationMinutes: tmdbData.durationMinutes || null,
        };
      } else {
        return film;
      }
    });

    const enrichedFilms = await Promise.all(enrichedPromises);
    allFilms = enrichedFilms;
    filteredFilms = [...allFilms];

    // Оповещаем, что фильмы загружены
    if (typeof window.onFilmsLoaded === "function") {
      window.onFilmsLoaded();
    }
  } catch (error) {
    console.error("Ошибка загрузки фильмов на странице марафонов:", error);
  }
}

let selectedFilms = [];

// ---------- Отображение выбранных фильмов ----------
function renderSelectedFilms() {
  const container = document.getElementById("marathon-selected-films");
  if (!container) return;
  if (selectedFilms.length === 0) {
    container.innerHTML =
      '<span style="color:#94a3b8; font-size:0.9rem;">Нет выбранных фильмов</span>';
    return;
  }
  container.innerHTML = selectedFilms
    .map(
      (f) => `
    <span style="background:#f1f5f9; padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:5px;">
      ${escapeHtml(f.title)} (${f.year})
      <span class="remove-selected" data-id="${f.id}" style="cursor:pointer; color:#ef4444; font-weight:bold;">&times;</span>
    </span>
  `,
    )
    .join("");
  document.querySelectorAll(".remove-selected").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = Number(el.dataset.id);
      selectedFilms = selectedFilms.filter((f) => f.id !== id);
      renderSelectedFilms();
    });
  });
}

// ---------- Загрузка и отображение списка марафонов ----------
async function loadMarathons() {
  try {
    const marathons = await getMarathons();
    const user = firebase.auth().currentUser;

    if (marathons.length === 0) {
      marathonsList.innerHTML =
        '<p style="text-align:center;color:#64748b;">Нет марафонов. Создайте первый!</p>';
      return;
    }

    marathonsList.innerHTML = marathons
      .map((m) => {
        const canDelete = user && m.createdBy === user.uid;
        const creatorLabel =
          user && m.createdBy === user.uid ? "Вы" : m.createdBy || "—";

        return `
          <div class="marathon-card-wrapper" data-marathon-id="${m.id}" style="
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            display: flex;
            flex-direction: column;
            height: 100%;
          ">
            ${
              m.coverUrl
                ? `<div style="height:120px; background-image:url('${escapeHtml(m.coverUrl)}'); background-size:cover; background-position:center;"></div>`
                : ""
            }
            <div style="padding: 20px; flex: 1; display: flex; flex-direction: column;">
              <h3 style="margin-top:0;">${escapeHtml(m.name)}</h3>
              <p style="color:#64748b; flex: 1;">${escapeHtml(m.description || "")}</p>
              <p style="color:#94a3b8; font-size:0.9rem; margin: 4px 0;">
                Фильмов: ${Object.keys(m.films || {}).length}
              </p>
              <p style="color:#94a3b8; font-size:0.9rem; margin: 4px 0;">
                Создатель: ${escapeHtml(creatorLabel)}
              </p>
            </div>
            ${
              canDelete
                ? `
              <button class="marathon-delete-btn" data-marathon-id="${m.id}" title="Удалить марафон" style="
                position: absolute;
                top: 10px; right: 10px;
                width: 34px; height: 34px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.9);
                color: white;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.9rem;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                transition: background 0.15s, transform 0.15s;
              ">
                <i class="fas fa-trash"></i>
              </button>
            `
                : ""
            }
          </div>
        `;
      })
      .join("");

    // Клик по карточке — переход на страницу марафона
    marathonsList.querySelectorAll(".marathon-card-wrapper").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.marathonId;
        window.location.href = `marathon.html?id=${id}`;
      });

      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-3px)";
        card.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      });
    });

    // Кнопка удаления
    marathonsList.querySelectorAll(".marathon-delete-btn").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#dc2626";
        btn.style.transform = "scale(1.08)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "rgba(239, 68, 68, 0.9)";
        btn.style.transform = "";
      });

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.marathonId;
        const marathon = marathons.find((m) => m.id === id);
        if (
          !confirm(
            `Удалить марафон «${marathon?.name || "—"}»?\nЭто действие необратимо.`,
          )
        )
          return;

        try {
          await deleteMarathon(id);
          await loadMarathons(); // явная перерисовка
        } catch (err) {
          alert("Ошибка удаления: " + err.message);
        }
      });
    });
  } catch (e) {
    console.error(e);
    marathonsList.innerHTML =
      '<p style="color:red;">Ошибка загрузки марафонов</p>';
  }
}

// ---------- Функция показа формы создания ----------
function showCreateForm() {
  document.getElementById("marathon-name").value = "";
  document.getElementById("marathon-cover").value = "";
  document.getElementById("marathon-desc").value = "";
  document.getElementById("editable-all").checked = true;
  document.getElementById("mark-all").checked = true;
  selectedFilms = [];
  renderSelectedFilms();
  document.getElementById("marathon-film-search").value = "";
  const suggestions = document.getElementById("suggestions-list");
  if (suggestions) suggestions.style.display = "none";
  document.querySelector("#create-modal h3").textContent =
    "Создать киномарафон";
  document.querySelector("#create-modal .filter-btn#modal-submit").disabled =
    false;
  document.querySelector(
    "#create-modal .filter-btn#modal-submit",
  ).style.opacity = "1";
}

// ---------- Показать модальное окно (с проверкой загрузки) ----------
function openCreateModal() {
  if (!firebase.auth().currentUser) {
    alert("Войдите в аккаунт, чтобы создать марафон");
    return;
  }
  // Если фильмы ещё не загружены – показываем состояние загрузки
  if (!allFilms || allFilms.length === 0) {
    modal.style.display = "flex";
    document.querySelector("#create-modal h3").textContent =
      "Загрузка фильмов...";
    document.querySelector("#create-modal .filter-btn#modal-submit").disabled =
      true;
    document.querySelector(
      "#create-modal .filter-btn#modal-submit",
    ).style.opacity = "0.5";
    // Ждём события загрузки
    window.onFilmsLoaded = function () {
      showCreateForm();
      window.onFilmsLoaded = null; // чтобы не сработало повторно
    };
    return;
  }
  // Если всё загружено – сразу показываем форму
  modal.style.display = "flex";
  showCreateForm();
}

createBtn.addEventListener("click", openCreateModal);

// ---------- Закрыть модальное окно ----------
document.getElementById("modal-cancel").addEventListener("click", () => {
  modal.style.display = "none";
});

// ---------- Автокомплит ----------
const searchInput = document.getElementById("marathon-film-search");
const suggestionsContainer = document.getElementById("suggestions-list");

searchInput.addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  if (!query) {
    suggestionsContainer.style.display = "none";
    return;
  }
  if (!allFilms || allFilms.length === 0) {
    suggestionsContainer.innerHTML =
      '<div style="padding:10px; color:#94a3b8;">Загрузка фильмов...</div>';
    suggestionsContainer.style.display = "block";
    return;
  }
  const matches = allFilms.filter(
    (f) => matchesSearch(f, query) && !selectedFilms.some((s) => s.id === f.id),
  );
  if (matches.length === 0) {
    suggestionsContainer.innerHTML =
      '<div style="padding:10px; color:#94a3b8;">Нет совпадений</div>';
    suggestionsContainer.style.display = "block";
    return;
  }
  suggestionsContainer.innerHTML = matches
    .map(
      (f) => `
    <div class="suggestion-item" data-id="${f.id}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background 0.15s;">
      ${f.poster ? `<img src="${f.poster}" style="width:40px; height:60px; object-fit:cover; border-radius:4px;">` : `<div style="width:40px; height:60px; background:#e2e8f0; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem;">Нет</div>`}
      <div>
        <div style="font-weight:600;">${escapeHtml(f.title)}</div>
        <div style="font-size:0.85rem; color:#64748b;">${f.year}</div>
      </div>
    </div>
  `,
    )
    .join("");
  suggestionsContainer.style.display = "block";

  document.querySelectorAll(".suggestion-item").forEach((el) => {
    el.addEventListener("click", function () {
      const id = Number(this.dataset.id);
      const film = allFilms.find((f) => f.id === id);
      if (film && !selectedFilms.some((s) => s.id === id)) {
        selectedFilms.push({ id: film.id, title: film.title, year: film.year });
        renderSelectedFilms();
        searchInput.value = "";
        suggestionsContainer.style.display = "none";
      }
    });
  });
});

searchInput.addEventListener("blur", function () {
  setTimeout(() => {
    suggestionsContainer.style.display = "none";
  }, 200);
});

searchInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const firstSuggestion = document.querySelector(".suggestion-item");
    if (firstSuggestion) {
      firstSuggestion.click();
    }
  }
});

document
  .getElementById("marathon-add-film-btn")
  .addEventListener("click", function () {
    searchInput.value = "";
    suggestionsContainer.style.display = "none";
  });

document.addEventListener("click", function (e) {
  if (
    !e.target.closest("#marathon-film-search") &&
    !e.target.closest("#suggestions-list")
  ) {
    suggestionsContainer.style.display = "none";
  }
});

// ---------- Создание марафона ----------
document.getElementById("modal-submit").addEventListener("click", async () => {
  const name = document.getElementById("marathon-name").value.trim();
  const desc = document.getElementById("marathon-desc").value.trim();
  const coverUrl = document.getElementById("marathon-cover").value.trim();
  if (!name) return alert("Введите название");

  const isEditable = document.getElementById("editable-all").checked;
  const canMark = document.getElementById("mark-all").checked;

  try {
    const id = await createMarathon(name, desc, isEditable, canMark, coverUrl);
    for (const film of selectedFilms) {
      await addFilmToMarathon(id, film.id);
    }
    modal.style.display = "none";
    document.getElementById("marathon-name").value = "";
    document.getElementById("marathon-cover").value = "";
    document.getElementById("marathon-desc").value = "";
    selectedFilms = [];
    renderSelectedFilms();
    alert("Марафон создан!");
    loadMarathons();
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
});

// ---------- Реальное время – обновление списка ----------
firebase
  .database()
  .ref("marathons")
  .on("value", () => {
    loadMarathons();
  });

// Перерисовываем список при логине/разлогине — чтобы кнопки удаления
// появлялись/исчезали без перезагрузки страницы.
firebase.auth().onAuthStateChanged(() => {
  loadMarathons();
});

// ---------- Загрузка списка марафонов при старте ----------
// Если фильмы уже загружены – сразу показываем, иначе ждём события
if (allFilms && allFilms.length > 0) {
  loadMarathons();
} else {
  window.onFilmsLoaded = function () {
    loadMarathons();
    window.onFilmsLoaded = null;
  };
}

// Загружаем фильмы при старте
fetchAndSetFilms();
