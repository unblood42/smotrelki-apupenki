// suggest.js
// Модалка «Предложить фильм» на главной странице.

let suggestCurrentUser = null;

// ---------- Модалка: HTML вставляется один раз ----------
function ensureSuggestModal() {
  if (document.getElementById("suggest-modal")) return;

  const modalHtml = `
    <div id="suggest-modal" class="modal" style="
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
        padding: 25px;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      ">
        <h3 style="margin-top:0;">💡 Предложить фильм</h3>
        <p style="color:#64748b; margin-top:0; font-size:0.9rem;">
          Ваше предложение попадёт в очередь на модерацию. Если фильм подойдёт — он появится на сайте.
        </p>

        <input type="text" id="suggest-title" placeholder="Название фильма" style="
          width: 100%; padding: 10px;
          margin: 5px 0 10px;
          border: 2px solid #3498db; border-radius: 30px;
          box-sizing: border-box; font-size: 1rem;
        " />
        <input type="number" id="suggest-year" placeholder="Год (опционально)" min="1888" max="2100" style="
          width: 100%; padding: 10px;
          margin: 0 0 10px;
          border: 2px solid #3498db; border-radius: 30px;
          box-sizing: border-box; font-size: 1rem;
        " />
        <textarea id="suggest-comment" placeholder="Комментарий для друзей (опционально)" style="
          width: 100%; padding: 10px;
          border: 2px solid #3498db; border-radius: 16px;
          resize: vertical; min-height: 70px;
          box-sizing: border-box; font-size: 0.95rem;
          font-family: inherit;
        "></textarea>

        <div id="suggest-error" style="color:#ef4444; margin: 10px 0; min-height: 20px;"></div>

        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
          <button id="suggest-cancel" class="filter-btn reset-btn">Отмена</button>
          <button id="suggest-submit" class="filter-btn" style="background:#22c55e;">
            <i class="fas fa-paper-plane"></i> Отправить
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document
    .getElementById("suggest-cancel")
    .addEventListener("click", closeSuggestModal);
  document.getElementById("suggest-modal").addEventListener("click", (e) => {
    if (e.target.id === "suggest-modal") closeSuggestModal();
  });
  document
    .getElementById("suggest-submit")
    .addEventListener("click", submitSuggestion);
}

function openSuggestModal() {
  ensureSuggestModal();
  document.getElementById("suggest-title").value = "";
  document.getElementById("suggest-year").value = "";
  document.getElementById("suggest-comment").value = "";
  document.getElementById("suggest-error").textContent = "";
  document.getElementById("suggest-modal").style.display = "flex";
  document.getElementById("suggest-title").focus();
}

function closeSuggestModal() {
  const modal = document.getElementById("suggest-modal");
  if (modal) modal.style.display = "none";
}

// ---------- Кнопка в шапке ----------
function updateSuggestButton(user) {
  suggestCurrentUser = user;

  // Кнопку показываем только на главной (где есть блок фильтров)
  if (!document.getElementById("films-container")) return;

  const nav = document.querySelector(".header nav");
  if (!nav) return;

  const existing = document.getElementById("suggest-btn");
  const shouldShow = !!user;

  if (shouldShow && !existing) {
    const btn = document.createElement("button");
    btn.id = "suggest-btn";
    btn.className = "filter-btn";
    btn.style.background = "#9b59b6";
    btn.innerHTML = '<i class="fas fa-lightbulb"></i> Предложить фильм';
    btn.addEventListener("click", openSuggestModal);

    // Вставляем перед email
    const emailSpan = document.getElementById("user-email");
    if (emailSpan) nav.insertBefore(btn, emailSpan);
    else nav.appendChild(btn);
  } else if (!shouldShow && existing) {
    existing.remove();
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
    errorEl.textContent = "Введите название фильма";
    return;
  }
  if (title.length > 300) {
    errorEl.textContent = "Название слишком длинное (макс. 300 символов)";
    return;
  }

  const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;
  if (yearRaw && (isNaN(yearNum) || yearNum < 1888 || yearNum > 2100)) {
    errorEl.textContent = "Некорректный год";
    return;
  }

  const submitBtn = document.getElementById("suggest-submit");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправляю...';
  errorEl.textContent = "";

  try {
    await firebase
      .database()
      .ref("filmSuggestions")
      .push({
        title,
        year: yearNum,
        comment: comment || "",
        suggestedBy: suggestCurrentUser.uid,
        suggestedByEmail: suggestCurrentUser.email || "",
        suggestedAt: Date.now(),
      });
    closeSuggestModal();
    // Небольшая благодарность
    setTimeout(() => {
      alert("Спасибо! Предложение отправлено на модерацию.");
    }, 100);
  } catch (e) {
    console.error(e);
    errorEl.textContent = "Ошибка отправки: " + e.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
  }
}

// ---------- Подписка на авторизацию ----------
firebase.auth().onAuthStateChanged((user) => {
  updateSuggestButton(user);
});
