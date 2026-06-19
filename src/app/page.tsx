'use client'

import { useEffect, useState } from 'react'
import { getLocalStats, getFarmerByPhone, registerFarmer, logHarvest, logDelivery } from '@/lib/db'
import { getCurrentPosition, capturePhoto } from '@/lib/gps'
import { setupAutoSync } from '@/lib/sync'

// ── Types ─────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'farmers' | 'harvest' | 'delivery' | 'sync'

interface Stats {
  farmers: number
  harvests: number
  deliveries: number
  pendingSync: number
  totalHarvestKg: number
  totalDeliveryKg: number
}

// ── Main Page ─────────────────────────────────────────────────────────────

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

    const handleOnline = () => { setOnline(true); loadStats() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const cleanup = setupAutoSync(30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      cleanup()
    }
  }, [])

  async function loadStats() {
    const s = await getLocalStats()
    setStats(s)
  }

  async function handleSync() {
    setSyncing(true)
    const { syncAll } = await import('@/lib/sync')
    const result = await syncAll()
    await loadStats()
    setSyncing(false)
    alert(`Synced: ${result.success} success, ${result.failed} failed`)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Home', icon: <IconHome /> },
    { id: 'farmers', label: 'Farmers', icon: <IconUsers /> },
    { id: 'harvest', label: 'Harvest', icon: <IconWheat /> },
    { id: 'delivery', label: 'Delivery', icon: <IconTruck /> },
    { id: 'sync', label: 'Sync', icon: <IconSync /> },
  ]

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="flex items-center gap-2.5">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="url(#g1)" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 7v10M8 9.5l4 2.5 4-2.5M8 14.5l4-2.5 4 2.5" stroke="url(#g2)" strokeWidth="1.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="24" y2="24">
                  <stop stopColor="#34d399"/><stop offset="1" stopColor="#c9a227"/>
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="24" y2="24">
                  <stop stopColor="#6ee7b7"/><stop offset="1" stopColor="#d4af37"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Agrowealth</div>
            <div className="text-[10px] text-royal-300 leading-tight">Field Agent</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`status-pill ${online ? 'online' : 'offline'}`}>
            <span className="status-orb"></span>
            <span>{online ? 'Online' : 'Offline'}</span>
          </div>
          {stats.pendingSync > 0 && (
            <span className="badge-pending">{stats.pendingSync}</span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="app-main" key={tab}>
        {tab === 'dashboard' && <DashboardTab stats={stats} onNavigate={setTab} />}
        {tab === 'farmers' && <FarmersTab onComplete={loadStats} />}
        {tab === 'harvest' && <HarvestTab onComplete={loadStats} />}
        {tab === 'delivery' && <DeliveryTab onComplete={loadStats} />}
        {tab === 'sync' && <SyncTab stats={stats} onSync={handleSync} syncing={syncing} />}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {tabs.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
          >
            <div className="nav-icon">{item.icon}</div>
            <span className="nav-label">{item.label}</span>
            {tab === item.id && <div className="nav-indicator"></div>}
          </button>
        ))}
      </nav>

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(74, 76, 255, 0.12), transparent),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201, 162, 39, 0.06), transparent),
            var(--bg-primary);
        }
        .app-header {
          padding: 0.875rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(10, 11, 30, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(107, 109, 255, 0.08);
        }
        .logo-mark {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(201, 162, 39, 0.15));
          border: 1px solid rgba(107, 109, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-pill {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 500;
        }
        .status-pill.online {
          background: rgba(16, 185, 129, 0.12);
          color: #6ee7b7;
        }
        .status-pill.offline {
          background: rgba(250, 204, 21, 0.12);
          color: #facc15;
        }
        .status-orb {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: currentColor;
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .badge-pending {
          background: linear-gradient(135deg, #c9a227, #a68520);
          color: #0f1028;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          min-width: 18px;
          text-align: center;
        }
        .app-main {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem 1rem 6rem 1rem;
          animation: fadeIn 0.25s ease-out;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: rgba(10, 11, 30, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(107, 109, 255, 0.1);
          padding: 0.5rem 0.25rem calc(0.5rem + env(safe-area-inset-bottom));
          z-index: 50;
        }
        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 0.5rem 0;
          background: none;
          border: none;
          color: rgba(151, 159, 255, 0.5);
          cursor: pointer;
          position: relative;
          transition: color 0.2s ease;
        }
        .nav-item.active {
          color: #6ee7b7;
        }
        .nav-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .nav-item.active .nav-icon {
          transform: translateY(-2px) scale(1.1);
        }
        .nav-label {
          font-size: 0.625rem;
          font-weight: 500;
        }
        .nav-indicator {
          position: absolute;
          bottom: 2px;
          width: 24px;
          height: 3px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #34d399, #6ee7b7);
        }
      `}</style>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────

function DashboardTab({ stats, onNavigate }: { stats: Stats; onNavigate: (tab: Tab) => void }) {
  const harvestProgress = stats.totalHarvestKg > 0
    ? Math.min(100, (stats.totalDeliveryKg / stats.totalHarvestKg) * 100)
    : 0

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Hero */}
      <div>
        <div className="text-royal-300 text-xs font-medium mb-1">Welcome back</div>
        <div className="text-white text-2xl font-bold tracking-tight">Field Dashboard</div>
      </div>

      {/* Hero stat */}
      <div className="hero-stat">
        <div className="hero-stat-bg"></div>
        <div className="relative z-10">
          <div className="text-royal-200 text-xs uppercase tracking-wider mb-1">Total Volume</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-white tracking-tight">
              {(stats.totalHarvestKg / 1000).toFixed(1)}
            </span>
            <span className="text-lg font-semibold text-emerald-300">t</span>
          </div>
          <div className="text-royal-300 text-xs mt-0.5">harvested this season</div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-royal-200 mb-1">
              <span>Delivered</span>
              <span>{harvestProgress.toFixed(0)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${harvestProgress}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="text-royal-200 text-xs font-semibold uppercase tracking-wider mb-3">Quick Actions</div>
        <div className="grid grid-cols-3 gap-2.5">
          <ActionCard label="Register" sub="New farmer" icon={<IconUsers />} gradient="emerald" onClick={() => onNavigate('farmers')} />
          <ActionCard label="Harvest" sub="Log crop" icon={<IconWheat />} gradient="gold" onClick={() => onNavigate('harvest')} />
          <ActionCard label="Deliver" sub="Confirm" icon={<IconTruck />} gradient="blue" onClick={() => onNavigate('delivery')} />
        </div>
      </div>

      {/* Stat Grid */}
      <div>
        <div className="text-royal-200 text-xs font-semibold uppercase tracking-wider mb-3">Overview</div>
        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat label="Farmers" value={stats.farmers} icon={<IconUsers />} color="#6ee7b7" />
          <MiniStat label="Harvests" value={stats.harvests} icon={<IconWheat />} color="#d4af37" />
          <MiniStat label="Deliveries" value={stats.deliveries} icon={<IconTruck />} color="#6b6dff" />
          <MiniStat label="Pending" value={stats.pendingSync} icon={<IconSync />} color="#facc15" />
        </div>
      </div>

      {/* Delivery summary */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold text-sm">Volume Summary</span>
          <span className="text-[10px] text-royal-300 uppercase tracking-wider">kg</span>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-royal-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Harvested
            </span>
            <span className="text-white font-bold text-sm">{stats.totalHarvestKg.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-royal-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-400"></span>
              Delivered
            </span>
            <span className="text-white font-bold text-sm">{stats.totalDeliveryKg.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-stat {
          position: relative;
          border-radius: 1.25rem;
          padding: 1.5rem;
          overflow: hidden;
          border: 1px solid rgba(107, 109, 255, 0.15);
        }
        .hero-stat-bg {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(52, 211, 153, 0.08), rgba(74, 76, 255, 0.12)),
            rgba(24, 28, 68, 0.4);
        }
        .progress-track {
          height: 6px;
          background: rgba(107, 109, 255, 0.15);
          border-radius: 9999px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #34d399, #6ee7b7);
          border-radius: 9999px;
          transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
        }
      `}</style>
    </div>
  )
}

function ActionCard({ label, sub, icon, gradient, onClick }: {
  label: string; sub: string; icon: React.ReactNode; gradient: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="action-card group">
      <div className={`action-icon ${gradient}`}>{icon}</div>
      <div className="text-white text-xs font-semibold mt-2">{label}</div>
      <div className="text-royal-300 text-[10px]">{sub}</div>
      <style jsx>{`
        .action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.875rem 0.5rem;
          background: rgba(24, 28, 68, 0.35);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(107, 109, 255, 0.1);
          border-radius: 0.875rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .action-card:hover {
          border-color: rgba(107, 109, 255, 0.25);
          transform: translateY(-2px);
        }
        .action-card:active {
          transform: scale(0.96);
        }
        .action-icon {
          width: 38px;
          height: 38px;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-icon.emerald {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.1));
          color: #34d399;
        }
        .action-icon.gold {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(201, 162, 39, 0.1));
          color: #d4af37;
        }
        .action-icon.blue {
          background: linear-gradient(135deg, rgba(107, 109, 255, 0.2), rgba(74, 76, 255, 0.1));
          color: #6b6dff;
        }
      `}</style>
    </button>
  )
}

function MiniStat({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <div className="glass p-3 flex items-center gap-3">
      <div className="mini-icon" style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <div>
        <div className="text-white font-bold text-lg leading-none">{value}</div>
        <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-1">{label}</div>
      </div>
      <style jsx>{`
        .mini-icon {
          width: 32px;
          height: 32px;
          border-radius: 0.625rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}

// ── Farmers Tab ───────────────────────────────────────────────────────────

function FarmersTab({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    phone: '', bvn: '', fullName: '', farmState: 'Benue',
    farmLga: '', farmHectares: '', cassavaVariety: 'TME 419',
  })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'saving' | 'done' | 'error'>('idle')

  async function handleSubmit() {
    if (!form.phone || !form.fullName) {
      alert('Phone and name are required')
      return
    }
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })
      setStatus('saving')

      await registerFarmer({
        phone: form.phone,
        bvn: form.bvn,
        fullName: form.fullName,
        farmState: form.farmState,
        farmLga: form.farmLga,
        gpsLat: pos.lat,
        gpsLng: pos.lng,
        farmHectares: parseFloat(form.farmHectares) || 0,
        cassavaVariety: form.cassavaVariety,
      })

      setStatus('done')
      onComplete()
      setTimeout(() => {
        setStatus('idle')
        setForm({ phone: '', bvn: '', fullName: '', farmState: 'Benue', farmLga: '', farmHectares: '', cassavaVariety: 'TME 419' })
      }, 2000)
    } catch (e) {
      setStatus('error')
      alert(`Error: ${e}`)
    }
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <PageHeader icon={<IconUsers />} title="Register Farmer" subtitle="Onboard a new cooperative member" />

      <div className="glass p-5 space-y-4">
        <FormField label="Phone Number" required value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="BVN" value={form.bvn} onChange={v => setForm({ ...form, bvn: v })} placeholder="12345678901" />
        <FormField label="Full Name" required value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} placeholder="John Doe" />

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="State" value={form.farmState} onChange={v => setForm({ ...form, farmState: v })}
            options={['Benue', 'Niger', 'Nasarawa', 'Oyo', 'Ogun', 'Cross River', 'Kogi']} />
          <FormField label="LGA" value={form.farmLga} onChange={v => setForm({ ...form, farmLga: v })} placeholder="Makurdi" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hectares" value={form.farmHectares} onChange={v => setForm({ ...form, farmHectares: v })} placeholder="5" type="number" />
          <SelectField label="Variety" value={form.cassavaVariety} onChange={v => setForm({ ...form, cassavaVariety: v })}
            options={['TME 419', 'TMS 30572', 'TMS 4(2)1425', 'Local']} />
        </div>

        {gps && <GPSBadge lat={gps.lat} lng={gps.lng} />}

        <SubmitButton status={status} onClick={handleSubmit} label="Register Farmer" loadingText={['Getting GPS...', 'Saving...']} />
      </div>
    </div>
  )
}

// ── Harvest Tab ───────────────────────────────────────────────────────────

function HarvestTab({ onComplete }: { onComplete: () => void }) {
  const [phone, setPhone] = useState('')
  const [kg, setKg] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'photo' | 'saving' | 'done'>('idle')

  async function handleSubmit() {
    if (!phone || !kg) {
      alert('Farmer phone and weight are required')
      return
    }
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })

      setStatus('photo')
      const dataUrl = await capturePhoto()
      setPhoto(dataUrl)

      const farmer = await getFarmerByPhone(phone)
      if (!farmer) {
        alert('Farmer not found. Please register them first.')
        setStatus('idle')
        return
      }

      setStatus('saving')
      await logHarvest({
        farmerId: farmer.id,
        farmerPhone: phone,
        estimatedKg: parseInt(kg) || 0,
        gpsLat: pos.lat,
        gpsLng: pos.lng,
        photoDataUrl: dataUrl,
      })

      setStatus('done')
      onComplete()
      setTimeout(() => {
        setStatus('idle')
        setPhone('')
        setKg('')
        setPhoto(null)
      }, 2000)
    } catch (e) {
      alert(`Error: ${e}`)
    }
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <PageHeader icon={<IconWheat />} title="Log Harvest" subtitle="Record estimated crop yield" />

      <div className="glass p-5 space-y-4">
        <FormField label="Farmer Phone" required value={phone} onChange={setPhone} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="Estimated Weight (kg)" required value={kg} onChange={setKg} placeholder="5000" type="number" />

        {photo && <PhotoPreview src={photo} alt="Harvest" />}
        {gps && <GPSBadge lat={gps.lat} lng={gps.lng} />}

        <SubmitButton status={status} onClick={handleSubmit} label="Log Harvest"
          loadingText={['Getting GPS...', 'Take Photo...', 'Saving...']}
          extraStates={['photo']} />
      </div>
    </div>
  )
}

// ── Delivery Tab ──────────────────────────────────────────────────────────

function DeliveryTab({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    farmerPhone: '', actualKg: '', offTakerName: '', truckId: '',
  })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'photo' | 'saving' | 'done'>('idle')

  async function handleSubmit() {
    if (!form.farmerPhone || !form.actualKg) {
      alert('Farmer phone and weight are required')
      return
    }
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })

      setStatus('photo')
      const photoUrl = await capturePhoto()
      setPhoto(photoUrl)

      const farmer = await getFarmerByPhone(form.farmerPhone)
      if (!farmer) {
        alert('Farmer not found. Please register them first.')
        setStatus('idle')
        return
      }

      setStatus('saving')
      await logDelivery({
        farmerId: farmer.id,
        farmerPhone: form.farmerPhone,
        actualKg: parseInt(form.actualKg) || 0,
        offTakerName: form.offTakerName,
        truckId: form.truckId,
        gpsLat: pos.lat,
        gpsLng: pos.lng,
        photoDataUrl: photoUrl,
      })

      setStatus('done')
      onComplete()
      setTimeout(() => {
        setStatus('idle')
        setForm({ farmerPhone: '', actualKg: '', offTakerName: '', truckId: '' })
        setPhoto(null)
      }, 2000)
    } catch (e) {
      alert(`Error: ${e}`)
    }
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <PageHeader icon={<IconTruck />} title="Log Delivery" subtitle="Confirm crop delivery to off-taker" />

      <div className="glass p-5 space-y-4">
        <FormField label="Farmer Phone" required value={form.farmerPhone} onChange={v => setForm({ ...form, farmerPhone: v })} placeholder="+234 801 234 5678" type="tel" />
        <FormField label="Actual Weight (kg)" required value={form.actualKg} onChange={v => setForm({ ...form, actualKg: v })} placeholder="35000" type="number" />
        <FormField label="Off-Taker" value={form.offTakerName} onChange={v => setForm({ ...form, offTakerName: v })} placeholder="Pure Biotech" />
        <FormField label="Truck ID" value={form.truckId} onChange={v => setForm({ ...form, truckId: v })} placeholder="TRK-001" />

        {photo && <PhotoPreview src={photo} alt="Delivery" />}
        {gps && <GPSBadge lat={gps.lat} lng={gps.lng} />}

        <SubmitButton status={status} onClick={handleSubmit} label="Log Delivery"
          loadingText={['Getting GPS...', 'Take Photo...', 'Saving...']}
          extraStates={['photo']} />
      </div>
    </div>
  )
}

// ── Sync Tab ──────────────────────────────────────────────────────────────

function SyncTab({ stats, onSync, syncing }: { stats: Stats; onSync: () => void; syncing: boolean }) {
  return (
    <div className="space-y-4 animate-slide-up">
      <PageHeader icon={<IconSync />} title="Sync Data" subtitle="Upload queued records to server" />

      {/* Big pending card */}
      <div className="sync-hero">
        <div className="sync-hero-bg"></div>
        <div className="relative z-10 text-center">
          <div className="text-royal-200 text-xs uppercase tracking-wider mb-2">Pending Records</div>
          <div className="text-5xl font-extrabold text-white tracking-tight">{stats.pendingSync}</div>
          <div className="text-royal-300 text-xs mt-1">
            {stats.pendingSync === 0 ? 'All synced ✓' : 'waiting to upload'}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <SyncStat label="Farmers" value={stats.farmers} />
        <SyncStat label="Harvests" value={stats.harvests} />
        <SyncStat label="Deliveries" value={stats.deliveries} />
      </div>

      {/* Sync button */}
      <button
        onClick={onSync}
        disabled={syncing || stats.pendingSync === 0}
        className={`sync-btn ${syncing ? 'syncing' : ''} ${stats.pendingSync === 0 ? 'done' : ''}`}
      >
        {syncing ? (
          <><span className="sync-spinner"></span> Syncing...</>
        ) : stats.pendingSync === 0 ? (
          <>✓ All Caught Up</>
        ) : (
          <>Sync Now</>
        )}
      </button>

      {/* Info */}
      <div className="glass p-4">
        <div className="text-royal-200 text-xs font-semibold uppercase tracking-wider mb-2">How Sync Works</div>
        <ul className="space-y-1.5">
          {[
            'Data saved locally when offline',
            'Auto-syncs every 30 seconds online',
            'Manual sync for instant upload',
            'Failed items retry automatically',
          ].map((item, i) => (
            <li key={i} className="text-royal-300 text-xs flex items-center gap-2">
              <span className="text-emerald-400">•</span> {item}
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        .sync-hero {
          position: relative;
          border-radius: 1.25rem;
          padding: 2rem 1.5rem;
          overflow: hidden;
          border: 1px solid rgba(107, 109, 255, 0.15);
        }
        .sync-hero-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(74, 76, 255, 0.15), transparent 70%),
            rgba(24, 28, 68, 0.4);
        }
        .sync-btn {
          width: 100%;
          padding: 1rem;
          border-radius: 1rem;
          border: none;
          font-weight: 700;
          font-size: 0.9375rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
          background: linear-gradient(135deg, #34d399, #10b981);
          color: #0a0b1e;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.25);
        }
        .sync-btn:active { transform: scale(0.98); }
        .sync-btn:disabled { opacity: 0.6; }
        .sync-btn.done {
          background: rgba(24, 28, 68, 0.4);
          color: #6ee7b7;
          border: 1px solid rgba(52, 211, 153, 0.2);
          box-shadow: none;
        }
        .sync-btn.syncing {
          background: rgba(24, 28, 68, 0.4);
          color: #979fff;
          border: 1px solid rgba(107, 109, 255, 0.2);
          box-shadow: none;
        }
        .sync-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(151, 159, 255, 0.3);
          border-top-color: #6b6dff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass p-3 text-center">
      <div className="text-white font-bold text-xl">{value}</div>
      <div className="text-royal-300 text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────────────

function PageHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="page-header-icon">{icon}</div>
      <div>
        <div className="text-white font-bold text-lg leading-tight">{title}</div>
        <div className="text-royal-300 text-xs">{subtitle}</div>
      </div>
      <style jsx>{`
        .page-header-icon {
          width: 40px;
          height: 40px;
          border-radius: 0.75rem;
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(74, 76, 255, 0.1));
          border: 1px solid rgba(107, 109, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6ee7b7;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] text-royal-200 font-medium block mb-1.5">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-field"
      />
      <style jsx>{`
        .form-field {
          width: 100%;
          background: rgba(15, 16, 40, 0.6);
          border: 1px solid rgba(107, 109, 255, 0.12);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          color: white;
          transition: all 0.2s ease;
        }
        .form-field:focus {
          outline: none;
          border-color: rgba(52, 211, 153, 0.4);
          background: rgba(15, 16, 40, 0.8);
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.1);
        }
      `}</style>
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="text-[11px] text-royal-200 font-medium block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="form-field">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function GPSBadge({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="gps-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
      <style jsx>{`
        .gps-badge {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(52, 211, 153, 0.2);
          border-radius: 0.625rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: #6ee7b7;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  )
}

function PhotoPreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="photo-preview">
      <img src={src} alt={alt} />
      <div className="photo-badge">📷 Verified</div>
      <style jsx>{`
        .photo-preview {
          position: relative;
          border-radius: 0.875rem;
          overflow: hidden;
          border: 1px solid rgba(107, 109, 255, 0.15);
        }
        .photo-preview img {
          width: 100%;
          height: 160px;
          object-fit: cover;
        }
        .photo-badge {
          position: absolute;
          bottom: 0.5rem;
          right: 0.5rem;
          background: rgba(10, 11, 30, 0.8);
          backdrop-filter: blur(8px);
          color: #6ee7b7;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          border: 1px solid rgba(52, 211, 153, 0.2);
        }
      `}</style>
    </div>
  )
}

function SubmitButton({ status, onClick, label, loadingText, extraStates = [] }: {
  status: string; onClick: () => void; label: string; loadingText: string[]; extraStates?: string[]
}) {
  const loading = ['gps', 'saving', ...extraStates].includes(status)
  const statusLabels: Record<string, string> = {
    gps: loadingText[0],
    photo: loadingText[1] || 'Take Photo...',
    saving: loadingText[loadingText.length - 1],
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={loading}
        className={`submit-btn ${status === 'done' ? 'done' : ''} ${loading ? 'loading' : ''}`}
      >
        {status === 'done' ? '✓ Completed' :
         loading ? (statusLabels[status] || 'Loading...') :
         label}
      </button>
      <style jsx>{`
        .submit-btn {
          width: 100%;
          padding: 1rem;
          border-radius: 1rem;
          border: none;
          font-weight: 700;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
          background: linear-gradient(135deg, #c9a227, #d4af37);
          color: #0a0b1e;
          box-shadow: 0 4px 20px rgba(201, 162, 39, 0.2);
        }
        .submit-btn:active { transform: scale(0.98); }
        .submit-btn.loading {
          background: rgba(24, 28, 68, 0.4);
          color: #979fff;
          border: 1px solid rgba(107, 109, 255, 0.2);
          box-shadow: none;
        }
        .submit-btn.done {
          background: linear-gradient(135deg, #34d399, #10b981);
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        }
      `}</style>
    </>
  )
}

// ── Icons (Inline SVGs — crisp at any size, zero requests) ────────────────

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3v-6a1 1 0 011-1h4a1 1 0 011 1v6h3a1 1 0 001-1V10"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function IconWheat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V8"/><path d="M12 8c0-3 2-5 5-5 0 3-2 5-5 5z"/>
      <path d="M12 12c0-3 2-5 5-5 0 3-2 5-5 5z"/><path d="M12 16c0-3 2-5 5-5 0 3-2 5-5 5z"/>
      <path d="M12 8c0-3-2-5-5-5 0 3 2 5 5 5z"/><path d="M12 12c0-3-2-5-5-5 0 3 2 5 5 5z"/>
      <path d="M12 16c0-3-2-5-5-5 0 3 2 5 5 5z"/>
    </svg>
  )
}

function IconTruck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}

function IconSync() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  )
}
