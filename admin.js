// admin.js

// ADMIN_UID объявлена в auth.js

let adminCurrentUser = null;
let allFilmsFromDb = [];
let pendingFilm = null;
let searchCandidates = [];

// ---------- Проверка доступа ----------
firebase.auth().onAuthStateChanged((user) => {
  adminCurrentUser = user;
  renderAdminStatus();
});

function renderAdminStatus() {
  const statusEl = document.getElementById("admin-status");
  const contentEl = document.getElementById("admin-content");
  if (!statusEl || !contentEl) return;

  if (!adminCurrentUser) {
    statusEl.innerHTML =
      'Чтобы попасть в админку, <a href="index.html">войдите через Google</a> на главной и вернитесь сюда.';
    contentEl.style.display = "none";
    return;
  }

  if (adminCurrentUser.uid !== ADMIN_UID) {
    statusEl.innerHTML = `
      <span style="color:#ef4444;">Доступ только для администратора.</span><br>
      Ваш UID: <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${adminCurrentUser.uid}</code>
    `;
    contentEl.style.display = "none";
    return;
  }

  statusEl.innerHTML = `
    <strong style="color:#16a34a;">✅ Доступ разрешён</strong><br>
    Вы вошли как <strong>${adminCurrentUser.email}</strong>
  `;
  contentEl.style.display = "block";
  loadFilmsList();
  loadSuggestions();
}

// ---------- Проверка дубликата в базе ----------
// Возвращает существующий фильм или null.
function findDuplicate(tmdbId, title, year) {
  // 1. По tmdbId — самый надёжный способ
  if (tmdbId) {
    const byId = allFilmsFromDb.find(
      (f) => Number(f.tmdbId) === Number(tmdbId),
    );
    if (byId) return byId;
  }

  // 2. Фолбэк по нормализованному title + year
  const norm = (s) => (s || "").toLowerCase().trim();
  const nTitle = norm(title);
  const nYear = year ? parseInt(year, 10) : null;

  return (
    allFilmsFromDb.find((f) => {
      const sameTitle = norm(f.title) === nTitle;
      const sameYear = !nYear || !f.year || Number(f.year) === nYear;
      return sameTitle && sameYear;
    }) || null
  );
}

// ---------- Поиск: показываем список кандидатов ----------
document
  .getElementById("admin-search-btn")
  .addEventListener("click", async () => {
    const title = document.getElementById("admin-title").value.trim();
    const yearRaw = document.getElementById("admin-year").value.trim();
    if (!title) return alert("Введите название");

    const previewEl = document.getElementById("admin-preview");
    const btn = document.getElementById("admin-search-btn");
    const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ищу...';
    previewEl.innerHTML =
      '<p style="color:#64748b;">Запрос к TMDB через воркер...</p>';

    try {
      const results = await searchMoviesInTMDB(title, yearNum);

      if (!results || results.length === 0) {
        previewEl.innerHTML = `
          <p style="color:#ef4444;">Ничего не найдено. Попробуйте другое название или уберите год.</p>
        `;
        searchCandidates = [];
        return;
      }

      // Отсеиваем adult-контент и сортируем по популярности
      searchCandidates = results
        .filter((r) => !r.adult)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      renderCandidates(searchCandidates);
    } catch (e) {
      console.error(e);
      previewEl.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
      searchCandidates = [];
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-search"></i> Найти в TMDB';
    }
  });

// ---------- Рендер списка кандидатов ----------
function renderCandidates(candidates) {
  const previewEl = document.getElementById("admin-preview");

  const itemsHtml = candidates
    .map((c) => {
      const year = c.release_date ? c.release_date.split("-")[0] : "—";
      const dup = findDuplicate(c.id, c.title, year);
      const posterUrl = c.poster_path
        ? `${TMDB_IMAGE_BASE_URL}${c.poster_path}`
        : "";
      const isDup = !!dup;

      return `
        <div class="candidate-item" data-tmdb-id="${c.id}" style="
          display:flex; gap:12px; padding:10px;
          border-bottom:1px solid #e2e8f0;
          cursor: ${isDup ? "default" : "pointer"};
          opacity: ${isDup ? 0.6 : 1};
          background: ${isDup ? "#fef2f2" : "transparent"};
          transition: background 0.15s;
        ">
          <div style="flex:0 0 50px; height:75px;">
            ${
              posterUrl
                ? `<img src="${posterUrl}" style="width:50px; height:75px; object-fit:cover; border-radius:4px;">`
                : '<div style="width:50px; height:75px; background:#e2e8f0; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem;">Нет</div>'
            }
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600;">${escapeHtml(c.title)}${c.original_title && c.original_title !== c.title ? ` <span style="color:#94a3b8; font-weight:400; font-size:0.85rem;">(${escapeHtml(c.original_title)})</span>` : ""}</div>
            <div style="color:#64748b; font-size:0.85rem;">${year}${c.vote_average ? ` · ⭐ ${c.vote_average.toFixed(1)}` : ""}</div>
            ${c.overview ? `<div style="color:#94a3b8; font-size:0.8rem; margin-top:4px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml(c.overview)}</div>` : ""}
          </div>
          <div style="flex:0 0 auto; display:flex; align-items:center;">
            ${
              isDup
                ? `<span style="color:#ef4444; font-size:0.8rem; font-weight:600;">⛔ Уже в базе (id #${dup.id})</span>`
                : `<span style="color:#22c55e; font-size:0.85rem; font-weight:600;">+ Добавить</span>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  previewEl.innerHTML = `
    <div style="background:#f8fafc; border-radius:12px; padding:10px 0;">
      <div style="padding:0 15px 10px; color:#64748b; font-size:0.9rem;">
        Найдено результатов: <strong>${candidates.length}</strong>. Выберите нужный:
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        ${itemsHtml}
      </div>
    </div>
  `;

  previewEl.querySelectorAll(".candidate-item").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.style.opacity === "0.6") return; // дубликат — клик игнорируем
      const tmdbId = Number(el.dataset.tmdbId);
      loadCandidateDetails(tmdbId);
    });
  });
}

// ---------- Загрузка деталей выбранного кандидата ----------
async function loadCandidateDetails(tmdbId) {
  const previewEl = document.getElementById("admin-preview");
  previewEl.innerHTML =
    '<p style="color:#64748b; padding:15px;">Загружаю детали фильма...</p>';

  try {
    const details = await getMovieDetailsFromTMDB(tmdbId);
    if (!details) {
      previewEl.innerHTML =
        '<p style="color:#ef4444;">Не удалось загрузить детали</p>';
      return;
    }

    // Финальная проверка дубликата
    const dup = findDuplicate(details.tmdbId, details.title, details.year);
    if (dup) {
      previewEl.innerHTML = `
        <p style="color:#ef4444; padding:15px;">
          ⚠️ Этот фильм уже есть в базе: <strong>${escapeHtml(dup.title)} (${dup.year || "—"})</strong>, id #${dup.id}.
        </p>
        <button id="candidate-back" class="filter-btn reset-btn">← Назад к списку</button>
      `;
      document
        .getElementById("candidate-back")
        .addEventListener("click", () => renderCandidates(searchCandidates));
      return;
    }

    pendingFilm = details;
    renderPreview(details);
  } catch (e) {
    console.error(e);
    previewEl.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

// ---------- Превью выбранного фильма ----------
function renderPreview(film) {
  const previewEl = document.getElementById("admin-preview");
  const genresHtml = (film.genres || [])
    .map((g) => `<span class="film-genre">${escapeHtml(g)}</span>`)
    .join("");

  previewEl.innerHTML = `
    <div style="display:flex; gap:20px; flex-wrap:wrap; padding:15px; background:#f8fafc; border-radius:12px;">
      <div style="flex:0 0 150px;">
        ${
          film.poster
            ? `<img src="${film.poster}" style="width:100%; border-radius:8px;" alt="poster">`
            : '<div class="poster-placeholder" style="height:225px;"><i class="fas fa-film"></i></div>'
        }
      </div>
      <div style="flex:1; min-width:200px;">
        <h3 style="margin:0 0 8px 0;">${escapeHtml(film.title)} (${film.year || "—"})</h3>
        ${film.originalTitle && film.originalTitle !== film.title ? `<p style="margin:0 0 8px 0; color:#94a3b8; font-size:0.9rem;">Оригинал: ${escapeHtml(film.originalTitle)}</p>` : ""}
        <p style="margin:5px 0;"><strong>Режиссёр:</strong> ${escapeHtml(film.director || "—")}</p>
        <p style="margin:5px 0;"><strong>Длительность:</strong> ${escapeHtml(film.duration || "—")}</p>
        <p style="margin:5px 0;"><strong>Рейтинг TMDB:</strong> ${escapeHtml(film.rating || "—")}</p>
        <div style="margin:8px 0;">${genresHtml}</div>
        <p style="margin:10px 0; font-size:0.9rem; color:#475569;">${escapeHtml(film.description || "")}</p>
        <div style="display:flex; gap:10px; margin-top:15px;">
          <button id="admin-save-btn" class="filter-btn" style="background:#22c55e;">
            <i class="fas fa-save"></i> Сохранить в Firebase
          </button>
          <button id="admin-cancel-btn" class="filter-btn reset-btn">
            ← К списку
          </button>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("admin-save-btn")
    .addEventListener("click", savePendingFilm);
  document.getElementById("admin-cancel-btn").addEventListener("click", () => {
    pendingFilm = null;
    if (searchCandidates.length > 0) renderCandidates(searchCandidates);
    else document.getElementById("admin-preview").innerHTML = "";
  });
}

// ---------- Сохранение в Firebase ----------
async function savePendingFilm() {
  if (!pendingFilm) return;
  const btn = document.getElementById("admin-save-btn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохраняю...';

  try {
    const snap = await firebase.database().ref("films").once("value");
    const films = snap.val() || {};
    const ids = Object.keys(films)
      .map(Number)
      .filter((n) => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const filmData = {
      id: newId,
      tmdbId: pendingFilm.tmdbId || null,
      title: pendingFilm.title,
      originalTitle: pendingFilm.originalTitle || "",
      year: pendingFilm.year,
      poster: pendingFilm.poster || "",
      director: pendingFilm.director || "",
      genres: pendingFilm.genres || [],
      duration: pendingFilm.duration || "",
      rating: pendingFilm.rating || "",
      description: pendingFilm.description || "",
      durationMinutes: pendingFilm.durationMinutes || null,
    };

    await firebase.database().ref(`films/${newId}`).set(filmData);

    document.getElementById("admin-title").value = "";
    document.getElementById("admin-year").value = "";
    document.getElementById("admin-preview").innerHTML = `
      <p style="color:#16a34a; padding:15px;">✅ Фильм «${escapeHtml(filmData.title)}» (${filmData.year || "—"}) добавлен с id ${newId}.</p>
    `;
    pendingFilm = null;
    searchCandidates = [];
    loadFilmsList();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Сохранить в Firebase';
    alert("Ошибка сохранения: " + e.message);
  }
}

// ---------- Список всех фильмов ----------
async function loadFilmsList() {
  const container = document.getElementById("admin-films-list");
  const countEl = document.getElementById("admin-count");
  if (!container) return;

  try {
    const snap = await firebase.database().ref("films").once("value");
    const data = snap.val() || {};
    allFilmsFromDb = Object.keys(data)
      .map((k) => ({ id: Number(k), ...data[k] }))
      .sort((a, b) => a.id - b.id);

    countEl.textContent = allFilmsFromDb.length;

    container.innerHTML = allFilmsFromDb
      .map(
        (f) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8; font-size:0.85rem; min-width:30px;">#${f.id}</span>
          <div style="flex:0 0 40px; height:60px;">
            ${
              f.poster
                ? `<img src="${f.poster}" style="width:40px; height:60px; object-fit:cover; border-radius:4px;">`
                : '<div style="width:40px; height:60px; background:#e2e8f0; border-radius:4px;"></div>'
            }
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600;">${escapeHtml(f.title)}</div>
            <div style="color:#64748b; font-size:0.85rem;">
              ${f.year || "—"} · ${escapeHtml(f.director || "—")}
              ${f.tmdbId ? `· <span style="color:#94a3b8;">TMDB ${f.tmdbId}</span>` : '· <span style="color:#f59e0b;">нет tmdbId</span>'}
            </div>
          </div>
          <button class="admin-delete-btn filter-btn" data-id="${f.id}" style="background:#ef4444; padding:6px 12px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `,
      )
      .join("");

    container.querySelectorAll(".admin-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteFilm(Number(btn.dataset.id)));
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:#ef4444;">Ошибка загрузки: ${e.message}</p>`;
  }
}

// ---------- Удаление ----------
async function deleteFilm(filmId) {
  if (!confirm(`Удалить фильм #${filmId}? Это действие необратимо.`)) return;
  try {
    await firebase.database().ref(`films/${filmId}`).remove();
    loadFilmsList();
  } catch (e) {
    alert("Ошибка удаления: " + e.message);
  }
}

// ================= ПРЕДЛОЖЕНИЯ ДРУЗЕЙ =================

async function loadSuggestions() {
  const container = document.getElementById("admin-suggestions-list");
  const countEl = document.getElementById("admin-suggestions-count");
  if (!container) return;

  try {
    const snap = await firebase.database().ref("filmSuggestions").once("value");
    const data = snap.val() || {};
    const suggestions = Object.keys(data)
      .map((k) => ({ id: k, ...data[k] }))
      .sort((a, b) => (b.suggestedAt || 0) - (a.suggestedAt || 0));

    countEl.textContent = suggestions.length;

    if (suggestions.length === 0) {
      container.innerHTML =
        '<p style="color:#94a3b8;">Пока никто ничего не предлагал.</p>';
      return;
    }

    container.innerHTML = suggestions
      .map(
        (s) => `
        <div style="display:flex; gap:12px; padding:12px; border-bottom:1px solid #e2e8f0; align-items:flex-start;">
          <div style="flex:1; min-width: 0;">
            <div style="font-weight:600;">${escapeHtml(s.title)}${s.year ? ` (${s.year})` : ""}</div>
            <div style="color:#64748b; font-size:0.85rem; margin:4px 0;">
              От: ${escapeHtml(s.suggestedByEmail || s.suggestedBy)}
              · ${new Date(s.suggestedAt || 0).toLocaleString("ru-RU")}
            </div>
            ${s.comment ? `<div style="color:#475569; font-size:0.9rem; margin:6px 0; padding:8px; background:#f8fafc; border-radius:8px;">${escapeHtml(s.comment)}</div>` : ""}
          </div>
          <div style="display:flex; gap:6px; flex-shrink: 0;">
            <button class="suggestion-approve filter-btn" data-id="${s.id}" style="background:#22c55e; padding:6px 12px; font-size:0.85rem;">
              <i class="fas fa-check"></i> Одобрить
            </button>
            <button class="suggestion-reject filter-btn" data-id="${s.id}" style="background:#ef4444; padding:6px 12px; font-size:0.85rem;">
              <i class="fas fa-times"></i> Отклонить
            </button>
          </div>
        </div>
      `,
      )
      .join("");

    container.querySelectorAll(".suggestion-approve").forEach((btn) => {
      btn.addEventListener("click", () => approveSuggestion(btn.dataset.id));
    });
    container.querySelectorAll(".suggestion-reject").forEach((btn) => {
      btn.addEventListener("click", () => rejectSuggestion(btn.dataset.id));
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

async function approveSuggestion(suggestionId) {
  const snap = await firebase
    .database()
    .ref(`filmSuggestions/${suggestionId}`)
    .once("value");
  const suggestion = snap.val();
  if (!suggestion) {
    alert("Предложение уже обработано");
    return;
  }

  const btn = document.querySelector(
    `.suggestion-approve[data-id="${suggestionId}"]`,
  );
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
  }

  try {
    // Ищем детали через TMDB (получаем tmdbId + всё остальное)
    let details = null;
    try {
      const results = await searchMoviesInTMDB(
        suggestion.title,
        suggestion.year,
      );
      if (results && results.length > 0) {
        details = await getMovieDetailsFromTMDB(results[0].id);
      }
    } catch (e) {
      console.warn("TMDB lookup failed, сохраняем базовые поля", e.message);
    }

    // Проверяем дубликат
    if (details) {
      const dup = findDuplicate(details.tmdbId, details.title, details.year);
      if (dup) {
        alert(
          `Такой фильм уже есть в базе: ${dup.title} (${dup.year || "—"}), id #${dup.id}. Предложение будет удалено.`,
        );
        await firebase
          .database()
          .ref(`filmSuggestions/${suggestionId}`)
          .remove();
        loadSuggestions();
        return;
      }
    }

    const filmsSnap = await firebase.database().ref("films").once("value");
    const films = filmsSnap.val() || {};
    const ids = Object.keys(films)
      .map(Number)
      .filter((n) => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const filmData = {
      id: newId,
      tmdbId: details ? details.tmdbId : null,
      title: details ? details.title : suggestion.title,
      originalTitle: details ? details.originalTitle : "",
      year: (details && details.year) || suggestion.year || null,
      poster: (details && details.poster) || "",
      director: (details && details.director) || "",
      genres: (details && details.genres) || [],
      duration: (details && details.duration) || "",
      rating: (details && details.rating) || "",
      description: (details && details.description) || "",
      durationMinutes: (details && details.durationMinutes) || null,
      addedBySuggestion: suggestion.suggestedBy,
    };

    await firebase.database().ref(`films/${newId}`).set(filmData);
    await firebase.database().ref(`filmSuggestions/${suggestionId}`).remove();

    loadSuggestions();
    loadFilmsList();
  } catch (e) {
    console.error(e);
    alert("Ошибка: " + e.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Одобрить';
    }
  }
}

async function rejectSuggestion(suggestionId) {
  if (!confirm("Отклонить предложение?")) return;
  try {
    await firebase.database().ref(`filmSuggestions/${suggestionId}`).remove();
    loadSuggestions();
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
}
