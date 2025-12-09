// ============================================
// == Guest Portal Engine - محرك بوابة النزيل ==
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // == Configuration & State ==================
    // ============================================
    
    // قراءة hotelId من URL أو استخدام default
    const urlParams = new URLSearchParams(window.location.search);
    const HOTEL_ID = urlParams.get('hotel') || 'default';
    const CACHE_KEY = `hotel_settings::${HOTEL_ID}`;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق
    
    let guestConfig = null;
    let currentRoom = null;
    // ✅ جلب رقم الغرفة من URL تلقائياً
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        currentRoom = roomFromUrl;
    }
    let db = null;
    let storage = null;
    let unsubscribeSettings = null;
    
    // Default Settings
    const DEFAULT_CONFIG = {
        siteTitle: 'بوابة النزيل | Adora',
        guestHeaderTitle: 'أهلاً بك في منظومة Adora',
        guestHeaderSubtitle: 'خدمة الغرفة السريعة',
        logoUrl: '',
        theme: {
            primaryColor: '#00ACC1',
            accentColor: '#F0F4FF',
            bgColor: '#E3E8FF',
            bgImage: '',
            textColor: '#1E293B',
            themeType: 'light'
        },
        guestTabs: [
            { id: 'cleaning', title: '🧹 تنظيف الغرفة', icon: '🧹', type: 'form', visible: true, order: 1 },
            { id: 'checkout', title: '🧳 طلب حامل حقائب للمغادرة', icon: '🧳', type: 'checkout', visible: true, order: 2 },
            { id: 'requests', title: '🧴 طلبات تجهيز (شامبو، صابون…)', icon: '🧴', type: 'form', visible: true, order: 3 },
            { id: 'maintenance', title: '🛠️ الدعم الفني والصيانة الطارئة', icon: '🛠️', type: 'form', visible: true, order: 4 },
            { id: 'fnb', title: '☕ خدمات الكافي شوب', icon: '☕', type: 'fnb', visible: true, order: 5 },
            { id: 'food', title: '🍕 طلبات المأكولات', icon: '🍕', type: 'whatsapp', visible: true, order: 6 },
            { id: 'offers', title: '🎁 عروض حصرية', icon: '🎁', type: 'link', visible: true, order: 7 },
            { id: 'review', title: '⭐ شارك تجربتك', icon: '⭐', type: 'link', visible: true, order: 8 },
            { id: 'contact', title: '💬 تواصل مباشر', icon: '💬', type: 'whatsapp', visible: true, order: 9 }
        ],
        quickWhatsapp: '',
        googleReviewUrl: '',
        kitchenWhatsapp: '',
        receptionPhone: '',
        welcomeMessage: '',
        fnbItems: [],
        fnbCart: [], // سلة التسوق للمنتجات
        version: 1,
        updatedAt: Date.now()
    };
    
    // ============================================
    // == Initialize Firebase ====================
    // ============================================
    
    function initFirebase() {
        try {
            // استخدام نفس إعدادات Firebase من النظام الرئيسي
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                db = firebase.firestore();
                if (firebase.storage) {
                    storage = firebase.storage();
                }
            } else {
                // Fallback: تهيئة Firebase إذا لم يكن موجوداً
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
                if (firebase.storage) {
                    storage = firebase.storage();
                }
            }
        } catch(e) {
            console.error('Firebase initialization error:', e);
        }
    }
    
    // ============================================
    // == Cache Management ========================
    // ============================================
    
    function getCachedSettings() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const now = Date.now();
            
            // التحقق من انتهاء الكاش
            if (data.fetchedAt && (now - data.fetchedAt) > CACHE_DURATION) {
                return null;
            }
            
            return data.payload;
        } catch(e) {
            console.error('Error reading cache:', e);
            return null;
        }
    }
    
    function setCachedSettings(payload) {
        try {
            const data = {
                payload: payload,
                version: payload.version || 1,
                fetchedAt: Date.now()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch(e) {
            console.error('Error writing cache:', e);
        }
    }
    
    // ============================================
    // == Fetch Settings from Firebase ===========
    // ============================================
    
    async function fetchSettingsFromFirebase() {
        if (!db) {
            console.warn('Firebase not initialized, using cache or defaults');
            return null;
        }
        
        try {
            const doc = await db.collection('hotel_settings').doc(HOTEL_ID).get();
            
            if (doc.exists) {
                const data = doc.data();
                // تحويل Firestore Timestamp إلى timestamp عادي
                if (data.updatedAt && data.updatedAt.toMillis) {
                    data.updatedAt = data.updatedAt.toMillis();
                }
                return data;
            }
            
            return null;
        } catch(e) {
            console.error('Error fetching settings from Firebase:', e);
            return null;
        }
    }
    
    function subscribeToSettings() {
        if (!db) return;
        
        unsubscribeSettings = db.collection('hotel_settings').doc(HOTEL_ID)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const newSettings = doc.data();
                    // تحويل Firestore Timestamp
                    if (newSettings.updatedAt && newSettings.updatedAt.toMillis) {
                        newSettings.updatedAt = newSettings.updatedAt.toMillis();
                    }
                    
                    const cached = getCachedSettings();
                    
                    // تحديث فقط إذا تغيرت الإعدادات
                    if (!cached || newSettings.version !== cached.version) {
                        applySettings(newSettings);
                        setCachedSettings(newSettings);
                    }
                }
            }, (error) => {
                console.error('Settings listener error:', error);
            });
    }
    
    // ============================================
    // == Load & Apply Settings ==================
    // ============================================
    
    async function loadAndApplySettings() {
        // 1. تحميل من الكاش أولاً (للسرعة)
        const cached = getCachedSettings();
        if (cached) {
            applySettings(cached);
        }
        
        // 2. محاولة التحميل من Firebase
        const firebaseSettings = await fetchSettingsFromFirebase();
        
        if (firebaseSettings) {
            // التحقق من الإصدار
            if (!cached || firebaseSettings.version !== cached.version) {
                applySettings(firebaseSettings);
                setCachedSettings(firebaseSettings);
            }
        } else if (!cached) {
            // استخدام الإعدادات الافتراضية
            applySettings(DEFAULT_CONFIG);
        }
        
        // 3. الاشتراك في التحديثات المباشرة
        subscribeToSettings();
    }
    
    // ============================================
    // == Apply Settings to DOM ===================
    // ============================================
    
    // متغير لتخزين إعدادات الأوقات
    let requestCooldowns = {
        cleaning: 12, // 12 ساعة افتراضي
        cleaningFrom: '08:00', // أوقات العمل للنظافة الفورية
        cleaningTo: '22:00',
        maintenanceFrom: '08:00', // أوقات العمل للصيانة الفورية
        maintenanceTo: '22:00',
        maintenance24h: false, // مؤشر 24 ساعة للصيانة
        requestsFrom: '08:00', // أوقات العمل للطلبات الفورية
        requestsTo: '22:00',
        requests24h: false, // مؤشر 24 ساعة للطلبات
        fnbFrom: '08:00', // أوقات العمل لخدمات الكافي شوب
        fnbTo: '22:00',
        fnb24h: false // مؤشر 24 ساعة للكافي شوب
    };
    
    function applySettings(config) {
        // حفظ إعدادات الأوقات
        if (config.requestCooldowns) {
            requestCooldowns = {
                cleaning: config.requestCooldowns.cleaning || 12,
                cleaningFrom: config.requestCooldowns.cleaningFrom || '08:00',
                cleaningTo: config.requestCooldowns.cleaningTo || '22:00',
                maintenanceFrom: config.requestCooldowns.maintenanceFrom || '08:00',
                maintenanceTo: config.requestCooldowns.maintenanceTo || '22:00',
                maintenance24h: config.requestCooldowns.maintenance24h || false,
                requestsFrom: config.requestCooldowns.requestsFrom || '08:00',
                requestsTo: config.requestCooldowns.requestsTo || '22:00',
                requests24h: config.requestCooldowns.requests24h || false,
                fnbFrom: config.requestCooldowns.fnbFrom || '08:00',
                fnbTo: config.requestCooldowns.fnbTo || '22:00',
                fnb24h: config.requestCooldowns.fnb24h || false
            };
        }
        
        // دمج الإعدادات مع القيم الافتراضية لضمان وجود المسميات الجديدة
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            // دمج التبويبات: استخدام الافتراضية إذا لم تكن موجودة أو كانت قديمة
            guestTabs: config.guestTabs && config.guestTabs.length > 0 
                ? config.guestTabs.map(firebaseTab => {
                    // البحث عن التبويب الافتراضي المقابل
                    const defaultTab = DEFAULT_CONFIG.guestTabs.find(dt => dt.id === firebaseTab.id);
                    // دمج البيانات: استخدام المسميات الجديدة من الافتراضي إذا كانت موجودة
                    return {
                        ...firebaseTab,
                        title: defaultTab ? defaultTab.title : firebaseTab.title,
                        icon: defaultTab ? defaultTab.icon : firebaseTab.icon
                    };
                })
                : DEFAULT_CONFIG.guestTabs,
            // ضمان وجود العنوان الافتراضي (فرض القيم الصحيحة)
            guestHeaderTitle: DEFAULT_CONFIG.guestHeaderTitle, // دائماً استخدام القيمة الافتراضية الصحيحة
            guestHeaderSubtitle: DEFAULT_CONFIG.guestHeaderSubtitle // دائماً استخدام القيمة الافتراضية الصحيحة
        };
        
        guestConfig = mergedConfig;
        
        // تطبيق العنوان (مع إعادة المحاولة إذا لم يكن DOM جاهزاً)
        const updateHeader = () => {
            const titleEl = document.getElementById('guest-title');
            if (titleEl) {
                const title = mergedConfig.guestHeaderTitle || DEFAULT_CONFIG.guestHeaderTitle;
                // إجبار التحديث
                titleEl.innerHTML = '';
                titleEl.textContent = title;
                // إجبار إعادة الرسم
                titleEl.style.display = 'none';
                titleEl.offsetHeight; // trigger reflow
                titleEl.style.display = '';
            }
            
            const subtitleEl = document.getElementById('guest-subtitle');
            if (subtitleEl) {
                const subtitle = mergedConfig.guestHeaderSubtitle || DEFAULT_CONFIG.guestHeaderSubtitle;
                // إجبار التحديث
                subtitleEl.innerHTML = '';
                subtitleEl.textContent = subtitle;
                // إجبار إعادة الرسم
                subtitleEl.style.display = 'none';
                subtitleEl.offsetHeight; // trigger reflow
                subtitleEl.style.display = '';
            }
        };
        
        // تحديث فوري
        updateHeader();
        
        // إعادة المحاولة بعد تأخير قصير (في حالة تأخر تحميل DOM)
        setTimeout(updateHeader, 100);
        setTimeout(updateHeader, 500);
        setTimeout(updateHeader, 1000);
        
        // تطبيق اللوجو في الصفحة الرئيسية
        if (mergedConfig.logoUrl) {
            const logoEl = document.getElementById('guest-logo');
            if (logoEl) {
                logoEl.src = mergedConfig.logoUrl;
                logoEl.style.display = 'block';
                logoEl.onerror = function() {
                    this.style.display = 'none';
                };
            }
        }
        
        // ✅ تطبيق اللوجو في صفحة الدخول (Welcome Screen)
        if (mergedConfig.logoUrl) {
            const welcomeLogoEl = document.querySelector('.guest-welcome-logo');
            if (welcomeLogoEl) {
                // استبدال الأيقونة باللوجو
                welcomeLogoEl.innerHTML = `<img src="${mergedConfig.logoUrl}" alt="Logo" style="max-width: 120px; max-height: 120px; border-radius: 12px; object-fit: contain;" onerror="this.parentElement.innerHTML='🏨';">`;
            }
        }
        
        // تطبيق الثيم
        if (mergedConfig.theme) {
            applyTheme(mergedConfig.theme);
        }
        
        // بناء التبويبات (دائماً استخدام المدمجة)
        renderTabs(mergedConfig.guestTabs);
        
        // تطبيق نص Footer
        if (mergedConfig.footerText) {
            const footerEl = document.getElementById('guest-footer-text');
            if (footerEl) footerEl.innerHTML = mergedConfig.footerText;
        }
        
        // تحميل menu_items وتطبيقها
        loadMenuItemsForGuest();
    }
    
    // تحميل menu_items وتطبيقها على واجهة النزيل
    async function loadMenuItemsForGuest() {
        try {
            const items = await loadMenuItems();
            // حفظ في guestConfig للاستخدام لاحقاً
            if (!guestConfig) guestConfig = {};
            guestConfig.menuItems = items;
        } catch(e) {
            console.error('Error loading menu items for guest:', e);
        }
    }
    
    function applyTheme(theme) {
        const body = document.getElementById('guest-body');
        const root = document.documentElement;
        
        // تطبيق الألوان
        if (theme.primaryColor) {
            root.style.setProperty('--guest-primary', theme.primaryColor);
        }
        
        if (theme.accentColor) {
            root.style.setProperty('--guest-accent', theme.accentColor);
        }
        
        if (theme.textColor) {
            root.style.setProperty('--guest-text-main', theme.textColor);
        }
        
        // تطبيق الخلفية
        if (theme.bgImage) {
            body.style.background = `url(${theme.bgImage}) center/cover, ${theme.bgColor || '#E3E8FF'}`;
        } else if (theme.bgColor) {
            body.style.background = theme.bgColor;
        }
        
        // تطبيق نوع الثيم
        if (theme.themeType) {
            body.className = `guest-body theme-${theme.themeType}`;
        }
    }
    
    // ============================================
    // == Render Tabs =============================
    // ============================================
    
    function renderTabs(tabs) {
        const container = document.getElementById('guest-tabs');
        if (!container) return;
        
        container.innerHTML = '';
        
        // ✅ إعادة تصميم كامل - تبويبات بسيطة وواضحة
        const visibleTabs = tabs
            .filter(tab => tab.visible !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // ✅ تصميم جديد: تبويبات في صف واحد مع أيقونات كبيرة
        visibleTabs.forEach((tab, index) => {
            const btn = document.createElement('button');
            btn.className = 'guest-tab-btn-new';
            btn.dataset.tabId = tab.id;
            if (index === 0) btn.classList.add('active');
            
            // ✅ تصميم جديد: أيقونة كبيرة + نص قصير
            const icon = tab.icon || '📋';
            const title = tab.title || tab.id;
            // استخراج النص بعد الأيقونة
            const titleText = title.replace(/^[^\s]+\s/, ''); // إزالة الأيقونة من البداية
            
            btn.innerHTML = `
                <div style="font-size: 1.8rem; margin-bottom: 4px;">${icon}</div>
                <div style="font-size: 0.85rem; font-weight: 700; line-height: 1.2;">${titleText}</div>
            `;
            
            btn.onclick = () => openTab(tab, btn);
            
            container.appendChild(btn);
        });
        
        // فتح أول تبويب
        if (visibleTabs.length > 0) {
            openTab(visibleTabs[0]);
        }
    }
    
    // ============================================
    // == Tab Content Rendering ==================
    // ============================================
    
    function openTab(tab, btnElement) {
        // ✅ تحديث الأزرار (دعم التصميم الجديد والقديم)
        document.querySelectorAll('.guest-tab-btn, .guest-tab-btn-new').forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        const content = document.getElementById('guest-content');
        if (!content) return;
        
        content.innerHTML = '';
        
        if (tab.type === 'form') {
            renderFormTab(tab);
        } else if (tab.type === 'checkout') {
            renderCheckoutTab(tab);
        } else if (tab.type === 'fnb') {
            renderFNBTab(tab);
        } else if (tab.type === 'link') {
            if (tab.id === 'review') {
                renderReviewTab(tab);
            } else {
                renderLinkTab(tab);
            }
        } else if (tab.type === 'whatsapp') {
            renderWhatsAppTab(tab);
        }
    }
    
    // دالة للحصول على نصوص الأزرار حسب نوع التبويب
    function getButtonTexts(tabId) {
        const texts = {
            cleaning: {
                instant: '👉 إرسال طلب تنظيف الغرفة الآن',
                schedule: '👉 جدولة تنظيف الغرفة',
                scheduled: '📅 إرسال طلب تنظيف الغرفة المجدول'
            },
            checkout: {
                instant: '👉 إرسال طلب حامل حقائب فوراً',
                schedule: '👉 جدولة طلب حامل الحقائب',
                scheduled: '📅 إرسال طلب حامل الحقائب المجدول'
            },
            requests: {
                instant: '👉 إرسال طلب تجهيز للغرفة',
                schedule: '👉 جدولة طلب تجهيز',
                scheduled: '📅 إرسال طلب التجهيز المجدول'
            },
            maintenance: {
                instant: '👉 إرسال طلب صيانة فوراً',
                schedule: '👉 جدولة طلب صيانة',
                scheduled: '📅 إرسال طلب الصيانة المجدول'
            },
            fnb: {
                instant: '👉 إرسال طلب طعام فوراً',
                schedule: '👉 جدولة طلب طعام',
                scheduled: '📅 إرسال طلب الطعام المجدول'
            }
        };
        
        return texts[tabId] || {
            instant: '🚀 إرسال فوري',
            schedule: '📅 مجدول',
            scheduled: '📅 إرسال الطلب المجدول'
        };
    }
    
    function renderFormTab(tab) {
        const content = document.getElementById('guest-content');
        const isMaintenance = tab.id === 'maintenance';
        const isRequest = tab.id === 'requests';
        const isCleaning = tab.id === 'cleaning';
        const buttonTexts = getButtonTexts(tab.id);
        
        content.innerHTML = `
            <h3 style="margin-top: 0; color: var(--guest-primary); font-size: 1.5rem; margin-bottom: 20px;">
                ${tab.title || tab.icon + ' ' + tab.id}
            </h3>
            ${!isCleaning ? `
            <div class="guest-form-group">
                <label class="guest-form-label">${isMaintenance ? 'وصف المشكلة *' : 'تفاصيل الطلب *'}</label>
                <div style="position: relative;">
                    <textarea id="guest-request-input" class="guest-form-textarea" rows="5" 
                        placeholder="${isMaintenance ? 'اكتب وصف المشكلة بالتفصيل... (إجباري)' : 'اكتب طلبك هنا... (إجباري)'}" 
                        required></textarea>
                    <button id="guest-voice-btn" onclick="window.startVoiceRecording('guest-request-input')" 
                        style="position: absolute; bottom: 10px; left: 10px; background: linear-gradient(135deg, #EF4444, #DC2626); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.2rem; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;" 
                        title="تسجيل صوتي">
                        🎤
                    </button>
                </div>
            </div>
            ` : ''}
            ${isMaintenance ? `
            <div class="guest-form-group">
                <label class="guest-form-label">📷 صورة (اختياري)</label>
                <div style="display: flex; gap: 10px;">
                    <input type="file" id="guest-media-image" accept="image/*" capture="environment" style="display: none;" onchange="handleGuestImage(this.files[0])">
                    <button onclick="document.getElementById('guest-media-image').click()" class="guest-btn guest-btn-secondary" style="flex: 1;">
                        📷 التقاط صورة
                    </button>
                </div>
                <div id="guest-image-preview" style="margin-top: 10px; display: none;">
                    <img id="guest-image-preview-img" src="" style="max-width: 100%; border-radius: 8px; max-height: 200px;">
                    <div id="guest-image-info" style="padding: 8px; background: rgba(0,188,212,0.1); border-radius: 8px; font-size: 0.85rem; color: var(--guest-primary); margin-top: 8px;"></div>
                </div>
            </div>
            ` : ''}
            <div class="guest-form-group" id="schedule-group" style="display: none;">
                <label class="guest-form-label">⏰ موعد الطلب</label>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="flex: 0 0 120px; font-size: 0.85rem; color: var(--guest-text-sec);">📅 التاريخ (اختياري)</label>
                        <div style="flex: 1; position: relative;">
                            <input type="date" id="guest-schedule-date" class="guest-form-input" style="width: 100%; padding-right: 80px;" onchange="window.checkScheduleInputs()" oninput="window.checkScheduleInputs()">
                            <span id="guest-date-today-label" onclick="document.getElementById('guest-schedule-date').showPicker()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--guest-primary); font-weight: 600; font-size: 0.85rem; cursor: pointer; user-select: none; pointer-events: auto; padding: 4px 8px; background: rgba(0,172,193,0.1); border-radius: 6px;">اليوم</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="flex: 0 0 120px; font-size: 0.85rem; color: var(--guest-text-sec);">⏰ الوقت *</label>
                        <input type="time" id="guest-schedule-time" class="guest-form-input" style="flex: 1;" onchange="window.checkScheduleInputs()" oninput="window.checkScheduleInputs()" required>
                    </div>
                </div>
            </div>
            <div class="guest-btn-group" id="guest-action-buttons">
                <button onclick="window.sendGuestRequestNow('${tab.id}')" class="guest-btn" style="flex: 1;" id="btn-send-instant">
                    ${buttonTexts.instant}
                </button>
                <button onclick="window.toggleSchedule()" class="guest-btn guest-btn-secondary" style="flex: 1;" id="btn-schedule">
                    ${buttonTexts.schedule}
                </button>
            </div>
            <div class="guest-btn-group" id="guest-scheduled-button" style="display: none;">
                <button onclick="window.sendGuestRequestNow('${tab.id}', null, null, false)" class="guest-btn" style="flex: 1;">
                    ${buttonTexts.scheduled}
                </button>
            </div>
        `;
    }
    
    function renderCheckoutTab(tab) {
        const content = document.getElementById('guest-content');
        const buttonTexts = getButtonTexts('checkout');
        
        content.innerHTML = `
            <h3 style="margin-top: 0; color: var(--guest-primary); font-size: 1.5rem; margin-bottom: 20px;">
                ${tab.title || tab.icon + ' ' + tab.id}
            </h3>
            <div class="guest-form-group">
                <label class="guest-form-label">ملاحظات (اختياري)</label>
                <textarea id="guest-checkout-notes" class="guest-form-textarea" rows="3" 
                    placeholder="أضف أي ملاحظات إضافية..."></textarea>
            </div>
            <div class="guest-form-group">
                <div id="guest-cart-container" class="toggle-container" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.15)); border: 2px solid rgba(34, 197, 94, 0.4); margin-bottom: 15px; padding: 18px; border-radius: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2); transition: all 0.3s ease;">
                    <div id="guest-cart-label" class="toggle-label" style="color: #16A34A; font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; gap: 12px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: color 0.3s ease;">
                        <span style="font-size: 2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">🚚</span>
                        <span>إرسال عربة</span>
                    </div>
                    <label class="switch" style="margin-top: 8px;">
                        <input type="checkbox" id="guest-checkout-cart" checked onchange="window.toggleCheckoutCart()">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="guest-form-group" id="schedule-group" style="display: none;">
                <label class="guest-form-label">⏰ موعد الطلب</label>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="flex: 0 0 120px; font-size: 0.85rem; color: var(--guest-text-sec);">📅 التاريخ (اختياري)</label>
                        <div style="flex: 1; position: relative;">
                            <input type="date" id="guest-schedule-date" class="guest-form-input" style="width: 100%; padding-right: 80px;" onchange="window.checkScheduleInputs()" oninput="window.checkScheduleInputs()">
                            <span id="guest-date-today-label" onclick="document.getElementById('guest-schedule-date').showPicker()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--guest-primary); font-weight: 600; font-size: 0.85rem; cursor: pointer; user-select: none; pointer-events: auto; padding: 4px 8px; background: rgba(0,172,193,0.1); border-radius: 6px;">اليوم</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="flex: 0 0 120px; font-size: 0.85rem; color: var(--guest-text-sec);">⏰ الوقت *</label>
                        <input type="time" id="guest-schedule-time" class="guest-form-input" style="flex: 1;" onchange="window.checkScheduleInputs()" oninput="window.checkScheduleInputs()" required>
                    </div>
                </div>
            </div>
            <div class="guest-btn-group" id="guest-action-buttons">
                <button onclick="window.sendCheckoutRequest(true)" class="guest-btn" style="flex: 1;" id="btn-send-instant">
                    ${buttonTexts.instant}
                </button>
                <button onclick="window.toggleSchedule()" class="guest-btn guest-btn-secondary" style="flex: 1;" id="btn-schedule">
                    ${buttonTexts.schedule}
                </button>
            </div>
            <div class="guest-btn-group" id="guest-scheduled-button" style="display: none;">
                <button onclick="window.sendCheckoutRequest(false)" class="guest-btn" style="flex: 1;">
                    ${buttonTexts.scheduled}
                </button>
            </div>
        `;
        
        // تهيئة ألوان مستطيل العربة بعد إنشاء الـ HTML
        setTimeout(() => {
            const checkbox = document.getElementById('guest-checkout-cart');
            const container = document.getElementById('guest-cart-container');
            const label = document.getElementById('guest-cart-label');
            if (checkbox && container && label) {
                updateCartContainerColors(checkbox.checked, container, label);
            }
        }, 50);
    }
    
    window.toggleCheckoutCart = function() {
        const checkbox = document.getElementById('guest-checkout-cart');
        const container = document.getElementById('guest-cart-container');
        const label = document.getElementById('guest-cart-label');
        
        if (!checkbox || !container || !label) return;
        
        updateCartContainerColors(checkbox.checked, container, label);
    };
    
    function updateCartContainerColors(isChecked, container, label) {
        if (!container || !label) return;
        
        if (isChecked) {
            // أخضر عند التفعيل
            container.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.15))';
            container.style.border = '2px solid rgba(34, 197, 94, 0.4)';
            container.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)';
            label.style.color = '#16A34A';
        } else {
            // أحمر عند الإلغاء
            container.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15))';
            container.style.border = '2px solid rgba(239, 68, 68, 0.4)';
            container.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
            label.style.color = '#DC2626';
        }
    }
    
    window.sendCheckoutRequest = function(isInstant = true) {
        const room = currentRoom || '--';
        const notes = document.getElementById('guest-checkout-notes')?.value || '';
        const needsCart = document.getElementById('guest-checkout-cart')?.checked || false;
        let mode = isInstant ? 'instant' : 'scheduled';
        let scheduledTime = null;
        
        // الحصول على الزر المضغوط
        const buttonElement = event?.target || document.querySelector('#guest-action-buttons button:active, #guest-scheduled-button button:active');
        
        // التحقق من الجدولة
        const scheduleGroup = document.getElementById('schedule-group');
        if (scheduleGroup && scheduleGroup.style.display !== 'none') {
            let date = document.getElementById('guest-schedule-date').value;
            const time = document.getElementById('guest-schedule-time').value;
            
            // إذا لم يكن التاريخ محدداً، استخدم اليوم
            if (!date) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
            
            if (time) {
                mode = 'scheduled';
                scheduledTime = new Date(`${date}T${time}`).getTime();
            }
        }
        
        let details = 'طلب تسجيل خروج';
        if (needsCart) {
            details += ' - يحتاج عربة';
        }
        if (notes.trim()) {
            details += ` - ملاحظات: ${notes}`;
        }
        
        // تحويل الزر إلى شريط تحميل (مدة قصيرة جداً)
        if (buttonElement) {
            showButtonLoading(buttonElement, 800);
        }
        
        // إرسال فوري بدون انتظار
        sendGuestRequest(room, 'checkout', details, mode, scheduledTime);
    };
    
    async function loadMenuItems() {
        if (!db) {
            // Fallback إلى localStorage
            return JSON.parse(localStorage.getItem('menu_items') || '[]');
        }
        
        try {
            const hotelId = HOTEL_ID;
            const snapshot = await db.collection('hotel_settings').doc(hotelId).collection('menu_items').get();
            
            if (!snapshot.empty) {
                return snapshot.docs.map(doc => doc.data());
            }
            
            // Fallback إلى localStorage
            return JSON.parse(localStorage.getItem('menu_items') || '[]');
        } catch(e) {
            console.error('Error loading menu items:', e);
            return JSON.parse(localStorage.getItem('menu_items') || '[]');
        }
    }
    
    function renderFNBTab(tab) {
        const content = document.getElementById('guest-content');
        
        // تحميل menu_items من Firebase
        loadMenuItems().then(items => {
            // فلترة المنتجات: visibleToGuest = true && showInQR = true && type = 'fnb'
            const fnbItems = items.filter(item => 
                item.visibleToGuest !== false && 
                item.showInQR !== false && 
                (item.type === 'fnb' || item.type === 'orderable')
            );
            
            if (fnbItems.length === 0) {
                content.innerHTML = `
                    <div class="guest-welcome-message">
                        <div class="guest-welcome-icon">☕</div>
                        <div class="guest-welcome-text">لا توجد منتجات متاحة حالياً</div>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <h3 style="margin-top: 0; color: var(--guest-primary); font-size: 1.5rem; margin-bottom: 20px;">
                        ${tab.title || '☕ خدمات الكافي شوب'}
                    </h3>
                    <div id="fnb-products-list" style="margin-bottom: 20px;">
                        ${fnbItems.map(item => `
                            <div class="guest-item-card" style="margin-bottom: 12px;">
                                ${item.imageUrl ? `
                                    <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; margin-left: 12px; flex-shrink: 0;">
                                        <img src="${item.imageUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">
                                    </div>
                                ` : ''}
                                <div class="guest-item-info" style="flex: 1;">
                                    <div class="guest-item-name">${item.icon || '🍽️'} ${item.name}</div>
                                    ${item.price && item.price !== '0' ? `<div class="guest-item-price">${item.price} ريال</div>` : ''}
                                </div>
                                <button onclick="window.addToFNBCart('${item.id || ''}', '${encodeURIComponent(item.name)}', ${item.price ? parseFloat(item.price) : 0}, '${item.icon || '🍽️'}')" 
                                    class="guest-btn guest-item-btn" style="min-width: 120px;">
                                    ➕ إضافة للسلة
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div id="fnb-cart-container" style="display: none; margin-top: 30px; padding-top: 20px; border-top: 2px solid var(--guest-primary-light);">
                        <h4 style="color: var(--guest-primary); font-size: 1.2rem; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                            🛒 سلة التسوق
                            <span id="fnb-cart-count" style="background: var(--guest-primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">0</span>
                        </h4>
                        <div id="fnb-cart-items" style="margin-bottom: 15px;">
                            <!-- سيتم ملؤها ديناميكياً -->
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="window.sendFNBCart()" class="guest-btn" style="flex: 1; background: linear-gradient(135deg, var(--guest-primary), var(--guest-primary-dark)); color: white !important; font-weight: 700; padding: 16px; border: 2px solid var(--guest-primary);">
                                🚀 إرسال الطلب
                            </button>
                            <button onclick="window.clearFNBCart()" class="guest-btn" style="background: rgba(239, 68, 68, 0.1); color: #DC2626; border: 2px solid rgba(239, 68, 68, 0.3);">
                                🗑️ مسح السلة
                            </button>
                        </div>
                    </div>
                `;
                
                // عرض السلة إذا كانت تحتوي على منتجات
                updateFNBCartDisplay();
            }
        });
    }
    
    // إضافة منتج إلى السلة
    window.addToFNBCart = function(itemId, itemName, price, icon) {
        const decodedName = decodeURIComponent(itemName);
        const cart = DEFAULT_CONFIG.fnbCart || [];
        
        // التحقق من وجود المنتج في السلة
        const existingIndex = cart.findIndex(item => item.id === itemId);
        
        if (existingIndex !== -1) {
            // زيادة الكمية
            cart[existingIndex].quantity += 1;
        } else {
            // إضافة منتج جديد
            cart.push({
                id: itemId,
                name: decodedName,
                price: price || 0,
                icon: icon || '🍽️',
                quantity: 1
            });
        }
        
        DEFAULT_CONFIG.fnbCart = cart;
        updateFNBCartDisplay();
        
        // تأثير بصري
        if (typeof window.showGuestAlert === 'function') {
            window.showGuestAlert(`✅ تم إضافة ${decodedName} إلى السلة`);
        } else {
            console.log(`✅ تم إضافة ${decodedName} إلى السلة`);
        }
    };
    
    // تحديث عرض السلة
    function updateFNBCartDisplay() {
        const cart = DEFAULT_CONFIG.fnbCart || [];
        const cartContainer = document.getElementById('fnb-cart-container');
        const cartItems = document.getElementById('fnb-cart-items');
        const cartCount = document.getElementById('fnb-cart-count');
        
        if (!cartContainer || !cartItems || !cartCount) return;
        
        if (cart.length === 0) {
            cartContainer.style.display = 'none';
            return;
        }
        
        cartContainer.style.display = 'block';
        cartCount.textContent = cart.length;
        
        // حساب الإجمالي
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        cartItems.innerHTML = `
            ${cart.map((item, index) => `
                <div class="guest-item-card" style="margin-bottom: 10px; background: rgba(0, 172, 193, 0.05); border: 1px solid rgba(0, 172, 193, 0.2);">
                    <div class="guest-item-info" style="flex: 1;">
                        <div class="guest-item-name">${item.icon} ${item.name}</div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                            <div class="guest-item-price" style="font-weight: 700; color: var(--guest-primary);">${item.price > 0 ? `${(item.price * item.quantity).toFixed(2)} ريال` : 'مجاني'}</div>
                            <div style="display: flex; align-items: center; gap: 8px; background: white; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--guest-primary-light);">
                                <button onclick="window.updateCartQuantity(${index}, -1)" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--guest-primary); padding: 0 8px;">➖</button>
                                <span style="font-weight: 700; min-width: 30px; text-align: center;">${item.quantity}</span>
                                <button onclick="window.updateCartQuantity(${index}, 1)" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--guest-primary); padding: 0 8px;">➕</button>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.removeFromCart(${index})" style="background: rgba(239, 68, 68, 0.1); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 12px; border-radius: 8px; cursor: pointer;">
                        🗑️
                    </button>
                </div>
            `).join('')}
            ${total > 0 ? `
                <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, rgba(0, 172, 193, 0.1), rgba(0, 172, 193, 0.05)); border-radius: 12px; border: 2px solid var(--guest-primary-light);">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 700; color: var(--guest-primary);">
                        <span>الإجمالي:</span>
                        <span>${total.toFixed(2)} ريال</span>
                    </div>
                </div>
            ` : ''}
        `;
    }
    
    // تحديث كمية منتج في السلة
    window.updateCartQuantity = function(index, change) {
        const cart = DEFAULT_CONFIG.fnbCart || [];
        if (index < 0 || index >= cart.length) return;
        
        cart[index].quantity += change;
        
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        
        DEFAULT_CONFIG.fnbCart = cart;
        updateFNBCartDisplay();
    };
    
    // حذف منتج من السلة
    window.removeFromCart = function(index) {
        const cart = DEFAULT_CONFIG.fnbCart || [];
        if (index < 0 || index >= cart.length) return;
        
        const itemName = cart[index].name;
        cart.splice(index, 1);
        
        DEFAULT_CONFIG.fnbCart = cart;
        updateFNBCartDisplay();
        
        if (typeof window.showGuestAlert === 'function') {
            window.showGuestAlert(`✅ تم حذف ${itemName} من السلة`);
        } else {
            console.log(`✅ تم حذف ${itemName} من السلة`);
        }
    };
    
    // مسح السلة بالكامل
    window.clearFNBCart = function() {
        if (DEFAULT_CONFIG.fnbCart && DEFAULT_CONFIG.fnbCart.length > 0) {
            if (confirm('هل تريد مسح السلة بالكامل؟')) {
                DEFAULT_CONFIG.fnbCart = [];
                updateFNBCartDisplay();
                if (typeof window.showGuestAlert === 'function') {
                    window.showGuestAlert('✅ تم مسح السلة');
                } else {
                    console.log('✅ تم مسح السلة');
                }
            }
        }
    };
    
    // إرسال طلب السلة
    window.sendFNBCart = function() {
        const cart = DEFAULT_CONFIG.fnbCart || [];
        
        if (cart.length === 0) {
            window.showGuestAlert('السلة فارغة. يرجى إضافة منتجات أولاً.', 'تنبيه');
            return;
        }
        
        // بناء تفاصيل الطلب
        const itemsList = cart.map(item => {
            const itemText = item.quantity > 1 ? `${item.icon} ${item.name} (${item.quantity})` : `${item.icon} ${item.name}`;
            return itemText;
        }).join('\n');
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const details = `🛒 طلب من الكافي شوب:\n\n${itemsList}${total > 0 ? `\n\n💰 الإجمالي: ${total.toFixed(2)} ريال` : ''}`;
        
        // إرسال الطلب
        const room = currentRoom || '--';
        sendGuestRequest(room, 'fnb', details, 'instant', null);
        
        // مسح السلة بعد الإرسال
        DEFAULT_CONFIG.fnbCart = [];
        updateFNBCartDisplay();
    };
    
    function renderLinkTab(tab) {
        const content = document.getElementById('guest-content');
        const url = tab.url || guestConfig?.googleReviewUrl || '';
        
        content.innerHTML = `
            <div class="guest-welcome-message">
                <div class="guest-welcome-icon">${tab.icon || '🔗'}</div>
                <h3 style="margin: 0 0 20px 0; color: var(--guest-primary); font-size: 1.5rem;">
                    ${tab.title || 'فتح الرابط'}
                </h3>
                <button onclick="window.open('${url}', '_blank')" class="guest-btn" style="padding: 16px 32px; font-size: 1.1rem;">
                    فتح الرابط
                </button>
            </div>
        `;
    }
    
    function renderReviewTab(tab) {
        const content = document.getElementById('guest-content');
        const room = currentRoom || '--';
        const googleReviewUrl = tab.url || guestConfig?.googleReviewUrl || '';
        
        content.innerHTML = `
            <div class="guest-welcome-message" style="padding: 40px 20px; text-align: center;">
                <div class="guest-welcome-icon" style="font-size: 3rem; margin-bottom: 15px; animation: pulse 2s ease-in-out infinite;">⭐</div>
                <h3 style="margin: 0 0 20px 0; color: var(--guest-primary); font-size: 1.5rem; font-weight: 700;">
                    ${tab.title || 'شارك تجربتك'}
                </h3>
                
                ${googleReviewUrl ? `
                <div style="margin-bottom: 25px;">
                    <div id="guest-rating-stars" style="display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                        ${[1, 2, 3, 4, 5].map((star, index) => {
                            const isFiveStars = star === 5;
                            return `
                            <button onclick="window.startRatingAnimation(${star})" 
                                class="rating-star-btn" 
                                data-rating="${star}"
                                id="rating-btn-${star}"
                                style="
                                    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1));
                                    border: 2px solid rgba(251, 191, 36, 0.3);
                                    border-radius: 14px;
                                    padding: 14px 18px;
                                    font-size: 1.3rem;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                    min-width: 70px;
                                    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
                                    opacity: 0;
                                    transform: translateY(20px);
                                "
                                onmouseover="if(!window.ratingInProgress) { this.style.transform='scale(1.1)'; this.style.boxShadow='0 8px 24px rgba(251, 191, 36, 0.4)'; }"
                                onmouseout="if(!window.ratingInProgress) { this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(251, 191, 36, 0.15)'; }">
                                <div id="rating-stars-${star}" style="font-size: 1.3rem;">${'⭐'.repeat(star)}</div>
                                <div style="font-size: 0.8rem; margin-top: 6px; color: var(--guest-text-sec); font-weight: 600;">
                                    ${star} ${star === 1 ? 'نجمة' : 'نجوم'}
                                </div>
                            </button>
                        `;
                        }).join('')}
                    </div>
                </div>
                
                <div id="rating-celebration" style="display: none; margin-top: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 10px; animation: bounce 0.6s ease;">🎉</div>
                    <h3 style="margin: 0 0 8px 0; color: var(--guest-primary); font-size: 1.3rem; font-weight: 700;">
                        شكراً لك! 🌟
                    </h3>
                </div>
                
                <div style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.08)); border-radius: 12px; padding: 15px; margin-top: 20px; border: 1px solid rgba(251, 191, 36, 0.2);">
                    <p style="color: var(--guest-text-sec); font-size: 0.85rem; line-height: 1.5; margin: 0;">
                        💝 شكراً لك! تقييمك يساعدنا على التحسين
                    </p>
                </div>
                ` : `
                <div style="background: rgba(220, 38, 38, 0.1); border-radius: 16px; padding: 20px; border: 1px solid rgba(220, 38, 38, 0.2);">
                    <p style="color: var(--guest-text-sec); font-size: 0.95rem; margin: 0;">
                        ⚠️ يرجى إدخال رابط خرائط جوجل في إعدادات التبويبات
                    </p>
                </div>
                `}
            </div>
        `;
        
        // بدء animation النجوم بعد تحميل الصفحة
        setTimeout(() => {
            animateStarsEntrance();
        }, 300);
    }
    
    // Animation دخول النجوم
    function animateStarsEntrance() {
        for (let i = 1; i <= 5; i++) {
            const btn = document.getElementById(`rating-btn-${i}`);
            if (btn) {
                setTimeout(() => {
                    btn.style.transition = 'all 0.5s ease';
                    btn.style.opacity = '1';
                    btn.style.transform = 'translateY(0)';
                }, i * 100);
            }
        }
    }
    
    // Animation النجوم التلقائية
    window.startRatingAnimation = function(targetRating) {
        if (window.ratingInProgress) return;
        window.ratingInProgress = true;
        
        const googleReviewUrl = guestConfig?.googleReviewUrl || '';
        if (!googleReviewUrl) {
            window.showGuestAlert('يرجى إدخال رابط خرائط جوجل في إعدادات التبويبات', 'تعرض هذه الصفحة');
            window.ratingInProgress = false;
            return;
        }
        
        let currentRating = 0;
        const interval = setInterval(() => {
            currentRating++;
            
            // تحديث جميع الأزرار
            for (let i = 1; i <= 5; i++) {
                const btn = document.getElementById(`rating-btn-${i}`);
                if (btn) {
                    if (i <= currentRating) {
                        // نجم مفعّل
                        btn.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.3))';
                        btn.style.border = '2px solid rgba(251, 191, 36, 0.8)';
                        btn.style.transform = 'scale(1.1)';
                        btn.style.boxShadow = '0 8px 24px rgba(251, 191, 36, 0.4)';
                    } else {
                        // نجم غير مفعّل
                        btn.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))';
                        btn.style.border = '2px solid rgba(251, 191, 36, 0.3)';
                        btn.style.transform = 'scale(1)';
                        btn.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.15)';
                    }
                }
            }
            
            // عند الوصول للهدف
            if (currentRating >= targetRating) {
                clearInterval(interval);
                
                // احتفال خاص لـ 5 نجوم
                if (targetRating === 5) {
                    setTimeout(() => {
                        showCelebration();
                    }, 300);
                }
                
                // فتح رابط جوجل بعد التأخير القصير
                setTimeout(() => {
                    window.open(googleReviewUrl, '_blank');
                    window.ratingInProgress = false;
                }, targetRating === 5 ? 2000 : 800);
            }
        }, 200); // سرعة الحركة
    };
    
    // عرض الاحتفال
    function showCelebration() {
        const celebration = document.getElementById('rating-celebration');
        const starsContainer = document.getElementById('guest-rating-stars');
        
        if (celebration && starsContainer) {
            celebration.style.display = 'block';
            celebration.style.animation = 'fadeIn 0.5s ease';
            
            // إضافة confetti effect
            createConfetti();
        }
    }
    
    // تأثير confetti
    function createConfetti() {
        const colors = ['#FBBF24', '#F59E0B', '#EF4444', '#10B981', '#3B82F6'];
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.cssText = `
                    position: fixed;
                    width: 10px;
                    height: 10px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    left: ${Math.random() * 100}%;
                    top: -10px;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 10000;
                    animation: confettiFall ${1 + Math.random()}s linear forwards;
                `;
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 2000);
            }, i * 50);
        }
        
        // إضافة animation للـ confetti
        if (!document.getElementById('confetti-styles')) {
            const style = document.createElement('style');
            style.id = 'confetti-styles';
            style.textContent = `
                @keyframes confettiFall {
                    to {
                        transform: translateY(100vh) rotate(360deg);
                        opacity: 0;
                    }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    window.openGoogleReview = function(rating) {
        const googleReviewUrl = guestConfig?.googleReviewUrl || '';
        
        if (!googleReviewUrl) {
            window.showGuestAlert('يرجى إدخال رابط خرائط جوجل في إعدادات التبويبات', 'تعرض هذه الصفحة');
            return;
        }
        
        // فتح رابط خرائط جوجل في نافذة جديدة
        window.open(googleReviewUrl, '_blank');
    };
    
    function renderWhatsAppTab(tab) {
        const content = document.getElementById('guest-content');
        let phone = tab.url || guestConfig?.quickWhatsapp || guestConfig?.kitchenWhatsapp || '';
        
        // معالجة الرابط إذا كان يحتوي على رابط واتساب كامل
        if (phone.includes('wa.me/') || phone.includes('whatsapp.com')) {
            // استخراج الرقم من الرابط
            const match = phone.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\d+)/);
            if (match) {
                phone = match[1];
            }
        }
        
        // تنظيف الرقم (إزالة أي أحرف غير رقمية)
        phone = phone.replace(/\D/g, '');
        
        const message = encodeURIComponent(`مرحباً من غرفة ${currentRoom || '--'}`);
        const whatsappUrl = phone ? `https://wa.me/${phone}?text=${message}` : '#';
        
        content.innerHTML = `
            <div class="guest-welcome-message" style="padding: 40px 20px;">
                <div class="guest-welcome-icon" style="font-size: 4rem; margin-bottom: 20px; animation: pulse 2s ease-in-out infinite;">💬</div>
                <h3 style="margin: 0 0 10px 0; color: var(--guest-primary); font-size: 1.8rem; font-weight: 700;">
                    ${tab.title || 'تواصل مباشر'}
                </h3>
                <p style="color: var(--guest-text-sec); margin-bottom: 30px; font-size: 1.1rem; line-height: 1.6;">
                    ${phone ? 'نحن هنا لمساعدتك في أي وقت! 💚' : '⚠️ يرجى إدخال رقم واتساب في إعدادات التبويبات'}
                </p>
                ${phone ? `
                <button onclick="window.open('${whatsappUrl}', '_blank')" 
                    class="guest-btn" 
                    style="
                        padding: 20px 40px; 
                        font-size: 1.2rem; 
                        font-weight: 700;
                        background: linear-gradient(135deg, #25D366, #128C7E);
                        box-shadow: 0 8px 24px rgba(37, 211, 102, 0.4);
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                        margin: 0 auto;
                        transition: all 0.3s ease;
                        min-width: 250px;
                    "
                    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 12px 32px rgba(37, 211, 102, 0.5)';"
                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 8px 24px rgba(37, 211, 102, 0.4)';">
                    <span style="font-size: 1.8rem;">💚</span>
                    <span>ابدأ المحادثة الآن</span>
                </button>
                <p style="color: var(--guest-text-sec); margin-top: 20px; font-size: 0.9rem; opacity: 0.8;">
                    اضغط للتواصل المباشر عبر واتساب
                </p>
                ` : ''}
            </div>
        `;
    }
    
    // ============================================
    // == Guest Request Functions ================
    // ============================================
    
    // متغيرات لحفظ الميديا
    let guestImageMedia = null;
    let guestRecognition = null;
    let isRecording = false;
    
    // معالجة الصورة
    window.handleGuestImage = function(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            guestImageMedia = e.target.result; // Base64
            const preview = document.getElementById('guest-image-preview');
            const previewImg = document.getElementById('guest-image-preview-img');
            const info = document.getElementById('guest-image-info');
            
            if (preview && previewImg && info) {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
                info.innerHTML = `📷 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            }
        };
        reader.readAsDataURL(file);
    };
    
    // تهيئة Speech Recognition
    function initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            guestRecognition = new SpeechRecognition();
            guestRecognition.lang = 'ar-SA'; // اللغة العربية
            guestRecognition.continuous = false;
            guestRecognition.interimResults = false;
            
            guestRecognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                const targetInput = document.getElementById('guest-request-input');
                if (targetInput) {
                    targetInput.value = transcript;
                    showNotification('✅ تم تحويل الصوت إلى نص', 'success');
                }
                stopVoiceRecording();
            };
            
            guestRecognition.onerror = function(event) {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech') {
                    showNotification('⚠️ لم يتم اكتشاف صوت', 'error');
                } else {
                    showNotification('❌ خطأ في التعرف على الصوت', 'error');
                }
                stopVoiceRecording();
            };
            
            guestRecognition.onend = function() {
                stopVoiceRecording();
            };
            
            return true;
        }
        return false;
    }
    
    // بدء التسجيل الصوتي
    window.startVoiceRecording = function(targetId) {
        if (!guestRecognition && !initSpeechRecognition()) {
            showNotification('❌ المتصفح لا يدعم التسجيل الصوتي', 'error');
            return;
        }
        
        if (isRecording) {
            stopVoiceRecording();
            return;
        }
        
        try {
            isRecording = true;
            guestRecognition.start();
            const btn = document.getElementById('guest-voice-btn');
            if (btn) {
                btn.innerHTML = '⏹️';
                btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
            }
            showNotification('🎤 استمع... تحدث الآن', 'success');
        } catch (e) {
            console.error('Error starting recognition:', e);
            showNotification('❌ فشل بدء التسجيل', 'error');
            isRecording = false;
        }
    };
    
    // إيقاف التسجيل الصوتي
    function stopVoiceRecording() {
        if (guestRecognition && isRecording) {
            try {
                guestRecognition.stop();
            } catch (e) {
                console.error('Error stopping recognition:', e);
            }
        }
        isRecording = false;
        const btn = document.getElementById('guest-voice-btn');
        if (btn) {
            btn.innerHTML = '🎤';
            btn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
        }
    }
    
    // التحقق من إدخال التاريخ والوقت
    window.checkScheduleInputs = async function() {
        const date = document.getElementById('guest-schedule-date');
        const time = document.getElementById('guest-schedule-time');
        const actionButtons = document.getElementById('guest-action-buttons');
        const scheduledButton = document.getElementById('guest-scheduled-button');
        
        if (!date || !time || !actionButtons || !scheduledButton) {
            return;
        }
        
        // تعيين التاريخ التلقائي (اليوم) إذا لم يكن محدداً
        if (!date.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            date.value = `${year}-${month}-${day}`;
        }
        
        // التحقق من أن الوقت مملوء (الوقت إجباري)
        if (time.value) {
            // ✅ التحقق من 12 ساعة للتنظيف عند الجدولة
            const tabId = document.querySelector('.guest-tab-btn-new.active')?.dataset.tabId;
            if (tabId === 'cleaning' && typeof db !== 'undefined' && db && db.collection) {
                const roomNum = parseInt(currentRoom, 10);
                if (!isNaN(roomNum) && roomNum > 0) {
                    const cleaningCooldownHours = requestCooldowns.cleaning || 12;
                    const COOLDOWN_TIME = cleaningCooldownHours * 60 * 60 * 1000;
                    
                    // جمع جميع مصادر آخر تنظيف
                    let allLastCleanings = [];
                    
                    // البحث في guestRequests
                    if (guestIdentity || guestPhone) {
                        let lastGuestCleaningQuery = null;
                        if (guestIdentity) {
                            lastGuestCleaningQuery = db.collection('guestRequests')
                                .where('requestType', '==', 'cleaning')
                                .where('fromGuest', '==', true)
                                .where('guestIdentity', '==', guestIdentity)
                                .get();
                        } else if (guestPhone) {
                            lastGuestCleaningQuery = db.collection('guestRequests')
                                .where('requestType', '==', 'cleaning')
                                .where('fromGuest', '==', true)
                                .where('guestPhone', '==', guestPhone)
                                .get();
                        }
                        
                        if (lastGuestCleaningQuery) {
                            const guestSnapshot = await lastGuestCleaningQuery;
                            if (!guestSnapshot.empty) {
                                guestSnapshot.docs.forEach(doc => {
                                    const data = doc.data();
                                    const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                                    if (finishTime) {
                                        allLastCleanings.push({ time: finishTime });
                                    }
                                });
                            }
                        }
                    }
                    
                    // البحث في log collection
                    const logSnapshot = await db.collection('log')
                        .where('num', '==', roomNum)
                        .get();
                    
                    if (!logSnapshot.empty) {
                        logSnapshot.docs.forEach(doc => {
                            const data = doc.data();
                            const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : data.finishTime;
                            if (finishTime) {
                                allLastCleanings.push({ time: finishTime });
                            }
                        });
                    }
                    
                    // البحث في guestRequests للغرفة مباشرة
                    const roomCleaningQuery = await db.collection('guestRequests')
                        .where('requestType', '==', 'cleaning')
                        .where('num', '==', roomNum)
                        .where('fromGuest', '==', true)
                        .get();
                    
                    if (!roomCleaningQuery.empty) {
                        roomCleaningQuery.docs.forEach(doc => {
                            const data = doc.data();
                            const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                            if (finishTime) {
                                const exists = allLastCleanings.find(c => c.time === finishTime);
                                if (!exists) {
                                    allLastCleanings.push({ time: finishTime });
                                }
                            }
                        });
                    }
                    
                    // ترتيب واختيار الأحدث
                    if (allLastCleanings.length > 0) {
                        allLastCleanings.sort((a, b) => b.time - a.time);
                        const lastCleaningTime = allLastCleanings[0].time;
                        const deadline = lastCleaningTime + COOLDOWN_TIME;
                        const selectedDateTime = new Date(`${date.value}T${time.value}`).getTime();
                        
                        if (selectedDateTime < deadline) {
                            // الموعد المحدد قبل انتهاء المهلة - منع الجدولة
                            const nextAvailableTime = new Date(deadline);
                            const nextDateStr = nextAvailableTime.toISOString().split('T')[0];
                            const nextTimeStr = nextAvailableTime.toLocaleTimeString('ar-EG', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                hour12: false 
                            }).replace(' ', '');
                            
                            window.showGuestAlert(
                                `⏳ لا يمكن جدولة تنظيف قبل مرور ${cleaningCooldownHours} ساعة من آخر تنظيف\n\n` +
                                `يرجى اختيار موعد بعد الساعة ${nextTimeStr} في ${nextDateStr}`,
                                '⏰ وقت الجدولة'
                            );
                            
                            // تعيين التاريخ والوقت الأدنى المسموح
                            date.value = nextDateStr;
                            time.value = nextTimeStr;
                            return;
                        }
                    }
                }
            }
            
            // إخفاء الأزرار العادية وإظهار زر المجدول
            actionButtons.style.display = 'none';
            scheduledButton.style.display = 'flex';
        } else {
            // إظهار الأزرار العادية وإخفاء زر المجدول
            actionButtons.style.display = 'flex';
            scheduledButton.style.display = 'none';
        }
    };
    
    // ✅ دالة للتحقق من أوقات العمل
    function isWithinWorkingHours(fromTime, toTime) {
        if (!fromTime || !toTime) return true; // إذا لم تكن محددة، السماح دائماً
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        
        const [fromHour, fromMin] = fromTime.split(':').map(Number);
        const [toHour, toMin] = toTime.split(':').map(Number);
        const fromTimeMinutes = fromHour * 60 + fromMin;
        const toTimeMinutes = toHour * 60 + toMin;
        
        // إذا كان الوقت من > إلى (يعني يعبر منتصف الليل)
        if (fromTimeMinutes > toTimeMinutes) {
            return currentTimeMinutes >= fromTimeMinutes || currentTimeMinutes <= toTimeMinutes;
        } else {
            return currentTimeMinutes >= fromTimeMinutes && currentTimeMinutes <= toTimeMinutes;
        }
    }
    
    window.sendGuestRequestNow = async function(category, itemName, itemId, isInstant = true, buttonElement = null) {
        const room = currentRoom || '--';
        let details = '';
        let mode = isInstant ? 'instant' : 'scheduled';
        let scheduledTime = null;
        
        // ✅ متغير لتخزين حالة الطارئ
        let isEmergencyRequest = false;
        
        // ✅ أولاً: التحقق من 12 ساعة للتنظيف (يجب أن يحدث قبل التحقق من أوقات العمل)
        if (category === 'cleaning' && isInstant) {
            const actualRoom = room || currentRoom || (() => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('room') || null;
            })();
            
            if (actualRoom && actualRoom !== '--') {
                const roomNum = parseInt(actualRoom, 10);
                if (!isNaN(roomNum) && roomNum > 0 && typeof db !== 'undefined' && db && db.collection) {
                    const cleaningCooldownHours = requestCooldowns.cleaning || 12;
                    const COOLDOWN_TIME = cleaningCooldownHours * 60 * 60 * 1000;
                    
                    // ✅ التحقق من 12 ساعة دائماً (سواء كانت الغرفة موجودة في rooms أم لا)
                    // جمع جميع مصادر آخر تنظيف: guestRequests + log collection
                    let allLastCleanings = [];
                    
                    // 1. البحث في guestRequests (إذا كانت هناك هوية)
                    if (guestIdentity || guestPhone) {
                        let lastGuestCleaningQuery = null;
                        if (guestIdentity) {
                            lastGuestCleaningQuery = db.collection('guestRequests')
                                .where('requestType', '==', 'cleaning')
                                .where('fromGuest', '==', true)
                                .where('guestIdentity', '==', guestIdentity)
                                .get();
                        } else if (guestPhone) {
                            lastGuestCleaningQuery = db.collection('guestRequests')
                                .where('requestType', '==', 'cleaning')
                                .where('fromGuest', '==', true)
                                .where('guestPhone', '==', guestPhone)
                                .get();
                        }
                        
                        if (lastGuestCleaningQuery) {
                            const guestSnapshot = await lastGuestCleaningQuery;
                            if (!guestSnapshot.empty) {
                                guestSnapshot.docs.forEach(doc => {
                                    const data = doc.data();
                                    const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                                    if (finishTime) {
                                        allLastCleanings.push({
                                            time: finishTime,
                                            source: 'guestRequest',
                                            data: data
                                        });
                                    }
                                });
                            }
                        }
                    }
                    
                    // 2. البحث في log collection للغرفة (دائماً)
                    const logSnapshot = await db.collection('log')
                        .where('num', '==', roomNum)
                        .get();
                    
                    if (!logSnapshot.empty) {
                        logSnapshot.docs.forEach(doc => {
                            const data = doc.data();
                            const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : data.finishTime;
                            if (finishTime) {
                                allLastCleanings.push({
                                    time: finishTime,
                                    source: 'log',
                                    data: data
                                });
                            }
                        });
                    }
                    
                    // 3. البحث في guestRequests للغرفة مباشرة (بغض النظر عن الهوية)
                    const roomCleaningQuery = await db.collection('guestRequests')
                        .where('requestType', '==', 'cleaning')
                        .where('num', '==', roomNum)
                        .where('fromGuest', '==', true)
                        .get();
                    
                    if (!roomCleaningQuery.empty) {
                        roomCleaningQuery.docs.forEach(doc => {
                            const data = doc.data();
                            const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                            if (finishTime) {
                                // تجنب التكرار
                                const exists = allLastCleanings.find(c => c.time === finishTime && c.source === 'guestRequest');
                                if (!exists) {
                                    allLastCleanings.push({
                                        time: finishTime,
                                        source: 'guestRequest',
                                        data: data
                                    });
                                }
                            }
                        });
                    }
                    
                    // 4. ترتيب جميع النتائج واختيار الأحدث
                    if (allLastCleanings.length > 0) {
                        allLastCleanings.sort((a, b) => b.time - a.time);
                        const lastCleaning = allLastCleanings[0];
                        const lastCleaningTime = lastCleaning.time;
                        
                        if (lastCleaningTime) {
                            const deadline = lastCleaningTime + COOLDOWN_TIME;
                            const now = Date.now();
                            
                            if (now < deadline) {
                                // المهلة لم تنتهِ بعد - منع الإرسال
                                const nextAvailableTime = new Date(deadline);
                                const nextTimeStr = nextAvailableTime.toLocaleTimeString('ar-EG', { 
                                    hour: '2-digit', 
                                    minute: '2-digit', 
                                    hour12: true 
                                });
                                
                                const remainingMs = deadline - now;
                                const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
                                const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / 60000);
                                
                                // تصحيح: إذا كانت الدقائق 60 أو أكثر، نحولها إلى ساعات
                                let finalHours = remainingHours;
                                let finalMins = remainingMins;
                                if (finalMins >= 60) {
                                    finalHours += Math.floor(finalMins / 60);
                                    finalMins = finalMins % 60;
                                }
                                
                                let message = `⏳ نعتذر، لا يمكن إرسال طلب تنظيف الآن\n\n`;
                                
                                if (finalHours > 0 && finalMins > 0) {
                                    message += `يرجى الانتظار ${finalHours} ساعة و ${finalMins} دقيقة\n`;
                                } else if (finalHours > 0) {
                                    message += `يرجى الانتظار ${finalHours} ساعة\n`;
                                } else {
                                    message += `يرجى الانتظار ${finalMins} دقيقة\n`;
                                }
                                
                                message += `\nيمكنك إرسال طلب جديد بعد الساعة ${nextTimeStr}`;
                                
                                window.showGuestAlert(message, '⏰ وقت الانتظار');
                                return; // منع الإرسال
                            }
                        }
                    }
                }
            }
        }
        
        // ✅ ثانياً: التحقق من أوقات العمل للطلبات الفورية (النظافة، الصيانة، والطلبات)
        // ✅ checkout متاح 24 ساعة - لا يتم التحقق من أوقات العمل
        if (isInstant && category !== 'checkout') {
            let workingHoursFrom = null;
            let workingHoursTo = null;
            let categoryName = '';
            let is24h = false;
            
            if (category === 'cleaning') {
                workingHoursFrom = requestCooldowns.cleaningFrom || '08:00';
                workingHoursTo = requestCooldowns.cleaningTo || '22:00';
                categoryName = 'النظافة';
                is24h = false; // النظافة لا تدعم 24 ساعة
            } else if (category === 'maintenance') {
                is24h = requestCooldowns.maintenance24h || false;
                if (!is24h) {
                    workingHoursFrom = requestCooldowns.maintenanceFrom || '08:00';
                    workingHoursTo = requestCooldowns.maintenanceTo || '22:00';
                }
                categoryName = 'الصيانة';
            } else if (category === 'requests' || category === 'service') {
                is24h = requestCooldowns.requests24h || false;
                if (!is24h) {
                    workingHoursFrom = requestCooldowns.requestsFrom || '08:00';
                    workingHoursTo = requestCooldowns.requestsTo || '22:00';
                }
                categoryName = 'الطلبات';
            } else if (category === 'fnb') {
                is24h = requestCooldowns.fnb24h || false;
                if (!is24h) {
                    workingHoursFrom = requestCooldowns.fnbFrom || '08:00';
                    workingHoursTo = requestCooldowns.fnbTo || '22:00';
                }
                categoryName = 'خدمات الكافي شوب';
            }
            
            // إذا لم يكن 24 ساعة وكان خارج أوقات العمل، نعرض رسالة اعتذار مهذبة
            if (!is24h && workingHoursFrom && workingHoursTo && !isWithinWorkingHours(workingHoursFrom, workingHoursTo)) {
                const fromTimeStr = workingHoursFrom;
                const toTimeStr = workingHoursTo;
                
                // عرض نافذة مخصصة مع خيارات
                const userChoice = await new Promise((resolve) => {
                    // إزالة أي نافذة موجودة مسبقاً
                    const existing = document.getElementById('guest-working-hours-modal');
                    if (existing) existing.remove();
                    
                    const overlay = document.createElement('div');
                    overlay.id = 'guest-working-hours-modal';
                    const isMobileModal = window.innerWidth <= 768;
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.4);
                        backdrop-filter: blur(8px);
                        -webkit-backdrop-filter: blur(8px);
                        z-index: 10002;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: ${isMobileModal ? '15px' : '20px'};
                        animation: fadeIn 0.2s ease;
                        box-sizing: border-box;
                    `;
                    
                    const dialog = document.createElement('div');
                    dialog.style.cssText = `
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95));
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        border-radius: ${isMobileModal ? '20px' : '24px'};
                        padding: ${isMobileModal ? '20px' : '32px'};
                        max-width: ${isMobileModal ? '100%' : '480px'};
                        width: 100%;
                        max-height: ${isMobileModal ? '90vh' : 'auto'};
                        overflow-y: auto;
                        box-shadow: 0 20px 60px rgba(0, 172, 193, 0.3), 0 0 0 1px rgba(0, 172, 193, 0.1);
                        border: 2px solid rgba(0, 172, 193, 0.2);
                        animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        box-sizing: border-box;
                    `;
                    
                    dialog.innerHTML = `
                        <div style="text-align: center; margin-bottom: ${isMobileModal ? '20px' : '24px'};">
                            <div style="
                                width: ${isMobileModal ? '56px' : '64px'};
                                height: ${isMobileModal ? '56px' : '64px'};
                                background: linear-gradient(135deg, #00ACC1, #0EA5E9);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto ${isMobileModal ? '12px' : '16px'};
                                box-shadow: 0 4px 20px rgba(0, 172, 193, 0.4);
                            ">
                                <span style="color: white; font-size: ${isMobileModal ? '28px' : '32px'};">
                                    ⏰
                                </span>
                            </div>
                            <h3 style="color: #1E293B; font-size: ${isMobileModal ? '1.2rem' : '1.4rem'}; font-weight: 800; margin: 0 0 ${isMobileModal ? '10px' : '12px'} 0; font-family: 'Tajawal', sans-serif; line-height: 1.3;">
                                نعتذر بشدة 🙏
                            </h3>
                            <p style="color: #475569; font-size: ${isMobileModal ? '0.95rem' : '1.05rem'}; line-height: 1.7; margin: 0 0 ${isMobileModal ? '6px' : '8px'} 0; font-family: 'Tajawal', sans-serif;">
                                عامل ${categoryName} غير متوفر حالياً لانتهاء وقت الدوام الرسمي.
                            </p>
                            <div style="
                                background: linear-gradient(135deg, rgba(0, 172, 193, 0.1), rgba(14, 165, 233, 0.1));
                                padding: ${isMobileModal ? '10px 12px' : '12px 16px'};
                                border-radius: ${isMobileModal ? '10px' : '12px'};
                                margin: ${isMobileModal ? '12px' : '16px'} 0;
                                border-right: 3px solid #00ACC1;
                            ">
                                <p style="color: #1E293B; font-size: ${isMobileModal ? '0.85rem' : '0.95rem'}; margin: 0; font-weight: 600; font-family: 'Tajawal', sans-serif;">
                                    ⏰ أوقات العمل الرسمية:<br>
                                    <span style="color: #00ACC1; font-weight: 700;">من ${fromTimeStr} إلى ${toTimeStr}</span>
                                </p>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: ${isMobileModal ? '10px' : '12px'};">
                            <button id="emergency-btn" style="
                                width: 100%;
                                padding: ${isMobileModal ? '14px 20px' : '16px 24px'};
                                background: linear-gradient(135deg, #DC2626, #EF4444);
                                color: white;
                                border: none;
                                border-radius: ${isMobileModal ? '12px' : '14px'};
                                font-size: ${isMobileModal ? '0.95rem' : '1.05rem'};
                                font-weight: 700;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
                                font-family: 'Tajawal', sans-serif;
                            "
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(220, 38, 38, 0.5)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(220, 38, 38, 0.4)';">
                                🚨 طلب طارئ (فوري)
                            </button>
                            <button id="schedule-btn" style="
                                width: 100%;
                                padding: ${isMobileModal ? '14px 20px' : '16px 24px'};
                                background: linear-gradient(135deg, #00ACC1, #0EA5E9);
                                color: white;
                                border: none;
                                border-radius: ${isMobileModal ? '12px' : '14px'};
                                font-size: ${isMobileModal ? '0.95rem' : '1.05rem'};
                                font-weight: 700;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                box-shadow: 0 4px 16px rgba(0, 172, 193, 0.4);
                                font-family: 'Tajawal', sans-serif;
                            "
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0, 172, 193, 0.5)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(0, 172, 193, 0.4)';">
                                📅 جدولة للغد
                            </button>
                            <button id="cancel-btn" style="
                                width: 100%;
                                padding: ${isMobileModal ? '12px 20px' : '14px 24px'};
                                background: rgba(255, 255, 255, 0.9);
                                color: #64748B;
                                border: 2px solid rgba(0, 172, 193, 0.2);
                                border-radius: ${isMobileModal ? '12px' : '14px'};
                                font-size: ${isMobileModal ? '0.9rem' : '1rem'};
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                font-family: 'Tajawal', sans-serif;
                            "
                            onmouseover="this.style.background='rgba(0, 172, 193, 0.1)'; this.style.borderColor='rgba(0, 172, 193, 0.4)'; this.style.color='#1E293B';"
                            onmouseout="this.style.background='rgba(255, 255, 255, 0.9)'; this.style.borderColor='rgba(0, 172, 193, 0.2)'; this.style.color='#64748B';">
                                إلغاء
                            </button>
                        </div>
                    `;
                    
                    overlay.appendChild(dialog);
                    document.body.appendChild(overlay);
                    
                    // معالجة الأزرار
                    document.getElementById('emergency-btn').addEventListener('click', () => {
                        overlay.remove();
                        resolve('emergency');
                    });
                    
                    document.getElementById('schedule-btn').addEventListener('click', () => {
                        overlay.remove();
                        resolve('schedule');
                    });
                    
                    document.getElementById('cancel-btn').addEventListener('click', () => {
                        overlay.remove();
                        resolve('cancel');
                    });
                    
                    // إغلاق عند النقر خارج النافذة
                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) {
                            overlay.remove();
                            resolve('cancel');
                        }
                    });
                });
                
                if (userChoice === 'emergency') {
                    // ✅ المستخدم اختار طلب طارئ - إرسال الطلب كطلب طارئ
                    isEmergencyRequest = true;
                    mode = 'instant';
                } else if (userChoice === 'schedule') {
                    // ✅ المستخدم اختار الجدولة - جدولة للغد في بداية وقت العمل
                    const [hours, minutes] = workingHoursFrom.split(':').map(Number);
                    scheduledTime = new Date();
                    scheduledTime.setHours(hours, minutes, 0, 0);
                    scheduledTime.setDate(scheduledTime.getDate() + 1); // للغد
                    mode = 'scheduled';
                } else {
                    // المستخدم ألغى - منع الإرسال
                    return;
                }
            }
        }
        
        // الحصول على الزر المضغوط
        if (!buttonElement) {
            buttonElement = event?.target || document.querySelector('.guest-btn:active, .guest-btn:hover');
        }
        
        if (category === 'fnb' && itemName) {
            details = decodeURIComponent(itemName);
        } else {
            const input = document.getElementById('guest-request-input');
            if (input) {
                details = input.value.trim();
                // جعل الحقل إجباري للطلبات والصيانة (وليس للنظافة)
                if (!details && category !== 'cleaning') {
                    const isMaintenance = category === 'maintenance';
                    window.showGuestAlert(`${isMaintenance ? 'يرجى إدخال وصف المشكلة' : 'يرجى إدخال تفاصيل الطلب'}`, 'تعرض هذه الصفحة');
                    input.focus();
                    return;
                }
                // طلبات النظافة لا تحتاج تفاصيل
                if (category === 'cleaning' && !details) {
                    details = 'طلب نظافة';
                }
            } else {
                // إذا كان الحقل غير موجود (FNB أو Cleaning)، يجب أن يكون itemName موجود أو تفاصيل افتراضية
                if (category === 'cleaning') {
                    details = 'طلب نظافة';
                } else if (category !== 'fnb' || !itemName) {
                    window.showGuestAlert('يرجى إدخال تفاصيل الطلب', 'تعرض هذه الصفحة');
                    return;
                }
            }
        }
        
        // التحقق من الجدولة
        const scheduleGroup = document.getElementById('schedule-group');
        if (scheduleGroup && scheduleGroup.style.display !== 'none') {
            let date = document.getElementById('guest-schedule-date').value;
            const time = document.getElementById('guest-schedule-time').value;
            
            // إذا لم يكن التاريخ محدداً، استخدم اليوم
            if (!date) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
            
            if (time) {
                mode = 'scheduled';
                scheduledTime = new Date(`${date}T${time}`).getTime();
                
                // ✅ التحقق من 12 ساعة للتنظيف عند الإرسال (تحقق إضافي)
                if (category === 'cleaning' && typeof db !== 'undefined' && db && db.collection) {
                    const roomNum = parseInt(room || currentRoom, 10);
                    if (!isNaN(roomNum) && roomNum > 0) {
                        try {
                            const cleaningCooldownHours = requestCooldowns.cleaning || 12;
                            const COOLDOWN_TIME = cleaningCooldownHours * 60 * 60 * 1000;
                            
                            // جمع جميع مصادر آخر تنظيف
                            let allLastCleanings = [];
                            
                            // البحث في guestRequests
                            if (guestIdentity || guestPhone) {
                                let lastGuestCleaningQuery = null;
                                if (guestIdentity) {
                                    lastGuestCleaningQuery = await db.collection('guestRequests')
                                        .where('requestType', '==', 'cleaning')
                                        .where('fromGuest', '==', true)
                                        .where('guestIdentity', '==', guestIdentity)
                                        .get();
                                } else if (guestPhone) {
                                    lastGuestCleaningQuery = await db.collection('guestRequests')
                                        .where('requestType', '==', 'cleaning')
                                        .where('fromGuest', '==', true)
                                        .where('guestPhone', '==', guestPhone)
                                        .get();
                                }
                                
                                if (lastGuestCleaningQuery && !lastGuestCleaningQuery.empty) {
                                    lastGuestCleaningQuery.docs.forEach(doc => {
                                        const data = doc.data();
                                        const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                                        if (finishTime) {
                                            allLastCleanings.push({ time: finishTime });
                                        }
                                    });
                                }
                            }
                            
                            // البحث في log collection
                            const logSnapshot = await db.collection('log')
                                .where('num', '==', roomNum)
                                .get();
                            
                            if (!logSnapshot.empty) {
                                logSnapshot.docs.forEach(doc => {
                                    const data = doc.data();
                                    const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : data.finishTime;
                                    if (finishTime) {
                                        allLastCleanings.push({ time: finishTime });
                                    }
                                });
                            }
                            
                            // البحث في guestRequests للغرفة مباشرة
                            const roomCleaningQuery = await db.collection('guestRequests')
                                .where('requestType', '==', 'cleaning')
                                .where('num', '==', roomNum)
                                .where('fromGuest', '==', true)
                                .get();
                            
                            if (!roomCleaningQuery.empty) {
                                roomCleaningQuery.docs.forEach(doc => {
                                    const data = doc.data();
                                    const finishTime = data.finishTime?.toMillis ? data.finishTime.toMillis() : (data.finishTime || data.startTime);
                                    if (finishTime) {
                                        const exists = allLastCleanings.find(c => c.time === finishTime);
                                        if (!exists) {
                                            allLastCleanings.push({ time: finishTime });
                                        }
                                    }
                                });
                            }
                            
                            // ترتيب واختيار الأحدث
                            if (allLastCleanings.length > 0) {
                                allLastCleanings.sort((a, b) => b.time - a.time);
                                const lastCleaningTime = allLastCleanings[0].time;
                                const deadline = lastCleaningTime + COOLDOWN_TIME;
                                
                                if (scheduledTime < deadline) {
                                    // الموعد المحدد قبل انتهاء المهلة - منع الجدولة
                                    const nextAvailableTime = new Date(deadline);
                                    const nextDateStr = nextAvailableTime.toISOString().split('T')[0];
                                    const nextTimeStr = nextAvailableTime.toLocaleTimeString('ar-EG', { 
                                        hour: '2-digit', 
                                        minute: '2-digit', 
                                        hour12: false 
                                    }).replace(' ', '');
                                    
                                    window.showGuestAlert(
                                        `⏳ لا يمكن جدولة تنظيف قبل مرور ${cleaningCooldownHours} ساعة من آخر تنظيف\n\n` +
                                        `يرجى اختيار موعد بعد الساعة ${nextTimeStr} في ${nextDateStr}`,
                                        '⏰ وقت الجدولة'
                                    );
                                    
                                    // تعيين التاريخ والوقت الأدنى المسموح
                                    const dateInput = document.getElementById('guest-schedule-date');
                                    const timeInput = document.getElementById('guest-schedule-time');
                                    if (dateInput) dateInput.value = nextDateStr;
                                    if (timeInput) timeInput.value = nextTimeStr;
                                    
                                    return; // منع الإرسال
                                }
                            }
                        } catch (error) {
                            console.error('Error checking cleaning cooldown for scheduling:', error);
                            // في حالة الخطأ، نتابع الإرسال (fail-open)
                        }
                    }
                }
            }
        }
        
        // تحويل الزر إلى شريط تحميل (مدة قصيرة جداً)
        if (buttonElement) {
            showButtonLoading(buttonElement, 800);
        }
        
        // إرسال فوري بدون انتظار
        sendGuestRequest(room, category, details, mode, scheduledTime, itemId);
    };
    
    window.toggleSchedule = function() {
        const group = document.getElementById('schedule-group');
        const actionButtons = document.getElementById('guest-action-buttons');
        const scheduledButton = document.getElementById('guest-scheduled-button');
        
        if (group) {
            const isVisible = group.style.display !== 'none';
            group.style.display = isVisible ? 'none' : 'block';
            
            // إعادة تعيين الأزرار عند إخفاء الجدولة
            if (isVisible) {
                if (actionButtons) actionButtons.style.display = 'flex';
                if (scheduledButton) scheduledButton.style.display = 'none';
                // مسح القيم
                const date = document.getElementById('guest-schedule-date');
                const time = document.getElementById('guest-schedule-time');
                if (date) date.value = '';
                if (time) time.value = '';
            } else {
                // عند فتح الجدولة، تعيين التاريخ التلقائي (اليوم)
                const date = document.getElementById('guest-schedule-date');
                if (date && !date.value) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    date.value = `${year}-${month}-${day}`;
                }
                // التحقق من القيم الحالية
                setTimeout(() => {
                    window.checkScheduleInputs();
                }, 100);
            }
        }
    };
    
    function sendGuestRequest(room, category, details, mode, scheduledTime, itemId = null) {
        // استخدام currentRoom من URL تلقائياً
        let actualRoom = room;
        if (!actualRoom || actualRoom === '--') {
            actualRoom = currentRoom || (() => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('room') || null;
            })();
        }
        
        if (!actualRoom || actualRoom === '--' || actualRoom === null) {
            window.showGuestAlert('رقم الغرفة غير معروف. يرجى التأكد من فتح الصفحة من QR Code صحيح.', 'تعرض هذه الصفحة');
            return;
        }
        
        const roomNum = parseInt(actualRoom, 10);
        if (isNaN(roomNum) || roomNum <= 0) {
            window.showGuestAlert('رقم الغرفة غير صالح. يرجى التأكد من فتح الصفحة من QR Code صحيح.', 'تعرض هذه الصفحة');
            return;
        }
        
        // التحقق من الطلبات المكررة للنظافة فقط
        if (category === 'cleaning') {
            // ✅ فحص أولي: التحقق من أن الغرفة ليست مكتملة (في collection rooms)
            if (typeof db !== 'undefined' && db && db.collection) {
                // التحقق من وجود الغرفة في collection rooms (إذا كانت موجودة، فهي نشطة)
                db.collection('rooms')
                    .where('num', '==', roomNum)
                    .limit(1)
                    .get()
                    .then(roomsSnapshot => {
                        if (!roomsSnapshot.empty) {
                            // ✅ الغرفة موجودة في rooms - يمكن إرسال طلب تنظيف
                            // الآن نتحقق من وجود طلبات نظافة نشطة
                            return db.collection('guestRequests')
                                .where('num', '==', roomNum)
                                .where('requestType', '==', 'cleaning')
                                .get()
                                .then(snapshot => {
                                    if (snapshot.empty) {
                                        // لا توجد طلبات - متابعة الإرسال
                                        continueSendingRequest();
                                        return;
                                    }
                                    
                                    // فلترة محلياً بنفس الفلتر المستخدم في script2.js
                                    let hasActiveCleaning = false;
                                    let hasScheduledCleaning = false;
                                    
                                    snapshot.forEach(doc => {
                                        const data = doc.data();
                                        
                                        // ✅ فحص صارم: الطلب نشط فقط إذا لم يكن مكتملاً
                                        const isActuallyActive = 
                                            data.requestType === 'cleaning' &&
                                            data.roomTracking === true &&
                                            data.status !== 'scheduled' &&
                                            data.status !== 'completed' &&
                                            !data.finishTime;
                                        
                                        // ✅ فحص الطلبات المجدولة
                                        const matchesScheduledFilter = 
                                            data.requestType === 'cleaning' &&
                                            data.roomTracking === true &&
                                            data.status === 'scheduled' &&
                                            !data.finishTime;
                                        
                                        if (isActuallyActive) {
                                            hasActiveCleaning = true;
                                            console.log('Found active cleaning request:', doc.id, data);
                                        } else if (matchesScheduledFilter) {
                                            hasScheduledCleaning = true;
                                            console.log('Found scheduled cleaning request:', doc.id, data);
                                        }
                                    });
                                    
                                    console.log('Cleaning check result:', {
                                        roomNum: roomNum,
                                        totalSnapshotSize: snapshot.size,
                                        hasActive: hasActiveCleaning,
                                        hasScheduled: hasScheduledCleaning,
                                        willBlock: hasActiveCleaning || hasScheduledCleaning
                                    });
                                    
                                    // فقط إذا كان هناك طلب نظافة نشط فعلاً، نمنع الإرسال
                                    if (hasActiveCleaning || hasScheduledCleaning) {
                                        window.showGuestAlert('يوجد طلب نظافة مفتوح لهذه الغرفة', 'تعرض هذه الصفحة');
                                        return;
                                    }
                                    // متابعة الإرسال
                                    continueSendingRequest();
                                })
                                .catch(error => {
                                    console.error('Error checking active cleaning requests:', error);
                                    continueSendingRequest();
                                });
                        } else {
                            // ✅ الغرفة غير موجودة في rooms - تم إنهاؤها
                            // التحقق من 12 ساعة تم في sendGuestRequestNow، هنا نتابع الإرسال فقط
                                            continueSendingRequest();
                        }
                        })
                    .catch((error) => {
                        console.error('Error checking duplicate cleaning requests:', error);
                        // في حالة الخطأ، متابعة الإرسال (لا نمنع المستخدم)
                        continueSendingRequest();
                    });
            } else {
                // إذا لم يكن Firebase متاحاً، متابعة الإرسال
                continueSendingRequest();
            }
        } else if (category === 'checkout') {
            // التحقق من وجود طلب حامل حقائب مفتوح للغرفة نفسها
            if (typeof db !== 'undefined' && db && db.collection) {
                db.collection('guestRequests')
                    .where('num', '==', roomNum)
                    .where('requestType', '==', 'checkout')
                    .get()
                    .then(snapshot => {
                        let hasActiveCheckout = false;
                        let hasScheduledCheckout = false;
                        
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            
                            // الفلتر للطلبات النشطة: status !== 'scheduled' && status !== 'completed'
                            const matchesActiveFilter = 
                                data.requestType === 'checkout' &&
                                data.status !== 'scheduled' &&
                                data.status !== 'completed' &&
                                !data.finishTime;
                            
                            // الفلتر للطلبات المجدولة: status === 'scheduled'
                            const matchesScheduledFilter = 
                                data.requestType === 'checkout' &&
                                data.status === 'scheduled' &&
                                !data.finishTime;
                            
                            if (matchesActiveFilter) {
                                hasActiveCheckout = true;
                            } else if (matchesScheduledFilter) {
                                hasScheduledCheckout = true;
                            }
                        });
                        
                        if (hasActiveCheckout || hasScheduledCheckout) {
                            window.showGuestAlert(
                                'يوجد طلب حامل حقائب نشط لهذه الغرفة حالياً. نعتذر عن التأخير بسبب ضغط العمل، وسنقوم بتنفيذ طلبك في أقرب وقت ممكن. نشكرك على صبرك وتفهمك 🙏',
                                'طلب نشط'
                            );
                            return;
                        }
                        // متابعة الإرسال
                        continueSendingRequest();
                    })
                    .catch((error) => {
                        console.error('Error checking duplicate checkout requests:', error);
                        continueSendingRequest();
                    });
            } else {
                continueSendingRequest();
            }
        } else if (category === 'maintenance') {
            // ✅ التحقق من وجود طلب صيانة نشط للغرفة نفسها
            if (typeof db !== 'undefined' && db && db.collection) {
                db.collection('activeMaintenance')
                    .where('num', '==', roomNum)
                    .where('status', 'in', ['active', 'acknowledging', 'in-progress'])
                    .get()
                    .then(snapshot => {
                        let hasActiveMaintenance = false;
                        
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            // التحقق من أن الطلب نشط فعلاً (ليس مكتملاً أو محذوفاً)
                            if (data.status !== 'completed' && 
                                data.status !== 'deleted' && 
                                !data.finishTime &&
                                // التحقق من أن الطلب حديث (أقل من ساعة)
                                (Date.now() - (data.startTime || 0)) < 3600000) {
                                hasActiveMaintenance = true;
                            }
                        });
                        
                        if (hasActiveMaintenance) {
                            window.showGuestAlert(
                                'يوجد طلب صيانة نشط لهذه الغرفة حالياً. سيتم التعامل مع طلبك في أقرب وقت ممكن. نشكرك على صبرك 🙏',
                                'طلب نشط'
                            );
                            return;
                        }
                        // متابعة الإرسال
                        continueSendingRequest();
                    })
                    .catch((error) => {
                        console.error('Error checking duplicate maintenance requests:', error);
                        // في حالة الخطأ، متابعة الإرسال (لا نمنع المستخدم)
                        continueSendingRequest();
                    });
            } else {
                // إذا لم يكن Firebase متاحاً، متابعة الإرسال
                continueSendingRequest();
            }
        } else {
            // للطلبات الأخرى (requests, service, fnb) لا نتحقق من التكرار
            continueSendingRequest();
        }
        
        function continueSendingRequest() {
            // التحقق من الحقول الإجبارية
            if (category === 'maintenance' && !details.trim()) {
                window.showGuestAlert('يرجى إدخال وصف المشكلة', 'تعرض هذه الصفحة');
                return;
            }
            // طلبات النظافة لا تحتاج تفاصيل
            if (category === 'cleaning') {
                details = 'طلب نظافة'; // تعيين تفاصيل افتراضية
            }
            if ((category === 'requests' || category === 'service') && !details.trim() && !itemName) {
                window.showGuestAlert('يرجى إدخال تفاصيل الطلب', 'تعرض هذه الصفحة');
                return;
            }
        
        const payload = {
            num: roomNum,
            details: details || '',
            category: category || 'service',
            status: mode === 'scheduled' ? 'scheduled' : 'active',
            startTime: Date.now(),
            isUrgent: false,
            fromGuest: true,
            worker: 'نزيل',
            guestIdentity: guestIdentity || null,
            guestPhone: guestPhone || null
        };
        
        // إضافة معلومات خاصة للطلبات
        if (category === 'cleaning') {
            payload.requestType = 'cleaning';
            payload.roomTracking = true; // يظهر في قسم تتبع الغرف
        } else if (category === 'checkout') {
            payload.requestType = 'checkout';
            payload.roomTracking = false; // يظهر في قسم طلبات النزلاء
        }
        
        // إضافة الصورة للصيانة والطلبات
        if (guestImageMedia) {
            if (category === 'maintenance') {
                payload.maintImg = guestImageMedia; // Base64
            } else {
                payload.requestImg = guestImageMedia; // Base64 للطلبات
            }
        }
        
        // إضافة itemId إذا كان موجوداً
        if (itemId) {
            payload.menuItemId = itemId;
        }
        
        if (mode === 'scheduled' && scheduledTime) {
            payload.schedTimestamp = scheduledTime;
            payload.schedTime = new Date(scheduledTime).toLocaleString('ar-EG');
            // ✅ التأكد من أن status='scheduled' للطلبات المجدولة
            payload.status = 'scheduled';
        }
        
        // تحديد Collection حسب النوع
        let collectionName = 'guestRequests';
        if (category === 'maintenance') {
            collectionName = 'activeMaintenance';
            payload.maintDesc = details;
            payload.type = 'maint';
        } else if (category === 'fnb') {
            // طلبات F&B تذهب إلى guestRequests
            collectionName = 'guestRequests';
            payload.requestType = 'fnb';
        }
        
        // تحديد نوع الطلب (فوري أو مجدول)
        const scheduleGroup = document.getElementById('schedule-group');
        const isScheduled = scheduleGroup && scheduleGroup.style.display !== 'none';
        const timeInput = document.getElementById('guest-schedule-time');
        const hasScheduledTime = timeInput && timeInput.value;
        
        // رسائل مختلفة حسب نوع الطلب
        let loadingMessage = '⏳ الرجاء الانتظار لإرسال الطلب بنجاح...';
        if (isScheduled && hasScheduledTime) {
            // طلب مجدول
            loadingMessage = '⏳ الرجاء الانتظار لجدولة الطلب بنجاح...';
        } else {
            // طلب فوري
            loadingMessage = '⏳ الرجاء الانتظار لإرسال الطلب بنجاح...';
        }
        
        // إخفاء محتوى النموذج أثناء التحميل
        const guestContent = document.getElementById('guest-content');
        if (guestContent) {
            guestContent.style.opacity = '0.3';
            guestContent.style.pointerEvents = 'none';
        }
        
        // إظهار شريط التحميل
        showLoadingBar(loadingMessage);
        
        // استخدام النظام الأمني (Geo-Fence + Device Check) مع timeout
        if (typeof window.secureSendHybrid === 'function') {
            // ✅ متغير لتتبع ما إذا تم إرسال الطلب بالفعل
            let requestSent = false;
            
            // timeout للتحقق الأمني (5 ثواني كحد أقصى)
            const securityTimeout = setTimeout(() => {
                // إذا استغرق التحقق الأمني وقتاً طويلاً، متابعة الإرسال مباشرة
                if (!requestSent) {
                    console.warn('Security check timeout, proceeding with request');
                    requestSent = true;
                    sendRequestToFirebase(collectionName, payload);
                }
            }, 5000);
            
            window.secureSendHybrid(
                { ...payload, roomNum: roomNum },
                // onSuccess
                () => {
                    clearTimeout(securityTimeout);
                    // ✅ التحقق من أن الطلب لم يتم إرساله بالفعل
                    if (!requestSent) {
                        requestSent = true;
                        sendRequestToFirebase(collectionName, payload);
                    }
                },
                // onError
                (error) => {
                    clearTimeout(securityTimeout);
                    if (error && error.type === 'DEVICE_LIMIT_EXCEEDED') {
                        hideLoadingBar();
                        window.showGuestAlert(error.message, 'حد الأجهزة');
                        // ✅ إعادة تعيين حالة الإرسال في حالة الخطأ
                        isSendingRequest = false;
                    } else {
                        // Fail-open: إرسال الطلب رغم الخطأ
                        if (!requestSent) {
                            requestSent = true;
                            sendRequestToFirebase(collectionName, payload);
                        }
                    }
                }
            );
        } else {
            // Fallback: إرسال مباشر إذا لم يكن النظام الأمني متاحاً
            sendRequestToFirebase(collectionName, payload);
        }
    }
    
    // ✅ متغير لمنع الإرسال المكرر
    let isSendingRequest = false;
    
    function sendRequestToFirebase(collectionName, payload) {
        // ✅ منع الإرسال المكرر
        if (isSendingRequest) {
            console.warn('Request already being sent, ignoring duplicate');
            return;
        }
        
        // ✅ تحديد حالة الإرسال
        isSendingRequest = true;
        
        // ✅ فحص تكرار إضافي للصيانة قبل الإرسال
        if (collectionName === 'activeMaintenance' && db) {
            db.collection('activeMaintenance')
                .where('num', '==', payload.num)
                .where('status', 'in', ['active', 'acknowledging', 'in-progress'])
                .limit(1)
                .get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        // يوجد طلب نشط - التحقق من التفاصيل
                        let isDuplicate = false;
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            // التحقق من أن الطلب مشابه (نفس الوصف تقريباً ونفس الوقت)
                            if (data.maintDesc && payload.maintDesc &&
                                data.maintDesc.trim() === payload.maintDesc.trim() &&
                                Math.abs((data.startTime || 0) - (payload.startTime || 0)) < 10000) { // 10 ثواني
                                isDuplicate = true;
                            }
                        });
                        
                        if (isDuplicate) {
                            isSendingRequest = false;
                            hideLoadingBar();
                            window.showGuestAlert('تم إرسال هذا الطلب مسبقاً', 'طلب مكرر');
                            return;
                        }
                    }
                    // متابعة الإرسال
                    proceedWithSending();
                })
                .catch((error) => {
                    console.error('Error checking duplicate before send:', error);
                    // في حالة الخطأ، متابعة الإرسال
                    proceedWithSending();
                });
        } else {
            proceedWithSending();
        }
        
        function proceedWithSending() {
            // إرسال إلى Firebase (فوري بدون انتظار)
            if (db) {
                db.collection(collectionName).add(payload)
                .then(() => {
                    // ✅ إعادة تعيين حالة الإرسال بعد 2 ثانية
                    setTimeout(() => {
                        isSendingRequest = false;
                    }, 2000);
                    
                    // تحويل شريط التحميل إلى رسالة نجاح
                    // تحديد رسالة النجاح حسب نوع الطلب
                    const scheduleGroupCheck = document.getElementById('schedule-group');
                    const isScheduledCheck = scheduleGroupCheck && scheduleGroupCheck.style.display !== 'none';
                    const timeInputCheck = document.getElementById('guest-schedule-time');
                    const hasScheduledTimeCheck = timeInputCheck && timeInputCheck.value;
                    
                    let successMessage = '✅ تم إرسال طلبك - فريق العمل في الطريق إليك 🚀';
                    if (isScheduledCheck && hasScheduledTimeCheck) {
                        successMessage = '✅ تم جدولة طلبك بنجاح - سنكون في خدمتك في الوقت المحدد 🎯';
                    }
                    
                    updateLoadingBarToSuccess(successMessage);
                    
                    // إعادة تعيين النموذج
                    const input = document.getElementById('guest-request-input');
                    if (input) input.value = '';
                    
                    // إعادة تعيين الجدولة
                    const scheduleGroup = document.getElementById('schedule-group');
                    if (scheduleGroup) scheduleGroup.style.display = 'none';
                    const actionButtons = document.getElementById('guest-action-buttons');
                    const scheduledButton = document.getElementById('guest-scheduled-button');
                    if (actionButtons) actionButtons.style.display = 'flex';
                    if (scheduledButton) scheduledButton.style.display = 'none';
                    const date = document.getElementById('guest-schedule-date');
                    const time = document.getElementById('guest-schedule-time');
                    if (date) date.value = '';
                    if (time) time.value = '';
                    
                    // إعادة تعيين الميديا
                    guestImageMedia = null;
                    const preview = document.getElementById('guest-image-preview');
                    if (preview) preview.style.display = 'none';
                    const imageInput = document.getElementById('guest-media-image');
                    if (imageInput) imageInput.value = '';
                })
                .catch(e => {
                    // ✅ إعادة تعيين حالة الإرسال في حالة الخطأ
                    isSendingRequest = false;
                    console.error('Error sending request:', e);
                    updateLoadingBarToError('❌ فشل إرسال الطلب');
                });
        } else {
            // Fallback: حفظ محلياً
            const pending = JSON.parse(localStorage.getItem('guest_pending') || '[]');
            pending.push({ ...payload, timestamp: Date.now() });
            localStorage.setItem('guest_pending', JSON.stringify(pending));
            
            setTimeout(() => {
                // رسالة النجاح للوضع غير المتصل
                const scheduleGroupOffline = document.getElementById('schedule-group');
                const isScheduledOffline = scheduleGroupOffline && scheduleGroupOffline.style.display !== 'none';
                const timeInputOffline = document.getElementById('guest-schedule-time');
                const hasScheduledTimeOffline = timeInputOffline && timeInputOffline.value;
                
                let offlineMessage = '✅ تم حفظ طلبك محلياً - سيتم إرساله عند الاتصال 🚀';
                if (isScheduledOffline && hasScheduledTimeOffline) {
                    offlineMessage = '✅ تم حفظ طلبك المجدول محلياً - سيتم إرساله عند الاتصال 🎯';
                }
                
                updateLoadingBarToSuccess(offlineMessage);
            }, 1000);
            
            // ✅ إعادة تعيين حالة الإرسال
            setTimeout(() => {
                isSendingRequest = false;
            }, 2000);
        }
        } // إغلاق proceedWithSending
    } // إغلاق sendRequestToFirebase
    } // إغلاق sendGuestRequest
    
    // ============================================
    // == UI Helpers ==============================
    // ============================================
    
    function showSuccess(message) {
        showNotification(message, 'success');
    }
    
    function showError(message) {
        showNotification(message, 'error');
    }
    
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10B981' : '#EF4444'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 700;
            font-size: 1rem;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // نافذة تحذير مخصصة متوافقة مع الثيم
    window.showGuestAlert = function(message, title = '') {
        // إزالة أي نافذة موجودة مسبقاً
        const existing = document.getElementById('guest-alert-modal');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'guest-alert-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 15px;
            animation: fadeIn 0.2s ease;
            box-sizing: border-box;
        `;
        
        const dialog = document.createElement('div');
        const isMobile = window.innerWidth <= 768;
        dialog.style.cssText = `
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95));
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: ${isMobile ? '20px' : '24px'};
            padding: ${isMobile ? '20px' : '28px'};
            max-width: ${isMobile ? '100%' : '420px'};
            width: 100%;
            max-height: ${isMobile ? '90vh' : 'auto'};
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 172, 193, 0.3), 0 0 0 1px rgba(0, 172, 193, 0.1);
            border: 2px solid rgba(0, 172, 193, 0.2);
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-sizing: border-box;
        `;
        
        dialog.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: ${isMobile ? '12px' : '16px'}; margin-bottom: ${isMobile ? '16px' : '20px'};">
                <div style="
                    width: ${isMobile ? '40px' : '48px'};
                    height: ${isMobile ? '40px' : '48px'};
                    background: linear-gradient(135deg, #00ACC1, #0EA5E9);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 4px 16px rgba(0, 172, 193, 0.3);
                ">
                    <span style="color: white; font-size: ${isMobile ? '20px' : '24px'}; font-weight: 700;">⚠️</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                    ${title ? `<div style="color: #1E293B; font-size: ${isMobile ? '1rem' : '1.2rem'}; font-weight: 700; margin-bottom: ${isMobile ? '8px' : '10px'}; font-family: 'Tajawal', sans-serif; word-wrap: break-word;">${title}</div>` : ''}
                    <div style="color: #475569; font-size: ${isMobile ? '0.9rem' : '1rem'}; line-height: 1.7; font-family: 'Tajawal', sans-serif; word-wrap: break-word; white-space: pre-line;">${message}</div>
                </div>
            </div>
            <button onclick="this.closest('#guest-alert-modal').remove()" 
                style="
                    width: 100%;
                    padding: ${isMobile ? '12px 20px' : '14px 28px'};
                    background: linear-gradient(135deg, #00ACC1, #0EA5E9);
                    color: white;
                    border: none;
                    border-radius: ${isMobile ? '12px' : '14px'};
                    font-size: ${isMobile ? '0.95rem' : '1.05rem'};
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 16px rgba(0, 172, 193, 0.4);
                    font-family: 'Tajawal', sans-serif;
                "
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0, 172, 193, 0.5)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(0, 172, 193, 0.4)';">
                حسناً
            </button>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // إضافة أنيميشن
        if (!document.getElementById('guest-alert-styles')) {
            const style = document.createElement('style');
            style.id = 'guest-alert-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes popIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // إغلاق عند النقر خارج النافذة
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    };
    
    // ============================================
    // == Button Loading Animation ================
    // ============================================
    
    function showButtonLoading(button, duration = 3000) {
        if (!button) return;
        
        const originalHTML = button.innerHTML;
        const originalDisabled = button.disabled;
        const originalStyle = button.style.cssText;
        
        // تعطيل الزر
        button.disabled = true;
        button.style.pointerEvents = 'none';
        
        // إنشاء شريط التحميل
        button.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <div class="button-loading-spinner" style="
                    width: 18px;
                    height: 18px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: buttonSpin 0.8s linear infinite;
                "></div>
                <span>جاري الإرسال...</span>
            </div>
        `;
        
        // إضافة animation للـ spinner إذا لم تكن موجودة
        if (!document.getElementById('button-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'button-loading-styles';
            style.textContent = `
                @keyframes buttonSpin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // استعادة الزر بعد المدة المحددة
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = originalDisabled;
            button.style.cssText = originalStyle;
        }, duration);
    }
    
    // ============================================
    // == Loading Bar Functions ===================
    // ============================================
    
    function showLoadingBar(message = '⏳ الرجاء الانتظار لإرسال الطلب بنجاح...') {
        // إزالة أي شريط تحميل موجود مسبقاً
        const existing = document.getElementById('guest-loading-bar');
        if (existing) existing.remove();
        
        // إخفاء محتوى النموذج أثناء التحميل
        const guestContent = document.getElementById('guest-content');
        if (guestContent) {
            guestContent.style.opacity = '0.3';
            guestContent.style.pointerEvents = 'none';
            guestContent.style.transition = 'opacity 0.3s ease';
        }
        
        const loadingBar = document.createElement('div');
        loadingBar.id = 'guest-loading-bar';
        loadingBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #00ACC1, #0EA5E9);
            color: white;
            padding: 18px 24px;
            z-index: 10001;
            font-weight: 700;
            font-size: 1.05rem;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease;
        `;
        
        loadingBar.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                <div class="guest-loading-spinner" style="
                    width: 24px;
                    height: 24px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></div>
                <span style="font-weight: 700;">${message}</span>
            </div>
        `;
        
        // إضافة animation للـ spinner
        if (!document.getElementById('guest-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'guest-loading-styles';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                @keyframes slideUp {
                    from { transform: translateY(0); }
                    to { transform: translateY(-100%); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(loadingBar);
    }
    
    function hideLoadingBar() {
        const loadingBar = document.getElementById('guest-loading-bar');
        if (loadingBar) {
            loadingBar.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => {
                loadingBar.remove();
                // إعادة إظهار محتوى النموذج بعد إخفاء شريط التحميل
                const guestContent = document.getElementById('guest-content');
                if (guestContent) {
                    guestContent.style.opacity = '1';
                    guestContent.style.pointerEvents = 'auto';
                }
            }, 300);
        } else {
            // إذا لم يكن هناك شريط تحميل، تأكد من إظهار المحتوى
            const guestContent = document.getElementById('guest-content');
            if (guestContent) {
                guestContent.style.opacity = '1';
                guestContent.style.pointerEvents = 'auto';
            }
        }
    }
    
    // تحديث شريط التحميل لرسالة النجاح
    function updateLoadingBarToSuccess(message = '✅ تم إرسال الطلب بنجاح') {
        const loadingBar = document.getElementById('guest-loading-bar');
        if (loadingBar) {
            // تغيير الخلفية إلى الأخضر
            loadingBar.style.background = 'linear-gradient(135deg, #10B981, #059669)';
            // تحديث النص وإزالة spinner
            loadingBar.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <span style="font-size: 1.3rem;">✅</span>
                    <span style="font-weight: 700;">${message}</span>
                </div>
            `;
            // إخفاء بعد 1.5 ثانية (تقليل المدة)
            setTimeout(() => {
                hideLoadingBar();
            }, 1500);
        } else {
            // إذا لم يكن الشريط موجوداً، إنشاء واحد جديد
            showLoadingBar(message);
            setTimeout(() => {
                hideLoadingBar();
            }, 2500);
        }
    }
    
    // تحديث شريط التحميل لرسالة الخطأ
    function updateLoadingBarToError(message = '❌ فشل إرسال الطلب') {
        const loadingBar = document.getElementById('guest-loading-bar');
        if (loadingBar) {
            // تغيير الخلفية إلى الأحمر
            loadingBar.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
            // تحديث النص وإزالة spinner
            loadingBar.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <span style="font-size: 1.3rem;">❌</span>
                    <span style="font-weight: 700;">${message}</span>
                </div>
            `;
            // إخفاء بعد 3 ثواني
            setTimeout(() => {
                hideLoadingBar();
            }, 3000);
        } else {
            // إذا لم يكن الشريط موجوداً، إنشاء واحد جديد
            showLoadingBar(message);
            setTimeout(() => {
                hideLoadingBar();
            }, 3000);
        }
    }
    
    // ============================================
    // == Initialize ==============================
    // ============================================
    
    // متغيرات للهوية والجوال
    let guestIdentity = null;
    let guestPhone = null;
    
    function init() {
        // قراءة رقم الغرفة من URL
        const params = new URLSearchParams(window.location.search);
        const roomFromUrl = params.get('room');
        
        // ✅ تحديث currentRoom إذا كان موجوداً في URL
        if (roomFromUrl) {
            currentRoom = roomFromUrl;
        } else if (!currentRoom) {
            currentRoom = '--';
        }
        
        // عرض رقم الغرفة في صفحة الدخول
        const welcomeRoomInput = document.getElementById('guest-welcome-room');
        if (welcomeRoomInput) {
            if (currentRoom && currentRoom !== '--') {
                welcomeRoomInput.value = `غرفة ${currentRoom}`;
            } else {
                welcomeRoomInput.value = '--';
            }
        }
        
        // ✅ التأكد من أن currentRoom صالح قبل المتابعة
        if (!currentRoom || currentRoom === '--') {
            console.warn('⚠️ رقم الغرفة غير موجود في URL');
        }
        
        // التحقق من وجود بيانات الدخول المحفوظة لنفس الغرفة
        const savedGuestData = getSavedGuestData(currentRoom);
        
        if (savedGuestData && (savedGuestData.identity || savedGuestData.phone)) {
            // إذا كانت البيانات موجودة لنفس الغرفة، تخطي صفحة الدخول
            guestIdentity = savedGuestData.identity;
            guestPhone = savedGuestData.phone;
            proceedToGuestPortal();
        } else {
            // إظهار صفحة الدخول
            const welcomeScreen = document.getElementById('guest-welcome-screen');
            if (welcomeScreen) {
                welcomeScreen.style.display = 'flex';
                
                // محاولة ملء حقل الإدخال بالبيانات المحفوظة (إن وجدت)
                const identityInput = document.getElementById('guest-welcome-identity');
                if (identityInput) {
                    // ✅ منع إدخال الحروف - السماح فقط بالأرقام (عربي/إنجليزي)
                    identityInput.addEventListener('input', function(e) {
                        // إزالة أي حروف والاحتفاظ بالأرقام فقط (عربي ٠-٩ وإنجليزي 0-9)
                        const value = e.target.value;
                        const cleaned = value.replace(/[^0-9٠-٩]/g, '');
                        if (value !== cleaned) {
                            e.target.value = cleaned;
                        }
                    });
                    
                    // ✅ منع اللصق للحروف
                    identityInput.addEventListener('paste', function(e) {
                        e.preventDefault();
                        const pasted = (e.clipboardData || window.clipboardData).getData('text');
                        const cleaned = pasted.replace(/[^0-9٠-٩]/g, '');
                        e.target.value = cleaned;
                    });
                    
                    // محاولة الحصول من مفتاح عام للجهاز
                    try {
                        const deviceData = localStorage.getItem('guest_device_data');
                        if (deviceData) {
                            const parsed = JSON.parse(deviceData);
                            if (parsed && (parsed.identity || parsed.phone)) {
                                const savedValue = parsed.identity || parsed.phone || '';
                                // تنظيف القيمة المحفوظة أيضاً
                                identityInput.value = savedValue.replace(/[^0-9٠-٩]/g, '');
                            }
                        }
                    } catch(e) {
                        console.error('Error pre-filling identity input:', e);
                    }
                }
            }
        }
    }
    
    // الحصول على البيانات المحفوظة للجهاز (عام لكل الجهاز)
    function getSavedGuestData(room) {
        try {
            // أولاً: محاولة الحصول من مفتاح عام للجهاز
            const deviceKey = 'guest_device_data';
            const deviceData = localStorage.getItem(deviceKey);
            if (deviceData) {
                const parsed = JSON.parse(deviceData);
                if (parsed && (parsed.identity || parsed.phone)) {
                    return parsed;
                }
            }
            
            // ثانياً: محاولة الحصول من مفتاح خاص بالغرفة (للتوافق مع النسخ السابقة)
            const roomKey = `guest_data_${room}`;
            const roomData = localStorage.getItem(roomKey);
            if (roomData) {
                const parsed = JSON.parse(roomData);
                if (parsed && (parsed.identity || parsed.phone)) {
                    // نقل البيانات إلى المفتاح العام للجهاز
                    saveGuestData(null, parsed.identity, parsed.phone);
                    return parsed;
                }
            }
        } catch(e) {
            console.error('Error reading saved guest data:', e);
        }
        return null;
    }
    
    // حفظ بيانات النزيل (عام لكل الجهاز)
    function saveGuestData(room, identity, phone) {
        try {
            // حفظ في مفتاح عام للجهاز (بغض النظر عن رقم الغرفة)
            const deviceKey = 'guest_device_data';
            const data = {
                identity: identity || null,
                phone: phone || null,
                timestamp: Date.now(),
                lastRoom: room || currentRoom || null
            };
            localStorage.setItem(deviceKey, JSON.stringify(data));
            
            // أيضاً حفظ نسخة في مفتاح خاص بالغرفة (للتوافق)
            if (room || currentRoom) {
                const roomKey = `guest_data_${room || currentRoom}`;
                localStorage.setItem(roomKey, JSON.stringify(data));
            }
        } catch(e) {
            console.error('Error saving guest data:', e);
        }
    }
    
    // الانتقال إلى البوابة بعد إدخال البيانات
    function proceedToGuestPortal() {
        const identityInput = document.getElementById('guest-welcome-identity');
        if (!identityInput) {
            // إذا لم يكن هناك حقل إدخال (يعني تم استدعاؤها من init)، متابعة مباشرة
            loadGuestPortal();
            return;
        }
        
        const identity = identityInput.value.trim();
        if (!identity) {
            // إضافة تأثير اهتزاز للحقل الفارغ
            identityInput.style.borderColor = '#DC2626';
            identityInput.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.1)';
            identityInput.focus();
            
            // إزالة التأثير بعد ثانية
            setTimeout(() => {
                identityInput.style.borderColor = '';
                identityInput.style.boxShadow = '';
            }, 1000);
            return;
        }
        
        // ✅ التأكد من وجود رقم الغرفة قبل المتابعة
        if (!currentRoom || currentRoom === '--') {
            // محاولة قراءة رقم الغرفة من URL مرة أخرى
            const params = new URLSearchParams(window.location.search);
            const roomFromUrl = params.get('room');
            if (roomFromUrl) {
                currentRoom = roomFromUrl;
                // تحديث حقل رقم الغرفة أيضاً
                const welcomeRoomInput = document.getElementById('guest-welcome-room');
                if (welcomeRoomInput) {
                    welcomeRoomInput.value = `غرفة ${currentRoom}`;
                }
            } else {
                // إذا لم يكن موجوداً، عرض رسالة خطأ
                if (typeof window.showGuestAlert === 'function') {
                    window.showGuestAlert('⚠️ رقم الغرفة غير معروف. يرجى التأكد من فتح الصفحة من QR Code صحيح.', 'تعرض هذه الصفحة');
                } else {
                    alert('⚠️ رقم الغرفة غير معروف. يرجى التأكد من فتح الصفحة من QR Code صحيح.');
                }
                return;
            }
        }
        
        // حفظ البيانات مع ربطها برقم الغرفة
        // التحقق من نوع المدخل (هوية أو جوال)
        const isPhone = /^[0-9]{9,10}$/.test(identity.replace(/[^0-9]/g, ''));
        if (isPhone) {
            guestPhone = identity.replace(/[^0-9]/g, '');
            guestIdentity = null;
        } else {
            guestIdentity = identity;
            guestPhone = null;
        }
        
        // حفظ البيانات مرتبطة برقم الغرفة
        saveGuestData(currentRoom, guestIdentity, guestPhone);
        
        // ✅ التحقق من إذن الموقع مرة واحدة فقط في صفحة الدخول
        if (typeof window.checkGeolocationPermissionOnce === 'function') {
            window.checkGeolocationPermissionOnce();
        }
        
        // إخفاء صفحة الدخول
        const welcomeScreen = document.getElementById('guest-welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.opacity = '0';
            setTimeout(() => {
                welcomeScreen.style.display = 'none';
                loadGuestPortal();
            }, 300);
        } else {
            loadGuestPortal();
        }
    }
    
    // ✅ تصدير الدالة للاستخدام العام
    window.proceedToGuestPortal = proceedToGuestPortal;
    
    // تحميل البوابة الرئيسية
    function loadGuestPortal() {
        // عرض شاشة التحميل
        const loader = document.getElementById('guest-loader');
        if (loader) {
            loader.style.display = 'flex';
        }
        
        // عرض رقم الغرفة
        const roomNumEl = document.getElementById('guest-room-num');
        if (roomNumEl) roomNumEl.textContent = currentRoom;
        
        // تحديث العنوان مباشرة (لضمان التحديث حتى لو تأخرت الإعدادات)
        const titleEl = document.getElementById('guest-title');
        const subtitleEl = document.getElementById('guest-subtitle');
        if (titleEl) {
            titleEl.textContent = guestConfig?.guestHeaderTitle || DEFAULT_CONFIG.guestHeaderTitle;
        }
        if (subtitleEl) {
            subtitleEl.textContent = guestConfig?.guestHeaderSubtitle || DEFAULT_CONFIG.guestHeaderSubtitle;
        }
        
        // تهيئة Firebase (غير متزامن - لا ننتظره)
        initFirebase();
        
        // التحقق من طلبات النظافة المكتملة السابقة
        checkPreviousCleaningRequests(currentRoom);
        
        // تحديث العنوان مباشرة قبل تحميل الإعدادات
        if (titleEl) {
            titleEl.textContent = DEFAULT_CONFIG.guestHeaderTitle;
        }
        if (subtitleEl) {
            subtitleEl.textContent = DEFAULT_CONFIG.guestHeaderSubtitle;
        }
        
        // تحميل وتطبيق الإعدادات (مع تحسين السرعة)
        Promise.all([
            loadAndApplySettings(),
            new Promise(resolve => setTimeout(resolve, 500)) // حد أدنى للتحميل السريع
        ]).then(() => {
            // تحديث العنوان مرة أخرى بعد تحميل الإعدادات
            if (titleEl && guestConfig) {
                titleEl.textContent = guestConfig.guestHeaderTitle || DEFAULT_CONFIG.guestHeaderTitle;
            }
            if (subtitleEl && guestConfig) {
                subtitleEl.textContent = guestConfig.guestHeaderSubtitle || DEFAULT_CONFIG.guestHeaderSubtitle;
            }
            
            // إخفاء شاشة التحميل
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    const container = document.getElementById('guest-container');
                    if (container) {
                        container.style.display = 'block';
                        container.style.animation = 'fadeIn 0.5s ease';
                    }
                }, 300);
            } else {
                const container = document.getElementById('guest-container');
                if (container) container.style.display = 'block';
            }
        });
    }
    
    // تحديث العنوان مباشرة عند تحميل الصفحة (قبل أي شيء)
    function forceUpdateHeader() {
        const titleEl = document.getElementById('guest-title');
        const subtitleEl = document.getElementById('guest-subtitle');
        if (titleEl) {
            // إجبار التحديث باستخدام innerHTML و textContent
            titleEl.innerHTML = '';
            titleEl.textContent = DEFAULT_CONFIG.guestHeaderTitle;
            // إجبار إعادة الرسم
            titleEl.style.display = 'none';
            titleEl.offsetHeight; // trigger reflow
            titleEl.style.display = '';
        }
        if (subtitleEl) {
            // إجبار التحديث باستخدام innerHTML و textContent
            subtitleEl.innerHTML = '';
            subtitleEl.textContent = DEFAULT_CONFIG.guestHeaderSubtitle;
            // إجبار إعادة الرسم
            subtitleEl.style.display = 'none';
            subtitleEl.offsetHeight; // trigger reflow
            subtitleEl.style.display = '';
        }
    }
    
    // تحديث فوري
    forceUpdateHeader();
    
    // تحديث بعد تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            forceUpdateHeader();
            init();
        });
    } else {
        forceUpdateHeader();
        init();
    }
    
    // تحديث إضافي بعد تأخير قصير
    setTimeout(forceUpdateHeader, 100);
    setTimeout(forceUpdateHeader, 500);
    setTimeout(forceUpdateHeader, 1000);
    
    // ============================================
    // == Check Previous Cleaning Requests ========
    // ============================================
    
    function checkPreviousCleaningRequests(room) {
        if (!room || room === '--' || !db) return;
        
        const roomNum = parseInt(room, 10);
        if (isNaN(roomNum) || roomNum <= 0) return;
        
        // البحث عن آخر طلب نظافة مكتمل للغرفة (بدون orderBy لتجنب الحاجة لـ index)
        db.collection('guestRequests')
            .where('num', '==', roomNum)
            .where('requestType', '==', 'cleaning')
            .where('status', '==', 'completed')
            .get()
            .then(snapshot => {
                if (!snapshot.empty) {
                    // ترتيب النتائج محلياً حسب finishTime
                    const cleanings = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(c => c.finishTime)
                        .sort((a, b) => {
                            const timeA = a.finishTime?.toMillis ? a.finishTime.toMillis() : (a.finishTime || 0);
                            const timeB = b.finishTime?.toMillis ? b.finishTime.toMillis() : (b.finishTime || 0);
                            return timeB - timeA; // الأحدث أولاً
                        });
                    
                    if (cleanings.length > 0) {
                        const lastCleaning = cleanings[0];
                        const finishTime = lastCleaning.finishTime?.toMillis ? lastCleaning.finishTime.toMillis() : lastCleaning.finishTime;
                        
                        if (finishTime) {
                            showCleaningNotification(finishTime);
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error checking previous cleaning requests:', error);
            });
    }
    
    function showCleaningNotification(finishTime) {
        const notificationEl = document.getElementById('guest-cleaning-notification');
        const notificationText = document.getElementById('guest-cleaning-notification-text');
        
        if (!notificationEl || !notificationText) return;
        
        const finishDate = new Date(finishTime);
        const now = new Date();
        const diffTime = now - finishDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let timeText = '';
        if (diffDays === 0) {
            // اليوم
            const hours = Math.floor(diffTime / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diffTime / (1000 * 60));
                timeText = `منذ ${minutes} دقيقة`;
            } else {
                timeText = `منذ ${hours} ساعة`;
            }
            notificationText.textContent = `هذه الغرفة طلبت نظافة اليوم الساعة ${finishDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} (${timeText})`;
        } else if (diffDays === 1) {
            // أمس
            notificationText.textContent = `هذه الغرفة طلبت نظافة أمس الساعة ${finishDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            // تاريخ محدد
            const dateStr = finishDate.toLocaleDateString('ar-EG', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            notificationText.textContent = `هذه الغرفة طلبت نظافة في ${dateStr} الساعة ${finishDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        notificationEl.style.display = 'block';
    }
    
    // تنظيف عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        if (unsubscribeSettings) {
            unsubscribeSettings();
        }
    });
    
})();

