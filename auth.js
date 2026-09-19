// auth.js

let currentUser = null;

function initAuth() {
  firebase
    .auth()
    .getRedirectResult()
    .catch((error) => {
      console.error("Ошибка редиректа:", error);
    });

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      window.currentUser = user;
      document.body.classList.add("user-logged-in");
      updateAuthButton(user);
      updateUserInfo(user);
      updateAdminLink(user);
      await loadUserData(user.uid);
    } else {
      currentUser = null;
      window.currentUser = null;
      document.body.classList.remove("user-logged-in");
      updateAuthButton(null);
      updateUserInfo(null);
      updateAdminLink(null);
      clearUserData();
    }
  });
}

function updateAuthButton(user) {
  const btn = document.getElementById("auth-button");
  if (!btn) return;
  if (user) {
    btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Выйти';
  } else {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
  }
}

// UID администратора — должен совпадать с admin.js и Firebase Rules
const ADMIN_UID = "FCX08Xm9e0ZKhkwe3qESrtP0ey13";

// Показывает/скрывает ссылку на админку в шапке.
// Вставляется динамически, чтобы не править каждый HTML-файл.
function updateAdminLink(user) {
  const nav = document.querySelector(".header nav");
  if (!nav) return;

  const existing = document.getElementById("admin-link");
  const isAdmin = user && user.uid === ADMIN_UID;

  if (isAdmin && !existing) {
    const link = document.createElement("a");
    link.href = "admin.html";
    link.id = "admin-link";
    link.textContent = "⚙️ Админка";
    // Вставляем перед user-email, чтобы был рядом с кнопкой «Выйти»
    const emailSpan = document.getElementById("user-email");
    if (emailSpan) {
      nav.insertBefore(link, emailSpan);
    } else {
      nav.appendChild(link);
    }
  } else if (!isAdmin && existing) {
    existing.remove();
  }
}

function updateUserInfo(user) {
  const span = document.getElementById("user-email");
  if (!span) return;
  if (user && user.email) {
    span.textContent = user.displayName || user.email;
    span.style.display = "inline-flex";
  } else {
    span.style.display = "none";
  }
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase
    .auth()
    .signInWithPopup(provider)
    .then((result) => console.log("Успешный вход через popup", result.user))
    .catch((error) => {
      console.error("Ошибка входа через popup:", error);
      if (error.code === "auth/popup-blocked") {
        alert(
          "Вход не удался: браузер заблокировал всплывающее окно. Пожалуйста, разрешите всплывающие окна для этого сайта и попробуйте снова.",
        );
      } else if (error.code === "auth/unauthorized-domain") {
        alert(
          "Домен не авторизован. Добавьте " +
            window.location.hostname +
            " в консоли Firebase (Authentication → Sign-in method → Authorized domains).",
        );
      } else {
        alert("Ошибка входа: " + error.message);
      }
    });
}

function signOut() {
  firebase.auth().signOut();
}

async function loadUserData(uid) {
  const userRef = firebase.database().ref(`users/${uid}`);
  const snapshot = await userRef.once("value");
  const userData = snapshot.val() || {};

  window.userFavorites = userData.favorites || [];
  window.userExcluded = new Set(userData.excluded || []);

  if (typeof excludedFilmIds !== "undefined") {
    excludedFilmIds = window.userExcluded;
  }
}

function saveFavoritesToFirebase(favoritesArray) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  firebase
    .database()
    .ref(`users/${user.uid}/favorites`)
    .set(favoritesArray)
    .then(() => console.log("✅ Избранное сохранено в Firebase"))
    .catch((error) =>
      console.error("❌ Ошибка сохранения избранного в Firebase:", error),
    );
  window.userFavorites = favoritesArray;
}

function saveExcludedToFirebase(excludedArray) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  firebase
    .database()
    .ref(`users/${user.uid}/excluded`)
    .set(excludedArray)
    .then(() => console.log("✅ Исключённые сохранены в Firebase"))
    .catch((error) =>
      console.error("❌ Ошибка сохранения исключённых в Firebase:", error),
    );
  window.userExcluded = new Set(excludedArray);
}

function saveRatingToFirebase(filmId, ratingData) {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.warn("⚠️ saveRatingToFirebase: пользователь не авторизован");
    return;
  }
  const path = `users/${user.uid}/ratings/${filmId}`;
  console.log("💾 Сохранение в Firebase по пути:", path, ratingData);
  firebase
    .database()
    .ref(path)
    .set(ratingData)
    .then(() => console.log("✅ Оценка успешно сохранена в Firebase"))
    .catch((error) =>
      console.error("❌ Ошибка сохранения оценки в Firebase:", error),
    );
}

async function loadRatingFromFirebase(filmId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("📥 loadRatingFromFirebase: пользователь не авторизован");
    return null;
  }
  const path = `users/${user.uid}/ratings/${filmId}`;
  console.log("📥 Загрузка из Firebase по пути:", path);
  try {
    const snapshot = await firebase.database().ref(path).once("value");
    const data = snapshot.val();
    console.log("📦 Получены данные из Firebase:", data);
    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки из Firebase:", error);
    return null;
  }
}

function clearUserData() {
  window.userFavorites = [];
  window.userExcluded = new Set();
  if (typeof excludedFilmIds !== "undefined") {
    excludedFilmIds = new Set();
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#auth-button")) {
    if (currentUser) {
      signOut();
    } else {
      signInWithGoogle();
    }
  }
});

document.addEventListener("DOMContentLoaded", initAuth);
