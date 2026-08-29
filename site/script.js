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
const chatRows = [...document.querySelectorAll('.chat-row')]
const flowCards = [...document.querySelectorAll('.flow-card')]
let demoTimers = []

const clearDemo = () => {
  demoTimers.forEach(window.clearTimeout)
  demoTimers = []
  chatRows.forEach(row => row.classList.remove('active'))
  flowCards.forEach(card => card.classList.remove('is-active'))
}

const runDemo = () => {
  clearDemo()
  document.querySelector('#demo').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  demoButton.textContent = '演示播放中…'

  chatRows.forEach((row, index) => {
    demoTimers.push(window.setTimeout(() => {
      chatRows.forEach(item => item.classList.remove('active'))
      row.classList.add('active')
      const mappedCard = flowCards[Math.min(index, flowCards.length - 1)]
      flowCards.forEach(card => card.classList.remove('is-active'))
      mappedCard?.classList.add('is-active')
    }, 700 + index * 1600))
  })

  demoTimers.push(window.setTimeout(() => {
    demoButton.textContent = '再播放一次'
    flowCards.forEach(card => card.classList.remove('is-active'))
  }, 700 + chatRows.length * 1600))
}

demoButton.addEventListener('click', runDemo)
