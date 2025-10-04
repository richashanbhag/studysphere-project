document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_URL = 'https://studysphere-backend-richa.onrender.com/api';
    const SOCKET_URL = 'https://studysphere-backend-richa.onrender.com';
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    let currentUserId = null;

    // --- Authentication Check ---
    const isProtected = (path) => path.endsWith('/dashboard') || path.endsWith('/dashboard.html') || path.endsWith('/groups') || path.endsWith('/groups.html') || path.endsWith('/group') || path.endsWith('/group.html');
    if (isProtected(currentPath) && !token) {
        window.location.href = 'login.html';
        return;
    }

    // --- Page-Specific Logic ---
    if (currentPath.endsWith('/dashboard') || currentPath.endsWith('/dashboard.html')) {
        setupDashboardPage();
    } else if (currentPath.endsWith('/groups') || currentPath.endsWith('/groups.html')) {
        setupGroupsPage();
    } else if (currentPath.endsWith('/group') || currentPath.endsWith('/group.html')) {
        setupGroupDetailPage();
    } else if (currentPath.endsWith('/login') || currentPath.endsWith('/login.html')) {
        setupLoginPage();
    } else if (currentPath.endsWith('/register') || currentPath.endsWith('/register.html')) {
        setupRegisterPage();
    }
    
    // Universal setup
    setupGeneralUI();
});

// --- Helper Functions and Event Handlers ---

function setupGeneralUI() {
    // Mobile Menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenu?.classList.toggle('hidden');
    });

    // Universal Logout Button
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    });

    // Create Group Modal
    const createGroupModal = document.getElementById('create-group-modal');
    if (createGroupModal) {
        const openModalBtn = document.getElementById('open-create-group-modal');
        const closeModalBtn = document.getElementById('close-modal-btn');
        openModalBtn?.addEventListener('click', () => createGroupModal.classList.remove('hidden'));
        closeModalBtn?.addEventListener('click', () => createGroupModal.classList.add('hidden'));
    }
}

// All your other functions like setupDashboardPage, loadDashboardData, etc. remain the same.
// The provided code snippet only shows the necessary change at the top of the file.
// The rest of your main.js file should follow.

// ... (The rest of your main.js code from the previous version goes here)
// Make sure to copy the entire content from the Canvas file.

