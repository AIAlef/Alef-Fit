# Settings Spec

The **Setting** tab (Tab 5) is where every adjustable function of the app lives, plus backup & sync. All values are stored in the `app_settings` key-value table (so a backup captures them) — see [DATA_MODEL](./DATA_MODEL.md). Built in milestone **M5**, but the settings *store* and a few cross-cutting values (theme, text size) come online with the design phase so features can read them as they're built.

CE (Gregorian) is the system standard; BE is an optional display-only toggle.

---

## 1. Appearance

### Text size
Two modes:
- **Follow system** (default) — respect the phone's font-scale setting (`MediaQuery.textScaler`). Changing the OS text size changes the app.
- **Manual** — a **slider** sets the app's own scale, overriding the OS. Clamp to a safe range (≈ 0.85×–1.6×) so layouts never break. Live preview while sliding.

### Theme
System (default) / Light / Dark.

### Language
System (default) / English / ไทย.

### Calendar
**CE (default)** / BE. Display-only: BE = CE + 543. Storage, logic, and exports stay CE.

---

## 2. Backup & sync

Drives the "Backup" button (Retro) and this screen. Detail in [BACKUP_AND_VERSIONING](./BACKUP_AND_VERSIONING.md).
- **Export backup** — write a `.zip`/`.alefbak` (DB + media) and share (file or Google Drive).
- **Import / restore** — pick a backup file, validate, restore (snapshots current data first).
- **Google Drive sync** — sign in; manual "Back up now"; optional auto-backup schedule; shows **last backup / last sync** time.

---

## 3. Photos & media

- **Save to phone album** — on/off (default off). When on, photos imported or captured in the app are also copied to the device gallery.
- **Image quality** — applied when importing/saving images:
  - **Original** — store as-is, no re-encoding.
  - **Normal** (default) — re-encode to a sensible max dimension/quality to save space.
  - **Low** — stronger compression for smallest size.
  - Videos (mp4) are always kept as-is.

---

## 4. Modules — folders & tags

Fitness Note and Bodybuilding **each** have their own, **separate** folder list and tag set.

### Fitness Note → "Edit the folder list"
Add, rename, reorder, delete folders; optionally set a folder's card background (see §6).

### Fitness Note → "Manage Tags"
Add, rename, recolor, delete, (optional) merge tags. A note can carry several tags.

### Bodybuilding → "Edit the folder list" / "Manage Tags"
Identical capabilities, but a **completely separate** set from Notes.

---

## 5. Fitness To-do settings — Default Alert Times

Defaults applied to new to-dos (each to-do can still override its own alert).

### "Time To-do Note" (timed events)
Default reminder offset before a to-do that has a specific time:

> None · At time of event · 5 minutes before · 10 minutes before · 15 minutes before · 30 minutes before · 45 minutes before · 1 hour before · 2 hours before · 3 hours before · 6 hours before · 12 hours before · 1 day before · 2 days before · 3 days before

### "All-Day To-do Note" (all-day events)
Default reminder for all-day to-dos:

> None · On day of event (09:00) · 1 day before (09:00) · 2 days before (09:00) · 7 days before (09:00)

…where the **09:00** time is itself adjustable via an **hour + minute slider** (the "All-day alert time"). Changing it updates the time shown in all four options.

### "Create as all-day when no time is entered"
A **switch** (default on). When adding a to-do without entering a time, it is created as an **all-day** item (and uses the all-day alert default above).

---

## 6. Section card backgrounds

Customize the background image (and accent) of each **section / sub-module card** — the folder-style cards seen on the Exercise and Discipline home screens, Program categories, and Note/Bodybuilding folders. Think of each as a *folder that holds objects*.

- Pick a card → choose a background image (or color) + accent.
- Stored per `cardKey` in `card_appearance` (e.g. `exercise.abs`, `discipline.todo`, `program.bulking`, `note.folder.<id>`).
- **Content-specific cards:** some sections need special handling tied to their content. Those rules will be specified per section as we build each module — this screen is the generic shell; per-section behaviour is added when its module lands.

---

## 7. About
App version, link to `CHANGELOG.md`, credits/licenses.

---

## 8. `app_settings` keys (reference)

| Key | Values | Default |
|---|---|---|
| `locale` | system \| en \| th | system |
| `calendar` | ce \| be | ce |
| `theme` | system \| light \| dark | system |
| `textSizeMode` | system \| manual | system |
| `textScale` | 0.85–1.6 | 1.0 |
| `saveToAlbum` | bool | false |
| `imageQuality` | original \| normal \| low | normal |
| `units` | kg \| lb | kg |
| `todo.defaultTimedAlert` | none, atEvent, m5, m10, m15, m30, m45, h1, h2, h3, h6, h12, d1, d2, d3 | atEvent |
| `todo.defaultAllDayAlert` | none, day0, day1, day2, day7 | day0 |
| `todo.allDayAlertTime` | minutes-of-day (0–1439) | 540 (09:00) |
| `todo.createAllDayWhenNoTime` | bool | true |
| `sync.driveEnabled` | bool | false |
| `backup.lastBackupAt` / `sync.lastSyncAt` | epoch millis | — |

Adding a key here is not a schema migration (the table is key-value) — but document new keys in this table.
