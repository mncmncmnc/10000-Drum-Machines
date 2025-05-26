// Global variables
let scene, camera, renderer, earth, sunLight, terminator, clouds;
let activeCities = new Map();
const EARTH_RADIUS = 5;
const EARTH_SEGMENTS = 64;
let rotationSpeed = 5000; // Default speed multiplier set to 5000x
let showNight = true;
let showClouds = true;
let nightTexture; // Add this to store the night texture globally
const NORMAL_SUN_INTENSITY = 2.0; // Store the normal sun intensity
const EVEN_LIGHTING_INTENSITY = 0.5; // Intensity for even lighting mode
let ambientLight; // Store ambient light reference globally

// Audio context and sounds
let audioContext;
let drumSounds = new Map();
const DRUM_SOUNDS = [
    'rim tap.wav', 'block.wav', 'bass hit 5.wav', 'bass hit 4.wav', 'bass hit 3.wav',
    'bass hit 2.wav', 'bass hit 1.wav', 'tom rattle.wav', 'bass drum.wav',
    'laser snare.wav', 'bell rim 2.wav', 'bell rim 1.wav', 'snare muted.wav',
    'plonk high.wav', 'plonk low.wav', 'tom mid.wav', 'tom high.wav',
    'tom low.wav', 'rim ring.wav', 'hihat closed boink.wav', 'hihat closed pitch.wav',
    'bass short.wav', 'snare thwack.wav', 'beep slight.wav', 'snare slap.wav',
    'laser.wav', 'hihat open snap.wav', 'bloop.wav', 'hihat closed snap.wav'
];

// Constants for rotation calculation
const RADIANS_PER_DAY = Math.PI * 2; // 2π radians per day
const FRAMES_PER_DAY = 24 * 60 * 60 * 60; // Assuming 60fps
const BASE_ROTATION_SPEED = RADIANS_PER_DAY / FRAMES_PER_DAY; // Radians per frame for real-time

// Add pulse effect geometry and material as reusable objects
const pulseGeometry = new THREE.RingGeometry(0.05, 0.1, 32);
const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});

// Create a pulse effect at a specific position
function createPulseEffect(position) {
    // Create a very thin ring that will expand
    const pulse = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.063, 64), // Slightly thicker ring
        new THREE.MeshBasicMaterial({
            color: 0xff3333, // Brighter red
            transparent: true,
            opacity: 1.0,    // Full opacity
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            renderOrder: 1
        })
    );
    
    // Position exactly at the city's position
    pulse.position.copy(position);
    
    // Make sure the ring is perpendicular to the view direction
    pulse.lookAt(camera.position);
    
    pulse.userData = {
        startTime: Date.now(),
        duration: 800, 
        maxScale: 12, 
        startScale: 1
    };
    
    // Add to Earth so it moves with the city
    earth.add(pulse);
    return pulse;
}

// Update pulse effects
function updatePulseEffects() {
    // Update pulses that are children of Earth
    earth.children.forEach(child => {
        if (child.userData && child.userData.startTime) {
            const age = Date.now() - child.userData.startTime;
            const progress = age / child.userData.duration;
            
            if (progress >= 1) {
                earth.remove(child);
            } else {
                // Smooth easing function for more natural expansion
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const scale = child.userData.startScale + (child.userData.maxScale - child.userData.startScale) * easedProgress;
                
                child.scale.set(scale, scale, scale);
                // Slower fade out for more visibility
                child.material.opacity = 1.0 * (1 - progress * progress * progress);
                child.lookAt(camera.position);
            }
        }
    });
}

// Check if a point is crossing the terminator
function isCrossingTerminator(position, lastPosition) {
    const currentX = position.x;
    const lastX = lastPosition.x;
    
    // Only trigger when crossing from night (negative x) to daylight (positive x)
    const crossingToDaylight = lastX < 0 && currentX > 0;
    
    if (crossingToDaylight) {
        // Additional check to ensure we're actually on the terminator circle
        const yzDistance = Math.sqrt(position.y * position.y + position.z * position.z);
        const isOnTerminator = Math.abs(yzDistance - EARTH_RADIUS) < 0.1;
        return isOnTerminator;
    }
    return false;
}

// Create a simple colored material as fallback
function createFallbackMaterial() {
    return new THREE.MeshPhongMaterial({
        color: 0x2233ff,
        shininess: 5,
        specular: 0x333333,
        emissive: 0x000000,
        emissiveIntensity: 0.2
    });
}

// Create the terminator line
function createTerminator() {
    const segments = 128; // Number of segments for smooth circle
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    
    // Create a line of points at the terminator boundary
    // Extremely slight extension beyond Earth's radius
    const scaleFactor = 1.01; // Just 1% beyond Earth's radius
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = 0; // Keep x at 0 for the terminator plane
        const y = EARTH_RADIUS * Math.cos(theta) * scaleFactor;
        const z = EARTH_RADIUS * Math.sin(theta) * scaleFactor;
        vertices.push(x, y, z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.5
    });
    
    terminator = new THREE.Line(geometry, material);
    scene.add(terminator);
}

// Initialize audio context and load sounds
async function initializeAudio() {
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load all drum sounds
        for (const soundFile of DRUM_SOUNDS) {
            const response = await fetch(`drums/${soundFile}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            drumSounds.set(soundFile, audioBuffer);
        }
        
        console.log('All drum sounds loaded successfully');
        
        // Resume audio context on first user interaction
        document.addEventListener('click', () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }, { once: true });
        
    } catch (error) {
        console.error('Error initializing audio:', error);
    }
}

// Play a drum sound
function playDrumSound(soundFile) {
    if (!audioContext || !drumSounds.has(soundFile)) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = drumSounds.get(soundFile);
    source.connect(audioContext.destination);
    source.start();
}

// Get a random drum sound
function getRandomDrumSound() {
    const sounds = Array.from(drumSounds.keys());
    return sounds[Math.floor(Math.random() * sounds.length)];
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Initializing Three.js application...');
        
        // Initialize audio first
        await initializeAudio();
        console.log('Audio initialized');
        
        // Initialize modal
        initializeModal();
        console.log('Modal initialized');
        
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Black background
        
        // Create camera
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Position camera to center on actual terminator line (x=0)
        const cameraDistance = 22;
        camera.position.set(0, 0, cameraDistance); // Back to original position
        camera.lookAt(0, 0, 0); // Look at center
        console.log('Camera position:', camera.position);
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('globeContainer').appendChild(renderer.domElement);
        console.log('Renderer created and added to DOM');
        
        // Add ambient light
        ambientLight = new THREE.AmbientLight(0x404040, 0.05); // Store reference globally
        scene.add(ambientLight);
        console.log('Ambient light added');
        
        // Add directional light (sun)
        sunLight = new THREE.DirectionalLight(0xffffff, 2.0); // Increased intensity
        sunLight.position.set(1, 0, 0); // Back to original position
        scene.add(sunLight);
        console.log('Sun light added at position:', sunLight.position);
        
        // Create Earth
        await createEarth();
        console.log('Earth created and added to scene');
        
        // Create terminator line
        createTerminator();
        console.log('Terminator line created and added to scene');
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);
        
        // Initialize UI controls
        initializeControls();
        console.log('UI controls initialized');
        
        // Start animation loop
        animate();
        console.log('Animation loop started');
        
    } catch (error) {
        console.error('Error initializing Three.js:', error);
    }
}

// Create the Earth sphere
async function createEarth() {
    try {
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(EARTH_RADIUS, EARTH_SEGMENTS, EARTH_SEGMENTS);
        console.log('Earth geometry created');

        // Load all textures
        const textureLoader = new THREE.TextureLoader();
        let dayTexture, cloudTexture, normalMap, specularMap;
        try {
            [dayTexture, nightTexture, cloudTexture, normalMap, specularMap] = await Promise.all([
                new Promise((resolve, reject) => {
                    textureLoader.load('earth_textures/2k_earth_daymap.jpg', resolve, undefined, reject);
                }),
                new Promise((resolve, reject) => {
                    textureLoader.load('earth_textures/2k_earth_nightmap.jpg', resolve, undefined, reject);
                }),
                new Promise((resolve, reject) => {
                    textureLoader.load('earth_textures/2k_earth_clouds.jpg', resolve, undefined, reject);
                }),
                new Promise((resolve, reject) => {
                    textureLoader.load('earth_textures/2k_earth_normal_map.jpg', resolve, undefined, reject);
                }),
                new Promise((resolve, reject) => {
                    textureLoader.load('earth_textures/2k_earth_specular_map.jpg', resolve, undefined, reject);
                })
            ]);
            
            // Store nightTexture globally
            window.nightTexture = nightTexture;
        } catch (textureError) {
            console.warn('Using fallback material due to texture loading error');
            const material = createFallbackMaterial();
            earth = new THREE.Mesh(geometry, material);
            earth.rotation.y = 0;
            scene.add(earth);
            return;
        }

        // Enhanced shader material for better Earth rendering
        const material = new THREE.ShaderMaterial({
            uniforms: {
                dayMap: { value: dayTexture },
                nightMap: { value: nightTexture },
                normalMap: { value: normalMap },
                specularMap: { value: specularMap },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                time: { value: 0 },
                showNight: { value: true },
                evenLighting: { value: false } // Add new uniform for even lighting
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D dayMap;
                uniform sampler2D nightMap;
                uniform sampler2D normalMap;
                uniform sampler2D specularMap;
                uniform vec3 sunDirection;
                uniform float time;
                uniform bool showNight;
                uniform bool evenLighting;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    // Sample textures
                    vec4 dayColor = texture2D(dayMap, vUv);
                    vec4 nightColor = texture2D(nightMap, vUv);
                    vec3 normal = normalize(vNormal);
                    vec3 normalMap = normalize(texture2D(normalMap, vUv).xyz * 2.0 - 1.0);
                    float specular = texture2D(specularMap, vUv).r;
                    
                    // Combine normals
                    normal = normalize(normal + normalMap * 0.5);
                    
                    // Calculate lighting
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 sunDir = normalize(sunDirection);
                    float dotNL = dot(normal, sunDir);
                    
                    // Original terminator calculation, modified for even lighting
                    float dayFactor = evenLighting ? 0.5 : clamp(dotNL, 0.0, 1.0);
                    float nightFactor = showNight && !evenLighting ? (1.0 - dayFactor) : 0.0;
                    
                    // Selective city lights boost with much darker base
                    float cityLightMask = smoothstep(0.1, 0.3, nightColor.r);
                    vec3 boostedNightColor = mix(nightColor.rgb * 0.1, nightColor.rgb * 3.0, cityLightMask);
                    
                    // Specular highlight (reduced in even lighting mode)
                    vec3 reflectDir = reflect(-sunDir, normal);
                    float spec = evenLighting ? 0.0 : pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * specular;
                    
                    // Reduced atmospheric scattering for darker night
                    float atmosphere = evenLighting ? 0.0 : pow(1.0 - abs(dot(viewDir, normal)), 2.0) * 0.2;
                    
                    // Combine colors with enhanced effects
                    vec3 finalColor = dayColor.rgb * dayFactor + 
                                    boostedNightColor * nightFactor * 0.3 +
                                    vec3(0.05, 0.1, 0.2) * atmosphere +
                                    vec3(1.0) * spec * dayFactor;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        earth = new THREE.Mesh(geometry, material);
        earth.rotation.y = 0;
        scene.add(earth);
        console.log('Earth mesh with enhanced shader created and added to scene');

        // Enhanced cloud layer
        const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.01, EARTH_SEGMENTS, EARTH_SEGMENTS);
        const cloudMaterial = new THREE.ShaderMaterial({
            uniforms: {
                cloudMap: { value: cloudTexture },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D cloudMap;
                uniform vec3 sunDirection;
                uniform float time;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec4 cloudColor = texture2D(cloudMap, vUv);
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 sunDir = normalize(sunDirection);
                    
                    // Enhanced cloud lighting
                    float dotNL = dot(vNormal, sunDir);
                    float cloudFactor = smoothstep(0.0, 0.5, cloudColor.r);
                    
                    // Cloud edge glow
                    float edgeGlow = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
                    
                    // Combine effects
                    vec3 finalColor = cloudColor.rgb * (0.5 + 0.5 * dotNL) + 
                                    vec3(1.0) * edgeGlow * 0.2;
                    
                    gl_FragColor = vec4(finalColor, cloudFactor * 0.8);
                }
            `,
            transparent: true,
            depthWrite: false
        });
        
        clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        clouds.rotation.y = 0;
        scene.add(clouds);
        console.log('Enhanced cloud layer added');
        
    } catch (error) {
        console.error('Error creating Earth:', error);
        const geometry = new THREE.SphereGeometry(EARTH_RADIUS, EARTH_SEGMENTS, EARTH_SEGMENTS);
        const material = createFallbackMaterial();
        earth = new THREE.Mesh(geometry, material);
        earth.rotation.y = 0;
        scene.add(earth);
    }
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001; // Convert to seconds
    
    // Rotate Earth
    if (earth) {
        earth.rotation.y += BASE_ROTATION_SPEED * rotationSpeed;
        if (earth.material.uniforms) {
            earth.material.uniforms.time.value = time;
        }
    }
    
    // Rotate clouds with Earth and add small extra rotation
    if (clouds) {
        clouds.rotation.y += BASE_ROTATION_SPEED * rotationSpeed + 0.00008;
        if (clouds.material.uniforms) {
            clouds.material.uniforms.time.value = time;
        }
    }
    
    // Update city positions and check transitions
    updateCities();
    
    renderer.render(scene, camera);
}

// Convert lat/lon to 3D position
function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
    // Convert to radians
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    
    // Coordinate transformation to match Earth's orientation
    const x = radius * Math.cos(latRad) * Math.cos(-lonRad); // Restore negative sign for longitude
    const z = radius * Math.cos(latRad) * Math.sin(-lonRad); // Restore negative sign for longitude
    const y = radius * Math.sin(latRad);
    
    return new THREE.Vector3(x, y, z);
}

// Load cities data from JSON file
async function loadCitiesData() {
    try {
        const response = await fetch('cities_filtered.json');
        const data = await response.json();
        const cities = new Map();
        
        // Handle array of cities directly (no 'cities' property)
        data.forEach(city => {
            // Store with lowercase name for case-insensitive search
            cities.set(city.name.toLowerCase(), {
                name: city.name,
                country: city.country,
                lat: city.lat,
                lon: city.lon,
                population: city.population
            });
        });
        
        console.log(`Loaded ${cities.size} major cities`);
        return cities;
    } catch (error) {
        console.error('Error loading cities data:', error);
        return new Map();
    }
}

// Initialize UI controls
function initializeControls() {
    const rotationSpeedInput = document.getElementById('rotationSpeed');
    const speedValueDisplay = document.getElementById('speedValue');
    const cityInput = document.getElementById('cityInput');
    const toggleButton = document.getElementById('toggleCityList');
    const cityList = document.getElementById('cityList');
    
    // Add event listeners for toggles
    document.getElementById('nightToggle').addEventListener('change', (e) => {
        if (earth && earth.material.uniforms) {
            earth.material.uniforms.nightMap.value = e.target.checked ? window.nightTexture : null;
            // Update even lighting based on both toggles
            updateEvenLighting();
        }
    });
    
    document.getElementById('cloudsToggle').addEventListener('change', (e) => {
        if (clouds) {
            clouds.visible = e.target.checked;
            // Update even lighting based on both toggles
            updateEvenLighting();
        }
    });

    document.getElementById('terminatorToggle').addEventListener('change', (e) => {
        if (terminator) {
            terminator.visible = e.target.checked;
        }
    });

    // Function to update even lighting based on other toggles
    function updateEvenLighting() {
        const nightToggle = document.getElementById('nightToggle');
        const cloudsToggle = document.getElementById('cloudsToggle');
        const isEvenLighting = !nightToggle.checked && !cloudsToggle.checked;
        
        // Update the lighting
        if (sunLight && earth && earth.material.uniforms) {
            earth.material.uniforms.evenLighting.value = isEvenLighting;
            
            if (isEvenLighting) {
                sunLight.intensity = EVEN_LIGHTING_INTENSITY;
                ambientLight.intensity = 0.3;
            } else {
                sunLight.intensity = NORMAL_SUN_INTENSITY;
                ambientLight.intensity = 0.05;
            }
        }
    }
    
    // Create custom dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'city-dropdown';
    dropdownContainer.style.display = 'none';
    cityInput.parentNode.appendChild(dropdownContainer);
    
    // Add toggle functionality
    toggleButton.addEventListener('click', () => {
        cityList.classList.toggle('collapsed');
        toggleButton.textContent = cityList.classList.contains('collapsed') ? 'Show Selected Cities ▼' : 'Hide Selected Cities ▲';
    });
    
    // Initially hide the city list container
    document.querySelector('.city-list-container').style.display = 'none';
    
    // Update the slider range for speed multiplier
    rotationSpeedInput.min = "1";      // Real time (1x)
    rotationSpeedInput.max = "30000";  // 30000x faster than real-time
    rotationSpeedInput.step = "1";     // Use 1 as base step for smooth movement
    rotationSpeedInput.value = "5000";    // Start at 5000x speed
    
    // Update the display immediately
    speedValueDisplay.textContent = "5000x";
    
    // Format speed display value
    function formatSpeedDisplay(speed) {
        if (speed >= 1000) {
            return Math.round(speed / 100) * 100 + "x";
        } else if (speed >= 10) {
            return Math.round(speed) + "x";
        } else {
            return speed.toFixed(1) + "x";
        }
    }
    
    // Add event listeners
    const updateSpeed = (e) => {
        const newSpeed = parseFloat(e.target.value);
        rotationSpeed = newSpeed;
        speedValueDisplay.textContent = formatSpeedDisplay(newSpeed);
    };
    
    rotationSpeedInput.addEventListener('input', updateSpeed);
    rotationSpeedInput.addEventListener('change', updateSpeed);
    
    // Initialize city input handling
    let citiesData = null;
    
    // Function to update the dropdown options
    function updateCityOptions(cities) {
        dropdownContainer.innerHTML = '';
        const searchTerm = cityInput.value.toLowerCase();
        
        // Filter and sort cities
        const filteredCities = Array.from(cities.entries())
            .filter(([name, city]) => 
                name.includes(searchTerm) || 
                city.country.toLowerCase().includes(searchTerm))
            .sort((a, b) => a[1].name.localeCompare(b[1].name));
        
        filteredCities.forEach(([name, city]) => {
            const div = document.createElement('div');
            div.className = 'city-option';
            if (activeCities.has(city.name)) {
                div.classList.add('selected');
            }
            
            const cityName = document.createElement('span');
            cityName.className = 'city-name';
            cityName.textContent = `${city.name}, ${city.country}`;
            
            const checkmark = document.createElement('span');
            checkmark.className = 'checkmark';
            checkmark.textContent = '✓';
            
            div.appendChild(cityName);
            if (activeCities.has(city.name)) {
                div.appendChild(checkmark);
            }
            
            div.addEventListener('click', () => {
                handleCitySelection(city.name);
                cityInput.value = '';
                dropdownContainer.style.display = 'none';
            });
            
            dropdownContainer.appendChild(div);
        });
    }
    
    // Function to handle city selection
    function handleCitySelection(cityName) {
        if (!citiesData) {
            loadCitiesData().then(cities => {
                citiesData = cities;
                const city = cities.get(cityName.toLowerCase());
                if (city) {
                    if (activeCities.has(city.name)) {
                        removeCity(city.name);
                    } else {
                        addCityToGlobe(city);
                    }
                    updateCityOptions(cities);
                }
            });
        } else {
            const city = citiesData.get(cityName.toLowerCase());
            if (city) {
                if (activeCities.has(city.name)) {
                    removeCity(city.name);
                } else {
                    addCityToGlobe(city);
                }
                updateCityOptions(citiesData);
            }
        }
    }
    
    // Add event listeners for city input
    cityInput.addEventListener('click', (e) => {
        if (citiesData) {
            updateCityOptions(citiesData);
            dropdownContainer.style.display = 'block';
        }
    });

    cityInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (citiesData) {
            updateCityOptions(citiesData);
            dropdownContainer.style.display = 'block';
        }
    });
    
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const cityName = e.target.value.split(',')[0].trim();
            if (cityName) {
                handleCitySelection(cityName);
                e.target.value = '';
                dropdownContainer.style.display = 'none';
            }
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !dropdownContainer.contains(e.target)) {
            dropdownContainer.style.display = 'none';
        }
    });
    
    // Load cities data and set up autocomplete
    loadCitiesData().then(cities => {
        citiesData = cities;
    });
}

// Add a city to the globe
function addCityToGlobe(cityData) {
    const position = latLonToVector3(cityData.lat, cityData.lon);
    
    // Create city marker
    const markerGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    earth.add(marker);
    
    // Create label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    context.fillStyle = 'white';
    context.font = 'bold 48px Arial';
    context.fillText(cityData.name, 20, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.copy(position);
    label.position.multiplyScalar(1.1);
    label.scale.set(2, 0.5, 1);
    earth.add(label);
    
    // Initialize with a random drum sound
    const selectedSound = getRandomDrumSound();
    
    // Initialize with null lastPosition - it will be set on first update
    activeCities.set(cityData.name, {
        marker,
        label,
        data: cityData,
        lastPosition: null,
        lastTransition: null,
        selectedSound
    });
    
    updateCityList();
}

// Remove a city from the globe
function removeCity(cityName) {
    const city = activeCities.get(cityName);
    if (city) {
        earth.remove(city.marker);
        earth.remove(city.label);
        activeCities.delete(cityName);
        updateCityList();
    }
}

// Update the city list UI
function updateCityList() {
    const cityList = document.getElementById('cityList');
    const toggleButton = document.getElementById('toggleCityList');
    cityList.innerHTML = '';
    
    // Hide the entire container if no cities
    const container = document.querySelector('.city-list-container');
    if (activeCities.size === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Show the container and update button text
    container.style.display = 'block';
    toggleButton.textContent = cityList.classList.contains('collapsed') ? 'Show Selected Cities ▼' : 'Hide Selected Cities ▲';
    
    // Add active cities to the list
    activeCities.forEach((city, name) => {
        const div = document.createElement('div');
        div.className = 'city-item';
        
        // Sort drum sounds alphabetically
        const sortedSounds = Array.from(drumSounds.keys()).sort((a, b) => 
            a.replace('.wav', '').localeCompare(b.replace('.wav', ''))
        );
        
        div.innerHTML = `
            <span class="city-name">${city.data.name}, ${city.data.country}</span>
            <select class="sound-selector">
                ${sortedSounds.map(soundFile => 
                    `<option value="${soundFile}" ${soundFile === city.selectedSound ? 'selected' : ''}>
                        ${soundFile.replace('.wav', '')}
                    </option>`
                ).join('')}
            </select>
            <button class="remove-btn" onclick="removeCity('${name}')" title="Remove city">×</button>
        `;
        
        // Add change event listener to the select element
        const select = div.querySelector('.sound-selector');
        select.addEventListener('change', (e) => {
            city.selectedSound = e.target.value;
        });
        
        cityList.appendChild(div);
    });
}

// Update cities and check transitions
function updateCities() {
    activeCities.forEach((city, name) => {
        const currentPosition = new THREE.Vector3();
        city.marker.getWorldPosition(currentPosition);
        
        if (city.lastPosition && isCrossingTerminator(currentPosition, city.lastPosition)) {
            // Get the local position relative to Earth for the pulse effect
            const localPosition = city.marker.position.clone();
            createPulseEffect(localPosition);
            
            // Play the selected drum sound
            playDrumSound(city.selectedSound);
        }
        
        if (!city.lastPosition) {
            city.lastPosition = new THREE.Vector3();
        }
        city.lastPosition.copy(currentPosition);
    });
    
    updatePulseEffects();
}

// Initialize modal functionality
function initializeModal() {
    // Create modal HTML structure
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close">×</button>
                <div class="modal-body">
                    ${document.getElementById('modalContent').innerHTML}
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modalOverlay = document.querySelector('.modal-overlay');
    const infoButton = document.querySelector('.info-button');
    const closeButton = document.querySelector('.modal-close');
    
    // Open modal
    infoButton.addEventListener('click', () => {
        modalOverlay.classList.add('active');
        // Prevent scrolling of background content
        document.body.style.overflow = 'hidden';
    });
    
    // Close modal
    function closeModal() {
        modalOverlay.classList.remove('active');
        // Restore scrolling
        document.body.style.overflow = '';
    }
    
    closeButton.addEventListener('click', closeModal);
    
    // Close modal when clicking outside content
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });
}

// Start the application
initializeApp();
