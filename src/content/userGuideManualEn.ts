/**
 * English user guide — mirror of `userGuideManual.ts`.
 * Keep section order and scope aligned when the French manual changes.
 */
import type { UserGuideSection } from './userGuideManual';

export const USER_GUIDE_META_EN = {
  title: 'CATRACK Pro — User guide',
  subtitle: 'Step-by-step guide with practical examples',
  versionLabel:
    'June 24, 2026 (stock flightcase QR, content label)',
};

export const USER_GUIDE_SECTIONS_EN: UserGuideSection[] = [
  {
    icon: '📘',
    title: 'Built-in guide and PDF export',
    paragraphs: [
      'This manual is available inside the app (Notice screen) and can be exported as a PDF for training or offline reading.',
      'After an app update, open Notice again to read the version that matches your installation.',
      'The PDF contains the same sections as the in-app guide.',
    ],
  },
  {
    icon: '🎯',
    title: 'What CATRACK Pro is for',
    paragraphs: [
      'CATRACK Pro helps you manage equipment and consumables, track loans, receive alerts (low stock, overdue returns, maintenance, inspections) and, if needed, follow tours on the road.',
      'The app works without Internet: your data is stored on the phone first. Sync then sends your changes to one chosen backend only — either a local PC server (Wi‑Fi or Tailscale) or Supabase (cloud). Both are never used at the same time.',
      'Day-to-day actions (scan, stock, consumables) are on the bottom bar. The home screen groups main activities in large tiles. The Menu tab lists everything else.',
    ],
    examples: [
      'Backstage technician: open Scanner, scan a QR code, record a consumable issue, then check Alerts for loan returns due today.',
    ],
  },
  {
    icon: '🚀',
    title: 'First launch and sign-in',
    paragraphs: [
      'On first install, a short tutorial walks you through language, venue (optional), PC server connection (recommended) and your profile. You can continue without a server — the app works offline on the phone.',
      'Sign-in uses a PIN code on the device (administrator, technician or borrower). If the default PIN 1234 is still active, the app asks you to change it immediately.',
      'Choose Français or English at the start; the whole interface follows your choice. You can change language later in Settings.',
      'Tap Scan pairing QR code to connect to the PC. If the server is unavailable, choose Continue without server — the app stays usable. Full diagnostic: Connection / Network → Diagnostic tab.',
      'You can restart the tutorial from Settings at any time.',
    ],
    examples: [
      'New phone: download the server installer from the wizard, install it on the PC, open StageStock Local, scan the pairing QR, then start inventory work.',
    ],
  },
  {
    icon: '🏠',
    title: 'Home screen and navigation',
    paragraphs: [
      'Large tiles open the main areas: Stock, Consumables, Loans, etc., depending on your role.',
      'The All tile opens the full tab bar (Scanner, Stock, Network…).',
      'The round home button in a workspace returns to the large tiles.',
      'Borrowers see a reduced menu; administrators and technicians have access to management screens.',
    ],
  },
  {
    icon: '📷',
    title: 'Scanner (QR, barcodes, NFC)',
    paragraphs: [
      'The Scanner tab uses the camera for QR codes and barcodes, or NFC if your phone supports it.',
      'Camera: when several codes are visible, aim at the one you want and tap the screen to read it (no automatic scan on the first code detected).',
      'Server pairing QR: Connection / Network → Scan pairing QR code (or Scanner tab) and aim at the QR on the PC /pair page — not the address line under the QR alone. The QR includes URL and API key. If “API key required”: reload /pair on the PC and scan again; after server reinstall, old QR codes are invalid.',
      'Equipment: the code opens the record or creates a minimal one if your organisation allows it.',
      'Stock flightcase: an SS-FC:… QR opens the list of items stored in that case (same flightcase label + same location).',
      'Consumables: stock in or out; burst mode applies the same quantity at each scan.',
    ],
    examples: [
      'Consumable issue: enable Burst, choose Out, scan labels one after another.',
    ],
  },
  {
    icon: '📦',
    title: 'Equipment stock',
    paragraphs: [
      'Filterable list by status and text search (equipment and consumables from the search bar). Tap a search result to open and edit its record. Long-press a row or 🗑️: selection mode (check rows, select all, bulk delete or export PDF).',
      'When creating a record, the Quantity field replaces the old type field. Quantity 1 = single item with its own QR. Quantity > 1 = lot (one QR, stock adjusted like a consumable, ± Adjust button and Scanner).',
      'When adding or editing a record: pick an existing category or create one (optional parent for a subcategory, e.g. Lighting › LED). Below location (store, stage…), you can add a flightcase label (e.g. FC-Lighting 3) when several items are stored together.',
      'Each flightcase (same label in the same location) has a dedicated QR in the form SS-FC:fc_…, separate from each item’s QR. Scanning the flightcase QR opens the contents list; scanning an item’s QR always opens that item’s record.',
      'Print QR labels (Stock, Consumables, bulk print): each label shows the QR code, item name and reference; text size adapts so nothing is clipped.',
      'The detail view shows only filled fields.',
    ],
  },
  {
    icon: '🛒',
    title: 'Consumables',
    paragraphs: [
      'List with low-stock filter and search bar (name, reference, category, QR…). Tap a search result to open the edit form. When adding a record: subcategories and locations can be created inline (same as Stock). Movements from the record, Scanner or spreadsheet import.',
      'On each tile, the “± Adjust” button offers Stock in or Stock out, then a numeric keypad to enter the exact quantity.',
    ],
  },
  {
    icon: '🧾',
    title: 'Loans and requests',
    paragraphs: [
      'Typical path: pending → active → returned. Loan sheet with signature and PDF export.',
    ],
  },
  {
    icon: '🎪',
    title: 'Tours (tracking)',
    paragraphs: [
      'Create a tour, add locations, assign gear by list or scan. Track each line with a status.',
      'Gear on a tour can only change status from the Tour screen.',
      'When the tour ends (status completed or active), open “Tour return scan”: scan QR codes to put gear back in stock, or search manually for items without labels. The app lists missing items vs the initial load-out.',
    ],
  },
  {
    icon: '🛎️',
    title: 'Alerts and inspections (VGP)',
    paragraphs: [
      'Alerts: low stock, overdue loans, maintenance and inspection due dates. Notifications configurable in Settings.',
    ],
  },
  {
    icon: '📤',
    title: 'Import / export',
    paragraphs: [
      'CSV import and export for bulk updates. Equipment CSV import: categorie_nom and localisation_nom (or a label in categorie_id / localisation_id) create missing categories and locations; category paths like Parent › Child are supported. Manual sync from Network.',
    ],
  },
  {
    icon: '🎭',
    title: 'Run sheet and technical plot',
    paragraphs: [
      'Two backstage tools: the run sheet (timed cues for live show) and the technical plot (steps, on-stage positions, setup photos).',
      'Text, cues, steps and positions sync to the PC server or Supabase like inventory (Push ↑ / Pull ↓ in Network).',
      'Deletions (run sheet, cue, step, object…) propagate to the server then to other devices on the next sync.',
      'Technical plot photos upload to the server on Push ↑, then download automatically on other phones on Pull ↓.',
      'Enable “Sync after each action” in Settings to push automatically after a change.',
    ],
    examples: [
      'Stage manager on tablet + lighting chief on phone: same run sheet after Pull ↓ on both; live mode ticks cues and the state propagates on the next sync.',
    ],
  },
  {
    icon: '🌐',
    title: 'Network, connection and sync',
    paragraphs: [
      'Open the Network tab. At the top, choose how to sync:',
      '• Local PC server (Wi‑Fi or Tailscale) — inventory, loans, run sheets, technical plots and Accueil Pro go through the PC.',
      '• Supabase cloud (Internet) — inventory, loans, run sheets, technical plots and Accueil Pro go through the cloud, with no PC server.',
      'Only the cards for the chosen mode are shown below.',
      'In local mode: install the server, pair with the QR, then Push ↑ and Pull ↓.',
      'In Supabase mode: export SQL, set URL + anon key. Switch Connection → “Supabase cloud”: the invitation QR appears at the top of the tab (green 📲 card). Share by email or scan; scanning switches the phone to cloud mode automatically.',
      'Several phones on cloud: the device that changed a quantity runs Push ↑, others run Pull ↓. Everyone must see “Inventory sync (Supabase)” (not “with PC”).',
      'The same Push ↑ / Pull ↓ also syncs venue identity (theatre name, address, logo, admin contact in Profile) and Accueil Pro data (venues, events…).',

      'In local mode: Connection tile → “Local PC server” (pairing QR or PC address). Only one mode active at a time; all devices must match.',
      'All team phones must use the same mode.',
    ],
    examples: [
      'At the venue on Wi‑Fi: pair once, then sync from Network.',
    ],
  },
  {
    icon: '🛰️',
    title: 'Remote access with Tailscale',
    paragraphs: [
      'Tailscale links the PC and phones like a private network, even on mobile data. Free account at tailscale.com.',
      'On the PC: install Tailscale, note the 100.x.x.x address, set PAIRING_PUBLIC_BASE in the server .env.',
      'On the phone: install Tailscale, stay connected (ON), pair with the QR or Tailscale address.',
    ],
  },
  {
    icon: '⚙️',
    title: 'Settings',
    paragraphs: [
      'Language, notifications, user accounts, dynamic profiles, sync options.',
      'Restart the setup tutorial from Settings if needed.',
    ],
  },
  {
    icon: '🎭',
    title: 'Accueil Pro (venue hire)',
    paragraphs: [
      'Module for front-of-house and room hire. Accueil Pro banner on the home screen.',
      'Venues, events, agreements, association portal. Hire requests are not handled in the app — create events directly. Separate sync: Network → Accueil Pro card.',
      'Agreements: Agreements tab — each row shows the linked event (name and date). “+ New” requires picking an event. Delete via “Delete” on the row or at the bottom of the edit screen. You can also add agreements from the event detail (Agreements section).',
      'Venues: Accueil Pro → Venues. Each venue appears as a bubble; select it to show its spaces (rooms) as bubbles. Select a space to view or edit it, or “+ New space” to create one. Delete: “Delete venue” or “Delete space” on the bubble card, button at the bottom of the edit screen, or trash icon in “Manage spaces”. Venue plan: when creating or editing, use “Venue plan” to import a PDF or DWG; view it from the venue record (Regulations tab) or while editing. PDF opens in-app; DWG via Share (AutoCAD, etc.). After saving, use “Rental agreement” to attach a PDF template or text (also under the venue Regulations tab).',
      'Organizations: Accueil Pro → Organizations. Saved list with edit (details, contacts, documents). “Create event” under each row or on the organization record — organization is pre-selected in the event form.',
      'Inspections: Accueil Pro → Inspections → “By event” tab. Select an event; for each space, check-in and check-out buttons (checklist + photos). History tab for past records. Issues report: PDF (print/share) or email summary (failed checks, comments, missing inspections).',
      'Open event: Overview, Team and Agenda tabs. Team — “Manage team”: pick from directory or create a record. “SMS whole team” (Team tab or Manage team screen): write a message (e.g. meal break); Messages opens with all listed mobiles — you confirm sending on the phone. Contacts — venue, organization and external contacts. Agenda — time slots (who, what, where); trash icon to delete a slot.',
      'Day plan: Accueil Pro → Day plan (home shortcut). Each row has a trash icon on the right to delete (with confirmation). Tap the row to edit; “+” at top to add a slot.',
      'Run sheet: Accueil Pro → Run sheet. One sheet per event (title = name + dates), list sorted chronologically. Tap a row for the synthesis (organization, venue, spaces, times, equipment per space, team, agenda, agreements, inspections, regisseur notes) and PDF export. “Open run sheet” on the event record (Overview tab). Information sheet: from the event or run sheet, enter equipment needed per room (e.g. “Room A: 80 chairs, 2 wireless mics”) — text appears on the run sheet and PDF. Day schedule remains under Day plan.',
      'Organization portal: Accueil Pro → Association portal. Lists organizations with at least one created event; events appear under each name. Tap an event to add PDF, audio or video files (programme, rider, sound tracks…). For association users (client portal), the profile form and general organization documents remain at the bottom.',
      'My day (staff): section on Accueil Pro home with readiness score per today’s event; tap → event record. Today banner → filtered list. Events: Today / Week / All filters; statuses Option, Confirmed, Cancelled, Completed (cancelled excluded from day counts). Each event has a fixed color (Planning calendar bubbles, list side stripe) for quick identification. Event record → “Ready to host” checklist (agreement, files, inspections, team + briefing and access toggles). “Compare check-in / check-out” link per space. Run sheet PDF includes readiness score.',
      'Portal invitations (staff, Supabase mode): Organization record → Invite to cloud portal.',
    ],
  },
  {
    icon: '💾',
    title: 'Backup and good habits',
    paragraphs: [
      'Sync regularly or export before changing phones.',
      'Prefer stable Wi‑Fi for large imports.',
    ],
  },
];
