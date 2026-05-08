import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProjectModal from '../components/ProjectModal'
import { format } from 'date-fns'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    const { data } = await supabase.from('project_summary').select('*').order('project_name')
    setProjects(data || [])
    setLoading(false)
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project and all its transactions? This cannot be undone.')) return
    await supabase.from('projects').delete().eq('id', id)
    loadProjects()
  }

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Projects</div>
          <div className="page-sub">Manage your farm projects</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <i className="ti ti-plus"></i> New Project
        </button>
      </div>

      <div className="filter-bar" style={{marginBottom:'20px'}}>
        {['all','active','paused','closed'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><i className="ti ti-loader-2"></i> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="ti ti-plant"></i>
            <p>No projects found. Create your first project!</p>
          </div>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'16px'}}>
          {filtered.map(p => {
            const profit = Number(p.total_income) - Number(p.total_expense)
            const pct = p.total_income > 0 ? Math.min((p.total_expense / p.total_income) * 100, 100) : 0
            return (
              <div key={p.project_id} className="card" style={{cursor:'default'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'8px'}}>
                  <div>
                    <div style={{fontSize:'15px',fontWeight:'600',marginBottom:'3px'}}>{p.project_name}</div>
                    <div style={{fontSize:'12.5px',color:'var(--gray-500)'}}>
                      {p.crop_type && <span>{p.crop_type} · </span>}
                      {p.start_date && <span>Started {format(new Date(p.start_date), 'MMM yyyy')}</span>}
                    </div>
                  </div>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',margin:'14px 0'}}>
                  <div style={{textAlign:'center',padding:'10px 8px',background:'var(--green-light)',borderRadius:'8px'}}>
                    <div style={{fontSize:'11px',color:'var(--gray-500)',marginBottom:'3px'}}>Income</div>
                    <div style={{fontSize:'14px',fontWeight:'600',color:'var(--green)'}}>{fmt(p.total_income)}</div>
                  </div>
                  <div style={{textAlign:'center',padding:'10px 8px',background:'var(--red-light)',borderRadius:'8px'}}>
                    <div style={{fontSize:'11px',color:'var(--gray-500)',marginBottom:'3px'}}>Expense</div>
                    <div style={{fontSize:'14px',fontWeight:'600',color:'var(--red)'}}>{fmt(p.total_expense)}</div>
                  </div>
                  <div style={{textAlign:'center',padding:'10px 8px',background: profit >= 0 ? 'var(--blue-light)' : 'var(--red-light)',borderRadius:'8px'}}>
                    <div style={{fontSize:'11px',color:'var(--gray-500)',marginBottom:'3px'}}>Profit</div>
                    <div style={{fontSize:'14px',fontWeight:'600',color: profit >= 0 ? 'var(--blue)' : 'var(--red)'}}>{fmt(profit)}</div>
                  </div>
                </div>

                <div className="project-bar-bg">
                  <div className="project-bar-fill" style={{width: pct + '%', background: profit < 0 ? 'var(--red)' : 'var(--green-mid)'}}></div>
                </div>
                <div style={{fontSize:'12px',color:'var(--gray-500)',marginBottom:'14px'}}>
                  {p.transaction_count} transaction{p.transaction_count !== 1 ? 's' : ''}
                </div>

                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={() => navigate('/transactions?project=' + p.project_id)}>
                    <i className="ti ti-list"></i> Transactions
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing({id: p.project_id, name: p.project_name, crop_type: p.crop_type, status: p.status, start_date: p.start_date}); setShowModal(true) }}>
                    <i className="ti ti-edit"></i>
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteProject(p.project_id)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={editing}
          onClose={() => setShowModal(false)}
          onSaved={loadProjects}
        />
      )}
    </div>
  )
}
