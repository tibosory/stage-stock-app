/**
 * English user guide — mirror of `userGuideManual.ts`.
 * Keep section order and scope aligned when the French manual changes.
 */
import type { UserGuideSection } from './userGuideManual';

export const USER_GUIDE_META_EN = {
  title: 'CATRACK Pro — User guide',
  subtitle: 'Step-by-step guide with practical examples',
  versionLabel:
    'May 21, 2026 (v1.0.66: my day, statuses, checklist, EDL compare)',
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
      'Server pairing QR: during setup, tap Scan pairing QR code, or use the Scanner tab to scan the PC /pair page code. The app saves the address and API key automatically. Do not create an equipment record for this code. Fallback: manual entry in Network.',
      'Equipment: the code opens the record or creates a minimal one if your organisation allows it.',
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
      'Filterable list by status and text search. Long-press to select several records and export a PDF.',
      'Print labels and A4 sheets from the printing area.',
      'The detail view shows only filled fields.',
    ],
  },
  {
    icon: '🛒',
    title: 'Consumables',
    paragraphs: [
      'List with low-stock filter. Movements from the record, Scanner or spreadsheet import.',
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
      'CSV import and export for bulk updates. Manual sync from Network.',
    ],
  },
  {
    icon: '🌐',
    title: 'Network, connection and sync',
    paragraphs: [
      'Open the Network tab. At the top, choose how to sync:',
      '• Local PC server (Wi‑Fi or Tailscale) — inventory, loans and Accueil Pro go through the PC.',
      '• Supabase cloud (Internet) — inventory, loans and Accueil Pro go through the cloud, with no PC server.',
      'Only the cards for the chosen mode are shown below.',
      'In local mode: install the server, pair with the QR, then Push ↑ and Pull ↓.',
      'In Supabase mode: configure the project, sign in, then Push ↑ and Pull ↓.',
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
      'Venues: Accueil Pro → Venues. After saving a venue, use “Rental agreement” to attach a PDF template or text (also under the venue Regulations tab).',
      'Organizations: Accueil Pro → Organizations. Saved list with edit (details, contacts, documents). “Create event” under each row or on the organization record — organization is pre-selected in the event form.',
      'Inspections: Accueil Pro → Inspections → “By event” tab. Select an event; for each space, check-in and check-out buttons (checklist + photos). History tab for past records. Issues report: PDF (print/share) or email summary (failed checks, comments, missing inspections).',
      'Open event: Overview, Team and Agenda tabs. Team — create a staff record (name, phone, email, address): it joins the general directory and the event team; or pick someone already in the directory. Contacts — venue team (Team menu), organization and external contacts; permanent members highlighted at the top (A–Z), then others (A–Z). View or edit a record, “Add to event” from the record. Agenda — detailed time slots (who, what, where) like a day schedule; import event times with one tap.',
      'Run sheet: Accueil Pro → Run sheet. Pick the date with arrows or the date field. Global day schedule at the top; then one block per event (organization, venue, spaces, times, description, day-of team with roles and contact details, agenda, agreements, inspections). Venues & safety section and regisseur notes at the bottom. Export PDF to print or share.',
      'Organization portal: Accueil Pro → Association portal. Lists organizations with at least one created event; events appear under each name. Tap an event to add PDF, audio or video files (programme, rider, sound tracks…). For association users (client portal), the profile form and general organization documents remain at the bottom.',
      'My day (staff): section on Accueil Pro home with readiness score per today’s event; tap → event record. Today banner → filtered list. Events: Today / Week / All filters; statuses Option, Confirmed, Cancelled, Completed (cancelled excluded from day counts). Event record → “Ready to host” checklist (agreement, files, inspections, team + briefing and access toggles). “Compare check-in / check-out” link per space. Run sheet PDF includes readiness score.',
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
