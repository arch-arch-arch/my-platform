'use client'

import { useEffect, useMemo, useState } from 'react'

type TierId = 'essential' | 'premium' | 'exclusive'

type ContentItem = {
  id: number
  title: string
  tier: TierId
  image: string
}

const tiers = [
  { id: 'essential' as const, name: 'Essential', color: '#F6C744' },
  { id: 'premium' as const, name: 'Premium', color: '#FF8C42' },
  { id: 'exclusive' as const, name: 'Exclusive', color: '#E84A5F' },
]

function getTierColor(tier: TierId) {
  if (tier === 'essential') return '#F6C744'
  if (tier === 'premium') return '#FF8C42'
  return '#E84A5F'
}

function readArray(key: string): any[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function isFilePath(s: string) {
  return s.startsWith('/')
}

/* ============
   CONTENT SETS
   (distinct per pack)
============ */
const essentialItems: ContentItem[] = [
  { id: 1, title: 'Sous la douche 💧', tier: 'essential', image: '/e-1.jpg' },
  { id: 2, title: 'Sous la douche 💦', tier: 'essential', image: '/e-2.jpg' },
  { id: 3, title: 'Sous la douche 🚿', tier: 'essential', image: '/e-3.jpg' },
  { id: 4, title: 'Sous la douche 💧💧', tier: 'essential', image: '/e-4.jpg' },
  { id: 5, title: 'Sous la douche 💦💦', tier: 'essential', image: '/e-5.jpg' },
]

const premiumItems: ContentItem[] = [
  { id: 101, title: 'Sous la douche 💧', tier: 'premium', image: '/p-1.jpg' },
  { id: 102, title: 'Sous la douche 💦', tier: 'premium', image: '/p-2.jpg' },
  { id: 103, title: 'Sous la douche 🚿', tier: 'premium', image: '/p-3.jpg' },
  { id: 104, title: 'Sous la douche 💧💧', tier: 'premium', image: '/p-4.jpg' },
  { id: 105, title: 'Sous la douche 💦💦', tier: 'premium', image: '/p-5.jpg' },
  { id: 106, title: 'Sous la douche 🚿💧', tier: 'premium', image: '/p-6.jpg' },
  { id: 107, title: 'Sous la douche 💧✨', tier: 'premium', image: '/p-7.jpg' },
  { id: 108, title: 'Sous la douche 💦✨', tier: 'premium', image: '/p-8.jpg' },
  { id: 109, title: 'Sous la douche 💧💫', tier: 'premium', image: '/p-9.jpg' },
  { id: 110, title: 'Sous la douche 🚿💫', tier: 'premium', image: '/p-10.jpg' },
]

const exclusiveItems: ContentItem[] = [
  { id: 201, title: 'Sous la douche 💧', tier: 'exclusive', image: '/x-1.jpg' },
  { id: 202, title: 'Sous la douche 💦', tier: 'exclusive', image: '/x-2.jpg' },
  { id: 203, title: 'Sous la douche 🚿', tier: 'exclusive', image: '/x-3.jpg' },
  { id: 204, title: 'Sous la douche 💧💧', tier: 'exclusive', image: '/x-4.jpg' },
  { id: 205, title: 'Sous la douche 💦💦', tier: 'exclusive', image: '/x-5.jpg' },
  { id: 206, title: 'Sous la douche 🚿💧', tier: 'exclusive', image: '/x-6.jpg' },
  { id: 207, title: 'Sous la douche 💧✨', tier: 'exclusive', image: '/x-7.jpg' },
  { id: 208, title: 'Sous la douche 💦✨', tier: 'exclusive', image: '/x-8.jpg' },
  { id: 209, title: 'Sous la douche 💧💫', tier: 'exclusive', image: '/x-9.jpg' },
  { id: 210, title: 'Sous la douche 🚿💫', tier: 'exclusive', image: '/x-10.jpg' },
  { id: 211, title: 'Sous la douche 💦👑', tier: 'exclusive', image: '/x-11.jpg' },
  { id: 212, title: 'Sous la douche 🚿💎', tier: 'exclusive', image: '/x-12.jpg' },
  { id: 213, title: 'Sous la douche 💧🌙', tier: 'exclusive', image: '/x-13.jpg' },
  { id: 214, title: 'Sous la douche 💦🏆', tier: 'exclusive', image: '/x-14.jpg' },
  { id: 215, title: 'Sous la douche 🚿💖', tier: 'exclusive', image: '/x-15.jpg' },
]

const allItems: ContentItem[] = [...essentialItems, ...premiumItems, ...exclusiveItems]

export default function GalleryPage() {
  const [unlockedIds, setUnlockedIds] = useState<number[]>([])
  const [purchasedTiers, setPurchasedTiers] = useState<string[]>([])
  const [selectedTier, setSelectedTier] = useState<TierId>('essential')

  // blur friction state for thumbnails
  const [revealedThumbs, setRevealedThumbs] = useState<number[]>([])

  // modal
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [modalRevealed, setModalRevealed] = useState(false)

  useEffect(() => {
    setRevealedThumbs([]) // Always reset blur state when gallery opens
    setUnlockedIds(readArray('unlockedItems') as number[])
    setPurchasedTiers(readArray('purchasedTiers') as string[])

    const lastTier = localStorage.getItem('lastTier') as TierId | null
    if (lastTier) setSelectedTier(lastTier)
  }, [])

  const tierObj = tiers.find(t => t.id === selectedTier)!
  const currentItems = useMemo(() => allItems.filter(i => i.tier === selectedTier), [selectedTier])

  function goToOffers() {
    window.location.href = '/offers'
  }

  function isUnlocked(id: number) {
    return unlockedIds.includes(id)
  }

  function toggleThumbReveal(id: number) {
    setRevealedThumbs(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function openModal(item: ContentItem) {
    setSelectedItem(item)
    setModalRevealed(false)
  }

  function closeModal() {
    setSelectedItem(null)
    setModalRevealed(false)
  }

  const unlockedCount = unlockedIds.length
  const totalCount = allItems.length
  const pct = totalCount === 0 ? 0 : (unlockedCount / totalCount) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a14 50%, #0d0d0d 100%)', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* GLOW */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 650, height: 420, background: tierObj.color, opacity: 0.12, filter: 'blur(160px)', borderRadius: '50%', pointerEvents: 'none' }}></div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 4, background: 'linear-gradient(90deg, #F6C744, #FF8C42, #E84A5F)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            MYPLATFORM
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {purchasedTiers.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {purchasedTiers.map(t => {
                  const tier = (t === 'essential' || t === 'premium' || t === 'exclusive') ? (t as TierId) : null
                  if (!tier) return null
                  return (
                    <span key={t} style={{ background: getTierColor(tier), color: 'black', padding: '5px 12px', borderRadius: 999, fontWeight: 'bold', fontSize: 12, textTransform: 'capitalize' }}>
                      {t}
                    </span>
                  )
                })}
              </div>
            )}

            <button onClick={goToOffers} style={{ padding: '10px 25px', background: 'transparent', border: '2px solid #ffffff30', borderRadius: 25, color: 'white', fontSize: 14, cursor: 'pointer' }}>
              Retour
            </button>
          </div>
        </div>

        {/* STATS */}
        <div style={{ textAlign: 'center', marginBottom: 35 }}>
          <h2 style={{ color: 'white', fontSize: 28, marginBottom: 10 }}>Ma Collection</h2>
          <p style={{ color: 'gray', fontSize: 16 }}>{unlockedCount} / {totalCount} images debloquees</p>
          <div style={{ width: 320, height: 8, background: '#333', borderRadius: 4, margin: '15px auto', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #F6C744, #FF8C42, #E84A5F)' }}></div>
          </div>
        </div>

        {/* TABS (PACKS) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 35, flexWrap: 'wrap' }}>
          {tiers.map(t => {
            const items = allItems.filter(i => i.tier === t.id)
            const unlockedHere = items.filter(i => isUnlocked(i.id)).length
            const isSelected = selectedTier === t.id
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTier(t.id)}
                style={{
                  padding: '12px 26px',
                  borderRadius: 30,
                  border: isSelected ? `2px solid ${t.color}` : '2px solid #333',
                  background: isSelected ? `${t.color}20` : 'transparent',
                  color: isSelected ? t.color : 'gray',
                  fontWeight: 'bold',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {t.name} ({unlockedHere}/{items.length})
              </button>
            )
          })}
        </div>

        {/* GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20 }}>
          {currentItems.map(item => {
            const unlocked = isUnlocked(item.id)
            const revealed = revealedThumbs.includes(item.id)

            return (
              <div
                key={item.id}
                style={{
                  aspectRatio: '3/4',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: unlocked ? `2px solid ${tierObj.color}40` : '2px solid #333',
                  background: unlocked ? `linear-gradient(180deg, ${tierObj.color}18 0%, #1a1a1a 100%)` : '#1a1a1a',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: unlocked ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (!unlocked) return
                  openModal(item)
                }}
              >
                {unlocked ? (
                  <>
                    {isFilePath(item.image) ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleThumbReveal(item.id)
                        }}
                        style={{
                          width: '84%',
                          height: '70%',
                          borderRadius: 10,
                          overflow: 'hidden',
                          position: 'relative',
                          border: '1px solid #ffffff14',
                          background: '#0a0a0a',
                        }}
                      >
                        <img
                          src={item.image}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: revealed ? 'none' : 'blur(14px)',
                            transform: revealed ? 'scale(1)' : 'scale(1.05)',
                            transition: 'filter 220ms ease, transform 220ms ease',
                          }}
                        />
                        {!revealed && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                            <div style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 }}>
                              CLIQUE POUR REVELER
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 50, marginBottom: 10 }}>{item.image}</div>
                    )}

                    <p style={{ color: 'white', fontWeight: 'bold', fontSize: 13, marginTop: 10, marginBottom: 0, textAlign: 'center', padding: '0 8px' }}>
                      {item.title}
                    </p>
                    <p style={{ color: tierObj.color, fontSize: 11, marginTop: 4, marginBottom: 0, textTransform: 'capitalize' }}>
                      {item.tier}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 50, marginBottom: 10 }}>🔒</div>
                    <p style={{ color: '#666', fontWeight: 'bold', fontSize: 14 }}>Verrouille</p>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* EMPTY */}
        {unlockedCount === 0 && (
          <div style={{ textAlign: 'center', marginTop: 50, padding: 40, background: '#ffffff10', borderRadius: 20 }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🔐</div>
            <h3 style={{ color: 'white', fontSize: 20, marginBottom: 10 }}>Aucune image debloquee</h3>
            <p style={{ color: 'gray', marginBottom: 25 }}>Achetez un pack pour debloquer du contenu</p>
            <button onClick={goToOffers} style={{ padding: '15px 40px', background: 'linear-gradient(135deg, #E84A5F, #FF8C42)', border: 'none', borderRadius: 30, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>
              Voir les offres
            </button>
          </div>
        )}
      </div>

      {/* MODAL (big view + blur friction + open in new tab) */}
      {selectedItem && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
          onClick={closeModal}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: 24,
              padding: 18,
              maxWidth: 720,
              width: '100%',
              border: `2px solid ${getTierColor(selectedItem.tier)}`,
              boxShadow: `0 0 60px ${getTierColor(selectedItem.tier)}40`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{selectedItem.title}</div>
                <div style={{ color: getTierColor(selectedItem.tier), fontSize: 12, textTransform: 'capitalize' }}>{selectedItem.tier}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isFilePath(selectedItem.image) && (
                  <button
                    onClick={() => window.open(selectedItem.image, '_blank')}
                    style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #ffffff30', borderRadius: 999, color: 'white', fontSize: 13, cursor: 'pointer' }}
                  >
                    Ouvrir en nouvel onglet
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #ffffff30', borderRadius: 999, color: 'white', fontSize: 13, cursor: 'pointer' }}
                >
                  Fermer
                </button>
              </div>
            </div>

            {isFilePath(selectedItem.image) ? (
              <div
                onClick={() => setModalRevealed(true)}
                style={{
                  width: '100%',
                  borderRadius: 18,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #ffffff14',
                  background: '#0a0a0a',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={selectedItem.image}
                  style={{
                    width: '100%',
                    maxHeight: '75vh',
                    objectFit: 'contain',
                    display: 'block',
                    filter: modalRevealed ? 'none' : 'blur(18px)',
                    transform: modalRevealed ? 'scale(1)' : 'scale(1.02)',
                    transition: 'filter 250ms ease, transform 250ms ease',
                  }}
                />
                {!modalRevealed && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                    <div style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>
                      CLIQUE POUR REVELER
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 420 }}>
                <div style={{ fontSize: 120 }}>{selectedItem.image}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setModalRevealed(true)}
                style={{
                  flex: 1,
                  padding: 14,
                  background: `linear-gradient(135deg, ${getTierColor(selectedItem.tier)}, ${getTierColor(selectedItem.tier)}cc)`,
                  border: 'none',
                  borderRadius: 14,
                  color: 'black',
                  fontSize: 15,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Reveler
              </button>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  padding: 14,
                  background: 'transparent',
                  border: `2px solid ${getTierColor(selectedItem.tier)}55`,
                  borderRadius: 14,
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
