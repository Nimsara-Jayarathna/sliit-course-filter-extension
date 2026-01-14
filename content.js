(() => {
  'use strict';

  // --- Constants ---
  const STORAGE_KEYS = {
    COURSES_CACHE: 'myCoursesCache',
    LAST_FETCH: 'myCoursesLastFetch',
    SELECTED_SEMESTER: 'myCoursesSelectedSemester' // Remember user's choice
  };

  const CACHE_DURATION = 1000 * 60 * 15; // 15 minutes cache
  const MAX_RETRIES = 5;

  // New Moodle Navbar Selectors (Moodle 4.x / Boost Theme)
  const SELECTORS = {
    NAVBAR_CONTAINER: 'nav .primary-navigation .more-nav, nav .primary-navigation, .navbar-nav', // Try multiple to be safe
    NAVBAR_ITEM_CLASS: 'nav-item',
    NAVBAR_LINK_CLASS: 'nav-link',
    // Parsing selectors for the fetched page
    COURSE_ITEM: '.course-listitem, .course-card',
    COURSE_NAME: '.coursename, .aalink',
    COURSE_CATEGORY: '.categoryname, .text-muted'
  };

  // --- Helpers ---
  const createElement = (tag, classes = [], html = '') => {
    const el = document.createElement(tag);
    if (classes.length) el.classList.add(...classes);
    if (html) el.innerHTML = html;
    return el;
  };

  // --- Data Fetching & Parsing ---
  const fetchAndParseCourses = async () => {
    try {
      const response = await fetch('/my/courses.php?view=list'); // Force list view for easier parsing
      if (!response.ok) throw new Error('Network response was not ok');
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const courses = [];
      const items = doc.querySelectorAll(SELECTORS.COURSE_ITEM);

      items.forEach(item => {
        const nameEl = item.querySelector(SELECTORS.COURSE_NAME);
        const catEl = item.querySelector(SELECTORS.COURSE_CATEGORY);

        if (nameEl) {
          const title = nameEl.innerText.trim();
          const href = nameEl.getAttribute('href');
          // Try to find category: Explicit element OR regex from title
          let category = 'Uncategorized';
          if (catEl) {
            category = catEl.innerText.trim();
          } else {
            const match = title.match(/\[(.*?)]/); // Fallback: try looking for [2024/JUL] in title
            if (match) category = match[1];
          }

          courses.push({ title, href, category });
        }
      });

      // Save to storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.COURSES_CACHE]: courses,
        [STORAGE_KEYS.LAST_FETCH]: Date.now()
      });

      return courses;
    } catch (err) {
      console.error('SLIIT Filter: Failed to fetch courses', err);
      return [];
    }
  };

  const getCourses = async (forceRefresh = false) => {
    const data = await chrome.storage.local.get([STORAGE_KEYS.COURSES_CACHE, STORAGE_KEYS.LAST_FETCH]);
    const cache = data[STORAGE_KEYS.COURSES_CACHE];
    const lastFetch = data[STORAGE_KEYS.LAST_FETCH];

    if (!forceRefresh && cache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
      return cache;
    }
    return await fetchAndParseCourses();
  };

  // --- UI Components ---
  const createCourseList = (courses, targetCategory) => {
    const list = createElement('div', ['scf-course-list']);

    // Filter
    const filtered = courses.filter(c => c.category.includes(targetCategory) || targetCategory === 'All');

    if (filtered.length === 0) {
      list.innerHTML = `<div class="scf-empty">No courses found for ${targetCategory}</div>`;
      return list;
    }

    filtered.forEach(c => {
      const item = createElement('a', ['scf-course-link'], c.title);
      item.href = c.href;
      list.appendChild(item);
    });

    return list;
  };

  const createDropdown = (courses, selectedSemester, onSemesterChange, onRescan) => {
    const dropdown = createElement('div', ['scf-dropdown']);

    // Header: Semester Selector
    const header = createElement('div', ['scf-dropdown-header']);
    const semesters = [...new Set(courses.map(c => c.category))].sort().reverse();

    // "All" option? Maybe better to just show semesters.

    const select = createElement('select', ['scf-semester-select']);
    semesters.forEach(s => {
      const opt = createElement('option', [], s);
      opt.value = s;
      opt.selected = s === selectedSemester;
      select.appendChild(opt);
    });

    // Add event listener for change
    select.addEventListener('change', (e) => {
      onSemesterChange(e.target.value);
    });
    // Stop click propagation on select to prevent dropdown closing
    select.addEventListener('click', (e) => e.stopPropagation());

    header.appendChild(createElement('span', ['scf-label'], 'Semester: '));
    header.appendChild(select);
    dropdown.appendChild(header);

    // Body: Course List container
    const body = createElement('div', ['scf-dropdown-body']);
    body.appendChild(createCourseList(courses, selectedSemester || semesters[0]));
    dropdown.appendChild(body);

    // Footer: Refresh
    const footer = createElement('div', ['scf-dropdown-footer']);
    const refreshBtn = createElement('button', ['scf-refresh-btn'], '↻ Rescan Courses');
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRescan();
    });
    footer.appendChild(refreshBtn);
    dropdown.appendChild(footer);

    return {
      dom: dropdown, updateBody: (newSem) => {
        body.innerHTML = '';
        body.appendChild(createCourseList(courses, newSem));
      }
    };
  };

  const injectNavbarItem = async () => {
    // Avoid duplicates
    if (document.getElementById('scf-navbar-item')) return;

    // Find navbar
    const navContainer = document.querySelector(SELECTORS.NAVBAR_CONTAINER);
    if (!navContainer) return; // Not loaded yet

    // Get Data
    let courses = await getCourses();
    let storedSem = await chrome.storage.local.get(STORAGE_KEYS.SELECTED_SEMESTER);
    let currentSem = storedSem[STORAGE_KEYS.SELECTED_SEMESTER] || (courses.length ? courses[0].category : '');

    // Create Nav Item
    const navItem = createElement('li', [SELECTORS.NAVBAR_ITEM_CLASS, 'scf-nav-item']);
    navItem.id = 'scf-navbar-item';

    // Trigger Link
    const navLink = createElement('a', [SELECTORS.NAVBAR_LINK_CLASS, 'scf-nav-link'], 'Semester');
    navLink.href = '#';
    navLink.setAttribute('role', 'button');

    // Icon (optional)
    navLink.innerHTML = `<span class="scf-icon">📚</span> Semester`;

    // Dropdown Container
    const dropdownWrapper = createElement('div', ['scf-dropdown-wrapper']);

    // Functions to handle state
    const handleSemesterChange = (newSem) => {
      currentSem = newSem;
      chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_SEMESTER]: newSem });
      dropdownInstance.updateBody(newSem);
    };

    const handleRescan = async () => {
      dropdownWrapper.classList.add('loading');
      courses = await getCourses(true); // Force fetch
      // Re-render
      dropdownWrapper.innerHTML = '';
      const newInstance = createDropdown(courses, currentSem, handleSemesterChange, handleRescan);
      dropdownWrapper.appendChild(newInstance.dom);
      dropdownWrapper.classList.remove('loading');
      // Update current sem if invalid?
      const newSems = [...new Set(courses.map(c => c.category))];
      if (!newSems.includes(currentSem) && newSems.length) {
        handleSemesterChange(newSems[0]);
      }
    };

    let dropdownInstance = createDropdown(courses, currentSem, handleSemesterChange, handleRescan);
    dropdownWrapper.appendChild(dropdownInstance.dom);

    // Assembly
    navItem.appendChild(navLink);
    navItem.appendChild(dropdownWrapper);

    // Insert: Try to put it after "My courses" (usually index 1 or 2)
    // Or just append to the container
    navContainer.insertBefore(navItem, navContainer.children[2] || null);

    // Events (Hover/Click)
    let hideTimeout;
    const show = () => {
      clearTimeout(hideTimeout);
      navItem.classList.add('show');
    };
    const hide = () => {
      hideTimeout = setTimeout(() => {
        navItem.classList.remove('show');
      }, 300); // delay to allow moving mouse to dropdown
    };

    navItem.addEventListener('mouseenter', show);
    navItem.addEventListener('mouseleave', hide);
    navItem.addEventListener('click', (e) => {
      // Keep open on click
      if (!navItem.classList.contains('show')) show();
    });
  };

  // --- Observer ---
  // Wait for navbar to exist
  const observer = new MutationObserver((mutations) => {
    if (document.querySelector(SELECTORS.NAVBAR_CONTAINER)) {
      injectNavbarItem();
      // Don't disconnect, Moodle might erase navbar on navigation (SPA-like behaviors)
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial try
  injectNavbarItem();

})();