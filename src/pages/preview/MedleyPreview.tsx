import { useEffect, useState } from 'react'

type Step = '01' | 'cr' | 'choice'

const STEPS: Step[] = ['01', 'cr', 'choice']

export function MedleyPreview() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setIndex(i => (i + 1) % STEPS.length)
    }, 3500)
    return () => clearInterval(id)
  }, [paused])

  const current = STEPS[index]

  const label = current === '01'
    ? 'Game 1: 301 Master Out (Full Bull)'
    : current === 'cr'
      ? 'Game 2: Cricket'
      : 'Game 3: Choice (01 vs CR)'

  const description = current === '01'
    ? 'Auto demo of 301 MiMo with full bull.'
    : current === 'cr'
      ? 'Cricket board with marks and scoring.'
      : 'Cork winner chooses FIRST or GAME; loser picks between 301 MiMo or CR.'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 20% 20%, #111, #000)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Helvetica Condensed', sans-serif",
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/assets/gamescreenbackground.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.35,
      }} />

      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            background: paused ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div style={{
        position: 'relative',
        padding: '32px',
        borderRadius: '16px',
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: 640,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
          Medley Preview
        </div>
        <div style={{ marginTop: 12, fontSize: 18, opacity: 0.8 }}>
          {label}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.6 }}>
          {description}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.4)',
                background: i === index ? '#fff' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default MedleyPreview
