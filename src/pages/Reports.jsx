import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { format, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtShort(n) { return n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : '₹' + (n/1000).toFixed(0) + 'k' }

const COLORS = ['#2d9657','#1a5fa0','#c47a1a','#b83030','#7b5ea7','#1a6b7a','#8b6914','#6b2d2d']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'#fff',border:'1px solid var(--gray-200)',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
      <div style={{fontWeight:'600',marginBottom:'6px'}}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{color: p.color, display:'flex',justifyContent:'space-between',gap:'20px'}}>
          <span>{p.name}</span><span style={{fontWeight:'600'}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const [projectSummary, setProjectSummary] = useState([])
  const [catData, setCatData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('6')

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data || []))
  }, [])

  useEffect(() => { loadData() }, [selectedProject, dateRange])

  async function loadData() {
    setLoading(true)
    const months = parseInt(dateRange)
    const fromDate = format(subMonths(new Date(), months), 'yyyy-MM-dd')

    let txQuery = supabase.from('transactions')
      .select('*, categories(name, type)')
      .gte('date', fromDate)
    if (selectedProject) txQuery = txQuery.eq('project_id', selectedProject)

    const [{ data: txData }, { data: summaryData }] = await Promise.all([
      txQuery,
      supabase.from('project_summary').select('*')
    ])

    const txs = txData || []
    setAllTransactions(txs)
    setProjectSummary(summaryData || [])

    // Category breakdown (expenses only)
    const catMap = {}
    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name || 'Other'
      catMap[name] = (catMap[name] || 0) + Number(t.amount)
    })
    setCatData(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))

    // Monthly trend
    const monthRange = eachMonthOfInterval({ start: subMonths(new Date(), months - 1), end: new Date() })
    const monthly = monthRange.map(m => {
      const key = format(m, 'yyyy-MM')
      const monthTxs = txs.filter(t => t.date.startsWith(key))
      return {
        month: format(m, 'MMM yy'),
        Income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        Expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      }
    })
    setMonthlyData(monthly)
    setLoading(false)
  }

  const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const projChartData = projectSummary
    .filter(p => selectedProject ? p.project_id === selectedProject : true)
    .map(p => ({
      name: p.project_name.length > 16 ? p.project_name.slice(0, 14) + '…' : p.project_name,
      Income: Number(p.total_income),
      Expense: Number(p.total_expense),
    }))
    .slice(0, 8)

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Financial analysis and insights</div>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
          <select className="form-control" style={{width:'auto'}} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-control" style={{width:'auto'}} value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="24">Last 24 months</option>
          </select>
        </div>
      </div>

      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
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
          <div className={`kpi-value profit ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}`}>{fmt(totalIncome - totalExpense)}</div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><i className="ti ti-loader-2"></i> Loading reports...</div>
      ) : (
        <>
          {/* Monthly trend */}
          <div className="card" style={{marginBottom:'16px'}}>
            <div className="chart-title">Monthly Income vs Expense</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barSize={18} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2ee" />
                <XAxis dataKey="month" tick={{fontSize:12,fill:'#7a8570'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:12,fill:'#7a8570'}} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:'12px'}} />
                <Bar dataKey="Income" fill="#2d9657" radius={[4,4,0,0]} />
                <Bar dataKey="Expense" fill="#b83030" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="charts-grid">
            {/* Project comparison */}
            <div className="card">
              <div className="chart-title">Project Comparison</div>
              {projChartData.length === 0 ? (
                <div className="empty-state" style={{padding:'30px'}}><p>No project data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={projChartData} layout="vertical" barSize={12} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2ee" horizontal={false} />
                    <XAxis type="number" tick={{fontSize:11,fill:'#7a8570'}} tickFormatter={fmtShort} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{fontSize:11,fill:'#7a8570'}} width={80} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:'12px'}} />
                    <Bar dataKey="Income" fill="#2d9657" radius={[0,4,4,0]} />
                    <Bar dataKey="Expense" fill="#b83030" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category pie */}
            <div className="card">
              <div className="chart-title">Expense by Category</div>
              {catData.length === 0 ? (
                <div className="empty-state" style={{padding:'30px'}}><p>No expense data</p></div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{marginTop:'8px',display:'flex',flexWrap:'wrap',gap:'6px 12px'}}>
                    {catData.slice(0, 6).map((c, i) => (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11.5px'}}>
                        <span style={{width:'8px',height:'8px',borderRadius:'50%',background:COLORS[i % COLORS.length],display:'inline-block'}}></span>
                        <span style={{color:'var(--gray-700)'}}>{c.name}</span>
                        <span style={{color:'var(--gray-500)',fontWeight:'600'}}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* P&L table */}
          <div className="card">
            <div className="chart-title">Project P&L Summary</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{textAlign:'right'}}>Income</th>
                    <th style={{textAlign:'right'}}>Expense</th>
                    <th style={{textAlign:'right'}}>Net Profit</th>
                    <th style={{textAlign:'right'}}>Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSummary.map(p => {
                    const profit = Number(p.total_income) - Number(p.total_expense)
                    return (
                      <tr key={p.project_id}>
                        <td style={{fontWeight:'500'}}>{p.project_name}</td>
                        <td style={{color:'var(--gray-500)',fontSize:'12.5px'}}>{p.crop_type || '—'}</td>
                        <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                        <td style={{textAlign:'right'}} className="amount-income">{fmt(p.total_income)}</td>
                        <td style={{textAlign:'right'}} className="amount-expense">{fmt(p.total_expense)}</td>
                        <td style={{textAlign:'right',fontWeight:'600',color: profit >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmt(profit)}</td>
                        <td style={{textAlign:'right',color:'var(--gray-500)',fontSize:'12.5px'}}>{p.transaction_count}</td>
                      </tr>
                    )
                  })}
                  <tr style={{background:'var(--gray-50)',fontWeight:'600'}}>
                    <td colSpan={3} style={{fontWeight:'600'}}>Total</td>
                    <td style={{textAlign:'right',color:'var(--green)'}}>
                      {fmt(projectSummary.reduce((s, p) => s + Number(p.total_income), 0))}
                    </td>
                    <td style={{textAlign:'right',color:'var(--red)'}}>
                      {fmt(projectSummary.reduce((s, p) => s + Number(p.total_expense), 0))}
                    </td>
                    <td style={{textAlign:'right',color: projectSummary.reduce((s,p) => s + Number(p.total_income) - Number(p.total_expense), 0) >= 0 ? 'var(--green)' : 'var(--red)'}}>
                      {fmt(projectSummary.reduce((s, p) => s + Number(p.total_income) - Number(p.total_expense), 0))}
                    </td>
                    <td style={{textAlign:'right',color:'var(--gray-500)'}}>
                      {projectSummary.reduce((s, p) => s + Number(p.transaction_count), 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Category breakdown table */}
          {catData.length > 0 && (
            <div className="card" style={{marginTop:'16px'}}>
              <div className="chart-title">Expense Category Breakdown</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{textAlign:'right'}}>Amount</th>
                      <th style={{textAlign:'right'}}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catData.map((c, i) => (
                      <tr key={i}>
                        <td style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span style={{width:'10px',height:'10px',borderRadius:'50%',background:COLORS[i % COLORS.length],display:'inline-block',flexShrink:0}}></span>
                          {c.name}
                        </td>
                        <td style={{textAlign:'right'}} className="amount-expense">{fmt(c.value)}</td>
                        <td style={{textAlign:'right',color:'var(--gray-500)'}}>
                          {totalExpense > 0 ? ((c.value / totalExpense) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
