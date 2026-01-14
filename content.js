(() => {
  'use strict';

  // --- Constants ---
  const STORAGE_KEYS = {
    COURSES_CACHE: 'myCoursesCache',
    LAST_FETCH: 'myCoursesLastFetch',
    SELECTED_SEMESTER: 'myCoursesSelectedSemester',
    FOCUS_MODE: 'scf_focus_mode'
  };

  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache (API is reliable)

  // API Config
  const API_ENDPOINT = '/lib/ajax/service.php';
  const API_METHOD = 'core_course_get_enrolled_courses_by_timeline_classification';

  // --- Helpers ---
  const createElement = (tag, classes = [], html = '') => {
    const el = document.createElement(tag);
    if (classes.length) el.classList.add(...classes);
    if (html) el.innerHTML = html;
    return el;
  };

  const getSesskey = () => {
    // Try to find sesskey in logout link
    const link = document.querySelector('a[href*="sesskey="]');
    if (link) {
      const match = link.href.match(/sesskey=([^&]+)/);
      return match ? match[1] : null;
    }
    return null;
  };

  // --- Data Fetching (API) ---
  const fetchCoursesFromAPI = async () => {
    const sesskey = getSesskey();
    if (!sesskey) {
      console.warn('SLIIT Filter: Sesskey not found. Cannot fetch courses via API.');
      return [];
    }

    const payload = [{
      index: 0,
      methodname: API_METHOD,
      args: {
        offset: 0,
        limit: 0, // 0 = All
        classification: 'all', // Get Everything (Past, Future, In Progress)
        sort: 'fullname'
      }
    }];

    const url = `${API_ENDPOINT}?sesskey=${sesskey}&info=${API_METHOD}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        if (json[0] && json[0].error) {
          throw new Error(json[0].exception);
        }

        const rawCourses = json[0].data.courses;

        // Transform to our format
        const courses = rawCourses.map(c => ({
          title: c.fullname,
          href: c.viewurl,
          // Course category is often just "Miscellaneous" or "2024 July".
          // If it looks like a semester, use it. Otherwise fall back to parsing title.
          category: c.coursecategory || parseSemesterFromTitle(c.fullname)
        }));

        await chrome.storage.local.set({
          [STORAGE_KEYS.COURSES_CACHE]: courses,
          [STORAGE_KEYS.LAST_FETCH]: Date.now()
        });

        return courses;

      } catch (err) {
        console.warn(`SLIIT Filter: API Fetch attempt ${attempt} failed`, err);
        if (attempt === 3) {
          console.error('SLIIT Filter: All API Fetch attempts failed', err);
          return [];
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    return [];
  };

  const parseSemesterFromTitle = (title) => {
    const match = title.match(/\[(.*?)]/);
    return match ? match[1] : 'Uncategorized';
  };

  const getCourses = async (forceRefresh = false) => {
    const data = await chrome.storage.local.get([STORAGE_KEYS.COURSES_CACHE, STORAGE_KEYS.LAST_FETCH]);
    const cache = data[STORAGE_KEYS.COURSES_CACHE];
    const lastFetch = data[STORAGE_KEYS.LAST_FETCH];

    if (!forceRefresh && cache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
      return cache;
    }
    return await fetchCoursesFromAPI();
  };

  // --- UI Components ---
  const createCourseList = (courses, targetCategory) => {
    const list = createElement('div', ['scf-course-list']);

    const filtered = courses.filter(c => c.category === targetCategory || targetCategory === 'All');

    if (filtered.length === 0) {
      list.innerHTML = `<div class="scf-empty">No courses found for ${targetCategory}</div>`;
      return list;
    }

    filtered.forEach(c => {
      // Strip [Semester Info] from display string
      // Handles both prefix: "[2024 JAN] Name" AND suffix: "Name [2025/FEB]"
      const cleanTitle = c.title.replace(/\s*\[.*?\]/g, '').trim();

      const item = createElement('a', ['scf-course-link'], cleanTitle);
      item.href = c.href;
      item.title = c.title; // Full title on hover
      list.appendChild(item);
    });
    return list;
  };

  const createDropdown = (courses, currentSem, lastFetch, onSemesterChange, onRescan) => {
    const dropdown = createElement('div', ['scf-dropdown']);

    // --- Header ---
    const header = createElement('div', ['scf-dropdown-header']);
    header.style.flexDirection = 'column';
    header.style.gap = '8px';

    // Header Row 1: Label + Select (Inline)
    const headerRow = createElement('div', ['scf-header-row']);
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.width = '100%';

    const semesters = [...new Set(courses.map(c => c.category))].sort().reverse();

    if (!semesters.includes(currentSem) && semesters.length > 0) {
      currentSem = semesters[0];
      onSemesterChange(currentSem); // Auto-correct
    }

    // --- Custom Select Implementation ---
    const selectContainer = createElement('div', ['scf-custom-select']);
    const selectTrigger = createElement('div', ['scf-select-trigger']);
    selectTrigger.innerHTML = `<span>${currentSem || 'Select Semester'}</span><div class="scf-arrow"></div>`;

    const selectOptions = createElement('div', ['scf-select-options']);

    semesters.forEach(s => {
      const option = createElement('div', ['scf-select-option'], s);
      if (s === currentSem) option.classList.add('selected');

      option.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update UI
        selectTrigger.querySelector('span').textContent = s;
        selectOptions.querySelectorAll('.scf-select-option').forEach(el => el.classList.remove('selected'));
        option.classList.add('selected');
        selectOptions.classList.remove('open');
        selectTrigger.classList.remove('active');

        // Callback
        onSemesterChange(s);
      });
      selectOptions.appendChild(option);
    });

    // Toggle logic
    selectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = selectOptions.classList.contains('open');
      // Close others if any (not strictly needed here as we only have one, but good practice)
      document.querySelectorAll('.scf-select-options').forEach(el => el.classList.remove('open'));

      if (!isOpen) {
        selectOptions.classList.add('open');
        selectTrigger.classList.add('active');
      } else {
        selectOptions.classList.remove('open');
        selectTrigger.classList.remove('active');
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!selectContainer.contains(e.target)) {
        selectOptions.classList.remove('open');
        selectTrigger.classList.remove('active');
      }
    });

    selectContainer.appendChild(selectTrigger);
    selectContainer.appendChild(selectOptions);
    // ------------------------------------

    // Label + Select Wrapper -- replacing direct append
    const controlsWrapper = createElement('div', ['scf-controls-wrapper']);
    controlsWrapper.style.display = 'flex';
    controlsWrapper.style.alignItems = 'center';
    controlsWrapper.style.gap = '10px';

    // Label moved inside wrapper
    const label = createElement('span', ['scf-label'], 'Select Semester:');
    controlsWrapper.appendChild(label);
    controlsWrapper.appendChild(selectContainer);

    headerRow.appendChild(controlsWrapper);
    header.appendChild(headerRow);
    dropdown.appendChild(header);

    dropdown.appendChild(header);

    // Body
    const body = createElement('div', ['scf-dropdown-body']);
    body.appendChild(createCourseList(courses, currentSem));
    dropdown.appendChild(body);

    // --- Footer ---
    const footer = createElement('div', ['scf-dropdown-footer']);

    // Left: Primary Action
    const myCoursesBtn = createElement('a', ['scf-btn', 'scf-btn-primary'], 'Go to My Courses');
    myCoursesBtn.href = '/my/courses.php';

    // Right: Secondary Action + Timestamp
    const rightActions = createElement('div', ['scf-footer-right']);

    // Timestamp logic
    let lastFetchedTime = 'Just now';
    if (lastFetch) {
      const diffMins = Math.floor((Date.now() - lastFetch) / 60000);
      lastFetchedTime = diffMins < 1 ? 'Just now' : `${diffMins}m ago`;
    }
    // const timestamp = createElement('span', ['scf-timestamp'], `Synced: ${lastFetchedTime}`); 
    // Commented out timestamp to save space if needed, or keep it? 
    // User didn't ask to remove it, but complained about clutter. Let's keep it small.
    // Actually user said "just keep the Semester label only" regarding navbar, not footer. 
    // I will keep timestamp but maybe simpler.

    const refreshBtn = createElement('button', ['scf-btn', 'scf-btn-secondary'], '↻ Rescan');
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRescan();
    });

    rightActions.appendChild(refreshBtn);

    footer.appendChild(myCoursesBtn);
    footer.appendChild(rightActions);
    dropdown.appendChild(footer);

    return {
      dom: dropdown, updateBody: (newSem) => {
        body.innerHTML = '';
        body.appendChild(createCourseList(courses, newSem));
      }
    };
  };

  const injectNavbarItem = async () => {
    // 1. Check & Inject Placeholder SYNCHRONOUSLY
    if (document.getElementById('scf-navbar-item')) return;

    // Navbar Selectors (Updated for 4.x)
    const navContainer = document.querySelector('nav .primary-navigation .more-nav') ||
      document.querySelector('.primary-navigation') ||
      document.querySelector('.navbar-nav');

    if (!navContainer) return;

    const navItem = createElement('li', ['nav-item', 'scf-nav-item']); // 'nav-item' is standard BS class
    navItem.id = 'scf-navbar-item';

    // Create Link
    const navLink = createElement('a', ['nav-link', 'scf-nav-link'], 'Courses');
    navLink.href = '#';
    // navLink.innerHTML = `<span class="scf-icon">📚</span> Semester`; // Removed icon as requested
    navItem.appendChild(navLink);

    // Wrapper
    const dropdownWrapper = createElement('div', ['scf-dropdown-wrapper']);
    const loadingEl = createElement('div', ['scf-loading'], 'Loading...');
    loadingEl.style.padding = '10px';
    dropdownWrapper.appendChild(loadingEl);
    navItem.appendChild(dropdownWrapper);

    // Insert Logic: Try to be 2nd or 3rd item
    if (navContainer.children.length > 2) {
      navContainer.insertBefore(navItem, navContainer.children[2]);
    } else {
      navContainer.appendChild(navItem);
    }

    // Interaction
    let timer;
    const show = () => {
      clearTimeout(timer);
      navItem.classList.add('show');
    };
    const hide = () => {
      timer = setTimeout(() => navItem.classList.remove('show'), 300);
    };

    navItem.addEventListener('mouseenter', show);
    navItem.addEventListener('mouseleave', hide);
    navItem.addEventListener('click', (e) => {
      if (!navItem.classList.contains('show')) show();
    });

    // 2. Async Data Fetch & Populate
    try {
      let courses = await getCourses();
      let storedSem = await chrome.storage.local.get(STORAGE_KEYS.SELECTED_SEMESTER);
      let currentSem = storedSem[STORAGE_KEYS.SELECTED_SEMESTER] || (courses.length ? courses[0].category : '');

      const lastFetchData = await chrome.storage.local.get(STORAGE_KEYS.LAST_FETCH);

      const renderDropdown = (lastFetch) => {
        dropdownWrapper.innerHTML = '';
        const instance = createDropdown(
          courses,
          currentSem,
          lastFetch,
          (newSem) => {
            currentSem = newSem;
            chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_SEMESTER]: newSem });
            instance.updateBody(newSem);
          },
          async () => {
            dropdownWrapper.classList.add('loading');
            courses = await getCourses(true);
            const refetchedData = await chrome.storage.local.get(STORAGE_KEYS.LAST_FETCH);
            dropdownWrapper.classList.remove('loading');
            renderDropdown(refetchedData[STORAGE_KEYS.LAST_FETCH]);
          }
        );
        dropdownWrapper.appendChild(instance.dom);
      };

      renderDropdown(lastFetchData[STORAGE_KEYS.LAST_FETCH]);
    } catch (err) {
      console.error('SLIIT Filter: Failed to initialize navbar item', err);
      dropdownWrapper.innerHTML = '<div style="padding:10px; color:red;">Failed to load</div>';
    }
  };

  // Observer
  const observer = new MutationObserver(() => {
    if (document.querySelector('nav') && !document.getElementById('scf-navbar-item')) {
      injectNavbarItem();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial run
  injectNavbarItem();

  // Hide original "My courses" link
  // We run this periodically or just once? Moodle might re-render. 
  // Let's add it to the observer or a specific interval check if simple css isn't enough.
  // Ideally, we'd use CSS, but we need to target a specific list item based on text content often.
  const hideOriginalMyCourses = () => {
    const navItems = document.querySelectorAll('.nav-item, .more-nav > li');
    navItems.forEach(item => {
      if (item.innerText.trim() === 'My courses' || item.querySelector('a[title="My courses"]')) {
        item.style.display = 'none';
      }
    });
  };

  // Run immediately and also observe
  hideOriginalMyCourses();
  const hideObserver = new MutationObserver(hideOriginalMyCourses);
  hideObserver.observe(document.body, { childList: true, subtree: true });

  // Auto-close Right Drawer (Profile/Block Drawer)
  const closeRightDrawer = () => {
    // Moodle 4.x: Drawer is usually .drawer-right or similar.
    // If it has 'show' class, it's open.
    // We look for the close button inside it OR the toggle button.

    const drawer = document.querySelector('.drawer-right, [data-region="right-hand-drawer"]');
    if (drawer && drawer.classList.contains('show')) {
      // Try to find the specific close button within the drawer
      const closeBtn = drawer.querySelector('[data-action="closedrawer"]');
      if (closeBtn) {
        closeBtn.click();
        return;
      }

      // Fallback: Try the main toggle button if drawer is open
      // The toggle usually has aria-expanded="true"
      const toggleBtn = document.querySelector('button[data-action="toggle-drawer"][data-side="right"]');
      if (toggleBtn && toggleBtn.getAttribute('aria-expanded') === 'true') {
        toggleBtn.click();
      }
    }
  };

  // Check a few times in case of lazy loading
  setTimeout(closeRightDrawer, 500);
  setTimeout(closeRightDrawer, 1500);
  setTimeout(closeRightDrawer, 3000);

  const injectFocusToggle = async () => {
    if (document.getElementById('scf-focus-toggle')) return;

    const navContainer = document.querySelector('nav .primary-navigation .more-nav') ||
      document.querySelector('.primary-navigation') ||
      document.querySelector('.navbar-nav');

    if (!navContainer) return;

    // Fetch state
    const focusData = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_MODE);
    let isFocusMode = focusData[STORAGE_KEYS.FOCUS_MODE] || false;
    if (isFocusMode) document.body.classList.add('scf-focus-enabled');

    const toggleItem = createElement('li', ['nav-item', 'scf-nav-item', 'scf-focus-item']);
    toggleItem.id = 'scf-focus-toggle';

    // Toggle UI
    const wrapper = createElement('label', ['scf-focus-wrapper']);
    wrapper.title = "Toggle Focus Mode";
    // Slightly different style for navbar: no text label, just icon/switch?
    // Title says "toogle button". I'll use the same switch style but maybe adapt colors.

    const checkbox = createElement('input', ['scf-focus-checkbox']);
    checkbox.type = 'checkbox';
    checkbox.checked = isFocusMode;

    const slider = createElement('div', ['scf-focus-slider']);
    // Add text label if space permits, or tooltip.
    // User said "after all the lable are placed".

    wrapper.appendChild(checkbox);
    wrapper.appendChild(slider);

    toggleItem.appendChild(wrapper);

    // Event
    checkbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      if (enabled) {
        document.body.classList.add('scf-focus-enabled');
      } else {
        document.body.classList.remove('scf-focus-enabled');
      }
      chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_MODE]: enabled });
    });

    navContainer.appendChild(toggleItem);
  };

  // Run injectFocusToggle
  injectFocusToggle();
  // Also observe? 
  const focusObserver = new MutationObserver(() => {
    if (document.querySelector('nav') && !document.getElementById('scf-focus-toggle')) {
      injectFocusToggle();
    }
  });
  focusObserver.observe(document.body, { childList: true, subtree: true });

})();