import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TransactionModal from '../components/TransactionModal'
import { format } from 'date-fns'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function Dashboard() {
  const [summary, setSummary] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: summaryData }, { data: txData }] = await Promise.all([
      supabase.from('project_summary').select('*'),
      supabase.from('transactions')
        .select('*, projects(name), categories(name)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8)
    ])
    setSummary(summaryData || [])
    setRecent(txData || [])
    setLoading(false)
  }

  const totalIncome = summary.reduce((s, p) => s + Number(p.total_income), 0)
  const totalExpense = summary.reduce((s, p) => s + Number(p.total_expense), 0)
  const netProfit = totalIncome - totalExpense
  const activeProjects = summary.filter(p => p.status === 'active').length

  if (loading) return <div className="loading"><i className="ti ti-loader-2"></i> Loading...</div>

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Overview of all your farm finances</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="ti ti-plus"></i> Add Transaction
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon green"><i className="ti ti-trending-up" style={{fontSize:'18px'}}></i></div>
          <div className="kpi-label">Total Income</div>
          <div className="kpi-value income">{fmt(totalIncome)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><i className="ti ti-trending-down" style={{fontSize:'18px'}}></i></div>
          <div className="kpi-label">Total Expense</div>
          <div className="kpi-value expense">{fmt(totalExpense)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><i className="ti ti-coin" style={{fontSize:'18px'}}></i></div>
          <div className="kpi-label">Net Profit</div>
          <div className={`kpi-value profit ${netProfit >= 0 ? 'positive' : 'negative'}`}>{fmt(netProfit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon amber"><i className="ti ti-plant" style={{fontSize:'18px'}}></i></div>
          <div className="kpi-label">Active Projects</div>
          <div className="kpi-value neutral">{activeProjects}</div>
        </div>
      </div>

      {summary.length > 0 && (
        <div style={{marginBottom:'24px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <h3 style={{fontSize:'14px',fontWeight:'600'}}>Projects Overview</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>View all</button>
          </div>
          <div className="projects-grid">
            {summary.map(p => {
              const pct = p.total_income > 0 ? Math.min((p.total_expense / p.total_income) * 100, 100) : 0
              const profit = Number(p.total_income) - Number(p.total_expense)
              return (
                <div key={p.project_id} className="project-card" onClick={() => navigate('/transactions?project=' + p.project_id)}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                    <div className="project-name">{p.project_name}</div>
                    <span className={`badge badge-${p.status}`}>{p.status}</span>
                  </div>
                  <div className="project-meta">{p.crop_type || 'General'}</div>
                  <div className="project-bar-bg">
                    <div className="project-bar-fill" style={{width: pct + '%', background: profit < 0 ? 'var(--red)' : 'var(--green-mid)'}}></div>
                  </div>
                  <div className="project-stats">
                    <span style={{color:'var(--red)'}}>Exp {fmt(p.total_expense)}</span>
                    <span style={{color: profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600}}>{profit >= 0 ? '+' : ''}{fmt(profit)}</span>
                    <span style={{color:'var(--green)'}}>Inc {fmt(p.total_income)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <h3 style={{fontSize:'14px',fontWeight:'600'}}>Recent Transactions</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}>View all</button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-receipt"></i>
            <p>No transactions yet. Add your first transaction!</p>
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
                  <th style={{textAlign:'right'}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id}>
                    <td style={{color:'var(--gray-500)',whiteSpace:'nowrap'}}>{format(new Date(t.date), 'dd MMM yyyy')}</td>
                    <td style={{color:'var(--gray-700)'}}>{t.projects?.name}</td>
                    <td>{t.description}</td>
                    <td>{t.categories?.name ? <span className="badge" style={{background:'var(--gray-100)',color:'var(--gray-700)'}}>{t.categories.name}</span> : '—'}</td>
                    <td style={{textAlign:'right'}}>
                      <span className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                        {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <TransactionModal onClose={() => setShowAdd(false)} onSaved={loadData} />}
    </div>
  )
}
