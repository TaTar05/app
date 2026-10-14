/* =====================================================================
   ตื่นจริง – แอปปลุกที่ต้องทำภารกิจก่อน เสียงถึงจะหยุด
   ไฟล์นี้คือ "สมอง" ของแอป แบ่งเป็นส่วนๆ ตามนี้
     1. ตัวช่วยและข้อมูลเริ่มต้น
     2. เสียงและการเปิดหน้าจอค้าง
     3. ตอนปลุกดัง (ring)
     4. ภารกิจ 3 แบบ (mission)
     5. ตอนทำภารกิจสำเร็จ (done)
     6. วาดตัวเลข/ปุ่มบนหน้าจอ (render)
     7. นาฬิกาที่เดินทุกวินาที (tick)
     8. ปุ่มต่างๆ ในหน้าหลัก
     9. แข่งกับเพื่อน (ใช้ฐานข้อมูลของ Claude)
    10. เริ่มทำงาน
   ===================================================================== */
(() => {

  /* ---------- 1. ตัวช่วยและข้อมูลเริ่มต้น ---------- */

  // $('#id') = ทางลัดหา element ในหน้าเว็บ | p2(5) = '05' (เติมเลข 0 ให้ครบ 2 หลัก)
  const $ = s => document.querySelector(s),
        p2 = n => String(n).padStart(2, '0');

  // ชื่อภารกิจ (แสดงในข้อความสถานะ)
  const MN = { math: 'คำนวณ', type: 'พิมพ์ประโยค', tap: 'แตะ 1–9' };

  // ประโยคที่ให้พิมพ์ในภารกิจ "พิมพ์ประโยค" (สุ่มมา 1 ประโยค)
  const PH = ['ตื่นแล้ว ลุกจากเตียงเลย', 'วันนี้ฉันจะทำให้ดีที่สุด', 'ล้างหน้าแล้วดื่มน้ำหนึ่งแก้ว'];

  // S = ข้อมูลของแอปทั้งหมด (เก็บในเครื่อง)
  //   time = เวลาปลุก, mission = ภารกิจที่เลือก, on = เปิดปลุกอยู่ไหม
  //   hist = ประวัติการตื่น, streak = วันติดต่อกัน, last = วันที่ตื่นล่าสุด
  //   goal/goalDay = เป้าหมายของวันและวันที่ตั้ง
  let S = { time: '06:30', mission: 'math', on: false, hist: [], streak: 0, last: '', goal: '', goalDay: '' };

  // โหลดข้อมูลที่เคยบันทึกไว้ (ถ้ามี)
  try { Object.assign(S, JSON.parse(localStorage.getItem('tuenjing') || '{}')) } catch (e) {}

  // บันทึกข้อมูลลงเครื่อง
  const save = () => { try { localStorage.setItem('tuenjing', JSON.stringify(S)) } catch (e) {} };

  // แปลงวันที่เป็นข้อความ เช่น '2026-10-13' (ใช้เทียบว่าเป็นวันเดียวกันไหม)
  const key = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

  // ตัวแปรสถานะตอนปลุก
  //   ac = ระบบเสียง, ringing = กำลังดังอยู่ไหม, test = เป็นโหมดทดลองไหม
  //   t0 = เวลาที่เริ่มดัง, beepT = ตัวตั้งเวลาเสียง, fired = วันที่ปลุกไปแล้ว (กันดังซ้ำ)
  let ac, ringing = false, test = false, t0 = 0, beepT, fired = '';


  /* ---------- 2. เสียงและการเปิดหน้าจอค้าง ---------- */

  // เตรียมระบบเสียง (ต้องเรียกหลังผู้ใช้กดปุ่มก่อน เบราว์เซอร์ถึงยอมให้มีเสียง)
  function initAudio() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      ac.resume()
    } catch (e) {}
  }

  // ส่งเสียง "ปี๊บ" ครั้งเดียว (ความถี่ 880 Hz ยาว 0.25 วินาที)
  function beep() {
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.value = .12;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + .25)
    } catch (e) {}
  }

  // ขอให้หน้าจอไม่ดับระหว่างรอปลุก
  function wl() {
    try {
      navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {})
    } catch (e) {}
  }


  /* ---------- 3. ตอนปลุกดัง ---------- */

  // เริ่มปลุก: แสดงหน้าจอปลุก + ส่งเสียงทุก 0.6 วินาที + สั่น + เริ่มภารกิจ
  // isTest = true คือโหมดทดลอง (ไม่นับสถิติ)
  function ring(isTest) {
    if (ringing) return;
    ringing = true;
    test = isTest;
    t0 = Date.now();
    $('#ring').hidden = false;
    $('#cancelTest').hidden = !isTest;
    initAudio();
    beepT = setInterval(() => {
      beep();
      try { navigator.vibrate && navigator.vibrate(300) } catch (e) {}
    }, 600);
    mission(S.mission);
  }


  /* ---------- 4. ภารกิจ 3 แบบ ---------- */

  // สร้างภารกิจตามที่เลือก (m = 'math' | 'type' | 'tap') ทำครบแล้วเรียก done()
  function mission(m) {
    const box = $('#mission');   // กล่องที่ใส่ภารกิจ

    // ----- แบบที่ 1: คำนวณเลข 3 ข้อ -----
    if (m === 'math') {
      let n = 0;                 // n = ตอบถูกไปกี่ข้อแล้ว

      // nx = สร้างโจทย์ข้อถัดไป (รูปแบบ a × b + c)
      const nx = () => {
        const a = 7 + Math.random() * 13 | 0,
              b = 3 + Math.random() * 7 | 0,
              c = Math.random() * 30 | 0,
              ans = a * b + c;
        box.innerHTML = `<div class="q">ข้อ ${n+1} จาก 3</div><div class="big">${a} × ${b} + ${c} = ?</div><input id="ans" inputmode="numeric" autocomplete="off"><button class="btn" id="ok">ยืนยัน</button><div class="err" id="err"></div>`;

        // chk = ตรวจคำตอบ: ถูก → ข้อต่อไป (ครบ 3 ข้อ → เสร็จ) | ผิด → แจ้งเตือนแล้วล้างช่อง
        const chk = () => {
          if (+$('#ans').value === ans && $('#ans').value !== '') {
            n++;
            n >= 3 ? done() : nx()
          } else {
            $('#err').textContent = 'ยังไม่ถูก ลองใหม่!';
            $('#ans').value = ''
          }
        };
        $('#ok').onclick = chk;                                   // กดปุ่มยืนยัน
        $('#ans').onkeydown = e => { if (e.key === 'Enter') chk() };  // หรือกด Enter
        $('#ans').focus();
      };
      nx();

    // ----- แบบที่ 2: พิมพ์ประโยคให้ตรงเป๊ะ -----
    } else if (m === 'type') {
      const s = PH[Math.random() * PH.length | 0];   // สุ่มประโยค
      box.innerHTML = `<div class="q">พิมพ์ประโยคนี้ให้ตรงเป๊ะ</div><div class="big sm">${s}</div><input id="ans" autocomplete="off"><button class="btn" id="ok">ยืนยัน</button><div class="err" id="err"></div>`;

      // ตรวจว่าพิมพ์ตรงไหม (ตัดช่องว่างหน้า-หลังให้)
      const chk = () => {
        if ($('#ans').value.trim().replace(/\s+/g, ' ') === s) done();
        else $('#err').textContent = 'ยังไม่ตรง ลองอีกครั้ง!'
      };
      $('#ok').onclick = chk;
      $('#ans').onkeydown = e => { if (e.key === 'Enter') chk() };
      $('#ans').focus();

    // ----- แบบที่ 3: แตะเลข 1–9 ตามลำดับ -----
    } else {
      let nxt = 1;                                    // nxt = เลขที่ต้องแตะต่อไป
      const o = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - .5);   // สลับตำแหน่งเลข
      box.innerHTML = `<div class="q">แตะเลข 1 ถึง 9 ตามลำดับ</div><div class="grid">${o.map(n=>`<button data-n="${n}">${n}</button>`).join('')}</div><div class="err" id="err"></div>`;
      const bs = box.querySelectorAll('.grid button');

      bs.forEach(b => b.onclick = () => {
        if (+b.dataset.n === nxt) {
          // แตะถูก → ปุ่มเป็นสีเขียว กดซ้ำไม่ได้ → ครบ 9 เสร็จภารกิจ
          b.classList.add('on');
          b.disabled = true;
          nxt++;
          if (nxt > 9) done()
        } else {
          // แตะผิด → เริ่มนับ 1 ใหม่
          nxt = 1;
          bs.forEach(x => { x.classList.remove('on'); x.disabled = false });
          $('#err').textContent = 'ผิดลำดับ เริ่มใหม่!'
        }
      });
    }
  }


  /* ---------- 5. ตอนทำภารกิจสำเร็จ ---------- */

  // หยุดเสียง → คำนวณเวลาที่ใช้ → อัปเดตสถิติ → แสดงหน้าจอตอนเช้า
  function done() {
    clearInterval(beepT);       // หยุดเสียงปลุก
    ringing = false;
    $('#ring').hidden = true;   // ปิดหน้าจอปลุก

    const secs = Math.round((Date.now() - t0) / 1000),   // secs = ใช้เวลาทำภารกิจกี่วินาที
          now = new Date(),
          td = key(now);                                   // td = วันนี้

    // โหมดทดลองไม่นับสถิติ
    if (!test) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);   // y = เมื่อวาน

      // ตื่นครั้งแรกของวัน: ถ้าเมื่อวานตื่นด้วย → วันติดต่อกัน +1 ไม่งั้นเริ่มนับใหม่ที่ 1
      if (S.last !== td) {
        S.streak = S.last === key(y) ? S.streak + 1 : 1;
        S.last = td;
        push(secs, td);             // ส่งคะแนนขึ้นกระดานแข่งกับเพื่อน
      }
      S.hist.push({ d: td, s: secs });   // เก็บประวัติ (เก็บแค่ 30 ครั้งล่าสุด)
      S.hist = S.hist.slice(-30);
      save();
    }

    // แสดงหน้าจอตอนเช้า
    $('#mtext').textContent = `ตื่นสำเร็จใน ${secs} วินาที` + (test ? ' (โหมดทดลอง ไม่นับสถิติ)' : ' · 🔥 ' + S.streak + ' วันติดต่อกัน');
    $('#goal').value = '';
    $('#morning').hidden = false;
    render();
  }


  /* ---------- 6. วาดตัวเลข/ปุ่มบนหน้าจอ ---------- */

  // อัปเดตทุกอย่างบนหน้าหลักให้ตรงกับข้อมูล S ล่าสุด
  function render() {
    $('#time').value = S.time;   // ช่องเวลาปลุก

    // ปุ่มภารกิจที่เลือก ให้ขอบเป็นสีส้ม
    document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.mission));

    // วันติดต่อกัน: ถ้าขาดไปเกิน 1 วัน ให้แสดง 0
    const now = new Date(), y = new Date(now);
    y.setDate(y.getDate() - 1);
    const st = (S.last === key(now) || S.last === key(y)) ? S.streak : 0;
    $('#streak').textContent = '🔥 ' + st + ' วัน';
    $('#sStreak').textContent = st;

    // เวลาเฉลี่ยที่ใช้ตื่น
    const h = S.hist;
    $('#sAvg').textContent = h.length ? Math.round(h.reduce((a, x) => a + x.s, 0) / h.length) : '–';

    // กราฟแท่ง 7 ครั้งล่าสุด (แท่งที่สูงสุดเต็มกรอบ)
    const last7 = h.slice(-7), mx = Math.max(30, ...last7.map(x => x.s));
    $('#bars').innerHTML = last7.map(x => `<div style="height:${Math.max(6,x.s/mx*100)}%"><span>${x.s}</span></div>`).join('');
    $('#empty').hidden = h.length > 0;   // ซ่อนข้อความ "ยังไม่มีข้อมูล" เมื่อมีสถิติแล้ว

    // ปุ่มตั้งปลุก/ยกเลิกปลุก
    const b = $('#set');
    b.textContent = S.on ? 'ยกเลิกปลุก' : 'ตั้งปลุก';
    b.classList.toggle('off', S.on);

    // เป้าหมายของวันนี้ (แสดงเฉพาะที่ตั้งไว้ในวันนี้)
    $('#goalLine').textContent = S.goal && S.goalDay === key(now) ? '🎯 เป้าหมายวันนี้: ' + S.goal : '';
  }


  /* ---------- 7. นาฬิกาที่เดินทุกวินาที ---------- */

  // ทำงานทุก 1 วินาที: ขยับนาฬิกา + เช็คว่าถึงเวลาปลุกหรือยัง + นับถอยหลัง
  function tick() {
    const n = new Date(), hm = p2(n.getHours()) + ':' + p2(n.getMinutes());   // hm = 'ชม:นาที'
    $('#clock').innerHTML = hm + '<small>' + p2(n.getSeconds()) + '</small>';
    $('#date').textContent = n.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#rclock').textContent = hm;   // เวลาบนหน้าจอปลุก

    if (S.on) {
      // ถึงเวลาที่ตั้งไว้ และวันนี้ยังไม่ได้ปลุก → ปลุกเลย
      const k = key(n) + S.time;
      if (!ringing && hm === S.time && fired !== k) { fired = k; ring(false) }

      // คำนวณว่าอีกกี่ชั่วโมง/นาทีจะถึงเวลาปลุก
      const [H, M] = S.time.split(':').map(Number), t = new Date(n);
      t.setHours(H, M, 0, 0);
      if (t <= n) t.setDate(t.getDate() + 1);   // ถ้าเวลาวันนี้ผ่านไปแล้ว ให้นับของพรุ่งนี้
      const d = Math.round((t - n) / 60000);
      $('#status').textContent = `ปลุกทุกวัน ${S.time} · ภารกิจ: ${MN[S.mission]} · อีก ${Math.floor(d/60)} ชม. ${d%60} นาที`;
    } else if (!/วินาที/.test($('#status').textContent)) {
      $('#status').textContent = 'ยังไม่ได้ตั้งปลุก'
    }
  }


  /* ---------- 8. ปุ่มต่างๆ ในหน้าหลัก ---------- */

  // เปลี่ยนเวลาปลุก
  $('#time').onchange = e => { if (e.target.value) { S.time = e.target.value; save() } };

  // เลือกภารกิจ
  $('#seg').onclick = e => {
    const b = e.target.closest('button');
    if (b) { S.mission = b.dataset.m; save(); render() }
  };

  // ปุ่ม "ตั้งปลุก" / "ยกเลิกปลุก"
  $('#set').onclick = () => {
    S.on = !S.on;
    if (S.on) { initAudio(); wl() } else $('#status').textContent = '';
    save();
    render();
    tick()
  };

  // ปุ่ม "ทดลองปลุกใน 5 วินาที"
  $('#test').onclick = () => {
    initAudio();
    $('#status').textContent = 'จะปลุกใน 5 วินาที…';
    setTimeout(() => { ring(true); tick() }, 5000)
  };

  // ปุ่ม "ยกเลิกการทดลอง" บนหน้าจอปลุก
  $('#cancelTest').onclick = () => { clearInterval(beepT); ringing = false; $('#ring').hidden = true };

  // ปุ่ม "เริ่มวันนี้" บนหน้าจอตอนเช้า (บันทึกเป้าหมายของวัน)
  $('#go').onclick = () => {
    const g = $('#goal').value.trim();
    if (g) { S.goal = g; S.goalDay = key(new Date()); save() }
    $('#morning').hidden = true;
    render()
  };


  /* ---------- 9. แข่งกับเพื่อน ---------- */
  // ใช้ฐานข้อมูลของ Claude (claude.use('db')) ที่ทุกคนที่เปิดหน้านี้เห็นข้อมูลร่วมกัน
  // ถ้าเปิดไฟล์นี้นอก Claude ส่วนนี้จะไม่ทำงาน (การ์ดแข่งกับเพื่อนจะถูกซ่อนไว้)

  // db = ฐานข้อมูล, uid = รหัสของเรา, canW = เรามีสิทธิ์เขียนไหม, rows = ข้อมูลทุกคนบนกระดาน
  let db = null, uid = null, canW = false, rows = [];

  // wk(วันที่) = วันจันทร์ของสัปดาห์นั้น (ใช้แยกคะแนนรายสัปดาห์)
  const wk = d => {
    const x = new Date(d);
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    return key(x)
  };

  // esc = กันชื่อเล่นที่มีตัวอักษรพิเศษ (<, >, &) ไม่ให้ทำหน้าเว็บพัง
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // คะแนนต่อการตื่น 1 ครั้ง = (100 − วินาทีที่ใช้, ขั้นต่ำ 20) + โบนัสวันติดต่อกัน (วันละ 5 สูงสุด 7 วัน)
  const pts = (secs, streak) => Math.max(20, 100 - secs) + Math.min(streak, 7) * 5;

  // วาดอันดับ: เรียงคะแนนสัปดาห์นี้จากมากไปน้อย (คะแนนเท่ากันดูวันติดต่อกัน)
  function drawBoard() {
    const W = wk(new Date()), td = key(new Date()), me = rows.find(r => r.id === uid);
    $('#join').hidden = !!me || !canW;   // ถ้าเข้าร่วมแล้ว หรือไม่มีสิทธิ์ ให้ซ่อนช่องกรอกชื่อ
    const L = rows.map(r => ({ ...r, p: r.wk === W ? (r.pts || 0) : 0 })).sort((a, b) => b.p - a.p || (b.streak || 0) - (a.streak || 0));
    $('#board').hidden = !L.length;
    $('#rank').innerHTML = L.map((r,i)=>`<li class="${r.id===uid?'me':''}"><b>${['🥇','🥈','🥉'][i]||i+1}</b><span class="nm">${esc(r.name||'เพื่อน')}${r.id===uid?' (คุณ)':''}</span><span class="st">${r.today&&r.today.d===td?'✅ ตื่น '+esc(r.today.t):'⏳ ยังไม่ตื่น'}</span><em>${r.p}</em></li>`).join('');
  }

  // ส่งคะแนนของเราขึ้นกระดาน (เรียกจาก done() ตอนตื่นครั้งแรกของวัน)
  async function push(secs, td) {
    const me = rows.find(r => r.id === uid); if (!db || !uid || !me) return;
    const W = wk(new Date()), n = new Date(), base = me.wk === W ? (me.pts || 0) : 0;   // base = คะแนนสะสมสัปดาห์นี้
    try {
      await db.doc('board/' + uid).update({ wk: W, pts: base + pts(secs, S.streak), streak: S.streak, today: { d: td, t: p2(n.getHours()) + ':' + p2(n.getMinutes()), s: secs } })
    } catch (e) {}
  }

  // เชื่อมฐานข้อมูล แล้วคอยฟังการเปลี่ยนแปลงของกระดาน (มีคนตื่น/สมัครใหม่ → อันดับอัปเดตทันที)
  async function initSocial() {
    try {
      if (!(window.claude && claude.use)) return;
      db = await claude.use('db'); const user = await claude.use('user');
      if (!db || !user) return;
      uid = await user.id();
      canW = !!uid && (await user.can('data.write')) !== false;
      $('#friends').hidden = false;   // เจอฐานข้อมูลแล้ว → แสดงการ์ดแข่งกับเพื่อน
      if (!canW) $('#fmsg').textContent = 'คุณดูอันดับได้อย่างเดียว ให้เจ้าของแอปเชิญเป็นผู้ร่วมแก้ไขเพื่อเข้าร่วมแข่ง';
      db.collection('board').onSnapshot(s => { rows = s.docs.map(d => ({ id: d.id, ...d.data() })); drawBoard() }, () => {});
    } catch (e) {}
  }

  // ปุ่ม "เข้าร่วมกระดานแข่ง": สร้างข้อมูลของเราบนกระดานด้วยชื่อเล่น
  $('#joinBtn').onclick = async () => {
    const n = $('#nick').value.trim(); if (!n || !uid) return;
    try { await db.doc('board/' + uid).set({ name: n.slice(0, 16), wk: wk(new Date()), pts: 0, streak: 0, today: null }) }
    catch (e) { $('#fmsg').textContent = 'เข้าร่วมไม่สำเร็จ ลองใหม่อีกครั้ง' }
  };

  // ปุ่ม "ชวนเพื่อนมาแข่ง": เปิดหน้าแชร์ของเครื่อง ถ้าไม่ได้ก็คัดลอกลิงก์ให้
  $('#invite').onclick = async () => {
    const url = 'https://claude.ai/artifact/DN6j5pzZ2FzCmconwvNQwK', txt = 'มาแข่งตื่นเช้ากับฉันในแอป "ตื่นจริง" สิ! ใครตื่นไวกว่าชนะ 🏆';
    try { if (navigator.share) { await navigator.share({ title: 'ตื่นจริง', text: txt, url }); return } } catch (e) { if (e && e.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(txt + ' ' + url); $('#fmsg').textContent = 'คัดลอกลิงก์ชวนเพื่อนแล้ว!' } catch (e) { $('#fmsg').textContent = url }
  };


  /* ---------- 10. เริ่มทำงาน ---------- */

  render();                  // วาดหน้าจอครั้งแรก
  tick();                    // ขยับนาฬิกาทันที
  setInterval(tick, 1000);   // แล้วทำซ้ำทุก 1 วินาที
  initSocial();              // เชื่อมระบบแข่งกับเพื่อน
})();