import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TransactionModal from '../components/TransactionModal'
import { format } from 'date-fns'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    project_id: searchParams.get('project') || '',
    type: '',
    category_id: '',
    date_from: '',
    date_to: '',
    search: '',
  })

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data || []))
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  useEffect(() => { loadTransactions() }, [filters])

  async function loadTransactions() {
    setLoading(true)
    let query = supabase.from('transactions')
      .select('*, projects(name), categories(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.project_id) query = query.eq('project_id', filters.project_id)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.category_id) query = query.eq('category_id', filters.category_id)
    if (filters.date_from) query = query.gte('date', filters.date_from)
    if (filters.date_to) query = query.lte('date', filters.date_to)
    if (filters.search) query = query.ilike('description', `%${filters.search}%`)

    const { data } = await query.limit(200)
    setTransactions(data || [])
    setLoading(false)
  }

  function setFilter(key, val) { setFilters(f => ({ ...f, [key]: val })) }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    loadTransactions()
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const payMethodLabel = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', cheque: 'Cheque', other: 'Other' }

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-sub">All your payments and receipts</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <i className="ti ti-plus"></i> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:'16px',padding:'14px 18px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:'10px',alignItems:'end'}}>
          <div>
            <label className="form-label">Search</label>
            <input className="form-control" placeholder="Search description..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Project</label>
            <select className="form-control" value={filters.project_id} onChange={e => setFilter('project_id', e.target.value)}>
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-control" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
              <option value="">All types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input className="form-control" type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-control" type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div style={{display:'flex',gap:'12px',marginBottom:'16px'}}>
        <div style={{background:'var(--green-light)',borderRadius:'10px',padding:'10px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
          <i className="ti ti-arrow-down-circle" style={{color:'var(--green)',fontSize:'18px'}}></i>
          <div>
            <div style={{fontSize:'11px',color:'var(--gray-500)'}}>Total Income</div>
            <div style={{fontWeight:'600',color:'var(--green)'}}>{fmt(totalIncome)}</div>
          </div>
        </div>
        <div style={{background:'var(--red-light)',borderRadius:'10px',padding:'10px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
          <i className="ti ti-arrow-up-circle" style={{color:'var(--red)',fontSize:'18px'}}></i>
          <div>
            <div style={{fontSize:'11px',color:'var(--gray-500)'}}>Total Expense</div>
            <div style={{fontWeight:'600',color:'var(--red)'}}>{fmt(totalExpense)}</div>
          </div>
        </div>
        <div style={{background:'var(--blue-light)',borderRadius:'10px',padding:'10px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
          <i className="ti ti-coin" style={{color:'var(--blue)',fontSize:'18px'}}></i>
          <div>
            <div style={{fontSize:'11px',color:'var(--gray-500)'}}>Net</div>
            <div style={{fontWeight:'600',color: totalIncome - totalExpense >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmt(totalIncome - totalExpense)}</div>
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',color:'var(--gray-500)',fontSize:'13px'}}>
          {transactions.length} records
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        {loading ? (
          <div className="loading"><i className="ti ti-loader-2"></i> Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-receipt"></i>
            <p>No transactions found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th style={{textAlign:'right'}}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{whiteSpace:'nowrap',color:'var(--gray-500)',fontSize:'12.5px'}}>{format(new Date(t.date), 'dd MMM yyyy')}</td>
                    <td style={{color:'var(--gray-700)',fontSize:'12.5px',whiteSpace:'nowrap'}}>{t.projects?.name}</td>
                    <td>
                      <div style={{fontWeight:'500'}}>{t.description}</div>
                      {t.notes && <div style={{fontSize:'11.5px',color:'var(--gray-500)'}}>{t.notes}</div>}
                    </td>
                    <td>{t.categories?.name ? <span className="badge" style={{background:'var(--gray-100)',color:'var(--gray-700)',fontSize:'11px'}}>{t.categories.name}</span> : '—'}</td>
                    <td style={{fontSize:'12px',color:'var(--gray-500)'}}>{payMethodLabel[t.payment_method] || t.payment_method}</td>
                    <td><span className={`badge badge-${t.type}`}>{t.type}</span></td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <span className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                        {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button className="btn-icon btn" style={{padding:'5px'}} onClick={() => { setEditing(t); setShowModal(true) }}>
                          <i className="ti ti-edit" style={{fontSize:'14px'}}></i>
                        </button>
                        <button className="btn-icon btn" style={{padding:'5px',color:'var(--red)'}} onClick={() => deleteTransaction(t.id)}>
                          <i className="ti ti-trash" style={{fontSize:'14px'}}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <TransactionModal
          transaction={editing}
          projectId={filters.project_id}
          onClose={() => setShowModal(false)}
          onSaved={loadTransactions}
        />
      )}
    </div>
  )
}
