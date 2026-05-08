import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function ProjectModal({ project, onClose, onSaved }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    crop_type: project?.crop_type || '',
    area_acres: project?.area_acres || '',
    start_date: project?.start_date || new Date().toISOString().split('T')[0],
    end_date: project?.end_date || '',
    status: project?.status || 'active',
  })

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Project name is required'); return }
    setLoading(true); setError('')

    const payload = {
      ...form,
      area_acres: form.area_acres ? parseFloat(form.area_acres) : null,
      end_date: form.end_date || null,
      created_by: user.id,
    }

    let result
    if (project?.id) {
      result = await supabase.from('projects').update(payload).eq('id', project.id)
    } else {
      result = await supabase.from('projects').insert(payload)
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{project?.id ? 'Edit Project' : 'New Project'}</span>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-control" type="text" placeholder="e.g. Banana Farming - 2026" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Crop / Type</label>
                <input className="form-control" type="text" placeholder="e.g. Banana, Poultry, Coffee" value={form.crop_type} onChange={e => set('crop_type', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Area (Acres)</label>
                <input className="form-control" type="number" step="0.01" min="0" placeholder="e.g. 2.5" value={form.area_acres} onChange={e => set('area_acres', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-control" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-control" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" placeholder="Any details about this project..." value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            {project?.id && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <i className="ti ti-check"></i> {loading ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
