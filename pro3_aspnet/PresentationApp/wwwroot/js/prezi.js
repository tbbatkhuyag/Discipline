// Initialize Three.js Presentation
document.addEventListener('DOMContentLoaded', function() {
    console.log('✨ Initializing Three.js + GSAP Presentation');

    // Setup Scene, Camera, Renderer
    const container = document.getElementById('presentation-container');
    const scene = new THREE.Scene();
    
    // Create Perspective Camera (Increased far plane to see background when zoomed out)
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 50000);
    // Initial camera position (will be updated immediately)
    camera.position.set(0, 0, 1000);

    // Create CSS3D Renderer
    const renderer = new THREE.CSS3DRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    container.appendChild(renderer.domElement);

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);
    function onWindowResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // --- Zoomable 3D Background ---
    const bgEl = document.createElement('div');
    bgEl.style.width = '30000px';
    bgEl.style.height = '20000px';
    bgEl.style.position = 'absolute';
    bgEl.style.pointerEvents = 'none';
    bgEl.style.userSelect = 'none';

    const bgColor = window.PRESENTATION_BG_COLOR || '#1e293b';
    const bgImage = window.PRESENTATION_BG_IMAGE || '';
    bgEl.style.backgroundColor = bgColor;
    if (bgImage) {
        bgEl.style.backgroundImage = `url('${bgImage}')`;
        bgEl.style.backgroundSize = 'cover';
        bgEl.style.backgroundPosition = 'center';
        bgEl.style.backgroundRepeat = 'no-repeat';
    }

    const bgObject = new THREE.CSS3DObject(bgEl);
    bgObject.position.set(0, 0, -5000); // Fixed depth so it naturally scales when camera zooms
    scene.add(bgObject);

    // Slides setup
    const slideElements = document.querySelectorAll('.slide, #overview');
    const slides = [];
    let currentSlideIndex = 0;
    
    function setupSlideUI(el, index) {
        if (el.id !== 'overview' && !el.querySelector('.slide-badge')) {
            const badge = document.createElement('div');
            badge.className = 'slide-badge';
            badge.textContent = index + 1;
            el.appendChild(badge);

            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-in-btn';
            zoomBtn.innerHTML = '🔍 Zoom in';
            
            const triggerZoom = (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.querySelectorAll('.step').forEach(s => s.classList.remove('editor-selected'));
                gotoSlide(index);
            };
            zoomBtn.addEventListener('mousedown', triggerZoom);
            zoomBtn.addEventListener('touchstart', triggerZoom);
            el.appendChild(zoomBtn);

            ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${pos}`;
                handle.dataset.corner = pos;
                el.appendChild(handle);
            });
        }
    }

    slideElements.forEach((el, index) => {
        const x = parseFloat(el.getAttribute('data-x')) || 0;
        const y = parseFloat(el.getAttribute('data-y')) || 0;
        const z = parseFloat(el.getAttribute('data-z')) || 0;
        const scale = parseFloat(el.getAttribute('data-scale')) || 1;

        const cssObject = new THREE.CSS3DObject(el);
        cssObject.position.set(x, y, z);
        cssObject.scale.set(scale, scale, scale);
        scene.add(cssObject);
        
        el.dataset.index = index;
        slides.push({ element: el, object: cssObject, scale: scale });

        setupSlideUI(el, index);
    });

    let draggedSidebarIndex = null;

    function rebuildSidebar() {
        const sidebar = document.getElementById('sidebar-frames');
        if (!sidebar) return;
        sidebar.innerHTML = ''; // Clear existing
        
        slides.forEach((slide, index) => {
            const frameItem = document.createElement('div');
            frameItem.className = 'frame-item';
            frameItem.dataset.index = index;
            frameItem.draggable = true;
            if (index === currentSlideIndex) frameItem.classList.add('active');

            // Drag and Drop Logic
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
                e.dataTransfer.dropEffect = 'move';
                if (index !== draggedSidebarIndex) {
                    const rect = frameItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        frameItem.classList.add('drag-over-top');
                        frameItem.classList.remove('drag-over-bottom');
                    } else {
                        frameItem.classList.add('drag-over-bottom');
                        frameItem.classList.remove('drag-over-top');
                    }
                }
            });
            
            frameItem.addEventListener('dragleave', () => {
                frameItem.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            frameItem.addEventListener('drop', (e) => {
                e.preventDefault();
                frameItem.classList.remove('drag-over-top', 'drag-over-bottom');
                if (draggedSidebarIndex !== null && draggedSidebarIndex !== index) {
                    const draggedSlide = slides.splice(draggedSidebarIndex, 1)[0];
                    
                    // Determine actual drop index
                    let dropIndex = index;
                    const rect = frameItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    // If dropping below the middle, insert after
                    if (e.clientY >= midY) {
                        dropIndex++;
                    }
                    // Adjust dropIndex if dragged from above
                    if (draggedSidebarIndex < dropIndex) {
                        dropIndex--;
                    }
                    
                    slides.splice(dropIndex, 0, draggedSlide);
                    
                    // Update DOM element indices
                    slides.forEach((s, i) => { s.element.dataset.index = i; });
                    
                    // Physically reorder DOM elements in the container
                    const container = document.getElementById('presentation-container');
                    if (container) {
                        slides.forEach(s => container.appendChild(s.element));
                    }
                    
                    // Update currentSlideIndex
                    const activeSlideEl = document.querySelector('.step.active');
                    if (activeSlideEl) {
                        currentSlideIndex = slides.findIndex(s => s.element === activeSlideEl);
                    }
                    
                    rebuildSidebar();
                    if(typeof updateCounter === 'function') updateCounter();
                    
                    // Automatically save the new order
                    savePresentationToServer();
                }
            });
            
            const itemRow = document.createElement('div');
            itemRow.style.display = 'flex';
            itemRow.style.alignItems = 'center';
            itemRow.style.width = '100%';

            const frameNumber = document.createElement('div');
            frameNumber.className = 'frame-number';
            frameNumber.textContent = index + 1;
            
            const frameThumb = document.createElement('div');
            frameThumb.className = 'frame-thumb';
            frameThumb.innerHTML = `<div style="font-size:8px; padding:5px; text-align:center; height:100%; display:flex; align-items:center; justify-content:center; color:#9ca3af;">${slide.element.id}</div>`;
            
            // Delete button
            if (slide.element.id !== 'overview') {
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '🗑️';
                delBtn.style.position = 'absolute';
                delBtn.style.right = '5px';
                delBtn.style.top = '5px';
                delBtn.style.border = 'none';
                delBtn.style.background = 'white';
                delBtn.style.borderRadius = '4px';
                delBtn.style.cursor = 'pointer';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(confirm('Delete slide?')) {
                        slide.element.remove();
                        scene.remove(slide.object);
                        slides.splice(index, 1);
                        // Update indices
                        slides.forEach((s, i) => { s.element.dataset.index = i; });
                        rebuildSidebar();
                    }
                });
                frameThumb.appendChild(delBtn);
            }

            itemRow.appendChild(frameNumber);
            itemRow.appendChild(frameThumb);
            
            frameItem.style.flexDirection = 'column';
            frameItem.style.alignItems = 'flex-start';
            frameItem.appendChild(itemRow);

            // Add background controls for all slides (hidden by default)
            if (slide.element.id !== 'overview') {
                const controls = document.createElement('div');
                controls.className = 'frame-controls';
                controls.style.display = 'none'; // Hidden by default
                controls.style.flexDirection = 'column';
                controls.style.gap = '5px';
                controls.style.marginTop = '10px';
                controls.style.width = '100%';
                controls.style.paddingLeft = '34px'; // align with thumb
                
                const bgColor = slide.element.getAttribute('data-bgcolor') || '#ffffff';
                const bgOpacity = parseFloat(slide.element.getAttribute('data-opacity')) || 0.6;
                
                controls.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:10px; color:#6b7280; font-weight:bold;">Color:</span>
                        <input type="color" value="${bgColor}" class="side-color" style="width:24px; height:24px; padding:0; border:none; cursor:pointer;">
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:10px; color:#6b7280; font-weight:bold;">Opacity:</span>
                        <input type="range" min="0" max="1" step="0.1" value="${bgOpacity}" class="side-opacity" style="width:60px; cursor:ew-resize;">
                    </div>
                `;
                
                controls.addEventListener('click', (e) => e.stopPropagation());
                controls.addEventListener('mousedown', (e) => e.stopPropagation());
                controls.addEventListener('dblclick', (e) => e.stopPropagation());
                
                controls.querySelector('.side-color').addEventListener('input', (e) => {
                    const val = e.target.value;
                    slide.element.setAttribute('data-bgcolor', val);
                    const content = slide.element.querySelector('.slide-content');
                    if(content) content.style.backgroundColor = val;
                });
                
                controls.querySelector('.side-opacity').addEventListener('input', (e) => {
                    const val = e.target.value;
                    slide.element.setAttribute('data-opacity', val);
                    const content = slide.element.querySelector('.slide-content');
                    if(content) content.style.opacity = val;
                });

                // Auto-save when user finishes selecting
                controls.querySelector('.side-color').addEventListener('change', () => {
                    savePresentationToServer();
                });
                controls.querySelector('.side-opacity').addEventListener('change', () => {
                    savePresentationToServer();
                });
                
                frameItem.appendChild(controls);
                
                // Double click or Right click the row to toggle controls
                itemRow.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    controls.style.display = controls.style.display === 'none' ? 'flex' : 'none';
                });
                
                itemRow.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    controls.style.display = controls.style.display === 'none' ? 'flex' : 'none';
                });
            }
            
            frameItem.addEventListener('click', () => {
                gotoSlide(index);
            });
            
            sidebar.appendChild(frameItem);
        });
    }
    rebuildSidebar();

    // --- WYSIWYG Editor Element Management ---
    let activeSlideElement = null;
    let isDraggingElement = false;
    let elemDragStartX = 0, elemDragStartY = 0, elemStartX = 0, elemStartY = 0;

    function initSlideElement(el) {
        el.addEventListener('mousedown', function(e) {
            if(e.button !== 0) return;
            e.stopPropagation(); // Stop slide drag
            
            // Select element
            document.querySelectorAll('.slide-element').forEach(s => s.classList.remove('selected-element'));
            el.classList.add('selected-element');
            activeSlideElement = el;

            isDraggingElement = true;
            elemDragStartX = e.clientX;
            elemDragStartY = e.clientY;
            elemStartX = parseFloat(el.style.left) || 0;
            elemStartY = parseFloat(el.style.top) || 0;
        });

        el.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            if (el.dataset.type === 'text') {
                el.setAttribute('contenteditable', 'true');
                el.focus();
            }
        });

        el.addEventListener('blur', function() {
            el.setAttribute('contenteditable', 'false');
        });
    }

    document.querySelectorAll('.slide-element').forEach(initSlideElement);

    document.addEventListener('mousemove', function(e) {
        if (isDraggingElement && activeSlideElement) {
            const distance = camera.position.distanceTo(slides[currentSlideIndex].object.position);
            // Rough approximation of dragging speed based on camera distance
            const factor = distance > 0 ? (distance / 1000) * 1.5 : 1;
            
            const deltaX = (e.clientX - elemDragStartX) * factor;
            const deltaY = (e.clientY - elemDragStartY) * factor;
            
            activeSlideElement.style.left = (elemStartX + deltaX) + 'px';
            activeSlideElement.style.top = (elemStartY + deltaY) + 'px';
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (isDraggingElement) isDraggingElement = false;
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (activeSlideElement && activeSlideElement.getAttribute('contenteditable') !== 'true') {
                activeSlideElement.remove();
                activeSlideElement = null;
            }
        }
    });

    function addTextToCurrentSlide(x = 50, y = 50) {
        if (!slides[currentSlideIndex]) return;
        const slide = slides[currentSlideIndex].element;
        if (slide.id === 'overview') return;
        
        const content = slide.querySelector('.slide-content');
        if (!content) return;

        const el = document.createElement('div');
        el.className = 'slide-element';
        el.id = 'el-' + Date.now();
        el.dataset.type = 'text';
        el.style.position = 'absolute';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = '300px';
        el.style.height = '100px';
        el.innerHTML = '<h2>New Text</h2>';
        
        content.appendChild(el);
        initSlideElement(el);
        
        // Immediately make it editable and focus it
        setTimeout(() => {
            el.setAttribute('contenteditable', 'true');
            el.focus();
            
            // Select the element
            document.querySelectorAll('.slide-element').forEach(s => s.classList.remove('selected-element'));
            el.classList.add('selected-element');
            activeSlideElement = el;
        }, 50);
    }

    document.getElementById('btn-add-text')?.addEventListener('click', () => {
        addTextToCurrentSlide();
    });

    document.getElementById('btn-add-image')?.addEventListener('click', () => {
        if (!slides[currentSlideIndex]) return;
        const slide = slides[currentSlideIndex].element;
        const content = slide.querySelector('.slide-content');
        if (!content) return;

        const url = prompt("Enter Image URL:");
        if(!url) return;

        const el = document.createElement('div');
        el.className = 'slide-element';
        el.id = 'el-' + Date.now();
        el.dataset.type = 'image';
        el.style.position = 'absolute';
        el.style.left = '50px';
        el.style.top = '50px';
        el.style.width = '400px';
        el.style.height = '300px';
        el.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain;" draggable="false" />`;
        
        content.appendChild(el);
        initSlideElement(el);
    });

    document.querySelector('.add-frame-btn')?.addEventListener('click', () => {
        const id = 'slide-' + Date.now();
        const el = document.createElement('div');
        el.id = id;
        el.className = 'step slide';
        
        // Random position nearby last slide
        const lastSlide = slides[slides.length-1];
        const nx = (lastSlide ? lastSlide.object.position.x : 0) + 1200;
        const ny = (lastSlide ? lastSlide.object.position.y : 0);
        
        el.setAttribute('data-x', nx);
        el.setAttribute('data-y', ny);
        el.setAttribute('data-scale', 1);

        const content = document.createElement('div');
        content.className = 'slide-content';
        el.appendChild(content);
        
        document.getElementById('presentation-container').appendChild(el);

        const cssObject = new THREE.CSS3DObject(el);
        cssObject.position.set(nx, ny, 0);
        scene.add(cssObject);

        const newIndex = slides.length;
        el.dataset.index = newIndex;
        slides.push({ element: el, object: cssObject, scale: 1 });

        setupSlideUI(el, newIndex);
        rebuildSidebar();
        
        // Bind dragging logic to new slide
        bindSlideDragging(el);
        
        gotoSlide(newIndex);
    });

    // Expose gotoSlide to window for inline onclick handlers
    window.gotoSlide = gotoSlide;

    // Navigation function using GSAP
    function gotoSlide(index) {
        if (index < 0 || index >= slides.length) return;
        
        currentSlideIndex = index;
        const targetSlide = slides[currentSlideIndex];
        
        // Update active class
        slides.forEach(s => s.element.classList.remove('active'));
        targetSlide.element.classList.add('active');

        // Update sidebar active class
        document.querySelectorAll('.frame-item').forEach((el, idx) => {
            if (idx === index) el.classList.add('active');
            else el.classList.remove('active');
        });
        
        // Move camera to view the slide properly in 2D, including scale (zoom)
        const baseDistance = 1500;
        
        gsap.killTweensOf(camera.position);
        
        // Simple 2D pan and zoom to the target X, Y, and Scale
        gsap.to(camera.position, {
            x: targetSlide.object.position.x,
            y: targetSlide.object.position.y,
            z: baseDistance * targetSlide.scale,
            duration: 1.2,
            ease: "power3.inOut"
        });

        updateCounter();
    }

    // Go to overview initially, or first slide if no overview
    const overviewIndex = slides.findIndex(s => s.element.id === 'overview');
    if (overviewIndex !== -1) {
        gotoSlide(overviewIndex);
    } else {
        gotoSlide(0);
    }

    function nextSlide() {
        if (overviewIndex !== -1 && currentSlideIndex === overviewIndex) {
            gotoSlide(0); // From overview to first slide
        } else {
            gotoSlide(Math.min(currentSlideIndex + 1, slides.length - 1));
        }
    }

    function prevSlide() {
        if (overviewIndex !== -1 && currentSlideIndex === 0) {
            gotoSlide(overviewIndex); // From first slide to overview
        } else {
            gotoSlide(Math.max(currentSlideIndex - 1, 0));
        }
    }

    // Update Counter
    function updateCounter() {
        const slideCounterElem = document.getElementById('current-slide');
        const totalSlidesElem = document.getElementById('total-slides');
        
        let displayCurrent = currentSlideIndex + 1;
        let displayTotal = slides.length;

        // If overview is the last slide, don't count it in the total
        if (overviewIndex === slides.length - 1) {
            displayTotal = slides.length - 1;
            // If we are currently ON the overview, just show "All" or similar, or cap it at total
            if (currentSlideIndex === overviewIndex) {
                displayCurrent = "All";
            }
        }
        
        if (slideCounterElem) slideCounterElem.textContent = displayCurrent;
        if (totalSlidesElem) totalSlidesElem.textContent = displayTotal;
    }

    // Keyboard Navigation
    document.addEventListener('keydown', function(event) {
        const isEditable = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;
        
        // Prevent default scrolling for arrow keys
        if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", "Escape", " "].includes(event.key)) {
            // Only prevent if we're not focusing an input
            if (!isEditable) {
                event.preventDefault();
            }
        }

        if (isEditable) return;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
            nextSlide();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            prevSlide();
        } else if (event.key === 'Home') {
            gotoSlide(0);
        } else if (event.key === 'End') {
            // Go to actual last slide (before overview if it exists)
            gotoSlide(overviewIndex === totalSlides - 1 ? totalSlides - 2 : totalSlides - 1);
        } else if (event.key === 'Escape') {
            if (overviewIndex !== -1) {
                gotoSlide(overviewIndex);
            }
        }
    });

    // Navigation Buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);

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
                nextSlide();
            } else {
                prevSlide();
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
        
        const bgColor = slideData.element.getAttribute('data-bgcolor') || '#ffffff';
        const bgOpacity = parseFloat(slideData.element.getAttribute('data-opacity')) || 0.6;

        positionPanel.innerHTML = `
            <div class="position-info">
                <h4>📍 Position & Background</h4>
                <p><strong>X:</strong> <input type="number" value="${Math.round(x)}" data-prop="x" class="pos-input"></p>
                <p><strong>Y:</strong> <input type="number" value="${Math.round(y)}" data-prop="y" class="pos-input"></p>
                <p><strong>Scale:</strong> <input type="number" value="${scale}" step="0.1" data-prop="scale" class="pos-input"></p>
                <p><strong>Color:</strong> <input type="color" value="${bgColor}" data-prop="bgcolor" class="pos-input"></p>
                <p><strong>Glass Opacity:</strong> <input type="range" min="0" max="1" step="0.1" value="${bgOpacity}" data-prop="opacity" class="pos-input"></p>
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
                if (prop === 'bgcolor' || prop === 'opacity') {
                    slideData.element.setAttribute('data-' + prop, input.value);
                    const content = slideData.element.querySelector('.slide-content');
                    if (content) {
                        if (prop === 'bgcolor') content.style.backgroundColor = input.value;
                        if (prop === 'opacity') content.style.opacity = input.value;
                    }
                    return;
                }
                
                const val = parseFloat(input.value) || 0;
                if (prop === 'x') slideData.object.position.x = val;
                if (prop === 'y') slideData.object.position.y = val;
                if (prop === 'scale') {
                    slideData.scale = val;
                    slideData.object.scale.set(val, val, val);
                }
                
                // Update DOM attributes for persistence if needed
                slideData.element.setAttribute('data-' + prop, val);
            });
            // Re-center camera if it's the current slide
            if (slideData.element.dataset.index == currentSlideIndex) {
                gotoSlide(currentSlideIndex);
            }
        });

        // Add event listener to save to server button
        document.getElementById('save-server-btn').addEventListener('click', () => {
            document.getElementById('update-btn').click(); // first apply locally
            savePresentationToServer(document.getElementById('save-server-btn'));
        });
    }

    function savePresentationToServer(btnElement = null) {
        const payload = {
            Slides: []
        };

        slides.forEach(s => {
            if (!s.element.id) return;
            
            const slideData = {
                Id: s.element.id,
                X: s.object.position.x,
                Y: s.object.position.y,
                Z: s.object.position.z,
                Scale: s.scale,
                BgColor: s.element.getAttribute('data-bgcolor') || '#ffffff',
                BgOpacity: parseFloat(s.element.getAttribute('data-opacity')) !== null && !isNaN(parseFloat(s.element.getAttribute('data-opacity'))) ? parseFloat(s.element.getAttribute('data-opacity')) : 0.6,
                Elements: []
            };

            // Gather elements
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
                        Height: parseFloat(el.style.height) || 100
                    });
                });
            }
            
            payload.Slides.push(slideData);
        });
        
        const btn = btnElement || document.getElementById('tb-save-btn');
        const originalText = btn ? btn.innerHTML : '';
        if(btn) btn.textContent = "Saving...";
        
        fetch('/Indexpreze?handler=SavePresentation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(res => {
            if(res.ok) {
                if(btn) btn.textContent = "✅ Saved!";
                setTimeout(() => { if(btn) btn.innerHTML = originalText; }, 2000);
            } else {
                if(btn) btn.textContent = "❌ Error!";
            }
        }).catch(e => {
            console.error(e);
            if(btn) btn.textContent = "❌ Error!";
        });
    }

    // --- 2D Editor Toolbar ---
    const editToolbar = document.createElement('div');
    editToolbar.className = 'edit-toolbar';
    editToolbar.innerHTML = `
        <div class="toolbar-group">
            <button class="tb-btn active" data-mode="move">✥ Move</button>
            <button class="tb-btn" data-mode="scale">⤢ Scale</button>
        </div>
        <div class="toolbar-group">
            <button class="tb-btn active" data-axis="x">X</button>
            <button class="tb-btn" data-axis="y">Y</button>
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
        savePresentationToServer(document.getElementById('tb-save-btn'));
    });

    function bindSlideDragging(el) {
        el.style.cursor = 'grab';

        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // Left click only
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.slide-element')) return; 

            // Find slide data
            const slideData = slides.find(s => s.element === el);
            if (!slideData) return;

            isDragging = true;
            draggedSlide = slideData;
            el.style.cursor = 'grabbing';
            el.classList.add('dragging');
            
            // --- Prezi-Style Selection ---
            slides.forEach(s => s.element.classList.remove('editor-selected'));
            el.classList.add('editor-selected');

            // Determine if scaling via corner handle
            if (e.target.classList.contains('resize-handle')) {
                editMode = 'scale';
                editToolbar.querySelectorAll('.tb-btn[data-mode]').forEach(b => b.classList.remove('active'));
                const scaleBtn = editToolbar.querySelector('.tb-btn[data-mode="scale"]');
                if (scaleBtn) scaleBtn.classList.add('active');
            } else {
                editMode = 'move';
                editToolbar.querySelectorAll('.tb-btn[data-mode]').forEach(b => b.classList.remove('active'));
                const moveBtn = editToolbar.querySelector('.tb-btn[data-mode="move"]');
                if (moveBtn) moveBtn.classList.add('active');
            }

            editToolbar.classList.add('visible');

            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            objStartX = slideData.object.position.x;
            objStartY = slideData.object.position.y;
            objStartZ = slideData.object.position.z;
            objStartScale = slideData.scale;

            showPositionPanel(slideData);
            
            e.stopPropagation(); 
        });

        // Double click to add text
        el.addEventListener('dblclick', function(e) {
            // Ignore if double clicking on an existing slide-element
            if (e.target.closest('.slide-element')) return;
            
            const slideData = slides.find(s => s.element === el);
            if (!slideData || slideData.element.id === 'overview') return;
            
            // Ensure we are ON this slide
            if (slides.indexOf(slideData) !== currentSlideIndex) {
                gotoSlide(slides.indexOf(slideData));
            }
            
            // Calculate relative click position if possible
            let x = 50, y = 50;
            const content = el.querySelector('.slide-content');
            if (content) {
                const rect = content.getBoundingClientRect();
                x = (e.clientX - rect.left) / (rect.width / content.offsetWidth);
                y = (e.clientY - rect.top) / (rect.height / content.offsetHeight);
            }
            
            addTextToCurrentSlide(x, y);
        });
    }

    // Bind to initial slides
    document.querySelectorAll('.slide, #overview').forEach(bindSlideDragging);

    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !draggedSlide) return;

        // Calculate delta in screen coordinates
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : -deltaY;
        
        const distance = camera.position.distanceTo(draggedSlide.object.position);
        const translateFactor = (distance / 1000) * 1.5;
        const scaleFactor = 0.01;

        if (editMode === 'move') {
            draggedSlide.object.position.x = objStartX + (deltaX * translateFactor);
            draggedSlide.object.position.y = objStartY - (deltaY * translateFactor);
        } else if (editMode === 'scale') {
            const newScale = Math.max(0.1, objStartScale + (delta * scaleFactor));
            draggedSlide.scale = newScale;
            draggedSlide.object.scale.set(newScale, newScale, newScale);
        }

        // Update panel inputs in real-time
        const xInput = positionPanel.querySelector('[data-prop="x"]');
        const yInput = positionPanel.querySelector('[data-prop="y"]');
        const scaleInput = positionPanel.querySelector('[data-prop="scale"]');
        if (xInput) xInput.value = Math.round(draggedSlide.object.position.x);
        if (yInput) yInput.value = Math.round(draggedSlide.object.position.y);
        if (scaleInput) scaleInput.value = draggedSlide.scale.toFixed(2);
    });

    document.addEventListener('mouseup', function(e) {
        if (isDragging && draggedSlide) {
            draggedSlide.element.style.cursor = 'grab';
            draggedSlide.element.classList.remove('dragging');
            
            // We KEEP .editor-selected so the handles stay visible until another slide is clicked.
            // If they click on the background (not a slide), we could remove it, but for now it's fine.

            // Update attributes
            draggedSlide.element.setAttribute('data-x', Math.round(draggedSlide.object.position.x));
            draggedSlide.element.setAttribute('data-y', Math.round(draggedSlide.object.position.y));
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
