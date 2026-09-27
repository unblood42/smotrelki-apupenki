// film.js

let currentLoadRating = null;
let currentFilmIdForReload = null;

function getMovieDataFromCache(title, year) {
  const cache = JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || "{}");
  const cacheKey = `${title}_${year}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
    console.log(`✅ Из кеша (film.js): ${title}`);
    const data = { ...cached.data };
    if (data.poster) data.poster = normalizePosterUrl(data.poster);
    return data;
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("film-detail");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const filmId = urlParams.get("id");

  if (!filmId) {
    container.innerHTML =
      '<p style="color: red;">Ошибка: не указан ID фильма</p>';
    return;
  }

  loadAllFilmsFromFirebase()
    .then(async (films) => {
      const film = films.find((f) => f.id == filmId);
      if (!film) {
        container.innerHTML = '<p style="color: red;">Фильм не найден</p>';
        return;
      }

      let filmData = getMovieDataFromCache(film.title, film.year);

      if (!filmData) {
        container.innerHTML =
          '<p style="text-align: center;">Загрузка данных о фильме...</p>';
        filmData = await getMovieDataFromTMDB(film);
      }

      const enrichedFilm = {
        ...film,
        poster: filmData?.poster || film.poster,
        genres: film.genres,
        rating: filmData?.rating || film.rating,
        description: filmData?.description || film.description || "",
        director: filmData?.director || film.director || "",
        duration: filmData?.duration || film.duration || "—",
      };

      renderFilmDetail(enrichedFilm, container);
      initRatingSystem(film.id);
      if (typeof initCommentsForFilm === "function") {
        initCommentsForFilm(film.id);
      }
    })
    .catch((error) => {
      console.error("Ошибка:", error);
      container.innerHTML =
        '<p style="color: red;">Не удалось загрузить информацию о фильме</p>';
    });
});

function renderFilmDetail(film, container) {
  const genresHtml = film.genres
    .map((genre) => `<span class="film-genre">${escapeHtml(genre)}</span>`)
    .join("");
  const videoLink = film.videoUrl
    ? `<p><strong>Смотреть:</strong> <a href="${film.videoUrl}" target="_blank">${film.videoUrl}</a></p>`
    : "<p><em>Ссылка на видео пока не добавлена</em></p>";
  const descriptionHtml = film.description
    ? `<p><strong>Описание:</strong> ${escapeHtml(film.description)}</p>`
    : "";
  const posterHtml = film.poster
    ? `<img src="${film.poster}" alt="${escapeHtml(film.title)}" style="max-width: 300px; border-radius: 8px;">`
    : '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
  const durationText = film.duration ? film.duration : "—";
  const ratingText =
    film.rating && film.rating !== "" ? `⭐ ${film.rating}` : "";

  const html = `
    <div class="film-detail-card">
      <div class="film-detail-poster">${posterHtml}</div>
      <div class="film-detail-info">
        <h2>${escapeHtml(film.title)} (${film.year})</h2>
        <p><strong>Режиссёр:</strong> ${escapeHtml(film.director)}</p>
        <p><strong>Жанры:</strong></p>
        <div class="film-genres">${genresHtml}</div>
        <p><strong>Длительность:</strong> ${durationText}</p>
        ${ratingText ? `<p><strong>Рейтинг:</strong> ${ratingText}</p>` : ""}
        ${videoLink}
        ${descriptionHtml}
      </div>
    </div>
    <div class="rating-section">
      <h3>Оцени фильм</h3>
      <div class="rating-scales">
        ${createScale("scale1", "Сценарий")}
        ${createScale("scale2", "Режиссура")}
        ${createScale("scale3", "Визуал + музыка")}
        ${createScale("scale4", "Актёрский состав")}
        ${createScale("scale5", "Хорош в рамках жанра + для своего времени?")}
        <div class="scale-item scale-subj">
          <div class="scale-header">
            <span class="scale-name">Общее впечатление</span>
            <span class="scale-value" id="subj-value">5</span>
          </div>
          <input type="range" id="subj" min="1" max="10" step="1" value="5">
        </div>
      </div>
      <div class="total-rating">
        <strong>Итоговая оценка:</strong> <span id="total-score" class="score-badge">0</span>
      </div>
      <div class="rating-save-wrapper">
        <button id="rating-save-btn" class="filter-btn rating-save-btn">
          Оценить фильм
        </button>
        <div id="rating-delete-wrapper" style="display: none; margin-top: 10px;">
          <button id="rating-delete-btn" class="rating-delete-btn">
            Удалить оценку
          </button>
        </div>
      </div>
    </div>

    <div class="comments-section">
      <h3>Комментарии (<span id="comments-count">0</span>)</h3>

      <div id="comment-auth-hint" style="display: none; padding: 15px; background: #f1f5f9; border-radius: 12px; color: #475569; text-align: center;">
        <a href="#" onclick="signInWithGoogle(); return false;" style="color: #3498db; font-weight: 600;">Войдите</a>, чтобы оставить комментарий
      </div>

      <div id="comment-form" style="display: none; margin-bottom: 20px;">
        <textarea
          id="comment-input"
          placeholder="Напишите что-нибудь об этом фильме..."
          maxlength="1000"
          style="
            width: 100%; padding: 12px;
            border: 2px solid #e2e8f0; border-radius: 12px;
            resize: vertical; min-height: 80px;
            box-sizing: border-box; font-family: inherit;
            font-size: 0.95rem;
          "
        ></textarea>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 8px;">
          <div id="comment-error" style="color:#ef4444; font-size:0.85rem;"></div>
          <button id="comment-submit-btn" class="filter-btn" style="background:#3498db;">
            <i class="fas fa-paper-plane"></i> Отправить
          </button>
        </div>
      </div>

      <div id="comments-list">
        <p style="color:#94a3b8; text-align:center; padding: 20px 0;">Загрузка...</p>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

function createScale(id, name) {
  return `
    <div class="scale-item scale-base">
      <div class="scale-header">
        <span class="scale-name">${name}</span>
        <span class="scale-value" id="${id}-value">5</span>
      </div>
      <input type="range" id="${id}" min="1" max="10" step="1" value="5">
    </div>
  `;
}

function initRatingSystem(filmId) {
  const scale1 = document.getElementById("scale1");
  const scale2 = document.getElementById("scale2");
  const scale3 = document.getElementById("scale3");
  const scale4 = document.getElementById("scale4");
  const scale5 = document.getElementById("scale5");
  const subj = document.getElementById("subj");

  const scale1value = document.getElementById("scale1-value");
  const scale2value = document.getElementById("scale2-value");
  const scale3value = document.getElementById("scale3-value");
  const scale4value = document.getElementById("scale4-value");
  const scale5value = document.getElementById("scale5-value");
  const subjvalue = document.getElementById("subj-value");
  const totalSpan = document.getElementById("total-score");
  const saveBtn = document.getElementById("rating-save-btn");
  const deleteBtn = document.getElementById("rating-delete-btn");
  const deleteWrapper = document.getElementById("rating-delete-wrapper");

  if (!scale1 || !scale2 || !scale3 || !scale4 || !scale5 || !subj) return;

  // ---------- Состояние ----------
  let isDirty = false; // есть несохранённые изменения
  let hasSavedRating = false; // есть сохранённая оценка (firebase или localStorage)
  let isSaving = false;
  let lastLoadedRating = null; // последняя загруженная оценка (для сохранения createdAt)

  // ---------- Визуал ползунков ----------
  function updateRangeBackground(range, startColor, endColor) {
    const min = parseFloat(range.min);
    const max = parseFloat(range.max);
    const val = parseFloat(range.value);
    const percent = ((val - min) / (max - min)) * 100;
    range.style.background = `linear-gradient(to right, ${startColor} 0%, ${endColor} ${percent}%, #e2e8f0 ${percent}%, #e2e8f0 100%)`;
  }

  const colorPairs = [
    { max: 3, bg: "#ef4444", border: "#b91c1c" },
    { max: 5, bg: "#f87171", border: "#b91c1c" },
    { max: 7, bg: "#fde047", border: "#eab308" },
    { max: 8.5, bg: "#86efac", border: "#22c55e" },
    { max: 10, bg: "#22c55e", border: "#16a34a" },
    { max: Infinity, bg: "#8b5cf6", border: "#6b21a8" },
  ];

  function setScoreColor(score, element) {
    const pair =
      colorPairs.find((p) => score < p.max) ||
      colorPairs[colorPairs.length - 1];
    element.style.backgroundColor = pair.bg;
    element.style.borderColor = pair.border;
  }

  // ---------- Обновление UI расчёта ----------
  function updateUI() {
    const s1 = parseFloat(scale1.value);
    const s2 = parseFloat(scale2.value);
    const s3 = parseFloat(scale3.value);
    const s4 = parseFloat(scale4.value);
    const s5 = parseFloat(scale5.value);
    const m = parseFloat(subj.value);

    scale1value.textContent = s1;
    scale2value.textContent = s2;
    scale3value.textContent = s3;
    scale4value.textContent = s4;
    scale5value.textContent = s5;
    subjvalue.textContent = m;

    updateRangeBackground(scale1, "#3498db", "#9b59b6");
    updateRangeBackground(scale2, "#3498db", "#9b59b6");
    updateRangeBackground(scale3, "#3498db", "#9b59b6");
    updateRangeBackground(scale4, "#3498db", "#9b59b6");
    updateRangeBackground(scale5, "#3498db", "#9b59b6");
    updateRangeBackground(subj, "#9b59b6", "#d8b4ff");

    const avgBase = (s1 + s2 + s3 + s4 + s5) / 5;
    const diff = m - avgBase;

    let additionalWeight = 0;
    if (diff >= 0) {
      const part1 = (diff * (-0.2 * Math.pow(diff, 2) + 50)) / 100;
      const part2 = (0.5 * Math.pow(m, 2) + 50) / 100;
      additionalWeight = part1 * part2;
    } else {
      const part1 = (diff * (-0.2 * Math.pow(diff, 2) + 50)) / 100;
      const part2 = (-0.5 * Math.pow(m, 2) + 100) / 100;
      additionalWeight = part1 * part2;
    }

    const total = avgBase + additionalWeight;
    const roundedTotal = Math.round(total * 10) / 10;
    totalSpan.textContent = roundedTotal;
    setScoreColor(roundedTotal, totalSpan);
  }

  // ---------- Состояние кнопки ----------
  function updateSaveButton() {
    if (!saveBtn) return;
    saveBtn.classList.remove("dirty", "saved");
    saveBtn.disabled = false;

    // Ссылку «Удалить оценку» показываем только если есть сохранённая оценка
    if (deleteWrapper) {
      deleteWrapper.style.display = hasSavedRating ? "block" : "none";
    }

    if (isSaving) {
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
      saveBtn.disabled = true;
      return;
    }

    if (isDirty) {
      if (hasSavedRating) {
        saveBtn.textContent = "Обновить оценку";
        saveBtn.classList.add("dirty");
      } else {
        saveBtn.textContent = "Оценить фильм";
      }
    } else {
      if (hasSavedRating) {
        saveBtn.innerHTML =
          '<span style="font-weight: 400; opacity: 0.7;">✓</span>&nbsp; Оценка сохранена';
        saveBtn.classList.add("saved");
        saveBtn.disabled = true;
      } else {
        saveBtn.textContent = "Оценить фильм";
      }
    }
  }

  function markDirty() {
    isDirty = true;
    updateSaveButton();
  }

  // ---------- Сбор данных ----------
  function collectRatingData() {
    // Если оценка уже была сохранена — обновляем updatedAt.
    // Если сохраняем впервые — ставим и createdAt, и updatedAt.
    const now = Date.now();
    const data = {
      s1: parseFloat(scale1.value),
      s2: parseFloat(scale2.value),
      s3: parseFloat(scale3.value),
      s4: parseFloat(scale4.value),
      s5: parseFloat(scale5.value),
      m: parseFloat(subj.value),
      updatedAt: now,
    };
    if (!hasSavedRating) {
      data.createdAt = now;
    } else {
      // Сохраняем существующий createdAt, если он есть
      const existing = lastLoadedRating || {};
      data.createdAt = existing.createdAt || now;
    }
    return data;
  }

  // ---------- Сохранение ----------
  async function saveRating() {
    if (isSaving) return;
    // Если уже сохранено и пользователь ничего не менял — не сохраняем повторно.
    // Если не сохранено — сохраняем, даже если isDirty = false (дефолтные 5 — валидная оценка).
    if (!isDirty && hasSavedRating) return;
    isSaving = true;
    updateSaveButton();

    const ratingData = collectRatingData();
    const user = firebase.auth().currentUser;

    try {
      if (user) {
        await saveRatingToFirebase(filmId, ratingData);
      } else {
        localStorage.setItem(
          `filmRating_${filmId}`,
          JSON.stringify(ratingData),
        );
      }
      isDirty = false;
      hasSavedRating = true;
      isSaving = false;
      updateSaveButton();

      // Небольшой визуальный акцент «сохранено» — короткая пульсация
      if (saveBtn) {
        saveBtn.style.transform = "scale(1.05)";
        setTimeout(() => {
          saveBtn.style.transform = "";
        }, 200);
      }
    } catch (e) {
      console.error("Ошибка сохранения оценки:", e);
      isSaving = false;
      // Оставляем кнопку в состоянии «можно попробовать снова»
      updateSaveButton();
      alert("Не удалось сохранить оценку: " + e.message);
    }
  }

  // ---------- Загрузка ----------
  async function loadRating(userFromEvent = null) {
    const user = userFromEvent || firebase.auth().currentUser;
    let data = null;

    if (user) {
      data = await loadRatingFromFirebase(filmId);
    } else {
      const saved = localStorage.getItem(`filmRating_${filmId}`);
      if (saved) {
        try {
          data = JSON.parse(saved);
        } catch (e) {
          console.warn("Не удалось распарсить сохранённую оценку:", e);
        }
      }
    }

    if (data) {
      scale1.value = data.s1;
      scale2.value = data.s2;
      scale3.value = data.s3;
      scale4.value = data.s4;
      scale5.value = data.s5;
      subj.value = data.m;
      hasSavedRating = true;
      lastLoadedRating = data;
    } else {
      hasSavedRating = false;
      lastLoadedRating = null;
    }

    isDirty = false;
    isSaving = false;
    updateUI();
    updateSaveButton();
  }

  currentLoadRating = loadRating;
  currentFilmIdForReload = filmId;

  // ---------- Ползунки: только UI, без сохранения ----------
  [scale1, scale2, scale3, scale4, scale5, subj].forEach((el) => {
    el.addEventListener("input", () => {
      markDirty();
      updateUI();
    });
  });

  // ---------- Сброс ползунков в дефолт ----------
  function resetSlidersToDefault() {
    scale1.value = 5;
    scale2.value = 5;
    scale3.value = 5;
    scale4.value = 5;
    scale5.value = 5;
    subj.value = 5;
  }

  // ---------- Удаление оценки ----------
  async function deleteRating() {
    if (!hasSavedRating) return;
    if (!confirm("Удалить оценку? Ползунки вернутся в исходное положение."))
      return;

    try {
      const user = firebase.auth().currentUser;
      if (user) {
        await deleteRatingFromFirebase(filmId);
      } else {
        localStorage.removeItem(`filmRating_${filmId}`);
      }
      hasSavedRating = false;
      isDirty = false;
      resetSlidersToDefault();
      updateUI();
      updateSaveButton();
    } catch (e) {
      console.error("Ошибка удаления оценки:", e);
      alert("Не удалось удалить оценку: " + e.message);
    }
  }

  // ---------- Кнопка сохранения ----------
  if (saveBtn) {
    saveBtn.addEventListener("click", saveRating);
  }

  // ---------- Кнопка удаления ----------
  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteRating);
  }

  // ---------- Первоначальная загрузка ----------
  loadRating();
}

// Слушатель изменения аутентификации – передаём пользователя в loadRating
firebase.auth().onAuthStateChanged((user) => {
  console.log("🔥 onAuthStateChanged в film.js, пользователь:", user?.uid);
  if (currentLoadRating) {
    console.log("🔄 Вызываем currentLoadRating с пользователем");
    currentLoadRating(user);
  } else {
    console.log("⚠️ currentLoadRating ещё не определена");
  }
});
