// comments.js
// Список комментариев к фильму + редактирование/удаление.
// Создание комментария теперь в film.js (объединённая форма «отзыв»).

let commentsFilmId = null;
let commentsRef = null;
let commentsListener = null;
let commentsCurrentUser = null;
let commentsAuthUnsubscribed = null;

// ---------- Инициализация для конкретного фильма ----------
function initCommentsForFilm(filmId) {
  if (!commentsAuthUnsubscribed) {
    commentsAuthUnsubscribed = firebase.auth().onAuthStateChanged((user) => {
      commentsCurrentUser = user;
    });
  }

  if (commentsFilmId === filmId && commentsRef) return;
  commentsFilmId = filmId;

  if (commentsListener && commentsRef) {
    commentsRef.off("value", commentsListener);
  }

  commentsRef = firebase
    .database()
    .ref("comments")
    .orderByChild("filmId")
    .equalTo(filmId);

  commentsListener = commentsRef.on("value", (snap) => {
    const data = snap.val() || {};
    const list = Object.keys(data)
      .map((id) => ({ id, ...data[id] }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderCommentsList(list);
  });
}

// ---------- Рендер списка ----------
function renderCommentsList(list) {
  const container = document.getElementById("comments-list");
  const countEl = document.getElementById("comments-count");
  if (!container) return;

  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = `
      <p style="color:#94a3b8; text-align:center; padding: 20px 0;">
        Пока никто не оставил комментарий. Будьте первым!
      </p>
    `;
    return;
  }

  container.innerHTML = list.map((c) => renderCommentItem(c)).join("");

  container.querySelectorAll("[data-edit-comment]").forEach((btn) => {
    btn.addEventListener("click", () =>
      startEditComment(btn.dataset.editComment),
    );
  });
  container.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteComment(btn.dataset.deleteComment),
    );
  });
  container.querySelectorAll("[data-save-edit]").forEach((btn) => {
    btn.addEventListener("click", () => saveEditComment(btn.dataset.saveEdit));
  });
  container.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
    btn.addEventListener("click", () =>
      cancelEditComment(btn.dataset.cancelEdit),
    );
  });
}

function renderCommentItem(c) {
  const user = commentsCurrentUser;
  const isOwner = user && user.uid === c.uid;
  const isAdmin =
    user && typeof ADMIN_UID !== "undefined" && user.uid === ADMIN_UID;
  const canEdit = isOwner || isAdmin;

  const hasText = !!(c.text && c.text.trim().length > 0);
  const hasRating = !!c.ratingSnapshot;

  const authorName = getCommentAuthorName(c);
  const initials = getInitials(authorName);
  const dateStr = formatCommentDate(c.createdAt);
  const editedStr =
    c.updatedAt && c.updatedAt > c.createdAt ? " · изменено" : "";

  // Заголовок: если нет текста, но есть оценка — «поставил оценку»
  const headerLabel = hasText
    ? `<span class="comment-author">${escapeHtml(authorName)}</span>`
    : `<span class="comment-author">${escapeHtml(authorName)}</span>
       <span class="comment-action-label">поставил оценку</span>`;

  // Плашка оценки — показывается если сохранён снимок
  const ratingBadgeHtml = hasRating ? renderRatingBadge(c.ratingSnapshot) : "";

  // Текст комментария — только если есть
  const textHtml = hasText
    ? `<div class="comment-text" data-comment-text="${c.id}">${escapeHtml(c.text).replace(/\n/g, "<br>")}</div>`
    : "";

  // Кнопки: Редактировать — только если есть текст; Удалить — всегда
  const editBtnHtml = hasText
    ? `<button class="comment-action-btn" data-edit-comment="${c.id}">Редактировать</button>`
    : "";
  const deleteBtnHtml = canEdit
    ? `<button class="comment-action-btn danger" data-delete-comment="${c.id}">Удалить</button>`
    : "";

  const actionsHtml =
    editBtnHtml || deleteBtnHtml
      ? `
      <div style="display:flex; gap:8px; margin-top:8px;">
        ${editBtnHtml}
        ${deleteBtnHtml}
      </div>
    `
      : "";

  // Форма редактирования — только если есть текст
  const editFormHtml = hasText
    ? `
      <div class="comment-edit-form" data-comment-edit-form="${c.id}" style="display:none;">
        <textarea class="comment-edit-textarea" data-comment-edit-textarea="${c.id}">${escapeHtml(c.text)}</textarea>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button class="filter-btn" style="background:#22c55e; padding:6px 14px; font-size:0.85rem;" data-save-edit="${c.id}">
            Сохранить
          </button>
          <button class="filter-btn reset-btn" style="padding:6px 14px; font-size:0.85rem;" data-cancel-edit="${c.id}">
            Отмена
          </button>
        </div>
      </div>
    `
    : "";

  return `
    <div class="comment-item" data-comment-id="${c.id}">
      <div class="comment-avatar">${escapeHtml(initials)}</div>
      <div class="comment-body">
        <div class="comment-header">
          ${headerLabel}
          <span class="comment-date">${escapeHtml(dateStr)}${editedStr}</span>
        </div>
        ${ratingBadgeHtml}
        ${textHtml}
        ${editFormHtml}
        ${actionsHtml}
      </div>
    </div>
  `;
}

// ---------- Плашка оценки в записи ----------
function renderRatingBadge(snap) {
  const breakdown = [
    `Сценарий: ${snap.s1}`,
    `Режиссура: ${snap.s2}`,
    `Визуал + музыка: ${snap.s3}`,
    `Актёрский состав: ${snap.s4}`,
    `Хорош в рамках жанра: ${snap.s5}`,
    `Общее впечатление: ${snap.m}`,
  ].join("\n");

  const pair = getScoreColor(snap.total);

  return `
    <div class="comment-rating-badge has-tooltip" data-tooltip="${escapeHtml(breakdown)}">
      <span class="comment-rating-score"
        style="background-color: ${pair.bg}; border-color: ${pair.border}; color: ${pair.text};"
      >${snap.total}</span>
    </div>
  `;
}

// ---------- Хелперы ----------
function getCommentAuthorName(c) {
  if (c.uidEmail) {
    const at = c.uidEmail.indexOf("@");
    return at > 0 ? c.uidEmail.slice(0, at) : c.uidEmail;
  }
  return c.uid || "Аноним";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCommentDate(ts) {
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
  return `${day} ${month} ${d.getFullYear()}, ${time}`;
}

// ---------- Редактирование ----------
function startEditComment(commentId) {
  const textEl = document.querySelector(`[data-comment-text="${commentId}"]`);
  const formEl = document.querySelector(
    `[data-comment-edit-form="${commentId}"]`,
  );
  if (!textEl || !formEl) return;
  textEl.style.display = "none";
  formEl.style.display = "block";
  const ta = formEl.querySelector("textarea");
  if (ta) ta.focus();
}

function cancelEditComment(commentId) {
  const textEl = document.querySelector(`[data-comment-text="${commentId}"]`);
  const formEl = document.querySelector(
    `[data-comment-edit-form="${commentId}"]`,
  );
  if (!textEl || !formEl) return;
  textEl.style.display = "block";
  formEl.style.display = "none";
}

async function saveEditComment(commentId) {
  const formEl = document.querySelector(
    `[data-comment-edit-form="${commentId}"]`,
  );
  if (!formEl) return;
  const ta = formEl.querySelector("textarea");
  if (!ta) return;

  const newText = ta.value.trim();
  if (!newText) return alert("Комментарий не может быть пустым");
  if (newText.length > 1000)
    return alert("Слишком длинный комментарий (макс. 1000)");

  const btn = formEl.querySelector("[data-save-edit]");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  try {
    await firebase.database().ref(`comments/${commentId}`).update({
      text: newText,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error(e);
    alert("Ошибка: " + e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Сохранить";
    }
  }
}

// ---------- Удаление ----------
async function deleteComment(commentId) {
  if (!confirm("Удалить комментарий? Действие необратимо.")) return;
  try {
    await firebase.database().ref(`comments/${commentId}`).remove();
  } catch (e) {
    console.error(e);
    alert("Ошибка удаления: " + e.message);
  }
}
