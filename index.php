<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PS Manager</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">

  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/layout.css">
  <link rel="stylesheet" href="assets/css/cards.css">
  <link rel="stylesheet" href="assets/css/modals.css">
  <link rel="stylesheet" href="assets/css/responsive.css">
</head>
<body>
  <div class="blob2" aria-hidden="true"></div>

  <section id="login-page" class="login-page">
    <div class="login-card">
      <div class="login-logo"><i class="fas fa-gamepad"></i></div>
      <h1>PS Manager</h1>
      <p>تسجيل دخول مالك المحل</p>

      <div id="login-error" class="login-error"></div>

      <form id="login-form" autocomplete="off">
        <div class="form-group">
          <label for="login-username">اسم المستخدم</label>
          <input id="login-username" type="text" maxlength="30" required>
        </div>

        <div class="form-group">
          <label for="login-password">كلمة المرور</label>
          <input id="login-password" type="password" required>
        </div>

        <button type="submit" class="btn btn-primary">
          <i class="fas fa-right-to-bracket"></i>
          دخول
        </button>
      </form>
    </div>
  </section>

  <div id="app-shell" class="wrapper hidden">
    <header>
      <div class="logo">
        <div class="logo-icon"><i class="fas fa-gamepad"></i></div>
        <div class="logo-text">
          <h1>PS Shop Manager</h1>
          <p>إدارة جلسات وأجهزة البلايستيشن</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="header-stats">
          <div class="stat-pill"><span class="dot green"></span> متاح: <span id="available-count">0</span></div>
          <div class="stat-pill"><span class="dot red"></span> شغال: <span id="running-count">0</span></div>
          <div class="stat-pill">الإجمالي: <span id="total-count">0 أجهزة</span></div>
        </div>

        <button id="logout-btn" class="btn btn-logout" type="button">
          <i class="fas fa-right-from-bracket"></i>
          تسجيل خروج
        </button>
      </div>
    </header>

    <div class="main-grid">
      <aside class="panel">
        <h2 class="panel-title"><i class="fas fa-plus"></i> إضافة جهاز</h2>

        <form id="add-device-form" autocomplete="off">
          <div class="form-group">
            <label for="device-name">اسم الجهاز</label>
            <input id="device-name" type="text" maxlength="50" required placeholder="مثال: PS5-1">
          </div>

          <div class="form-group">
            <label for="device-type">نوع الجهاز</label>
            <input id="device-type" type="text" maxlength="50" placeholder="PlayStation 5">
          </div>

          <div class="form-group">
            <label for="device-price">السعر بالساعة</label>
            <input id="device-price" type="number" min="1" step="0.01" required placeholder="50">
          </div>

          <button type="submit" class="btn btn-primary">
            <i class="fas fa-floppy-disk"></i>
            إضافة الجهاز
          </button>
        </form>
      </aside>

      <section>
        <div class="section-header">
          <h2 class="section-title">الأجهزة</h2>
          <div class="device-count">إدارة مباشرة</div>
        </div>

        <div class="filter-buttons">
          <button class="filter-btn active" data-filter="all" type="button">الكل</button>
          <button class="filter-btn" data-filter="running" type="button">شغال</button>
          <button class="filter-btn" data-filter="available" type="button">متاح</button>
        </div>

        <div id="devices-grid" aria-live="polite"></div>
      </section>
    </div>
  </div>

  <div id="toast-container" aria-live="assertive" aria-atomic="true"></div>

  <div id="result-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon"><i class="fas fa-receipt"></i></div>
      <h2 id="modal-device-name">ملخص الجلسة</h2>
      <p class="subtitle">تفاصيل إنهاء الجلسة</p>

      <div class="result-rows">
        <div class="result-row"><span class="row-label">البداية</span><span id="modal-start" class="row-value">-</span></div>
        <div class="result-row"><span class="row-label">النهاية</span><span id="modal-end" class="row-value">-</span></div>
        <div class="result-row"><span class="row-label">المدة</span><span id="modal-duration" class="row-value">-</span></div>
        <div id="modal-extra-row" class="result-row"><span class="row-label">وقت إضافي</span><span id="modal-extra" class="row-value">-</span></div>
        <div id="modal-multi-row" class="result-row"><span class="row-label">متعدد اللاعبين</span><span id="modal-multi-info" class="row-value">-</span></div>
        <div class="result-row highlight"><span class="row-label">الإجمالي</span><span id="modal-cost" class="row-value">0.00</span></div>
      </div>

      <div id="modal-segments-section"></div>

      <button id="modal-close-btn" class="btn modal-close" type="button">إغلاق</button>
    </div>
  </div>

  <div id="start-options-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon start-options-icon"><i class="fas fa-play"></i></div>
      <h2 id="so-title">تشغيل الجهاز</h2>
      <p id="so-device-name" class="subtitle"></p>

      <div class="extend-btns">
        <button id="so-open-start-btn" type="button" class="btn btn-start"><i class="fas fa-bolt"></i> جلسة مفتوحة</button>
        <button id="so-fixed-60-btn" type="button" class="btn btn-extend">60 دقيقة</button>
        <button id="so-fixed-90-btn" type="button" class="btn btn-extend">90 دقيقة</button>
      </div>

      <div class="custom-extend-row">
        <input id="so-custom-minutes" type="number" min="1" max="480" placeholder="مدة مخصصة بالدقائق">
        <button id="so-start-custom-btn" type="button" class="btn btn-extend">تشغيل</button>
      </div>

      <button id="so-cancel-btn" class="btn cancel-btn" type="button">إلغاء</button>
    </div>
  </div>

  <div id="stop-extend-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon"><i class="fas fa-stopwatch"></i></div>
      <h2 id="se-device-name">إيقاف أو تمديد</h2>
      <p class="subtitle">يمكنك تمديد الوقت أو إنهاء الجلسة الآن</p>

      <div class="live-preview">
        <span class="lp-label">مباشر</span>
        <div class="lp-values">
          <div class="lp-item"><span id="se-live-time" class="lp-num">00:00</span><span class="lp-sub">الوقت</span></div>
          <div class="lp-item"><span id="se-live-cost" class="lp-num">0.00 ج</span><span class="lp-sub">التكلفة</span></div>
        </div>
      </div>

      <div class="modal-section-label"><i class="fas fa-plus-circle"></i> تمديد</div>
      <div class="extend-btns">
        <button class="btn btn-extend" data-extend-minutes="15" type="button">+15 دقيقة</button>
        <button class="btn btn-extend" data-extend-minutes="30" type="button">+30 دقيقة</button>
        <button class="btn btn-extend" data-extend-minutes="60" type="button">+60 دقيقة</button>
      </div>

      <div class="custom-extend-row">
        <input id="custom-extend-input" type="number" min="1" max="480" placeholder="مدة مخصصة بالدقائق">
        <button id="se-custom-extend-btn" class="btn btn-extend" type="button">إضافة</button>
      </div>

      <div class="divider"></div>

      <div class="se-end-summary">
        <div class="se-end-row"><span>إجمالي المدة</span><span id="se-end-duration">-</span></div>
        <div class="se-end-row"><span>تكلفة عادي</span><span id="se-end-normal-price">-</span></div>
      </div>

      <div class="multi-toggle-row">
        <span class="multi-label-text">وضع متعدد اللاعبين</span>
        <button id="se-multi-toggle" class="toggle-switch" type="button" aria-label="تفعيل وضع متعدد اللاعبين"></button>
      </div>

      <div id="se-multi-inputs" style="display:none;">
        <div class="form-group">
          <label for="se-multi-minutes">عدد دقائق الملتي</label>
          <input id="se-multi-minutes" type="number" min="0" step="1" placeholder="0">
          <span id="se-multi-minutes-hint" class="field-hint"></span>
        </div>
        <div class="form-group">
          <label for="se-multi-price-ph">سعر ساعة الملتي</label>
          <input id="se-multi-price-ph" type="number" min="0" step="0.01" placeholder="0">
        </div>
      </div>

      <div class="price-breakdown">
        <div class="breakdown-title"><i class="fas fa-calculator"></i> تفصيل التكلفة</div>
        <div class="breakdown-row"><span>عادي</span><span id="bd-normal-time" class="bd-minutes">-</span><span id="bd-normal-price" class="bd-price">0.00 ج</span></div>
        <div class="breakdown-row"><span>ملتي</span><span id="bd-multi-time" class="bd-minutes">-</span><span id="bd-multi-price" class="bd-price">0.00 ج</span></div>
        <div class="breakdown-total"><span>الإجمالي</span><span id="bd-total-price">0.00 جنيه</span></div>
      </div>

      <button id="se-confirm-end-btn" class="btn confirm-end-btn" type="button">إنهاء الجلسة</button>
      <button id="se-close-btn" class="btn cancel-btn" type="button">إغلاق</button>
    </div>
  </div>

  <div id="session-ended-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon session-ended-modal-icon"><i class="fas fa-hourglass-end"></i></div>
      <h2 id="sen-device-name">انتهى الوقت المحدد</h2>
      <p class="subtitle">اختر تمديدًا سريعًا أو إنهاء الجلسة</p>

      <div class="result-rows">
        <div class="result-row"><span class="row-label">المدة الحالية</span><span id="sen-duration" class="row-value">-</span></div>
        <div class="result-row highlight"><span class="row-label">التكلفة الحالية</span><span id="sen-cost" class="row-value">-</span></div>
      </div>

      <div class="extend-btns">
        <button id="sen-extend-15" class="btn btn-extend" type="button">+15 دقيقة</button>
        <button id="sen-extend-30" class="btn btn-extend" type="button">+30 دقيقة</button>
      </div>

      <div class="custom-extend-row">
        <input id="sen-custom-minutes" type="number" min="1" max="480" placeholder="مدة مخصصة">
        <button id="sen-custom-extend-btn" class="btn btn-extend" type="button">إضافة</button>
      </div>

      <button id="sen-stop-now-btn" class="btn confirm-end-btn" type="button">إنهاء الآن</button>
      <button id="sen-close-btn" class="btn cancel-btn" type="button">إغلاق</button>
    </div>
  </div>

  <div id="transfer-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon"><i class="fas fa-exchange-alt"></i></div>
      <h2>نقل الجلسة</h2>
      <p id="tr-subtitle" class="subtitle"></p>

      <div id="tr-no-devices" class="tr-no-devices-msg" style="display:none;">لا توجد أجهزة متاحة للنقل حالياً.</div>
      <div id="tr-device-list" class="transfer-device-list"></div>

      <button id="tr-confirm-btn" class="btn tr-confirm-btn" type="button" disabled>تأكيد النقل</button>
      <button id="tr-cancel-btn" class="btn cancel-btn" type="button">إلغاء</button>
    </div>
  </div>

  <div id="edit-modal" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-icon edit-modal-icon"><i class="fas fa-pen"></i></div>
      <h2>تعديل الجهاز</h2>
      <p class="subtitle">تحديث بيانات الجهاز</p>

      <div class="form-group">
        <label for="edit-device-name">اسم الجهاز</label>
        <input id="edit-device-name" type="text" maxlength="50">
        <span id="edit-name-error" class="field-error"></span>
      </div>

      <div class="form-group">
        <label for="edit-device-type">نوع الجهاز</label>
        <input id="edit-device-type" type="text" maxlength="50">
      </div>

      <div class="form-group">
        <label for="edit-device-price">السعر بالساعة</label>
        <input id="edit-device-price" type="number" min="1" step="0.01">
        <span id="edit-price-error" class="field-error"></span>
      </div>

      <button id="edit-save-btn" class="btn edit-save-btn" type="button">حفظ التعديلات</button>
      <button id="edit-cancel-btn" class="btn cancel-btn" type="button">إلغاء</button>
    </div>
  </div>

  <script type="module" src="assets/js/app.js"></script>
</body>
</html>
