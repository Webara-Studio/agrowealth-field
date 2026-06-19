'use client'

import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react'
import {
  getCycleStats, type CycleStats,
  registerFarmer, getFarmerByPhone, getAllFarmers, type Farmer,
  logPurchase, getAvailablePurchases, type Purchase,
  createDispatch, getDispatchesByStatus, type Dispatch,
  logDelivery, type Delivery,
  getPendingSyncCount,
} from '@/lib/db'
import { getCurrentPosition, capturePhoto, type GPSPosition } from '@/lib/gps'
import { setupAutoSync, syncAll } from '@/lib/sync'

type Tab = 'dashboard' | 'buy' | 'dispatch' | 'deliver' | 'farmers'

// ── Formatters ────────────────────────────────────────────────────────────

const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`)
const fmtNaira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const fmtNairaShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `₦${Math.round(n / 1000)}K`
  return `₦${Math.round(n)}`
}
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Icons ──────────────────────────────────────────────────────────────────

const iconStyle: CSSProperties = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

const Icons = {
  home: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
  ),
  naira: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M7 4v16M17 4v16M7 8h10M7 14h10" /></svg>
  ),
  truck: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><rect x="1" y="5" width="13" height="11" rx="1" /><path d="M14 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" /></svg>
  ),
  box: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" /><path d="M1 4h22v4H1z" /><path d="M10 12h4" /></svg>
  ),
  users: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  pin: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
  ),
  check: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><polyline points="20 6 9 17 4 12" /></svg>
  ),
  alert: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  refresh: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
  ),
  plus: (s: CSSProperties) => (
    <svg viewBox="0 0 24 24" style={{ ...iconStyle, ...s }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
}

// ── Shared UI Components ───────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-[#979fff]/50 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function FormField({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#979fff]/60 mb-1.5 block uppercase tracking-wider">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      <input className="form-field" {...props} />
    </div>
  )
}

function FormSelect({ label, required, children, ...props }: { label: string; required?: boolean; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#979fff]/60 mb-1.5 block uppercase tracking-wider">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      <select className="form-field" {...props}>{children}</select>
    </div>
  )
}

function GpsBadge({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="gps-badge">
      <span style={{ width: 14, height: 14 }}>{Icons.pin({ width: 14, height: 14 })}</span>
      <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
    </div>
  )
}

function PhotoPreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="photo-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <div className="photo-badge">✓ Captured</div>
    </div>
  )
}

function SubmitBtn({ status, label, onClick, loadingStates }: {
  status: string
  label: string
  onClick: () => void
  loadingStates: Record<string, string>
}) {
  const isLoading = ['gps', 'photo', 'saving'].includes(status)
  const isDone = status === 'done'
  return (
    <button
      className={`btn-submit ${isLoading ? 'btn-submit-loading' : ''} ${isDone ? 'btn-submit-done' : ''}`}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <><span className="spinner" />{loadingStates[status] || 'Processing...'}</>
      ) : isDone ? (
        <><span style={{ width: 18, height: 18, display: 'inline-flex' }}>{Icons.check({ width: 18, height: 18 })}</span>Done!</>
      ) : (
        label
      )}
    </button>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#979fff]/50">{label}</span>
      <span className={`text-sm font-bold ${color || 'text-white'}`}>{value}</span>
    </div>
  )
}

// ── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ stats, onNavigate, onSync, syncPending }: {
  stats: CycleStats | null
  onNavigate: (t: Tab) => void
  onSync: () => void
  syncPending: number
}) {
  if (!stats) return null
  const lossHigh = stats.weightLossPct > 15 && stats.totalDeliveredKg > 0
  const hasData = stats.purchaseCount > 0

  return (
    <div className="space-y-4">
      {/* Hero: Trade Cycle */}
      <div className="card-hero p-5 relative">
        <div className="orb-deco" style={{ width: 120, height: 120, background: 'rgba(52, 211, 153, 0.12)', top: -30, right: -20 }} />
        <div className="relative">
          <p className="text-xs font-bold text-emerald-300/60 uppercase tracking-widest mb-1">Trade Cycle</p>
          <div className="flex items-end gap-2 mb-1">
            <span className="text-4xl font-extrabold text-white">{fmtKg(stats.totalBoughtKg)}</span>
            <span className="text-sm text-[#979fff]/50 mb-1.5">bought from farmers</span>
          </div>

          {hasData && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#979fff]/50">Delivered to off-takers</span>
                <span className={lossHigh ? 'text-orange-400 font-bold' : 'text-emerald-300 font-bold'}>
                  {fmtKg(stats.totalDeliveredKg)}
                  {stats.totalDeliveredKg > 0 && `  (−${stats.weightLossPct.toFixed(1)}%)`}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{
                  width: `${stats.totalBoughtKg > 0 ? (stats.totalDeliveredKg / stats.totalBoughtKg) * 100 : 0}%`,
                  background: lossHigh
                    ? 'linear-gradient(90deg, #f97316, #e8c84e)'
                    : undefined,
                }} />
              </div>
              {lossHigh && (
                <div className="flex items-center gap-1.5 text-xs text-orange-400">
                  <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{Icons.alert({ width: 12, height: 12 })}</span>
                  <span>High weight loss — check spoilage or theft</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty State Guidance */}
      {!hasData && (
        <div className="card-glass p-5 text-center">
          <p className="text-sm text-[#979fff]/50 mb-3">No purchases logged yet</p>
          <button className="btn-submit" style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }} onClick={() => onNavigate('buy')}>
            Log Your First Purchase
          </button>
        </div>
      )}

      {/* Next Step Guidance */}
      {hasData && stats.activeDispatches === 0 && stats.deliveryCount === 0 && (
        <div className="card-glass p-4 flex items-center gap-3 border-emerald-500/20">
          <div className="action-icon action-icon-gold flex-shrink-0">
            <span style={{ display: 'flex' }}>{Icons.truck({ width: 20, height: 20 })}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Ready to dispatch</p>
            <p className="text-xs text-[#979fff]/50">Load cassava onto a truck and send to an off-taker</p>
          </div>
          <button className="text-xs font-bold text-gold-300" onClick={() => onNavigate('dispatch')}>Go →</button>
        </div>
      )}
      {stats.activeDispatches > 0 && (
        <div className="card-glass p-4 flex items-center gap-3">
          <div className="action-icon action-icon-blue flex-shrink-0">
            <span style={{ display: 'flex' }}>{Icons.box({ width: 20, height: 20 })}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{stats.activeDispatches} truck{stats.activeDispatches > 1 ? 's' : ''} in transit</p>
            <p className="text-xs text-[#979fff]/50">Log delivery when off-taker confirms receipt</p>
          </div>
          <button className="text-xs font-bold text-royal-300" onClick={() => onNavigate('deliver')}>Go →</button>
        </div>
      )}

      {/* Financial Breakdown */}
      {stats.totalBoughtCost > 0 && (
        <div className="card-glass p-5 space-y-3">
          <p className="text-xs font-bold text-[#979fff]/50 uppercase tracking-widest">Financials (All-Time)</p>
          <Row label="Buy Cost" value={fmtNairaShort(stats.totalBoughtCost)} />
          <Row label="Revenue (delivered)" value={fmtNairaShort(stats.totalRevenue)} color="text-emerald-300" />
          <Row label="Logistics (est. 15%)" value={`−${fmtNairaShort(stats.estLogistics)}`} color="text-orange-400" />
          <div className="h-px bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-white">Est. Net Profit</span>
            <span className={`text-xl font-extrabold ${stats.estProfit > 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {fmtNairaShort(stats.estProfit)}
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button className="action-card action-card-emerald" onClick={() => onNavigate('buy')}>
          <div className="action-icon action-icon-emerald mb-2">
            <span style={{ display: 'flex' }}>{Icons.naira({ width: 22, height: 22 })}</span>
          </div>
          <span className="text-xs font-semibold text-emerald-300">Buy</span>
        </button>
        <button className="action-card action-card-gold" onClick={() => onNavigate('dispatch')}>
          <div className="action-icon action-icon-gold mb-2">
            <span style={{ display: 'flex' }}>{Icons.truck({ width: 22, height: 22 })}</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#e8c84e' }}>Dispatch</span>
        </button>
        <button className="action-card action-card-blue" onClick={() => onNavigate('deliver')}>
          <div className="action-icon action-icon-blue mb-2">
            <span style={{ display: 'flex' }}>{Icons.box({ width: 22, height: 22 })}</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#979fff' }}>Deliver</span>
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
            <span style={{ display: 'flex' }}>{Icons.users({ width: 16, height: 16 })}</span>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white leading-none">{stats.farmerCount}</p>
            <p className="text-[10px] text-[#979fff]/40 font-semibold uppercase tracking-wider mt-0.5">Farmers</p>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(212,175,55,0.15)', color: '#e8c84e' }}>
            <span style={{ display: 'flex' }}>{Icons.naira({ width: 16, height: 16 })}</span>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white leading-none">{stats.purchaseCount}</p>
            <p className="text-[10px] text-[#979fff]/40 font-semibold uppercase tracking-wider mt-0.5">Buys</p>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(107,109,255,0.15)', color: '#818cf8' }}>
            <span style={{ display: 'flex' }}>{Icons.box({ width: 16, height: 16 })}</span>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white leading-none">{stats.deliveryCount}</p>
            <p className="text-[10px] text-[#979fff]/40 font-semibold uppercase tracking-wider mt-0.5">Deliveries</p>
          </div>
        </div>
      </div>

      {/* Sync */}
      {syncPending > 0 && (
        <button className="btn-sync" onClick={onSync}>
          <span className="spinner" /> Sync {syncPending} pending record{syncPending > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

// ── Buy Tab (Purchase cassava from farmer) ────────────────────────────────

function BuyTab({ onComplete }: { onComplete: () => void }) {
  const [phone, setPhone] = useState('')
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [weight, setWeight] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [gps, setGps] = useState<GPSPosition | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')

  const total = (parseFloat(weight) || 0) * (parseFloat(pricePerKg) || 0)

  async function lookupFarmer(p: string) {
    setPhone(p)
    if (p.replace(/\s/g, '').length >= 10) {
      const f = await getFarmerByPhone(p.replace(/\s/g, ''))
      setFarmer(f || null)
      setLookupDone(true)
    } else {
      setFarmer(null)
      setLookupDone(false)
    }
  }

  async function submit() {
    if (!farmer) return alert('Farmer not found. Register them in the Farmers tab first.')
    if (!weight || !pricePerKg) return alert('Weight and price per kg are required')
    try {
      setStatus('gps')
      let pos: GPSPosition | null = null
      try { pos = await getCurrentPosition(); setGps(pos) } catch { /* best-effort */ }

      setStatus('photo')
      let photoUrl: string | null = null
      try { photoUrl = await capturePhoto(); setPhoto(photoUrl) } catch { /* best-effort */ }

      setStatus('saving')
      await logPurchase({
        farmerId: farmer.id,
        farmerName: farmer.fullName,
        farmerPhone: farmer.phone,
        weightKg: parseFloat(weight),
        pricePerKg: parseFloat(pricePerKg),
        gpsLat: pos?.lat ?? 0,
        gpsLng: pos?.lng ?? 0,
        photoDataUrl: photoUrl ?? undefined,
        agentName: 'Field Agent',
      })
      setStatus('done')
      setTimeout(() => {
        onComplete()
        setPhone(''); setFarmer(null); setLookupDone(false)
        setWeight(''); setPricePerKg(''); setGps(null); setPhoto(null)
        setStatus('idle')
      }, 1500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to log purchase')
      setStatus('idle')
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Buy Cassava" subtitle="Purchase from a registered farmer" />

      <div className="card-glass p-5 space-y-4">
        <FormField label="Farmer Phone" required value={phone}
          onChange={(e) => lookupFarmer(e.target.value)} placeholder="0803 123 4567" type="tel" />

        {lookupDone && farmer && (
          <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm font-semibold text-emerald-300">{farmer.fullName}</p>
            <p className="text-xs text-[#979fff]/50">{farmer.farmState} · {farmer.farmLga} · {farmer.farmHectares}ha · {farmer.cassavaVariety}</p>
          </div>
        )}
        {lookupDone && !farmer && (
          <div className="rounded-xl p-3 bg-orange-500/10 border border-orange-500/20">
            <p className="text-sm font-semibold text-orange-400">Farmer not registered</p>
            <p className="text-xs text-[#979fff]/40">Register them in the Farmers tab first</p>
          </div>
        )}

        {farmer && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Weight (kg)" required value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="5000" type="number" />
              <FormField label="₦ per kg" required value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder="120" type="number" />
            </div>
            {total > 0 && (
              <div className="flex justify-between items-center p-3 rounded-xl border" style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(232,200,78,0.7)' }}>Total Cost</span>
                <span className="text-lg font-extrabold" style={{ color: '#e8c84e' }}>{fmtNaira(total)}</span>
              </div>
            )}
            {photo && <PhotoPreview src={photo} alt="Cassava purchased" />}
            {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}
            <SubmitBtn status={status} label="Log Purchase" onClick={submit}
              loadingStates={{ gps: 'Getting GPS...', photo: 'Capture Photo...', saving: 'Saving...' }} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Dispatch Tab (Load truck, send to off-taker) ──────────────────────────

function DispatchTab({ onComplete }: { onComplete: () => void }) {
  const [available, setAvailable] = useState<Purchase[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [truckId, setTruckId] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [offTakerName, setOffTakerName] = useState('')
  const [destination, setDestination] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => { refreshAvailable() }, [])
  async function refreshAvailable() { setAvailable(await getAvailablePurchases()) }

  const selectedPurchases = available.filter((p) => selected.has(p.id))
  const totalWeight = selectedPurchases.reduce((s, p) => s + p.weightKg, 0)
  const totalCost = selectedPurchases.reduce((s, p) => s + p.totalAmount, 0)

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function submit() {
    if (selectedPurchases.length === 0) return alert('Select at least one purchase to load')
    if (!truckId || !driverName || !offTakerName) return alert('Truck ID, driver name, and off-taker name are required')
    try {
      setStatus('saving')
      await createDispatch({
        truckId, driverName, driverPhone,
        offTakerName, destination,
        totalWeightKg: totalWeight,
        purchaseIds: selectedPurchases.map((p) => p.id),
      })
      setStatus('done')
      setTimeout(() => {
        onComplete()
        setSelected(new Set())
        setTruckId(''); setDriverName(''); setDriverPhone('')
        setOffTakerName(''); setDestination('')
        setStatus('idle')
        refreshAvailable()
      }, 1500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create dispatch')
      setStatus('idle')
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Dispatch Truck" subtitle="Load cassava and send to an off-taker" />

      {available.length === 0 ? (
        <div className="card-glass p-5 text-center">
          <p className="text-sm text-[#979fff]/50">No cassava available to dispatch</p>
          <p className="text-xs text-[#979fff]/30 mt-1">Log purchases in the Buy tab first</p>
        </div>
      ) : (
        <>
          {/* Available Purchases */}
          <div className="card-glass p-4">
            <p className="text-xs font-bold text-[#979fff]/50 uppercase tracking-widest mb-3">
              Available Purchases ({available.length})
            </p>
            <div className="space-y-2">
              {available.map((p) => {
                const isSel = selected.has(p.id)
                return (
                  <button key={p.id} onClick={() => toggle(p.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                    style={{
                      background: isSel ? 'rgba(52,211,153,0.08)' : 'rgba(10,14,36,0.5)',
                      borderColor: isSel ? 'rgba(52,211,153,0.3)' : 'rgba(107,109,255,0.08)',
                    }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"
                      style={{
                        background: isSel ? '#34d399' : 'transparent',
                        borderColor: isSel ? '#34d399' : 'rgba(107,109,255,0.3)',
                      }}>
                      {isSel && <span style={{ display: 'flex', color: '#060818' }}>{Icons.check({ width: 14, height: 14 })}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.farmerName}</p>
                      <p className="text-xs text-[#979fff]/40">{fmtKg(p.weightKg)} · {fmtNaira(p.totalAmount)} · {timeAgo(p.createdAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Summary */}
          {selectedPurchases.length > 0 && (
            <div className="card-glass p-4 space-y-2">
              <Row label="Selected" value={`${selectedPurchases.length} purchase${selectedPurchases.length > 1 ? 's' : ''}`} />
              <Row label="Total Weight" value={fmtKg(totalWeight)} color="text-emerald-300" />
              <Row label="Total Buy Cost" value={fmtNairaShort(totalCost)} color="text-gold-300" />
            </div>
          )}

          {/* Truck Details */}
          <div className="card-glass p-5 space-y-4">
            <p className="text-xs font-bold text-[#979fff]/50 uppercase tracking-widest">Truck Details</p>
            <FormField label="Truck ID / Plate Number" required value={truckId} onChange={(e) => setTruckId(e.target.value)} placeholder="TRK-001 or ABC-123XY" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Driver Name" required value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="John Doe" />
              <FormField label="Driver Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="0803..." type="tel" />
            </div>
            <FormField label="Off-Taker (Processing Company)" required value={offTakerName} onChange={(e) => setOffTakerName(e.target.value)} placeholder="e.g. Psaltry International" />
            <FormField label="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Makurdi, Benue" />
          </div>

          <SubmitBtn status={status} label="Dispatch Truck" onClick={submit}
            loadingStates={{ saving: 'Creating dispatch...' }} />
        </>
      )}
    </div>
  )
}

// ── Deliver Tab (Off-taker confirms receipt) ──────────────────────────────

function DeliverTab({ onComplete }: { onComplete: () => void }) {
  const [transit, setTransit] = useState<Dispatch[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [receivedKg, setReceivedKg] = useState('')
  const [accepted, setAccepted] = useState(true)
  const [rejectionReason, setRejectionReason] = useState('')
  const [offTakerRep, setOffTakerRep] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [gps, setGps] = useState<GPSPosition | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')

  useEffect(() => { refreshTransit() }, [])
  async function refreshTransit() {
    const t = await getDispatchesByStatus('in_transit')
    setTransit(t)
  }

  const selectedDispatch = transit.find((d) => d.id === selectedId)
  const revenue = (parseFloat(receivedKg) || 0) * (parseFloat(sellPrice) || 0)
  const weightDiff = selectedDispatch ? parseFloat(receivedKg) - selectedDispatch.totalWeightKg : 0
  const weightDiffPct = selectedDispatch && selectedDispatch.totalWeightKg > 0
    ? (Math.abs(weightDiff) / selectedDispatch.totalWeightKg) * 100 : 0

  async function submit() {
    if (!selectedDispatch) return alert('Select a truck')
    if (!receivedKg) return alert('Enter received weight')
    if (!offTakerRep) return alert('Enter off-taker representative name')
    if (!sellPrice) return alert('Enter sell price per kg')
    if (!accepted && !rejectionReason) return alert('Enter rejection reason')
    try {
      setStatus('gps')
      let pos: GPSPosition | null = null
      try { pos = await getCurrentPosition(); setGps(pos) } catch { /* best-effort */ }

      setStatus('photo')
      let photoUrl: string | null = null
      try { photoUrl = await capturePhoto(); setPhoto(photoUrl) } catch { /* best-effort */ }

      setStatus('saving')
      await logDelivery({
        dispatchId: selectedDispatch.id,
        truckId: selectedDispatch.truckId,
        receivedWeightKg: parseFloat(receivedKg),
        accepted,
        rejectionReason: !accepted ? rejectionReason : undefined,
        offTakerRep,
        sellPricePerKg: parseFloat(sellPrice),
        gpsLat: pos?.lat ?? 0,
        gpsLng: pos?.lng ?? 0,
        photoDataUrl: photoUrl ?? undefined,
      })
      setStatus('done')
      setTimeout(() => {
        onComplete()
        setSelectedId(''); setReceivedKg(''); setAccepted(true)
        setRejectionReason(''); setOffTakerRep(''); setSellPrice('')
        setGps(null); setPhoto(null)
        setStatus('idle')
        refreshTransit()
      }, 1500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to log delivery')
      setStatus('idle')
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Confirm Delivery" subtitle="Off-taker confirms receipt of cassava" />

      {transit.length === 0 ? (
        <div className="card-glass p-5 text-center">
          <p className="text-sm text-[#979fff]/50">No trucks in transit</p>
          <p className="text-xs text-[#979fff]/30 mt-1">Dispatch a truck first to confirm delivery</p>
        </div>
      ) : (
        <>
          {/* Select Truck */}
          <div className="card-glass p-5 space-y-4">
            <FormSelect label="Select Truck" required value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">— Choose a truck in transit —</option>
              {transit.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.truckId} · {fmtKg(d.totalWeightKg)} · → {d.offTakerName}
                </option>
              ))}
            </FormSelect>

            {selectedDispatch && (
              <div className="rounded-xl p-3 border space-y-1.5" style={{ background: 'rgba(10,14,36,0.5)', borderColor: 'rgba(107,109,255,0.1)' }}>
                <Row label="Dispatched Weight" value={fmtKg(selectedDispatch.totalWeightKg)} color="text-emerald-300" />
                <Row label="Off-Taker" value={selectedDispatch.offTakerName} />
                <Row label="Driver" value={`${selectedDispatch.driverName} · ${selectedDispatch.driverPhone || 'N/A'}`} />
                <Row label="Destination" value={selectedDispatch.destination || 'N/A'} />
              </div>
            )}
          </div>

          {selectedDispatch && (
            <>
              {/* Receipt Details */}
              <div className="card-glass p-5 space-y-4">
                <p className="text-xs font-bold text-[#979fff]/50 uppercase tracking-widest">Off-Taker Receipt</p>
                <FormField label="Received Weight (kg)" required value={receivedKg} onChange={(e) => setReceivedKg(e.target.value)} placeholder={String(selectedDispatch.totalWeightKg)} type="number" />

                {receivedKg && weightDiffPct > 5 && (
                  <div className="rounded-xl p-3 border" style={{ background: weightDiffPct > 15 ? 'rgba(249,115,22,0.08)' : 'rgba(212,175,55,0.08)', borderColor: weightDiffPct > 15 ? 'rgba(249,115,22,0.2)' : 'rgba(212,175,55,0.2)' }}>
                    <p className="text-xs font-semibold" style={{ color: weightDiffPct > 15 ? '#f97316' : '#e8c84e' }}>
                      {weightDiff < 0 ? '⚠' : 'ℹ'} Weight difference: {weightDiff > 0 ? '+' : ''}{fmtKg(weightDiff)} ({weightDiffPct.toFixed(1)}%)
                    </p>
                    <p className="text-xs text-[#979fff]/40 mt-0.5">
                      {weightDiff < 0 ? 'Shortfall — possible moisture loss, spoilage, or dispute' : 'Overweight — verify scale accuracy'}
                    </p>
                  </div>
                )}

                {/* Accept / Reject */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAccepted(true)}
                    className="p-3 rounded-xl font-semibold text-sm transition-all border-2"
                    style={{
                      background: accepted ? 'rgba(52,211,153,0.15)' : 'rgba(10,14,36,0.5)',
                      borderColor: accepted ? 'rgba(52,211,153,0.4)' : 'rgba(107,109,255,0.1)',
                      color: accepted ? '#34d399' : 'rgba(151,159,255,0.4)',
                    }}>
                    ✓ Accepted
                  </button>
                  <button onClick={() => setAccepted(false)}
                    className="p-3 rounded-xl font-semibold text-sm transition-all border-2"
                    style={{
                      background: !accepted ? 'rgba(249,115,22,0.15)' : 'rgba(10,14,36,0.5)',
                      borderColor: !accepted ? 'rgba(249,115,22,0.4)' : 'rgba(107,109,255,0.1)',
                      color: !accepted ? '#f97316' : 'rgba(151,159,255,0.4)',
                    }}>
                    ✗ Rejected
                  </button>
                </div>

                {!accepted && (
                  <FormField label="Rejection Reason" required value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Quality below standard" />
                )}

                {accepted && (
                  <>
                    <FormField label="Off-Taker Representative" required value={offTakerRep} onChange={(e) => setOffTakerRep(e.target.value)} placeholder="Name of person who signed off" />
                    <FormField label="Sell Price (₦ per kg)" required value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="150" type="number" />
                    {revenue > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-xl border" style={{ background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)' }}>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300/70">Total Revenue</span>
                        <span className="text-lg font-extrabold text-emerald-300">{fmtNaira(revenue)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {photo && <PhotoPreview src={photo} alt="Delivery receipt" />}
              {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}

              <SubmitBtn status={status} label={accepted ? 'Confirm Delivery' : 'Log Rejection'} onClick={submit}
                loadingStates={{ gps: 'Getting GPS...', photo: 'Capture Photo...', saving: 'Saving...' }} />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Farmers Tab (Register & browse suppliers) ─────────────────────────────

function FarmersTab() {
  const [showForm, setShowForm] = useState(false)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ fullName: '', phone: '', farmState: 'Benue', farmLga: '', farmHectares: '', cassavaVariety: 'TME419' })
  const [gps, setGps] = useState<GPSPosition | null>(null)
  const [status, setStatus] = useState('idle')

  const refresh = useCallback(async () => { setFarmers(await getAllFarmers()) }, [])
  useEffect(() => { refresh() }, [refresh])

  const filtered = farmers.filter(f =>
    f.fullName.toLowerCase().includes(search.toLowerCase()) ||
    f.phone.includes(search) ||
    f.farmState.toLowerCase().includes(search.toLowerCase())
  )

  async function submit() {
    if (!form.fullName || !form.phone) return alert('Name and phone are required')
    try {
      setStatus('gps')
      let pos: GPSPosition | null = null
      try { pos = await getCurrentPosition(); setGps(pos) } catch { /* best-effort */ }

      setStatus('saving')
      await registerFarmer({
        fullName: form.fullName,
        phone: form.phone.replace(/\s/g, ''),
        farmState: form.farmState,
        farmLga: form.farmLga,
        gpsLat: pos?.lat ?? 0,
        gpsLng: pos?.lng ?? 0,
        farmHectares: parseFloat(form.farmHectares) || 0,
        cassavaVariety: form.cassavaVariety,
      })
      setStatus('done')
      setTimeout(() => {
        refresh()
        setShowForm(false)
        setForm({ fullName: '', phone: '', farmState: 'Benue', farmLga: '', farmHectares: '', cassavaVariety: 'TME419' })
        setGps(null)
        setStatus('idle')
      }, 1500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to register farmer')
      setStatus('idle')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle title="Farmers" subtitle={`${farmers.length} registered`} />
        <button onClick={() => setShowForm(!showForm)}
          className="action-icon action-icon-emerald flex-shrink-0"
          style={{ width: 40, height: 40 }}>
          <span style={{ display: 'flex' }}>{showForm ? Icons.check({ width: 20, height: 20 }) : Icons.plus({ width: 20, height: 20 })}</span>
        </button>
      </div>

      {/* Search */}
      <input className="form-field" placeholder="Search by name, phone, or state..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Registration Form */}
      {showForm && (
        <div className="card-glass p-5 space-y-4">
          <FormField label="Full Name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="John Doe" />
          <FormField label="Phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 123 4567" type="tel" />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="State" value={form.farmState} onChange={(e) => setForm({ ...form, farmState: e.target.value })}>
              <option>Benue</option><option>Niger</option><option>Nasarawa</option>
              <option>Ogun</option><option>Oyo</option><option>Cross River</option>
              <option>Delta</option><option>Other</option>
            </FormSelect>
            <FormField label="LGA" value={form.farmLga} onChange={(e) => setForm({ ...form, farmLga: e.target.value })} placeholder="e.g. Guma" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Farm Size (ha)" value={form.farmHectares} onChange={(e) => setForm({ ...form, farmHectares: e.target.value })} placeholder="5" type="number" />
            <FormSelect label="Cassava Variety" value={form.cassavaVariety} onChange={(e) => setForm({ ...form, cassavaVariety: e.target.value })}>
              <option>TME419</option><option>TMS30572</option><option>Farmer's Pride</option>
              <option>Local Variety</option><option>Other</option>
            </FormSelect>
          </div>
          {gps && <GpsBadge lat={gps.lat} lng={gps.lng} />}
          <SubmitBtn status={status} label="Register Farmer" onClick={submit}
            loadingStates={{ gps: 'Getting GPS...', saving: 'Saving...' }} />
        </div>
      )}

      {/* Farmer List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card-glass p-5 text-center">
            <p className="text-sm text-[#979fff]/40">{farmers.length === 0 ? 'No farmers registered yet' : 'No farmers match your search'}</p>
          </div>
        ) : filtered.map((f) => (
          <div key={f.id} className="card-glass p-3 flex items-center gap-3">
            <div className="action-icon action-icon-emerald flex-shrink-0" style={{ width: 38, height: 38 }}>
              <span style={{ display: 'flex' }}>{Icons.users({ width: 18, height: 18 })}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{f.fullName}</p>
              <p className="text-xs text-[#979fff]/40">{f.phone} · {f.farmState} · {f.farmHectares}ha · {f.cassavaVariety}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Header & Bottom Nav ───────────────────────────────────────────────────

function Header({ online }: { online: boolean }) {
  return (
    <header className="app-header">
      <div className="flex items-center gap-2.5">
        <div className="logo-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#e8c84e" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-extrabold text-white leading-none">AGROWEALTH</p>
          <p className="text-[10px] text-emerald-300/50 font-semibold tracking-widest">FIELD AGENT</p>
        </div>
      </div>
      <div className={`status-pill ${online ? 'online' : 'offline'}`}>
        <span className="status-orb" />
        {online ? 'Online' : 'Offline'}
      </div>
    </header>
  )
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: (s: CSSProperties) => ReactNode }[] = [
    { key: 'dashboard', label: 'Home', icon: Icons.home },
    { key: 'buy', label: 'Buy', icon: Icons.naira },
    { key: 'dispatch', label: 'Dispatch', icon: Icons.truck },
    { key: 'deliver', label: 'Deliver', icon: Icons.box },
    { key: 'farmers', label: 'Farmers', icon: Icons.users },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(({ key, label, icon }) => {
        const active = tab === key
        return (
          <button key={key} className={`nav-item ${active ? 'active' : ''}`} onClick={() => onTab(key)}>
            {active && <span className="nav-indicator" />}
            <div className="nav-icon-wrap">{icon({ width: 22, height: 22 })}</div>
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<CycleStats | null>(null)
  const [online, setOnline] = useState(true)
  const [syncPending, setSyncPending] = useState(0)

  const refresh = useCallback(async () => {
    setStats(await getCycleStats())
    setSyncPending(await getPendingSyncCount())
  }, [])

  useEffect(() => {
    refresh()
    const cleanup = setupAutoSync(30000)
    const onOnline = () => { setOnline(true); refresh() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)
    const interval = setInterval(refresh, 5000)
    return () => {
      cleanup()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [refresh])

  const handleSync = async () => {
    await syncAll()
    await refresh()
  }

  return (
    <div className="app-shell">
      <Header online={online} />
      <main className="app-main">
        {tab === 'dashboard' && <DashboardTab stats={stats} onNavigate={setTab} onSync={handleSync} syncPending={syncPending} />}
        {tab === 'buy' && <BuyTab onComplete={refresh} />}
        {tab === 'dispatch' && <DispatchTab onComplete={refresh} />}
        {tab === 'deliver' && <DeliverTab onComplete={refresh} />}
        {tab === 'farmers' && <FarmersTab />}
      </main>
      <BottomNav tab={tab} onTab={setTab} />
    </div>
  )
}
