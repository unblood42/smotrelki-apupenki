// admin.js

// ADMIN_UID объявлена в auth.js (используется там для ссылки в шапке)

let adminCurrentUser = null;
let allFilmsFromDb = [];
let pendingFilm = null; // результат поиска TMDB, ждёт сохранения

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
}

// ---------- Поиск в TMDB ----------
document
  .getElementById("admin-search-btn")
  .addEventListener("click", async () => {
    const title = document.getElementById("admin-title").value.trim();
    const yearRaw = document.getElementById("admin-year").value.trim();
    if (!title) return alert("Введите название");

    const previewEl = document.getElementById("admin-preview");
    const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;

    // Проверка дубликата по названию (регистронезависимо) + году
    const duplicate = allFilmsFromDb.find((f) => {
      const sameTitle =
        f.title.toLowerCase().trim() === title.toLowerCase().trim();
      const sameYear = !yearNum || !f.year || f.year === yearNum;
      return sameTitle && sameYear;
    });

    if (duplicate) {
      previewEl.innerHTML = `
      <p style="color:#ef4444; padding:10px;">
        ⚠️ Похожий фильм уже есть в базе:
        <strong>${escapeHtml(duplicate.title)} (${duplicate.year || "—"})</strong>
        — id #${duplicate.id}.<br>
        <small>Если это другой фильм (например, ремейк) — уточните год и попробуйте снова.</small>
      </p>
    `;
      return;
    }

    const btn = document.getElementById("admin-search-btn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ищу...';
    previewEl.innerHTML =
      '<p style="color:#64748b;">Запрос к TMDB через воркер...</p>';

    try {
      const mockFilm = {
        title,
        year: yearNum,
      };
      const data = await getMovieDataFromTMDB(mockFilm);

      if (!data) {
        previewEl.innerHTML = `
        <p style="color:#ef4444;">Ничего не найдено в TMDB. Попробуйте другое название или уточните год.</p>
      `;
        pendingFilm = null;
        return;
      }

      // Собираем "черновик" фильма для сохранения
      pendingFilm = {
        title,
        year: data.year ? parseInt(data.year, 10) : yearNum,
        poster: data.poster || "",
        director: data.director || "",
        genres: data.genres || [],
        duration: data.duration || "",
        rating: data.rating || "",
        description: data.description || "",
      };

      renderPreview(pendingFilm);
    } catch (e) {
      console.error(e);
      previewEl.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
      pendingFilm = null;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-search"></i> Найти в TMDB';
    }
  });

// ---------- Превью найденного фильма ----------
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
            Отмена
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
    document.getElementById("admin-preview").innerHTML = "";
  });
}

// ---------- Сохранение в Firebase ----------
async function savePendingFilm() {
  if (!pendingFilm) return;
  const btn = document.getElementById("admin-save-btn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохраняю...';

  try {
    // Считаем максимальный id
    const snap = await firebase.database().ref("films").once("value");
    const films = snap.val() || {};
    const ids = Object.keys(films)
      .map(Number)
      .filter((n) => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const filmData = {
      id: newId,
      title: pendingFilm.title,
      year: pendingFilm.year,
      poster: pendingFilm.poster,
      director: pendingFilm.director,
      genres: pendingFilm.genres,
      duration: pendingFilm.duration,
      rating: pendingFilm.rating,
      description: pendingFilm.description,
    };

    await firebase.database().ref(`films/${newId}`).set(filmData);

    // Сброс формы
    document.getElementById("admin-title").value = "";
    document.getElementById("admin-year").value = "";
    document.getElementById("admin-preview").innerHTML = `
      <p style="color:#16a34a; padding:10px;">✅ Фильм «${escapeHtml(filmData.title)}» добавлен с id ${newId}.</p>
    `;
    pendingFilm = null;
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
          <div style="flex:1;">
            <div style="font-weight:600;">${escapeHtml(f.title)}</div>
            <div style="color:#64748b; font-size:0.85rem;">${f.year || "—"} · ${escapeHtml(f.director || "—")}</div>
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
