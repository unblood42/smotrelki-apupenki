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
    <div class="review-section">
      <h3>Ваш отзыв</h3>

      <!-- Свёрнутое состояние: показывается если оценка уже сохранена -->
      <div id="rating-summary" class="rating-summary" style="display: none;">
        <div class="rating-summary-content">
          <div class="rating-summary-label">Ваша оценка</div>
          <div class="rating-summary-score" id="saved-score-badge">0</div>
        </div>
        <button id="edit-rating-btn" class="rating-summary-edit">
          <i class="fas fa-pen"></i> Изменить оценку
        </button>
      </div>

      <!-- Развёрнутое состояние: ползунки -->
      <div id="rating-full">
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
      </div>

      <div class="review-comment-block">
        <label for="review-comment-input" class="review-comment-label">
          Комментарий <span class="review-comment-hint">(опционально, можно оставить несколько)</span>
        </label>
        <textarea
          id="review-comment-input"
          maxlength="1000"
          placeholder="Поделитесь мыслями о фильме, шуткой или запоминающейся фразой..."
        ></textarea>
      </div>

      <div id="comment-auth-hint" class="review-auth-hint" style="display: none;">
        <a href="#" onclick="signInWithGoogle(); return false;">Войдите</a>, чтобы оставить комментарий вместе с оценкой
      </div>

      <div class="review-actions">
        <button id="review-save-btn" class="review-action-btn primary" disabled>
          Сохранить отзыв
        </button>
        <button id="cancel-edit-rating-btn" class="review-action-btn ghost" style="display: none;">
          Отмена
        </button>
        <button id="rating-delete-btn" class="review-action-btn danger" style="display: none;">
          Удалить оценку
        </button>
      </div>
    </div>

    <div class="comments-section">
      <h3>Отзывы и оценки (<span id="comments-count">0</span>)</h3>
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
  // ---------- Элементы ----------
  const scale1 = document.getElementById("scale1");
  const scale2 = document.getElementById("scale2");
  const scale3 = document.getElementById("scale3");
  const scale4 = document.getElementById("scale4");
  const scale5 = document.getElementById("scale5");
  const subj = document.getElementById("subj");
  const commentInput = document.getElementById("review-comment-input");

  const scale1value = document.getElementById("scale1-value");
  const scale2value = document.getElementById("scale2-value");
  const scale3value = document.getElementById("scale3-value");
  const scale4value = document.getElementById("scale4-value");
  const scale5value = document.getElementById("scale5-value");
  const subjvalue = document.getElementById("subj-value");
  const totalSpan = document.getElementById("total-score");

  const ratingSummary = document.getElementById("rating-summary");
  const ratingFull = document.getElementById("rating-full");
  const savedScoreBadge = document.getElementById("saved-score-badge");
  const editRatingBtn = document.getElementById("edit-rating-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-rating-btn");

  const saveBtn = document.getElementById("review-save-btn");
  const deleteBtn = document.getElementById("rating-delete-btn");
  const authHint = document.getElementById("comment-auth-hint");

  if (!scale1 || !saveBtn) return;

  // ---------- Состояние ----------
  let isDirty = false; // ползунки изменены, но не сохранены
  let hasSavedRating = false; // у пользователя есть сохранённая оценка
  let isEditing = false; // ползунки развёрнуты для правки
  let isSaving = false;
  let lastLoadedRating = null;
  let currentUser = firebase.auth().currentUser;

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    updateAuthState();
    // Если гость — оценка идёт в localStorage, метку сохраним
    if (!user && hasSavedRating) {
      // hasSavedRating в localStorage валиден, оставляем как есть
    }
  });

  // ---------- Расчёт итоговой оценки ----------
  function computeTotal(s1, s2, s3, s4, s5, m) {
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
    return Math.round((avgBase + additionalWeight) * 10) / 10;
  }

  function computeTotalFromData(data) {
    return computeTotal(data.s1, data.s2, data.s3, data.s4, data.s5, data.m);
  }

  // ---------- Визуал ползунков ----------
  function updateRangeBackground(range, startColor, endColor) {
    const min = parseFloat(range.min);
    const max = parseFloat(range.max);
    const val = parseFloat(range.value);
    const percent = ((val - min) / (max - min)) * 100;
    range.style.background = `linear-gradient(to right, ${startColor} 0%, ${endColor} ${percent}%, #e2e8f0 ${percent}%, #e2e8f0 100%)`;
  }

  function setScoreColor(score, element) {
    const pair = getScoreColor(score);
    element.style.backgroundColor = pair.bg;
    element.style.borderColor = pair.border;
    element.style.color = pair.text;
  }

  // ---------- Текстовый tooltip с разбивкой ----------
  function formatRatingTooltip(data) {
    return [
      `Сценарий: ${data.s1}`,
      `Режиссура: ${data.s2}`,
      `Визуал + музыка: ${data.s3}`,
      `Актёрский состав: ${data.s4}`,
      `Хорош в рамках жанра: ${data.s5}`,
      `Общее впечатление: ${data.m}`,
    ].join("\n");
  }

  // ---------- Обновление UI ползунков ----------
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

    const total = computeTotal(s1, s2, s3, s4, s5, m);
    totalSpan.textContent = total;
    setScoreColor(total, totalSpan);

    if (savedScoreBadge) {
      savedScoreBadge.textContent = total;
    }

    // Tooltip с разбивкой по критериям — и на итоговом бейдже, и на свёрнутой карточке
    const breakdown = formatRatingTooltip({ s1, s2, s3, s4, s5, m });
    if (savedScoreBadge) {
      savedScoreBadge.textContent = total;
      savedScoreBadge.dataset.tooltip = breakdown;
      savedScoreBadge.classList.add("has-tooltip");
      setScoreColor(total, savedScoreBadge);
    }
    if (totalSpan) {
      totalSpan.dataset.tooltip = breakdown;
      totalSpan.classList.add("has-tooltip");
    }
  }

  // ---------- Состояние «свёрнуто / развёрнуто» ----------
  function updateRatingView() {
    if (!ratingSummary || !ratingFull) return;

    const showSummary = hasSavedRating && !isEditing;

    if (showSummary) {
      ratingSummary.style.display = "flex";
      ratingFull.style.display = "none";
      if (cancelEditBtn) cancelEditBtn.style.display = "none";
    } else {
      ratingSummary.style.display = "none";
      ratingFull.style.display = "block";
      if (cancelEditBtn) {
        cancelEditBtn.style.display =
          isEditing && hasSavedRating ? "inline-flex" : "none";
      }
    }
  }

  // ---------- Текст и состояние кнопки ----------
  function updateSaveButton() {
    if (!saveBtn) return;
    saveBtn.classList.remove("ready", "saved-pulse");
    saveBtn.disabled = false;

    if (deleteBtn) {
      deleteBtn.style.display = hasSavedRating ? "inline-flex" : "none";
    }

    if (isSaving) {
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
      saveBtn.disabled = true;
      return;
    }

    const commentText = ((commentInput && commentInput.value) || "").trim();
    const hasComment = currentUser && commentText.length > 0;
    const willSaveRating = isDirty;

    // --- Выбор текста ---
    let text;
    if (willSaveRating && hasComment) {
      text = hasSavedRating
        ? "Обновить оценку и отправить комментарий"
        : "Сохранить оценку и комментарий";
    } else if (willSaveRating) {
      text = hasSavedRating
        ? "Обновить оценку"
        : "Сохранить оценку без комментария";
    } else if (hasComment) {
      text = "Отправить комментарий";
    } else {
      text = "Сохранить отзыв";
    }

    saveBtn.textContent = text;

    if (willSaveRating || hasComment) {
      saveBtn.classList.add("ready");
      saveBtn.disabled = false;
    } else {
      saveBtn.disabled = true;
    }
  }

  function markDirty() {
    isDirty = true;
    updateSaveButton();
  }

  // ---------- Гость/юзер ----------
  function updateAuthState() {
    if (!commentInput) return;
    if (currentUser) {
      commentInput.disabled = false;
      commentInput.placeholder =
        "Поделитесь мыслями о фильме, шуткой или запоминающейся фразой...";
      if (authHint) authHint.style.display = "none";
    } else {
      commentInput.disabled = true;
      commentInput.value = "";
      commentInput.placeholder = "Войдите, чтобы оставить комментарий";
      if (authHint) authHint.style.display = "block";
    }
    updateSaveButton();
  }

  // ---------- Сбор данных оценки ----------
  function collectRatingData() {
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
      const existing = lastLoadedRating || {};
      data.createdAt = existing.createdAt || now;
    }
    return data;
  }

  // ---------- Сохранение ----------
  async function saveReview() {
    if (isSaving) return;

    const commentText = ((commentInput && commentInput.value) || "").trim();
    const willSaveRating = isDirty;
    const willSaveComment = currentUser && commentText.length > 0;

    if (!willSaveRating && !willSaveComment) return;

    if (commentText.length > 1000) {
      alert("Комментарий слишком длинный (макс. 1000 символов)");
      return;
    }

    isSaving = true;
    updateSaveButton();

    try {
      // 1. Оценка
      if (willSaveRating) {
        const ratingData = collectRatingData();
        if (currentUser) {
          await saveRatingToFirebase(filmId, ratingData);
        } else {
          localStorage.setItem(
            `filmRating_${filmId}`,
            JSON.stringify(ratingData),
          );
        }
        isDirty = false;
        hasSavedRating = true;
        isEditing = false;
        lastLoadedRating = ratingData;
      }

      // 2. Запись в ленту — комментарий и/или оценка
      if (willSaveComment || willSaveRating) {
        const entry = {
          filmId: filmId,
          uid: currentUser.uid,
          uidEmail: currentUser.email || "",
          createdAt: Date.now(),
        };

        if (willSaveComment) {
          entry.text = commentText;
        }

        // Прикрепляем снимок оценки — либо когда сохраняем оценку сейчас,
        // либо когда оценка уже была и пользователь просто пишет комментарий
        // (в этом случае берём последнее сохранённое значение).
        if (willSaveRating) {
          const snap = collectRatingData();
          entry.ratingSnapshot = {
            s1: snap.s1,
            s2: snap.s2,
            s3: snap.s3,
            s4: snap.s4,
            s5: snap.s5,
            m: snap.m,
            total: computeTotal(
              snap.s1,
              snap.s2,
              snap.s3,
              snap.s4,
              snap.s5,
              snap.m,
            ),
            savedAt: snap.updatedAt,
          };
        }

        await firebase.database().ref("comments").push(entry);
        if (willSaveComment) commentInput.value = "";
      }

      // 3. Обновляем интерфейс — сворачиваем ползунки если оценка сохранена
      updateRatingView();
      updateUI();

      // 4. Визуальный акцент «сохранено»
      isSaving = false;
      saveBtn.textContent = "✓ Сохранено";
      saveBtn.disabled = true;
      saveBtn.classList.add("saved-pulse");
      setTimeout(() => {
        saveBtn.classList.remove("saved-pulse");
        updateSaveButton();
      }, 1500);
    } catch (e) {
      console.error("Ошибка сохранения отзыва:", e);
      isSaving = false;
      updateSaveButton();
      alert("Не удалось сохранить: " + e.message);
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
          console.warn("Не удалось распарсить оценку:", e);
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
      // Дефолтные значения
      scale1.value = 5;
      scale2.value = 5;
      scale3.value = 5;
      scale4.value = 5;
      scale5.value = 5;
      subj.value = 5;
    }

    isDirty = false;
    isEditing = false;
    isSaving = false;
    updateUI();
    updateRatingView();
    updateSaveButton();
  }

  // ---------- Сброс к дефолту ----------
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
      isEditing = false;
      lastLoadedRating = null;
      resetSlidersToDefault();
      updateUI();
      updateRatingView();
      updateSaveButton();
    } catch (e) {
      console.error("Ошибка удаления оценки:", e);
      alert("Не удалось удалить оценку: " + e.message);
    }
  }

  // ---------- Развернуть ползунки (правка) ----------
  function startEditingRating() {
    isEditing = true;
    updateRatingView();
    updateSaveButton();
  }

  // ---------- Отменить правку ----------
  function cancelEditingRating() {
    if (!lastLoadedRating) return;
    // Возвращаем ползунки к сохранённой оценке
    scale1.value = lastLoadedRating.s1;
    scale2.value = lastLoadedRating.s2;
    scale3.value = lastLoadedRating.s3;
    scale4.value = lastLoadedRating.s4;
    scale5.value = lastLoadedRating.s5;
    subj.value = lastLoadedRating.m;
    isDirty = false;
    isEditing = false;
    updateUI();
    updateRatingView();
    updateSaveButton();
  }

  // ---------- Обработчики ----------
  [scale1, scale2, scale3, scale4, scale5, subj].forEach((el) => {
    el.addEventListener("input", () => {
      markDirty();
      updateUI();
    });
  });

  if (commentInput) {
    commentInput.addEventListener("input", updateSaveButton);
  }

  if (saveBtn) saveBtn.addEventListener("click", saveReview);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteRating);
  if (editRatingBtn)
    editRatingBtn.addEventListener("click", startEditingRating);
  if (cancelEditBtn)
    cancelEditBtn.addEventListener("click", cancelEditingRating);

  // ---------- Старт ----------
  currentLoadRating = loadRating;
  currentFilmIdForReload = filmId;

  updateAuthState();
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
