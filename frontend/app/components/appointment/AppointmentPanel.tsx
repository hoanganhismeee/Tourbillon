// Sliding appointment booking panel — vertical accordion with 4 collapsible sections.
// Animation and portal handled by SlidingPanel.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { submitAppointment } from '@/lib/api';
import SlidingPanel, { PANEL_EXIT_MS } from './SlidingPanel';

interface AppointmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  watchId?: number;
  watchSlug?: string;
  brandName?: string;
  redirectPath?: string;
}

const TIME_SLOTS = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM',  '1:30 PM',
  '2:00 PM',  '2:30 PM',  '3:00 PM',  '3:30 PM',
  '4:00 PM',  '4:30 PM',  '5:00 PM',
];

const PHONE_REGIONS = [
  { code: '+61', label: 'Australia' },
  { code: '+93', label: 'Afghanistan' },
  { code: '+355', label: 'Albania' },
  { code: '+213', label: 'Algeria' },
  { code: '+1', label: 'United States' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+33', label: 'France' },
  { code: '+49', label: 'Germany' },
  { code: '+39', label: 'Italy' },
  { code: '+34', label: 'Spain' },
  { code: '+351', label: 'Portugal' },
  { code: '+41', label: 'Switzerland' },
  { code: '+43', label: 'Austria' },
  { code: '+32', label: 'Belgium' },
  { code: '+31', label: 'Netherlands' },
  { code: '+46', label: 'Sweden' },
  { code: '+47', label: 'Norway' },
  { code: '+45', label: 'Denmark' },
  { code: '+358', label: 'Finland' },
  { code: '+48', label: 'Poland' },
  { code: '+420', label: 'Czech Republic' },
  { code: '+36', label: 'Hungary' },
  { code: '+40', label: 'Romania' },
  { code: '+30', label: 'Greece' },
  { code: '+90', label: 'Turkey' },
  { code: '+7', label: 'Russia' },
  { code: '+380', label: 'Ukraine' },
  { code: '+81', label: 'Japan' },
  { code: '+82', label: 'South Korea' },
  { code: '+86', label: 'China' },
  { code: '+852', label: 'Hong Kong' },
  { code: '+886', label: 'Taiwan' },
  { code: '+65', label: 'Singapore' },
  { code: '+60', label: 'Malaysia' },
  { code: '+66', label: 'Thailand' },
  { code: '+84', label: 'Vietnam' },
  { code: '+62', label: 'Indonesia' },
  { code: '+63', label: 'Philippines' },
  { code: '+91', label: 'India' },
  { code: '+92', label: 'Pakistan' },
  { code: '+880', label: 'Bangladesh' },
  { code: '+971', label: 'UAE' },
  { code: '+966', label: 'Saudi Arabia' },
  { code: '+974', label: 'Qatar' },
  { code: '+972', label: 'Israel' },
  { code: '+20', label: 'Egypt' },
  { code: '+27', label: 'South Africa' },
  { code: '+234', label: 'Nigeria' },
  { code: '+254', label: 'Kenya' },
  { code: '+55', label: 'Brazil' },
  { code: '+54', label: 'Argentina' },
  { code: '+56', label: 'Chile' },
  { code: '+52', label: 'Mexico' },
  { code: '+57', label: 'Colombia' },
  { code: '+64', label: 'New Zealand' },
  { code: '+353', label: 'Ireland' },
  { code: '+354', label: 'Iceland' },
  { code: '+352', label: 'Luxembourg' },
  { code: '+377', label: 'Monaco' },
];

const DAY_HEADERS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseTimeSlot(slot: string): { hours: number; minutes: number } {
  const [time, period] = slot.split(' ');
  const [hoursStr, minutesStr] = time.split(':');
  let hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: (Date | null)[][] = [];
  let day = 1 - startOffset;

  for (let r = 0; r < 6; r++) {
    const row: (Date | null)[] = [];
    for (let c = 0; c < 7; c++) {
      row.push(day >= 1 && day <= daysInMonth ? new Date(year, month, day) : null);
      day++;
    }
    if (row.every(d => d === null)) break;
    rows.push(row);
  }
  return rows;
}

export default function AppointmentPanel({
  isOpen,
  onClose,
  watchId,
  watchSlug,
  brandName,
  redirectPath,
}: AppointmentPanelProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const loginRedirectPath = redirectPath || `/watches/${watchSlug || watchId}?panel=appointment`;

  const today = new Date();
  const [activeSection, setActiveSection] = useState(1);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [phoneRegion, setPhoneRegion]       = useState('+61');
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect]     = useState<DOMRect | null>(null);
  const regionBtnRef = useRef<HTMLButtonElement>(null);
  const notifyByEmail = true;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [confirmed, setConfirmed]   = useState<Set<number>>(new Set());

  // Reset form state after exit animation completes
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setActiveSection(1);
        setCalMonth(today.getMonth());
        setCalYear(today.getFullYear());
        setSelectedDate(null);
        setSelectedTime('');
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setPhoneRegion('+61');
        setRegionDropdownOpen(false);
        setDropdownRect(null);
        setSubmitting(false);
        setSubmitted(false);
        setError(null);
        setConfirmed(new Set());
      }, PANEL_EXIT_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-fill from user when section 4 becomes active
  useEffect(() => {
    if (activeSection === 4 && user) {
      setFirstName(prev => prev || user.firstName || '');
      setLastName(prev => prev || user.lastName || '');
      setEmail(user.email || '');
      setPhone(prev => prev || user.phoneNumber || '');
    }
  }, [activeSection, user]);

  const confirmSection = (section: number) => {
    setConfirmed(prev => new Set(prev).add(section));
    if (section < 4) setActiveSection(section + 1);
  };

  const canConfirmSection3 = selectedDate !== null && selectedTime !== '';
  const canSubmit = firstName.trim() !== '' && lastName.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { hours, minutes } = parseTimeSlot(selectedTime);
      const appointmentDate = new Date(selectedDate!);
      appointmentDate.setHours(hours, minutes, 0, 0);
      await submitAppointment({
        watchId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        phoneRegionCode: phone.trim() ? phoneRegion : undefined,
        notifyByEmail,
        notifyBySms: false,
        boutiqueName: 'Tourbillon Sydney',
        visitPurpose: 'discover_brand',
        brandName: brandName || 'Tourbillon',
        appointmentDate: appointmentDate.toISOString(),
      });
      setSubmitted(true);
      setActiveSection(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const isSelectable = (date: Date) => {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return date >= tomorrow && date.getDay() !== 0;
  };

  const canGoPrev = calYear > today.getFullYear() || (calYear === today.getFullYear() && calMonth > today.getMonth());

  const purposeLabel = brandName ? `Discover the ${brandName} collections` : 'Discover the Tourbillon collections';
  const formattedDate = selectedDate
    ? `${DAY_NAMES[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : '';
  const calendarGrid = buildCalendarGrid(calYear, calMonth);

  const SectionHeader = ({ num, title, summary, isActive, isConfirmed: done, onEdit }: {
    num: number; title: string; summary?: string;
    isActive: boolean; isConfirmed: boolean; onEdit?: () => void;
  }) => {
    const isReachable = num <= activeSection || done;
    return (
      <div className={`border-b border-white/8 ${!isReachable ? 'opacity-40' : ''}`}>
        <div className="flex items-center justify-between py-5">
          <div>
            <p className={`text-sm font-medium ${isActive ? 'text-[#ecddc8]' : 'text-white/70'}`}>
              <span className="text-white/30 mr-2">{num}.</span>{title}
            </p>
            {done && !isActive && summary && (
              <p className="text-sm text-white/50 mt-1 ml-5">{summary}</p>
            )}
          </div>
          {done && !isActive && onEdit && (
            <button onClick={onEdit} className="text-sm text-[#bfa68a] hover:text-[#d4c4a8] transition-colors underline underline-offset-2">
              Edit
            </button>
          )}
        </div>
      </div>
    );
  };

  const phoneDropdownOverlay = regionDropdownOpen && dropdownRect ? (
    <div
      style={{
        position: 'fixed',
        top: dropdownRect.top,
        left: dropdownRect.left - 248,
        width: 240, maxHeight: 208, overflowY: 'auto',
        background: '#252220', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 300,
      }}
    >
      {PHONE_REGIONS.map(r => (
        <button
          key={r.code + r.label}
          type="button"
          onClick={() => { setPhoneRegion(r.code); setRegionDropdownOpen(false); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14,
            background: phoneRegion === r.code ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: phoneRegion === r.code ? '#ecddc8' : 'rgba(255,255,255,0.7)',
            fontWeight: phoneRegion === r.code ? 600 : 400,
            border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600 }}>{r.code}</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <SlidingPanel
      isOpen={isOpen}
      onClose={onClose}
      title={submitted ? 'Appointment Confirmed' : 'Book an Appointment'}
      ariaLabel="Book an appointment"
      onPanelScroll={() => setRegionDropdownOpen(false)}
      overlays={phoneDropdownOverlay}
    >
      {submitted ? (
        <div className="flex flex-col items-center text-center px-8 pt-12 pb-8">
          <div className="w-16 h-16 rounded-full border-2 border-[#bfa68a] flex items-center justify-center mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bfa68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <p className="text-white/90 text-lg font-medium mb-2">{formattedDate} at {selectedTime}</p>
          <p className="text-white/50 text-sm mb-1">Tourbillon Sydney</p>
          <p className="text-white/50 text-sm">123 George Street, Sydney NSW 2000</p>
          <p className="text-white/40 text-sm mt-6">A confirmation has been sent to {email}.</p>
          <button
            onClick={onClose}
            className="mt-10 py-3.5 px-12 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="px-8 pb-8">
          {/* Section 1: Boutique */}
          <SectionHeader num={1} title="Select a boutique" summary="Tourbillon Sydney"
            isActive={activeSection === 1} isConfirmed={confirmed.has(1)} onEdit={() => setActiveSection(1)} />
          <div className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ maxHeight: activeSection === 1 ? 300 : 0, opacity: activeSection === 1 ? 1 : 0 }}>
            <div className="pt-2 pb-6">
              <div className="border border-[#bfa68a]/40 bg-[#bfa68a]/5 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#bfa68a] flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#bfa68a]" />
                  </div>
                  <div>
                    <p className="text-white/90 font-medium">Tourbillon Sydney</p>
                    <p className="text-white/50 text-sm mt-1">123 George Street</p>
                    <p className="text-white/50 text-sm">Sydney, NSW 2000</p>
                    <p className="text-white/40 text-xs mt-2">Mon - Sat: 10:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>
              <button onClick={() => confirmSection(1)}
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors text-sm">
                Confirm
              </button>
            </div>
          </div>

          {/* Section 2: Purpose */}
          <SectionHeader num={2} title="Purpose of your visit" summary={purposeLabel}
            isActive={activeSection === 2} isConfirmed={confirmed.has(2)} onEdit={() => setActiveSection(2)} />
          <div className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ maxHeight: activeSection === 2 ? 200 : 0, opacity: activeSection === 2 ? 1 : 0 }}>
            <div className="pt-2 pb-6">
              <div className="border border-[#bfa68a]/40 bg-[#bfa68a]/5 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#bfa68a] flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#bfa68a]" />
                  </div>
                  <p className="text-white/90 font-medium">{purposeLabel}</p>
                </div>
              </div>
              <button onClick={() => confirmSection(2)}
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors text-sm">
                Confirm
              </button>
            </div>
          </div>

          {/* Section 3: Date + Time */}
          <SectionHeader num={3} title="Appointment details"
            summary={selectedDate && selectedTime ? `${formattedDate} at ${selectedTime}` : undefined}
            isActive={activeSection === 3} isConfirmed={confirmed.has(3)} onEdit={() => setActiveSection(3)} />
          <div className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ maxHeight: activeSection === 3 ? 800 : 0, opacity: activeSection === 3 ? 1 : 0 }}>
            <div className="pt-2 pb-6">
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Date *</label>
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} disabled={!canGoPrev}
                  className="text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <span className="text-sm font-semibold uppercase tracking-widest text-white/70">
                  {MONTH_FULL[calMonth]} {calYear}
                </span>
                <button onClick={nextMonth} className="text-white/40 hover:text-white/70 transition-colors p-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_HEADERS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/30 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarGrid.flat().map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="py-2" />;
                  const selectable = isSelectable(date);
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const isToday = date.toDateString() === today.toDateString();
                  const isSunday = date.getDay() === 0;
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => { if (selectable) { setSelectedDate(date); setSelectedTime(''); } }}
                      disabled={!selectable}
                      className={`relative py-2 text-sm text-center transition-colors rounded-lg mx-0.5 my-0.5
                        ${isSelected ? 'bg-[#bfa68a]/20 text-[#ecddc8] font-semibold'
                          : selectable ? 'text-white/70 hover:bg-white/5 hover:text-white/90'
                          : isSunday ? 'text-white/15 cursor-not-allowed'
                          : 'text-white/20 cursor-not-allowed'}
                        ${isToday && !isSelected ? 'font-semibold text-white/90' : ''}`}
                    >
                      {date.getDate()}
                      {isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#bfa68a]" />}
                    </button>
                  );
                })}
              </div>
              {selectedDate && (
                <div className="mt-5" style={{ animation: 'apptFadeUp 250ms ease-out' }}>
                  <style>{`@keyframes apptFadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Available Time *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map(slot => (
                      <button key={slot} onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedTime === slot
                            ? 'border-[#bfa68a] bg-[#bfa68a]/15 text-[#ecddc8]'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70'
                        }`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => confirmSection(3)} disabled={!canConfirmSection3}
                className="w-full mt-5 py-3 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Confirm
              </button>
            </div>
          </div>

          {/* Section 4: Personal Info */}
          <SectionHeader num={4} title="Personal information"
            summary={firstName && lastName ? `${firstName} ${lastName}` : undefined}
            isActive={activeSection === 4} isConfirmed={confirmed.has(4)} />
          <div className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ maxHeight: activeSection === 4 ? 800 : 0, opacity: activeSection === 4 ? 1 : 0 }}>
            <div className="pt-2 pb-6">
              {!authLoading && !isAuthenticated && (
                <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/50 text-sm">Already joined Tourbillon?</span>
                  <Link href={`/login?redirect=${encodeURIComponent(loginRedirectPath)}`}
                    className="text-[#bfa68a] hover:text-[#d4c4a8] text-sm font-medium transition-colors">
                    Sign in
                  </Link>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">First Name *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors"
                    placeholder="First name" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Last Name *</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors"
                    placeholder="Last name" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    readOnly={isAuthenticated && !!user?.email}
                    className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors ${isAuthenticated && user?.email ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder="Email address" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Notify me by *</label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-[18px] h-[18px] rounded-full border-2 border-[#bfa68a] flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#bfa68a]" />
                      </span>
                      <span className="text-sm text-white/70">Email</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Mobile Number <span className="text-white/30">(Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">
                      <button
                        ref={regionBtnRef}
                        type="button"
                        onClick={() => {
                          if (regionBtnRef.current) setDropdownRect(regionBtnRef.current.getBoundingClientRect());
                          setRegionDropdownOpen(prev => !prev);
                        }}
                        className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm hover:border-white/20 focus:outline-none focus:border-[#bfa68a]/50 transition-colors min-w-[90px]"
                      >
                        <span>{phoneRegion}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/40 ml-auto">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                    </div>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors"
                      placeholder="Mobile number" />
                  </div>
                </div>
              </div>
              {error && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
              )}
              <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                className="w-full mt-5 py-3 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Booking...' : 'Book Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SlidingPanel>
  );
}
