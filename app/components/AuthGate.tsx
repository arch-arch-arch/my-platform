'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function AuthGate(props: {
  open: boolean
  onClose: () => void
  onAuthed: () => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setMsg(null)
    setLoading(false)
  }, [props.open])

  async function handleSubmit() {
    setMsg(null)
    setLoading(true)

    try {
      if (!email || !password) {
        setMsg('Email et mot de passe requis')
        return
      }

      if (mode === 'signup') {
        const derivedUsername = email.split('@')[0].trim()

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: derivedUsername }, // <-- IMPORTANT pour ton trigger
          },
        })

        if (error) throw error
        setMsg('Compte cree. Passe en Connexion.')
        setMode('login')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      props.onAuthed()
      props.onClose()
    } catch (e: any) {
      setMsg(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (!props.open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        padding: 16,
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 22,
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: 20, marginBottom: 6 }}>
              Compte obligatoire
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Creer un compte ou connecte-toi pour continuer
            </div>
          </div>
          <button
            onClick={props.onClose}
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            X
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 14 }}>
          <button
            onClick={() => setMode('signup')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 999,
              border: mode === 'signup' ? '1px solid #E84A5F' : '1px solid rgba(255,255,255,0.12)',
              background: mode === 'signup' ? 'rgba(232,74,95,0.15)' : 'transparent',
              color: mode === 'signup' ? '#E84A5F' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Creer
          </button>

          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 999,
              border: mode === 'login' ? '1px solid #FF8C42' : '1px solid rgba(255,255,255,0.12)',
              background: mode === 'login' ? 'rgba(255,140,66,0.15)' : 'transparent',
              color: mode === 'login' ? '#FF8C42' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Connexion
          </button>
        </div>

        <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          style={{
            width: '100%',
            marginTop: 6,
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            background: '#0b0b0b',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Mot de passe</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          style={{
            width: '100%',
            marginTop: 6,
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            background: '#0b0b0b',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <button
          disabled={loading}
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #E84A5F, #FF8C42)',
            color: 'white',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '...' : mode === 'signup' ? 'Creer mon compte' : 'Se connecter'}
        </button>

        {msg && <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{msg}</p>}

        <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          Note: si tu es deja connecte, ce popup ne se fermera pas tout seul. Tu peux cliquer sur X.
        </p>
      </div>
    </div>
  )
}
