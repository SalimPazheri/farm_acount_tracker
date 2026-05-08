import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function TransactionModal({ transaction, projectId, onClose, onSaved }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    type: transaction?.type || 'expense',
    project_id: transaction?.project_id || projectId || '',
    category_id: transaction?.category_id || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    description: transaction?.description || '',
    amount: transaction?.amount || '',
    payment_method: transaction?.payment_method || 'cash',
    notes: transaction?.notes || '',
  })

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data || []))
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  const filteredCats = categories.filter(c => c.type === form.type || c.type === 'both')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.project_id) { setError('Please select a project'); return }
    if (!form.description.trim()) { setError('Please enter a description'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Please enter a valid amount'); return }
    setLoading(true); setError('')

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      created_by: user.id,
      category_id: form.category_id || null,
    }

    let result
    if (transaction?.id) {
      result = await supabase.from('transactions').update(payload).eq('id', transaction.id)
    } else {
      result = await supabase.from('transactions').insert(payload)
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{transaction?.id ? 'Edit Transaction' : 'Add Transaction'}</span>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="type-toggle">
              <button type="button"
                className={`type-option ${form.type === 'expense' ? 'active-expense' : ''}`}
                onClick={() => set('type', 'expense')}>
                <i className="ti ti-arrow-up-circle"></i> Expense
              </button>
              <button type="button"
                className={`type-option ${form.type === 'income' ? 'active-income' : ''}`}
                onClick={() => set('type', 'income')}>
                <i className="ti ti-arrow-down-circle"></i> Income
              </button>
            </div>

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
                <input className="form-control" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <input className="form-control" type="text" placeholder="e.g. Paid Rajan for ploughing" value={form.description} onChange={e => set('description', e.target.value)} required />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">Select category...</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-control" placeholder="Any additional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <i className="ti ti-check"></i> {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
