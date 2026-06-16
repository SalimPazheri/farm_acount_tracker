import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function AllocationModal({ advance, onClose, onSaved }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const remaining = Number(advance.amount) - Number(advance.allocated_amount)

  const [form, setForm] = useState({
    project_id: '',
    category_id: '',
    allocated_amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })

  useEffect(() => {
    supabase.from('projects').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => setProjects(data || []))
    supabase.from('categories').select('*').in('type', ['expense', 'both']).order('sort_order')
      .then(({ data }) => setCategories(data || []))
  }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleAmountChange(e) {
    const val = e.target.value
    if (/^\d*\.?\d*$/.test(val)) set('allocated_amount', val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.project_id) { setError('Please select a project'); return }
    if (!form.description.trim()) { setError('Please enter a description'); return }
    if (!form.allocated_amount || parseFloat(form.allocated_amount) <= 0) {
      setError('Please enter a valid amount'); return
    }
    if (parseFloat(form.allocated_amount) > remaining) {
      setError(`Amount cannot exceed remaining balance of ${fmt(remaining)}`); return
    }

    setLoading(true); setError('')

    // 1. Create the transaction in the project
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        project_id: form.project_id,
        category_id: form.category_id || null,
        type: 'expense',
        date: form.date,
        description: form.description,
        amount: parseFloat(form.allocated_amount),
        payment_method: advance.payment_method,
        notes: `Allocated from advance payment to: ${advance.paid_to}`,
        created_by: user.id,
      })
      .select()
      .single()

    if (txError) { setError(txError.message); setLoading(false); return }

    // 2. Create the allocation record linked to the transaction
    const { error: allocError } = await supabase
      .from('advance_allocations')
      .insert({
        advance_id: advance.id,
        project_id: form.project_id,
        category_id: form.category_id || null,
        transaction_id: txData.id,
        allocated_amount: parseFloat(form.allocated_amount),
        date: form.date,
        description: form.description,
        created_by: user.id,
      })

    if (allocError) {
      // Rollback the transaction if allocation insert fails
      await supabase.from('transactions').delete().eq('id', txData.id)
      setError(allocError.message); setLoading(false); return
    }

    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Allocate Advance</span>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x"></i></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Advance summary */}
            <div style={{
              padding: '12px 14px',
              background: 'var(--gray-50)',
              borderRadius: '10px',
              marginBottom: '16px',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '6px' }}>Allocating from</div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{advance.paid_to}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px' }}>{advance.purpose}</div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Total</div>
                  <div style={{ fontWeight: '600', color: 'var(--gray-700)' }}>{fmt(advance.amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Allocated</div>
                  <div style={{ fontWeight: '600', color: 'var(--red)' }}>{fmt(advance.allocated_amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Remaining</div>
                  <div style={{ fontWeight: '600', color: 'var(--green)' }}>{fmt(remaining)}</div>
                </div>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-control" value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
                <option value="">Select project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-control" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  className="form-control"
                  type="text"
                  inputMode="decimal"
                  placeholder={`Max ${fmt(remaining)}`}
                  value={form.allocated_amount}
                  onChange={handleAmountChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. Fertilizer for banana plot"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <i className="ti ti-check"></i> {loading ? 'Allocating...' : 'Allocate to Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}