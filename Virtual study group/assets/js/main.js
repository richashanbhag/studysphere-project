document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_URL = 'http://localhost:5000/api';
    const SOCKET_URL = 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    let currentUserId = null;

    // --- Authentication Check ---
    const protectedPaths = ['dashboard.html', 'groups.html', 'group.html'];
    if (protectedPaths.some(path => currentPath.includes(path)) && !token) {
        window.location.href = 'login.html';
        return;
    }

    // --- General UI ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenu?.classList.toggle('hidden');
    });

    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    });

    // --- Auth Forms ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.elements.email.value;
            const password = e.target.elements.password.value;
            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'Login failed');
                localStorage.setItem('token', data.token);
                window.location.href = 'dashboard.html';
            } catch (err) {
                showCustomAlert(`Login Error: ${err.message}`);
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = e.target.elements.fullName.value;
            const email = e.target.elements.email.value;
            const password = e.target.elements.password.value;
            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'Registration failed');
                localStorage.setItem('token', data.token);
                window.location.href = 'dashboard.html';
            } catch (err) {
                showCustomAlert(`Registration Error: ${err.message}`);
            }
        });
    }

    // --- Dashboard Page ---
    if (currentPath.includes('dashboard.html')) {
        const populateDashboard = async () => {
            try {
                const [userRes, groupsRes] = await Promise.all([
                    fetch(`${API_URL}/auth/me`, { headers: { 'x-auth-token': token } }),
                    fetch(`${API_URL}/groups/my`, { headers: { 'x-auth-token': token } })
                ]);

                if (userRes.status === 401 || groupsRes.status === 401) {
                    throw new Error('Your session has expired. Please log in again.');
                }
                 if (!userRes.ok || !groupsRes.ok) {
                    throw new Error('Failed to load dashboard data.');
                }

                const user = await userRes.json();
                const groups = await groupsRes.json();
                currentUserId = user._id;

                document.getElementById('user-name').textContent = user.fullName;
                renderMyGroups(groups);
            } catch (err) {
                showCustomAlert(err.message);
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            }
        };

        const renderMyGroups = (groups) => {
            const listEl = document.getElementById('my-groups-list');
            listEl.innerHTML = '';
            if (groups.length === 0) {
                listEl.innerHTML = `<p class="text-slate-500 col-span-full">You haven't joined or created any groups yet.</p>`;
                return;
            }
            groups.forEach(group => {
                const card = `
                    <a href="group.html?id=${group._id}" class="block bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                        <span class="text-xs font-semibold px-2 py-1 rounded-full ${getSubjectColor(group.subject)}">${group.subject}</span>
                        <h3 class="mt-3 text-xl font-bold text-slate-800">${group.name}</h3>
                        <p class="text-sm text-slate-500 mt-1">${group.university}</p>
                        <div class="flex items-center space-x-2 mt-4 text-slate-600">
                            <i data-lucide="users" class="w-4 h-4"></i>
                            <span>${group.members.length} / ${group.capacity} members</span>
                        </div>
                    </a>`;
                listEl.innerHTML += card;
            });
            lucide.createIcons();
        };
        
        document.addEventListener('reloadDashboard', populateDashboard);
        populateDashboard();
    }

    // --- Group Detail Page ---
    if (currentPath.includes('group.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const groupId = urlParams.get('id');
        if (!groupId) { window.location.href = 'dashboard.html'; return; }

        const socket = io(SOCKET_URL);
        const chatMessagesEl = document.getElementById('chat-messages');

        const fetchCurrentUser = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/me`, { headers: { 'x-auth-token': token } });
                if (!res.ok) throw new Error('Could not authenticate user.');
                const user = await res.json();
                currentUserId = user._id;
                loadGroupPage();
            } catch (error) {
                window.location.href = 'login.html';
            }
        };
        fetchCurrentUser();

        socket.on('connect', () => socket.emit('join group', groupId));
        socket.on('chat message', (msg) => appendMessage(msg));
        socket.on('file uploaded', (file) => appendFile(file, true));

        const loadGroupPage = async () => {
            try {
                const res = await fetch(`${API_URL}/groups/${groupId}`, { headers: { 'x-auth-token': token } });
                 if (res.status === 403) {
                    throw new Error("You are not a member of this group.");
                }
                if (!res.ok) throw new Error('Failed to load group details.');

                const group = await res.json();
                
                const [messages, files] = await Promise.all([
                    fetch(`${API_URL}/groups/${groupId}/messages`, { headers: { 'x-auth-token': token } }).then(r => r.json()),
                    fetch(`${API_URL}/groups/${groupId}/files`, { headers: { 'x-auth-token': token } }).then(r => r.json())
                ]);

                document.getElementById('group-header').innerHTML = `<h1 class="text-3xl font-bold">${group.name}</h1><p class="text-slate-500 mt-1">${group.subject} at ${group.university}</p>`;
                chatMessagesEl.innerHTML = '';
                messages.forEach(appendMessage);
                renderFiles(files);
                
                if (group.createdBy._id === currentUserId) {
                    loadJoinRequests();
                }

            } catch (err) {
                 document.querySelector('main').innerHTML = `<p class="text-center text-red-500">${err.message} <a href="dashboard.html" class="text-indigo-600">Return to Dashboard</a></p>`;
            }
        };
        
        const loadJoinRequests = async () => {
            const requestsPanel = document.getElementById('join-requests-panel');
            const requestsList = document.getElementById('join-requests-list');
            try {
                const res = await fetch(`${API_URL}/groups/${groupId}/requests`, { headers: { 'x-auth-token': token } });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.msg || 'Failed to fetch requests.');
                };
                const requests = await res.json();
                
                if (requests.length > 0) {
                    if (requestsPanel) requestsPanel.classList.remove('hidden');
                    if (requestsList) {
                        requestsList.innerHTML = '';
                        requests.forEach(req => {
                            const reqEl = document.createElement('div');
                            reqEl.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-lg';
                            reqEl.innerHTML = `
                                <p><span class="font-semibold">${req.user.fullName}</span> wants to join.</p>
                                <div class="flex gap-2">
                                    <button data-req-id="${req._id}" data-action="approve" class="respond-btn bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">Approve</button>
                                    <button data-req-id="${req._id}" data-action="reject" class="respond-btn bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full hover:bg-red-200">Reject</button>
                                </div>`;
                            requestsList.appendChild(reqEl);
                        });
                    }
                } else {
                    if (requestsPanel) requestsPanel.classList.add('hidden');
                }
            } catch (err) {
                // This is the updated part. It checks if the elements exist before using them.
                showCustomAlert(`Error loading join requests: ${err.message}`);
                if (requestsPanel) {
                    requestsPanel.classList.remove('hidden');
                }
                if (requestsList) {
                    requestsList.innerHTML = `<p class="text-red-500 text-center">Could not load join requests. Please try again later.</p>`;
                }
            }
        };
        
        document.body.addEventListener('click', async (e) => {
            if (e.target.classList.contains('respond-btn')) {
                const reqId = e.target.dataset.reqId;
                const action = e.target.dataset.action;
                const button = e.target;
                button.disabled = true;
                try {
                    const res = await fetch(`${API_URL}/groups/requests/${reqId}/respond`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                        body: JSON.stringify({ action })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.msg);
                    
                    showCustomAlert(`Request ${action}d successfully.`);
                    button.closest('.flex').parentElement.remove();
                     if (document.getElementById('join-requests-list')?.children.length === 0) {
                        document.getElementById('join-requests-panel')?.classList.add('hidden');
                    }
                    
                } catch (err) {
                    showCustomAlert(`Error: ${err.message}`);
                    button.disabled = false;
                }
            }
        });

        const appendMessage = (msg) => {
            if (!chatMessagesEl) return;
            const isMe = msg.user._id === currentUserId;
            const messageDiv = document.createElement('div');
            messageDiv.className = `flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`;
            messageDiv.innerHTML = `
                <div class="max-w-xs md:max-w-md">
                    ${!isMe ? `<div class="text-xs text-slate-500 mb-1 ml-3">${msg.user.fullName}</div>` : ''}
                    <div class="px-4 py-2 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-lg' : 'bg-slate-100 text-slate-800 rounded-bl-lg'}">
                        ${msg.content}
                    </div>
                </div>`;
            chatMessagesEl.appendChild(messageDiv);
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        };

        const renderFiles = (files) => {
            const fileListEl = document.getElementById('file-list');
            if (!fileListEl) return;
            fileListEl.innerHTML = '';
            if (files.length === 0) {
                fileListEl.innerHTML = `<p class="text-sm text-center text-slate-400">No files shared yet.</p>`;
                return;
            }
            files.forEach(file => appendFile(file, false));
        };
        
        const appendFile = (file, prepend) => {
            const fileListEl = document.getElementById('file-list');
            if (!fileListEl) return;
            if (fileListEl.querySelector('p')) fileListEl.innerHTML = '';
            const fileEl = document.createElement('a');
            fileEl.href = `${SOCKET_URL}/uploads/${file.filePath}`;
            fileEl.target = '_blank';
            fileEl.className = 'block p-3 rounded-lg hover:bg-slate-100 transition-colors';
            fileEl.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="file-text" class="w-5 h-5 text-indigo-500 flex-shrink-0"></i>
                    <div class="flex-1 overflow-hidden">
                        <p class="text-sm font-medium truncate">${file.originalName}</p>
                        <p class="text-xs text-slate-400">by ${file.user.fullName}</p>
                    </div>
                </div>`;
            prepend ? fileListEl.prepend(fileEl) : fileListEl.appendChild(fileEl);
            lucide.createIcons();
        };

        document.getElementById('chat-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('message-input');
            if (input && input.value.trim()) {
                socket.emit('chat message', { groupId, token, content: input.value });
                input.value = '';
            }
        });

        document.getElementById('file-upload-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('file-input');
            if (!fileInput || !fileInput.files[0]) return;
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const button = e.target.querySelector('button');
            button.textContent = 'Uploading...';
            button.disabled = true;
            try {
                const res = await fetch(`${API_URL}/groups/${groupId}/upload`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token },
                    body: formData,
                });
                if (!res.ok) throw new Error('Upload failed.');
                e.target.reset();
            } catch (err) {
                showCustomAlert(err.message);
            } finally {
                button.textContent = 'Upload';
                button.disabled = false;
            }
        });
        
        document.getElementById('share-group-btn')?.addEventListener('click', () => {
             const inviteLink = `${window.location.origin}${window.location.pathname.replace('group.html', 'groups.html')}?join=${groupId}`;
             navigator.clipboard.writeText(inviteLink).then(() => showCustomAlert('Group invite link copied to clipboard!'));
        });
    }

    // --- Find Groups Page ---
    if (currentPath.includes('groups.html')) {
        const loadPublicGroups = async () => {
            try {
                const res = await fetch(`${API_URL}/groups`, { headers: { 'x-auth-token': token } });
                const groups = await res.json();
                renderPublicGroups(groups);
            } catch (err) {
                const listEl = document.getElementById('public-groups-list');
                if (listEl) listEl.innerHTML = `<p class="text-red-500 col-span-full">Failed to load public groups.</p>`;
            }
        };

        async function handleJoinClick(e) {
            const btn = e.target;
            const groupId = btn.dataset.groupId;
            btn.disabled = true;
            btn.textContent = 'Requesting...';
            try {
                const res = await fetch(`${API_URL}/groups/join/${groupId}`, {
                    method: 'PUT',
                    headers: { 'x-auth-token': token }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg);

                showCustomAlert(data.msg);
                if (data.group) {
                    btn.textContent = 'Joined';
                } else {
                    btn.textContent = 'Requested';
                }
            } catch (err) {
                showCustomAlert(`Error: ${err.message}`);
                btn.disabled = false;
                btn.textContent = 'Join';
            }
        }

        function renderPublicGroups(groups) {
             const listEl = document.getElementById('public-groups-list');
             if (!listEl) return;
             listEl.innerHTML = '';
             if (groups.length === 0) {
                 listEl.innerHTML = `<p class="text-slate-500 col-span-full">No public groups available to join right now.</p>`;
                 return;
             }
             groups.forEach(group => {
                 const card = `
                     <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                         <h3 class="text-xl font-bold text-slate-800">${group.name}</h3>
                         <p class="text-sm text-slate-500 mt-1">${group.subject} at ${group.university}</p>
                          <p class="text-xs text-slate-400 mt-2">Created by ${group.createdBy.fullName}</p>
                         <div class="flex items-center justify-between mt-4">
                             <span class="text-slate-600">${group.members.length} / ${group.capacity} members</span>
                             <button data-group-id="${group._id}" class="join-group-btn bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700">Join</button>
                         </div>
                     </div>`;
                 listEl.innerHTML += card;
             });
             
             document.querySelectorAll('.join-group-btn').forEach(btn => {
                 btn.addEventListener('click', handleJoinClick);
             });
        }
        
        async function handleJoinInvitation(groupId) {
            const joinPromptEl = document.getElementById('join-prompt');
            if (!joinPromptEl) return;

            joinPromptEl.classList.remove('hidden');
            joinPromptEl.innerHTML = `<p class="text-center text-slate-500">Fetching group information...</p>`;

            try {
                const res = await fetch(`${API_URL}/groups/${groupId}`, { headers: { 'x-auth-token': token } });
                if (!res.ok) {
                   const errText = await res.json();
                   throw new Error(errText.msg || 'Could not fetch group details.');
                }
                const group = await res.json();
                
                joinPromptEl.innerHTML = `
                    <h2 class="text-xl font-bold text-center">You've been invited!</h2>
                    <div class="my-4 p-4 bg-slate-50 rounded-lg border text-center">
                        <h3 class="font-semibold text-lg">${group.name}</h3>
                        <p class="text-slate-600">${group.subject} at ${group.university}</p>
                    </div>
                    <div class="flex justify-center gap-4">
                        <button id="confirm-join-btn" class="bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-500">Confirm Request</button>
                        <button id="decline-join-btn" class="bg-slate-200 text-slate-700 font-semibold px-6 py-2 rounded-lg hover:bg-slate-300">Decline</button>
                    </div>`;

                document.getElementById('confirm-join-btn').addEventListener('click', async () => {
                    try {
                        const joinRes = await fetch(`${API_URL}/groups/join/${groupId}`, {
                            method: 'PUT',
                            headers: { 'x-auth-token': token }
                        });
                        const data = await joinRes.json();
                        if (!joinRes.ok) throw new Error(data.msg || 'Failed to send request.');
                        
                        showCustomAlert(data.msg);
                        if (data.group) {
                             window.location.href = `group.html?id=${groupId}`;
                        } else {
                             joinPromptEl.innerHTML = `
                                 <div class="text-center">
                                     <h2 class="text-xl font-bold">Request Sent!</h2>
                                     <p class="text-slate-600 mt-2">The group creator has been notified. You can access the group once approved.</p>
                                     <button id="close-prompt-btn" class="mt-4 bg-slate-800 text-white font-semibold px-6 py-2 rounded-lg hover:bg-slate-700">OK</button>
                                 </div>`;
                             document.getElementById('close-prompt-btn').addEventListener('click', () => {
                                 joinPromptEl.classList.add('hidden');
                                 window.history.pushState({}, '', window.location.pathname);
                             });
                        }
                    } catch (err) {
                        showCustomAlert(`Error: ${err.message}`);
                    }
                });

                 document.getElementById('decline-join-btn').addEventListener('click', () => {
                     joinPromptEl.classList.add('hidden');
                     window.history.pushState({}, '', window.location.pathname);
                 });
            } catch (err) {
                joinPromptEl.innerHTML = `<p class="text-center text-red-500">Error: ${err.message}</p>`;
            }
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const joinGroupId = urlParams.get('join');

        if (joinGroupId) {
            handleJoinInvitation(joinGroupId);
        } else {
            loadPublicGroups();
        }
    }

    // --- Create Group Modal ---
    const createGroupModal = document.getElementById('create-group-modal');
    if (createGroupModal) {
        const openModalBtn = document.getElementById('open-create-group-modal');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const createGroupForm = document.getElementById('create-group-form');

        openModalBtn?.addEventListener('click', () => createGroupModal.classList.remove('hidden'));
        closeModalBtn?.addEventListener('click', () => createGroupModal.classList.add('hidden'));

        createGroupForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Creating...';
            
            const groupData = {
                name: e.target.elements.name.value,
                subject: e.target.elements.subject.value,
                university: e.target.elements.university.value,
                capacity: e.target.elements.capacity.value,
                isPrivate: e.target.elements.isPrivate.checked
            };

            try {
                const res = await fetch(`${API_URL}/groups`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body: JSON.stringify(groupData),
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.msg || 'Failed to create group');
                }
                showCustomAlert('Group created successfully!');
                createGroupForm.reset();
                createGroupModal.classList.add('hidden');
                document.dispatchEvent(new Event('reloadDashboard'));
            } catch (err) {
                 showCustomAlert(`Error: ${err.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Create Group';
            }
        });
    }

    // --- Helper Functions ---
    const getSubjectColor = (subject = '') => {
        const s = subject.toLowerCase();
        if (s.includes('math')) return 'bg-sky-100 text-sky-700';
        if (s.includes('chem')) return 'bg-teal-100 text-teal-700';
        if (s.includes('computer') || s.includes('science')) return 'bg-indigo-100 text-indigo-700';
        if (s.includes('physic')) return 'bg-amber-100 text-amber-700';
        if (s.includes('history')) return 'bg-rose-100 text-rose-700';
        return 'bg-slate-100 text-slate-700';
    };

    const showCustomAlert = (message) => {
        const alertOverlay = document.createElement('div');
        alertOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        alertOverlay.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-sm text-center">
                <h3 class="text-lg font-bold text-slate-800 mb-4">StudySphere Says</h3>
                <p class="text-slate-600 mb-6">${message}</p>
                <button class="close-alert bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-500">OK</button>
            </div>
        `;
        document.body.appendChild(alertOverlay);
        alertOverlay.querySelector('.close-alert').addEventListener('click', () => {
            alertOverlay.remove();
        });
    };

    lucide.createIcons();
});

