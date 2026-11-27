const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const namespace = "demo-smotrelki-order-default-rtdb";

async function createUser() {
  const response = await fetch(
    "http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  assert.ok(response.ok, "Cannot create a user in the local Auth emulator");
  const { localId: uid, idToken } = await response.json();
  assert.ok(uid && idToken);
  return { uid, idToken };
}

async function database(method, location, user, value, expectedStatus = 200) {
  const url = new URL("http://127.0.0.1:19000/" + location + ".json");
  url.searchParams.set("ns", namespace);
  if (user) url.searchParams.set("auth", user.idToken);
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const body = await response.json();
  assert.equal(response.status, expectedStatus, method + " " + location + " " + JSON.stringify(body));
  return body;
}

test("marathon roles, version conflicts and preservation of viewing marks", async () => {
  const [owner, editor, viewer] = await Promise.all([createUser(), createUser(), createUser()]);
  const location = "marathons/test-order";
  const write = (user, value, status) => database("PATCH", location, user, value, status);
  await database("PUT", location, owner, {
    name: "Test marathon",
    createdBy: owner.uid,
    createdAt: 1,
    isEditableByAll: true,
    canAnyoneMarkWatched: true,
  });
  await database("GET", location, null, undefined, 401);
  await write(editor, {
    filmsRevision: 1,
    "films/3": { addedBy: editor.uid, addedAt: 2, order: 0 },
  });
  await write(owner, {
    filmsRevision: 2,
    "films/1": { addedBy: owner.uid, addedAt: 3, order: 1 },
  });
  await database("PUT", location + "/films/3/watchedBy/" + viewer.uid, viewer, true);
  await write(editor, { filmsRevision: 3, "films/3/order": 1, "films/1/order": 0 });
  await write(owner, { filmsRevision: 3, "films/3/order": 0 }, 401);
  await write(editor, { filmsRevision: 4, "films/99/order": 0 }, 401);
  await write(editor, { filmsRevision: 4, "films/1/order": 0.5 }, 401);
  await write(editor, { name: "Unauthorized name" }, 401);
  const stored = await database("GET", location, viewer);
  assert.deepEqual(stored.films[3], {
    addedBy: editor.uid,
    addedAt: 2,
    order: 1,
    watchedBy: { [viewer.uid]: true },
  });

  await write(owner, { isEditableByAll: false });
  await write(viewer, { filmsRevision: 4, "films/3/order": 0 }, 401);
  await write(viewer, {
    filmsRevision: 4,
    "films/2": { addedBy: viewer.uid, addedAt: 4, order: 2 },
  }, 401);
  await write(owner, { filmsRevision: 4, "films/1": null });
  await write(editor, { filmsRevision: 5, "films/3": null }, 401);
  await database("DELETE", location, editor, undefined, 401);
  await database("DELETE", location, owner);
});

function loadRatingClient(user) {
  let updates = 0;
  let expectedStatus = 200;
  const context = vm.createContext({
    document: { addEventListener() {} },
    console: { log() {}, error() {} },
    firebase: {
      auth: () => ({ currentUser: user }),
      database: () => ({
        ref(location) {
          assert.equal(location, undefined, "Rating updates must target the database root");
          return {
            async update(value) {
              updates++;
              await database("PATCH", "", user, value, expectedStatus);
              if (expectedStatus !== 200) throw new Error("Rating write denied");
            },
          };
        },
      }),
    },
  });
  for (const file of ["shared.js", "auth.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "shared", file), "utf8"), context);
  }
  return {
    save: context.saveRatingToFirebase,
    remove: context.deleteRatingFromFirebase,
    updates: () => updates,
    expectStatus: (value) => { expectedStatus = value; },
  };
}

test("rating save, rejected update and deletion are atomic; publication remains", async () => {
  const [author, other] = await Promise.all([createUser(), createUser()]);
  const client = loadRatingClient(author);
  const filmId = 42;
  const personal = "users/" + author.uid + "/ratings/" + filmId;
  const index = "filmRatings/" + filmId + "/" + author.uid;
  const original = { s1: 5, s2: 5, s3: 5, s4: 5, s5: 5, m: 5, updatedAt: 1 };
  const edited = { ...original, s1: 10, updatedAt: 2 };
  const history = {
    uid: author.uid, filmId, createdAt: 1,
    ratingSnapshot: { ...original, total: 5 },
  };
  await client.save(filmId, original);
  await database("PUT", "comments/test-rating", author, history);
  await client.save(filmId, edited);
  assert.equal(client.updates(), 2);
  assert.deepEqual(await database("GET", personal, author), edited);
  const indexed = await database("GET", index, other);
  assert.equal(indexed.s1, 10);
  assert.equal(indexed.updatedAt, 2);
  await database("DELETE", index, other, undefined, 401);
  await database("GET", index, null, undefined, 401);

  client.expectStatus(401);
  await assert.rejects(client.save(filmId, { ...edited, s1: null }), /denied/);
  assert.deepEqual(await database("GET", personal, author), edited);
  assert.deepEqual(await database("GET", index, other), indexed);
  client.expectStatus(200);
  await client.remove(filmId);
  assert.equal(client.updates(), 4);
  assert.equal(await database("GET", personal, author), null);
  assert.equal(await database("GET", index, other), null);
  assert.deepEqual(await database("GET", "comments/test-rating", other), history);
});
