import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function AdvanceModal({ advance, onClose, onSaved }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    paid_to: advance?.paid_to || '',
    amount: advance?.amount || '',
    date: advance?.date || new Date().toISOString().split('T')[0],
    purpose: advance?.purpose || '',
    payment_method: advance?.payment_method || 'cash',
    notes: advance?.notes || '',
  })

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleAmountChange(e) {
    const val = e.target.value
    if (/^\d*\.?\d*$/.test(val)) set('amount', val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.paid_to.trim()) { setError('Please enter who was paid'); return }
    if (!form.purpose.trim()) { setError('Please enter the purpose'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Please enter a valid amount'); return }
    setLoading(true); setError('')

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      created_by: user.id,
    }

    let result
    if (advance?.id) {
      result = await supabase.from('advances').update(payload).eq('id', advance.id)
    } else {
      result = await supabase.from('advances').insert(payload)
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{advance?.id ? 'Edit Advance' : 'New Advance Payment'}</span>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label">Paid To *</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. Rajan, Fertilizer Shop"
                value={form.paid_to}
                onChange={e => set('paid_to', e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  className="form-control"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleAmountChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Purpose *</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. Farm supplies, Labour advance"
                value={form.purpose}
                onChange={e => set('purpose', e.target.value)}
                required
              />
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

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-control"
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <i className="ti ti-check"></i> {loading ? 'Saving...' : 'Save Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}