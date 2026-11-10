/* Public AR gallery */
(function () {
  const { C, CLASSES, client, configured, esc, classLabel, signedUrls, toast } = window.ARG;
  const $ = id => document.getElementById(id);

  let allPhotos = [];       // published photos (RLS guarantees only published are returned)
  let urls = {};            // storage_path -> signed URL
  let currentClass = null;
  let filtered = [];        // photos currently shown
  let lbIndex = 0;
  let selected = null;

  $("homeLink").href = C.HOME_URL || "../index.html";

  async function loadPhotos() {
    if (!configured || !client) { $("configBanner").classList.remove("hidden"); renderClasses(); return; }
    const { data, error } = await client.from("ar_photos")
      .select("id,class_level,career_name,description,storage_path,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) { toast("Could not load gallery: " + error.message, "error"); console.error(error); }
    allPhotos = data || [];
    renderClasses();
    route();
  }

  /* ---------- class selection ---------- */
  function renderClasses() {
    $("classGrid").innerHTML = CLASSES.map(c => {
      const n = allPhotos.filter(p => p.class_level === c.id).length;
      const bg = C.CLASS_BACKGROUNDS && C.CLASS_BACKGROUNDS[c.id];
      const style = bg ? `style="background-image:url('${esc(bg)}')"` : "";
      return `<button class="class-card ${bg ? "has-bg" : ""}" data-class="${c.id}" ${style}>
        <span class="class-num">${c.short}</span>
        <h2>${c.label}</h2>
        <p>${esc(c.tagline)}</p>
        <span class="count-pill">${n} published photo${n === 1 ? "" : "s"}</span>
        <span class="btn gold">Explore Gallery →</span>
      </button>`;
    }).join("");
    document.querySelectorAll(".class-card").forEach(el =>
      el.addEventListener("click", () => { location.hash = el.dataset.class; }));
  }

  /* ---------- routing ---------- */
  function route() {
    const h = location.hash.replace("#", "");
    if (CLASSES.some(c => c.id === h)) openClass(h);
    else showClasses();
  }
  window.addEventListener("hashchange", route);

  function showClasses() {
    currentClass = null;
    $("viewGallery").classList.add("hidden");
    $("viewClasses").classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  async function openClass(id) {
    currentClass = id;
    $("viewClasses").classList.add("hidden");
    $("viewGallery").classList.remove("hidden");
    $("galleryTitle").textContent = classLabel(id) + " – AR Career Gallery";
    $("searchBox").value = "";
    const list = allPhotos.filter(p => p.class_level === id);
    const careers = [...new Set(list.map(p => p.career_name))].sort((a, b) => a.localeCompare(b));
    $("careerFilter").innerHTML = '<option value="">All careers</option>' +
      careers.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    window.scrollTo(0, 0);
    $("galleryMsg").classList.remove("hidden");
    $("galleryMsg").innerHTML = '<span class="loader"></span> Loading photos…';
    $("masonry").innerHTML = "";
    const need = list.map(p => p.storage_path).filter(p => !urls[p]);
    Object.assign(urls, await signedUrls(need));
    renderGallery();
  }

  function renderGallery() {
    const q = $("searchBox").value.trim().toLowerCase();
    const career = $("careerFilter").value;
    filtered = allPhotos.filter(p => p.class_level === currentClass &&
      (!career || p.career_name === career) &&
      (!q || p.career_name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)));
    const msg = $("galleryMsg");
    if (!filtered.length) {
      msg.classList.remove("hidden");
      msg.textContent = allPhotos.some(p => p.class_level === currentClass)
        ? "No careers match your search." : "No photos have been published for this class yet.";
    } else msg.classList.add("hidden");

    $("masonry").innerHTML = filtered.map((p, i) => `
      <article class="photo-card" data-i="${i}" tabindex="0">
        <div class="img"><img loading="lazy" src="${esc(urls[p.storage_path] || "")}" alt="${esc(p.career_name)}"></div>
        <div class="meta">
          <h3>${esc(p.career_name)}</h3>
          <p>${esc(p.description)}</p>
          <span class="tag">${esc(classLabel(p.class_level))}</span>
        </div>
      </article>`).join("");
    document.querySelectorAll(".photo-card").forEach(el => {
      const open = () => openLightbox(+el.dataset.i);
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  $("searchBox").addEventListener("input", renderGallery);
  $("careerFilter").addEventListener("change", renderGallery);
  $("backToClasses").addEventListener("click", () => { location.hash = ""; history.replaceState(null, "", location.pathname); showClasses(); });

  /* ---------- lightbox ---------- */
  function openLightbox(i) {
    lbIndex = i;
    $("lightbox").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    showLb();
  }
  function showLb() {
    const p = filtered[lbIndex];
    if (!p) return;
    $("lbImg").src = urls[p.storage_path] || "";
    $("lbImg").alt = p.career_name;
    $("lbTitle").textContent = p.career_name;
    $("lbDesc").textContent = p.description || "";
    $("lbClass").textContent = classLabel(p.class_level);
    $("lbCount").textContent = `${lbIndex + 1} / ${filtered.length}`;
    const multi = filtered.length > 1;
    $("lbPrev").style.display = $("lbNext").style.display = multi ? "" : "none";
  }
  function stepLb(d) {
    if (!filtered.length) return;
    lbIndex = (lbIndex + d + filtered.length) % filtered.length;
    showLb();
  }
  function closeLb() {
    $("lightbox").classList.add("hidden");
    document.body.style.overflow = "";
  }
  $("lbPrev").addEventListener("click", () => stepLb(-1));
  $("lbNext").addEventListener("click", () => stepLb(1));
  $("lbClose").addEventListener("click", closeLb);
  $("lbBack").addEventListener("click", closeLb);
  $("lbSelect").addEventListener("click", () => openBooth(filtered[lbIndex]));

  // swipe support
  let tx = null;
  $("lightbox").addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
  $("lightbox").addEventListener("touchend", e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 60) stepLb(dx < 0 ? 1 : -1);
    tx = null;
  });

  /* ---------- selected background / photo booth ---------- */
  function fileNameFor(p) {
    return p.storage_path.split("/").pop();
  }
  function openBooth(p) {
    selected = p;
    try { localStorage.setItem("arg_selected", JSON.stringify({ id: p.id, career: p.career_name, class: p.class_level, file: fileNameFor(p) })); } catch (e) {}
    $("boothImg").src = urls[p.storage_path] || "";
    $("boothImg").alt = p.career_name;
    $("boothTitle").textContent = p.career_name;
    $("boothDesc").textContent = p.description || "";
    $("boothClass").textContent = classLabel(p.class_level);
    $("boothFile").textContent = classLabel(p.class_level) + " / " + p.career_name + "  —  " + fileNameFor(p);
    $("booth").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeBooth() {
    $("booth").classList.add("hidden");
    $("fsBg").classList.add("hidden");
    document.body.style.overflow = $("lightbox").classList.contains("hidden") ? "" : "hidden";
  }
  $("boothReturn").addEventListener("click", () => { closeBooth(); closeLb(); });

  $("boothDownload").addEventListener("click", async () => {
    if (!selected) return;
    const name = fileNameFor(selected);
    const map = await signedUrls([selected.storage_path], { download: name });
    const u = map[selected.storage_path];
    if (!u) { toast("Could not prepare download.", "error"); return; }
    const a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  });

  $("boothFull").addEventListener("click", () => {
    if (!selected) return;
    const fs = $("fsBg");
    fs.style.backgroundImage = `url("${urls[selected.storage_path]}")`;
    fs.classList.remove("hidden");
    if (fs.requestFullscreen) fs.requestFullscreen().catch(() => {});
  });
  $("fsBg").addEventListener("click", () => {
    $("fsBg").classList.add("hidden");
    if (document.fullscreenElement) document.exitFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) $("fsBg").classList.add("hidden");
  });

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", e => {
    if (!$("fsBg").classList.contains("hidden")) { if (e.key === "Escape") $("fsBg").classList.add("hidden"); return; }
    if (!$("booth").classList.contains("hidden")) { if (e.key === "Escape") closeBooth(); return; }
    if ($("lightbox").classList.contains("hidden")) return;
    if (e.key === "Escape") closeLb();
    else if (e.key === "ArrowRight") stepLb(1);
    else if (e.key === "ArrowLeft") stepLb(-1);
  });

  loadPhotos();
})();
