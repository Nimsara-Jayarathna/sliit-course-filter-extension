(() => {
  'use strict';

  // --- Constants ---
  const STORAGE_KEYS = {
    COURSES_CACHE: 'myCoursesCache',
    LAST_FETCH: 'myCoursesLastFetch',
    SELECTED_SEMESTER: 'myCoursesSelectedSemester'
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

    try {
      const url = `${API_ENDPOINT}?sesskey=${sesskey}&info=${API_METHOD}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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

      // Bonus: Check for "Hidden" courses? The 'all' classification usually covers Everything.
      // But just in case, we could do a second call for 'hidden' if needed.
      // For now, 'all' is usually sufficient in Moodle 4.x.

      await chrome.storage.local.set({
        [STORAGE_KEYS.COURSES_CACHE]: courses,
        [STORAGE_KEYS.LAST_FETCH]: Date.now()
      });

      return courses;

    } catch (err) {
      console.error('SLIIT Filter: API Fetch failed', err);
      return [];
    }
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
    const filtered = courses.filter(c => c.category === targetCategory || targetCategory === 'All'); // Exact match preferred

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

  const createDropdown = (courses, currentSem, onSemesterChange, onRescan) => {
    const dropdown = createElement('div', ['scf-dropdown']);

    // Header
    const header = createElement('div', ['scf-dropdown-header']);
    const semesters = [...new Set(courses.map(c => c.category))].sort().reverse();

    if (!semesters.includes(currentSem) && semesters.length > 0) {
      currentSem = semesters[0];
      onSemesterChange(currentSem); // Auto-correct
    }

    const select = createElement('select', ['scf-semester-select']);
    semesters.forEach(s => {
      const opt = createElement('option', [], s);
      opt.value = s;
      opt.selected = s === currentSem;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => onSemesterChange(e.target.value));
    select.addEventListener('click', (e) => e.stopPropagation());

    header.appendChild(createElement('span', ['scf-label'], 'Semester: '));
    header.appendChild(select);
    dropdown.appendChild(header);

    // Body
    const body = createElement('div', ['scf-dropdown-body']);
    body.appendChild(createCourseList(courses, currentSem));
    dropdown.appendChild(body);

    // Footer
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
    if (document.getElementById('scf-navbar-item')) return;

    // Navbar Selectors (Updated for 4.x)
    const navContainer = document.querySelector('nav .primary-navigation .more-nav') ||
      document.querySelector('.primary-navigation') ||
      document.querySelector('.navbar-nav');

    if (!navContainer) return;

    let courses = await getCourses();
    let storedSem = await chrome.storage.local.get(STORAGE_KEYS.SELECTED_SEMESTER);
    let currentSem = storedSem[STORAGE_KEYS.SELECTED_SEMESTER] || (courses.length ? courses[0].category : '');

    const navItem = createElement('li', ['nav-item', 'scf-nav-item']); // 'nav-item' is standard BS class
    navItem.id = 'scf-navbar-item';

    // Create Link
    const navLink = createElement('a', ['nav-link', 'scf-nav-link'], 'Semester');
    navLink.href = '#';
    navLink.innerHTML = `<span class="scf-icon">📚</span> Semester`;

    // Wrapper
    const dropdownWrapper = createElement('div', ['scf-dropdown-wrapper']);

    const renderDropdown = () => {
      dropdownWrapper.innerHTML = '';
      const instance = createDropdown(
        courses,
        currentSem,
        (newSem) => {
          currentSem = newSem;
          chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_SEMESTER]: newSem });
          instance.updateBody(newSem);
        },
        async () => {
          dropdownWrapper.classList.add('loading');
          courses = await getCourses(true);
          dropdownWrapper.classList.remove('loading');
          renderDropdown();
        }
      );
      dropdownWrapper.appendChild(instance.dom);
    };

    renderDropdown();

    navItem.appendChild(navLink);
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
  };

  // Observer
  const observer = new MutationObserver(() => {
    if (document.querySelector('nav') && !document.getElementById('scf-navbar-item')) {
      injectNavbarItem();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  injectNavbarItem();

})();