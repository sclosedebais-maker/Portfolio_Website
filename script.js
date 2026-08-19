(function() {
    // ===== Theme Toggle =====
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;
    const themeKey = 'scd-theme';

    // Restore saved theme on load
    const savedTheme = localStorage.getItem(themeKey);
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    }

    // Toggle theme on button click
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem(themeKey, next);
        });
    }

    // ===== Reveal on Scroll =====
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elementsToReveal = document.querySelectorAll('.section, .timeline-item, .skill, .passion');

    if (prefersReduced) {
        // If motion is reduced, immediately show all elements
        elementsToReveal.forEach(el => {
            el.classList.add('is-visible');
        });
    } else {
        // Use IntersectionObserver for reveal on scroll
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        // Only add once
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );

        elementsToReveal.forEach(el => {
            revealObserver.observe(el);
        });
    }

    // ===== Scroll Spy =====
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section, .hero');

    const scrollSpyObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('is-active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('is-active');
                        }
                    });
                }
            });
        },
        { threshold: 0.3 }
    );

    sections.forEach(section => {
        scrollSpyObserver.observe(section);
    });
})();
