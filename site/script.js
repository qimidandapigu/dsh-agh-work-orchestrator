const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const revealItems = document.querySelectorAll('.reveal')
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach(item => item.classList.add('is-visible'))
} else {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: 0.12 })
  revealItems.forEach(item => observer.observe(item))
}

const progress = document.querySelector('#page-progress')
const updateProgress = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0
  progress.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`
}
window.addEventListener('scroll', updateProgress, { passive: true })
updateProgress()

const navToggle = document.querySelector('.nav-toggle')
const nav = document.querySelector('#site-nav')
navToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open')
  navToggle.setAttribute('aria-expanded', String(open))
})
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('is-open')
  navToggle.setAttribute('aria-expanded', 'false')
}))

const demoButton = document.querySelector('#play-demo')
const demoSignals = [...document.querySelectorAll('.demo-signal')]
const flowCards = [...document.querySelectorAll('.flow-card')]
const gameStage = document.querySelector('.game-stage')
let demoTimers = []

const clearDemo = () => {
  demoTimers.forEach(window.clearTimeout)
  demoTimers = []
  demoSignals.forEach(signal => signal.classList.remove('active'))
  flowCards.forEach(card => card.classList.remove('is-active'))
  gameStage?.classList.remove('is-playing')
}

const runDemo = () => {
  clearDemo()
  document.querySelector('#demo').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  demoButton.textContent = '语音与小皮鞭演示中…'
  gameStage?.classList.add('is-playing')

  demoSignals.forEach((signal, index) => {
    demoTimers.push(window.setTimeout(() => {
      demoSignals.forEach(item => item.classList.remove('active'))
      signal.classList.add('active')
      const mappedCard = flowCards[[0, 1, 3][index]]
      flowCards.forEach(card => card.classList.remove('is-active'))
      mappedCard?.classList.add('is-active')
    }, 700 + index * 1800))
  })

  demoTimers.push(window.setTimeout(() => {
    demoButton.textContent = '再演示一次'
    flowCards.forEach(card => card.classList.remove('is-active'))
    gameStage?.classList.remove('is-playing')
  }, 700 + demoSignals.length * 1800))
}

demoButton.addEventListener('click', runDemo)
