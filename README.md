# CyBird Security: CISSP Study Tool

**CyBird Security** is a modern, interactive web application designed to help cybersecurity professionals prepare for the **ISC2 CISSP**. The tool streamlines the study process by breaking down complex concepts into interactive quizzes and high-frequency flashcards.

[View the Live Tool](https://cissp.cybirdsecurity.com/)

---

## 🚀 Key Features

* **All 8 CISSP Domains:** Dedicated study modules for every exam domain, from Security and Risk Management to Software Development Security.
* **Interactive Quizzes:** 200+ practice questions with real-time feedback to simulate exam-day decision making.
* **Rapid-Fire Flashcards:** 120 curated cards designed to reinforce key terminology and frameworks.
* **Progress Dashboard:** Track your accuracy and maintain your study streak with a visual performance overview.
* **Focus Mode:** A clean, dark-themed interface built to minimize distractions during long study sessions.

## 🛠️ Tech Stack

* **Frontend:** React / Next.js
* **Styling:** Tailwind CSS (for a responsive, mobile-first design)
* **Icons:** Lucide React
* **State Management:** React Hooks (Local Storage for progress persistence)

## 📂 Project Structure

```text
├── src/
│   ├── components/      # UI components (Quiz cards, Navigation, Progress)
│   ├── data/            # Domain-specific question banks and flashcards
│   ├── hooks/           # Custom logic for scoring and streak tracking
│   └── pages/           # Application routing (Home, Quiz, Flashcards)
├── public/              # Optimized assets and brand icons
└── README.md
