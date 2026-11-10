/* Admin dashboard */
(function () {
  const { C, CLASSES, SUGGESTED, client, configured, esc, uniquePath, classLabel, validateFile, signedUrls, toast, fmtDate } = window.ARG;
  const $ = id => document.getElementById(id);
  const ADMIN_USERNAME = "admin123";
  const ADMIN_PASSWORD = "cg@kkm";

  let photos = [];
  let urls = {};
  let editing = null;
  let deleting = null;

  /* ---------- boot / auth ---------- */
  function boot() { showLogin(); }

  function showLogin() {
    $("dashView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
  }

  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const err = $("loginErr"); err.classList.add("hidden");
    const name = $("username").value.trim();
    const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Signing in…";
    try {
      if (name !== ADMIN_USERNAME || $("password").value !== ADMIN_PASSWORD)
        throw new Error("Invalid username or password.");
      $("password").value = "";
      enterDashboard();
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove("hidden");
    } finally { btn.disabled = false; btn.textContent = "Login"; }
  });

  $("logoutBtn").addEventListener("click", () => {
    photos = []; urls = {}; showLogin();
  });

  async function enterDashboard() {
    $("loginView").classList.add("hidden");
    $("dashView").classList.remove("hidden");
    $("configBanner").classList.remove("hidden");
    $("welcome").textContent = "Signed in as " + ADMIN_USERNAME + ".";
    buildStaticUI();
    if (configured && client) await loadPhotos();
    switchTab("overview");
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll(".side button[data-tab]").forEach(b =>
    b.addEventListener("click", () => switchTab(b.dataset.tab)));

  function switchTab(t) {
    document.querySelectorAll(".side button[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
    ["overview", "upload", "manage", "folders"].forEach(n => $("tab-" + n).classList.toggle("hidden", n !== t));
    if (t === "overview") renderOverview();
    if (t === "manage") renderManage();
    if (t === "folders") renderFolders();
  }

  function buildStaticUI() {
    $("uClassRow").innerHTML = CLASSES.map((c, i) =>
      `<label><input type="radio" name="uClass" value="${c.id}" ${i === 0 ? "checked" : ""}><span>${c.label}</span></label>`).join("");
    $("mClass").innerHTML = '<option value="">All classes</option>' + CLASSES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
    $("eClass").innerHTML = CLASSES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
    document.querySelectorAll('input[name="uClass"]').forEach(r => r.addEventListener("change", updateDatalist));
    updateDatalist();
  }

  function selectedUploadClass() {
    const r = document.querySelector('input[name="uClass"]:checked');
    return r ? r.value : CLASSES[0].id;
  }

  function updateDatalist() {
    const cls = selectedUploadClass();
    const existing = photos.filter(p => p.class_level === cls).map(p => p.career_name);
    const names = [...new Set([...(SUGGESTED[cls] || []), ...existing])];
    $("careerList").innerHTML = names.map(n => `<option value="${esc(n)}">`).join("");
  }

  /* ---------- data ---------- */
  async function loadPhotos() {
    if (!configured || !client) {
      toast("Supabase must be configured to load and manage gallery photos.", "error");
      return;
    }
    const { data, error } = await client.from("ar_photos").select("*").order("created_at", { ascending: false });
    if (error) { toast("Could not load photos: " + error.message, "error"); return; }
    photos = data || [];
    urls = await signedUrls(photos.map(p => p.storage_path));
    updateDatalist();
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    const pub = photos.filter(p => p.is_published).length;
    const cells = [
      ["Total photos", photos.length], ["Published", pub], ["Drafts", photos.length - pub],
      ...CLASSES.map(c => [c.label, photos.filter(p => p.class_level === c.id).length])
    ];
    $("stats").innerHTML = cells.map(([l, n]) => `<div class="stat glass"><b>${n}</b><span>${esc(l)}</span></div>`).join("");
  }

  /* ---------- upload ---------- */
  $("uFile").addEventListener("change", () => {
    const f = $("uFile").files[0];
    const box = $("uPreview");
    if (!f) { box.textContent = "No image selected"; return; }
    const err = validateFile(f);
    if (err) { toast(err, "error"); $("uFile").value = ""; box.textContent = "No image selected"; return; }
    box.innerHTML = ""; const img = new Image(); img.alt = "Preview"; img.src = URL.createObjectURL(f); box.appendChild(img);
  });

  function setProgress(pct) {
    const p = $("uProg"); p.classList.remove("hidden"); p.firstElementChild.style.width = pct + "%";
  }

  $("uploadForm").addEventListener("submit", async e => {
    e.preventDefault();
    const file = $("uFile").files[0];
    const err = validateFile(file);
    if (err) return toast(err, "error");
    const career = $("uCareer").value.trim();
    if (!career) return toast("Career name is required.", "error");
    const cls = selectedUploadClass();
    const publish = document.querySelector('input[name="uStatus"]:checked').value === "publish";
    const path = uniquePath(cls, career, file.type);

    const btn = $("uBtn"); btn.disabled = true; btn.textContent = "Uploading…"; setProgress(15);
    try {
      const up = await client.storage.from(C.BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (up.error) throw up.error;
      setProgress(65);
      const ins = await client.from("ar_photos").insert({
        class_level: cls, career_name: career, description: $("uDesc").value.trim(),
        storage_path: path, is_published: publish, uploaded_by: null
      });
      if (ins.error) {
        await client.storage.from(C.BUCKET).remove([path]); // roll back orphan file
        throw ins.error;
      }
      setProgress(100);
      toast(`Uploaded to ${classLabel(cls)} (${publish ? "published" : "draft"}).`, "ok");
      $("uploadForm").reset();
      $("uPreview").textContent = "No image selected";
      await loadPhotos();
    } catch (ex) {
      toast("Upload failed: " + (ex.message || ex), "error");
    } finally {
      btn.disabled = false; btn.textContent = "Upload";
      setTimeout(() => $("uProg").classList.add("hidden"), 800);
    }
  });

  /* ---------- manage ---------- */
  ["mSearch", "mClass", "mStatus"].forEach(id => $(id).addEventListener("input", renderManage));

  function renderManage() {
    const q = $("mSearch").value.trim().toLowerCase();
    const cls = $("mClass").value, st = $("mStatus").value;
    const list = photos.filter(p =>
      (!cls || p.class_level === cls) &&
      (!st || (st === "pub" ? p.is_published : !p.is_published)) &&
      (!q || p.career_name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)));
    if (!list.length) { $("mList").innerHTML = '<div class="empty">No photos found.</div>'; return; }
    $("mList").innerHTML = list.map(p => `
      <div class="row" data-id="${p.id}">
        <div class="thumb"><img loading="lazy" alt="${esc(p.career_name)}" src="${esc(urls[p.storage_path] || "")}"></div>
        <div>
          <h4>${esc(p.career_name)}
            <span class="badge ${p.is_published ? "pub" : "draft"}">${p.is_published ? "Published" : "Draft"}</span></h4>
          <small>${esc(classLabel(p.class_level))} · uploaded ${esc(fmtDate(p.created_at))}</small>
          <small>${esc(p.description || "No description")}</small>
          <div class="actions">
            <button class="btn sm" data-act="edit">Edit</button>
            <button class="btn sm" data-act="toggle">${p.is_published ? "Unpublish" : "Publish"}</button>
            <button class="btn sm danger" data-act="delete">Delete</button>
          </div>
        </div>
      </div>`).join("");
  }

  $("mList").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const p = photos.find(x => x.id === b.closest(".row").dataset.id); if (!p) return;
    if (b.dataset.act === "edit") openEdit(p);
    if (b.dataset.act === "toggle") togglePublish(p);
    if (b.dataset.act === "delete") askDelete(p);
  });

  async function togglePublish(p) {
    const { error } = await client.from("ar_photos").update({ is_published: !p.is_published }).eq("id", p.id);
    if (error) return toast("Failed: " + error.message, "error");
    toast(p.is_published ? "Unpublished." : "Published.", "ok");
    await loadPhotos(); renderManage();
  }

  /* ---------- edit ---------- */
  function openEdit(p) {
    editing = p;
    $("eClass").value = p.class_level;
    $("eCareer").value = p.career_name;
    $("eDesc").value = p.description || "";
    $("ePub").checked = p.is_published;
    $("eFile").value = "";
    setEditPreview(urls[p.storage_path]);
    $("editModal").classList.remove("hidden");
  }
  function setEditPreview(src) {
    const box = $("ePreview"); box.innerHTML = "";
    if (src) { const i = new Image(); i.src = src; i.alt = "Preview"; box.appendChild(i); } else box.textContent = "No preview";
  }
  $("eFile").addEventListener("change", () => {
    const f = $("eFile").files[0]; if (!f) return setEditPreview(urls[editing.storage_path]);
    const err = validateFile(f);
    if (err) { toast(err, "error"); $("eFile").value = ""; return; }
    setEditPreview(URL.createObjectURL(f));
  });
  $("eCancel").addEventListener("click", () => $("editModal").classList.add("hidden"));

  $("editForm").addEventListener("submit", async e => {
    e.preventDefault();
    const p = editing; if (!p) return;
    const btn = $("eSave"); btn.disabled = true; btn.textContent = "Saving…";
    const bucket = client.storage.from(C.BUCKET);
    const newClass = $("eClass").value;
    const career = $("eCareer").value.trim();
    const file = $("eFile").files[0];
    let newPath = p.storage_path;
    let uploadedNew = null, movedFrom = null;
    try {
      if (!career) throw new Error("Career name is required.");
      if (file) {
        const err = validateFile(file); if (err) throw new Error(err);
        newPath = uniquePath(newClass, career, file.type);
        const up = await bucket.upload(newPath, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        uploadedNew = newPath;
      } else if (newClass !== p.class_level) {
        const fname = p.storage_path.split("/").pop();
        newPath = `${newClass}/${fname}`;
        const mv = await bucket.move(p.storage_path, newPath);
        if (mv.error) throw mv.error;
        movedFrom = p.storage_path;
      }
      const upd = await client.from("ar_photos").update({
        class_level: newClass, career_name: career, description: $("eDesc").value.trim(),
        is_published: $("ePub").checked, storage_path: newPath
      }).eq("id", p.id);
      if (upd.error) {
        // undo storage changes so DB and storage stay consistent
        if (uploadedNew) await bucket.remove([uploadedNew]);
        if (movedFrom) await bucket.move(newPath, movedFrom);
        throw upd.error;
      }
      if (uploadedNew) await bucket.remove([p.storage_path]); // old image replaced
      toast("Changes saved.", "ok");
      $("editModal").classList.add("hidden");
      await loadPhotos(); renderManage();
    } catch (ex) {
      toast("Save failed: " + (ex.message || ex), "error");
    } finally { btn.disabled = false; btn.textContent = "Save Changes"; }
  });

  /* ---------- delete ---------- */
  function askDelete(p) {
    deleting = p;
    $("delText").textContent = `"${p.career_name}" (${classLabel(p.class_level)}) will be removed from the gallery and storage. This cannot be undone.`;
    $("delModal").classList.remove("hidden");
  }
  $("delNo").addEventListener("click", () => $("delModal").classList.add("hidden"));
  $("delYes").addEventListener("click", async () => {
    const p = deleting; if (!p) return;
    const btn = $("delYes"); btn.disabled = true;
    try {
      const rm = await client.storage.from(C.BUCKET).remove([p.storage_path]);
      if (rm.error) throw rm.error;
      const del = await client.from("ar_photos").delete().eq("id", p.id);
      if (del.error) throw del.error;
      toast("Photo deleted.", "ok");
      $("delModal").classList.add("hidden");
      await loadPhotos(); renderManage();
    } catch (ex) { toast("Delete failed: " + (ex.message || ex), "error"); }
    finally { btn.disabled = false; deleting = null; }
  });

  /* ---------- folders ---------- */
  function renderFolders() {
    $("folderList").innerHTML = CLASSES.map(c => {
      const list = photos.filter(p => p.class_level === c.id);
      const pub = list.filter(p => p.is_published).length;
      const have = new Set(list.map(p => p.career_name.toLowerCase()));
      const chips = [
        ...[...new Set(list.map(p => p.career_name))].map(n => `<span class="chip has">${esc(n)}</span>`),
        ...(SUGGESTED[c.id] || []).filter(n => !have.has(n.toLowerCase())).map(n => `<span class="chip">${esc(n)}</span>`)
      ].join("");
      return `<div class="folder glass">
        <h3>${c.label} <small style="color:var(--muted);font-weight:400">· career-fair-ar/${c.id}/</small></h3>
        <small style="color:var(--muted)">${list.length} photo(s) · ${pub} published · ${list.length - pub} draft</small>
        <div class="chips">${chips}</div>
        <div class="actions">
          <button class="btn sm gold" data-add="${c.id}">+ Add Career / Photo</button>
          <button class="btn sm" data-view="${c.id}">View Photos</button>
        </div></div>`;
    }).join("");
  }
  $("folderList").addEventListener("click", e => {
    const a = e.target.closest("[data-add]"), v = e.target.closest("[data-view]");
    if (a) {
      switchTab("upload");
      const r = document.querySelector(`input[name="uClass"][value="${a.dataset.add}"]`);
      if (r) { r.checked = true; updateDatalist(); }
      $("uCareer").focus();
    }
    if (v) { switchTab("manage"); $("mClass").value = v.dataset.view; renderManage(); }
  });

  boot();
})();
