// suggest.js
// Модалка «Предложить фильм»:
//  - Форма с превью TMDB
//  - Мои предложения с удалением из истории

let suggestCurrentUser = null;
let selectedTmdbId = null;
let selectedYear = null;

// ---------- Модалка ----------
function ensureSuggestModal() {
  if (document.getElementById("suggest-modal")) return;

  const modalHtml = `
    <div id="suggest-modal" style="
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    ">
      <div style="
        background: white;
        border-radius: 16px;
        max-width: 620px;
        width: 100%;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <!-- Шапка -->
        <div style="padding: 20px 25px 0;">
          <h3 style="margin: 0 0 5px 0;">💡 Предложить фильм</h3>
          <p style="color:#64748b; margin: 0; font-size: 0.85rem;">
            Найдите фильм в TMDB — это поможет админу быстро его одобрить.
          </p>
        </div>

        <!-- Вкладки -->
        <div style="
          display: flex;
          gap: 5px;
          padding: 15px 25px 0;
          border-bottom: 2px solid #e2e8f0;
        ">
          <button class="suggest-tab active" data-tab="form" style="
            background: none; border: none; padding: 8px 14px;
            cursor: pointer; font-weight: 600; color: #9b59b6;
            border-bottom: 3px solid #9b59b6; margin-bottom: -2px;
            font-size: 0.95rem;
          ">Отправить</button>
          <button class="suggest-tab" data-tab="list" style="
            background: none; border: none; padding: 8px 14px;
            cursor: pointer; font-weight: 600; color: #94a3b8;
            border-bottom: 3px solid transparent; margin-bottom: -2px;
            font-size: 0.95rem;
          ">
            Мои предложения
            <span id="suggest-count-badge" style="
              background: #e2e8f0; color: #475569;
              border-radius: 10px; padding: 1px 7px;
              font-size: 0.75rem; margin-left: 4px; display: none;
            ">0</span>
          </button>
        </div>

        <!-- Контент: форма -->
        <div id="suggest-tab-form" style="padding: 20px 25px 25px; overflow-y: auto;">
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <input type="text" id="suggest-title" placeholder="Название фильма" style="
              flex: 1; padding: 10px;
              border: 2px solid #3498db; border-radius: 30px;
              box-sizing: border-box; font-size: 1rem;
            " />
            <button id="suggest-search-btn" class="filter-btn" style="
              background: #3498db; padding: 0 20px; white-space: nowrap;
            ">
              <i class="fas fa-search"></i> Найти
            </button>
          </div>

          <input type="number" id="suggest-year" placeholder="Год (опционально)" min="1888" max="2100" style="
            width: 100%; padding: 10px;
            margin: 0 0 10px;
            border: 2px solid #3498db; border-radius: 30px;
            box-sizing: border-box; font-size: 1rem;
          " />

          <!-- Контейнер для кандидатов -->
          <div id="suggest-candidates" style="display: none; margin: 10px 0;"></div>

          <!-- Контейнер для выбранного фильма -->
          <div id="suggest-selected" style="display: none; margin: 10px 0;"></div>

          <textarea id="suggest-comment" placeholder="Комментарий для друзей (опционально)" style="
            width: 100%; padding: 10px;
            border: 2px solid #3498db; border-radius: 16px;
            resize: vertical; min-height: 60px;
            box-sizing: border-box; font-size: 0.95rem;
            font-family: inherit;
            margin-top: 5px;
          "></textarea>

          <div id="suggest-error" style="color:#ef4444; margin: 10px 0; min-height: 20px; font-size: 0.9rem;"></div>

          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button id="suggest-cancel" class="filter-btn reset-btn">Закрыть</button>
            <button id="suggest-submit" class="filter-btn" style="background:#22c55e;">
              <i class="fas fa-paper-plane"></i> Отправить
            </button>
          </div>
        </div>

        <!-- Контент: список -->
        <div id="suggest-tab-list" style="
          padding: 15px 25px 25px; overflow-y: auto; display: none;
        ">
          <div id="suggest-list-container">
            <p style="color:#94a3b8; text-align:center; padding: 20px 0;">Загрузка...</p>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top: 15px;">
            <button id="suggest-list-close" class="filter-btn reset-btn">Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document
    .getElementById("suggest-cancel")
    .addEventListener("click", closeSuggestModal);
  document
    .getElementById("suggest-list-close")
    .addEventListener("click", closeSuggestModal);
  document.getElementById("suggest-modal").addEventListener("click", (e) => {
    if (e.target.id === "suggest-modal") closeSuggestModal();
  });
  document.querySelectorAll(".suggest-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchSuggestTab(tab.dataset.tab));
  });
  document
    .getElementById("suggest-submit")
    .addEventListener("click", submitSuggestion);
  document
    .getElementById("suggest-search-btn")
    .addEventListener("click", runPreviewSearch);

  // При изменении названия вручную — сбрасываем выбор
  document.getElementById("suggest-title").addEventListener("input", () => {
    if (selectedTmdbId) {
      selectedTmdbId = null;
      document.getElementById("suggest-selected").style.display = "none";
    }
  });
  // При изменении года — тоже
  document.getElementById("suggest-year").addEventListener("input", () => {
    if (selectedTmdbId) {
      selectedTmdbId = null;
      document.getElementById("suggest-selected").style.display = "none";
    }
  });
}

function switchSuggestTab(tabName) {
  document.querySelectorAll(".suggest-tab").forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.style.color = active ? "#9b59b6" : "#94a3b8";
    tab.style.borderBottomColor = active ? "#9b59b6" : "transparent";
  });
  document.getElementById("suggest-tab-form").style.display =
    tabName === "form" ? "block" : "none";
  document.getElementById("suggest-tab-list").style.display =
    tabName === "list" ? "block" : "none";
  if (tabName === "list") loadMySuggestions();
}

function openSuggestModal() {
  ensureSuggestModal();
  document.getElementById("suggest-title").value = "";
  document.getElementById("suggest-year").value = "";
  document.getElementById("suggest-comment").value = "";
  document.getElementById("suggest-error").textContent = "";
  document.getElementById("suggest-candidates").style.display = "none";
  document.getElementById("suggest-selected").style.display = "none";
  selectedTmdbId = null;
  selectedYear = null;
  switchSuggestTab("form");
  document.getElementById("suggest-modal").style.display = "flex";
  setTimeout(() => document.getElementById("suggest-title").focus(), 50);
  updateSuggestBadge();
}

function closeSuggestModal() {
  const modal = document.getElementById("suggest-modal");
  if (modal) modal.style.display = "none";
}

// ---------- Кнопка в шапке (у админа — корона, оранжевый) ----------
function updateSuggestButton(user) {
  suggestCurrentUser = user;
  if (!document.getElementById("films-container")) return;

  const nav = document.querySelector(".header nav");
  if (!nav) return;

  const existing = document.getElementById("suggest-btn");
  const isAdmin =
    user && typeof ADMIN_UID !== "undefined" && user.uid === ADMIN_UID;

  // Кнопку показываем только обычным залогиненным юзерам.
  // У админа уже есть admin.html — предложка ему не нужна.
  const shouldShow = !!user && !isAdmin;

  if (shouldShow && !existing) {
    const btn = document.createElement("button");
    btn.id = "suggest-btn";
    btn.className = "filter-btn";
    btn.style.background = "#9b59b6";
    btn.innerHTML = '<i class="fas fa-lightbulb"></i> Предложить фильм';
    btn.addEventListener("click", openSuggestModal);

    const emailSpan = document.getElementById("user-email");
    if (emailSpan) nav.insertBefore(btn, emailSpan);
    else nav.appendChild(btn);

    updateSuggestBadge();
  } else if (!shouldShow && existing) {
    existing.remove();
  }
}

// ---------- Превью: поиск в TMDB ----------
async function runPreviewSearch() {
  const title = document.getElementById("suggest-title").value.trim();
  const yearRaw = document.getElementById("suggest-year").value.trim();
  const errEl = document.getElementById("suggest-error");
  const candidatesEl = document.getElementById("suggest-candidates");
  const btn = document.getElementById("suggest-search-btn");

  errEl.textContent = "";
  selectedTmdbId = null;
  document.getElementById("suggest-selected").style.display = "none";

  if (!title) {
    errEl.textContent = "Введите название";
    return;
  }

  const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  candidatesEl.style.display = "block";
  candidatesEl.innerHTML =
    '<p style="color:#64748b; font-size:0.9rem;">Ищу в TMDB...</p>';

  try {
    const results = await searchMoviesInTMDB(title, yearNum);
    const filtered = (results || []).filter((r) => !r.adult);

    if (filtered.length === 0) {
      candidatesEl.innerHTML = `
        <p style="color:#ef4444; font-size:0.9rem;">
          Ничего не найдено. Можно отправить как есть — админ разберётся.
        </p>
      `;
      return;
    }

    const itemsHtml = filtered
      .slice(0, 20)
      .map((c) => {
        const year = c.release_date ? c.release_date.slice(0, 4) : "—";
        const poster = c.poster_path
          ? `${TMDB_IMAGE_BASE_URL}${c.poster_path}`
          : "";
        return `
          <div class="candidate-mini" data-tmdb-id="${c.id}" data-year="${year}" style="
            flex: 0 0 auto; width: 95px; cursor: pointer;
            border-radius: 8px; overflow: hidden;
            border: 3px solid transparent; transition: transform 0.15s;
            background: white;
          ">
            ${
              poster
                ? `<img src="${poster}" style="width:95px;height:143px;object-fit:cover;display:block;">`
                : '<div style="width:95px;height:143px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;"><i class="fas fa-film"></i></div>'
            }
            <div style="font-size:0.75rem;padding:4px 6px;color:#1e293b;line-height:1.2;height:40px;overflow:hidden;">
              ${escapeHtml(c.title)}<br>
              <span style="color:#94a3b8;">${year}</span>
            </div>
          </div>
        `;
      })
      .join("");

    candidatesEl.innerHTML = `
      <div style="font-size:0.85rem;color:#64748b;margin-bottom:6px;">
        Найдено: ${filtered.length}. Выберите фильм:
      </div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding:6px 2px 10px;">
        ${itemsHtml}
      </div>
    `;

    candidatesEl.querySelectorAll(".candidate-mini").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        if (!el.classList.contains("selected"))
          el.style.transform = "translateY(-2px)";
      });
      el.addEventListener("mouseleave", () => {
        if (!el.classList.contains("selected")) el.style.transform = "";
      });
      el.addEventListener("click", () => {
        selectCandidate(Number(el.dataset.tmdbId), Number(el.dataset.year));
      });
    });
  } catch (e) {
    console.error(e);
    candidatesEl.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> Найти';
  }
}

// ---------- Выбор кандидата → загрузка деталей ----------
async function selectCandidate(tmdbId, year) {
  const selEl = document.getElementById("suggest-selected");
  const candEl = document.getElementById("suggest-candidates");
  selEl.style.display = "block";
  selEl.innerHTML = '<p style="color:#64748b;padding:10px;">Загружаю...</p>';

  try {
    const details = await getMovieDetailsFromTMDB(tmdbId);
    if (!details) {
      selEl.innerHTML = '<p style="color:#ef4444;">Не удалось загрузить</p>';
      return;
    }

    selectedTmdbId = details.tmdbId;
    selectedYear = details.year;

    // Подставляем в поля формы
    document.getElementById("suggest-title").value = details.title;
    if (details.year)
      document.getElementById("suggest-year").value = details.year;

    const genresHtml = (details.genres || [])
      .map((g) => `<span class="film-genre">${escapeHtml(g)}</span>`)
      .join("");

    selEl.innerHTML = `
      <div style="
        display: flex; gap: 12px; padding: 12px;
        background: #ecfdf5; border: 2px solid #22c55e; border-radius: 12px;
        align-items: flex-start;
      ">
        ${
          details.poster
            ? `<img src="${details.poster}" style="width:70px;height:105px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
            : '<div style="width:70px;height:105px;background:#e2e8f0;border-radius:6px;flex-shrink:0;"></div>'
        }
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:1rem;">
            ${escapeHtml(details.title)} (${details.year || "—"})
            <span style="color:#22c55e;font-size:0.8rem;margin-left:6px;">✓ выбран</span>
          </div>
          <div style="color:#64748b;font-size:0.85rem;margin:4px 0;">
            ${escapeHtml(details.director || "—")} · ${escapeHtml(details.duration || "—")}
          </div>
          <div style="margin:4px 0;">${genresHtml}</div>
          <div style="color:#94a3b8;font-size:0.8rem;max-height:36px;overflow:hidden;">
            ${escapeHtml((details.description || "").slice(0, 140))}${details.description && details.description.length > 140 ? "..." : ""}
          </div>
        </div>
        <button id="candidate-clear" style="
          background:none;border:none;color:#94a3b8;cursor:pointer;
          font-size:1.2rem;padding:2px 6px;align-self:flex-start;
        " title="Отменить выбор">✕</button>
      </div>
    `;

    // Скрываем список кандидатов
    candEl.style.display = "none";

    document.getElementById("candidate-clear").addEventListener("click", () => {
      selectedTmdbId = null;
      selectedYear = null;
      selEl.style.display = "none";
      candEl.style.display = "block";
    });
  } catch (e) {
    console.error(e);
    selEl.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

// ---------- Бейдж ----------
async function updateSuggestBadge() {
  if (!suggestCurrentUser) return;
  try {
    const snap = await firebase.database().ref("filmSuggestions").once("value");
    const data = snap.val() || {};
    const mine = Object.keys(data)
      .map((k) => ({ id: k, ...data[k] }))
      .filter((s) => s.suggestedBy === suggestCurrentUser.uid);

    const badge = document.getElementById("suggest-count-badge");
    if (badge) {
      if (mine.length > 0) {
        badge.textContent = mine.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    warn("updateSuggestBadge error:", e.message);
  }
}

// ---------- Мои предложения ----------
async function loadMySuggestions() {
  const container = document.getElementById("suggest-list-container");
  if (!container) return;

  container.innerHTML =
    '<p style="color:#94a3b8; text-align:center; padding: 20px 0;">Загрузка...</p>';

  try {
    const snap = await firebase.database().ref("filmSuggestions").once("value");
    const data = snap.val() || {};
    const mine = Object.keys(data)
      .map((k) => ({ id: k, ...data[k] }))
      .filter((s) => s.suggestedBy === suggestCurrentUser.uid)
      .sort((a, b) => (b.suggestedAt || 0) - (a.suggestedAt || 0));

    const badge = document.getElementById("suggest-count-badge");
    if (badge) {
      if (mine.length > 0) {
        badge.textContent = mine.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    if (mine.length === 0) {
      container.innerHTML = `
        <p style="color:#94a3b8; text-align:center; padding: 30px 0;">
          Вы пока ничего не предлагали.
        </p>
      `;
      return;
    }

    const statusMap = {
      pending: { label: "На рассмотрении", color: "#f59e0b", icon: "⏳" },
      approved: { label: "Одобрено", color: "#22c55e", icon: "✅" },
      rejected: { label: "Отклонено", color: "#ef4444", icon: "❌" },
    };

    container.innerHTML = mine
      .map((s) => {
        const st = statusMap[s.status] || statusMap.pending;
        const canDelete = true; // любой статус можно удалить
        return `
          <div style="
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            position: relative;
          ">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px; padding-right: 25px;">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:600;">
                  ${escapeHtml(s.title)}${s.year ? ` (${s.year})` : ""}
                  ${s.tmdbId ? ' <span style="color:#94a3b8;font-size:0.75rem;font-weight:400;">• TMDB</span>' : ""}
                </div>
                <div style="color:#94a3b8; font-size:0.8rem; margin-top:2px;">
                  ${new Date(s.suggestedAt || 0).toLocaleString("ru-RU")}
                </div>
                ${s.comment ? `<div style="color:#475569; font-size:0.88rem; margin-top:6px;">${escapeHtml(s.comment)}</div>` : ""}
              </div>
              <span style="
                color: ${st.color};
                font-weight:600;
                font-size:0.85rem;
                white-space:nowrap;
                background: ${st.color}1a;
                padding: 3px 10px;
                border-radius: 12px;
              ">${st.icon} ${st.label}</span>
            </div>
            ${
              canDelete
                ? `<button class="suggest-delete-hist" data-id="${s.id}" title="Удалить из истории" style="
                    position:absolute; top:10px; right:6px;
                    background:none;border:none;color:#cbd5e1;
                    cursor:pointer;font-size:1rem;padding:2px 6px;
                    transition: color 0.15s;
                  ">
                    <i class="fas fa-times"></i>
                  </button>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".suggest-delete-hist").forEach((btn) => {
      btn.addEventListener("mouseenter", () => (btn.style.color = "#ef4444"));
      btn.addEventListener("mouseleave", () => (btn.style.color = "#cbd5e1"));
      btn.addEventListener("click", () => deleteHistoryItem(btn.dataset.id));
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:#ef4444; text-align:center; padding: 20px 0;">Ошибка: ${e.message}</p>`;
  }
}

// ---------- Удаление из истории ----------
async function deleteHistoryItem(suggestionId) {
  if (!confirm("Удалить это предложение из истории? Отменить будет нельзя."))
    return;
  try {
    await firebase.database().ref(`filmSuggestions/${suggestionId}`).remove();
    loadMySuggestions();
  } catch (e) {
    console.error(e);
    alert("Не удалось удалить: " + e.message);
  }
}

// ---------- Отправка ----------
async function submitSuggestion() {
  if (!suggestCurrentUser) return;

  const title = document.getElementById("suggest-title").value.trim();
  const yearRaw = document.getElementById("suggest-year").value.trim();
  const comment = document.getElementById("suggest-comment").value.trim();
  const errorEl = document.getElementById("suggest-error");

  if (!title) {
    errorEl.style.color = "#ef4444";
    errorEl.textContent = "Введите название фильма";
    return;
  }
  if (title.length > 300) {
    errorEl.style.color = "#ef4444";
    errorEl.textContent = "Название слишком длинное (макс. 300 символов)";
    return;
  }

  const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;
  if (yearRaw && (isNaN(yearNum) || yearNum < 1888 || yearNum > 2100)) {
    errorEl.style.color = "#ef4444";
    errorEl.textContent = "Некорректный год";
    return;
  }

  const submitBtn = document.getElementById("suggest-submit");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправляю...';
  errorEl.textContent = "";

  try {
    const payload = {
      title,
      comment: comment || "",
      suggestedBy: suggestCurrentUser.uid,
      suggestedByEmail: suggestCurrentUser.email || "",
      suggestedAt: Date.now(),
      status: "pending",
    };
    if (yearNum) payload.year = yearNum;
    if (selectedTmdbId) payload.tmdbId = selectedTmdbId;

    await firebase.database().ref("filmSuggestions").push(payload);

    document.getElementById("suggest-title").value = "";
    document.getElementById("suggest-year").value = "";
    document.getElementById("suggest-comment").value = "";
    document.getElementById("suggest-candidates").style.display = "none";
    document.getElementById("suggest-selected").style.display = "none";
    selectedTmdbId = null;
    selectedYear = null;

    errorEl.style.color = "#16a34a";
    errorEl.textContent = "✅ Спасибо! Предложение отправлено.";

    updateSuggestBadge();
  } catch (e) {
    console.error(e);
    errorEl.style.color = "#ef4444";
    errorEl.textContent = "Ошибка отправки: " + e.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
  }
}

// ---------- Авторизация ----------
firebase.auth().onAuthStateChanged((user) => {
  updateSuggestButton(user);
});
