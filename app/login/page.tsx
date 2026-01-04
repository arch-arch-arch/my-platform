'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function LoginPage() {
  const supabase = createClient()

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = '/offers'
    })
  }, [])

  async function submit() {
    setMsg(null)
    setLoading(true)
    try {
      if (!email || !password) {
        setMsg('Email et mot de passe requis')
        return
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Compte cree. Passe en Connexion.')
        setMode('login')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      window.location.href = '/offers'
    } catch (e: any) {
      setMsg(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a14 50%, #0d0d0d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#141414', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 22, padding: 22 }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: 20, marginBottom: 6 }}>Connexion</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 14 }}>Creer un compte ou se connecter</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setMode('signup')} style={{ flex: 1, padding: 10, borderRadius: 999, border: mode === 'signup' ? '1px solid #E84A5F' : '1px solid rgba(255,255,255,0.12)', background: mode === 'signup' ? 'rgba(232,74,95,0.15)' : 'transparent', color: mode === 'signup' ? '#E84A5F' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 'bold' }}>Creer</button>
          <button onClick={() => setMode('login')} style={{ flex: 1, padding: 10, borderRadius: 999, border: mode === 'login' ? '1px solid #FF8C42' : '1px solid rgba(255,255,255,0.12)', background: mode === 'login' ? 'rgba(255,140,66,0.15)' : 'transparent', color: mode === 'login' ? '#FF8C42' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 'bold' }}>Connexion</button>
        </div>

        <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ width: '100%', marginTop: 6, marginBottom: 12, padding: 12, borderRadius: 12, background: '#0b0b0b', border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none' }} />

        <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Mot de passe</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={{ width: '100%', marginTop: 6, marginBottom: 14, padding: 12, borderRadius: 12, background: '#0b0b0b', border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none' }} />

        <button disabled={loading} onClick={submit} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #E84A5F, #FF8C42)', color: 'white', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? '...' : (mode === 'signup' ? 'Creer mon compte' : 'Se connecter')}
        </button>

        {msg && <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{msg}</p>}

        <button onClick={() => (window.location.href = '/offers')} style={{ marginTop: 12, width: '100%', padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: 'white', cursor: 'pointer' }}>
          Retour
        </button>
      </div>
    </div>
  )
}
