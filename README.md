# 🎓 Better CourseWeb

**Better CourseWeb** is a browser extension for [SLIIT CourseWeb](https://courseweb.sliit.lk/) that makes **course filtration** easy and intuitive. It also includes handy side features like auto-login and a distraction-free focus mode.

---

## 🚀 Features at a Glance

### 1. 🔐 Intelligent Auto Login
Say goodbye to repetitive login screens. Better CourseWeb automatically detects when you're logged out and handles the login flow for you.
-   **OAuth Integrated:** Seamlessly clicks the "Continue with Microsoft" button.
-   **Smart Detection:** If you land on the homepage logged out, the extension knows and prompts you immediately.

### 2. 🧭 Global Navigation Menu
Access your courses from *any* page. No more going back to the dashboard just to switch subjects.
-   **Dropdown Menu:** A convenient dropdown injected right into the navbar.
-   **Semester Filtering:** Easily switch between current and past semesters.
-   **Smart Caching:** Courses load instantly without waiting for the API every time.

### 3. 🎯 Focus Mode
Need to study? Turn on Focus Mode to eliminate distractions.
-   **Remove Clutter:** Hides top navigation bars, sidebars, and footer links.
-   **Content Aware:** intelligently keeps vital content (like Student Manuals or Main Dashboard blocks) visible while hiding the noise.
-   **One-Click Toggle:** Enable it from the extension popup instantly.

<img src="assets/popup_ui_annotated.png" alt="Extension Settings UI" width="300" />

### ⚙️ How to Use

1.  **Open the Popup:** Click the extension icon in your toolbar.
2.  **Master Control:** Use the top "Enable Extension" switch to turn the entire extension on/off instantly.
3.  **Focus Mode:** Toggle this to hide distractions like the top navigation bar.
4.  **Auto Login:** Enable this to skip the manual login process.

---

## 🛠️ Installation Guide

1.  **Download the Source:**
    Clone the repository to your local machine:
    ```bash
    git clone https://github.com/Nimsara-Jayarathna/better-courseweb.git
    ```

2.  **Load into Browser (Chrome/Edge/Brave):**
    -   Navigate to `chrome://extensions/`.
    -   Toggle **Developer mode** in the top-right corner.
    -   Click the **Load unpacked** button.
    -   Select the `better-courseweb` folder you just cloned.

3.  **Pin & Configure:**
    -   Pin the extension to your toolbar for easy access.
    -   Open the popup to configure Auto Login and Focus Mode preferences.

---

## 🤝 Contributing

We welcome contributions!
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

## ⚖️ Disclaimer

**Just for Fun!** ✌️
This project was created purely for educational purposes and to explore the capabilities of modern browser extensions. It serves as a personal playground for customization and offers an alternative workflow for students who enjoy tweaking their digital environment.

*This project is not officially affiliated with SLIIT.*
