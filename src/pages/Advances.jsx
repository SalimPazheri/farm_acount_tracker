import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import AdvanceModal from '../components/AdvanceModal'
import AllocationModal from '../components/AllocationModal'

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

const statusColors = {
  unallocated: { bg: 'var(--red-light)', color: 'var(--red)', label: 'Unallocated' },
  partial: { bg: 'var(--amber-light, #fff8e6)', color: '#c47a1a', label: 'Partial' },
  fully_allocated: { bg: 'var(--green-light)', color: 'var(--green)', label: 'Fully Allocated' },
}

const payMethodLabel = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', cheque: 'Cheque', other: 'Other' }

export default function Advances() {
  const [advances, setAdvances] = useState([])
  const [allocations, setAllocations] = useState({}) // keyed by advance_id
  const [loading, setLoading] = useState(true)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showAllocModal, setShowAllocModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [allocTarget, setAllocTarget] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadAdvances() }, [])

  async function loadAdvances() {
    setLoading(true)
    const { data } = await supabase
      .from('advances')
      .select('*')
      .order('date', { ascending: false })
    setAdvances(data || [])
    setLoading(false)
  }

  async function loadAllocations(advanceId) {
    const { data } = await supabase
      .from('advance_allocations')
      .select('*, projects(name), categories(name)')
      .eq('advance_id', advanceId)
      .order('date', { ascending: true })
    setAllocations(prev => ({ ...prev, [advanceId]: data || [] }))
  }

  function toggleExpand(id) {
    const next = !expanded[id]
    setExpanded(prev => ({ ...prev, [id]: next }))
    if (next && !allocations[id]) loadAllocations(id)
  }

  async function deleteAllocation(alloc, advanceId) {
    if (!confirm('Remove this allocation? The linked project transaction will also be deleted.')) return
    if (alloc.transaction_id) {
      await supabase.from('transactions').delete().eq('id', alloc.transaction_id)
    }
    await supabase.from('advance_allocations').delete().eq('id', alloc.id)
    await loadAllocations(advanceId)
    loadAdvances()
  }

  async function deleteAdvance(id) {
    if (!confirm('Delete this advance? All allocations and linked transactions will also be deleted.')) return
    // Get all allocations first to delete their transactions
    const { data: allocs } = await supabase
      .from('advance_allocations')
      .select('transaction_id')
      .eq('advance_id', id)

    for (const a of (allocs || [])) {
      if (a.transaction_id) {
        await supabase.from('transactions').delete().eq('id', a.transaction_id)
      }
    }
    await supabase.from('advances').delete().eq('id', id)
    loadAdvances()
  }

  const filtered = filter === 'all' ? advances : advances.filter(a => a.status === filter)

  const totalAdvanced = advances.reduce((s, a) => s + Number(a.amount), 0)
  const totalAllocated = advances.reduce((s, a) => s + Number(a.allocated_amount), 0)
  const totalRemaining = totalAdvanced - totalAllocated

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Advance Payments</div>
          <div className="page-sub">Track advances and allocate to projects when bills arrive</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdvanceModal(true) }}>
          <i className="ti ti-plus"></i> New Advance
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px 18px', flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '3px' }}>Total Advanced</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)' }}>{fmt(totalAdvanced)}</div>
        </div>
        <div style={{ background: 'var(--green-light)', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px 18px', flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '3px' }}>Allocated</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--green)' }}>{fmt(totalAllocated)}</div>
        </div>
        <div style={{ background: 'var(--red-light)', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px 18px', flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '3px' }}>Unallocated</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--red)' }}>{fmt(totalRemaining)}</div>
        </div>
        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px 18px', flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '3px' }}>Total Advances</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)' }}>{advances.length}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: '16px' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unallocated', label: 'Unallocated' },
          { key: 'partial', label: 'Partial' },
          { key: 'fully_allocated', label: 'Fully Allocated' },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><i className="ti ti-loader-2"></i> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="ti ti-cash"></i>
            <p>No advance payments found.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(adv => {
            const st = statusColors[adv.status]
            const remaining = Number(adv.amount) - Number(adv.allocated_amount)
            const pct = adv.amount > 0 ? Math.min((Number(adv.allocated_amount) / Number(adv.amount)) * 100, 100) : 0
            const isExpanded = expanded[adv.id]

            return (
              <div key={adv.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Main row */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(adv.id)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '7px', border: '1px solid var(--gray-200)',
                      background: isExpanded ? 'var(--gray-100)' : 'var(--white)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, color: 'var(--gray-500)'
                    }}
                  >
                    <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '14px' }}></i>
                  </button>

                  {/* Date */}
                  <div style={{ width: '80px', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {format(new Date(adv.date), 'dd MMM yyyy')}
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{adv.paid_to}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '1px' }}>{adv.purpose}</div>
                  </div>

                  {/* Progress */}
                  <div style={{ width: '140px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--gray-400)', marginBottom: '4px' }}>
                      <span>{fmt(adv.allocated_amount)} used</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--gray-100)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: adv.status === 'fully_allocated' ? 'var(--green)' : '#c47a1a', borderRadius: '10px', transition: 'width 0.3s' }}></div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{fmt(adv.amount)}</div>
                    {remaining > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--red)' }}>{fmt(remaining)} left</div>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                      background: st.bg, color: st.color
                    }}>{st.label}</span>
                  </div>

                  {/* Method */}
                  <div style={{ fontSize: '12px', color: 'var(--gray-400)', flexShrink: 0, width: '50px' }}>
                    {payMethodLabel[adv.payment_method]}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {adv.status !== 'fully_allocated' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setAllocTarget(adv); setShowAllocModal(true) }}
                        title="Allocate to project"
                      >
                        <i className="ti ti-arrow-fork"></i> Allocate
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setEditing(adv); setShowAdvanceModal(true) }}
                      title="Edit"
                    >
                      <i className="ti ti-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteAdvance(adv.id)}
                      title="Delete"
                    >
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Expanded allocations */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', padding: '12px 18px 12px 60px' }}>
                    {!allocations[adv.id] ? (
                      <div style={{ fontSize: '13px', color: 'var(--gray-400)' }}>Loading...</div>
                    ) : allocations[adv.id].length === 0 ? (
                      <div style={{ fontSize: '13px', color: 'var(--gray-400)', fontStyle: 'italic' }}>
                        No allocations yet. Click Allocate to assign to a project.
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                          Allocations
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {allocations[adv.id].map(alloc => (
                            <div key={alloc.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '8px 12px', background: 'var(--white)',
                              borderRadius: '8px', border: '1px solid var(--gray-200)'
                            }}>
                              <i className="ti ti-arrow-fork" style={{ color: 'var(--gray-300)', fontSize: '14px', flexShrink: 0 }}></i>
                              <div style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {format(new Date(alloc.date), 'dd MMM yyyy')}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '500' }}>{alloc.description}</div>
                                <div style={{ fontSize: '11.5px', color: 'var(--gray-400)' }}>
                                  {alloc.projects?.name}
                                  {alloc.categories?.name && <span> · {alloc.categories.name}</span>}
                                </div>
                              </div>
                              <div style={{ fontWeight: '600', color: 'var(--red)', fontSize: '13px', flexShrink: 0 }}>
                                {fmt(alloc.allocated_amount)}
                              </div>
                              <button
                                onClick={() => deleteAllocation(alloc, adv.id)}
                                style={{
                                  width: '26px', height: '26px', borderRadius: '6px',
                                  border: '1px solid var(--gray-200)', background: 'var(--white)',
                                  color: 'var(--red)', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', cursor: 'pointer', flexShrink: 0
                                }}
                                title="Remove allocation"
                              >
                                <i className="ti ti-trash" style={{ fontSize: '13px' }}></i>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', fontSize: '12.5px', color: 'var(--gray-500)' }}>
                          Total allocated: <strong style={{ marginLeft: '6px', color: 'var(--gray-700)' }}>{fmt(adv.allocated_amount)}</strong>
                          &nbsp;·&nbsp; Remaining: <strong style={{ marginLeft: '6px', color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(remaining)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdvanceModal && (
        <AdvanceModal
          advance={editing}
          onClose={() => setShowAdvanceModal(false)}
          onSaved={loadAdvances}
        />
      )}

      {showAllocModal && allocTarget && (
        <AllocationModal
          advance={allocTarget}
          onClose={() => { setShowAllocModal(false); setAllocTarget(null) }}
          onSaved={() => {
            loadAdvances()
            if (allocations[allocTarget.id]) loadAllocations(allocTarget.id)
          }}
        />
      )}
    </div>
  )
}