# 🎓 SLIIT CourseWeb Navbar Extension

A powerful Chrome extension that completely upgrades the navigation experience on [courseweb.sliit.lk](https://courseweb.sliit.lk/). 

It replaces the default, limited "My courses" logic with a **Global Navigation Menu** that fetches *all* your courses (even hidden or past ones) via the Moodle API and organizes them nicely by semester.

---

## 🚀 Why the Change?

Recently, **SLIIT CourseWeb underwent a major UI overhaul**, which changed the underlying structure of the website. This update unfortunately **broke the logic of the previous extension**, which relied on scraping the "My courses" dropdown from the page DOM.

**This major update (v2.0) introduces a complete refactor to fix this:**
1.  **API-First Approach**: Instead of relying on the fragile page structure, we now fetch course data directly from Moodle's API. This makes the extension **immune to future UI changes**.
2.  **Global Accessibility**: The menu is injected into the global top navigation bar, so you can access your courses from *any* page.
3.  **Cleaner UI**: We strip redundant clutter (like semester tags in names) and provide a focused, semester-based view.

---

## ✨ Features

- **📚 Global Semester Menu**: A new "Semester" dropdown in the top navbar.
- **🔍 Smart Filtering**: Automatically groups courses by semester.
- **🧹 Clean Course Names**: Removes clutter like `[2024 JAN - JUN]` from course titles for a readable list.
- **🔄 Auto-Retry**: Robust fetching with auto-retry logic to handle network bumps.
- **⚡ Fast Access**: Caches your course list locally for instant loading.
- **🔗 My Courses Shortcut**: Adds a quick "Go to My Courses" link in the footer of the menu.

---

## 📦 Installation

### Choose Your Version

You can choose between two versions of the extension depending on your preference:

#### Option 1: Enhanced UI & Clean Experience (Recommended)
Offers a more fluid, smooth UI for the menu and a cleaner LMS page interface.
```bash
git clone -b feature/moodle-new-workflow https://github.com/Nimsara-Jayarathna/sliit-course-filter-extension.git
```

#### Option 2: Standard Version
The normal version of the extension.
```bash
git clone https://github.com/Nimsara-Jayarathna/sliit-course-filter-extension.git
```

### Load as Unpacked Extension
1.  Open Chrome and navigate to:
    `chrome://extensions/`
2.  Enable **Developer mode** (top-right corner).
3.  Click **Load unpacked** and select the project folder (the one you just cloned).
4.  Refesh SLIIT CourseWeb to see the changes!

---

## 🏛️ Legacy Version

If you prefer the old behavior (which simply filtered the existing list without API calls), you can access the legacy version here:

[**View Legacy Version (v1.0)**](https://github.com/Nimsara-Jayarathna/sliit-course-filter-extension/commits/v1.0)

To use this version, clone the `v1.0` tag:
```bash
git clone -b v1.0 https://github.com/Nimsara-Jayarathna/sliit-course-filter-extension.git
```

*Note: The legacy version does not support fetching courses not already visible on the page.*
