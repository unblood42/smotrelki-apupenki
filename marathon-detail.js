// marathon-detail.js
// Использует глобальный массив allFilms из shared.js

let marathonId = null;
let marathonData = null;

// ---------- Получить id из URL ----------
const params = new URLSearchParams(window.location.search);
marathonId = params.get("id");
if (!marathonId) {
  document.querySelector(".marathon-detail").innerHTML =
    '<p style="color:red;">Марафон не найден</p>';
  throw new Error("No marathon id");
}

// ---------- Загрузить данные марафона и отрисовать ----------
async function loadMarathon() {
  try {
    const data = await getMarathon(marathonId);
    if (!data) {
      document.querySelector(".marathon-detail").innerHTML =
        '<p style="color:red;">Марафон не найден</p>';
      return;
    }
    marathonData = data;
    renderMarathon(data);
  } catch (e) {
    console.error(e);
    document.querySelector(".marathon-detail").innerHTML =
      '<p style="color:red;">Ошибка загрузки марафона</p>';
  }
}

// ---------- Отрисовка марафона ----------
function renderMarathon(data) {
  const coverContainer = document.querySelector(".marathon-cover");
  if (coverContainer) {
    if (data.coverUrl) {
      coverContainer.innerHTML = `<img src="${data.coverUrl}" alt="Обложка марафона" style="width:100%; max-height:300px; object-fit:cover; border-radius:12px;">`;
    } else {
      coverContainer.innerHTML = "";
    }
  }

  document.getElementById("marathon-title").textContent = data.name;
  document.getElementById("marathon-desc").textContent = data.description || "";

  const container = document.getElementById("marathon-films");
  const filmIds = Object.keys(data.films || {});
  if (filmIds.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;color:#94a3b8;">В этом марафоне пока нет фильмов</p>';
    document.getElementById("marathon-progress").textContent = "0%";
    return;
  }

  const user = firebase.auth().currentUser;
  let watchedCount = 0;
  const total = filmIds.length;

  let html = "";
  filmIds.forEach((filmId) => {
    const filmData = data.films[filmId];
    const filmInfo = allFilms ? allFilms.find((f) => f.id == filmId) : null;
    if (!filmInfo) return;

    const isWatched =
      user && filmData.watchedBy && filmData.watchedBy[user.uid] === true;
    if (isWatched) watchedCount++;

    html += `
      <div class="marathon-film-card" data-film-id="${filmId}" style="
        position: relative;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <div style="position: relative; aspect-ratio: 2/3; background: #e2e8f0;">
          ${
            filmInfo.poster
              ? `<img src="${filmInfo.poster}" alt="${escapeHtml(filmInfo.title)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
              : '<div class="poster-placeholder" style="width:100%;height:100%;"><i class="fas fa-film"></i></div>'
          }
          <button class="remove-film-btn" data-film-id="${filmId}" title="Удалить фильм" style="
            position: absolute;
            top: 6px; right: 6px;
            width: 28px; height: 28px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
          ">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div style="padding: 12px; display: flex; flex-direction: column; flex: 1;">
          <h3 style="margin: 0 0 6px 0; font-size: 1rem; line-height: 1.3; color: #1e293b;">
            ${escapeHtml(filmInfo.title)} (${filmInfo.year})
          </h3>
          ${
            filmInfo.director
              ? `<div class="marathon-film-director"><i class="fas fa-video"></i> ${escapeHtml(filmInfo.director)}</div>`
              : ""
          }
          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin: 4px 0 10px;">
            ${filmInfo.genres
              .slice(0, 3)
              .map(
                (g) =>
                  `<span class="film-genre" style="font-size: 0.72rem; padding: 3px 8px; margin: 0;">${escapeHtml(g)}</span>`,
              )
              .join("")}
          </div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">
            Добавил: ${escapeHtml(
              filmData.addedBy
                ? getUserDisplayInfo(
                    filmData.addedBy,
                    (data.members || {})[filmData.addedBy],
                  ).name
                : "—",
            )}
          </div>
          ${renderWatchersAvatars(filmData, data.members || {})}  
          <button class="watched-btn filter-btn" data-film-id="${filmId}" style="
            width: 100%;
            background: ${isWatched ? "#22c55e" : "#94a3b8"};
            padding: 8px 12px;
            font-size: 0.85rem;
            margin-top: auto;
          ">
            ${isWatched ? "✅ Просмотрено" : "☐ Отметить просмотренным"}
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // --- Участники марафона ---
  renderMarathonMembers(data.members || {});

  // Прогресс: «N из M» + полоса
  const progress = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
  const progressEl = document.getElementById("marathon-progress");
  if (progressEl) {
    progressEl.innerHTML = `
      <div class="marathon-progress-wrap">
        <div class="marathon-progress-text">
          <span>${watchedCount} из ${total}</span>
          <span class="marathon-progress-percent">${progress}%</span>
        </div>
        <div class="marathon-progress-bar">
          <div class="marathon-progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  document.querySelectorAll(".watched-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      try {
        await toggleWatched(marathonId, filmId);
        await loadMarathon();
      } catch (err) {
        alert("Ошибка: " + err.message);
      }
    });
  });

  document.querySelectorAll(".remove-film-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      if (!confirm("Удалить фильм из марафона?")) return;
      try {
        await removeFilmFromMarathon(marathonId, filmId);
        await loadMarathon();
      } catch (err) {
        alert("Ошибка: " + err.message);
      }
    });
  });

  // Клик по карточке → страница фильма
  document.querySelectorAll(".marathon-film-card").forEach((card) => {
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      // Игнорируем клики по внутренним кнопкам
      if (e.target.closest(".remove-film-btn")) return;
      if (e.target.closest(".watched-btn")) return;

      const filmId = card.dataset.filmId;
      if (filmId) window.location.href = `film.html?id=${filmId}`;
    });
  });
}

// ---------- Автокомплит ----------
const filmSearchInput = document.getElementById("film-search");
const suggestionsContainer = document.getElementById("marathon-suggestions");

filmSearchInput.addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  if (!query || !marathonData) {
    suggestionsContainer.style.display = "none";
    return;
  }
  if (!allFilms || allFilms.length === 0) {
    suggestionsContainer.innerHTML =
      '<div style="padding:10px; color:#94a3b8;">Загрузка фильмов...</div>';
    suggestionsContainer.style.display = "block";
    return;
  }
  const existingIds = Object.keys(marathonData.films || {}).map(Number);
  const matches = allFilms.filter(
    (f) => matchesSearch(f, query) && !existingIds.includes(f.id),
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
    <div class="suggestion-item" data-id="${f.id}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;">
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

  document
    .querySelectorAll("#marathon-suggestions .suggestion-item")
    .forEach((el) => {
      el.addEventListener("click", function () {
        const id = Number(this.dataset.id);
        const film = allFilms.find((f) => f.id === id);
        if (film && !existingIds.includes(id)) {
          addFilmToMarathon(marathonId, id)
            .then(() => {
              loadMarathon();
              filmSearchInput.value = "";
              suggestionsContainer.style.display = "none";
              suggestionsContainer.innerHTML = "";
            })
            .catch((err) => alert("Ошибка: " + err.message));
        }
      });
    });
});

filmSearchInput.addEventListener("blur", function () {
  setTimeout(() => {
    suggestionsContainer.style.display = "none";
  }, 200);
});

filmSearchInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const firstSuggestion = document.querySelector(
      "#marathon-suggestions .suggestion-item",
    );
    if (firstSuggestion) {
      firstSuggestion.click();
    }
  }
});

document.getElementById("add-film-btn").addEventListener("click", function () {
  const query = filmSearchInput.value.trim();

  // Сначала проверяем пустое поле — не трогаем Firebase вообще
  if (!query) {
    alert("Сначала введите название фильма");
    return;
  }

  if (!allFilms || allFilms.length === 0) {
    alert("Фильмы ещё загружаются, подождите");
    return;
  }

  // Только если есть текст — пытаемся кликнуть по первой подсказке
  const firstSuggestion = document.querySelector(
    "#marathon-suggestions .suggestion-item",
  );
  if (firstSuggestion) {
    firstSuggestion.click();
    return;
  }

  // Если подсказки нет — ищем сами
  const found = allFilms.find((f) => matchesSearch(f, query));
  if (!found) {
    alert("Фильм не найден");
    return;
  }
  const existingIds = Object.keys(marathonData?.films || {}).map(Number);
  if (existingIds.includes(found.id)) {
    alert("Фильм уже в марафоне");
    return;
  }
  addFilmToMarathon(marathonId, found.id)
    .then(() => {
      loadMarathon();
      filmSearchInput.value = "";
    })
    .catch((err) => alert("Ошибка: " + err.message));
});

// ---------- Удаление марафона ----------
document
  .getElementById("delete-marathon")
  .addEventListener("click", async () => {
    if (!confirm("Удалить марафон безвозвратно?")) return;
    try {
      await deleteMarathon(marathonId);
      alert("Марафон удалён");
      window.location.href = "marathons.html";
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  });

// ---------- Инициализация ----------
async function init() {
  // Загружаем фильмы из Firebase (с фолбэком на films.json)
  if (!allFilms || allFilms.length === 0) {
    try {
      allFilms = await loadAllFilmsFromFirebase();
      filteredFilms = [...allFilms];

      // Фоновое обогащение TMDB-данными (не блокирует UI)
      enrichFilmsProgressively(allFilms, (updated) => {
        allFilms = updated;
      }).then((final) => {
        allFilms = final;
        window.dispatchEvent(new CustomEvent("films-enriched"));
      });
    } catch (e) {
      console.error("Не удалось загрузить фильмы:", e);
    }
  }

  // Рендерим марафон
  await loadMarathon();

  // Подписываемся на изменения марафона в реальном времени
  firebase
    .database()
    .ref(`marathons/${marathonId}`)
    .on("value", () => {
      loadMarathon();
    });
}

init();

// ---------- Список участников в шапке ----------
function renderMarathonMembers(membersObj) {
  const el = document.getElementById("marathon-members");
  if (!el) return;

  const uids = Object.keys(membersObj || {});
  if (uids.length === 0) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "flex";

  const MAX_SHOWN = 6;
  const shown = uids.slice(0, MAX_SHOWN);
  const rest = uids.length - shown.length;

  const avatarsHtml = shown
    .map((uid) => {
      const info = getUserDisplayInfo(uid, membersObj[uid]);
      return `<div class="marathon-member-avatar" title="${escapeHtml(info.name)}">${escapeHtml(info.initials)}</div>`;
    })
    .join("");

  const moreHtml =
    rest > 0
      ? `<div class="marathon-member-avatar more" title="ещё ${rest}">+${rest}</div>`
      : "";

  el.innerHTML = `
    <span class="marathon-members-label">
      <i class="fas fa-users"></i> Участники (${uids.length}):
    </span>
    <div class="marathon-members-avatars">
      ${avatarsHtml}${moreHtml}
    </div>
  `;
}

// ---------- Аватарки «кто посмотрел» на карточке фильма ----------
function renderWatchersAvatars(filmData, membersObj) {
  const watchedBy = filmData.watchedBy || {};
  const watchedUids = Object.keys(watchedBy).filter(
    (uid) => watchedBy[uid] === true,
  );
  if (watchedUids.length === 0) return "";

  const MAX_SHOWN = 4;
  const shown = watchedUids.slice(0, MAX_SHOWN);
  const rest = watchedUids.length - shown.length;

  const avatarsHtml = shown
    .map((uid) => {
      const info = getUserDisplayInfo(uid, membersObj[uid]);
      return `<div class="marathon-watcher-avatar" title="${escapeHtml(info.name)}">${escapeHtml(info.initials)}</div>`;
    })
    .join("");

  const moreHtml =
    rest > 0
      ? `<div class="marathon-watcher-avatar more" title="ещё ${rest}">+${rest}</div>`
      : "";

  return `
    <div class="marathon-watchers-row">
      <span class="marathon-watchers-label">Посмотрели:</span>
      <div class="marathon-watchers-avatars">
        ${avatarsHtml}${moreHtml}
      </div>
    </div>
  `;
}
