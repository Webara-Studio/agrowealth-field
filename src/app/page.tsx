'use client'

import { useEffect, useState } from 'react'
import { getLocalStats, registerFarmer, logHarvest, logDelivery } from '@/lib/db'
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

    const handleOnline = () => setOnline(true)
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

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="header-bar">
          <div className="flex items-center gap-2">
            <div className="logo-icon">A</div>
            <span className="font-semibold text-white text-sm">Agrowealth Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${online ? 'status-online' : 'status-offline'}`}></span>
            <span className="text-xs text-royal-200">{online ? 'Online' : 'Offline'}</span>
            {stats.pendingSync > 0 && (
              <span className="pending-badge">{stats.pendingSync} pending</span>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20">
          {tab === 'dashboard' && <DashboardTab stats={stats} />}
          {tab === 'farmers' && <FarmersTab onComplete={loadStats} />}
          {tab === 'harvest' && <HarvestTab onComplete={loadStats} />}
          {tab === 'delivery' && <DeliveryTab onComplete={loadStats} />}
          {tab === 'sync' && <SyncTab stats={stats} onSync={handleSync} syncing={syncing} />}
        </main>

        {/* Bottom Nav */}
        <nav className="bottom-nav">
          {([
            { id: 'dashboard', label: 'Home', icon: '◉' },
            { id: 'farmers', label: 'Farmers', icon: '◈' },
            { id: 'harvest', label: 'Harvest', icon: '◊' },
            { id: 'delivery', label: 'Delivery', icon: '◇' },
            { id: 'sync', label: 'Sync', icon: '◎' },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`nav-btn ${tab === item.id ? 'nav-active' : ''}`}
            >
              <div className="text-lg">{item.icon}</div>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <style jsx>{`
        .header-bar {
          background-color: #181c44;
          border-bottom: 1px solid rgba(42, 42, 120, 0.3);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .logo-icon {
          width: 1.75rem;
          height: 1.75rem;
          background-color: #c9a227;
          border-radius: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0f1028;
          font-weight: 700;
          font-size: 0.75rem;
        }
        .status-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 9999px;
        }
        .status-online { background-color: #4ade80; }
        .status-offline { background-color: #facc15; }
        .pending-badge {
          background-color: rgba(113, 63, 18, 0.4);
          color: #facc15;
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background-color: #181c44;
          border-top: 1px solid rgba(42, 42, 120, 0.3);
          display: flex;
        }
        .nav-btn {
          flex: 1;
          padding: 0.75rem;
          text-align: center;
          font-size: 0.75rem;
          color: #979fff;
          background: none;
          border: none;
          cursor: pointer;
        }
        .nav-active {
          color: #d4af37;
          background-color: rgba(30, 30, 90, 0.5);
        }
      `}</style>
    </>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────

function DashboardTab({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Farmers" value={stats.farmers.toString()} />
        <StatCard label="Harvests" value={stats.harvests.toString()} />
        <StatCard label="Deliveries" value={stats.deliveries.toString()} />
        <StatCard label="Pending Sync" value={stats.pendingSync.toString()} />
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-royal-200 mb-2">Volume Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-royal-300">Harvested</span>
            <span className="text-white font-medium">{stats.totalHarvestKg.toLocaleString()} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-royal-300">Delivered</span>
            <span className="text-white font-medium">{stats.totalDeliveryKg.toLocaleString()} kg</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-royal-200 mb-2">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction emoji="👤" label="Register" />
          <QuickAction emoji="🌾" label="Harvest" />
          <QuickAction emoji="🚛" label="Deliver" />
        </div>
      </div>

      <style jsx>{`
        .card {
          background-color: rgba(24, 28, 68, 0.6);
          border: 1px solid rgba(42, 42, 120, 0.3);
          border-radius: 0.75rem;
          padding: 1.25rem;
        }
      `}</style>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <style jsx>{`
        .stat-card {
          background-color: rgba(24, 28, 68, 0.6);
          border: 1px solid rgba(42, 42, 120, 0.3);
          border-radius: 0.75rem;
          padding: 1rem;
        }
        .stat-label {
          font-size: 0.75rem;
          color: #979fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  )
}

function QuickAction({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="quick-action">
      <div className="text-2xl">{emoji}</div>
      <div className="text-xs text-royal-200 mt-1">{label}</div>
      <style jsx>{`
        .quick-action {
          background-color: rgba(30, 30, 90, 0.5);
          border: 1px solid rgba(42, 42, 120, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem;
          text-align: center;
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
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Register Farmer</h1>

      <div className="space-y-3">
        <Field label="Phone Number *" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+234XXXXXXXXXX" />
        <Field label="BVN" value={form.bvn} onChange={v => setForm({ ...form, bvn: v })} placeholder="12345678901" />
        <Field label="Full Name *" value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} placeholder="John Doe" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-royal-300 block mb-1">State</label>
            <select
              value={form.farmState}
              onChange={e => setForm({ ...form, farmState: e.target.value })}
              className="form-input"
            >
              <option value="Benue">Benue</option>
              <option value="Niger">Niger</option>
              <option value="Nasarawa">Nasarawa</option>
              <option value="Oyo">Oyo</option>
              <option value="Ogun">Ogun</option>
            </select>
          </div>
          <Field label="LGA" value={form.farmLga} onChange={v => setForm({ ...form, farmLga: v })} placeholder="Makurdi" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hectares" value={form.farmHectares} onChange={v => setForm({ ...form, farmHectares: v })} placeholder="5" />
          <div>
            <label className="text-xs text-royal-300 block mb-1">Cassava Variety</label>
            <select
              value={form.cassavaVariety}
              onChange={e => setForm({ ...form, cassavaVariety: e.target.value })}
              className="form-input"
            >
              <option value="TME 419">TME 419</option>
              <option value="TMS 30572">TMS 30572</option>
              <option value="TMS 4(2)1425">TMS 4(2)1425</option>
              <option value="Local">Local</option>
            </select>
          </div>
        </div>

        {gps && (
          <div className="gps-badge">
            GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'gps' || status === 'saving'}
          className={`btn-gold ${status === 'gps' || status === 'saving' ? 'opacity-50' : ''}`}
        >
          {status === 'gps' ? 'Getting GPS...' :
           status === 'saving' ? 'Saving...' :
           status === 'done' ? '✓ Registered!' :
           'Register Farmer'}
        </button>
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          background-color: #1e1e5a;
          border: 1px solid rgba(42, 42, 120, 0.5);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: white;
        }
        .gps-badge {
          background-color: rgba(20, 83, 45, 0.2);
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem;
          font-size: 0.75rem;
          color: #86efac;
        }
        .btn-gold {
          width: 100%;
          background-color: #c9a227;
          color: #0f1028;
          font-weight: 600;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-gold:hover { background-color: #d4af37; }
      `}</style>
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
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })

      setStatus('photo')
      const dataUrl = await capturePhoto()
      setPhoto(dataUrl)

      setStatus('saving')
      await logHarvest({
        farmerId: '',
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
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Log Harvest</h1>

      <Field label="Farmer Phone *" value={phone} onChange={setPhone} placeholder="+234XXXXXXXXXX" />
      <Field label="Estimated Weight (kg) *" value={kg} onChange={setKg} placeholder="5000" />

      {photo && (
        <div className="rounded-lg overflow-hidden bg-royal-800">
          <img src={photo} alt="Harvest" className="w-full h-40 object-cover" />
        </div>
      )}

      {gps && (
        <div className="gps-badge">
          GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={status === 'gps' || status === 'photo' || status === 'saving'}
        className={`btn-gold ${(status === 'gps' || status === 'photo' || status === 'saving') ? 'opacity-50' : ''}`}
      >
        {status === 'gps' ? 'Getting GPS...' :
         status === 'photo' ? 'Take Photo...' :
         status === 'saving' ? 'Saving...' :
         status === 'done' ? '✓ Logged!' :
         'Log Harvest'}
      </button>

      <style jsx>{`
        .gps-badge {
          background-color: rgba(20, 83, 45, 0.2);
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem;
          font-size: 0.75rem;
          color: #86efac;
        }
        .btn-gold {
          width: 100%;
          background-color: #c9a227;
          color: #0f1028;
          font-weight: 600;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

// ── Delivery Tab ──────────────────────────────────────────────────────────

function DeliveryTab({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    farmerPhone: '', actualKg: '', offTakerName: '', truckId: '',
  })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'gps' | 'saving' | 'done'>('idle')

  async function handleSubmit() {
    setStatus('gps')
    try {
      const pos = await getCurrentPosition()
      setGps({ lat: pos.lat, lng: pos.lng })

      setStatus('saving')
      await logDelivery({
        farmerId: '',
        farmerPhone: form.farmerPhone,
        actualKg: parseInt(form.actualKg) || 0,
        offTakerName: form.offTakerName,
        truckId: form.truckId,
        gpsLat: pos.lat,
        gpsLng: pos.lng,
        photoDataUrl: '',
      })

      setStatus('done')
      onComplete()
      setTimeout(() => {
        setStatus('idle')
        setForm({ farmerPhone: '', actualKg: '', offTakerName: '', truckId: '' })
      }, 2000)
    } catch (e) {
      alert(`Error: ${e}`)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Log Delivery</h1>

      <Field label="Farmer Phone *" value={form.farmerPhone} onChange={v => setForm({ ...form, farmerPhone: v })} placeholder="+234XXXXXXXXXX" />
      <Field label="Actual Weight (kg) *" value={form.actualKg} onChange={v => setForm({ ...form, actualKg: v })} placeholder="35000" />
      <Field label="Off-Taker *" value={form.offTakerName} onChange={v => setForm({ ...form, offTakerName: v })} placeholder="Pure Biotech" />
      <Field label="Truck ID *" value={form.truckId} onChange={v => setForm({ ...form, truckId: v })} placeholder="TRK-001" />

      {gps && (
        <div className="gps-badge">
          GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={status === 'gps' || status === 'saving'}
        className={`btn-gold ${status === 'gps' || status === 'saving' ? 'opacity-50' : ''}`}
      >
        {status === 'gps' ? 'Getting GPS...' :
         status === 'saving' ? 'Saving...' :
         status === 'done' ? '✓ Delivered!' :
         'Log Delivery'}
      </button>

      <style jsx>{`
        .gps-badge {
          background-color: rgba(20, 83, 45, 0.2);
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem;
          font-size: 0.75rem;
          color: #86efac;
        }
        .btn-gold {
          width: 100%;
          background-color: #c9a227;
          color: #0f1028;
          font-weight: 600;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

// ── Sync Tab ──────────────────────────────────────────────────────────────

function SyncTab({ stats, onSync, syncing }: { stats: Stats; onSync: () => void; syncing: boolean }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Sync Data</h1>

      <div className="card space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-royal-300">Pending Items</span>
          <span className="text-yellow-400 font-medium">{stats.pendingSync}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-royal-300">Total Farmers</span>
          <span className="text-white font-medium">{stats.farmers}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-royal-300">Total Harvests</span>
          <span className="text-white font-medium">{stats.harvests}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-royal-300">Total Deliveries</span>
          <span className="text-white font-medium">{stats.deliveries}</span>
        </div>
      </div>

      <button
        onClick={onSync}
        disabled={syncing || stats.pendingSync === 0}
        className={`btn-primary ${syncing || stats.pendingSync === 0 ? 'opacity-50' : ''}`}
      >
        {syncing ? 'Syncing...' : `Sync Now (${stats.pendingSync} items)`}
      </button>

      <div className="card">
        <h3 className="text-sm font-medium text-royal-200 mb-2">How Sync Works</h3>
        <ul className="text-xs text-royal-300 space-y-1">
          <li>• Data is saved locally when offline</li>
          <li>• Auto-syncs every 30 seconds when online</li>
          <li>• Manual sync button for immediate upload</li>
          <li>• Failed items retry automatically</li>
        </ul>
      </div>

      <style jsx>{`
        .card {
          background-color: rgba(24, 28, 68, 0.6);
          border: 1px solid rgba(42, 42, 120, 0.3);
          border-radius: 0.75rem;
          padding: 1.25rem;
        }
        .btn-primary {
          width: 100%;
          background-color: #323395;
          color: white;
          font-weight: 600;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover { background-color: #4a4cff; }
      `}</style>
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-royal-300 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input"
      />
      <style jsx>{`
        .form-input {
          width: 100%;
          background-color: #1e1e5a;
          border: 1px solid rgba(42, 42, 120, 0.5);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: white;
        }
        .form-input:focus {
          outline: none;
          border-color: #4a4cff;
        }
      `}</style>
    </div>
  )
}
