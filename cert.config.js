/**
 * cert.config.js — The only file you need to change when copying this repo
 * for a new certification. All app strings, storage keys, and cross-cert
 * links are driven from this single config object.
 */

const CERT_CONFIG = {
  // Short identifier — used in the localStorage key and as a CSS class hook
  id: 'cissp',

  // Display name shown in nav, hero title, and page title
  name: 'CISSP',

  // localStorage key — must be unique per cert repo to avoid data collisions
  storageKey: 'cissp_progress',

  // Hero section copy
  eyebrow: 'CISSP Exam Preparation',
  heroSub: 'Flashcards, practice quizzes, real-time feedback, and progress tracking — everything you need to pass the CISSP exam.',

  // Domain section label (home page)
  domainLabel: 'CISSP Domains',

  // Flashcards page subtitle
  flashcardSubtitle: 'Study key terms and concepts across all CISSP domains',

  // Progress page subtitle
  progressSubtitle: 'Track your CISSP exam preparation',

  // Other CyBird certification sites — shown in the nav "Other Certs" dropdown.
  // Remove an entry (or leave the array empty) to hide it until that cert launches.
  otherCerts: [
    // { name: 'Security+', url: 'https://securityplus.cybirdsecurity.com' },
    // { name: 'CASP+',     url: 'https://casp.cybirdsecurity.com' },
  ]
};
