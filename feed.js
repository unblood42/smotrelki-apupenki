// feed.js
// Лента оценок и комментариев всех пользователей.
// Читает из comments/, показывает фильтры «Все / Только мои / По автору».

let feedAllItems = []; // все записи из comments/, отсортированные по createdAt
let feedCurrentUser = null;
let feedFilterMode = "all"; // "all" | "mine"
let feedAuthorFilter = ""; // uid или "" (все)
let feedListener = null;
let feedLoaded = false; // true — когда данные из Firebase пришли (пусть даже пустые)

// ---------- Утилиты ----------
function feedAuthorName(item) {
  if (item.uidEmail) {
    const at = item.uidEmail.indexOf("@");
    return at > 0 ? item.uidEmail.slice(0, at) : item.uidEmail;
  }
  return item.uid || "Аноним";
}

function feedInitials(name) {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function feedFormatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    sameYear;

  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `Сегодня, ${time}`;

  const months = [
    "янв",
    "фев",
    "мар",
    "апр",
    "мая",
    "июн",
    "июл",
    "авг",
    "сен",
    "окт",
    "ноя",
    "дек",
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  if (sameYear) return `${day} ${month}, ${time}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

// ---------- Рендер одной записи ----------
function renderFeedItem(item) {
  const author = feedAuthorName(item);
  const initials = feedInitials(author);
  const dateStr = feedFormatDate(item.createdAt);

  // Ищем фильм в allFilms (загружены из shared.js)
  const film = (allFilms || []).find((f) => f.id == item.filmId);

  const filmTitle = film ? film.title : `Фильм #${item.filmId}`;
  const filmYear = film && film.year ? film.year : "";
  const filmPoster = film && film.poster ? film.poster : "";

  const posterHtml = filmPoster
    ? `<img src="${filmPoster}" alt="">`
    : `<div class="feed-item-poster-ph"><i class="fas fa-film"></i></div>`;

  // Плашка оценки:
  //  - есть текст → компактная плашка с итогом
  //  - только оценка без текста → разбивка по критериям
  let ratingHtml = "";
  if (item.ratingSnapshot) {
    if (item.text) {
      const pair = getScoreColor(item.ratingSnapshot.total);
      const breakdown = [
        `Сценарий: ${item.ratingSnapshot.s1}`,
        `Режиссура: ${item.ratingSnapshot.s2}`,
        `Визуал: ${item.ratingSnapshot.s3}`,
        `Актёры: ${item.ratingSnapshot.s4}`,
        `Жанр: ${item.ratingSnapshot.s5}`,
        `Впечатление: ${item.ratingSnapshot.m}`,
      ].join("\n");

      ratingHtml = `
        <div class="comment-rating-badge has-tooltip" data-tooltip="${escapeHtml(breakdown)}">
          <span class="comment-rating-score"
            style="background-color: ${pair.bg}; border-color: ${pair.border}; color: ${pair.text};"
          >${item.ratingSnapshot.total}</span>
        </div>
      `;
    } else {
      ratingHtml = renderRatingBreakdown(item.ratingSnapshot);
    }
  }

  // Текст
  const textHtml = item.text
    ? `<div class="feed-item-text">${escapeHtml(item.text).replace(/\n/g, "<br>")}</div>`
    : "";

  // Метка «поставил оценку» если нет текста
  const actionLabel =
    !item.text && item.ratingSnapshot
      ? `<span class="comment-action-label">поставил оценку</span>`
      : "";

  return `
    <div class="feed-item" data-film-id="${item.filmId}" data-comment-id="${item.id}">
      <div class="feed-item-header">
        <div class="comment-avatar">${escapeHtml(initials)}</div>
        <div class="feed-item-author-info">
          <span class="comment-author">${escapeHtml(author)}</span>
          ${actionLabel}
        </div>
        <span class="comment-date">${escapeHtml(dateStr)}</span>
      </div>

      <div class="feed-item-body">
        <div class="feed-item-poster">${posterHtml}</div>
        <div class="feed-item-content">
          <div class="feed-item-film">
            <span class="feed-item-film-title">${escapeHtml(filmTitle)}</span>
            ${filmYear ? `<span class="feed-item-film-year">${filmYear}</span>` : ""}
          </div>
          ${ratingHtml}
          ${textHtml}
        </div>
      </div>
    </div>
  `;
}

// ---------- Фильтрация ----------
function getFilteredFeed() {
  let items = [...feedAllItems];

  if (feedFilterMode === "mine") {
    if (!feedCurrentUser) return [];
    items = items.filter((it) => it.uid === feedCurrentUser.uid);
  }

  if (feedAuthorFilter) {
    items = items.filter((it) => it.uid === feedAuthorFilter);
  }

  return items;
}

// ---------- Скелетоны загрузки ленты ----------
function renderFeedSkeletons(count = 3) {
  const listEl = document.getElementById("feed-list");
  if (!listEl) return;

  listEl.innerHTML = Array.from({ length: count })
    .map(
      () => `
    <div class="feed-item feed-item-skeleton">
      <div class="feed-item-header">
        <div class="skeleton-avatar"></div>
        <div class="feed-item-author-info" style="flex: 1;">
          <div class="skeleton-line" style="height: 14px; width: 120px;"></div>
          <div class="skeleton-line" style="height: 12px; width: 80px; margin-left: auto;"></div>
        </div>
      </div>
      <div class="feed-item-body">
        <div class="feed-item-poster">
          <div class="skeleton-poster" style="border-radius: 8px;"></div>
        </div>
        <div class="feed-item-content" style="flex: 1;">
          <div class="skeleton-line" style="height: 16px; width: 60%; margin-bottom: 10px;"></div>
          <div class="skeleton-line" style="height: 30px; width: 60px; border-radius: 10px; margin-bottom: 12px;"></div>
          <div class="skeleton-line" style="height: 12px; width: 100%; margin-bottom: 6px;"></div>
          <div class="skeleton-line" style="height: 12px; width: 78%;"></div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

// ---------- Рендер списка ----------
function renderFeed() {
  const listEl = document.getElementById("feed-list");
  if (!listEl) return;

  // Данные ещё не пришли — показываем скелетоны
  if (!feedLoaded) {
    renderFeedSkeletons();
    return;
  }

  if (!feedAllItems || feedAllItems.length === 0) {
    listEl.innerHTML = `
      <div class="feed-empty">
        <i class="fas fa-stream"></i>
        <p>Пока никто не оставил ни отзыва, ни оценки.</p>
        <a href="index.html" class="filter-btn">
          <i class="fas fa-arrow-left"></i> К фильмам
        </a>
      </div>
    `;
    return;
  }

  const filtered = getFilteredFeed();

  if (filtered.length === 0) {
    let msg = "Нет записей по этому фильтру.";
    if (feedFilterMode === "mine") {
      msg = "Вы пока не оставили ни отзыва, ни оценки.";
    } else if (feedAuthorFilter) {
      msg = "У этого автора пока нет записей.";
    }
    listEl.innerHTML = `
      <div class="feed-empty">
        <i class="fas fa-filter"></i>
        <p>${msg}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map((item) => renderFeedItem(item)).join("");

  // Клик по карточке → страница фильма
  listEl.querySelectorAll(".feed-item").forEach((el) => {
    el.addEventListener("click", () => {
      const filmId = el.dataset.filmId;
      if (filmId) window.location.href = `film.html?id=${filmId}`;
    });
  });
}

// ---------- Обновление списка авторов в селекте ----------
function renderAuthorSelect() {
  const select = document.getElementById("feed-author-select");
  if (!select) return;

  const authorMap = new Map(); // uid → email
  feedAllItems.forEach((it) => {
    if (!it.uid) return;
    if (!authorMap.has(it.uid)) {
      authorMap.set(it.uid, it.uidEmail || it.uid);
    }
  });

  const currentValue = select.value;

  const options = [`<option value="">Все авторы</option>`];
  Array.from(authorMap.entries())
    .sort((a, b) => {
      const nameA = feedAuthorName({ uid: a[0], uidEmail: a[1] });
      const nameB = feedAuthorName({ uid: b[0], uidEmail: b[1] });
      return nameA.localeCompare(nameB, "ru");
    })
    .forEach(([uid, email]) => {
      const name = feedAuthorName({ uid, uidEmail: email });
      options.push(`<option value="${uid}">${escapeHtml(name)}</option>`);
    });

  select.innerHTML = options.join("");

  // Восстанавливаем выбор если возможно
  if (currentValue && authorMap.has(currentValue)) {
    select.value = currentValue;
    feedAuthorFilter = currentValue;
  } else {
    feedAuthorFilter = "";
  }
}

// ---------- Подписка на comments ----------
function subscribeFeed() {
  if (feedListener) return;

  const ref = firebase.database().ref("comments");
  feedListener = ref.on("value", (snap) => {
    const data = snap.val() || {};
    const items = Object.keys(data)
      .map((id) => ({ id, ...data[id] }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    feedAllItems = items;
    feedLoaded = true;
    renderAuthorSelect();
    renderFeed();
  });
}

// ---------- Инициализация ----------
document.addEventListener("DOMContentLoaded", () => {
  // Авторизация
  firebase.auth().onAuthStateChanged((user) => {
    feedCurrentUser = user;
    renderFeed();
  });

  // Табы «Все / Только мои»
  document.querySelectorAll(".feed-filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".feed-filter-tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
      });
      feedFilterMode = tab.dataset.filter;
      renderFeed();
    });
  });

  // Селект «По автору»
  const authorSelect = document.getElementById("feed-author-select");
  if (authorSelect) {
    authorSelect.addEventListener("change", (e) => {
      feedAuthorFilter = e.target.value;
      renderFeed();
    });
  }

  // Скелетоны сразу — пока грузятся данные
  renderFeedSkeletons();

  // Загружаем фильмы сами — на этой странице их никто другой не грузит.
  // Параллельно можно подписываться на comments — Firebase справится.
  loadAllFilmsFromFirebase()
    .then((films) => {
      allFilms = films;
      filteredFilms = [...allFilms];
      // Перерисовываем ленту, если она уже успела что-то отобразить
      renderFeed();
    })
    .catch((e) => {
      console.warn("Не удалось загрузить фильмы для ленты:", e);
    });

  subscribeFeed();
});
