/**
 * Prezi Studio Pro - Professional 3D Spatial Presentation Engine
 * Powered by Three.js (CSS3DRenderer) & GSAP
 */

document.addEventListener('DOMContentLoaded', function () {
    console.log('✨ Initializing Prezi Studio Pro Engine...');

    // --- State & Config ---
    const container = document.getElementById('presentation-container');
    const initialData = window.PRESENTATION_DATA || { Slides: [] };
    let slides = [];
    let currentSlideIndex = 0;
    let isPresenting = false;
    let laserPointerActive = false;
    let presentationStartTime = null;
    let presentationTimerInterval = null;
    let activeTool = 'select'; // 'select' | 'hand'
    let isPanningCanvas = false;
    let panStartX = 0, panStartY = 0;
    let camStartX = 0, camStartY = 0;
    let autoSaveTimer = null;
    let showFlightPaths = true;

    // --- Active Selected References ---
    let selectedSlide = null;
    let selectedElement = null;
    let isDraggingElement = false;
    let elemDragStartX = 0, elemDragStartY = 0, elemStartX = 0, elemStartY = 0;

    // --- Three.js Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 50000);
    camera.position.set(0, 0, 3500);

    const renderer = new THREE.CSS3DRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    container.appendChild(renderer.domElement);

    // Dynamic 3D Deep Space Canvas Background
    const bgEl = document.createElement('div');
    bgEl.style.width = '50000px';
    bgEl.style.height = '35000px';
    bgEl.style.position = 'absolute';
    bgEl.style.pointerEvents = 'none';
    bgEl.style.userSelect = 'none';
    bgEl.style.background = 'radial-gradient(circle at center, #111a2e 0%, #070b14 100%)';
    const bgObject = new THREE.CSS3DObject(bgEl);
    bgObject.position.set(0, 0, -8000);
    scene.add(bgObject);

    // Window Resize Handler
    window.addEventListener('resize', onResize);
    function onResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        updateFlightPaths();
    }

    // Render / Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        if (showFlightPaths) {
            updateFlightPaths();
        }
    }
    animate();

    // =========================================================================
    // Slide Object & UI Builders
    // =========================================================================

    function createSlideDOM(slideData, index) {
        const el = document.createElement('div');
        el.id = slideData.Id || ('slide-' + Date.now());
        el.className = `step slide slide-shape-${slideData.Shape || 'rounded'}`;
        el.dataset.index = index;
        el.dataset.title = slideData.Title || (el.id === 'overview' ? 'Бүх сэдвийн тойм' : `Сэдэв ${index}`);
        el.dataset.x = slideData.X || 0;
        el.dataset.y = slideData.Y || 0;
        el.dataset.z = slideData.Z || 0;
        el.dataset.rotate = slideData.Rotate || 0;
        el.dataset.scale = slideData.Scale || 1;
        el.dataset.shape = slideData.Shape || 'rounded';
        el.dataset.bgcolor = slideData.BgColor || '#1e293b';
        el.dataset.opacity = slideData.BgOpacity !== undefined ? slideData.BgOpacity : 0.85;
        el.dataset.bordercolor = slideData.BorderColor || 'rgba(255, 255, 255, 0.15)';
        el.dataset.accentcolor = slideData.AccentColor || '#38bdf8';

        if (el.id !== 'overview') {
            const content = document.createElement('div');
            content.className = 'slide-content';
            content.style.backgroundColor = el.dataset.bgcolor;
            content.style.opacity = el.dataset.opacity;
            content.style.borderColor = el.dataset.bordercolor;

            // Append elements
            if (slideData.Elements && slideData.Elements.length > 0) {
                slideData.Elements.forEach(item => {
                    const elemDiv = createSlideElementDOM(item);
                    content.appendChild(elemDiv);
                });
            }

            el.appendChild(content);

            // Add Prezi UI: Badge & Zoom In button
            const badge = document.createElement('div');
            badge.className = 'slide-badge';
            badge.textContent = index;
            el.appendChild(badge);

            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-in-btn';
            zoomBtn.innerHTML = '🔍 Томруулах';
            zoomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                gotoSlide(index);
            });
            el.appendChild(zoomBtn);

            // 4 Resize handles
            ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
                const h = document.createElement('div');
                h.className = `resize-handle ${pos}`;
                h.dataset.corner = pos;
                el.appendChild(h);
            });
        }

        bindSlideEvents(el);
        return el;
    }

    function createSlideElementDOM(item) {
        const div = document.createElement('div');
        div.id = item.Id || ('el-' + Date.now() + Math.floor(Math.random() * 1000));
        div.className = 'slide-element';
        div.dataset.type = item.Type || 'text';
        div.style.position = 'absolute';
        div.style.left = (item.X || 50) + 'px';
        div.style.top = (item.Y || 50) + 'px';
        div.style.width = (item.Width || 300) + 'px';
        div.style.height = (item.Height || 100) + 'px';
        if (item.Style) {
            div.style.cssText += ';' + item.Style;
        }
        div.innerHTML = item.Content || '<p>Энд бичнэ үү</p>';
        initSlideElement(div);
        return div;
    }

    function buildSlidesFromData(data) {
        // Clear scene slides
        slides.forEach(s => {
            scene.remove(s.object);
            if (s.element.parentNode) s.element.parentNode.removeChild(s.element);
        });
        slides = [];

        const slideList = data.Slides || [];
        slideList.forEach((sData, idx) => {
            const el = createSlideDOM(sData, idx);
            container.appendChild(el);

            const cssObject = new THREE.CSS3DObject(el);
            const x = parseFloat(sData.X) || 0;
            const y = parseFloat(sData.Y) || 0;
            const z = parseFloat(sData.Z) || 0;
            const rotDeg = parseFloat(sData.Rotate) || 0;
            const scale = parseFloat(sData.Scale) || 1;

            cssObject.position.set(x, y, z);
            cssObject.rotation.z = THREE.MathUtils.degToRad(rotDeg);
            cssObject.scale.set(scale, scale, scale);
            scene.add(cssObject);

            slides.push({
                id: el.id,
                title: el.dataset.title,
                element: el,
                object: cssObject,
                scale: scale,
                rotate: rotDeg
            });
        });

        rebuildSidebar();
        updateCounterHUD();
        updateFlightPaths();

        // Initial view
        const overviewIdx = slides.findIndex(s => s.element.id === 'overview');
        if (overviewIdx !== -1) {
            gotoSlide(overviewIdx, 0.5);
        } else if (slides.length > 0) {
            gotoSlide(0, 0.5);
        }
    }

    // =========================================================================
    // Sidebar & Navigation
    // =========================================================================

    let draggedSidebarIndex = null;

    function rebuildSidebar() {
        const sidebar = document.getElementById('sidebar-frames');
        if (!sidebar) return;
        sidebar.innerHTML = '';

        const badge = document.getElementById('slide-count-badge');
        if (badge) badge.textContent = slides.filter(s => s.element.id !== 'overview').length;

        slides.forEach((slide, index) => {
            const isOverview = slide.element.id === 'overview';
            const frameItem = document.createElement('div');
            frameItem.className = 'frame-item';
            frameItem.dataset.index = index;
            frameItem.draggable = !isOverview;
            if (index === currentSlideIndex) frameItem.classList.add('active');

            // Drag and drop ordering
            if (!isOverview) {
                frameItem.addEventListener('dragstart', (e) => {
                    draggedSidebarIndex = index;
                    e.dataTransfer.effectAllowed = 'move';
                    setTimeout(() => frameItem.classList.add('dragging'), 0);
                });

                frameItem.addEventListener('dragend', () => {
                    frameItem.classList.remove('dragging');
                    draggedSidebarIndex = null;
                    document.querySelectorAll('.frame-item').forEach(f => f.classList.remove('drag-over-top', 'drag-over-bottom'));
                });

                frameItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedSidebarIndex === null || draggedSidebarIndex === index) return;
                    const rect = frameItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        frameItem.classList.add('drag-over-top');
                        frameItem.classList.remove('drag-over-bottom');
                    } else {
                        frameItem.classList.add('drag-over-bottom');
                        frameItem.classList.remove('drag-over-top');
                    }
                });

                frameItem.addEventListener('dragleave', () => {
                    frameItem.classList.remove('drag-over-top', 'drag-over-bottom');
                });

                frameItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    frameItem.classList.remove('drag-over-top', 'drag-over-bottom');
                    if (draggedSidebarIndex !== null && draggedSidebarIndex !== index) {
                        const moved = slides.splice(draggedSidebarIndex, 1)[0];
                        let dropIdx = index;
                        const rect = frameItem.getBoundingClientRect();
                        if (e.clientY >= rect.top + rect.height / 2) dropIdx++;
                        if (draggedSidebarIndex < dropIdx) dropIdx--;
                        slides.splice(dropIdx, 0, moved);

                        slides.forEach((s, i) => { s.element.dataset.index = i; });
                        rebuildSidebar();
                        updateCounterHUD();
                        updateFlightPaths();
                        scheduleAutoSave();
                    }
                });
            }

            // Thumbnail content
            const frameNum = document.createElement('div');
            frameNum.className = 'frame-number';
            frameNum.textContent = isOverview ? '🌐' : index;

            const frameThumb = document.createElement('div');
            frameThumb.className = 'frame-thumb';

            const shape = slide.element.dataset.shape || 'rounded';
            const shapeLabel = shape === 'circle' ? 'Тойрог' : (shape === 'bracket' ? 'Хаалт' : (shape === 'invisible' ? 'Тойм' : 'Карт'));

            frameThumb.innerHTML = `
                <div class="frame-thumb-title">${slide.element.dataset.title || ('Слайд ' + index)}</div>
                <div class="frame-thumb-meta">
                    <span class="frame-shape-tag">${shapeLabel}</span>
                    <span>${Math.round(slide.rotate || 0)}°</span>
                </div>
            `;

            // Quick actions on hover
            if (!isOverview) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'frame-quick-actions';

                const dupBtn = document.createElement('button');
                dupBtn.className = 'thumb-action-btn';
                dupBtn.title = 'Хувилах (Duplicate)';
                dupBtn.innerHTML = '📋';
                dupBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    duplicateSlide(index);
                });

                const delBtn = document.createElement('button');
                delBtn.className = 'thumb-action-btn';
                delBtn.title = 'Устгах';
                delBtn.innerHTML = '🗑️';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSlide(index);
                });

                actionsDiv.appendChild(dupBtn);
                actionsDiv.appendChild(delBtn);
                frameThumb.appendChild(actionsDiv);
            }

            frameItem.appendChild(frameNum);
            frameItem.appendChild(frameThumb);

            frameItem.addEventListener('click', () => {
                gotoSlide(index);
            });

            sidebar.appendChild(frameItem);
        });
    }

    // =========================================================================
    // Prezi Cinematic 3D Navigation (GSAP Camera Flight)
    // =========================================================================

    function gotoSlide(index, customDuration = 1.2) {
        if (index < 0 || index >= slides.length) return;

        currentSlideIndex = index;
        const target = slides[currentSlideIndex];

        // Active class updates
        slides.forEach(s => s.element.classList.remove('active'));
        target.element.classList.add('active');

        // Sidebar active
        document.querySelectorAll('.frame-item').forEach((item, idx) => {
            if (idx === index) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Calculate Camera Distance
        const isOverview = target.element.id === 'overview';
        const baseDistance = 1400;
        const targetZ = isOverview ? 4500 : (baseDistance * (target.scale || 1));

        // Calculate Prezi Rotation Alignment:
        // When camera rotates to align with slide, camera.rotation.z = -target.rotation.z
        const targetRotZ = isOverview ? 0 : -THREE.MathUtils.degToRad(target.rotate || 0);

        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(camera.rotation);

        gsap.to(camera.position, {
            x: target.object.position.x,
            y: target.object.position.y,
            z: targetZ,
            duration: customDuration,
            ease: "power3.inOut"
        });

        gsap.to(camera.rotation, {
            z: targetRotZ,
            duration: customDuration,
            ease: "power3.inOut"
        });

        updateCounterHUD();

        // If in editor, select this slide in inspector
        if (!isPresenting) {
            selectSlide(target);
        }
    }

    function nextSlide() {
        const overviewIdx = slides.findIndex(s => s.element.id === 'overview');
        if (overviewIdx !== -1 && currentSlideIndex === overviewIdx) {
            // From overview go to first real slide
            const firstReal = slides.findIndex(s => s.element.id !== 'overview');
            gotoSlide(firstReal !== -1 ? firstReal : 0);
        } else {
            const nextIdx = Math.min(currentSlideIndex + 1, slides.length - 1);
            gotoSlide(nextIdx);
        }
    }

    function prevSlide() {
        const overviewIdx = slides.findIndex(s => s.element.id === 'overview');
        const firstReal = slides.findIndex(s => s.element.id !== 'overview');
        if (overviewIdx !== -1 && currentSlideIndex === firstReal) {
            gotoSlide(overviewIdx);
        } else {
            const prevIdx = Math.max(currentSlideIndex - 1, 0);
            gotoSlide(prevIdx);
        }
    }

    function updateCounterHUD() {
        const realSlides = slides.filter(s => s.element.id !== 'overview');
        const currentTarget = slides[currentSlideIndex];
        const isOverview = currentTarget && currentTarget.element.id === 'overview';

        let displayIdx = isOverview ? 'Тойм' : (slides.indexOf(currentTarget));
        let total = realSlides.length;

        const hudCounter = document.getElementById('hud-slide-counter');
        if (hudCounter) hudCounter.textContent = `${displayIdx} / ${total}`;

        const presCounter = document.getElementById('pres-hud-counter');
        if (presCounter) presCounter.textContent = `${displayIdx} / ${total}`;

        const progBar = document.getElementById('pres-progress-bar');
        if (progBar) {
            const pct = isOverview ? 100 : Math.round((slides.indexOf(currentTarget) / Math.max(total, 1)) * 100);
            progBar.style.width = pct + '%';
        }
    }

    // =========================================================================
    // Prezi Dynamic 3D Flight Paths Projection
    // =========================================================================

    function updateFlightPaths() {
        const g = document.getElementById('path-lines-group');
        if (!g) return;

        const realSlides = slides.filter(s => s.element.id !== 'overview');
        if (realSlides.length < 2) {
            g.innerHTML = '';
            return;
        }

        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;

        const screenPoints = realSlides.map(s => {
            const pos = s.object.position.clone();
            pos.project(camera);
            return {
                x: (pos.x * widthHalf) + widthHalf,
                y: -(pos.y * heightHalf) + heightHalf,
                visible: pos.z < 1
            };
        });

        let pathD = '';
        for (let i = 0; i < screenPoints.length - 1; i++) {
            const p1 = screenPoints[i];
            const p2 = screenPoints[i + 1];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2 - 40; // slight arc curve

            if (i === 0) {
                pathD += `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y} `;
            } else {
                pathD += `Q ${midX} ${midY} ${p2.x} ${p2.y} `;
            }
        }

        g.innerHTML = `<path d="${pathD}" class="prezi-flight-path" />`;
    }

    // =========================================================================
    // WYSIWYG & Slide Elements Management
    // =========================================================================

    function initSlideElement(el) {
        el.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || isPresenting) return;
            e.stopPropagation();

            selectElement(el);

            isDraggingElement = true;
            elemDragStartX = e.clientX;
            elemDragStartY = e.clientY;
            elemStartX = parseFloat(el.style.left) || 0;
            elemStartY = parseFloat(el.style.top) || 0;
        });

        el.addEventListener('dblclick', function (e) {
            if (isPresenting) return;
            e.stopPropagation();
            el.setAttribute('contenteditable', 'true');
            el.focus();
            showTextToolbar(el);
        });

        el.addEventListener('blur', function () {
            el.setAttribute('contenteditable', 'false');
            scheduleAutoSave();
        });
    }

    function selectElement(el) {
        document.querySelectorAll('.slide-element').forEach(s => s.classList.remove('selected-element'));
        el.classList.add('selected-element');
        selectedElement = el;
        showTextToolbar(el);
        showInspectorForElement(el);
    }

    function selectSlide(slideData) {
        selectedSlide = slideData;
        slides.forEach(s => s.element.classList.remove('editor-selected'));
        if (slideData.element.id !== 'overview') {
            slideData.element.classList.add('editor-selected');
        }
        showInspectorForSlide(slideData);
    }

    function showTextToolbar(el) {
        const toolbar = document.getElementById('text-format-toolbar');
        if (!toolbar) return;

        const rect = el.getBoundingClientRect();
        toolbar.style.display = 'flex';
        toolbar.style.left = (rect.left + rect.width / 2) + 'px';
        toolbar.style.top = (rect.top - 10) + 'px';
    }

    function hideTextToolbar() {
        const toolbar = document.getElementById('text-format-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    }

    // Element Dragging
    document.addEventListener('mousemove', function (e) {
        if (isDraggingElement && selectedElement && !isPresenting) {
            const currentSlide = slides[currentSlideIndex];
            const distance = camera.position.distanceTo(currentSlide.object.position);
            const factor = distance > 0 ? (distance / 1200) : 1;

            const deltaX = (e.clientX - elemDragStartX) * factor;
            const deltaY = (e.clientY - elemDragStartY) * factor;

            selectedElement.style.left = Math.round(elemStartX + deltaX) + 'px';
            selectedElement.style.top = Math.round(elemStartY + deltaY) + 'px';
            showTextToolbar(selectedElement);
        }

        // Canvas Pan Tool
        if (isPanningCanvas && activeTool === 'hand') {
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            camera.position.x = camStartX - (dx * (camera.position.z / 1000));
            camera.position.y = camStartY + (dy * (camera.position.z / 1000));
        }

        // Laser pointer dot tracking
        if (laserPointerActive) {
            const dot = document.getElementById('laser-pointer-dot');
            if (dot) {
                dot.style.left = e.clientX + 'px';
                dot.style.top = e.clientY + 'px';
            }
        }
    });

    document.addEventListener('mouseup', function () {
        if (isDraggingElement) {
            isDraggingElement = false;
            scheduleAutoSave();
        }
        if (isPanningCanvas) {
            isPanningCanvas = false;
        }
    });

    // Slide Binding (Dragging & Selection)
    function bindSlideEvents(el) {
        el.addEventListener('mousedown', function (e) {
            if (isPresenting) return;
            if (e.target.closest('.slide-element') || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

            const slideData = slides.find(s => s.element === el);
            if (slideData) {
                selectSlide(slideData);
            }
        });
    }

    // =========================================================================
    // Content Authoring & Templates (Агуулга оруулах)
    // =========================================================================

    function addSlideWithTemplate(templateType) {
        const id = 'slide-' + Date.now();
        const lastSlide = slides[slides.length - 1];

        // Spatial arrangement: Serpentine / Spiral path with dynamic Prezi rotation!
        const step = slides.length;
        const radius = 1800;
        const angle = (step * 0.9); // radians
        const nx = Math.round(Math.cos(angle) * (radius + step * 100));
        const ny = Math.round(Math.sin(angle) * (radius + step * 100));
        const rotDeg = Math.round(((step % 2 === 0 ? 1 : -1) * (10 + (step * 3))) % 360);

        const newSlideData = {
            Id: id,
            Title: getTemplateDefaultTitle(templateType),
            X: nx,
            Y: ny,
            Z: 0,
            Rotate: rotDeg,
            Scale: 1.0,
            Shape: templateType === 'circle' ? 'circle' : (templateType === 'quote' ? 'bracket' : 'rounded'),
            BgColor: '#131b2e',
            BgOpacity: 0.9,
            BorderColor: 'rgba(56, 189, 248, 0.3)',
            AccentColor: '#38bdf8',
            Elements: buildTemplateElements(templateType)
        };

        const el = createSlideDOM(newSlideData, slides.length);
        container.appendChild(el);

        const cssObject = new THREE.CSS3DObject(el);
        cssObject.position.set(nx, ny, 0);
        cssObject.rotation.z = THREE.MathUtils.degToRad(rotDeg);
        cssObject.scale.set(1, 1, 1);
        scene.add(cssObject);

        const newIndex = slides.length;
        slides.push({
            id: id,
            title: newSlideData.Title,
            element: el,
            object: cssObject,
            scale: 1,
            rotate: rotDeg
        });

        rebuildSidebar();
        gotoSlide(newIndex);
        showToast('✨ Шинэ сэдэв амжилттай нэмэгдлээ!', 'success');
        scheduleAutoSave();
    }

    function getTemplateDefaultTitle(type) {
        switch (type) {
            case 'hero': return 'Танилцуулга гарчиг';
            case 'three-cards': return 'Гол үзүүлэлтүүд (KPI)';
            case 'split-feature': return 'Онцлох давуу талууд';
            case 'timeline': return 'Хөгжлийн үе шат';
            case 'quote': return 'Ишлэл & Дүгнэлт';
            case 'circle': return 'Прези тойрог сэдэв';
            default: return 'Шинэ слайд';
        }
    }

    function buildTemplateElements(type) {
        switch (type) {
            case 'hero':
                return [
                    { Id: 'el-h-badge', Type: 'badge', Content: '<span class="badge-pill">🌟 Шинэ танилцуулга</span>', X: 60, Y: 60, Width: 260, Height: 40 },
                    { Id: 'el-h-title', Type: 'text', Content: '<h1 class="hero-title-text">Бизнес Өсөлтийн<br/><span class="text-gradient">Шинэ Стратеги 2026</span></h1>', X: 60, Y: 120, Width: 840, Height: 200 },
                    { Id: 'el-h-sub', Type: 'text', Content: '<p class="hero-subtitle-text">Дэлхийн жишигт нийцсэн шийдэл, хэрэглэгчийн туршлага болон 3D динамик үзүүлбэр.</p>', X: 60, Y: 350, Width: 800, Height: 80 }
                ];
            case 'three-cards':
                return [
                    { Id: 'el-tc-title', Type: 'text', Content: '<h2>Зорилт & <span style="color:#10b981;">KPI Үзүүлэлт</span></h2>', X: 60, Y: 50, Width: 840, Height: 60 },
                    {
                        Id: 'el-tc-grid', Type: 'card', Content: `<div class="three-cards-grid">
                            <div class="feature-card"><div class="card-icon">⚡</div><h3>+300%</h3><h4>Хурд</h4><p>Бүтээмжийн өсөлт ба автоматжуулалт.</p></div>
                            <div class="feature-card highlight"><div class="card-icon">🎯</div><h3>99.9%</h3><h4>Найдвартай</h4><p>Хэрэглэгчдийн өндөр сэтгэл ханамж.</p></div>
                            <div class="feature-card"><div class="card-icon">💎</div><h3>Тэргүүлэгч</h3><h4>Чанар</h4><p>Мэргэжлийн өндөр стандарт.</p></div>
                        </div>`, X: 60, Y: 140, Width: 840, Height: 440
                    }
                ];
            case 'split-feature':
                return [
                    { Id: 'el-sf-title', Type: 'text', Content: '<h2>Дижитал <span style="color:#38bdf8;">Инноваци</span></h2>', X: 60, Y: 50, Width: 840, Height: 60 },
                    {
                        Id: 'el-sf-img', Type: 'image', Content: '<img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80" style="width:100%; height:100%; object-fit:cover; border-radius:16px;" draggable="false" />',
                        X: 60, Y: 130, Width: 400, Height: 420
                    },
                    {
                        Id: 'el-sf-list', Type: 'text', Content: `<div style="font-size:16px; line-height:1.8; color:#f1f5f9;">
                            <p>✅ <strong>3D Орон зайн шилжилт</strong>: Сэдвүүдийг сонирхолтой холбоно</p>
                            <p>✅ <strong>Агуулга хялбар оруулах</strong>: Хэдхэн хоромд бэлтгэнэ</p>
                            <p>✅ <strong>Мэргэжлийн загварууд</strong>: Бэлэн картууд ба дүрсүүд</p>
                            <p>✅ <strong>Бүтэн дэлгэцийн горим</strong>: Лазер заагчтай танилцуулга</p>
                        </div>`, X: 490, Y: 160, Width: 410, Height: 360
                    }
                ];
            case 'timeline':
                return [
                    { Id: 'el-tl-title', Type: 'text', Content: '<h2>Хөгжлийн <span style="color:#a855f7;">4 Үе Шат</span></h2>', X: 60, Y: 50, Width: 840, Height: 60 },
                    {
                        Id: 'el-tl-steps', Type: 'card', Content: `<div class="timeline-row">
                            <div class="timeline-step"><div class="step-badge">01</div><h4>Судалгаа</h4><p>Хэрэгцээ шаардлага тодорхойлох.</p></div>
                            <div class="timeline-arrow">➔</div>
                            <div class="timeline-step"><div class="step-badge">02</div><h4>Төлөвлөлт</h4><p>Бүтэц, архитектур боловсруулах.</p></div>
                            <div class="timeline-arrow">➔</div>
                            <div class="timeline-step active"><div class="step-badge">03</div><h4>Гүйцэтгэл</h4><p>3D загварчлал, агуулга бэлдэх.</p></div>
                            <div class="timeline-arrow">➔</div>
                            <div class="timeline-step"><div class="step-badge">04</div><h4>Үр дүн</h4><p>Амжилттай танилцуулах.</p></div>
                        </div>`, X: 50, Y: 180, Width: 860, Height: 400
                    }
                ];
            case 'quote':
                return [
                    {
                        Id: 'el-q-content', Type: 'card', Content: `<div class="quote-container">
                            <div class="quote-mark">“</div>
                            <blockquote class="quote-text">Энгийн байдал бол хамгийн дээд зэргийн боловсронгуй чанар юм.</blockquote>
                            <div class="quote-author">— Леонардо да Винчи</div>
                        </div>`, X: 60, Y: 100, Width: 840, Height: 440
                    }
                ];
            case 'circle':
                return [
                    { Id: 'el-c-title', Type: 'text', Content: '<h2 style="text-align:center; font-size:36px;">Гол Сэдэв</h2><p style="text-align:center; opacity:0.8;">Презигийн сонгодог дугуй хүрээ</p>', X: 110, Y: 180, Width: 500, Height: 120 }
                ];
            default:
                return [
                    { Id: 'el-b-title', Type: 'text', Content: '<h2>Гарчиг бичих</h2>', X: 60, Y: 60, Width: 400, Height: 80 }
                ];
        }
    }

    function duplicateSlide(index) {
        const source = slides[index];
        if (!source || source.element.id === 'overview') return;

        const newId = 'slide-' + Date.now();
        const cloneData = {
            Id: newId,
            Title: (source.element.dataset.title || 'Слайд') + ' (Хуулбар)',
            X: source.object.position.x + 400,
            Y: source.object.position.y + 200,
            Z: source.object.position.z,
            Rotate: source.rotate,
            Scale: source.scale,
            Shape: source.element.dataset.shape || 'rounded',
            BgColor: source.element.dataset.bgcolor || '#1e293b',
            BgOpacity: parseFloat(source.element.dataset.opacity) || 0.85,
            BorderColor: source.element.dataset.bordercolor || 'rgba(255,255,255,0.2)',
            Elements: []
        };

        // Clone elements
        source.element.querySelectorAll('.slide-element').forEach(el => {
            cloneData.Elements.push({
                Id: 'el-' + Date.now() + Math.floor(Math.random() * 1000),
                Type: el.dataset.type,
                Content: el.innerHTML,
                X: parseFloat(el.style.left) || 50,
                Y: parseFloat(el.style.top) || 50,
                Width: parseFloat(el.style.width) || 300,
                Height: parseFloat(el.style.height) || 100,
                Style: el.getAttribute('style') || ''
            });
        });

        const newEl = createSlideDOM(cloneData, slides.length);
        container.appendChild(newEl);

        const cssObject = new THREE.CSS3DObject(newEl);
        cssObject.position.set(cloneData.X, cloneData.Y, cloneData.Z);
        cssObject.rotation.z = THREE.MathUtils.degToRad(cloneData.Rotate);
        cssObject.scale.set(cloneData.Scale, cloneData.Scale, cloneData.Scale);
        scene.add(cssObject);

        slides.push({
            id: newId,
            title: cloneData.Title,
            element: newEl,
            object: cssObject,
            scale: cloneData.Scale,
            rotate: cloneData.Rotate
        });

        rebuildSidebar();
        gotoSlide(slides.length - 1);
        showToast('📋 Слайд хувилагдлаа!', 'success');
        scheduleAutoSave();
    }

    function deleteSlide(index) {
        const slide = slides[index];
        if (!slide || slide.element.id === 'overview') return;

        if (confirm(`"${slide.element.dataset.title || 'Слайд'}"-г устгах уу?`)) {
            scene.remove(slide.object);
            if (slide.element.parentNode) slide.element.parentNode.removeChild(slide.element);
            slides.splice(index, 1);

            slides.forEach((s, i) => { s.element.dataset.index = i; });
            rebuildSidebar();
            gotoSlide(Math.max(0, index - 1));
            showToast('🗑️ Слайд устгагдлаа', 'info');
            scheduleAutoSave();
        }
    }

    // =========================================================================
    // Quick Outline Importer (Агуулга хялбар оруулах горим)
    // =========================================================================

    const importerModal = document.getElementById('importer-modal');
    const openImporterBtn = document.getElementById('btn-open-importer');
    const closeImporterBtn = document.getElementById('btn-close-importer');
    const cancelImporterBtn = document.getElementById('btn-cancel-importer');
    const generateSlidesBtn = document.getElementById('btn-generate-slides');
    const importerTextarea = document.getElementById('importer-textarea');

    if (openImporterBtn) {
        openImporterBtn.addEventListener('click', () => {
            if (importerModal) importerModal.style.display = 'flex';
        });
    }

    function closeImporter() {
        if (importerModal) importerModal.style.display = 'none';
    }

    if (closeImporterBtn) closeImporterBtn.addEventListener('click', closeImporter);
    if (cancelImporterBtn) cancelImporterBtn.addEventListener('click', closeImporter);

    // Sample Outline Fillers
    document.querySelectorAll('.sample-fill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sampleType = btn.dataset.sample;
            if (sampleType === 'business') {
                importerTextarea.value = `# 1. Зах зээлийн боломж
- Манай салбарын зах зээл жилд 25% өсөж байна
- Хэрэглэгчид дижитал шийдлийг илүүд үзэж байна
- Өрсөлдөгчдийн дутагдалтай талуудыг нөхөх боломж
# 2. Бидний санал болгох шийдэл
- Хэрэглэхэд туйлын хялбар, ойлгомжтой систем
- Хиймэл оюунд суурилсан автоматжуулалт
- Зах зээлд 2 дахин бага үнээр нэвтрүүлэх
# 3. Гол зорилт & Хүлээгдэж буй үр дүн
- Эхний жилд 10,000 идэвхтэй хэрэглэгчтэй болох
- Нийт зардлыг 40% бууруулж ашгийг нэмэгдүүлэх
- Салбартаа шилдэг инновацийн шагнал авах`;
            } else if (sampleType === 'product') {
                importerTextarea.value = `# 1. Бүтээгдэхүүний онцлог
- 3D Прези орон зайд динамик шилжилт
- Хялбар чирэх, зөөх, засварлах боломж
- Өндөр нарийвчлалтай дүрслэл ба гар утасны дэмжлэг
# 2. Хэрэглэгчдэд өгөх үнэ цэнэ
- Танилцуулга бэлтгэх хугацааг 5 дахин хэмнэнэ
- Үзэгчдийн анхаарлыг бүрэн татаж сэтгэгдэл төрүүлнэ
- Хаанаас ч онлайнаар хадгалж хамтран ажиллана`;
            } else {
                importerTextarea.value = `# 1. Төслийн явц & Гүйцэтгэл
- Нийт төлөвлөгөөт ажлын 85% бүрэн биеллээ
- Чанарын туршилтууд амжилттай хийгдсэн
# 2. Дараагийн алхмууд
- Системийн аюулгүй байдлын аудит хийх
- Хэрэглэгчдэд зориулсан сургалт зохион байгуулах
- Албан ёсны нээлтийн арга хэмжээ зохион байгуулах`;
            }
        });
    });

    if (generateSlidesBtn) {
        generateSlidesBtn.addEventListener('click', () => {
            const rawText = importerTextarea.value.trim();
            if (!rawText) {
                alert('Агуулгын бичвэрээ оруулна уу!');
                return;
            }

            const sections = rawText.split(/(?=#\s)/g).map(s => s.trim()).filter(s => s.length > 0);
            if (sections.length === 0) {
                alert('Ядаж нэг "# Гарчиг" оруулна уу!');
                return;
            }

            sections.forEach((sec, idx) => {
                const lines = sec.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const titleLine = lines[0].replace(/^#+\s*/, '');
                const bulletLines = lines.slice(1).map(l => l.replace(/^[-*•]\s*/, ''));

                const id = 'slide-' + Date.now() + '-' + idx;
                const radius = 1600;
                const angle = ((slides.length + idx) * 1.1);
                const nx = Math.round(Math.cos(angle) * (radius + (slides.length + idx) * 120));
                const ny = Math.round(Math.sin(angle) * (radius + (slides.length + idx) * 120));
                const rotDeg = Math.round(((idx % 2 === 0 ? 1 : -1) * (8 + (idx * 4))) % 360);

                const bulletHtml = bulletLines.map(b => `<li style="margin-bottom:12px;">${b}</li>`).join('');

                const newSlideData = {
                    Id: id,
                    Title: titleLine,
                    X: nx,
                    Y: ny,
                    Z: 0,
                    Rotate: rotDeg,
                    Scale: 1.0,
                    Shape: 'rounded',
                    BgColor: '#131b2e',
                    BgOpacity: 0.9,
                    BorderColor: 'rgba(56, 189, 248, 0.4)',
                    AccentColor: '#38bdf8',
                    Elements: [
                        {
                            Id: 'el-title-' + Date.now() + '-' + idx,
                            Type: 'text',
                            Content: `<h2>${titleLine}</h2>`,
                            X: 60, Y: 60, Width: 840, Height: 70
                        },
                        {
                            Id: 'el-body-' + Date.now() + '-' + idx,
                            Type: 'text',
                            Content: `<ul style="font-size:18px; line-height:1.7; color:#f1f5f9; padding-left:24px;">${bulletHtml}</ul>`,
                            X: 60, Y: 160, Width: 840, Height: 420
                        }
                    ]
                };

                const el = createSlideDOM(newSlideData, slides.length);
                container.appendChild(el);

                const cssObject = new THREE.CSS3DObject(el);
                cssObject.position.set(nx, ny, 0);
                cssObject.rotation.z = THREE.MathUtils.degToRad(rotDeg);
                cssObject.scale.set(1, 1, 1);
                scene.add(cssObject);

                slides.push({
                    id: id,
                    title: newSlideData.Title,
                    element: el,
                    object: cssObject,
                    scale: 1,
                    rotate: rotDeg
                });
            });

            rebuildSidebar();
            closeImporter();
            gotoSlide(slides.length - sections.length);
            showToast(`✨ ${sections.length} шинэ сэдэв амжилттай үүсгэгдлээ!`, 'success');
            scheduleAutoSave();
        });
    }

    // =========================================================================
    // Media & Image Uploader
    // =========================================================================

    const mediaModal = document.getElementById('media-modal');
    const openMediaBtn = document.getElementById('btn-open-media-modal');
    const closeMediaBtn = document.getElementById('btn-close-media');
    const imageFileInput = document.getElementById('image-file-input');
    const fileDropzone = document.getElementById('file-dropzone');
    const uploadProgressBox = document.getElementById('upload-progress-box');
    const btnInsertUrlImage = document.getElementById('btn-insert-url-image');
    const imageUrlInput = document.getElementById('image-url-input');

    if (openMediaBtn) {
        openMediaBtn.addEventListener('click', () => {
            if (mediaModal) mediaModal.style.display = 'flex';
        });
    }

    function closeMediaModal() {
        if (mediaModal) mediaModal.style.display = 'none';
    }

    if (closeMediaBtn) closeMediaBtn.addEventListener('click', closeMediaModal);

    // Media Tabs
    document.querySelectorAll('.media-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.media-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            const targetPane = document.getElementById('tab-pane-' + tab.dataset.tab);
            if (targetPane) targetPane.style.display = 'block';
        });
    });

    // Curated gallery presets
    const curatedImages = [
        { name: 'Бизнес Аналитик', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80' },
        { name: 'Багийн Ажиллагаа', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80' },
        { name: 'Дижитал Инноваци', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80' },
        { name: 'Хиймэл Оюун Ухаан', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80' },
        { name: 'Стратеги & Зорилт', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80' },
        { name: 'Орчин Үеийн Оффис', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80' }
    ];

    const galleryGrid = document.getElementById('curated-gallery-grid');
    if (galleryGrid) {
        galleryGrid.innerHTML = '';
        curatedImages.forEach(img => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.innerHTML = `<img src="${img.url}" draggable="false" /><span>${img.name}</span>`;
            card.addEventListener('click', () => {
                insertImageToCurrentSlide(img.url);
                closeMediaModal();
            });
            galleryGrid.appendChild(card);
        });
    }

    // Direct Image File Upload
    if (fileDropzone && imageFileInput) {
        fileDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropzone.classList.add('dragover');
        });

        fileDropzone.addEventListener('dragleave', () => {
            fileDropzone.classList.remove('dragover');
        });

        fileDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        imageFileInput.addEventListener('change', () => {
            if (imageFileInput.files && imageFileInput.files.length > 0) {
                handleFileUpload(imageFileInput.files[0]);
            }
        });
    }

    function handleFileUpload(file) {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        if (uploadProgressBox) uploadProgressBox.style.display = 'block';

        fetch('/Indexpreze?handler=UploadImage', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (uploadProgressBox) uploadProgressBox.style.display = 'none';
                if (data.success && data.url) {
                    insertImageToCurrentSlide(data.url);
                    closeMediaModal();
                    showToast('🖼️ Зураг амжилттай хуулагдлаа!', 'success');
                } else {
                    alert(data.message || 'Зураг хуулахад алдаа гарлаа.');
                }
            })
            .catch(err => {
                if (uploadProgressBox) uploadProgressBox.style.display = 'none';
                console.error(err);
                alert('Зураг хуулах явцад алдаа гарлаа.');
            });
    }

    if (btnInsertUrlImage && imageUrlInput) {
        btnInsertUrlImage.addEventListener('click', () => {
            const url = imageUrlInput.value.trim();
            if (url) {
                insertImageToCurrentSlide(url);
                imageUrlInput.value = '';
                closeMediaModal();
            }
        });
    }

    function insertImageToCurrentSlide(imageUrl) {
        const slide = slides[currentSlideIndex];
        if (!slide || slide.element.id === 'overview') {
            alert('Зураг оруулахын тулд тодорхой сэдвийг сонгоно уу!');
            return;
        }

        const content = slide.element.querySelector('.slide-content');
        if (!content) return;

        const elemData = {
            Id: 'el-img-' + Date.now(),
            Type: 'image',
            Content: `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain; border-radius:12px;" draggable="false" />`,
            X: 100,
            Y: 100,
            Width: 400,
            Height: 300
        };

        const domElem = createSlideElementDOM(elemData);
        content.appendChild(domElem);
        selectElement(domElem);
        scheduleAutoSave();
    }

    // =========================================================================
    // Text Formatting & Inline Toolbar Events
    // =========================================================================

    document.querySelectorAll('.format-btn[data-command]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.command;
            document.execCommand(cmd, false, null);
            scheduleAutoSave();
        });
    });

    const formatHeadingSelect = document.getElementById('format-heading-select');
    if (formatHeadingSelect) {
        formatHeadingSelect.addEventListener('change', () => {
            const tag = formatHeadingSelect.value;
            document.execCommand('formatBlock', false, tag);
            scheduleAutoSave();
        });
    }

    const textColorPicker = document.getElementById('text-color-picker');
    if (textColorPicker) {
        textColorPicker.addEventListener('input', () => {
            document.execCommand('foreColor', false, textColorPicker.value);
            scheduleAutoSave();
        });
    }

    const deleteElemBtn = document.getElementById('btn-delete-element');
    if (deleteElemBtn) {
        deleteElemBtn.addEventListener('click', () => {
            if (selectedElement) {
                selectedElement.remove();
                selectedElement = null;
                hideTextToolbar();
                scheduleAutoSave();
            }
        });
    }

    const dupElemBtn = document.getElementById('btn-duplicate-element');
    if (dupElemBtn) {
        dupElemBtn.addEventListener('click', () => {
            if (selectedElement && selectedElement.parentNode) {
                const clone = selectedElement.cloneNode(true);
                clone.id = 'el-' + Date.now();
                clone.style.left = (parseFloat(selectedElement.style.left) + 20) + 'px';
                clone.style.top = (parseFloat(selectedElement.style.top) + 20) + 'px';
                selectedElement.parentNode.appendChild(clone);
                initSlideElement(clone);
                selectElement(clone);
                scheduleAutoSave();
            }
        });
    }

    // Add Text Button
    const addTextBtn = document.getElementById('btn-add-text');
    if (addTextBtn) {
        addTextBtn.addEventListener('click', () => {
            const slide = slides[currentSlideIndex];
            if (!slide || slide.element.id === 'overview') {
                alert('Бичвэр оруулахын тулд тодорхой сэдвийг сонгоно уу!');
                return;
            }

            const content = slide.element.querySelector('.slide-content');
            if (!content) return;

            const elemData = {
                Id: 'el-text-' + Date.now(),
                Type: 'text',
                Content: '<h2>Шинэ гарчиг</h2><p>Энд агуулгаа оруулна уу.</p>',
                X: 80,
                Y: 80,
                Width: 350,
                Height: 120
            };

            const domElem = createSlideElementDOM(elemData);
            content.appendChild(domElem);
            selectElement(domElem);
            scheduleAutoSave();
        });
    }

    // Insert Shapes / Cards
    document.querySelectorAll('#shapes-dropdown .template-item').forEach(item => {
        item.addEventListener('click', () => {
            const shapeType = item.dataset.shape;
            insertShapeToCurrentSlide(shapeType);
        });
    });

    function insertShapeToCurrentSlide(shapeType) {
        const slide = slides[currentSlideIndex];
        if (!slide || slide.element.id === 'overview') {
            alert('Элемент оруулахын тулд тодорхой сэдвийг сонгоно уу!');
            return;
        }
        const content = slide.element.querySelector('.slide-content');
        if (!content) return;

        let html = '';
        let w = 240, h = 140;

        if (shapeType === 'stat-card') {
            html = `<div class="feature-card" style="padding:16px;"><h3>+250%</h3><h4>Өсөлт</h4><p>Амжилтын хувь хэмжээ.</p></div>`;
            w = 220; h = 150;
        } else if (shapeType === 'badge-pill') {
            html = `<span class="badge-pill">🔥 Онцлох төсөл</span>`;
            w = 180; h = 40;
        } else {
            html = `<div class="feature-card" style="padding:16px;"><div class="card-icon">⚡</div><h4>Шуурхай үйлчилгээ</h4></div>`;
            w = 200; h = 130;
        }

        const elemData = {
            Id: 'el-shape-' + Date.now(),
            Type: 'shape',
            Content: html,
            X: 120,
            Y: 120,
            Width: w,
            Height: h
        };

        const domElem = createSlideElementDOM(elemData);
        content.appendChild(domElem);
        selectElement(domElem);
        scheduleAutoSave();
    }

    // =========================================================================
    // Inspector Panel (Slide & Element Properties)
    // =========================================================================

    const inspector = document.getElementById('prezi-inspector');
    const inspectorBody = document.getElementById('inspector-body');
    const inspectorTitle = document.getElementById('inspector-target-title');
    const closeInspectorBtn = document.getElementById('btn-close-inspector');
    const toggleInspectorBtn = document.getElementById('btn-toggle-inspector');

    if (closeInspectorBtn) {
        closeInspectorBtn.addEventListener('click', () => {
            if (inspector) inspector.classList.add('collapsed');
        });
    }

    if (toggleInspectorBtn) {
        toggleInspectorBtn.addEventListener('click', () => {
            if (inspector) inspector.classList.toggle('collapsed');
        });
    }

    function showInspectorForSlide(slideData) {
        if (!inspectorBody) return;
        if (inspectorTitle) inspectorTitle.textContent = `🎯 Слайд: ${slideData.element.dataset.title || 'Тохиргоо'}`;

        const isOverview = slideData.element.id === 'overview';
        if (isOverview) {
            inspectorBody.innerHTML = `
                <div class="inspector-group">
                    <span class="inspector-label">Бүх сэдвийн тойм (Spatial Canvas)</span>
                    <p style="font-size:12px; color:#94a3b8; line-height:1.5;">Энэ нь бүх сэдвүүдийг нэгтгэн харуулах төв тойм орон зай юм.</p>
                </div>
            `;
            return;
        }

        const shape = slideData.element.dataset.shape || 'rounded';
        const bgColor = slideData.element.dataset.bgcolor || '#1e293b';
        const opacity = slideData.element.dataset.opacity || '0.85';
        const rotate = slideData.rotate || 0;
        const scale = slideData.scale || 1;

        inspectorBody.innerHTML = `
            <div class="inspector-group">
                <span class="inspector-label">Сэдвийн нэр (Гарчиг)</span>
                <input type="text" id="insp-slide-title" class="modern-input" value="${slideData.element.dataset.title || ''}" />
            </div>

            <div class="inspector-group">
                <span class="inspector-label">Хэлбэр & Загвар (Frame Shape)</span>
                <select id="insp-slide-shape" class="inspector-select">
                    <option value="rounded" ${shape === 'rounded' ? 'selected' : ''}>🔲 Дугуйрсан карт (Rounded)</option>
                    <option value="circle" ${shape === 'circle' ? 'selected' : ''}>⭕ Прези тойрог (Circle Topic)</option>
                    <option value="bracket" ${shape === 'bracket' ? 'selected' : ''}>📐 Хаалт хэлбэр (Bracket [ ])</option>
                    <option value="invisible" ${shape === 'invisible' ? 'selected' : ''}>✦ Ил харагдахгүй (Minimalist)</option>
                </select>
            </div>

            <div class="inspector-group">
                <span class="inspector-label">Өнгө & Тунгалаг байдал</span>
                <div class="inspector-row">
                    <span style="font-size:12px;">Дэвсгэр өнгө:</span>
                    <input type="color" id="insp-slide-color" value="${bgColor}" style="cursor:pointer; width:36px; height:28px; border:none;" />
                </div>
                <div class="inspector-row" style="margin-top:6px;">
                    <span style="font-size:12px;">Тунгалаг (Opacity):</span>
                    <input type="range" id="insp-slide-opacity" min="0" max="1" step="0.05" value="${opacity}" style="width:100px;" />
                </div>
            </div>

            <div class="inspector-group">
                <span class="inspector-label">3D Эргэлтийн өнцөг (Prezi Rotation)</span>
                <div class="inspector-row">
                    <span style="font-size:12px;">Өнцөг (градус):</span>
                    <input type="number" id="insp-slide-rotate" class="inspector-input" value="${Math.round(rotate)}" step="5" />
                </div>
            </div>

            <div class="inspector-group">
                <span class="inspector-label">Томруулалтын хэмжээ (Scale)</span>
                <div class="inspector-row">
                    <span style="font-size:12px;">Харьцаа:</span>
                    <input type="number" id="insp-slide-scale" class="inspector-input" value="${scale}" step="0.1" min="0.2" max="5" />
                </div>
            </div>

            <div class="inspector-group" style="margin-top:10px;">
                <button id="insp-btn-duplicate" class="action-pill-btn" style="width:100%; justify-content:center;">📋 Энэ слайдыг хувилах</button>
                <button id="insp-btn-delete" class="action-pill-btn" style="width:100%; justify-content:center; color:#ef4444; border-color:rgba(239,68,68,0.3); margin-top:6px;">🗑️ Слайдыг устгах</button>
            </div>
        `;

        // Event listeners
        document.getElementById('insp-slide-title')?.addEventListener('input', (e) => {
            slideData.element.dataset.title = e.target.value;
            slideData.title = e.target.value;
            rebuildSidebar();
            scheduleAutoSave();
        });

        document.getElementById('insp-slide-shape')?.addEventListener('change', (e) => {
            const newShape = e.target.value;
            slideData.element.className = `step slide slide-shape-${newShape} editor-selected active`;
            slideData.element.dataset.shape = newShape;
            rebuildSidebar();
            scheduleAutoSave();
        });

        document.getElementById('insp-slide-color')?.addEventListener('input', (e) => {
            const val = e.target.value;
            slideData.element.dataset.bgcolor = val;
            const content = slideData.element.querySelector('.slide-content');
            if (content) content.style.backgroundColor = val;
            scheduleAutoSave();
        });

        document.getElementById('insp-slide-opacity')?.addEventListener('input', (e) => {
            const val = e.target.value;
            slideData.element.dataset.opacity = val;
            const content = slideData.element.querySelector('.slide-content');
            if (content) content.style.opacity = val;
            scheduleAutoSave();
        });

        document.getElementById('insp-slide-rotate')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            slideData.rotate = val;
            slideData.element.dataset.rotate = val;
            slideData.object.rotation.z = THREE.MathUtils.degToRad(val);
            updateFlightPaths();
            scheduleAutoSave();
        });

        document.getElementById('insp-slide-scale')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 1;
            slideData.scale = val;
            slideData.element.dataset.scale = val;
            slideData.object.scale.set(val, val, val);
            scheduleAutoSave();
        });

        document.getElementById('insp-btn-duplicate')?.addEventListener('click', () => {
            duplicateSlide(slides.indexOf(slideData));
        });

        document.getElementById('insp-btn-delete')?.addEventListener('click', () => {
            deleteSlide(slides.indexOf(slideData));
        });
    }

    function showInspectorForElement(el) {
        if (!inspectorBody) return;
        if (inspectorTitle) inspectorTitle.textContent = `📝 Элемент: ${el.dataset.type || 'Текст'}`;

        const w = parseInt(el.style.width) || 300;
        const h = parseInt(el.style.height) || 100;

        inspectorBody.innerHTML = `
            <div class="inspector-group">
                <span class="inspector-label">Хэмжээ (Өргөн x Өндөр)</span>
                <div class="inspector-row">
                    <span style="font-size:12px;">Өргөн:</span>
                    <input type="number" id="insp-elem-width" class="inspector-input" value="${w}" step="10" />
                </div>
                <div class="inspector-row" style="margin-top:6px;">
                    <span style="font-size:12px;">Өндөр:</span>
                    <input type="number" id="insp-elem-height" class="inspector-input" value="${h}" step="10" />
                </div>
            </div>

            <div class="inspector-group">
                <button id="insp-elem-dup" class="action-pill-btn" style="width:100%; justify-content:center;">📋 Хувилах (Ctrl+D)</button>
                <button id="insp-elem-del" class="action-pill-btn" style="width:100%; justify-content:center; color:#ef4444; border-color:rgba(239,68,68,0.3); margin-top:6px;">🗑️ Устгах</button>
            </div>
        `;

        document.getElementById('insp-elem-width')?.addEventListener('input', (e) => {
            el.style.width = e.target.value + 'px';
            scheduleAutoSave();
        });

        document.getElementById('insp-elem-height')?.addEventListener('input', (e) => {
            el.style.height = e.target.value + 'px';
            scheduleAutoSave();
        });

        document.getElementById('insp-elem-dup')?.addEventListener('click', () => {
            dupElemBtn?.click();
        });

        document.getElementById('insp-elem-del')?.addEventListener('click', () => {
            deleteElemBtn?.click();
        });
    }

    // =========================================================================
    // Fullscreen Presentation Mode (F5)
    // =========================================================================

    const btnPresentMode = document.getElementById('btn-present-mode');
    const presFullscreenHUD = document.getElementById('presentation-fullscreen-hud');
    const btnPresPrev = document.getElementById('btn-pres-prev');
    const btnPresNext = document.getElementById('btn-pres-next');
    const btnPresOverview = document.getElementById('btn-pres-overview');
    const btnPresLaser = document.getElementById('btn-pres-laser');
    const btnExitPresentation = document.getElementById('btn-exit-presentation');
    const presTimerClock = document.getElementById('pres-timer-clock');
    const laserPointerDot = document.getElementById('laser-pointer-dot');

    function startPresentationMode() {
        isPresenting = true;
        document.body.classList.add('presenting');
        if (presFullscreenHUD) presFullscreenHUD.style.display = 'flex';
        hideTextToolbar();

        // Start from first slide or current
        const firstReal = slides.findIndex(s => s.element.id !== 'overview');
        if (currentSlideIndex === 0 && firstReal !== -1) {
            gotoSlide(firstReal);
        }

        // Timer
        presentationStartTime = Date.now();
        if (presentationTimerInterval) clearInterval(presentationTimerInterval);
        presentationTimerInterval = setInterval(updatePresentationTimer, 1000);

        // Request Fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
        }

        showToast('▶ Танилцуулга эхэллээ. Гарахын тулд Escape дарна уу.', 'info');
    }

    function exitPresentationMode() {
        isPresenting = false;
        laserPointerActive = false;
        document.body.classList.remove('presenting');
        if (presFullscreenHUD) presFullscreenHUD.style.display = 'none';
        if (laserPointerDot) laserPointerDot.style.display = 'none';

        if (presentationTimerInterval) clearInterval(presentationTimerInterval);

        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        }
    }

    function updatePresentationTimer() {
        if (!presentationStartTime || !presTimerClock) return;
        const diff = Math.floor((Date.now() - presentationStartTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        presTimerClock.textContent = `⏱️ ${mins}:${secs}`;
    }

    if (btnPresentMode) btnPresentMode.addEventListener('click', startPresentationMode);
    if (btnExitPresentation) btnExitPresentation.addEventListener('click', exitPresentationMode);
    if (btnPresNext) btnPresNext.addEventListener('click', nextSlide);
    if (btnPresPrev) btnPresPrev.addEventListener('click', prevSlide);

    if (btnPresOverview) {
        btnPresOverview.addEventListener('click', () => {
            const overviewIdx = slides.findIndex(s => s.element.id === 'overview');
            if (overviewIdx !== -1) gotoSlide(overviewIdx);
        });
    }

    if (btnPresLaser) {
        btnPresLaser.addEventListener('click', () => {
            laserPointerActive = !laserPointerActive;
            btnPresLaser.classList.toggle('active', laserPointerActive);
            if (laserPointerDot) {
                laserPointerDot.style.display = laserPointerActive ? 'block' : 'none';
            }
        });
    }

    // =========================================================================
    // Save & Server Persistence
    // =========================================================================

    const saveServerBtn = document.getElementById('save-server-btn');
    const saveStatusBadge = document.getElementById('save-status-badge');

    function savePresentationToServer() {
        if (saveStatusBadge) {
            saveStatusBadge.className = 'status-badge saving';
            saveStatusBadge.innerHTML = '<span class="status-dot"></span> Хадгалж байна...';
        }

        const titleInput = document.getElementById('presentation-title-input');
        const payload = {
            Title: titleInput ? titleInput.value : 'Мэргэжлийн Прези Танилцуулга',
            Theme: document.body.className.replace('theme-', '') || 'cosmic',
            BackgroundColor: window.PRESENTATION_BG_COLOR || '#070b14',
            BackgroundImage: window.PRESENTATION_BG_IMAGE || '',
            Slides: []
        };

        slides.forEach(s => {
            if (!s.element.id) return;
            const slideData = {
                Id: s.element.id,
                Title: s.element.dataset.title || s.title || '',
                X: s.object.position.x,
                Y: s.object.position.y,
                Z: s.object.position.z,
                Rotate: s.rotate || 0,
                Scale: s.scale || 1,
                Shape: s.element.dataset.shape || 'rounded',
                BgColor: s.element.dataset.bgcolor || '#1e293b',
                BgOpacity: parseFloat(s.element.dataset.opacity) || 0.85,
                BorderColor: s.element.dataset.bordercolor || 'rgba(255,255,255,0.2)',
                AccentColor: s.element.dataset.accentcolor || '#38bdf8',
                Elements: []
            };

            const contentNode = s.element.querySelector('.slide-content');
            if (contentNode) {
                contentNode.querySelectorAll('.slide-element').forEach(el => {
                    slideData.Elements.push({
                        Id: el.id,
                        Type: el.dataset.type || 'text',
                        Content: el.innerHTML,
                        X: parseFloat(el.style.left) || 0,
                        Y: parseFloat(el.style.top) || 0,
                        Width: parseFloat(el.style.width) || 300,
                        Height: parseFloat(el.style.height) || 100,
                        Style: el.getAttribute('style') || ''
                    });
                });
            }

            payload.Slides.push(slideData);
        });

        fetch('/Indexpreze?handler=SavePresentation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (saveStatusBadge) {
                        saveStatusBadge.className = 'status-badge saved';
                        saveStatusBadge.innerHTML = `<span class="status-dot"></span> Хадгалагдсан ${data.timestamp || ''}`;
                    }
                    showToast('💾 Амжилттай хадгалагдлаа!', 'success');
                } else {
                    if (saveStatusBadge) saveStatusBadge.textContent = '❌ Алдаа гарлаа';
                }
            })
            .catch(err => {
                console.error(err);
                if (saveStatusBadge) saveStatusBadge.textContent = '❌ Алдаа гарлаа';
            });
    }

    function scheduleAutoSave() {
        clearTimeout(autoSaveTimer);
        if (saveStatusBadge) {
            saveStatusBadge.className = 'status-badge saving';
            saveStatusBadge.innerHTML = '<span class="status-dot"></span> Өөрчлөлт орлоо...';
        }
        autoSaveTimer = setTimeout(savePresentationToServer, 3500);
    }

    if (saveServerBtn) saveServerBtn.addEventListener('click', savePresentationToServer);

    // Title input auto-save
    const presTitleInput = document.getElementById('presentation-title-input');
    if (presTitleInput) {
        presTitleInput.addEventListener('change', () => {
            document.title = presTitleInput.value + ' - Prezi Studio Pro';
            scheduleAutoSave();
        });
    }

    // =========================================================================
    // Dropdown Handlers & Template Pickers
    // =========================================================================

    function setupDropdown(toggleBtnId, menuId) {
        const btn = document.getElementById(toggleBtnId);
        const menu = document.getElementById(menuId);
        if (!btn || !menu) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        });
    }

    setupDropdown('btn-add-slide-menu', 'slide-template-dropdown');
    setupDropdown('btn-shapes-menu', 'shapes-dropdown');
    setupDropdown('btn-theme-menu', 'theme-dropdown');
    setupDropdown('btn-more-menu', 'more-dropdown');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-wrapper')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    });

    // Add slide from template dropdown
    document.querySelectorAll('#slide-template-dropdown .template-item').forEach(item => {
        item.addEventListener('click', () => {
            const tpl = item.dataset.template;
            addSlideWithTemplate(tpl);
            document.getElementById('slide-template-dropdown')?.classList.remove('show');
        });
    });

    // Quick add slide from sidebar
    const quickAddBtn = document.getElementById('btn-quick-add-slide');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            addSlideWithTemplate('hero');
        });
    }

    // Theme Switcher
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.dataset.theme;
            document.body.className = `theme-${theme}`;
            document.getElementById('theme-dropdown')?.classList.remove('show');
            showToast(`🎨 Өнгөний загвар: ${theme}`, 'info');
            scheduleAutoSave();
        });
    });

    // Overview Button in Sidebar & Bottom bar
    const sidebarOverviewBtn = document.getElementById('btn-sidebar-overview');
    const bottomOverviewBtn = document.getElementById('btn-zoom-overview');
    const triggerOverview = () => {
        const overviewIdx = slides.findIndex(s => s.element.id === 'overview');
        if (overviewIdx !== -1) gotoSlide(overviewIdx);
    };
    if (sidebarOverviewBtn) sidebarOverviewBtn.addEventListener('click', triggerOverview);
    if (bottomOverviewBtn) bottomOverviewBtn.addEventListener('click', triggerOverview);

    // Zoom buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            gsap.to(camera.position, { z: Math.max(camera.position.z * 0.75, 400), duration: 0.4 });
        });
    }
    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            gsap.to(camera.position, { z: Math.min(camera.position.z * 1.35, 12000), duration: 0.4 });
        });
    }

    // Toggle Path Lines
    const btnTogglePaths = document.getElementById('btn-toggle-paths');
    if (btnTogglePaths) {
        btnTogglePaths.addEventListener('click', () => {
            showFlightPaths = !showFlightPaths;
            btnTogglePaths.classList.toggle('active', showFlightPaths);
            const pathSvg = document.getElementById('prezi-path-svg');
            if (pathSvg) pathSvg.style.display = showFlightPaths ? 'block' : 'none';
        });
    }

    // Export & Import JSON
    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const title = document.getElementById('presentation-title-input')?.value || 'presentation';
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.PRESENTATION_DATA, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `${title}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });
    }

    const btnImportTrigger = document.getElementById('btn-import-json-trigger');
    const jsonFileInput = document.getElementById('json-file-input');
    if (btnImportTrigger && jsonFileInput) {
        btnImportTrigger.addEventListener('click', () => jsonFileInput.click());
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    buildSlidesFromData(parsed);
                    showToast('📥 Танилцуулга амжилттай уншигдлаа!', 'success');
                    savePresentationToServer();
                } catch {
                    alert('Буруу форматтай JSON файл байна.');
                }
            };
            reader.readAsText(file);
        });
    }

    // Reset / Pro Template Loader
    const btnLoadPro = document.getElementById('btn-load-pro-template');
    if (btnLoadPro) {
        btnLoadPro.addEventListener('click', () => {
            if (confirm('Бэлэн мэргэжлийн бүтэн загварыг ачаалах уу? Одоогийн өөрчлөлтүүд шинэчлэгдэнэ.')) {
                fetch('/Indexpreze?handler=ResetTemplate', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            window.location.reload();
                        }
                    });
            }
        });
    }

    // =========================================================================
    // Keyboard Navigation & Shortcuts
    // =========================================================================

    document.addEventListener('keydown', function (e) {
        const isEditing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

        // F5 - Presentation mode
        if (e.key === 'F5') {
            e.preventDefault();
            if (!isPresenting) startPresentationMode();
            else exitPresentationMode();
            return;
        }

        // Escape
        if (e.key === 'Escape') {
            if (isPresenting) {
                exitPresentationMode();
            } else {
                triggerOverview();
            }
            return;
        }

        // Laser key 'L' during presentation
        if (isPresenting && (e.key === 'l' || e.key === 'L')) {
            btnPresLaser?.click();
            return;
        }

        if (isEditing) return;

        // Navigation
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            nextSlide();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            prevSlide();
        } else if (e.key === 'Home') {
            e.preventDefault();
            triggerOverview();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedElement) {
                selectedElement.remove();
                selectedElement = null;
                hideTextToolbar();
                scheduleAutoSave();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            savePresentationToServer();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            if (selectedElement) dupElemBtn?.click();
            else if (selectedSlide) duplicateSlide(slides.indexOf(selectedSlide));
        }
    });

    // Navigation buttons in bottom bar
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);

    // =========================================================================
    // Toast Notification Utility
    // =========================================================================

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    // =========================================================================
    // Initialize Slides
    // =========================================================================

    buildSlidesFromData(initialData);

    console.log('🚀 Prezi Studio Pro fully loaded and ready!');
});
