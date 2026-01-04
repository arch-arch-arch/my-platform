'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/browser'
import AuthGate from '@/app/components/AuthGate'
import { useSearchParams } from 'next/navigation'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

const tiers = [
  { id: 'essential', name: 'Essential', price: 10, image: '/card-essential.png', color: '#F6C744', count: 5 },
  { id: 'premium', name: 'Premium', price: 20, image: '/card-premium.png', color: '#FF8C42', count: 10 },
  { id: 'exclusive', name: 'Exclusive', price: 50, image: '/card-exclusive.png', color: '#E84A5F', count: 15 },
] as const

type TierId = typeof tiers[number]['id']
type Item = { id: string; title: string; tier: TierId; n: number }
type WeekData = { id: string; name: string; is_active: boolean }
type Purchase = { tier: TierId; week_id: string }
type Reveal = { tier: TierId; media_key: string; week_id: string }

function generateItems(tier: TierId, count: number): Item[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${tier}-${i + 1}`,
    tier,
    n: i + 1,
    title: `Photo ${i + 1}`,
  }))
}

const itemsByTier: Record<TierId, Item[]> = {
  essential: generateItems('essential', 5),
  premium: generateItems('premium', 10),
  exclusive: generateItems('exclusive', 15),
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

async function getSignedUrl(tier: TierId, n: number, weekId: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/media-url?tier=${tier}&n=${n}&week=${weekId}`)
    if (!r.ok) return null
    const j = await r.json()
    return j.url ?? null
  } catch { return null }
}

function OffersContent() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()

  const [selected, setSelected] = useState<TierId>('exclusive')
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAgePopup, setShowAgePopup] = useState(true)
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null)
  const [allWeeks, setAllWeeks] = useState<WeekData[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [reveals, setReveals] = useState<Reveal[]>([])
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [revealTier, setRevealTier] = useState<TierId>('exclusive')
  const [revealWeek, setRevealWeek] = useState('week-1')
  const [revealIndex, setRevealIndex] = useState(0)
  const [revealUrl, setRevealUrl] = useState<string | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [collectionTier, setCollectionTier] = useState<TierId>('exclusive')
  const [collectionWeek, setCollectionWeek] = useState('week-1')
  const [bigView, setBigView] = useState<null | { tier: TierId; item: Item; url: string; weekId: string }>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [urlCache, setUrlCache] = useState<Record<string, { url: string; ts: number }>>({})

  const selectedTier = tiers.find(t => t.id === selected)!
  const selectedColor = selectedTier.color

  const isPurchased = (tier: TierId, weekId: string) => purchases.some(p => p.tier === tier && p.week_id === weekId)
  const isRevealed = (tier: TierId, mediaKey: string, weekId: string) => reveals.some(r => r.tier === tier && r.media_key === mediaKey && r.week_id === weekId)
  const getPurchasedWeeks = () => [...new Set(purchases.map(p => p.week_id))]

  useEffect(() => {
    if (localStorage.getItem('ageVerified') === 'true') setShowAgePopup(false)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  useEffect(() => {
    supabase.from('weeks').select('*').order('starts_at', { ascending: false }).then(({ data }) => {
      if (data?.length) {
        setAllWeeks(data)
        const active = data.find(w => w.is_active) || data[0]
        setCurrentWeek(active)
        setCollectionWeek(active.id)
      }
    })
  }, [supabase])

  useEffect(() => {
    const success = searchParams.get('success')
    const tier = searchParams.get('tier') as TierId | null
    const week = searchParams.get('week')
    if (success === 'true' && tier && week && userId) {
      loadAccess(userId).then(() => {
        setRevealTier(tier)
        setRevealWeek(week)
        setRevealIndex(0)
        setRevealUrl(null)
        setShowReveal(true)
      })
      window.history.replaceState({}, '', '/offers')
    }
  }, [searchParams, userId])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setIsAuthed(!!data.session)
      setUserId(data.session?.user?.id ?? null)
      if (data.session?.user?.id) loadAccess(data.session.user.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session)
      setUserId(session?.user?.id ?? null)
      if (session?.user?.id) loadAccess(session.user.id)
      else { setPurchases([]); setReveals([]); setUsername(null) }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [supabase])

  async function requireAuth(action: () => void) {
    const { data } = await supabase.auth.getSession()
    if (data.session) { action(); return }
    setPendingAction(() => action)
    setAuthOpen(true)
  }

  async function loadAccess(uid: string) {
    const [{ data: p }, { data: r }, { data: profile }] = await Promise.all([
      supabase.from('purchases').select('tier, week_id').eq('user_id', uid),
      supabase.from('reveals').select('tier, media_key, week_id').eq('user_id', uid),
      supabase.from('profiles').select('username').eq('id', uid).single()
    ])
    setPurchases((p || []) as Purchase[])
    setReveals((r || []) as Reveal[])
    if (profile?.username) setUsername(profile.username)
  }

  async function dbInsertReveal(tier: TierId, mediaKey: string, weekId: string) {
    if (!userId) return
    const { error } = await supabase.from('reveals').insert({ user_id: userId, tier, media_key: mediaKey, week_id: weekId })
    if (!error) setReveals(prev => [...prev, { tier, media_key: mediaKey, week_id: weekId }])
  }

  async function getUrlForItem(item: Item, weekId: string): Promise<string | null> {
    const key = `${weekId}/${item.tier}/${item.n}`
    const cached = urlCache[key]
    if (cached && Date.now() - cached.ts < 45000) return cached.url
    const url = await getSignedUrl(item.tier, item.n, weekId)
    if (url) setUrlCache(prev => ({ ...prev, [key]: { url, ts: Date.now() } }))
    return url
  }

  function startSpinOnce(): Promise<void> {
    return new Promise(resolve => {
      setIsSpinning(true)
      setRotation(r => r + 1080 + Math.random() * 360)
      setTimeout(() => { setIsSpinning(false); resolve() }, 2800)
    })
  }

  function clickDebloquer() {
    if (!currentWeek) return
    requireAuth(() => {
      if (isPurchased(selected, currentWeek.id)) return
      setShowPayment(true)
    })
  }

  async function handleStripePayment() {
    if (!userId || !currentWeek) return
    setIsProcessingPayment(true)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected, weekId: currentWeek.id, userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Erreur: ' + (data.error || 'Paiement impossible'))
    } catch { alert('Erreur de connexion') }
    finally { setIsProcessingPayment(false) }
  }

  async function handleFakePayment() {
    if (!userId || !currentWeek) return
    setShowPayment(false)
    await sleep(600)
    await startSpinOnce()
    await sleep(200)
    const { error } = await supabase.from('purchases').insert({ user_id: userId, tier: selected, week_id: currentWeek.id })
    if (!error) {
      setPurchases(prev => [...prev, { tier: selected, week_id: currentWeek.id }])
      setRevealTier(selected)
      setRevealWeek(currentWeek.id)
      setRevealIndex(0)
      setRevealUrl(null)
      setShowReveal(true)
    }
  }

  useEffect(() => {
    if (!showReveal) return
    const item = itemsByTier[revealTier][revealIndex]
    let cancelled = false
    getUrlForItem(item, revealWeek).then(url => { if (!cancelled) setRevealUrl(url) })
    return () => { cancelled = true }
  }, [showReveal, revealTier, revealWeek, revealIndex])

  async function revealNext() {
    const count = tiers.find(t => t.id === revealTier)!.count
    const current = itemsByTier[revealTier][revealIndex]
    if (current) await dbInsertReveal(revealTier, current.id, revealWeek)
    if (revealIndex + 1 >= count) {
      setShowReveal(false)
      setShowCollection(true)
      setCollectionTier(revealTier)
      setCollectionWeek(revealWeek)
    } else setRevealIndex(revealIndex + 1)
  }

  async function resetMyData() {
    if (!userId || !confirm('⚠️ Supprimer tous tes achats et reveals ? (DEV MODE)')) return
    await supabase.from('purchases').delete().eq('user_id', userId)
    await supabase.from('reveals').delete().eq('user_id', userId)
    setPurchases([])
    setReveals([])
    setShowAccount(false)
    alert('✅ Données réinitialisées !')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setIsAuthed(false)
    setUserId(null)
    setUsername(null)
    setPurchases([])
    setReveals([])
    setShowAccount(false)
  }

  async function clickCollectionItem(tier: TierId, item: Item, weekId: string) {
    requireAuth(async () => {
      if (!isRevealed(tier, item.id, weekId)) { await dbInsertReveal(tier, item.id, weekId); return }
      const url = await getUrlForItem(item, weekId)
      if (url) setBigView({ tier, item, url, weekId })
    })
  }

  function PackCard({ tier }: { tier: typeof tiers[number] }) {
    const purchased = currentWeek ? isPurchased(tier.id, currentWeek.id) : false
    const selectedNow = selected === tier.id
    const cardWidth = isMobile ? 120 : 180
    const cardHeight = isMobile ? 180 : 270
    return (
      <div
        onClick={() => !purchased && setSelected(tier.id)}
        style={{
          cursor: purchased ? 'not-allowed' : 'pointer',
          border: selectedNow ? `3px solid ${tier.color}` : '3px solid transparent',
          borderRadius: isMobile ? 12 : 16, overflow: 'hidden',
          boxShadow: selectedNow ? `0 0 ${isMobile ? 25 : 40}px ${tier.color}` : 'none',
          transition: 'all 0.25s ease',
          transform: selectedNow ? 'scale(1.05)' : 'scale(0.95)',
          opacity: purchased ? 0.35 : selectedNow ? 1 : 0.6,
          filter: purchased ? 'grayscale(1)' : 'none',
          position: 'relative', userSelect: 'none',
        }}
      >
        <img src={tier.image} alt={tier.name} draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: cardWidth, height: cardHeight, objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
        <div style={{ textAlign: 'center', padding: isMobile ? 6 : 10, background: '#1a1a1a', color: selectedNow ? tier.color : 'white', fontWeight: 'bold', fontSize: isMobile ? 12 : 18 }}>{tier.price}€ - {tier.count} items</div>
        {purchased && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', color: 'white', fontWeight: 'bold', letterSpacing: isMobile ? 1 : 2, fontSize: isMobile ? 10 : 14 }}>DEJA ACHETE</div>}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a14 50%, #0d0d0d 100%)', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* AGE POPUP */}
      {showAgePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 24, padding: 50, maxWidth: 450, width: '90%', textAlign: 'center', border: '2px solid #E84A5F50' }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🔞</div>
            <h2 style={{ color: 'white', fontSize: 24, marginBottom: 15 }}>Contenu reserve aux adultes</h2>
            <p style={{ color: 'gray', marginBottom: 30 }}>Ce site est reserve aux personnes de 18 ans et plus.</p>
            <p style={{ color: 'white', fontSize: 18, marginBottom: 25 }}>Avez-vous 18 ans ou plus ?</p>
            <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
              <button onClick={() => { localStorage.setItem('ageVerified', 'true'); setShowAgePopup(false) }} style={{ padding: '15px 40px', background: 'linear-gradient(135deg, #E84A5F, #FF8C42)', border: 'none', borderRadius: 30, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>Oui</button>
              <button onClick={() => window.location.href = 'https://google.com'} style={{ padding: '15px 40px', background: 'transparent', border: '2px solid #333', borderRadius: 30, color: 'gray', fontSize: 16, cursor: 'pointer' }}>Non</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', width: 650, height: 420, background: selectedColor, opacity: 0.14, filter: 'blur(150px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 16 : 26, gap: isMobile ? 12 : 0 }}>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 'bold', letterSpacing: 4, background: 'linear-gradient(90deg, #F6C744, #FF8C42, #E84A5F)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>MYPLATFORM</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => requireAuth(() => { setShowCollection(true); if (currentWeek) setCollectionWeek(currentWeek.id) })} style={{ padding: isMobile ? '8px 14px' : '10px 18px', background: 'transparent', border: '2px solid #ffffff30', borderRadius: 25, color: 'white', fontSize: isMobile ? 12 : 14, cursor: 'pointer' }}>Ma collection</button>
            <button onClick={() => isAuthed ? setShowAccount(true) : setAuthOpen(true)} style={{ padding: isMobile ? '8px 14px' : '10px 18px', background: isAuthed ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #E84A5F, #FF8C42)', border: isAuthed ? '1px solid rgba(255,255,255,0.2)' : 'none', borderRadius: 25, color: 'white', fontSize: isMobile ? 12 : 14, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isAuthed ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />{username || 'Compte'}</> : 'Creer un compte'}
            </button>
          </div>
        </div>

        {/* WEEK BADGE */}
        {currentWeek && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{ background: 'linear-gradient(135deg, #E84A5F, #FF8C42)', padding: '8px 20px', borderRadius: 20, color: 'white', fontSize: 14, fontWeight: 'bold' }}>🔥 {currentWeek.name} - Nouveau contenu !</span>
          </div>
        )}

        {/* WHEEL */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 20 : 28 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: isMobile ? -12 : -18, background: selectedColor, opacity: 0.35, filter: 'blur(40px)', borderRadius: '50%' }} />
            <svg width={isMobile ? 220 : 320} height={isMobile ? 220 : 320} viewBox="0 0 500 500" style={{ position: 'relative', transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 2.8s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'transform 0.25s ease-out', filter: `drop-shadow(0 0 20px ${selectedColor})` }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const a = 45, s = i * a - 90, sr = s * Math.PI / 180, er = (s + a) * Math.PI / 180
                const x1 = 250 + 240 * Math.cos(sr), y1 = 250 + 240 * Math.sin(sr), x2 = 250 + 240 * Math.cos(er), y2 = 250 + 240 * Math.sin(er)
                return <path key={i} d={`M 250 250 L ${x1} ${y1} A 240 240 0 0 1 ${x2} ${y2} Z`} fill={['#E84A5F', '#FF8C42', '#F6C744'][i % 3]} stroke="#1a1a1a" strokeWidth="2" />
              })}
              <circle cx="250" cy="250" r="52" fill="#1a1a1a" stroke={selectedColor} strokeWidth="4" />
              <text x="250" y="245" fill={selectedColor} fontSize="22" fontWeight="bold" textAnchor="middle">{selectedTier.price}€</text>
              <text x="250" y="268" fill="#888" fontSize="11" textAnchor="middle">{selectedTier.name}</text>
            </svg>
            <div style={{ position: 'absolute', top: '50%', right: isMobile ? -6 : -10, transform: 'translateY(-50%)', width: 0, height: 0, borderTop: `${isMobile ? 10 : 14}px solid transparent`, borderBottom: `${isMobile ? 10 : 14}px solid transparent`, borderRight: `${isMobile ? 18 : 24}px solid ${selectedColor}` }} />
          </div>
        </div>

        {/* PACKS */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 10 : 14 }}><p style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: 2, fontSize: isMobile ? 11 : 13 }}>SELECTIONNEZ VOTRE PACK</p></div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 10 : 22, flexWrap: 'wrap', marginBottom: isMobile ? 14 : 20 }}>{tiers.map(t => <PackCard key={t.id} tier={t} />)}</div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: isMobile ? 6 : 10 }}>
          <button onClick={clickDebloquer} disabled={(currentWeek && isPurchased(selected, currentWeek.id)) || isSpinning} style={{ background: (currentWeek && isPurchased(selected, currentWeek.id)) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${selectedColor}, ${selectedColor}cc)`, color: (currentWeek && isPurchased(selected, currentWeek.id)) ? 'rgba(255,255,255,0.5)' : 'black', padding: isMobile ? '12px 32px' : '15px 46px', borderRadius: 30, border: 'none', fontSize: isMobile ? 14 : 18, fontWeight: 'bold', cursor: (currentWeek && isPurchased(selected, currentWeek.id)) || isSpinning ? 'not-allowed' : 'pointer', boxShadow: (currentWeek && isPurchased(selected, currentWeek.id)) || isSpinning ? 'none' : `0 0 30px ${selectedColor}50`, opacity: isSpinning ? 0.7 : 1 }}>
            {(currentWeek && isPurchased(selected, currentWeek.id)) ? 'Deja achete' : isSpinning ? 'Patiente...' : `Debloquer ${selectedTier.count} medias`}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: isMobile ? 8 : 12, fontSize: isMobile ? 10 : 12 }}>Paiement unique - Acces permanent - 18+</p>
        </div>
      </div>

      {/* PAYMENT POPUP */}
      {showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: isMobile ? 12 : 16 }} onClick={() => !isProcessingPayment && setShowPayment(false)}>
          <div style={{ background: '#1a1a1a', borderRadius: isMobile ? 18 : 24, padding: isMobile ? 18 : 26, maxWidth: 420, width: '100%', border: `2px solid ${selectedColor}` }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'white', fontSize: isMobile ? 18 : 22, textAlign: 'center', marginBottom: isMobile ? 14 : 18 }}>Finaliser l'achat</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, background: '#0a0a0a', padding: isMobile ? 10 : 14, borderRadius: 12, marginBottom: isMobile ? 14 : 18 }}>
              <img src={selectedTier.image} alt={selectedTier.name} draggable={false} style={{ width: isMobile ? 50 : 60, height: isMobile ? 75 : 90, objectFit: 'cover', borderRadius: 8 }} />
              <div style={{ flex: 1 }}><p style={{ color: 'white', fontWeight: 'bold', fontSize: isMobile ? 14 : 18 }}>{selectedTier.name}</p><p style={{ color: 'gray', fontSize: isMobile ? 12 : 14 }}>{selectedTier.count} medias - {currentWeek?.name}</p></div>
              <div style={{ color: selectedColor, fontSize: isMobile ? 20 : 26, fontWeight: 'bold' }}>{selectedTier.price}€</div>
            </div>
            <button onClick={handleStripePayment} disabled={isProcessingPayment} style={{ width: '100%', padding: isMobile ? 12 : 14, background: `linear-gradient(135deg, ${selectedColor}, ${selectedColor}cc)`, border: 'none', borderRadius: 12, color: 'black', fontSize: isMobile ? 14 : 18, fontWeight: 'bold', cursor: isProcessingPayment ? 'not-allowed' : 'pointer', opacity: isProcessingPayment ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {isProcessingPayment ? 'Redirection...' : `💳 Payer ${selectedTier.price}€ par carte`}
            </button>
            <button onClick={handleFakePayment} style={{ width: '100%', padding: isMobile ? 10 : 12, background: 'rgba(232,74,95,0.1)', border: '1px solid #E84A5F50', borderRadius: 12, color: '#E84A5F', fontSize: isMobile ? 11 : 13, cursor: 'pointer', marginTop: 10 }}>🧪 Test sans paiement (DEV)</button>
            <button onClick={() => setShowPayment(false)} style={{ width: '100%', padding: isMobile ? 8 : 10, background: 'transparent', border: 'none', color: 'gray', fontSize: isMobile ? 12 : 14, cursor: 'pointer', marginTop: 8 }}>Annuler</button>
            <div style={{ marginTop: isMobile ? 10 : 14, padding: isMobile ? 10 : 12, background: '#0a0a0a', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 10 : 12 }}>🔒 Paiement sécurisé par Stripe</div>
          </div>
        </div>
      )}

      {/* REVEAL */}
      {showReveal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 350, padding: isMobile ? 10 : 16 }}>
          <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 480, background: '#141414', borderRadius: isMobile ? 16 : 24, padding: isMobile ? 12 : 18, border: `2px solid ${tiers.find(t => t.id === revealTier)!.color}80` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 8 : 10 }}>
              <div><div style={{ color: 'white', fontWeight: 'bold', fontSize: isMobile ? 14 : 18 }}>Media debloque</div><div style={{ color: 'rgba(255,255,255,0.55)', fontSize: isMobile ? 10 : 12 }}>{revealIndex + 1} / {tiers.find(t => t.id === revealTier)!.count}</div></div>
              <button onClick={() => setShowReveal(false)} style={{ padding: isMobile ? '6px 10px' : '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: isMobile ? 12 : 14 }}>Fermer</button>
            </div>
            <div style={{ borderRadius: isMobile ? 12 : 18, overflow: 'hidden', background: '#0b0b0b', marginBottom: isMobile ? 10 : 12 }} onContextMenu={e => e.preventDefault()}>
              {revealUrl ? <img src={revealUrl} draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: isMobile ? '55vh' : 'none', objectFit: 'contain' }} /> : <div style={{ padding: isMobile ? 40 : 60, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>Chargement…</div>}
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 8 : 10 }}>
              <button onClick={() => { const item = itemsByTier[revealTier][revealIndex]; if (revealUrl) setBigView({ tier: revealTier, item, url: revealUrl, weekId: revealWeek }) }} style={{ flex: 1, padding: isMobile ? 10 : 14, borderRadius: isMobile ? 10 : 14, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: isMobile ? 12 : 14 }}>Agrandir</button>
              <button onClick={revealNext} style={{ flex: 1, padding: isMobile ? 10 : 14, borderRadius: isMobile ? 10 : 14, border: 'none', background: `linear-gradient(135deg, ${tiers.find(t => t.id === revealTier)!.color}, ${tiers.find(t => t.id === revealTier)!.color}cc)`, color: 'black', cursor: 'pointer', fontWeight: 'bold', fontSize: isMobile ? 12 : 14 }}>Suivant</button>
            </div>
          </div>
        </div>
      )}

      {/* COLLECTION */}
      {showCollection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: isMobile ? 8 : 16 }} onClick={() => setShowCollection(false)}>
          <div style={{ background: '#141414', borderRadius: isMobile ? 16 : 24, padding: isMobile ? 12 : 18, maxWidth: 920, width: '100%', border: `2px solid ${tiers.find(t => t.id === collectionTier)!.color}80`, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 10 : 12 }}>
              <div><div style={{ color: 'white', fontWeight: 'bold', fontSize: isMobile ? 16 : 20 }}>Ma collection</div><div style={{ color: 'rgba(255,255,255,0.55)', fontSize: isMobile ? 10 : 12 }}>Clique pour reveler, puis agrandir</div></div>
              <button onClick={() => setShowCollection(false)} style={{ padding: isMobile ? '8px 10px' : '10px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: isMobile ? 12 : 14 }}>Fermer</button>
            </div>
            <div style={{ marginBottom: isMobile ? 10 : 14 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 10 : 12, marginBottom: 8 }}>SEMAINE</div>
              <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
                {getPurchasedWeeks().map(wid => {
                  const w = allWeeks.find(x => x.id === wid)
                  return <button key={wid} onClick={() => setCollectionWeek(wid)} style={{ padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: 999, border: collectionWeek === wid ? '1px solid #E84A5F' : '1px solid rgba(255,255,255,0.14)', background: collectionWeek === wid ? '#E84A5F20' : 'transparent', color: collectionWeek === wid ? '#E84A5F' : 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: isMobile ? 11 : 13 }}>{w?.name || wid}</button>
                })}
                {!getPurchasedWeeks().length && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: isMobile ? 11 : 13 }}>Aucun achat</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 6 : 10, flexWrap: 'wrap', marginBottom: isMobile ? 10 : 14 }}>
              {tiers.map(t => <button key={t.id} onClick={() => isPurchased(t.id, collectionWeek) && setCollectionTier(t.id)} style={{ padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: 999, border: collectionTier === t.id ? `1px solid ${t.color}` : '1px solid rgba(255,255,255,0.14)', background: collectionTier === t.id ? `${t.color}20` : 'transparent', color: isPurchased(t.id, collectionWeek) ? (collectionTier === t.id ? t.color : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.25)', cursor: isPurchased(t.id, collectionWeek) ? 'pointer' : 'not-allowed', opacity: isPurchased(t.id, collectionWeek) ? 1 : 0.55, fontSize: isMobile ? 12 : 14 }}>{t.name}</button>)}
            </div>
            {!isPurchased(collectionTier, collectionWeek) ? (
              <div style={{ padding: isMobile ? 14 : 18, borderRadius: isMobile ? 12 : 18, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>Pack non acheté pour cette semaine</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: isMobile ? 8 : 14 }}>
                {itemsByTier[collectionTier].slice(0, tiers.find(t => t.id === collectionTier)!.count).map(item => {
                  const unlocked = isRevealed(collectionTier, item.id, collectionWeek)
                  return (
                    <div key={item.id} onClick={() => clickCollectionItem(collectionTier, item, collectionWeek)} onContextMenu={e => e.preventDefault()} style={{ borderRadius: isMobile ? 10 : 16, border: '1px solid rgba(255,255,255,0.12)', background: '#0b0b0b', overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                        <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-thumbs/${collectionWeek}/${collectionTier}/${item.n}.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: unlocked ? 'none' : 'blur(20px)', transform: unlocked ? 'none' : 'scale(1.1)' }} draggable={false} onContextMenu={e => e.preventDefault()} />
                        {!unlocked && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}><div style={{ fontSize: isMobile ? 24 : 34 }}>🔒</div></div>}
                      </div>
                      <div style={{ padding: isMobile ? 6 : 10 }}><div style={{ color: 'white', fontWeight: 'bold', fontSize: isMobile ? 10 : 12, marginBottom: 2 }}>{item.title}</div><div style={{ color: tiers.find(t => t.id === collectionTier)!.color, fontSize: isMobile ? 9 : 11 }}>{collectionTier.toUpperCase()}</div></div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BIG VIEW */}
      {bigView && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: isMobile ? 8 : 16 }} onClick={() => setBigView(null)}>
          <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 520, background: '#121212', borderRadius: isMobile ? 14 : 22, padding: isMobile ? 10 : 16, border: `2px solid ${tiers.find(t => t.id === bigView.tier)!.color}80` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 8 : 10 }}>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: isMobile ? 14 : 16 }}>{bigView.item.title}</div>
              <button onClick={() => setBigView(null)} style={{ padding: isMobile ? '6px 10px' : '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: isMobile ? 12 : 14 }}>Fermer</button>
            </div>
            <div style={{ borderRadius: isMobile ? 12 : 18, overflow: 'hidden', background: '#0b0b0b', position: 'relative' }} onContextMenu={e => e.preventDefault()}>
              <img src={bigView.url} draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: isMobile ? '70vh' : 'none', objectFit: 'contain' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: isMobile ? 16 : 24, fontWeight: 'bold', letterSpacing: isMobile ? 2 : 4, transform: 'rotate(-30deg)', textShadow: '0 0 10px rgba(0,0,0,0.5)', userSelect: 'none' }}>{username || 'MYPLATFORM'}</div>
              </div>
              <div style={{ position: 'absolute', top: isMobile ? 10 : 20, left: isMobile ? 10 : 20, color: 'rgba(255,255,255,0.08)', fontSize: isMobile ? 10 : 12, fontWeight: 'bold', letterSpacing: 2, pointerEvents: 'none', userSelect: 'none' }}>{username || 'MYPLATFORM'}</div>
              <div style={{ position: 'absolute', bottom: isMobile ? 10 : 20, right: isMobile ? 10 : 20, color: 'rgba(255,255,255,0.08)', fontSize: isMobile ? 10 : 12, fontWeight: 'bold', letterSpacing: 2, pointerEvents: 'none', userSelect: 'none' }}>{username || 'MYPLATFORM'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT */}
      {showAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 450, padding: isMobile ? 12 : 16 }} onClick={() => setShowAccount(false)}>
          <div style={{ background: '#1a1a1a', borderRadius: isMobile ? 18 : 24, padding: isMobile ? 20 : 28, maxWidth: 400, width: '100%', border: '2px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: isMobile ? 18 : 24 }}>
              <div style={{ width: isMobile ? 56 : 70, height: isMobile ? 56 : 70, borderRadius: '50%', background: 'linear-gradient(135deg, #E84A5F, #FF8C42)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: isMobile ? 22 : 28 }}>👤</div>
              <div style={{ color: 'white', fontSize: isMobile ? 18 : 22, fontWeight: 'bold', marginBottom: 4 }}>{username}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: isMobile ? 11 : 13 }}>Membre</div>
            </div>
            <div style={{ background: '#0d0d0d', borderRadius: isMobile ? 10 : 14, padding: isMobile ? 10 : 14, marginBottom: isMobile ? 14 : 20 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 10 : 12, marginBottom: isMobile ? 8 : 10 }}>MES ACHATS</div>
              {!purchases.length ? <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: isMobile ? 11 : 13 }}>Aucun achat</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 8 }}>
                  {getPurchasedWeeks().map(wid => {
                    const w = allWeeks.find(x => x.id === wid)
                    const wp = purchases.filter(p => p.week_id === wid)
                    return <div key={wid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}><span style={{ color: 'white', fontSize: isMobile ? 11 : 13 }}>{w?.name || wid}</span><div style={{ display: 'flex', gap: 4 }}>{wp.map(p => { const t = tiers.find(x => x.id === p.tier)!; return <span key={p.tier} style={{ background: t.color, color: 'black', padding: isMobile ? '2px 6px' : '2px 8px', borderRadius: 10, fontSize: isMobile ? 9 : 11, fontWeight: 'bold' }}>{t.name}</span> })}</div></div>
                  })}
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{ width: '100%', padding: isMobile ? 12 : 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'white', fontSize: isMobile ? 13 : 15, cursor: 'pointer', fontWeight: 'bold' }}>Se déconnecter</button>
            <button onClick={resetMyData} style={{ width: '100%', padding: isMobile ? 12 : 14, borderRadius: 12, border: '1px solid #E84A5F50', background: 'rgba(232,74,95,0.1)', color: '#E84A5F', fontSize: isMobile ? 11 : 13, cursor: 'pointer', marginTop: 10 }}>🔄 Reset mes achats (DEV)</button>
            <button onClick={() => setShowAccount(false)} style={{ width: '100%', padding: isMobile ? 10 : 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: isMobile ? 11 : 13, cursor: 'pointer', marginTop: 10 }}>Fermer</button>
          </div>
        </div>
      )}

      <AuthGate open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={async () => { setIsAuthed(true); const { data } = await supabase.auth.getSession(); const uid = data.session?.user?.id ?? null; setUserId(uid); if (uid) await loadAccess(uid); if (pendingAction) pendingAction(); setPendingAction(null) }} />
    </div>
  )
}

export default function OffersPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Chargement...</div>}><OffersContent /></Suspense>
}
