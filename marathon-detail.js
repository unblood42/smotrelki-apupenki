// marathon-detail.js
// Использует глобальный массив allFilms из shared.js

let marathonId = null;
let marathonData = null;

// ---------- Утилита: сжатие изображения через canvas ----------
async function compressImage(file, maxSize = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Не удалось сжать изображение"));
        },
        "image/jpeg",
        quality,
      );
    };
  });
}

// ---------- Загрузка обложки в Cloudinary ----------
const CLOUDINARY_CLOUD_NAME = "fuwoznkt";
const CLOUDINARY_UPLOAD_PRESET = "marathon_covers";

async function uploadMarathonCover(marathonId, file, onProgress) {
  const blob = await compressImage(file, 1200, 0.82);

  const formData = new FormData();
  formData.append("file", blob, "cover.jpg");
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `marathons/${marathonId}`);
  formData.append("public_id", `cover_${Date.now()}`);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch (e) {
          reject(new Error("Не удалось прочитать ответ Cloudinary"));
        }
      } else {
        let msg = "Ошибка загрузки в Cloudinary";
        try {
          const err = JSON.parse(xhr.responseText);
          msg = (err.error && err.error.message) || msg;
        } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Сеть недоступна"));
    xhr.onabort = () => reject(new Error("Загрузка отменена"));
    xhr.send(formData);
  });
}

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
      coverContainer.innerHTML = `
        <div class="marathon-cover-bg" style="background-image: url('${data.coverUrl}');"></div>
        <img src="${data.coverUrl}" alt="Обложка марафона" class="marathon-cover-img">
      `;
    } else {
      coverContainer.innerHTML = "";
    }
  }

  document.getElementById("marathon-title").textContent = data.name;
  document.getElementById("marathon-desc").textContent = data.description || "";

  // Кнопки «Редактировать» и «Удалить» — только создателю
  const user = firebase.auth().currentUser;
  const isCreator = user && data.createdBy === user.uid;
  const editBtn = document.getElementById("edit-marathon");
  const delBtn = document.getElementById("delete-marathon");
  if (editBtn) editBtn.style.display = isCreator ? "inline-flex" : "none";
  if (delBtn) delBtn.style.display = isCreator ? "inline-flex" : "none";

  const container = document.getElementById("marathon-films");
  const filmIds = Object.keys(data.films || {});
  if (filmIds.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;color:#94a3b8;">В этом марафоне пока нет фильмов</p>';
    document.getElementById("marathon-progress").textContent = "0%";
    return;
  }

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

// ---------- Состояние модалки редактирования ----------
let pendingCoverFile = null;
let currentCoverUrl = "";

function openEditMarathonModal() {
  if (!marathonData) return;
  const modal = document.getElementById("edit-marathon-modal");
  if (!modal) return;

  pendingCoverFile = null;
  currentCoverUrl = marathonData.coverUrl || "";

  document.getElementById("edit-marathon-name").value = marathonData.name || "";
  document.getElementById("edit-marathon-desc").value =
    marathonData.description || "";
  document.getElementById("edit-marathon-error").textContent = "";
  document.getElementById("edit-marathon-cover-file").value = "";
  document.getElementById("edit-marathon-cover-progress").style.display =
    "none";
  document.getElementById("edit-marathon-cover-fill").style.width = "0%";
  document.getElementById("edit-marathon-cover-percent").textContent = "0%";

  updateCoverUI();

  modal.style.display = "flex";
  setTimeout(() => {
    document.getElementById("edit-marathon-name").focus();
  }, 50);
}

// Обновление превью и подписей обложки
function updateCoverUI() {
  const filenameEl = document.getElementById("edit-marathon-cover-filename");
  const previewEl = document.getElementById("edit-marathon-cover-preview");
  const removeBtn = document.getElementById("edit-marathon-cover-remove");
  if (!filenameEl || !previewEl || !removeBtn) return;

  const hasCover = !!currentCoverUrl || !!pendingCoverFile;
  removeBtn.style.display = hasCover ? "inline-flex" : "none";

  if (pendingCoverFile) {
    filenameEl.textContent = pendingCoverFile.name;
  } else if (currentCoverUrl) {
    filenameEl.textContent = "Текущая обложка";
  } else {
    filenameEl.textContent = "Файл не выбран";
  }

  if (pendingCoverFile) {
    const objectUrl = URL.createObjectURL(pendingCoverFile);
    previewEl.innerHTML = `<img src="${objectUrl}" alt="Превью">`;
  } else if (currentCoverUrl) {
    previewEl.innerHTML = `<img src="${currentCoverUrl}" alt="Текущая обложка">`;
  } else {
    previewEl.innerHTML = "";
  }
}

function closeEditMarathonModal() {
  const modal = document.getElementById("edit-marathon-modal");
  if (modal) modal.style.display = "none";
  pendingCoverFile = null;
}

async function saveEditMarathon() {
  const nameInput = document.getElementById("edit-marathon-name");
  const descInput = document.getElementById("edit-marathon-desc");
  const errorEl = document.getElementById("edit-marathon-error");
  const saveBtn = document.getElementById("edit-marathon-save");
  const progressEl = document.getElementById("edit-marathon-cover-progress");
  const fillEl = document.getElementById("edit-marathon-cover-fill");
  const percentEl = document.getElementById("edit-marathon-cover-percent");

  const name = nameInput.value.trim();
  const description = descInput.value.trim();

  if (!name) {
    errorEl.textContent = "Название не может быть пустым";
    return;
  }
  if (name.length > 200) {
    errorEl.textContent = "Название слишком длинное (макс. 200 символов)";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
  errorEl.textContent = "";

  try {
    let coverUrl = currentCoverUrl;

    if (pendingCoverFile) {
      progressEl.style.display = "flex";
      fillEl.style.width = "0%";
      percentEl.textContent = "0%";

      coverUrl = await uploadMarathonCover(
        marathonId,
        pendingCoverFile,
        (progress) => {
          fillEl.style.width = progress + "%";
          percentEl.textContent = Math.round(progress) + "%";
        },
      );
    }

    await updateMarathonMeta(marathonId, { name, description, coverUrl });
    closeEditMarathonModal();
    await loadMarathon();
  } catch (e) {
    console.error(e);
    errorEl.textContent = e.message;
    progressEl.style.display = "none";
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
  }
}

document
  .getElementById("edit-marathon")
  ?.addEventListener("click", openEditMarathonModal);
document
  .getElementById("edit-marathon-cancel")
  ?.addEventListener("click", closeEditMarathonModal);
document
  .getElementById("edit-marathon-save")
  ?.addEventListener("click", saveEditMarathon);

// Закрытие модалки по клику на фон
document
  .getElementById("edit-marathon-modal")
  ?.addEventListener("click", (e) => {
    if (e.target.id === "edit-marathon-modal") closeEditMarathonModal();
  });

// --- Кнопка «Загрузить файл» ---
document
  .getElementById("edit-marathon-cover-btn")
  ?.addEventListener("click", () => {
    document.getElementById("edit-marathon-cover-file")?.click();
  });

// --- Обработчик выбора файла ---
document
  .getElementById("edit-marathon-cover-file")
  ?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const errorEl = document.getElementById("edit-marathon-error");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      errorEl.textContent = "Файл должен быть изображением";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      errorEl.textContent = "Файл слишком большой (макс. 10 МБ)";
      return;
    }

    errorEl.textContent = "";
    pendingCoverFile = file;
    updateCoverUI();
  });

// --- Кнопка «Удалить обложку» ---
document
  .getElementById("edit-marathon-cover-remove")
  ?.addEventListener("click", () => {
    if (!confirm("Удалить обложку?")) return;
    pendingCoverFile = null;
    currentCoverUrl = "";
    document.getElementById("edit-marathon-cover-file").value = "";
    updateCoverUI();
  });

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
