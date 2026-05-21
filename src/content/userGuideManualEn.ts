/**
 * English user guide — mirror of `userGuideManual.ts` for non-FR locales.
 * Keep section order and scope aligned when the French manual changes.
 */
import type { UserGuideSection } from './userGuideManual';

export const USER_GUIDE_META_EN = {
  title: 'CATRACK Pro — User guide',
  subtitle: 'Full guide with examples',
  versionLabel:
    'May 21, 2026 (v1.0.45: Network — local/Tailscale vs Supabase submenu, filtered panels)',
};

export const USER_GUIDE_SECTIONS_EN: UserGuideSection[] = [
  {
    icon: '📘',
    title: 'In-app guide and PDF export',
    paragraphs: [
      'This manual is shown in the app (Guide screen) and can be exported to PDF for offline training or archives.',
      'The app uses a modern neutral typeface (Roboto) on screen; PDFs use a standard document font for admin sharing.',
      'The app icon and splash animation are tuned for a sharper, smoother launch.',
      'The PDF mirrors the same sections; after an app update, reopen the guide to match your build.',
    ],
  },
  {
    icon: '🎯',
    title: 'What the app is for',
    paragraphs: [
      'CATRACK Pro inventories gear and consumables, manages loans and alerts (low stock, overdue loans, maintenance, inspections) and optionally tour tracking.',
      'It is offline-first: local SQLite is your working copy; sync (CATRACK Pro server and/or Supabase, depending on setup) keeps devices aligned.',
      'Startup is optimized: the UI appears faster and non-critical work (notifications, cloud init) is deferred.',
      'Frequent actions (scan, stock, supplies) sit on the bottom bar; large home tiles group “jobs”; the Menu tab lists the rest.',
    ],
    examples: [
      'Technician: open Scanner to read a QR, record a consumable issue, then check Alerts for today’s loan returns.',
    ],
  },
  {
    icon: '🚀',
    title: 'First launch and accounts',
    paragraphs: [
      'After sign-in (device PIN or cloud account, per deployment), onboarding runs on fresh installs to pick language, site, server and profile; each step is skippable.',
      'Language choice (Français or English) applies immediately across supported UI and exports.',
      'Connection/Network and PC server installer flows also follow the selected language (messages, buttons, alerts, guide).',
      'The “Automatic connection (recommended)” button provides a plug-and-play setup: LAN detection, local URL switch, then connection validation.',
      'The “Guided diagnostics” button then checks server reachability and API sync route health, with a clear corrective message.',
      'Roles (admin, technician, borrower) restrict some actions: creating records, approving loan requests, notification tests, etc.',
      'You can restart onboarding from Settings if needed.',
    ],
    examples: [
      'New phone: finish onboarding with the server URL, test connection under Network, then wait for the first sync before mass inventory.',
    ],
  },
  {
    icon: '🏠',
    title: 'Home tiles and navigation',
    paragraphs: [
      'Home groups Stock, Supplies, Loan, Checks (VGP), Settings, Alerts, Import/Export, Printing based on your role.',
      'Home buttons use rounded colored outlines to separate activity areas.',
      'On Android, extra bottom padding avoids overlap with system navigation.',
      '“All” opens the full tab bar (Scanner, Stock, etc.).',
      'The round “home” control in workspaces returns to the large tiles.',
      '“Tour” (non-borrower) creates tours and assigns gear (list, QR, NFC).',
      'From a stock record, a button opens the dynamic profile editor to adjust field templates.',
    ],
  },
  {
    icon: '📷',
    title: 'Scanner (QR, barcode, NFC)',
    paragraphs: [
      'The Scanner tab uses the camera for QR/barcodes, or NFC if the device supports it.',
      'For gear: the code opens the card or creates a minimal record if allowed.',
      'For consumables: stock in/out, burst mode with fixed quantity or keypad per scan, per settings.',
      'Batch mode chains several gear records for a quick list.',
      'A short vibration confirms reads; Settings → Comfort (scanner) can add haptics when the code matches a known record.',
    ],
    examples: [
      'Consumable out: enable Burst, type Out, scan labels; quantity applies each time or keypad prompts depending on option.',
    ],
  },
  {
    icon: '📦',
    title: 'Gear stock',
    paragraphs: [
      'Filterable list by status, text search, progressive pagination for fluid UI.',
      'When gear is assigned to a tour its status becomes “on tour”; the stock list may show the active tour name.',
      'The list keeps ~40%+ of visible height dedicated to scrolling rows.',
      'Long-press for multi-select PDF export (photo, fields, QR).',
      'Labels: custom formats, bulk QR prints, shelf labels.',
      'Detail preview hides empty dynamic fields.',
      'Detail: photo, PDF/image manuals, NFC, QR defaults to id if blank, dynamic fields per profile.',
    ],
    examples: [
      'Two projectors same name: differentiate by serial, QR or category; the “cards in stock under this label” banner helps count.',
    ],
  },
  {
    icon: '🛒',
    title: 'Consumables',
    paragraphs: [
      'List with under-threshold filter, search, edit per permissions.',
      'Movements: from card, Scanner, or spreadsheet import per procedure.',
    ],
  },
  {
    icon: '🧾',
    title: 'Loans and requests',
    paragraphs: [
      'Typical flow: pending → active → returned (or cancelled). Borrowers may report returns.',
      'Loan sheet with on-device signature, PDF export.',
      'Administrators see pending approvals depending on configuration.',
    ],
  },
  {
    icon: '🎪',
    title: 'Tours (tracking mode)',
    paragraphs: [
      'Access via home / Menu, Settings shortcuts (tour list, tracking, journal).',
      'Create: name + start date picker. Cards let you change org state (planned, active, finished) and delete a tour directly from the list (with confirmation) without opening detail. A long-press also opens quick actions (details / state / delete).',
      'Detail in three blocks: locations, add gear (pick lists + qty, or QR/NFC with confirm), tracked lines with status chips and actions (move site, in use, return, reports).',
      'Each tour can now include useful files (AutoCAD plans, technical PDFs, setup sheets, etc.) imported directly from the phone.',
      'Imported tour documents can be previewed (image/PDF), renamed, and deleted directly in the app.',
      'When a tour is deleted, all linked documents are deleted too (database + local files) to avoid leftovers.',
      'When a gear item is on tour, its status is locked outside the Tour screen; status updates must be made from the tour flow.',
      'The "on tour" status also shows the active tour name to prevent confusion across multiple tours.',
      'When flightcases exist, picking uses numbered case-shaped buttons for field use.',
      'Gear can be added outside a flightcase (“no flightcase”).',
      'Each non-flightcase line can attach packing/load photo (camera or gallery).',
      'Flightcase buttons show total weight (kg) from assigned gear.',
      'Long-press a flightcase: quick print manifest or QR for the case.',
      'Flightcase QR opens its contents with per-line weights and total.',
      'Flightcase PDF export includes weight columns and totals.',
      'Burst scan assigns a series into a case: set count, scan continuously, Undo last assign if needed.',
      '“In stock” = 1 unit; assigned qty cannot exceed availability. Activity journal can open filtered to this tour.',
    ],
    examples: [
      '“Summer festival” tour: add sites Warehouse / Stage A, set active, assign flightcases as you NFC-scan cases.',
    ],
  },
  {
    icon: '📍',
    title: 'Tour tracking (global view)',
    paragraphs: [
      'Dedicated screen: table of gear currently on a tour, filter by assignment status.',
      'Status labels follow the app language; pull to refresh.',
    ],
  },
  {
    icon: '📋',
    title: 'Activity journal (tours)',
    paragraphs: [
      'Chronological events (assign, move, return, check, report) with gear, tour and site when recorded.',
      'Filters by tour and gear; pull to refresh; opening from a tour may pre-fill the tour filter.',
    ],
  },
  {
    icon: '🛎️',
    title: 'Alerts and inspections (VGP)',
    paragraphs: [
      'Alerts cover low consumables, overdue loans, maintenance and inspection due dates.',
      'The VGP tab lists periodic control gear with due dates and visit entry.',
      'On a VGP card you can attach the latest PDF report, open, replace or remove it.',
      'Local notifications: loan/VGP/threshold reminders; push/email tests per profile.',
    ],
  },
  {
    icon: '📜',
    title: 'Movement history',
    paragraphs: [
      'Stock history shows past movements (gear and consumables) with filters for audits.',
    ],
  },
  {
    icon: '📤',
    title: 'Import / export',
    paragraphs: [
      'CSV import/export (gear, consumables, loans depending on screens) for bulk updates.',
      'Loan calendar export (.ics) for Outlook or Google Calendar.',
      'API sync can be triggered from its screen; optional “sync after each action” trades traffic for freshness.',
    ],
    examples: [
      'Excel re-use: align columns, export a template if available, pilot import on one device before rollout.',
    ],
  },
  {
    icon: '🌐',
    title: 'Network, connection and sync',
    paragraphs: [
      'Local Wi-Fi HTTPS or tunnel: URL entry, ping and snapshot sync tests.',
      'Officially supported server installs without IT help: Windows 10/11 via the One-Click installer, or Docker (Linux/macOS/Windows WSL2). Other targets (NAS, ARM, Linux without Docker) need support assistance — do not promise plug-and-play deployment for those.',
      'LAN discovery may be enabled. If Supabase is configured on the device, cloud inventory sync (push/pull) runs whenever Internet is available; when the CATRACK Pro server (PC) is reachable on the LAN, a second API sync updates the PC as well (no extra switch). Without Supabase, only CATRACK Pro API sync applies; photo/manual uploads to Storage remain optional.',
      'If configured, a daily background task tries auto push/pull.',
      'Server install assistant may fetch the Windows `.exe` from configured release; filenames vary by version.',
      'Pairing QR: open `/pair` on the server, scan, confirm opening in-app; URL is saved.',
      'Recent Windows installs default backend port 8091 for simpler mobile URLs; 8095 is still common on older setups.',
      'Pairing probes a Stage-Stock-style `/health` response and, if `PAIRING_PUBLIC_BASE` lists the LAN IP with a stale `.env` port while Node bound another free port, the server overwrites the port for the QR and on-page URL with the real listen port.',
      'On Windows, the « Server dashboard » and « Phone pairing (QR) » desktop shortcuts launch a small script that checks `/health` for JSON `status: ok` starting from `.env`, then scans a usual port range, so generic HTTP servers on wrong ports cannot win.',
      'On foreground, the app tries Supabase first (if configured + online), then the PC inventory API if reachable (silent on failure).',
      'Windows adds a real desktop shortcut (.lnk) for uninstall (launcher CMD, not a browser URL). Expect a UAC prompt so the scheduled task and firewall rules can be removed. The console pauses when finished so you can read the summary (or inspect errors).',
    ],
  },
  {
    icon: '🧭',
    title: 'Network diagram (PC, router, phone)',
    paragraphs: [
      'Reference wiring for LAN use:\n\n[Optional Internet]\n        │\n        ▼\n  [Wi-Fi Router]\n      │             │\n LAN/Wi‑Fi       Wi‑Fi\n      ▼             ▼\n[Windows PC]   [Phone Android/iOS]\nLocal server   CATRACK Pro app\n(active PORT   same LAN\n8091 / 8095 / 3847\nor 8090-8110)\n\nMain flow:\n1) The phone syncs to Supabase first when the project is configured.\n2) When the PC is on the LAN and the API URL responds, the phone also pushes/pulls the CATRACK Pro server (inventory snapshot, loans, etc.).\n3) Photos and PDF manuals may use Supabase Storage depending on setup.',
      'Minimum: PC and phone on same LAN, Windows firewall allows backend port, correct API URL (or pairing QR).',
      'If it fails: check PC IP, real port, `/pair` reachable from phone, rerun connection test.',
    ],
    examples: ['Example: PC 192.168.1.77, port 8091 → http://192.168.1.77:8091'],
  },
  {
    icon: '⚙️',
    title: 'Settings',
    paragraphs: [
      'Categories, locations, users, notification prefs, sync diagnostics (admin), updates, cloud options.',
      'Language can be changed anytime without reinstall.',
      'Tour technical statuses and stock/loan badges follow the selected language.',
      'Scanner, Network, tour detail confirmations, onboarding, Consumables, Loans, Alerts (including purchase email prep) follow the language where implemented.',
      'Dynamic profiles: industry presets (wardrobe, props, lighting, audio, video, structure) import in one tap.',
      'If no dynamic profile is selected, classic validation still applies.',
      'Comfort (scanner): optional haptics on successful match.',
      'Tour mode shortcuts: tour list, global tracking, activity journal.',
      'In Supabase project settings (user profile), a button downloads/shares a `.sql` file to paste into Supabase (left nav → SQL Editor). In the repo, `StageStock/supabase/patch_mobile_sync_tables_timestamps.sql` is the short ALTER/UPDATE-only script for legacy projects missing `updated_at`. Only someone logged into your Supabase project can run it—no automation can execute it for you remotely.',
    ],
  },
  {
    icon: '🧩',
    title: 'Dynamic profiles — filling fields well',
    paragraphs: [
      'Profiles standardize entry across cards: keep stable technical IDs and readable labels.',
      'Text: short useful notes. Number: value only if unit is in the label already. Select: short consistent options, no duplicates. Boolean: yes/no. Date: calendar picker for checks and deadlines.',
      'Team habit: mandatory fields first, then safety/maintenance, then free notes.',
    ],
    examples: [
      'Lighting: Power (W)=300 ; DMX mode=16ch ; IP rating=IP65.',
      'Wardrobe: Size=M ; Costume state=Good ; Last care=2026-04-10.',
    ],
  },
  {
    icon: '👤',
    title: 'User profile',
    paragraphs: ['User tab: session info, local cloud sign-out, etc.'],
  },
  {
    icon: '🧠',
    title: 'Assistant (AI)',
    paragraphs: [
      'In local app mode Send stays enabled whenever text is present; SaaS mode follows flag saas.ai.',
      'Home search routes to Assistant when network is OK, else Quick local search.',
      'Recommended PC model: llama3.2:1b (~1.3 GB, replies in 1–3 s even on modest hardware). Install once with: ollama pull llama3.2:1b. Switch to llama3.2:3b or mistral via OLLAMA_MODEL in the server .env if you prefer accuracy over latency.',
      'If the PC model is slow, the server may try another faster downloaded Ollama model when available; otherwise you get a clear error after roughly two minutes (app-side cap). On very weak PCs, raise OLLAMA_TIMEOUT_MS in the server .env and open GET /diagnostic on that PC.',
    ],
  },
  {
    icon: '🖨️',
    title: 'Printing',
    paragraphs: [
      'Label formats, HTML preview, bulk QR PDFs, shelf labels, A4 gear sheets.',
      'Tour mode with flightcases: PDF manifest per case and bulk flightcase QR sheets.',
    ],
  },
  {
    icon: '🔍',
    title: 'Quick search',
    paragraphs: ['Local instant results; optional AI enrichment in background without blocking.'],
  },
  {
    icon: '🏛️',
    title: 'AccueilPro — client portal (in progress)',
    paragraphs: [
      'A second module “AccueilPro” (venues, events, conventions) is planned. Partner associations and companies get a limited account: they can create and edit their organisation profile, referent contacts (roles and coordinates), and upload documents (insurance, programme, rider, etc.).',
      'Planning, event details, conventions, inspections, technical venue data, and in-house venue staff stay read-only for those accounts; changes go through the venue team.',
      'Access is enforced on the server (Supabase RLS). Venue staff use roles such as admin, régisseur, technicien, accueil. Portal organisations use role client; role organisateur has the same restricted read/write scope (events and conventions linked to the organisation, not venue staff records).',
      'Invitation flow: venue staff (Supabase backend) open an **Organization** record → **Invite to cloud portal**. The app generates a 7-day code and can open a pre-filled email. On the invitee side: **Sign-in** → invitation section → Supabase account (same email) → **Finalize** to link the account. Imported documents may use the private Storage bucket client-documents (folder = organisation id), depending on project setup.',
    ],
  },
  {
    icon: '💾',
    title: 'Backup and good habits',
    paragraphs: [
      'Data lives on device: plan regular sync or export before phone changes.',
      'Performance: avoid unnecessary per-action sync, filter long lists, prefer stable Wi-Fi for big imports.',
    ],
    examples: [
      'After unstable 4G day: on office Wi-Fi run manual sync from Network / Import-Export before leaving.',
    ],
  },
];
