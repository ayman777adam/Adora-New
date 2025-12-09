// ============================================
// == Guest Engine Hybrid - Geo-Fence + Device Security ==
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // == Configuration ==========================
    // ============================================
    
    const urlParams = new URLSearchParams(window.location.search);
    const HOTEL_ID = urlParams.get('hotel') || 'default';
    const SHIFT_HOURS = 4; // نافذة 12 ساعة تبدأ من 04:00
    const DEVICE_LIMIT = 2; // حد أقصى 2 أجهزة لكل نافذة
    const DEFAULT_RADIUS = 150; // متر
    
    let db = null;
    let currentRoom = null;
    let geolocationPermissionGranted = false; // ✅ متغير لتخزين حالة الإذن
    let geolocationPermissionChecked = false; // ✅ متغير لتتبع ما إذا تم التحقق من الإذن
    
    // ============================================
    // == Initialize Firebase ====================
    // ============================================
    
    function initFirebaseHybrid() {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                db = firebase.firestore();
            } else {
                const firebaseConfig = {
                    apiKey: "AIzaSyD1rY9BUciB0ir1b8begsPozpJzgwnR-Z0",
                    authDomain: "adora-staff5255.firebaseapp.com",
                    projectId: "adora-staff5255",
                    storageBucket: "adora-staff5255.firebasestorage.app",
                    messagingSenderId: "96309381730",
                    appId: "1:96309381730:web:d24e0d275255347e43df3b"
                };
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
            }
        } catch(e) {
            console.error('Firebase initialization error:', e);
        }
    }
    
    // ============================================
    // == Device Fingerprint ======================
    // ============================================
    
    async function getDeviceFingerprintHybrid() {
        const components = [];
        
        // 1. User Agent
        if (navigator.userAgent) {
            components.push(navigator.userAgent);
        }
        
        // 2. Screen resolution
        if (screen.width && screen.height) {
            components.push(`${screen.width}x${screen.height}`);
        }
        
        // 3. Timezone
        if (Intl && Intl.DateTimeFormat) {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                components.push(tz);
            } catch(e) {}
        }
        
        // 4. Language
        if (navigator.language) {
            components.push(navigator.language);
        }
        
        // 5. Canvas fingerprint (fallback)
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Device fingerprint', 2, 2);
            const canvasData = canvas.toDataURL();
            components.push(canvasData.substring(0, 100));
        } catch(e) {}
        
        const combined = components.join('|');
        
        // Hash using crypto.subtle if available
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(combined);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch(e) {
                console.warn('crypto.subtle failed, using btoa fallback');
            }
        }
        
        // Fallback: btoa
        try {
            return btoa(combined).substring(0, 32);
        } catch(e) {
            return combined.substring(0, 32);
        }
    }
    
    // ============================================
    // == Window Key Generation ==================
    // ============================================
    
    function getWindowKey(timestamp = Date.now()) {
        const date = new Date(timestamp);
        const shiftedHours = date.getHours() - SHIFT_HOURS;
        const adjustedDate = new Date(date);
        if (shiftedHours < 0) {
            adjustedDate.setDate(adjustedDate.getDate() - 1);
            adjustedDate.setHours(shiftedHours + 24);
        } else {
            adjustedDate.setHours(shiftedHours);
        }
        
        const year = adjustedDate.getFullYear();
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const period = adjustedDate.getHours() < 12 ? 'AM' : 'PM';
        
        return `${year}-${month}-${day}_${period}`;
    }
    
    // ============================================
    // == Read Geofence ==========================
    // ============================================
    
    async function readGeofenceForHotel() {
        if (!db) {
            initFirebaseHybrid();
            if (!db) return null;
        }
        
        try {
            const doc = await db.collection('hotel_settings').doc(HOTEL_ID).get();
            if (!doc.exists) return null;
            
            const data = doc.data();
            if (data.geofence) {
                return {
                    lat: data.geofence.lat,
                    lng: data.geofence.lng,
                    radiusMeters: data.geofence.radiusMeters || DEFAULT_RADIUS
                };
            }
            return null;
        } catch(e) {
            console.error('Error reading geofence:', e);
            return null;
        }
    }
    
    // ============================================
    // == Geolocation Check =======================
    // ============================================
    
    // ✅ التحقق من إذن الموقع مرة واحدة فقط في صفحة الدخول
    function checkGeolocationPermissionOnce() {
        if (geolocationPermissionChecked) {
            return Promise.resolve(geolocationPermissionGranted);
        }
        
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                geolocationPermissionChecked = true;
                geolocationPermissionGranted = false;
                resolve(false);
                return;
            }
            
            // التحقق من حالة الإذن مرة واحدة فقط
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then(result => {
                    geolocationPermissionGranted = result.state === 'granted';
                    geolocationPermissionChecked = true;
                    
                    // الاستماع لتغييرات حالة الإذن
                    if (result.onchange) {
                        result.onchange = () => {
                            geolocationPermissionGranted = result.state === 'granted';
                        };
                    }
                    
                    resolve(geolocationPermissionGranted);
                }).catch(() => {
                    geolocationPermissionChecked = true;
                    geolocationPermissionGranted = false;
                    resolve(false);
                });
            } else {
                // Fallback: إذا لم يكن permissions API متاحاً، نفترض أن الإذن غير ممنوح
                geolocationPermissionChecked = true;
                geolocationPermissionGranted = false;
                resolve(false);
            }
        });
    }
    
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            // ✅ استخدام حالة الإذن المحفوظة لتجنب طلب الإذن مرة أخرى
            const options = {
                enableHighAccuracy: false,
                timeout: 5000,
                // ✅ إذا كان الإذن ممنوحاً، استخدم maximumAge كبير جداً لتجنب طلب الإذن
                maximumAge: geolocationPermissionGranted ? 86400000 : 0 // 24 ساعة إذا كان الإذن ممنوحاً
            };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    reject(error);
                },
                options
            );
        });
    }
    
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // ============================================
    // == Device Transactional Check =============
    // ============================================
    
    async function checkDeviceTransactionalAndSend(roomNum, requestData, onSuccess, onError) {
        if (!db) {
            initFirebaseHybrid();
            if (!db) {
                onError('Database not available');
                return;
            }
        }
        
        try {
            const deviceId = await getDeviceFingerprintHybrid();
            const windowKey = getWindowKey();
            const roomSecurityPath = `hotel_settings/${HOTEL_ID}/room_security/${roomNum}`;
            
            await db.runTransaction(async (transaction) => {
                const roomSecurityRef = db.doc(roomSecurityPath);
                const roomSecurityDoc = await transaction.get(roomSecurityRef);
                
                const now = firebase.firestore.Timestamp.now();
                const data = roomSecurityDoc.exists ? roomSecurityDoc.data() : { windows: {}, lastUpdate: now };
                
                if (!data.windows) data.windows = {};
                if (!data.windows[windowKey]) {
                    data.windows[windowKey] = { devices: [], createdAt: now };
                }
                
                const window = data.windows[windowKey];
                const deviceIndex = window.devices.indexOf(deviceId);
                
                if (deviceIndex === -1) {
                    // New device
                    if (window.devices.length >= DEVICE_LIMIT) {
                        throw new Error('DEVICE_LIMIT_EXCEEDED');
                    }
                    window.devices.push(deviceId);
                }
                
                data.lastUpdate = now;
                transaction.set(roomSecurityRef, data, { merge: true });
            });
            
            // Success - proceed with sending request
            onSuccess();
            
        } catch(error) {
            if (error.message === 'DEVICE_LIMIT_EXCEEDED') {
                const nextWindow = getNextWindowTime();
                onError({
                    type: 'DEVICE_LIMIT_EXCEEDED',
                    message: `تم الوصول للحد الأقصى من الأجهزة (${DEVICE_LIMIT}) لهذه النافذة الزمنية. يمكنك المحاولة مرة أخرى بعد ${nextWindow}`,
                    nextWindow: nextWindow
                });
            } else {
                console.error('Transaction error:', error);
                // Fail-open policy: allow request on error
                onSuccess();
            }
        }
    }
    
    function getNextWindowTime() {
        const now = new Date();
        const currentWindow = getWindowKey();
        const isAM = currentWindow.endsWith('_AM');
        const nextDate = new Date(now);
        
        if (isAM) {
            // Next is PM (same day, 12 hours later)
            nextDate.setHours(now.getHours() < SHIFT_HOURS + 12 ? SHIFT_HOURS + 12 : SHIFT_HOURS + 24);
        } else {
            // Next is AM (next day)
            nextDate.setDate(nextDate.getDate() + 1);
            nextDate.setHours(SHIFT_HOURS);
        }
        
        return nextDate.toLocaleString('ar-EG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // ============================================
    // == Main Secure Send Function ==============
    // ============================================
    
    window.secureSendHybrid = async function(requestData, onSuccess, onError) {
        try {
            // 1. Read geofence
            const geofence = await readGeofenceForHotel();
            
            if (geofence) {
                // 2. Get current location
                try {
                    const location = await getCurrentLocation();
                    const distance = calculateDistance(
                        location.lat, location.lng,
                        geofence.lat, geofence.lng
                    );
                    
                    if (distance > geofence.radiusMeters) {
                        // Outside geofence - soft fail, proceed to device check
                        console.warn('Outside geofence, proceeding to device check');
                    } else {
                        // Inside geofence - proceed directly
                        await checkDeviceTransactionalAndSend(
                            requestData.roomNum || currentRoom,
                            requestData,
                            onSuccess,
                            onError
                        );
                        return;
                    }
                } catch(geoError) {
                    console.warn('Geolocation error, proceeding to device check:', geoError);
                    // Fail-open: proceed to device check
                }
            }
            
            // 3. Device check (if geofence failed or not configured)
            await checkDeviceTransactionalAndSend(
                requestData.roomNum || currentRoom,
                requestData,
                onSuccess,
                onError
            );
            
        } catch(error) {
            console.error('secureSendHybrid error:', error);
            // Fail-open policy
            onSuccess();
        }
    };
    
    // Initialize
    initFirebaseHybrid();
    
    // Get room from URL
    currentRoom = urlParams.get('room') || '--';
    
    // ✅ تصدير دالة التحقق من الإذن للاستخدام في صفحة الدخول
    window.checkGeolocationPermissionOnce = checkGeolocationPermissionOnce;
    
})();

