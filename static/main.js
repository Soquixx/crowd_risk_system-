// ECRIS Global UI Logic
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 ECRIS Main UI Initialized");
    updateClock();
    setInterval(updateClock, 1000);
});

// 1. Live Clock and Date for Weather Bar
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    
    // Update elements if they exist in the weather bar
    const timeEl = document.querySelector('.weather-date span:nth-child(2)');
    const dateEl = document.querySelector('.weather-date span:first-child');
    
    if (timeEl) timeEl.innerHTML = `<i class="far fa-clock"></i> ${timeString}`;
    if (dateEl) dateEl.innerHTML = `<i class="far fa-calendar"></i> ${dateString}`;
}

// 2. Live Demo Trigger
function showDemo() {
    // Scroll to the dashboard section or alert the user
    if (window.location.pathname !== '/dashboard') {
        window.location.href = '/dashboard?startDemo=true';
    } else {
        showToast("Starting Live Simulation...", "warning");
        if (typeof testESP32 === "function") {
            testESP32(); // Call the test function from your dashboard script
        }
    }
}

// 3. Smooth Scroll Navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// 4. Navbar Sticky Effect
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        nav.style.padding = '0.5rem 2rem';
        nav.style.boxShadow = 'var(--shadow-lg)';
    } else {
        nav.style.padding = '1rem 2rem';
        nav.style.boxShadow = 'var(--shadow)';
    }
});