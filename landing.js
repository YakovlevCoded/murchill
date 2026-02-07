// ========================================
// МУРКОТЕКА SURVEY — Landing animations
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initScrollReveal();
    initSmoothScroll();
    initSurveyOpen();
});

// Header background on scroll
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
}

// Intersection Observer scroll reveal
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => entry.target.classList.add('revealed'), delay);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    const selectors = [
        '.recognition-card', '.value-card', '.segment-card',
        '.step', '.barrier-card', '.cat-yoga-content'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach((el, i) => {
        el.classList.add('reveal-element');
        const parent = el.parentElement;
        if (parent && parent.children.length > 1) {
            const idx = Array.from(parent.children).indexOf(el);
            el.dataset.delay = idx * 80;
        }
        observer.observe(el);
    });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Open survey on CTA click
function initSurveyOpen() {
    document.querySelectorAll('[data-open-survey]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof openSurvey === 'function') {
                openSurvey();
            }
        });
    });
}
