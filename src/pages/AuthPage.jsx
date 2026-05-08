import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else {
      if (!fullName.trim()) { setError('Please enter your name'); setLoading(false); return }
      const { error } = await signUp(email, password, fullName)
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="icon-wrap"><i className="ti ti-plant"></i></div>
          <div className="name">Farm Ledger</div>
        </div>
        <div className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create account'}</div>
        <div className="auth-sub">{mode === 'login' ? 'Sign in to your farm account' : 'Start tracking your farm finances'}</div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" type="text" placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'10px',marginTop:'8px'}} type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account? <a onClick={() => setMode('signup')}>Sign up</a></>
          ) : (
            <>Already have an account? <a onClick={() => setMode('login')}>Sign in</a></>
          )}
        </div>
      </div>
    </div>
  )
}
