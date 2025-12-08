        // ===============================================
        // == منظومة Adora - الإصدار المتكامل ==============
        // ===============================================

        // ============ نظام Haptic Feedback ============
        function hapticFeedback(intensity = 'light') {
            if (navigator.vibrate) {
                const patterns = {
                    light: 10,
                    medium: 20,
                    heavy: 50
                };
                navigator.vibrate(patterns[intensity] || 10);
            }
        }
        
        // ============ حذف غرف DND (بباسورد المدير) ============
        async function clearDNDRooms() {
            hapticFeedback('medium');
            
            // نافذة مخصصة للباسورد - تصميم Soft UI
            const modalHtml = `
                <div class="modal-overlay" id="dnd-password-modal" style="display:flex;">
                    <div class="modal-content" style="max-width:400px; background:#ffffff; border-radius:20px; box-shadow:0 8px 32px rgba(0,0,0,0.12); padding:24px;">
                        <h3 style="color:#DC2626; margin-top:0; margin-bottom:8px; font-size:1.1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
                            <span>🔒</span>
                            <span>حذف غرف عدم الإزعاج</span>
                        </h3>
                        <p style="color:#64748B; margin-bottom:20px; font-size:0.9rem; text-align:right;">أدخل رمز المدير للمتابعة</p>
                        <input type="password" id="dnd-password-input" placeholder="رمز المدير" 
                            style="width:100%; padding:12px 16px; border-radius:12px; border:1px solid #e2e8f0; 
                            font-size:1rem; text-align:center; margin-bottom:20px; direction:ltr; background:#f8fafc; 
                            transition:all 0.2s; box-sizing:border-box;">
                        <div style="display:flex; gap:10px;">
                            <button onclick="confirmDNDDelete()" class="glass-btn" 
                                style="flex:1; background:rgba(220, 38, 38, 0.1) !important; color:#DC2626 !important; 
                                border:1px solid rgba(220, 38, 38, 0.2) !important; font-weight:700; height:40px; border-radius:12px;">
                                ✅ تأكيد الحذف
                            </button>
                            <button onclick="document.getElementById('dnd-password-modal').remove()" class="glass-btn" 
                                style="flex:1; background:#f1f5f9 !important; color:#475569 !important; 
                                border:1px solid #e2e8f0 !important; font-weight:700; height:40px; border-radius:12px;">
                                ❌ إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const input = document.getElementById('dnd-password-input');
            input.focus();
            
            // تأثير focus على حقل الإدخال
            input.addEventListener('focus', function() {
                this.style.borderColor = '#DC2626';
                this.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = '#e2e8f0';
                this.style.boxShadow = 'none';
            });
            
            // Enter للتأكيد
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') confirmDNDDelete();
            });
        }
        
        async function confirmDNDDelete() {
            const pass = document.getElementById('dnd-password-input').value;
            if (!pass) {
                showMiniAlert('⚠️ أدخل الرمز', 'warning');
                return;
            }
            
            // تم حذف كلمة المرور - السماح بالدخول دائماً
            if (HOTEL_CONFIG.adminHash !== null && simpleHash(pass) !== HOTEL_CONFIG.adminHash) {
                showMiniAlert('❌ رمز خاطئ', 'error');
                document.getElementById('dnd-password-input').value = '';
                document.getElementById('dnd-password-input').focus();
                return;
            }
            
            document.getElementById('dnd-password-modal').remove();
            
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            const dndRooms = appState.rooms.filter(r => r.type === 'dnd');
            
            if (dndRooms.length === 0) {
                showMiniAlert('⚠️ لا توجد غرف DND', 'warning');
                return;
            }
            
            try {
                toggleSyncIndicator(true);
                const batch = db.batch();
                
                dndRooms.forEach(room => {
                    // استخدام 'rooms' بدلاً من 'activeRooms'
                    const docRef = db.collection('rooms').doc(String(room.id));
                    batch.delete(docRef);
                });
                
                await batch.commit();
                
                // تحديث الحالة المحلية
                appState.rooms = appState.rooms.filter(r => r.type !== 'dnd');
                
                showMiniAlert(`✅ تم حذف ${dndRooms.length} غرفة (لا تزعج)`, 'success');
                hapticFeedback('heavy');
                smartUpdate();
                
            } catch (error) {
                console.error('Error deleting DND rooms:', error);
                showMiniAlert('❌ خطأ في الحذف', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        // ============ WhatsApp Template Editor ============
        function openWhatsAppTemplateEditor() {
            hapticFeedback('medium');
            
            // جلب القوالب المحفوظة
            const templates = JSON.parse(localStorage.getItem('whatsappTemplates') || '{}');
            
            const defaultTemplates = {
                addRoom: '🏨 {hotelName}\n🧹 غرفة جديدة\n🔢 الغرفة: {roomNum}\n🏷️ النوع: {roomType}\n⏰ الوقت: {time}\n\n#تنظيف',
                finishRoom: '✅ {hotelName}\n🏁 غرفة مكتملة\n🔢 الغرفة: {roomNum}\n⏱️ المدة: {duration}\n✅ الحالة: {status}\n\n#مكتمل',
                report8PM: '📊 *تقرير يومي*\n🏨 {hotelName}\n📅 {date}\n\n✅ منجز: {completed}\n⚠️ نشط: {active}\n🔴 متأخر: {late}'
            };
            
            const currentTemplates = { ...defaultTemplates, ...templates };
            
            const modal = document.createElement('div');
            modal.id = 'whatsapp-template-modal';
            modal.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.7); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 9999; padding: 20px;
            `;
            
            modal.innerHTML = `
                <div style="background: var(--bg-body); border-radius: 16px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;">
                    <div style="padding: 20px; border-bottom: 2px solid var(--border-color);">
                        <h3 style="margin: 0; color: var(--primary);">✉️ محرر قوالب واتساب</h3>
                        <p style="margin: 5px 0 0 0; color: var(--text-sec); font-size: 0.85rem;">
                            تخصيص رسائل واتساب التلقائية
                        </p>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">📝 رسالة إضافة غرفة</label>
                            <textarea id="template-addRoom" rows="4" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.addRoom}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {roomNum}, {roomType}, {time}
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">✅ رسالة إنهاء غرفة</label>
                            <textarea id="template-finishRoom" rows="4" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.finishRoom}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {roomNum}, {duration}, {status}
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">📊 قالب التقرير اليومي</label>
                            <textarea id="template-report8PM" rows="5" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.report8PM}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {date}, {completed}, {active}, {late}
                            </p>
                        </div>
                    </div>
                    
                    <div style="padding: 15px 20px; border-top: 2px solid var(--border-color); display: flex; gap: 10px;">
                        <button onclick="saveWhatsAppTemplates()" style="
                            flex: 1; padding: 12px; background: linear-gradient(135deg, #10B981, #059669);
                            color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">💾 حفظ</button>
                        <button onclick="resetWhatsAppTemplates()" style="
                            flex: 1; padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706);
                            color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">🔄 استعادة الافتراضي</button>
                        <button onclick="document.getElementById('whatsapp-template-modal').remove()" style="
                            padding: 12px 20px; background: #E5E7EB; color: #374151; border: none; 
                            border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">إغلاق</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        function saveWhatsAppTemplates() {
            const templates = {
                addRoom: document.getElementById('template-addRoom').value,
                finishRoom: document.getElementById('template-finishRoom').value,
                report8PM: document.getElementById('template-report8PM').value
            };
            
            localStorage.setItem('whatsappTemplates', JSON.stringify(templates));
            showMiniAlert('✅ تم حفظ القوالب بنجاح', 'success');
            hapticFeedback('medium');
            document.getElementById('whatsapp-template-modal').remove();
        }
        
        function resetWhatsAppTemplates() {
            localStorage.removeItem('whatsappTemplates');
            document.getElementById('whatsapp-template-modal').remove();
            showMiniAlert('🔄 تم استعادة القوالب الافتراضية', 'success');
            hapticFeedback('medium');
        }
        
        // ============ Swipe to Archive/Delete System ============
        let swipeStartX = 0;
        let swipeStartY = 0;
        let swipeElement = null;
        
        function handleSwipeStart(event, roomId) {
            const touch = event.touches[0];
            swipeStartX = touch.clientX;
            swipeStartY = touch.clientY;
            swipeElement = event.currentTarget;
        }
        
        function handleSwipeMove(event, roomId) {
            if (!swipeElement) return;
            
            const touch = event.touches[0];
            const diffX = touch.clientX - swipeStartX;
            const diffY = touch.clientY - swipeStartY;
            
            // فقط إذا كان السحب أفقياً (وليس عمودياً)
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
                event.preventDefault();
                swipeElement.style.transform = `translateX(${diffX}px)`;
                swipeElement.style.transition = 'none';
                
                // تغيير اللون حسب الاتجاه
                if (diffX > 0) {
                    // سحب لليمين - أرشفة (أخضر)
                    swipeElement.style.background = 'linear-gradient(90deg, rgba(34, 197, 94, 0.2), var(--bg-card))';
                } else {
                    // سحب لليسار - حذف (أحمر)
                    swipeElement.style.background = 'linear-gradient(90deg, var(--bg-card), rgba(220, 38, 38, 0.2))';
                }
            }
        }
        
        async function handleSwipeEnd(event, roomId) {
            if (!swipeElement) return;
            
            const diffX = event.changedTouches[0].clientX - swipeStartX;
            
            if (Math.abs(diffX) > 120) {
                hapticFeedback('heavy');
                
                if (diffX > 0) {
                    // سحب لليمين - أرشفة سريعة
                    swipeElement.style.transform = 'translateX(100%)';
                    swipeElement.style.transition = 'transform 0.3s ease';
                    
                    setTimeout(() => {
                        openFinishModal(roomId);
                    }, 300);
                } else {
                    // سحب لليسار - حذف (تراجع)
                    swipeElement.style.transform = 'translateX(-100%)';
                    swipeElement.style.transition = 'transform 0.3s ease';
                    
                    setTimeout(() => {
                        // تم حذف undoLastAction
                    }, 300);
                }
            } else {
                // إرجاع العنصر لموضعه
                swipeElement.style.transform = '';
                swipeElement.style.transition = 'transform 0.3s ease';
                swipeElement.style.background = '';
            }
            
            swipeElement = null;
        }
        
        // ============ التقرير الآلي 8PM ============
        function sendAutoReport8PM() {
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const completedToday = appState.log.length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            const report = 
                `📊 *تقرير يومي - الساعة 8 مساءً*\n` +
                `🏨 ${HOTEL_CONFIG.name}\n` +
                `📅 ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
                `➖➖➖➖➖➖➖➖➖➖\n\n` +
                `✅ *الإنجاز اليومي:*\n` +
                `   🧹 غرف منظفة: ${completedToday}\n` +
                `   🚨 خروج: ${appState.log.filter(l => l.type === 'out').length}\n` +
                `   🏠 ساكن: ${appState.log.filter(l => l.type === 'stay').length}\n\n` +
                `⚠️ *الحالة النشطة:*\n` +
                `   🔵 غرف نشطة: ${activeRooms}\n` +
                `   🔴 غرف متأخرة: ${lateRooms}\n` +
                `   🛎️ طلبات نشطة: ${activeRequests}\n` +
                `   🛠️ صيانة نشطة: ${activeMaintenance}\n\n` +
                `➖➖➖➖➖➖➖➖➖➖\n` +
                `#تقرير_يومي #Adora`;
            
            // فتح واتساب برسالة جاهزة
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(report)}`;
            window.open(whatsappUrl, '_blank');
            
            showMiniAlert('📊 تم إنشاء التقرير اليومي التلقائي', 'success');
            hapticFeedback('heavy');
        }
        
        // ============ نظام الإدخال الصوتي (Voice Input) ============
        let recognition = null;
        let currentVoiceTarget = null;
        
        function initVoiceRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.lang = 'ar-SA'; // اللغة العربية
                recognition.continuous = false;
                recognition.interimResults = false;
                
                recognition.onresult = function(event) {
                    const transcript = event.results[0][0].transcript;
                    if (currentVoiceTarget) {
                        const targetEl = document.getElementById(currentVoiceTarget);
                        if (targetEl) {
                            targetEl.value = transcript;
                            showMiniAlert('✅ تم التعرف على الصوت', 'success');
                            hapticFeedback('medium');
                        }
                    }
                };
                
                recognition.onerror = function(event) {
                    console.error('Voice recognition error:', event.error);
                    if (event.error === 'no-speech') {
                        showMiniAlert('⚠️ لم يتم اكتشاف صوت', 'warning');
                    } else {
                        showMiniAlert('❌ خطأ في التعرف على الصوت', 'error');
                    }
                    stopVoiceInput();
                };
                
                recognition.onend = function() {
                    stopVoiceInput();
                };
                
                return true;
            }
            return false;
        }
        
        function startVoiceInput(targetId) {
            if (!recognition && !initVoiceRecognition()) {
                showMiniAlert('❌ المتصفح لا يدعم الإدخال الصوتي', 'error');
                return;
            }
            
            currentVoiceTarget = targetId;
            const btn = event.target;
            
            try {
                recognition.start();
                btn.innerHTML = '⏹️';
                btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
                showMiniAlert('🎤 استمع... تحدث الآن', 'success');
                hapticFeedback('medium');
            } catch (e) {
                console.error('Error starting recognition:', e);
                showMiniAlert('❌ فشل بدء التسجيل', 'error');
            }
        }
        
        function stopVoiceInput() {
            const btns = document.querySelectorAll('[id^="voice"]');
            btns.forEach(btn => {
                btn.innerHTML = '🎤';
                btn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
            });
            currentVoiceTarget = null;
        }
        
        // ============ نظام تنظيف الذاكرة (Memory Cleanup) ============
        const activeTimers = new Set();
        
        function registerTimer(intervalId) {
            activeTimers.add(intervalId);
            return intervalId;
        }
        
        function clearAllTimers() {
            activeTimers.forEach(id => clearInterval(id));
            activeTimers.clear();
            console.log(`🧹 تم تنظيف ${activeTimers.size} تايمر من الذاكرة`);
        }
        
        function smartSetInterval(fn, delay) {
            const id = setInterval(fn, delay);
            registerTimer(id);
            return id;
        }
        
        // ============ Error Boundary System ============
        let errorCount = 0;
        const MAX_ERRORS = 3;
        
        window.addEventListener('error', function(event) {
            // تجاهل الأخطاء null (غالباً من Firebase أو extensions)
            if (!event.error) return;
            
            errorCount++;
            console.error('🔴 خطأ غير متوقع:', event.error);
            
            if (errorCount >= MAX_ERRORS) {
                showErrorBoundary();
            } else {
                showMiniAlert(`⚠️ خطأ: ${event.message}`, 'error');
            }
        });
        
        window.addEventListener('unhandledrejection', function(event) {
            errorCount++;
            console.error('🔴 Promise غير معالج:', event.reason);
            
            if (errorCount >= MAX_ERRORS) {
                showErrorBoundary();
            } else {
                showMiniAlert('⚠️ خطأ في العملية', 'error');
            }
        });
        
        function showErrorBoundary() {
            const existingBoundary = document.getElementById('error-boundary');
            if (existingBoundary) return;
            
            const boundary = document.createElement('div');
            boundary.id = 'error-boundary';
            boundary.style.cssText = `
                position: fixed;
                inset: 0;
                background: linear-gradient(135deg, #1E293B, #0F172A);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: 'Cairo', sans-serif;
                padding: 20px;
                text-align: center;
            `;
            
            boundary.innerHTML = `
                <div style="background: rgba(220, 38, 38, 0.1); border: 2px solid #DC2626; border-radius: 20px; padding: 30px; max-width: 400px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 15px; color: #DC2626;">حدث خطأ غير متوقع</h2>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 25px; line-height: 1.6;">
                        لا تقلق، بياناتك محفوظة. سيتم إعادة تحميل التطبيق بشكل آمن.
                    </p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, #0EA5E9, #06B6D4);
                        color: white;
                        border: none;
                        padding: 15px 40px;
                        border-radius: 12px;
                        font-size: 1.1rem;
                        font-weight: 700;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        🔄 إعادة تحميل آمن
                    </button>
                </div>
            `;
            
            document.body.appendChild(boundary);
        }

        // ===============================================
        // == إعدادات Firebase ===========================
        // ===============================================
        
        const firebaseConfig = {
            apiKey: "AIzaSyD1rY9BUciB0ir1b8begsPozpJzgwnR-Z0",
            authDomain: "adora-staff5255.firebaseapp.com",
            projectId: "adora-staff5255",
            storageBucket: "adora-staff5255.firebasestorage.app",
            messagingSenderId: "96309381730",
            appId: "1:96309381730:web:d24e0d275255347e43df3b"
        };
        
        function simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash = hash & 0xFFFFFFFF;

            }
            return hash;
        }

        let db;
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            
            // ============ تفعيل وضع الأوفلاين (Offline Persistence) ============
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => {
                    console.log("✅ وضع الأوفلاين مفعّل: البيانات محفوظة محلياً");
                    showMiniAlert("✅ متصل - البيانات محمية", "success");
                    // معالجة قائمة الانتظار المحلية عند الاتصال
                    processOfflineQueue();
                })
                .catch((err) => {
                    if (err.code == 'failed-precondition') {
                        console.warn("⚠️ وضع الأوفلاين غير متاح: تبويبات متعددة مفتوحة");
                    } else if (err.code == 'unimplemented') {
                        console.warn("⚠️ المتصفح لا يدعم وضع الأوفلاين");
                    }
                });
            
            // ============ نظام Offline Queue المحسّن ============
            const OFFLINE_QUEUE_KEY = 'adora_offline_queue';
            
            // حفظ العملية في قائمة الانتظار المحلية
            function saveToOfflineQueue(operation) {
                try {
                    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
                    queue.push({
                        ...operation,
                        timestamp: Date.now(),
                        id: Date.now() + Math.random()
                    });
                    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
                    console.log('💾 تم حفظ العملية في قائمة الانتظار المحلية:', operation.type);
                } catch (e) {
                    console.error('❌ خطأ في حفظ قائمة الانتظار:', e);
                }
            }
            
            // معالجة قائمة الانتظار عند الاتصال
            async function processOfflineQueue() {
                if (!db || !navigator.onLine) return;
                
                try {
                    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
                    if (queue.length === 0) return;
                    
                    console.log(`🔄 معالجة ${queue.length} عملية من قائمة الانتظار...`);
                    updateSyncIndicator('pending');
                    
                    const batch = db.batch();
                    let processed = 0;
                    
                    for (const operation of queue) {
                        try {
                            if (operation.type === 'room') {
                                const ref = db.collection('rooms').doc(String(operation.id));
                                if (operation.action === 'add') {
                                    batch.set(ref, operation.data);
                                } else if (operation.action === 'update') {
                                    batch.update(ref, operation.data);
                                } else if (operation.action === 'delete') {
                                    batch.delete(ref);
                                }
                            } else if (operation.type === 'request') {
                                const ref = db.collection('guestRequests').doc(String(operation.id));
                                if (operation.action === 'add') {
                                    batch.set(ref, operation.data);
                                } else if (operation.action === 'update') {
                                    batch.update(ref, operation.data);
                                } else if (operation.action === 'delete') {
                                    batch.delete(ref);
                                }
                            } else if (operation.type === 'maintenance') {
                                const ref = db.collection('activeMaintenance').doc(String(operation.id));
                                if (operation.action === 'add') {
                                    batch.set(ref, operation.data);
                                } else if (operation.action === 'update') {
                                    batch.update(ref, operation.data);
                                } else if (operation.action === 'delete') {
                                    batch.delete(ref);
                                }
                            } else if (operation.type === 'log') {
                                const ref = db.collection('log').doc();
                                batch.set(ref, operation.data);
                            }
                            
                            processed++;
                        } catch (e) {
                            console.error('❌ خطأ في معالجة العملية:', e, operation);
                        }
                    }
                    
                    if (processed > 0) {
                        await batch.commit();
                        console.log(`✅ تم معالجة ${processed} عملية بنجاح`);
                        
                        // حذف العمليات المعالجة من القائمة
                        const remaining = queue.slice(processed);
                        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
                        
                        if (remaining.length > 0) {
                            console.log(`⚠️ تبقى ${remaining.length} عملية في قائمة الانتظار`);
                        } else {
                            console.log('✅ تم تفريغ قائمة الانتظار بالكامل');
                        }
                    }
                    
                    updateSyncIndicator('synced');
                } catch (e) {
                    console.error('❌ خطأ في معالجة قائمة الانتظار:', e);
                    updateSyncIndicator('offline');
                }
            }
            
            // مراقبة حالة الاتصال
            window.addEventListener('online', () => {
                console.log('🌐 تم استعادة الاتصال - معالجة قائمة الانتظار...');
                processOfflineQueue();
            });
            
            // تصدير الدوال
            window.saveToOfflineQueue = saveToOfflineQueue;
            window.processOfflineQueue = processOfflineQueue;
            
            console.log("🏨 منظومة Adora متصلة بقاعدة البيانات.");
        } catch(e) {
            console.error("خطأ في الاتصال بقاعدة البيانات:", e);
            showMiniAlert("⚠️ فشل الاتصال بقاعدة البيانات", "error");
        }

        // ===============================================
        // == نظام الترجمة الشامل ======================
        // ===============================================
        
        const translations = {
            ar: {
                headerTitle: 'تتبع الغرف', todayStats: 'إحصائيات اليوم', newShift: 'شفت جديد',
                checkout: 'خروج', stayover: 'ساكن', requests: 'طلبات', maintenance: 'صيانة',
                lastRequest: 'آخر طلب', lastMaintenance: 'آخر صيانة', active: 'نشط', late: 'متأخر',
                roomTracking: 'تتبع الغرف', guestRequests: 'طلبات النزلاء', maintenanceSection: 'الصيانة',
                cleaningRequests: 'طلبات تنظيف ( خارج - ساكن )',
                logCompleted: 'السجل (مكتمل)', archive: 'الأرشيف', showMore: 'عرض المزيد',
                searchPlaceholder: 'ابحث برقم الغرفة...', addNewRoom: 'إضافة غرفة جديدة',
                cleaning: 'تنظيف', requestsTab: 'طلبات', maintenanceTab: 'صيانة',
                roomNumber: 'رقم الغرفة', roomPlaceholder: 'مثال: 101', checkoutUrgent: 'خروج (عاجل)',
                stayoverScheduled: 'ساكن (مجدول)', inside: 'داخل', outside: 'خارج',
                scheduleTime: 'موعد التنظيف', superTurbo: 'Super Turbo (-5 min)', immediate: 'فوري',
                scheduled: 'مجدول', requestPlaceholder: 'اكتب طلب النزيل (منشفة - لحاف - وهكذا)',
                urgent: 'عاجل', urgentRequest: 'طلب عاجل', maintenanceDesc: 'اكتب وصف المشكلة...', photoOptional: 'صورة (اختياري)',
                addAndSend: 'إضافة وإرسال', back: 'رجوع', roomReport: 'تقرير الغرفة',
                delayReason: 'سبب التأخير:', workload: 'ضغط العمل', roomIssue: 'مشكلة بالغرفة',
                other: 'أخرى', ready: 'جاهزة', needsMaintenance: 'صيانة', sendWhatsAppReport: 'إرسال تقرير واتساب',
                confirm: 'تأكيد', completeMaintenance: 'إنهاء الصيانة', room: 'غرفة',
                maintenanceStartTime: 'وقت بدء الصيانة:', photoRequired: 'صورة إجبارية (اضغط لرفع)',
                photoUploaded: 'تم رفع الصورة بنجاح', documentAndFinish: 'توثيق وإنهاء',
                checkoutCard: 'خروج', stayoverIn: 'ساكن (داخل)', stayoverOut: 'ساكن (خارج)',
                startNow: 'بدء الآن', arriveRoom: 'الوصول للغرفة', startInspection: 'بدء الفحص',
                finish: 'إنهاء', start: 'بدء', requestConfirm: 'هل تم تسليم {room} طلبه؟',
                yes: 'نعم', verify: 'تأكيد', passwordPlaceholder: 'كلمة المرور',
                purchasesTitle: 'قائمة المشتريات', addItem: 'إضافة', clearList: 'مسح القائمة',
                close: 'إغلاق', itemPlaceholder: 'أضف عنصراً...', emptyList: 'القائمة فارغة',
                scheduledRooms: 'غرف مجدولة', scheduledRequests: 'طلبات مجدولة', scheduledMaintenance: 'صيانة مجدولة',
                undoSuccess: 'تم حذف غرفة {room}', cannotUndoMaintenance: 'لا يمكن التراجع: الغرفة تحتوي على صيانة نشطة. امسح الصيانة أولاً.',
                systemName: 'منظومة Adora', systemDescription: 'لتتبع العمليات التشغيلية للفنادق',
                requestCompleted: 'تم إنهاء طلب غرفة {room}', requestFailed: 'فشل إنهاء الطلب',
                noArchiveRequests: 'لا توجد طلبات سابقة', noArchiveMaintenance: 'لا توجد صيانة سابقة',
                startTime: 'البدء', finishTime: 'الانتهاء', duration: 'الوقت المستغرق',
                completed: 'مكتمل', executed: 'تم التنفيذ', maintenanceDone: 'تمت الصيانة', maintenanceInProgress: 'قيد الصيانة', late: 'متأخر',
                clickToUpload: 'اضغط لرفع صورة', record: 'سجل',
                tipCleaningLessStayover: '💡 النظافة أقل في الساكن اليوم', tipCleaningMoreCheckout: '💡 النظافة أكثر في الخروج اليوم',
                tipMoreRequests: '💡 الطلبات أكثر من أمس', tipMoreMaintenance: '💡 الصيانة أكثر من أمس',
                tipLessProductivity: '💡 إنتاجية أقل من أمس', tipGoodPerformance: '💡 الأداء جيد اليوم',
                noCompletedOperations: 'لا توجد عمليات مكتملة'
            },
            en: {
                headerTitle: 'Room Tracking', todayStats: 'Today\'s Stats', newShift: 'New Shift',
                checkout: 'Checkout', stayover: 'Stayover', requests: 'Requests', maintenance: 'Maintenance',
                lastRequest: 'Last Request', lastMaintenance: 'Last Maintenance', active: 'Active', late: 'Late',
                roomTracking: 'Room Tracking', guestRequests: 'Guest Requests', maintenanceSection: 'Maintenance',
                cleaningRequests: 'Cleaning Requests (Out / Stayover)',
                logCompleted: 'Log (Completed)', archive: 'Archive', showMore: 'Show More',
                searchPlaceholder: 'Search by room number...', addNewRoom: 'Add New Room',
                cleaning: 'Cleaning', requestsTab: 'Requests', maintenanceTab: 'Maintenance',
                roomNumber: 'Room Number', roomPlaceholder: 'Example: 101', checkoutUrgent: 'Checkout (Urgent)',
                stayoverScheduled: 'Stayover (Scheduled)', inside: 'Inside', outside: 'Outside',
                scheduleTime: 'Scheduled Time', superTurbo: 'Super Turbo (-5 min)', immediate: 'Immediate',
                scheduled: 'Scheduled', requestPlaceholder: 'Enter guest request (towel, blanket, etc.)',
                urgent: 'Urgent', maintenanceDesc: 'Describe the issue...', photoOptional: 'Photo (Optional)',
                addAndSend: 'Add & Send', back: 'Back', roomReport: 'Room Report',
                delayReason: 'Delay Reason:', workload: 'Workload', roomIssue: 'Room Issue',
                other: 'Other', ready: 'Ready', needsMaintenance: 'Maintenance', sendWhatsAppReport: 'Send WhatsApp Report',
                confirm: 'Confirm', completeMaintenance: 'Complete Maintenance', room: 'Room',
                maintenanceStartTime: 'Maintenance Start Time:', photoRequired: 'Photo Required (Click to Upload)',
                photoUploaded: 'Photo Uploaded Successfully', documentAndFinish: 'Document & Finish',
                checkoutCard: 'Checkout', stayoverIn: 'Stayover (In)', stayoverOut: 'Stayover (Out)',
                startNow: 'Start Now', arriveRoom: 'Arrive at Room', startInspection: 'Start Inspection',
                finish: 'Finish', start: 'Start', requestConfirm: 'Request for room {room} completed?',
                yes: 'Yes', verify: 'Verify', passwordPlaceholder: 'Password',
                purchasesTitle: 'Purchases List', addItem: 'Add', clearList: 'Clear List',
                close: 'Close', itemPlaceholder: 'Add an item...', emptyList: 'List is empty',
                scheduledRooms: 'Scheduled Rooms', scheduledRequests: 'Scheduled Requests', scheduledMaintenance: 'Scheduled Maintenance',
                undo: 'Undo', urgentRequest: 'Urgent', request: 'Request', dnd: 'Do Not Disturb', delete: 'Delete',
                noActiveRooms: 'No active rooms', noActiveRequests: 'No active requests', noActiveMaintenance: 'No active maintenance',
                undoSuccess: 'Room {room} deleted', cannotUndoMaintenance: 'Cannot undo: Room has active maintenance. Clear maintenance first.',
                systemName: 'Adora System', systemDescription: 'For tracking hotel operational processes',
                requestCompleted: 'Request for room {room} completed', requestFailed: 'Failed to complete request',
                noArchiveRequests: 'No previous requests', noArchiveMaintenance: 'No previous maintenance',
                startTime: 'Start', finishTime: 'Finish', duration: 'Duration',
                completed: 'Completed', executed: 'Executed', maintenanceDone: 'Maintenance Done', maintenanceInProgress: 'In Progress', late: 'Late',
                clickToUpload: 'Click to upload photo', record: 'record',
                tipCleaningLessStayover: '💡 Cleaning is less for stayover today', tipCleaningMoreCheckout: '💡 Cleaning is more for checkout today',
                tipMoreRequests: '💡 More requests than yesterday', tipMoreMaintenance: '💡 More maintenance than yesterday',
                tipLessProductivity: '💡 Less productivity than yesterday', tipGoodPerformance: '💡 Good performance today',
                noCompletedOperations: 'No completed operations'
            },
            hi: {
                headerTitle: 'कमरा ट्रैकिंग', todayStats: 'आज के आंकड़े', newShift: 'नया शिफ्ट',
                checkout: 'चेकआउट', stayover: 'स्टेओवर', requests: 'अनुरोध', maintenance: 'रखरखाव',
                lastRequest: 'अंतिम अनुरोध', lastMaintenance: 'अंतिम रखरखाव', active: 'सक्रिय', late: 'देर से',
                roomTracking: 'कमरा ट्रैकिंग', guestRequests: 'अतिथि अनुरोध', maintenanceSection: 'रखरखाव',
                cleaningRequests: 'सफाई अनुरोध (बाहर / रहना)',
                logCompleted: 'लॉग (पूर्ण)', archive: 'संग्रह', showMore: 'और दिखाएं',
                searchPlaceholder: 'कमरा नंबर से खोजें...', addNewRoom: 'नया कमरा जोड़ें',
                cleaning: 'सफाई', requestsTab: 'अनुरोध', maintenanceTab: 'रखरखाव',
                roomNumber: 'कमरा नंबर', roomPlaceholder: 'उदाहरण: 101', checkoutUrgent: 'चेकआउट (जरूरी)',
                stayoverScheduled: 'स्टेओवर (निर्धारित)', inside: 'अंदर', outside: 'बाहर',
                scheduleTime: 'निर्धारित समय', superTurbo: 'सुपर टर्बो (-5 मिनट)', immediate: 'तत्काल',
                scheduled: 'निर्धारित', requestPlaceholder: 'अतिथि अनुरोध दर्ज करें (तौलिया, कंबल, आदि)',
                urgent: 'जरूरी', maintenanceDesc: 'समस्या का वर्णन करें...', photoOptional: 'फोटो (वैकल्पिक)',
                addAndSend: 'जोड़ें और भेजें', back: 'वापस', roomReport: 'कमरा रिपोर्ट',
                delayReason: 'देरी का कारण:', workload: 'कार्यभार', roomIssue: 'कमरे की समस्या',
                other: 'अन्य', ready: 'तैयार', needsMaintenance: 'रखरखाव', sendWhatsAppReport: 'व्हाट्सएप रिपोर्ट भेजें',
                confirm: 'पुष्टि करें', completeMaintenance: 'रखरखाव पूर्ण करें', room: 'कमरा',
                maintenanceStartTime: 'रखरखाव शुरू होने का समय:', photoRequired: 'फोटो आवश्यक (अपलोड करने के लिए क्लिक करें)',
                photoUploaded: 'फोटो सफलतापूर्वक अपलोड किया गया', documentAndFinish: 'दस्तावेज और समाप्त करें',
                checkoutCard: 'चेकआउट', stayoverIn: 'स्टेओवर (अंदर)', stayoverOut: 'स्टेओवर (बाहर)',
                startNow: 'अभी शुरू करें', arriveRoom: 'कमरे पर पहुंचें', startInspection: 'निरीक्षण शुरू करें',
                finish: 'समाप्त', start: 'शुरू', requestConfirm: 'कमरा {room} के लिए अनुरोध पूर्ण हुआ?',
                yes: 'हाँ', verify: 'सत्यापित करें', passwordPlaceholder: 'पासवर्ड',
                purchasesTitle: 'खरीदारी सूची', addItem: 'जोड़ें', clearList: 'सूची साफ करें',
                close: 'बंद करें', itemPlaceholder: 'एक आइटम जोड़ें...', emptyList: 'सूची खाली है',
                scheduledRooms: 'निर्धारित कमरे', scheduledRequests: 'निर्धारित अनुरोध', scheduledMaintenance: 'निर्धारित रखरखाव',
                undo: 'पूर्ववत', urgentRequest: 'जरूरी', request: 'अनुरोध', dnd: 'परेशान न करें', delete: 'हटाएं',
                noActiveRooms: 'कोई सक्रिय कमरे नहीं', noActiveRequests: 'कोई सक्रिय अनुरोध नहीं', noActiveMaintenance: 'कोई सक्रिय रखरखाव नहीं',
                undoSuccess: 'कमरा {room} हटा दिया गया', cannotUndoMaintenance: 'पूर्ववत नहीं कर सकते: कमरे में सक्रिय रखरखाव है। पहले रखरखाव साफ करें।',
                systemName: 'Adora प्रणाली', systemDescription: 'होटल परिचालन प्रक्रियाओं को ट्रैक करने के लिए',
                requestCompleted: 'कमरा {room} के लिए अनुरोध पूर्ण हुआ', requestFailed: 'अनुरोध पूर्ण करने में विफल',
                noArchiveRequests: 'कोई पिछला अनुरोध नहीं', noArchiveMaintenance: 'कोई पिछला रखरखाव नहीं',
                startTime: 'शुरुआत', finishTime: 'समाप्ति', duration: 'अवधि',
                completed: 'पूर्ण', executed: 'निष्पादित', maintenanceDone: 'रखरखाव पूर्ण', maintenanceInProgress: 'प्रगति में', late: 'देर से',
                clickToUpload: 'फोटो अपलोड करने के लिए क्लिक करें', record: 'रिकॉर्ड',
                tipCleaningLessStayover: '💡 आज स्टेओवर के लिए सफाई कम है', tipCleaningMoreCheckout: '💡 आज चेकआउट के लिए सफाई अधिक है',
                tipMoreRequests: '💡 कल से अधिक अनुरोध', tipMoreMaintenance: '💡 कल से अधिक रखरखाव',
                tipLessProductivity: '💡 कल से कम उत्पादकता', tipGoodPerformance: '💡 आज अच्छा प्रदर्शन',
                noCompletedOperations: 'कोई पूर्ण संचालन नहीं'
            },
            ur: {
                headerTitle: 'کمرہ ٹریکنگ', todayStats: 'آج کے اعداد و شمار', newShift: 'نیا شفٹ',
                checkout: 'چیک آؤٹ', stayover: 'سٹے اوور', requests: 'درخواستیں', maintenance: 'دیکھ بھال',
                lastRequest: 'آخری درخواست', lastMaintenance: 'آخری دیکھ بھال', active: 'فعال', late: 'دیر سے',
                roomTracking: 'کمرہ ٹریکنگ', guestRequests: 'مہمان درخواستیں', maintenanceSection: 'دیکھ بھال',
                cleaningRequests: 'صفائی کی درخواستیں (باہر / رہنا)',
                logCompleted: 'لاگ (مکمل)', archive: 'آرکائیو', showMore: 'مزید دکھائیں',
                searchPlaceholder: 'کمرہ نمبر سے تلاش کریں...', addNewRoom: 'نیا کمرہ شامل کریں',
                cleaning: 'صفائی', requestsTab: 'درخواستیں', maintenanceTab: 'دیکھ بھال',
                roomNumber: 'کمرہ نمبر', roomPlaceholder: 'مثال: 101', checkoutUrgent: 'چیک آؤٹ (فوری)',
                stayoverScheduled: 'سٹے اوور (طے شدہ)', inside: 'اندر', outside: 'باہر',
                scheduleTime: 'طے شدہ وقت', superTurbo: 'سپر ٹربو (-5 منٹ)', immediate: 'فوری',
                scheduled: 'طے شدہ', requestPlaceholder: 'مہمان درخواست درج کریں (تولیہ، کمبل، وغیرہ)',
                urgent: 'فوری', maintenanceDesc: 'مسئلہ بیان کریں...', photoOptional: 'تصویر (اختیاری)',
                addAndSend: 'شامل کریں اور بھیجیں', back: 'واپس', roomReport: 'کمرہ رپورٹ',
                delayReason: 'تاخیر کی وجہ:', workload: 'کام کا بوجھ', roomIssue: 'کمرے کا مسئلہ',
                other: 'دیگر', ready: 'تیار', needsMaintenance: 'دیکھ بھال', sendWhatsAppReport: 'واٹس ایپ رپورٹ بھیجیں',
                confirm: 'تصدیق کریں', completeMaintenance: 'دیکھ بھال مکمل کریں', room: 'کمرہ',
                maintenanceStartTime: 'دیکھ بھال شروع ہونے کا وقت:', photoRequired: 'تصویر ضروری (اپ لوڈ کرنے کے لیے کلک کریں)',
                photoUploaded: 'تصویر کامیابی سے اپ لوڈ ہو گئی', documentAndFinish: 'دستاویز اور ختم کریں',
                checkoutCard: 'چیک آؤٹ', stayoverIn: 'سٹے اوور (اندر)', stayoverOut: 'سٹے اوور (باہر)',
                startNow: 'ابھی شروع کریں', arriveRoom: 'کمرے پر پہنچیں', startInspection: 'معائنہ شروع کریں',
                finish: 'ختم', start: 'شروع', requestConfirm: 'کمرہ {room} کے لیے درخواست مکمل ہوئی؟',
                yes: 'ہاں', verify: 'تصدیق کریں', passwordPlaceholder: 'پاس ورڈ',
                purchasesTitle: 'خریداری کی فہرست', addItem: 'شامل کریں', clearList: 'فہرست صاف کریں',
                close: 'بند کریں', itemPlaceholder: 'ایک آئٹم شامل کریں...', emptyList: 'فہرست خالی ہے',
                scheduledRooms: 'طے شدہ کمرے', scheduledRequests: 'طے شدہ درخواستیں', scheduledMaintenance: 'طے شدہ دیکھ بھال',
                undo: 'واپس', urgentRequest: 'فوری', request: 'درخواست', dnd: 'پریشان نہ کریں', delete: 'حذف کریں',
                noActiveRooms: 'کوئی فعال کمرے نہیں', noActiveRequests: 'کوئی فعال درخواستیں نہیں', noActiveMaintenance: 'کوئی فعال دیکھ بھال نہیں',
                undoSuccess: 'کمرہ {room} حذف کر دیا گیا', cannotUndoMaintenance: 'واپس نہیں کر سکتے: کمرے میں فعال دیکھ بھال ہے۔ پہلے دیکھ بھال صاف کریں۔',
                systemName: 'Adora نظام', systemDescription: 'ہوٹل کے آپریشنل عمل کو ٹریک کرنے کے لیے',
                requestCompleted: 'کمرہ {room} کے لیے درخواست مکمل ہوئی', requestFailed: 'درخواست مکمل کرنے میں ناکام',
                noArchiveRequests: 'کوئی پچھلی درخواستیں نہیں', noArchiveMaintenance: 'کوئی پچھلی دیکھ بھال نہیں',
                startTime: 'شروع', finishTime: 'ختم', duration: 'مدت',
                completed: 'مکمل', executed: 'نافذ', maintenanceDone: 'دیکھ بھال مکمل', maintenanceInProgress: 'جاری', late: 'دیر سے',
                clickToUpload: 'تصویر اپ لوڈ کرنے کے لیے کلک کریں', record: 'ریکارڈ',
                tipCleaningLessStayover: '💡 آج سٹے اوور کے لیے صفائی کم ہے', tipCleaningMoreCheckout: '💡 آج چیک آؤٹ کے لیے صفائی زیادہ ہے',
                tipMoreRequests: '💡 کل سے زیادہ درخواستیں', tipMoreMaintenance: '💡 کل سے زیادہ دیکھ بھال',
                tipLessProductivity: '💡 کل سے کم پیداواریت', tipGoodPerformance: '💡 آج اچھی کارکردگی',
                noCompletedOperations: 'کوئی مکمل آپریشن نہیں'
            },
            bn: {
                headerTitle: 'রুম ট্র্যাকিং', todayStats: 'আজকের পরিসংখ্যান', newShift: 'নতুন শিফ্ট',
                checkout: 'চেকআউট', stayover: 'স্টে ওভার', requests: 'অনুরোধ', maintenance: 'রক্ষণাবেক্ষণ',
                lastRequest: 'শেষ অনুরোধ', lastMaintenance: 'শেষ রক্ষণাবেক্ষণ', active: 'সক্রিয়', late: 'বিলম্বিত',
                roomTracking: 'রুম ট্র্যাকিং', guestRequests: 'অতিথি অনুরোধ', maintenanceSection: 'রক্ষণাবেক্ষণ',
                cleaningRequests: 'পরিষ্কারের অনুরোধ (আউট / থাকুন)',
                logCompleted: 'লগ (সম্পন্ন)', archive: 'আর্কাইভ', showMore: 'আরও দেখুন',
                searchPlaceholder: 'রুম নম্বর দিয়ে অনুসন্ধান করুন...', addNewRoom: 'নতুন রুম যোগ করুন',
                cleaning: 'পরিষ্কার', requestsTab: 'অনুরোধ', maintenanceTab: 'রক্ষণাবেক্ষণ',
                roomNumber: 'রুম নম্বর', roomPlaceholder: 'উদাহরণ: 101', checkoutUrgent: 'চেকআউট (জরুরি)',
                stayoverScheduled: 'স্টে ওভার (নির্ধারিত)', inside: 'ভিতরে', outside: 'বাইরে',
                scheduleTime: 'নির্ধারিত সময়', superTurbo: 'সুপার টার্বো (-5 মিনিট)', immediate: 'তাত্ক্ষণিক',
                scheduled: 'নির্ধারিত', requestPlaceholder: 'অতিথি অনুরোধ লিখুন (তোয়ালে, কম্বল, ইত্যাদি)',
                urgent: 'জরুরি', maintenanceDesc: 'সমস্যা বর্ণনা করুন...', photoOptional: 'ছবি (ঐচ্ছিক)',
                addAndSend: 'যোগ করুন এবং পাঠান', back: 'ফিরে যান', roomReport: 'রুম রিপোর্ট',
                delayReason: 'বিলম্বের কারণ:', workload: 'কাজের চাপ', roomIssue: 'রুমের সমস্যা',
                other: 'অন্যান্য', ready: 'প্রস্তুত', needsMaintenance: 'রক্ষণাবেক্ষণ', sendWhatsAppReport: 'হোয়াটসঅ্যাপ রিপোর্ট পাঠান',
                confirm: 'নিশ্চিত করুন', completeMaintenance: 'রক্ষণাবেক্ষণ সম্পন্ন করুন', room: 'রুম',
                maintenanceStartTime: 'রক্ষণাবেক্ষণ শুরুর সময়:', photoRequired: 'ছবি প্রয়োজনীয় (আপলোড করতে ক্লিক করুন)',
                photoUploaded: 'ছবি সফলভাবে আপলোড হয়েছে', documentAndFinish: 'নথিভুক্ত করুন এবং শেষ করুন',
                checkoutCard: 'চেকআউট', stayoverIn: 'স্টে ওভার (ভিতরে)', stayoverOut: 'স্টে ওভার (বাইরে)',
                startNow: 'এখনই শুরু করুন', arriveRoom: 'রুমে পৌঁছান', startInspection: 'পরিদর্শন শুরু করুন',
                finish: 'শেষ', start: 'শুরু', requestConfirm: 'রুম {room} এর জন্য অনুরোধ সম্পন্ন হয়েছে?',
                yes: 'হ্যাঁ', verify: 'যাচাই করুন', passwordPlaceholder: 'পাসওয়ার্ড',
                purchasesTitle: 'ক্রয় তালিকা', addItem: 'যোগ করুন', clearList: 'তালিকা সাফ করুন',
                close: 'বন্ধ করুন', itemPlaceholder: 'একটি আইটেম যোগ করুন...', emptyList: 'তালিকা খালি',
                scheduledRooms: 'নির্ধারিত রুম', scheduledRequests: 'নির্ধারিত অনুরোধ', scheduledMaintenance: 'নির্ধারিত রক্ষণাবেক্ষণ',
                undo: 'পূর্বাবস্থায় ফিরুন', urgentRequest: 'জরুরি', request: 'অনুরোধ', dnd: 'বিঘ্নিত করবেন না', delete: 'মুছুন',
                noActiveRooms: 'কোন সক্রিয় রুম নেই', noActiveRequests: 'কোন সক্রিয় অনুরোধ নেই', noActiveMaintenance: 'কোন সক্রিয় রক্ষণাবেক্ষণ নেই',
                undoSuccess: 'রুম {room} মুছে ফেলা হয়েছে', cannotUndoMaintenance: 'পূর্বাবস্থায় ফিরানো যাবে না: রুমে সক্রিয় রক্ষণাবেক্ষণ রয়েছে। প্রথমে রক্ষণাবেক্ষণ সাফ করুন।',
                systemName: 'Adora সিস্টেম', systemDescription: 'হোটেলের অপারেশনাল প্রক্রিয়া ট্র্যাক করার জন্য',
                requestCompleted: 'রুম {room} এর জন্য অনুরোধ সম্পন্ন হয়েছে', requestFailed: 'অনুরোধ সম্পন্ন করতে ব্যর্থ',
                noArchiveRequests: 'কোন পূর্ববর্তী অনুরোধ নেই', noArchiveMaintenance: 'কোন পূর্ববর্তী রক্ষণাবেক্ষণ নেই',
                startTime: 'শুরু', finishTime: 'শেষ', duration: 'সময়কাল',
                completed: 'সম্পন্ন', executed: 'নিষ্পাদিত', maintenanceDone: 'রক্ষণাবেক্ষণ সম্পন্ন', maintenanceInProgress: 'চলমান', late: 'বিলম্বিত',
                clickToUpload: 'ছবি আপলোড করতে ক্লিক করুন', record: 'রেকর্ড',
                tipCleaningLessStayover: '💡 আজ স্টে ওভারের জন্য পরিষ্কার কম', tipCleaningMoreCheckout: '💡 আজ চেকআউটের জন্য পরিষ্কার বেশি',
                tipMoreRequests: '💡 গতকালের চেয়ে বেশি অনুরোধ', tipMoreMaintenance: '💡 গতকালের চেয়ে বেশি রক্ষণাবেক্ষণ',
                tipLessProductivity: '💡 গতকালের চেয়ে কম উৎপাদনশীলতা', tipGoodPerformance: '💡 আজ ভাল পারফরম্যান্স',
                noCompletedOperations: 'কোন সম্পন্ন অপারেশন নেই'
            }
        };
        
        function t(key) {
            return translations[appState.language]?.[key] || key;
        }

        // ===============================================
        // == الثوابت والمتغيرات العامة ==================
        // ===============================================
        
        const HOTEL_CONFIG = {
            name: "الفندق",
            imgbbKey: "a7ec1c5e56839fcc6e0b6bda38257f05", 
            adminHash: null, // تم حذف كلمة المرور
            times: { 
                OUT_NORM: 35 * 60000, 
                OUT_TURBO: 30 * 60000, 
                STAY_NORM: 25 * 60000, 
                STAY_TURBO: 20 * 60000, 
                TRAVEL: 15 * 60000,
                CHECKING: 15 * 60000 
            }
        };
        
        let appState = { 
            rooms: [], 
            log: [], 
            activeMaintenance: [], 
            completedMaintenanceLog: [], 
            guestRequests: [], 
            guestRequestsLog: [], 
            turbo: true,  // تلقائياً مفعّل
            searchText: "", 
            archiveViewLimit: { req: 5, maint: 5 },
            logViewLimit: 3,  // عرض آخر 3 سجلات افتراضياً
            logStep: 3,       // زيادة 3 عند الضغط على المزيد
            points: 0,
            focusMode: false,
            emergencyMode: false,
            notificationsEnabled: true,
            language: localStorage.getItem('adora_lang') || 'ar', // اللغة الافتراضية عربية
            autoSendWhatsApp: localStorage.getItem('adora_auto_whatsapp') !== 'false' // افتراضي مفعّل
        };
        
        // قائمة المشتريات
        let purchasesList = [];
        
        // الرموز السريعة
        const quickCodes = {
            '/T1': 'طلب منشفة',
            '/T2': 'طلب مناديل',
            '/W1': 'طلب ماء',
            '/W2': 'طلب مياه غازية',
            '/C1': 'طلب قهوة',
            '/C2': 'طلب شاي',
            '/S1': 'طلب صابون',
            '/S2': 'طلب شامبو'
        };
        
        // نظام النقاط
        const pointsSystem = {
            onTime: 10,
            early: 15,
            late: 5,
            superTurbo: 20,
            urgentRequest: 25,
            maintenanceComplete: 30
        };

        let currentAddMode = 'cleaning';
        let isImmediateRequest = true;
        let isImmediateMaint = true; 
        let tempRoomId = null, activeRoomId = null, activeMaintId = null, pendingAction = null;

        // ===============================================
        // == الوظائف الأساسية (Utilities) ===============
        // ===============================================
        
        function getFormattedDate() { 
            return new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' }); 
        }
        
        // رسائل تنبيه صغيرة
        function showMiniAlert(message, type = 'info') {
            const container = document.getElementById('mini-alert-container');
            if (!container) return;
            
            const alert = document.createElement('div');
            alert.className = 'mini-alert';
            alert.style.background = type === 'error' ? 'var(--danger)' : 
                                   type === 'success' ? 'var(--success)' : 
                                   type === 'warning' ? 'var(--warning)' : 'var(--primary)';
            alert.textContent = message;
            
            container.appendChild(alert);
            
            // إزالة الرسالة بعد 3 ثواني
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 3000);
        }
        
        // تشغيل صوت الإشعار
        function playNotificationSound() {
            if (appState.notificationsEnabled) {
                try {
                    const sound = document.getElementById('notification-sound');
                    if (sound) {
                        sound.currentTime = 0;
                        sound.play();
                    }
                } catch(e) {
                    console.log("لا يمكن تشغيل الصوت");
                }
            }
        }
        
        // إظهار شريط التحفيز
        
        // اقتراح نوع الغرفة بناء على الوقت
        function suggestRoomType() {
            const hour = new Date().getHours();
            let suggestion = '';
            
            if (hour >= 8 && hour <= 12) {
                suggestion = 'خروج'; // وقت الذروة للخروج
            } else if (hour >= 13 && hour <= 17) {
                suggestion = 'ساكن'; // وقت الظهيرة
            } else if (hour >= 18 && hour <= 22) {
                suggestion = 'طلبات'; // وقت المساء
            }
            
            if (suggestion) {
                showMiniAlert(`💡 اقتراح: ${suggestion}`, 'info');
            }
        }
        
        // التحقق من الرموز السريعة
        function checkQuickCodes() {
            const textarea = document.getElementById('inpRequestDetails');
            const suggestionsDiv = document.getElementById('quick-codes-suggestions');
            if (!textarea || !suggestionsDiv) return;
            
            const text = textarea.value;
            if (text.includes('/')) {
                let suggestions = '';
                for (const [code, meaning] of Object.entries(quickCodes)) {
                    if (code.includes(text.substring(text.lastIndexOf('/')))) {
                        suggestions += `<div class="quick-code" onclick="insertQuickCode('${code}')">${code} → ${meaning}</div>`;
                    }
                }
                suggestionsDiv.innerHTML = suggestions || '';
                suggestionsDiv.style.display = suggestions ? 'block' : 'none';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }
        
        function insertQuickCode(code) {
            const textarea = document.getElementById('inpRequestDetails');
            if (textarea) {
                textarea.value = textarea.value.replace(/\/\w*$/, quickCodes[code]);
                document.getElementById('quick-codes-suggestions').style.display = 'none';
            }
        }
        
        // ===============================================
        // == نظام النقاط ================================
        // ===============================================
        
        function addPoints(amount, reason) {
            appState.points += amount;
            updatePointsDisplay();
            // تم حذف رسالة النقاط - لا تظهر رسالة عند إضافة النقاط
            
            // حفظ النقاط في localStorage
            localStorage.setItem('adora_points', appState.points);
        }
        
        function updatePointsDisplay() {
            const display = document.getElementById('points-display');
            if (display) {
                display.innerHTML = `🏆 ${appState.points}`;
            }
        }
        
        function loadPoints() {
            const saved = localStorage.getItem('adora_points');
            if (saved) {
                appState.points = parseInt(saved) || 0;
                updatePointsDisplay();
            }
        }

        // ===============================================
        // == نظام المشتريات =============================
        // ===============================================
        
        function showPurchasesModal() {
            const modalHTML = `
            <div class="modal-content" style="max-width:450px; background:linear-gradient(145deg, #ffffff, #f8fafc); border-radius:24px; padding:24px; box-shadow:0 12px 40px rgba(0,0,0,0.12); font-family:'Tajawal', sans-serif;">
                <h3 style="margin:0 0 20px 0; font-size:1.3rem; font-weight:800; color:#1f2937; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <span style="font-size:1.5rem;">🛒</span>
                    ${t('purchasesTitle')}
                </h3>
                
                <div style="background:linear-gradient(145deg, rgba(59,130,246,0.05), rgba(37,99,235,0.08)); padding:16px; border-radius:16px; margin-bottom:16px; border:1px solid rgba(59,130,246,0.15);">
                    <div style="display:flex; gap:10px; margin-bottom:12px;">
                        <input type="number" id="purchase-quantity" placeholder="${appState.language === 'ar' ? 'كمية' : 'Qty'}" min="1" 
                               style="width:70px; padding:14px 8px; border-radius:12px; border:2px solid rgba(59,130,246,0.2); font-size:1rem; font-weight:700; text-align:center; background:#fff; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='rgba(59,130,246,0.2)'">
                        <input type="text" id="purchase-item" placeholder="${t('itemPlaceholder')}" 
                               style="flex:1; padding:14px 16px; border-radius:12px; border:2px solid rgba(59,130,246,0.2); font-size:1rem; font-weight:600; background:#fff; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='rgba(59,130,246,0.2)'">
                    </div>
                    <button onclick="addToPurchasesList()" style="width:100%; padding:14px; border-radius:12px; border:none; background:linear-gradient(145deg, #3b82f6, #2563eb); color:#fff; font-size:1rem; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(59,130,246,0.3); transition:all 0.2s; font-family:'Tajawal', sans-serif;">
                        ➕ ${t('addItem')}
                    </button>
                </div>
                
                <div style="margin-top:15px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                        <span style="font-size:0.9rem; font-weight:700; color:#374151;">📋 القائمة الحالية</span>
                        <span style="font-size:0.8rem; color:#6b7280; background:rgba(107,114,128,0.1); padding:4px 10px; border-radius:20px;">${purchasesList.length} بند</span>
                    </div>
                    
                    <div id="purchases-list-container" style="max-height:280px; overflow-y:auto; margin-bottom:15px;">
                        ${purchasesList.length > 0 ? 
                            purchasesList.map((item, index) => `
                                <div style="display:flex; justify-content:space-between; align-items:center; 
                                            padding:12px 14px; background:linear-gradient(145deg, #ffffff, #f8fafc); border-radius:12px; 
                                            margin-bottom:8px; border:1px solid rgba(0,0,0,0.06); box-shadow:0 2px 6px rgba(0,0,0,0.04); transition:all 0.2s;">
                                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                                        ${item.quantity ? `<span style="font-size:1.1rem; font-weight:800; color:#3b82f6; min-width:30px;">${item.quantity}×</span>` : ''}
                                        <span style="font-weight:700; font-size:0.95rem; color:#1f2937;">${item.name}</span>
                                    </div>
                                    <button onclick="removePurchaseItem(${index})" style="background:linear-gradient(145deg, rgba(239,68,68,0.1), rgba(220,38,38,0.15)); color:#dc2626; 
                                            border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:6px 10px; font-size:0.85rem; font-weight:700; cursor:pointer; transition:0.2s;">
                                        ✕
                                    </button>
                                </div>
                            `).join('') : 
                            '<div style="text-align:center; color:#9ca3af; padding:30px 20px; background:linear-gradient(145deg, rgba(148,163,184,0.05), rgba(148,163,184,0.1)); border-radius:16px; border:2px dashed rgba(148,163,184,0.3);"><p style="font-size:1.2rem; margin-bottom:8px;">📭</p><p style="font-size:0.95rem; font-weight:600;">القائمة فارغة</p><p style="font-size:0.8rem; margin-top:6px;">أضف عناصر للبدء</p></div>'
                        }
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                        <button onclick="generatePurchasesReport()" style="padding:12px; border-radius:12px; border:none; background:linear-gradient(145deg, rgba(34,197,94,0.15), rgba(22,163,74,0.2)); color:#15803d; font-size:0.9rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(34,197,94,0.15); transition:all 0.2s; font-family:'Tajawal', sans-serif; border:1px solid rgba(34,197,94,0.25);">
                            📄 تقرير
                        </button>
                        <button onclick="clearPurchasesList()" style="padding:12px; border-radius:12px; border:none; background:linear-gradient(145deg, rgba(239,68,68,0.15), rgba(220,38,38,0.2)); color:#dc2626; font-size:0.9rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(239,68,68,0.15); transition:all 0.2s; font-family:'Tajawal', sans-serif; border:1px solid rgba(239,68,68,0.25);">
                            🗑️ مسح الكل
                        </button>
                    </div>
                </div>
                
                <button onclick="closeModal()" style="width:100%; margin-top:15px; padding:14px; border-radius:12px; border:1px solid rgba(100,116,139,0.2); background:linear-gradient(145deg, rgba(100,116,139,0.08), rgba(148,163,184,0.12)); color:#475569; font-size:0.95rem; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:'Tajawal', sans-serif;">
                    ← رجوع
                </button>
            </div>`;
            
            const modal = document.getElementById('purchases-modal');
            modal.innerHTML = modalHTML;
            modal.style.display = 'flex';
            
            // التركيز على حقل الإدخال
            setTimeout(() => {
                const input = document.getElementById('purchase-item');
                if (input) input.focus();
            }, 100);
        }
        
        function addToPurchasesList() {
            const itemInput = document.getElementById('purchase-item');
            const quantityInput = document.getElementById('purchase-quantity');
            const itemName = itemInput.value.trim();
            const quantity = quantityInput.value.trim();
            
            if (!itemName) {
                showMiniAlert('⚠️ الرجاء إدخال اسم البند', 'warning');
                return;
            }
            
            const newItem = {
                name: itemName,
                quantity: quantity || null,
                date: new Date().toLocaleDateString('ar-EG'),
                timestamp: Date.now()
            };
            
            purchasesList.push(newItem);
            savePurchasesToStorage();
            showMiniAlert(`✅ تم إضافة "${itemName}" إلى قائمة المشتريات`, 'success');
            addPoints(5, 'إضافة مشتريات');
            
            // إعادة فتح المودال لتحديث القائمة
            setTimeout(() => {
                showPurchasesModal();
            }, 300);
        }
        
        function savePurchasesToStorage() {
            try {
                localStorage.setItem('adora_purchases_list', JSON.stringify(purchasesList));
            } catch (e) {
                console.error('خطأ في حفظ المشتريات:', e);
            }
        }
        
        function loadPurchasesFromStorage() {
            try {
                const saved = localStorage.getItem('adora_purchases_list');
                if (saved) {
                    purchasesList = JSON.parse(saved);
                }
            } catch (e) {
                console.error('خطأ في تحميل المشتريات:', e);
            }
        }
        
        function removePurchaseItem(index) {
            purchasesList.splice(index, 1);
            savePurchasesToStorage();
            showPurchasesModal();
            showMiniAlert('🗑️ تم حذف البند من القائمة', 'success');
        }
        
        function generatePurchasesReport() {
            if (purchasesList.length === 0) {
                showMiniAlert('📭 قائمة المشتريات فارغة', 'warning');
                return;
            }
            
            const currentDate = new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let report = `🛒 *تقرير المشتريات - منظومة Adora*\n` +
                         `🏨 ${HOTEL_CONFIG.name}\n` +
                         `📅 تاريخ التقرير: ${currentDate}\n` +
                         `📋 إجمالي البنود: ${purchasesList.length}\n` +
                         `➖➖➖➖➖➖➖➖➖➖\n`;
            
            purchasesList.forEach((item, index) => {
                report += `${index + 1}. ${item.quantity ? `${item.quantity}x ` : ''}${item.name}\n`;
            });
            
            report += `\n➖➖➖➖➖➖➖➖➖➖\n` +
                      `👤 مقدم التقرير: فريق العمل\n` +
                      `#مشتريات`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert(`📄 تم إنشاء تقرير المشتريات (${purchasesList.length} بند)`, 'success');
            addPoints(10, 'تقرير المشتريات');
        }
        
        function clearPurchasesList() {
            if (purchasesList.length === 0) {
                showMiniAlert('القائمة فارغة بالفعل', 'info');
                return;
            }
            
            // إغلاق نافذة المشتريات حتى لا تغطي نافذة التأكيد
            const purchasesModal = document.getElementById('purchases-modal');
            if (purchasesModal) {
                purchasesModal.style.display = 'none';
            }
            
            pendingAction = 'clearPurchases';
            document.getElementById('confirm-message').innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; color: var(--danger); margin-bottom: 8px;">⚠️</div>
                    <div>هل تريد مسح جميع البنود (${purchasesList.length} بند) من قائمة المشتريات؟</div>
                    <div style="font-size: 0.8rem; color: var(--text-sec); margin-top: 5px;">
                        لا يمكن التراجع عن هذا الإجراء
                    </div>
                </div>
            `;
            
            document.getElementById('confirm-yes-btn').onclick = function() {
                purchasesList = [];
                savePurchasesToStorage();
                closeModal();
                showMiniAlert('🗑️ تم مسح قائمة المشتريات بالكامل', 'success');
                setTimeout(() => {
                    showPurchasesModal(); // إعادة فتح النافذة لتحديث القائمة
                }, 300);
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }

        // ===============================================
        // == التقرير السريع =============================
        // ===============================================
        
        function showQuickReport() {
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const urgentRequests = appState.guestRequests.filter(r => r.isUrgent && r.status !== 'scheduled').length;
            const urgentMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            let report = `📊 *تقرير سريع - منظومة Adora*\n` +
                        `🏨 ${HOTEL_CONFIG.name}\n` +
                        `🕒 ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n` +
                        `➖➖➖➖➖➖➖\n` +
                        `🧹 الغرف النشطة: ${activeRooms}\n` +
                        `⏰ الغرف المتأخرة: ${lateRooms}\n` +
                        `🚨 طلبات عاجلة: ${urgentRequests}\n` +
                        `🛠️ صيانة عاجلة: ${urgentMaintenance}\n` +
                        `🏆 نقاطك: ${appState.points}\n` +
                        `➖➖➖➖➖➖➖\n` +
                        `#تقرير_سريع`;
            
            showMiniAlert('📊 تم إنشاء التقرير السريع', 'success');
            setTimeout(() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            }, 500);
        }

        // ===============================================
        // == نظام السجل الشامل =========================
        // ===============================================
        
        function showComprehensiveLog() {
            const allLogs = [
                ...(appState.log || []).map(item => ({ ...item, logType: 'cleaning' })),
                ...(appState.guestRequestsLog || []).map(item => ({ ...item, logType: 'request' })),
                ...(appState.completedMaintenanceLog || []).map(item => ({ ...item, logType: 'maintenance' }))
            ];
            
            allLogs.sort((a, b) => (b.id || 0) - (a.id || 0));
            
            const modalHTML = `
            <div class="modal-content" style="max-width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3 style="color:var(--primary); margin-top:0; font-size:1.2rem; display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                    📋 السجل الشامل للعمليات
                </h3>
                
                <div class="modal-tabs" style="margin-bottom:15px;">
                    <button onclick="filterComprehensiveLog('all')" class="modal-tab-btn active" id="tab-all">الكل</button>
                    <button onclick="filterComprehensiveLog('cleaning')" class="modal-tab-btn" id="tab-cleaning-log">النظافة</button>
                    <button onclick="filterComprehensiveLog('request')" class="modal-tab-btn" id="tab-request-log">الطلبات</button>
                    <button onclick="filterComprehensiveLog('maintenance')" class="modal-tab-btn" id="tab-maintenance-log">الصيانة</button>
                </div>
                
                <div id="comprehensive-log-list" style="text-align:right;">
                    ${allLogs.length > 0 ? 
                        allLogs.slice(0, 20).map(item => createComprehensiveLogRow(item)).join('') : 
                        '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد سجلات بعد</p>'
                    }
                </div>
                
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="full-btn" style="background:var(--primary); flex:1;">رجوع</button>
                    <button onclick="exportComprehensiveLog()" class="full-btn" style="background:var(--success); flex:1;">📥 تصدير</button>
                </div>
            </div>`;
            
            const modal = document.getElementById('comprehensive-log-modal');
            modal.innerHTML = modalHTML;
            modal.style.display = 'flex';
            
            window.comprehensiveLogData = allLogs;
        }
        
        function filterComprehensiveLog(type) {
            const logs = window.comprehensiveLogData || [];
            let filteredLogs = logs;
            
            if (type !== 'all') {
                filteredLogs = logs.filter(item => item.logType === type);
            }
            
            ['all', 'cleaning', 'request', 'maintenance'].forEach(t => {
                const tab = document.getElementById(`tab-${t}-log`);
                if (tab) {
                    tab.classList.toggle('active', t === type);
                }
            });
            
            const container = document.getElementById('comprehensive-log-list');
            if (container) {
                container.innerHTML = filteredLogs.length > 0 ? 
                    filteredLogs.slice(0, 20).map(item => createComprehensiveLogRow(item)).join('') : 
                    '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد سجلات لهذا النوع</p>';
            }
        }
        
        function createComprehensiveLogRow(item) {
            // التاريخ والوقت
            const finishDate = new Date(item.finishTime || item.id || Date.now());
            const startDate = item.startTime ? new Date(item.startTime) : null;
            
            const dateStr = finishDate.toLocaleDateString('ar-EG', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            
            const startTimeStr = startDate ? startDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '--';
            const finishTimeStr = finishDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            // النوع والألوان
            let typeIcon = '📄';
            let typeColor = 'var(--text-sec)';
            let bgGradient = 'rgba(148,163,184,0.05)';
            let typeText = '';
            let statusBadge = '';
            
            if (item.logType === 'cleaning') {
                typeIcon = item.type === 'out' ? '🚪' : '🏠';
                typeColor = 'var(--success)';
                bgGradient = 'rgba(34,197,94,0.05)';
                typeText = item.type === 'out' ? 'خروج' : 'ساكن';
                statusBadge = item.isLate ? 
                    '<span style="background:rgba(239,68,68,0.1); color:#dc2626; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">⚠️ متأخر</span>' : 
                    '<span style="background:rgba(34,197,94,0.1); color:#15803d; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ في الوقت</span>';
            } else if (item.logType === 'request') {
                typeIcon = item.isUrgent ? '🚨' : '🛎️';
                typeColor = 'var(--request-color)';
                bgGradient = 'rgba(168,85,247,0.05)';
                typeText = item.isUrgent ? 'طلب عاجل' : 'طلب نزيل';
                statusBadge = '<span style="background:rgba(168,85,247,0.1); color:#7c3aed; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ تم التنفيذ</span>';
            } else if (item.logType === 'maintenance') {
                typeIcon = '🛠️';
                typeColor = 'var(--maint-color)';
                bgGradient = 'rgba(6,182,212,0.05)';
                typeText = 'صيانة';
                statusBadge = item.finishImg ? 
                    '<span style="background:rgba(6,182,212,0.1); color:#0891b2; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ تم الإصلاح</span>' : 
                    '<span style="background:rgba(245,158,11,0.1); color:#d97706; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">🔧 قيد العمل</span>';
            }
            
            // التفاصيل
            let detailsHtml = '';
            if (item.details) {
                detailsHtml = `<div style="font-size:0.8rem; color:#374151; margin-top:6px; padding:8px 10px; background:rgba(0,0,0,0.03); border-radius:8px; border-right:3px solid ${typeColor};">
                    📝 <strong>الطلب:</strong> ${item.details}
                </div>`;
            }
            if (item.maintDesc) {
                detailsHtml = `<div style="font-size:0.8rem; color:#374151; margin-top:6px; padding:8px 10px; background:rgba(0,0,0,0.03); border-radius:8px; border-right:3px solid ${typeColor};">
                    🔧 <strong>العطل:</strong> ${item.maintDesc}
                </div>`;
            }
            if (item.delayReason) {
                detailsHtml += `<div style="font-size:0.75rem; color:#dc2626; margin-top:4px;">
                    ⚠️ سبب التأخير: ${item.delayReason}
                </div>`;
            }
            
            // صورة الصيانة
            let imageHtml = '';
            if (item.finishImg || item.maintImg) {
                const imgUrl = item.finishImg || item.maintImg;
                imageHtml = `<div style="margin-top:8px;">
                    <a href="${imgUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(145deg, rgba(59,130,246,0.1), rgba(37,99,235,0.15)); color:#1d4ed8; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; text-decoration:none; border:1px solid rgba(59,130,246,0.2);">
                        📷 عرض صورة الإصلاح
                    </a>
                </div>`;
            }
            
            return `
            <div style="border:1px solid rgba(0,0,0,0.08); border-radius:14px; padding:14px; margin-bottom:10px; background:linear-gradient(145deg, ${bgGradient}, rgba(255,255,255,0.95)); box-shadow:0 2px 8px rgba(0,0,0,0.04); font-family:'Tajawal', sans-serif;">
                <!-- الصف العلوي: رقم الغرفة + النوع + الحالة -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:45px; height:45px; border-radius:50%; background:linear-gradient(145deg, ${typeColor}dd, ${typeColor}); display:flex; align-items:center; justify-content:center; color:white; font-size:1.3rem; box-shadow:0 3px 10px ${typeColor}40;">
                            ${typeIcon}
                        </div>
                        <div>
                            <div style="font-size:1.15rem; font-weight:800; color:#1f2937;">غرفة ${item.num}</div>
                            <div style="font-size:0.8rem; color:${typeColor}; font-weight:600;">${typeText}</div>
                        </div>
                    </div>
                    <div style="text-align:left;">
                        ${statusBadge}
                        <div style="font-size:0.7rem; color:#9ca3af; margin-top:4px;">${dateStr}</div>
                    </div>
                </div>
                
                <!-- أوقات البدء والانتهاء -->
                <div style="display:flex; gap:15px; padding:10px; background:rgba(0,0,0,0.02); border-radius:10px; margin-bottom:8px;">
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">🕐 البدء</div>
                        <div style="font-size:0.9rem; font-weight:700; color:#374151;">${startTimeStr}</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">🏁 الانتهاء</div>
                        <div style="font-size:0.9rem; font-weight:700; color:#374151;">${finishTimeStr}</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">⏱️ المدة</div>
                        <div style="font-size:0.9rem; font-weight:800; color:${typeColor};">${item.duration || '--'}</div>
                    </div>
                </div>
                
                <!-- التفاصيل -->
                ${detailsHtml}
                
                <!-- صورة الصيانة -->
                ${imageHtml}
            </div>`;
        }
        
        function exportComprehensiveLog() {
            const logs = window.comprehensiveLogData || [];
            if (logs.length === 0) {
                showMiniAlert('لا توجد سجلات للتصدير', 'warning');
                return;
            }
            
            let report = `📋 *السجل الشامل - منظومة Adora*\n` +
                        `🏨 ${HOTEL_CONFIG.name}\n` +
                        `📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}\n` +
                        `📊 إجمالي السجلات: ${logs.length}\n` +
                        `➖➖➖➖➖➖➖➖➖➖\n`;
            
            logs.slice(0, 50).forEach((item, index) => {
                const date = new Date(item.id || Date.now());
                const dateStr = date.toLocaleDateString('ar-EG');
                const typeText = item.logType === 'cleaning' ? 'تنظيف' : 
                                item.logType === 'request' ? 'طلب' : 'صيانة';
                
                report += `${index + 1}. ${typeText} - غرفة ${item.num} (${dateStr})\n`;
            });
            
            report += `\n➖➖➖➖➖➖➖➖➖➖\n` +
                     `👤 مقدم التقرير: فريق العمل\n` +
                     `#سجل_شامل`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert(`📄 تم إنشاء تقرير السجل الشامل (${logs.length} سجل)`, 'success');
        }

        // ===============================================
        // == التحكم في النوافذ (Modals) =================
        // ===============================================
        
        function setDelayReason(reason, el) { 
            document.getElementById('modal-delay').value = reason; 
            
            // إزالة التحديد من كل الأزرار
            ['dly_work', 'dly_room'].forEach(id => {
                const btn = document.getElementById(id);
                if(btn) { 
                    btn.classList.remove('selected');
                }
            }); 
            
            // تحديد الزر المضغوط
            if(el) { 
                el.classList.add('selected');
            }
            
            // إذا كانت "مشكلة بالغرفة"، إظهار نافذة كتابة النص
            const issueDetailsSection = document.getElementById('room-issue-details-section');
            if (reason === 'مشكلة بالغرفة') {
                if (issueDetailsSection) issueDetailsSection.style.display = 'block';
                const issueDetails = document.getElementById('room-issue-details');
                if (issueDetails) issueDetails.focus();
            } else {
                if (issueDetailsSection) issueDetailsSection.style.display = 'none';
                const issueDetails = document.getElementById('room-issue-details');
                if (issueDetails) issueDetails.value = '';
            }
        }

        function setFinishModalLoading(isLoading) {
            const confirmBtn = document.getElementById('btn_confirm_finish');
            const backBtn = document.querySelector('#final-modal .back-action-btn');
            const loader = document.getElementById('finish-modal-loader');
            if (confirmBtn) {
                if (isLoading) {
                    confirmBtn.dataset.originalText = confirmBtn.dataset.originalText || confirmBtn.innerHTML;
                    confirmBtn.classList.add('btn-loading');
                    confirmBtn.innerHTML = '⏳ جارٍ التأكيد...';
                } else if (confirmBtn.dataset.originalText) {
                    confirmBtn.innerHTML = confirmBtn.dataset.originalText;
                }
                confirmBtn.disabled = isLoading;
            }
            if (backBtn) backBtn.disabled = isLoading;
            if (loader) loader.style.display = isLoading ? 'flex' : 'none';
        }
        
        function openFinishModal(id) { 
            activeRoomId = id; 
            const room = appState.rooms.find(r => r.id === id); 
            if (!room) return; 
            
            // ✅ إعادة تفعيل زر التأكيد عند فتح النافذة
            const confirmBtn = document.getElementById('btn_confirm_finish');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.pointerEvents = 'auto';
            }
            
            // إعادة تعيين حالة التحميل
            setFinishModalLoading(false);
            
            // حساب إذا كانت متأخرة
            const isLate = room.status === 'overdue' || Date.now() > room.deadline;
            document.getElementById('delay-reason-section').style.display = isLate ? 'block' : 'none'; 
            document.getElementById('modal-delay').value = ''; 
            ['dly_work','dly_room'].forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.classList.remove('selected');
            });
            const issueSection = document.getElementById('room-issue-details-section');
            if (issueSection) issueSection.style.display = 'none';
            const issueDetailsField = document.getElementById('room-issue-details');
            if (issueDetailsField) issueDetailsField.value = '';
            if (isLate) {
                const defaultBtn = document.getElementById('dly_work');
                setDelayReason('ضغط العمل', defaultBtn);
            }
            document.getElementById('repair-details-input').value = ''; 
            document.getElementById('modal-img-camera-input').value = ''; 
            // تم إزالة inpSendWhatsapp - نستخدم فقط inpAutoSendWhatsappFinish 
            
            // تحديث حالة الإرسال التلقائي بناءً على appState
            const autoSendToggle = document.getElementById('inpAutoSendWhatsappFinish');
            if (autoSendToggle) {
                autoSendToggle.checked = appState.autoSendWhatsApp !== false; // افتراضي مفعّل
                toggleAutoSendWhatsApp('finish', autoSendToggle.checked);
            } 
            
            // إضافة رسالة تشجيعية
            let title = '📝 تقرير الغرفة';
            if (isLate) {
                const delayMinutes = Math.floor((Date.now() - room.deadline) / 60000);
                title = `⏰ تأخرت ${delayMinutes} دقيقة - حاول التعجل المرة القادمة`;
            } else {
                title = '⭐ ممتاز! أنهيت في الوقت المحدد';
            }
            document.getElementById('finish-title').innerText = title;
            
            setRoomStatus('جاهزة');
            document.getElementById('final-modal').style.display = 'flex'; 
        }
        
        function openCompleteMaintenanceModal(id) { 
            activeMaintId = id; 
            const maint = appState.activeMaintenance.find(m => m.id === id); 
            if (!maint) return; 
            
            document.getElementById('maint-room-num-display').innerText = `غرفة ${maint.num}`; 
            document.getElementById('maint-img-camera-input').value = ''; 
            
            // عرض وقت بدء الصيانة
            if (maint.startTime) {
                const startTime = new Date(maint.startTime).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                document.getElementById('maint-start-time').innerText = startTime;
            }
            
            document.getElementById('complete-maint-modal').style.display = 'flex'; 
        }
        
        function checkDuplicate() { 
            const num = document.getElementById('inpRoomNum').value; 
            const exists = appState.rooms.find(r => r.num == String(num)); 
            const alertBox = document.getElementById('room-dup-alert'); 
            
            // البحث عن آخر طلب/صيانة للغرفة
            const lastRequest = appState.guestRequestsLog
                .filter(r => r.num == num)
                .sort((a, b) => (b.finishTime || b.id) - (a.finishTime || a.id))[0];
            const lastMaint = appState.completedMaintenanceLog
                .filter(m => m.num == num)
                .sort((a, b) => (b.finishTime || b.id) - (a.finishTime || a.id))[0];
            
            let historyInfo = '';
            if (lastRequest) {
                const time = new Date(lastRequest.finishTime || lastRequest.id);
                const timeStr = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                // استخراج كلمة مختصرة من تفاصيل الطلب
                const reqDetails = lastRequest.details || '';
                const shortReq = reqDetails.split(' ')[0] || 'طلب';
                historyInfo += `<div style="font-size:0.8rem; color:var(--request-color); margin-top:4px;">🛎️ آخر طلب: ${shortReq} - ${timeStr}</div>`;
            }
            if (lastMaint) {
                const time = new Date(lastMaint.finishTime || lastMaint.id);
                const timeStr = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                // استخراج كلمة مختصرة من تفاصيل الصيانة
                const maintDetails = lastMaint.maintDesc || '';
                const shortMaint = maintDetails.split(' ')[0] || 'صيانة';
                historyInfo += `<div style="font-size:0.8rem; color:var(--maint-color); margin-top:4px;">🛠️ آخر صيانة: ${shortMaint} - ${timeStr}</div>`;
            }
            
            if (exists) { 
                if (currentAddMode === 'cleaning') {
                    // Hard Block: لا يمكن إضافة تنظيف على غرفة نشطة
                    alertBox.style.display = 'block'; 
                    alertBox.innerHTML = `⚠️ الغرفة ${num} نشطة بالفعل!${historyInfo}`; 
                } else {
                    // Soft Warning: يسمح بإضافة طلب/صيانة مع تنبيه
                    alertBox.style.display = 'block'; 
                    alertBox.style.background = 'rgba(250, 204, 21, 0.15)';
                    alertBox.style.color = 'var(--warning)';
                    alertBox.innerHTML = `💡 الغرفة ${num} قيد التنظيف. يمكنك إضافة ${currentAddMode === 'request' ? 'طلب' : 'صيانة'} على أي حال.${historyInfo}`; 
                }
            } else { 
                    alertBox.style.display = historyInfo ? 'block' : 'none';
                    if (historyInfo) {
                        alertBox.style.background = 'rgba(56, 189, 248, 0.1)';
                        alertBox.style.color = 'var(--text-main)';
                        alertBox.innerHTML = historyInfo;
                }
            } 
        }
        
        function openAddModal() { 
            hapticFeedback('light');
            
            const modal = document.getElementById('addRoomModal');
            if (!modal) return;
            
            // فتح النافذة مباشرة
            modal.style.display = 'flex';
            
            // إظهار مؤشر التحميل
            showLoadingBar();
            setTimeout(() => {
                hideLoadingBar();
            }, 3000);
            
            // تهيئة الحقول
            const inpRoomNum = document.getElementById('inpRoomNum');
            if (inpRoomNum) inpRoomNum.value = ''; 
            
            const dupAlert = document.getElementById('room-dup-alert');
            if (dupAlert) dupAlert.style.display = 'none'; 
            
            const inpRoomType = document.getElementById('inpRoomType');
            if (inpRoomType) inpRoomType.value = ''; 
            
            // مسح selected من جميع أزرار الاختيار
            document.querySelectorAll('.modal-select-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // مسح اختيارات الحالة
            document.querySelectorAll('.guest-status-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            const inpSuperTurbo = document.getElementById('inpSuperTurbo');
            if (inpSuperTurbo) inpSuperTurbo.checked = false; 
            
            const inpRequestDetails = document.getElementById('inpRequestDetails');
            if (inpRequestDetails) inpRequestDetails.value = ''; 
            
            const inpMaintDetails = document.getElementById('inpMaintDetails');
            if (inpMaintDetails) inpMaintDetails.value = ''; 
            
            const inpMaintImage = document.getElementById('inpMaintImage');
            if (inpMaintImage) inpMaintImage.value = '';
            
            // مسح حالة الصورة المرفوعة (الدائرة الدوارة)
            const maintImageLabel = document.querySelector('.maint-image-upload');
            if (maintImageLabel) maintImageLabel.classList.remove('uploaded');
            
            // تعيين الحد الأدنى للتاريخ والوقت (اليوم فقط، ومنع الوقت الماضي)
            setMinDateTime();
            
            // تعيين الوضع الافتراضي
            currentAddMode = 'cleaning';
            switchAddMode('cleaning');
            
            // لا نعين أي وضع افتراضي للطلبات والصيانة - نترك المستخدم يختار
            // مسح جميع الأزرار لتكون في وضع محايد
            const btnReqImm = document.getElementById('btn-req-imm');
            const btnReqSch = document.getElementById('btn-req-sch');
            if (btnReqImm) btnReqImm.classList.remove('selected');
            if (btnReqSch) btnReqSch.classList.remove('selected');
            const reqScheduleContainer = document.getElementById('request-schedule-container');
            if (reqScheduleContainer) reqScheduleContainer.style.display = 'none';
            isImmediateRequest = null;
            
            const btnMaintImm = document.getElementById('btn-maint-imm');
            const btnMaintSch = document.getElementById('btn-maint-sch');
            if (btnMaintImm) btnMaintImm.classList.remove('selected');
            if (btnMaintSch) btnMaintSch.classList.remove('selected');
            const maintScheduleContainer = document.getElementById('maint-schedule-container');
            if (maintScheduleContainer) maintScheduleContainer.style.display = 'none';
            isImmediateMaint = null;
            
            // مسح أزرار التنظيف أيضاً
            const optOut = document.getElementById('opt_out');
            const optStay = document.getElementById('opt_stay');
            const optDnd = document.getElementById('opt_dnd');
            if (optOut) optOut.classList.remove('selected');
            if (optStay) optStay.classList.remove('selected');
            if (optDnd) optDnd.classList.remove('selected');
            const stayOptions = document.getElementById('stayOptionsCleaning');
            if (stayOptions) stayOptions.style.display = 'none';
            const systemTimeInput = document.getElementById('systemTimeInput');
            if (systemTimeInput) systemTimeInput.value = '12:00';
        }
        
        function setMinDateTime() {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            
            // تعيين اليوم كحد أدنى
            const dateInputs = ['systemDateInput', 'systemDateInputReq', 'systemDateInputMaint'];
            dateInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.min = today;
                    el.value = today;
                    
                    // عند تغيير التاريخ، نتحقق من الوقت
                    el.addEventListener('change', function() {
                        const selectedDate = this.value;
                        const timeInputId = id.replace('Date', 'Time');
                        const timeInput = document.getElementById(timeInputId);
                        
                        if (selectedDate === today && timeInput) {
                            timeInput.min = currentTime;
                            // إذا كان الوقت المحدد أقل من الوقت الحالي، نعيّنه للوقت الحالي
                            if (timeInput.value < currentTime) {
                                timeInput.value = currentTime;
                            }
                        } else if (timeInput) {
                            timeInput.min = '00:00';
                        }
                    });
                }
            });
            
            // تعيين الوقت الحالي
            const timeInputs = ['systemTimeInput', 'systemTimeInputReq', 'systemTimeInputMaint'];
            timeInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.min = currentTime;
                    el.value = currentTime;
                }
            });
        }
        
        function showLogClearModal() { 
            pendingAction = 'clearLog'; 
            document.getElementById('admin-password').value = ''; 
            document.getElementById('password-modal').style.display = 'flex'; 
        }
        
        function showNewShiftModal() { 
            pendingAction = 'newShift'; 
            document.getElementById('admin-password').value = ''; 
            document.getElementById('password-modal').style.display = 'flex'; 
        }
        
// تم حذف وظائف الأرشيف - تم نقلها إلى نظام التقارير

  
        function loadMoreLog() {
            appState.logViewLimit += appState.logStep;
            renderLogSection();
        }
        
        function switchAddMode(mode) { 
            currentAddMode = mode; 
            hapticFeedback('medium');
            
            // إخفاء كل الخيارات
            ['cleaning', 'request', 'maintenance'].forEach(m => { 
                const el = document.getElementById(`${m}-options`);
                if (el) el.style.display = 'none'; 
            }); 
            
            // إزالة active من كل الأزرار
            document.querySelectorAll('.add-mode-tab').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // إضافة active للزر المختار
            const tabBtn = document.getElementById(`tab-${mode}`);
            if (tabBtn) tabBtn.classList.add('active');
            
            // إظهار الخيارات المناسبة
            const optionsEl = document.getElementById(`${mode}-options`);
            if (optionsEl) optionsEl.style.display = 'block'; 
            
            // تحديث العنوان
            const titleEl = document.getElementById('modal-title-add');
            if (titleEl) {
                const titles = {
                    cleaning: t('addNewRoom'),
                    request: appState.language === 'ar' ? 'إضافة طلب نزيل' : 'Add Guest Request',
                    maintenance: appState.language === 'ar' ? 'تسجيل صيانة' : 'Register Maintenance'
                };
                titleEl.innerText = titles[mode] || titles.cleaning; 
            }
            
            checkDuplicate();
        }
        
        function setRequestMode(mode) { 
            isImmediateRequest = (mode === 'immediate'); 
            hapticFeedback('medium');
            
            const btnImm = document.getElementById('btn-req-imm');
            const btnSch = document.getElementById('btn-req-sch');
            const scheduleContainer = document.getElementById('request-schedule-container');
            
            // إزالة selected من كل الأزرار
            if (btnImm) btnImm.classList.remove('selected');
            if (btnSch) btnSch.classList.remove('selected');
            
            // إضافة selected للزر المختار
            if (isImmediateRequest) {
                if (btnImm) btnImm.classList.add('selected');
            } else {
                if (btnSch) btnSch.classList.add('selected');
            }
            
            if (scheduleContainer) {
                scheduleContainer.style.display = isImmediateRequest ? 'none' : 'block';
            }
        }
        
        function setMaintMode(mode) { 
            isImmediateMaint = (mode === 'immediate'); 
            hapticFeedback('medium');
            
            const btnImm = document.getElementById('btn-maint-imm');
            const btnSch = document.getElementById('btn-maint-sch');
            const scheduleContainer = document.getElementById('maint-schedule-container');
            
            // إزالة selected من كل الأزرار
            if (btnImm) btnImm.classList.remove('selected');
            if (btnSch) btnSch.classList.remove('selected');
            
            // إضافة selected للزر المختار
            if (isImmediateMaint) {
                if (btnImm) btnImm.classList.add('selected');
            } else {
                if (btnSch) btnSch.classList.add('selected');
            }
            
            if (scheduleContainer) {
                scheduleContainer.style.display = isImmediateMaint ? 'none' : 'block';
            }
        }
        
        function setRoomType(type) { 
            document.getElementById('inpRoomType').value = type; 
            hapticFeedback('medium');
            
            // إزالة selected من كل الأزرار
            document.querySelectorAll('#opt_out, #opt_stay, #opt_dnd').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // إضافة selected للزر المختار
            if (type === 'out') {
                document.getElementById('opt_out').classList.add('selected');
            } else if (type === 'stay') {
                document.getElementById('opt_stay').classList.add('selected');
                // تعيين حالة النزيل الافتراضية إلى "خارج"
                setTimeout(() => setGuestStatus('out'), 100);
            } else if (type === 'dnd') {
                document.getElementById('opt_dnd').classList.add('selected');
            }
            
            // إخفاء خيارات الساكن إذا كان DND أو خروج
            document.getElementById('stayOptionsCleaning').style.display = (type === 'out' || type === 'dnd') ? 'none' : 'block';
            
            // إظهار رسالة للDND
            if (type === 'dnd') {
                showMiniAlert('🚫 وضع عدم الإزعاج: لن يتم فتح هذه الغرفة', 'info');
            }
        }
        
        function setGuestStatus(status) { 
            document.getElementById('inpGuestStatus').value = status; 
            hapticFeedback('medium');
            
            // تحديث المظهر - فقط أزرار داخل/خارج
            const toggleContainer = document.querySelector('.in-out-toggle');
            if (toggleContainer) {
                toggleContainer.querySelectorAll('.io-btn').forEach(btn => {
                    btn.classList.remove('active', 'selected');
                });
                
                if (status === 'in') {
                    document.getElementById('gst_clean_in').classList.add('active', 'selected');
                } else {
                    document.getElementById('gst_clean_out').classList.add('active', 'selected');
                }
            }
        }
        
        function setRoomStatus(status) { 
            document.getElementById('modal-notes').value = status; 
            
            // إزالة التحديد من كلا الزرين
            document.getElementById('st_ready').classList.remove('selected');
            document.getElementById('st_maint').classList.remove('selected');
            
            // تحديد الزر المناسب
            if (status === 'جاهزة') {
                document.getElementById('st_ready').classList.add('selected');
            } else {
                document.getElementById('st_maint').classList.add('selected');
            }
            
            document.getElementById('maintenance-fields').style.display = status === 'جاهزة' ? 'none' : 'block'; 
        }
        
        function promptAction(id, type) { 
            // البحث في appState.rooms أولاً
            let room = appState.rooms.find(r => r.id === id);
            
            // إذا لم تجد في appState.rooms، ابحث في طلبات النظافة من QR
            if (!room) {
                const cleaningReq = appState.guestRequests.find(r => 
                    r.id === id && 
                    r.requestType === 'cleaning' && 
                    r.roomTracking === true && 
                    r.fromGuest === true
                );
                
                if (cleaningReq) {
                    room = {
                        id: cleaningReq.id,
                        num: cleaningReq.num,
                        type: 'stay',
                        status: 'acknowledging',
                        startTime: cleaningReq.startTime || Date.now(),
                        deadline: (cleaningReq.startTime || Date.now()) + (HOTEL_CONFIG.times.STAY_NORM || 25 * 60000),
                        guestStatus: 'in',
                        isSuperTurbo: false,
                        fromQR: true,
                        originalRequestId: cleaningReq.id
                    };
                }
            }
            
            if (!room) {
                console.error('Room not found:', id);
                return;
            }
            
            let message = '';
            let title = '';
            let buttonText = '';
            
            if (type === 'arrival') {
                title = 'الوصول للغرفة';
                message = `🏃 *الوصول للغرفة*\n\n🔢 الغرفة: ${room.num}\n\nهل وصلت للغرفة وجاهز لبدء التنظيف؟`;
                buttonText = 'نعم، وصلت ✅';
            } else if (type === 'clean') {
                title = 'بدء الفحص';
                message = `🔍 *فحص الغرفة*\n\n🔢 الغرفة: ${room.num}\n\nهل انتهيت من التنظيف وجاهز لبدء الفحص؟`;
                buttonText = 'نعم، انتهيت ✅';
            }
            
            const confirmTitle = document.getElementById('confirm-title');
            const confirmMessage = document.getElementById('confirm-message');
            const confirmBtn = document.getElementById('confirm-yes-btn');
            const confirmModal = document.getElementById('action-confirm-modal');
            
            if (!confirmTitle || !confirmMessage || !confirmBtn || !confirmModal) {
                console.error('Confirm modal elements not found');
                return;
            }
            
            confirmTitle.innerText = title;
            confirmMessage.innerHTML = message.replace(/\n/g, '<br>');
            confirmBtn.innerText = buttonText;
            
            // إزالة أي معالجات سابقة وإضافة معالج جديد
            const newBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
            
            // استخدام addEventListener بدلاً من onclick لضمان الاستجابة
            newBtn.addEventListener('click', async function handler(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // إزالة المعالج بعد الاستخدام لمنع التكرار
                newBtn.removeEventListener('click', handler);
                
                // إغلاق النافذة فوراً
                const confirmModalEl = document.getElementById('action-confirm-modal');
                if (confirmModalEl) {
                    confirmModalEl.style.display = 'none';
                }
                closeModal('action-confirm-modal');
                
                // تنفيذ العملية بعد تأخير قصير لضمان إغلاق النافذة
                setTimeout(async () => {
                    await executePhase(id, type);
                }, 100);
            }, { once: true });
            
            // إضافة معالج لزر الرجوع
            const backBtn = document.getElementById('confirm-back-btn');
            if (backBtn) {
                // إزالة أي معالجات سابقة
                const newBackBtn = backBtn.cloneNode(true);
                backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                
                newBackBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal('action-confirm-modal');
                }, { once: false });
            }
            
            // إظهار النافذة فوراً
            confirmModal.style.display = 'flex';
            confirmModal.style.zIndex = '10000';
            
            // التأكد من ظهور النافذة
            requestAnimationFrame(() => {
                confirmModal.style.display = 'flex';
                confirmModal.style.zIndex = '10000';
            });
        }

        // ===============================================
        // == نظام التحقق الذكي للغرف ====================
        // ===============================================
        
        // Smart Search V3 - بحث في 5 طبقات
        function handleRoomSearch(value) {
            appState.searchText = value;
            
            // إخفاء رسائل التحقق إذا كان الحقل فارغاً
            if (!value || value.trim() === '') {
                hideRoomCheckMessages();
                smartUpdate();
                return;
            }
            
            const searchTerm = value.trim().toLowerCase();
            
            // طبقة 1: الغرف النشطة
            const activeMatch = appState.rooms.find(r => 
                String(r.num).toLowerCase().includes(searchTerm) && r.status !== 'scheduled'
            );
            
            // طبقة 2: الطلبات النشطة
            const requestMatch = appState.guestRequests.find(r => 
                String(r.num).toLowerCase().includes(searchTerm) && r.status !== 'scheduled'
            );
            
            // طبقة 3: الصيانة النشطة
            const maintMatch = appState.activeMaintenance.find(m => 
                String(m.num).toLowerCase().includes(searchTerm) && m.status !== 'scheduled'
            );
            
            // طبقة 4: سجل الأمس (آخر 24 ساعة)
            const yesterday = Date.now() - (24 * 60 * 60 * 1000);
            const logMatch = appState.log
                .filter(l => l.finishTime > yesterday)
                .find(l => String(l.num).toLowerCase().includes(searchTerm));
            
            // طبقة 5: الأرشيف (طلبات وصيانة مكتملة)
            const archiveReqMatch = appState.guestRequestsLog
                .find(r => String(r.num).toLowerCase().includes(searchTerm));
            const archiveMaintMatch = appState.completedMaintenanceLog
                .find(m => String(m.num).toLowerCase().includes(searchTerm));
            
            // التحقق الذكي من الغرفة (للرسائل)
            const roomNum = searchTerm;
            const checkResult = checkRoomStatus(roomNum);
            
            // عرض رسائل التحقق
            showRoomCheckMessages(checkResult);
            
            // التحديث العادي (سيقوم smartUpdate بالتصفية)
            smartUpdate();
        }
        
        // دالة التحقق من حالة الغرفة
        function checkRoomStatus(roomNum) {
            const result = {
                num: roomNum,
                isActive: false,
                isCleanedBefore: false,
                hasActiveRequest: false,
                hasCompletedRequest: false,
                lastCleaningDate: null,
                lastRequest: null,
                message: '',
                type: 'info' // error, warning, info, success
            };
            
            // التحقق من الغرف النشطة
            const activeRoom = appState.rooms.find(room => 
                room.num === roomNum && room.status !== 'scheduled'
            );
            
            if (activeRoom) {
                result.isActive = true;
                result.message = `❌ الغرفة ${roomNum} مضافة بالفعل الآن ولا يمكن تكرارها.`;
                result.type = 'error';
                return result;
            }
            
            // التحقق من السجل (تم تنظيفها سابقاً)
            const cleaningLog = appState.log
                .filter(item => item.num === roomNum)
                .sort((a, b) => b.id - a.id)[0];
            
            if (cleaningLog) {
                result.isCleanedBefore = true;
                result.lastCleaningDate = new Date(cleaningLog.id);
            }
            
            // التحقق من الطلبات النشطة
            const activeRequest = appState.guestRequests
                .filter(req => req.num === roomNum && req.status !== 'scheduled')
                .sort((a, b) => b.startTime - a.startTime)[0];
            
            if (activeRequest) {
                result.hasActiveRequest = true;
                result.lastRequest = activeRequest;
            }
            
            // التحقق من الطلبات المكتملة
            const completedRequest = appState.guestRequestsLog
                ? appState.guestRequestsLog
                    .filter(req => req.num === roomNum)
                    .sort((a, b) => b.id - a.id)[0]
                : null;
            
            if (completedRequest && !result.hasActiveRequest) {
                result.hasCompletedRequest = true;
                result.lastRequest = completedRequest;
            }
            
            // بناء الرسالة المناسبة
            if (result.hasActiveRequest) {
                const time = new Date(result.lastRequest.startTime);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = result.lastRequest.details || 'طلب';
                if (details.length > 20) {
                    details = details.substring(0, 20) + '...';
                }
                
                result.message = `🔴 آخر طلب: ${details} – ${timeStr}`;
                result.type = 'warning';
                
            } else if (result.hasCompletedRequest) {
                const time = new Date(result.lastRequest.finishTime || result.lastRequest.id);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = result.lastRequest.details || 'طلب';
                if (details.length > 20) {
                    details = details.substring(0, 20) + '...';
                }
                
                result.message = `🛎️ آخر طلب: ${details} – ${timeStr} (تم إغلاقه)`;
                result.type = 'info';
                
            } else if (result.isCleanedBefore) {
                const dateStr = result.lastCleaningDate.toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                result.message = `🧹 تم تنظيف هذه الغرفة بتاريخ: ${dateStr}`;
                result.type = 'success';
                
            } else {
                result.message = `✅ الغرفة ${roomNum} جاهزة للإضافة.`;
                result.type = 'info';
            }
            
            return result;
        }
        
        // دالة لعرض رسائل التحقق
        function showRoomCheckMessages(checkResult) {
            const messagesDiv = document.getElementById('room-check-messages');
            const contentDiv = document.getElementById('room-check-content');
            
            if (!messagesDiv || !contentDiv) return;
            
            // تنظيف المحتوى القديم
            contentDiv.innerHTML = '';
            contentDiv.className = '';
            
            // إضافة محتوى جديد
            const messageDiv = document.createElement('div');
            messageDiv.className = `room-check-${checkResult.type}`;
            messageDiv.innerHTML = checkResult.message;
            
            // إضافة تأثير النبض للطلب النشط
            if (checkResult.hasActiveRequest) {
                messageDiv.classList.add('room-check-pulse');
            }
            
            contentDiv.appendChild(messageDiv);
            
            // إضافة زر الإغلاق
            const closeBtn = document.createElement('button');
            closeBtn.className = 'room-check-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = hideRoomCheckMessages;
            contentDiv.appendChild(closeBtn);
            
            // عرض الرسائل
            messagesDiv.style.display = 'block';
        }
        
        // دالة لإخفاء رسائل التحقق
        function hideRoomCheckMessages() {
            const messagesDiv = document.getElementById('room-check-messages');
            if (messagesDiv) {
                messagesDiv.style.display = 'none';
            }
        }
        
        // إخفاء الرسائل عند النقر خارجها
        document.addEventListener('click', function(event) {
            const searchContainer = document.querySelector('.search-container');
            const messagesDiv = document.getElementById('room-check-messages');
            
            if (searchContainer && messagesDiv && 
                !searchContainer.contains(event.target) && 
                event.target.id !== 'search-bar') {
                hideRoomCheckMessages();
            }
        });

        // ===============================================
        // == كروت الإحصائيات الجديدة ====================
        // ===============================================
        
        // دالة لتحديث كروت الإحصائيات الجديدة
        function updateNewStats() {
            // تحديث الكروت الأساسية
            document.getElementById('stat-out-done').innerText = appState.log.filter(item => item.type === 'out').length;
            document.getElementById('stat-stay-done').innerText = appState.log.filter(item => item.type === 'stay').length;
            
            // الطلبات المنتهية والنشطة
            const reqDone = appState.guestRequestsLog ? appState.guestRequestsLog.length : 0;
            const reqActive = appState.guestRequests.filter(req => req.status !== 'scheduled' && req.status !== 'completed').length;
            document.getElementById('stat-req-done').innerText = reqDone;
            document.getElementById('stat-req-active').innerText = reqActive;
            
            // الصيانة المنتهية والنشطة
            const maintDone = appState.completedMaintenanceLog ? appState.completedMaintenanceLog.length : 0;
            const maintActive = appState.activeMaintenance.filter(maint => maint.status !== 'scheduled' && maint.status !== 'completed').length;
            document.getElementById('stat-maint-done').innerText = maintDone;
            document.getElementById('stat-maint-active').innerText = maintActive;
            
            // تحديث آخر طلب
            updateLastRequest();
            
            // تحديث آخر صيانة
            updateLastMaintenance();
            
            // تحديث الإحصائيات النشطة
            const activeCount = appState.rooms.filter(room => room.status !== 'scheduled').length;
            const lateCount = appState.rooms.filter(room => room.status === 'overdue').length;
            const totalRooms = appState.rooms.length || 1;
            
            document.getElementById('stat-active').innerText = activeCount;
            document.getElementById('stat-late').innerText = lateCount;
            
            // تحديث دوائر Progress
            updateProgressCircle('progress-active', activeCount, totalRooms);
            updateProgressCircle('progress-late', lateCount, totalRooms);
            
            // تحديث نصيحة اليوم
            updateDailyTip();
        }
        
        // دالة لتحديث نصيحة اليوم
        function updateDailyTip() {
            const tipElement = document.getElementById('daily-tip-text');
            if (!tipElement) return;
            
            const today = new Date();
            const todayKey = today.toDateString();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = yesterday.toDateString();
            
            // حساب الإحصائيات
            const todayOutDone = appState.log.filter(l => {
                const logDate = new Date(l.finishTime || l.id).toDateString();
                return logDate === todayKey && l.type === 'out';
            }).length;
            
            const todayStayDone = appState.log.filter(l => {
                const logDate = new Date(l.finishTime || l.id).toDateString();
                return logDate === todayKey && l.type === 'stay';
            }).length;
            
            const yesterdayOutDone = appState.log.filter(l => {
                const logDate = new Date(l.finishTime || l.id).toDateString();
                return logDate === yesterdayKey && l.type === 'out';
            }).length;
            
            const yesterdayStayDone = appState.log.filter(l => {
                const logDate = new Date(l.finishTime || l.id).toDateString();
                return logDate === yesterdayKey && l.type === 'stay';
            }).length;
            
            const todayRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const yesterdayRequests = (appState.guestRequestsLog || []).filter(r => {
                const reqDate = new Date(r.finishTime || r.id).toDateString();
                return reqDate === yesterdayKey;
            }).length;
            
            const todayMaint = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            const yesterdayMaint = (appState.completedMaintenanceLog || []).filter(m => {
                const maintDate = new Date(m.finishTime || m.id).toDateString();
                return maintDate === yesterdayKey;
            }).length;
            
            // إنشاء النصيحة
            let tip = '';
            if (todayStayDone < yesterdayStayDone) {
                tip = t('tipCleaningLessStayover');
            } else if (todayOutDone > yesterdayOutDone) {
                tip = t('tipCleaningMoreCheckout');
            } else if (todayRequests > yesterdayRequests * 1.2) {
                tip = t('tipMoreRequests');
            } else if (todayMaint > yesterdayMaint * 1.2) {
                tip = t('tipMoreMaintenance');
            } else if (todayOutDone + todayStayDone < (yesterdayOutDone + yesterdayStayDone) * 0.8) {
                tip = t('tipLessProductivity');
                } else {
                tip = t('tipGoodPerformance');
            }
            
            tipElement.textContent = tip;
        }
        
        function updateProgressCircle(circleId, value, max) {
            const circle = document.getElementById(circleId);
            if (!circle) return;
            
            const circumference = 2 * Math.PI * 55; // r = 55 (تم تحديثه)
            const percentage = max > 0 ? (value / max) : 0;
            const offset = circumference - (percentage * circumference);
            
            circle.style.strokeDashoffset = offset;
        }
        
        // دالة للانتقال التلقائي للقسم عند الضغط على كارت الإحصائيات
        function scrollToSection(sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                hapticFeedback('light');
            }
        }
        
        // دالة لتحديث آخر طلب
        function updateLastRequest() {
            const lastRequestCard = document.getElementById('stat-last-request-card');
            const lastRequestValue = document.getElementById('stat-last-request');
            
            // البحث عن آخر طلب نشط
            const activeRequests = appState.guestRequests
                .filter(req => req.status !== 'scheduled')
                .sort((a, b) => b.startTime - a.startTime);
            
            if (activeRequests.length > 0) {
                const lastRequest = activeRequests[0];
                const time = new Date(lastRequest.startTime);
                const timeStr = time.toLocaleTimeString(appState.language === 'ar' ? 'ar-EG' : appState.language === 'en' ? 'en-US' : appState.language === 'hi' ? 'hi-IN' : appState.language === 'ur' ? 'ur-PK' : 'bn-BD', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = lastRequest.details || t('request');
                if (details.length > 8) {
                    details = details.substring(0, 8) + '...';
                }
                
                lastRequestValue.innerText = `${lastRequest.num} - ${details} - ${timeStr}`;
                
                // إضافة تأثير النبض للطلب النشط
                lastRequestCard.classList.add('pulse-active');
            } else {
                // البحث في سجل الطلبات المكتملة
                const completedRequests = appState.guestRequestsLog || [];
                if (completedRequests.length > 0) {
                    const lastCompleted = completedRequests.sort((a, b) => b.id - a.id)[0];
                    const time = new Date(lastCompleted.finishTime || lastCompleted.id);
                    const timeStr = time.toLocaleTimeString(appState.language === 'ar' ? 'ar-EG' : appState.language === 'en' ? 'en-US' : appState.language === 'hi' ? 'hi-IN' : appState.language === 'ur' ? 'ur-PK' : 'bn-BD', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let details = lastCompleted.details || t('request');
                    if (details.length > 8) {
                        details = details.substring(0, 8) + '...';
                    }
                    
                    lastRequestValue.innerText = `${lastCompleted.num || '--'} - ${details} - ${timeStr}`;
                } else {
                    lastRequestValue.innerText = '--';
                }
                
                // إزالة تأثير النبض
                lastRequestCard.classList.remove('pulse-active');
            }
        }
        
        // دالة لتحديث آخر صيانة
        function updateLastMaintenance() {
            const lastMaintCard = document.getElementById('stat-last-maint-card');
            const lastMaintValue = document.getElementById('stat-last-maint');
            
            // البحث عن آخر صيانة نشطة
            const activeMaintenance = appState.activeMaintenance
                .filter(maint => maint.status !== 'scheduled' && maint.status !== 'completed')
                .sort((a, b) => b.startTime - a.startTime);
            
            if (activeMaintenance.length > 0) {
                const lastMaint = activeMaintenance[0];
                const time = new Date(lastMaint.startTime);
                const timeStr = time.toLocaleTimeString(appState.language === 'ar' ? 'ar-EG' : appState.language === 'en' ? 'en-US' : appState.language === 'hi' ? 'hi-IN' : appState.language === 'ur' ? 'ur-PK' : 'bn-BD', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = lastMaint.maintDesc || t('maintenance');
                if (details.length > 8) {
                    details = details.substring(0, 8) + '...';
                }
                
                lastMaintValue.innerText = `${lastMaint.num} - ${details} - ${timeStr}`;
                
                // إضافة تأثير النبض للصيانة النشطة
                lastMaintCard.classList.add('pulse-active');
            } else {
                // البحث في سجل الصيانة المكتملة
                const completedMaintenance = appState.completedMaintenanceLog || [];
                if (completedMaintenance.length > 0) {
                    const lastCompleted = completedMaintenance.sort((a, b) => b.id - a.id)[0];
                    const time = new Date(lastCompleted.finishTime || lastCompleted.id);
                    const timeStr = time.toLocaleTimeString(appState.language === 'ar' ? 'ar-EG' : appState.language === 'en' ? 'en-US' : appState.language === 'hi' ? 'hi-IN' : appState.language === 'ur' ? 'ur-PK' : 'bn-BD', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let details = lastCompleted.maintDesc || t('maintenance');
                    if (details.length > 8) {
                        details = details.substring(0, 8) + '...';
                    }
                    
                    lastMaintValue.innerText = `${lastCompleted.num || '--'} - ${details} - ${timeStr}`;
                } else {
                    lastMaintValue.innerText = '--';
                }
                
                // إزالة تأثير النبض
                lastMaintCard.classList.remove('pulse-active');
            }
        }

        // ===============================================
        // == التحديث الذكي للواجهة ======================
        // ===============================================
        
        // ===============================================
        // == التحديث الذكي المحسّن ======================
        // ===============================================
        
        // خريطة لتتبع العناصر المعروضة في DOM
        const renderedItems = {
            rooms: new Map(), // roomId -> DOM element
            requests: new Map(), // requestId -> DOM element
            maintenance: new Map() // maintId -> DOM element
        };
        
        function smartUpdate(forceFullRender = false) { 
            updateTimersDOM(); 
            updateNewStats();
            
            if (forceFullRender) {
                // إعادة رسم كاملة عند الحاجة
            renderRoomCards(); 
            renderGuestRequests();
            renderMaintenanceCards();
            } else {
                // تحديث جزئي ذكي
                updateRoomCardsPartial();
                updateGuestRequestsPartial();
                updateMaintenanceCardsPartial();
                renderCleaningRequestsInRoomTracking(); // تحديث طلبات النظافة في تتبع الغرف
            }
        }
        
        // تحديث جزئي للغرف - يرندر فقط العناصر المتأثرة
        function updateRoomCardsPartial() {
            const filterItems = (items) => items.filter(item => 
                String(item.num).includes(appState.searchText)
            );
            
            // فصل غرف DND
            let dndRooms = filterItems(appState.rooms.filter(room => room.type === 'dnd'));
            let activeRooms = filterItems(appState.rooms.filter(room => room.status !== 'scheduled' && room.type !== 'dnd')); 
            let scheduledRooms = filterItems(appState.rooms.filter(room => room.status === 'scheduled' && room.type !== 'dnd')); 
            
            // ترتيب
            activeRooms.sort((a, b) => { 
                if (a.startTime !== b.startTime) return a.startTime - b.startTime;
                const statusOrder = { 'overdue': 0, 'acknowledging': 1, 'cleaning': 2, 'checking': 3 }; 
                if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]; 
                return (a.deadline - Date.now()) - (b.deadline - Date.now()); 
            });
            scheduledRooms.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
            
            const roomsContainer = document.getElementById('rooms-container');
            if (!roomsContainer) return;
            
            // تحديث الغرف النشطة
            const existingRoomIds = new Set(Array.from(roomsContainer.querySelectorAll('[data-room-id]')).map(el => el.getAttribute('data-room-id')));
            const currentRoomIds = new Set(activeRooms.map(r => r.id));
            
            // إزالة الغرف المحذوفة
            existingRoomIds.forEach(roomId => {
                if (!currentRoomIds.has(roomId)) {
                    const roomEl = roomsContainer.querySelector(`[data-room-id="${roomId}"]`);
                    if (roomEl) {
                        roomEl.style.opacity = '0';
                        roomEl.style.transform = 'translateX(-20px)';
                        setTimeout(() => roomEl.remove(), 300);
                    }
                }
            });
            
            // إضافة/تحديث الغرف الموجودة
            activeRooms.forEach(room => {
                const existingEl = roomsContainer.querySelector(`[data-room-id="${room.id}"]`);
                if (existingEl) {
                    // عند تغيير الحالة، إعادة رسم الكارد بالكامل لضمان التحديث الصحيح
                    const oldStatus = existingEl.getAttribute('data-status');
                    if (oldStatus !== room.status) {
                        // إعادة رسم الكارد بالكامل عند تغيير الحالة
                        const newCard = createRoomCard(room);
                        existingEl.outerHTML = newCard;
                    } else {
                        // تحديث العنصر الموجود فقط إذا لم تتغير الحالة
                        updateSingleRoomCard(room, existingEl);
                    }
                } else {
                    // إضافة غرفة جديدة
                    const newCard = createRoomCard(room);
                    roomsContainer.insertAdjacentHTML('beforeend', newCard);
                }
            });
            
            // تحديث رسالة "لا توجد غرف"
            if (activeRooms.length === 0 && roomsContainer.innerHTML.trim() === '') {
                roomsContainer.innerHTML = `<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">${t('noActiveRooms')}</p>`;
            } else if (activeRooms.length > 0) {
                const noRoomsMsg = roomsContainer.querySelector('p');
                if (noRoomsMsg) noRoomsMsg.remove();
            }
            
            // تحديث DND
            const dndContainer = document.getElementById('dnd-rooms-container');
            if (dndRooms.length > 0) {
                const dndNumbers = dndRooms.map(r => r.num).join(' - ');
                if (dndContainer) {
                    dndContainer.style.display = 'block';
                    dndContainer.innerHTML = `
                        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; background:linear-gradient(145deg, rgba(100,116,139,0.06), rgba(148,163,184,0.08)); border:1px solid rgba(100,116,139,0.15); border-radius:12px; padding:10px 12px; margin-bottom:10px; font-family:'Tajawal', sans-serif; box-sizing:border-box; width:100%;">
                            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                                <span style="font-size:1rem; flex-shrink:0;">🚫</span>
                                <span style="font-size:0.8rem; color:#64748b; font-weight:600; flex-shrink:0;">${t('dnd')}:</span>
                                <span style="font-size:0.85rem; color:#374151; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dndNumbers}</span>
                            </div>
                            <button onclick="clearDNDRooms()" style="background:linear-gradient(145deg, rgba(239,68,68,0.08), rgba(220,38,38,0.12)); color:#dc2626; border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:5px 10px; font-size:0.75rem; cursor:pointer; font-weight:700; font-family:'Tajawal', sans-serif; white-space:nowrap; flex-shrink:0;">🗑️ ${t('delete')}</button>
                        </div>
                    `;
                }
            } else {
                if (dndContainer) dndContainer.style.display = 'none';
            }
            
            // تحديث المجدولة
            const schedContainer = document.getElementById('scheduled-rooms-container');
            if(scheduledRooms.length) { 
                schedContainer.style.display = 'block'; 
                schedContainer.innerHTML = 
                    `<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 ${t('scheduledRooms')}</div>` + 
                    scheduledRooms.map(room => createRoomCard(room)).join(''); 
            } else { 
                schedContainer.style.display = 'none'; 
            }
        }
        
        // تحديث كارت غرفة واحد فقط
        function updateSingleRoomCard(room, element) {
            if (!element || !room) return;
            
            // تحديث التايمر فقط (الأكثر تكراراً)
            const timerEl = element.querySelector(`#timer-${room.id}`);
            if (timerEl) {
                const timeLeft = room.deadline - Date.now();
                if (timeLeft > 0) {
                    const mins = Math.floor(timeLeft / 60000);
                    const secs = Math.floor((timeLeft % 60000) / 1000);
                    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                    
                    // إضافة تحذير عند التأخير الوشيك (أقل من 5 دقائق)
                    if (timeLeft < 5 * 60 * 1000) {
                        timerEl.style.color = '#ef4444';
                        timerEl.style.fontWeight = '700';
                        timerEl.style.animation = 'pulse-red 1.5s infinite';
                        if (!timerEl.textContent.includes('⚠️')) {
                            timerEl.innerHTML = '⚠️ ' + timerEl.textContent;
                        }
                        // إضافة نبض أحمر للكارد
                        element.classList.add('warning-pulse');
                    } else {
                        timerEl.style.color = '';
                        timerEl.style.fontWeight = '';
                        timerEl.style.animation = '';
                        timerEl.innerHTML = timerEl.textContent.replace('⚠️ ', '');
                        element.classList.remove('warning-pulse');
                    }
                } else {
                    // متأخر - نبض أحمر قوي
                    timerEl.innerHTML = '⚠️ متأخر';
                    timerEl.style.color = '#ef4444';
                    timerEl.style.fontWeight = '700';
                    timerEl.style.animation = 'pulse-red 1s infinite';
                    element.classList.add('warning-pulse', 'overdue-pulse');
                }
            }
            
            // تحديث التنبيهات
            const roomRequests = appState.guestRequests.filter(r => r.num == room.num && r.status !== 'scheduled');
            const roomMaintenance = appState.activeMaintenance.filter(m => m.num == room.num && m.status !== 'scheduled');
            const alertsEl = element.querySelector('.room-alerts');
            if (roomRequests.length > 0 || roomMaintenance.length > 0) {
                let alertsHtml = '';
                if (roomRequests.length > 0) alertsHtml += ' <span style="color:var(--request-color);">🔔</span>';
                if (roomMaintenance.length > 0) alertsHtml += ' <span style="color:var(--maint-color);">🛠️</span>';
                
                // إضافة علامة 📱 إذا كان هناك طلبات من QR
                const hasGuestRequests = roomRequests.some(r => r.fromGuest);
                const hasGuestMaintenance = roomMaintenance.some(m => m.fromGuest);
                if (hasGuestRequests || hasGuestMaintenance) {
                    alertsHtml += ' <span style="color:#10B981; font-size:0.9rem;" title="طلبات من QR">📱</span>';
                }
                
                if (alertsEl) {
                    alertsEl.innerHTML = alertsHtml;
                } else {
                    const detailsEl = element.querySelector('.room-details');
                    if (detailsEl) {
                        detailsEl.insertAdjacentHTML('beforeend', `<div class="room-alerts">${alertsHtml}</div>`);
                    }
                }
            } else if (alertsEl) {
                alertsEl.remove();
            }
            
            // تحديث حالة الكارد (overdue)
            if (room.deadline < Date.now() && room.status !== 'overdue') {
                element.classList.add('overdue');
            } else if (room.deadline >= Date.now()) {
                element.classList.remove('overdue');
            }
        }
        
        // تحديث جزئي للطلبات
        function updateGuestRequestsPartial() {
            // في حالة الطلبات، نستخدم renderGuestRequests العادي لأنها أقل عدداً
            renderGuestRequests();
        }
        
        // تحديث جزئي للصيانة
        function updateMaintenanceCardsPartial() {
            // في حالة الصيانة، نستخدم renderMaintenanceCards العادي لأنها أقل عدداً
            renderMaintenanceCards();
        }
        
        // دالة renderRoomCards الأصلية (للحالات التي تحتاج إعادة رسم كاملة)
        function renderRoomCards() {
            const filterItems = (items) => items.filter(item => 
                String(item.num).includes(appState.searchText)
            );
            
            // فصل غرف DND
            let dndRooms = filterItems(appState.rooms.filter(room => room.type === 'dnd'));
            let activeRooms = filterItems(appState.rooms.filter(room => room.status !== 'scheduled' && room.type !== 'dnd')); 
            
            // ترتيب حسب أول عملية "Arrive at Room" - الغرف التي تم الضغط عليها أولاً تظهر أولاً
            activeRooms.sort((a, b) => { 
                // أولاً: حسب وقت بدء العملية (startTime)
                if (a.startTime !== b.startTime) {
                    return a.startTime - b.startTime; // الأقدم أولاً
                }
                // ثانياً: حسب الحالة
                const statusOrder = { 'overdue': 0, 'acknowledging': 1, 'cleaning': 2, 'checking': 3 }; 
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status]; 
                }
                // ثالثاً: حسب الموعد النهائي
                return (a.deadline - Date.now()) - (b.deadline - Date.now()); 
            });
            
            let scheduledRooms = filterItems(appState.rooms.filter(room => room.status === 'scheduled' && room.type !== 'dnd')); 
            scheduledRooms.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
            
            document.getElementById('rooms-container').innerHTML = activeRooms.length ? 
                activeRooms.map(room => createRoomCard(room)).join('') : 
                `<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">${t('noActiveRooms')}</p>`;
            
            // ============ عرض غرف DND في سطر رفيع ============
            const dndContainer = document.getElementById('dnd-rooms-container');
            if (dndRooms.length > 0) {
                const dndNumbers = dndRooms.map(r => r.num).join(' - ');
                if (dndContainer) {
                    dndContainer.style.display = 'block';
                    dndContainer.innerHTML = `
                        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; background:linear-gradient(145deg, rgba(100,116,139,0.06), rgba(148,163,184,0.08)); border:1px solid rgba(100,116,139,0.15); border-radius:12px; padding:10px 12px; margin-bottom:10px; font-family:'Tajawal', sans-serif; box-sizing:border-box; width:100%;">
                            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                                <span style="font-size:1rem; flex-shrink:0;">🚫</span>
                                <span style="font-size:0.8rem; color:#64748b; font-weight:600; flex-shrink:0;">${t('dnd')}:</span>
                                <span style="font-size:0.85rem; color:#374151; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dndNumbers}</span>
                            </div>
                            <button onclick="clearDNDRooms()" style="background:linear-gradient(145deg, rgba(239,68,68,0.08), rgba(220,38,38,0.12)); color:#dc2626; border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:5px 10px; font-size:0.75rem; cursor:pointer; font-weight:700; font-family:'Tajawal', sans-serif; white-space:nowrap; flex-shrink:0;">🗑️ ${t('delete')}</button>
                        </div>
                    `;
                }
            } else {
                if (dndContainer) dndContainer.style.display = 'none';
            }
            
            const schedContainer = document.getElementById('scheduled-rooms-container');
            if(scheduledRooms.length) { 
                schedContainer.style.display = 'block'; 
                schedContainer.innerHTML = 
                    `<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 ${t('scheduledRooms')}</div>` + 
                    scheduledRooms.map(room => createRoomCard(room)).join(''); 
            } else { 
                schedContainer.style.display = 'none'; 
            }
            
            // عرض طلبات النظافة في قسم تتبع الغرف
            renderCleaningRequestsInRoomTracking();
        }
        
        // عرض طلبات النظافة في قسم تتبع الغرف
        function renderCleaningRequestsInRoomTracking() {
            const cleaningContainer = document.getElementById('cleaning-requests-container');
            if (!cleaningContainer) return;
            
            // فلترة طلبات النظافة
            const activeCleaningReqs = appState.guestRequests.filter(r => 
                r.status !== 'scheduled' && 
                r.status !== 'completed' && 
                r.requestType === 'cleaning' && 
                r.roomTracking === true &&
                String(r.num).includes(appState.searchText)
            );
            
            const scheduledCleaningReqs = appState.guestRequests.filter(r => 
                r.status === 'scheduled' && 
                r.requestType === 'cleaning' && 
                r.roomTracking === true &&
                String(r.num).includes(appState.searchText)
            );
            
            if (activeCleaningReqs.length > 0 || scheduledCleaningReqs.length > 0) {
                cleaningContainer.style.display = 'block';
                let html = '';
                
                if (activeCleaningReqs.length > 0) {
                    html += activeCleaningReqs.map(req => createRequestCard(req)).join('');
                }
                
                if (scheduledCleaningReqs.length > 0) {
                    html += `<div style="font-weight: bold; color: var(--sched-color); margin: 15px 0 8px 0; font-size:0.9rem;">📅 طلبات نظافة مجدولة</div>`;
                    html += scheduledCleaningReqs.map(req => createRequestCard(req)).join('');
                }
                
                cleaningContainer.innerHTML = html;
            } else {
                cleaningContainer.style.display = 'none';
            }
        }
        
        function renderRoomCards() {
            const filterItems = (items) => items.filter(item => 
                String(item.num).includes(appState.searchText)
            );
            
            // فصل غرف DND
            let dndRooms = filterItems(appState.rooms.filter(room => room.type === 'dnd'));
            let activeRooms = filterItems(appState.rooms.filter(room => room.status !== 'scheduled' && room.type !== 'dnd')); 
            
            // تحويل طلبات النظافة من QR إلى غرف في قسم تتبع الغرف
            const cleaningRequestsFromQR = appState.guestRequests.filter(r => 
                r.requestType === 'cleaning' && 
                r.roomTracking === true && 
                r.status !== 'scheduled' && 
                r.status !== 'completed' &&
                r.fromGuest === true
            );
            
            // تحويل كل طلب نظافة من QR إلى غرفة
            cleaningRequestsFromQR.forEach(req => {
                // التحقق من عدم وجود غرفة بنفس الرقم والحالة النشطة في activeRooms أولاً
                const existingInActiveRooms = activeRooms.find(r => r.num == req.num && r.status !== 'scheduled');
                
                // التحقق من عدم وجود غرفة بنفس الرقم في appState.rooms
                const existingRoom = appState.rooms.find(r => r.num == req.num && r.status !== 'scheduled');
                
                // إذا كانت موجودة في activeRooms، لا تضيفها مرة أخرى
                if (existingInActiveRooms) {
                    return; // تخطي هذا الطلب
                }
                
                if (!existingRoom) {
                    // إنشاء غرفة من طلب النظافة
                    const roomFromRequest = {
                        id: req.id || `req_${req.num}_${req.startTime}`,
                        num: req.num,
                        type: 'stay', // افتراضي ساكن
                        status: 'acknowledging', // تبدأ بحالة "الوصول للغرفة"
                        startTime: req.startTime || Date.now(),
                        deadline: (req.startTime || Date.now()) + (HOTEL_CONFIG.times.STAY_NORM || 25 * 60000),
                        guestStatus: 'in', // افتراضي داخل
                        isSuperTurbo: false,
                        fromQR: true, // علامة أن الغرفة جاءت من QR
                        originalRequestId: req.id, // حفظ ID الطلب الأصلي
                        historyLogs: [{ 
                            action: 'طلب نظافة من QR', 
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                        }]
                    };
                    
                    // إضافة الغرفة إلى Firebase تلقائياً لتتبع مراحل التنظيف
                    if (db) {
                        db.collection('rooms').doc(req.id).set(roomFromRequest, { merge: true })
                            .catch(err => {
                                console.error('Error adding QR cleaning room to Firebase:', err);
                            });
                    }
                    
                    // إضافة إلى appState.rooms محلياً
                    appState.rooms.push(roomFromRequest);
                    activeRooms.push(roomFromRequest);
                } else {
                    // إذا كانت الغرفة موجودة، أضفها إلى activeRooms إذا لم تكن موجودة
                    if (!activeRooms.find(r => r.id === existingRoom.id)) {
                        activeRooms.push(existingRoom);
                    }
                }
            });
            
            // ترتيب حسب أول عملية "Arrive at Room" - الغرف التي تم الضغط عليها أولاً تظهر أولاً
            activeRooms.sort((a, b) => { 
                // أولاً: حسب وقت بدء العملية (startTime)
                if (a.startTime !== b.startTime) {
                    return a.startTime - b.startTime; // الأقدم أولاً
                }
                // ثانياً: حسب الحالة
                const statusOrder = { 'overdue': 0, 'acknowledging': 1, 'cleaning': 2, 'checking': 3 }; 
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status]; 
                }
                // ثالثاً: حسب الموعد النهائي
                return (a.deadline - Date.now()) - (b.deadline - Date.now()); 
            });
            
            let scheduledRooms = filterItems(appState.rooms.filter(room => room.status === 'scheduled' && room.type !== 'dnd')); 
            
            // إضافة طلبات النظافة المجدولة من QR
            const scheduledCleaningFromQR = appState.guestRequests.filter(r => 
                r.requestType === 'cleaning' && 
                r.roomTracking === true && 
                r.status === 'scheduled' &&
                r.fromGuest === true
            );
            
            scheduledCleaningFromQR.forEach(req => {
                const existingRoom = appState.rooms.find(r => r.num == req.num && r.status === 'scheduled');
                if (!existingRoom) {
                    const roomFromRequest = {
                        id: req.id || `req_${req.num}_${req.schedTimestamp}`,
                        num: req.num,
                        type: 'stay',
                        status: 'scheduled',
                        schedTimestamp: req.schedTimestamp || Date.now(),
                        guestStatus: 'in',
                        isSuperTurbo: false,
                        fromQR: true,
                        originalRequestId: req.id
                    };
                    scheduledRooms.push(roomFromRequest);
                }
            });
            
            scheduledRooms.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
            
            // عرض الغرف (النشطة + من QR)
            const allActiveRooms = activeRooms.length;
            document.getElementById('rooms-container').innerHTML = allActiveRooms > 0 ? 
                activeRooms.map(room => createRoomCard(room)).join('') : 
                `<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">${t('noActiveRooms')}</p>`;
            
            // ============ عرض غرف DND في سطر رفيع ============
            const dndContainer = document.getElementById('dnd-rooms-container');
            if (dndRooms.length > 0) {
                const dndNumbers = dndRooms.map(r => r.num).join(' - ');
                if (dndContainer) {
                    dndContainer.style.display = 'block';
                    dndContainer.innerHTML = `
                        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; background:linear-gradient(145deg, rgba(100,116,139,0.06), rgba(148,163,184,0.08)); border:1px solid rgba(100,116,139,0.15); border-radius:12px; padding:10px 12px; margin-bottom:10px; font-family:'Tajawal', sans-serif; box-sizing:border-box; width:100%;">
                            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                                <span style="font-size:1rem; flex-shrink:0;">🚫</span>
                                <span style="font-size:0.8rem; color:#64748b; font-weight:600; flex-shrink:0;">${t('dnd')}:</span>
                                <span style="font-size:0.85rem; color:#374151; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dndNumbers}</span>
                            </div>
                            <button onclick="clearDNDRooms()" style="background:linear-gradient(145deg, rgba(239,68,68,0.08), rgba(220,38,38,0.12)); color:#dc2626; border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:5px 10px; font-size:0.75rem; cursor:pointer; font-weight:700; font-family:'Tajawal', sans-serif; white-space:nowrap; flex-shrink:0;">🗑️ ${t('delete')}</button>
                        </div>
                    `;
                }
            } else {
                if (dndContainer) dndContainer.style.display = 'none';
            }
            
            const schedContainer = document.getElementById('scheduled-rooms-container');
            if(scheduledRooms.length) { 
                schedContainer.style.display = 'block'; 
                schedContainer.innerHTML = 
                    `<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 ${t('scheduledRooms')}</div>` + 
                    scheduledRooms.map(room => createRoomCard(room)).join(''); 
            } else { 
                schedContainer.style.display = 'none'; 
            }
        }
        
        function createRoomCard(room) {
            const isScheduled = room.status === 'scheduled'; 
            
            // النصوص
            const checkoutText = t('checkoutCard');
            const stayoverInText = t('stayoverIn');
            const stayoverOutText = t('stayoverOut');
            const badgeText = room.type === 'dnd' ? `🚫 ${t('dnd')}` : 
                            (room.type === 'out' ? checkoutText : 
                            (room.guestStatus === 'in' ? stayoverInText : stayoverOutText)); 

            // زر التراجع:
            // تم حذف زر Undo نهائياً 

            // التنبيهات (طلبات/صيانة/نظافة)
            const roomRequests = appState.guestRequests.filter(r => r.num == room.num && r.status !== 'scheduled' && (!r.roomTracking || r.requestType !== 'cleaning'));
            const roomMaintenance = appState.activeMaintenance.filter(m => m.num == room.num && m.status !== 'scheduled');
            const roomCleaning = appState.guestRequests.filter(r => r.num == room.num && r.status !== 'scheduled' && r.requestType === 'cleaning' && r.roomTracking);
            
            let alertsHtml = '';
            if (roomRequests.length > 0) alertsHtml += ' <span style="color:var(--request-color);">🔔</span>';
            if (roomMaintenance.length > 0) alertsHtml += ' <span style="color:var(--maint-color);">🛠️</span>';
            if (roomCleaning.length > 0) alertsHtml += ' <span style="color:#10B981;">🧹</span>';

            // الأزرار
            let actionBtn = '';
            if (room.type === 'dnd') {
                actionBtn = `<span style="color:#94a3b8; font-size:0.8rem;">--</span>`;
            } else if (isScheduled) { 
                actionBtn = `<button class="glass-btn start" onclick="forceStartScheduled('${room.id}', 'room')">${t('startNow')}</button>`; 
            } else if (room.status === 'acknowledging') { 
                actionBtn = `<button class="glass-btn start" onclick="promptAction('${room.id}', 'arrival')">${t('arriveRoom')}</button>`; 
            } else if (room.status === 'cleaning') { 
                actionBtn = `<button class="glass-btn" style="background:var(--warning); color:#333;" onclick="promptAction('${room.id}', 'clean')">${t('startInspection')}</button>`; 
            } else if (room.status === 'checking' || room.status === 'overdue') { 
                actionBtn = `<button class="glass-btn finish" onclick="openFinishModal('${room.id}')">${t('finish')}</button>`; 
            }

            // تحديد كلاس الحالة للألوان
            let statusClass = '';
            if (isScheduled) statusClass = 'status-scheduled';
            else if (room.status === 'cleaning') statusClass = 'status-cleaning';
            else if (room.status === 'overdue') statusClass = 'status-over';
            else if (room.type === 'dnd') statusClass = 'status-dnd';

            // Swipe handlers
            const swipeHandlers = `ontouchstart="handleSwipeStart(event, '${room.id}')" ontouchmove="handleSwipeMove(event, '${room.id}')" ontouchend="handleSwipeEnd(event, '${room.id}')"`;

            // زر التاريخ (يمكن الضغط على رقم الغرفة لفتح التاريخ)
            const historyBtn = `<button class="glass-btn" style="background:rgba(0,188,212,0.1); color:var(--primary); font-size:0.75rem; padding:4px 8px; margin-left:5px;" onclick="showRoomQuickInfo('${room.id}')" title="تاريخ الغرفة">📋</button>`;

            // --- الهيكلية الجديدة (سطر واحد) - RTL: يمين → يسار ---
            return `
            <div class="room-row ${statusClass}" data-room-id="${room.id}" ${swipeHandlers}>
                
                <div class="room-num-circle" onclick="showRoomQuickInfo('${room.id}')" style="cursor:pointer; position: relative;" title="انقر لعرض التاريخ">
                    ${room.num}
                    ${(roomRequests.some(r => r.fromGuest) || roomMaintenance.some(m => m.fromGuest) || roomCleaning.some(r => r.fromGuest)) ? '<span style="position: absolute; top: -3px; left: -3px; width: 16px; height: 16px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.3); border: 1.5px solid rgba(255,255,255,0.9); z-index: 10;" title="طلبات من QR"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 2H7C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V4C19 2.9 18.1 2 17 2ZM17 18H7V6H17V18Z" fill="white"/></svg></span>' : ''}
                </div>

                <div class="room-details">
                    <div class="room-title">${badgeText}${room.isSuperTurbo ? ' 🚀' : ''}</div>
                    <div class="room-timer" id="timer-${room.id}">--</div>
                    ${alertsHtml ? `<div class="room-alerts">${alertsHtml}</div>` : ''}
                </div>

                <div>${actionBtn}${historyBtn}</div>
                
            </div>`;
        }
// ============ Room History Log (سجل تاريخ الغرفة) ============
async function showRoomQuickInfo(id) {
    const room = appState.rooms.find(r => r.id === id);
    if (!room) return;

    hapticFeedback('light');
    
    // جلب تاريخ الغرفة من Firebase
    if (!db) {
        showMiniAlert('⚠️ غير متصل بقاعدة البيانات', 'warning');
        return;
    }
    
    try {
        // البحث في السجلات المحلية أولاً (أسرع)
        const roomNum = room.num;
        const localHistory = [];
        
        // من سجل التنظيف - مع العامل
        const cleaningLogs = appState.log.filter(l => l.num == roomNum).slice(0, 5);
        cleaningLogs.forEach(log => {
            const time = new Date(log.finishTime || log.id);
            localHistory.push({
                type: '🧹 تنظيف',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: log.status || 'مكتمل',
                duration: log.duration || '--',
                worker: log.worker || 'غير محدد',
                image: null
            });
        });
        
        // من سجل الطلبات
        const requestLogs = (appState.guestRequestsLog || []).filter(r => r.num == roomNum).slice(0, 5);
        requestLogs.forEach(req => {
            const time = new Date(req.finishTime || req.id);
            localHistory.push({
                type: '🛎️ طلب',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: req.details || 'طلب نزيل',
                duration: req.duration || '--',
                worker: req.worker || 'غير محدد',
                image: null
            });
        });
        
        // من سجل الصيانة - مع الصور
        const maintLogs = (appState.completedMaintenanceLog || []).filter(m => m.num == roomNum).slice(0, 5);
        maintLogs.forEach(maint => {
            const time = new Date(maint.finishTime || maint.id);
            localHistory.push({
                type: '🛠️ صيانة',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: maint.maintDesc || 'صيانة',
                duration: maint.duration || '--',
                recurring: maint.recurring || false,
                worker: maint.worker || 'غير محدد',
                image: maint.image || null
            });
        });
        
        // آخر تنظيف
        const lastCleaning = cleaningLogs.length > 0 ? cleaningLogs[0] : null;
        
        // آخر صيانة
        const lastMaintenance = maintLogs.length > 0 ? maintLogs[0] : null;
        
        // ترتيب حسب الأحدث
        localHistory.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        // ============ Frequent Fault Alert (تنبيه الأعطال المتكررة) ============
        const maintenanceCount = maintLogs.length;
        let frequentFaultAlert = '';
        if (maintenanceCount >= 3) {
            // فحص إذا كان نفس العطل
            const descriptions = maintLogs.map(m => (m.maintDesc || '').toLowerCase());
            const uniqueIssues = [...new Set(descriptions)];
            if (uniqueIssues.length < maintenanceCount) {
                frequentFaultAlert = `<div style="background: rgba(220, 38, 38, 0.1); border: 2px solid var(--danger); border-radius: 8px; padding: 8px; margin-top: 10px;">
                    <strong style="color: var(--danger);">⚠️ تحذير: عطل متكرر!</strong><br>
                    <span style="font-size: 0.85rem;">تم تسجيل ${maintenanceCount} عمليات صيانة لهذه الغرفة</span>
                </div>`;
            }
        }
        
        // ============ Advanced Anti-Cheat (كشف التلاعب) ============
        let antiCheatWarning = '';
        if (room.historyLogs && room.historyLogs.length > 0) {
            const recentLogs = room.historyLogs.slice(-5);
            let suspiciousCount = 0;
            
            recentLogs.forEach(log => {
                if (log.action && log.action.includes('→')) {
                    const parts = log.action.split('→');
                    if (parts.length === 2) {
                        const duration = log.timestamp - (log.prevTimestamp || log.timestamp);
                        const durationMins = Math.floor(duration / 60000);
                        
                        // تحقق من الوقت المنطقي (أقل من دقيقتين مشبوه)
                        if (durationMins < 2 && durationMins > 0) {
                            suspiciousCount++;
                        }
                    }
                }
            });
            
            if (suspiciousCount >= 2) {
                antiCheatWarning = `<div style="background: rgba(245, 158, 11, 0.1); border: 2px solid var(--warning); border-radius: 8px; padding: 8px; margin-top: 10px;">
                    <strong style="color: var(--warning);">⚡ تنبيه: سرعة غير طبيعية</strong><br>
                    <span style="font-size: 0.85rem;">تم اكتشاف ${suspiciousCount} عملية سريعة جداً</span>
                </div>`;
            }
        }
        
        // عرض المعلومات المحسّنة
        const historyHTML = localHistory.length > 0 ? 
            localHistory.slice(0, 10).map(h => `
                <div style="padding: 10px; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                    <div style="display: flex; align-items: start; gap: 10px;">
                        <div style="flex: 1;">
                    <strong>${h.type}</strong> - ${h.time}<br>
                            <span style="color: var(--text-sec);">${h.status}</span><br>
                            <span style="color: var(--text-sec); font-size: 0.75rem;">👤 ${h.worker || 'غير محدد'}</span>
                            ${h.duration && h.duration !== '--' ? `<br><span style="color: var(--text-sec); font-size: 0.75rem;">⏱️ ${h.duration}</span>` : ''}
                    ${h.recurring ? ' <span style="color: var(--primary);">🔄 دورية</span>' : ''}
                        </div>
                        ${h.image ? `<img src="${h.image}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; cursor: pointer;" onclick="window.open('${h.image}', '_blank')" title="انقر للتكبير">` : ''}
                    </div>
                </div>
            `).join('') : 
            '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا يوجد سجل سابق</p>';
        
        // معلومات سريعة في الأعلى
        const quickInfoHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; padding: 15px; background: rgba(0,188,212,0.05); border-radius: 12px;">
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: var(--text-sec); margin-bottom: 5px;">✔ آخر تنظيف</div>
                    <div style="font-weight: 700; color: var(--primary);">
                        ${lastCleaning ? new Date(lastCleaning.finishTime || lastCleaning.id).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لا يوجد'}
                    </div>
                    ${lastCleaning && lastCleaning.worker ? `<div style="font-size: 0.7rem; color: var(--text-sec); margin-top: 3px;">👤 ${lastCleaning.worker}</div>` : ''}
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: var(--text-sec); margin-bottom: 5px;">🛠️ آخر صيانة</div>
                    <div style="font-weight: 700; color: var(--maint-color);">
                        ${lastMaintenance ? new Date(lastMaintenance.finishTime || lastMaintenance.id).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لا يوجد'}
                    </div>
                    ${lastMaintenance && lastMaintenance.worker ? `<div style="font-size: 0.7rem; color: var(--text-sec); margin-top: 3px;">👤 ${lastMaintenance.worker}</div>` : ''}
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: var(--text-sec); margin-bottom: 5px;">🛎️ عدد الطلبات</div>
                    <div style="font-weight: 700; color: var(--request-color);">${requestLogs.length}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: var(--text-sec); margin-bottom: 5px;">🛠️ عدد الصيانة</div>
                    <div style="font-weight: 700; color: var(--maint-color);">${maintLogs.length}</div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7); 
            display: flex; align-items: center; justify-content: center; 
            z-index: 9999; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg-body); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="padding: 20px; border-bottom: 2px solid var(--border-color);">
                    <h3 style="margin: 0; color: var(--primary); font-size: 1.3rem;">📋 سجل غرفة ${roomNum}</h3>
                    <p style="margin: 5px 0 0 0; color: var(--text-sec); font-size: 0.9rem;">
                        ${room.type === 'out' ? '🚨 خروج' : '📅 ساكن'} | 
                        ${room.guestStatus === 'in' ? '👤 داخل' : '🚶 خارج'}
                    </p>
                </div>
                ${frequentFaultAlert}
                ${antiCheatWarning}
                <div style="padding: 15px;">
                    ${quickInfoHTML}
                    <h4 style="margin: 0 0 10px 0; color: var(--text-main); font-size: 1rem;">📊 آخر 10 عمليات</h4>
                    ${historyHTML}
                </div>
                <div style="padding: 15px; border-top: 2px solid var(--border-color);">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        width: 100%; padding: 12px; background: linear-gradient(135deg, var(--maint-color), #0EA5E9);
                        color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700;
                        cursor: pointer; box-shadow: 0 4px 12px rgba(14,165,233,0.3);
                    ">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error fetching room history:', error);
        showMiniAlert('❌ خطأ في جلب السجل', 'error');
    }
}

        function createRequestCard(req) {
            const isScheduled = req.status === 'scheduled';
            const details = req.details || 'طلب';
            const shortDetails = details.length > 25 ? details.substring(0, 25) + '...' : details;
            
            // التحقق من وجود num صالح (لإصلاح مشكلة undefined)
            const roomNum = (req.num !== undefined && req.num !== null && !isNaN(req.num)) 
                ? parseInt(req.num, 10) 
                : (req.room !== undefined && req.room !== null && !isNaN(req.room))
                    ? parseInt(req.room, 10)
                    : '--';

            let actionBtn = !isScheduled ? 
                `<button class="glass-btn finish" onclick="completeRequest('${req.id}')">${t('finish')}</button>` : 
                `<button class="glass-btn start" onclick="forceStartScheduled('${req.id}', 'req')">${t('start')}</button>`;

            // RTL: يمين → يسار
            return `
            <div class="room-row status-request ${isScheduled ? 'status-scheduled' : ''}" onclick="showRequestDetails('${req.id}')" style="cursor: pointer;">
                
                <div class="room-num-circle" style="position: relative;">
                    ${roomNum}
                    ${req.fromGuest ? `<span style="position: absolute; top: -3px; left: -3px; width: 16px; height: 16px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.3); border: 1.5px solid rgba(255,255,255,0.9); z-index: 10;" title="طلب من QR"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 2H7C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V4C19 2.9 18.1 2 17 2ZM17 18H7V6H17V18Z" fill="white"/></svg></span>` : ''}
                </div>

                <div class="room-details">
                    <div class="room-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${req.requestType === 'checkout' ? '🚪 طلب تسجيل خروج' : req.requestType === 'cleaning' ? '🧹 طلب نظافة' : (req.isUrgent ? `🚨 ${t('urgentRequest')}` : `🛎️ طلب`)}</span>
                        ${req.fromGuest && (req.guestIdentity || req.guestPhone) ? `<span style="font-size: 0.7rem; color: var(--text-sec); background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 500; white-space: nowrap;" title="رقم الجوال أو الهوية">${req.guestPhone || req.guestIdentity || ''}</span>` : ''}
                    </div>
                    <div class="room-timer ${isScheduled ? 'timer-sched' : 'timer-req'}" id="req-timer-${req.id}">0:00</div>
                    <div class="room-desc">${req.requestType === 'checkout' ? (req.details && req.details.includes('عربة') ? 'يحتاج عربة' : 'طلب تسجيل خروج - بدون عربة') : shortDetails}</div>
                </div>

                <div onclick="event.stopPropagation();">${actionBtn}</div>
            </div>`;
        }
        
        // عرض تفاصيل الطلب وسجل آخر 3 طلبات
        async function showRequestDetails(requestId) {
            const req = appState.guestRequests.find(r => r.id === requestId);
            if (!req) return;
            
            const roomNum = req.num || req.room || '--';
            
            // جلب آخر 3 طلبات للغرفة نفسها
            let recentRequests = [];
            if (db) {
                try {
                    // إزالة orderBy لتجنب الحاجة إلى index - سنرتب محلياً
                    const requestsSnapshot = await db.collection('guestRequests')
                        .where('num', '==', parseInt(roomNum))
                        .get();
                    
                    const allRequests = [];
                    requestsSnapshot.forEach(doc => {
                        const data = doc.data();
                        allRequests.push({
                            id: doc.id,
                            ...data,
                            startTime: data.startTime || data.schedTimestamp || doc.id,
                            finishTime: data.finishTime || null
                        });
                    });
                    
                    // ترتيب محلي حسب startTime
                    allRequests.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
                    recentRequests = allRequests.slice(0, 3);
                } catch (e) {
                    console.error('Error fetching recent requests:', e);
                    // Fallback: استخدام البيانات المحلية
                    recentRequests = (appState.guestRequestsLog || [])
                        .filter(r => r.num == roomNum)
                        .sort((a, b) => (b.finishTime || b.startTime || 0) - (a.finishTime || a.startTime || 0))
                        .slice(0, 3);
                }
            } else {
                // Fallback: استخدام البيانات المحلية
                recentRequests = (appState.guestRequestsLog || [])
                    .filter(r => r.num == roomNum)
                    .sort((a, b) => (b.finishTime || b.startTime || 0) - (a.finishTime || a.startTime || 0))
                    .slice(0, 3);
            }
            
            // تنسيق تفاصيل الطلب الحالي
            const startDate = req.startTime ? new Date(req.startTime) : new Date(req.schedTimestamp || Date.now());
            const startDateStr = startDate.toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const startTimeStr = startDate.toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // تنسيق سجل آخر 3 طلبات
            let recentRequestsHTML = '';
            if (recentRequests.length > 0) {
                recentRequestsHTML = recentRequests.map((r, index) => {
                    const reqDate = r.startTime ? new Date(r.startTime) : new Date(r.schedTimestamp || r.finishTime || Date.now());
                    const reqDateStr = reqDate.toLocaleDateString('ar-EG', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    const reqTimeStr = reqDate.toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const finishTimeStr = r.finishTime ? new Date(r.finishTime).toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }) : null;
                    
                    return `
                        <div style="background: linear-gradient(135deg, rgba(0,188,212,0.05), rgba(14,165,233,0.05)); padding: 15px; border-radius: 12px; border: 1px solid rgba(0,188,212,0.2); margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div style="font-weight: 700; color: var(--request-color); font-size: 1rem;">طلب #${index + 1}</div>
                                <div style="font-size: 0.85rem; color: var(--text-sec);">${r.status === 'completed' ? '✅ مكتمل' : r.status === 'scheduled' ? '📅 مجدول' : '🔄 نشط'}</div>
                            </div>
                            <div style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px; line-height: 1.6;">${r.details || 'طلب'}</div>
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: var(--text-sec);">
                                <div>📅 <strong>التاريخ:</strong> ${reqDateStr}</div>
                                <div>⏰ <strong>وقت الطلب:</strong> ${reqTimeStr}</div>
                                ${finishTimeStr ? `<div>✅ <strong>وقت الإنهاء:</strong> ${finishTimeStr}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                recentRequestsHTML = '<div style="text-align: center; padding: 20px; color: var(--text-sec);">لا توجد طلبات سابقة</div>';
            }
            
            // إنشاء نافذة التفاصيل
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.7); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 9999; padding: 20px;
            `;
            
            modal.innerHTML = `
                <div style="background: var(--bg-body); border-radius: 16px; max-width: 600px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                    <div style="padding: 20px; border-bottom: 2px solid var(--border-color);">
                        <h3 style="margin: 0; color: var(--primary); font-size: 1.3rem;">📋 تفاصيل الطلب - غرفة ${roomNum}</h3>
                    </div>
                    <div style="padding: 20px;">
                        <div style="background: linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.1)); padding: 20px; border-radius: 12px; border: 2px solid rgba(168,85,247,0.3); margin-bottom: 20px;">
                            <h4 style="margin: 0 0 15px 0; color: var(--request-color); font-size: 1.1rem;">📝 تفاصيل الطلب الحالي</h4>
                            <div style="font-size: 1rem; color: var(--text-main); margin-bottom: 12px; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word;">${req.details || 'طلب'}</div>
                            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; color: var(--text-sec); margin-top: 15px;">
                                <div>📅 <strong>التاريخ:</strong> ${startDateStr}</div>
                                <div>⏰ <strong>وقت الطلب:</strong> ${startTimeStr}</div>
                                <div>🔄 <strong>الحالة:</strong> ${req.status === 'scheduled' ? '📅 مجدول' : req.status === 'completed' ? '✅ مكتمل' : '🔄 نشط'}</div>
                                ${req.fromGuest ? `<div>📱 <strong>مصدر الطلب:</strong> من النزيل (QR)</div>` : ''}
                                ${req.guestIdentity || req.guestPhone ? `<div>👤 <strong>هوية/جوال النزيل:</strong> ${req.guestPhone || req.guestIdentity}</div>` : ''}
                            </div>
                        </div>
                        
                        <h4 style="margin: 20px 0 15px 0; color: var(--text-main); font-size: 1.1rem;">📊 آخر 3 طلبات للغرفة</h4>
                        ${recentRequestsHTML}
                    </div>
                    <div style="padding: 15px; border-top: 2px solid var(--border-color);">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                            width: 100%; padding: 12px; background: linear-gradient(135deg, var(--request-color), #0EA5E9);
                            color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700;
                            cursor: pointer; box-shadow: 0 4px 12px rgba(14,165,233,0.3);
                        ">إغلاق</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // إغلاق عند الضغط خارج النافذة
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
        
        window.showRequestDetails = showRequestDetails;


function renderGuestRequests() {
    // تعديل: استبعاد طلبات النظافة تماماً من هذه القائمة لأنها تظهر في قسم تتبع الغرف
    const activeReqs = appState.guestRequests.filter(r => r.status !== 'scheduled' && r.status !== 'completed' && r.requestType !== 'cleaning');
    
    // تصحيح: هذا هو التعريف الوحيد والصحيح للمتغير (تم حذف التكرار)
    const scheduledReqs = appState.guestRequests.filter(r => r.status === 'scheduled' && r.requestType !== 'cleaning');
    
    const archiveReqs = appState.guestRequestsLog || [];
    
    // سيتم عرضها في قسم تتبع الغرف - طلبات النظافة (cleaning)
    const activeCleaningReqs = appState.guestRequests.filter(r => r.status !== 'scheduled' && r.status !== 'completed' && r.requestType === 'cleaning' && r.roomTracking);
    const requestSection = document.getElementById('guest-requests-section');
    const archiveContainer = document.getElementById('req-archive-container');

    const isArchiveOpen = (appState.isArchiveView && appState.isArchiveView.req) === true;

    // إظهار القسم دائماً
    if (requestSection) requestSection.style.display = 'block';

    // عرض الطلبات النشطة
    const activeList = document.getElementById('guest-requests-active-list');
    if (activeList) {
        if (activeReqs.length === 0 && scheduledReqs.length === 0) {
            // لا توجد عمليات نشطة
            activeList.innerHTML = `<div style="text-align:center; padding:8px; color:var(--text-sec); font-size:0.85rem;"><span>${t('noActiveRequests')}</span></div>`;
        } else {
            activeList.innerHTML = activeReqs.length ?
                activeReqs.map(req => createRequestCard(req)).join('') :
                `<p class="no-data">${t('noActiveRequests')}</p>`;
        }
    }

    // عرض الطلبات المجدولة
    const schedContainer = document.getElementById('scheduled-requests-container');
    if (schedContainer) {
        if (scheduledReqs.length) {
            schedContainer.style.display = 'block';
            schedContainer.innerHTML =
                `<div class="section-title">📅 ${t('scheduledRequests')}</div>` +
                scheduledReqs.map(req => createRequestCard(req)).join('');
        } else {
            schedContainer.style.display = 'none';
        }
    }

    // ظهور / إخفاء الأرشيف
    if (archiveContainer) {
        archiveContainer.style.display = isArchiveOpen ? 'block' : 'none';
        if (isArchiveOpen && typeof renderGuestRequestsArchive === 'function') {
            renderGuestRequestsArchive();
        }
    }
}

// تم حذف وظائف الأرشيف - تم نقلها إلى نظام التقارير

// ===============================================
// == دالة renderMaintenanceCards الكاملة =========
// ===============================================
function renderMaintenanceCards() {
    const filterItems = (items) => items.filter(item => 
        String(item.num).includes(appState.searchText)
    );
    
    let activeMaint = filterItems(appState.activeMaintenance.filter(m => m.status !== 'scheduled' && m.status !== 'completed'));
    let scheduledMaint = filterItems(appState.activeMaintenance.filter(m => m.status === 'scheduled')); 
    scheduledMaint.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
    
    const maintenanceSection = document.getElementById('maintenance-section');
    
    // إظهار القسم فقط إذا كان فيه صفوف نشطة
    if (maintenanceSection) {
        if (activeMaint.length === 0 && scheduledMaint.length === 0) {
            maintenanceSection.style.display = 'none';
        } else {
            maintenanceSection.style.display = 'block';
        }
    }
    
    const activeList = document.getElementById('maintenance-active-list');
    if (activeList) {
        if (activeMaint.length === 0 && scheduledMaint.length === 0) {
            // لا توجد عمليات نشطة
            activeList.innerHTML = `<div style="text-align:center; padding:8px; color:var(--text-sec); font-size:0.85rem;"><span>${t('noActiveMaintenance')}</span></div>`;
        } else {
        activeList.innerHTML = activeMaint.length ? 
        activeMaint.map(m => createMaintenanceCard(m)).join('') : 
            `<p style="text-align:center;color:var(--text-sec);font-size:0.8rem;">${t('noActiveMaintenance')}</p>`;
        }
    }
    
    const schedMaintContainer = document.getElementById('scheduled-maintenance-container');
    if(schedMaintContainer) {
    if(scheduledMaint.length) { 
        schedMaintContainer.style.display = 'block'; 
        schedMaintContainer.innerHTML = 
                        `<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 ${t('scheduledMaintenance')}</div>` + 
            scheduledMaint.map(m => createMaintenanceCard(m)).join(''); 
    } else { 
        schedMaintContainer.style.display = 'none'; 
        }
    }

    // تم حذف الأرشيف
}
        
        function createMaintenanceCard(maint) {
            const isScheduled = maint.status === 'scheduled';
            const shortDesc = maint.maintDesc.length > 25 ? maint.maintDesc.substring(0, 25) + '...' : maint.maintDesc;
            
            // التحقق من وجود num صالح (لإصلاح مشكلة undefined)
            const roomNum = (maint.num !== undefined && maint.num !== null && !isNaN(maint.num)) 
                ? parseInt(maint.num, 10) 
                : (maint.room !== undefined && maint.room !== null && !isNaN(maint.room))
                    ? parseInt(maint.room, 10)
                    : '--';
            
            let actionBtn = !isScheduled ? 
                `<button class="glass-btn finish" onclick="openCompleteMaintenanceModal('${maint.id}')">${t('finish')}</button>` : 
                `<button class="glass-btn start" onclick="forceStartScheduled('${maint.id}', 'maint')">${t('start')}</button>`;
            
            let imgBtn = (maint.maintImg && !isScheduled) ? 
                `<a href="${maint.maintImg}" target="_blank" style="font-size:0.8rem; margin-right:5px;">📷</a>` : '';

            // RTL: يمين → يسار
            return `
            <div class="room-row status-maintenance ${isScheduled ? 'status-scheduled' : ''}">
                
                <div class="room-num-circle" style="position: relative;">
                    ${roomNum}
                    ${maint.fromGuest ? '<span style="position: absolute; top: -3px; left: -3px; width: 16px; height: 16px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.3); border: 1.5px solid rgba(255,255,255,0.9); z-index: 10;" title="صيانة من QR"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 2H7C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V4C19 2.9 18.1 2 17 2ZM17 18H7V6H17V18Z" fill="white"/></svg></span>' : ''}
                </div>

                <div class="room-details">
                    <div class="room-title">🛠️ صيانة</div>
                    <div class="room-timer ${isScheduled ? 'timer-sched' : 'timer-maint'}" id="maint-timer-${maint.id}">0:00</div>
                    <div class="room-desc">${shortDesc}</div>
                </div>

                <div style="display:flex; align-items:center;">${actionBtn}${imgBtn}</div>
            </div>`;
        }
        
        function renderLogSection() { 
            const listEl = document.getElementById('cleaning-log-list'); 
            const btnMore = document.getElementById('btn-more-log');
            
            if (!appState.log || appState.log.length === 0) { 
                listEl.innerHTML = `<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">${t('noCompletedOperations')}</p>`; 
                if (btnMore) btnMore.style.display = 'none';
                return; 
            } 
            
            const sortedLog = [...appState.log].sort((a, b) => b.id - a.id);
            // عرض آخر 3 سجلات فقط افتراضياً
            const defaultLimit = 3;
            const limit = appState.logViewLimit || defaultLimit;
            const visibleLogs = sortedLog.slice(0, limit); 
            
            listEl.innerHTML = visibleLogs.map(item => createLogRow(item, false)).join(''); 
            
            if (btnMore) {
                btnMore.style.display = sortedLog.length > limit ? 'block' : 'none';
                btnMore.textContent = `📂 ${t('showMore')} (${sortedLog.length - limit} ${t('record')})`;
            }
        }
        
        function createLogRow(item, isArchive) {
            // تحديد نوع العملية والألوان
            let borderColor = 'var(--success)';
            let bgColor = 'rgba(34, 197, 94, 0.05)';
            let typeIcon = '🧹';
            let typeText = t('cleaning');
            let statusBadge = `${t('completed')} ✅`;
            
            if (item.type === 'request' || item.details) {
                borderColor = 'var(--request-color)';
                bgColor = 'rgba(59, 130, 246, 0.05)';
                typeIcon = '🛎️';
                typeText = t('request');
                statusBadge = `${t('executed')} ✅`;
            } else if (item.type === 'maint' || item.maintDesc) {
                borderColor = 'var(--maint-color)';
                bgColor = 'rgba(6, 182, 212, 0.05)';
                typeIcon = '🛠️';
                typeText = t('maintenance');
                statusBadge = item.finishImg ? `${t('maintenanceDone')} ✅` : `${t('maintenanceInProgress')} 🔧`;
            } else if (item.type === 'out') {
                typeText = t('checkout');
            } else if (item.type === 'stay') {
                typeText = t('stayover');
            }
            
            if (item.isLate) {
                statusBadge = `${t('late')} ⚠️`;
            }
            
            // الأوقات - استخدام اللغة الحالية
            const locale = appState.language === 'ar' ? 'ar-EG' : appState.language === 'en' ? 'en-US' : appState.language === 'hi' ? 'hi-IN' : appState.language === 'ur' ? 'ur-PK' : 'bn-BD';
            const startTime = item.startTime ? new Date(item.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
            const finishTime = item.finishTime ? new Date(item.finishTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true }) : new Date(item.id).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true });
            const duration = item.duration || '--';
            
            // التفاصيل المختصرة
            let shortDetails = '';
            if (item.details) {
                shortDetails = item.details.split(' ')[0] || '';
            } else if (item.maintDesc) {
                shortDetails = item.maintDesc.split(' ')[0] || '';
            }
            
            // أيقونة الصورة
            let imgIcon = '';
            if (item.finishImg || item.maintImg) {
                const imgUrl = item.finishImg || item.maintImg;
                imgIcon = `<span onclick="window.open('${imgUrl}', '_blank')" style="cursor:pointer; font-size:1.1rem; margin-right:8px;" title="عرض الصورة">📷</span>`;
            }
            
            return `<div style="border-right:3px solid ${borderColor}; padding:8px 10px; background:linear-gradient(135deg, ${bgColor}, rgba(255,255,255,0.95)); border-radius:10px; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05); font-family:'Tajawal', sans-serif;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size:1rem; font-weight:900; color:${borderColor}; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; min-width:40px; text-align:center;">
                            ${item.num}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:1px;">
                            <span style="font-size:0.8rem; font-weight:700; color:#1f2937;">${typeIcon} ${typeText}${shortDetails ? ': ' + shortDetails : ''}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${imgIcon}
                        <span style="font-size:0.7rem; padding:3px 8px; border-radius:16px; background:linear-gradient(135deg, ${borderColor}, ${borderColor}dd); color:white; font-weight:700;">${statusBadge}</span>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid rgba(0,0,0,0.05);">
                    <div style="display:flex; flex-direction:column; gap:2px; font-size:0.7rem; color:#6b7280;">
                        <span>🕒 ${t('startTime')}: <strong style="color:#374151;">${startTime}</strong></span>
                        <span>🕒 ${t('finishTime')}: <strong style="color:#374151;">${finishTime}</strong></span>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.65rem; color:#9ca3af;">${t('duration')}</div>
                        <div style="font-size:0.85rem; font-weight:800; color:${borderColor};">⏱️ ${duration}</div>
                    </div>
                </div>
            </div>`;
        }
        
        // ===============================================
        // == دالة تحويل الفترات الزمنية إلى نص عربي =====
        // ===============================================
        
        function formatLongDurationArabic(startTime, now = Date.now()) {
            // حمايات أساسية
            if (!startTime || isNaN(startTime)) {
                return "0 دقيقة";
            }
            
            const diff = now - Number(startTime);
            
            if (diff < 0 || !isFinite(diff)) {
                return "0 دقيقة";
            }
            
            const totalMinutes = Math.floor(diff / 60000);
            const days = Math.floor(totalMinutes / 1440); // 24 * 60
            const hours = Math.floor((totalMinutes % 1440) / 60);
            const minutes = totalMinutes % 60;
            
            // تصريف كلمة "يوم" بالعربية
            let dayText = "";
            if (days === 1) dayText = "1 يوم";
            else if (days === 2) dayText = "يومان";
            else if (days >= 3 && days <= 10) dayText = `${days} أيام`;
            else if (days > 10) dayText = `${days} يوم`;
            
            const parts = [];
            if (days > 0) parts.push(dayText);
            if (hours > 0) parts.push(`${hours} ساعة`);
            if (minutes > 0) parts.push(`${minutes} دقيقة`);
            
            if (parts.length === 0) return "0 دقيقة";
            
            return parts.join(" و ");
        }
        
        function updateTimersDOM() { 
            const now = Date.now(); 
            
            // Room Timers + Update Undo Buttons
            appState.rooms.forEach(room => { 
                const el = document.getElementById(`timer-${room.id}`); 
                if (!el) return; 
                
                // تم حذف كود Undo نهائياً
                
                if (room.status === 'scheduled' && room.schedTimestamp) { 
                    const diff = room.schedTimestamp - now;
                    if (diff > 0) {
                        const totalSeconds = Math.floor(diff / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        const timeStr = new Date(room.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        let timeDisplay = '';
                        if (hours > 0) {
                            timeDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                        
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${timeDisplay}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    // استخدام formatLongDurationArabic للغرف أيضاً
                    // للغرف: نعرض الوقت المتبقي (deadline) أو الوقت المنقضي (startTime) كبديل
                    const deadlineVal = (typeof room.deadline !== 'undefined' && room.deadline !== null) ? Number(room.deadline) : null;
                    
                    if (deadlineVal && isFinite(deadlineVal)) {
                        // عرض الوقت المتبقي حتى deadline
                        const diff = deadlineVal - now;
                        if (isFinite(diff)) {
                            if (diff < 0) {
                                // متأخر - عرض الوقت المنقضي منذ deadline بصيغة h:mm:ss أو m:ss
                                const elapsedMs = now - deadlineVal;
                                const totalSeconds = Math.floor(elapsedMs / 1000);
                                const hours = Math.floor(totalSeconds / 3600);
                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                const seconds = totalSeconds % 60;
                                
                                let timeDisplay = '';
                                if (hours > 0) {
                                    timeDisplay = `⚠️ ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                } else {
                                    timeDisplay = `⚠️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
                                }
                                
                                el.innerHTML = timeDisplay;
                                el.className = 'room-timer timer-danger';
                                
                                if (room.status !== 'overdue') {
                                    if (typeof db !== 'undefined' && db) {
                        db.collection('rooms').doc(room.id).set({ status: 'overdue' }, { merge: true }).catch(e => console.error(e)); 
                                    }
                                }
                            } else {
                                // متبقي - عرض الوقت المتبقي بصيغة h:mm:ss أو m:ss
                                const remainingMs = diff;
                                const totalSeconds = Math.floor(remainingMs / 1000);
                                const hours = Math.floor(totalSeconds / 3600);
                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                const seconds = totalSeconds % 60;
                                
                                if (hours > 0) {
                                    el.innerHTML = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                } else {
                                    el.innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                }
                                el.className = 'room-timer timer-active';
                            }
                        } else {
                            el.innerHTML = '--';
                            el.className = 'room-timer';
                        }
                    } else {
                        // fallback إلى startTime (عرض الوقت المنقضي منذ البدء بصيغة h:mm:ss أو m:ss)
                        const startVal = (typeof room.startTime !== 'undefined' && room.startTime !== null) ? Number(room.startTime) : null;
                        if (startVal && isFinite(startVal)) {
                            const elapsedMs = now - startVal;
                            const totalSeconds = Math.floor(elapsedMs / 1000);
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor((totalSeconds % 3600) / 60);
                            const seconds = totalSeconds % 60;
                            
                            if (hours > 0) {
                                el.innerHTML = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                            } else {
                                el.innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                            }
                            el.className = 'room-timer timer-active';
                        } else {
                            // لا يوجد deadline ولا startTime -> عرض افتراضي آمن
                            el.innerHTML = '--';
                            el.className = 'room-timer';
                        }
                    }
                } 
            }); 
            
            // Maintenance Timers
            appState.activeMaintenance.forEach(maint => { 
                const el = document.getElementById(`maint-timer-${maint.id}`); 
                if (!el) return; 
                
                if (maint.status === 'scheduled' && maint.schedTimestamp) { 
                    const diff = maint.schedTimestamp - now;
                    if (diff > 0) {
                        // حساب الوقت المتبقي حتى الجدولة بصيغة h:mm:ss أو m:ss
                        const totalSeconds = Math.floor(diff / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        const timeStr = new Date(maint.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        let timeDisplay = '';
                        if (hours > 0) {
                            timeDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                        
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${timeDisplay}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    // صيانة نشطة - عرض الوقت المنقضي منذ البدء بصيغة h:mm:ss أو m:ss
                    const startVal = (typeof maint.startTime !== 'undefined' && maint.startTime !== null) ? Number(maint.startTime) : null;
                    if (startVal && isFinite(startVal)) {
                        const elapsedMs = now - startVal;
                        const totalSeconds = Math.floor(elapsedMs / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        if (hours > 0) {
                            el.innerHTML = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            el.innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                    } else {
                        // لا يوجد startTime -> عرض افتراضي
                        el.innerHTML = '--';
                    }
                } 
            }); 
            
            // Guest Request Timers
            appState.guestRequests.forEach(req => { 
                const el = document.getElementById(`req-timer-${req.id}`); 
                if (!el) return; 
                
                if (req.status === 'scheduled' && req.schedTimestamp) { 
                    const diff = req.schedTimestamp - now;
                    if (diff > 0) {
                        // حساب الوقت المتبقي حتى الجدولة بصيغة h:mm:ss أو m:ss
                        const totalSeconds = Math.floor(diff / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        const timeStr = new Date(req.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        let timeDisplay = '';
                        if (hours > 0) {
                            timeDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                        
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${timeDisplay}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    // طلب نشط - عرض الوقت المنقضي منذ البدء بصيغة h:mm:ss أو m:ss
                    const startVal = (typeof req.startTime !== 'undefined' && req.startTime !== null) ? Number(req.startTime) : null;
                    if (startVal && isFinite(startVal)) {
                        const elapsedMs = now - startVal;
                        const totalSeconds = Math.floor(elapsedMs / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        if (hours > 0) {
                            el.innerHTML = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            el.innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                    } else {
                        // لا يوجد startTime -> عرض افتراضي
                        el.innerHTML = '--';
                    }
                    el.className = 'timer-display timer-req'; 
                } 
            }); 
        }

        // ===============================================
        // == العمليات الأساسية (Firebase) ===============
        // ===============================================
        
        async function saveData() {
            if (!db) return;
            toggleSyncIndicator(true);
            try {
                await db.collection('settings').doc('globalState').set({
                    turbo: appState.turbo,
                    archiveViewLimit: appState.archiveViewLimit,
                    logViewLimit: appState.logViewLimit,
                    logStep: appState.logStep,
                    points: appState.points
                }, { merge: true });
            } catch (e) { 
                console.error("Error saving global state:", e); 
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        // ===============================================
        // == نظام Auto-Sync Indicator الذكي ============
        // ===============================================
        
        let syncState = 'synced'; // synced, pending, offline
        let pendingOperations = 0;
        
        // ===============================================
        // == نظام Loading Bar ==========================
        // ===============================================
        
        function showLoadingBar() {
            // استخدام sync indicator كـ loading bar
            updateSyncIndicator('pending');
        }
        
        function hideLoadingBar() {
            // إخفاء loading bar
            if (pendingOperations === 0) {
                updateSyncIndicator('synced');
                setTimeout(() => {
            const el = document.getElementById('sync-indicator');
                    if (el && syncState === 'synced') {
                        el.style.opacity = '0';
                        setTimeout(() => el.style.display = 'none', 300);
                    }
                }, 2000);
            }
        }
        
        function updateSyncIndicator(state) {
            const el = document.getElementById('sync-indicator');
            if (!el) return;
            
            syncState = state;
            
            // تحديث الألوان والرسائل
            if (state === 'synced') {
                el.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.2))';
                el.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                el.style.color = '#15803d';
                el.innerHTML = '✅ متزامن';
                el.style.display = 'block';
            } else if (state === 'pending') {
                el.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.2))';
                el.style.borderColor = 'rgba(234, 179, 8, 0.4)';
                el.style.color = '#ca8a04';
                el.innerHTML = `🔄 جاري الحفظ... (${pendingOperations})`;
                el.style.display = 'block';
            } else if (state === 'offline') {
                el.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.2))';
                el.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                el.style.color = '#dc2626';
                el.innerHTML = '⚠️ غير متصل';
                el.style.display = 'block';
            }
        }
        
        function toggleSyncIndicator(show, state = 'pending') {
            const el = document.getElementById('sync-indicator');
            if (!el) return;
            
            if (show) {
                if (state === 'pending') {
                    pendingOperations++;
                    updateSyncIndicator('pending');
                } else {
                    updateSyncIndicator(state);
                }
            } else {
                pendingOperations = Math.max(0, pendingOperations - 1);
                if (pendingOperations === 0) {
                    // التحقق من حالة الاتصال
                    if (navigator.onLine) {
                        updateSyncIndicator('synced');
                        // إخفاء بعد 2 ثانية
                        setTimeout(() => {
                            if (syncState === 'synced') {
                                el.style.opacity = '0';
                                setTimeout(() => el.style.display = 'none', 300);
                            }
                        }, 2000);
                    } else {
                        updateSyncIndicator('offline');
                    }
                } else {
                    updateSyncIndicator('pending');
                }
            }
        }
        
        // مراقبة حالة الاتصال
        window.addEventListener('online', () => {
            updateSyncIndicator('synced');
            setTimeout(() => {
                const el = document.getElementById('sync-indicator');
                if (el && syncState === 'synced') {
                    el.style.opacity = '0';
                    setTimeout(() => el.style.display = 'none', 300);
                }
            }, 2000);
        });
        
        window.addEventListener('offline', () => {
            updateSyncIndicator('offline');
        });
        
        // ============ نظام رفع الصور الذكي (Smart Upload + Retry) ============
        async function uploadToImgBB(file, retries = 3) { 
            return new Promise((resolve) => { 
                if (!file) return resolve(null);
                
                const reader = new FileReader(); 
                reader.onload = function(e) { 
                    const img = new Image(); 
                    img.onload = function() { 
                        // ============ ضغط الصور الذكي (Smart Compression) ============
                        const canvas = document.createElement('canvas'); 
                        const ctx = canvas.getContext('2d'); 
                        
                        // تحديد الحد الأقصى: 1000px بدلاً من 800px لجودة أفضل
                        const maxDim = 1000;
                        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                        canvas.width = img.width * scale; 
                        canvas.height = img.height * scale; 
                        
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        
                        // ضغط الصورة بنسبة 70% (أفضل من 80%)
                        canvas.toBlob(async function(blob) { 
                            const originalSize = (file.size / 1024).toFixed(0);
                            const compressedSize = (blob.size / 1024).toFixed(0);
                            console.log(`📸 ضغط الصورة: ${originalSize}KB → ${compressedSize}KB`);
                            
                            const formData = new FormData(); 
                            formData.append('image', blob); 
                            
                            // ============ نظام إعادة المحاولة (Retry System) ============
                            let attempt = 0;
                            let uploadSuccess = false;
                            let finalUrl = null;
                            
                            while (attempt < retries && !uploadSuccess) {
                                attempt++;
                                
                                try {
                                    if (attempt > 1) {
                                        showMiniAlert(`🔄 محاولة ${attempt}/${retries}...`, 'warning');
                                        await new Promise(r => setTimeout(r, 1000 * attempt)); // تأخير تصاعدي
                                    }
                                    
                                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${HOTEL_CONFIG.imgbbKey}`, { 
                                method: 'POST', 
                                        body: formData,
                                        signal: AbortSignal.timeout(15000) // 15 ثانية timeout
                                    });
                                    
                                    if (!response.ok) {
                                        throw new Error(`HTTP ${response.status}`);
                                    }
                                    
                                    const data = await response.json();
                                    
                                    if (data.data?.url) {
                                        finalUrl = data.data.url;
                                        uploadSuccess = true;
                                        showMiniAlert('✅ تم رفع الصورة بنجاح', 'success');
                                    } else {
                                        throw new Error('No URL in response');
                                    }
                                    
                                } catch (error) {
                                    console.error(`❌ محاولة ${attempt} فشلت:`, error.message);
                                    
                                    if (attempt === retries) {
                                        showMiniAlert('❌ فشل رفع الصورة بعد 3 محاولات', 'error');
                                    }
                                }
                            }
                            
                            resolve(finalUrl);
                        }, 'image/jpeg', 0.7); 
                    }; 
                    
                    img.onerror = function() {
                        showMiniAlert('❌ خطأ في قراءة الصورة', 'error');
                        resolve(null);
                    };
                    
                    img.src = e.target.result; 
                }; 
                
                reader.onerror = function() {
                    showMiniAlert('❌ خطأ في قراءة الملف', 'error');
                    resolve(null);
                };
                
                reader.readAsDataURL(file); 
            }); 
        }
        
        async function submitNewEntryToFirebase(mode, num, isScheduled, schedTimestamp, fullTimeString, roomType, isSuper, maintDetails, reqDetails, maintFile) {
            if (!db) return;
            
            toggleSyncIndicator(true);
            try {
                let imgUrl = null;
                if (mode === 'maintenance' && maintFile) {
                    imgUrl = await uploadToImgBB(maintFile);
                    if (!imgUrl) { 
                        showMiniAlert('فشل رفع صورة الصيانة.', 'error'); 
                        return; 
                    }
                }
                
                if (mode === 'request') {
                    const newRequest = { 
                        num, 
                        details: reqDetails, 
                        schedTime: isImmediateRequest ? "🚨 فوري" : fullTimeString, 
                        schedTimestamp, 
                        isUrgent: isImmediateRequest, 
                        startTime: Date.now(), 
                        status: isImmediateRequest ? 'active' : 'scheduled',
                        type: 'request'
                    };
                    await db.collection('guestRequests').doc().set(newRequest, { merge: true });
                    
                } else if (mode === 'maintenance') {
                    const newMaint = { 
                        num, 
                        maintDesc: maintDetails, 
                        maintImg: imgUrl, 
                        schedTime: isImmediateMaint ? "🚨 فوري" : fullTimeString, 
                        schedTimestamp, 
                        startTime: Date.now(), 
                        status: isImmediateMaint ? 'active' : 'scheduled', 
                        history: [{
                            action: 'تسجيل', 
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                        }],
                        type: 'maint'
                    };
                    await db.collection('activeMaintenance').doc().set(newMaint, { merge: true });
                    
                } else if (mode === 'cleaning') {
                    const newRoom = { 
                        num, 
                        type: roomType, 
                        status: isScheduled ? 'scheduled' : 'acknowledging', 
                        startTime: Date.now(), 
                        deadline: Date.now() + HOTEL_CONFIG.times.TRAVEL, 
                        guestStatus: roomType === 'stay' ? document.getElementById('inpGuestStatus').value : 'out', 
                        // تم حذف undoExpiry 
                        historyLogs: [{ 
                            action: 'إضافة', 
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                        }], 
                        isSuperTurbo: isSuper, 
                        schedTime: fullTimeString, 
                        schedTimestamp 
                    };
                    await db.collection('rooms').doc().set(newRoom, { merge: true });
                }
                
                toggleSyncIndicator(false);
                showMiniAlert('✅ تم الإضافة بنجاح', 'success');
                playNotificationSound();
                
            } catch(e) { 
                console.error("Firebase Add Failed:", e); 
                showMiniAlert(`❌ فشل الإضافة.`, 'error'); 
                toggleSyncIndicator(false);
            }
        }
        
        async function addNewBtnAction() {
            let num = document.getElementById('inpRoomNum').value; 
            
            if (!num) { 
                showMiniAlert('⚠️ أدخل رقم الغرفة.', 'warning'); 
                return; 
            }
            if (num < 1 || num > 9999) { 
                showMiniAlert('⚠️ رقم غرفة غير صحيح.', 'warning'); 
                return; 
            }
            
            num = String(num); 
            
            if (currentAddMode === 'cleaning' && appState.rooms.find(room => room.num === num)) { 
                showMiniAlert(`❌ الغرفة ${num} نشطة بالفعل. لا يمكن إضافة تنظيف جديد.`, 'error'); 
                return; 
            }
            
            // التحقق من اختيار الخيارات المطلوبة
            if (currentAddMode === 'cleaning') {
                const roomType = document.getElementById('inpRoomType').value;
                if (!roomType) {
                    showMiniAlert('⚠️ يرجى اختيار نوع الغرفة (خروج/ساكن/DND).', 'warning');
                    return;
                }
            } else if (currentAddMode === 'request') {
                if (isImmediateRequest === null) {
                    showMiniAlert('⚠️ يرجى اختيار نوع الطلب (فوري/مجدول).', 'warning');
                    return;
                }
            } else if (currentAddMode === 'maintenance') {
                if (isImmediateMaint === null) {
                    showMiniAlert('⚠️ يرجى اختيار نوع الصيانة (عاجل/مجدول).', 'warning');
                    return;
                }
            }
            
            if (!db) { 
                showMiniAlert('❌ خطأ في الاتصال بقاعدة البيانات.', 'error'); 
                return; 
            }
            
            let timeValue = '';
            let schedTimestamp = null;
            let timeInputId = '';
            
            if (currentAddMode === 'cleaning') { 
                timeInputId = 'systemTimeInput'; 
            } else if (currentAddMode === 'request' && !isImmediateRequest) { 
                timeInputId = 'systemTimeInputReq'; 
            } else if (currentAddMode === 'maintenance' && !isImmediateMaint) { 
                timeInputId = 'systemTimeInputMaint'; 
            }
            
            if (timeInputId) { 
                timeValue = document.getElementById(timeInputId).value; 
            }
            
            const timeParts = timeValue.split(':');
            const hours = parseInt(timeParts[0]) || 12;
            const minutes = parseInt(timeParts[1]) || 0;
            const period = hours >= 12 ? 'م' : 'ص';
            const displayHours = hours % 12 || 12;
            const fullTimeString = `اليوم - ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            
            const isScheduled = (currentAddMode === 'request' && !isImmediateRequest) || 
                              (currentAddMode === 'maintenance' && !isImmediateMaint) || 
                              (currentAddMode === 'cleaning' && document.getElementById('inpRoomType').value === 'stay');
            
            if (isScheduled) { 
                const now = new Date(); 
                const selected = new Date(); 
                selected.setHours(hours, minutes, 0, 0); 
                if (selected < new Date(now.getTime() - 60000)) { 
                    showMiniAlert("⚠️ الوقت المجدول في الماضي!", "warning"); 
                    return; 
                } 
                schedTimestamp = selected.getTime(); 
            }
            
            // رسائل واتساب مختلفة حسب النوع
            let waMsg = '';
            const currentDate = new Date().toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            if (currentAddMode === 'request') {
                const details = document.getElementById('inpRequestDetails').value; 
                if (!details) { 
                    showMiniAlert('⚠️ اكتب تفاصيل الطلب.', 'warning'); 
                    return; 
                }
                
                if (isImmediateRequest) {
                    waMsg = `🚨 *طلب عاجل - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `📝 التفاصيل: ${details}\n` +
                           `⏰ الحالة: عاجل - تنفيذ الآن\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 مسجل الطلب: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#طلب_عاجل`;
                } else {
                    waMsg = `📅 *طلب مجدول - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `📝 التفاصيل: ${details}\n` +
                           `⏰ وقت التنفيذ: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 مسجل الطلب: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#طلب_مجدول`;
                }
                       
            } else if (currentAddMode === 'maintenance') {
                const details = document.getElementById('inpMaintDetails').value; 
                if (!details) { 
                    showMiniAlert('⚠️ اكتب وصف العطل.', 'warning'); 
                    return; 
                }
                
                if (isImmediateMaint) {
                    waMsg = `🚨 *صيانة عاجلة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `🔧 نوع العطل: ${details}\n` +
                           `⏰ الحالة: عاجلة - تدخل فوري\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 مسجل البلاغ: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة_عاجلة`;
                } else {
                    waMsg = `📅 *صيانة مجدولة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `🔧 نوع العطل: ${details}\n` +
                           `⏰ وقت التنفيذ: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 مسجل البلاغ: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة_مجدولة`;
                }
                       
            } else if (currentAddMode === 'cleaning') {
                const type = document.getElementById('inpRoomType').value; 
                if (!type) { 
                    showMiniAlert('⚠️ اختر حالة الغرفة.', 'warning'); 
                    return; 
                }
                const guestStatus = document.getElementById('inpGuestStatus').value;
                const isSuper = document.getElementById('inpSuperTurbo').checked;
                
                if (type === 'out') {
                    waMsg = `🚨 *تنظيف عاجل (خروج) - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `⚠️ الحالة: النزيل غادر - تنظيف عاجل\n` +
                           `⚡ النظام: ${isSuper ? 'سوبر تيربو (خصم 5 دقائق)' : appState.turbo ? 'تيربو نشط' : 'عادي'}\n` +
                           `⏰ المطلوب: التنظيف الآن (فوري)\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 المشرف: فريق النظافة\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#تنظيف_عاجل`;
                } else {
                    waMsg = `📅 *تنظيف مجدول (ساكن) - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `👤 حالة النزيل: ${guestStatus === 'in' ? 'داخل الغرفة' : 'خارج الغرفة'}\n` +
                           `⚡ النظام: ${isSuper ? 'سوبر تيربو (خصم 5 دقائق)' : appState.turbo ? 'تيربو نشط' : 'عادي'}\n` +
                           `⏰ وقت التنظيف: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 المشرف: فريق النظافة\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#تنظيف_مجدول`;
                }
            }
            
            // إغلاق النافذة فوراً قبل بدء العملية الطويلة
            const addRoomModal = document.getElementById('addRoomModal');
            if (addRoomModal) addRoomModal.style.display = 'none';
            closeModal();
            
            if (waMsg) {
                window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank'); 
            }
            
            const roomType = document.getElementById('inpRoomType').value;
            const isSuper = document.getElementById('inpSuperTurbo').checked;
            const maintDetails = document.getElementById('inpMaintDetails').value;
            const reqDetails = document.getElementById('inpRequestDetails').value;
            const maintFile = document.getElementById('inpMaintImage').files[0];
            
            // تنفيذ العملية في الخلفية بعد إغلاق النافذة
            submitNewEntryToFirebase(currentAddMode, num, isScheduled, schedTimestamp, 
                                          fullTimeString, roomType, isSuper, maintDetails, 
                                    reqDetails, maintFile)
                .then(() => {
                    // إضافة نقاط بعد نجاح العملية
            if (currentAddMode === 'cleaning') {
                addPoints(5, 'إضافة غرفة');
            } else if (currentAddMode === 'request') {
                addPoints(3, 'إضافة طلب');
            } else if (currentAddMode === 'maintenance') {
                addPoints(5, 'إضافة صيانة');
            }
                })
                .catch(e => {
                    console.error("Error in addNewBtnAction:", e);
                });
        }
        
        async function confirmFinishRoom() { 
            if (!db) { 
                showMiniAlert("❌ خطأ: قاعدة البيانات غير متصلة", "error"); 
                return; 
            }
            
            const room = appState.rooms.find(r => r.id === activeRoomId); 
            if (!room) { 
                showMiniAlert("❌ خطأ: الغرفة غير موجودة", "error"); 
                return; 
            }
            
            const status = document.getElementById('modal-notes').value; 
            const isLate = document.getElementById('delay-reason-section').style.display !== 'none'; 
            const delayReason = document.getElementById('modal-delay').value; 
            // تم إزالة inpSendWhatsapp - نستخدم فقط inpAutoSendWhatsappFinish 
            
            if (isLate && (!delayReason || delayReason === '')) { 
                showMiniAlert('⚠️ يجب اختيار سبب التأخير قبل التأكيد!', 'warning'); 
                return; 
            }
            
            // إذا كانت المشكلة بالغرفة، يجب إدخال التفاصيل
            if (delayReason === 'مشكلة بالغرفة') {
                const issueDetails = document.getElementById('room-issue-details').value.trim();
                if (!issueDetails) {
                    showMiniAlert('⚠️ يرجى كتابة تفاصيل المشكلة بالغرفة', 'warning');
                    return;
                }
            } 
            
            const repairDetails = document.getElementById('repair-details-input').value;
            const repairFile = document.getElementById('modal-img-camera-input').files[0];
            
            // Guard: منع إنهاء "جاهزة" إذا يوجد بيانات صيانة
            if (status === 'جاهزة' && (repairDetails || repairFile)) {
                showMiniAlert('❌ لا يمكن الإنهاء كـ "جاهزة" مع وجود بيانات صيانة. امسح بيانات الصيانة أو اختر "صيانة".', 'error'); 
                return;
            }
            
            // Guard: إلزام بيانات الصيانة الكاملة
            if (status === 'تحتاج صيانة' && (!repairDetails || !repairFile)) {
                showMiniAlert('❌ الصيانة تتطلب وصف المشكلة وصورة.', 'error'); 
                return;
            }
            
            // Guard: منع إنهاء "جاهزة" إذا متأخرة والسبب فارغ
            if (status === 'جاهزة' && isLate && (!delayReason || delayReason === '')) {
                showMiniAlert('⚠️ يجب اختيار سبب التأخير قبل التأكيد!', 'warning'); 
                return;
            }
            
            // التحقق من الإرسال التلقائي
            const autoSend = document.getElementById('inpAutoSendWhatsappFinish');
            const shouldSendWhatsapp = autoSend && autoSend.checked && appState.autoSendWhatsApp !== false;
            
            if (shouldSendWhatsapp) {
                const currentDate = new Date().toLocaleDateString('ar-EG', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                let waMsg = '';
                if (status === 'تحتاج صيانة') {
                    waMsg = `🛠️ *تقرير صيانة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${room.num}\n` +
                           `⚠️ الحالة: تحتاج صيانة\n` +
                           `📝 وصف العطل: ${repairDetails}\n` +
                           `⏰ الحالة: ${isLate ? 'متأخرة' : 'في الوقت المحدد'}\n` +
                           `${isLate ? `🔴 سبب التأخير: ${delayReason}\n` : ''}` +
                           `📅 تاريخ الإنهاء: ${currentDate}\n` +
                           `🕒 وقت الإنهاء: ${currentTime}\n` +
                           `👤 مسؤول الإنهاء: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة`;

                } else {
                    if (isLate) {
                        const delayMinutes = Math.floor((Date.now() - room.deadline) / 60000);
                        waMsg = `⏰ *تقرير إنهاء (متأخر) - منظومة Adora*\n` +
                               `🏨 ${HOTEL_CONFIG.name}\n` +
                               `🔢 الغرفة: ${room.num}\n` +
                               `✅ الحالة: جاهزة للتسليم\n` +
                               `⚠️ التأخير: ${delayMinutes} دقيقة\n` +
                               `🔴 سبب التأخير: ${delayReason}${(delayReason === 'مشكلة بالغرفة' && issueDetails) ? `\n📝 تفاصيل المشكلة: ${issueDetails}` : ''}\n` +
                               `📅 تاريخ الإنهاء: ${currentDate}\n` +
                               `🕒 وقت الإنهاء: ${currentTime}\n` +
                               `👤 مسؤول الإنهاء: فريق العمل\n` +
                               `➖➖➖➖➖➖➖➖➖➖\n` +
                               `#إنهاء_متأخر`;
                    } else {
                        waMsg = `✅ *تقرير إنهاء - منظومة Adora*\n` +
                               `🏨 ${HOTEL_CONFIG.name}\n` +
                               `🔢 الغرفة: ${room.num}\n` +
                               `✅ الحالة: جاهزة للتسليم\n` +
                               `⭐ الأداء: في الوقت المحدد\n` +
                               `📅 تاريخ الإنهاء: ${currentDate}\n` +
                               `🕒 وقت الإنهاء: ${currentTime}\n` +
                               `👤 مسؤول الإنهاء: فريق العمل\n` +
                               `➖➖➖➖➖➖➖➖➖➖\n` +
                               `#إنهاء_ناجح`;
                    }
                }
                
                // التحقق من الإرسال التلقائي (تم توحيد الخيارات)
                if (waMsg && shouldSendWhatsapp) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank'); 
                }
            }
            
            // تفعيل حالة التحميل أولاً لمنع الإدخال المتكرر
            setFinishModalLoading(true);
            toggleSyncIndicator(true);
            showLoadingBar();
            
            // تعطيل زر التأكيد لمنع الضغط المتكرر
            const confirmBtn = document.getElementById('btn_confirm_finish');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
                confirmBtn.style.pointerEvents = 'none';
            }
            
            // إخفاء النافذة فوراً لمنع الإدخال المتكرر
            const finishModal = document.getElementById('final-modal');
            if (finishModal) finishModal.style.display = 'none';
            let imgUrl = null;
            
            try {
                if (status !== 'جاهزة' && repairFile) {
                    imgUrl = await uploadToImgBB(repairFile);
                }
                
                if (status === 'تحتاج صيانة') {
                    // إضافة إلى قائمة الصيانة
                    const newMaint = {
                        num: room.num,
                        maintDesc: repairDetails,
                        maintImg: imgUrl,
                        startTime: Date.now(),
                        status: 'active',
                        history: [{
                            action: 'تحويل من التنظيف',
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                        }]
                    };
                    await db.collection('activeMaintenance').doc().set(newMaint, { merge: true });
                }
                
                // إنشاء سجل التنظيف
                const duration = Date.now() - (room.startTime || Date.now());
                const durationMinutes = Math.floor(duration / 60000);
                const durationSeconds = Math.floor((duration % 60000) / 1000);
                
                // التحقق من وجود num صالح
                const roomNum = (room.num !== undefined && room.num !== null && !isNaN(room.num)) 
                    ? parseInt(room.num, 10) 
                    : 0;
                
                const logEntry = {
                    num: roomNum,
                    type: room.type || 'stay',
                    startTime: room.startTime || Date.now(),  // وقت البدء
                    finishTime: Date.now(),
                    duration: `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`,
                    status: status || 'جاهزة',
                    isLate: isLate || false,
                    delayReason: (isLate && delayReason) ? delayReason : null,
                    issueDetails: (delayReason === 'مشكلة بالغرفة' && issueDetails) ? issueDetails : null,
                    id: Date.now(),
                    guestStatus: room.guestStatus || 'in',
                    isSuperTurbo: room.isSuperTurbo || false,
                    maintDesc: (status !== 'جاهزة' && repairDetails) ? repairDetails : null,
                    finishImg: (status !== 'جاهزة' && imgUrl) ? imgUrl : null
                };
                
                // إزالة أي حقول undefined
                Object.keys(logEntry).forEach(key => {
                    if (logEntry[key] === undefined) {
                        delete logEntry[key];
                    }
                });
                
                // استخدام Batch لضمان النزاهة الذرية
                const batch = db.batch();
                const logRef = db.collection('log').doc();
                batch.set(logRef, logEntry, { merge: true });
                
                // حذف الغرفة من القائمة النشطة
                const roomRef = db.collection('rooms').doc(activeRoomId);
                batch.delete(roomRef);
                
                await batch.commit();
                
                // حساب النقاط
                let pointsEarned = 0;
                let pointsReason = '';
                
                if (isLate) {
                    pointsEarned = pointsSystem.late;
                    pointsReason = 'إنهاء متأخر';
                } else {
                    if (room.isSuperTurbo) {
                        pointsEarned = pointsSystem.superTurbo;
                        pointsReason = 'سوبر تيربو';
                    } else {
                        pointsEarned = pointsSystem.onTime;
                        pointsReason = 'إنهاء في الوقت';
                    }
                }
                
                addPoints(pointsEarned, pointsReason);
                
                hideLoadingBar();
                closeModal();
                
                // ✅ إعادة تفعيل زر التأكيد
                const confirmBtn = document.getElementById('btn_confirm_finish');
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.pointerEvents = 'auto';
                }
                
                // ✅ تحديث الواجهة فوراً (إعادة رسم كاملة)
                smartUpdate(true);
                
                // ✅ إعادة تعيين activeRoomId لضمان إمكانية فتح نافذة جديدة
                activeRoomId = null;
                
                // تم حذف showModalSuccess
                playNotificationSound();
                
            } catch(e) {
                console.error("Error finishing room:", e);
                showMiniAlert('❌ فشل إنهاء الغرفة', 'error');
                hideLoadingBar();
                
                // ✅ إعادة تفعيل زر التأكيد حتى في حالة الخطأ
                const confirmBtn = document.getElementById('btn_confirm_finish');
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.pointerEvents = 'auto';
                }
                
                // ✅ إعادة تعيين activeRoomId
                activeRoomId = null;
            } finally {
                toggleSyncIndicator(false);
                setFinishModalLoading(false);
            }
        }
        
        async function confirmCompleteMaintenance() {
            hapticFeedback('heavy');
            
            if (!db) { 
                showMiniAlert("❌ خطأ: قاعدة البيانات غير متصلة", "error"); 
                return; 
            }
            
            const maint = appState.activeMaintenance.find(m => m.id === activeMaintId); 
            if (!maint) { 
                showMiniAlert("❌ خطأ: الصيانة غير موجودة", "error"); 
                return; 
            }
            
            // التحقق من رفع الصورة (إجباري)
                const file = document.getElementById('maint-img-camera-input').files[0];
            if (!file) {
                showMiniAlert("⚠️ يجب رفع صورة للصيانة", "error");
                return;
            }
            
            toggleSyncIndicator(true);
            try {
                let imgUrl = await uploadToImgBB(file);
                
                const finishTime = Date.now();
                const duration = finishTime - maint.startTime;
                const durationHours = Math.floor(duration / 3600000);
                const durationMinutes = Math.floor((duration % 3600000) / 60000);
                
                // إنشاء سجل الصيانة المكتملة
                // التحقق من وجود num صالح
                const roomNum = (maint.num !== undefined && maint.num !== null && !isNaN(maint.num)) 
                    ? parseInt(maint.num, 10) 
                    : (maint.room !== undefined && maint.room !== null && !isNaN(maint.room))
                        ? parseInt(maint.room, 10)
                        : 0;
                
                const completedEntry = {
                    num: roomNum,
                    maintDesc: maint.maintDesc || '',
                    startTime: maint.startTime || finishTime,
                    finishTime: finishTime,
                    duration: `${durationHours}:${durationMinutes.toString().padStart(2, '0')}`,
                    finishImg: imgUrl || '',
                    originalMaintImg: maint.maintImg || null,
                    id: Date.now(),
                    worker: maint.worker || 'غير محدد'
                };
                
                // إزالة أي حقول undefined
                Object.keys(completedEntry).forEach(key => {
                    if (completedEntry[key] === undefined) {
                        delete completedEntry[key];
                    }
                });
                
                // استخدام Batch لضمان النزاهة الذرية
                const batch = db.batch();
                const completedRef = db.collection('completedMaintenanceLog').doc();
                batch.set(completedRef, completedEntry, { merge: true });
                
                // حذف من الصيانة النشطة - استخدام id الصحيح
                const maintRef = db.collection('activeMaintenance').doc(String(activeMaintId));
                batch.delete(maintRef);
                
                await batch.commit();
                
                // تحديث الواجهة مباشرة
                smartUpdate();
                
                // إضافة النقاط
                addPoints(pointsSystem.maintenanceComplete, 'إكمال صيانة');
                
                // إرسال تقرير واتساب
                const currentDate = new Date().toLocaleDateString('ar-EG', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const waMsg = `✅ *تقرير إنهاء صيانة - منظومة Adora*\n` +
                             `🏨 ${HOTEL_CONFIG.name}\n` +
                             `🔢 الغرفة: ${maint.num}\n` +
                             `🔧 نوع الصيانة: ${maint.maintDesc}\n` +
                             `⏰ المدة: ${durationHours} ساعة و ${durationMinutes} دقيقة\n` +
                             `📅 تاريخ الإنهاء: ${currentDate}\n` +
                             `🕒 وقت الإنهاء: ${currentTime}\n` +
                             `👤 مسؤول الإنهاء: فريق الصيانة\n` +
                             `➖➖➖➖➖➖➖➖➖➖\n` +
                             `#صيانة_مكتملة`;
                
                // التحقق من الإرسال التلقائي
                const autoSend = document.getElementById('inpAutoSendWhatsappMaint');
                const shouldSend = (autoSend && autoSend.checked && appState.autoSendWhatsApp);
                
                if (shouldSend) {
                window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
                }
                
                // إغلاق النافذة بشكل صريح
                const maintModal = document.getElementById('complete-maint-modal');
                if (maintModal) {
                    maintModal.style.display = 'none';
                }
                closeModal('complete-maint-modal');
                
                // إعادة تعيين الحقول
                const imgInput = document.getElementById('maint-img-camera-input');
                if (imgInput) imgInput.value = '';
                const uploadedIcon = document.getElementById('maint-img-uploaded-icon');
                if (uploadedIcon) uploadedIcon.style.display = 'none';
                
                // تم حذف showModalSuccess
                playNotificationSound();
                
            } catch(e) {
                console.error("Error completing maintenance:", e);
                showMiniAlert('❌ فشل إنهاء الصيانة', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        async function executePhase(id, type) {
            // البحث في appState.rooms أولاً
            let room = appState.rooms.find(r => r.id === id);
            
            // إذا لم تجد في appState.rooms، ابحث في طلبات النظافة من QR
            if (!room) {
                const cleaningReq = appState.guestRequests.find(r => 
                    r.id === id && 
                    r.requestType === 'cleaning' && 
                    r.roomTracking === true && 
                    r.fromGuest === true
                );
                
                if (cleaningReq) {
                    // إنشاء غرفة من طلب النظافة
                    room = {
                        id: cleaningReq.id,
                        num: cleaningReq.num,
                        type: 'stay',
                        status: 'acknowledging',
                        startTime: cleaningReq.startTime || Date.now(),
                        deadline: (cleaningReq.startTime || Date.now()) + (HOTEL_CONFIG.times.STAY_NORM || 25 * 60000),
                        guestStatus: 'in',
                        isSuperTurbo: false,
                        fromQR: true,
                        originalRequestId: cleaningReq.id
                    };
                    
                    // إضافة الغرفة إلى Firebase إذا لم تكن موجودة
                    if (db) {
                        await db.collection('rooms').doc(cleaningReq.id).set(room, { merge: true });
                    }
                    
                    // إضافة إلى appState.rooms
                    appState.rooms.push(room);
                }
            }
            
            if (!room) return;
            
            // إغلاق النافذة فوراً قبل بدء العملية
            const confirmModal = document.getElementById('action-confirm-modal');
            if (confirmModal) {
                confirmModal.style.display = 'none';
            }
            closeModal('action-confirm-modal');
            
            toggleSyncIndicator(true);
            
            try {
                const now = Date.now();
                const newHistoryLog = {
                    action: type === 'arrival' ? 'الوصول للغرفة' : 'بدء الفحص',
                    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                };
                
                let updateData = {
                    historyLogs: firebase.firestore.FieldValue.arrayUnion(newHistoryLog)
                };
                
                // زر التراجع فقط لأول عملية (arrival) وليس لـ clean
                let baseTime = 0;
                let checkingTime = 0;
                
                if (type === 'arrival') {
                    // تم حذف undoExpiry
                    baseTime = room.isSuperTurbo ? 
                        (room.type === 'out' ? HOTEL_CONFIG.times.OUT_TURBO : HOTEL_CONFIG.times.STAY_TURBO) :
                        (room.type === 'out' ? HOTEL_CONFIG.times.OUT_NORM : HOTEL_CONFIG.times.STAY_NORM);
                    
                    // التيربو يخصم 5 دقائق
                    if (appState.turbo) {
                        baseTime -= 5 * 60000; // خصم 5 دقائق
                    }
                    // وضع التركيز يزيد 5 دقائق
                    if (appState.focusMode) {
                        baseTime += 5 * 60000; // إضافة 5 دقائق
                    }
                    
                    updateData.status = 'cleaning';
                    updateData.deadline = now + baseTime;
                    
                } else if (type === 'clean') {
                    // تم حذف undoExpiry
                    checkingTime = HOTEL_CONFIG.times.CHECKING;
                    
                    // التيربو يخصم 5 دقائق
                    if (appState.turbo) {
                        checkingTime -= 5 * 60000;
                    }
                    // وضع التركيز يزيد 5 دقائق
                    if (appState.focusMode) {
                        checkingTime += 5 * 60000;
                    }
                    
                    updateData.status = 'checking';
                    updateData.deadline = now + checkingTime;
                }
                
                // تحديث الحالة المحلية فوراً قبل Firebase لضمان استجابة فورية
                const roomIndex = appState.rooms.findIndex(r => r.id === id);
                if (roomIndex !== -1) {
                    if (type === 'arrival') {
                        appState.rooms[roomIndex].status = 'cleaning';
                        appState.rooms[roomIndex].deadline = now + baseTime;
                    } else if (type === 'clean') {
                        appState.rooms[roomIndex].status = 'checking';
                        appState.rooms[roomIndex].deadline = now + checkingTime;
                    }
                    if (appState.rooms[roomIndex].historyLogs) {
                        appState.rooms[roomIndex].historyLogs.push(newHistoryLog);
                    } else {
                        appState.rooms[roomIndex].historyLogs = [newHistoryLog];
                    }
                }
                
                // تحديث Firebase
                await db.collection('rooms').doc(id).set(updateData, { merge: true });
                
                // ✅ تحديث الواجهة فوراً (إعادة رسم كاملة لضمان ظهور الحالة الجديدة)
                smartUpdate(true);
                
                showMiniAlert(`✅ ${type === 'arrival' ? 'تم الوصول للغرفة' : 'تم بدء الفحص'}`, 'success');
                addPoints(2, type === 'arrival' ? 'الوصول للغرفة' : 'بدء الفحص');
                    
            } catch(e) {
                console.error("Error executing phase:", e);
                showMiniAlert('❌ فشل تحديث الحالة', 'error');
                // ✅ تحديث الواجهة حتى في حالة الخطأ (إعادة رسم كاملة)
                smartUpdate(true);
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        // تم حذف دالة undoLastAction نهائياً
        
        async function forceStartScheduled(id, type) {
            pendingAction = 'forceStart';
            tempRoomId = id;
            
            let itemName = '';
            if (type === 'room') {
                const room = appState.rooms.find(r => r.id === id);
                itemName = `غرفة ${room?.num || ''}`;
            } else if (type === 'req') {
                const req = appState.guestRequests.find(r => r.id === id);
                itemName = `طلب غرفة ${req?.num || ''}`;
            } else if (type === 'maint') {
                const maint = appState.activeMaintenance.find(m => m.id === id);
                itemName = `صيانة غرفة ${maint?.num || ''}`;
            }
            
            document.getElementById('confirm-message').innerText = `هل تريد بدء ${itemName} الآن؟`;
            document.getElementById('confirm-yes-btn').onclick = async function() {
                // إغلاق النافذة فوراً
                const confirmModal = document.getElementById('action-confirm-modal');
                if (confirmModal) confirmModal.style.display = 'none';
                closeModal();
                
                toggleSyncIndicator(true);
                try {
                    if (type === 'room') {
                        await db.collection('rooms').doc(id).update({
                            status: 'acknowledging',
                            deadline: Date.now() + HOTEL_CONFIG.times.TRAVEL,
                            schedTime: null,
                            schedTimestamp: null
                        });
                    } else if (type === 'req') {
                        await db.collection('guestRequests').doc(id).update({
                            status: 'active',
                            schedTime: null,
                            schedTimestamp: null
                        });
                    } else if (type === 'maint') {
                        await db.collection('activeMaintenance').doc(id).update({
                            status: 'active',
                            schedTime: null,
                            schedTimestamp: null
                        });
                    }
                    
                    showMiniAlert(`✅ تم بدء ${itemName}`, 'success');
                    addPoints(3, 'بدء مجدول الآن');
                    
                } catch(e) {
                    console.error("Error forcing start:", e);
                    showMiniAlert('❌ فشل بدء العنصر', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        async function completeRequest(id) {
            const req = appState.guestRequests.find(r => r.id === id);
            if (!req) {
                showMiniAlert(`❌ ${t('requestFailed')}`, 'error');
                return;
            }
            
            pendingAction = 'completeRequest';
            tempRoomId = id;
            
            // تحديث نصوص النافذة
            const confirmTitle = document.getElementById('confirm-title');
            const confirmMessage = document.getElementById('confirm-message');
            const confirmYesBtn = document.getElementById('confirm-yes-btn');
            const confirmBackBtn = document.getElementById('confirm-back-btn');
            
            // التحقق من وجود num صالح
            const roomNum = (req.num !== undefined && req.num !== null && !isNaN(req.num)) 
                ? parseInt(req.num, 10) 
                : (req.room !== undefined && req.room !== null && !isNaN(req.room))
                    ? parseInt(req.room, 10)
                    : '--';
            
            if (confirmTitle) confirmTitle.textContent = t('confirm');
            if (confirmMessage) confirmMessage.innerText = t('requestConfirm').replace('{room}', roomNum);
            if (confirmYesBtn) confirmYesBtn.textContent = t('yes');
            if (confirmBackBtn) confirmBackBtn.textContent = t('back');
            
            // فتح النافذة
            const confirmModal = document.getElementById('action-confirm-modal');
            if (confirmModal) confirmModal.style.display = 'flex';
            
            // إزالة أي معالجات سابقة وإضافة معالج جديد
            if (confirmYesBtn) {
                // إزالة جميع المعالجات السابقة
                const newYesBtn = confirmYesBtn.cloneNode(true);
                confirmYesBtn.parentNode.replaceChild(newYesBtn, confirmYesBtn);
                
                newYesBtn.onclick = async function() {
                // إخفاء النافذة فوراً لمنع الإدخال المتكرر
                const confirmModal = document.getElementById('action-confirm-modal');
                if (confirmModal) confirmModal.style.display = 'none';
                
                showLoadingBar();
                toggleSyncIndicator(true);
                try {
                    const now = Date.now();
                    const duration = now - (req.startTime || now);
                    const durationMinutes = Math.floor(duration / 60000);
                    const durationSeconds = Math.floor((duration % 60000) / 1000);
                    
                    // حفظ في سجل الطلبات
                    // التحقق من وجود num صالح (لإصلاح مشكلة undefined)
                    const roomNum = (req.num !== undefined && req.num !== null && !isNaN(req.num)) 
                        ? parseInt(req.num, 10) 
                        : (req.room !== undefined && req.room !== null && !isNaN(req.room))
                            ? parseInt(req.room, 10)
                            : 0;
                    
                    const logEntry = {
                        num: roomNum,
                        details: req.details || '',
                        startTime: req.startTime || now,  // وقت البدء
                        duration: `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`,
                        finishTime: now,
                        isUrgent: req.isUrgent || false,
                        type: 'request',
                        id: now,
                        fromGuest: req.fromGuest || false
                    };
                    
                    // إزالة أي حقول undefined
                    Object.keys(logEntry).forEach(key => {
                        if (logEntry[key] === undefined) {
                            delete logEntry[key];
                        }
                    });
                    
                    // استخدام Batch لضمان النزاهة الذرية
                    const batch = db.batch();
                    const logRef = db.collection('guestRequestsLog').doc();
                    batch.set(logRef, logEntry, { merge: true });
                    
                    // حذف من الطلبات النشطة - استخدام id الصحيح
                    const reqRef = db.collection('guestRequests').doc(String(id));
                    batch.delete(reqRef);
                    
                    await batch.commit();
                    
                    // تحديث الواجهة مباشرة
                    smartUpdate();
                    
                    // إضافة النقاط
                    const points = req.isUrgent ? pointsSystem.urgentRequest : pointsSystem.onTime;
                    addPoints(points, req.isUrgent ? 'طلب عاجل' : 'طلب عادي');
                    
                    // تم إلغاء الإرسال التلقائي للواتساب في طلبات النزلاء
                    // يمكن إضافة خيار إرسال يدوي لاحقاً إذا لزم الأمر
                    
                    showMiniAlert(`✅ ${t('requestCompleted').replace('{room}', roomNum)}`, 'success');
                    playNotificationSound();
                    
                } catch(e) {
                    console.error("Error completing request:", e);
                    showMiniAlert(`❌ ${t('requestFailed')}`, 'error');
                } finally {
                    hideLoadingBar();
                    toggleSyncIndicator(false);
                }
                };
            }
        }
        
        function checkPasswordAndAction() {
            const entered = document.getElementById('admin-password').value;
            
            // تم حذف كلمة المرور - السماح بالدخول دائماً
            if (HOTEL_CONFIG.adminHash === null || simpleHash(entered) === HOTEL_CONFIG.adminHash) {
                // إغلاق نافذة كلمة المرور بشكل صريح
                const passwordModal = document.getElementById('password-modal');
                if (passwordModal) {
                    passwordModal.style.display = 'none';
                }
                closeModal('password-modal');
                
                // مسح حقل كلمة المرور
                const passwordInput = document.getElementById('admin-password');
                if (passwordInput) {
                    passwordInput.value = '';
                }
                
                if (pendingAction === 'clearLog') {
                    clearLogAction();
                } else if (pendingAction === 'newShift') {
                    newShiftAction();
                } else if (pendingAction === 'clearPurchases') {
                    // تم التعامل معه بالفعل
                } else if (pendingAction === 'clearAllData') {
                    clearAllDataAction();
                }
            } else {
                showMiniAlert('❌ كلمة المرور غير صحيحة', 'error');
            }
        }
        
        async function clearLogAction() {
            pendingAction = 'confirmClearLog';
            
            // التأكد من إغلاق نافذة كلمة المرور أولاً
            const passwordModal = document.getElementById('password-modal');
            if (passwordModal) {
                passwordModal.style.display = 'none';
            }
            closeModal('password-modal');
            
            const confirmMessage = document.getElementById('confirm-message');
            const confirmYesBtn = document.getElementById('confirm-yes-btn');
            const confirmModal = document.getElementById('action-confirm-modal');
            
            if (!confirmMessage || !confirmYesBtn || !confirmModal) {
                console.error('Confirm modal elements not found');
                return;
            }
            
            confirmMessage.innerText = 'هل تريد مسح سجل اليوم بالكامل؟ لا يمكن التراجع عن هذا الإجراء.';
            
            // إزالة أي معالجات سابقة وإضافة معالج جديد
            const newBtn = confirmYesBtn.cloneNode(true);
            confirmYesBtn.parentNode.replaceChild(newBtn, confirmYesBtn);
            
            newBtn.onclick = async function() {
                // إغلاق النافذة فوراً
                if (confirmModal) confirmModal.style.display = 'none';
                closeModal('action-confirm-modal');
                
                toggleSyncIndicator(true);
                try {
                    // حذف جميع السجلات من Firebase
                    const batch = db.batch();
                    
                    // حذف سجل التنظيف
                    const logSnapshot = await db.collection('log').get();
                    logSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    // حذف سجل الطلبات
                    const reqLogSnapshot = await db.collection('guestRequestsLog').get();
                    reqLogSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    // حذف سجل الصيانة المكتملة
                    const maintLogSnapshot = await db.collection('completedMaintenanceLog').get();
                    maintLogSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    
                    showMiniAlert('🗑️ تم مسح السجل بالكامل', 'success');
                    addPoints(-10, 'مسح السجل');
                    
                } catch(e) {
                    console.error("Error clearing log:", e);
                    showMiniAlert('❌ فشل مسح السجل', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        async function newShiftAction() {
            pendingAction = 'confirmNewShift';
            
            // التأكد من إغلاق نافذة كلمة المرور أولاً
            const passwordModal = document.getElementById('password-modal');
            if (passwordModal) {
                passwordModal.style.display = 'none';
            }
            closeModal('password-modal');
            
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            let message = 'هل تريد بدء شفت جديد؟\n\n';
            message += `🧹 غرف نشطة: ${activeRooms}\n`;
            message += `🛎️ طلبات نشطة: ${activeRequests}\n`;
            message += `🛠️ صيانة نشطة: ${activeMaintenance}\n\n`;
            message += 'سيتم نقل جميع المهام النشطة إلى الأرشيف.';
            
            const confirmMessage = document.getElementById('confirm-message');
            const confirmYesBtn = document.getElementById('confirm-yes-btn');
            const confirmModal = document.getElementById('action-confirm-modal');
            
            if (!confirmMessage || !confirmYesBtn || !confirmModal) {
                console.error('Confirm modal elements not found');
                return;
            }
            
            confirmMessage.innerText = message;
            
            // إزالة أي معالجات سابقة وإضافة معالج جديد
            const newBtn = confirmYesBtn.cloneNode(true);
            confirmYesBtn.parentNode.replaceChild(newBtn, confirmYesBtn);
            
            newBtn.onclick = async function() {
                // إغلاق النافذة فوراً
                if (confirmModal) confirmModal.style.display = 'none';
                closeModal('action-confirm-modal');
                
                toggleSyncIndicator(true);
                try {
                    const now = Date.now();
                    const batch = db.batch();
                    
                    // أرشفة الغرف النشطة
                    const roomsSnapshot = await db.collection('rooms').where('status', '!=', 'scheduled').get();
                    roomsSnapshot.forEach(doc => {
                        const room = doc.data();
                        const logEntry = {
                            num: room.num,
                            type: room.type,
                            finishTime: now,
                            status: 'ملغاة - بداية شفت جديد',
                            isLate: true,
                            id: now + Math.random(),
                            guestStatus: room.guestStatus,
                            isSuperTurbo: room.isSuperTurbo
                        };
                        
                        // إضافة إلى السجل
                        const logRef = db.collection('log').doc();
                        batch.set(logRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    // أرشفة الطلبات النشطة
                    const requestsSnapshot = await db.collection('guestRequests').where('status', '!=', 'scheduled').get();
                    requestsSnapshot.forEach(doc => {
                        const req = doc.data();
                        const logEntry = {
                            num: req.num,
                            details: req.details,
                            finishTime: now,
                            isUrgent: req.isUrgent,
                            status: 'ملغاة - بداية شفت جديد',
                            id: now + Math.random()
                        };
                        
                        // إضافة إلى سجل الطلبات
                        const reqLogRef = db.collection('guestRequestsLog').doc();
                        batch.set(reqLogRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    // أرشفة الصيانة النشطة
                    const maintenanceSnapshot = await db.collection('activeMaintenance').where('status', '!=', 'scheduled').get();
                    maintenanceSnapshot.forEach(doc => {
                        const maint = doc.data();
                        const logEntry = {
                            num: maint.num,
                            maintDesc: maint.maintDesc,
                            finishTime: now,
                            status: 'ملغاة - بداية شفت جديد',
                            id: now + Math.random()
                        };
                        
                        // إضافة إلى سجل الصيانة
                        const maintLogRef = db.collection('completedMaintenanceLog').doc();
                        batch.set(maintLogRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    
                    // إنشاء تقرير الشفت
                    const currentDate = new Date().toLocaleDateString('ar-EG', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    const waMsg = `🌅 *بداية شفت جديد - منظومة Adora*\n` +
                                 `🏨 ${HOTEL_CONFIG.name}\n` +
                                 `📅 التاريخ: ${currentDate}\n` +
                                 `🕒 الوقت: ${currentTime}\n` +
                                 `📊 إحصائيات الشفت السابق:\n` +
                                 `   🧹 غرف أرشفة: ${activeRooms}\n` +
                                 `   🛎️ طلبات أرشفة: ${activeRequests}\n` +
                                 `   🛠️ صيانة أرشفة: ${activeMaintenance}\n` +
                                 `➖➖➖➖➖➖➖➖➖➖\n` +
                                 `🔥 بداية شفت جديد - جاهز للعمل!\n` +
                                 `➖➖➖➖➖➖➖➖➖➖\n` +
                                 `👤 المشرف: فريق العمل\n` +
                                 `#بداية_شفت`;
                    
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
                    
                    showMiniAlert('🌅 تم بدء شفت جديد بنجاح', 'success');
                    addPoints(20, 'بداية شفت جديد');
                    
                } catch(e) {
                    console.error("Error starting new shift:", e);
                    showMiniAlert('❌ فشل بدء الشفت الجديد', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        // ===============================================
        // == صفحة التقارير المتقدمة ====================
        // ===============================================
        
        function showAdvancedReports() {
            toggleSideMenu();
            document.getElementById('advanced-reports-modal').style.display = 'flex';
            switchReportTab('productivity');
        }
        
        function closeAdvancedReports() {
            document.getElementById('advanced-reports-modal').style.display = 'none';
        }
        
        function switchReportTab(tab) {
            // تحديث الأزرار
            document.querySelectorAll('.report-tab').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
            
            const content = document.getElementById('report-content');
            if (!content) return;
            
            if (tab === 'productivity') {
                renderProductivityReport(content);
            } else if (tab === 'timing') {
                renderTimingReport(content);
            } else if (tab === 'delays') {
                renderDelaysReport(content);
            } else if (tab === 'requests') {
                renderRequestsReport(content);
            } else if (tab === 'maintenance') {
                renderMaintenanceReport(content);
            }
        }
        
        function renderProductivityReport(container) {
            // حساب الإنتاجية لكل عامل
            const workerStats = {};
            
            // من سجل التنظيف
            appState.log.forEach(log => {
                const worker = log.worker || 'غير محدد';
                if (!workerStats[worker]) {
                    workerStats[worker] = { rooms: 0, requests: 0, maintenance: 0, totalTime: 0 };
                }
                workerStats[worker].rooms++;
                if (log.duration) {
                    const [mins, secs] = log.duration.split(':').map(Number);
                    workerStats[worker].totalTime += (mins * 60 + secs) * 1000;
                }
            });
            
            // من سجل الطلبات
            (appState.guestRequestsLog || []).forEach(req => {
                const worker = req.worker || 'غير محدد';
                if (!workerStats[worker]) {
                    workerStats[worker] = { rooms: 0, requests: 0, maintenance: 0, totalTime: 0 };
                }
                workerStats[worker].requests++;
            });
            
            // من سجل الصيانة
            (appState.completedMaintenanceLog || []).forEach(maint => {
                const worker = maint.worker || 'غير محدد';
                if (!workerStats[worker]) {
                    workerStats[worker] = { rooms: 0, requests: 0, maintenance: 0, totalTime: 0 };
                }
                workerStats[worker].maintenance++;
            });
            
            const workers = Object.entries(workerStats).map(([name, stats]) => ({
                name,
                total: stats.rooms + stats.requests + stats.maintenance,
                rooms: stats.rooms,
                requests: stats.requests,
                maintenance: stats.maintenance,
                avgTime: stats.rooms > 0 ? Math.round(stats.totalTime / stats.rooms / 60000) : 0
            })).sort((a, b) => b.total - a.total);
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(0,188,212,0.1), rgba(76,175,80,0.1)); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--primary);">👷 إنتاجية العمال</h4>
                    <div style="display: grid; gap: 12px;">
                        ${workers.length > 0 ? workers.map(w => `
                            <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid var(--border-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <strong style="font-size: 1.1rem;">${w.name}</strong>
                                    <span style="background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 700;">${w.total} عملية</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
                                    <div>🧹 ${w.rooms} غرفة</div>
                                    <div>🛎️ ${w.requests} طلب</div>
                                    <div>🛠️ ${w.maintenance} صيانة</div>
                                </div>
                                ${w.avgTime > 0 ? `<div style="margin-top: 8px; color: var(--text-sec); font-size: 0.85rem;">⏱️ متوسط الوقت: ${w.avgTime} دقيقة</div>` : ''}
                            </div>
                        `).join('') : '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا توجد بيانات</p>'}
                    </div>
                </div>
            `;
        }
        
        function renderTimingReport(container) {
            // حساب متوسط وقت الغرفة
            const roomTimes = appState.log
                .filter(log => log.duration && log.type)
                .map(log => {
                    const [mins, secs] = (log.duration || '0:00').split(':').map(Number);
                    return { type: log.type, time: mins * 60 + secs };
                });
            
            const outTimes = roomTimes.filter(r => r.type === 'out').map(r => r.time);
            const stayTimes = roomTimes.filter(r => r.type === 'stay').map(r => r.time);
            
            const avgOut = outTimes.length > 0 ? Math.round(outTimes.reduce((a, b) => a + b, 0) / outTimes.length / 60) : 0;
            const avgStay = stayTimes.length > 0 ? Math.round(stayTimes.reduce((a, b) => a + b, 0) / stayTimes.length / 60) : 0;
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1)); padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--primary);">⏱️ متوسط وقت الغرفة</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid var(--danger);">
                            <div style="font-size: 0.9rem; color: var(--text-sec); margin-bottom: 8px;">🚨 خروج</div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--danger);">${avgOut}</div>
                            <div style="font-size: 0.85rem; color: var(--text-sec); margin-top: 5px;">دقيقة</div>
                            <div style="font-size: 0.75rem; color: var(--text-sec); margin-top: 8px;">${outTimes.length} عملية</div>
                        </div>
                        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid var(--primary);">
                            <div style="font-size: 0.9rem; color: var(--text-sec); margin-bottom: 8px;">🏠 ساكن</div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${avgStay}</div>
                            <div style="font-size: 0.85rem; color: var(--text-sec); margin-top: 5px;">دقيقة</div>
                            <div style="font-size: 0.75rem; color: var(--text-sec); margin-top: 8px;">${stayTimes.length} عملية</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderDelaysReport(container) {
            // حساب التأخيرات
            const today = new Date().setHours(0, 0, 0, 0);
            const delayedRooms = appState.log.filter(log => {
                if (!log.finishTime || log.finishTime < today) return false;
                const deadline = log.deadline || log.startTime + (log.type === 'out' ? 30 : 20) * 60000;
                return log.finishTime > deadline;
            });
            
            const delayReasons = {};
            delayedRooms.forEach(room => {
                const reason = room.delayReason || 'غير محدد';
                delayReasons[reason] = (delayReasons[reason] || 0) + 1;
            });
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.1)); padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--danger);">⚠️ التأخيرات</h4>
                    <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger); text-align: center; margin-bottom: 5px;">${delayedRooms.length}</div>
                        <div style="text-align: center; color: var(--text-sec); font-size: 0.9rem;">غرفة متأخرة اليوم</div>
                    </div>
                    <div style="display: grid; gap: 10px;">
                        <h5 style="margin: 0 0 10px 0; color: var(--text-main);">أسباب التأخير:</h5>
                        ${Object.entries(delayReasons).length > 0 ? Object.entries(delayReasons)
                            .sort((a, b) => b[1] - a[1])
                            .map(([reason, count]) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(239,68,68,0.05); border-radius: 8px;">
                                    <span>${reason}</span>
                                    <span style="font-weight: 700; color: var(--danger);">${count}</span>
                                </div>
                            `).join('') : '<p style="text-align: center; color: var(--text-sec); padding: 10px;">لا توجد تأخيرات</p>'}
                    </div>
                </div>
            `;
        }
        
        function renderRequestsReport(container) {
            // الطلبات الأكثر انتشاراً
            const requestCounts = {};
            (appState.guestRequestsLog || []).forEach(req => {
                const details = (req.details || 'طلب عام').toLowerCase().trim();
                requestCounts[details] = (requestCounts[details] || 0) + 1;
            });
            
            const topRequests = Object.entries(requestCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.1)); padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--request-color);">🛎️ الطلبات الأكثر انتشاراً</h4>
                    <div style="display: grid; gap: 10px;">
                        ${topRequests.length > 0 ? topRequests.map(([request, count], index) => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 8px; border: 2px solid var(--border-color);">
                                <div style="width: 30px; height: 30px; background: var(--request-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem;">${index + 1}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; color: var(--text-main);">${request}</div>
                                </div>
                                <div style="background: var(--request-color); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 0.9rem;">${count}</div>
                            </div>
                        `).join('') : '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا توجد بيانات</p>'}
                    </div>
                </div>
            `;
        }
        
        function renderMaintenanceReport(container) {
            // نسبة الصيانة
            const totalRooms = appState.log.length;
            const maintenanceCount = (appState.completedMaintenanceLog || []).length;
            const maintenanceRate = totalRooms > 0 ? ((maintenanceCount / totalRooms) * 100).toFixed(1) : 0;
            
            // أكثر المشاكل تكراراً
            const maintIssues = {};
            (appState.completedMaintenanceLog || []).forEach(maint => {
                const issue = (maint.maintDesc || 'مشكلة عامة').toLowerCase().trim();
                maintIssues[issue] = (maintIssues[issue] || 0) + 1;
            });
            
            const topIssues = Object.entries(maintIssues)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(220,38,38,0.1), rgba(185,28,28,0.1)); padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0 0 15px 0; color: var(--maint-color);">🛠️ نسبة الصيانة</h4>
                    <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: var(--maint-color); margin-bottom: 5px;">${maintenanceRate}%</div>
                        <div style="color: var(--text-sec); font-size: 0.9rem;">${maintenanceCount} من ${totalRooms} غرفة</div>
                    </div>
                    <div>
                        <h5 style="margin: 0 0 10px 0; color: var(--text-main);">أكثر المشاكل تكراراً:</h5>
                        <div style="display: grid; gap: 8px;">
                            ${topIssues.length > 0 ? topIssues.map(([issue, count]) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(220,38,38,0.05); border-radius: 8px;">
                                    <span>${issue}</span>
                                    <span style="font-weight: 700; color: var(--maint-color);">${count}</span>
                                </div>
                            `).join('') : '<p style="text-align: center; color: var(--text-sec); padding: 10px;">لا توجد بيانات</p>'}
                        </div>
                    </div>
                </div>
            `;
        }
        
        function generateDailyReport() {
            const outDone = appState.log.filter(item => item.type === 'out').length;
            const stayDone = appState.log.filter(item => item.type === 'stay').length;
            const reqDone = appState.guestRequestsLog ? appState.guestRequestsLog.length : 0;
            const maintDone = appState.completedMaintenanceLog ? appState.completedMaintenanceLog.length : 0;
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            const currentDate = new Date().toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let report = `📊 *تقرير المدير - منظومة Adora*\n\n` +
                        `🏨 *الفندق:* ${HOTEL_CONFIG.name}\n` +
                        `📅 *التاريخ:* ${currentDate}\n` +
                        `🕐 *الوقت:* ${currentTime}\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `📈 *الإنجازات:*\n` +
                        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                        `🚪 خروج: *${outDone}* غرفة\n` +
                        `🏠 ساكن: *${stayDone}* غرفة\n` +
                        `🛎️ طلبات: *${reqDone}* طلب\n` +
                        `🔧 صيانة: *${maintDone}* إصلاح\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `📊 *الحالة الحالية:*\n` +
                        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                        `🟢 نشط: *${activeRooms}* غرفة\n` +
                        `🔴 متأخر: *${lateRooms}* غرفة\n` +
                        `🚨 طلبات عاجلة: *${activeRequests}* طلب\n` +
                        `🛠️ صيانة نشطة: *${activeMaintenance}* إصلاح\n` +
                        `🏆 النقاط: *${appState.points}*\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `⭐ *التقييم:* ${getPerformanceRating(outDone + stayDone)}\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `👤 *مقدم التقرير:* المدير\n\n` +
                        `#تقرير_المدير`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert('📊 تم إنشاء تقرير المدير', 'success');
            addPoints(15, 'تقرير المدير');
        }
        
        function getPerformanceRating(totalCompleted) {
            if (totalCompleted >= 20) return 'ممتاز ⭐⭐⭐⭐⭐';
            if (totalCompleted >= 15) return 'جيد جداً ⭐⭐⭐⭐';
            if (totalCompleted >= 10) return 'جيد ⭐⭐⭐';
            if (totalCompleted >= 5) return 'مقبول ⭐⭐';
            return 'ضعيف ⭐';
        }
        
        // ===============================================
        // == استماع Firebase في الوقت الحقيقي ===========
        // ===============================================

        function setupFirebaseListeners() {
            if (!db) return;
            
            // استماع للغرف - محسّن مع docChanges
            let isFirstLoad = true;
            db.collection('rooms').onSnapshot(snapshot => {
                // تحديث appState.rooms أولاً
                snapshot.docChanges().forEach(change => {
                    const roomData = { id: change.doc.id, ...change.doc.data() };
                    
                    // تم حذف كود undoExpiry
                    
                    if (change.type === 'added') {
                        // إضافة غرفة جديدة
                        const existingIndex = appState.rooms.findIndex(r => r.id === roomData.id);
                        if (existingIndex === -1) {
                            appState.rooms.push(roomData);
                        }
                    } else if (change.type === 'modified') {
                        // تحديث غرفة موجودة
                        const index = appState.rooms.findIndex(r => r.id === roomData.id);
                        if (index !== -1) {
                            appState.rooms[index] = roomData;
                        } else {
                    appState.rooms.push(roomData);
                        }
                    } else if (change.type === 'removed') {
                        // حذف غرفة
                        appState.rooms = appState.rooms.filter(r => r.id !== roomData.id);
                    }
                });
                
                // تم حذف كود undoExpiry
                if (isFirstLoad) {
                    isFirstLoad = false;
                    smartUpdate(true); // إعادة رسم كاملة
                } else {
                    // بعد ذلك، تحديث جزئي فقط
                    smartUpdate(false);
                }
            }, error => {
                console.error("Rooms listener error:", error);
                updateSyncIndicator('offline');
            });
            
            // استماع للسجل
            db.collection('log').onSnapshot(snapshot => {
                appState.log = [];
                snapshot.forEach(doc => {
                    appState.log.push({ id: doc.id, ...doc.data() });
                });
                renderLogSection();
                updateNewStats();
            }, error => {
                console.error("Log listener error:", error);
            });
            
            // استماع للصيانة النشطة - محسّن
            db.collection('activeMaintenance').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const maintData = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added' || change.type === 'modified') {
                        const index = appState.activeMaintenance.findIndex(m => m.id === maintData.id);
                        if (index !== -1) {
                            appState.activeMaintenance[index] = maintData;
                        } else {
                            appState.activeMaintenance.push(maintData);
                        }
                    } else if (change.type === 'removed') {
                        appState.activeMaintenance = appState.activeMaintenance.filter(m => m.id !== maintData.id);
                    }
                });
                smartUpdate(false);
            }, error => {
                console.error("Maintenance listener error:", error);
                updateSyncIndicator('offline');
            });
            
            // استماع للصيانة المكتملة
            db.collection('completedMaintenanceLog').onSnapshot(snapshot => {
                appState.completedMaintenanceLog = [];
                snapshot.forEach(doc => {
                    appState.completedMaintenanceLog.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Completed maintenance listener error:", error);
            });
            
            // استماع للطلبات النشطة - محسّن
            db.collection('guestRequests').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const reqData = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added' || change.type === 'modified') {
                        const index = appState.guestRequests.findIndex(r => r.id === reqData.id);
                        if (index !== -1) {
                            appState.guestRequests[index] = reqData;
                        } else {
                            appState.guestRequests.push(reqData);
                        }
                        
                        // تحويل طلبات النظافة من QR إلى غرف في Firebase تلقائياً
                        if (change.type === 'added' && 
                            reqData.requestType === 'cleaning' && 
                            reqData.roomTracking === true && 
                            reqData.fromGuest === true &&
                            reqData.status !== 'scheduled' && 
                            reqData.status !== 'completed') {
                            
                            // التحقق من عدم وجود غرفة بنفس ID في Firebase
                            db.collection('rooms').doc(reqData.id).get().then(roomDoc => {
                                if (!roomDoc.exists) {
                                    // إنشاء غرفة من طلب النظافة
                                    const roomFromRequest = {
                                        id: reqData.id,
                                        num: reqData.num,
                                        type: 'stay', // افتراضي ساكن
                                        status: 'acknowledging', // تبدأ بحالة "الوصول للغرفة"
                                        startTime: reqData.startTime || Date.now(),
                                        deadline: (reqData.startTime || Date.now()) + (HOTEL_CONFIG.times.STAY_NORM || 25 * 60000),
                                        guestStatus: 'in', // افتراضي داخل
                                        isSuperTurbo: false,
                                        fromQR: true, // علامة أن الغرفة جاءت من QR
                                        originalRequestId: reqData.id, // حفظ ID الطلب الأصلي
                                        historyLogs: [{ 
                                            action: 'طلب نظافة من QR', 
                                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                                        }]
                                    };
                                    
                                    // إضافة الغرفة إلى Firebase
                                    db.collection('rooms').doc(reqData.id).set(roomFromRequest, { merge: true })
                                        .catch(err => {
                                            console.error('Error converting QR cleaning request to room:', err);
                                        });
                                }
                            }).catch(err => {
                                console.error('Error checking room existence:', err);
                            });
                        }
                    } else if (change.type === 'removed') {
                        appState.guestRequests = appState.guestRequests.filter(r => r.id !== reqData.id);
                    }
                });
                renderGuestRequests();
                smartUpdate(false);
            }, error => {
                console.error("Guest requests listener error:", error);
                updateSyncIndicator('offline');
            });
            
            // استماع لسجل الطلبات
            db.collection('guestRequestsLog').onSnapshot(snapshot => {
                appState.guestRequestsLog = [];
                snapshot.forEach(doc => {
                    appState.guestRequestsLog.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Guest requests log listener error:", error);
            });
            
            // استماع للإعدادات العامة
            db.collection('settings').doc('globalState').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    appState.turbo = data.turbo || false;
                    appState.archiveViewLimit = data.archiveViewLimit || { req: 5, maint: 5 };
                    appState.logViewLimit = data.logViewLimit || 3;
                    appState.logStep = data.logStep || 3;
                    appState.points = data.points || 0;
                    
                    const turboBtn = document.getElementById('turbo-mode-btn');
                    if (turboBtn) {
                        turboBtn.classList.toggle('turbo-active', appState.turbo);
                    }
                    updatePointsDisplay();
                }
            }, error => {
                console.error("Settings listener error:", error);
            });
        }
        
        // ===============================================
        // == تهيئة التطبيق =============================
        // ===============================================
        
        function initApp() {
            // تهيئة اللغة
            initLanguage();
            
            // تحميل النقاط
            loadPoints();
            
            // تحميل قائمة المشتريات
            loadPurchasesFromStorage();
            
            // تهيئة FAB Draggable (يتم استدعاؤها بعد تعريف الدالة)
            setTimeout(() => {
                if (typeof initFABDraggable === 'function') {
                    initFABDraggable();
                }
            }, 500);
            
            // إعداد مستمعي Firebase
            setupFirebaseListeners();
            
            // تحديث المؤقتات كل ثانية
            setInterval(updateTimersDOM, 1000);
            
            // تحديث الإحصائيات كل 30 ثانية
            setInterval(updateNewStats, 30000);
            
            // فحص الصيانة الدورية كل ساعة
            setInterval(checkRecurringMaintenance, 60 * 60 * 1000);
            checkRecurringMaintenance(); // فحص فوري عند البدء
            
            // ============ Anti-Idle Detection (كشف الخمول) ============
            let lastActivityTime = Date.now();
            let idleWarningShown = false;
            
            // تسجيل النشاط
            ['touchstart', 'click', 'scroll', 'keypress'].forEach(eventType => {
                document.addEventListener(eventType, () => {
                    lastActivityTime = Date.now();
                    idleWarningShown = false;
                });
            });
            
            // فحص الخمول كل دقيقة
            setInterval(() => {
                const idleTime = Date.now() - lastActivityTime;
                const idleMinutes = Math.floor(idleTime / 60000);
                
                // تحذير بعد 10 دقائق خمول
                if (idleMinutes >= 10 && !idleWarningShown && appState.rooms.length > 0) {
                    showMiniAlert('⚠️ تنبيه: لا يوجد نشاط منذ 10 دقائق', 'warning');
                    hapticFeedback('heavy');
                    idleWarningShown = true;
                    
                    // تسجيل الخمول في السجل
                    console.log(`⏸️ Idle detected: ${idleMinutes} minutes`);
                }
                
                // تحديث مؤشر الخمول في الواجهة
                const idleIndicator = document.getElementById('idle-indicator');
                if (idleIndicator) {
                    if (idleMinutes >= 5) {
                        idleIndicator.style.display = 'block';
                        idleIndicator.innerText = `⏸️ خامل: ${idleMinutes} د`;
                    } else {
                        idleIndicator.style.display = 'none';
                    }
                }
            }, 60000); // كل دقيقة
            
            // تطبيق الثيم الديناميكي عند البدء (تم تعطيله مؤقتاً)
            // applyDynamicTheme();
            
            // تحديث الثيم كل ساعة
            // setInterval(applyDynamicTheme, 60 * 60 * 1000);
            
            // ============ التقرير الآلي الساعة 8 مساءً (Auto Report 8PM) ============
            setInterval(() => {
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                
                // إذا كانت الساعة 8:00 مساءً (20:00)
                if (hour === 20 && minute === 0) {
                    // التحقق من أننا لم نرسل تقرير اليوم
                    const lastReportDate = localStorage.getItem('lastAutoReportDate');
                    const today = now.toDateString();
                    
                    if (lastReportDate !== today) {
                        sendAutoReport8PM();
                        localStorage.setItem('lastAutoReportDate', today);
                    }
                }
            }, 60000); // فحص كل دقيقة
            
            
            // إعداد أحداث الكاميرا
            setupCameraEvents();
            
            // جعل التطبيق متاحاً كتطبيق PWA
            // ServiceWorker يعمل فقط في بيئة http:// أو https:// (وليس file://)
            if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(err => {
                        // تجاهل الخطأ بصمت (يحدث عادة في بيئة التطوير)
                        // console.log('ServiceWorker registration failed: ', err);
                    });
                });
            }
            
            // منع التحديث العرضي
            window.addEventListener('beforeunload', (e) => {
                if (appState.rooms.length > 0 || appState.guestRequests.length > 0 || appState.activeMaintenance.length > 0) {
                    e.preventDefault();
                    e.returnValue = 'لديك مهام نشطة. هل تريد حقاً مغادرة الصفحة؟';
                }
            });
        }
        
        function setupCameraEvents() {
            // كاميرا الصيانة في المودال
            const modalCameraBtn = document.getElementById('modal-img-camera-input');
            if (modalCameraBtn) {
                modalCameraBtn.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        showMiniAlert('📷 تم اختيار صورة', 'success');
                    }
                });
            }
            
            // كاميرا الصيانة العامة
            const maintCameraBtn = document.getElementById('maint-img-camera-input');
            if (maintCameraBtn) {
                maintCameraBtn.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        const label = maintCameraBtn.previousElementSibling;
                        const uploadedIcon = document.getElementById('maint-img-uploaded-icon');
                        if (label) {
                            label.classList.add('uploaded');
                            label.style.borderColor = 'var(--success)';
                            label.style.borderWidth = '2px';
                            label.style.borderStyle = 'solid';
                        }
                        if (uploadedIcon) {
                            uploadedIcon.style.display = 'block';
                        }
                        showMiniAlert('📷 تم اختيار صورة', 'success');
                    }
                });
            }
            
            // كاميرا إضافة الصيانة
            const inpMaintImage = document.getElementById('inpMaintImage');
            if (inpMaintImage) {
                inpMaintImage.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        showMiniAlert('📷 تم اختيار صورة الصيانة', 'success');
                    }
                });
            }
        }
        
        // فحص الصيانة الدورية وإنشاء مهام جديدة
        function checkRecurringMaintenance() {
            if (!db) return;
            
            const completedMaint = appState.completedMaintenanceLog || [];
            const today = Date.now();
            
            completedMaint.forEach(maint => {
                if (maint.recurring && maint.recurringDays) {
                    const nextDue = maint.finishTime + (maint.recurringDays * 24 * 60 * 60 * 1000);
                    
                    // إذا حان موعد الصيانة الدورية
                    if (today >= nextDue) {
                        // التحقق من عدم وجود صيانة نشطة لنفس الغرفة
                        const existingMaint = appState.activeMaintenance.find(m => 
                            m.num == maint.num && m.maintDesc === maint.maintDesc
                        );
                        
                        if (!existingMaint) {
                            // إنشاء صيانة دورية جديدة
                            const newMaint = {
                                id: Date.now(),
                                num: maint.num,
                                maintDesc: `🔄 ${maint.maintDesc}`,
                                status: 'scheduled',
                                schedTimestamp: today,
                                recurring: true,
                                recurringDays: maint.recurringDays,
                                startTime: today
                            };
                            
                            appState.activeMaintenance.push(newMaint);
                            
                            // حفظ في Firebase
                            db.collection('activeMaintenance').doc(String(newMaint.id)).set(newMaint, {merge: true})
                                .then(() => {
                                    showMiniAlert(`🔄 صيانة دورية: غرفة ${maint.num}`, 'info');
                                    smartUpdate();
                                });
                        }
                    }
                }
            });
        }
        
        // ===============================================
        // == بدء التطبيق ===============================
        // ===============================================
        
        window.onload = initApp;
        
        // إضافة event listener لزر الإضافة السريع
        document.addEventListener('keydown', function(e) {
            // Ctrl + N لفتح نافذة الإضافة
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openAddModal();
            }
            
            // Esc لإغلاق جميع النوافذ
            if (e.key === 'Escape') {
                closeAllModals();
            }
            
            // مسافة لإظهار التقرير السريع
            if (e.key === ' ' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                showQuickReport();
            }
        });
        
        // جعل التطبيق متجاوباً مع اللمس
        document.addEventListener('touchstart', function() {}, {passive: true});
        
        // دعم وضع الشاشة الكاملة
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
        
        // التحكم في وضع التركيز - يزيد المؤقتات 5 دقائق
        function toggleFocusMode() {
            hapticFeedback('medium');
            
            appState.focusMode = !appState.focusMode;
            document.body.classList.toggle('focus-mode', appState.focusMode);
            
            const btn = document.getElementById('focus-mode-btn');
            if (btn) {
                btn.classList.toggle('focus-active', appState.focusMode);
            }
            
            showMiniAlert(appState.focusMode ? '👁️ وضع التركيز مفعّل (+5 دقائق)' : '👁️ تم إلغاء وضع التركيز', 'success');
        }
        
        // زر التيربو - تلقائياً مفعّل - يخصم 5 دقائق
        function toggleTurboMode() {
            hapticFeedback('medium');
            
            appState.turbo = !appState.turbo;
            const btn = document.getElementById('turbo-mode-btn');
            if (btn) {
                btn.classList.toggle('turbo-active', appState.turbo);
                btn.style.color = appState.turbo ? 'var(--success)' : '';
            }
            
            const msg = appState.language === 'ar' ? 
                (appState.turbo ? '⚡ وضع التيربو مفعل (-5 دقائق)' : '⚡ وضع التيربو معطل') :
                (appState.turbo ? '⚡ Turbo mode enabled (-5 min)' : '⚡ Turbo mode disabled');
            showMiniAlert(msg, 'success');
            if (appState.turbo) playNotificationSound();
        }
        
        // تهيئة اللغة عند بدء التطبيق
        function initLanguage() {
            const savedLang = localStorage.getItem('adora_lang') || 'ar';
            appState.language = savedLang;
            document.documentElement.lang = savedLang;
            
            // تحديد الاتجاه: RTL للعربية والأردية، LTR للباقي
            const isRTL = savedLang === 'ar' || savedLang === 'ur';
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.body.classList.toggle('rtl-mode', isRTL);
            document.body.classList.toggle('ltr-mode', !isRTL);
            
            // تحديث الواجهة فوراً
            setTimeout(() => updateUIForLanguage(), 100);
        }
        
        // Language toggle - تبديل اللغة فعلي
        function toggleLanguage() {
            const languages = ['ar', 'en', 'hi', 'ur', 'bn'];
            const currentIndex = languages.indexOf(appState.language);
            const nextIndex = (currentIndex + 1) % languages.length;
            appState.language = languages[nextIndex];
            
            localStorage.setItem('adora_lang', appState.language);
            document.documentElement.lang = appState.language;
            
            // تحديد الاتجاه: RTL للعربية والأردية، LTR للباقي
            const isRTL = appState.language === 'ar' || appState.language === 'ur';
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.body.classList.toggle('rtl-mode', isRTL);
            document.body.classList.toggle('ltr-mode', !isRTL);
            
            // تحديث الواجهة
            updateUIForLanguage();
            
            const langNames = {
                'ar': 'العربية',
                'en': 'English',
                'hi': 'हिंदी',
                'ur': 'اردو',
                'bn': 'বাংলা'
            };
            showMiniAlert(`🌐 ${langNames[appState.language]}`, 'success');
        }
        
        function updateUIForLanguage() {
            const lang = appState.language;
            
            // تحديث زر اللغة
            const langBtn = document.getElementById('lang-btn');
            if (langBtn) {
                const langNames = {
                    'ar': '🌐 العربية',
                    'en': '🌐 English',
                    'hi': '🌐 हिंदी',
                    'ur': '🌐 اردو',
                    'bn': '🌐 বাংলা'
                };
                langBtn.textContent = langNames[lang] || '🌐';
            }
            
            // تحديث عناوين الأقسام
            document.querySelectorAll('.sec-title span').forEach((el, i) => {
                if (i === 0) el.innerHTML = `📈 ${t('todayStats')}`;
                else if (el.textContent.includes('تتبع') || el.textContent.includes('Room Tracking')) el.innerHTML = `🚪 ${t('roomTracking')}`;
                else if (el.textContent.includes('طلبات تنظيف') || el.textContent.includes('Cleaning Requests')) el.innerHTML = `🧹 ${t('cleaningRequests') || 'طلبات تنظيف ( خارج - ساكن )'}`;
                else if (el.textContent.includes('طلبات') || el.textContent.includes('Guest Requests')) el.innerHTML = `🛎️ ${t('guestRequests')}`;
                else if (el.textContent.includes('الصيانة') || el.textContent.includes('Maintenance')) el.innerHTML = `🛠️ ${t('maintenanceSection')}`;
                else if (el.textContent.includes('السجل') || el.textContent.includes('Log')) el.innerHTML = `🧹 ${t('logCompleted')}`;
            });
            
            // تحديث الإحصائيات - استخدام الترجمات
            const statLabels = {
                'ar': [
                    'إجمالي تنظيف الخروج',
                    'إجمالي تنظيف الساكن',
                    'إجمالي الطلبات المنتهية',
                    'إجمالي الطلبات النشطة',
                    'إجمالي الصيانة المنتهية',
                    'إجمالي الصيانة النشطة',
                    'آخر طلب',
                    'آخر صيانة'
                ],
                'en': [
                    'Total Checkout Cleaning',
                    'Total Stayover Cleaning',
                    'Total Completed Requests',
                    'Total Active Requests',
                    'Total Completed Maintenance',
                    'Total Active Maintenance',
                    'Last Request',
                    'Last Maintenance'
                ],
                'hi': [
                    'कुल चेकआउट सफाई',
                    'कुल स्टेओवर सफाई',
                    'कुल पूर्ण अनुरोध',
                    'कुल सक्रिय अनुरोध',
                    'कुल पूर्ण रखरखाव',
                    'कुल सक्रिय रखरखाव',
                    'अंतिम अनुरोध',
                    'अंतिम रखरखाव'
                ],
                'ur': [
                    'کل چیک آؤٹ صفائی',
                    'کل سٹے اوور صفائی',
                    'کل مکمل درخواستیں',
                    'کل فعال درخواستیں',
                    'کل مکمل دیکھ بھال',
                    'کل فعال دیکھ بھال',
                    'آخری درخواست',
                    'آخری دیکھ بھال'
                ],
                'bn': [
                    'মোট চেকআউট পরিষ্কার',
                    'মোট স্টে ওভার পরিষ্কার',
                    'মোট সম্পন্ন অনুরোধ',
                    'মোট সক্রিয় অনুরোধ',
                    'মোট সম্পন্ন রক্ষণাবেক্ষণ',
                    'মোট সক্রিয় রক্ষণাবেক্ষণ',
                    'শেষ অনুরোধ',
                    'শেষ রক্ষণাবেক্ষণ'
                ]
            };
            const labels = statLabels[lang] || statLabels['ar'];
            document.querySelectorAll('.stat-label').forEach((el, i) => {
                if (labels[i]) el.textContent = labels[i];
            });
            
            // تحديث نشط/متأخر
            document.querySelectorAll('.active-label').forEach((el, i) => {
                el.textContent = i === 0 ? t('active') : t('late');
            });
            
            // تحديث placeholder للبحث
            const searchBar = document.getElementById('search-bar');
            if (searchBar) searchBar.placeholder = `🔍 ${t('searchPlaceholder')}`;
            
            // تحديث النصوص الثابتة في الـ header
            const systemNameEl = document.querySelector('.header-center span:first-child');
            if (systemNameEl) systemNameEl.textContent = t('systemName');
            
            const systemDescEl = document.querySelector('.header-center span:last-child');
            if (systemDescEl) systemDescEl.textContent = t('systemDescription');
            
            // تحديث مودال الإضافة
            const modalTitle = document.getElementById('modal-title-add');
            if (modalTitle) modalTitle.textContent = t('addNewRoom');
            document.getElementById('tab-cleaning').innerHTML = `🧹 ${t('cleaning')}`;
            document.getElementById('tab-request').innerHTML = `🛎️ ${t('requestsTab')}`;
            document.getElementById('tab-maintenance').innerHTML = `🛠️ ${t('maintenanceTab')}`;
            
            // تحديث أزرار مودال الإضافة
            const optOut = document.getElementById('opt_out');
            const optStay = document.getElementById('opt_stay');
            if (optOut) optOut.innerHTML = `🚨 ${t('checkoutUrgent')}`;
            if (optStay) optStay.innerHTML = `📅 ${t('stayoverScheduled')}`;
            
            const gstIn = document.getElementById('gst_clean_in');
            const gstOut = document.getElementById('gst_clean_out');
            if (gstIn) gstIn.innerHTML = `👤 ${t('inside')}`;
            if (gstOut) gstOut.innerHTML = `🚶 ${t('outside')}`;
            
            // تحديث أزرار الطلبات والصيانة
            const btnReqImm = document.getElementById('btn-req-imm');
            const btnReqSch = document.getElementById('btn-req-sch');
            if (btnReqImm) btnReqImm.innerHTML = `🚨 ${t('immediate')}`;
            if (btnReqSch) btnReqSch.innerHTML = `📅 ${t('scheduled')}`;
            
            const btnMaintImm = document.getElementById('btn-maint-imm');
            const btnMaintSch = document.getElementById('btn-maint-sch');
            if (btnMaintImm) btnMaintImm.innerHTML = `🚨 ${t('urgent')}`;
            if (btnMaintSch) btnMaintSch.innerHTML = `📅 ${t('scheduled')}`;
            
            // تحديث أزرار الإنهاء
            const stReady = document.getElementById('st_ready');
            const stMaint = document.getElementById('st_maint');
            if (stReady) stReady.innerHTML = `${t('ready')} ✅`;
            if (stMaint) stMaint.innerHTML = `${t('needsMaintenance')} 🛠️`;
            
            // تحديث نصوص نافذة التأكيد
            const confirmTitleEl = document.getElementById('confirm-title');
            const confirmYesBtnEl = document.getElementById('confirm-yes-btn');
            const confirmBackBtnEl = document.getElementById('confirm-back-btn');
            if (confirmTitleEl) confirmTitleEl.textContent = t('confirm');
            if (confirmYesBtnEl) confirmYesBtnEl.textContent = t('yes');
            if (confirmBackBtnEl) confirmBackBtnEl.textContent = t('back');
            
            // تحديث labels في مودال الإضافة
            const roomNumberLabel = document.getElementById('room-number-label');
            if (roomNumberLabel) roomNumberLabel.textContent = t('roomNumber');
            
            const inpRoomNum = document.getElementById('inpRoomNum');
            if (inpRoomNum) inpRoomNum.placeholder = t('roomPlaceholder');
            
            const inpRequestDetails = document.getElementById('inpRequestDetails');
            if (inpRequestDetails) {
                inpRequestDetails.placeholder = t('requestPlaceholder');
            }
            
            const inpMaintDetails = document.getElementById('inpMaintDetails');
            if (inpMaintDetails) {
                inpMaintDetails.placeholder = t('maintenanceDesc');
            }
            
            // تحديث نص "اضغط لرفع صورة"
            const clickToUploadText = document.getElementById('click-to-upload-text');
            if (clickToUploadText) {
                clickToUploadText.textContent = t('clickToUpload');
            }
            
            // تحديث label "صورة (اختياري)"
            const photoOptionalLabel = document.getElementById('photo-optional-label');
            if (photoOptionalLabel) {
                photoOptionalLabel.textContent = t('photoOptional');
            }
            
            // تحديث أزرار الإضافة والرجوع
            const confirmAddBtn = document.getElementById('confirm-add-btn');
            if (confirmAddBtn) confirmAddBtn.textContent = `${t('addAndSend')} 🚀`;
            
            const backBtnAddModal = document.getElementById('back-btn-add-modal');
            if (backBtnAddModal) backBtnAddModal.textContent = t('back');
            
            // تحديث عنوان السجل
            const logTitleText = document.getElementById('log-title-text');
            if (logTitleText) {
                logTitleText.innerHTML = `🧹 ${t('logCompleted')}`;
            }
            
            // تحديث نصيحة اليوم
            updateDailyTip();
            
            // تحديث جميع الكروت
            smartUpdate();
        }
        
        // تحديث الساعة الرقمية المميزة
        function updateDigitalClock(timeValue, inputId) {
            if (!timeValue) return;
            const [hours, minutes] = timeValue.split(':');
            const hour = parseInt(hours);
            const minute = parseInt(minutes);
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
            const timeStr = `${displayHour.toString().padStart(2, '0')}:${minutes}`;
            
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = new Date().getDay();
            const dayName = days[today];
            
            const suffix = inputId === 'systemTimeInput' ? '' : 
                          inputId === 'systemTimeInputReq' ? '-req' : '-maint';
            
            const dayEl = document.getElementById(`clock-day${suffix}`);
            const timeEl = document.getElementById(`clock-time${suffix}`);
            const periodEl = document.getElementById(`clock-period${suffix}`);
            
            if (dayEl) dayEl.textContent = dayName;
            if (timeEl) timeEl.textContent = timeStr;
            if (periodEl) periodEl.textContent = period;
        }
        
        // تهيئة الساعات الرقمية عند فتح المودال
        function initDigitalClocks() {
            const timeInputs = ['systemTimeInput', 'systemTimeInputReq', 'systemTimeInputMaint'];
            timeInputs.forEach(id => {
                const input = document.getElementById(id);
                if (input && input.value) {
                    updateDigitalClock(input.value, id);
                }
            });
        }
        
        // التحكم في الوضع الداكن
        function toggleDarkMode() { 
            const isNowDark = !document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode'); 
            showMiniAlert(isNowDark ? '🌙 Dark mode enabled' : '☀️ Dark mode disabled', 'success');
        }
        
        // التحكم في وضع التيربو (محذوف - تم دمجه مع الطوارئ)
        
        function closeModal(modalId) { 
            // إذا تم تمرير معرف نافذة محددة، أغلقها فقط
            if (modalId) {
                const el = document.getElementById(modalId);
                if (el) el.style.display = 'none';
                return;
            }
            
            // إغلاق جميع النوافذ
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.style.display = 'none';
            });
            
            // إغلاق النوافذ المحددة أيضاً
            const specificModals = [
                'addRoomModal',
                'final-modal',
                'complete-maint-modal',
                'action-confirm-modal',
                'admin-pin-modal',
                'inspection-modal',
                'password-modal',
                'add-service-modal',
                'menu-editor-modal'
            ];
            specificModals.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    // إزالة أي classes قد تمنع الإخفاء
                    el.classList.remove('open', 'visible', 'show');
                }
            });
        }
        
        // عرض رسالة نجاح مكان النافذة
        // تم حذف showModalSuccess - لا حاجة لها
        
        function closeAllModals() { 
            closeModal();
        }
        
        function closeCustomAlert() { 
            document.getElementById('customAlertModal').style.display = 'none'; 
        }
        
        // ===============================================
        // == Side Menu Functions ========================
        // ===============================================
        
        function toggleSideMenu() {
            const menu = document.getElementById('side-menu');
            const overlay = document.getElementById('side-menu-overlay');
            if (menu && overlay) {
                const isOpen = menu.style.display === 'block';
                menu.style.display = isOpen ? 'none' : 'block';
                overlay.style.display = isOpen ? 'none' : 'block';
                hapticFeedback('light');
            }
        }
        
        // ===============================================
        // == FAB (Floating Action Button) Functions ====
        // ===============================================
        
        // تهيئة FAB Draggable
        function initFABDraggable() {
            const fab = document.getElementById('fab');
            const container = document.getElementById('fab-container');
            if (!fab || !container) return;
            
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let initialX = 0;
            let initialY = 0;
            
            const applyPosition = (x, y) => {
                const maxX = window.innerWidth - container.offsetWidth;
                const maxY = window.innerHeight - container.offsetHeight;
                const clampedX = Math.max(0, Math.min(x, maxX));
                const clampedY = Math.max(0, Math.min(y, maxY));
                container.style.left = `${clampedX}px`;
                container.style.top = `${clampedY}px`;
                container.style.right = 'auto';
                container.style.bottom = 'auto';
            };
            
            const savePosition = () => {
                const rect = container.getBoundingClientRect();
                localStorage.setItem('fabPosition', JSON.stringify({ x: rect.left, y: rect.top }));
            };
            
            const savedPos = localStorage.getItem('fabPosition');
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                applyPosition(pos.x, pos.y);
            }
            
            const startDrag = (clientX, clientY) => {
                isDragging = true;
                startX = clientX;
                startY = clientY;
                const rect = container.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                container.style.transition = 'none';
                fab.classList.add('draggable');
            };
            
            const moveDrag = (clientX, clientY) => {
                if (!isDragging) return;
                const deltaX = clientX - startX;
                const deltaY = clientY - startY;
                applyPosition(initialX + deltaX, initialY + deltaY);
            };
            
            const endDrag = () => {
                if (!isDragging) return;
                isDragging = false;
                container.style.transition = 'all 0.3s ease';
                fab.classList.remove('draggable');
                savePosition();
            };
            
            fab.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                moveDrag(e.clientX, e.clientY);
            });
            document.addEventListener('mouseup', endDrag);
            
            fab.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                startDrag(touch.clientX, touch.clientY);
            }, { passive: true });
            
            document.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const touch = e.touches[0];
                moveDrag(touch.clientX, touch.clientY);
            }, { passive: false });
            
            document.addEventListener('touchend', endDrag);
        }
        
        function positionFABOptions() {
            const fabMenu = document.getElementById('fab-menu');
            const container = document.getElementById('fab-container');
            if (!fabMenu || !container) return;
            
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const margin = 150;
            const nearTop = centerY < margin;
            const nearBottom = centerY > window.innerHeight - margin;
            const nearLeft = centerX < margin;
            const nearRight = centerX > window.innerWidth - margin;
            
            let angles;
            if (nearBottom) {
                angles = [-120, -150, -180, -210];
            } else if (nearTop) {
                angles = [60, 30, 0, -30];
            } else if (nearRight) {
                angles = [180, 150, 120, 90];
            } else if (nearLeft) {
                angles = [0, -30, -60, -90];
            } else {
                angles = [-90, -120, -150, -180];
            }
            
            const radius = 95;
            const baseTransform = 'translate(-50%, -50%)';
            const options = fabMenu.querySelectorAll('.fab-option');
            options.forEach((btn, idx) => {
                const angle = angles[idx] !== undefined ? angles[idx] : angles[angles.length - 1];
                const rad = angle * Math.PI / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                btn.style.transform = `${baseTransform} translate(${x}px, ${y}px)`;
            });
        }
        
        function toggleFABMenu() {
            const fabMenu = document.getElementById('fab-menu');
            if (!fabMenu) return;
            
            const isVisible = fabMenu.classList.contains('open');
            if (isVisible) {
                fabMenu.classList.remove('open');
                fabMenu.style.display = 'none';
                fabMenu.querySelectorAll('.fab-option').forEach(btn => {
                    btn.style.transform = 'translate(-50%, -50%)';
                });
            } else {
                fabMenu.style.display = 'block';
                positionFABOptions();
                requestAnimationFrame(() => fabMenu.classList.add('open'));
            }
            
            hapticFeedback('medium');
        }
        
        function openFABOption(type) {
            // إضافة تأثير الضغط على الزر
            const button = document.querySelector(`.fab-option[data-fab-type="${type}"]`);
            if (button) {
                button.classList.add('fab-pressed');
                setTimeout(() => {
                    button.classList.remove('fab-pressed');
                }, 300);
            }
            
            toggleFABMenu();
            
            if (type === 'inspection') {
                // فتح نافذة الفحص مباشرة
                const inspectionModal = document.getElementById('inspection-modal');
                if (!inspectionModal) return;
                
                inspectionModal.style.display = 'flex';
                
                // إظهار مؤشر التحميل
                showLoadingBar();
                
                // تهيئة نافذة الفحص
                setTimeout(() => {
                    openReceptionInspection();
                    hideLoadingBar();
                }, 100);
            } else {
                // تحديد الوضع
                const mode = type === 'clean' ? 'cleaning' : type === 'request' ? 'request' : 'maintenance';
                
                // فتح النافذة أولاً
                const modal = document.getElementById('addRoomModal');
                if (!modal) return;
                
                modal.style.display = 'flex';
                
                // إظهار مؤشر التحميل
                showLoadingBar();
                
                // ===== إعادة تعيين جميع الحقول بشكل كامل =====
                // إعادة تعيين رقم الغرفة
                const inpRoomNum = document.getElementById('inpRoomNum');
                if (inpRoomNum) inpRoomNum.value = ''; 
                
                // إعادة تعيين تنبيه التكرار
                const dupAlert = document.getElementById('room-dup-alert');
                if (dupAlert) dupAlert.style.display = 'none'; 
                
                // إعادة تعيين نوع الغرفة
                const inpRoomType = document.getElementById('inpRoomType');
                if (inpRoomType) inpRoomType.value = ''; 
                
                // مسح selected من جميع أزرار الاختيار
                document.querySelectorAll('.modal-select-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // إعادة تعيين Super Turbo
                const inpSuperTurbo = document.getElementById('inpSuperTurbo');
                if (inpSuperTurbo) inpSuperTurbo.checked = false; 
                
                // إعادة تعيين تفاصيل الطلب
                const inpRequestDetails = document.getElementById('inpRequestDetails');
                if (inpRequestDetails) inpRequestDetails.value = ''; 
                
                // إعادة تعيين تفاصيل الصيانة
                const inpMaintDetails = document.getElementById('inpMaintDetails');
                if (inpMaintDetails) inpMaintDetails.value = ''; 
                
                // إعادة تعيين صورة الصيانة
                const maintImage = document.getElementById('inpMaintImage');
                if (maintImage) maintImage.value = '';
                
                // مسح حالة الصورة المرفوعة
                const maintImageLabel = document.querySelector('.maint-image-upload');
                if (maintImageLabel) {
                    maintImageLabel.classList.remove('uploaded');
                    const uploadText = document.getElementById('click-to-upload-text');
                    if (uploadText) uploadText.textContent = 'اضغط لرفع صورة';
                }
                
                // إعادة تعيين حالة النزيل
                const inpGuestStatus = document.getElementById('inpGuestStatus');
                if (inpGuestStatus) inpGuestStatus.value = 'in';
                
                // إعادة تعيين أزرار حالة النزيل
                const gstIn = document.getElementById('gst_clean_in');
                const gstOut = document.getElementById('gst_clean_out');
                if (gstIn) {
                    gstIn.classList.remove('active', 'selected');
                }
                if (gstOut) {
                    gstOut.classList.remove('active', 'selected');
                }
                
                // إعادة تعيين جميع حقول التاريخ والوقت
                const systemTimeInput = document.getElementById('systemTimeInput');
                if (systemTimeInput) systemTimeInput.value = '12:00';
                
                const systemDateInputReq = document.getElementById('systemDateInputReq');
                if (systemDateInputReq) systemDateInputReq.value = '';
                
                const systemTimeInputReq = document.getElementById('systemTimeInputReq');
                if (systemTimeInputReq) systemTimeInputReq.value = '12:00';
                
                const systemDateInputMaint = document.getElementById('systemDateInputMaint');
                if (systemDateInputMaint) systemDateInputMaint.value = '';
                
                const systemTimeInputMaint = document.getElementById('systemTimeInputMaint');
                if (systemTimeInputMaint) systemTimeInputMaint.value = '12:00';
                
                // إخفاء اقتراحات الرموز السريعة
                const quickCodesSuggestions = document.getElementById('quick-codes-suggestions');
                if (quickCodesSuggestions) {
                    quickCodesSuggestions.style.display = 'none';
                    quickCodesSuggestions.innerHTML = '';
                }
                
                // تعيين الحد الأدنى للتاريخ والوقت
                setMinDateTime();
                
                // تغيير الوضع مباشرة - كل نوع يفتح على الوضع المناسب له
                setTimeout(() => {
                    switchAddMode(mode);
                    
                    // مسح جميع الأزرار لتكون في وضع محايد
                    if (mode === 'request') {
                        // إزالة selected من أزرار الطلبات
                        const btnReqImm = document.getElementById('btn-req-imm');
                        const btnReqSch = document.getElementById('btn-req-sch');
                        if (btnReqImm) btnReqImm.classList.remove('selected');
                        if (btnReqSch) btnReqSch.classList.remove('selected');
                        // إخفاء حاوية الجدولة
                        const reqScheduleContainer = document.getElementById('request-schedule-container');
                        if (reqScheduleContainer) reqScheduleContainer.style.display = 'none';
                        // إعادة تعيين المتغير
                        isImmediateRequest = null;
                    } else if (mode === 'maintenance') {
                        // إزالة selected من أزرار الصيانة
                        const btnMaintImm = document.getElementById('btn-maint-imm');
                        const btnMaintSch = document.getElementById('btn-maint-sch');
                        if (btnMaintImm) btnMaintImm.classList.remove('selected');
                        if (btnMaintSch) btnMaintSch.classList.remove('selected');
                        // إخفاء حاوية الجدولة
                        const maintScheduleContainer = document.getElementById('maint-schedule-container');
                        if (maintScheduleContainer) maintScheduleContainer.style.display = 'none';
                        // إعادة تعيين المتغير
                        isImmediateMaint = null;
                    } else if (mode === 'cleaning') {
                        // إزالة selected من أزرار التنظيف
                        const optOut = document.getElementById('opt_out');
                        const optStay = document.getElementById('opt_stay');
                        const optDnd = document.getElementById('opt_dnd');
                        if (optOut) optOut.classList.remove('selected');
                        if (optStay) optStay.classList.remove('selected');
                        if (optDnd) optDnd.classList.remove('selected');
                        // إخفاء خيارات الساكن
                        const stayOptions = document.getElementById('stayOptionsCleaning');
                        if (stayOptions) stayOptions.style.display = 'none';
                    }
                    
                    // التمرير التلقائي إلى القسم المناسب بعد فتح النافذة
                    setTimeout(() => {
                        let sectionId = '';
                        if (mode === 'cleaning') {
                            // التمرير إلى قسم الغرف
                            const roomsSection = document.querySelector('.section-rooms');
                            if (roomsSection) {
                                roomsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        } else if (mode === 'request') {
                            // التمرير إلى قسم الطلبات
                            scrollToSection('guest-requests-section');
                        } else if (mode === 'maintenance') {
                            // التمرير إلى قسم الصيانة
                            scrollToSection('maintenance-section');
                        }
                    }, 100);
                }, 50);
                
                // إخفاء مؤشر التحميل بعد 3 ثواني
                setTimeout(() => {
                    hideLoadingBar();
                }, 3000);
            }
            hapticFeedback('medium');
        }
        
        // ===============================================
        // == Inspection Modal Functions ================
        // ===============================================
        
        function openSupervisorInspection() {
            const receptionSection = document.getElementById('reception-inspection-section');
            const supervisorSection = document.getElementById('supervisor-inspection-section');
            const supervisorBtn = document.getElementById('btn-supervisor-inspection');
            const receptionBtn = document.getElementById('btn-reception-inspection');
            
            if (receptionSection) receptionSection.style.display = 'none';
            if (supervisorSection) supervisorSection.style.display = 'block';
            
            // تحديث class active على الأزرار
            if (supervisorBtn) supervisorBtn.classList.add('active');
            if (receptionBtn) receptionBtn.classList.remove('active');
            
            // مسح جميع البيانات والأزرار
            const inpInspectionRoom = document.getElementById('inspection-room-num');
            if (inpInspectionRoom) inpInspectionRoom.value = '';
            
            // مسح أزرار العجلة والحالة
            document.querySelectorAll('.inspection-mode-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.inspection-action-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            hapticFeedback('light');
        }
        
        function openReceptionInspection() {
            const receptionSection = document.getElementById('reception-inspection-section');
            const supervisorSection = document.getElementById('supervisor-inspection-section');
            const supervisorBtn = document.getElementById('btn-supervisor-inspection');
            const receptionBtn = document.getElementById('btn-reception-inspection');
            
            if (supervisorSection) supervisorSection.style.display = 'none';
            if (receptionSection) receptionSection.style.display = 'block';
            
            // تحديث class active على الأزرار
            if (receptionBtn) receptionBtn.classList.add('active');
            if (supervisorBtn) supervisorBtn.classList.remove('active');
            
            // مسح جميع البيانات والأزرار
            const inpInspectionRoom = document.getElementById('inspection-room-num');
            if (inpInspectionRoom) inpInspectionRoom.value = '';
            
            // مسح أزرار العجلة والحالة
            document.querySelectorAll('.inspection-mode-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.inspection-action-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // مسح الصور المرفوعة
            const damagePhoto = document.getElementById('damage-photo-input');
            const lostfoundPhoto = document.getElementById('lostfound-photo-input');
            if (damagePhoto) {
                damagePhoto.value = '';
                const damageLabel = damagePhoto.previousElementSibling;
                if (damageLabel) damageLabel.classList.remove('uploaded');
            }
            if (lostfoundPhoto) {
                lostfoundPhoto.value = '';
                const lostfoundLabel = lostfoundPhoto.previousElementSibling;
                if (lostfoundLabel) lostfoundLabel.classList.remove('uploaded');
            }
            
            // مسح اختيارات الميني بار
            document.querySelectorAll('.minibar-item-checkbox').forEach(cb => {
                cb.checked = false;
            });
            
            // تحميل قائمة الميني بار عند فتح قسم الاستقبال
            MinibarManager.loadMinibar().then(() => {
                MinibarManager.renderInspectionModal();
            });
            
            hapticFeedback('light');
        }
        
        function setSupervisorUrgency(urgency) {
            const urgentBtn = document.getElementById('supervisor-urgent-btn');
            const normalBtn = document.getElementById('supervisor-normal-btn');
            if (urgentBtn && normalBtn) {
                if (urgency === 'urgent') {
                    urgentBtn.classList.add('active');
                    normalBtn.classList.remove('active');
                } else {
                    normalBtn.classList.add('active');
                    urgentBtn.classList.remove('active');
                }
            }
            hapticFeedback('light');
        }
        
        function setSupervisorGuestStatus(status) {
            const insideBtn = document.getElementById('supervisor-guest-inside-btn');
            const outsideBtn = document.getElementById('supervisor-guest-outside-btn');
            if (insideBtn && outsideBtn) {
                if (status === 'inside') {
                    insideBtn.classList.add('active');
                    outsideBtn.classList.remove('active');
                } else {
                    outsideBtn.classList.add('active');
                    insideBtn.classList.remove('active');
                }
            }
            hapticFeedback('light');
        }
        
        function switchInspectionTab(tab) {
            document.querySelectorAll('.inspection-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.inspection-tab-content').forEach(c => c.style.display = 'none');
            
            const tabBtn = document.getElementById(`tab-${tab}`);
            const tabContent = document.getElementById(`inspection-${tab}`);
            if (tabBtn) tabBtn.classList.add('active');
            if (tabContent) tabContent.style.display = 'block';
            hapticFeedback('light');
            
            // إظهار شريط التنبيه عند اختيار تبويب
            showInspectionAlert(tab);
        }
        
        // متغيرات للتنبيهات
        let inspectionAlertQueue = [];
        let currentInspectionAlertIndex = 0;
        let inspectionAlertInterval = null;
        
        // دالة لإظهار شريط تنبيه الفحص
        function showInspectionAlert(tabType, roomNum = '') {
            const alertBar = document.getElementById('inspection-alert-bar');
            const alertIcon = document.getElementById('inspection-alert-icon');
            const alertTitle = document.getElementById('inspection-alert-title');
            const alertMessageReception = document.getElementById('inspection-alert-message-reception');
            const alertMessageWorkers = document.getElementById('inspection-alert-message-workers');
            const alertWorkersDiv = document.getElementById('inspection-alert-workers');
            const actionBtn = document.getElementById('inspection-alert-action-btn');
            
            if (!alertBar || !alertIcon || !alertTitle || !alertMessageReception) return;
            
            // الحصول على قائمة العناصر من البيانات المحفوظة (إن وجدت)
            let minibarItemsList = '';
            if (tabType === 'minibar') {
                const selectedItems = Array.from(document.querySelectorAll('#minibar-items-dynamic input:checked')).map(cb => {
                    const label = cb.closest('label');
                    return label ? label.textContent.trim() : cb.value;
                });
                if (selectedItems.length > 0) {
                    minibarItemsList = selectedItems.map((item, idx) => `${idx + 1} ${item}`).join('\n');
                }
            }
            
            const alerts = {
                'minibar': {
                    icon: '🍫',
                    title: 'تنبيه فحص - الميني بار',
                    receptionMsg: minibarItemsList ? 
                        `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: عاجل، وضع النزيل: داخل` :
                        `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: عاجل، وضع النزيل: داخل`,
                    workersMsg: 'تم إرسال تقرير الميني بار للاستقبال',
                    showActionBtn: true,
                    actionBtnText: '✅ تم العلم - جاري الفحص',
                    actionType: 'minibar'
                },
                'damages': {
                    icon: '🔨',
                    title: 'تنبيه فحص - تلفيات',
                    receptionMsg: `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: عاجل، وضع النزيل: داخل`,
                    workersMsg: 'يرجى العلم أنه تم رصد تلفيات داخل الغرفة.',
                    showActionBtn: true,
                    actionBtnText: '✅ تم العلم - جاري الفحص',
                    actionType: 'damages'
                },
                'lostfound': {
                    icon: '☂️',
                    title: 'تنبيه فحص - مفقودات',
                    receptionMsg: `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: عاجل، وضع النزيل: داخل`,
                    workersMsg: 'يرجى العلم أنه تم رصد مفقودات في الغرفة.',
                    showActionBtn: true,
                    actionBtnText: '✅ تم العلم - جاري الفحص',
                    actionType: 'lostfound'
                },
                'excellent': {
                    icon: '✅',
                    title: 'تنبيه فحص - حالة ممتازة',
                    receptionMsg: `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: عاجل، وضع النزيل: داخل`,
                    workersMsg: 'تم العلم أن الحالة ممتازة للغرفة.',
                    showActionBtn: false,
                    actionBtnText: '',
                    actionType: ''
                }
            };
            
            const alert = alerts[tabType];
            if (alert) {
                // حفظ البيانات الكاملة للاستخدام في نافذة التفاصيل
                const fullData = window.currentInspectionData || {
                    type: tabType,
                    roomNum: roomNum,
                    items: [],
                    imageUrl: null,
                    timestamp: Date.now()
                };
                
                // إضافة التنبيهات إلى قائمة الانتظار
                inspectionAlertQueue = [
                    {
                        type: 'reception',
                        icon: alert.icon,
                        message: alert.receptionMsg,
                        showActionBtn: alert.showActionBtn,
                        actionBtnText: alert.actionBtnText,
                        actionType: alert.actionType,
                        roomNum: roomNum,
                        fullData: fullData // حفظ البيانات الكاملة
                    },
                    {
                        type: 'workers',
                        icon: alert.icon,
                        message: alert.workersMsg,
                        fullData: fullData
                    }
                ];
                
                // بدء التبديل التلقائي
                currentInspectionAlertIndex = 0;
                showNextInspectionAlert();
                
                // إعداد التبديل التلقائي كل 3 ثواني
                if (inspectionAlertInterval) {
                    clearInterval(inspectionAlertInterval);
                }
                inspectionAlertInterval = setInterval(() => {
                    // التحقق من عدم وجود hover على التنبيه وعدم وجود pause
                    if (!inspectionAlertPaused) {
                    currentInspectionAlertIndex = (currentInspectionAlertIndex + 1) % inspectionAlertQueue.length;
                    showNextInspectionAlert();
                    }
                }, 3000);
                
                alertBar.style.display = 'block';
                
                // تمرير سلس للشريط
                setTimeout(() => {
                    alertBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        }
        
        // دالة لإظهار التنبيه التالي
        function showNextInspectionAlert() {
            if (inspectionAlertQueue.length === 0) return;
            
            const alert = inspectionAlertQueue[currentInspectionAlertIndex];
            const alertReceptionDiv = document.getElementById('inspection-alert-reception');
            const alertWorkersDiv = document.getElementById('inspection-alert-workers');
            const alertIconReception = document.getElementById('inspection-alert-icon-reception');
            const alertIconWorkers = document.getElementById('inspection-alert-icon-workers');
            const alertMessageReception = document.getElementById('inspection-alert-message-reception');
            const alertMessageWorkers = document.getElementById('inspection-alert-message-workers');
            const actionBtn = document.getElementById('inspection-alert-action-btn');
            
            if (alert.type === 'reception') {
                alertReceptionDiv.style.display = 'block';
                alertWorkersDiv.style.display = 'none';
                if (alertIconReception) alertIconReception.textContent = alert.icon;
                if (alertMessageReception) alertMessageReception.innerHTML = alert.message;
                if (actionBtn) {
                    if (alert.showActionBtn) {
                        actionBtn.textContent = alert.actionBtnText;
                        actionBtn.style.display = 'block';
                        actionBtn.setAttribute('data-action-type', alert.actionType);
                        actionBtn.setAttribute('data-room-num', alert.roomNum);
                    } else {
                        actionBtn.style.display = 'none';
                    }
                }
            } else {
                alertReceptionDiv.style.display = 'none';
                alertWorkersDiv.style.display = 'block';
                if (alertIconWorkers) alertIconWorkers.textContent = alert.icon;
                if (alertMessageWorkers) alertMessageWorkers.textContent = alert.message;
                if (actionBtn) actionBtn.style.display = 'none';
            }
        }
        
        // دالة للتعامل مع زر "تم العلم"
        function handleInspectionAction() {
            const actionBtn = document.getElementById('inspection-alert-action-btn');
            if (!actionBtn) return;
            
            const actionType = actionBtn.getAttribute('data-action-type');
            const roomNum = actionBtn.getAttribute('data-room-num');
            
            // البحث عن الغرفة في appState.rooms
            const room = appState.rooms.find(r => r.num == roomNum);
            
            if (room) {
                // تحويل الغرفة مباشرة إلى مرحلة الفحص
                const now = Date.now();
                const checkingTime = HOTEL_CONFIG.times.CHECKING || 10 * 60000;
                
                // تحديث الحالة في Firebase
                if (db) {
                    db.collection('rooms').doc(room.id).update({
                        status: 'checking',
                        deadline: now + checkingTime,
                        historyLogs: firebase.firestore.FieldValue.arrayUnion({
                            action: 'تم العلم - جاري الفحص',
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                        })
                    }).then(() => {
                        // تحديث الحالة المحلية
                        const roomIndex = appState.rooms.findIndex(r => r.id === room.id);
                        if (roomIndex !== -1) {
                            appState.rooms[roomIndex].status = 'checking';
                            appState.rooms[roomIndex].deadline = now + checkingTime;
                            if (!appState.rooms[roomIndex].historyLogs) {
                                appState.rooms[roomIndex].historyLogs = [];
                            }
                            appState.rooms[roomIndex].historyLogs.push({
                                action: 'تم العلم - جاري الفحص',
                                time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                            });
                        }
                        
                        // تحديث الواجهة
                        smartUpdate(false);
                        showMiniAlert('✅ تم العلم - جاري الفحص', 'success');
                    }).catch(e => {
                        console.error('Error updating room status:', e);
                        showMiniAlert('❌ فشل تحديث الحالة', 'error');
                    });
                }
            }
            
            // تحديث الرسالة للعمال
            const workersMsg = document.getElementById('inspection-alert-message-workers');
            if (workersMsg) {
                workersMsg.textContent = '✅ تم العلم - جاري الفحص';
                workersMsg.style.color = 'var(--success)';
                workersMsg.style.fontWeight = '700';
            }
            
            // إخفاء زر "تم العلم"
            actionBtn.style.display = 'none';
            
            // حفظ في Firebase
            if (db && roomNum) {
                db.collection('inspectionActions').doc().set({
                    roomNum: parseInt(roomNum),
                    actionType: actionType,
                    action: 'acknowledged',
                    branch: 'default',
                    timestamp: Date.now()
                }).catch(e => console.error('Error saving action:', e));
            }
            
            hapticFeedback('medium');
        }
        
        // دالة لإيقاف التبديل عند hover
        let inspectionAlertPaused = false;
        function pauseInspectionAlert() {
            inspectionAlertPaused = true;
        }
        
        function resumeInspectionAlert() {
            inspectionAlertPaused = false;
        }
        
        // دالة لعرض تفاصيل الفحص الكاملة
        function showInspectionDetails() {
            if (inspectionAlertQueue.length === 0) return;
            
            const currentAlert = inspectionAlertQueue[currentInspectionAlertIndex];
            if (!currentAlert || !currentAlert.fullData) return;
            
            const data = currentAlert.fullData;
            let detailsHtml = '';
            
            if (data.type === 'minibar' && data.items && data.items.length > 0) {
                detailsHtml = `
                    <h4 style="color: var(--primary); margin-top: 0; margin-bottom: 15px;">🍫 تفاصيل الميني بار - الغرفة ${data.roomNum}</h4>
                    <div style="background: rgba(0, 172, 193, 0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: var(--text-main);">العناصر المستهلكة:</div>
                        <ul style="margin: 0; padding-right: 20px; color: var(--text-main);">
                            ${data.items.map((item, idx) => `<li style="margin-bottom: 8px;">${idx + 1}. ${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
            } else if (data.type === 'damages') {
                detailsHtml = `
                    <h4 style="color: var(--primary); margin-top: 0; margin-bottom: 15px;">🔨 تفاصيل الأضرار - الغرفة ${data.roomNum}</h4>
                    <div style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: var(--text-main);">تم رصد تلفيات داخل الغرفة</div>
                        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="صورة الأضرار" style="width: 100%; max-width: 400px; border-radius: 8px; margin-top: 10px;">` : '<p style="color: var(--text-sec);">لا توجد صورة متاحة</p>'}
                    </div>
                `;
            } else if (data.type === 'lostfound') {
                detailsHtml = `
                    <h4 style="color: var(--primary); margin-top: 0; margin-bottom: 15px;">☂️ تفاصيل المفقودات - الغرفة ${data.roomNum}</h4>
                    <div style="background: rgba(168, 85, 247, 0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: var(--text-main);">تم رصد مفقودات في الغرفة</div>
                        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="صورة المفقودات" style="width: 100%; max-width: 400px; border-radius: 8px; margin-top: 10px;">` : '<p style="color: var(--text-sec);">لا توجد صورة متاحة</p>'}
                    </div>
                `;
            } else if (data.type === 'excellent') {
                detailsHtml = `
                    <h4 style="color: var(--success); margin-top: 0; margin-bottom: 15px;">✅ حالة الغرفة - الغرفة ${data.roomNum}</h4>
                    <div style="background: rgba(34, 197, 94, 0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
                        <div style="font-weight: 700; color: var(--success); font-size: 1.1rem;">الغرفة في حالة ممتازة</div>
                        <div style="color: var(--text-sec); margin-top: 8px;">لا توجد ملاحظات - كل شيء سليم</div>
                    </div>
                `;
            }
            
            const modalHtml = `
                <div class="modal-overlay" id="inspection-details-modal" style="display: flex; z-index: 10000;">
                    <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
                        ${detailsHtml}
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button onclick="closeModal('inspection-details-modal')" class="glass-btn" style="flex: 1; background: var(--text-sec); color: white;">إغلاق</button>
                        </div>
                    </div>
                </div>
            `;
            
            // إزالة أي نافذة تفاصيل موجودة مسبقاً
            const existingModal = document.getElementById('inspection-details-modal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        // دالة لإخفاء شريط التنبيه
        function dismissInspectionAlert() {
            const alertBar = document.getElementById('inspection-alert-bar');
            if (alertBar) {
                alertBar.style.opacity = '0';
                alertBar.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    alertBar.style.display = 'none';
                    alertBar.style.opacity = '1';
                    alertBar.style.transform = 'translateY(0)';
                }, 300);
            }
            
            // إيقاف التبديل التلقائي
            if (inspectionAlertInterval) {
                clearInterval(inspectionAlertInterval);
                inspectionAlertInterval = null;
            }
            inspectionAlertQueue = [];
            currentInspectionAlertIndex = 0;
            
            hapticFeedback('light');
        }
        
        async function submitSupervisorInspection() {
            const roomNum = document.getElementById('supervisor-room-num').value;
            if (!roomNum) {
                showMiniAlert('⚠️ أدخل رقم الغرفة', 'warning');
                return;
            }
            
            const urgentBtn = document.getElementById('supervisor-urgent-btn');
            const insideBtn = document.getElementById('supervisor-guest-inside-btn');
            const isUrgent = urgentBtn && urgentBtn.classList.contains('active');
            const guestInside = insideBtn && insideBtn.classList.contains('active');
            
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            try {
                const guestStatusText = guestInside ? 'داخل' : (document.getElementById('supervisor-guest-outside-btn')?.classList.contains('active') ? 'خارج' : 'مسجّل خروج');
                const urgencyText = isUrgent ? 'عاجل' : 'غير عاجل';
                
                await db.collection('inspectionCards').doc().set({
                    roomNum: parseInt(roomNum),
                    type: 'supervisor',
                    urgency: isUrgent ? 'urgent' : 'normal',
                    urgencyText: urgencyText,
                    guestStatus: guestInside ? 'inside' : 'outside',
                    guestStatusText: guestStatusText,
                    branch: 'default',
                    timestamp: Date.now()
                });
                
                // إظهار شريط التنبيه فوراً قبل إغلاق النافذة
                const alertBar = document.getElementById('inspection-alert-bar');
                const alertReceptionDiv = document.getElementById('inspection-alert-reception');
                const alertWorkersDiv = document.getElementById('inspection-alert-workers');
                const alertMessageReception = document.getElementById('inspection-alert-message-reception');
                const alertMessageWorkers = document.getElementById('inspection-alert-message-workers');
                const alertIconReception = document.getElementById('inspection-alert-icon-reception');
                const actionBtn = document.getElementById('inspection-alert-action-btn');
                
                if (alertBar && alertReceptionDiv && alertWorkersDiv) {
                    // رسالة للاستقبال
                    if (alertMessageReception) {
                        alertMessageReception.innerHTML = `تنبيه: يوجد طلب فحص للغرفة <span style="color: #2563EB; font-weight: 900; font-size: 1.2rem;">${roomNum}</span> الحالة: ${urgencyText}، وضع النزيل: ${guestStatusText}`;
                    }
                    if (alertIconReception) {
                        alertIconReception.textContent = '📋';
                    }
                    alertReceptionDiv.style.display = 'block';
                    
                    // رسالة للعمال
                    if (alertMessageWorkers) {
                        alertMessageWorkers.textContent = `تم إرسال طلب فحص للغرفة ${roomNum} للمشرف.`;
                    }
                    alertWorkersDiv.style.display = 'none';
                    
                    if (actionBtn) actionBtn.style.display = 'none';
                    
                    alertBar.style.display = 'block';
                    
                    // تمرير سلس للشريط فوراً
                    setTimeout(() => {
                        alertBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                }
                
                closeModal('inspection-modal');
                showMiniAlert('✅ تم إرسال الطلب للمشرف بنجاح', 'success');
                // تم حذف showModalSuccess
            } catch(e) {
                console.error('Error submitting supervisor inspection:', e);
                showMiniAlert('❌ فشل الإرسال', 'error');
            }
        }
        
        async function submitInspection(type) {
            const roomNum = document.getElementById('inspection-room-num').value;
            if (!roomNum) {
                showMiniAlert('⚠️ أدخل رقم الغرفة', 'warning');
                return;
            }
            
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            try {
                let data = {
                    roomNum: parseInt(roomNum),
                    type: type,
                    branch: 'default',
                    timestamp: Date.now()
                };
                
                let selectedItems = [];
                let imageUrl = null;
                
                if (type === 'minibar') {
                    selectedItems = Array.from(document.querySelectorAll('#minibar-items-dynamic input:checked')).map(cb => {
                        const label = cb.closest('label');
                        return label ? label.textContent.trim() : cb.value;
                    });
                    
                    // التحقق من وجود عناصر محددة
                    if (selectedItems.length === 0) {
                        showMiniAlert('⚠️ يرجى تحديد عنصر واحد على الأقل من الميني بار', 'warning');
                        return;
                    }
                    
                    data.items = selectedItems;
                    
                    // إنشاء رسالة الميني بار مع التفاصيل
                    const itemsList = selectedItems.map((item, idx) => `${idx + 1} ${item}`).join('\n');
                        data.itemsList = itemsList;
                        
                        // تحديث رسالة الاستقبال لتشمل قائمة العناصر
                        const receptionMsg = `توجد مسحوبات من الميني بار للغرفة ${roomNum}:\n\n${itemsList}\n\nالرجاء تحصيل القيمة من العميل.`;
                        // سيتم استخدامها في showInspectionAlert
                } else if (type === 'damages') {
                    const file = document.getElementById('damage-photo').files[0];
                    if (!file) {
                        showMiniAlert('⚠️ يجب إرفاق صورة للتلفيات قبل الإرسال', 'warning');
                        return;
                    }
                    imageUrl = await uploadToImgBB(file);
                    data.imageUrl = imageUrl;
                } else if (type === 'lostfound') {
                    const file = document.getElementById('lostfound-photo').files[0];
                    if (!file) {
                        showMiniAlert('⚠️ يجب إرفاق صورة للمفقودات قبل الإرسال', 'warning');
                        return;
                    }
                    imageUrl = await uploadToImgBB(file);
                    data.imageUrl = imageUrl;
                }
                
                await db.collection('inspectionCards').doc().set(data);
                
                // حفظ البيانات الكاملة للاستخدام في showInspectionAlert
                window.currentInspectionData = {
                    type: type,
                    roomNum: roomNum,
                    items: selectedItems,
                    imageUrl: imageUrl,
                    timestamp: Date.now()
                };
                
                // إظهار شريط التنبيه بعد الإرسال مع رقم الغرفة
                showInspectionAlert(type, roomNum);
                
                closeModal('inspection-modal');
                showMiniAlert('✅ تم إرسال التقرير بنجاح', 'success');
                // تم حذف showModalSuccess
            } catch(e) {
                console.error('Error submitting inspection:', e);
                showMiniAlert('❌ فشل الإرسال', 'error');
            }
        }
        
        // ===============================================
        // == Menu Manager ==============================
        // ===============================================
        
        const MenuManager = {
            items: [],
            
            async loadMenu() {
                if (!db) return;
                try {
                    const snapshot = await db.collection('menuItems').where('branch', '==', 'default').get();
                    this.items = [];
                    snapshot.forEach(doc => {
                        this.items.push({ id: doc.id, ...doc.data() });
                    });
                } catch(e) {
                    console.error('Error loading menu:', e);
                }
            },
            
            async saveMenu() {
                if (!db) return;
                try {
                    const batch = db.batch();
                    const oldSnapshot = await db.collection('menuItems').where('branch', '==', 'default').get();
                    oldSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    this.items.forEach(item => {
                        const ref = db.collection('menuItems').doc();
                        batch.set(ref, { ...item, branch: 'default' });
                    });
                    
                    await batch.commit();
                } catch(e) {
                    console.error('Error saving menu:', e);
                }
            },
            
            renderEditorList() {
                const list = document.getElementById('menu-items-list');
                if (!list) return;
                
                if (this.items.length === 0) {
                    list.innerHTML = '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد عناصر</p>';
                    return;
                }
                
                list.innerHTML = this.items.map((item, index) => {
                    const itemId = item.id || item.serviceId || `temp-${index}`;
                    return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; margin-bottom:8px; background:#f8fafc; border-radius:8px;">
                        <div style="flex:1;">
                            <div style="font-weight:700;">${item.icon || '☕'} ${item.name}</div>
                            <div style="font-size:0.85rem; color:var(--text-sec);">${item.price || 0} ريال</div>
                        </div>
                        <button onclick="deleteService('${itemId}')" style="background:var(--danger); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">🗑️</button>
                    </div>
                `;
                }).join('');
            },
            
            renderGuestMenu() {
                const grid = document.getElementById('amenities-dynamic-grid');
                if (!grid) return;
                
                grid.innerHTML = this.items.map(item => `
                    <button onclick="requestAmenityItem('${item.name}', ${item.price || 0}, '${item.icon || '☕'}')" 
                            class="amenity-card" style="padding:12px; border-radius:12px; border:1px solid var(--border-color); background:white; cursor:pointer;">
                        <div style="font-size:1.5rem; margin-bottom:4px;">${item.icon || '☕'}</div>
                        <div style="font-weight:700; font-size:0.9rem;">${item.name}</div>
                        <div style="font-size:0.8rem; color:var(--text-sec);">${item.price || 0} ريال</div>
                    </button>
                `).join('');
            }
        };
        
        // ===============================================
        // == محرر قائمة الخدمات (Menu Editor) ==========
        // ===============================================
        
        let currentEditingServiceId = null;
        
        function showMenuEditor() {
            toggleSideMenu();
            const modal = document.getElementById('menu-editor-modal');
            if (!modal) return;
            
            modal.style.display = 'flex';
            loadMenuItems();
        }
        
        function openAddServiceModal() {
            currentEditingServiceId = null;
            const modal = document.getElementById('add-service-modal');
            if (!modal) return;
            
            // إعادة تعيين الحقول
            document.getElementById('add-service-title').textContent = '➕ إضافة خدمة / منتج جديد';
            document.getElementById('service-name').value = '';
            document.getElementById('service-icon').value = '🍽️';
            document.getElementById('service-type').value = 'fnb';
            document.getElementById('service-price').value = '';
            document.getElementById('service-url').value = '';
            document.getElementById('service-whatsapp').value = '';
            document.getElementById('service-image-url').value = '';
            document.getElementById('service-visible-guest').checked = true;
            document.getElementById('service-is-minibar').checked = false;
            document.getElementById('service-show-in-qr').checked = true;
            document.getElementById('service-instant').checked = true;
            document.getElementById('service-image-preview').innerHTML = '';
            
            // إظهار/إخفاء الحقول حسب النوع
            updateServiceTypeFields();
            
            modal.style.display = 'flex';
        }
        
        function openEditServiceModal(serviceId) {
            const services = JSON.parse(localStorage.getItem('menu_items') || '[]');
            const service = services.find(s => s.id === serviceId);
            if (!service) return;
            
            currentEditingServiceId = serviceId;
            const modal = document.getElementById('add-service-modal');
            if (!modal) return;
            
            // ملء الحقول
            document.getElementById('add-service-title').textContent = '✏️ تعديل خدمة / منتج';
            document.getElementById('service-name').value = service.name || '';
            document.getElementById('service-icon').value = service.icon || '🍽️';
            document.getElementById('service-type').value = service.type || 'fnb';
            document.getElementById('service-price').value = service.price || '';
            document.getElementById('service-url').value = service.url || '';
            document.getElementById('service-whatsapp').value = service.whatsapp || '';
            document.getElementById('service-image-url').value = service.imageUrl || '';
            document.getElementById('service-visible-guest').checked = service.visibleToGuest !== false;
            document.getElementById('service-is-minibar').checked = service.isMiniBar === true;
            document.getElementById('service-show-in-qr').checked = service.showInQR !== false;
            document.getElementById('service-instant').checked = service.instant !== false;
            
            // عرض الصورة
            if (service.imageUrl) {
                document.getElementById('service-image-preview').innerHTML = 
                    `<img src="${service.imageUrl}" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 2px solid var(--border-color);">`;
            }
            
            updateServiceTypeFields();
            modal.style.display = 'flex';
        }
        
        function updateServiceTypeFields() {
            const type = document.getElementById('service-type').value;
            const priceGroup = document.getElementById('service-price-group');
            const urlGroup = document.getElementById('service-url-group');
            const whatsappGroup = document.getElementById('service-whatsapp-group');
            
            // إظهار/إخفاء الحقول حسب النوع
            if (priceGroup) priceGroup.style.display = (type === 'fnb' || type === 'orderable') ? 'block' : 'none';
            if (urlGroup) urlGroup.style.display = (type === 'link') ? 'block' : 'none';
            if (whatsappGroup) whatsappGroup.style.display = (type === 'whatsapp') ? 'block' : 'none';
        }
        
        // إضافة event listener لتغيير النوع
        document.addEventListener('DOMContentLoaded', function() {
            const typeSelect = document.getElementById('service-type');
            if (typeSelect) {
                typeSelect.addEventListener('change', updateServiceTypeFields);
            }
        });
        
        function handleServiceImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            showMiniAlert('⏳ جاري رفع الصورة...', 'info');
            
            uploadImageToStorage(file, `services/${Date.now()}_${file.name}`).then(url => {
                if (url) {
                    document.getElementById('service-image-url').value = url;
                    const preview = document.getElementById('service-image-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 2px solid var(--border-color);">`;
                    }
                    showMiniAlert('✅ تم رفع الصورة بنجاح', 'success');
                } else {
                    showMiniAlert('❌ فشل رفع الصورة', 'error');
                }
            });
        }
        
        function saveService() {
            const name = document.getElementById('service-name').value.trim();
            if (!name) {
                showMiniAlert('⚠️ يرجى إدخال اسم المنتج', 'warning');
                return;
            }
            
            const service = {
                id: currentEditingServiceId || 'item_' + Date.now(),
                name: name,
                icon: document.getElementById('service-icon').value || '🍽️',
                type: document.getElementById('service-type').value,
                price: document.getElementById('service-price').value || '0',
                url: document.getElementById('service-url').value || '',
                whatsapp: document.getElementById('service-whatsapp').value || '',
                imageUrl: document.getElementById('service-image-url').value || '',
                visibleToGuest: document.getElementById('service-visible-guest').checked,
                isMiniBar: document.getElementById('service-is-minibar').checked,
                showInQR: document.getElementById('service-show-in-qr').checked,
                instant: document.getElementById('service-instant').checked,
                createdAt: currentEditingServiceId ? undefined : Date.now(),
                updatedAt: Date.now()
            };
            
            // حفظ في localStorage
            let services = JSON.parse(localStorage.getItem('menu_items') || '[]');
            
            if (currentEditingServiceId) {
                const index = services.findIndex(s => s.id === currentEditingServiceId);
                if (index !== -1) {
                    services[index] = { ...services[index], ...service };
                }
            } else {
                services.push(service);
            }
            
            localStorage.setItem('menu_items', JSON.stringify(services));
            
            // حفظ في Firebase
            if (db) {
                const hotelId = HOTEL_CONFIG.hotelId || 'default';
                db.collection('hotel_settings').doc(hotelId).collection('menu_items').doc(service.id).set(service, { merge: true })
                    .then(() => {
                        showMiniAlert('✅ تم حفظ المنتج بنجاح', 'success');
                        closeModal('add-service-modal');
                        loadMenuItems();
                    })
                    .catch(e => {
                        console.error('Error saving to Firebase:', e);
                        showMiniAlert('⚠️ تم الحفظ محلياً فقط', 'warning');
                        closeModal('add-service-modal');
                        loadMenuItems();
                    });
            } else {
                showMiniAlert('✅ تم حفظ المنتج محلياً', 'success');
                closeModal('add-service-modal');
                loadMenuItems();
            }
        }
        
        function deleteService(serviceId) {
            if (!confirm('⚠️ هل أنت متأكد من حذف هذا المنتج؟')) return;
            
            // حذف من localStorage
            let services = JSON.parse(localStorage.getItem('menu_items') || '[]');
            services = services.filter(s => s.id !== serviceId);
            localStorage.setItem('menu_items', JSON.stringify(services));
            
            // حذف من Firebase
            if (db) {
                const hotelId = HOTEL_CONFIG.hotelId || 'default';
                db.collection('hotel_settings').doc(hotelId).collection('menu_items').doc(serviceId).delete()
                    .then(() => {
                        showMiniAlert('✅ تم حذف المنتج', 'success');
                        loadMenuItems();
                    })
                    .catch(e => {
                        console.error('Error deleting from Firebase:', e);
                        showMiniAlert('⚠️ تم الحذف محلياً فقط', 'warning');
                        loadMenuItems();
                    });
            } else {
                showMiniAlert('✅ تم حذف المنتج', 'success');
                loadMenuItems();
            }
        }
        
        async function loadMenuItems() {
            const container = document.getElementById('menu-items-list');
            if (!container) return;
            
            let services = [];
            
            // محاولة التحميل من Firebase أولاً
            if (db) {
                try {
                    const hotelId = HOTEL_CONFIG.hotelId || 'default';
                    const snapshot = await db.collection('hotel_settings').doc(hotelId).collection('menu_items')
                        .orderBy('updatedAt', 'desc')
                        .get();
                    if (!snapshot.empty) {
                        services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        // حفظ في localStorage للسرعة
                        localStorage.setItem('menu_items', JSON.stringify(services));
                    } else {
                        // Fallback إلى localStorage
                        services = JSON.parse(localStorage.getItem('menu_items') || '[]');
                    }
                } catch(e) {
                    console.error('Error loading from Firebase:', e);
                    services = JSON.parse(localStorage.getItem('menu_items') || '[]');
                }
            } else {
                services = JSON.parse(localStorage.getItem('menu_items') || '[]');
            }
            
            if (services.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-sec);">
                        <div style="font-size: 3rem; margin-bottom: 16px;">📋</div>
                        <div>لا توجد منتجات أو خدمات حالياً</div>
                        <div style="font-size: 0.9rem; margin-top: 8px;">اضغط "➕ إضافة خدمة / منتج" لإضافة أول منتج</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = services.map(service => `
                <div class="menu-item-card" style="background: var(--bg-card); border-radius: 12px; padding: 16px; border: 2px solid var(--border-color); transition: all 0.3s ease;">
                    ${service.imageUrl ? `
                        <div style="width: 100%; height: 150px; border-radius: 8px; overflow: hidden; margin-bottom: 12px; background: var(--bg-sec);">
                            <img src="${service.imageUrl}" alt="${service.name}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    ` : `
                        <div style="width: 100%; height: 150px; border-radius: 8px; margin-bottom: 12px; background: linear-gradient(135deg, var(--primary), #0EA5E9); display: flex; align-items: center; justify-content: center; font-size: 4rem;">
                            ${service.icon || '🍽️'}
                        </div>
                    `}
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <h4 style="margin: 0; color: var(--text-main); font-size: 1.1rem; font-weight: 700;">
                            ${service.icon || '🍽️'} ${service.name}
                        </h4>
                        <button onclick="deleteService('${service.id}')" class="glass-btn" style="background: var(--danger); color: white; padding: 6px 12px; font-size: 0.85rem;">🗑️</button>
                    </div>
                    
                    <div style="margin-bottom: 12px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: var(--text-sec); margin-bottom: 8px;">
                            <strong>النوع:</strong> ${getServiceTypeLabel(service.type)}
                        </div>
                        ${service.price && service.price !== '0' ? `
                            <div style="font-size: 0.85rem; color: var(--text-sec); margin-bottom: 8px;">
                                <strong>السعر:</strong> ${service.price} ريال
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                        <div class="toggle-container" style="margin: 0;">
                            <div class="toggle-label" style="font-size: 0.85rem;">👤 للضيف</div>
                            <label class="switch">
                                <input type="checkbox" ${service.visibleToGuest ? 'checked' : ''} onchange="toggleServiceProperty('${service.id}', 'visibleToGuest', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                        
                        <div class="toggle-container" style="margin: 0;">
                            <div class="toggle-label" style="font-size: 0.85rem;">📦 ميني بار</div>
                            <label class="switch">
                                <input type="checkbox" ${service.isMiniBar ? 'checked' : ''} onchange="toggleServiceProperty('${service.id}', 'isMiniBar', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                        
                        <div class="toggle-container" style="margin: 0;">
                            <div class="toggle-label" style="font-size: 0.85rem;">📱 في QR</div>
                            <label class="switch">
                                <input type="checkbox" ${service.showInQR ? 'checked' : ''} onchange="toggleServiceProperty('${service.id}', 'showInQR', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                        
                        <div class="toggle-container" style="margin: 0;">
                            <div class="toggle-label" style="font-size: 0.85rem;">⚡ فوري</div>
                            <label class="switch">
                                <input type="checkbox" ${service.instant !== false ? 'checked' : ''} onchange="toggleServiceProperty('${service.id}', 'instant', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <button onclick="openEditServiceModal('${service.id}')" class="glass-btn" style="width: 100%; padding: 10px; font-size: 0.9rem;">✏️ تعديل</button>
                </div>
            `).join('');
        }
        
        function getServiceTypeLabel(type) {
            const labels = {
                'form': 'نموذج',
                'fnb': 'أغذية ومشروبات',
                'link': 'رابط',
                'whatsapp': 'واتساب',
                'minibar': 'ميني بار',
                'orderable': 'منتج قابل للطلب'
            };
            return labels[type] || type;
        }
        
        function toggleServiceProperty(serviceId, property, value) {
            let services = JSON.parse(localStorage.getItem('menu_items') || '[]');
            const index = services.findIndex(s => s.id === serviceId);
            
            if (index !== -1) {
                services[index][property] = value;
                services[index].updatedAt = Date.now();
                localStorage.setItem('menu_items', JSON.stringify(services));
                
                // تحديث في Firebase
                if (db) {
                    const hotelId = HOTEL_CONFIG.hotelId || 'default';
                    db.collection('hotel_settings').doc(hotelId).collection('menu_items').doc(serviceId).update({
                        [property]: value,
                        updatedAt: Date.now()
                    }).catch(e => console.error('Error updating Firebase:', e));
                }
            }
        }
        
        function showMenuEditor() {
            toggleSideMenu();
            const modal = document.getElementById('menu-editor-modal');
            if (!modal) return;
            
            modal.style.display = 'flex';
            loadMenuItems();
        }
        
        function closeMenuEditor() {
            const modal = document.getElementById('menu-editor-modal');
            if (modal) modal.style.display = 'none';
        }
        
        function requestAmenityItem(name, price, icon) {
            if (!guestRoomNum) return;
            const message = `${icon} ${name} - ${price} ريال`;
            submitGuestRequest(guestRoomNum, 'amenity', message);
            showMiniAlert(`✅ تم طلب ${name}`, 'success');
        }
        
        // ===============================================
        // == Minibar Manager ===========================
        // ===============================================
        
        const MinibarManager = {
            items: [],
            
            async loadMinibar() {
                // محاولة التحميل من menu_items الجديد أولاً
                try {
                    if (db) {
                        const hotelId = HOTEL_CONFIG.hotelId || 'default';
                        const snapshot = await db.collection('hotel_settings').doc(hotelId).collection('menu_items')
                            .where('isMiniBar', '==', true)
                            .get();
                        
                        if (!snapshot.empty) {
                            this.items = snapshot.docs.map(doc => doc.data());
                            return; // نجح التحميل من menu_items
                        }
                    }
                } catch(e) {
                    console.error('Error loading minibar from menu_items:', e);
                }
                
                // Fallback إلى النظام القديم
                if (db) {
                try {
                    const snapshot = await db.collection('minibarItems').where('branch', '==', 'default').get();
                    this.items = [];
                    snapshot.forEach(doc => {
                        this.items.push({ id: doc.id, ...doc.data() });
                    });
                } catch(e) {
                        console.error('Error loading minibar from old system:', e);
                    }
                }
                
                // Fallback أخير إلى localStorage
                if (this.items.length === 0) {
                    const allMenuItems = JSON.parse(localStorage.getItem('menu_items') || '[]');
                    this.items = allMenuItems.filter(item => item.isMiniBar === true);
                }
            },
            
            async saveMinibar() {
                // لا حاجة لحفظ منفصل - يتم الحفظ عبر محرر قائمة الخدمات
                // هذه الدالة موجودة للتوافق مع الكود القديم فقط
                console.log('Minibar items are now managed through Menu Editor');
            },
            
            renderInspectionModal() {
                const container = document.getElementById('minibar-items-dynamic');
                if (!container) return;
                
                if (this.items.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد عناصر في الميني بار<br><small>استخدم "📋 محرر قائمة الخدمات" لإضافة عناصر</small></p>';
                    return;
                }
                
                container.innerHTML = this.items.map(item => `
                    <label class="minibar-item-checkbox" style="display:flex; align-items:center; gap:10px; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:8px; cursor:pointer; border:1px solid var(--border-color);">
                        <input type="checkbox" value="${item.name}" style="width:20px; height:20px; cursor:pointer;">
                        <span style="font-size:1.2rem;">${item.icon || '🍫'}</span>
                        <span style="font-weight:700; flex:1;">${item.name}</span>
                        ${item.price && item.price !== '0' ? `<span style="color:var(--text-sec); font-size:0.9rem;">${item.price} ريال</span>` : ''}
                    </label>
                `).join('');
            }
        };
        
        // ===============================================
        // == Maintenance Scheduler ====================
        // ===============================================
        
        function showMaintenanceScheduler() {
            toggleSideMenu();
            verifyAdminPIN(() => {
                loadScheduledMaintenance();
                document.getElementById('maintenance-scheduler-modal').style.display = 'flex';
            });
        }
        
        function closeMaintenanceScheduler() {
            const modal = document.getElementById('maintenance-scheduler-modal');
            if (modal) modal.style.display = 'none';
        }
        
        async function loadScheduledMaintenance() {
            if (!db) return;
            
            try {
                const snapshot = await db.collection('recurringMaintenance').where('branch', '==', 'default').get();
                const scheduled = [];
                snapshot.forEach(doc => {
                    scheduled.push({ id: doc.id, ...doc.data() });
                });
                
                renderScheduledMaintenanceList(scheduled);
            } catch (e) {
                console.error('Error loading scheduled maintenance:', e);
            }
        }
        
        function renderScheduledMaintenanceList(scheduled) {
            const list = document.getElementById('scheduled-maintenance-list');
            if (!list) return;
            
            if (scheduled.length === 0) {
                list.innerHTML = '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا توجد مهام مجدولة</p>';
                return;
            }
            
            list.innerHTML = scheduled.map(item => {
                const freqText = {
                    daily: 'يومي',
                    weekly: 'أسبوعي',
                    monthly: 'شهري',
                    custom: `كل ${item.customDays || 0} أيام`
                }[item.frequency] || item.frequency;
                
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; 
                                padding: 12px; margin-bottom: 8px; background: white; 
                                border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 0.9rem;">غرفة ${item.roomNum}</div>
                            <div style="font-size: 0.8rem; color: var(--text-sec);">${item.description}</div>
                            <div style="font-size: 0.75rem; color: var(--text-sec); margin-top: 4px;">
                                ${freqText} - ${item.time || '09:00'}
                            </div>
                        </div>
                        <button onclick="deleteScheduledMaintenance('${item.id}')" 
                                style="background: var(--danger); color: white; border: none; 
                                       padding: 6px 12px; border-radius: 6px; cursor: pointer; 
                                       font-size: 0.85rem;">🗑️</button>
                    </div>
                `;
            }).join('');
        }
        
        async function addScheduledMaintenance() {
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            const roomNumInput = document.getElementById('scheduler-room-num');
            const descInput = document.getElementById('scheduler-task-desc');
            const timeInput = document.getElementById('scheduler-time');
            const freqSelect = document.getElementById('scheduler-frequency');
            const customDaysInput = document.getElementById('scheduler-custom-days-input');
            
            const roomNum = roomNumInput ? roomNumInput.value : '';
            const description = descInput ? descInput.value.trim() : '';
            const time = timeInput ? timeInput.value : '09:00';
            const frequency = freqSelect ? freqSelect.value : 'daily';
            const customDays = frequency === 'custom' && customDaysInput ? parseInt(customDaysInput.value) : null;
            
            if (!roomNum || !description) {
                showMiniAlert('⚠️ يرجى إدخال جميع البيانات', 'warning');
                return;
            }
            
            if (frequency === 'custom' && (!customDays || customDays < 1)) {
                showMiniAlert('⚠️ يرجى إدخال عدد الأيام', 'warning');
                return;
            }
            
            try {
                await db.collection('recurringMaintenance').doc().set({
                    roomNum: parseInt(roomNum),
                    description,
                    frequency,
                    time,
                    customDays,
                    branch: 'default',
                    createdAt: Date.now()
                });
                
                if (roomNumInput) roomNumInput.value = '';
                if (descInput) descInput.value = '';
                if (timeInput) timeInput.value = '09:00';
                if (freqSelect) freqSelect.value = 'daily';
                if (customDaysInput) customDaysInput.value = '';
                
                showMiniAlert('✅ تم إضافة المهمة المجدولة', 'success');
                loadScheduledMaintenance();
            } catch (e) {
                console.error('Error adding scheduled maintenance:', e);
                showMiniAlert('❌ فشل إضافة المهمة', 'error');
            }
        }
        
        async function deleteScheduledMaintenance(id) {
            if (!db) return;
            
            if (!confirm('هل أنت متأكد من حذف هذه المهمة المجدولة؟')) return;
            
            try {
                await db.collection('recurringMaintenance').doc(id).delete();
                showMiniAlert('✅ تم حذف المهمة', 'success');
                loadScheduledMaintenance();
            } catch (e) {
                console.error('Error deleting scheduled maintenance:', e);
                showMiniAlert('❌ فشل الحذف', 'error');
            }
        }
        
        // Handle frequency change
        document.addEventListener('DOMContentLoaded', () => {
            const freqSelect = document.getElementById('scheduler-frequency');
            const customDaysDiv = document.getElementById('scheduler-custom-days');
            if (freqSelect && customDaysDiv) {
                freqSelect.addEventListener('change', function() {
                    customDaysDiv.style.display = this.value === 'custom' ? 'block' : 'none';
                });
            }
            
            // Handle inspection photo uploads
            const damagePhoto = document.getElementById('damage-photo');
            const lostfoundPhoto = document.getElementById('lostfound-photo');
            
            if (damagePhoto) {
                damagePhoto.addEventListener('change', async function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const preview = document.getElementById('damage-preview');
                        const label = damagePhoto.previousElementSibling;
                        if (preview && label) {
                            // إظهار الدائرة الدوارة أثناء الرفع
                            preview.innerHTML = `
                                <div class="photo-upload-indicator">
                                    <div class="upload-spinner"></div>
                                    <span style="font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 8px; display: block;">⏳ جاري الرفع...</span>
                                </div>
                            `;
                            preview.style.display = 'block';
                            
                            // محاولة رفع الصورة
                            try {
                                const imgUrl = await uploadToImgBB(file);
                                if (imgUrl) {
                                    // تحديث المؤشر بعد اكتمال الرفع
                                    preview.innerHTML = `
                                        <div class="photo-upload-indicator">
                                            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--success); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">✅</div>
                                            <span style="font-size: 0.85rem; color: var(--success); font-weight: 600; margin-top: 8px; display: block;">${t('photoUploaded')}</span>
                                        </div>
                                    `;
                                    label.style.borderColor = 'var(--success)';
                                    label.style.borderWidth = '2px';
                                    label.style.borderStyle = 'solid';
                                }
                            } catch (error) {
                                preview.innerHTML = '';
                                preview.style.display = 'none';
                                showMiniAlert('❌ فشل رفع الصورة', 'error');
                            }
                        }
                    }
                });
            }
            
            if (lostfoundPhoto) {
                lostfoundPhoto.addEventListener('change', async function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const preview = document.getElementById('lostfound-preview');
                        const label = lostfoundPhoto.previousElementSibling;
                        if (preview && label) {
                            // إظهار الدائرة الدوارة أثناء الرفع
                            preview.innerHTML = `
                                <div class="photo-upload-indicator">
                                    <div class="upload-spinner"></div>
                                    <span style="font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 8px; display: block;">⏳ جاري الرفع...</span>
                                </div>
                            `;
                            preview.style.display = 'block';
                            
                            // محاولة رفع الصورة
                            try {
                                const imgUrl = await uploadToImgBB(file);
                                if (imgUrl) {
                                    // تحديث المؤشر بعد اكتمال الرفع
                                    preview.innerHTML = `
                                        <div class="photo-upload-indicator">
                                            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--success); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">✅</div>
                                            <span style="font-size: 0.85rem; color: var(--success); font-weight: 600; margin-top: 8px; display: block;">${t('photoUploaded')}</span>
                                        </div>
                                    `;
                                    label.style.borderColor = 'var(--success)';
                                    label.style.borderWidth = '2px';
                                    label.style.borderStyle = 'solid';
                                }
                            } catch (error) {
                                preview.innerHTML = '';
                                preview.style.display = 'none';
                                showMiniAlert('❌ فشل رفع الصورة', 'error');
                            }
                        }
                    }
                });
            }
        });
        
        // ===============================================
        // == Shift Log ================================
        // ===============================================
        
        function showShiftLog() {
            toggleSideMenu();
            loadShiftLogs();
            document.getElementById('shift-log-modal').style.display = 'flex';
        }
        
        function closeShiftLog() {
            const modal = document.getElementById('shift-log-modal');
            if (modal) modal.style.display = 'none';
        }
        
        async function loadShiftLogs() {
            if (!db) return;
            
            try {
                // جلب البيانات بدون orderBy لتجنب الحاجة لـ index
                const snapshot = await db.collection('shiftLogs').where('branch', '==', 'default').get();
                const logs = [];
                snapshot.forEach(doc => {
                    logs.push({ id: doc.id, ...doc.data() });
                });
                
                // ترتيب محلياً حسب timestamp
                logs.sort((a, b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
                    return bTime - aTime; // ترتيب تنازلي
                });
                
                // تحديد أول 20 عنصر
                const limitedLogs = logs.slice(0, 20);
                
                renderShiftLogsList(limitedLogs);
            } catch (e) {
                console.error('Error loading shift logs:', e);
            }
        }
        
        function renderShiftLogsList(logs) {
            const list = document.getElementById('shift-logs-list');
            if (!list) return;
            
            if (logs.length === 0) {
                list.innerHTML = '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد سجلات</p>';
                return;
            }
            
            const typeLabels = {
                handover: 'تسليم',
                note: 'ملاحظة',
                issue: 'مشكلة'
            };
            
            list.innerHTML = logs.map(log => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleString('ar-EG');
                return `
                    <div style="padding:10px; margin-bottom:8px; background:#f8fafc; border-radius:8px; border-left:3px solid var(--primary);">
                        <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px;">${typeLabels[log.type] || log.type}</div>
                        <div style="font-size:0.85rem; color:var(--text-sec); margin-bottom:4px;">${log.notes}</div>
                        <div style="font-size:0.75rem; color:var(--text-sec);">${timeStr}</div>
                    </div>
                `;
            }).join('');
        }
        
        async function saveShiftLog() {
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            const typeSelect = document.getElementById('shift-log-type');
            const notesInput = document.getElementById('shift-log-notes');
            const type = typeSelect ? typeSelect.value : 'note';
            const notes = notesInput ? notesInput.value.trim() : '';
            
            if (!notes) {
                showMiniAlert('⚠️ يرجى إدخال الملاحظات', 'warning');
                return;
            }
            
            try {
                await db.collection('shiftLogs').doc().set({
                    type,
                    notes,
                    branch: 'default',
                    timestamp: Date.now(),
                    createdBy: 'staff'
                });
                
                if (notesInput) notesInput.value = '';
                loadShiftLogs();
                // تم حذف showModalSuccess
            } catch (e) {
                console.error('Error saving shift log:', e);
                showMiniAlert('❌ فشل الحفظ', 'error');
            }
        }
        
        // ===============================================
        // == Loyalty Check ============================
        // ===============================================
        
        // ===============================================
        // == News Ticker ==============================
        // ===============================================
        
        function showNewsTickerEditor() {
            toggleSideMenu();
            verifyAdminPIN(() => {
                loadNewsTicker();
                document.getElementById('news-ticker-modal').style.display = 'flex';
            });
        }
        
        function closeNewsTickerEditor() {
            const modal = document.getElementById('news-ticker-modal');
            if (modal) modal.style.display = 'none';
        }
        
        async function loadNewsTicker() {
            if (!db) return;
            
            try {
                const doc = await db.collection('settings').doc('newsTicker_default').get();
                const messageInput = document.getElementById('news-ticker-message');
                const enabledCheckbox = document.getElementById('news-ticker-enabled');
                
                if (doc.exists) {
                    const data = doc.data();
                    if (messageInput) messageInput.value = data.message || '';
                    if (enabledCheckbox) enabledCheckbox.checked = data.enabled !== false;
                } else {
                    if (messageInput) messageInput.value = '';
                    if (enabledCheckbox) enabledCheckbox.checked = false;
                }
            } catch (e) {
                console.error('Error loading news ticker:', e);
            }
        }
        
        async function saveNewsTicker() {
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            const messageInput = document.getElementById('news-ticker-message');
            const enabledCheckbox = document.getElementById('news-ticker-enabled');
            const message = messageInput ? messageInput.value.trim() : '';
            const enabled = enabledCheckbox ? enabledCheckbox.checked : false;
            
            try {
                await db.collection('settings').doc('newsTicker_default').set({
                    message,
                    enabled,
                    branch: 'default',
                    updatedAt: Date.now()
                }, { merge: true });
                
                closeNewsTickerEditor();
                // تم حذف showModalSuccess
            } catch (e) {
                console.error('Error saving news ticker:', e);
                showMiniAlert('❌ فشل الحفظ', 'error');
            }
        }
        
        // ===============================================
        // == Admin PIN Verification ====================
        // ===============================================
        
        let pendingAdminCallback = null;
        
        function verifyAdminPIN(callback) {
            pendingAdminCallback = callback;
            const modal = document.getElementById('admin-pin-modal');
            const input = document.getElementById('admin-pin-input');
            if (modal) {
                modal.style.display = 'flex';
                if (input) {
                    input.value = '';
                    setTimeout(() => input.focus(), 100);
                }
            }
        }
        
        function confirmAdminPIN() {
            const input = document.getElementById('admin-pin-input');
            if (!input) return;
            
            const pass = input.value.trim();
            if (!pass) {
                showMiniAlert('⚠️ يرجى إدخال الرمز', 'warning');
                return;
            }
            
            // تم حذف كلمة المرور - السماح بالدخول دائماً
            if (HOTEL_CONFIG.adminHash === null || simpleHash(pass) === HOTEL_CONFIG.adminHash) {
                closeAdminPINModal();
                if (pendingAdminCallback) {
                    pendingAdminCallback();
                    pendingAdminCallback = null;
                }
            } else {
                showMiniAlert('❌ رمز خاطئ', 'error');
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }
        }
        
        function closeAdminPINModal() {
            const modal = document.getElementById('admin-pin-modal');
            const input = document.getElementById('admin-pin-input');
            if (modal) modal.style.display = 'none';
            if (input) input.value = '';
            pendingAdminCallback = null;
        }
        
        // تصدير الدوال للاستخدام العام
        window.adoraSystem = {
            toggleTurboMode,
            toggleDarkMode,
            toggleFocusMode,
            generateDailyReport,
            showQuickReport,
            showPurchasesModal,
            showComprehensiveLog,
            addPoints,
            getState: () => ({ ...appState })
        };
        
        // تصدير دوال القائمة الجانبية للاستخدام العام
        window.showMenuEditor = showMenuEditor;
        window.openAddServiceModal = openAddServiceModal;
        window.openEditServiceModal = openEditServiceModal;
        window.saveService = saveService;
        window.deleteService = deleteService;
        window.toggleServiceProperty = toggleServiceProperty;
        window.handleServiceImageUpload = handleServiceImageUpload;
        window.showMaintenanceScheduler = showMaintenanceScheduler;
        window.showShiftLog = showShiftLog;
        window.showNewsTickerEditor = showNewsTickerEditor;
        window.showRoomQuickInfo = showRoomQuickInfo;
        window.showAdvancedReports = showAdvancedReports;
        window.closeAdvancedReports = closeAdvancedReports;
        window.switchReportTab = switchReportTab;
        window.generateDailyReport = generateDailyReport;
        window.showPurchasesModal = showPurchasesModal;
        // تم استبدال addMenuItem بـ openAddServiceModal
        // window.addMenuItem = addMenuItem; // محذوف - استخدم openAddServiceModal
        // window.removeMenuItem = removeMenuItem; // محذوف - استخدم deleteService
        // window.saveMenuItems = saveMenuItems; // محذوف - استخدم saveService
        window.addScheduledMaintenance = addScheduledMaintenance;
        window.deleteScheduledMaintenance = deleteScheduledMaintenance;
        window.saveShiftLog = saveShiftLog;
        window.saveNewsTicker = saveNewsTicker;
        window.confirmAdminPIN = confirmAdminPIN;
        window.closeAdminPINModal = closeAdminPINModal;
        window.dismissInspectionAlert = dismissInspectionAlert;
        window.showInspectionAlert = showInspectionAlert;
        window.handleInspectionAction = handleInspectionAction;
        window.pauseInspectionAlert = pauseInspectionAlert;
        window.resumeInspectionAlert = resumeInspectionAlert;
        window.showInspectionDetails = showInspectionDetails;
        // تم حذف وظائف الأرشيف
        window.toggleFABMenu = toggleFABMenu;
        window.openFABOption = openFABOption;
        window.openAddModal = openAddModal;
        window.toggleSideMenu = toggleSideMenu;
        window.toggleFocusMode = toggleFocusMode;
        window.toggleLanguage = toggleLanguage;
        
        // تهيئة التطبيق عند تحميل الصفحة
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
        
        console.log('✅ Adora System is ready!');
        
        // ===============================================
        // == نظام مولد QR وبوابة النزيل ================
        // ===============================================
        
        // فتح مودال مولد QR (يتم فتحه من لوحة التحكم الآن)
        function openQRGeneratorModal() {
            // فتح لوحة التحكم على تبويب QR
            showGuestPortalManager();
            setTimeout(() => {
                switchGuestPortalTab('qr');
            }, 100);
        }
        
        // توليد وطباعة QR من لوحة التحكم
        async function generateAndPrintQRFromGPM() {
            const fromInput = document.getElementById('gpm-qr-from');
            const toInput = document.getElementById('gpm-qr-to');
            const sizeInput = document.getElementById('gpm-qr-size');
            const colsInput = document.getElementById('gpm-qr-columns');
            
            if (!fromInput || !toInput) {
                showMiniAlert('⚠️ الحقول غير موجودة', 'warning');
                return;
            }
            
            const from = parseInt(fromInput.value, 10);
            const to = parseInt(toInput.value, 10);
            const size = parseInt(sizeInput ? sizeInput.value : '160', 10) || 160;
            const cols = parseInt(colsInput ? colsInput.value : '3', 10) || 3;
            
            if (!from || !to || from > to) {
                showMiniAlert('⚠️ نطاق غرف غير صالح', 'warning');
                return;
            }
            
            if (to - from > 50) {
                if (!confirm(`⚠️ سيتم توليد ${to - from + 1} رمز QR. هل تريد المتابعة؟`)) {
                    return;
                }
            }
            
            const preview = document.getElementById('gpm-qr-preview-area');
            const printArea = document.getElementById('qr-print-area');
            
            if (!preview || !printArea) {
                showMiniAlert('⚠️ عناصر QR غير موجودة', 'warning');
                return;
            }
            
            preview.innerHTML = '';
            printArea.innerHTML = '';
            preview.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            
            // توليد QR لكل غرفة
            for (let room = from; room <= to; room++) {
                const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}guest.html?room=${room}`;
                
                // Preview Card
                const card = document.createElement('div');
                card.style.padding = '12px';
                card.style.textAlign = 'center';
                card.style.background = 'var(--bg-card)';
                card.style.borderRadius = '12px';
                card.style.border = '1px solid var(--border-color)';
                card.style.transition = 'all 0.3s ease';
                
                const holder = document.createElement('div');
                holder.style.marginBottom = '10px';
                holder.style.display = 'flex';
                holder.style.justifyContent = 'center';
                holder.id = `qr-holder-${room}`;
                
                const label = document.createElement('div');
                label.textContent = `غرفة ${room}`;
                label.style.fontWeight = '700';
                label.style.fontSize = '0.9rem';
                label.style.marginTop = '8px';
                label.style.color = 'var(--text-main)';
                
                card.appendChild(holder);
                card.appendChild(label);
                preview.appendChild(card);
                
                // Print Card
                const printCard = document.createElement('div');
                printCard.style.padding = '20px';
                printCard.style.textAlign = 'center';
                printCard.style.pageBreakInside = 'avoid';
                
                const printHolder = document.createElement('div');
                printHolder.style.marginBottom = '10px';
                printHolder.style.display = 'flex';
                printHolder.style.justifyContent = 'center';
                printHolder.id = `qr-print-holder-${room}`;
                
                const printLabel = document.createElement('div');
                printLabel.textContent = `غرفة ${room}`;
                printLabel.style.fontWeight = '700';
                printLabel.style.fontSize = '1.2rem';
                printLabel.style.marginTop = '12px';
                
                printCard.appendChild(printHolder);
                printCard.appendChild(printLabel);
                printArea.appendChild(printCard);
                
                // توليد QR
                if (typeof QRCode !== 'undefined') {
                    new QRCode(holder, {
                        text: url,
                        width: size,
                        height: size,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    
                    new QRCode(printHolder, {
                        text: url,
                        width: size,
                        height: size,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } else {
                    holder.innerHTML = `<div style="padding: 20px; color: var(--text-sec);">QR Library غير محمّل</div>`;
                    printHolder.innerHTML = `<div style="padding: 20px;">QR Library غير محمّل</div>`;
                }
            }
            
            showMiniAlert(`✅ تم توليد ${to - from + 1} رمز QR`, 'success');
        }
        
        // إغلاق مودال (دالة مساعدة)
        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = 'none';
        }
        
        // توليد وطباعة QR
        async function generateAndPrintQR() {
            const fromInput = document.getElementById('qr-from');
            const toInput = document.getElementById('qr-to');
            const sizeInput = document.getElementById('qr-size');
            const colsInput = document.getElementById('qr-columns');
            
            if (!fromInput || !toInput) {
                showMiniAlert('⚠️ الحقول غير موجودة', 'warning');
                return;
            }
            
            const from = parseInt(fromInput.value, 10);
            const to = parseInt(toInput.value, 10);
            const size = parseInt(sizeInput ? sizeInput.value : '160', 10) || 160;
            const cols = parseInt(colsInput ? colsInput.value : '3', 10) || 3;
            
            if (!from || !to || from > to) {
                showMiniAlert('⚠️ نطاق غرف غير صالح', 'warning');
                return;
            }
            
            if (to - from > 50) {
                if (!confirm(`⚠️ سيتم توليد ${to - from + 1} رمز QR. هل تريد المتابعة؟`)) {
                    return;
                }
            }
            
            const preview = document.getElementById('qr-preview-area');
            const printArea = document.getElementById('qr-print-area');
            
            if (!preview || !printArea) {
                showMiniAlert('⚠️ عناصر QR غير موجودة', 'warning');
                return;
            }
            
            preview.innerHTML = '';
            printArea.innerHTML = '';
            preview.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            
            // توليد QR لكل غرفة
            for (let room = from; room <= to; room++) {
                const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}guest.html?room=${room}`;
                
                // Preview Card
                const card = document.createElement('div');
                card.style.padding = '12px';
                card.style.textAlign = 'center';
                card.style.background = 'var(--bg-card)';
                card.style.borderRadius = '12px';
                card.style.border = '1px solid var(--border-color)';
                card.style.transition = 'all 0.3s ease';
                
                const holder = document.createElement('div');
                holder.style.marginBottom = '10px';
                holder.style.display = 'flex';
                holder.style.justifyContent = 'center';
                holder.id = `qr-prev-${room}`;
                card.appendChild(holder);
                
                const lbl = document.createElement('div');
                lbl.textContent = `غرفة ${room}`;
                lbl.style.fontWeight = '700';
                lbl.style.fontSize = '0.95rem';
                lbl.style.color = 'var(--text-main)';
                card.appendChild(lbl);
                
                preview.appendChild(card);
                
                // Print Card
                const pcard = document.createElement('div');
                pcard.style.display = 'inline-block';
                pcard.style.width = `${100 / cols - 2}%`;
                pcard.style.textAlign = 'center';
                pcard.style.padding = '15px';
                pcard.style.margin = '10px';
                pcard.style.verticalAlign = 'top';
                pcard.innerHTML = `
                    <div style="font-weight: 800; margin-bottom: 10px; font-size: 1rem;">${HOTEL_CONFIG.name || 'الفندق'}</div>
                    <div style="font-weight: 700; margin-bottom: 10px; color: var(--primary);">غرفة ${room}</div>
                    <div id="qr-print-${room}"></div>
                    <div style="font-size: 0.75rem; margin-top: 8px; color: #666;">امسح الكود للوصول</div>
                `;
                printArea.appendChild(pcard);
                
                // توليد QR Code
                try {
                    if (typeof QRCode !== 'undefined') {
                        new QRCode(holder, {
                            text: url,
                            width: size,
                            height: size,
                            colorDark: '#000000',
                            colorLight: '#ffffff',
                            correctLevel: QRCode.CorrectLevel.H
                        });
                        
                        new QRCode(document.getElementById(`qr-print-${room}`), {
                            text: url,
                            width: size,
                            height: size,
                            colorDark: '#000000',
                            colorLight: '#ffffff',
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    } else {
                        console.error('QRCode library not loaded');
                        showMiniAlert('⚠️ مكتبة QR غير محملة', 'error');
                        return;
                    }
                } catch (e) {
                    console.error('Error generating QR:', e);
                    showMiniAlert('❌ خطأ في توليد QR', 'error');
                    return;
                }
            }
            
            showMiniAlert(`✅ تم توليد ${to - from + 1} رمز QR`, 'success');
            
            // تأخير بسيط ثم الطباعة
            setTimeout(() => {
                printArea.style.display = 'block';
                window.print();
                setTimeout(() => {
                    printArea.style.display = 'none';
                }, 500);
            }, 500);
        }
        
        // دالة إرسال طلب النزيل
        function sendGuestRequest(room, category, details, mode = 'instant', scheduledTime = null) {
            if (!room || room === '--') {
                if (typeof showMiniAlert !== 'undefined') {
                    showMiniAlert('⚠️ رقم الغرفة غير معروف', 'warning');
                } else {
                    alert('⚠️ رقم الغرفة غير معروف');
                }
                return;
            }
            
            // التحقق من أن room رقم صالح
            const roomNum = parseInt(room, 10);
            if (isNaN(roomNum) || roomNum <= 0) {
                if (typeof showMiniAlert !== 'undefined') {
                    showMiniAlert('⚠️ رقم الغرفة غير صالح', 'warning');
                } else {
                    alert('⚠️ رقم الغرفة غير صالح');
                }
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
                worker: 'نزيل'
            };
            
            if (mode === 'scheduled' && scheduledTime) {
                payload.schedTimestamp = scheduledTime;
                payload.schedTime = new Date(scheduledTime).toLocaleString('ar-EG');
            }
            
            // تحديد Collection حسب النوع
            let collectionName = 'guestRequests';
            if (category === 'maintenance') {
                collectionName = 'activeMaintenance';
                payload.maintDesc = details;
                payload.type = 'maint';
            }
            
            // إرسال إلى Firebase
            if (typeof db !== 'undefined' && db) {
                toggleSyncIndicator(true, 'pending');
                
                db.collection(collectionName).add(payload)
                    .then(() => {
                        toggleSyncIndicator(false);
                        if (typeof showMiniAlert !== 'undefined') {
                            showMiniAlert('✅ تم إرسال الطلب بنجاح', 'success');
                        } else {
                            alert('✅ تم إرسال الطلب بنجاح');
                        }
                        
                        if (typeof playNotificationSound === 'function') {
                            playNotificationSound();
                        }
                    })
                    .catch(e => {
                        console.error('Error sending guest request:', e);
                        toggleSyncIndicator(false);
                        if (typeof showMiniAlert !== 'undefined') {
                            showMiniAlert('❌ فشل إرسال الطلب', 'error');
                        } else {
                            alert('❌ فشل إرسال الطلب');
                        }
                    });
            } else {
                // Fallback: حفظ محلياً
                const pending = JSON.parse(localStorage.getItem('guest_pending') || '[]');
                pending.push({
                    ...payload,
                    timestamp: Date.now()
                });
                localStorage.setItem('guest_pending', JSON.stringify(pending));
                
                if (typeof showMiniAlert !== 'undefined') {
                    showMiniAlert('✅ تم حفظ الطلب محلياً (غير متصل)', 'success');
                } else {
                    alert('✅ تم حفظ الطلب محلياً (غير متصل)');
                }
            }
        }
        
        // ===============================================
        // == لوحة تحكم بوابة النزيل (Guest Portal Manager) ===
        // ===============================================
        
        let currentGuestPortalTab = 'design';
        
        function showGuestPortalManager() {
            toggleSideMenu();
            const modal = document.getElementById('guest-portal-manager-modal');
            if (!modal) return;
            
            modal.style.display = 'flex';
            loadGuestPortalSettings();
            renderTabsList();
            // renderFNBList تم دمجه في MenuManager
            loadQRTemplates();
            
            // إعادة تعيين حقول QR
            const qrFrom = document.getElementById('gpm-qr-from');
            const qrTo = document.getElementById('gpm-qr-to');
            if (qrFrom) qrFrom.value = '';
            if (qrTo) qrTo.value = '';
            const qrPreview = document.getElementById('gpm-qr-preview-area');
            if (qrPreview) qrPreview.innerHTML = '';
            
            // إظهار معاينة اللوجو
            const logoInput = document.getElementById('gpm-logo');
            if (logoInput) {
                logoInput.addEventListener('input', function() {
                    const preview = document.getElementById('gpm-logo-preview');
                    if (preview && this.value) {
                        preview.innerHTML = `<img src="${this.value}" alt="Logo Preview" style="max-width: 100px; max-height: 100px; border-radius: 8px; border: 2px solid var(--border-color);">`;
                    } else if (preview) {
                        preview.innerHTML = '';
                    }
                });
            }
            
            // إظهار/إخفاء قسم لوجو QR
            const qrLogoEnabled = document.getElementById('gpm-qr-logo-enabled');
            const qrLogoSection = document.getElementById('gpm-qr-logo-section');
            if (qrLogoEnabled && qrLogoSection) {
                qrLogoEnabled.addEventListener('change', function() {
                    qrLogoSection.style.display = this.checked ? 'block' : 'none';
                });
            }
        }
        
        function switchGuestPortalTab(tab) {
            currentGuestPortalTab = tab;
            
            // تحديث التبويبات
            document.querySelectorAll('.gpm-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.querySelectorAll('.add-mode-tab').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.getElementById(`gpm-content-${tab}`).style.display = 'block';
            document.getElementById(`gpm-tab-${tab}`).classList.add('active');
        }
        
        function loadGuestPortalSettings() {
            try {
                const saved = localStorage.getItem('HOTEL_GUEST_CONFIG');
                if (saved) {
                    const config = JSON.parse(saved);
                    
                    if (config.bgColor) document.getElementById('gpm-bg-color').value = config.bgColor;
                    if (config.bgImage) document.getElementById('gpm-bg-image').value = config.bgImage;
                    if (config.logo) document.getElementById('gpm-logo').value = config.logo;
                    if (config.title) document.getElementById('gpm-title').value = config.title;
                    if (config.subtitle) document.getElementById('gpm-subtitle').value = config.subtitle;
                    if (config.theme) document.getElementById('gpm-theme').value = config.theme;
                    if (config.primaryColor) document.getElementById('gpm-primary-color').value = config.primaryColor;
                    if (config.googleReviewUrl) document.getElementById('gpm-google-review').value = config.googleReviewUrl;
                    if (config.quickWhatsapp) document.getElementById('gpm-whatsapp-manager').value = config.quickWhatsapp;
                    if (config.kitchenWhatsapp) document.getElementById('gpm-whatsapp-kitchen').value = config.kitchenWhatsapp;
                    if (config.receptionPhone) document.getElementById('gpm-reception-phone').value = config.receptionPhone;
                    if (config.welcomeMessage) document.getElementById('gpm-welcome-message').value = config.welcomeMessage;
                    if (config.qrSize) document.getElementById('gpm-qr-size').value = config.qrSize;
                    if (config.qrColumns) document.getElementById('gpm-qr-columns').value = config.qrColumns;
                    if (config.qrLogoEnabled) document.getElementById('gpm-qr-logo-enabled').checked = config.qrLogoEnabled;
                    if (config.qrLogoUrl) document.getElementById('gpm-qr-logo-url').value = config.qrLogoUrl;
                    
                    // إظهار قسم لوجو QR إذا كان مفعلاً
                    if (config.qrLogoEnabled) {
                        document.getElementById('gpm-qr-logo-section').style.display = 'block';
                    }
                }
            } catch(e) {
                console.error('Error loading guest portal settings:', e);
            }
        }
        
        // رفع صورة إلى Firebase Storage (مع fallback لـ ImgBB)
        async function uploadImageToStorage(file, path) {
            if (!file) return null;
            
            // التحقق من حجم الصورة (أقل من 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showMiniAlert('⚠️ حجم الصورة كبير جداً (الحد الأقصى 2MB)', 'warning');
                return null;
            }
            
            // التحقق من نوع الصورة
            if (!file.type.startsWith('image/')) {
                showMiniAlert('⚠️ الملف المحدد ليس صورة', 'warning');
                return null;
            }
            
            // التحقق من protocol - إذا كان file:// أو origin null، استخدم ImgBB مباشرة
            const isFileProtocol = location.protocol === 'file:' || location.protocol === '';
            const isNullOrigin = !location.origin || location.origin === 'null' || location.origin === '';
            const isLocalFile = window.location.href.startsWith('file://');
            const shouldUseImgBB = isFileProtocol || isNullOrigin || isLocalFile;
            
            if (shouldUseImgBB) {
                // استخدام ImgBB مباشرة عند file:// protocol
                console.warn('Firebase Storage not available (file:// protocol), using ImgBB');
                try {
                    const url = await uploadToImgBB(file);
                    return url;
                } catch(e) {
                    console.error('ImgBB upload failed:', e);
                    showMiniAlert('❌ فشل رفع الصورة. يرجى فتح الملف من خادم (HTTP/HTTPS)', 'error');
                    return null;
                }
            }
            
            // استخدام Firebase Storage إذا كان متاحاً (HTTP/HTTPS)
            if (!firebase || !firebase.storage) {
                console.warn('Firebase Storage not available, using ImgBB fallback');
                // Fallback to ImgBB
                try {
                    const url = await uploadToImgBB(file);
                    return url;
                } catch(e) {
                    console.error('ImgBB upload failed:', e);
                    showMiniAlert('❌ فشل رفع الصورة', 'error');
                    return null;
                }
            }
            
            const storage = firebase.storage();
            if (!storage) {
                // Fallback to ImgBB
                try {
                    const url = await uploadToImgBB(file);
                    return url;
                } catch(e) {
                    console.error('ImgBB upload failed:', e);
                    showMiniAlert('❌ فشل رفع الصورة', 'error');
                    return null;
                }
            }
            
            try {
                // Resize الصورة إذا كانت كبيرة (اختياري - يمكن استخدام Canvas)
                const resizedFile = await resizeImageIfNeeded(file, 2000, 2000);
                
                // رفع إلى Storage
                const storageRef = storage.ref(`hotels/${HOTEL_CONFIG.hotelId || 'default'}/${path}`);
                const uploadTask = storageRef.put(resizedFile);
                
                return new Promise((resolve, reject) => {
                    let fallbackAttempted = false;
                    
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            // تحديث شريط التقدم
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            updateUploadProgress(path, progress);
                        },
                        async (error) => {
                            console.error('Firebase Storage upload error:', error);
                            // Fallback to ImgBB عند فشل Firebase Storage (مرة واحدة فقط)
                            if (!fallbackAttempted) {
                                fallbackAttempted = true;
                                try {
                                    console.log('Falling back to ImgBB due to Firebase Storage error...');
                                    const url = await uploadToImgBB(file);
                                    resolve(url);
                                } catch(imgbbError) {
                                    console.error('ImgBB upload failed:', imgbbError);
                                    reject(error);
                                }
                            } else {
                                reject(error);
                            }
                        },
                        async () => {
                            try {
                                // الحصول على رابط التحميل
                                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                                resolve(downloadURL);
                            } catch(error) {
                                console.error('Error getting download URL:', error);
                                // Fallback to ImgBB
                                if (!fallbackAttempted) {
                                    fallbackAttempted = true;
                                    try {
                                        const url = await uploadToImgBB(file);
                                        resolve(url);
                                    } catch(imgbbError) {
                                        reject(error);
                                    }
                                } else {
                                    reject(error);
                                }
                            }
                        }
                    );
                });
            } catch(e) {
                console.error('Error uploading image to Firebase Storage:', e);
                // Fallback to ImgBB
                try {
                    const url = await uploadToImgBB(file);
                    return url;
                } catch(imgbbError) {
                    console.error('ImgBB upload failed:', imgbbError);
                    showMiniAlert('❌ فشل رفع الصورة', 'error');
                    return null;
                }
            }
        }
        
        // Resize الصورة إذا كانت كبيرة
        async function resizeImageIfNeeded(file, maxWidth, maxHeight) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;
                        
                        if (width <= maxWidth && height <= maxHeight) {
                            resolve(file);
                            return;
                        }
                        
                        // حساب الأبعاد الجديدة
                        if (width > height) {
                            if (width > maxWidth) {
                                height = (height * maxWidth) / width;
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = (width * maxHeight) / height;
                                height = maxHeight;
                            }
                        }
                        
                        // رسم الصورة على Canvas
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        canvas.toBlob((blob) => {
                            resolve(new File([blob], file.name, { type: file.type }));
                        }, file.type, 0.9);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }
        
        function updateUploadProgress(type, progress) {
            const progressEl = document.getElementById(`gpm-${type}-progress-bar`);
            const progressContainer = document.getElementById(`gpm-${type}-upload-progress`);
            
            if (progressEl) {
                progressEl.style.width = progress + '%';
            }
            if (progressContainer) {
                progressContainer.style.display = 'block';
                if (progress >= 100) {
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        if (progressEl) progressEl.style.width = '0%';
                    }, 1000);
                }
            }
        }
        
        // معالجة رفع اللوجو
        window.handleLogoUpload = async function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            showMiniAlert('⏳ جاري رفع الصورة...', 'info');
            
            const url = await uploadImageToStorage(file, 'logo.png');
            
            if (url) {
                document.getElementById('gpm-logo').value = url;
                const preview = document.getElementById('gpm-logo-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${url}" alt="Logo Preview" style="max-width: 150px; max-height: 150px; border-radius: 12px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
                }
                showMiniAlert('✅ تم رفع اللوجو بنجاح', 'success');
            } else {
                showMiniAlert('❌ فشل رفع الصورة', 'error');
            }
        };
        
        // معالجة رفع صورة الخلفية
        window.handleBgImageUpload = async function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            showMiniAlert('⏳ جاري رفع الصورة...', 'info');
            
            const url = await uploadImageToStorage(file, 'background.jpg');
            
            if (url) {
                document.getElementById('gpm-bg-image').value = url;
                const preview = document.getElementById('gpm-bg-image-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${url}" alt="Background Preview" style="max-width: 100%; max-height: 150px; border-radius: 12px; border: 2px solid var(--border-color);">`;
                }
                showMiniAlert('✅ تم رفع صورة الخلفية بنجاح', 'success');
            } else {
                showMiniAlert('❌ فشل رفع الصورة', 'error');
            }
        };
        
        // ---------------------------
        // Google Maps: expand + parse + admin integration
        // ---------------------------
        
        async function expandUrlIfShort(url) {
            try {
                if (!url || typeof url !== 'string') return null;
                url = url.trim();
                const shortHosts = ['maps.app.goo.gl','goo.gl','g.page'];
                let host = null;
                try { host = (new URL(url)).host.replace('www.',''); } catch(e) { host = null; }
                if (!host || !shortHosts.includes(host)) return url; // not a known short host -> return original
                
                // try fetch to follow redirects; may fail due to CORS
                try {
                    const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
                    if (resp && resp.url) return resp.url;
                } catch(e) {
                    console.warn('expandUrlIfShort: fetch failed (possibly CORS)', e);
                    return null;
                }
                return null;
            } catch (e) {
                console.warn('expandUrlIfShort failed', e);
                return null;
            }
        }
        
        function parseGoogleMapsURL(url) {
            if (!url || typeof url !== 'string') return null;
            try {
                url = url.trim();
                
                let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                
                m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                
                m = url.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+),/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                
                m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                
                m = url.match(/\/@?(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                
                return null;
            } catch (e) {
                console.error('parseGoogleMapsURL error', e);
                return null;
            }
        }
        
        // bind parse button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                bindParseMapButton();
            });
        } else {
            bindParseMapButton();
        }
        
        function bindParseMapButton() {
            const btn = document.getElementById('gpm-parse-map-btn');
            if (!btn) return;
            btn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const input = document.getElementById('gpm-map-link');
                const msg = document.getElementById('gpm-map-msg');
                if (!input) return;
                msg.textContent = '⚙️ جارٍ الفحص...';
                const raw = input.value.trim();
                if (!raw) { msg.textContent = 'يرجى لصق الرابط أولاً.'; return; }
                
                let candidate = raw;
                const maybeExpanded = await expandUrlIfShort(raw);
                if (maybeExpanded) candidate = maybeExpanded;
                
                const coords = parseGoogleMapsURL(candidate);
                if (coords) {
                    msg.textContent = `✅ تم استخراج الإحداثيات: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
                    const latEl = document.getElementById('geo-lat');
                    const lngEl = document.getElementById('geo-lng');
                    if (latEl) latEl.value = coords.lat.toFixed(6);
                    if (lngEl) lngEl.value = coords.lng.toFixed(6);
                } else {
                    msg.textContent = '⚠️ لم أتمكن من استخراج الإحداثيات تلقائيًا. افتح الرابط في المتصفح وانسخ الرابط النهائي (الذي يحتوي @lat,lng) ثم الصقه هنا أو أدخل الإحداثيات يدوياً.';
                }
            });
        }
        
        async function saveGuestPortalSettings() {
            toggleSyncIndicator(true);
            showLoadingBar();
            
            try {
                // جمع الإعدادات
                const config = {
                    siteTitle: document.getElementById('gpm-title').value || 'بوابة النزيل',
                    guestHeaderTitle: document.getElementById('gpm-title').value || 'أهلاً بك',
                    guestHeaderSubtitle: document.getElementById('gpm-subtitle').value || 'خدمة الغرفة السريعة',
                    logoUrl: document.getElementById('gpm-logo').value || '',
                    theme: {
                        primaryColor: document.getElementById('gpm-primary-color').value || '#00ACC1',
                        accentColor: '#F0F4FF',
                        bgColor: document.getElementById('gpm-bg-color').value || '#E3E8FF',
                        bgImage: document.getElementById('gpm-bg-image').value || '',
                        textColor: '#1E293B',
                        themeType: document.getElementById('gpm-theme').value || 'light'
                    },
                    guestTabs: getTabsConfig(),
                    quickWhatsapp: document.getElementById('gpm-whatsapp-manager').value || '',
                    googleReviewUrl: document.getElementById('gpm-google-review').value || '',
                    kitchenWhatsapp: document.getElementById('gpm-whatsapp-kitchen').value || '',
                    receptionPhone: document.getElementById('gpm-reception-phone').value || '',
                    welcomeMessage: document.getElementById('gpm-welcome-message').value || '',
                    fnbItems: getFNBItems(),
                    qrSize: parseInt(document.getElementById('gpm-qr-size').value) || 160,
                    qrColumns: parseInt(document.getElementById('gpm-qr-columns').value) || 3,
                    qrLogoEnabled: document.getElementById('gpm-qr-logo-enabled').checked || false,
                    qrLogoUrl: document.getElementById('gpm-qr-logo-url').value || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // معالجة Geofence
                const rawMapLinkInput = (document.getElementById('gpm-map-link') && document.getElementById('gpm-map-link').value) ? document.getElementById('gpm-map-link').value.trim() : '';
                if (rawMapLinkInput) {
                    let finalLink = rawMapLinkInput;
                    try {
                        const maybeExpanded = await expandUrlIfShort(rawMapLinkInput);
                        if (maybeExpanded) finalLink = maybeExpanded;
                    } catch(e) { /* ignore expansion errors */ }
                    
                    const coords = parseGoogleMapsURL(finalLink);
                    if (coords) {
                        config.geofence = {
                            lat: coords.lat,
                            lng: coords.lng,
                            radiusMeters: Number(document.getElementById('gpm-map-radius') && document.getElementById('gpm-map-radius').value) || 150,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                    } else {
                        // if admin filled geo-lat / geo-lng manually, prefer those
                        const latManual = parseFloat(document.getElementById('geo-lat') && document.getElementById('geo-lat').value);
                        const lngManual = parseFloat(document.getElementById('geo-lng') && document.getElementById('geo-lng').value);
                        if (!isNaN(latManual) && !isNaN(lngManual)) {
                            config.geofence = {
                                lat: latManual,
                                lng: lngManual,
                                radiusMeters: Number(document.getElementById('gpm-map-radius') && document.getElementById('gpm-map-radius').value) || 150,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            };
                        } else {
                            config.mapLink = rawMapLinkInput;
                        }
                    }
                } else {
                    // if no map link: maybe admin filled manual coords
                    const latManual = parseFloat(document.getElementById('geo-lat') && document.getElementById('geo-lat').value);
                    const lngManual = parseFloat(document.getElementById('geo-lng') && document.getElementById('geo-lng').value);
                    if (!isNaN(latManual) && !isNaN(lngManual)) {
                        config.geofence = {
                            lat: latManual,
                            lng: lngManual,
                            radiusMeters: Number(document.getElementById('gpm-map-radius') && document.getElementById('gpm-map-radius').value) || 150,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                    }
                }
                
                // الحصول على الإصدار الحالي وزيادته
                if (db) {
                    const currentDoc = await db.collection('hotel_settings').doc(HOTEL_CONFIG.hotelId || 'default').get();
                    const currentVersion = currentDoc.exists ? (currentDoc.data().version || 1) : 1;
                    config.version = currentVersion + 1;
                } else {
                    config.version = Date.now();
                }
                
                // حفظ محلياً
                localStorage.setItem('HOTEL_GUEST_CONFIG', JSON.stringify(config));
                
                // حفظ في Firebase
                if (db) {
                    const hotelId = HOTEL_CONFIG.hotelId || 'default';
                    await db.collection('hotel_settings').doc(hotelId).set(config, { merge: true });
                    
                    // حفظ نسخة في التاريخ (اختياري)
                    await db.collection('hotel_settings').doc(hotelId).collection('history').add({
                        ...config,
                        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        savedBy: 'admin'
                    });
                    
                    showMiniAlert('✅ تم حفظ الإعدادات بنجاح', 'success');
                    playNotificationSound();
                } else {
                    showMiniAlert('✅ تم حفظ الإعدادات محلياً', 'success');
                }
            } catch(e) {
                console.error('Error saving settings:', e);
                showMiniAlert('❌ فشل حفظ الإعدادات', 'error');
            } finally {
                toggleSyncIndicator(false);
                hideLoadingBar();
            }
        }
        
        function getTabsConfig() {
            // جمع إعدادات التبويبات من الواجهة
            const tabs = [];
            document.querySelectorAll('.gpm-tab-item').forEach(item => {
                const urlInput = item.querySelector('.gpm-tab-url');
                tabs.push({
                    id: item.dataset.tabId,
                    title: item.querySelector('.gpm-tab-title').value,
                    icon: item.querySelector('.gpm-tab-icon').value,
                    type: item.querySelector('.gpm-tab-type').value,
                    visible: item.querySelector('.gpm-tab-visible').checked,
                    order: parseInt(item.dataset.order) || 0,
                    url: urlInput ? urlInput.value.trim() : ''
                });
            });
            return tabs;
        }
        
        window.toggleTabUrlField = function(selectElement) {
            const tabItem = selectElement.closest('.gpm-tab-item');
            if (!tabItem) return;
            
            const urlContainer = tabItem.querySelector('.gpm-tab-url-container');
            const urlInput = tabItem.querySelector('.gpm-tab-url');
            const selectedType = selectElement.value;
            
            if (urlContainer) {
                if (selectedType === 'link' || selectedType === 'whatsapp') {
                    urlContainer.style.display = 'block';
                    if (urlInput) {
                        urlInput.placeholder = selectedType === 'whatsapp' 
                            ? 'مثال: 966501234567 أو https://wa.me/966501234567' 
                            : 'مثال: https://example.com';
                        const label = urlContainer.querySelector('label');
                        if (label) {
                            label.textContent = selectedType === 'whatsapp' 
                                ? '🔗 رقم واتساب أو رابط' 
                                : '🔗 رابط التبويب';
                        }
                    }
                } else {
                    urlContainer.style.display = 'none';
                    if (urlInput) urlInput.value = '';
                }
            }
        };
        
        function getFNBItems() {
            // جمع عناصر F&B من الواجهة
            const items = [];
            document.querySelectorAll('.gpm-fnb-item').forEach(item => {
                items.push({
                    name: item.querySelector('.gpm-fnb-name').value,
                    icon: item.querySelector('.gpm-fnb-icon').value,
                    price: item.querySelector('.gpm-fnb-price').value
                });
            });
            return items;
        }
        
        function renderTabsList() {
            const container = document.getElementById('gpm-tabs-list');
            if (!container) return;
            
            const defaultTabs = [
                { id: 'cleaning', title: '🧹 تنظيف الغرفة', icon: '🧹', type: 'form', visible: true, order: 1 },
                { id: 'checkout', title: '🧳 طلب حامل حقائب للمغادرة', icon: '🧳', type: 'checkout', visible: true, order: 2 },
                { id: 'requests', title: '🧴 طلبات تجهيز (شامبو، صابون…)', icon: '🧴', type: 'form', visible: true, order: 3 },
                { id: 'maintenance', title: '🛠️ الدعم الفني والصيانة الطارئة', icon: '🛠️', type: 'form', visible: true, order: 4 },
                { id: 'fnb', title: '🍽️ ضيافة الطعام', icon: '🍽️', type: 'fnb', visible: true, order: 5 },
                { id: 'food', title: '🍕 طلبات المأكولات', icon: '🍕', type: 'whatsapp', visible: true, order: 6 },
                { id: 'offers', title: '🎁 عروض حصرية', icon: '🎁', type: 'link', visible: true, order: 7 },
                { id: 'review', title: '⭐ شارك تجربتك', icon: '⭐', type: 'link', visible: true, order: 8 },
                { id: 'contact', title: '💬 تواصل مباشر', icon: '💬', type: 'whatsapp', visible: true, order: 9 }
            ];
            
            try {
                const saved = localStorage.getItem('HOTEL_GUEST_CONFIG');
                if (saved) {
                    const config = JSON.parse(saved);
                    if (config.tabs && config.tabs.length > 0) {
                        defaultTabs.forEach((tab, index) => {
                            const savedTab = config.tabs.find(t => t.id === tab.id);
                            if (savedTab) {
                                Object.assign(tab, savedTab);
                            }
                        });
                    }
                }
            } catch(e) {
                console.error('Error loading tabs:', e);
            }
            
            container.innerHTML = defaultTabs.map((tab, index) => `
                <div class="gpm-tab-item" data-tab-id="${tab.id}" data-order="${tab.order || index + 1}" style="background: var(--bg-card); padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 2px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <input type="text" class="gpm-tab-icon" value="${tab.icon}" style="width: 50px; text-align: center; font-size: 1.5rem; padding: 8px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <input type="text" class="gpm-tab-title" value="${tab.title}" style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <select class="gpm-tab-type" onchange="toggleTabUrlField(this)" style="padding: 10px; border-radius: 8px; border: 2px solid var(--border-color);">
                            <option value="form" ${tab.type === 'form' ? 'selected' : ''}>نموذج</option>
                            <option value="checkout" ${tab.type === 'checkout' ? 'selected' : ''}>تسجيل خروج</option>
                            <option value="fnb" ${tab.type === 'fnb' ? 'selected' : ''}>أغذية ومشروبات</option>
                            <option value="link" ${tab.type === 'link' ? 'selected' : ''}>رابط</option>
                            <option value="whatsapp" ${tab.type === 'whatsapp' ? 'selected' : ''}>واتساب</option>
                        </select>
                        <label class="switch">
                            <input type="checkbox" class="gpm-tab-visible" ${tab.visible ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <button onclick="removeTab('${tab.id}')" class="glass-btn" style="background: var(--danger); color: white; padding: 8px 12px;">🗑️</button>
                    </div>
                    <div class="gpm-tab-url-container" style="display: ${(tab.type === 'link' || tab.type === 'whatsapp') ? 'block' : 'none'}; margin-top: 10px;">
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text-main);">🔗 ${tab.type === 'whatsapp' ? 'رقم واتساب أو رابط' : 'رابط التبويب'}</label>
                        <input type="text" class="gpm-tab-url" value="${tab.url || ''}" placeholder="${tab.type === 'whatsapp' ? 'مثال: 966501234567 أو https://wa.me/966501234567' : 'مثال: https://example.com'}" style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color); font-size: 0.9rem;">
                    </div>
                </div>
            `).join('');
            
            // تهيئة حقول URL للتبويبات الموجودة
            container.querySelectorAll('.gpm-tab-type').forEach(select => {
                toggleTabUrlField(select);
            });
        }
        
        function addNewTab() {
            const container = document.getElementById('gpm-tabs-list');
            if (!container) return;
            
            const newTab = {
                id: 'tab-' + Date.now(),
                title: 'تبويب جديد',
                icon: '📋',
                type: 'form',
                visible: true,
                order: container.children.length + 1
            };
            
            const div = document.createElement('div');
            div.className = 'gpm-tab-item';
            div.dataset.tabId = newTab.id;
            div.dataset.order = newTab.order;
            div.style.cssText = 'background: var(--bg-card); padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 2px solid var(--border-color);';
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <input type="text" class="gpm-tab-icon" value="${newTab.icon}" style="width: 50px; text-align: center; font-size: 1.5rem; padding: 8px; border-radius: 8px; border: 2px solid var(--border-color);">
                    <input type="text" class="gpm-tab-title" value="${newTab.title}" style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color);">
                    <select class="gpm-tab-type" onchange="toggleTabUrlField(this)" style="padding: 10px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <option value="form" selected>نموذج</option>
                        <option value="checkout">تسجيل خروج</option>
                        <option value="fnb">أغذية ومشروبات</option>
                        <option value="link">رابط</option>
                        <option value="whatsapp">واتساب</option>
                    </select>
                    <label class="switch">
                        <input type="checkbox" class="gpm-tab-visible" checked>
                        <span class="slider"></span>
                    </label>
                    <button onclick="removeTab('${newTab.id}')" class="glass-btn" style="background: var(--danger); color: white; padding: 8px 12px;">🗑️</button>
                </div>
                <div class="gpm-tab-url-container" style="display: none; margin-top: 10px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text-main);">🔗 رابط التبويب</label>
                    <input type="text" class="gpm-tab-url" value="" placeholder="مثال: https://example.com" style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color); font-size: 0.9rem;">
                </div>
            `;
            
            container.appendChild(div);
        }
        
        function removeTab(tabId) {
            const item = document.querySelector(`.gpm-tab-item[data-tab-id="${tabId}"]`);
            if (item) {
                item.remove();
            }
        }
        
        function saveQRTemplate() {
            const name = document.getElementById('gpm-qr-template-name').value;
            if (!name) {
                showMiniAlert('⚠️ أدخل اسم القالب', 'warning');
                return;
            }
            
            const template = {
                name: name,
                size: document.getElementById('gpm-qr-size').value,
                columns: document.getElementById('gpm-qr-columns').value,
                logoEnabled: document.getElementById('gpm-qr-logo-enabled').checked,
                logoUrl: document.getElementById('gpm-qr-logo-url').value,
                timestamp: Date.now()
            };
            
            let templates = JSON.parse(localStorage.getItem('QR_TEMPLATES') || '[]');
            templates.push(template);
            localStorage.setItem('QR_TEMPLATES', JSON.stringify(templates));
            
            document.getElementById('gpm-qr-template-name').value = '';
            showMiniAlert('✅ تم حفظ القالب', 'success');
            loadQRTemplates();
        }
        
        function loadQRTemplates() {
            const container = document.getElementById('gpm-templates-list');
            if (!container) return;
            
            const templates = JSON.parse(localStorage.getItem('QR_TEMPLATES') || '[]');
            
            if (templates.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا توجد قوالب محفوظة</p>';
                return;
            }
            
            container.innerHTML = templates.map((t, index) => `
                <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 700;">${t.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-sec);">${t.size}px - ${t.columns} أعمدة</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="applyQRTemplate(${index})" class="glass-btn" style="padding: 6px 12px; font-size: 0.85rem;">تطبيق</button>
                        <button onclick="deleteQRTemplate(${index})" class="glass-btn" style="background: var(--danger); color: white; padding: 6px 12px; font-size: 0.85rem;">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        function applyQRTemplate(index) {
            const templates = JSON.parse(localStorage.getItem('QR_TEMPLATES') || '[]');
            if (templates[index]) {
                const t = templates[index];
                document.getElementById('gpm-qr-size').value = t.size;
                document.getElementById('gpm-qr-columns').value = t.columns;
                document.getElementById('gpm-qr-logo-enabled').checked = t.logoEnabled || false;
                document.getElementById('gpm-qr-logo-url').value = t.logoUrl || '';
                document.getElementById('gpm-qr-logo-section').style.display = (t.logoEnabled) ? 'block' : 'none';
                showMiniAlert('✅ تم تطبيق القالب', 'success');
            }
        }
        
        function deleteQRTemplate(index) {
            let templates = JSON.parse(localStorage.getItem('QR_TEMPLATES') || '[]');
            templates.splice(index, 1);
            localStorage.setItem('QR_TEMPLATES', JSON.stringify(templates));
            loadQRTemplates();
            showMiniAlert('✅ تم حذف القالب', 'success');
        }
        
        function previewGuestPortal() {
            const room = prompt('أدخل رقم غرفة للمعاينة:', '101');
            if (room) {
                window.open(`guest.html?room=${room}&preview=true`, '_blank');
            }
        }
        
        // تصدير الدوال للاستخدام العام
        window.showGuestPortalManager = showGuestPortalManager;
        window.switchGuestPortalTab = switchGuestPortalTab;
        window.addNewTab = addNewTab;
        window.removeTab = removeTab;
        window.saveGuestPortalSettings = saveGuestPortalSettings;
        // ===============================================
        // == FNB & Service Management Fixes ============
        // ===============================================
        
        // 1. إصلاح دالة الإضافة (تعتمد على المودال الموجود)
        function addFNBItem() {
            if (typeof openAddServiceModal === "function") {
                openAddServiceModal();
            } else {
                console.error("openAddServiceModal is not defined");
                if (typeof showMiniAlert === 'function') {
                    showMiniAlert("⚠️ نافذة الإضافة غير متاحة", "warning");
                }
            }
        }
        
        // 2. إضافة دالة الحذف المفقودة (تحذف من Firebase + تعيد التحميل)
        function removeFNBItem(id) {
            if (!id) {
                console.warn('removeFNBItem called with empty id');
                return;
            }
            
            if (!confirm('⚠️ هل أنت متأكد من حذف هذا العنصر نهائياً؟')) return;
            
            const hotelId = (typeof HOTEL_CONFIG !== 'undefined' && HOTEL_CONFIG.hotelId) ? HOTEL_CONFIG.hotelId : 'default';
            
            // حذف من localStorage
            try {
                const items = JSON.parse(localStorage.getItem('menu_items') || '[]');
                const updated = items.filter(x => String(x.id) !== String(id));
                localStorage.setItem('menu_items', JSON.stringify(updated));
            } catch (err) {
                console.warn('localStorage deletion failed', err);
            }
            
            // حذف من Firebase
            if (typeof db !== 'undefined' && db && db.collection) {
                db.collection('hotel_settings')
                    .doc(hotelId)
                    .collection('menu_items')
                    .doc(String(id))
                    .delete()
                    .then(() => {
                        console.log("Deleted from Firebase:", id);
                        if (typeof showMiniAlert === 'function') {
                            showMiniAlert('🗑️ تم حذف العنصر', 'success');
                        }
                        // إعادة تحميل القائمة لتحديث الواجهة
                        if (typeof loadMenuItems === 'function') loadMenuItems();
                        if (typeof renderFNBItemsList === 'function') renderFNBItemsList();
                    })
                    .catch(err => {
                        console.error("Firebase deletion failed:", err);
                        if (typeof showMiniAlert === 'function') {
                            showMiniAlert('⚠️ تم الحذف محلياً فقط', 'warning');
                        }
                        if (typeof loadMenuItems === 'function') loadMenuItems();
                    });
            } else {
                if (typeof showMiniAlert === 'function') {
                    showMiniAlert('🗑️ تم حذف العنصر محلياً', 'success');
                }
                if (typeof loadMenuItems === 'function') loadMenuItems();
            }
        }
        
        // 3. تصدير الدوال الصحيحة
        window.addFNBItem = addFNBItem;
        window.removeFNBItem = removeFNBItem;
        window.saveQRTemplate = saveQRTemplate;
        window.applyQRTemplate = applyQRTemplate;
        window.deleteQRTemplate = deleteQRTemplate;
        window.previewGuestPortal = previewGuestPortal;
        window.openQRGeneratorModal = openQRGeneratorModal;
        window.generateAndPrintQRFromGPM = generateAndPrintQRFromGPM;
        window.closeModal = closeModal;
        window.generateAndPrintQR = generateAndPrintQR;
        window.sendGuestRequest = sendGuestRequest;
        // تم حذف undoLastAction
        window.executePhase = executePhase;
        window.promptAction = promptAction;
        window.openFinishModal = openFinishModal;
        
        // دالة تفعيل/إلغاء الإرسال التلقائي للواتساب
        function toggleAutoSendWhatsApp(type, enabled) {
            appState.autoSendWhatsApp = enabled;
            localStorage.setItem('adora_auto_whatsapp', enabled);
            
            const indicator = document.getElementById(`auto-wa-indicator-${type}`);
            if (indicator) {
                if (enabled) {
                    indicator.innerHTML = '🟢 تلقائي';
                    indicator.style.background = 'rgba(34, 197, 94, 0.2)';
                    indicator.style.color = '#16A34A';
                } else {
                    indicator.innerHTML = '🔴 يدوي';
                    indicator.style.background = 'rgba(220, 38, 38, 0.2)';
                    indicator.style.color = '#DC2626';
                }
            }
        }
        window.toggleAutoSendWhatsApp = toggleAutoSendWhatsApp;
        
        // دالة حذف كل البيانات
        function showClearAllDataModal() {
            pendingAction = 'clearAllData';
            document.getElementById('admin-password').value = '';
            document.getElementById('password-modal').style.display = 'flex';
        }
        window.showClearAllDataModal = showClearAllDataModal;
        
        async function clearAllDataAction() {
            pendingAction = 'confirmClearAll';
            
            // التأكد من إغلاق نافذة كلمة المرور أولاً
            const passwordModal = document.getElementById('password-modal');
            if (passwordModal) {
                passwordModal.style.display = 'none';
            }
            closeModal('password-modal');
            
            const confirmMessage = document.getElementById('confirm-message');
            const confirmYesBtn = document.getElementById('confirm-yes-btn');
            const confirmModal = document.getElementById('action-confirm-modal');
            
            if (!confirmMessage || !confirmYesBtn || !confirmModal) {
                console.error('Confirm modal elements not found');
                return;
            }
            
            confirmMessage.innerText = '⚠️ تحذير: سيتم حذف جميع البيانات (الغرف، الطلبات، الصيانة، السجلات). لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟';
            
            // إزالة أي معالجات سابقة وإضافة معالج جديد
            const newBtn = confirmYesBtn.cloneNode(true);
            confirmYesBtn.parentNode.replaceChild(newBtn, confirmYesBtn);
            
            newBtn.onclick = async function() {
                if (confirmModal) confirmModal.style.display = 'none';
                closeModal('action-confirm-modal');
                
                toggleSyncIndicator(true);
                try {
                    const batch = db.batch();
                    
                    // حذف جميع الغرف
                    const roomsSnapshot = await db.collection('rooms').get();
                    roomsSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    // حذف جميع الطلبات
                    const requestsSnapshot = await db.collection('guestRequests').get();
                    requestsSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    // حذف جميع الصيانة
                    const maintSnapshot = await db.collection('activeMaintenance').get();
                    maintSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    // حذف جميع السجلات
                    const logSnapshot = await db.collection('log').get();
                    logSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    const reqLogSnapshot = await db.collection('guestRequestsLog').get();
                    reqLogSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    const maintLogSnapshot = await db.collection('completedMaintenanceLog').get();
                    maintLogSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    await batch.commit();
                    
                    // إعادة تعيين الحالة المحلية
                    appState.rooms = [];
                    appState.guestRequests = [];
                    appState.activeMaintenance = [];
                    appState.log = [];
                    appState.guestRequestsLog = [];
                    appState.completedMaintenanceLog = [];
                    
                    smartUpdate(true);
                    showMiniAlert('✅ تم حذف جميع البيانات', 'success');
                } catch(e) {
                    console.error('Error clearing all data:', e);
                    showMiniAlert('❌ فشل حذف البيانات', 'error');
                } finally {
                    toggleSyncIndicator(false);
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
