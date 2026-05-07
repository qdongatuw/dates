// State
let birthdays = JSON.parse(localStorage.getItem('birthdays') || '[]');

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const form = document.getElementById('birthday-form');
const bTypeRadios = document.getElementsByName('b-type');
const lunarLeapGroup = document.getElementById('lunar-leap-group');
const bMonthSelect = document.getElementById('b-month');
const bDaySelect = document.getElementById('b-day');
const bYearInput = document.getElementById('b-year');
const upcomingList = document.getElementById('upcoming-list');
const calendarGrid = document.getElementById('calendar-grid');

// Initialize Icons
lucide.createIcons();

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const targetId = item.dataset.target;
        viewSections.forEach(sec => {
            sec.classList.remove('active');
            if(sec.id === targetId) {
                sec.classList.add('active');
            }
        });
        
        if(targetId === 'dashboard') renderDashboard();
        if(targetId === 'calendar-view') renderCalendar();
    });
});

// Populate Form dropdowns
function populateDropdowns(isLunar) {
    bMonthSelect.innerHTML = '';
    bDaySelect.innerHTML = '';
    
    // Months
    for(let i=1; i<=12; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.textContent = isLunar ? getLunarMonthName(i) : `${i}月`;
        bMonthSelect.appendChild(opt);
    }
    
    // Days
    for(let i=1; i<=30; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.textContent = isLunar ? getLunarDayName(i) : `${i}日`;
        bDaySelect.appendChild(opt);
    }
    if (!isLunar) {
        let opt = document.createElement('option');
        opt.value = 31;
        opt.textContent = '31日';
        bDaySelect.appendChild(opt);
    }
}

function getLunarMonthName(m) {
    const names = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
    return names[m-1];
}

function getLunarDayName(d) {
    const days = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    return days[d-1];
}

// Initial populate
populateDropdowns(false);

bTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const isLunar = e.target.value === 'lunar';
        lunarLeapGroup.style.display = isLunar ? 'block' : 'none';
        populateDropdowns(isLunar);
    });
});

// Form Submit
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('b-name').value;
    const type = document.querySelector('input[name="b-type"]:checked').value;
    const year = document.getElementById('b-year').value || null;
    const month = parseInt(document.getElementById('b-month').value);
    const day = parseInt(document.getElementById('b-day').value);
    const isLeap = document.getElementById('b-is-leap').checked;

    const newBirthday = {
        id: Date.now().toString(),
        name,
        type,
        year: year ? parseInt(year) : null,
        month,
        day,
        isLeap: type === 'lunar' ? isLeap : false
    };

    birthdays.push(newBirthday);
    saveBirthdays();
    showToast('生日添加成功！');
    form.reset();
    populateDropdowns(false);
    lunarLeapGroup.style.display = 'none';
    
    // Switch to dashboard
    navItems[0].click();
});

function saveBirthdays() {
    localStorage.setItem('birthdays', JSON.stringify(birthdays));
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="check-circle" style="color: #6ee7b7;"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    lucide.createIcons({root: toast});
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Calculate next occurrences
function getNextOccurrence(b) {
    const today = Solar.fromDate(new Date());
    const currentYear = today.getYear();
    
    let nextSolar;
    if (b.type === 'gregorian') {
        nextSolar = Solar.fromYmd(currentYear, b.month, b.day);
        if (nextSolar.isBefore(today) && !(nextSolar.getYear()===today.getYear() && nextSolar.getMonth()===today.getMonth() && nextSolar.getDay()===today.getDay())) {
            nextSolar = Solar.fromYmd(currentYear + 1, b.month, b.day);
        }
    } else {
        // Lunar
        let m = b.isLeap ? -b.month : b.month;
        let lunar = Lunar.fromYmd(currentYear, m, b.day);
        nextSolar = lunar.getSolar();
        
        if (nextSolar.isBefore(today) && !(nextSolar.getYear()===today.getYear() && nextSolar.getMonth()===today.getMonth() && nextSolar.getDay()===today.getDay())) {
            lunar = Lunar.fromYmd(currentYear + 1, m, b.day);
            nextSolar = lunar.getSolar();
        }
    }
    
    // Calculate days left
    // lunar-javascript's subtract method works on Solar dates using julian days
    const daysLeft = nextSolar.subtract(today);
    
    return {
        ...b,
        nextDate: nextSolar.toYmd(),
        daysLeft: daysLeft,
        ageNext: b.year ? nextSolar.getYear() - b.year : null
    };
}

// Export to ICS
function exportToICS(bOccur) {
    const {name, type, nextDate} = bOccur;
    const [y, m, d] = nextDate.split('-').map(Number);
    
    const pad = (n) => n.toString().padStart(2, '0');
    const dtstart = `${y}${pad(m)}${pad(d)}`;
    
    let events = [];
    
    if (type === 'gregorian') {
        events.push(
`BEGIN:VEVENT
SUMMARY:${name}的生日
DTSTART;VALUE=DATE:${dtstart}
RRULE:FREQ=YEARLY
DESCRIPTION:生日提醒 - 流年 App
END:VEVENT`
        );
    } else {
        // Generate 10 occurrences for lunar since it doesn't fit standard RRULE
        for(let i=0; i<10; i++) {
            let ly = y + i;
            let m_lunar = bOccur.isLeap ? -bOccur.month : bOccur.month;
            let lun = Lunar.fromYmd(ly, m_lunar, bOccur.day);
            let sol = lun.getSolar();
            let dstart_l = `${sol.getYear()}${pad(sol.getMonth())}${pad(sol.getDay())}`;
            events.push(
`BEGIN:VEVENT
SUMMARY:${name}的农历生日
DTSTART;VALUE=DATE:${dstart_l}
DESCRIPTION:农历生日提醒 - 流年 App
END:VEVENT`
            );
        }
    }
    
    const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LiuNian//Birthday Tracker//CN
${events.join('\n')}
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}_birthday.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('日历文件已导出');
}

// Delete Birthday
function deleteBirthday(id) {
    if(confirm('确定要删除这个生日吗？')) {
        birthdays = birthdays.filter(b => b.id !== id);
        saveBirthdays();
        renderDashboard();
        showToast('已删除');
    }
}

// Render Dashboard
function renderDashboard() {
    const today = Solar.fromDate(new Date());
    const lunarToday = today.getLunar();
    
    document.getElementById('current-date-display').innerHTML = 
        `${today.toYmd()} &nbsp;&nbsp; 农历 ${lunarToday.getMonthInChinese()}月${lunarToday.getDayInChinese()}`;
    
    if(birthdays.length === 0) {
        upcomingList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted)">还没有添加生日哦，快去添加吧！</div>`;
        return;
    }
    
    const occurrences = birthdays.map(getNextOccurrence);
    occurrences.sort((a, b) => a.daysLeft - b.daysLeft);
    
    upcomingList.innerHTML = '';
    
    occurrences.forEach(occ => {
        const isToday = occ.daysLeft === 0;
        const tagClass = occ.type === 'lunar' ? 'lunar' : 'gregorian';
        const tagText = occ.type === 'lunar' ? '农历' : '公历';
        
        const card = document.createElement('div');
        card.className = 'birthday-card';
        card.innerHTML = `
            <div class="card-info">
                <h3>
                    ${occ.name} 
                    <span class="tag ${tagClass}">${tagText}</span>
                    ${isToday ? `<span class="tag today">今天!</span>` : ''}
                </h3>
                <div class="card-date">
                    下次: ${occ.nextDate} ${occ.ageNext ? `(将满 ${occ.ageNext} 岁)` : ''}
                </div>
                <div class="card-countdown">
                    ${isToday ? '生日快乐！🎉' : `还有 ${occ.daysLeft} 天`}
                </div>
            </div>
            <div class="card-actions">
                <button class="icon-btn export-btn" title="导出到日历" data-id="${occ.id}"><i data-lucide="calendar-arrow-down"></i></button>
                <button class="icon-btn delete-btn" title="删除" data-id="${occ.id}"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        upcomingList.appendChild(card);
    });
    
    lucide.createIcons({root: upcomingList});
    
    // Attach events
    upcomingList.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const occ = occurrences.find(o => o.id === id);
            exportToICS(occ);
        });
    });
    upcomingList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            deleteBirthday(id);
        });
    });
}

// Calendar Logic
let currentCalDate = new Date();

const calMonthYear = document.getElementById('calendar-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const todayBtn = document.getElementById('today-btn');

prevMonthBtn.addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderCalendar();
});
todayBtn.addEventListener('click', () => {
    currentCalDate = new Date();
    renderCalendar();
});

document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('calendar-details').classList.add('hidden');
});

function renderCalendar() {
    calendarGrid.innerHTML = '';
    
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    calMonthYear.textContent = `${year}年 ${month + 1}月`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startOffset = firstDay.getDay(); 
    
    // Calculate occurrences for this month's grid
    const occurrencesThisYear = birthdays.map(b => {
        if(b.type === 'gregorian') {
            return { ...b, solarDate: Solar.fromYmd(year, b.month, b.day) };
        } else {
            let m = b.isLeap ? -b.month : b.month;
            let lun = Lunar.fromYmd(year, m, b.day);
            return { ...b, solarDate: lun.getSolar() };
        }
    });
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
        const cell = createCalendarCell(year, month - 1, prevMonthDays - i, true, occurrencesThisYear);
        calendarGrid.appendChild(cell);
    }
    
    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const isToday = year === today.getFullYear() && month === today.getMonth() && i === today.getDate();
        const cell = createCalendarCell(year, month, i, false, occurrencesThisYear, isToday);
        calendarGrid.appendChild(cell);
    }
    
    const totalCells = calendarGrid.children.length;
    const remaining = 42 - totalCells;
    for(let i = 1; i <= remaining; i++) {
        const cell = createCalendarCell(year, month + 1, i, true, occurrencesThisYear);
        calendarGrid.appendChild(cell);
    }
}

function createCalendarCell(y, m, d, isOtherMonth, occurrences, isToday = false) {
    const cellDate = new Date(y, m, d);
    const solar = Solar.fromDate(cellDate);
    const lunar = solar.getLunar();
    
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if(isOtherMonth) cell.classList.add('other-month');
    if(isToday) cell.classList.add('today');
    
    let cellBirthdays = occurrences.filter(occ => 
        occ.solarDate.getYear() === solar.getYear() && 
        occ.solarDate.getMonth() === solar.getMonth() && 
        occ.solarDate.getDay() === solar.getDay()
    );
    
    if(cellBirthdays.length > 0) {
        cell.classList.add('has-birthday');
    }
    
    let lunarText = lunar.getDayInChinese();
    if(lunar.getDay() === 1) {
        lunarText = lunar.getMonthInChinese() + '月';
    }
    const festival = lunar.getFestivals()[0] || solar.getFestivals()[0] || lunar.getJieQi();
    if(festival) {
        lunarText = festival;
    }
    
    cell.innerHTML = `
        <div class="cal-gregorian">${solar.getDay()}</div>
        <div class="cal-lunar ${festival ? 'festival' : ''}" ${festival ? 'style="color: var(--accent-primary)"' : ''}>${lunarText}</div>
    `;
    
    cell.addEventListener('click', () => {
        showDayDetails(solar, lunar, cellBirthdays);
    });
    
    return cell;
}

function showDayDetails(solar, lunar, bdays) {
    const detailsPanel = document.getElementById('calendar-details');
    detailsPanel.classList.remove('hidden');
    
    document.getElementById('detail-date').textContent = `${solar.toYmd()} 星期${solar.getWeekInChinese()}`;
    
    document.getElementById('detail-lunar').innerHTML = `
        农历 ${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} <br>
        <span style="font-size: 0.85em; color: var(--text-muted)">${lunar.getYearShengXiao()}年</span>
    `;
    
    const bList = document.getElementById('detail-birthdays');
    if(bdays.length > 0) {
        bList.innerHTML = `<h5 style="margin-bottom: 10px; color: var(--accent-primary)">今日生日：</h5>` + 
            bdays.map(b => `<div style="margin-bottom: 5px;">🎉 ${b.name} <span class="tag ${b.type}">${b.type === 'lunar' ? '农历' : '公历'}</span></div>`).join('');
    } else {
        bList.innerHTML = '<div style="color: var(--text-muted)">今日没有生日记录。</div>';
    }
}

// Initial render
renderDashboard();
