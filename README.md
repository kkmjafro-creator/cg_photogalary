# Career Fair – Class-wise AR Photo Gallery

A self-contained add-on. It lives in its own `ar-gallery/` folder and does **not** modify any existing page of your website.

## Files
| File | Purpose |
|---|---|
| `ar-gallery.html` | Public gallery (class cards → class gallery → viewer → booth panel) |
| `admin.html` | Admin dashboard (login, upload, manage, class folders) |
| `ar-gallery.css` | Black / metallic gold / glass theme |
| `config.js` | **Your** Supabase URL + anon key, admin username |
| `common.js`, `gallery.js`, `admin.js` | JavaScript |
| `supabase-setup.sql` | Table, RLS, storage bucket and policies |

## 1. Install
1. Copy the `ar-gallery` folder next to your existing site (e.g. `yoursite/ar-gallery/`).
2. In `config.js` set `HOME_URL` to your main page (default `../index.html`).
3. Add a link on your existing site pointing to `ar-gallery/ar-gallery.html` (if your current AR Photo Experience link already exists, repoint it).

## 2. Supabase setup
1. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `config.js`. (Never use the `service_role` key.)
2. **SQL Editor**: paste and run all of `supabase-setup.sql`. This creates `ar_photos`, `career_admins`, the RLS policies, the private bucket `career-fair-ar` (5 MB, JPG/PNG/WEBP only) and the storage policies.
### Admin login
The admin page checks the username `admin123` and password `cg@kkm` in browser-side JavaScript. This is only a convenience gate: anyone can inspect the page source and bypass it. It does **not** create a Supabase Auth session. Supabase Row Level Security still blocks protected photo uploads, edits, and deletes without an authenticated admin session. Do not treat this browser-side login as security for private or sensitive data.

## 3. Storage layout
Private bucket `career-fair-ar`:
```
class-9/software-developer-1730800000000-a1b2c3.jpg
class-10/mechanical-engineer-…jpg
class-11/…   class-12/…
```
File names always get a timestamp + random suffix, so nothing is overwritten. Changing a photo's class moves the file to the new folder (`storage.move`) and updates the database; if the database update fails the move is reversed. Visitors get short-lived signed URLs, and storage policy only allows that for **published** photos, so drafts are not reachable even with a guessed URL.

## 4. Photo booth (OBS Studio + Open Photo Booth)
Selecting **Select Background** opens a panel showing the career, class and exact file name, with:
- **Download Background** – saves the image for the operator to set as the image source in OBS.
- **Full-Screen Booth View** – shows the background alone (e.g. capture that window in OBS).
- **Return to Gallery**.

This does **not** change OBS automatically. A real automatic link would need OBS WebSocket (obs-websocket) with a small local helper – say so if you want that built.

## 5. Testing checklist
**Public**
- [ ] Four class cards show; counts match published photos only.
- [ ] Open a class; search and career filter work; masonry is responsive on phone.
- [ ] Open image → full screen; ‹ › buttons, arrow keys and swipe work; Esc closes.
- [ ] Select Background → panel; Download works; Full-Screen works; Return to Gallery works.
- [ ] Unpublished photos never appear (check in a private window).

**Admin** (`admin.html`)
- [ ] Wrong password → error. Correct password → dashboard. A user not in `career_admins` is refused.
- [ ] Upload JPG/PNG/WEBP < 5 MB as Published → appears in public gallery.
- [ ] A `.gif` or file > 5 MB is rejected.
- [ ] Save as Draft → not public; Publish button then makes it public.
- [ ] Edit name/description; change class → file moves in Storage → class folder; replace photo → old file removed.
- [ ] Search and class/status filters work; upload dates shown.
- [ ] Delete asks for confirmation, then removes row and file.
- [ ] Logout returns to login; reloading the page does not show the dashboard.

**Security (browser console, logged out)**
```js
await supabase.from('ar_photos').select('*').eq('is_published', false)   // returns []
await supabase.from('ar_photos').insert({class_level:'class-9',career_name:'x',storage_path:'x'}) // error (RLS)
```
