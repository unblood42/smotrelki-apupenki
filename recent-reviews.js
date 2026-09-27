// recent-reviews.js
// Блок «Свежие отзывы» на главной странице.
// Показывает 5 последних записей из comments/.

const RECENT_LIMIT = 5;

let recentReviewsAll = [];
let recentReviewsRendered = false;

// ---------- Рендер ----------
function renderRecentReviews() {
  const block = document.getElementById("recent-reviews");
  const track = document.getElementById("recent-reviews-track");
  if (!block || !track) return;

  if (!recentReviewsAll || recentReviewsAll.length === 0) {
    block.style.display = "none";
    return;
  }

  const items = recentReviewsAll.slice(0, RECENT_LIMIT);
  block.style.display = "block";

  track.innerHTML = items.map((item) => renderRecentCard(item)).join("");

  // Клик по карточке → страница фильма
  track.querySelectorAll(".recent-card").forEach((el) => {
    el.addEventListener("click", () => {
      const filmId = el.dataset.filmId;
      if (filmId) window.location.href = `film.html?id=${filmId}`;
    });
  });
}

function renderRecentCard(item) {
  const film = (allFilms || []).find((f) => f.id == item.filmId);

  const filmTitle = film ? film.title : `Фильм #${item.filmId}`;
  const filmYear = film && film.year ? film.year : "";
  const filmPoster = film && film.poster ? film.poster : "";

  const posterHtml = filmPoster
    ? `<img src="${filmPoster}" alt="">`
    : `<div class="recent-card-poster-ph"><i class="fas fa-film"></i></div>`;

  const author = recentAuthorName(item);
  const initials = recentInitials(author);
  const dateStr = recentFormatDate(item.createdAt);

  // Плашка оценки (если есть)
  let ratingHtml = "";
  if (item.ratingSnapshot) {
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
      <div class="comment-rating-badge" title="${escapeHtml(breakdown)}">
        <span class="comment-rating-score"
          style="background-color: ${pair.bg}; border-color: ${pair.border}; color: ${pair.text};"
        >${item.ratingSnapshot.total}</span>
      </div>
    `;
  }

  // Текст (если есть)
  let textHtml = "";
  if (item.text) {
    const text =
      item.text.length > 120 ? item.text.slice(0, 120).trim() + "…" : item.text;
    textHtml = `<div class="recent-card-text">${escapeHtml(text)}</div>`;
  } else if (item.ratingSnapshot) {
    textHtml = `<div class="recent-card-text recent-card-text-muted">поставил оценку</div>`;
  }

  return `
    <div class="recent-card" data-film-id="${item.filmId}" data-comment-id="${item.id}">
      <div class="recent-card-poster">${posterHtml}</div>
      <div class="recent-card-body">
        <div class="recent-card-film">
          <span class="recent-card-film-title">${escapeHtml(filmTitle)}</span>
          ${filmYear ? `<span class="recent-card-film-year">${filmYear}</span>` : ""}
        </div>
        <div class="recent-card-author">
          <div class="recent-card-avatar">${escapeHtml(initials)}</div>
          <span>${escapeHtml(author)}</span>
        </div>
        <div class="recent-card-date">${escapeHtml(dateStr)}</div>
        ${ratingHtml}
        ${textHtml}
      </div>
    </div>
  `;
}

// ---------- Утилиты ----------
function recentAuthorName(item) {
  if (item.uidEmail) {
    const at = item.uidEmail.indexOf("@");
    return at > 0 ? item.uidEmail.slice(0, at) : item.uidEmail;
  }
  return item.uid || "Аноним";
}

function recentInitials(name) {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function recentFormatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    sameYear;

  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `сегодня, ${time}`;

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
  if (sameYear) return `${day} ${month}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

// ---------- Подписка ----------
function subscribeRecentReviews() {
  const ref = firebase.database().ref("comments");

  ref.on("value", (snap) => {
    const data = snap.val() || {};
    const items = Object.keys(data)
      .map((id) => ({ id, ...data[id] }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    recentReviewsAll = items;

    // Первый рендер — как только есть фильмы ИЛИ через таймаут
    if (!recentReviewsRendered) {
      if (allFilms && allFilms.length > 0) {
        renderRecentReviews();
        recentReviewsRendered = true;
      }
    } else {
      renderRecentReviews();
    }
  });
}

// ---------- Инициализация ----------
document.addEventListener("DOMContentLoaded", () => {
  // Подписываемся сразу — данные придут быстро
  subscribeRecentReviews();

  // Как только фильмы загрузятся — сразу перерисуем (если ещё не отрисовано)
  if (allFilms && allFilms.length > 0) {
    renderRecentReviews();
    recentReviewsRendered = true;
  } else {
    window.addEventListener(
      "films-enriched",
      () => {
        if (!recentReviewsRendered) {
          renderRecentReviews();
          recentReviewsRendered = true;
        }
      },
      { once: true },
    );

    // Фолбэк — если событие не пришло за 2 секунды
    setTimeout(() => {
      if (!recentReviewsRendered && recentReviewsAll.length > 0) {
        renderRecentReviews();
        recentReviewsRendered = true;
      }
    }, 2000);
  }
});
