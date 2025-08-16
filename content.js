(() => {
  'use strict';

  // --- Constants ---
  const STORAGE_KEYS = {
    ENABLED: 'myCoursesFilterEnabled',
    SEMESTER: 'myCoursesFilterSemester',
  };
  const MY_COURSES_LINK_SELECTOR = 'li.dropdown > a[title="My courses"]';
  const SEMESTER_REGEX = /(\d{4}\/\w+)/;

  // --- State ---
  let toggleBtn = null;

  // --- DOM Utilities ---
  const getMyCoursesList = () => document.querySelector(MY_COURSES_LINK_SELECTOR)?.nextElementSibling;
  const getAvailableSemesters = () => {
    const myCoursesList = getMyCoursesList();
    if (!myCoursesList) return [];
    const semesters = new Set();
    myCoursesList.querySelectorAll('li > a[title]').forEach(a => {
      const match = a.title.match(SEMESTER_REGEX);
      if (match && match[1]) semesters.add(match[1]);
    });
    return Array.from(semesters).sort().reverse();
  };

  // --- UI Update Functions ---
  const updateButton = (enabled, semester = null) => {
    if (!toggleBtn) return;
    toggleBtn.dataset.enabled = enabled.toString();
    if (enabled && semester) {
      toggleBtn.classList.add('active');
      toggleBtn.title = `Filter active for ${semester}. Click to clear.`;
    } else {
      toggleBtn.classList.remove('active');
      toggleBtn.title = 'Toggle semester filter for My Courses';
    }
  };

  const filterCourses = (semester) => {
    const myCoursesList = getMyCoursesList();
    if (!myCoursesList) return;
    myCoursesList.querySelectorAll('li > a[title]').forEach(a => {
      const li = a.parentElement;
      const match = a.title.match(SEMESTER_REGEX);
      li.classList.toggle('hidden-course', !(match && match[1] === semester));
    });
  };

  const resetFilter = () => {
    const myCoursesList = getMyCoursesList();
    if (!myCoursesList) return;
    myCoursesList.querySelectorAll('li.hidden-course').forEach(li => {
      li.classList.remove('hidden-course');
    });
  };

  // --- Modal Logic with UX improvements ---
  const createModal = (semesters, onSelect) => {
    const modal = document.createElement('div');
    modal.className = 'myCoursesFilterModal';
    modal.innerHTML = `
      <div class="myCoursesFilterContent">
        <h3 style="margin-bottom: 20px; font-weight: 700; color: #222;">Select Semester</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          ${semesters.map(s => `<button class="semester-btn" data-semester="${s}">${s}</button>`).join('')}
        </div>
        <button id="cancelBtn" title="Cancel filtering">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      modal.classList.remove('visible');
      document.removeEventListener('keydown', handleEsc);
      setTimeout(() => modal.remove(), 300);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(); // Click on background
    });
    modal.querySelector('#cancelBtn').addEventListener('click', closeModal);
    modal.querySelectorAll('.semester-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        onSelect(btn.dataset.semester);
        closeModal();
      });
    });

    document.addEventListener('keydown', handleEsc);
    requestAnimationFrame(() => modal.classList.add('visible'));
  };
  
  // --- Core Logic ---
  const handleToggleClick = async () => {
    const { [STORAGE_KEYS.ENABLED]: isEnabled } = await chrome.storage.sync.get(STORAGE_KEYS.ENABLED);

    if (isEnabled) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: false });
      await chrome.storage.sync.remove(STORAGE_KEYS.SEMESTER);
      resetFilter();
      updateButton(false);
    } else {
      const availableSemesters = getAvailableSemesters();
      if (availableSemesters.length === 0) return;
      createModal(availableSemesters, async (chosenSemester) => {
        await chrome.storage.sync.set({
          [STORAGE_KEYS.ENABLED]: true,
          [STORAGE_KEYS.SEMESTER]: chosenSemester,
        });
        filterCourses(chosenSemester);
        updateButton(true, chosenSemester);
      });
    }
  };

  const initialize = async () => {
    const myCoursesLink = document.querySelector(MY_COURSES_LINK_SELECTOR);
    if (!myCoursesLink || document.getElementById('myCoursesFilterToggleBtn')) {
      return; // Already initialized or element not found
    }

    const availableSemesters = getAvailableSemesters();
    if (availableSemesters.length === 0) {
      console.warn('My Courses filter: No semesters found in course titles.');
      return;
    }

    // Create and inject button
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'myCoursesFilterToggleBtn';
    toggleBtn.className = 'semester-toggle-btn';
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle class="toggle-off" cx="12" cy="12" r="9"/><path class="toggle-on" d="M7 12l4 4 6-8"/></svg>`;
    
    const btnLi = document.createElement('li');
    btnLi.style.cssText = 'display: flex; align-items: center;';
    btnLi.appendChild(toggleBtn);
    myCoursesLink.parentElement.parentElement?.insertBefore(btnLi, myCoursesLink.parentElement.nextSibling);

    // Load initial state from storage
    const stored = await chrome.storage.sync.get([STORAGE_KEYS.ENABLED, STORAGE_KEYS.SEMESTER]);
    const isEnabled = stored[STORAGE_KEYS.ENABLED] === true;
    const semester = stored[STORAGE_KEYS.SEMESTER];

    if (isEnabled && semester && availableSemesters.includes(semester)) {
      filterCourses(semester);
      updateButton(true, semester);
    } else {
      resetFilter();
      updateButton(false);
    }

    toggleBtn.addEventListener('click', handleToggleClick);
    console.log('My Courses filter: Initialization complete.');
  };

  // --- Use MutationObserver to wait for the element to appear ---
  const observer = new MutationObserver((mutations, obs) => {
    const myCoursesLink = document.querySelector(MY_COURSES_LINK_SELECTOR);
    if (myCoursesLink) {
      initialize();
      obs.disconnect(); // Stop observing once we've initialized
    }
  });

  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();