'use client'

import { useEffect, useState } from 'react'
import { getLocalStats, getFarmerByPhone, registerFarmer, logHarvest, logDelivery } from '@/lib/db'
import { getCurrentPosition, capturePhoto } from '@/lib/gps'
import { setupAutoSync } from '@/lib/sync'

type Tab = 'dashboard' | 'farmers' | 'harvest' | 'delivery' | 'sync'

interface Stats {
  farmers: number
  harvests: number
  deliveries: number
  pendingSync: number
  totalHarvestKg: number
  totalDeliveryKg: number
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<Stats>({
    farmers: 0, harvests: 0, deliveries: 0,
    pendingSync: 0, totalHarvestKg: 0, totalDeliveryKg: 0,
  })
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadStats()
    const on = () => { setOnline(true); loadStats() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const cleanup = setupAutoSync(30000)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); cleanup() }
  }, [])

  async function loadStats() { setStats(await getLocalStats()) }

  async function handleSync() {
    setSyncing(true)
    const { syncAll } = await import('@/lib/sync')
    const result = await syncAll()
    await loadStats()
    setSyncing(false)
    alert(`Synced: ${result.success} success, ${result.failed} failed`)
  }

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Home', icon: <IcoHome /> },
    { id: 'farmers', label: 'Farmers', icon: <IcoUsers /> },
    { id: 'harvest', label: 'Harvest', icon: <IcoLeaf /> },
    { id: 'delivery', label: 'Delivery', icon: <IcoTruck /> },
    { id: 'sync', label: 'Sync', icon: <IcoSync /> },
  ]

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="flex items-center gap-2.5">
          <div className="logo-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 6 6 9 6 13a6 6 0 0012 0c0-4-2-7-6-11z" fill="url(#lg1)"/>
              <path d="M12 7v11" stroke="url(#lg2)" strokeWidth="1.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="lg1" x1="6" y1="2" x2="18" y2="19"><stop stopColor="#34d399"/><stop offset="1" stopColor="#c9a227"/></linearGradient>
                <linearGradient id="lg2" x1="12" y1="7" x2="12" y2="18"><stop stopColor="#6ee7b7"/><stop offset="1" stopColor="#e8c84e"/></linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight tracking-tight">Agrowealth</div>
            <div className="text-[10px] text-royal-300 leading-tight font-medium tracking-wide">FIELD AGENT</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`status-pill ${online ? 'online' : 'offline'}`}>
            <span className="status-orb"></span>
            {online ? 'Online' : 'Offline'}
          </div>
          {stats.pendingSync > 0 && <span className="badge-pending">{stats.pendingSync}</span>}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="app-main" key={tab}>
        {tab === 'dashboard' && <DashboardTab stats={stats} onNavigate={setTab} />}
        {tab === 'farmers' && <FarmersTab onComplete={loadStats} />}
        {tab === 'harvest' && <HarvestTab onComplete={loadStats} />}
        {tab === 'delivery' && <DeliveryTab onComplete={loadStats} />}
        {tab === 'sync' && <SyncTab stats={stats} onSync={handleSync} syncing={syncing} />}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} className={`nav-item ${tab === item.id ? 'active' : ''}`}>
            <div className="nav-icon-wrap">{item.icon}</div>
            <span className="text-[10px] font-semibold">{item.label}</span>
            {tab === item.id && <div className="nav-indicator"></div>}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab({ stats, onNavigate }: { stats: Stats; onNavigate: (t: Tab) => void }) {
  const progress = stats.totalHarvestKg > 0 ? Math.min(100, (stats.totalDeliveryKg / stats.totalHarvestKg) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <div className="text-royal-300 text-xs font-semibold tracking-widest uppercase mb-1">Field Dashboard</div>
        <h1 className="text-white text-[28px] font-extrabold tracking-tight leading-none">Good day, Agent</h1>
      </div>

      {/* Hero Volume Card */}
      <div className="card-hero p-5 relative">
        <div className="orb-deco" style={{ width: 120, height: 120, background: 'rgba(52, 211, 153, 0.15)', top: -30, right: -20 }}></div>
        <div className="relative z-10">
          <div className="text-emerald-300 text-[11px] font-bold tracking-widest uppercase mb-2">Total Volume</div>
          <div className="flex items-baseline gap-1">
            <span className="text-white text-[44px] font-extrabold tracking-tighter leading-none">
              {(stats.totalHarvestKg / 1000).toFixed(1)}
            </span>
            <span className="text-emerald-400 text-xl font-bold">t</span>
          </div>
          <div className="text-royal-300 text-xs mt-1 mb-4">harvested this season</div>
          <div className="flex justify-between text-[10px] text-royal-300 font-semibold uppercase tracking-wider mb-1.5">
            <span>Delivery Rate</span>
            <span className="text-emerald-300">{progress.toFixed(0)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="text-royal-300 text-[11px] font-bold tracking-widest uppercase mb-3">Quick Actions</div>
        <div className="grid grid-cols-3 gap-2.5">
          <button className="action-card action-card-emerald" onClick={() => onNavigate('farmers')}>
            <div className="action-icon action-icon-emerald"><IcoUsers /></div>
            <div className="text-white text-xs font-bold mt-2.5">Register</div>
            <div className="text-royal-300 text-[10px]">New farmer</div>
          </button>
          <button className="action-card action-card-gold" onClick={() => onNavigate('harvest')}>
            <div className="action-icon action-icon-gold"><IcoLeaf /></div>
            <div className="text-white text-xs font-bold mt-2.5">Harvest</div>
            <div className="text-royal-300 text-[10px]">Log crop</div>
          </button>
          <button className="action-card action-card-blue" onClick={() => onNavigate('delivery')}>
            <div className="action-icon action-icon-blue"><IcoTruck /></div>
            <div className="text-white text-xs font-bold mt-2.5">Deliver</div>
            <div className="text-royal-300 text-[10px]">Confirm</div>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <div className="text-royal-300 text-[11px] font-bold tracking-widest uppercase mb-3">Overview</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="stat-mini">
            <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}><IcoUsers /></div>
            <div>
              <div className="text-white font-extrabold text-lg leading-none">{stats.farmers}</div>
              <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-1 font-semibold">Farmers</div>
            </div>
          </div>
          <div className="stat-mini">
            <div className="stat-icon" style={{ background: 'rgba(212, 175, 55, 0.12)', color: '#e8c84e' }}><IcoLeaf /></div>
            <div>
              <div className="text-white font-extrabold text-lg leading-none">{stats.harvests}</div>
              <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-1 font-semibold">Harvests</div>
            </div>
          </div>
          <div className="stat-mini">
            <div className="stat-icon" style={{ background: 'rgba(107, 109, 255, 0.12)', color: '#818cf8' }}><IcoTruck /></div>
            <div>
              <div className="text-white font-extrabold text-lg leading-none">{stats.deliveries}</div>
              <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-1 font-semibold">Deliveries</div>
            </div>
          </div>
          <div className="stat-mini">
            <div className="stat-icon" style={{ background: 'rgba(250, 204, 21, 0.12)', color: '#facc15' }}><IcoSync /></div>
            <div>
              <div className="text-white font-extrabold text-lg leading-none">{stats.pendingSync}</div>
              <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-1 font-semibold">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Volume breakdown */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-bold text-sm">Volume Breakdown</span>
          <span className="text-[10px] text-royal-300 uppercase tracking-wider font-semibold">kg</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-royal-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Harvested
            </span>
            <span className="text-white font-extrabold text-sm">{stats.totalHarvestKg.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-royal-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-400"></span> Delivered
            </span>
            <span className="text-white font-extrabold text-sm">{stats.totalDeliveryKg.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FARMERS TAB
// ═══════════════════════════════════════════════════════════════════════════

function FarmersTab({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    phone: '', bvn: '', fullName: '', farmState: 'Benue',
    farmLga: '', farmHectares: '', cassavaVariety: 'TME 419',
  })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'saving' | 'done' | 'error'>('idle')

  async function submit() {
    if (!form.phone || !form.fullName) return alert('Phone and name are required')
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })
      setStatus('saving')
      await registerFarmer({
        phone: form.phone, bvn: form.bvn, fullName: form.fullName,
        farmState: form.farmState, farmLga: form.farmLga,
        gpsLat: pos.lat, gpsLng: pos.lng,
        farmHectares: parseFloat(form.farmHectares) || 0, cassavaVariety: form.cassavaVariety,
      })
      setStatus('done')
      onComplete()
      setTimeout(() => {
        setStatus('idle')
        setForm({ phone: '', bvn: '', fullName: '', farmState: 'Benue', farmLga: '', farmHectares: '', cassavaVariety: 'TME 419' })
      }, 2000)
    } catch (e) { setStatus('error'); alert(`Error: ${e}`) }
  }

  return (
    <FormPage icon={<IcoUsers />} title="Register Farmer" subtitle="Onboard a new cooperative member">
      <div className="card-glass p-5 space-y-4">
        <FormField label="Phone Number" required value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="BVN" value={form.bvn} onChange={v => setForm({ ...form, bvn: v })} placeholder="12345678901" />
        <FormField label="Full Name" required value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} placeholder="John Doe" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="State" value={form.farmState} onChange={v => setForm({ ...form, farmState: v })} options={['Benue', 'Niger', 'Nasarawa', 'Oyo', 'Ogun', 'Cross River', 'Kogi']} />
          <FormField label="LGA" value={form.farmLga} onChange={v => setForm({ ...form, farmLga: v })} placeholder="Makurdi" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hectares" value={form.farmHectares} onChange={v => setForm({ ...form, farmHectares: v })} placeholder="5" type="number" />
          <SelectField label="Variety" value={form.cassavaVariety} onChange={v => setForm({ ...form, cassavaVariety: v })} options={['TME 419', 'TMS 30572', 'TMS 4(2)1425', 'Local']} />
        </div>
        {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}
        <SubmitBtn status={status} label="Register Farmer" onClick={submit} loadingStates={{ gps: 'Getting GPS...', saving: 'Saving...' }} />
      </div>
    </FormPage>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HARVEST TAB
// ═══════════════════════════════════════════════════════════════════════════

function HarvestTab({ onComplete }: { onComplete: () => void }) {
  const [phone, setPhone] = useState('')
  const [kg, setKg] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'photo' | 'saving' | 'done'>('idle')

  async function submit() {
    if (!phone || !kg) return alert('Farmer phone and weight are required')
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })
      setStatus('photo')
      const dataUrl = await capturePhoto()
      setPhoto(dataUrl)
      const farmer = await getFarmerByPhone(phone)
      if (!farmer) { alert('Farmer not found. Please register them first.'); setStatus('idle'); return }
      setStatus('saving')
      await logHarvest({ farmerId: farmer.id, farmerPhone: phone, estimatedKg: parseInt(kg) || 0, gpsLat: pos.lat, gpsLng: pos.lng, photoDataUrl: dataUrl })
      setStatus('done'); onComplete()
      setTimeout(() => { setStatus('idle'); setPhone(''); setKg(''); setPhoto(null) }, 2000)
    } catch (e) { alert(`Error: ${e}`) }
  }

  return (
    <FormPage icon={<IcoLeaf />} title="Log Harvest" subtitle="Record estimated crop yield">
      <div className="card-glass p-5 space-y-4">
        <FormField label="Farmer Phone" required value={phone} onChange={setPhone} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="Estimated Weight (kg)" required value={kg} onChange={setKg} placeholder="5000" type="number" />
        {photo && <PhotoPreview src={photo} alt="Harvest" />}
        {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}
        <SubmitBtn status={status} label="Log Harvest" onClick={submit}
          loadingStates={{ gps: 'Getting GPS...', photo: 'Take Photo...', saving: 'Saving...' }} extraLoading={['photo']} />
      </div>
    </FormPage>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DELIVERY TAB
// ═══════════════════════════════════════════════════════════════════════════

function DeliveryTab({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({ farmerPhone: '', actualKg: '', offTakerName: '', truckId: '' })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'photo' | 'saving' | 'done'>('idle')

  async function submit() {
    if (!form.farmerPhone || !form.actualKg) return alert('Farmer phone and weight are required')
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })
      setStatus('photo')
      const photoUrl = await capturePhoto()
      setPhoto(photoUrl)
      const farmer = await getFarmerByPhone(form.farmerPhone)
      if (!farmer) { alert('Farmer not found. Please register them first.'); setStatus('idle'); return }
      setStatus('saving')
      await logDelivery({ farmerId: farmer.id, farmerPhone: form.farmerPhone, actualKg: parseInt(form.actualKg) || 0, offTakerName: form.offTakerName, truckId: form.truckId, gpsLat: pos.lat, gpsLng: pos.lng, photoDataUrl: photoUrl })
      setStatus('done'); onComplete()
      setTimeout(() => { setStatus('idle'); setForm({ farmerPhone: '', actualKg: '', offTakerName: '', truckId: '' }); setPhoto(null) }, 2000)
    } catch (e) { alert(`Error: ${e}`) }
  }

  return (
    <FormPage icon={<IcoTruck />} title="Log Delivery" subtitle="Confirm crop delivery to off-taker">
      <div className="card-glass p-5 space-y-4">
        <FormField label="Farmer Phone" required value={form.farmerPhone} onChange={v => setForm({ ...form, farmerPhone: v })} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="Actual Weight (kg)" required value={form.actualKg} onChange={v => setForm({ ...form, actualKg: v })} placeholder="35000" type="number" />
        <FormField label="Off-Taker" value={form.offTakerName} onChange={v => setForm({ ...form, offTakerName: v })} placeholder="Pure Biotech" />
        <FormField label="Truck ID" value={form.truckId} onChange={v => setForm({ ...form, truckId: v })} placeholder="TRK-001" />
        {photo && <PhotoPreview src={photo} alt="Delivery" />}
        {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}
        <SubmitBtn status={status} label="Log Delivery" onClick={submit}
          loadingStates={{ gps: 'Getting GPS...', photo: 'Take Photo...', saving: 'Saving...' }} extraLoading={['photo']} />
      </div>
    </FormPage>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC TAB
// ═══════════════════════════════════════════════════════════════════════════

function SyncTab({ stats, onSync, syncing }: { stats: Stats; onSync: () => void; syncing: boolean }) {
  return (
    <div className="space-y-5">
      <FormHeader icon={<IcoSync />} title="Sync Data" subtitle="Upload queued records to server" />

      {/* Big number card */}
      <div className="card-hero p-8 relative text-center">
        <div className="orb-deco" style={{ width: 140, height: 140, background: 'rgba(74, 76, 255, 0.12)', top: -40, left: '50%', transform: 'translateX(-50%)' }}></div>
        <div className="relative z-10">
          <div className="text-royal-300 text-[11px] font-bold tracking-widest uppercase mb-2">Pending Records</div>
          <div className="text-white text-[56px] font-extrabold tracking-tighter leading-none">{stats.pendingSync}</div>
          <div className="text-royal-300 text-xs mt-2">
            {stats.pendingSync === 0 ? '✓ All synced — you\'re caught up' : 'waiting to upload'}
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Farmers', value: stats.farmers },
          { label: 'Harvests', value: stats.harvests },
          { label: 'Deliveries', value: stats.deliveries },
        ].map(s => (
          <div key={s.label} className="card-glass p-3 text-center">
            <div className="text-white font-extrabold text-xl">{s.value}</div>
            <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-0.5 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sync button */}
      <button
        onClick={onSync}
        disabled={syncing || stats.pendingSync === 0}
        className={`btn-sync ${syncing ? 'btn-sync-loading' : ''} ${stats.pendingSync === 0 ? 'btn-sync-done' : ''}`}
      >
        {syncing ? <><span className="spinner"></span> Syncing...</> :
         stats.pendingSync === 0 ? '✓ All Caught Up' :
         'Sync Now'}
      </button>

      {/* Info */}
      <div className="card-glass p-4">
        <div className="text-royal-300 text-[11px] font-bold tracking-widest uppercase mb-3">How Sync Works</div>
        <ul className="space-y-2">
          {['Saved locally when offline', 'Auto-syncs every 30s when online', 'Manual sync for instant upload', 'Failed items retry automatically'].map((t, i) => (
            <li key={i} className="text-royal-300 text-xs flex items-center gap-2.5">
              <span className="text-emerald-400 font-bold">→</span> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function FormPage({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <FormHeader icon={icon} title={title} subtitle={subtitle} />
      {children}
    </div>
  )
}

function FormHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="logo-mark" style={{ width: 44, height: 44, borderRadius: 12 }}>
        <div style={{ color: '#6ee7b7' }}>{icon}</div>
      </div>
      <div>
        <div className="text-white font-extrabold text-xl tracking-tight leading-tight">{title}</div>
        <div className="text-royal-300 text-xs font-medium">{subtitle}</div>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] text-royal-300 font-bold tracking-wide block mb-1.5">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="form-field" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="text-[11px] text-royal-300 font-bold tracking-wide block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="form-field">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function GpsBadge({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="gps-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
    </div>
  )
}

function PhotoPreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="photo-preview">
      <img src={src} alt={alt} />
      <div className="photo-badge">📷 Verified</div>
    </div>
  )
}

function SubmitBtn({ status, label, onClick, loadingStates, extraLoading = [] }: {
  status: string; label: string; onClick: () => void; loadingStates: Record<string, string>; extraLoading?: string[]
}) {
  const loading = ['gps', 'saving', ...extraLoading].includes(status)
  return (
    <button onClick={onClick} disabled={loading}
      className={`btn-submit ${status === 'done' ? 'btn-submit-done' : ''} ${loading ? 'btn-submit-loading' : ''}`}>
      {status === 'done' ? '✓ Completed' : loading ? (loadingStates[status] || 'Loading...') : label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════

function IcoHome() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3v-6a1 1 0 011-1h4a1 1 0 011 1v6h3a1 1 0 001-1V10"/></svg>
}
function IcoUsers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function IcoLeaf() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 9.3-3.2 17.8-8.2 17.04"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>
}
function IcoTruck() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
}
function IcoSync() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
}
