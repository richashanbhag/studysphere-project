document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_URL = 'https://studysphere-backend-richa.onrender.com/api';
    const SOCKET_URL = 'https://studysphere-backend-richa.onrender.com';
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;

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

// --- Page Setup Functions ---

function setupLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

function setupRegisterPage() {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

function setupDashboardPage() {
    loadDashboardData();
    const createGroupForm = document.getElementById('create-group-form');
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', handleCreateGroup);
    }
}

function setupGroupsPage() {
    loadPublicGroups();
    handleJoinViaLink();
}

function setupGroupDetailPage() {
    loadGroupPageData();
}

function setupGeneralUI() {
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    });

    const modal = document.getElementById('create-group-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn) openModalBtn.onclick = () => modal.classList.remove('hidden');
    if (closeModalBtn) closeModalBtn.onclick = () => modal.classList.add('hidden');
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.add('hidden');
        }
    };
}

// --- Handler & Logic Functions ---

async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.elements.email.value;
    const password = e.target.elements.password.value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            return showCustomAlert(`Login Error: ${data.msg || 'Something went wrong.'}`);
        }
        localStorage.setItem('token', data.token);
        window.location.href = 'dashboard.html';
    } catch (err) {
        showCustomAlert('Could not connect to the server. Please try again later.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = e.target.elements.fullName.value;
    const email = e.target.elements.email.value;
    const password = e.target.elements.password.value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            return showCustomAlert(`Registration Error: ${data.msg || 'Something went wrong.'}`);
        }
        localStorage.setItem('token', data.token);
        window.location.href = 'dashboard.html';
    } catch (err) {
        showCustomAlert('Could not connect to the server. Please try again later.');
    }
}

async function loadDashboardData() {
    const token = localStorage.getItem('token');
    try {
        const [userRes, groupsRes] = await Promise.all([
            fetch(`${API_URL}/auth/me`, { headers: { 'x-auth-token': token } }),
            fetch(`${API_URL}/groups/my`, { headers: { 'x-auth-token': token } })
        ]);

        if (userRes.status === 401 || groupsRes.status === 401) {
             showCustomAlert('Your session has expired. Please log in again.');
             return handleLogout();
        }
        if (!userRes.ok) throw new Error('Failed to fetch user data.');
        if (!groupsRes.ok) throw new Error('Failed to fetch your groups.');

        const user = await userRes.json();
        const groups = await groupsRes.json();
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = user.fullName;
        
        const myGroupsContainer = document.getElementById('my-groups-container');
        if (!myGroupsContainer) return;

        myGroupsContainer.innerHTML = '';
        if (groups.length === 0) {
            myGroupsContainer.innerHTML = '<p class="text-gray-500">You haven\'t joined any groups yet.</p>';
        } else {
            groups.forEach(group => {
                const groupElement = document.createElement('div');
                groupElement.className = 'bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow';
                groupElement.innerHTML = `
                    <h3 class="font-bold text-lg">${group.name}</h3>
                    <p class="text-gray-600">${group.subject}</p>
                    <p class="text-sm text-gray-500 mt-2">${group.members.length} / ${group.capacity} members</p>
                `;
                groupElement.onclick = () => {
                    window.location.href = `group.html?id=${group._id}`;
                };
                myGroupsContainer.appendChild(groupElement);
            });
        }
    } catch (err) {
        showCustomAlert(`Error: ${err.message}`);
    }
}

async function loadPublicGroups() {
    const groupsContainer = document.getElementById('public-groups-container');
     if (!groupsContainer) return;

    try {
        const response = await fetch(`${API_URL}/groups`, {
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        if (!response.ok) throw new Error('Could not fetch public groups.');
        const groups = await response.json();

        groupsContainer.innerHTML = '';
        if (groups.length === 0) {
            groupsContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">No public groups available to join right now.</p>';
        } else {
            groups.forEach(group => {
                const groupCard = document.createElement('div');
                groupCard.className = 'bg-white p-6 rounded-lg shadow-md flex flex-col justify-between';
                groupCard.innerHTML = `
                    <div>
                        <h3 class="text-xl font-bold mb-2">${group.name}</h3>
                        <p class="text-gray-700 mb-1"><span class="font-semibold">Subject:</span> ${group.subject}</p>
                        <p class="text-gray-700 mb-4"><span class="font-semibold">University:</span> ${group.university || 'N/A'}</p>
                    </div>
                    <div class="flex justify-between items-center mt-4">
                         <span class="text-sm text-gray-500">${group.members.length} / ${group.capacity} Members</span>
                        <button data-group-id="${group._id}" class="join-group-btn bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Join</button>
                    </div>
                `;
                groupsContainer.appendChild(groupCard);
            });
            document.querySelectorAll('.join-group-btn').forEach(button => {
                button.addEventListener('click', () => handleJoinGroup(button.dataset.groupId));
            });
        }
    } catch (err) {
        showCustomAlert(`Error: ${err.message}`);
        groupsContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Could not load groups. Please try again later.</p>';
    }
}

async function handleCreateGroup(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const isPrivate = formData.get('isPrivate') === 'on';
    
    const body = {
        name: formData.get('name'),
        subject: formData.get('subject'),
        university: formData.get('university'),
        capacity: formData.get('capacity'),
        isPrivate: isPrivate
    };

    try {
        const response = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) {
            return showCustomAlert(`Error: ${data.msg || 'Failed to create group.'}`);
        }
        document.getElementById('create-group-modal').classList.add('hidden');
        loadDashboardData();
    } catch (err) {
        showCustomAlert('An error occurred while creating the group.');
    }
}

async function handleJoinGroup(groupId) {
    try {
        const response = await fetch(`${API_URL}/groups/join/${groupId}`, {
            method: 'PUT',
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const data = await response.json();
        showCustomAlert(data.msg);
        if (response.ok && data.group) {
            loadPublicGroups();
        }
    } catch (err) {
        showCustomAlert('An error occurred while trying to join the group.');
    }
}

async function loadGroupPageData() {
    const mainContent = document.getElementById('group-main-content');
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('id');

    if (!groupId) {
        if (mainContent) mainContent.innerHTML = '<p class="text-red-500 text-center">No group ID provided. <a href="dashboard.html" class="text-blue-500">Return to Dashboard</a></p>';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/groups/${groupId}`, {
            headers: { 'x-auth-token': token }
        });

        if (!response.ok) {
           const errorText = await response.text();
           console.error("Server responded with an error page:", errorText);
           throw new Error(`Failed to load group details. Server responded with status ${response.status}.`);
        }

        const group = await response.json();
        
        const groupNameEl = document.getElementById('group-name');
        if(groupNameEl) groupNameEl.textContent = group.name;
        
    } catch (err) {
         if (mainContent) mainContent.innerHTML = `<p class="text-red-500 text-center">${err.message} <a href="dashboard.html" class="text-blue-500">Return to Dashboard</a></p>`;
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

function showCustomAlert(message) {
    const existingAlert = document.getElementById('custom-alert-overlay');
    if (existingAlert) {
        existingAlert.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50';

    const alertBox = document.createElement('div');
    alertBox.className = 'bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full mx-4';

    const title = document.createElement('h3');
    title.textContent = 'StudySphere Says';
    title.className = 'text-lg font-bold mb-4';

    const messageP = document.createElement('p');
    messageP.textContent = message;
    messageP.className = 'text-gray-700 mb-6';

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.className = 'bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50';
    
    okButton.onclick = () => overlay.remove();

    alertBox.appendChild(title);
    alertBox.appendChild(messageP);
    alertBox.appendChild(okButton);
    overlay.appendChild(alertBox);

    document.body.appendChild(overlay);
}

async function handleJoinViaLink() {
    const params = new URLSearchParams(window.location.search);
    const joinGroupId = params.get('join');
    if (!joinGroupId) return;

    const joinPrompt = document.getElementById('join-prompt');
    if(!joinPrompt) return;

    joinPrompt.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirm-join-btn');
    const declineBtn = document.getElementById('decline-join-btn');

    if(confirmBtn) confirmBtn.onclick = async () => {
        await handleJoinGroup(joinGroupId);
        window.history.replaceState({}, document.title, window.location.pathname);
        joinPrompt.classList.add('hidden');
    };

    if(declineBtn) declineBtn.onclick = () => {
        window.history.replaceState({}, document.title, window.location.pathname);
        joinPrompt.classList.add('hidden');
    };
}

