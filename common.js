/* Shared helpers for public gallery and admin dashboard */
(function () {
  const C = window.ARG_CONFIG;

  const CLASSES = [
    { id: "class-9",  label: "9th Class",  short: "9",  tagline: "First steps into the world of careers" },
    { id: "class-10", label: "10th Class", short: "10", tagline: "Choose your engineering path" },
    { id: "class-11", label: "11th Class", short: "11", tagline: "Specialise and explore streams" },
    { id: "class-12", label: "12th Class", short: "12", tagline: "Launch your professional future" }
  ];

  const SUGGESTED = {
    "class-9":  ["Software Developer", "AI Engineer", "Doctor", "Scientist", "Astronaut", "Other Careers"],
    "class-10": ["Computer Engineer", "Mechanical Engineer", "Civil Engineer", "Aerospace Engineer", "Robotics Engineer", "Other Careers"],
    "class-11": ["Computer Science", "Artificial Intelligence", "Electronics", "Mechanical", "Civil", "Other Careers"],
    "class-12": ["Software Engineer", "AI Engineer", "Aerospace Engineer", "Electrical Engineer", "Research Scientist", "Other Careers"]
  };

  const configured = C && C.SUPABASE_URL && !C.SUPABASE_URL.includes("YOUR-PROJECT") &&
                     C.SUPABASE_ANON_KEY && !C.SUPABASE_ANON_KEY.includes("YOUR-ANON");

  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function slugify(s) {
    return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
      .trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photo";
  }

  function extFromType(type) {
    return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type] || "jpg";
  }

  function uniquePath(classId, careerName, mime) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${classId}/${slugify(careerName)}-${Date.now()}-${rand}.${extFromType(mime)}`;
  }

  function classLabel(id) {
    const c = CLASSES.find(x => x.id === id);
    return c ? c.label : id;
  }

  function validateFile(file) {
    if (!file) return "Please choose an image.";
    if (!C.ALLOWED_TYPES.includes(file.type)) return "Only JPG, JPEG, PNG and WEBP images are allowed.";
    if (file.size > C.MAX_FILE_BYTES) return "Image is larger than 5 MB.";
    return null;
  }

  // Returns { path: signedUrl } for a list of storage paths.
  async function signedUrls(paths, options) {
    const map = {};
    if (!client || !paths.length) return map;
    const { data, error } = await client.storage.from(C.BUCKET)
      .createSignedUrls(paths, C.SIGNED_URL_SECONDS, options);
    if (error) { console.error(error); return map; }
    (data || []).forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }

  function toast(msg, type) {
    let box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 4200);
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return iso; }
  }

  window.ARG = { C, CLASSES, SUGGESTED, client, configured, esc, slugify, uniquePath, classLabel,
                 validateFile, signedUrls, toast, fmtDate };
})();
