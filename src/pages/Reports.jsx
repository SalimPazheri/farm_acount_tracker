import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, eachMonthOfInterval, subMonths } from 'date-fns'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtDec(n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtShort(n) { return n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : '₹' + (n/1000).toFixed(0) + 'k' }
function fmtDate(d) { if (!d) return ''; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}` }

const COLORS = ['#2d9657','#1a5fa0','#c47a1a','#b83030','#7b5ea7','#1a6b7a','#8b6914','#6b2d2d']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'#fff',border:'1px solid var(--gray-200)',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
      <div style={{fontWeight:'600',marginBottom:'6px'}}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{color:p.color,display:'flex',justifyContent:'space-between',gap:'20px'}}>
          <span>{p.name}</span><span style={{fontWeight:'600'}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  // ── existing dashboard state ──
  const [projectSummary, setProjectSummary] = useState([])
  const [catData, setCatData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('6')

  // ── statement state ──
  const [stmtProject, setStmtProject] = useState('')
  const [stmtFrom, setStmtFrom] = useState('')
  const [stmtTo, setStmtTo] = useState('')
  const [stmtRows, setStmtRows] = useState([])
  const [stmtName, setStmtName] = useState('')
  const [stmtLoading, setStmtLoading] = useState(false)
  const [stmtError, setStmtError] = useState('')
  const [stmtGenerated, setStmtGenerated] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data || []))
  }, [])

  useEffect(() => { loadData() }, [selectedProject, dateRange])

  // ── existing dashboard data load ──
  async function loadData() {
    setLoading(true)
    const months = parseInt(dateRange)
    const fromDate = format(subMonths(new Date(), months), 'yyyy-MM-dd')
    let txQuery = supabase.from('transactions').select('*, categories(name, type)').gte('date', fromDate)
    if (selectedProject) txQuery = txQuery.eq('project_id', selectedProject)
    const [{ data: txData }, { data: summaryData }] = await Promise.all([
      txQuery,
      supabase.from('project_summary').select('*')
    ])
    const txs = txData || []
    setAllTransactions(txs)
    setProjectSummary(summaryData || [])
    const catMap = {}
    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name || 'Other'
      catMap[name] = (catMap[name] || 0) + Number(t.amount)
    })
    setCatData(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))
    const monthRange = eachMonthOfInterval({ start: subMonths(new Date(), months - 1), end: new Date() })
    setMonthlyData(monthRange.map(m => {
      const key = format(m, 'yyyy-MM')
      const monthTxs = txs.filter(t => t.date.startsWith(key))
      return {
        month: format(m, 'MMM yy'),
        Income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        Expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      }
    }))
    setLoading(false)
  }

  const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const projChartData = projectSummary
    .filter(p => selectedProject ? p.project_id === selectedProject : true)
    .map(p => ({
      name: p.project_name.length > 16 ? p.project_name.slice(0, 14) + '\u2026' : p.project_name,
      Income: Number(p.total_income),
      Expense: Number(p.total_expense),
    })).slice(0, 8)

  // ── statement logic ──
  async function handleGenerateStatement() {
    if (!stmtProject) { setStmtError('Please select a project'); return }
    if (!stmtFrom || !stmtTo) { setStmtError('Please select a date range'); return }
    if (stmtFrom > stmtTo) { setStmtError('From date cannot be after To date'); return }
    setStmtError(''); setStmtLoading(true); setStmtGenerated(false)
    const proj = projects.find(p => p.id === stmtProject)
    setStmtName(proj?.name || '')
    const { data } = await supabase
      .from('transactions')
      .select('id, date, description, type, amount, payment_method, categories(name)')
      .eq('project_id', stmtProject)
      .gte('date', stmtFrom)
      .lte('date', stmtTo)
      .order('date', { ascending: true })
    let bal = 0
    setStmtRows((data || []).map(t => {
      if (t.type === 'income') bal += Number(t.amount)
      else bal -= Number(t.amount)
      return { ...t, balance: bal, isIncome: t.type === 'income' }
    }))
    setStmtGenerated(true)
    setStmtLoading(false)
  }

  const stmtTotalIncome = stmtRows.reduce((s, r) => r.isIncome ? s + Number(r.amount) : s, 0)
  const stmtTotalExpense = stmtRows.reduce((s, r) => !r.isIncome ? s + Number(r.amount) : s, 0)
  const stmtNet = stmtTotalIncome - stmtTotalExpense
  const printDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  function handlePrint() {
    const closingBal = stmtRows.length ? stmtRows[stmtRows.length - 1].balance : 0
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Transaction Statement - ${stmtName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      font-size: 11.5px;
      color: #1c1c1c;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 16mm 16mm; }

    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 3px solid #2d6a4f; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 40px; height: 40px; border-radius: 10px; background: #2d6a4f; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .app-name { font-size: 10px; font-weight: 600; color: #2d6a4f; letter-spacing: 1.5px; text-transform: uppercase; }
    .project-name { font-size: 18px; font-weight: 700; color: #1c1c1c; line-height: 1.2; margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 13px; font-weight: 600; color: #2d6a4f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .meta-table { margin-left: auto; border-collapse: collapse; }
    .meta-table td { padding: 2px 0; font-size: 11px; color: #555; }
    .meta-table td:first-child { padding-right: 12px; font-weight: 500; color: #333; }

    /* Summary strip */
    .summary-strip { display: flex; margin-bottom: 18px; border: 1px solid #dde5db; border-radius: 8px; overflow: hidden; }
    .s-box { flex: 1; padding: 11px 16px; border-right: 1px solid #dde5db; }
    .s-box:last-child { border-right: none; }
    .s-box.hi { background: #f2f7f4; }
    .s-label { font-size: 9.5px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .s-value { font-size: 15px; font-weight: 700; }
    .c-inc { color: #2d6a4f; } .c-exp { color: #b83030; } .c-neu { color: #333; }

    /* Table */
    table.ledger { width: 100%; border-collapse: collapse; }
    table.ledger thead tr { background: #2d6a4f; color: #fff; }
    table.ledger thead th { padding: 9px 11px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.3px; text-align: left; }
    table.ledger thead th.r { text-align: right; }
    table.ledger tbody tr { border-bottom: 1px solid #eaede8; }
    table.ledger tbody tr:nth-child(even) { background: #f8faf8; }
    table.ledger tbody td { padding: 7.5px 11px; font-size: 11px; vertical-align: middle; }
    table.ledger tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
    table.ledger tbody td.date-col { white-space: nowrap; color: #666; font-size: 10.5px; }
    .desc-main { font-weight: 500; color: #1c1c1c; }
    .desc-cat { font-size: 10px; color: #999; margin-top: 1px; }
    .pm-badge { display: inline-block; font-size: 9px; font-weight: 500; padding: 1px 6px; border-radius: 4px; background: #eef1ee; color: #666; text-transform: capitalize; margin-top: 2px; }
    .debit { color: #b83030; font-weight: 500; }
    .credit { color: #2d6a4f; font-weight: 500; }
    .dash { color: #ccc; }
    .bal-pos { color: #1c1c1c; font-weight: 600; }
    .bal-neg { color: #b83030; font-weight: 600; }
    table.ledger tfoot tr { background: #e8f0eb; border-top: 2px solid #2d6a4f; }
    table.ledger tfoot td { padding: 9px 11px; font-size: 11.5px; font-weight: 700; }
    table.ledger tfoot td.r { text-align: right; font-variant-numeric: tabular-nums; }

    /* Footer */
    .doc-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 9.5px; color: #bbb; }
    .no-data { text-align: center; padding: 50px 0; color: #aaa; font-size: 13px; }

    @media print {
      body { margin: 0; }
      .page { padding: 10mm 12mm 12mm; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="brand">
      <div class="brand-icon">🌿</div>
      <div>
        <div class="app-name">Farm Ledger</div>
        <div class="project-name">${stmtName}</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">Transaction Statement</div>
      <table class="meta-table">
        <tr><td>Period</td><td>${fmtDate(stmtFrom)} &ndash; ${fmtDate(stmtTo)}</td></tr>
        <tr><td>Generated</td><td>${printDate}</td></tr>
        <tr><td>Transactions</td><td>${stmtRows.length}</td></tr>
      </table>
    </div>
  </div>

  <div class="summary-strip">
    <div class="s-box">
      <div class="s-label">Total Income</div>
      <div class="s-value c-inc">&#8377;${fmtDec(stmtTotalIncome)}</div>
    </div>
    <div class="s-box">
      <div class="s-label">Total Expense</div>
      <div class="s-value c-exp">&#8377;${fmtDec(stmtTotalExpense)}</div>
    </div>
    <div class="s-box hi">
      <div class="s-label">Net Profit / Loss</div>
      <div class="s-value ${stmtNet >= 0 ? 'c-inc' : 'c-exp'}">&#8377;${fmtDec(stmtNet)}</div>
    </div>
    <div class="s-box">
      <div class="s-label">Closing Balance</div>
      <div class="s-value ${closingBal >= 0 ? 'c-inc' : 'c-exp'}">&#8377;${fmtDec(closingBal)}</div>
    </div>
  </div>

  ${stmtRows.length === 0
    ? '<div class="no-data">No transactions found for the selected period.</div>'
    : `<table class="ledger">
    <thead>
      <tr>
        <th style="width:72px">Date</th>
        <th>Description</th>
        <th class="r" style="width:96px">Debit (&#8377;)</th>
        <th class="r" style="width:96px">Credit (&#8377;)</th>
        <th class="r" style="width:106px">Balance (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      ${stmtRows.map(r => `
      <tr>
        <td class="date-col">${fmtDate(r.date)}</td>
        <td>
          <div class="desc-main">${r.description}</div>
          ${r.categories?.name ? `<div class="desc-cat">${r.categories.name}</div>` : ''}
          ${r.payment_method && r.payment_method !== 'cash' ? `<span class="pm-badge">${r.payment_method.replace('_', ' ')}</span>` : ''}
        </td>
        <td class="r">${r.isIncome ? '<span class="dash">&mdash;</span>' : `<span class="debit">${fmtDec(r.amount)}</span>`}</td>
        <td class="r">${r.isIncome ? `<span class="credit">${fmtDec(r.amount)}</span>` : '<span class="dash">&mdash;</span>'}</td>
        <td class="r ${r.balance >= 0 ? 'bal-pos' : 'bal-neg'}">${fmtDec(r.balance)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL</td>
        <td class="r debit">&#8377;${fmtDec(stmtTotalExpense)}</td>
        <td class="r credit">&#8377;${fmtDec(stmtTotalIncome)}</td>
        <td class="r ${stmtNet >= 0 ? 'credit' : 'debit'}">&#8377;${fmtDec(stmtNet)}</td>
      </tr>
    </tfoot>
  </table>`}

  <div class="doc-footer">
    <span>🌿 Farm Ledger &nbsp;&middot;&nbsp; ${stmtName}</span>
    <span>System-generated statement &nbsp;&middot;&nbsp; ${printDate}</span>
  </div>
</div>
</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  return (
    <div>
      {/* ════════════════════════════════
          EXISTING DASHBOARD — untouched
      ════════════════════════════════ */}
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

          <div className="card">
            <div className="chart-title">Project P&L Summary</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th><th>Type</th><th>Status</th>
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
                        <td style={{textAlign:'right',fontWeight:'600',color:profit >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmt(profit)}</td>
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
                    <td style={{textAlign:'right',color:projectSummary.reduce((s,p) => s + Number(p.total_income) - Number(p.total_expense), 0) >= 0 ? 'var(--green)' : 'var(--red)'}}>
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

      {/* ════════════════════════════════
          TRANSACTION STATEMENT SECTION
      ════════════════════════════════ */}
      <div className="card" style={{marginTop:'24px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
          <div>
            <div className="chart-title" style={{marginBottom:'2px'}}>Transaction Statement</div>
            <div style={{fontSize:'12.5px',color:'var(--gray-400)'}}>Generate a printable A4 ledger per project</div>
          </div>
          <div style={{width:'36px',height:'36px',borderRadius:'9px',background:'var(--green-light)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <i className="ti ti-file-invoice" style={{fontSize:'18px',color:'var(--green)'}}></i>
          </div>
        </div>

        <div style={{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'flex-end',padding:'16px',background:'var(--gray-50)',borderRadius:'10px',marginBottom:'16px'}}>
          <div className="form-group" style={{flex:'2',minWidth:'180px',margin:0}}>
            <label className="form-label">Project</label>
            <select className="form-control" value={stmtProject}
              onChange={e => { setStmtProject(e.target.value); setStmtGenerated(false) }}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{flex:'1',minWidth:'140px',margin:0}}>
            <label className="form-label">From Date</label>
            <input className="form-control" type="date" value={stmtFrom}max={new Date().toISOString().split('T')[0]}
  onChange={e => { setStmtFrom(e.target.value); setStmtGenerated(false) }} />
          </div>
          <div className="form-group" style={{flex:'1',minWidth:'140px',margin:0}}>
            <label className="form-label">To Date</label>
            <input className="form-control" type="date" value={stmtTo}max={new Date().toISOString().split('T')[0]}
  onChange={e => { setStmtFrom(e.target.value); setStmtGenerated(false) }} />
          </div>
          <button className="btn btn-primary" onClick={handleGenerateStatement}
            disabled={stmtLoading} style={{height:'38px',whiteSpace:'nowrap'}}>
            <i className="ti ti-table"></i> {stmtLoading ? 'Loading...' : 'Generate'}
          </button>
        </div>

        {stmtError && (
          <div style={{fontSize:'13px',color:'var(--red)',marginBottom:'12px'}}>
            <i className="ti ti-alert-circle"></i> {stmtError}
          </div>
        )}

        {stmtGenerated && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <div style={{fontSize:'13.5px',fontWeight:'600',color:'var(--gray-700)'}}>
                {stmtName}
                <span style={{fontWeight:'400',color:'var(--gray-400)',margin:'0 8px'}}>·</span>
                <span style={{fontWeight:'400',color:'var(--gray-500)',fontSize:'13px'}}>
                  {fmtDate(stmtFrom)} – {fmtDate(stmtTo)}
                </span>
              </div>
              <button className="btn btn-secondary" onClick={handlePrint}>
                <i className="ti ti-printer"></i> Print / Save PDF
              </button>
            </div>

            <div style={{display:'flex',marginBottom:'14px',border:'1px solid var(--gray-100)',borderRadius:'9px',overflow:'hidden'}}>
              {[
                { label:'Total Income',  value: fmt(stmtTotalIncome),  color:'var(--green)' },
                { label:'Total Expense', value: fmt(stmtTotalExpense), color:'var(--red)'   },
                { label:'Net Profit',    value: fmt(stmtNet),          color: stmtNet >= 0 ? 'var(--green)' : 'var(--red)' },
                { label:'Transactions',  value: stmtRows.length,       color:'var(--gray-700)' },
              ].map((s, i) => (
                <div key={i} style={{flex:1,padding:'11px 16px',borderRight:i < 3 ? '1px solid var(--gray-100)' : 'none'}}>
                  <div style={{fontSize:'10.5px',color:'var(--gray-400)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>{s.label}</div>
                  <div style={{fontSize:'16px',fontWeight:'700',color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="table-wrap">
              {stmtRows.length === 0 ? (
                <div style={{padding:'40px',textAlign:'center',color:'var(--gray-400)',fontSize:'13px'}}>
                  No transactions found for this period.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th style={{textAlign:'right'}}>Debit (₹)</th>
                      <th style={{textAlign:'right'}}>Credit (₹)</th>
                      <th style={{textAlign:'right'}}>Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmtRows.map(r => (
                      <tr key={r.id}>
                        <td style={{whiteSpace:'nowrap',color:'var(--gray-500)',fontSize:'12.5px'}}>{fmtDate(r.date)}</td>
                        <td>
                          <div style={{fontSize:'13px',fontWeight:'500'}}>{r.description}</div>
                          {r.categories?.name && (
                            <div style={{fontSize:'11px',color:'var(--gray-400)',marginTop:'1px'}}>{r.categories.name}</div>
                          )}
                        </td>
                        <td style={{textAlign:'right',fontSize:'13px',fontVariantNumeric:'tabular-nums',
                          color:r.isIncome ? 'var(--gray-300)' : 'var(--red)',fontWeight:r.isIncome ? '400' : '500'}}>
                          {r.isIncome ? '—' : fmt(r.amount)}
                        </td>
                        <td style={{textAlign:'right',fontSize:'13px',fontVariantNumeric:'tabular-nums',
                          color:r.isIncome ? 'var(--green)' : 'var(--gray-300)',fontWeight:r.isIncome ? '500' : '400'}}>
                          {r.isIncome ? fmt(r.amount) : '—'}
                        </td>
                        <td style={{textAlign:'right',fontSize:'13px',fontWeight:'600',fontVariantNumeric:'tabular-nums',
                          color:r.balance >= 0 ? 'var(--gray-800)' : 'var(--red)'}}>
                          {fmt(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--gray-100)',borderTop:'2px solid var(--gray-200)'}}>
                      <td colSpan={2} style={{fontWeight:'700',fontSize:'13px'}}>TOTAL</td>
                      <td style={{textAlign:'right',fontWeight:'700',fontSize:'13px',color:'var(--red)'}}>
                        {fmt(stmtTotalExpense)}
                      </td>
                      <td style={{textAlign:'right',fontWeight:'700',fontSize:'13px',color:'var(--green)'}}>
                        {fmt(stmtTotalIncome)}
                      </td>
                      <td style={{textAlign:'right',fontWeight:'700',fontSize:'13px',
                        color:stmtNet >= 0 ? 'var(--green)' : 'var(--red)'}}>
                        {fmt(stmtNet)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  )
}