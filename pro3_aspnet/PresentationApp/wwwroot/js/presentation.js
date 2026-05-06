// Initialize Three.js Presentation
document.addEventListener('DOMContentLoaded', function() {
    console.log('✨ Initializing Three.js + GSAP Presentation');

    // Setup Scene, Camera, Renderer
    const container = document.getElementById('presentation-container');
    const scene = new THREE.Scene();
    
    // Create Perspective Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    // Initial camera position (will be updated immediately)
    camera.position.set(0, 0, 1000);

    // Create CSS3D Renderer
    const renderer = new THREE.CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    container.appendChild(renderer.domElement);

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Slides setup
    const slideElements = document.querySelectorAll('.slide, #overview');
    const slides = [];
    let currentSlideIndex = 0;
    const totalSlides = slideElements.length;
    
    slideElements.forEach((el, index) => {
        // Read data attributes
        const x = parseFloat(el.getAttribute('data-x')) || 0;
        const y = parseFloat(el.getAttribute('data-y')) || 0;
        const z = parseFloat(el.getAttribute('data-z')) || 0;
        const rotateZ = parseFloat(el.getAttribute('data-rotate')) || 0;
        const rotateX = parseFloat(el.getAttribute('data-rotate-x')) || 0;
        const rotateY = parseFloat(el.getAttribute('data-rotate-y')) || 0;
        const scale = parseFloat(el.getAttribute('data-scale')) || 1;

        // Create CSS3DObject
        const cssObject = new THREE.CSS3DObject(el);
        cssObject.position.set(x, y, z);
        
        // Convert degrees to radians for Three.js
        cssObject.rotation.x = THREE.MathUtils.degToRad(rotateX);
        cssObject.rotation.y = THREE.MathUtils.degToRad(rotateY);
        // Prezi-style rotation is usually around the Z axis
        cssObject.rotation.z = THREE.MathUtils.degToRad(rotateZ);
        
        cssObject.scale.set(scale, scale, scale);
        
        scene.add(cssObject);
        slides.push({
            element: el,
            object: cssObject,
            scale: scale
        });

        // Store index for easy access
        el.dataset.index = index;
    });

    // Navigation function using GSAP
    function gotoSlide(index) {
        if (index < 0 || index >= totalSlides) return;
        
        currentSlideIndex = index;
        const targetSlide = slides[currentSlideIndex];
        
        // Update active class
        slideElements.forEach(el => el.classList.remove('active'));
        targetSlide.element.classList.add('active');
        
        // Calculate target camera position and rotation
        const dummyCamera = camera.clone();
        dummyCamera.position.copy(targetSlide.object.position);
        dummyCamera.rotation.copy(targetSlide.object.rotation);
        
        // Move camera back to view the slide properly
        // Base distance to view a 1:1 scale slide might be around 1000 units
        // Adjust this if slides appear too big or small
        const baseDistance = 1500;
        dummyCamera.translateZ(baseDistance * targetSlide.scale);
        
        // GSAP Animation: Prezi-style "zoom out -> pan/rotate -> zoom in"
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(camera.quaternion);
        
        const tl = gsap.timeline();
        const dist = camera.position.distanceTo(dummyCamera.position);
        
        // If distance is large enough, do a sweeping arc
        if (dist > 300) {
            // Calculate how far to pull back based on distance (max 3000)
            const pullBackDistance = Math.min(dist * 0.5, 3000);
            
            // 1. Zoom out (pull back) from current
            const p1 = camera.clone();
            p1.translateZ(pullBackDistance);
            
            // 2. Target Zoom out
            const p2 = dummyCamera.clone();
            p2.translateZ(pullBackDistance);
            
            // Zoom out
            tl.to(camera.position, {
                x: p1.position.x,
                y: p1.position.y,
                z: p1.position.z,
                duration: 0.8,
                ease: "power2.out"
            });
            
            // Rotate and pan to new zoomed-out position
            tl.to(camera.position, {
                x: p2.position.x,
                y: p2.position.y,
                z: p2.position.z,
                duration: 1.2,
                ease: "power2.inOut"
            }, "-=0.2");
            
            tl.to(camera.quaternion, {
                x: dummyCamera.quaternion.x,
                y: dummyCamera.quaternion.y,
                z: dummyCamera.quaternion.z,
                w: dummyCamera.quaternion.w,
                duration: 1.2,
                ease: "power2.inOut"
            }, "<"); // sync with pan
            
            // Zoom in
            tl.to(camera.position, {
                x: dummyCamera.position.x,
                y: dummyCamera.position.y,
                z: dummyCamera.position.z,
                duration: 1.0,
                ease: "power3.inOut"
            }, "-=0.3");
            
        } else {
            // If close, just move directly
            tl.to(camera.position, {
                x: dummyCamera.position.x,
                y: dummyCamera.position.y,
                z: dummyCamera.position.z,
                duration: 1.5,
                ease: "power3.inOut"
            }, 0);
            
            tl.to(camera.quaternion, {
                x: dummyCamera.quaternion.x,
                y: dummyCamera.quaternion.y,
                z: dummyCamera.quaternion.z,
                w: dummyCamera.quaternion.w,
                duration: 1.5,
                ease: "power3.inOut"
            }, 0);
        }

        updateCounter();
    }

    // Go to first slide initially
    gotoSlide(0);

    // Update Counter
    function updateCounter() {
        const slideCounterElem = document.getElementById('current-slide');
        const totalSlidesElem = document.getElementById('total-slides');
        if (slideCounterElem) slideCounterElem.textContent = currentSlideIndex + 1;
        // Don't count overview slide in total if it's the last one
        const displayTotal = slides[slides.length - 1].element.id === 'overview' ? slides.length - 1 : slides.length;
        if (totalSlidesElem) totalSlidesElem.textContent = displayTotal;
    }

    // Keyboard Navigation
    document.addEventListener('keydown', function(event) {
        // Prevent default scrolling for arrow keys
        if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", "Escape", " "].includes(event.key)) {
            // Only prevent if we're not focusing an input
            if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
            }
        }

        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
            gotoSlide(Math.min(currentSlideIndex + 1, totalSlides - 1));
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            gotoSlide(Math.max(currentSlideIndex - 1, 0));
        } else if (event.key === 'Home') {
            gotoSlide(0);
        } else if (event.key === 'End') {
            // If last slide is overview, go to it, otherwise go to actual last slide
            gotoSlide(totalSlides - 1);
        } else if (event.key === 'Escape') {
            const overviewIndex = slides.findIndex(s => s.element.id === 'overview');
            if (overviewIndex !== -1) {
                gotoSlide(overviewIndex);
            }
        }
    });

    // Navigation Buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => gotoSlide(Math.max(currentSlideIndex - 1, 0)));
    if (nextBtn) nextBtn.addEventListener('click', () => gotoSlide(Math.min(currentSlideIndex + 1, totalSlides - 1)));

    // Smooth Scrolling / Anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetIndex = slides.findIndex(s => s.element.id === targetId);
            if (targetIndex !== -1) gotoSlide(targetIndex);
        });
    });

    // Swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', function(event) {
        if (event.target.closest('.position-panel')) return; // Ignore touches on panel
        touchStartX = event.changedTouches[0].screenX;
    }, false);

    document.addEventListener('touchend', function(event) {
        if (event.target.closest('.position-panel')) return;
        touchEndX = event.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                gotoSlide(Math.min(currentSlideIndex + 1, totalSlides - 1));
            } else {
                gotoSlide(Math.max(currentSlideIndex - 1, 0));
            }
        }
    }

    // --- Drag and Drop for 3D Positioning ---
    let draggedSlide = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let objStartX = 0;
    let objStartY = 0;

    const positionPanel = document.createElement('div');
    positionPanel.id = 'position-panel';
    positionPanel.className = 'position-panel';
    document.body.appendChild(positionPanel);

    function showPositionPanel(slideData) {
        const x = slideData.object.position.x;
        const y = slideData.object.position.y;
        const z = slideData.object.position.z;
        const scale = slideData.scale;
        const rotZ = THREE.MathUtils.radToDeg(slideData.object.rotation.z);

        positionPanel.innerHTML = `
            <div class="position-info">
                <h4>📍 3D Position</h4>
                <p><strong>X:</strong> <input type="number" value="${Math.round(x)}" data-prop="x" class="pos-input"></p>
                <p><strong>Y:</strong> <input type="number" value="${Math.round(y)}" data-prop="y" class="pos-input"></p>
                <p><strong>Z:</strong> <input type="number" value="${Math.round(z)}" data-prop="z" class="pos-input"></p>
                <p><strong>RotZ:</strong> <input type="number" value="${Math.round(rotZ)}" data-prop="rotZ" class="pos-input"></p>
                <p><strong>Scale:</strong> <input type="number" value="${scale}" step="0.1" data-prop="scale" class="pos-input"></p>
                <button id="update-btn" class="reset-btn">✔️ Apply Locally</button>
                <button id="save-server-btn" class="reset-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; margin-top: 10px;">💾 Save to Server</button>
            </div>
        `;
        positionPanel.style.display = 'block';

        // Add event listener to apply button
        document.getElementById('update-btn').addEventListener('click', () => {
            const inputs = positionPanel.querySelectorAll('.pos-input');
            inputs.forEach(input => {
                const prop = input.dataset.prop;
                const val = parseFloat(input.value) || 0;
                if (prop === 'x') slideData.object.position.x = val;
                if (prop === 'y') slideData.object.position.y = val;
                if (prop === 'z') slideData.object.position.z = val;
                if (prop === 'rotZ') slideData.object.rotation.z = THREE.MathUtils.degToRad(val);
                if (prop === 'scale') {
                    slideData.scale = val;
                    slideData.object.scale.set(val, val, val);
                }
                
                // Update DOM attributes for persistence if needed
                if (prop === 'scale') slideData.element.setAttribute('data-scale', val);
                else if (prop === 'rotZ') slideData.element.setAttribute('data-rotate', val);
                else slideData.element.setAttribute('data-' + prop, val);
            });
            // Re-center camera if it's the current slide
            if (slideData.element.dataset.index == currentSlideIndex) {
                gotoSlide(currentSlideIndex);
            }
        });

        // Add event listener to save to server button
        document.getElementById('save-server-btn').addEventListener('click', () => {
            // first apply locally
            document.getElementById('update-btn').click();
            
            // then build the payload for all slides
            const payload = {};
            slides.forEach(s => {
                // only save slides that have an ID
                if (s.element.id) {
                    payload[s.element.id] = {
                        X: s.object.position.x,
                        Y: s.object.position.y,
                        Z: s.object.position.z,
                        RotateX: THREE.MathUtils.radToDeg(s.object.rotation.x),
                        RotateY: THREE.MathUtils.radToDeg(s.object.rotation.y),
                        RotateZ: THREE.MathUtils.radToDeg(s.object.rotation.z),
                        Scale: s.scale
                    };
                }
            });
            
            const btn = document.getElementById('save-server-btn');
            btn.textContent = "Saving...";
            
            fetch('/Index?handler=SavePositions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).then(res => {
                if(res.ok) {
                    btn.textContent = "✅ Saved!";
                    setTimeout(() => btn.textContent = "💾 Save to Server", 2000);
                } else {
                    btn.textContent = "❌ Error!";
                }
            }).catch(e => {
                console.error(e);
                btn.textContent = "❌ Error!";
            });
        });
    }

    // --- Full 3D Editor Toolbar ---
    const editToolbar = document.createElement('div');
    editToolbar.className = 'edit-toolbar';
    editToolbar.innerHTML = `
        <div class="toolbar-group">
            <button class="tb-btn active" data-mode="move">✥ Move</button>
            <button class="tb-btn" data-mode="rotate">↻ Rotate</button>
            <button class="tb-btn" data-mode="scale">⤢ Scale</button>
        </div>
        <div class="toolbar-group">
            <button class="tb-btn active" data-axis="x">X</button>
            <button class="tb-btn" data-axis="y">Y</button>
            <button class="tb-btn" data-axis="z">Z</button>
        </div>
        <div class="toolbar-group">
            <button id="tb-save-btn" class="tb-btn" style="background: #10b981; border-color: #059669;">💾 Save to Server</button>
        </div>
    `;
    document.body.appendChild(editToolbar);

    let editMode = 'move';
    let editAxis = 'x';
    let objStartRotX = 0, objStartRotY = 0, objStartRotZ = 0, objStartZ = 0, objStartScale = 1;

    editToolbar.querySelectorAll('.tb-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            editToolbar.querySelectorAll('.tb-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            editMode = btn.dataset.mode;
        });
    });

    editToolbar.querySelectorAll('.tb-btn[data-axis]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            editToolbar.querySelectorAll('.tb-btn[data-axis]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            editAxis = btn.dataset.axis;
        });
    });

    document.getElementById('tb-save-btn').addEventListener('click', () => {
        if(document.getElementById('save-server-btn')) {
            document.getElementById('save-server-btn').click();
            
            const btn = document.getElementById('tb-save-btn');
            const originalText = btn.textContent;
            btn.textContent = "Saving...";
            setTimeout(() => btn.textContent = "✅ Saved!", 500);
            setTimeout(() => btn.textContent = originalText, 2500);
        }
    });

    slideElements.forEach((el) => {
        el.style.cursor = 'grab';

        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // Left click only
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return; // Don't drag if clicking inputs

            // Find slide data
            const slideData = slides.find(s => s.element === el);
            if (!slideData) return;

            isDragging = true;
            draggedSlide = slideData;
            el.style.cursor = 'grabbing';
            el.classList.add('dragging');
            editToolbar.classList.add('visible');

            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            // Get current object position
            objStartX = slideData.object.position.x;
            objStartY = slideData.object.position.y;
            objStartZ = slideData.object.position.z;
            objStartRotX = slideData.object.rotation.x;
            objStartRotY = slideData.object.rotation.y;
            objStartRotZ = slideData.object.rotation.z;
            objStartScale = slideData.scale;

            showPositionPanel(slideData);
            
            e.stopPropagation(); // Prevent normal click behaviors
        });
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !draggedSlide) return;

        // Calculate delta in screen coordinates
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : -deltaY;
        
        const distance = camera.position.distanceTo(draggedSlide.object.position);
        const translateFactor = (distance / 1000) * 1.5;
        const rotateFactor = 0.01;
        const scaleFactor = 0.01;

        if (editMode === 'move') {
            if (editAxis === 'x') draggedSlide.object.position.x = objStartX + (deltaX * translateFactor);
            if (editAxis === 'y') draggedSlide.object.position.y = objStartY - (deltaY * translateFactor);
            if (editAxis === 'z') draggedSlide.object.position.z = objStartZ + (delta * translateFactor);
        } else if (editMode === 'rotate') {
            if (editAxis === 'x') draggedSlide.object.rotation.x = objStartRotX + (deltaY * rotateFactor);
            if (editAxis === 'y') draggedSlide.object.rotation.y = objStartRotY + (deltaX * rotateFactor);
            if (editAxis === 'z') draggedSlide.object.rotation.z = objStartRotZ - (deltaX * rotateFactor);
        } else if (editMode === 'scale') {
            const newScale = Math.max(0.1, objStartScale + (delta * scaleFactor));
            draggedSlide.scale = newScale;
            draggedSlide.object.scale.set(newScale, newScale, newScale);
        }

        // Update panel inputs in real-time
        const xInput = positionPanel.querySelector('[data-prop="x"]');
        const yInput = positionPanel.querySelector('[data-prop="y"]');
        const zInput = positionPanel.querySelector('[data-prop="z"]');
        const rotZInput = positionPanel.querySelector('[data-prop="rotZ"]');
        const scaleInput = positionPanel.querySelector('[data-prop="scale"]');
        if (xInput) xInput.value = Math.round(draggedSlide.object.position.x);
        if (yInput) yInput.value = Math.round(draggedSlide.object.position.y);
        if (zInput) zInput.value = Math.round(draggedSlide.object.position.z);
        if (rotZInput) rotZInput.value = Math.round(THREE.MathUtils.radToDeg(draggedSlide.object.rotation.z));
        if (scaleInput) scaleInput.value = draggedSlide.scale.toFixed(2);
    });

    document.addEventListener('mouseup', function() {
        if (isDragging && draggedSlide) {
            draggedSlide.element.style.cursor = 'grab';
            draggedSlide.element.classList.remove('dragging');
            
            // Update attributes
            draggedSlide.element.setAttribute('data-x', Math.round(draggedSlide.object.position.x));
            draggedSlide.element.setAttribute('data-y', Math.round(draggedSlide.object.position.y));
            draggedSlide.element.setAttribute('data-z', Math.round(draggedSlide.object.position.z));
            draggedSlide.element.setAttribute('data-rotate-x', Math.round(THREE.MathUtils.radToDeg(draggedSlide.object.rotation.x)));
            draggedSlide.element.setAttribute('data-rotate-y', Math.round(THREE.MathUtils.radToDeg(draggedSlide.object.rotation.y)));
            draggedSlide.element.setAttribute('data-rotate', Math.round(THREE.MathUtils.radToDeg(draggedSlide.object.rotation.z)));
            draggedSlide.element.setAttribute('data-scale', draggedSlide.scale);
        }
        isDragging = false;
        draggedSlide = null;
    });

    // Close toolbar when clicking outside slides
    document.addEventListener('mousedown', function(e) {
        if(!e.target.closest('.slide') && !e.target.closest('.edit-toolbar') && !e.target.closest('.position-panel')) {
            editToolbar.classList.remove('visible');
            positionPanel.style.display = 'none';
        }
    });

    // Log ready
    console.log('🚀 Three.js Presentation Ready!');
});
