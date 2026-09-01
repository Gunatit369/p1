document.addEventListener('DOMContentLoaded', () => {
    // ---- Auth state ----
    const auth = {
        token: localStorage.getItem('faceai_token') || null,
        user: null,
    };
    const authOverlay = document.getElementById('authOverlay');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const authClose = document.getElementById('authClose');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const userBar = document.getElementById('userBar');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    function setActiveTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(tab + 'Form').classList.add('active');
    }
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
    });
    function openAuth(tab) {
        setActiveTab(tab || 'login');
        authOverlay.style.display = 'flex';
    }
    function closeAuth() {
        authOverlay.style.display = 'none';
    }
    loginBtn.addEventListener('click', e => { e.preventDefault(); openAuth('login'); });
    signupBtn.addEventListener('click', e => { e.preventDefault(); openAuth('register'); });
    authClose.addEventListener('click', closeAuth);
    authOverlay.addEventListener('click', e => { if (e.target === authOverlay) closeAuth(); });

    async function api(url, options = {}) {
        const headers = options.headers || {};
        if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
        if (options.body && typeof options.body !== 'string') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const res = await fetch(url, { ...options, headers });
        return res;
    }

    function roleName(r) {
        return { owner: 'Owner', admin: 'Admin', user: 'User' }[r] || r || 'User';
    }

    async function renderUser() {
        if (!auth.token) {
            updateGalleryAuthUI();
            return;
        }
        try {
            const res = await api('/api/auth/me');
            const data = await res.json();
            if (data.success && data.user) {
                auth.user = data.user;
                applyUserUI();
                updateGalleryAuthUI();
            } else {
                logout();
            }
        } catch (e) {
            logout();
        }
    }

    function applyUserUI() {
        const u = auth.user;
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        userBar.style.display = 'flex';
        userName.textContent = u.name;
        userRole.textContent = roleName(u.role);
        userAvatar.textContent = (u.name || '?').charAt(0).toUpperCase();
    }

    function logout() {
        auth.token = null;
        auth.user = null;
        localStorage.removeItem('faceai_token');
        loginBtn.style.display = '';
        signupBtn.style.display = '';
        userBar.style.display = 'none';
        closeAuth();
        updateGalleryAuthUI();
    }

    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        loginError.textContent = '';
        const email = loginForm.email.value.trim();
        const password = loginForm.password.value;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success) {
                auth.token = data.token;
                auth.user = data.user;
                localStorage.setItem('faceai_token', data.token);
                applyUserUI();
                closeAuth();
                loginForm.reset();
            } else {
                loginError.textContent = data.message || 'Login failed';
            }
        } catch (err) {
            loginError.textContent = 'Server error. Try again.';
        }
    });

    registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        registerError.textContent = '';
        const name = registerForm.name.value.trim();
        const email = registerForm.email.value.trim();
        const password = registerForm.password.value;
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json();
            if (data.success) {
                registerError.textContent = 'Account created! You can now log in.';
                registerError.style.color = 'var(--success)';
                setTimeout(() => setActiveTab('login'), 1200);
            } else {
                registerError.textContent = data.message || 'Registration failed';
                registerError.style.color = 'var(--warning)';
            }
        } catch (err) {
            registerError.textContent = 'Server error. Try again.';
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (auth.token) fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + auth.token } }).catch(() => {});
        logout();
    });

    // Load session if a token exists
    renderUser();

    // ---- Gallery upload ----
    const galleryUploadBtn = document.getElementById('galleryUploadBtn');
    const galleryFileInput = document.getElementById('galleryFileInput');
    const galleryHint = document.getElementById('galleryHint');
    const uploadedGallery = document.getElementById('uploadedGallery');
    const galleryEmpty = document.getElementById('galleryEmpty');

    async function loadGallery() {
        if (!auth.token) {
            uploadedGallery.innerHTML = '';
            galleryEmpty.style.display = 'block';
            galleryEmpty.textContent = 'Log in to see and add your photos.';
            return;
        }
        try {
            const res = await api('/api/photos');
            const photos = await res.json();
            renderGallery(photos);
        } catch (e) {
            console.warn('Failed to load gallery:', e);
        }
    }

    function renderGallery(photos) {
        if (!uploadedGallery) return;
        uploadedGallery.innerHTML = '';
        if (!photos || photos.length === 0) {
            galleryEmpty.style.display = 'block';
            galleryEmpty.textContent = 'No photos uploaded yet.';
            return;
        }
        galleryEmpty.style.display = 'none';
        photos.forEach(p => {
            const item = document.createElement('div');
            item.className = 'gallery-item uploaded-item';
            const canDelete = auth.user && (auth.user.role !== 'user' || true);
            item.innerHTML = `
                <div class="gallery-photo">
                    <img src="${p.url}" alt="Uploaded photo">
                    <button class="gallery-delete" data-id="${p.id}" title="Delete">&times;</button>
                </div>
            `;
            item.querySelector('.gallery-delete').addEventListener('click', async e => {
                e.stopPropagation();
                if (!confirm('Delete this photo?')) return;
                try {
                    const del = await api('/api/photos/' + p.id, { method: 'DELETE' });
                    const data = await del.json();
                    if (data.success) loadGallery();
                } catch (err) {
                    console.error('Delete failed:', err);
                }
            });
            uploadedGallery.appendChild(item);
        });
    }

    galleryUploadBtn.addEventListener('click', () => {
        if (!auth.token) {
            openAuth('login');
            return;
        }
        galleryFileInput.click();
    });

    galleryFileInput.addEventListener('change', async () => {
        if (!galleryFileInput.files.length) return;
        const formData = new FormData();
        for (const f of galleryFileInput.files) formData.append('images', f);
        galleryUploadBtn.textContent = 'Uploading...';
        galleryUploadBtn.disabled = true;
        try {
            const res = await api('/api/photos/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                galleryFileInput.value = '';
                await loadGallery();
            } else {
                alert(data.message || 'Upload failed');
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            galleryUploadBtn.textContent = 'Upload Photos';
            galleryUploadBtn.disabled = false;
        }
    });

    // Show/hide gallery hint based on login
    function updateGalleryAuthUI() {
        if (auth.token) {
            galleryHint.textContent = 'Logged in — upload photos to your gallery';
        } else {
            galleryHint.textContent = 'Log in to upload photos to your gallery';
        }
        loadGallery();
    }

    // ---- Navbar scroll ----
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 40);
    });

    // ---- Mobile menu ----
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    // ---- Smooth scroll ----
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ---- Pricing toggle ----
    const pricingToggle = document.getElementById('pricingToggle');
    const monthlyLabel = document.getElementById('monthlyLabel');
    const yearlyLabel = document.getElementById('yearlyLabel');
    pricingToggle.addEventListener('change', () => {
        const isYearly = pricingToggle.checked;
        monthlyLabel.classList.toggle('active', !isYearly);
        yearlyLabel.classList.toggle('active', isYearly);
        document.querySelectorAll('.amount[data-monthly]').forEach(el => {
            const price = isYearly ? el.dataset.yearly : el.dataset.monthly;
            el.textContent = `$${price}`;
        });
    });

    // ---- Intersection Observer for animations ----
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .testimonial-card, .pricing-card, .gallery-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ---- Demo: Face Detection ----
    const uploadArea = document.getElementById('demoUploadArea');
    const fileInput = document.getElementById('demoFileInput');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const demoResult = document.getElementById('demoResult');
    const canvas = document.getElementById('demoCanvas');
    const ctx = canvas.getContext('2d');
    const facesList = document.getElementById('detectedFacesList');
    const clearBtn = document.getElementById('clearBtn');
    const shareBtn = document.getElementById('shareBtn');

    const faceNames = ['Person 1', 'Person 2', 'Person 3', 'Person 4', 'Person 5', 'Person 6'];

    uploadArea.addEventListener('click', e => {
        if (!demoResult.style.display || demoResult.style.display === 'none') {
            fileInput.click();
        }
    });

    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) processFile(fileInput.files[0]);
    });

    function processFile(file) {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                uploadPlaceholder.style.display = 'none';
                demoResult.style.display = 'grid';

                const maxW = 600;
                const scale = img.width > maxW ? maxW / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const photoId = 'photo-' + Date.now();
                callRecognition(file, photoId);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Use the real AI recognition API when configured, otherwise simulate.
    async function callRecognition(file, photoId) {
        let realServiceAvailable = false;
        try {
            const statusRes = await fetch('/api/recognize/status');
            const statusData = await statusRes.json();
            realServiceAvailable = statusData.configured && statusData.keySet;
        } catch (e) { /* fall back to simulation */ }

        if (realServiceAvailable) {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('photoId', photoId);
            formData.append('save', String(dbConnected));

            try {
                const res = await fetch('/api/recognize', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (data.success && data.detections) {
                    const faces = data.detections.map(d => ({
                        x: d.x <= 1 && d.x >= 0 ? d.x * canvas.width : d.x,
                        y: d.y <= 1 && d.y >= 0 ? d.y * canvas.height : d.y,
                        w: d.width <= 1 && d.width >= 0 ? d.width * canvas.width : d.width,
                        h: d.height <= 1 && d.height >= 0 ? d.height * canvas.height : d.height,
                        name: d.label,
                    }));
                    drawDetections(faces);
                    populateFacesList(faces);
                    saveDetections(data.detections, photoId);
                    return;
                }
            } catch (e) {
                console.warn('Real API failed, simulating:', e);
            }
        }

        simulateFaceDetection(canvas.width, canvas.height, photoId);
    }

    function saveDetections(detections, photoId) {
        if (!dbConnected) return;
        detections.forEach(d => {
            saveDetectionToDatabase(photoId, d.faceId, Math.round(d.x), Math.round(d.y), Math.round(d.width), Math.round(d.height));
        });
    }

    function simulateFaceDetection(w, h, photoId) {
        const numFaces = Math.floor(Math.random() * 4) + 1;
        const faces = [];

        for (let i = 0; i < numFaces; i++) {
            const faceW = 40 + Math.random() * 60;
            const faceH = faceW * 1.2;
            let x, y, overlap;

            do {
                overlap = false;
                x = 20 + Math.random() * (w - faceW - 40);
                y = 20 + Math.random() * (h - faceH - 40);
                for (const f of faces) {
                    if (Math.abs(x - f.x) < faceW && Math.abs(y - f.y) < faceH) {
                        overlap = true;
                        break;
                    }
                }
            } while (overlap);

            faces.push({ x, y, w: faceW, h: faceH, name: faceNames[i % faceNames.length] });
        }

        drawDetections(faces);
        populateFacesList(faces);

        if (dbConnected && photoId) {
            faces.forEach(f => {
                saveDetectionToDatabase(photoId, f.name, Math.round(f.x), Math.round(f.y), Math.round(f.w), Math.round(f.h));
            });
        }
    }

    // ---- MongoDB Database Connection ----
    let dbConnected = false;

    async function checkDatabaseStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            if (data.connected) {
                dbConnected = true;
                console.log('Connected to MongoDB database:', data.dbName);
            }
        } catch (e) {
            console.warn('Database not reachable');
        }
    }
    checkDatabaseStatus();

    async function saveDetectionToDatabase(photoId, faceId, x, y, width, height) {
        if (!dbConnected) return;
        try {
            await api('/api/detections', {
                method: 'POST',
                body: JSON.stringify({
                    photoId,
                    faceId,
                    x,
                    y,
                    width,
                    height,
                    label: faceId,
                    confidence: Math.round((85 + Math.random() * 14) * 10) / 10,
                }),
            });
        } catch (e) {
            console.error('Failed to save detection:', e);
        }
    }

    function drawDetections(faces) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        ctx.putImageData(imgData, 0, 0);

        faces.forEach((face, i) => {
            const color = i % 2 === 0 ? 'rgba(99,102,241,0.9)' : 'rgba(168,85,247,0.9)';

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);

            const r = 6;
            ctx.beginPath();
            ctx.moveTo(face.x + r, face.y);
            ctx.lineTo(face.x + face.w - r, face.y);
            ctx.quadraticCurveTo(face.x + face.w, face.y, face.x + face.w, face.y + r);
            ctx.lineTo(face.x + face.w, face.y + face.h - r);
            ctx.quadraticCurveTo(face.x + face.w, face.y + face.h, face.x + face.w - r, face.y + face.h);
            ctx.lineTo(face.x + r, face.y + face.h);
            ctx.quadraticCurveTo(face.x, face.y + face.h, face.x, face.y + face.h - r);
            ctx.lineTo(face.x, face.y + r);
            ctx.quadraticCurveTo(face.x, face.y, face.x + r, face.y);
            ctx.closePath();
            ctx.stroke();

            const label = face.name;
            ctx.font = '600 11px Inter, sans-serif';
            const tw = ctx.measureText(label).width;
            const pad = 6;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(face.x, face.y + face.h + 4, tw + pad * 2, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(label, face.x + pad, face.y + face.h + 18);

            // corner dots
            const dotR = 3;
            ctx.fillStyle = color;
            [[face.x, face.y], [face.x + face.w, face.y], [face.x, face.y + face.h], [face.x + face.w, face.y + face.h]].forEach(([dx, dy]) => {
                ctx.beginPath();
                ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function populateFacesList(faces) {
        facesList.innerHTML = '';
        faces.forEach((face, i) => {
            const div = document.createElement('div');
            div.className = 'face-item';
            div.innerHTML = `
                <div class="face-thumb">${face.name.charAt(face.name.length - 1)}</div>
                <div class="face-info">
                    <strong>${face.name}</strong>
                    <span>Confidence: ${(85 + Math.random() * 14).toFixed(1)}%</span>
                </div>
                <input type="checkbox" class="face-checkbox" checked>
            `;
            facesList.appendChild(div);
        });
    }

    clearBtn.addEventListener('click', () => {
        demoResult.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';
        fileInput.value = '';
        facesList.innerHTML = '';
    });

    shareBtn.addEventListener('click', () => {
        const checked = facesList.querySelectorAll('.face-checkbox:checked').length;
        if (checked > 0) {
            shareBtn.textContent = `Shared with ${checked} person${checked > 1 ? 's' : ''}!`;
            shareBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            setTimeout(() => {
                shareBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share Selected';
                shareBtn.style.background = '';
            }, 2000);
        }
    });

    // ---- Counter animation ----
    const statNumbers = document.querySelectorAll('.stat-number');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    statNumbers.forEach(el => counterObserver.observe(el));

    function animateCounter(el) {
        const text = el.textContent;
        const match = text.match(/([\d.]+)([MK+%]*)/);
        if (!match) return;
        const target = parseFloat(match[1]);
        const suffix = match[2];
        const duration = 1500;
        const start = performance.now();

        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            el.textContent = (target >= 10 ? Math.floor(current) : current.toFixed(1)) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
});
